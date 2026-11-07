-- Host actions shared the same opening and the same reset of the question fields. Behavior and error
-- codes stay as they were; the pgTAP suite covers them.

-- The opening of every host action: prove the token, lock the room, check the state.
create function private.host_room(
  p_room_id uuid,
  p_token text,
  p_allowed_states public.room_state[] default null
) returns public.rooms
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_host(p_room_id, p_token);
  v_room := private.lock_room(p_room_id);
  if p_allowed_states is not null and not (v_room.state = any (p_allowed_states)) then
    raise exception 'invalid_state';
  end if;
  return v_room;
end $$;

create function private.leave_question(p_room_id uuid, p_next_state public.room_state) returns void
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
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

revoke all on function
  private.host_room(uuid, text, public.room_state[]),
  private.leave_question(uuid, public.room_state)
from public, anon, authenticated;

create or replace function public.start_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.host_room(p_room_id, p_token, array['lobby']::public.room_state[]);
  update public.rooms set state = 'board' where id = p_room_id;
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
    buzz_winner_player_id = null,
    spent_player_ids = '{}'
  where id = p_room_id;
end $$;

create or replace function public.open_buzz(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.host_room(p_room_id, p_token, array['question_shown']::public.room_state[]);
  update public.rooms set state = 'buzzing_open' where id = p_room_id;
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
      spent_player_ids = spent_player_ids || v_room.buzz_winner_player_id
    where id = p_room_id;
  end if;
end $$;

create or replace function public.skip_question(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(
    p_room_id, p_token, array['question_shown', 'buzzing_open', 'buzzed']::public.room_state[]
  );
  perform private.reveal_answer(v_room);
end $$;

create or replace function public.return_to_board(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_round_done boolean;
begin
  v_room := private.host_room(p_room_id, p_token, array['answer_shown']::public.room_state[]);

  select not exists (
    select from public.room_cells
    where room_id = p_room_id and round = v_room.round and not played
  ) into v_round_done;

  perform private.leave_question(
    p_room_id, case when v_round_done then 'round_end'::public.room_state else 'board' end
  );
end $$;

create or replace function public.next_round(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['board', 'round_end']::public.room_state[]);

  if v_room.round >= v_room.round_count then
    update public.rooms set state = 'finished' where id = p_room_id;
  else
    update public.rooms set state = 'board', round = round + 1 where id = p_room_id;
  end if;
end $$;

create or replace function public.finish_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.host_room(p_room_id, p_token);
  perform private.leave_question(p_room_id, 'finished');
end $$;
