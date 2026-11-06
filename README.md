# Vadem Quiz

A live quiz board game for friends. A host runs the game, players answer from their phones with a
first-press-wins button, and a clean page goes to a Discord screen share.

Built with Angular 22, [`@vadem/ui`](https://www.npmjs.com/package/@vadem/ui) and Supabase (Postgres,
Realtime, Storage). There is no server of our own: all rules live in database functions.

## Run locally

Needs Node.js 24 and Docker.

```sh
npm ci
npm run db:start   # local Supabase; applies migrations
npm start          # http://localhost:4200
```

To play from a phone on the same network, serve with `npx ng serve --host 0.0.0.0` and point
`supabaseUrl` in `src/environments/environment.ts` at this machine's address.

## How a game goes

1. **Host:** open **Я ведучий**, create a quiz, fill it in or import JSON, then **Нова гра**.
2. **Players:** scan the QR code, or enter the room code and a nickname.
3. **Host:** pick a tile, let everyone read, then **Відкрити відповіді**. The first press wins.
4. **Host:** mark it right (+points, answer revealed) or wrong (−points, presses reopen for the
   others), or skip. Points are `base value × round multiplier`.
5. **Screen share:** open **Екран для стріму** and share that tab.

Quiz access is stored in the browser that created the quiz, so export quizzes you want to keep.

## Checks

```sh
npm run lint
npm test           # unit tests
npm run db:test    # pgTAP: permissions and game rules
npm run e2e        # full games across browsers, press race, axe (needs db:start)
npm run build
```

## Deploy

1. Create a Supabase project, then `npx supabase link --project-ref <ref>` and
   `npx supabase db push`.
2. Put the project's URL and anon key into `src/environments/environment.prod.ts`. Both are public
   by design: access is enforced by database functions.
3. Import the repository in Vercel; `vercel.json` has the settings.

Free Supabase projects pause after a week without activity, and include 1 GB of files and 5 GB of
traffic per month.

## Learn more

- `DECISIONS.md`: why things are the way they are, and known limits
- `docs/PLAN.md`: the original plan
