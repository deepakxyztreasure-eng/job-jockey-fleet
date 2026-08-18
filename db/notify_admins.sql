-- Run once in the SQL editor of the connected Supabase project.
-- Creates the notify_admins RPC used by the Jobs page (PGRST202 fix).

create or replace function public.notify_admins(
  p_title text,
  p_body text,
  p_type text,
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, type, job_id)
  select ur.user_id, p_title, p_body, p_type, p_job_id
  from public.user_roles ur
  where ur.role in ('super_admin', 'dispatch_admin')
  group by ur.user_id;
end;
$$;

revoke all on function public.notify_admins(text, text, text, uuid) from public, anon;
grant execute on function public.notify_admins(text, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
