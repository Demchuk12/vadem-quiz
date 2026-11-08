-- How late the others were. The winning press notes its moment; every later press while the
-- winner answers is kept with its distance from it, in milliseconds, by the database's own clock,
-- so a phone can neither fake it nor disagree with who won. Nothing here is secret: the room row
-- carries it to every screen.
alter table public.rooms
  add column buzzed_at timestamptz,
  add column late_presses jsonb not null default '[]';

create or replace function public.buzz(p_room_id uuid, p_player_id uuid, p_token text)
returns boolean
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

  -- The single UPDATE still decides the winner: concurrent calls queue on the row lock and
  -- re-check the WHERE clause, so exactly one succeeds.
  update public.rooms
  set state = 'buzzed',
    buzz_winner_player_id = p_player_id,
    buzzed_at = clock_timestamp(),
    late_presses = '[]'
  where id = p_room_id
    and state = 'buzzing_open'
    and buzz_winner_player_id is null
    and not (p_player_id = any (spent_player_ids));

  if found then
    return true;
  end if;

  -- Too late: noted once per player, for those who could still have answered, ten at most.
  update public.rooms
  set late_presses = late_presses || jsonb_build_array(jsonb_build_object(
    'player_id', p_player_id,
    'ms', greatest(1, round(extract(epoch from clock_timestamp() - buzzed_at) * 1000))::int
  ))
  where id = p_room_id
    and state = 'buzzed'
    and buzzed_at is not null
    and buzz_winner_player_id <> p_player_id
    and not (p_player_id = any (spent_player_ids))
    and jsonb_array_length(late_presses) < 10
    and not late_presses @> jsonb_build_array(jsonb_build_object('player_id', p_player_id));

  select buzz_winner_player_id = p_player_id into v_won
  from public.rooms where id = p_room_id;
  return coalesce(v_won, false);
end $$;
