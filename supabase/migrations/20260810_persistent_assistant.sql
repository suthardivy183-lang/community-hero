-- The assistant must never rely on a client-supplied reporter id. This RPC
-- returns only the authenticated citizen's own grievance summaries.
create or replace function public.my_grievance_summaries()
returns table (
  id uuid,
  title text,
  description text,
  category_name text,
  department_name text,
  status public.issue_status,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.title,
    i.description,
    c.name,
    d.name,
    i.status,
    i.created_at,
    i.resolved_at
  from public.issues i
  left join public.categories c on c.id = i.category_id
  left join public.departments d on d.id = i.department_id
  where i.reporter_id = auth.uid()
  order by i.created_at desc;
$$;

revoke all on function public.my_grievance_summaries() from public, anon;
grant execute on function public.my_grievance_summaries() to authenticated;
