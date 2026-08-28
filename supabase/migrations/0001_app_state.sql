create table public.app_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.app_state enable row level security;

create policy "own rows: select" on public.app_state
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "own rows: insert" on public.app_state
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own rows: update" on public.app_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own rows: delete" on public.app_state
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.app_state to authenticated;

revoke select, insert, update, delete, references, trigger on table public.app_state from anon;
