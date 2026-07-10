-- Citizen repair verification.
create table if not exists public.fix_feedback (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  satisfied boolean not null,
  created_at timestamptz not null default now(),
  unique (issue_id, user_id)
);

alter table public.fix_feedback enable row level security;
grant select on public.fix_feedback to anon, authenticated;
grant insert on public.fix_feedback to authenticated;
drop policy if exists "fix feedback read public" on public.fix_feedback;
create policy "fix feedback read public" on public.fix_feedback for select using (true);
drop policy if exists "fix feedback insert own" on public.fix_feedback;
create policy "fix feedback insert own" on public.fix_feedback for insert to authenticated with check (auth.uid() = user_id);

-- Upserted avatar objects need authenticated read access during the Storage operation.
drop policy if exists "issue media authenticated read" on storage.objects;
create policy "issue media authenticated read" on storage.objects for select to authenticated using (bucket_id = 'issue-media');

-- Keep staff transitions intact while allowing a reporter to withdraw only their own
-- still-new report. Existing status bookkeeping remains in the trigger.
create or replace function public.on_issue_status_change()
returns trigger language plpgsql security definer set search_path to public as $body$
begin
  if new.status is distinct from old.status then
    if not public.is_staff()
       and not (old.status = 'reported' and new.status = 'community_verified')
       and not (old.status = 'reported' and new.status = 'rejected' and auth.uid() = new.reporter_id) then
      raise exception 'Only staff can change issue status';
    end if;
    insert into public.status_history (issue_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, new.status, auth.uid(),
      case when new.status = 'rejected' and auth.uid() = new.reporter_id then 'Withdrawn by reporter' else null end);
    if new.reporter_id is distinct from auth.uid() and new.status <> 'rejected' then
      insert into public.notifications (user_id, issue_id, title, body)
      values (new.reporter_id, new.id, new.title, 'Status updated: ' || replace(new.status::text, '_', ' '));
    end if;
    if new.status = 'acknowledged' and new.acknowledged_at is null then
      new.acknowledged_at = now();
    elsif new.status = 'resolved' and new.resolved_at is null then
      new.resolved_at = now(); perform public.adjust_trust(new.reporter_id, 4);
    elsif new.status = 'ai_validated' then
      perform public.award_points(new.reporter_id, 15); perform public.adjust_trust(new.reporter_id, 8);
    elsif new.status = 'closed' and new.closed_at is null then
      new.closed_at = now();
    elsif new.status = 'rejected' then
      perform public.adjust_trust(new.reporter_id, -10);
    end if;
  end if;
  return new;
end;
$body$;
