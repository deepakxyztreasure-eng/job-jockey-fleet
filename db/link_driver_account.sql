-- Links the signed-in driver's login to their driver record (matched by email).
create or replace function public.link_driver_account()
returns uuid language plpgsql security definer set search_path = public as $$
declare _email text; _id uuid; _name text;
begin
  select email, coalesce(raw_user_meta_data->>'full_name', email) into _email, _name from auth.users where id = auth.uid();
  if _email is null then return null; end if;
  select id into _id from public.drivers where user_id = auth.uid() limit 1;
  if _id is not null then return _id; end if;
  update public.drivers set user_id = auth.uid()
   where id = (select id from public.drivers where lower(email) = lower(_email) order by created_at limit 1)
   returning id into _id;
  if _id is null and public.has_role(auth.uid(), 'driver') then
    insert into public.drivers (user_id, email, full_name, active) values (auth.uid(), _email, _name, true) returning id into _id;
  end if;
  return _id;
end $$;
grant execute on function public.link_driver_account() to authenticated;

-- One-time repair for existing drivers (incl. malkit@gmail.com):
update public.drivers d set user_id = u.id
  from auth.users u
 where lower(d.email) = lower(u.email)
   and (d.user_id is null or d.user_id not in (select id from auth.users));
notify pgrst, 'reload schema';
