create table if not exists public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade,
  level1_days int not null default 3 check (level1_days >= 0),
  level2_days int not null default 7 check (level2_days >= level1_days),
  updated_at timestamptz not null default now()
);

create unique index if not exists sla_policies_category_key
  on public.sla_policies (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.sla_policies enable row level security;

drop policy if exists "sla policies staff read" on public.sla_policies;
create policy "sla policies staff read" on public.sla_policies
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('authority', 'superadmin')));

drop policy if exists "sla policies superadmin write" on public.sla_policies;
create policy "sla policies superadmin write" on public.sla_policies
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));

create or replace function public.run_escalations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_level1 int;
  v_level2 int;
  v_target int;
  v_current int;
begin
  for r in
    select i.id, i.created_at,
           extract(epoch from (now() - i.created_at)) / 86400.0 as age_days,
           coalesce(category_policy.level1_days, default_policy.level1_days, 3) as level1_days,
           coalesce(category_policy.level2_days, default_policy.level2_days, 7) as level2_days
    from public.issues i
    left join public.sla_policies category_policy on category_policy.category_id = i.category_id
    left join public.sla_policies default_policy on default_policy.category_id is null
    where i.status not in ('resolved','ai_validated','closed','rejected')
  loop
    v_level1 := greatest(r.level1_days, 0);
    v_level2 := greatest(r.level2_days, v_level1);
    v_target := case when r.age_days >= v_level2 then 2 when r.age_days >= v_level1 then 1 else 0 end;
    if v_target = 0 then continue; end if;
    select coalesce(max(level), 0) into v_current from public.escalations where issue_id = r.id;
    if v_target > v_current then
      insert into public.escalations (issue_id, level, channel, reason)
      values (r.id, v_target,
              case when v_target >= 2 then 'higher_authority' else 'department' end,
              format('Unresolved for %s days', round(r.age_days)));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
