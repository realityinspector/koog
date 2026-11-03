// The Koog MCP server (tools, one prompt, one resource). A fresh instance is built per request: stateless.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CONCEPT_IDS, KINDS } from '../src/links/catalog.ts'
import { BadInput, catalogJson, getActivity, getConcept, getStarted, listActivities, makeLink, nextSteps, cleanList } from './core.ts'

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const text = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 1) }] })
/** run a tool body; bad input comes back as a tool error the model can read and fix */
function run<T>(f: () => T) {
  try { return text(f()) } catch (e) {
    if (e instanceof BadInput) return { isError: true, content: [{ type: 'text' as const, text: e.message }] }
    throw e
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'koog', version: '0.1.0', title: 'Koog: get a kid playing music' },
    {
      instructions:
        'Koog is a free kids\' piano and synth app that listens as a child plays and names what they did ("Cadence!", "Motif!"). It runs in the browser; there are no accounts. ' +
        'To help a parent: ask the child\'s age, how many minutes they have, whether they have a USB keyboard, and what the child likes, then call get_started. ' +
        'Always give the parent the returned links as plain URLs, and offer the kid_says lines to read aloud. Only use links that tools return; never invent Koog URLs.',
    },
  )

  server.registerTool('get_started', {
    title: 'Get a kid started with Koog',
    description:
      'Start here. Returns a short session plan (title, minutes, why, parent_says, kid_says, link for each step) plus first-time setup notes. ' +
      'Before calling, ask the parent a couple of questions: the child\'s age, minutes available, whether they have a USB keyboard (the web demo works with the computer keys only), and what the child likes (games, spooky, dance, animals, robots, drums, classical...). ' +
      'All arguments are optional; the result lists any follow-up questions still worth asking. Present the links as plain URLs and read kid_says aloud to the child.',
    inputSchema: {
      age: z.number().min(2).max(120).optional().describe('Child age in years'),
      minutes: z.number().min(1).max(90).optional().describe('Minutes available for this first session (default 15)'),
      has_usb_keyboard: z.boolean().optional().describe('True if they own a USB/MIDI keyboard. The web demo only plays with computer keys; USB keyboards need Koog run locally.'),
      interests: z.array(z.string().max(60)).max(10).optional().describe('What the child likes, e.g. ["zombies","dancing","space"]'),
    },
    annotations: RO,
  }, (a) => run(() => getStarted({ age: a.age, minutes: a.minutes, has_usb_keyboard: a.has_usb_keyboard, interests: cleanList(a.interests) })))

  server.registerTool('list_activities', {
    title: 'List Koog activities',
    description: 'Browse the catalog of songs, challenges, games, BachDoom levels, beats, synth emulators, visuals and helper modes. Every item has a canonical link, the concepts it teaches, an age range, minutes and a 1-5 level. Results are paged (default 25, max 50).',
    inputSchema: {
      kind: z.enum(KINDS).optional().describe('Filter by kind of activity'),
      concept: z.enum(CONCEPT_IDS).optional().describe('Filter by the music concept it teaches'),
      age: z.number().optional().describe('Only activities suitable for this age'),
      max_minutes: z.number().optional().describe('Only activities that take at most this long'),
      limit: z.number().min(1).max(50).optional().describe('Page size'),
      offset: z.number().min(0).optional().describe('Skip this many results'),
    },
    annotations: RO,
  }, (a) => run(() => listActivities(a)))

  server.registerTool('get_activity', {
    title: 'Get one Koog activity',
    description: 'Full details for one activity id (from list_activities or get_started, for example song-ode, challenge-echo, game-bachdoom, level-e1m1), with parent_says and kid_says text and related activities.',
    inputSchema: { id: z.string().max(80).describe('Activity id, such as song-ode') },
    annotations: RO,
  }, (a) => run(() => getActivity(a.id)))

  server.registerTool('explain_concept', {
    title: 'Explain a music concept',
    description: 'A short parent explanation and a kid-friendly explanation of a music concept Koog teaches, plus a link that demonstrates it and activities that practise it. Use it when a parent asks "what will they learn?".',
    inputSchema: { concept: z.enum(CONCEPT_IDS).describe('Concept id') },
    annotations: RO,
  }, (a) => run(() => getConcept(a.concept)))

  server.registerTool('make_link', {
    title: 'Build and check a Koog link',
    description:
      'Builds the canonical Koog URL for a state and checks every id against the catalog, returning { ok, url, problems }. Use it only when no activity in the catalog already has the link you want, ' +
      'for example free play in a chosen key with a helper on: { screen: "play", key: "a-minor", modes: ["mentor","vibes"] }. ' +
      'screen is one of play, songs, challenges, games, beats, synth, log. item is a song, challenge, game, beat or synth id from list_activities (without the kind prefix, e.g. "ode"). ' +
      'song_mode is wait, flow or learn; rung (1-7) and phrase only work with learn. level is a BachDoom level id (e.g. "e1m1") with screen games and item bachdoom. ' +
      'key is like c-major, a-minor, f-sharp-major or auto. modes are any of band, duo, mentor, mimic, vibes. Never invent ids.',
    inputSchema: {
      screen: z.string().max(20).optional().describe('play (default), songs, challenges, games, beats, synth, log'),
      item: z.string().max(64).optional(), song_mode: z.string().max(10).optional(),
      rung: z.number().int().min(1).max(7).optional(), phrase: z.number().int().min(1).max(99).optional(), level: z.string().max(20).optional(),
      key: z.string().max(20).optional(), visual: z.string().max(30).optional(), palette: z.string().max(30).optional(), sound: z.string().max(30).optional(),
      modes: z.array(z.string().max(10)).max(5).optional(), sheet: z.boolean().optional(),
    },
    annotations: RO,
  }, (a) => run(() => makeLink(a)))

  server.registerTool('next_steps', {
    title: 'Suggest what to try next',
    description: 'Given the activity ids a child has already done, suggests up to three next things, following a simple beginner curriculum (free play, notes, a first song, rhythm, chords, reading, games, history). Ask the parent what they tried, or pass ids from an earlier get_started plan.',
    inputSchema: {
      done_activity_ids: z.array(z.string().max(80)).max(60).describe('Activity ids already done'),
      age: z.number().optional().describe('Child age in years'),
    },
    annotations: RO,
  }, (a) => run(() => nextSteps(a.done_activity_ids, a.age)))

  server.registerPrompt('get_my_kid_started', {
    title: 'Get my kid started with Koog',
    description: 'Walks a parent through a first Koog session for their child.',
    argsSchema: { age: z.string().optional().describe('Child age'), minutes: z.string().optional().describe('Minutes available'), interests: z.string().optional().describe('What the child likes') },
  }, (a) => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text:
          'Help me get my child started with Koog, the free kids\' piano and synth app. ' +
          `${a.age ? `My child is ${a.age}. ` : ''}${a.minutes ? `We have ${a.minutes} minutes. ` : ''}${a.interests ? `They like: ${a.interests}. ` : ''}` +
          'Ask me anything you still need (age, minutes, whether we have a USB keyboard, what they love), then call get_started and walk me through the plan one step at a time with the links and the lines to read to my child.',
      },
    }],
  }))

  server.registerResource('catalog', 'koog://catalog', { title: 'Koog activity catalog', description: 'Every Koog activity and concept with canonical links, as JSON', mimeType: 'application/json' },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(catalogJson()) }] }))

  return server
}
