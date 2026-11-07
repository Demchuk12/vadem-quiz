-- The daily limit of AI generation.
begin;
select plan(8);

create temp table fx on commit drop as select * from public.create_quiz('Quiz');
grant select on fx to anon, service_role;

set local role anon;
select throws_ok(
  $$select public.consume_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  '42501', null, 'the browser cannot spend AI calls directly'
);
reset role;

set local role service_role;
select throws_ok(
  $$select public.consume_ai_call((select quiz_id from fx), 'wrong')$$,
  'P0001', 'not_authorized', 'a call needs the token of the quiz'
);
select lives_ok(
  $$select public.consume_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'the owner can spend a call'
);
reset role;

select is((select calls from private.ai_usage), 1, 'calls are counted');

update private.ai_usage set calls = 39;
set local role service_role;
select lives_ok(
  $$select public.consume_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'one quiz has room to write and then edit: forty calls a day'
);
select throws_ok(
  $$select public.consume_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'P0001', 'ai_limit', 'one quiz has a daily limit'
);
reset role;

update private.ai_usage set calls = 39;
create temp table other on commit drop as select * from public.create_quiz('Other');
grant select on other to service_role;
insert into private.ai_usage (quiz_id, calls) select quiz_id, 111 from other;
set local role service_role;
select throws_ok(
  $$select public.consume_ai_call((select quiz_id from fx), (select owner_token from fx))$$,
  'P0001', 'ai_limit', 'the whole app has a daily limit'
);
reset role;

delete from private.quizzes where id = (select quiz_id from fx);
select is((select count(*)::int from private.ai_usage where quiz_id = (select quiz_id from fx)), 0, 'usage goes with its quiz');

select * from finish();
rollback;
