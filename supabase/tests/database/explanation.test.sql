-- The explanation of an answer is as secret as the answer until it is revealed.
begin;
select plan(8);

create temp table fx on commit drop as select * from public.create_quiz('Quiz');
select public.save_quiz((select quiz_id from fx), (select owner_token from fx), $json$
{"title":"Quiz","roundMultipliers":[1],"rounds":[{"categories":[{"title":"A","questions":[
  {"basePoints":200,"text":"Q1","answerText":"A1","explanation":"  Because of E1.  "},
  {"basePoints":400,"text":"Q2","answerText":"A2"}]}]}]}$json$);

select is(
  public.get_quiz((select quiz_id from fx), (select owner_token from fx))
    #>> '{rounds,0,categories,0,questions,0,explanation}',
  'Because of E1.', 'the explanation is stored, trimmed'
);
select is(
  public.get_quiz((select quiz_id from fx), (select owner_token from fx))
    #>> '{rounds,0,categories,0,questions,1,explanation}',
  '', 'a question without one gets an empty explanation'
);

create temp table r on commit drop as
  select * from public.create_room((select quiz_id from fx), (select owner_token from fx));
create function pg_temp.room() returns public.rooms language sql as
  'select * from public.rooms where id = (select room_id from r)';
create function pg_temp.cell(p int) returns uuid language sql as
  'select id from public.room_cells where room_id = (select room_id from r) and points = p';

select public.start_game((select room_id from r), (select host_token from r));
select public.open_question((select room_id from r), (select host_token from r), pg_temp.cell(200));
select is((pg_temp.room()).answer_explanation, null, 'players cannot see it while the question runs');
select is(
  (select explanation from public.host_answer((select room_id from r), (select host_token from r))),
  'Because of E1.', 'the host sees it with the answer'
);

select public.skip_question((select room_id from r), (select host_token from r));
select is((pg_temp.room()).answer_explanation, 'Because of E1.', 'everyone sees it once revealed');

select public.return_to_board((select room_id from r), (select host_token from r));
select is((pg_temp.room()).answer_explanation, null, 'it leaves with the question');

select public.open_question((select room_id from r), (select host_token from r), pg_temp.cell(400));
select public.skip_question((select room_id from r), (select host_token from r));
select is((pg_temp.room()).answer_explanation, null, 'an empty one is not shown at all');

select throws_ok(
  format(
    $$select public.save_quiz('%s', '%s', '{"title":"Q","roundMultipliers":[1],"rounds":[{"categories":[{"title":"A","questions":[{"basePoints":200,"text":"Q","answerText":"A","explanation":"%s"}]}]}]}')$$,
    (select quiz_id from fx), (select owner_token from fx), repeat('x', 2001)
  ),
  'P0001', 'invalid_document', 'a very long explanation is refused'
);

select * from finish();
rollback;
