-- "Господар": the quiz, the turn, rent, cards, the queue, auctions, houses, mortgages, trades,
-- debts, bankruptcy, the clock and the end of the game. Dice and decks are fixed for the test.
begin;
select plan(54);

create temp table fx on commit drop as select * from public.create_quiz('Estate');
create function pg_temp.qid() returns uuid language sql as 'select quiz_id from fx';
create function pg_temp.qtok() returns text language sql as 'select owner_token from fx';
create function pg_temp.doc(patch jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'title', 'Estate', 'mode', 'estate',
    'regions', (select jsonb_agg('R' || i order by i) from generate_series(0, 7) as i),
    'cells', (select jsonb_agg('C' || i order by i) from generate_series(0, 31) as i),
    'fate', '[{"text": "Облігації", "effect": {"kind": "money", "amount": 1500}},
              {"text": "Назад", "effect": {"kind": "back", "steps": 3}}]'::jsonb,
    'community', '[{"text": "Коровай", "effect": {"kind": "each", "amount": 200}},
                   {"text": "Повістка", "effect": {"kind": "cnap"}}]'::jsonb,
    'startMoney', 15000, 'endKind', 'laps', 'endValue', 3, 'turnSeconds', 30
  ) || patch
$$;
create function pg_temp.save(doc jsonb) returns void language sql as
  'select public.save_quiz(pg_temp.qid(), pg_temp.qtok(), doc)';

create temp table pl (
  nick text primary key, room_id uuid, player_id uuid, player_token text
) on commit drop;
create function pg_temp.join(p_code text, p_nick text) returns void language sql as $$
  insert into pl select p_nick, j.room_id, j.player_id, j.player_token
  from public.join_room(p_code, p_nick) j
$$;
create function pg_temp.id(p_nick text) returns uuid language sql as
  'select player_id from pl where nick = p_nick';
create function pg_temp.call(p_fn text, p_nick text, p_args text default '') returns void
language plpgsql as $$
begin
  execute format(
    'select public.%s(room_id, player_id, player_token%s) from pl where nick = %L',
    p_fn, p_args, p_nick
  );
end $$;
create function pg_temp.dice(p_queue text) returns void language sql as
  $$select set_config('estate.dice', p_queue, true)$$;
create function pg_temp.money(p_nick text) returns int language sql as
  'select money from public.players where id = pg_temp.id(p_nick)';
create function pg_temp.pos(p_nick text) returns int language sql as
  'select position from public.players where id = pg_temp.id(p_nick)';
create function pg_temp.room(p_id uuid) returns public.rooms language sql as
  'select * from public.rooms where id = p_id';
create function pg_temp.cell(p_room uuid, p_idx int) returns public.estate_cells language sql as
  'select * from public.estate_cells where room_id = p_room and idx = p_idx';
create function pg_temp.expire(p_room uuid) returns void language sql as
  $$update public.rooms set phase_ends_at = now() - interval '1 second' where id = p_room$$;

-- ------------------------------------------------------------------------------------- the quiz

select pg_temp.save(pg_temp.doc());
select is(public.get_quiz(pg_temp.qid(), pg_temp.qtok()) ->> 'mode', 'estate',
  'the document saves an estate quiz');
select is(jsonb_array_length(public.get_quiz(pg_temp.qid(), pg_temp.qtok()) -> 'estate' -> 'cells'),
  32, 'its 32 cell names come back');
select throws_ok(
  $$select pg_temp.save(pg_temp.doc('{"regions": ["a", "b", "c", "d", "e", "f", "g"]}'))$$,
  'P0001', 'invalid_document', 'the ring has eight regions'
);
select throws_ok(
  $$select pg_temp.save(pg_temp.doc('{"fate": [{"text": "x", "effect": {"kind": "teleport"}}]}'))$$,
  'P0001', 'invalid_document', 'a card does only what the game knows'
);
select throws_ok(
  $$select pg_temp.save(pg_temp.doc('{"fate": [{"text": "x", "effect": {"kind": "move", "to": 14}}]}'))$$,
  'P0001', 'invalid_document', 'a card does not lead to another card'
);
select throws_ok(
  $$select pg_temp.save(pg_temp.doc('{"endValue": 1}'))$$,
  'P0001', 'invalid_document', 'a game has three laps at least'
);
select pg_temp.save(pg_temp.doc(jsonb_build_object('cells', (
  select jsonb_agg(case when i = 5 then '' else 'C' || i end order by i)
  from generate_series(0, 31) as i
))));
select throws_ok(
  $$select public.create_room(pg_temp.qid(), pg_temp.qtok())$$,
  'P0001', 'quiz_incomplete', 'a draft with an unnamed cell cannot be played'
);

-- ------------------------------------------------------------------------------------- the room

select pg_temp.save(pg_temp.doc());
select set_config('estate.shuffle', 'off', true);
create temp table r1 on commit drop as
  select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
create function pg_temp.r1() returns uuid language sql as 'select room_id from r1';

select is((pg_temp.room(pg_temp.r1())).mode, 'estate', 'the room plays the estate mode');
select is((pg_temp.room(pg_temp.r1())).round_count, 3, 'with a limit of three laps');
select is((select count(*)::int from public.estate_cells where room_id = pg_temp.r1()), 32,
  'the ring is copied into the room');
select is((pg_temp.cell(pg_temp.r1(), 1)).rents, array[50, 240, 660, 1560, 2520],
  'a city has its rents bare, with houses and with a manor');
select is((pg_temp.cell(pg_temp.r1(), 1)).name, 'C1', 'the cells carry the quiz''s names');

set local role anon;
select throws_ok($$select * from private.estate_decks$$, '42501', null,
  'clients cannot read the decks');
select throws_ok($$update public.estate_cells set owner_id = null$$, '42501', null,
  'clients cannot change the ring directly');
reset role;

select pg_temp.join((select room_code from r1), 'Ann');
select throws_ok($$select public.start_game(pg_temp.r1(), (select host_token from r1))$$,
  'P0001', 'not_enough_players', 'one player is too few');
select pg_temp.join((select room_code from r1), 'Bob');
select pg_temp.join((select room_code from r1), 'Cat');
update public.players p set joined_at = now() + (array_position(array['Ann', 'Bob', 'Cat'], p.nickname) || ' seconds')::interval
where p.room_id = pg_temp.r1();

select public.start_game(pg_temp.r1(), (select host_token from r1));
select ok(
  (pg_temp.room(pg_temp.r1())).state = 'estate_playing'
    and (pg_temp.room(pg_temp.r1())).estate_turn = pg_temp.id('Ann')
    and (pg_temp.room(pg_temp.r1())).estate_step = 'roll'
    and (pg_temp.room(pg_temp.r1())).phase_ends_at > now(),
  'the first to join rolls first, against the clock'
);
select is(
  (select array_agg(money order by turn_order) from public.players where room_id = pg_temp.r1()),
  array[15000, 15000, 15000], 'everyone starts with the quiz''s money'
);
select throws_ok($$select pg_temp.call('estate_roll', 'Bob')$$,
  'P0001', 'not_your_turn', 'nobody rolls out of turn');

-- ---------------------------------------------------------------------------------- the first lap

select pg_temp.dice('3,4');
select pg_temp.call('estate_roll', 'Ann');
select ok(pg_temp.pos('Ann') = 7 and (pg_temp.room(pg_temp.r1())).estate_step = 'decide',
  'free land asks the player to decide');
select pg_temp.call('estate_buy', 'Ann');
select ok(
  (pg_temp.cell(pg_temp.r1(), 7)).owner_id = pg_temp.id('Ann') and pg_temp.money('Ann') = 13800
    and (pg_temp.room(pg_temp.r1())).estate_step = 'act',
  'buying pays the price and ends the throw'
);
select pg_temp.call('estate_end_turn', 'Ann');
select is((pg_temp.room(pg_temp.r1())).estate_turn, pg_temp.id('Bob'), 'the turn passes on');

select pg_temp.dice('3,4');
select pg_temp.call('estate_roll', 'Bob');
select ok(pg_temp.money('Bob') = 14900 and pg_temp.money('Ann') = 13900,
  'rent on bare land of a partial region is the base rent');
select pg_temp.call('estate_end_turn', 'Bob');

select pg_temp.dice('1,1');
select pg_temp.call('estate_roll', 'Cat');
select ok(
  pg_temp.money('Cat') = 15400 and pg_temp.money('Ann') = 13700
    and (pg_temp.room(pg_temp.r1())).estate_step = 'roll',
  'a card makes everyone pay, and a double throws again'
);

select pg_temp.dice('2,2');
select pg_temp.call('estate_roll', 'Cat');
select pg_temp.call('estate_decline', 'Cat');
select ok(
  (pg_temp.room(pg_temp.r1())).estate_step = 'auction'
    and (pg_temp.room(pg_temp.r1())).estate_auction ->> 'cell' = '6',
  'declined land goes to an auction'
);
select pg_temp.call('estate_bid', 'Ann', ', 500');
select throws_ok($$select pg_temp.call('estate_bid', 'Bob', ', 505')$$,
  'P0001', 'invalid_bid', 'a bid raises by ten at least');
select pg_temp.call('estate_bid', 'Bob', ', 600');
select public.estate_timeout(pg_temp.r1(), (select host_token from r1));
select is((pg_temp.room(pg_temp.r1())).estate_step, 'auction',
  'the clock does nothing before its time');
select pg_temp.expire(pg_temp.r1());
select throws_ok($$select pg_temp.call('estate_bid', 'Ann', ', 700')$$,
  'P0001', 'invalid_state', 'no bids once the auction is over');
select public.estate_timeout(pg_temp.r1(), (select player_token from pl where nick = 'Ann'));
select ok(
  (pg_temp.cell(pg_temp.r1(), 6)).owner_id = pg_temp.id('Bob') and pg_temp.money('Bob') = 14100,
  'the highest bid buys the land'
);
select is((pg_temp.room(pg_temp.r1())).estate_step, 'roll',
  'after the auction the double still throws again');

select pg_temp.dice('5,5');
select pg_temp.call('estate_roll', 'Cat');
select ok(
  pg_temp.pos('Cat') = 8 and (select cnap_tries from public.players where id = pg_temp.id('Cat')) = 0
    and (pg_temp.room(pg_temp.r1())).estate_step = 'act',
  'the third double goes to the queue'
);
select pg_temp.call('estate_end_turn', 'Cat');
select ok(
  (pg_temp.room(pg_temp.r1())).round = 2
    and (pg_temp.room(pg_temp.r1())).estate_turn = pg_temp.id('Ann'),
  'a new lap starts with the first player'
);

-- --------------------------------------------------------------------------------- the second lap

select pg_temp.dice('5,6');
select pg_temp.call('estate_roll', 'Ann');
select ok(pg_temp.pos('Ann') = 8
    and (select cnap_tries from public.players where id = pg_temp.id('Ann')) = 0,
  'the next card of the deck sends to the queue');
select pg_temp.call('estate_end_turn', 'Ann');

select pg_temp.dice('6,1');
select pg_temp.call('estate_roll', 'Bob');
select is(pg_temp.money('Bob'), 15600, 'a fate card pays');
select pg_temp.call('estate_end_turn', 'Bob');

select pg_temp.call('estate_pay_bail', 'Cat');
select ok(pg_temp.money('Cat') = 14900
    and (select cnap_tries from public.players where id = pg_temp.id('Cat')) is null,
  'the fee lets a player out of the queue');
select pg_temp.dice('1,2');
select pg_temp.call('estate_roll', 'Cat');
select pg_temp.call('estate_decline', 'Cat');
select pg_temp.expire(pg_temp.r1());
select public.estate_timeout(pg_temp.r1(), (select host_token from r1));
select ok((pg_temp.cell(pg_temp.r1(), 11)).owner_id is null
    and (pg_temp.room(pg_temp.r1())).estate_step = 'act',
  'land nobody bids for stays free');
select pg_temp.call('estate_end_turn', 'Cat');

-- ---------------------------------------------------------------------------------- the third lap

select pg_temp.dice('1,2');
select pg_temp.call('estate_roll', 'Ann');
select ok(pg_temp.pos('Ann') = 8
    and (select cnap_tries from public.players where id = pg_temp.id('Ann')) = 1
    and (pg_temp.room(pg_temp.r1())).estate_step = 'act',
  'a throw without a double keeps the player in the queue');
select pg_temp.call('estate_end_turn', 'Ann');
select pg_temp.dice('2,3');
select pg_temp.call('estate_roll', 'Bob');
select pg_temp.call('estate_buy', 'Bob');
select pg_temp.call('estate_end_turn', 'Bob');

update public.estate_cells set owner_id = pg_temp.id('Cat')
where room_id = pg_temp.r1() and idx in (1, 3);
select pg_temp.call('estate_build', 'Cat', ', 1');
select ok((pg_temp.cell(pg_temp.r1(), 1)).level = 1 and pg_temp.money('Cat') = 14400,
  'a whole region takes a house');
select throws_ok($$select pg_temp.call('estate_build', 'Cat', ', 1')$$,
  'P0001', 'cannot_build', 'houses go up evenly');
select throws_ok($$select pg_temp.call('estate_build', 'Cat', ', 6')$$,
  'P0001', 'not_owner', 'nobody builds on land of another');
select pg_temp.call('estate_build', 'Cat', ', 3');
select throws_ok($$select pg_temp.call('estate_mortgage', 'Cat', ', 3')$$,
  'P0001', 'cannot_mortgage', 'a region with houses cannot be mortgaged');
select pg_temp.call('estate_sell_house', 'Cat', ', 1');
select pg_temp.call('estate_sell_house', 'Cat', ', 3');
select is(pg_temp.money('Cat'), 14400, 'a house sells back for half its price');
select pg_temp.call('estate_mortgage', 'Cat', ', 3');
select ok((pg_temp.cell(pg_temp.r1(), 3)).mortgaged and pg_temp.money('Cat') = 14700,
  'a mortgage pays half the price');
select pg_temp.call('estate_redeem', 'Cat', ', 3');
select is(pg_temp.money('Cat'), 14370, 'redeeming costs the loan and ten percent');

select throws_ok(
  format($$select pg_temp.call('estate_offer', 'Cat', %L)$$,
    format(', %L, array[7], null, 0, 0', pg_temp.id('Bob'))),
  'P0001', 'invalid_offer', 'nobody offers land of another'
);
select pg_temp.call('estate_offer', 'Cat', format(', %L, array[3], null, 0, 400', pg_temp.id('Ann')));
select pg_temp.call('estate_answer', 'Ann',
  format(', %L, true', (select id from public.estate_offers where room_id = pg_temp.r1())));
select ok(
  (pg_temp.cell(pg_temp.r1(), 3)).owner_id = pg_temp.id('Ann')
    and pg_temp.money('Cat') = 14770 and pg_temp.money('Ann') = 13300
    and not exists (select from public.estate_offers where room_id = pg_temp.r1()),
  'an accepted offer swaps land and money'
);

select pg_temp.dice('3,5');
select pg_temp.call('estate_roll', 'Cat');
select ok(pg_temp.money('Cat') = 14590 and pg_temp.money('Bob') = 13580,
  'rent goes to the owner');
select pg_temp.call('estate_end_turn', 'Cat');
select is((pg_temp.room(pg_temp.r1())).state::text, 'finished', 'the game ends after its last lap');
select ok(not exists (
  select from public.players p where p.room_id = pg_temp.r1() and p.score <> p.money + coalesce((
    select sum(case when c.mortgaged then c.price / 2 else c.price end + c.level * c.house_cost)
    from public.estate_cells c where c.room_id = pg_temp.r1() and c.owner_id = p.id), 0)
), 'every score is the player''s worth');

-- ------------------------------------------------------------------------------ debt and the last

select pg_temp.save(pg_temp.doc('{"endKind": "last", "endValue": 0, "turnSeconds": null}'));
create temp table r2 on commit drop as
  select * from public.create_room(pg_temp.qid(), pg_temp.qtok());
create function pg_temp.r2() returns uuid language sql as 'select room_id from r2';
select pg_temp.join((select room_code from r2), 'Dan');
select pg_temp.join((select room_code from r2), 'Eve');
select pg_temp.join((select room_code from r2), 'Fay');
update public.players p set joined_at = now() + (array_position(array['Dan', 'Eve', 'Fay'], p.nickname) || ' seconds')::interval
where p.room_id = pg_temp.r2();
select public.start_game(pg_temp.r2(), (select host_token from r2));
select is((pg_temp.room(pg_temp.r2())).phase_ends_at, null, 'without a turn clock no step is timed');
select throws_ok($$select pg_temp.join((select room_code from r2), 'Gus')$$,
  'P0001', 'game_started', 'nobody joins a game under way');

update public.players set money = 100 where id = pg_temp.id('Dan');
update public.estate_cells set owner_id = pg_temp.id('Dan') where room_id = pg_temp.r2() and idx = 31;
select pg_temp.dice('1,3');
select pg_temp.call('estate_roll', 'Dan');
select ok(
  (pg_temp.room(pg_temp.r2())).estate_step = 'debt'
    and (pg_temp.room(pg_temp.r2())).estate_debts = '[{"to": null, "amount": 2000}]',
  'a tax one cannot pay becomes a debt'
);
select throws_ok($$select pg_temp.call('estate_pay_debt', 'Dan')$$,
  'P0001', 'not_enough_money', 'a debt is paid in full');
select pg_temp.call('estate_give_up', 'Dan');
select ok(
  (select bankrupt from public.players where id = pg_temp.id('Dan'))
    and (pg_temp.cell(pg_temp.r2(), 31)).owner_id is null
    and (pg_temp.room(pg_temp.r2())).estate_turn = pg_temp.id('Eve'),
  'a player who owes the bank leaves their land free and the turn moves on'
);
select public.estate_remove_player(pg_temp.r2(), (select host_token from r2), pg_temp.id('Fay'));
select ok(
  (pg_temp.room(pg_temp.r2())).state = 'finished'
    and (select player_id from public.estate_events where room_id = pg_temp.r2() and code = 'finished')
      = pg_temp.id('Eve'),
  'the last player left wins'
);

select * from finish();
rollback;
