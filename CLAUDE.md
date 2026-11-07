# Vadem Quiz

Live quiz board game for friends: a host runs it, players press from their phones, a clean page goes
to a Discord screen share. Angular 22 + `@vadem/ui`, Supabase (Postgres, Realtime, Storage), Vercel.
No own server. Original plan: `docs/PLAN.md`. Reasons for choices: `DECISIONS.md`.

## Working agreement

- Talk to the owner in **Ukrainian**. Code, comments, commits, docs: **English**. UI text: Ukrainian.
- Ask before adding a dependency, feature or abstraction that was not requested.
- A missing UI component goes into `vadem-ui-angular` (sibling folder), not into this app. App code
  composes Vadem components; styles are page layout on `--vd-*` tokens with logical properties only.
- Components keep `<name>.ts`, `<name>.html` and `<name>.scss` apart, no inline templates or styles.
  No `.scss` file for a component without styles.
- Record non-obvious choices in `DECISIONS.md`.
- Commits and PRs carry no Claude attribution (no `Co-Authored-By: Claude`, no "Generated with" lines).

## Layout

Feature-Sliced Design, enforced by `no-restricted-imports` in `eslint.config.js`: a layer imports only
from layers below it, and from a slice only through its `index.ts`.

```
src/app/        bootstrap, routes, providers
src/pages/      one slice per route: join, quizzes, quiz-editor, host, play, stream
src/widgets/    self-contained screen blocks: room-header, host-question-panel, quiz-editor...
src/features/   one user action each: buzz, join-room, run-question, adjust-score...
src/entities/   room (with players and tiles, too entangled to split), quiz
src/shared/     api (Supabase, RPC, media), lib (storage, sound), ui (QR)
supabase/       migrations (the only way to change game state) and pgTAP tests
e2e/            Playwright: multi-browser game, press race, axe
```

A slice is `api/`, `model/`, `lib/`, `ui/<component>/` as needed, plus `index.ts`. Components that
need the live room inject `RoomStore`, which the page provides.

## Commands

`npm run db:start` (Docker) · `npm start` (:4200) · `npm test` · `npm run lint` ·
`npm run db:test` · `npm run e2e` · `npm run db:reset` after changing a migration.

## Hard rules

1. Clients never write tables. Every change is a `security definer` function with
   `set search_path = ''`, granted explicitly to `anon` at the end of the migration.
2. Nothing secret in `public` tables: they reach every client through realtime. Secrets and quiz
   content live in schema `private`; a question reaches `public.rooms` only when it opens, its answer
   only when revealed.
3. Functions raise a short code as the message; `shared/api/api-error.ts` maps codes to Ukrainian text.
4. Add a pgTAP test with every rule or permission change.

## Graphify

The CLI lives in a project venv, not on `PATH`: where the rules below say `graphify ...`, run
`.tools/graphify/bin/graphify ...`. Recreate the venv without sudo (this machine has no ensurepip):
`python3 -m venv --without-pip .tools/graphify`, then run pip from a downloaded pip wheel with
`PYTHONPATH=<pip.whl> .tools/graphify/bin/python -m pip install pip 'graphifyy[sql]==0.9.103'` (the `sql` extra makes the graph include the migrations).
The hooks in `.claude/settings.json` and the interpreter check in the skill were changed to use this
venv; re-apply both after upgrading graphify.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
