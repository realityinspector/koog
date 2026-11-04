// Discovery documents: the OpenAPI 3.1 description (paste into a ChatGPT custom GPT Action) and llms.txt for any AI.
import { CONCEPT_IDS, KINDS, OPTIONS } from '../src/links/catalog.ts'
import { APP_URL, REPO_URL } from './core.ts'

export const SITE = 'https://koog-demo.fly.dev'

const ageQ = { name: 'age', in: 'query', description: "Child's age in years", schema: { type: 'integer', minimum: 2, maximum: 120 } }
const json = (description: string, schema: object = { type: 'object' }) => ({ description, content: { 'application/json': { schema } } })
const err = { '400': json('Bad input; the body says what to fix', { type: 'object', properties: { error: { type: 'string' } } }), '429': { description: 'Too many requests; wait a minute' } }

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Koog API',
    version: '0.1.0',
    summary: 'Get a kid started with Koog, the kids\' piano and synth app that names what they play.',
    description:
      "Koog is a free, open-source piano/synth app for kids that listens as they play and names what they did (\"Cadence!\", \"Motif!\"). This API helps a parent or AI assistant pick activities and returns canonical links that open the app exactly in the right place. " +
      'It is stateless: no accounts, no stored data, nothing about the child is logged. To use it: call getStarted with the child\'s age, minutes, whether they have a USB keyboard and what they like, then give the parent the links. Only use links the API returns.',
    license: { name: 'MIT', url: REPO_URL },
  },
  servers: [{ url: SITE }],
  paths: {
    '/api/start': { get: {
      operationId: 'getStarted', summary: 'Get a session plan for a child',
      description: 'Returns a short plan: steps with title, minutes, why, parent_says, kid_says and a link, plus first-time setup notes. Ask the parent for age, minutes, keyboard and interests first; every parameter is optional.',
      parameters: [ageQ,
        { name: 'minutes', in: 'query', description: 'Minutes available (default 15)', schema: { type: 'integer', minimum: 1, maximum: 90 } },
        { name: 'keyboard', in: 'query', description: 'true if they have a USB/MIDI keyboard (the web demo only plays with computer keys)', schema: { type: 'boolean' } },
        { name: 'interests', in: 'query', description: 'Comma-separated, e.g. zombies,dancing,space', schema: { type: 'string', maxLength: 300 } }],
      responses: { '200': json('A session plan'), ...err } } },
    '/api/activities': { get: {
      operationId: 'listActivities', summary: 'Browse activities',
      description: 'Songs, challenges, games, BachDoom levels, beats, synth emulators, visuals and helper modes, each with concepts, ages, minutes, level and link.',
      parameters: [
        { name: 'kind', in: 'query', schema: { type: 'string', enum: [...KINDS] } },
        { name: 'concept', in: 'query', schema: { type: 'string', enum: [...CONCEPT_IDS] } }, ageQ,
        { name: 'max_minutes', in: 'query', schema: { type: 'integer', minimum: 1 } },
        { name: 'limit', in: 'query', description: 'Page size (default 25, max 50)', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }],
      responses: { '200': json('A page of activities'), ...err } } },
    '/api/activities/{id}': { get: {
      operationId: 'getActivity', summary: 'One activity',
      parameters: [{ name: 'id', in: 'path', required: true, description: 'e.g. song-ode, challenge-echo, game-bachdoom, level-e1m1', schema: { type: 'string' } }],
      responses: { '200': json('The activity'), ...err } } },
    '/api/concepts': { get: { operationId: 'listConcepts', summary: 'The music concepts Koog teaches', responses: { '200': json('Concept list') } } },
    '/api/concepts/{id}': { get: {
      operationId: 'explainConcept', summary: 'Explain one concept for a parent and for a kid, with a demo link',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', enum: [...CONCEPT_IDS] } }],
      responses: { '200': json('The concept'), ...err } } },
    '/api/link': {
      get: { operationId: 'makeLink', summary: 'Build and check a canonical Koog link',
        description: 'Validates ids against the catalog and returns { ok, url, problems }. Use only when no listed activity has the link you need.',
        parameters: [
          { name: 'screen', in: 'query', description: 'play (default), songs, challenges, games, beats, synth, log', schema: { type: 'string' } },
          { name: 'item', in: 'query', description: 'song, challenge, game, beat or synth id without the kind prefix, e.g. ode', schema: { type: 'string' } },
          { name: 'song_mode', in: 'query', schema: { type: 'string', enum: ['wait', 'flow', 'learn'] } },
          { name: 'rung', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 7 } }, { name: 'phrase', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'level', in: 'query', description: 'BachDoom level id, e.g. e1m1', schema: { type: 'string' } },
          { name: 'key', in: 'query', description: 'c-major, a-minor, f-sharp-major, auto', schema: { type: 'string' } },
          { name: 'visual', in: 'query', schema: { type: 'string', enum: OPTIONS.visuals } }, { name: 'palette', in: 'query', schema: { type: 'string', enum: OPTIONS.palettes } },
          { name: 'sound', in: 'query', schema: { type: 'string', enum: OPTIONS.sounds } },
          { name: 'modes', in: 'query', description: 'Comma-separated helpers: band, duo, mentor, mimic, vibes', schema: { type: 'string' } },
          { name: 'sheet', in: 'query', schema: { type: 'boolean' } }],
        responses: { '200': json('The link and any problems'), ...err } },
      post: { operationId: 'makeLinkPost', summary: 'Same as GET /api/link, with a JSON body',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          screen: { type: 'string' }, item: { type: 'string' }, song_mode: { type: 'string', enum: ['wait', 'flow', 'learn'] }, rung: { type: 'integer' }, phrase: { type: 'integer' }, level: { type: 'string' },
          key: { type: 'string' }, visual: { type: 'string' }, palette: { type: 'string' }, sound: { type: 'string' }, modes: { type: 'array', items: { type: 'string' } }, sheet: { type: 'boolean' } } } } } },
        responses: { '200': json('The link and any problems'), ...err } } },
    '/api/next': { get: {
      operationId: 'nextSteps', summary: 'What to try after what they have done',
      parameters: [{ name: 'done', in: 'query', description: 'Comma-separated activity ids already done', schema: { type: 'string' } }, ageQ],
      responses: { '200': json('Up to three suggestions'), ...err } } },
  },
}

export const LLMS_TXT = `# Koog

> Koog is a free, open-source kids' piano and synth app. It listens as a child plays and names what they did ("Cadence!", "Motif!"), turning free play into music lessons through games and classical music. It runs in the browser (Chrome or Edge), plays with the computer keyboard, and has no accounts, ads or tracking. App: ${APP_URL} Source: ${REPO_URL}

## How to help a parent get their kid started

1. Ask: how old is your child, how many minutes do you have right now, do you have a USB/MIDI keyboard (not needed), and what does your child like (games, spooky things, dancing, animals, robots, drums, classical)?
2. Call GET ${SITE}/api/start?age=8&minutes=15&keyboard=false&interests=zombies,dancing (or the MCP tool get_started). It returns a short session plan.
3. Give the parent each step's link as a plain URL, the "parent_says" instructions, and the "kid_says" line to read aloud to the child.
4. First-time setup to mention: use Chrome or Edge on a computer; the computer keys play notes (no keyboard needed); turn the sound up and click once on the page to enable sound. For a USB keyboard, run Koog locally (${REPO_URL}); the hosted demo only plays with the computer keys.
5. Not sure where to start, or the parent wants a preview? Offer the gallery: ${APP_URL}#/gallery is a self-playing, ~18-minute tour of every feature with pleasant music. One click starts it; any key press hands control to the child. For a TV or projector, Art Gallery mode (${APP_URL}#/gallery/art) is a full-screen, slowly drifting, looping version.
6. Afterwards, ask what they tried and call GET ${SITE}/api/next?done=song-ode,play-free to suggest more.

Be honest: Koog is a practice companion, not a replacement for a teacher. Only use links that the API returns or that you build exactly as below; do not invent ids.

## Privacy

The API and MCP server are stateless. No accounts, no cookies, and nothing about the child is stored or logged. The child's progress is saved only in their own browser.

## Endpoints (all JSON, CORS open)

- MCP (Streamable HTTP, stateless): ${SITE}/mcp  (tools: get_started, list_activities, get_activity, explain_concept, make_link, next_steps)
- GET ${SITE}/api              index
- GET ${SITE}/api/start?age=&minutes=&keyboard=&interests=
- GET ${SITE}/api/activities?kind=&concept=&age=&max_minutes=&limit=&offset=
- GET ${SITE}/api/activities/{id}      e.g. song-ode, challenge-echo, game-bachdoom, level-e1m1
- GET ${SITE}/api/concepts             and /api/concepts/{id}
- GET|POST ${SITE}/api/link            build and validate a link
- GET ${SITE}/api/next?done=a,b&age=
- GET ${SITE}/openapi.json             OpenAPI 3.1 (paste into a ChatGPT custom GPT Action)

Kinds: ${KINDS.join(', ')}. Concepts: ${CONCEPT_IDS.join(', ')}.

## Link grammar

Links are hash routes on ${APP_URL}:  ${APP_URL}#/<screen>[/<item>[/<mode>]][?<options>]

- #/play                                free play (the visualizer)
- #/songs/<songId>/<wait|flow|learn>    one song; learn = the phrase ladder (listen, follow, echo, memory, in time, no sheet, both hands)
- #/challenges/<challengeId>            one challenge
- #/games/<gameId>                      zombies, jiujitsu, fashion, bachdoom; BachDoom takes ?level=<levelId>
- #/beats/<beatId>   #/synth/<emulatorId>
- Options: key=<c-major|a-minor|...>  visual=<scene>  palette=<theme>  modes=<band|duo|mentor|mimic|vibes>  sheet=on  sound=<sound>  rung=1..7  phrase=n  level=<id>

Ids: songs: ${OPTIONS.songs.slice(0, 12).join(', ')}, ... (use /api/activities?kind=song for all). Visuals: ${OPTIONS.visuals.join(', ')}. Palettes: ${OPTIONS.palettes.join(', ')}. Sounds: ${OPTIONS.sounds.join(', ')}.
To build a link yourself, call /api/link or the make_link tool: it validates ids and returns the canonical URL.

## Example links

- ${APP_URL}#/play
- ${APP_URL}#/gallery     the self-playing tour of every feature
- ${APP_URL}#/gallery/art     Art Gallery mode: full-screen moving art with calm music, loops forever
- ${APP_URL}#/songs/ode/learn?rung=2     Learn "Ode to Joy" a few notes at a time
- ${APP_URL}#/games/bachdoom
- ${APP_URL}#/challenges/echo
- ${APP_URL}#/play?key=a-minor&modes=mentor,vibes     free play in A minor with the robot mentor and the mood face
`
