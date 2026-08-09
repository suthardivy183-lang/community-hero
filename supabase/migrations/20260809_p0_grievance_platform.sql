-- P0: citizen-first, multi-department grievance lodging and tracking.
-- This builds on the existing issues workflow without removing civic reporting.

alter type public.issue_status add value if not exists 'pending_information';
alter type public.issue_status add value if not exists 'reopened';

alter table public.issues
  add column if not exists complaint_number text;

create sequence if not exists public.grievance_complaint_sequence;

create or replace function public.generate_complaint_number()
returns trigger
language plpgsql
set search_path = public
as $body$
begin
  if new.complaint_number is null then
    new.complaint_number := format(
      'CH-%s-%s',
      to_char(current_date, 'YYYY'),
      lpad(nextval('public.grievance_complaint_sequence')::text, 6, '0')
    );
  end if;
  return new;
end;
$body$;

do $body$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'issues_generate_complaint_number'
      and tgrelid = 'public.issues'::regclass
  ) then
    create trigger issues_generate_complaint_number
      before insert on public.issues
      for each row execute function public.generate_complaint_number();
  end if;
end;
$body$;

create unique index if not exists issues_complaint_number_unique
  on public.issues (complaint_number)
  where complaint_number is not null;

-- One conversation per grievance. Citizens only see their own conversation;
-- authorised staff can respond while the database keeps the full history.
create table if not exists public.grievance_messages (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 3000),
  message_type text not null default 'message'
    check (message_type in ('message', 'information_request', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists grievance_messages_issue_created_idx
  on public.grievance_messages (issue_id, created_at);

alter table public.grievance_messages enable row level security;

do $body$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'grievance_messages'
      and policyname = 'grievance participants can read messages'
  ) then
    create policy "grievance participants can read messages"
      on public.grievance_messages for select to authenticated
      using (
        public.is_staff()
        or exists (
          select 1 from public.issues i
          where i.id = grievance_messages.issue_id
            and i.reporter_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'grievance_messages'
      and policyname = 'grievance participants can send messages'
  ) then
    create policy "grievance participants can send messages"
      on public.grievance_messages for insert to authenticated
      with check (
        sender_id = auth.uid()
        and (
          public.is_staff()
          or exists (
            select 1 from public.issues i
            where i.id = grievance_messages.issue_id
              and i.reporter_id = auth.uid()
          )
        )
      );
  end if;
end;
$body$;

do $body$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'grievance_messages'
    ) then
    execute 'alter publication supabase_realtime add table public.grievance_messages';
  end if;
end;
$body$;

-- Seed additional public-service departments. Existing city-specific rows are
-- preserved; these rows make the AI routing vocabulary broader than civic works.
insert into public.departments (name, slug)
values
  ('Health Services', 'health-services'),
  ('Education Services', 'education-services'),
  ('Public Transport', 'public-transport'),
  ('Electricity Services', 'electricity-services'),
  ('Revenue and Certificates', 'revenue-certificates'),
  ('Social Welfare', 'social-welfare'),
  ('Public Safety', 'public-safety')
on conflict (slug) do nothing;

insert into public.categories (name, slug, icon, default_department_id)
select seed.name, seed.slug, seed.icon, d.id
from (
  values
    ('Health service grievance', 'health-service-grievance', 'heart-pulse', 'health-services'),
    ('Education service grievance', 'education-service-grievance', 'graduation-cap', 'education-services'),
    ('Public transport grievance', 'public-transport-grievance', 'bus', 'public-transport'),
    ('Electricity service grievance', 'electricity-service-grievance', 'zap', 'electricity-services'),
    ('Revenue or certificate grievance', 'revenue-certificate-grievance', 'file-text', 'revenue-certificates'),
    ('Social welfare grievance', 'social-welfare-grievance', 'hand-heart', 'social-welfare'),
    ('Public safety grievance', 'public-safety-grievance', 'shield-alert', 'public-safety')
) as seed(name, slug, icon, department_slug)
join public.departments d on d.slug = seed.department_slug
on conflict (slug) do update
  set default_department_id = excluded.default_department_id;

-- Chat-first/no-media lodging path. The existing media reporting flow remains
-- intact, while this function lets a citizen lodge any government grievance.
create or replace function public.create_public_grievance(
  p_title text,
  p_description text,
  p_category_id uuid,
  p_department_id uuid,
  p_severity integer,
  p_lat double precision,
  p_lng double precision,
  p_address text default null,
  p_language text default 'en',
  p_ai_meta jsonb default '{}'::jsonb
)
returns table (issue_id uuid, complaint_number text)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_issue public.issues%rowtype;
  v_department_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must sign in to lodge a grievance';
  end if;

  if char_length(trim(coalesce(p_title, ''))) < 3 then
    raise exception 'A grievance title is required';
  end if;

  if char_length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Please provide enough detail for the department to act';
  end if;

  select coalesce(p_department_id, c.default_department_id)
    into v_department_id
  from public.categories c
  where c.id = p_category_id;

  insert into public.issues (
    reporter_id,
    title,
    description,
    category_id,
    department_id,
    severity,
    geom,
    address,
    ai_meta,
    tags
  ) values (
    auth.uid(),
    trim(p_title),
    trim(p_description),
    p_category_id,
    v_department_id,
    greatest(1, least(coalesce(p_severity, 5), 10)),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326),
    nullif(trim(coalesce(p_address, '')), ''),
    coalesce(p_ai_meta, '{}'::jsonb) || jsonb_build_object('intake', 'chat', 'language', p_language),
    array['public-grievance', 'chat-intake']
  ) returning * into v_issue;

  insert into public.status_history (issue_id, from_status, to_status, actor_id, note)
  values (v_issue.id, null, 'reported', auth.uid(), 'Lodged through the citizen grievance assistant');

  if v_department_id is not null then
    insert into public.notifications (user_id, issue_id, title, body, dedupe_key)
    select
      p.id,
      v_issue.id,
      'New grievance: ' || v_issue.complaint_number,
      'A new grievance has been assigned to your department: ' || v_issue.title,
      'new-grievance:' || v_issue.id::text || ':' || p.id::text
    from public.profiles p
    where p.role in ('authority', 'superadmin')
      and (p.role = 'superadmin' or p.department_id = v_department_id)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return query select v_issue.id, v_issue.complaint_number;
end;
$body$;

create or replace function public.my_complaint_reference(p_issue_id uuid)
returns text
language sql
security definer
set search_path = public
as $body$
  select i.complaint_number
  from public.issues i
  where i.id = p_issue_id
    and (i.reporter_id = auth.uid() or public.is_staff());
$body$;

revoke all on function public.create_public_grievance(text, text, uuid, uuid, integer, double precision, double precision, text, text, jsonb) from public, anon;
revoke all on function public.my_complaint_reference(uuid) from public, anon;
grant execute on function public.create_public_grievance(text, text, uuid, uuid, integer, double precision, double precision, text, text, jsonb) to authenticated;
grant execute on function public.my_complaint_reference(uuid) to authenticated;

-- A reporter may reopen only their own completed grievance. Everything else
-- remains controlled by the existing role/department guard.
create or replace function public.on_issue_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_role text := public.current_role();
  v_department uuid;
  v_notification_body text;
begin
  if new.status is distinct from old.status then
    select department_id into v_department from public.profiles where id = auth.uid();

    if v_role = 'citizen' then
      if not (
        (old.status = 'reported' and new.status = 'rejected' and auth.uid() = new.reporter_id)
        or (old.status in ('resolved', 'ai_validated', 'closed') and new.status = 'reopened' and auth.uid() = new.reporter_id)
      ) then
        raise exception 'Citizens may only withdraw a new report or reopen their own completed grievance';
      end if;
    elsif v_role = 'volunteer' then
      if not (old.status = 'reported' and new.status = 'community_verified') then
        raise exception 'Volunteers may only verify reported issues on the ground';
      end if;
    elsif v_role = 'authority' then
      if v_department is null or new.department_id is distinct from v_department then
        raise exception 'Authorities may only manage issues assigned to their department';
      end if;
    elsif v_role <> 'superadmin' then
      raise exception 'Only authorised staff can change issue status';
    end if;

    if new.status = 'resolved' and not exists (
      select 1 from public.issue_media m where m.issue_id = new.id and m.kind = 'resolution'
    ) then
      raise exception 'Resolution evidence is required before marking an issue resolved';
    end if;
    if new.status = 'ai_validated' and not exists (
      select 1 from public.validations v where v.issue_id = new.id and v.verdict = 'genuine'
    ) then
      raise exception 'A genuine AI validation is required before marking an issue AI validated';
    end if;

    insert into public.status_history (issue_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, new.status, auth.uid(), case
      when new.status = 'rejected' and auth.uid() = new.reporter_id then 'Withdrawn by reporter'
      when new.status = 'reopened' and auth.uid() = new.reporter_id then 'Reopened by reporter'
      when new.status = 'rejected' then 'Rejected by authority'
      else null end);

    if new.reporter_id is distinct from auth.uid() then
      v_notification_body := case
        when new.status = 'pending_information' then 'The department needs more information to progress your grievance.'
        when new.status = 'rejected' then 'Report rejected by the responsible authority. Open the report for its latest status.'
        when new.status = 'community_verified' then 'A volunteer verified this issue on the ground.'
        when new.status = 'acknowledged' then 'The responsible authority acknowledged your report.'
        when new.status = 'in_progress' then 'Work on your reported issue is now in progress.'
        when new.status = 'resolved' then 'The authority marked this issue resolved and uploaded repair proof.'
        when new.status = 'ai_validated' then 'The submitted repair proof passed AI validation.'
        when new.status = 'closed' then 'Your reported issue has been closed.'
        else 'Status updated: ' || replace(new.status::text, '_', ' ')
      end;
      insert into public.notifications (user_id, issue_id, title, body)
      values (new.reporter_id, new.id, new.title, v_notification_body);
    elsif new.status = 'reopened' then
      insert into public.notifications (user_id, issue_id, title, body, dedupe_key)
      select p.id, new.id, 'Grievance reopened: ' || new.title,
        'The reporter says this grievance still needs attention.',
        'reopened:' || new.id::text || ':' || p.id::text
      from public.profiles p
      where p.role in ('authority', 'superadmin')
        and (p.role = 'superadmin' or p.department_id = new.department_id)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    end if;

    if new.status = 'acknowledged' and new.acknowledged_at is null then new.acknowledged_at = now();
    elsif new.status = 'resolved' and new.resolved_at is null then new.resolved_at = now(); perform public.adjust_trust(new.reporter_id, 4);
    elsif new.status = 'ai_validated' then perform public.award_points(new.reporter_id, 15); perform public.adjust_trust(new.reporter_id, 8);
    elsif new.status = 'closed' and new.closed_at is null then new.closed_at = now();
    elsif new.status = 'rejected' then perform public.adjust_trust(new.reporter_id, -10);
    end if;
  end if;
  if new.department_id is distinct from old.department_id and v_role not in ('authority', 'superadmin') then
    raise exception 'Only authorities and superadmins may assign departments';
  end if;
  return new;
end;
$body$;
