# Koog API and MCP server

A small, stateless Node server (`server/`) that helps an AI assistant get a kid started with Koog. It stores nothing, sets no cookies and logs no request details. Base URL for the hosted demo: `https://koog-demo.fly.dev`.

Run locally: `npm run server` (or `PORT=8787 node server/index.ts`; Node 24 runs the TypeScript directly).

## MCP

`POST /mcp`, Streamable HTTP, stateless (each request is independent; `GET` and `DELETE` return 405). Responses are plain JSON.

| Tool | What it does |
|---|---|
| `get_started(age?, minutes?, has_usb_keyboard?, interests?)` | A short session plan: each step has title, minutes, why, parent_says, kid_says, link. Plus first-time setup notes and follow-up questions worth asking. |
| `list_activities(kind?, concept?, age?, max_minutes?, limit?, offset?)` | Browse the catalog. |
| `get_activity(id)` | One activity, e.g. `song-ode`. |
| `explain_concept(concept)` | Parent and kid explanations, a demo link, practice activities. |
| `make_link(state)` | Validates ids against the catalog and returns the canonical URL plus any problems. |
| `next_steps(done_activity_ids[], age?)` | Up to three suggestions following a simple beginner order. |

Also: the prompt `get_my_kid_started` and the resource `koog://catalog` (the whole catalog as JSON).

## REST (JSON, CORS open)

| Endpoint | Notes |
|---|---|
| `GET /api` | Index |
| `GET /api/start?age=&minutes=&keyboard=&interests=` | Same as `get_started`; `interests` is a comma list |
| `GET /api/activities?kind=&concept=&age=&max_minutes=&limit=&offset=` | Paged, max 50 |
| `GET /api/activities/{id}` | |
| `GET /api/concepts`, `GET /api/concepts/{id}` | |
| `GET /api/link?screen=&item=&song_mode=&key=&modes=...` or `POST /api/link` with JSON | Same as `make_link` |
| `GET /api/next?done=a,b&age=` | |
| `GET /api/catalog` | Everything |
| `GET /openapi.json` | OpenAPI 3.1 for a ChatGPT custom GPT Action |
| `GET /llms.txt` | Plain-text instructions for any AI |
| `GET /healthz` | Health check |

Activity ids are `<kind>-<sourceId>`: `song-ode`, `challenge-echo`, `game-bachdoom`, `level-e1m1`, `beat-disco`, `synth-moog`, `visual-fireworks`, `helper-mentor`, `play-free`. A bare source id such as `ode` works when only one activity ends with it. Kinds: song, challenge, game, level, beat, synth, visual, helper, play.

Concepts: notes, keys-scales, chords, rhythm-pulse, phrases-cadences, motifs-form, tension-release, mood-emotion, reading-music, memorizing, dynamics, style-history, ear-training.

Limits: bodies over 64 KB are rejected (413); in production nginx allows about 30 requests a minute per visitor on `/api` and `/mcp`, and POST only on `/mcp` and `/api/link`.

## Link grammar

Defined in `src/links/links.ts` (the app and the server share it). Every link is a hash route:

```
https://koog-demo.fly.dev/#/<screen>[/<item>[/<mode>]][?<options>]
```

| Link | Opens |
|---|---|
| `#/play` | Free play |
| `#/songs/ode/learn?rung=2` | A song in `wait`, `flow` or `learn` mode (`rung` 1-7 and `phrase` for learn) |
| `#/challenges/echo` | A challenge |
| `#/games/bachdoom?level=e1m1` | A game; `level` for BachDoom |
| `#/beats/disco`, `#/synth/moog` | A groove, a synth emulator |
| `#/play?key=a-minor&modes=mentor,vibes&visual=fireworks` | Free play with options |

Options: `key` (`c-major`, `a-minor`, `f-sharp-major`, `auto`), `visual`, `palette`, `sound`, `modes` (`band`, `duo`, `mentor`, `mimic`, `vibes`), `sheet=on`, `rung`, `phrase`, `level`. Canonical form: lowercase, options in a fixed order, defaults left out. Build links with `toUrl()` or the `make_link` tool; never by hand.

## The catalog

`src/links/catalog.ts` is pure data. The raw id inventory, `src/links/catalog.data.json`, is generated from the app source:

```
npm run build:catalog   # rewrite the JSON from the source
npm run check:catalog   # fail if ids drifted or the catalog is inconsistent (the deploy script runs this)
```

Run `build:catalog` after adding a song, challenge, game, level, beat, emulator, visual, palette or sound. A new item shows up in the catalog automatically; challenges, games, emulators and helpers also need a line of teaching metadata in `catalog.ts` (the check tells you which).

## Deploying

`npm run deploy:fly` uploads only `dist-web`, `server/`, three files from `src/links/` and the server's package files. One container runs nginx on 8080 (static files, rate limits) in front of Node on 127.0.0.1:8787; see `deploy/`.
