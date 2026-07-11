-- Align database enforcement with the citizen / volunteer / authority role matrix.
create or replace function public.on_issue_status_change()
returns trigger language plpgsql security definer set search_path to public as $body$
declare
  v_role text := public.current_role();
  v_department uuid;
begin
  if new.status is distinct from old.status then
    select department_id into v_department from public.profiles where id = auth.uid();

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

    if new.status = 'resolved' and not exists (select 1 from public.issue_media m where m.issue_id = new.id and m.kind = 'resolution') then
      raise exception 'Resolution evidence is required before marking an issue resolved';
    end if;
    if new.status = 'ai_validated' and not exists (select 1 from public.validations v where v.issue_id = new.id and v.verdict = 'genuine') then
      raise exception 'A genuine AI validation is required before marking an issue AI validated';
    end if;

    insert into public.status_history (issue_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, new.status, auth.uid(), case when new.status = 'rejected' and auth.uid() = new.reporter_id then 'Withdrawn by reporter' else null end);
    if new.reporter_id is distinct from auth.uid() and new.status <> 'rejected' then
      insert into public.notifications (user_id, issue_id, title, body) values (new.reporter_id, new.id, new.title, 'Status updated: ' || replace(new.status::text, '_', ' '));
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
