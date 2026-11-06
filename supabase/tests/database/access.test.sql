-- What an anonymous client can and cannot reach.
begin;
select plan(14);

-- Fixture created through the public API, as a host would.
create temp table fx on commit drop as
  select * from public.create_quiz('Quiz');
select public.save_quiz(
  (select quiz_id from fx), (select owner_token from fx),
  '{"title":"Quiz","roundMultipliers":[1],"rounds":[{"categories":[{"title":"C","questions":[
    {"basePoints":200,"text":"secret question","answerText":"secret answer"}]}]}]}'
);
create temp table room on commit drop as
  select * from public.create_room((select quiz_id from fx), (select owner_token from fx));
create temp table player on commit drop as
  select * from public.join_room((select room_code from room), 'Ann');
grant select on fx, room, player to anon;

set local role anon;

select throws_ok('select * from private.quizzes', '42501', null, 'private quizzes are unreachable');
select throws_ok('select * from private.questions', '42501', null, 'private questions are unreachable');
select throws_ok('select * from private.room_cell_contents', '42501', null, 'room copies are unreachable');
select throws_ok('select * from private.room_secrets', '42501', null, 'host tokens are unreachable');
select throws_ok('select * from private.player_secrets', '42501', null, 'player tokens are unreachable');

select throws_ok(
  $$update public.players set score = 9000$$, '42501', null, 'players cannot be changed directly'
);
select throws_ok(
  $$update public.rooms set state = 'finished'$$, '42501', null, 'rooms cannot be changed directly'
);
select throws_ok(
  $$insert into public.players (room_id, nickname) select room_id, 'x' from room$$,
  '42501', null, 'players cannot be inserted directly'
);
select throws_ok($$truncate public.rooms cascade$$, '42501', null, 'rooms cannot be truncated');
select throws_ok(
  $$select private.hash_token('x')$$, '42501', null, 'private helpers are not executable'
);

select is(
  (select question_text from public.rooms where id = (select room_id from room)),
  null, 'an unopened question is not visible in the room'
);
select is(
  (select count(*)::int from public.room_cells
   where to_jsonb(room_cells)::text like '%secret%'),
  0, 'the public board holds no question or answer text'
);
select throws_ok(
  $$select public.get_quiz((select quiz_id from fx), 'wrong')$$,
  'P0001', 'not_authorized', 'a quiz is readable only with its token'
);
select lives_ok(
  $$select public.get_quiz((select quiz_id from fx), (select owner_token from fx))$$,
  'the owner reads the quiz'
);

select * from finish();
rollback;
