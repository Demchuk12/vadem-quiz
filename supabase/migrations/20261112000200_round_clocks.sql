-- Round clocks, set per quiz in the editor and optional in either game. A quiz holds how long
-- players may press in "Своя гра" (`buzz_seconds`) and how long they may write and vote in
-- "Варіанти". NULL means no clock: the host moves the game on by hand, as they always can. A room
-- copies the quiz's clocks when it is created, as it copies everything else.
--
-- A clock runs only in the states that have one (buzzing_open, bluff_writing, bluff_voting);
-- `phase_ends_at` is set on entering them and is meaningless in any other state. The host's page
-- ends a phase whose clock runs out.

alter table private.quizzes
  add column buzz_seconds int check (buzz_seconds between 5 and 300),
  add column writing_seconds int default 30 check (writing_seconds between 5 and 300),
  add column voting_seconds int default 20 check (voting_seconds between 5 and 300);

alter table public.rooms
  add column buzz_seconds int,
  alter column writing_seconds drop not null,
  alter column writing_seconds drop default,
  alter column voting_seconds drop not null,
  alter column voting_seconds drop default;

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
  when invalid_text_representation or check_violation or not_null_violation then
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
    )
  );
end $$;

create or replace function private.create_bluff_room(p_quiz private.quizzes)
returns table (room_id uuid, room_code text, host_token text)
language plpgsql set search_path = '' as $$
declare
  v_token text := private.new_token();
  v_count int;
begin
  select count(*) into v_count from private.bluff_facts f where f.quiz_id = p_quiz.id;
  if exists (
    select from private.bluff_facts f
    where f.quiz_id = p_quiz.id
      and (btrim(f.text) = '' or btrim(f.truth) = '' or btrim(f.decoy) = '')
  ) then
    raise exception 'quiz_incomplete';
  end if;
  if v_count < 5 then
    raise exception 'too_few_facts';
  end if;

  loop
    begin
      insert into public.rooms (
        code, quiz_title, round_count, mode, writing_seconds, voting_seconds
      ) values (
        private.random_room_code(), p_quiz.title, v_count, 'bluff',
        p_quiz.writing_seconds, p_quiz.voting_seconds
      )
      returning id, code into room_id, room_code;
      exit;
    exception when unique_violation then
      null; -- The code is taken: draw another.
    end;
  end loop;

  insert into private.room_secrets (room_id, host_token_hash)
  values (create_bluff_room.room_id, private.hash_token(v_token));

  insert into private.room_bluff_facts (room_id, round, text, truth, decoy, explanation)
  select create_bluff_room.room_id, row_number() over (order by f.position),
    f.text, f.truth, f.decoy, f.explanation
  from private.bluff_facts f where f.quiz_id = p_quiz.id;

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

-- The press window: its clock starts when the presses open, and again for the others after a
-- wrong answer.
create or replace function public.open_buzz(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.host_room(p_room_id, p_token, array['question_shown']::public.room_state[]);
  update public.rooms set
    state = 'buzzing_open',
    phase_ends_at = now() + make_interval(secs => buzz_seconds)
  where id = p_room_id;
end $$;

create or replace function public.judge(p_room_id uuid, p_token text, p_correct boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_delta int;
begin
  v_room := private.host_room(p_room_id, p_token, array['buzzed']::public.room_state[]);
  if v_room.buzz_winner_player_id is null or p_correct is null then
    raise exception 'invalid_state';
  end if;

  v_delta := case when p_correct then v_room.current_points else -v_room.current_points end;

  update public.players set score = score + v_delta where id = v_room.buzz_winner_player_id;
  insert into private.answers_log (room_id, cell_id, player_id, correct, delta)
  values (p_room_id, v_room.current_cell_id, v_room.buzz_winner_player_id, p_correct, v_delta);

  if p_correct then
    perform private.reveal_answer(v_room);
  else
    update public.rooms set
      state = 'buzzing_open',
      buzz_winner_player_id = null,
      spent_player_ids = spent_player_ids || v_room.buzz_winner_player_id,
      phase_ends_at = now() + make_interval(secs => buzz_seconds)
    where id = p_room_id;
  end if;
end $$;
