# Decisions

Reasons that the code alone does not show. Differences from `docs/PLAN.md` are marked.

## D1 — Everything secret lives in schema `private` (differs from the plan)

The plan hides only `answer_text`. A question read in advance is just as much cheating, and any row
in `public` reaches every client. So quizzes, questions, tokens and the score log are in `private`,
which PostgREST does not expose. Questions enter `public.rooms` when they open, answers when revealed.

## D2 — Rooms copy the quiz when created (differs from the plan)

`save_quiz` replaces a quiz's questions. If rooms referenced them, editing a quiz would break running
games. So `create_room` snapshots them into `public.room_cells` (tile, no content) and
`private.room_cell_contents`. The plan's `room_questions` table became these two.

## D3 — Players have a secret token (differs from the plan)

The plan's `buzz(room_id, player_id)` trusts the id, but ids are public, so anyone could press for
someone else. `join_room` returns a token kept on the device; `buzz` checks it. Rejoining uses the
saved token. A nickname alone never recovers a session, or anyone could take over a player by name.

## D4 — One atomic UPDATE decides the press

`buzz` runs `UPDATE rooms ... WHERE state = 'buzzing_open' AND buzz_winner_player_id IS NULL`.
Concurrent calls wait on the row lock and re-check the condition, so exactly one wins, with no explicit
locking or clock comparison. `e2e/buzz-race.spec.ts` tests this with parallel calls.

## D5 — The room row carries the whole visible state

One row per transition means a client never sees half a change (a new state with an old question).
`rooms.version` lets clients drop late events. Each realtime (re)connect reloads everything, because
events sent while disconnected are not replayed.

## D6 — Online status uses Realtime Presence (differs from the plan)

The plan's `players.connected` column would need heartbeats and a cleanup job to notice a closed tab.
Presence does that already, without writing to the database.

## D7 — Tokens are hashed with plain SHA-256

They are 256 random bits, so a slow password hash protects nothing and would add latency to every
press, the one call that has to be fast.

## D8 — No image preloading before a question opens (differs from the plan)

Preloading needs the URL in advance, and the unguessable URL is what keeps the picture secret. Images
are compressed to about 100-250 KB, so loading when the question opens stays fast enough.

## Known limits

- Image upload is open to the anon key: Storage policies cannot check our tokens. Size, type and path
  shape are limited, and without a SELECT policy nobody can list files, but someone with the key could
  fill the bucket. An Edge Function issuing signed upload URLs would close this if it ever matters.
- Files of deleted quizzes stay in the bucket. Old rooms are not removed automatically.
- Mistaken judgments are fixed by a manual score correction; there is no undo.
- Quiz access is per browser. Clearing site data loses it, so export quizzes to JSON.
