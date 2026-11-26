-- "Господар": players take turns rolling two dice around a ring of 32 cells, buy the land they stop
-- on (or let it go to an auction), charge rent, build houses on whole regions, mortgage, trade and
-- go bankrupt. The game ends after a number of laps, after a number of minutes, or when one player
-- is left; the richest wins.
--
-- Nothing of a running game is secret except the order of the two card decks, so the board, money,
-- positions, offers and a log of events are public and reach every client through realtime. The
-- decks stay in `private`. Dice are thrown here, never by a client.
--
-- The ring, its prices and its rents are fixed (`private.estate_layout`); a quiz only names the
-- regions and cells, writes the cards and picks the settings.

alter table private.quizzes
  drop constraint quizzes_mode_check,
  add constraint quizzes_mode_check check (mode in ('board', 'bluff', 'guess', 'estate'));

-- --------------------------------------------------------------------------------------- the ring

create table private.estate_layout (
  idx int primary key check (idx between 0 and 31),
  kind text not null check (kind in (
    'start', 'city', 'community', 'tax', 'station', 'fate', 'utility', 'cnap', 'rest', 'summons'
  )),
  region int check (region between 0 and 7),
  price int not null default 0,
  -- A city's rent bare, with one, two and three houses, and with a manor.
  rents int[],
  house_cost int not null default 0
);

insert into private.estate_layout (idx, kind, region, price) values
  (0, 'start', null, 0), (1, 'city', 0, 600), (2, 'community', null, 0), (3, 'city', 0, 600),
  (4, 'tax', null, 0), (5, 'station', null, 2000), (6, 'city', 1, 1000), (7, 'city', 1, 1200),
  (8, 'cnap', null, 0), (9, 'city', 2, 1400), (10, 'utility', null, 1500), (11, 'city', 2, 1600),
  (12, 'city', 3, 1800), (13, 'station', null, 2000), (14, 'fate', null, 0), (15, 'city', 3, 2000),
  (16, 'rest', null, 0), (17, 'city', 4, 2200), (18, 'community', null, 0), (19, 'city', 4, 2200),
  (20, 'city', 4, 2400), (21, 'station', null, 2000), (22, 'city', 5, 2600), (23, 'city', 5, 2800),
  (24, 'summons', null, 0), (25, 'city', 6, 3000), (26, 'utility', null, 1500), (27, 'city', 6, 3200),
  (28, 'fate', null, 0), (29, 'station', null, 2000), (30, 'city', 7, 3500), (31, 'city', 7, 4000);

update private.estate_layout set
  rents = array(
    select (round(price * m / 10) * 10)::int
    from unnest(array[0.08, 0.4, 1.1, 2.6, 4.2]) with ordinality as u(m, o) order by o
  ),
  -- A house costs more the further the side of the ring.
  house_cost = (array[500, 1000, 1500, 2000])[idx / 8 + 1]
where kind = 'city';

-- ------------------------------------------------------------------------------------- the quiz

-- `fate` and `community` hold { text, effect } cards; see `estate_valid_card` for the effects.
create table private.estate_boards (
  quiz_id uuid primary key references private.quizzes on delete cascade,
  regions text[] not null check (cardinality(regions) = 8),
  cells text[] not null check (cardinality(cells) = 32),
  fate jsonb not null,
  community jsonb not null,
  start_money int not null check (start_money between 5000 and 50000),
  end_kind text not null check (end_kind in ('laps', 'minutes', 'last')),
  end_value int not null,
  turn_seconds int check (turn_seconds between 10 and 120)
);

-- -------------------------------------------------------------------------------------- the game

-- Seen by everyone.
-- `estate_step`: what the player whose turn it is must do now: roll; decide on free land they stand
-- on; wait for its auction; pay a debt; or act (build, trade, end the turn).
-- `estate_next`: the step a decision, an auction or a paid debt leads back to (a double rolls again).
-- `estate_debts`: [{ to, amount }] the player owes; `to` is null for the bank.
-- `estate_auction`: { cell, bid, leader } while the land is auctioned.
-- `round` counts laps of turns; `round_count` is the lap limit, 0 when the game ends otherwise.
alter table public.rooms
  add column estate_turn uuid references public.players on delete set null,
  add column estate_step text check (estate_step in ('roll', 'decide', 'auction', 'debt', 'act')),
  add column estate_next text check (estate_next in ('roll', 'act')),
  add column estate_dice int[],
  add column estate_doubles int not null default 0,
  add column estate_debts jsonb,
  add column estate_auction jsonb,
  add column estate_regions text[],
  add column estate_start_money int,
  add column estate_end_kind text,
  add column estate_end_value int,
  add column estate_ends_at timestamptz,
  add column estate_turn_seconds int;

-- `cnap_tries` is null outside the queue and counts the failed rolls in it.
alter table public.players
  add column money int,
  add column position int,
  add column cnap_tries int,
  add column bankrupt boolean not null default false,
  add column turn_order int;

create table public.estate_cells (
  room_id uuid not null references public.rooms on delete cascade,
  idx int not null,
  kind text not null,
  name text not null,
  region int,
  price int not null,
  rents int[],
  house_cost int not null,
  owner_id uuid references public.players on delete set null,
  -- Houses on a city: 1 to 3, and 4 for a manor.
  level int not null default 0 check (level between 0 and 4),
  mortgaged boolean not null default false,
  primary key (room_id, idx)
);

-- The game's story, which clients word in their own language.
create table public.estate_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms on delete cascade,
  player_id uuid references public.players on delete set null,
  code text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index estate_events_room on public.estate_events (room_id, id);

-- One open offer per player. `give_*` goes from `from_id` to `to_id`, `get_*` comes back.
create table public.estate_offers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  from_id uuid not null references public.players on delete cascade,
  to_id uuid not null references public.players on delete cascade,
  give_cells int[] not null default '{}',
  get_cells int[] not null default '{}',
  give_money int not null default 0 check (give_money >= 0),
  get_money int not null default 0 check (get_money >= 0),
  created_at timestamptz not null default now(),
  unique (room_id, from_id)
);

-- The shuffled decks. A drawn card goes to the bottom.
create table private.estate_decks (
  room_id uuid not null references public.rooms on delete cascade,
  deck text not null check (deck in ('fate', 'community')),
  position int not null,
  text text not null,
  effect jsonb not null,
  primary key (room_id, deck, position)
);

alter table public.estate_cells enable row level security;
alter table public.estate_events enable row level security;
alter table public.estate_offers enable row level security;
create policy estate_cells_read on public.estate_cells for select to anon, authenticated using (true);
create policy estate_events_read on public.estate_events for select to anon, authenticated using (true);
create policy estate_offers_read on public.estate_offers for select to anon, authenticated using (true);
revoke all on public.estate_cells, public.estate_events, public.estate_offers from anon, authenticated;
grant select on public.estate_cells, public.estate_events, public.estate_offers to anon, authenticated;
alter publication supabase_realtime add table
  public.estate_cells, public.estate_events, public.estate_offers;

-- ---------------------------------------------------------------------------------------- helpers

-- Two dice. A test may queue its throws in the setting `estate.dice` ("3,4;6,6"); no client can set
-- it, since no function reachable through the API calls `set_config`.
create function private.estate_dice() returns int[]
language plpgsql volatile set search_path = '' as $$
declare
  v_queue text := coalesce(current_setting('estate.dice', true), '');
  v_pair text;
begin
  if v_queue <> '' then
    v_pair := split_part(v_queue, ';', 1);
    perform set_config('estate.dice', substr(v_queue, char_length(v_pair) + 2), true);
    return array[split_part(v_pair, ',', 1)::int, split_part(v_pair, ',', 2)::int];
  end if;
  return array[1 + floor(random() * 6)::int, 1 + floor(random() * 6)::int];
end $$;

create function private.estate_log(p_room_id uuid, p_player_id uuid, p_code text, p_data jsonb)
returns void
language sql set search_path = '' as $$
  insert into public.estate_events (room_id, player_id, code, data)
  values (p_room_id, p_player_id, p_code, coalesce(p_data, '{}'))
$$;

-- Every step has the turn clock, when the quiz sets one; an auction always runs for ten seconds.
create function private.estate_set_step(p_room_id uuid, p_step text) returns void
language sql set search_path = '' as $$
  update public.rooms set
    estate_step = p_step,
    phase_ends_at = case
      when p_step = 'auction' then now() + interval '10 seconds'
      when estate_turn_seconds is null then null
      else now() + make_interval(secs => estate_turn_seconds)
    end
  where id = p_room_id
$$;

-- `score` is a player's worth, so the standings of every game show the richest first: money, land
-- at its price (mortgaged at half) and houses at theirs.
create function private.estate_settle(p_room_id uuid) returns void
language sql set search_path = '' as $$
  update public.players p set score = coalesce(p.money, 0) + coalesce((
    select sum(case when c.mortgaged then c.price / 2 else c.price end + c.level * c.house_cost)
    from public.estate_cells c where c.room_id = p_room_id and c.owner_id = p.id
  ), 0)::int
  where p.room_id = p_room_id
$$;

-- A payment. One who cannot pay and may owe gets a debt to settle before going on; one who may not
-- (someone else's card asked them) pays what they have.
create function private.estate_charge(
  p_room_id uuid, p_from uuid, p_to uuid, p_amount int, p_can_owe boolean
) returns void
language plpgsql set search_path = '' as $$
declare
  v_money int;
  v_paid int;
begin
  if p_amount <= 0 then
    return;
  end if;
  select money into v_money from public.players where id = p_from;
  if v_money >= p_amount then
    v_paid := p_amount;
  elsif p_can_owe then
    update public.rooms set estate_debts = coalesce(estate_debts, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('to', p_to, 'amount', p_amount))
    where id = p_room_id;
    return;
  else
    v_paid := greatest(v_money, 0);
  end if;
  update public.players set money = money - v_paid where id = p_from;
  if p_to is not null then
    update public.players set money = money + v_paid where id = p_to;
  end if;
end $$;

create function private.estate_rent(p_room_id uuid, p_idx int, p_dice_sum int) returns int
language plpgsql stable set search_path = '' as $$
declare
  v_cell public.estate_cells;
  v_count int;
begin
  select * into v_cell from public.estate_cells where room_id = p_room_id and idx = p_idx;
  if v_cell.owner_id is null or v_cell.mortgaged then
    return 0;
  end if;
  if v_cell.kind = 'city' then
    -- A whole region doubles the rent of bare land.
    if v_cell.level = 0 and not exists (
      select from public.estate_cells c
      where c.room_id = p_room_id and c.kind = 'city' and c.region = v_cell.region
        and c.owner_id is distinct from v_cell.owner_id
    ) then
      return v_cell.rents[1] * 2;
    end if;
    return v_cell.rents[v_cell.level + 1];
  end if;
  select count(*) into v_count from public.estate_cells c
  where c.room_id = p_room_id and c.kind = v_cell.kind and c.owner_id = v_cell.owner_id;
  if v_cell.kind = 'station' then
    return (array[250, 500, 1000, 2000])[v_count];
  end if;
  return p_dice_sum * case when v_count >= 2 then 100 else 40 end;
end $$;

-- Whether any city of the region has a house: then none of it may be mortgaged or traded.
create function private.estate_region_built(p_room_id uuid, p_region int) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select from public.estate_cells c
    where c.room_id = p_room_id and c.kind = 'city' and c.region = p_region and c.level > 0
  )
$$;

create function private.estate_to_cnap(p_room_id uuid, p_player_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  update public.players set position = 8, cnap_tries = 0 where id = p_player_id;
  update public.rooms set estate_doubles = 0 where id = p_room_id;
  perform private.estate_log(p_room_id, p_player_id, 'cnap_in', '{}');
end $$;

-- A move forward past the start pays the salary.
create function private.estate_move_to(
  p_room_id uuid, p_player_id uuid, p_to int, p_forward boolean
) returns void
language plpgsql set search_path = '' as $$
declare
  v_from int;
begin
  select position into v_from from public.players where id = p_player_id;
  if p_forward and p_to < v_from then
    update public.players set money = money + 2000 where id = p_player_id;
    perform private.estate_log(p_room_id, p_player_id, 'salary', jsonb_build_object('amount', 2000));
  end if;
  update public.players set position = p_to where id = p_player_id;
end $$;

-- What the cell a player stops on does. Free land marks the step `decide`; anything owed lands in
-- `estate_debts`. A card that moves the player lands them once more, but draws no second card.
create function private.estate_land(p_room_id uuid, p_player_id uuid, p_depth int) returns void
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
  v_cell public.estate_cells;
  v_rent int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  select c.* into v_cell from public.estate_cells c
  join public.players p on p.id = p_player_id and c.idx = p.position
  where c.room_id = p_room_id;

  if v_cell.kind in ('city', 'station', 'utility') then
    if v_cell.owner_id is null then
      update public.rooms set estate_step = 'decide' where id = p_room_id;
    elsif v_cell.owner_id <> p_player_id then
      v_rent := private.estate_rent(
        p_room_id, v_cell.idx, coalesce(v_room.estate_dice[1] + v_room.estate_dice[2], 7)
      );
      if v_rent > 0 then
        perform private.estate_charge(p_room_id, p_player_id, v_cell.owner_id, v_rent, true);
        perform private.estate_log(p_room_id, p_player_id, 'rent',
          jsonb_build_object('cell', v_cell.idx, 'to', v_cell.owner_id, 'amount', v_rent));
      end if;
    end if;
  elsif v_cell.kind = 'tax' then
    perform private.estate_charge(p_room_id, p_player_id, null, 2000, true);
    perform private.estate_log(p_room_id, p_player_id, 'tax', jsonb_build_object('amount', 2000));
  elsif v_cell.kind = 'summons' then
    perform private.estate_to_cnap(p_room_id, p_player_id);
  elsif v_cell.kind in ('fate', 'community') and p_depth = 0 then
    perform private.estate_draw(p_room_id, p_player_id, v_cell.kind);
  end if;
end $$;

create function private.estate_draw(p_room_id uuid, p_player_id uuid, p_deck text) returns void
language plpgsql set search_path = '' as $$
declare
  v_card private.estate_decks;
  v_effect jsonb;
  v_kind text;
  v_amount int;
  v_other uuid;
  v_position int;
begin
  select * into v_card from private.estate_decks
  where room_id = p_room_id and deck = p_deck
  order by position limit 1;
  update private.estate_decks set position = (
    select max(d.position) + 1 from private.estate_decks d
    where d.room_id = p_room_id and d.deck = p_deck
  )
  where room_id = p_room_id and deck = p_deck and position = v_card.position;

  v_effect := v_card.effect;
  v_kind := v_effect ->> 'kind';
  perform private.estate_log(p_room_id, p_player_id, 'card',
    jsonb_build_object('deck', p_deck, 'text', v_card.text, 'effect', v_effect));

  if v_kind = 'money' then
    v_amount := (v_effect ->> 'amount')::int;
    if v_amount >= 0 then
      update public.players set money = money + v_amount where id = p_player_id;
    else
      perform private.estate_charge(p_room_id, p_player_id, null, -v_amount, true);
    end if;
  elsif v_kind = 'each' then
    v_amount := (v_effect ->> 'amount')::int;
    for v_other in
      select p.id from public.players p
      where p.room_id = p_room_id and p.id <> p_player_id and p.turn_order is not null
        and not p.bankrupt
      order by p.turn_order
    loop
      if v_amount >= 0 then
        perform private.estate_charge(p_room_id, v_other, p_player_id, v_amount, false);
      else
        perform private.estate_charge(p_room_id, p_player_id, v_other, -v_amount, true);
      end if;
    end loop;
  elsif v_kind = 'repairs' then
    select coalesce(sum(case
      when c.level = 4 then (v_effect ->> 'manor')::int
      else c.level * (v_effect ->> 'house')::int
    end), 0) into v_amount
    from public.estate_cells c where c.room_id = p_room_id and c.owner_id = p_player_id;
    perform private.estate_charge(p_room_id, p_player_id, null, v_amount, true);
  elsif v_kind = 'move' then
    perform private.estate_move_to(p_room_id, p_player_id, (v_effect ->> 'to')::int, true);
    perform private.estate_land(p_room_id, p_player_id, 1);
  elsif v_kind = 'back' then
    select position into v_position from public.players where id = p_player_id;
    perform private.estate_move_to(
      p_room_id, p_player_id, (v_position - (v_effect ->> 'steps')::int + 32) % 32, false
    );
    perform private.estate_land(p_room_id, p_player_id, 1);
  elsif v_kind = 'cnap' then
    perform private.estate_to_cnap(p_room_id, p_player_id);
  end if;
end $$;

-- Back to the turn after a decision, an auction or a payment: a debt still open comes first.
create function private.estate_resume(p_room_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if coalesce(jsonb_array_length(v_room.estate_debts), 0) > 0 then
    perform private.estate_set_step(p_room_id, 'debt');
  else
    update public.rooms set estate_next = null where id = p_room_id;
    perform private.estate_set_step(p_room_id, coalesce(v_room.estate_next, 'act'));
  end if;
  perform private.estate_settle(p_room_id);
end $$;

-- After a throw has played out: `p_next` is where the turn goes once nothing is pending.
create function private.estate_after(p_room_id uuid, p_next text) returns void
language plpgsql set search_path = '' as $$
begin
  update public.rooms set estate_next = p_next where id = p_room_id;
  if (select estate_step from public.rooms where id = p_room_id) = 'decide' then
    perform private.estate_set_step(p_room_id, 'decide');
    perform private.estate_settle(p_room_id);
  else
    perform private.estate_resume(p_room_id);
  end if;
end $$;

-- A throw of the player whose turn it is. A double throws again; the third in a row goes to the
-- queue. In the queue a double lets the player out (and on, but not again), and so does the third
-- failed throw, for the 500 fee.
create function private.estate_do_roll(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_dice int[] := private.estate_dice();
  v_double boolean := v_dice[1] = v_dice[2];
  v_player public.players;
begin
  select * into v_player from public.players where id = p_room.estate_turn;
  update public.rooms set estate_dice = v_dice where id = p_room.id;
  perform private.estate_log(p_room.id, v_player.id, 'roll',
    jsonb_build_object('dice', to_jsonb(v_dice), 'from', v_player.position));

  if v_player.cnap_tries is not null then
    if v_double then
      update public.players set cnap_tries = null where id = v_player.id;
      perform private.estate_log(p_room.id, v_player.id, 'cnap_out', '{"how": "double"}');
    elsif v_player.cnap_tries >= 2 then
      update public.players set cnap_tries = null where id = v_player.id;
      perform private.estate_charge(p_room.id, v_player.id, null, 500, true);
      perform private.estate_log(p_room.id, v_player.id, 'cnap_out', '{"how": "forced"}');
    else
      update public.players set cnap_tries = cnap_tries + 1 where id = v_player.id;
      perform private.estate_after(p_room.id, 'act');
      return;
    end if;
    v_double := false;
  elsif v_double and p_room.estate_doubles >= 2 then
    perform private.estate_to_cnap(p_room.id, v_player.id);
    perform private.estate_after(p_room.id, 'act');
    return;
  end if;

  if v_double then
    update public.rooms set estate_doubles = estate_doubles + 1 where id = p_room.id;
  end if;
  perform private.estate_move_to(
    p_room.id, v_player.id, (v_player.position + v_dice[1] + v_dice[2]) % 32, true
  );
  perform private.estate_land(p_room.id, v_player.id, 0);
  perform private.estate_after(p_room.id, case
    when v_double and (select cnap_tries from public.players where id = v_player.id) is null
      then 'roll'
    else 'act'
  end);
end $$;

create function private.estate_finish(p_room_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform private.estate_settle(p_room_id);
  delete from public.estate_offers where room_id = p_room_id;
  update public.rooms set
    state = 'finished', estate_step = null, estate_next = null, estate_turn = null,
    estate_debts = null, estate_auction = null, phase_ends_at = null
  where id = p_room_id;
  perform private.estate_log(p_room_id, (
    select p.id from public.players p
    where p.room_id = p_room_id and p.turn_order is not null
    order by p.score desc, p.turn_order limit 1
  ), 'finished', '{}');
end $$;

-- The turn passes to the next player still in the game. The game ends here: when one is left, when
-- its minutes are up, or when the last lap is done.
create function private.estate_next_turn(p_room_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
  v_order int;
  v_next uuid;
  v_wrapped boolean := false;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if (
    select count(*) from public.players p
    where p.room_id = p_room_id and p.turn_order is not null and not p.bankrupt
  ) <= 1 or (v_room.estate_ends_at is not null and now() >= v_room.estate_ends_at) then
    perform private.estate_finish(p_room_id);
    return;
  end if;

  select turn_order into v_order from public.players where id = v_room.estate_turn;
  select p.id into v_next from public.players p
  where p.room_id = p_room_id and p.turn_order > coalesce(v_order, 0) and not p.bankrupt
  order by p.turn_order limit 1;
  if v_next is null then
    v_wrapped := true;
    select p.id into v_next from public.players p
    where p.room_id = p_room_id and p.turn_order is not null and not p.bankrupt
    order by p.turn_order limit 1;
  end if;
  if v_wrapped and v_room.estate_end_kind = 'laps' and v_room.round >= v_room.round_count then
    perform private.estate_finish(p_room_id);
    return;
  end if;

  update public.rooms set
    estate_turn = v_next,
    round = round + case when v_wrapped then 1 else 0 end,
    estate_dice = null, estate_doubles = 0, estate_debts = null, estate_auction = null,
    estate_next = null
  where id = p_room_id;
  perform private.estate_set_step(p_room_id, 'roll');
  perform private.estate_settle(p_room_id);
end $$;

-- Who a player who gives up owes: the one player their debt is to, or else the bank (null).
create function private.estate_creditor(p_room public.rooms, p_player_id uuid) returns uuid
language sql stable set search_path = '' as $$
  select case
    when p_room.estate_turn = p_player_id and (
      select count(distinct coalesce(d ->> 'to', 'bank'))
      from jsonb_array_elements(coalesce(p_room.estate_debts, '[]')) d
    ) = 1 then (p_room.estate_debts -> 0 ->> 'to')::uuid
  end
$$;

-- A player out of the game. A creditor gets their money, their land as it is mortgaged or not, and
-- half the price of their houses, which go back to the bank; with no creditor the land is free.
create function private.estate_bankrupt(p_room public.rooms, p_player_id uuid, p_creditor uuid)
returns void
language plpgsql set search_path = '' as $$
declare
  v_houses int;
begin
  select coalesce(sum(c.level * c.house_cost / 2), 0) into v_houses
  from public.estate_cells c where c.room_id = p_room.id and c.owner_id = p_player_id;

  if p_creditor is not null then
    update public.players set money = money + v_houses + greatest(
      (select money from public.players where id = p_player_id), 0
    ) where id = p_creditor;
    update public.estate_cells set owner_id = p_creditor, level = 0
    where room_id = p_room.id and owner_id = p_player_id;
  else
    update public.estate_cells set owner_id = null, level = 0, mortgaged = false
    where room_id = p_room.id and owner_id = p_player_id;
  end if;
  update public.players set bankrupt = true, money = 0, cnap_tries = null where id = p_player_id;
  delete from public.estate_offers
  where room_id = p_room.id and (from_id = p_player_id or to_id = p_player_id);
  if (p_room.estate_auction ->> 'leader')::uuid = p_player_id then
    update public.rooms set estate_auction = estate_auction || '{"bid": 0, "leader": null}'
    where id = p_room.id;
  end if;
  perform private.estate_log(p_room.id, p_player_id, 'bankrupt',
    jsonb_build_object('to', p_creditor));

  if p_room.estate_turn = p_player_id then
    perform private.estate_next_turn(p_room.id);
  elsif (
    select count(*) from public.players p
    where p.room_id = p_room.id and p.turn_order is not null and not p.bankrupt
  ) <= 1 then
    perform private.estate_finish(p_room.id);
  else
    perform private.estate_settle(p_room.id);
  end if;
end $$;

create function private.estate_open_auction(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_cell int;
begin
  select position into v_cell from public.players where id = p_room.estate_turn;
  update public.rooms set estate_auction = jsonb_build_object('cell', v_cell, 'bid', 0, 'leader', null)
  where id = p_room.id;
  perform private.estate_set_step(p_room.id, 'auction');
  perform private.estate_log(p_room.id, p_room.estate_turn, 'auction',
    jsonb_build_object('cell', v_cell));
end $$;

create function private.estate_close_auction(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_cell int := (p_room.estate_auction ->> 'cell')::int;
  v_bid int := (p_room.estate_auction ->> 'bid')::int;
  v_leader uuid := (p_room.estate_auction ->> 'leader')::uuid;
begin
  -- The leader may have spent their money in a trade meanwhile.
  if v_leader is not null and (select money from public.players where id = v_leader) >= v_bid then
    update public.players set money = money - v_bid where id = v_leader;
    update public.estate_cells set owner_id = v_leader where room_id = p_room.id and idx = v_cell;
    perform private.estate_log(p_room.id, v_leader, 'auction_won',
      jsonb_build_object('cell', v_cell, 'amount', v_bid));
  else
    perform private.estate_log(p_room.id, null, 'auction_none', jsonb_build_object('cell', v_cell));
  end if;
  update public.rooms set estate_auction = null where id = p_room.id;
  perform private.estate_resume(p_room.id);
end $$;

-- The opening of a turn action: the player, the room locked, their turn, the step.
create function private.estate_my_turn(
  p_room_id uuid, p_player_id uuid, p_token text, p_steps text[]
) returns public.rooms
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'estate_playing' then
    raise exception 'invalid_state';
  end if;
  if v_room.estate_turn is distinct from p_player_id then
    raise exception 'not_your_turn';
  end if;
  if not (v_room.estate_step = any (p_steps)) then
    raise exception 'invalid_state';
  end if;
  return v_room;
end $$;

-- The opening of an action any player still in the game may take.
create function private.estate_my_game(p_room_id uuid, p_player_id uuid, p_token text)
returns public.rooms
language plpgsql set search_path = '' as $$
declare
  v_room public.rooms;
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'estate_playing' or exists (
    select from public.players p
    where p.id = p_player_id and (p.bankrupt or p.turn_order is null)
  ) then
    raise exception 'invalid_state';
  end if;
  return v_room;
end $$;

create function private.estate_own_cell(p_room_id uuid, p_player_id uuid, p_idx int)
returns public.estate_cells
language plpgsql stable set search_path = '' as $$
declare
  v_cell public.estate_cells;
begin
  select * into v_cell from public.estate_cells where room_id = p_room_id and idx = p_idx;
  if not found or v_cell.owner_id is distinct from p_player_id then
    raise exception 'not_owner';
  end if;
  return v_cell;
end $$;

-- ----------------------------------------------------------------------------------------- quizzes

create function private.estate_valid_card(p_card jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v_effect jsonb := p_card -> 'effect';
begin
  if jsonb_typeof(p_card) <> 'object' or char_length(coalesce(p_card ->> 'text', '')) > 160
    or jsonb_typeof(v_effect) is distinct from 'object' then
    return false;
  end if;
  return coalesce(case v_effect ->> 'kind'
    when 'money' then (v_effect ->> 'amount')::int between -5000 and 5000
    when 'each' then (v_effect ->> 'amount')::int between -1000 and 1000
    when 'repairs' then (v_effect ->> 'house')::int between 0 and 1000
      and (v_effect ->> 'manor')::int between 0 and 3000
    -- Not onto a card cell: a card leads to no second card.
    when 'move' then (v_effect ->> 'to')::int between 0 and 31
      and (v_effect ->> 'to')::int not in (2, 14, 18, 28)
    when 'back' then (v_effect ->> 'steps')::int between 1 and 6
    when 'cnap' then true
    else false
  end, false);
end $$;

create function private.save_estate_quiz(p_quiz_id uuid, p_title text, p_document jsonb)
returns void
language plpgsql set search_path = '' as $$
declare
  v_regions text[];
  v_cells text[];
  v_end_kind text := p_document ->> 'endKind';
  v_end_value int := (p_document ->> 'endValue')::int;
begin
  if jsonb_typeof(p_document -> 'regions') is distinct from 'array'
    or jsonb_typeof(p_document -> 'cells') is distinct from 'array'
    or jsonb_typeof(p_document -> 'fate') is distinct from 'array'
    or jsonb_typeof(p_document -> 'community') is distinct from 'array'
    or jsonb_array_length(p_document -> 'fate') not between 1 and 16
    or jsonb_array_length(p_document -> 'community') not between 1 and 16
    or exists (
      select from jsonb_array_elements((p_document -> 'fate') || (p_document -> 'community')) c
      where not private.estate_valid_card(c)
    )
    or not (
      (v_end_kind = 'laps' and v_end_value between 3 and 100)
      or (v_end_kind = 'minutes' and v_end_value between 10 and 300)
      or (v_end_kind = 'last' and v_end_value = 0)
    ) then
    raise exception 'invalid_document';
  end if;

  select array_agg(btrim(coalesce(value, '')) order by ordinality) into v_regions
  from jsonb_array_elements_text(p_document -> 'regions') with ordinality;
  select array_agg(btrim(coalesce(value, '')) order by ordinality) into v_cells
  from jsonb_array_elements_text(p_document -> 'cells') with ordinality;
  if exists (select from unnest(v_regions || v_cells) n where char_length(n) > 24) then
    raise exception 'invalid_document';
  end if;

  update private.quizzes set title = p_title, mode = 'estate', updated_at = now()
  where id = p_quiz_id;
  delete from private.categories where quiz_id = p_quiz_id;
  delete from private.bluff_facts where quiz_id = p_quiz_id;
  delete from private.guess_questions where quiz_id = p_quiz_id;

  insert into private.estate_boards (
    quiz_id, regions, cells, fate, community, start_money, end_kind, end_value, turn_seconds
  ) values (
    p_quiz_id, v_regions, v_cells,
    (select jsonb_agg(jsonb_set(c, '{text}', to_jsonb(btrim(c ->> 'text'))))
     from jsonb_array_elements(p_document -> 'fate') c),
    (select jsonb_agg(jsonb_set(c, '{text}', to_jsonb(btrim(c ->> 'text'))))
     from jsonb_array_elements(p_document -> 'community') c),
    (p_document ->> 'startMoney')::int, v_end_kind, v_end_value,
    (p_document ->> 'turnSeconds')::int
  )
  on conflict (quiz_id) do update set
    regions = excluded.regions, cells = excluded.cells, fate = excluded.fate,
    community = excluded.community, start_money = excluded.start_money,
    end_kind = excluded.end_kind, end_value = excluded.end_value,
    turn_seconds = excluded.turn_seconds;
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
  if p_document ->> 'mode' = 'estate' then
    perform private.save_estate_quiz(p_quiz_id, v_title, p_document);
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
    ),
    'estate', (
      select jsonb_build_object(
        'regions', to_jsonb(b.regions),
        'cells', to_jsonb(b.cells),
        'fate', b.fate,
        'community', b.community,
        'startMoney', b.start_money,
        'endKind', b.end_kind,
        'endValue', b.end_value,
        'turnSeconds', b.turn_seconds
      )
      from private.estate_boards b where b.quiz_id = p_quiz_id and v_quiz.mode = 'estate'
    )
  );
end $$;

-- ------------------------------------------------------------------------------------------- rooms

create function private.create_estate_room(p_quiz private.quizzes)
returns table (room_id uuid, room_code text, host_token text)
language plpgsql set search_path = '' as $$
declare
  v_token text := private.new_token();
  v_board private.estate_boards;
begin
  select * into v_board from private.estate_boards b where b.quiz_id = p_quiz.id;
  if not found or exists (select from unnest(v_board.regions || v_board.cells) n where n = '')
    or exists (
      select from jsonb_array_elements(v_board.fate || v_board.community) c
      where btrim(c ->> 'text') = ''
    ) then
    raise exception 'quiz_incomplete';
  end if;

  loop
    begin
      insert into public.rooms (
        code, quiz_title, round_count, mode, estate_regions, estate_start_money, estate_end_kind,
        estate_end_value, estate_turn_seconds
      ) values (
        private.random_room_code(), p_quiz.title,
        case when v_board.end_kind = 'laps' then v_board.end_value else 0 end,
        'estate', v_board.regions, v_board.start_money, v_board.end_kind, v_board.end_value,
        v_board.turn_seconds
      )
      returning id, code into room_id, room_code;
      exit;
    exception when unique_violation then
      null; -- The code is taken: draw another.
    end;
  end loop;

  insert into private.room_secrets (room_id, host_token_hash)
  values (create_estate_room.room_id, private.hash_token(v_token));

  insert into public.estate_cells (room_id, idx, kind, name, region, price, rents, house_cost)
  select create_estate_room.room_id, l.idx, l.kind, v_board.cells[l.idx + 1], l.region, l.price,
    l.rents, l.house_cost
  from private.estate_layout l;

  -- A test may keep the decks in the order written, with `estate.shuffle` = 'off'.
  insert into private.estate_decks (room_id, deck, position, text, effect)
  select create_estate_room.room_id, d.deck,
    row_number() over (partition by d.deck order by case
      when current_setting('estate.shuffle', true) = 'off' then d.ordinality::float8
      else random()
    end),
    d.card ->> 'text', d.card -> 'effect'
  from (
    select 'fate' as deck, f.card, f.ordinality
    from jsonb_array_elements(v_board.fate) with ordinality as f(card, ordinality)
    union all
    select 'community', g.card, g.ordinality
    from jsonb_array_elements(v_board.community) with ordinality as g(card, ordinality)
  ) as d;

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
  if v_quiz.mode = 'estate' then
    return query select * from private.create_estate_room(v_quiz);
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

-- A game of eight at most, and nobody joins once it has begun: the turn order is fixed at the start.
create or replace function public.join_room(p_code text, p_nickname text)
returns table (room_id uuid, player_id uuid, player_token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_token text := private.new_token();
  v_players int;
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
  select count(*) into v_players from public.players p where p.room_id = v_room.id;
  if v_room.mode = 'estate' and v_room.state <> 'lobby' then
    raise exception 'game_started';
  end if;
  if v_players >= 32 or (v_room.mode = 'estate' and v_players >= 8) then
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

create function private.estate_start(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_first uuid;
begin
  update public.players p set
    turn_order = o.n, money = p_room.estate_start_money, position = 0, cnap_tries = null,
    bankrupt = false, score = p_room.estate_start_money
  from (
    select x.id, row_number() over (order by x.joined_at, x.id) as n
    from public.players x where x.room_id = p_room.id
  ) as o
  where p.id = o.id;
  select p.id into v_first from public.players p
  where p.room_id = p_room.id order by p.turn_order limit 1;

  update public.rooms set
    state = 'estate_playing', round = 1, estate_turn = v_first, estate_doubles = 0,
    estate_ends_at = case
      when estate_end_kind = 'minutes' then now() + make_interval(mins => estate_end_value)
    end
  where id = p_room.id;
  perform private.estate_set_step(p_room.id, 'roll');
  perform private.estate_log(p_room.id, null, 'start', '{}');
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
  elsif v_room.mode = 'estate' then
    if v_players < 2 then
      raise exception 'not_enough_players';
    end if;
    perform private.estate_start(v_room);
  else
    update public.rooms set state = 'board' where id = p_room_id;
  end if;
end $$;

create or replace function public.finish_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token);
  if v_room.mode = 'estate' and v_room.state = 'estate_playing' then
    perform private.estate_finish(p_room_id);
    return;
  end if;
  perform private.leave_question(p_room_id, 'finished');
  update public.rooms set
    phase_ends_at = null, bluff_done = '{}', bluff_options = null, bluff_deltas = null,
    guess_unit = null, guess_done = '{}', guess_results = null
  where id = p_room_id and mode <> 'board';
end $$;

-- ------------------------------------------------------------------------------------- the turn

create function public.estate_roll(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.estate_do_roll(
    private.estate_my_turn(p_room_id, p_player_id, p_token, array['roll'])
  );
end $$;

-- Out of the queue for the fee, before the throw.
create function public.estate_pay_bail(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_player public.players;
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['roll']);
  select * into v_player from public.players where id = p_player_id;
  if v_player.cnap_tries is null then
    raise exception 'invalid_state';
  end if;
  if v_player.money < 500 then
    raise exception 'not_enough_money';
  end if;
  update public.players set money = money - 500, cnap_tries = null where id = p_player_id;
  perform private.estate_log(p_room_id, p_player_id, 'cnap_out', '{"how": "bail"}');
  perform private.estate_settle(p_room_id);
end $$;

create function public.estate_buy(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cell public.estate_cells;
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['decide']);
  select c.* into v_cell from public.estate_cells c
  join public.players p on p.id = p_player_id and c.idx = p.position
  where c.room_id = p_room_id;
  if (select money from public.players where id = p_player_id) < v_cell.price then
    raise exception 'not_enough_money';
  end if;
  update public.players set money = money - v_cell.price where id = p_player_id;
  update public.estate_cells set owner_id = p_player_id where room_id = p_room_id and idx = v_cell.idx;
  perform private.estate_log(p_room_id, p_player_id, 'buy',
    jsonb_build_object('cell', v_cell.idx, 'amount', v_cell.price));
  perform private.estate_resume(p_room_id);
end $$;

-- Land the player does not buy goes to an auction among everyone.
create function public.estate_decline(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.estate_open_auction(
    private.estate_my_turn(p_room_id, p_player_id, p_token, array['decide'])
  );
end $$;

-- A bid raises the last by 10 at least, and each one gives the auction ten more seconds.
create function public.estate_bid(p_room_id uuid, p_player_id uuid, p_token text, p_amount int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.estate_my_game(p_room_id, p_player_id, p_token);
  if v_room.estate_step <> 'auction' or v_room.phase_ends_at < now() then
    raise exception 'invalid_state';
  end if;
  if p_amount is null or p_amount < (v_room.estate_auction ->> 'bid')::int + 10 then
    raise exception 'invalid_bid';
  end if;
  if (select money from public.players where id = p_player_id) < p_amount then
    raise exception 'not_enough_money';
  end if;
  update public.rooms set
    estate_auction = estate_auction
      || jsonb_build_object('bid', p_amount, 'leader', p_player_id),
    phase_ends_at = now() + interval '10 seconds'
  where id = p_room_id;
end $$;

create function public.estate_end_turn(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['act']);
  perform private.estate_next_turn(p_room_id);
end $$;

create function public.estate_pay_debt(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_debt jsonb;
begin
  v_room := private.estate_my_turn(p_room_id, p_player_id, p_token, array['debt']);
  if (select money from public.players where id = p_player_id) < (
    select sum((d ->> 'amount')::int) from jsonb_array_elements(v_room.estate_debts) d
  ) then
    raise exception 'not_enough_money';
  end if;
  for v_debt in select * from jsonb_array_elements(v_room.estate_debts) loop
    perform private.estate_charge(
      p_room_id, p_player_id, (v_debt ->> 'to')::uuid, (v_debt ->> 'amount')::int, false
    );
  end loop;
  update public.rooms set estate_debts = null where id = p_room_id;
  perform private.estate_log(p_room_id, p_player_id, 'debt_paid', '{}');
  perform private.estate_resume(p_room_id);
end $$;

-- A player may leave the game at any moment; in debt, what they have goes to the one they owe.
create function public.estate_give_up(p_room_id uuid, p_player_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.estate_my_game(p_room_id, p_player_id, p_token);
  perform private.estate_bankrupt(v_room, p_player_id, private.estate_creditor(v_room, p_player_id));
end $$;

create function public.estate_remove_player(p_room_id uuid, p_token text, p_player_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['estate_playing']::public.room_state[]);
  if not exists (
    select from public.players p
    where p.id = p_player_id and p.room_id = p_room_id and not p.bankrupt and p.turn_order is not null
  ) then
    raise exception 'player_not_found';
  end if;
  perform private.estate_bankrupt(v_room, p_player_id, null);
end $$;

-- When a step's clock runs out, any page in the room may say so; the step then plays itself out as
-- the slowest choice would: a throw, no purchase, the end of the auction or turn, giving up a debt.
-- Before its time, or once it has moved on, nothing happens.
create function public.estate_timeout(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  if not exists (
    select from private.room_secrets s
    where s.room_id = p_room_id and s.host_token_hash = private.hash_token(p_token)
  ) and not exists (
    select from private.player_secrets s join public.players p on p.id = s.player_id
    where p.room_id = p_room_id and s.token_hash = private.hash_token(p_token)
  ) then
    raise exception 'not_authorized';
  end if;
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'estate_playing' or v_room.phase_ends_at is null
    or v_room.phase_ends_at > now() then
    return;
  end if;
  case v_room.estate_step
    when 'roll' then perform private.estate_do_roll(v_room);
    when 'decide' then perform private.estate_open_auction(v_room);
    when 'auction' then perform private.estate_close_auction(v_room);
    when 'act' then perform private.estate_next_turn(p_room_id);
    when 'debt' then
      perform private.estate_bankrupt(
        v_room, v_room.estate_turn, private.estate_creditor(v_room, v_room.estate_turn)
      );
    else null;
  end case;
end $$;

-- ------------------------------------------------------------------------------------- the land

-- Houses go up evenly on a whole region with nothing mortgaged; the fourth makes a manor.
create function public.estate_build(p_room_id uuid, p_player_id uuid, p_token text, p_idx int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cell public.estate_cells;
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['roll', 'act']);
  v_cell := private.estate_own_cell(p_room_id, p_player_id, p_idx);
  if v_cell.kind <> 'city' or v_cell.level >= 4 or exists (
    select from public.estate_cells c
    where c.room_id = p_room_id and c.kind = 'city' and c.region = v_cell.region
      and (c.owner_id is distinct from p_player_id or c.mortgaged or c.level < v_cell.level)
  ) then
    raise exception 'cannot_build';
  end if;
  if (select money from public.players where id = p_player_id) < v_cell.house_cost then
    raise exception 'not_enough_money';
  end if;
  update public.players set money = money - v_cell.house_cost where id = p_player_id;
  update public.estate_cells set level = level + 1 where room_id = p_room_id and idx = p_idx;
  perform private.estate_log(p_room_id, p_player_id, 'build',
    jsonb_build_object('cell', p_idx, 'level', v_cell.level + 1));
  perform private.estate_settle(p_room_id);
end $$;

-- A house sells back for half its price, from the most built city of the region first.
create function public.estate_sell_house(p_room_id uuid, p_player_id uuid, p_token text, p_idx int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cell public.estate_cells;
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['roll', 'act', 'debt']);
  v_cell := private.estate_own_cell(p_room_id, p_player_id, p_idx);
  if v_cell.level = 0 or exists (
    select from public.estate_cells c
    where c.room_id = p_room_id and c.kind = 'city' and c.region = v_cell.region
      and c.level > v_cell.level
  ) then
    raise exception 'cannot_sell';
  end if;
  update public.players set money = money + v_cell.house_cost / 2 where id = p_player_id;
  update public.estate_cells set level = level - 1 where room_id = p_room_id and idx = p_idx;
  perform private.estate_log(p_room_id, p_player_id, 'sell',
    jsonb_build_object('cell', p_idx, 'level', v_cell.level - 1));
  perform private.estate_settle(p_room_id);
end $$;

create function public.estate_mortgage(p_room_id uuid, p_player_id uuid, p_token text, p_idx int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cell public.estate_cells;
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['roll', 'act', 'debt']);
  v_cell := private.estate_own_cell(p_room_id, p_player_id, p_idx);
  if v_cell.mortgaged
    or (v_cell.kind = 'city' and private.estate_region_built(p_room_id, v_cell.region)) then
    raise exception 'cannot_mortgage';
  end if;
  update public.players set money = money + v_cell.price / 2 where id = p_player_id;
  update public.estate_cells set mortgaged = true where room_id = p_room_id and idx = p_idx;
  perform private.estate_log(p_room_id, p_player_id, 'mortgage',
    jsonb_build_object('cell', p_idx, 'amount', v_cell.price / 2));
  perform private.estate_settle(p_room_id);
end $$;

-- Redeeming costs the loan and 10% on top.
create function public.estate_redeem(p_room_id uuid, p_player_id uuid, p_token text, p_idx int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cell public.estate_cells;
  v_cost int;
begin
  perform private.estate_my_turn(p_room_id, p_player_id, p_token, array['roll', 'act']);
  v_cell := private.estate_own_cell(p_room_id, p_player_id, p_idx);
  if not v_cell.mortgaged then
    raise exception 'cannot_mortgage';
  end if;
  v_cost := (round(v_cell.price * 0.55 / 10) * 10)::int;
  if (select money from public.players where id = p_player_id) < v_cost then
    raise exception 'not_enough_money';
  end if;
  update public.players set money = money - v_cost where id = p_player_id;
  update public.estate_cells set mortgaged = false where room_id = p_room_id and idx = p_idx;
  perform private.estate_log(p_room_id, p_player_id, 'redeem',
    jsonb_build_object('cell', p_idx, 'amount', v_cost));
  perform private.estate_settle(p_room_id);
end $$;

-- --------------------------------------------------------------------------------------- trades

-- Whether `p_cells` all belong to the player and carry no houses, nor any in their regions.
create function private.estate_tradable(p_room_id uuid, p_player_id uuid, p_cells int[])
returns boolean
language sql stable set search_path = '' as $$
  select (select count(distinct x) from unnest(p_cells) x) = cardinality(p_cells)
    and not exists (
      select from unnest(p_cells) x
      left join public.estate_cells c on c.room_id = p_room_id and c.idx = x
      where c.owner_id is distinct from p_player_id
        or (c.kind = 'city' and private.estate_region_built(p_room_id, c.region))
    )
$$;

-- Any player may offer any other, at any moment, a deal of land and money; a new offer replaces
-- their open one.
create function public.estate_offer(
  p_room_id uuid, p_player_id uuid, p_token text, p_to uuid,
  p_give_cells int[], p_get_cells int[], p_give_money int, p_get_money int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_give int[] := coalesce(p_give_cells, '{}');
  v_get int[] := coalesce(p_get_cells, '{}');
  v_give_money int := coalesce(p_give_money, 0);
  v_get_money int := coalesce(p_get_money, 0);
begin
  perform private.estate_my_game(p_room_id, p_player_id, p_token);
  if p_to = p_player_id or not exists (
    select from public.players p
    where p.id = p_to and p.room_id = p_room_id and not p.bankrupt and p.turn_order is not null
  ) or v_give_money < 0 or v_get_money < 0
    or cardinality(v_give) + cardinality(v_get) = 0
    or not private.estate_tradable(p_room_id, p_player_id, v_give)
    or not private.estate_tradable(p_room_id, p_to, v_get)
    or (select money from public.players where id = p_player_id) < v_give_money then
    raise exception 'invalid_offer';
  end if;

  delete from public.estate_offers where room_id = p_room_id and from_id = p_player_id;
  insert into public.estate_offers (
    room_id, from_id, to_id, give_cells, get_cells, give_money, get_money
  ) values (p_room_id, p_player_id, p_to, v_give, v_get, v_give_money, v_get_money);
  perform private.estate_log(p_room_id, p_player_id, 'offer', jsonb_build_object('to', p_to));
end $$;

-- The one offered accepts or refuses. Accepting checks the deal again: either side may have sold,
-- built or spent since.
create function public.estate_answer(
  p_room_id uuid, p_player_id uuid, p_token text, p_offer_id uuid, p_accept boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_offer public.estate_offers;
begin
  perform private.estate_my_game(p_room_id, p_player_id, p_token);
  select * into v_offer from public.estate_offers
  where id = p_offer_id and room_id = p_room_id and to_id = p_player_id;
  if not found then
    raise exception 'offer_not_found';
  end if;
  delete from public.estate_offers where id = p_offer_id;

  if not coalesce(p_accept, false) then
    perform private.estate_log(p_room_id, p_player_id, 'offer_declined',
      jsonb_build_object('from', v_offer.from_id));
    return;
  end if;
  if not private.estate_tradable(p_room_id, v_offer.from_id, v_offer.give_cells)
    or not private.estate_tradable(p_room_id, v_offer.to_id, v_offer.get_cells)
    or (select money from public.players where id = v_offer.from_id) < v_offer.give_money
    or (select money from public.players where id = v_offer.to_id) < v_offer.get_money then
    raise exception 'offer_stale';
  end if;

  update public.estate_cells set owner_id = v_offer.to_id
  where room_id = p_room_id and idx = any (v_offer.give_cells);
  update public.estate_cells set owner_id = v_offer.from_id
  where room_id = p_room_id and idx = any (v_offer.get_cells);
  update public.players set money = money - v_offer.give_money + v_offer.get_money
  where id = v_offer.from_id;
  update public.players set money = money + v_offer.give_money - v_offer.get_money
  where id = v_offer.to_id;
  perform private.estate_log(p_room_id, v_offer.from_id, 'trade', jsonb_build_object(
    'to', v_offer.to_id, 'give', to_jsonb(v_offer.give_cells), 'get', to_jsonb(v_offer.get_cells),
    'give_money', v_offer.give_money, 'get_money', v_offer.get_money
  ));
  perform private.estate_settle(p_room_id);
end $$;

create function public.estate_cancel_offer(p_room_id uuid, p_player_id uuid, p_token text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  delete from public.estate_offers where room_id = p_room_id and from_id = p_player_id;
end $$;

-- ----------------------------------------------------------------------------------- permissions

revoke all on function
  private.estate_dice(),
  private.estate_log(uuid, uuid, text, jsonb),
  private.estate_set_step(uuid, text),
  private.estate_settle(uuid),
  private.estate_charge(uuid, uuid, uuid, int, boolean),
  private.estate_rent(uuid, int, int),
  private.estate_region_built(uuid, int),
  private.estate_to_cnap(uuid, uuid),
  private.estate_move_to(uuid, uuid, int, boolean),
  private.estate_land(uuid, uuid, int),
  private.estate_draw(uuid, uuid, text),
  private.estate_resume(uuid),
  private.estate_after(uuid, text),
  private.estate_do_roll(public.rooms),
  private.estate_finish(uuid),
  private.estate_next_turn(uuid),
  private.estate_creditor(public.rooms, uuid),
  private.estate_bankrupt(public.rooms, uuid, uuid),
  private.estate_open_auction(public.rooms),
  private.estate_close_auction(public.rooms),
  private.estate_my_turn(uuid, uuid, text, text[]),
  private.estate_my_game(uuid, uuid, text),
  private.estate_own_cell(uuid, uuid, int),
  private.estate_valid_card(jsonb),
  private.save_estate_quiz(uuid, text, jsonb),
  private.create_estate_room(private.quizzes),
  private.estate_start(public.rooms),
  private.estate_tradable(uuid, uuid, int[])
from public, anon, authenticated;

revoke all on function
  public.estate_roll(uuid, uuid, text),
  public.estate_pay_bail(uuid, uuid, text),
  public.estate_buy(uuid, uuid, text),
  public.estate_decline(uuid, uuid, text),
  public.estate_bid(uuid, uuid, text, int),
  public.estate_end_turn(uuid, uuid, text),
  public.estate_pay_debt(uuid, uuid, text),
  public.estate_give_up(uuid, uuid, text),
  public.estate_remove_player(uuid, text, uuid),
  public.estate_timeout(uuid, text),
  public.estate_build(uuid, uuid, text, int),
  public.estate_sell_house(uuid, uuid, text, int),
  public.estate_mortgage(uuid, uuid, text, int),
  public.estate_redeem(uuid, uuid, text, int),
  public.estate_offer(uuid, uuid, text, uuid, int[], int[], int, int),
  public.estate_answer(uuid, uuid, text, uuid, boolean),
  public.estate_cancel_offer(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.estate_roll(uuid, uuid, text),
  public.estate_pay_bail(uuid, uuid, text),
  public.estate_buy(uuid, uuid, text),
  public.estate_decline(uuid, uuid, text),
  public.estate_bid(uuid, uuid, text, int),
  public.estate_end_turn(uuid, uuid, text),
  public.estate_pay_debt(uuid, uuid, text),
  public.estate_give_up(uuid, uuid, text),
  public.estate_remove_player(uuid, text, uuid),
  public.estate_timeout(uuid, text),
  public.estate_build(uuid, uuid, text, int),
  public.estate_sell_house(uuid, uuid, text, int),
  public.estate_mortgage(uuid, uuid, text, int),
  public.estate_redeem(uuid, uuid, text, int),
  public.estate_offer(uuid, uuid, text, uuid, int[], int[], int, int),
  public.estate_answer(uuid, uuid, text, uuid, boolean),
  public.estate_cancel_offer(uuid, uuid, text)
to anon, authenticated;
