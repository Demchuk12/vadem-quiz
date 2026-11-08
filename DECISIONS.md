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

## D15 — Answer explanation follows the answer's secrecy

An optional explanation per question lets the host say why an answer is right. It is stored with the
question in `private`, copied into the room's snapshot, given to the host by `host_answer`, and
reaches `public.rooms` only on reveal, like the answer. An empty one is never shown.

## D16 — Several free AIs, chosen or chained

Free tiers run out or get overloaded, so the function knows Gemini, Groq and OpenRouter and offers only
those with a key. "Auto" tries them in that order within one round, which together with resuming from
the failed round keeps a generation going when one AI is unavailable. Groq and OpenRouter share the
OpenAI chat format, so one adapter serves both. OpenRouter is limited in code to ":free" models and
its free router, which stands in when the chosen free model is rate-limited: a paid model would
spend credits. Model names are secrets with defaults, because free
models come and go.

## D17 — Photo questions from Wikipedia, not generated images

Free image generation is scarce and slow, and a drawn landmark can be wrong. Instead the AI names
an English Wikipedia article for about a third of the questions, and the function asks Wikipedia
once per round for each article's lead photo, free licences only. The browser downloads the photo
and stores it through the same compression as a manual upload, so the bucket, its rules and
`save_quiz` stay as they are. Each such question must read well without its photo: a photo that
is missing or fails to arrive costs only itself, never the round. No key, no new limit: Wikipedia
needs only a descriptive User-Agent, and a quiz gains a few megabytes of storage.

## D18 — AI edits by instruction, as one call and one undo

A question, a category or a whole round can be changed by the host's words. The same function
takes the current text as `current` and the instruction as `prompt`, and replies in the shape it
writes rounds in, so every AI and every safeguard (counts, photos, fallbacks) serves both. Edits
land in the draft; the toast offers "Скасувати", which restores only the edited part, so later
changes elsewhere survive. A picture stays while its answer does: then the question is still about
the same thing. Edits cost calls, so one quiz now gets 40 a day instead of 15; the app keeps 150.
Groq reasons more on small edits, where tokens are cheap and a wrong fact is the main risk.

## D19 — A question mark for waiting, and only when the wait is real

Long waits (joining a game, a slow page, an AI round) show the quiz's own loader: a board tile in
which the question mark from the background pattern writes itself and its dot drops in. Its fade-in
is delayed by 200 ms in CSS, so a fast load never flashes it and no timer code is needed. The
editor shows the outline of a quiz instead, so nothing jumps when the content arrives. Under
reduced motion the tile only glows.

## D20 — Verdicts come from scores, not just states

A correct answer and a skipped question both reveal the answer, so the room's state alone cannot
tell them apart: the cue used to call a skip "correct". A verdict is now read from the transition
out of "buzzed" together with the answerer's score: reopened buzzers mean wrong, a risen score
means correct, whichever realtime update arrives first. The screens celebrate verdicts: the stream
for everyone, a phone only for its player (with a vibration), and the standings show every score
change, the host's corrections included. Confetti is the quiz's own: question marks and tiles.

## D21 — One difficulty scale, no repeats, photos with answers

Rounds used to know only the earlier category titles, so they asked the same facts again, and
"later rounds are harder" left the climb to the model. Each round now gets the answers already in
the quiz and a place on one 1-to-10 scale (three rounds: 1-4, 4-7, 7-10), and the function sends
back a reply that repeats an answer or a category, like any other unusable reply. A generated
photo shows the answer, so it belongs to the answer and appears only once that is revealed.

## D22 — Own AI keys stay in the browser

A host can connect ChatGPT, Claude, Gemini or OpenRouter with their own key. With no accounts yet,
the key is kept in that browser's storage only and sent with each request to the function, which
uses it once and never stores it or logs it, nor any reply from that provider. Picking a model
starts from the key: the function asks the provider which models it opens, so new models appear
without a release. Own calls are counted apart (200 a quiz a day) and leave the shared free quota
alone. Under "auto" the host's own AIs go first, and one whose key is refused is skipped. Tying keys
to a user account is left for when accounts exist.

## D23 — How late a press was, by the database's clock

The winning press notes its moment and every later press, while the winner answers, is kept with
its distance from it in milliseconds, up to ten, in the room row. The database's clock decides, as
it decides the winner, so a phone can neither fake the number nor disagree with who won. The
delay includes each player's network, like the race itself; subtracting a measured ping would let
a player tamper with it. Phones read their own entry from the room, so the press call keeps its
boolean result and nothing else changes.

## D24 — Questions that give their answer away are rewritten

Models often write the answer into the question in another script or form ("named after the
Super Bowl" for "Super Bowl"), which no plain substring check catches. The function spells both
scripts one way and looks for the answer's most telling word, by the start of its stem, in the
question. Those questions alone go back to the same AI to be reworded around the same answer, and
are checked again; a round that still gives answers away is unusable like any other. On 100 real
questions the check caught 3, all genuine, and none remained after the rewrite.

## D25 — Flawed questions are replaced, not whole rounds

A round with a repeated answer or a giveaway used to be thrown away and written again. On a narrow
topic the model repeats itself every time, so the round never passed and the host got a 502. Now
only the flawed questions go back to the same AI (up to three passes), with every answer the quiz
already has listed as off limits; a per-minute limit hit by that follow-up call is waited out once.
Repeated category titles are only discouraged: on a narrow topic they cannot always be avoided,
and rejecting them broke more rounds than it improved.

## D26 — Types and constant tables live in their own files

A file that mixed logic with its interfaces and lookup tables grew hard to read. Types a slice
exports sit next to their code as `<name>.types.ts`; constant tables (defaults, vendor labels,
sound tones, edit chips) go into the slice's `config/`. Tuning numbers used in one place stay
beside that code, where their meaning is clear. The Edge Function follows the same split: one
module per concern, `config.ts` for limits and `types.ts` for shapes.

## Known limits

- Image upload is open to the anon key: Storage policies cannot check our tokens. Size, type and path
  shape are limited, and without a SELECT policy nobody can list files, but someone with the key could
  fill the bucket. An Edge Function issuing signed upload URLs would close this if it ever matters.
- Files of deleted quizzes stay in the bucket. Old rooms are not removed automatically.
- Mistaken judgments are fixed by a manual score correction; there is no undo.
- Quiz access is per browser. Clearing site data loses it, so export quizzes to JSON.
