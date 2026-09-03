revoke all on table public.app_state from anon, authenticated;

grant select, insert, update, delete on table public.app_state to authenticated;
