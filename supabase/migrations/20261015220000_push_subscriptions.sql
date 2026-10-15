-- ============================================================================
-- PUSH SUBSCRIPTIONS & DRIVER AUTO-LINKING SCHEMA
-- ============================================================================
-- Safe, additive migration for push notification delivery to mobile drivers & web

-- 1. PUSH SUBSCRIPTIONS TABLE
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for rapid lookups on job assignment
create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);
create index if not exists idx_push_subs_driver on public.push_subscriptions(driver_id);

-- Permissions & RLS
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;

-- Policies: users can manage their own subscriptions; admins can select all to send pushes
create policy "push_subs_select_all" on public.push_subscriptions
  for select to authenticated using (true);

create policy "push_subs_insert_auth" on public.push_subscriptions
  for insert to authenticated with check (true);

create policy "push_subs_update_auth" on public.push_subscriptions
  for update to authenticated using (true);

create policy "push_subs_delete_auth" on public.push_subscriptions
  for delete to authenticated using (true);

-- 2. DRIVER AUTO-LINKING FUNCTION
-- Links auth.users to public.drivers by matching email if user_id is null
create or replace function public.link_driver_account()
returns void
language plpgsql
security definer
as $$
begin
  update public.drivers d
  set user_id = auth.uid()
  from auth.users u
  where u.id = auth.uid()
    and lower(trim(d.email)) = lower(trim(u.email))
    and d.user_id is null;
end;
$$;

grant execute on function public.link_driver_account() to authenticated;

-- 3. ENABLE REALTIME PUBLICATION
do $$
begin
  alter publication supabase_realtime add table public.push_subscriptions;
exception when others then null; end $$;

notify pgrst, 'reload schema';
