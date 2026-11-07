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

## D9 — Feature-Sliced Design layers, with room as one entity

The owner asked for FSD. Rooms, players and tiles stay one `entities/room` slice: ranking, the buzzer's
state and the realtime store each need several of them at once, and FSD forbids imports between
slices of a layer. `src/app` stays where Angular puts it and acts as the app layer. Rules are enforced
with ESLint's built-in `no-restricted-imports`, so no plugin was added. The rule cannot see relative
imports across slices; those are caught in review.

## D10 — Visual identity: a board that spells the logo

The logo is five rounded blocks forming a V, and the game board is rounded blocks too, so the banner is
a board whose tiles light up into that V, and the room code is a row of tiles. The accent is an emerald
through `--vd-hue-accent`, which also tints the neutrals. Being first turns the buzzer amber: green
already means "press now", and the status green is nearly the same. The logo copies in `public/brand`
carry the green in the accent block, following the logo README's rule that the accent follows the hue;
the library's originals are unchanged. Motion is one-shot and shows a change, with one exception: the
ready buzzer pulses, because that is what the player must not miss. It is all off under reduced motion.

## D11 — Page background is generated vector art

Question marks, tiles, buzzers and stars come from `tools/game-pattern.mjs` as one small SVG instead
of a generated picture: it stays sharp on any screen, weighs a few KB and matches the palette exactly.
Its colors are fixed in the script, because an SVG used as a background cannot read CSS tokens, so a
new accent means regenerating it. It appears only in space that is really free: the side margins of
centered screens, and on full-width screens a block taking the height the content leaves over.

## D12 — AI writes a draft, through one Edge Function

The AI key cannot live in a browser, so `generate-round` is the app's only server code. It writes one
round per call: a whole quiz can exceed a free tier's per-minute limit, and a failure then costs one
round instead of everything. The result only fills the editor, because models state wrong facts with
confidence, so a person reviews it before saving. `consume_ai_call` is granted to the service role
alone and limits each quiz and the whole app per day: anyone can create a quiz, so a per-quiz limit by
itself would not protect the shared free quota. Gemini is the provider because its free tier fits a
game among friends, and free-tier requests may be used by Google, so no personal data belongs in a
prompt. Tests replace the function: they must not depend on, or spend, a real quota. The free tier
gets briefly overloaded (503), so the function retries and then falls back to a lighter model, and the
editor resumes an interrupted run from the failed round rather than spending the daily limit again.

## D13 — PWA caches the app, never the game

The service worker holds only the built files. Database calls, realtime and presses always go to the
network: a cached answer in a live game would show a stale state. A new version waits for the player
to press Update, because a reload in the middle of a question could cost them the press.

## D14 — A menu outside the game, a way back inside it

Layout routes keep the site menu on the site's pages only. Game screens keep the whole window for the
game and offer one arrow back; the stream view has no links at all, because it is shown on a shared
screen. Leaving is safe: a player's session stays on the device and the join page offers the way back.
Unsaved editor changes ask first, since a whole AI draft could otherwise be lost to one click.

## Known limits

- Image upload is open to the anon key: Storage policies cannot check our tokens. Size, type and path
  shape are limited, and without a SELECT policy nobody can list files, but someone with the key could
  fill the bucket. An Edge Function issuing signed upload URLs would close this if it ever matters.
- Files of deleted quizzes stay in the bucket. Old rooms are not removed automatically.
- Mistaken judgments are fixed by a manual score correction; there is no undo.
- Quiz access is per browser. Clearing site data loses it, so export quizzes to JSON.
