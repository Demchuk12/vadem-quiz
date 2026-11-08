-- Calls made with the host's own AI key.
begin;
select plan(6);

create temp table fx on commit drop as select * from public.create_quiz('Quiz');
grant select on fx to anon, service_role;

set local role anon;
select throws_ok(
  $$select public.consume_own_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  '42501', null, 'the browser cannot count calls directly'
);
reset role;

set local role service_role;
select throws_ok(
  $$select public.consume_own_ai_call((select quiz_id from fx), 'wrong')$$,
  'P0001', 'not_authorized', 'a call needs the token of the quiz'
);
select lives_ok(
  $$select public.consume_own_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'the owner can make a call with their own key'
);
reset role;

select is(
  (select (calls, own_calls)::text from private.ai_usage),
  '(0,1)',
  'own calls are counted apart from the shared free quota'
);

-- The shared quota is spent, yet own keys still work: they are paid by the host.
update private.ai_usage set calls = 150;
set local role service_role;
select lives_ok(
  $$select public.consume_own_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'own keys do not depend on the shared quota'
);
reset role;

update private.ai_usage set own_calls = 200;
set local role service_role;
select throws_ok(
  $$select public.consume_own_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'P0001', 'ai_limit', 'own keys have a daily limit of their own'
);
reset role;

select * from finish();
rollback;
