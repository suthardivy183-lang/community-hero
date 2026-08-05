-- Role-aware notification delivery for report progress and SLA escalation.
-- This migration is forward-only. Existing notifications remain unchanged;
-- dedupe_key is nullable so historical rows require no backfill.

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

-- Ensure inserts reach the signed-in recipient without requiring a refresh.
do $body$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$body$;

-- Preserve the role/department status guard while notifying the reporter for
-- every authority-driven transition, including rejection. Self-withdrawal is
-- intentionally silent because the reporter initiated it.
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
    select department_id into v_department
    from public.profiles
    where id = auth.uid();

    if v_role = 'citizen' then
      if not (old.status = 'reported' and new.status = 'rejected' and auth.uid() = new.reporter_id) then
        raise exception 'Citizens may only withdraw their own reported issue';
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
      select 1 from public.issue_media m
      where m.issue_id = new.id and m.kind = 'resolution'
    ) then
      raise exception 'Resolution evidence is required before marking an issue resolved';
    end if;

    if new.status = 'ai_validated' and not exists (
      select 1 from public.validations v
      where v.issue_id = new.id and v.verdict = 'genuine'
    ) then
      raise exception 'A genuine AI validation is required before marking an issue AI validated';
    end if;

    insert into public.status_history (issue_id, from_status, to_status, actor_id, note)
    values (
      new.id,
      old.status,
      new.status,
      auth.uid(),
      case
        when new.status = 'rejected' and auth.uid() = new.reporter_id then 'Withdrawn by reporter'
        when new.status = 'rejected' then 'Rejected by authority'
        else null
      end
    );

    if new.reporter_id is distinct from auth.uid() then
      v_notification_body := case
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
    end if;

    if new.status = 'acknowledged' and new.acknowledged_at is null then
      new.acknowledged_at = now();
    elsif new.status = 'resolved' and new.resolved_at is null then
      new.resolved_at = now();
      perform public.adjust_trust(new.reporter_id, 4);
    elsif new.status = 'ai_validated' then
      perform public.award_points(new.reporter_id, 15);
      perform public.adjust_trust(new.reporter_id, 8);
    elsif new.status = 'closed' and new.closed_at is null then
      new.closed_at = now();
    elsif new.status = 'rejected' then
      perform public.adjust_trust(new.reporter_id, -10);
    end if;
  end if;

  if new.department_id is distinct from old.department_id
     and v_role not in ('authority', 'superadmin') then
    raise exception 'Only authorities and superadmins may assign departments';
  end if;

  return new;
end;
$body$;

-- Insert the next SLA level once, notify the assigned department's authority
-- accounts, notify superadmins for L2, and enqueue the existing email function.
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
  if auth.uid() is not null and public.current_role() not in ('authority', 'superadmin') then
    raise exception 'Only authorities and superadmins may trigger escalation checks';
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
    left join public.sla_policies category_policy
      on category_policy.category_id = i.category_id
    left join public.sla_policies default_policy
      on default_policy.category_id is null
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

    select coalesce(max(level), 0)
    into v_current
    from public.escalations
    where issue_id = r.id;

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
        format(
          'This issue has remained unresolved for %s days and reached escalation level %s.',
          round(r.age_days),
          v_target
        ),
        format('escalation:%s:%s:%s', r.id, v_target, p.id)
      from public.profiles p
      where (p.role = 'authority' and p.department_id = r.department_id)
         or (v_target >= 2 and p.role = 'superadmin')
      on conflict (dedupe_key) where dedupe_key is not null do nothing;

      begin
        perform net.http_post(
          url := 'https://bfxhcevcqkoxlsqlbcny.supabase.co/functions/v1/notify-department',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('type', 'escalation', 'issue_id', r.id)
        );
      exception when others then
        -- Notification records and escalation state must survive an email outage.
        raise warning 'Could not enqueue department escalation email for issue %: %', r.id, sqlerrm;
      end;

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$body$;

-- Keep the existing dashboard RPC name working while sharing one implementation.
create or replace function public.trigger_escalations()
returns integer
language sql
security definer
set search_path = public
as $body$
  select public.run_escalations();
$body$;

revoke execute on function public.run_escalations() from public, anon;
revoke execute on function public.trigger_escalations() from public, anon;
grant execute on function public.run_escalations() to authenticated;
grant execute on function public.trigger_escalations() to authenticated;

-- Run once per hour. The function itself is idempotent per issue and SLA level.
select cron.schedule(
  'community-hero-escalations',
  '0 * * * *',
  $cron$select public.run_escalations();$cron$
)
where not exists (
  select 1 from cron.job where jobname = 'community-hero-escalations'
);
