-- P1: accountable department operations after a grievance is lodged.

alter type public.user_role add value if not exists 'supervisor';
alter type public.media_type add value if not exists 'audio';
alter type public.media_type add value if not exists 'document';

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $body$ select public.current_role() in ('authority', 'supervisor', 'volunteer', 'superadmin'); $body$;

create table if not exists public.issue_assignments (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  officer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now()
);

create index if not exists issue_assignments_officer_idx on public.issue_assignments(officer_id, assigned_at desc);
alter table public.issue_assignments enable row level security;

create table if not exists public.issue_appeals (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  appellant_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 10 and 3000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  outcome text check (outcome in ('pending', 'upheld', 'declined')) not null default 'pending'
);

create index if not exists issue_appeals_issue_created_idx on public.issue_appeals(issue_id, created_at desc);
alter table public.issue_appeals enable row level security;

-- Officers and supervisors can see their departmental assignments; reporters
-- can see only their own appeal records.
create policy "assignment participants can read"
  on public.issue_assignments for select to authenticated
  using (
    officer_id = auth.uid() or public.is_staff()
    or exists (select 1 from public.issues i where i.id = issue_id and i.reporter_id = auth.uid())
  );
create policy "appeal participants can read"
  on public.issue_appeals for select to authenticated
  using (appellant_id = auth.uid() or public.is_staff());
create policy "reporters can create appeals"
  on public.issue_appeals for insert to authenticated
  with check (appellant_id = auth.uid() and exists (select 1 from public.issues i where i.id = issue_id and i.reporter_id = auth.uid()));

-- Supervisor and administrator only assignment RPC. It validates both the
-- officer role and department before changing ownership, and logs the action.
create or replace function public.assign_issue_officer(p_issue_id uuid, p_officer_id uuid)
returns void
language plpgsql security definer set search_path = public
as $body$
declare
  v_role text := public.current_role();
  v_issue_department uuid;
  v_actor_department uuid;
  v_officer_department uuid;
  v_officer_role text;
  v_status public.issue_status;
begin
  if v_role not in ('supervisor', 'superadmin') then
    raise exception 'Only supervisors and super administrators may assign officers';
  end if;
  select department_id, status into v_issue_department, v_status from public.issues where id = p_issue_id;
  if not found then raise exception 'Complaint not found'; end if;
  select department_id into v_actor_department from public.profiles where id = auth.uid();
  select department_id, role into v_officer_department, v_officer_role from public.profiles where id = p_officer_id;
  if v_officer_role <> 'authority' then raise exception 'Assignments must be made to a department officer'; end if;
  if v_issue_department is null or v_officer_department is distinct from v_issue_department then raise exception 'Officer must belong to the complaint department'; end if;
  if v_role = 'supervisor' and v_actor_department is distinct from v_issue_department then raise exception 'Supervisors may only assign officers in their own department'; end if;

  insert into public.issue_assignments (issue_id, officer_id, assigned_by)
  values (p_issue_id, p_officer_id, auth.uid())
  on conflict (issue_id) do update set officer_id = excluded.officer_id, assigned_by = excluded.assigned_by, assigned_at = now();
  insert into public.status_history (issue_id, from_status, to_status, actor_id, note)
  values (p_issue_id, v_status, v_status, auth.uid(), 'Assigned to department officer');
  insert into public.notifications (user_id, issue_id, title, body, dedupe_key)
  values (p_officer_id, p_issue_id, 'Complaint assigned to you', 'You have been assigned a complaint to investigate.', 'assignment:' || p_issue_id::text || ':' || p_officer_id::text)
  on conflict (dedupe_key) where dedupe_key is not null do update set created_at = now(), read = false;
end;
$body$;

create or replace function public.appeal_issue_resolution(p_issue_id uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = public
as $body$
declare
  v_issue public.issues%rowtype;
  v_appeal_id uuid;
begin
  select * into v_issue from public.issues where id = p_issue_id;
  if not found then raise exception 'Complaint not found'; end if;
  if v_issue.reporter_id <> auth.uid() then raise exception 'Only the reporter may appeal this complaint'; end if;
  if v_issue.status not in ('resolved', 'ai_validated', 'closed') then raise exception 'Only a completed complaint may be appealed'; end if;
  insert into public.issue_appeals (issue_id, appellant_id, reason) values (p_issue_id, auth.uid(), trim(p_reason)) returning id into v_appeal_id;
  update public.issues set status = 'reopened' where id = p_issue_id;
  insert into public.notifications (user_id, issue_id, title, body, dedupe_key)
  select p.id, p_issue_id, 'Resolution appeal: ' || v_issue.title, 'A citizen appealed the completed grievance and requests supervisor review.', 'appeal:' || v_appeal_id::text || ':' || p.id::text
  from public.profiles p
  where p.role in ('supervisor', 'superadmin') and (p.role = 'superadmin' or p.department_id = v_issue.department_id)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  return v_appeal_id;
end;
$body$;

-- Supervisors operate only their own department; assigned officers cannot
-- update someone else's assigned complaint. All status changes stay audited.
create or replace function public.on_issue_status_change()
returns trigger language plpgsql security definer set search_path = public
as $body$
declare
  v_role text := public.current_role();
  v_department uuid;
  v_assigned_officer uuid;
begin
  if new.status is distinct from old.status then
    select department_id into v_department from public.profiles where id = auth.uid();
    select officer_id into v_assigned_officer from public.issue_assignments where issue_id = new.id;
    if v_role = 'citizen' then
      if not ((old.status = 'reported' and new.status = 'rejected' and auth.uid() = new.reporter_id) or (old.status in ('resolved','ai_validated','closed') and new.status = 'reopened' and auth.uid() = new.reporter_id)) then raise exception 'Citizens may only withdraw or reopen their own complaint'; end if;
    elsif v_role = 'volunteer' then
      if not (old.status = 'reported' and new.status = 'community_verified') then raise exception 'Volunteers may only verify reported issues'; end if;
    elsif v_role = 'authority' then
      if v_department is null or new.department_id is distinct from v_department or (v_assigned_officer is not null and v_assigned_officer is distinct from auth.uid()) then raise exception 'Officers may only manage their assigned department complaints'; end if;
    elsif v_role = 'supervisor' then
      if v_department is null or new.department_id is distinct from v_department then raise exception 'Supervisors may only manage their own department complaints'; end if;
    elsif v_role <> 'superadmin' then raise exception 'Only authorised staff can change complaint status'; end if;
    if new.status = 'resolved' and not exists (select 1 from public.issue_media m where m.issue_id = new.id and m.kind = 'resolution') then raise exception 'Resolution evidence is required before marking resolved'; end if;
    if new.status = 'ai_validated' and not exists (select 1 from public.validations v where v.issue_id = new.id and v.verdict = 'genuine') then raise exception 'A genuine AI validation is required before marking AI validated'; end if;
    insert into public.status_history (issue_id, from_status, to_status, actor_id, note) values (new.id, old.status, new.status, auth.uid(), case when new.status = 'reopened' then 'Reopened after citizen appeal' when new.status = 'rejected' and auth.uid() = new.reporter_id then 'Withdrawn by reporter' else null end);
    if new.reporter_id is distinct from auth.uid() then
      insert into public.notifications (user_id, issue_id, title, body) values (new.reporter_id, new.id, new.title, 'Status updated: ' || replace(new.status::text, '_', ' '));
    end if;
    if new.status = 'acknowledged' and new.acknowledged_at is null then new.acknowledged_at = now();
    elsif new.status = 'resolved' and new.resolved_at is null then new.resolved_at = now(); perform public.adjust_trust(new.reporter_id, 4);
    elsif new.status = 'ai_validated' then perform public.award_points(new.reporter_id, 15); perform public.adjust_trust(new.reporter_id, 8);
    elsif new.status = 'closed' and new.closed_at is null then new.closed_at = now();
    elsif new.status = 'rejected' then perform public.adjust_trust(new.reporter_id, -10); end if;
  end if;
  if new.department_id is distinct from old.department_id and v_role not in ('authority','supervisor','superadmin') then raise exception 'Only authorised staff may assign departments'; end if;
  return new;
end;
$body$;

revoke all on function public.assign_issue_officer(uuid, uuid) from public, anon;
revoke all on function public.appeal_issue_resolution(uuid, text) from public, anon;
grant execute on function public.assign_issue_officer(uuid, uuid) to authenticated;
grant execute on function public.appeal_issue_resolution(uuid, text) to authenticated;

-- Supervisors share their department's SLA queue. They receive first-level
-- escalations immediately and can run the same idempotent escalation check.
create or replace function public.run_escalations()
returns integer
language plpgsql
security definer
set search_path = public, net
as $body$
declare
  v_count int := 0;
  r record;
  v_level1 int;
  v_level2 int;
  v_target int;
  v_current int;
begin
  if auth.uid() is not null and public.current_role() not in ('authority', 'supervisor', 'superadmin') then
    raise exception 'Only department staff and superadmins may trigger escalation checks';
  end if;

  for r in
    select
      i.id,
      i.title,
      i.department_id,
      i.created_at,
      extract(epoch from (now() - i.created_at)) / 86400.0 as age_days,
      coalesce(category_policy.level1_days, default_policy.level1_days, 3) as level1_days,
      coalesce(category_policy.level2_days, default_policy.level2_days, 7) as level2_days
    from public.issues i
    left join public.sla_policies category_policy on category_policy.category_id = i.category_id
    left join public.sla_policies default_policy on default_policy.category_id is null
    where i.status not in ('resolved', 'ai_validated', 'closed', 'rejected')
  loop
    v_level1 := greatest(r.level1_days, 0);
    v_level2 := greatest(r.level2_days, v_level1);
    v_target := case
      when r.age_days >= v_level2 then 2
      when r.age_days >= v_level1 then 1
      else 0
    end;

    if v_target = 0 then
      continue;
    end if;

    select coalesce(max(level), 0) into v_current
    from public.escalations where issue_id = r.id;

    if v_target > v_current then
      insert into public.escalations (issue_id, level, channel, reason)
      values (
        r.id,
        v_target,
        case when v_target >= 2 then 'higher_authority' else 'department' end,
        format('Unresolved for %s days', round(r.age_days))
      );

      insert into public.notifications (user_id, issue_id, title, body, dedupe_key)
      select
        p.id,
        r.id,
        case when v_target >= 2 then 'Level 2 escalation' else 'Issue escalation' end || ': ' || r.title,
        format('This issue has remained unresolved for %s days and reached escalation level %s.', round(r.age_days), v_target),
        format('escalation:%s:%s:%s', r.id, v_target, p.id)
      from public.profiles p
      where (p.role in ('authority', 'supervisor') and p.department_id = r.department_id)
         or (v_target >= 2 and p.role = 'superadmin')
      on conflict (dedupe_key) where dedupe_key is not null do nothing;

      begin
        perform net.http_post(
          url := 'https://bfxhcevcqkoxlsqlbcny.supabase.co/functions/v1/notify-department',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('type', 'escalation', 'issue_id', r.id)
        );
      exception when others then
        raise warning 'Could not enqueue department escalation email for issue %: %', r.id, sqlerrm;
      end;

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$body$;
