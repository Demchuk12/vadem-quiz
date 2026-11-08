-- How late the other presses were.
begin;
select plan(9);

create temp table fx on commit drop as select * from public.create_quiz('Quiz');
select public.save_quiz((select quiz_id from fx), (select owner_token from fx), $json$
{"title":"Quiz","roundMultipliers":[1],"rounds":[
  {"categories":[{"title":"A","questions":[{"basePoints":200,"text":"Q1","answerText":"A1"}]}]}
]}$json$);
create temp table r on commit drop as
  select * from public.create_room((select quiz_id from fx), (select owner_token from fx));
create temp table ann on commit drop as select * from public.join_room((select room_code from r), 'Ann');
create temp table bob on commit drop as select * from public.join_room((select room_code from r), 'Bob');
create temp table cat on commit drop as select * from public.join_room((select room_code from r), 'Cat');

create function pg_temp.rid() returns uuid language sql as 'select room_id from r';
create function pg_temp.tok() returns text language sql as 'select host_token from r';
create function pg_temp.press(t regclass) returns boolean language plpgsql as $$
declare v boolean;
begin
  execute format('select public.buzz(room_id, player_id, player_token) from %s', t) into v;
  return v;
end $$;
create function pg_temp.late() returns jsonb language sql as
  'select late_presses from public.rooms where id = pg_temp.rid()';
create function pg_temp.late_of(t regclass) returns int language plpgsql as $$
declare v int;
begin
  execute format(
    $q$select (e ->> 'ms')::int from jsonb_array_elements(pg_temp.late()) e
       where e ->> 'player_id' = (select player_id::text from %s)$q$, t) into v;
  return v;
end $$;

select public.start_game(pg_temp.rid(), pg_temp.tok());
select public.open_question(
  pg_temp.rid(), pg_temp.tok(),
  (select id from public.room_cells where room_id = pg_temp.rid())
);

-- A press before the presses open is not "late".
select pg_temp.press('bob');
select is(pg_temp.late(), '[]'::jsonb, 'a press before opening is not counted as late');

select public.open_buzz(pg_temp.rid(), pg_temp.tok());
select ok(pg_temp.press('ann'), 'the first press wins');
select isnt(
  (select buzzed_at from public.rooms where id = pg_temp.rid()), null,
  'the winning press notes its moment'
);

select pg_sleep(0.05);
select ok(not pg_temp.press('bob'), 'a later press does not win');
select cmp_ok(pg_temp.late_of('bob'), '>=', 40, 'a later press is kept with its delay in ms');

select pg_temp.press('bob');
select is(jsonb_array_length(pg_temp.late()), 1, 'pressing again does not add a second entry');

select pg_temp.press('ann');
select is(jsonb_array_length(pg_temp.late()), 1, 'the winner pressing again is not late');

-- Wrong: Ann may not press again, and the next win starts a fresh list.
select public.judge(pg_temp.rid(), pg_temp.tok(), false);
select pg_temp.press('cat');
select is(pg_temp.late(), '[]'::jsonb, 'a new winner starts a fresh list');
select pg_temp.press('ann');
select is(pg_temp.late(), '[]'::jsonb, 'a player who already answered is not counted');

select * from finish();
rollback;
