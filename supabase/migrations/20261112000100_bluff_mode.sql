-- "Варіанти", a second game mode. A quiz is a list of facts with a missing ending; each round the
-- players write a lie, the host has one ready (the decoy), and everyone votes for what they take
-- as the truth. +2 for the truth, +1 to an author for every vote their lie drew, -1 for the decoy.
--
-- What the round must keep secret stays in `private` until it may be seen: the truth until the
-- reveal, the lies until voting opens and then without their authors, the votes until the reveal.
-- The shuffled options reach `public.rooms` with random ids, so their order and ids say nothing.

alter table private.quizzes
  add column mode text not null default 'board' check (mode in ('board', 'bluff'));

create table private.bluff_facts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references private.quizzes on delete cascade,
  position int not null,
  text text not null check (char_length(text) <= 300),
  truth text not null check (char_length(truth) <= 80),
  decoy text not null check (char_length(decoy) <= 80),
  explanation text not null default '' check (char_length(explanation) <= 2000),
  unique (quiz_id, position)
);

-- Seen by everyone. `bluff_done` lists who has written (or, while voting, who has voted).
-- `bluff_options` holds { id, text } while voting, and at the reveal also kind, author and voters.
alter table public.rooms
  add column mode text not null default 'board',
  add column phase_ends_at timestamptz,
  add column writing_seconds int not null default 30,
  add column voting_seconds int not null default 20,
  add column bluff_done uuid[] not null default '{}',
  add column bluff_options jsonb,
  add column bluff_deltas jsonb;

-- A room keeps its own copy of the facts, as it does of a board.
create table private.room_bluff_facts (
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  text text not null,
  truth text not null,
  decoy text not null,
  explanation text not null default '',
  primary key (room_id, round)
);

create table private.bluff_answers (
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  player_id uuid not null references public.players on delete cascade,
  text text not null,
  primary key (room_id, round, player_id)
);

-- One option per author: two players with the same words get two options, and a player who
-- wrote the truth gets one beside it. Who picks which copy is the luck the rules ask for.
create table private.bluff_options (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  position int not null,
  text text not null,
  kind text not null check (kind in ('truth', 'decoy', 'player')),
  player_id uuid references public.players on delete cascade,
  unique (room_id, round, position)
);

create table private.bluff_votes (
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  player_id uuid not null references public.players on delete cascade,
  option_id uuid not null references private.bluff_options on delete cascade,
  primary key (room_id, round, player_id)
);

-- ---------------------------------------------------------------------------------------- helpers

-- One look for every option, so the truth cannot stand out by its neatness: single spaces, no
-- closing full stop, a small first letter.
create function private.bluff_clean(p_text text) returns text
language sql immutable set search_path = '' as $$
  select lower(left(s.t, 1)) || substr(s.t, 2)
  from (
    select regexp_replace(
      regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'), '[\s.!…]+$', ''
    ) as t
  ) as s
$$;

-- What makes two options the same words: case and quotes aside.
create function private.bluff_key(p_text text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(private.bluff_clean(p_text), '[«»"''’„“]', '', 'g'))
$$;

create function private.assert_player(p_room_id uuid, p_player_id uuid, p_token text)
returns void
language plpgsql stable set search_path = '' as $$
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
end $$;

-- Every player has written, or voted: the phase need not wait for its clock.
create function private.everyone_done(p_room public.rooms) returns boolean
language sql stable set search_path = '' as $$
  select not exists (
    select from public.players p
    where p.room_id = p_room.id and not (p.id = any (p_room.bluff_done))
  )
$$;

create function private.bluff_open_fact(p_room_id uuid, p_round int) returns void
language plpgsql set search_path = '' as $$
declare
  v_fact private.room_bluff_facts;
begin
  select * into v_fact from private.room_bluff_facts where room_id = p_room_id and round = p_round;
  update public.rooms set
    state = 'bluff_writing',
    round = p_round,
    question_text = v_fact.text,
    answer_text = null,
    answer_explanation = null,
    bluff_done = '{}',
    bluff_options = null,
    bluff_deltas = null,
    phase_ends_at = now() + make_interval(secs => writing_seconds)
  where id = p_room_id;
end $$;

create function private.bluff_start_voting(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_fact private.room_bluff_facts;
begin
  select * into v_fact from private.room_bluff_facts
  where room_id = p_room.id and round = p_room.round;

  insert into private.bluff_options (room_id, round, position, text, kind, player_id)
  select p_room.id, p_room.round, row_number() over (order by gen_random_uuid()),
    private.bluff_clean(o.text), o.kind, o.player_id
  from (
    select v_fact.truth as text, 'truth' as kind, null::uuid as player_id
    union all
    select v_fact.decoy, 'decoy', null
    union all
    select a.text, 'player', a.player_id
    from private.bluff_answers a
    where a.room_id = p_room.id and a.round = p_room.round
  ) as o;

  update public.rooms set
    state = 'bluff_voting',
    bluff_done = '{}',
    bluff_options = (
      select jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text) order by o.position)
      from private.bluff_options o
      where o.room_id = p_room.id and o.round = p_room.round
    ),
    phase_ends_at = now() + make_interval(secs => voting_seconds)
  where id = p_room.id;
end $$;

-- One row per vote: who gains what from it.
create function private.bluff_points(p_room_id uuid, p_round int)
returns table (player_id uuid, delta int)
language sql stable set search_path = '' as $$
  select
    case when o.kind = 'player' then o.player_id else v.player_id end,
    case o.kind when 'truth' then 2 when 'decoy' then -1 else 1 end
  from private.bluff_votes v
  join private.bluff_options o on o.id = v.option_id
  where v.room_id = p_room_id and v.round = p_round
$$;

create function private.bluff_finish_round(p_room public.rooms) returns void
language plpgsql set search_path = '' as $$
declare
  v_fact private.room_bluff_facts;
begin
  select * into v_fact from private.room_bluff_facts
  where room_id = p_room.id and round = p_room.round;

  update public.players p set score = p.score + d.total
  from (
    select b.player_id, sum(b.delta)::int as total
    from private.bluff_points(p_room.id, p_room.round) b
    group by b.player_id
  ) as d
  where p.id = d.player_id;

  -- `correct` here tells a gain from a loss; the log has no other use for it in this mode.
  insert into private.answers_log (room_id, cell_id, player_id, correct, delta)
  select p_room.id, null, b.player_id, b.delta > 0, b.delta
  from private.bluff_points(p_room.id, p_room.round) b;

  update public.rooms set
    state = 'bluff_reveal',
    phase_ends_at = null,
    answer_text = private.bluff_clean(v_fact.truth),
    answer_explanation = nullif(v_fact.explanation, ''),
    bluff_options = (
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'text', o.text,
        'kind', o.kind,
        'player_id', o.player_id,
        'voter_ids', coalesce(
          (select jsonb_agg(v.player_id) from private.bluff_votes v where v.option_id = o.id),
          '[]'::jsonb
        )
      ) order by o.position)
      from private.bluff_options o
      where o.room_id = p_room.id and o.round = p_room.round
    ),
    bluff_deltas = coalesce((
      select jsonb_object_agg(d.player_id, d.total)
      from (
        select b.player_id, sum(b.delta)::int as total
        from private.bluff_points(p_room.id, p_room.round) b
        group by b.player_id
      ) as d
    ), '{}'::jsonb)
  where id = p_room.id;
end $$;

-- ----------------------------------------------------------------------------------------- quizzes

create function private.save_bluff_quiz(p_quiz_id uuid, p_title text, p_document jsonb)
returns void
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p_document -> 'facts') is distinct from 'array'
    or jsonb_array_length(p_document -> 'facts') > 20 then
    raise exception 'invalid_document';
  end if;

  update private.quizzes set title = p_title, mode = 'bluff', updated_at = now()
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

-- A document with "mode": "bluff" carries facts; any other is a board, as before.
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
  set title = v_title, round_multipliers = v_multipliers, mode = 'board', updated_at = now()
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

-- ------------------------------------------------------------------------------------------- rooms

create function private.create_bluff_room(p_quiz private.quizzes)
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
      insert into public.rooms (code, quiz_title, round_count, mode)
      values (private.random_room_code(), p_quiz.title, v_count, 'bluff')
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

-- ------------------------------------------------------------------------------------- the round

create or replace function public.start_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['lobby']::public.room_state[]);
  if v_room.mode = 'bluff' then
    -- The truth, the decoy and at least three lies: fewer, and guessing is too easy.
    if (select count(*) from public.players p where p.room_id = p_room_id) < 3 then
      raise exception 'not_enough_players';
    end if;
    perform private.bluff_open_fact(p_room_id, 1);
  else
    update public.rooms set state = 'board' where id = p_room_id;
  end if;
end $$;

-- A player's lie, which they may change until the phase ends.
create function public.bluff_submit(p_room_id uuid, p_player_id uuid, p_token text, p_text text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_text text := private.bluff_clean(p_text);
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  if char_length(v_text) not between 1 and 80 then
    raise exception 'invalid_bluff';
  end if;
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'bluff_writing' then
    raise exception 'invalid_state';
  end if;

  insert into private.bluff_answers (room_id, round, player_id, text)
  values (p_room_id, v_room.round, p_player_id, v_text)
  on conflict (room_id, round, player_id) do update set text = excluded.text;

  if not (p_player_id = any (v_room.bluff_done)) then
    update public.rooms set bluff_done = bluff_done || p_player_id
    where id = p_room_id
    returning * into v_room;
  end if;
  if private.everyone_done(v_room) then
    perform private.bluff_start_voting(v_room);
  end if;
end $$;

create function public.bluff_open_voting(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['bluff_writing']::public.room_state[]);
  perform private.bluff_start_voting(v_room);
end $$;

-- A vote, which may change until the phase ends. A player knows their own option is a lie, and
-- so is any other with the same words: those are not theirs to pick.
create function public.bluff_vote(p_room_id uuid, p_player_id uuid, p_token text, p_option_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_option private.bluff_options;
  v_own text;
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  v_room := private.lock_room(p_room_id);
  if v_room.state <> 'bluff_voting' then
    raise exception 'invalid_state';
  end if;

  select * into v_option from private.bluff_options o
  where o.id = p_option_id and o.room_id = p_room_id and o.round = v_room.round;
  if not found then
    raise exception 'option_not_found';
  end if;

  select a.text into v_own from private.bluff_answers a
  where a.room_id = p_room_id and a.round = v_room.round and a.player_id = p_player_id;
  if v_own is not null and private.bluff_key(v_option.text) = private.bluff_key(v_own) then
    raise exception 'own_option';
  end if;

  insert into private.bluff_votes (room_id, round, player_id, option_id)
  values (p_room_id, v_room.round, p_player_id, p_option_id)
  on conflict (room_id, round, player_id) do update set option_id = excluded.option_id;

  if not (p_player_id = any (v_room.bluff_done)) then
    update public.rooms set bluff_done = bluff_done || p_player_id
    where id = p_room_id
    returning * into v_room;
  end if;
  if private.everyone_done(v_room) then
    perform private.bluff_finish_round(v_room);
  end if;
end $$;

create function public.bluff_reveal(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['bluff_voting']::public.room_state[]);
  perform private.bluff_finish_round(v_room);
end $$;

create function public.bluff_next(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
begin
  v_room := private.host_room(p_room_id, p_token, array['bluff_reveal']::public.room_state[]);
  if v_room.round >= v_room.round_count then
    perform private.leave_question(p_room_id, 'finished');
  else
    perform private.bluff_open_fact(p_room_id, v_room.round + 1);
  end if;
end $$;

-- What the host reads aloud from: the truth and the decoy of the current fact.
create function public.bluff_host_fact(p_room_id uuid, p_token text)
returns table (truth text, decoy text, explanation text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_host(p_room_id, p_token);
  return query
    select f.truth, f.decoy, f.explanation
    from public.rooms r
    join private.room_bluff_facts f on f.room_id = r.id and f.round = r.round
    where r.id = p_room_id;
end $$;

-- A player's own part of the round, for a phone that reloads: their lie and their vote.
create function public.bluff_my_round(p_room_id uuid, p_player_id uuid, p_token text)
returns table (answer text, option_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_player(p_room_id, p_player_id, p_token);
  return query
    select
      (select a.text from private.bluff_answers a
       where a.room_id = r.id and a.round = r.round and a.player_id = p_player_id),
      (select v.option_id from private.bluff_votes v
       where v.room_id = r.id and v.round = r.round and v.player_id = p_player_id)
    from public.rooms r
    where r.id = p_room_id;
end $$;

create or replace function public.finish_game(p_room_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.host_room(p_room_id, p_token);
  perform private.leave_question(p_room_id, 'finished');
  update public.rooms set
    phase_ends_at = null, bluff_done = '{}', bluff_options = null, bluff_deltas = null
  where id = p_room_id and mode = 'bluff';
end $$;

-- ----------------------------------------------------------------------------------- permissions

revoke all on function
  private.bluff_clean(text),
  private.bluff_key(text),
  private.assert_player(uuid, uuid, text),
  private.everyone_done(public.rooms),
  private.bluff_open_fact(uuid, int),
  private.bluff_start_voting(public.rooms),
  private.bluff_points(uuid, int),
  private.bluff_finish_round(public.rooms),
  private.save_bluff_quiz(uuid, text, jsonb),
  private.create_bluff_room(private.quizzes)
from public, anon, authenticated;

revoke all on function
  public.bluff_submit(uuid, uuid, text, text),
  public.bluff_open_voting(uuid, text),
  public.bluff_vote(uuid, uuid, text, uuid),
  public.bluff_reveal(uuid, text),
  public.bluff_next(uuid, text),
  public.bluff_host_fact(uuid, text),
  public.bluff_my_round(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.bluff_submit(uuid, uuid, text, text),
  public.bluff_open_voting(uuid, text),
  public.bluff_vote(uuid, uuid, text, uuid),
  public.bluff_reveal(uuid, text),
  public.bluff_next(uuid, text),
  public.bluff_host_fact(uuid, text),
  public.bluff_my_round(uuid, uuid, text)
to anon, authenticated;
