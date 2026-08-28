begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

select has_table('public', 'app_state', 'app_state exists');
select col_is_pk('public', 'app_state', array['user_id', 'key'], 'primary key is (user_id, key)');
select col_not_null('public', 'app_state', 'value', 'value is not null');
select ok((select relrowsecurity from pg_class where oid = 'public.app_state'::regclass), 'RLS is enabled');
select policies_are(
  'public',
  'app_state',
  array['own rows: select', 'own rows: insert', 'own rows: update', 'own rows: delete'],
  'exactly the four owner-only policies exist'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$insert into public.app_state (user_id, key, value)
    values ('11111111-1111-1111-1111-111111111111', 'um.session.nf-fractions:x', '[]'::jsonb)$$,
  'a user writes their own row'
);
select lives_ok(
  $$insert into public.app_state (user_id, key, value)
    values ('11111111-1111-1111-1111-111111111111', 'um.session.nf-fractions:x', '[{"kind":"trial"}]'::jsonb)
    on conflict (user_id, key) do update set value = excluded.value, updated_at = now()$$,
  'and upserts it, the exact write shape the sync layer uses'
);
select results_eq(
  'select count(*)::int from public.app_state',
  array[1],
  'a user reads back exactly their own rows'
);

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is_empty('select * from public.app_state', 'another user reads nothing');
select throws_ok(
  $$insert into public.app_state (user_id, key, value)
    values ('11111111-1111-1111-1111-111111111111', 'um.theft', '"x"'::jsonb)$$,
  '42501',
  'new row violates row-level security policy for table "app_state"',
  'another user cannot write into rows they do not own'
);
select results_eq(
  $$with hit as (
      update public.app_state set value = '"tampered"'::jsonb
      where user_id = '11111111-1111-1111-1111-111111111111'
      returning 1
    ) select count(*)::int from hit$$,
  array[0],
  'an update aimed at another user touches zero rows'
);
select results_eq(
  $$with hit as (
      delete from public.app_state
      where user_id = '11111111-1111-1111-1111-111111111111'
      returning 1
    ) select count(*)::int from hit$$,
  array[0],
  'a delete aimed at another user touches zero rows'
);

set local role anon;
select throws_ok(
  'select * from public.app_state',
  '42501',
  'permission denied for table app_state',
  'anon cannot even select'
);
select throws_ok(
  $$insert into public.app_state (user_id, key, value)
    values ('11111111-1111-1111-1111-111111111111', 'um.x', '"x"'::jsonb)$$,
  '42501',
  'permission denied for table app_state',
  'anon cannot write at all'
);

select * from finish();
rollback;
