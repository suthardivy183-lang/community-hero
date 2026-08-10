-- P2: differentiated public-service access, confidentiality and interoperable updates.

alter table public.issues
  add column if not exists is_confidential boolean not null default false,
  add column if not exists consent_to_share boolean not null default false,
  add column if not exists data_retention_until timestamptz;

create index if not exists issues_public_map_idx
  on public.issues (created_at desc)
  where is_confidential = false;

-- The public feed is the privacy boundary for maps, search, dashboards and
-- Open311 export. A reporter and authorised department staff may still open a
-- confidential complaint directly, but it is never returned to the public.
create or replace view public.issues_view
with (security_invoker = true)
as
select
  i.id, i.reporter_id, i.title, i.description, i.category_id, i.department_id,
  i.severity, i.severity_score, i.severity_factors, i.near_hospital, i.near_school,
  i.road_class, i.status, i.address, i.tags, i.ai_meta, i.confirm_count, i.vote_count,
  i.comment_count, i.created_at, i.acknowledged_at, i.resolved_at, i.closed_at,
  st_y(i.geom::geometry)::double precision as lat, st_x(i.geom::geometry)::double precision as lng,
  c.name as category_name, c.slug as category_slug, c.icon as category_icon,
  d.name as department_name, p.full_name as reporter_name, p.avatar_url as reporter_avatar,
  p.trust_score as reporter_trust, i.is_confidential, i.consent_to_share
from public.issues i
left join public.categories c on c.id = i.category_id
left join public.departments d on d.id = i.department_id
left join public.profiles p on p.id = i.reporter_id
where i.is_confidential = false
   or i.reporter_id = auth.uid()
   or public.current_role() in ('authority', 'supervisor', 'superadmin');

create or replace function public.issues_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  p_status text default null,
  p_category uuid default null,
  p_limit integer default 400
)
returns setof public.issues_view
language sql stable security invoker set search_path = public
as $body$
  select * from public.issues_view
  where lng between min_lng and max_lng
    and lat between min_lat and max_lat
    and (p_status is null or status::text = p_status)
    and (p_category is null or category_id = p_category)
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 400), 500));
$body$;

create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'declined')),
  completed_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.external_status_updates (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  source text not null,
  external_reference text not null,
  status public.issue_status not null,
  note text,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (source, external_reference, status, received_at)
);

create index if not exists external_status_updates_issue_idx on public.external_status_updates(issue_id, received_at desc);

alter table public.data_deletion_requests enable row level security;
alter table public.external_status_updates enable row level security;

create policy "citizens can request own data deletion"
  on public.data_deletion_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy "citizens read own deletion requests"
  on public.data_deletion_requests for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'superadmin');
create policy "staff can read external updates"
  on public.external_status_updates for select to authenticated
  using (public.current_role() in ('authority', 'supervisor', 'superadmin'));

create or replace function public.request_data_deletion(p_reason text default null)
returns uuid
language plpgsql security definer set search_path = public
as $body$
declare v_id uuid;
begin
  insert into public.data_deletion_requests (user_id, reason)
  values (auth.uid(), nullif(trim(p_reason), ''))
  returning id into v_id;
  return v_id;
end;
$body$;

-- A reporter can always hide their own identity and evidence from public map/feed
-- views. Department staff continue to access it to resolve the case.
create or replace function public.set_issue_privacy(
  p_issue_id uuid,
  p_is_confidential boolean,
  p_consent_to_share boolean default false
)
returns void
language plpgsql security definer set search_path = public
as $body$
begin
  update public.issues
  set is_confidential = p_is_confidential,
      consent_to_share = case when p_is_confidential then false else p_consent_to_share end
  where id = p_issue_id and reporter_id = auth.uid();
  if not found then raise exception 'Only the reporter may change this privacy setting'; end if;
end;
$body$;

-- External systems do not write tables directly. The protected Edge Function
-- calls this RPC with the service role after validating its webhook secret.
create or replace function public.import_open311_status(
  p_external_reference text,
  p_status public.issue_status,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $body$
declare v_issue_id uuid;
begin
  select id into v_issue_id from public.issues where complaint_number = p_external_reference or id::text = p_external_reference;
  if v_issue_id is null then raise exception 'No CommunityHero complaint matches %', p_external_reference; end if;
  insert into public.external_status_updates (issue_id, source, external_reference, status, note, payload)
  values (v_issue_id, 'open311', p_external_reference, p_status, p_note, coalesce(p_payload, '{}'::jsonb));
  update public.issues set status = p_status where id = v_issue_id and status is distinct from p_status;
  return v_issue_id;
end;
$body$;

grant execute on function public.set_issue_privacy(uuid, boolean, boolean) to authenticated;
grant execute on function public.request_data_deletion(text) to authenticated;
revoke all on function public.import_open311_status(text, public.issue_status, text, jsonb) from public, anon, authenticated;

-- Public dashboard metrics intentionally exclude confidential grievances.
create or replace function public.public_transparency_summary()
returns table (
  total_complaints bigint,
  resolved_complaints bigint,
  average_response_hours numeric,
  escalation_rate numeric
)
language sql stable security definer set search_path = public
as $body$
  with public_issues as (
    select * from public.issues where is_confidential = false
  )
  select
    count(*) as total_complaints,
    count(*) filter (where status in ('resolved', 'ai_validated', 'closed')) as resolved_complaints,
    round(avg(extract(epoch from (resolved_at - created_at)) / 3600.0) filter (where resolved_at is not null), 1) as average_response_hours,
    round((count(*) filter (where exists (select 1 from public.escalations e where e.issue_id = public_issues.id))::numeric / nullif(count(*), 0)) * 100, 1) as escalation_rate
  from public_issues;
$body$;

grant execute on function public.public_transparency_summary() to anon, authenticated;
