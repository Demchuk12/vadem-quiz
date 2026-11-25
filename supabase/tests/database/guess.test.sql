-- The "На око" mode: places, ties, exact hits, the double last question, and its secrets.
begin;
select plan(45);

create temp table fx on commit drop as select * from public.create_quiz('Guess');
create function pg_temp.qid() returns uuid language sql as 'select quiz_id from fx';
create function pg_temp.qtok() returns text language sql as 'select owner_token from fx';
create function pg_temp.doc(n int, patch jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('title', 'Guess', 'mode', 'guess', 'guesses', (
    select jsonb_agg(jsonb_build_object(
      'text', 'Question ' || i, 'answer', i * 100, 'unit', case when i = 1 then 'км' else '' end,
      'explanation', case when i = 1 then 'Because.' else '' end
    ) order by i) from generate_series(1, n) as i
  )) || patch
$$;
create function pg_temp.save(doc jsonb) returns void language sql as
  'select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), doc)';
create function pg_temp.quiz() returns jsonb language sql as
  'select public.get_quiz(pg_temp.qid(), pg_temp.qtok())';

-- ------------------------------------------------------------------------------------- the quiz

select pg_temp.save(pg_temp.doc(4));
select is(pg_temp.quiz() ->> 'mode', 'guess', 'the document saves a guess quiz');
select is(jsonb_array_length(pg_temp.quiz() -> 'guesses'), 4, 'its questions come back');
select is(pg_temp.quiz() -> 'guessSeconds', '30'::jsonb, 'thirty seconds to answer by default');
select throws_ok('select public.create_room(pg_temp.qid(), pg_temp.qtok())',
  'P0001', 'too_few_questions', 'a game needs at least five questions');
select lives_ok($$select pg_temp.save(jsonb_set(pg_temp.doc(5), '{guesses,2,answer}', 'null'))$$,
  'a draft may miss an answer');
select throws_ok('select public.create_room(pg_temp.qid(), pg_temp.qtok())',
  'P0001', 'quiz_incomplete', 'a game may not');
select throws_ok($$select pg_temp.save(pg_temp.doc(21))$$,
  'P0001', 'invalid_document', 'twenty questions at most');
select throws_ok($$select pg_temp.save(jsonb_set(pg_temp.doc(5), '{guesses,0,answer}', '"many"'))$$,
  'P0001', 'invalid_document', 'an answer is a number');
select throws_ok($$select pg_temp.save(jsonb_set(pg_temp.doc(5), '{guesses,0,answer}', '"NaN"'))$$,
  'P0001', 'invalid_document', 'and a real one');
select throws_ok($$select pg_temp.save(jsonb_set(pg_temp.doc(5), '{guesses,0,answer}', '1e30'))$$,
  'P0001', 'invalid_document', 'and within range');
select throws_ok($$select pg_temp.save(pg_temp.doc(5, '{"guessSeconds": 2}'))$$,
  'P0001', 'invalid_document', 'the clock runs from 5 to 300 seconds');

select pg_temp.save(pg_temp.doc(5));
create temp table r on commit drop as select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
create function pg_temp.rid() returns uuid language sql as 'select room_id from r';
create function pg_temp.tok() returns text language sql as 'select host_token from r';
create function pg_temp.room() returns public.rooms language sql as
  'select * from public.rooms where id = pg_temp.rid()';
create function pg_temp.scores() returns int[] language sql as
  'select array_agg(score order by nickname) from public.players where room_id = pg_temp.rid()';
select ok((pg_temp.room()).mode = 'guess' and (pg_temp.room()).round_count = 5,
  'the room plays the mode, a round per question');

-- ------------------------------------------------------------------------------------- the start

create temp table ann on commit drop as select * from public.join_room((select room_code from r), 'Ann');
select throws_ok('select public.start_game(pg_temp.rid(), pg_temp.tok())',
  'P0001', 'not_enough_players', 'one player is too few');
create temp table bob on commit drop as select * from public.join_room((select room_code from r), 'Bob');
create temp table cat on commit drop as select * from public.join_room((select room_code from r), 'Cat');
create temp table dan on commit drop as select * from public.join_room((select room_code from r), 'Dan');
select public.start_game(pg_temp.rid(), pg_temp.tok());
select is((pg_temp.room()).state::text, 'guess_open', 'the first question opens');
select ok((pg_temp.room()).question_text = 'Question 1' and (pg_temp.room()).guess_unit = 'км',
  'everyone sees the question and its unit');
select ok((pg_temp.room()).answer_text is null and (pg_temp.room()).guess_results is null,
  'nobody sees the answer');
select ok((pg_temp.room()).phase_ends_at > now(), 'the clock runs');
select is((select answer from public.guess_host_question(pg_temp.rid(), pg_temp.tok())), 100::numeric,
  'the host sees the answer');
select throws_ok($$select public.guess_host_question(pg_temp.rid(), (select player_token from ann))$$,
  'P0001', 'not_authorized', 'a player does not');

-- ------------------------------------------------------------------------------------ the answers

create function pg_temp.guess(t regclass, v text) returns void language plpgsql as $$
begin
  execute format('select public.guess_submit(room_id, player_id, player_token, %L::numeric) from %s', v, t);
end $$;
select throws_ok($$select pg_temp.guess('ann', 'NaN')$$, 'P0001', 'invalid_guess', 'NaN is no answer');
select throws_ok($$select pg_temp.guess('ann', 'Infinity')$$, 'P0001', 'invalid_guess', 'nor infinity');
select throws_ok($$select pg_temp.guess('ann', '1e13')$$, 'P0001', 'invalid_guess', 'nor out of range');
select throws_ok($$select pg_temp.guess('ann', null)$$, 'P0001', 'invalid_guess', 'nor nothing');
select throws_ok(
  $$select public.guess_submit(pg_temp.rid(), (select player_id from ann), (select player_token from bob), 1)$$,
  'P0001', 'not_authorized', 'nobody answers for another');

select pg_temp.guess('ann', '5');
select pg_temp.guess('ann', '100');
select is(public.guess_my_value(pg_temp.rid(), (select player_id from ann), (select player_token from ann)),
  100::numeric, 'a player may change their number and read it back');
select is((pg_temp.room()).guess_done, array[(select player_id from ann)], 'who answered is seen, once');
select is(public.guess_my_value(pg_temp.rid(), (select player_id from bob), (select player_token from bob)),
  null, 'before answering there is nothing to read');
set local role anon;
select throws_ok('select * from private.guesses', '42501', null, 'clients cannot read the numbers');
reset role;
select ok(not (to_jsonb(pg_temp.room())::text ~ '"value"'), 'nor does the room show them');

-- Over and under by the same: they share the second place, and the next is the fourth.
select pg_temp.guess('bob', '90.5');
select pg_temp.guess('cat', '109.5');
select is((pg_temp.room()).state::text, 'guess_open', 'the question waits for everyone');
select pg_temp.guess('dan', '-400');

-- ------------------------------------------------------------------------------------- the reveal

select is((pg_temp.room()).state::text, 'guess_reveal', 'the last answer reveals');
select is((pg_temp.room()).answer_text, '100', 'the number is shown plainly');
select is((pg_temp.room()).answer_explanation, 'Because.', 'with its explanation');
select is(pg_temp.scores(), array[5, 2, 2, 0],
  'Ann 3 + 2 for the exact hit, Bob and Cat share the second place, Dan is fourth');
select is(
  (select array_agg((e ->> 'place')::int) from jsonb_array_elements((pg_temp.room()).guess_results) e),
  array[1, 2, 2, 4], 'the results come closest first, the place after a tie skipped');
select is(
  (pg_temp.room()).guess_results -> 0 ->> 'exact', 'true', 'an exact hit is marked');
select throws_ok($$select pg_temp.guess('dan', '100')$$, 'P0001', 'invalid_state', 'too late to change');

-- --------------------------------------------------------------------------------- further rounds

select public.guess_next(pg_temp.rid(), pg_temp.tok());
select ok((pg_temp.room()).round = 2 and (pg_temp.room()).state = 'guess_open'
  and (pg_temp.room()).guess_results is null and (pg_temp.room()).guess_done = '{}'
  and (pg_temp.room()).guess_unit is null and (pg_temp.room()).answer_text is null,
  'the next question opens clean');
select pg_temp.guess('bob', '1');
select public.guess_reveal(pg_temp.rid(), pg_temp.tok());
select is(pg_temp.scores(), array[5, 5, 2, 0], 'the host may reveal early; who did not answer gets nothing');
select public.guess_next(pg_temp.rid(), pg_temp.tok());
select public.guess_reveal(pg_temp.rid(), pg_temp.tok());
select is((pg_temp.room()).guess_results, '[]'::jsonb, 'a question nobody answered has no results');
select public.guess_next(pg_temp.rid(), pg_temp.tok());
select public.guess_reveal(pg_temp.rid(), pg_temp.tok());
select public.guess_next(pg_temp.rid(), pg_temp.tok());
select pg_temp.guess('dan', '500');
select pg_temp.guess('ann', '499');
select public.guess_reveal(pg_temp.rid(), pg_temp.tok());
select is(pg_temp.scores(), array[9, 5, 2, 10], 'the last question doubles the places and the exact hit');
select public.guess_next(pg_temp.rid(), pg_temp.tok());
select is((pg_temp.room()).state::text, 'finished', 'the game ends after it');

-- ------------------------------------------------------------------------------------- no clock

select pg_temp.save(pg_temp.doc(5, '{"guessSeconds": null}'));
select pg_temp.save(pg_temp.doc(5));
select is(pg_temp.quiz() -> 'guessSeconds', 'null'::jsonb, 'a document without the key keeps the clock off');
create temp table r2 on commit drop as select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
select public.join_room((select room_code from r2), n) from unnest(array['A', 'B']) as n;
select public.start_game((select room_id from r2), (select host_token from r2));
select is((select phase_ends_at from public.rooms where id = (select room_id from r2)), null,
  'without a clock the question waits for the host');
select throws_ok($$select public.bluff_next((select room_id from r2), (select host_token from r2))$$,
  'P0001', 'invalid_state', 'another game''s actions do not apply');

select * from finish();
rollback;
