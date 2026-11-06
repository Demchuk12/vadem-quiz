-- All client writes go through these functions. Failures raise a short code as the message; the
-- client maps codes to user-facing text.

-- ---------------------------------------------------------------------------------------- helpers

create function private.new_token() returns text
language sql volatile set search_path = '' as $$
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;

-- Tokens carry 256 random bits, so a plain fast hash is enough: there is nothing to brute-force.
create function private.hash_token(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select pg_catalog.sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
$$;

create function private.assert_quiz_owner(p_quiz_id uuid, p_token text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (
    select from private.quizzes
    where id = p_quiz_id and owner_token_hash = private.hash_token(p_token)
  ) then
    raise exception 'not_authorized';
  end if;
end $$;

create function private.assert_host(p_room_id uuid, p_token text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (
    select from private.room_secrets
    where room_id = p_room_id and host_token_hash = private.hash_token(p_token)
  ) then
    raise exception 'not_authorized';
  end if;
end $$;

-- Locks the room, so host actions on one room run one after another.
create function private.lock_room(p_room_id uuid) returns public.rooms
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  return v_room;
end $$;

create function private.random_room_code() returns text
language sql volatile set search_path = '' as $$
  -- No 0/O, 1/I/L: the code is read aloud and typed on phones.
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 31) + 1, 1), ''
  )
  from extensions.gen_random_bytes(5) as b, generate_series(0, 4) as i
$$;

create function private.valid_image_path(p_quiz_id uuid, p_path text) returns boolean
language sql immutable set search_path = '' as $$
  select p_path is null
    or p_path ~ ('^' || p_quiz_id::text || '/[0-9a-f-]{36}\.(webp|jpg)$')
$$;

-- --------------------------------------------------------------------------------------- quizzes

create function public.create_quiz(p_title text)
returns table (quiz_id uuid, owner_token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := private.new_token();
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) not between 1 and 120 then
    raise exception 'invalid_title';
  end if;
  insert into private.quizzes (title, owner_token_hash)
  values (v_title, private.hash_token(v_token))
  returning id into quiz_id;
  owner_token := v_token;
  return next;
end $$;

-- The same document shape is used for editing and for JSON import/export.
create function public.get_quiz(p_quiz_id uuid, p_token text) returns jsonb
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
              'answerImagePath', q.answer_image_path
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

-- Replaces the quiz with the document. Drafts may have empty texts; create_room checks completeness.
create function public.save_quiz(p_quiz_id uuid, p_token text, p_document jsonb) returns void
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
          category_id, position, base_points, text, image_path, answer_text, answer_image_path
        ) values (
          v_category_id,
          v_question_no,
          (v_question ->> 'basePoints')::int,
          coalesce(v_question ->> 'text', ''),
          v_question ->> 'imagePath',
          coalesce(v_question ->> 'answerText', ''),
          v_question ->> 'answerImagePath'
        );
      end loop;
    end loop;
  end loop;
exception
  when invalid_text_representation or check_violation or not_null_violation then
    raise exception 'invalid_document';
end $$;

-- Running games keep their own copy. Uploaded files stay in the bucket until cleaned up by hand.
create function public.delete_quiz(p_quiz_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_quiz_owner(p_quiz_id, p_token);
  delete from private.quizzes where id = p_quiz_id;
end $$;

-- ----------------------------------------------------------------------------------------- rooms

create function public.create_room(p_quiz_id uuid, p_quiz_token text)
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

    insert into private.room_cell_contents (cell_id, text, image_path, answer_text, answer_image_path)
    values (v_cell_id, v_row.text, v_row.image_path, v_row.answer_text, v_row.answer_image_path);
  end loop;

  host_token := v_token;
  return next;
end $$;

create function public.is_room_host(p_room_id uuid, p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select from private.room_secrets
    where room_id = p_room_id and host_token_hash = private.hash_token(p_token)
  )
$$;

-- --------------------------------------------------------------------------------------- players

create function public.join_room(p_code text, p_nickname text)
returns table (room_id uuid, player_id uuid, player_token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_token text := private.new_token();
begin
  if char_length(v_nickname) not between 1 and 24 then
    raise exception 'invalid_nickname';
  end if;

  -- The lock keeps the player limit exact under simultaneous joins.
  select * into v_room from public.rooms
  where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if v_room.state = 'finished' then
    raise exception 'room_finished';
  end if;
  if (select count(*) from public.players p where p.room_id = v_room.id) >= 32 then
    raise exception 'room_full';
  end if;

  begin
    insert into public.players (room_id, nickname)
    values (v_room.id, v_nickname)
    returning id into player_id;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;

  insert into private.player_secrets (player_id, token_hash)
  values (join_room.player_id, private.hash_token(v_token));

  room_id := v_room.id;
  player_token := v_token;
  return next;
end $$;

-- Lets a returning player check that the session saved on their device is still valid.
create function public.is_room_player(p_player_id uuid, p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select from private.player_secrets
    where player_id = p_player_id and token_hash = private.hash_token(p_token)
  )
$$;

-- The press. The single UPDATE decides the winner: concurrent calls queue on the row lock and
-- re-check the WHERE clause, so exactly one succeeds. Returns whether this player holds the turn,
-- which also makes a repeated press by the winner harmless.
create function public.buzz(p_room_id uuid, p_player_id uuid, p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_won boolean;
begin
  if not exists (
    select from private.player_secrets s
    join public.players p on p.id = s.player_id
    where s.player_id = p_player_id
      and s.token_hash = private.hash_token(p_token)
      and p.room_id = p_room_id
  ) then
    raise exception 'not_authorized';
  end if;

  update public.rooms
  set state = 'buzzed', buzz_winner_player_id = p_player_id
  where id = p_room_id
    and state = 'buzzing_open'
    and buzz_winner_player_id is null
    and not (p_player_id = any (spent_player_ids));

  if found then
    return true;
  end if;

  select buzz_winner_player_id = p_player_id into v_won
  from public.rooms where id = p_room_id;
  return coalesce(v_won, false);
end $$;

-- ---------------------------------------------------------------------------------- host actions

create function public.start_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'lobby' then
    raise exception 'invalid_state';
  end if;
  update public.rooms set state = 'board' where id = p_room_id;
end $$;

create function public.open_question(p_room_id uuid, p_token text, p_cell_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_cell public.room_cells;
  v_content private.room_cell_contents;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'board' then
    raise exception 'invalid_state';
  end if;

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
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

create function public.open_buzz(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'question_shown' then
    raise exception 'invalid_state';
  end if;
  update public.rooms set state = 'buzzing_open' where id = p_room_id;
end $$;

-- What the host reads aloud from; players get the answer only when it is revealed.
create function public.host_answer(p_room_id uuid, p_token text)
returns table (answer_text text, answer_image_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_host(p_room_id, p_token);
  return query
    select c.answer_text, c.answer_image_path
    from public.rooms r
    join private.room_cell_contents c on c.cell_id = r.current_cell_id
    where r.id = p_room_id;
end $$;

create function private.reveal_answer(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_content private.room_cell_contents;
begin
  select * into v_content from private.room_cell_contents where cell_id = p_room.current_cell_id;
  update public.room_cells set played = true where id = p_room.current_cell_id;
  update public.rooms set
    state = 'answer_shown',
    answer_text = v_content.answer_text,
    answer_image_path = v_content.answer_image_path
  where id = p_room.id;
end $$;

create function public.judge(p_room_id uuid, p_token text, p_correct boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_delta int;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'buzzed' or v_room.buzz_winner_player_id is null or p_correct is null then
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
      spent_player_ids = spent_player_ids || v_room.buzz_winner_player_id
    where id = p_room_id;
  end if;
end $$;

-- Nobody answered, or the host decides to move on: the tile closes without points.
create function public.skip_question(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state not in ('question_shown', 'buzzing_open', 'buzzed') then
    raise exception 'invalid_state';
  end if;
  perform private.reveal_answer(v_room);
end $$;

create function public.return_to_board(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_round_done boolean;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'answer_shown' then
    raise exception 'invalid_state';
  end if;

  select not exists (
    select from public.room_cells
    where room_id = p_room_id and round = v_room.round and not played
  ) into v_round_done;

  update public.rooms set
    state = case when v_round_done then 'round_end'::public.room_state else 'board' end,
    current_cell_id = null,
    current_points = null,
    question_text = null,
    question_image_path = null,
    answer_text = null,
    answer_image_path = null,
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

-- Also available from the board, so the host can cut a round short.
create function public.next_round(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state not in ('board', 'round_end') then
    raise exception 'invalid_state';
  end if;

  if v_room.round >= v_room.round_count then
    update public.rooms set state = 'finished' where id = p_room_id;
  else
    update public.rooms set state = 'board', round = round + 1 where id = p_room_id;
  end if;
end $$;

create function public.finish_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_host(p_room_id, p_token);
  perform private.lock_room(p_room_id);
  update public.rooms set
    state = 'finished',
    current_cell_id = null,
    current_points = null,
    question_text = null,
    question_image_path = null,
    answer_text = null,
    answer_image_path = null,
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

create function public.adjust_score(p_room_id uuid, p_token text, p_player_id uuid, p_delta int)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_host(p_room_id, p_token);
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta';
  end if;

  update public.players set score = score + p_delta
  where id = p_player_id and room_id = p_room_id;
  if not found then
    raise exception 'player_not_found';
  end if;

  insert into private.answers_log (room_id, cell_id, player_id, correct, delta)
  values (p_room_id, null, p_player_id, null, p_delta);
end $$;

-- ----------------------------------------------------------------------------------- permissions

-- Functions are executable by PUBLIC by default, and Supabase also grants them to anon. Public
-- functions are revoked by name: a shared database may hold another application's functions.
revoke all on all functions in schema private from public, anon, authenticated;

revoke all on function
  public.create_quiz(text),
  public.get_quiz(uuid, text),
  public.save_quiz(uuid, text, jsonb),
  public.delete_quiz(uuid, text),
  public.create_room(uuid, text),
  public.is_room_host(uuid, text),
  public.join_room(text, text),
  public.is_room_player(uuid, text),
  public.buzz(uuid, uuid, text),
  public.start_game(uuid, text),
  public.open_question(uuid, text, uuid),
  public.open_buzz(uuid, text),
  public.host_answer(uuid, text),
  public.judge(uuid, text, boolean),
  public.skip_question(uuid, text),
  public.return_to_board(uuid, text),
  public.next_round(uuid, text),
  public.finish_game(uuid, text),
  public.adjust_score(uuid, text, uuid, integer)
from public, anon, authenticated;

grant execute on function
  public.create_quiz(text),
  public.get_quiz(uuid, text),
  public.save_quiz(uuid, text, jsonb),
  public.delete_quiz(uuid, text),
  public.create_room(uuid, text),
  public.is_room_host(uuid, text),
  public.join_room(text, text),
  public.is_room_player(uuid, text),
  public.buzz(uuid, uuid, text),
  public.start_game(uuid, text),
  public.open_question(uuid, text, uuid),
  public.open_buzz(uuid, text),
  public.host_answer(uuid, text),
  public.judge(uuid, text, boolean),
  public.skip_question(uuid, text),
  public.return_to_board(uuid, text),
  public.next_round(uuid, text),
  public.finish_game(uuid, text),
  public.adjust_score(uuid, text, uuid, integer)
to anon, authenticated;
