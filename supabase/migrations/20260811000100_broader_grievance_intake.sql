-- Broader municipal grievance intake. This migration intentionally keeps every
-- citizen complaint as an issue; similar reports may share an incident only.
-- It must run after the P2 privacy migration because it protects confidential issues.

insert into public.departments (name, slug)
values
  ('Housing and Urban Development', 'housing-urban-development'),
  ('Property Tax and Assessment', 'property-tax-assessment'),
  ('Birth, Death and Civil Registration', 'civil-registration'),
  ('Licensing and Citizen Services', 'licensing-citizen-services'),
  ('Women and Child Development', 'women-child-development'),
  ('Consumer and Market Regulation', 'consumer-market-regulation'),
  ('Environment and Pollution Control', 'environment-pollution-control'),
  ('Animal Welfare', 'animal-welfare'),
  ('Disaster Management', 'disaster-management'),
  ('Urban Planning and Encroachment', 'urban-planning-encroachment')
on conflict (slug) do update set name = excluded.name;

insert into public.categories (name, slug, icon, default_department_id)
select seed.name, seed.slug, seed.icon, d.id
from (values
  ('Housing or tenancy grievance', 'housing-tenancy-grievance', 'house', 'housing-urban-development'),
  ('Property tax or assessment grievance', 'property-tax-grievance', 'receipt-indian-rupee', 'property-tax-assessment'),
  ('Birth, death or marriage certificate', 'civil-registration-grievance', 'file-check-2', 'civil-registration'),
  ('Licence, permit or application delay', 'licence-permit-grievance', 'clipboard-check', 'licensing-citizen-services'),
  ('Women or child service grievance', 'women-child-service-grievance', 'heart-handshake', 'women-child-development'),
  ('Consumer, market or price grievance', 'consumer-market-grievance', 'shopping-bag', 'consumer-market-regulation'),
  ('Pollution, air, noise or environment', 'environment-pollution-grievance', 'leaf', 'environment-pollution-control'),
  ('Stray animal or animal welfare', 'animal-welfare-grievance', 'paw-print', 'animal-welfare'),
  ('Disaster, flood or emergency support', 'disaster-management-grievance', 'siren', 'disaster-management'),
  ('Encroachment or planning grievance', 'planning-encroachment-grievance', 'ruler', 'urban-planning-encroachment')
) as seed(name, slug, icon, department_slug)
join public.departments d on d.slug = seed.department_slug
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, default_department_id = excluded.default_department_id;

create table if not exists public.infrastructure_incidents (
  id uuid primary key default gen_random_uuid(), title text not null,
  category_id uuid references public.categories(id) on delete set null,
  latitude double precision, longitude double precision,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.infrastructure_incident_reports (
  incident_id uuid not null references public.infrastructure_incidents(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (incident_id, issue_id), unique (issue_id)
);
alter table public.infrastructure_incidents enable row level security;
alter table public.infrastructure_incident_reports enable row level security;
create policy "incident members can read incidents" on public.infrastructure_incidents for select to authenticated using (exists (
  select 1 from public.infrastructure_incident_reports r join public.issues i on i.id = r.issue_id
  where r.incident_id = infrastructure_incidents.id and (i.reporter_id = auth.uid() or public.current_role() in ('authority', 'supervisor', 'superadmin'))
));
create policy "incident members can read memberships" on public.infrastructure_incident_reports for select to authenticated using (exists (
  select 1 from public.issues i where i.id = infrastructure_incident_reports.issue_id and (i.reporter_id = auth.uid() or public.current_role() in ('authority', 'supervisor', 'superadmin'))
));
create or replace function public.link_issue_to_infrastructure_incident(p_issue_id uuid, p_similar_issue_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_issue public.issues%rowtype; v_anchor public.issues%rowtype; v_incident_id uuid;
begin
  select * into v_issue from public.issues where id = p_issue_id;
  select * into v_anchor from public.issues where id = p_similar_issue_id;
  if v_issue.id is null or v_anchor.id is null then raise exception 'Complaint not found'; end if;
  if v_issue.reporter_id <> auth.uid() then raise exception 'Only the reporter can group this complaint'; end if;
  if v_issue.id = v_anchor.id then raise exception 'A complaint cannot be grouped with itself'; end if;
  if v_anchor.is_confidential and v_anchor.reporter_id <> auth.uid() and public.current_role() not in ('authority', 'supervisor', 'superadmin') then raise exception 'The comparison complaint is not visible to you'; end if;
  if v_issue.category_id is distinct from v_anchor.category_id then raise exception 'Only complaints in the same service area can be grouped'; end if;
  if v_issue.geom is null or v_anchor.geom is null or not st_dwithin(v_issue.geom::geography, v_anchor.geom::geography, 200) then raise exception 'Only nearby complaints can be grouped'; end if;
  select incident_id into v_incident_id from public.infrastructure_incident_reports where issue_id = v_anchor.id;
  if v_incident_id is null then
    insert into public.infrastructure_incidents (title, category_id, latitude, longitude)
    values (v_anchor.title, v_anchor.category_id, st_y(v_anchor.geom::geometry), st_x(v_anchor.geom::geometry)) returning id into v_incident_id;
    insert into public.infrastructure_incident_reports (incident_id, issue_id) values (v_incident_id, v_anchor.id);
  end if;
  if exists (select 1 from public.infrastructure_incident_reports where issue_id = v_issue.id and incident_id <> v_incident_id) then raise exception 'This complaint is already grouped under another incident'; end if;
  insert into public.infrastructure_incident_reports (incident_id, issue_id) values (v_incident_id, v_issue.id) on conflict (issue_id) do update set incident_id = excluded.incident_id;
  return v_incident_id;
end; $$;
revoke all on function public.link_issue_to_infrastructure_incident(uuid, uuid) from public, anon;
grant execute on function public.link_issue_to_infrastructure_incident(uuid, uuid) to authenticated;
