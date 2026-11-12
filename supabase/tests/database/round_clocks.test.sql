-- Round clocks: set per quiz, optional, copied to the room and started by the phases that have one.
begin;
select plan(14);

create temp table fx on commit drop as select * from public.create_quiz('Board');
create function pg_temp.qid() returns uuid language sql as 'select quiz_id from fx';
create function pg_temp.qtok() returns text language sql as 'select owner_token from fx';
create function pg_temp.board(clock jsonb) returns jsonb language sql as $$
  select jsonb_build_object('title', 'Board', 'roundMultipliers', '[1]'::jsonb, 'rounds', '[
    {"categories":[{"title":"A","questions":[{"basePoints":100,"text":"Q","answerText":"A"}]}]}
  ]'::jsonb) || coalesce(clock, '{}'::jsonb)
$$;
create function pg_temp.get(key text) returns jsonb language sql as
  'select public.get_quiz(pg_temp.qid(), pg_temp.qtok()) -> key';

-- ---------------------------------------------------------------------------------- "Своя гра"

select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.board(null));
select is(pg_temp.get('buzzSeconds'), 'null'::jsonb, 'a board has no press clock by default');

select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.board('{"buzzSeconds": 15}'));
select is(pg_temp.get('buzzSeconds'), '15'::jsonb, 'the press clock is saved');
select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.board(null));
select is(pg_temp.get('buzzSeconds'), '15'::jsonb, 'a document without the key keeps the clock');
select throws_ok(
  $$select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.board('{"buzzSeconds": 3}'))$$,
  'P0001', 'invalid_document', 'a clock runs from 5 to 300 seconds'
);

create temp table r on commit drop as
  select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
create function pg_temp.room() returns public.rooms language sql as
  'select * from public.rooms where id = (select room_id from r)';
create temp table ann on commit drop as select * from public.join_room((select room_code from r), 'Ann');
select is((pg_temp.room()).buzz_seconds, 15, 'the room copies the quiz''s clock');

select public.start_game((select room_id from r), (select host_token from r));
select public.open_question((select room_id from r), (select host_token from r),
  (select id from public.room_cells where room_id = (select room_id from r)));
select is((pg_temp.room()).phase_ends_at, null, 'nothing runs while the question is read');
select public.open_buzz((select room_id from r), (select host_token from r));
select ok(
  (pg_temp.room()).phase_ends_at between now() + interval '14 s' and now() + interval '16 s',
  'opening the presses starts the clock'
);
select public.buzz((select room_id from r), (select player_id from ann), (select player_token from ann));
update public.rooms set phase_ends_at = now() - interval '1 h' where id = (select room_id from r);
select public.judge((select room_id from r), (select host_token from r), false);
select ok(
  (pg_temp.room()).phase_ends_at > now() + interval '14 s',
  'a wrong answer gives the others the whole clock again'
);

-- A board without a clock runs as before.
select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.board('{"buzzSeconds": null}'));
create temp table r2 on commit drop as
  select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
select public.join_room((select room_code from r2), 'Bob');
select public.start_game((select room_id from r2), (select host_token from r2));
select public.open_question((select room_id from r2), (select host_token from r2),
  (select id from public.room_cells where room_id = (select room_id from r2)));
select public.open_buzz((select room_id from r2), (select host_token from r2));
select is(
  (select phase_ends_at from public.rooms where id = (select room_id from r2)), null,
  'without a clock the presses stay open until the host acts'
);

-- ---------------------------------------------------------------------------------- "Варіанти"

create temp table bx on commit drop as select * from public.create_quiz('Bluff');
create function pg_temp.facts(clock jsonb) returns jsonb language sql as $$
  select jsonb_build_object('title', 'Bluff', 'mode', 'bluff', 'facts', (
    select jsonb_agg(jsonb_build_object('text', 'F' || i, 'truth', 'T' || i, 'decoy', 'D' || i))
    from generate_series(1, 5) as i
  )) || coalesce(clock, '{}'::jsonb)
$$;
select public.save_quiz((select quiz_id from bx), (select owner_token from bx), pg_temp.facts(null));
select is(
  public.get_quiz((select quiz_id from bx), (select owner_token from bx)) -> 'writingSeconds',
  '30'::jsonb, 'a bluff quiz gives 30 seconds to write by default'
);
select is(
  public.get_quiz((select quiz_id from bx), (select owner_token from bx)) -> 'votingSeconds',
  '20'::jsonb, 'and 20 to vote'
);

select public.save_quiz((select quiz_id from bx), (select owner_token from bx),
  pg_temp.facts('{"writingSeconds": null, "votingSeconds": 10}'));
create temp table br on commit drop as
  select * from public.create_room((select quiz_id from bx), (select owner_token from bx));
create function pg_temp.broom() returns public.rooms language sql as
  'select * from public.rooms where id = (select room_id from br)';
select public.join_room((select room_code from br), n) from unnest(array['A', 'B', 'C']) as n;
select is((pg_temp.broom()).writing_seconds, null, 'the room copies a switched-off clock');
select public.start_game((select room_id from br), (select host_token from br));
select is((pg_temp.broom()).phase_ends_at, null, 'writing without a clock waits for the host');
select public.bluff_open_voting((select room_id from br), (select host_token from br));
select ok(
  (pg_temp.broom()).phase_ends_at between now() + interval '9 s' and now() + interval '11 s',
  'voting runs its own clock'
);

select * from finish();
rollback;
