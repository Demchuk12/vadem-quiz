-- The game rules, played through the same functions the app calls.
begin;
select plan(38);

create temp table fx on commit drop as select * from public.create_quiz('Quiz');
select public.save_quiz((select quiz_id from fx), (select owner_token from fx), $json$
{"title":"Quiz","roundMultipliers":[1,3],"rounds":[
  {"categories":[{"title":"A","questions":[
    {"basePoints":200,"text":"Q1","answerText":"A1"},
    {"basePoints":400,"text":"Q2","answerText":"A2"}]}]},
  {"categories":[{"title":"B","questions":[
    {"basePoints":200,"text":"Q3","answerText":"A3"}]}]}
]}$json$);
create temp table r on commit drop as
  select * from public.create_room((select quiz_id from fx), (select owner_token from fx));
create temp table ann on commit drop as select * from public.join_room((select room_code from r), 'Ann');
create temp table bob on commit drop as select * from public.join_room(lower((select room_code from r)), ' Bob ');
create temp table cat on commit drop as select * from public.join_room((select room_code from r), 'Cat');

create function pg_temp.rid() returns uuid language sql as 'select room_id from r';
create function pg_temp.tok() returns text language sql as 'select host_token from r';
create function pg_temp.state() returns text language sql as
  'select state::text from public.rooms where id = pg_temp.rid()';
create function pg_temp.score(n text) returns int language sql as
  'select score from public.players where room_id = pg_temp.rid() and nickname = n';
create function pg_temp.cell(p int, rnd int default 1) returns uuid language sql as
  'select id from public.room_cells where room_id = pg_temp.rid() and round = rnd and points = p';
create function pg_temp.press(t regclass) returns boolean language plpgsql as $$
declare v boolean;
begin
  execute format('select public.buzz(room_id, player_id, player_token) from %s', t) into v;
  return v;
end $$;

-- Joining
select is(pg_temp.state(), 'lobby', 'a room starts in the lobby');
select is((select count(*)::int from public.players where room_id = pg_temp.rid()), 3, 'codes ignore case, nicknames are trimmed');
select throws_ok(
  format($$select public.join_room('%s', 'ANN')$$, (select room_code from r)),
  'P0001', 'nickname_taken', 'nicknames are unique regardless of case'
);
select throws_ok($$select public.join_room('NOPE9', 'X')$$, 'P0001', 'room_not_found', 'an unknown code is refused');
select throws_ok(
  format($$select public.join_room('%s', '   ')$$, (select room_code from r)),
  'P0001', 'invalid_nickname', 'a blank nickname is refused'
);

-- Round multipliers: base points are multiplied by the round's factor.
select is((select array_agg(points order by points) from public.room_cells where room_id = pg_temp.rid() and round = 1), array[200, 400], 'round 1 uses x1');
select is((select points from public.room_cells where room_id = pg_temp.rid() and round = 2), 600, 'round 2 of this quiz uses x3');

-- Host authorization
select throws_ok(format($$select public.start_game('%s', 'wrong')$$, pg_temp.rid()), 'P0001', 'not_authorized', 'host actions need the host token');
select throws_ok(
  format($$select public.start_game('%s', '%s')$$, pg_temp.rid(), (select player_token from ann)),
  'P0001', 'not_authorized', 'a player token is not a host token'
);
select is(public.is_room_host(pg_temp.rid(), pg_temp.tok()), true, 'the host token is recognized');

-- Presses before they open
select public.start_game(pg_temp.rid(), pg_temp.tok());
select public.open_question(pg_temp.rid(), pg_temp.tok(), pg_temp.cell(200));
select is(pg_temp.state(), 'question_shown', 'opening a tile shows the question');
select is((select question_text from public.rooms where id = pg_temp.rid()), 'Q1', 'the question text is now public');
select is((select answer_text from public.rooms where id = pg_temp.rid()), null, 'the answer is still hidden');
select is((select answer_text from public.host_answer(pg_temp.rid(), pg_temp.tok())), 'A1', 'the host can read the answer');
select throws_ok(format($$select * from public.host_answer('%s', 'wrong')$$, pg_temp.rid()), 'P0001', 'not_authorized', 'players cannot read the answer');
select is(pg_temp.press('ann'), false, 'a press before opening does nothing');
select is(pg_temp.state(), 'question_shown', 'a press before opening changes nothing');

-- First press wins; impersonation fails
select public.open_buzz(pg_temp.rid(), pg_temp.tok());
select throws_ok(
  format($$select public.buzz('%s', '%s', 'wrong')$$, pg_temp.rid(), (select player_id from ann)),
  'P0001', 'not_authorized', 'pressing for another player needs their token'
);
select is(pg_temp.press('ann'), true, 'the first press wins');
select is(pg_temp.press('bob'), false, 'the second press loses');
select is(pg_temp.press('ann'), true, 'a repeated press by the winner stays a win');
select is((select buzz_winner_player_id from public.rooms where id = pg_temp.rid()), (select player_id from ann), 'the winner is recorded');

-- Wrong answer: minus points, the others may still press, this player may not
select public.judge(pg_temp.rid(), pg_temp.tok(), false);
select is(pg_temp.score('Ann'), -200, 'a wrong answer subtracts the points');
select is(pg_temp.state(), 'buzzing_open', 'a wrong answer reopens the presses');
select is(pg_temp.press('ann'), false, 'the same player cannot press again on this question');
select is(pg_temp.press('bob'), true, 'another player can');

-- Right answer: plus points, tile closes, answer revealed
select public.judge(pg_temp.rid(), pg_temp.tok(), true);
select is(pg_temp.score('Bob'), 200, 'a right answer adds the points');
select is(pg_temp.state(), 'answer_shown', 'a right answer reveals');
select is((select answer_text from public.rooms where id = pg_temp.rid()), 'A1', 'the answer is now public');
select is((select played from public.room_cells where id = pg_temp.cell(200)), true, 'the tile is finished');
select throws_ok(format($$select public.judge('%s', '%s', true)$$, pg_temp.rid(), pg_temp.tok()), 'P0001', 'invalid_state', 'judging twice is refused');

-- Back to the board: a played tile cannot reopen, tiles of other rounds neither
select public.return_to_board(pg_temp.rid(), pg_temp.tok());
select throws_ok(
  format($$select public.open_question('%s', '%s', '%s')$$, pg_temp.rid(), pg_temp.tok(), pg_temp.cell(200)),
  'P0001', 'cell_not_available', 'a played tile cannot reopen'
);
select throws_ok(
  format($$select public.open_question('%s', '%s', '%s')$$, pg_temp.rid(), pg_temp.tok(), pg_temp.cell(600, 2)),
  'P0001', 'cell_not_available', 'a tile of a later round cannot open yet'
);

-- Skip: no points, tile closes, the round ends with its last tile
select public.open_question(pg_temp.rid(), pg_temp.tok(), pg_temp.cell(400));
select public.skip_question(pg_temp.rid(), pg_temp.tok());
select is(pg_temp.score('Cat'), 0, 'skipping gives no points');
select public.return_to_board(pg_temp.rid(), pg_temp.tok());
select is(pg_temp.state(), 'round_end', 'the last tile ends the round');

-- Manual correction
select public.adjust_score(pg_temp.rid(), pg_temp.tok(), (select player_id from cat), 150);
select is(pg_temp.score('Cat'), 150, 'the host can correct a score at any moment');

-- Rounds
select public.next_round(pg_temp.rid(), pg_temp.tok());
select is((select round from public.rooms where id = pg_temp.rid()), 2, 'the next round starts');
select public.next_round(pg_temp.rid(), pg_temp.tok());
select is(pg_temp.state(), 'finished', 'after the last round the game finishes');

select * from finish();
rollback;
