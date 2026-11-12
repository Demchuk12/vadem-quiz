-- The "Варіанти" mode: a round from writing to the reveal, its points and its secrets.
begin;
select plan(40);

create temp table fx on commit drop as select * from public.create_quiz('Bluff');
create function pg_temp.qid() returns uuid language sql as 'select quiz_id from fx';
create function pg_temp.qtok() returns text language sql as 'select owner_token from fx';
create function pg_temp.facts(n int) returns jsonb language sql as $$
  select jsonb_build_object('title', 'Bluff', 'mode', 'bluff', 'facts', (
    select jsonb_agg(jsonb_build_object(
      'text', case when i = 1 then 'У Швеції є готель, збудований з' else 'Факт ' || i end,
      'truth', case when i = 1 then 'льоду' else 'правда ' || i end,
      'decoy', case when i = 1 then 'соломи' else 'пастка ' || i end,
      'explanation', case when i = 1 then 'Icehotel відбудовують щозими.' else '' end
    ) order by i)
    from generate_series(1, n) as i
  ))
$$;

-- ------------------------------------------------------------------------------------- the quiz

select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.facts(4));
select is(
  public.get_quiz(pg_temp.qid(), pg_temp.qtok()) ->> 'mode', 'bluff',
  'a document with facts saves a bluff quiz'
);
select is(
  jsonb_array_length(public.get_quiz(pg_temp.qid(), pg_temp.qtok()) -> 'facts'), 4,
  'its facts come back'
);
select throws_ok(
  $$select public.create_room(pg_temp.qid(), pg_temp.qtok())$$,
  'P0001', 'too_few_facts', 'a game needs at least five facts'
);

select public.save_quiz(pg_temp.qid(), pg_temp.qtok(),
  jsonb_set(pg_temp.facts(5), '{facts,1,decoy}', '""'));
select throws_ok(
  $$select public.create_room(pg_temp.qid(), pg_temp.qtok())$$,
  'P0001', 'quiz_incomplete', 'every fact needs its text, truth and decoy'
);
select throws_ok(
  $$select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.facts(21))$$,
  'P0001', 'invalid_document', 'a quiz holds at most twenty facts'
);

select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), pg_temp.facts(5));
create temp table r on commit drop as
  select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
create function pg_temp.rid() returns uuid language sql as 'select room_id from r';
create function pg_temp.tok() returns text language sql as 'select host_token from r';
create function pg_temp.room() returns public.rooms language sql as
  'select * from public.rooms where id = pg_temp.rid()';

select is((pg_temp.room()).mode, 'bluff', 'the room plays the bluff mode');
select is((pg_temp.room()).round_count, 5, 'a round per fact');

-- ------------------------------------------------------------------------------------ the start

create temp table ann on commit drop as select * from public.join_room((select room_code from r), 'Ann');
create temp table bob on commit drop as select * from public.join_room((select room_code from r), 'Bob');

select throws_ok(
  $$select public.start_game(pg_temp.rid(), pg_temp.tok())$$,
  'P0001', 'not_enough_players', 'two players are too few'
);

create temp table cat on commit drop as select * from public.join_room((select room_code from r), 'Cat');
select public.start_game(pg_temp.rid(), pg_temp.tok());

select is((pg_temp.room()).state::text, 'bluff_writing', 'the first round opens for writing');
select is(
  (pg_temp.room()).question_text, 'У Швеції є готель, збудований з', 'everyone sees the fact'
);
select ok(
  (pg_temp.room()).answer_text is null and (pg_temp.room()).bluff_options is null,
  'nobody sees the truth or any option yet'
);
select ok((pg_temp.room()).phase_ends_at > now(), 'the writing phase has a clock');
select is(
  (select truth from public.bluff_host_fact(pg_temp.rid(), pg_temp.tok())), 'льоду',
  'the host reads the truth'
);
select throws_ok(
  $$select public.bluff_host_fact(pg_temp.rid(), (select player_token from ann))$$,
  'P0001', 'not_authorized', 'a player cannot read the truth'
);

-- ---------------------------------------------------------------------------------- the writing

create function pg_temp.submit(t regclass, p_text text) returns void language plpgsql as $$
begin
  execute format(
    'select public.bluff_submit(room_id, player_id, player_token, %L) from %s', p_text, t
  );
end $$;

select throws_ok(
  $$select pg_temp.submit('ann', '   ')$$,
  'P0001', 'invalid_bluff', 'an empty lie is refused'
);
select throws_ok(
  $$select public.bluff_submit(pg_temp.rid(), (select player_id from ann),
    (select player_token from bob), 'x')$$,
  'P0001', 'not_authorized', 'nobody writes for another player'
);

select pg_temp.submit('ann', 'трамваїв');
select pg_temp.submit('ann', 'старих трамваїв');
select is(
  (select text from private.bluff_answers where player_id = (select player_id from ann)),
  'старих трамваїв', 'a player may change their lie'
);
select is(
  (pg_temp.room()).bluff_done, array[(select player_id from ann)],
  'everyone sees who has written, once'
);
select ok((pg_temp.room()).bluff_options is null, 'a written lie stays out of sight');

set local role anon;
select throws_ok(
  $$select * from private.bluff_answers$$, '42501', null, 'clients cannot read the lies'
);
reset role;

select pg_temp.submit('bob', '  Пивних   бочок. ');
select pg_temp.submit('cat', 'Льоду');

select is((pg_temp.room()).state::text, 'bluff_voting', 'voting opens once everyone has written');
select is(
  jsonb_array_length((pg_temp.room()).bluff_options), 5,
  'the truth, the decoy and every lie are options'
);
select ok(
  not exists (
    select from jsonb_array_elements((pg_temp.room()).bluff_options) o
    where o ?| array['kind', 'player_id', 'voter_ids']
  ),
  'options show only their words while voting'
);
select ok(
  (pg_temp.room()).bluff_options @> '[{"text": "пивних бочок"}]',
  'every option has one look'
);
select is(
  (select count(*)::int from jsonb_array_elements((pg_temp.room()).bluff_options) o
   where o ->> 'text' = 'льоду'),
  2, 'a lie that is the truth stands beside it as its own option'
);

-- ----------------------------------------------------------------------------------- the voting

create function pg_temp.option(p_kind text, t regclass default null) returns uuid
language plpgsql as $$
declare v uuid;
begin
  if t is null then
    select id into v from private.bluff_options
    where room_id = pg_temp.rid() and round = 1 and kind = p_kind;
  else
    execute format(
      'select o.id from private.bluff_options o, %s p
       where o.room_id = pg_temp.rid() and o.round = 1 and o.player_id = p.player_id', t
    ) into v;
  end if;
  return v;
end $$;
create function pg_temp.vote(t regclass, p_option uuid) returns void language plpgsql as $$
begin
  execute format(
    'select public.bluff_vote(room_id, player_id, player_token, %L) from %s', p_option, t
  );
end $$;

select throws_ok(
  format($$select pg_temp.vote('ann', %L)$$, pg_temp.option('player', 'ann')),
  'P0001', 'own_option', 'nobody votes for their own lie'
);
select throws_ok(
  format($$select pg_temp.vote('cat', %L)$$, pg_temp.option('truth')),
  'P0001', 'own_option', 'nor for an option with the same words as theirs'
);
select throws_ok(
  format($$select pg_temp.vote('ann', %L)$$, gen_random_uuid()),
  'P0001', 'option_not_found', 'a vote names an option of this round'
);

select pg_temp.vote('bob', pg_temp.option('decoy'));
select pg_temp.vote('bob', pg_temp.option('player', 'ann'));
select pg_temp.vote('ann', pg_temp.option('truth'));
select is((pg_temp.room()).state::text, 'bluff_voting', 'voting waits for every player');
select pg_temp.vote('cat', pg_temp.option('decoy'));

-- ----------------------------------------------------------------------------------- the reveal

select is((pg_temp.room()).state::text, 'bluff_reveal', 'the last vote reveals the round');
select is((pg_temp.room()).answer_text, 'льоду', 'everyone sees the truth');
select is(
  (select array_agg(score order by nickname) from public.players where room_id = pg_temp.rid()),
  array[3, 0, -1],
  'Ann: +2 for the truth, +1 for fooling Bob; Bob changed his vote; Cat -1 for the decoy'
);
select is(
  (pg_temp.room()).bluff_deltas,
  jsonb_build_object((select player_id from ann), 3, (select player_id from cat), -1),
  'the round''s gains are on the room'
);
select ok(
  (pg_temp.room()).bluff_options @> jsonb_build_array(jsonb_build_object(
    'kind', 'player',
    'player_id', (select player_id from ann),
    'voter_ids', jsonb_build_array((select player_id from bob))
  )),
  'the reveal shows each author and who fell for them'
);
select is(
  (select option_id from public.bluff_my_round(
    pg_temp.rid(), (select player_id from ann), (select player_token from ann))),
  pg_temp.option('truth'), 'a phone can read its own vote back'
);

-- ------------------------------------------------------------------------------- the next rounds

select public.bluff_next(pg_temp.rid(), pg_temp.tok());
select ok(
  (pg_temp.room()).state = 'bluff_writing' and (pg_temp.room()).round = 2
    and (pg_temp.room()).bluff_options is null and (pg_temp.room()).bluff_done = '{}',
  'the next fact opens clean'
);

select pg_temp.submit('ann', 'щось');
select public.bluff_open_voting(pg_temp.rid(), pg_temp.tok());
select is(
  jsonb_array_length((pg_temp.room()).bluff_options), 3,
  'the host may end the writing early; who did not write has no option'
);
select public.bluff_reveal(pg_temp.rid(), pg_temp.tok());
select is(
  (select sum(score)::int from public.players where room_id = pg_temp.rid()), 2,
  'a round without votes changes no score'
);

select public.bluff_next(pg_temp.rid(), pg_temp.tok());
select public.bluff_open_voting(pg_temp.rid(), pg_temp.tok());
select public.bluff_reveal(pg_temp.rid(), pg_temp.tok());
select public.bluff_next(pg_temp.rid(), pg_temp.tok());
select public.bluff_open_voting(pg_temp.rid(), pg_temp.tok());
select public.bluff_reveal(pg_temp.rid(), pg_temp.tok());
select public.bluff_next(pg_temp.rid(), pg_temp.tok());
select public.bluff_open_voting(pg_temp.rid(), pg_temp.tok());
select public.bluff_reveal(pg_temp.rid(), pg_temp.tok());
select public.bluff_next(pg_temp.rid(), pg_temp.tok());
select is((pg_temp.room()).state::text, 'finished', 'the game ends after the last fact');

select throws_ok(
  $$select public.open_question(pg_temp.rid(), pg_temp.tok(), null)$$,
  'P0001', 'invalid_state', 'board actions do not apply to a bluff room'
);

select * from finish();
rollback;
