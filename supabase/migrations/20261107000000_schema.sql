-- Everything a client must not read directly lives in schema `private`, which PostgREST does not
-- expose. Clients read `public` tables and change state only through the RPC functions below.

create schema private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------------- quiz content

create table private.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  owner_token_hash bytea not null,
  round_multipliers int[] not null default '{1,2,3}'
    check (cardinality(round_multipliers) between 1 and 5 and 0 < all (round_multipliers)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.categories (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references private.quizzes on delete cascade,
  round int not null check (round >= 1),
  position int not null,
  title text not null check (char_length(title) <= 80),
  unique (quiz_id, round, position)
);

create table private.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references private.categories on delete cascade,
  position int not null,
  base_points int not null check (base_points > 0),
  text text not null check (char_length(text) <= 2000),
  image_path text,
  answer_text text not null check (char_length(answer_text) <= 2000),
  answer_image_path text,
  unique (category_id, position)
);

-- ----------------------------------------------------------------------------------- public game

create type public.room_state as enum (
  'lobby',           -- players are joining
  'board',           -- host picks a tile
  'question_shown',  -- everyone reads, presses are locked
  'buzzing_open',    -- the first press wins
  'buzzed',          -- host judges the winner
  'answer_shown',    -- answer revealed, tile finished
  'round_end',       -- every tile of the round is played
  'finished'
);

-- One row holds the whole visible game state, so a client gets each transition atomically in a
-- single realtime event. Question and answer fields are copied here only when they may be seen.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  quiz_title text not null,
  state public.room_state not null default 'lobby',
  round int not null default 1,
  round_count int not null,
  current_cell_id uuid,
  current_points int,
  question_text text,
  question_image_path text,
  answer_text text,
  answer_image_path text,
  buzz_winner_player_id uuid,
  spent_player_ids uuid[] not null default '{}',
  version bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  score int not null default 0,
  joined_at timestamptz not null default now()
);
create unique index players_room_nickname on public.players (room_id, lower(nickname));

alter table public.rooms
  add constraint rooms_buzz_winner_fk
  foreign key (buzz_winner_player_id) references public.players on delete set null;

-- A room keeps its own copy of the quiz, so editing a quiz never disturbs a running game.
create table public.room_cells (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  round int not null,
  category_position int not null,
  category_title text not null,
  position int not null,
  points int not null,
  played boolean not null default false,
  unique (room_id, round, category_position, position)
);

alter table public.rooms
  add constraint rooms_current_cell_fk
  foreign key (current_cell_id) references public.room_cells on delete set null;

create table private.room_cell_contents (
  cell_id uuid primary key references public.room_cells on delete cascade,
  text text not null,
  image_path text,
  answer_text text not null,
  answer_image_path text
);

-- Separate from `players` and `rooms` because those rows reach every client.
create table private.room_secrets (
  room_id uuid primary key references public.rooms on delete cascade,
  host_token_hash bytea not null
);

create table private.player_secrets (
  player_id uuid primary key references public.players on delete cascade,
  token_hash bytea not null
);

-- History of score changes. `correct` is null for a manual correction by the host.
create table private.answers_log (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms on delete cascade,
  cell_id uuid references public.room_cells on delete set null,
  player_id uuid not null references public.players on delete cascade,
  correct boolean,
  delta int not null,
  created_at timestamptz not null default now()
);

-- Clients drop realtime events older than what they already hold.
create function private.bump_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end $$;

create trigger rooms_bump_version before update on public.rooms
  for each row execute function private.bump_version();

-- ------------------------------------------------------------------------------- access control

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.room_cells enable row level security;

create policy rooms_read on public.rooms for select to anon, authenticated using (true);
create policy players_read on public.players for select to anon, authenticated using (true);
create policy room_cells_read on public.room_cells for select to anon, authenticated using (true);

-- Supabase grants new public tables to anon by default; RLS alone would still allow TRUNCATE.
revoke all on public.rooms, public.players, public.room_cells from anon, authenticated;
grant select on public.rooms, public.players, public.room_cells to anon, authenticated;

alter publication supabase_realtime add table public.rooms, public.players, public.room_cells;

-- ------------------------------------------------------------------------------------- image files

-- Public bucket with unguessable names: reading needs the exact URL, which clients only receive
-- once a question opens. Without a SELECT policy nobody can list the files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', true, 2097152, array['image/webp', 'image/jpeg']);

create policy quiz_media_upload on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'quiz-media'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
  );
