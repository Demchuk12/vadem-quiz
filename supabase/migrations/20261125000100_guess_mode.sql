-- "На око", a third game: every question has a number for an answer, each player enters theirs, and
-- the closest score. Places by distance give 3, 2 and 1; an equal distance shares the place and the
-- next one is skipped. An exact hit adds 2, and the last question counts double.
--
-- The answer and everyone's numbers stay in `private` until the reveal.

alter table private.quizzes
  drop constraint quizzes_mode_check,
  add constraint quizzes_mode_check check (mode in ('board', 'bluff', 'guess')),
  add column guess_seconds int default 30 check (guess_seconds between 5 and 300);

create table private.guess_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references private.quizzes on delete cascade,
  position int not null,
  text text not null check (char_length(text) <= 300),
  -- Null in a draft. The range keeps every value exact in a browser's numbers.
  answer numeric(18, 3) check (answer between -1000000000000 and 1000000000000),
  unit text not null default '' check (char_length(unit) <= 20),
  explanation text not null default '' check (char_length(explanation) <= 2000),
  unique (quiz_id, position)
);

-- Seen by everyone. `guess_done` lists who has answered; `guess_results` holds, from the reveal on,
-- { player_id, value, place, delta, exact } for everyone who did, closest first.
alter table public.rooms
  add column guess_seconds int,
  add column guess_unit text,
  add column guess_done uuid[] not null default '{}',
  add column guess_results jsonb;

-- A room keeps its own copy of the questions, as it does of a board.
create table private.room_guess_questions (
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  text text not null,
  answer numeric(18, 3) not null,
  unit text not null default '',
  explanation text not null default '',
  primary key (room_id, round)
);

create table private.guesses (
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  player_id uuid not null references public.players on delete cascade,
  value numeric(18, 3) not null,
  primary key (room_id, round, player_id)
);

-- ----------------------------------------------------------------------------------------- quizzes

create function private.save_guess_quiz(p_quiz_id uuid, p_title text, p_document jsonb)
returns void
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p_document -> 'guesses') is distinct from 'array'
    or jsonb_array_length(p_document -> 'guesses') > 20 then
    raise exception 'invalid_document';
  end if;

  update private.quizzes set
    title = p_title,
    mode = 'guess',
    -- A document without the key leaves the clock as it was.
    guess_seconds = case
      when p_document ? 'guessSeconds' then (p_document ->> 'guessSeconds')::int
      else guess_seconds
    end,
    updated_at = now()
  where id = p_quiz_id;
  delete from private.categories where quiz_id = p_quiz_id;
  delete from private.bluff_facts where quiz_id = p_quiz_id;
  delete from private.guess_questions where quiz_id = p_quiz_id;

  insert into private.guess_questions (quiz_id, position, text, answer, unit, explanation)
  select p_quiz_id, g.ordinality,
    btrim(coalesce(g.value ->> 'text', '')),
    (g.value ->> 'answer')::numeric,
    btrim(coalesce(g.value ->> 'unit', '')),
    btrim(coalesce(g.value ->> 'explanation', ''))
  from jsonb_array_elements(p_document -> 'guesses') with ordinality as g;
end $$;

create or replace function private.save_bluff_quiz(p_quiz_id uuid, p_title text, p_document jsonb)
returns void
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p_document -> 'facts') is distinct from 'array'
    or jsonb_array_length(p_document -> 'facts') > 20 then
    raise exception 'invalid_document';
  end if;

  update private.quizzes set
    title = p_title,
    mode = 'bluff',
    -- A document without the key, from an older page or file, leaves the clock as it was.
    writing_seconds = case when p_document ? 'writingSeconds' then (p_document ->> 'writingSeconds')::int else writing_seconds end,
    -- A document without the key, from an older page or file, leaves the clock as it was.
    voting_seconds = case when p_document ? 'votingSeconds' then (p_document ->> 'votingSeconds')::int else voting_seconds end,
    updated_at = now()
  where id = p_quiz_id;
  delete from private.categories where quiz_id = p_quiz_id;
  delete from private.bluff_facts where quiz_id = p_quiz_id;
  delete from private.guess_questions where quiz_id = p_quiz_id;

  insert into private.bluff_facts (quiz_id, position, text, truth, decoy, explanation)
  select p_quiz_id, f.ordinality,
    btrim(coalesce(f.value ->> 'text', '')),
    btrim(coalesce(f.value ->> 'truth', '')),
    btrim(coalesce(f.value ->> 'decoy', '')),
    btrim(coalesce(f.value ->> 'explanation', ''))
  from jsonb_array_elements(p_document -> 'facts') with ordinality as f;
end $$;

create or replace function public.save_quiz(p_quiz_id uuid, p_token text, p_document jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_title text := btrim(coalesce(p_document ->> 'title', ''));
  v_multipliers int[];
  v_round jsonb;
  v_round_no int;
  v_category jsonb;
  v_category_no int;
  v_category_id uuid;
  v_question jsonb;
  v_question_no int;
begin
  perform private.assert_quiz_owner(p_quiz_id, p_token);

  if char_length(v_title) not between 1 and 120 then
    raise exception 'invalid_title';
  end if;

  if p_document ->> 'mode' = 'bluff' then
    perform private.save_bluff_quiz(p_quiz_id, v_title, p_document);
    return;
  end if;
  if p_document ->> 'mode' = 'guess' then
    perform private.save_guess_quiz(p_quiz_id, v_title, p_document);
    return;
  end if;

  if jsonb_typeof(p_document -> 'rounds') is distinct from 'array'
    or jsonb_typeof(p_document -> 'roundMultipliers') is distinct from 'array' then
    raise exception 'invalid_document';
  end if;

  select array_agg(value::int order by ordinality) into v_multipliers
  from jsonb_array_elements_text(p_document -> 'roundMultipliers') with ordinality;

  if cardinality(v_multipliers) <> jsonb_array_length(p_document -> 'rounds') then
    raise exception 'invalid_document';
  end if;

  update private.quizzes
  set title = v_title,
    round_multipliers = v_multipliers,
    mode = 'board',
    -- A document without the key, from an older page or file, leaves the clock as it was.
    buzz_seconds = case when p_document ? 'buzzSeconds' then (p_document ->> 'buzzSeconds')::int else buzz_seconds end,
    updated_at = now()
  where id = p_quiz_id;

  delete from private.categories where quiz_id = p_quiz_id;
  delete from private.bluff_facts where quiz_id = p_quiz_id;
  delete from private.guess_questions where quiz_id = p_quiz_id;

  for v_round, v_round_no in
    select value, ordinality from jsonb_array_elements(p_document -> 'rounds') with ordinality
  loop
    for v_category, v_category_no in
      select value, ordinality from jsonb_array_elements(v_round -> 'categories') with ordinality
    loop
      insert into private.categories (quiz_id, round, position, title)
      values (p_quiz_id, v_round_no, v_category_no, coalesce(v_category ->> 'title', ''))
      returning id into v_category_id;

      for v_question, v_question_no in
        select value, ordinality from jsonb_array_elements(v_category -> 'questions') with ordinality
      loop
        if not private.valid_image_path(p_quiz_id, v_question ->> 'imagePath')
          or not private.valid_image_path(p_quiz_id, v_question ->> 'answerImagePath') then
          raise exception 'invalid_image_path';
        end if;
        insert into private.questions (
          category_id, position, base_points, text, image_path, answer_text, answer_image_path,
          explanation
        ) values (
          v_category_id,
          v_question_no,
          (v_question ->> 'basePoints')::int,
          coalesce(v_question ->> 'text', ''),
          v_question ->> 'imagePath',
          coalesce(v_question ->> 'answerText', ''),
          v_question ->> 'answerImagePath',
          btrim(coalesce(v_question ->> 'explanation', ''))
        );
      end loop;
    end loop;
  end loop;
exception
  when invalid_text_representation or check_violation or not_null_violation
    or numeric_value_out_of_range then
    raise exception 'invalid_document';
end $$;

create or replace function public.get_quiz(p_quiz_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_quiz private.quizzes;
begin
  perform private.assert_quiz_owner(p_quiz_id, p_token);
  select * into v_quiz from private.quizzes where id = p_quiz_id;

  return jsonb_build_object(
    'title', v_quiz.title,
    'mode', v_quiz.mode,
    'buzzSeconds', v_quiz.buzz_seconds,
    'writingSeconds', v_quiz.writing_seconds,
    'votingSeconds', v_quiz.voting_seconds,
    'guessSeconds', v_quiz.guess_seconds,
    'roundMultipliers', to_jsonb(v_quiz.round_multipliers),
    'rounds', (
      select coalesce(jsonb_agg(jsonb_build_object('categories', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'title', c.title,
          'questions', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'basePoints', q.base_points,
              'text', q.text,
              'imagePath', q.image_path,
              'answerText', q.answer_text,
              'answerImagePath', q.answer_image_path,
              'explanation', q.explanation
            ) order by q.position), '[]'::jsonb)
            from private.questions q where q.category_id = c.id
          )
        ) order by c.position), '[]'::jsonb)
        from private.categories c
        where c.quiz_id = p_quiz_id and c.round = r
      )) order by r), '[]'::jsonb)
      from generate_series(1, cardinality(v_quiz.round_multipliers)) as r
    ),
    'facts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'text', f.text,
        'truth', f.truth,
        'decoy', f.decoy,
        'explanation', f.explanation
      ) order by f.position), '[]'::jsonb)
      from private.bluff_facts f where f.quiz_id = p_quiz_id
    ),
    'guesses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'text', g.text,
        'answer', g.answer,
        'unit', g.unit,
        'explanation', g.explanation
      ) order by g.position), '[]'::jsonb)
      from private.guess_questions g where g.quiz_id = p_quiz_id
    )
  );
end $$;

-- ------------------------------------------------------------------------------------------- rooms

create function private.create_guess_room(p_quiz private.quizzes)
returns table (room_id uuid, room_code text, host_token text)
language plpgsql set search_path = '' as $$
declare
  v_token text := private.new_token();
  v_count int;
begin
  select count(*) into v_count from private.guess_questions g where g.quiz_id = p_quiz.id;
  if exists (
    select from private.guess_questions g
    where g.quiz_id = p_quiz.id and (btrim(g.text) = '' or g.answer is null)
  ) then
    raise exception 'quiz_incomplete';
  end if;
  if v_count < 5 then
    raise exception 'too_few_questions';
  end if;

  loop
    begin
      insert into public.rooms (code, quiz_title, round_count, mode, guess_seconds)
      values (
        private.random_room_code(), p_quiz.title, v_count, 'guess', p_quiz.guess_seconds
      )
      returning id, code into room_id, room_code;
      exit;
    exception when unique_violation then
      null; -- The code is taken: draw another.
    end;
  end loop;

  insert into private.room_secrets (room_id, host_token_hash)
  values (create_guess_room.room_id, private.hash_token(v_token));

  insert into private.room_guess_questions (room_id, round, text, answer, unit, explanation)
  select create_guess_room.room_id, row_number() over (order by g.position),
    g.text, g.answer, g.unit, g.explanation
  from private.guess_questions g where g.quiz_id = p_quiz.id;

  host_token := v_token;
  return next;
end $$;

create or replace function public.create_room(p_quiz_id uuid, p_quiz_token text)
returns table (room_id uuid, room_code text, host_token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_quiz private.quizzes;
  v_token text := private.new_token();
  v_cell_id uuid;
  v_row record;
begin
  perform private.assert_quiz_owner(p_quiz_id, p_quiz_token);
  select * into v_quiz from private.quizzes where id = p_quiz_id;

  if v_quiz.mode = 'bluff' then
    return query select * from private.create_bluff_room(v_quiz);
    return;
  end if;
  if v_quiz.mode = 'guess' then
    return query select * from private.create_guess_room(v_quiz);
    return;
  end if;

  if not exists (
    select from private.categories c join private.questions q on q.category_id = c.id
    where c.quiz_id = p_quiz_id
  ) or exists (
    select from private.categories c
    left join private.questions q on q.category_id = c.id
    where c.quiz_id = p_quiz_id
      and (
        btrim(c.title) = '' or q.id is null
        or (btrim(q.text) = '' and q.image_path is null)
        or (btrim(q.answer_text) = '' and q.answer_image_path is null)
      )
  ) or exists (
    select from generate_series(1, cardinality(v_quiz.round_multipliers)) as r
    where not exists (select from private.categories c where c.quiz_id = p_quiz_id and c.round = r)
  ) then
    raise exception 'quiz_incomplete';
  end if;

  loop
    begin
      insert into public.rooms (code, quiz_title, round_count, buzz_seconds)
      values (
        private.random_room_code(), v_quiz.title, cardinality(v_quiz.round_multipliers),
        v_quiz.buzz_seconds
      )
      returning id, code into room_id, room_code;
      exit;
    exception when unique_violation then
      null; -- The code is taken: draw another.
    end;
  end loop;

  insert into private.room_secrets (room_id, host_token_hash)
  values (create_room.room_id, private.hash_token(v_token));

  for v_row in
    select c.round, c.position as category_position, c.title as category_title, q.*
    from private.categories c join private.questions q on q.category_id = c.id
    where c.quiz_id = p_quiz_id
  loop
    insert into public.room_cells (room_id, round, category_position, category_title, position, points)
    values (
      create_room.room_id, v_row.round, v_row.category_position, v_row.category_title, v_row.position,
      v_row.base_points * v_quiz.round_multipliers[v_row.round]
    )
    returning id into v_cell_id;

    insert into private.room_cell_contents (
      cell_id, text, image_path, answer_text, answer_image_path, explanation
    ) values (
      v_cell_id, v_row.text, v_row.image_path, v_row.answer_text, v_row.answer_image_path,
      v_row.explanation
    );
  end loop;

  host_token := v_token;
  return next;
end $$;

-- -------------------------------------------------------------------------------------- the round

create function private.guess_open_question(p_room_id uuid, p_round int) returns void
language plpgsql set search_path = '' as $$
declare
  v_question private.room_guess_questions;
begin
  select * into v_question from private.room_guess_questions
  where room_id = p_room_id and round = p_round;
  update public.rooms set
    state = 'guess_open',
    round = p_round,
    question_text = v_question.text,
    answer_text = null,
    answer_explanation = null,
    guess_unit = nullif(v_question.unit, ''),
    guess_done = '{}',
    guess_results = null,
    phase_ends_at = now() + make_interval(secs => guess_seconds)
  where id = p_room_id;
end $$;

-- One row per player who answered.
create function private.guess_scores(p_room public.rooms)
returns table (player_id uuid, value numeric, place int, delta int, exact boolean)
language sql stable set search_path = '' as $$
  select r.player_id, r.value, r.place, r.exact_bonus + greatest(0, 4 - r.place) * r.times, r.exact
  from (
    select g.player_id, g.value, g.value = q.answer as exact,
      rank() over (order by abs(g.value - q.answer))::int as place,
      case when p_room.round >= p_room.round_count then 2 else 1 end as times,
      case when g.value = q.answer then 2 else 0 end
        * case when p_room.round >= p_room.round_count then 2 else 1 end as exact_bonus
    from private.guesses g
    join private.room_guess_questions q on q.room_id = g.room_id and q.round = g.round
    where g.room_id = p_room.id and g.round = p_room.round
  ) as r
$$;

create function private.guess_finish_round(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_question private.room_guess_questions;
begin
  select * into v_question from private.room_guess_questions
  where room_id = p_room.id and round = p_room.round;

  update public.players p set score = p.score + s.delta
  from private.guess_scores(p_room) s
  where p.id = s.player_id and s.delta <> 0;

  insert into private.answers_log (room_id, cell_id, player_id, correct, delta)
  select p_room.id, null, s.player_id, s.exact, s.delta from private.guess_scores(p_room) s;

  update public.rooms set
    state = 'guess_reveal',
    phase_ends_at = null,
    answer_text = trim_scale(v_question.answer)::text,
    answer_explanation = nullif(v_question.explanation, ''),
    guess_results = coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', s.player_id,
        'value', s.value,
        'place', s.place,
        'delta', s.delta,
        'exact', s.exact
      ) order by s.place, s.value, s.player_id)
      from private.guess_scores(p_room) s
    ), '[]'::jsonb)
  where id = p_room.id;
end $$;

create or replace function public.start_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_players int;
begin
  v_room := private.host_room(p_room_id, p_token, array['lobby']::public.room_state[]);
  select count(*) into v_players from public.players p where p.room_id = p_room_id;
  if v_room.mode = 'bluff' then
    -- The truth, the decoy and at least three lies: fewer, and guessing is too easy.
    if v_players < 3 then
      raise exception 'not_enough_players';
    end if;
    perform private.bluff_open_fact(p_room_id, 1);
  elsif v_room.mode = 'guess' then
    if v_players < 2 then
      raise exception 'not_enough_players';
    end if;
    perform private.guess_open_question(p_room_id, 1);
  else
    update public.rooms set state = 'board' where id = p_room_id;
  end if;
end $$;

-- A player's number, which they may change until the reveal.
create function public.guess_submit(
  p_room_id uuid, p_player_id uuid, p_token text, p_value numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  -- NaN and the infinities sort above every number, so they fail here too.
  if p_value is null or not p_value between -1000000000000 and 1000000000000 then
    raise exception 'invalid_guess';
  end if;
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'guess_open' then
    raise exception 'invalid_state';
  end if;

  insert into private.guesses (room_id, round, player_id, value)
  values (p_room_id, v_room.round, p_player_id, p_value)
  on conflict (room_id, round, player_id) do update set value = excluded.value;

  if not (p_player_id = any (v_room.guess_done)) then
    update public.rooms set guess_done = guess_done || p_player_id
    where id = p_room_id
    returning * into v_room;
  end if;
  -- Everyone has answered: no need to wait for the clock.
  if not exists (
    select from public.players p
    where p.room_id = p_room_id and not (p.id = any (v_room.guess_done))
  ) then
    perform private.guess_finish_round(v_room);
  end if;
end $$;

create function public.guess_reveal(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['guess_open']::public.room_state[]);
  perform private.guess_finish_round(v_room);
end $$;

create function public.guess_next(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['guess_reveal']::public.room_state[]);
  if v_room.round >= v_room.round_count then
    perform private.leave_question(p_room_id, 'finished');
  else
    perform private.guess_open_question(p_room_id, v_room.round + 1);
  end if;
end $$;

-- What only the host sees while the players answer.
create function public.guess_host_question(p_room_id uuid, p_token text)
returns table (answer numeric, explanation text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_host(p_room_id, p_token);
  return query
    select trim_scale(q.answer), q.explanation
    from public.rooms r
    join private.room_guess_questions q on q.room_id = r.id and q.round = r.round
    where r.id = p_room_id;
end $$;

-- A player's own number, for a phone that reloads; null before they answer.
create function public.guess_my_value(p_room_id uuid, p_player_id uuid, p_token text)
returns numeric
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  return (
    select trim_scale(g.value)
    from public.rooms r
    join private.guesses g on g.room_id = r.id and g.round = r.round
    where r.id = p_room_id and g.player_id = p_player_id
  );
end $$;

create or replace function public.finish_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.host_room(p_room_id, p_token);
  perform private.leave_question(p_room_id, 'finished');
  update public.rooms set
    phase_ends_at = null, bluff_done = '{}', bluff_options = null, bluff_deltas = null,
    guess_unit = null, guess_done = '{}', guess_results = null
  where id = p_room_id and mode <> 'board';
end $$;

-- ----------------------------------------------------------------------------------- permissions

revoke all on function
  private.save_guess_quiz(uuid, text, jsonb),
  private.create_guess_room(private.quizzes),
  private.guess_open_question(uuid, int),
  private.guess_scores(public.rooms),
  private.guess_finish_round(public.rooms)
from public, anon, authenticated;

revoke all on function
  public.guess_submit(uuid, uuid, text, numeric),
  public.guess_reveal(uuid, text),
  public.guess_next(uuid, text),
  public.guess_host_question(uuid, text),
  public.guess_my_value(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.guess_submit(uuid, uuid, text, numeric),
  public.guess_reveal(uuid, text),
  public.guess_next(uuid, text),
  public.guess_host_question(uuid, text),
  public.guess_my_value(uuid, uuid, text)
to anon, authenticated;
