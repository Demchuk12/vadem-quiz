-- An optional explanation of the answer. The host sees it with the answer while the question runs;
-- everyone else sees it only when the answer is revealed, exactly like the answer itself.

alter table private.questions
  add column explanation text not null default '' check (char_length(explanation) <= 2000);
alter table private.room_cell_contents add column explanation text not null default '';
alter table public.rooms add column answer_explanation text;

create or replace function public.get_quiz(p_quiz_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_title text;
  v_multipliers int[];
begin
  perform private.assert_quiz_owner(p_quiz_id, p_token);
  select title, round_multipliers into v_title, v_multipliers
  from private.quizzes where id = p_quiz_id;

  return jsonb_build_object(
    'title', v_title,
    'roundMultipliers', to_jsonb(v_multipliers),
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
      from generate_series(1, cardinality(v_multipliers)) as r
    )
  );
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
  set title = v_title, round_multipliers = v_multipliers, updated_at = now()
  where id = p_quiz_id;

  delete from private.categories where quiz_id = p_quiz_id;

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
      insert into public.rooms (code, quiz_title, round_count)
      values (private.random_room_code(), v_quiz.title, cardinality(v_quiz.round_multipliers))
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

-- The result gains a column, which `create or replace` cannot change.
drop function public.host_answer(uuid, text);
create function public.host_answer(p_room_id uuid, p_token text)
returns table (answer_text text, answer_image_path text, explanation text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_host(p_room_id, p_token);
  return query
    select c.answer_text, c.answer_image_path, c.explanation
    from public.rooms r
    join private.room_cell_contents c on c.cell_id = r.current_cell_id
    where r.id = p_room_id;
end $$;
revoke all on function public.host_answer(uuid, text) from public, anon, authenticated;
grant execute on function public.host_answer(uuid, text) to anon, authenticated;

create or replace function private.reveal_answer(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_content private.room_cell_contents;
begin
  select * into v_content from private.room_cell_contents where cell_id = p_room.current_cell_id;
  update public.room_cells set played = true where id = p_room.current_cell_id;
  update public.rooms set
    state = 'answer_shown',
    answer_text = v_content.answer_text,
    answer_image_path = v_content.answer_image_path,
    answer_explanation = nullif(v_content.explanation, '')
  where id = p_room.id;
end $$;

create or replace function public.open_question(p_room_id uuid, p_token text, p_cell_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_cell public.room_cells;
  v_content private.room_cell_contents;
begin
  v_room := private.host_room(p_room_id, p_token, array['board']::public.room_state[]);

  select * into v_cell from public.room_cells
  where id = p_cell_id and room_id = p_room_id and round = v_room.round and not played;
  if not found then
    raise exception 'cell_not_available';
  end if;

  select * into v_content from private.room_cell_contents where cell_id = p_cell_id;

  update public.rooms set
    state = 'question_shown',
    current_cell_id = p_cell_id,
    current_points = v_cell.points,
    question_text = v_content.text,
    question_image_path = v_content.image_path,
    answer_text = null,
    answer_image_path = null,
    answer_explanation = null,
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

create or replace function private.leave_question(p_room_id uuid, p_next_state public.room_state)
returns void
language plpgsql set search_path = '' as $$
begin
  update public.rooms set
    state = p_next_state,
    current_cell_id = null,
    current_points = null,
    question_text = null,
    question_image_path = null,
    answer_text = null,
    answer_image_path = null,
    answer_explanation = null,
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

revoke all on function private.reveal_answer(public.rooms) from public, anon, authenticated;
revoke all on function private.leave_question(uuid, public.room_state) from public, anon, authenticated;
