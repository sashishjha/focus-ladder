/**
 * Optional AI decomposition for Focus Ladder.
 *
 * Talks to any OpenAI-compatible chat-completions endpoint with a key the
 * person supplies themselves (bring your own key). The key lives in
 * localStorage on their device and is sent only to the endpoint they chose.
 *
 * Everything the model returns is validated against a strict schema and
 * then passed through the same invariants as the template engine. If the
 * network fails, the key is missing, or the JSON is malformed, the caller
 * falls back to the deterministic engine. The app never breaks because the
 * AI did.
 */

import { clampMinutes, MAX_SETUP_MINUTES, MAX_RUNGS } from '../engine/ladder.js';
import { KINDS, GENERIC } from '../engine/archetypes.js';
import { parseDump } from '../engine/parse.js';

export const PRESETS = {
  groq: { label: 'Groq (free tier)', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  ollama: { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  custom: { label: 'Custom endpoint', baseUrl: '', model: '' }
};

export const SYSTEM_PROMPT = `You help a person with ADHD or executive dysfunction start a task they feel stuck on.
Turn their brain dump into a ladder of tiny rungs.

Rules, in priority order:
1. Every rung takes 5 minutes or less. Give an honest minutes value from 1 to 5.
2. The first rung of each task is physical setup that takes 2 minutes or less: open, fetch, stand up, put in front of you.
3. 4 to 8 rungs per task. Repetition is handled by the app, so do not list "do chapter 1 ... chapter 12".
4. Plain, concrete, kind language. Start with a verb. Never use "just", "simply", "should have" or anything that shames.
5. Keep the person's own words for what the task is. Do not invent tasks they did not mention.
6. Kinds: "setup" for getting things in front of you, "work" for progress, "wrap" for closing the loop.

Respond with JSON only, no prose, in exactly this shape:
{"tasks":[{"text":"their task in their words","steps":[{"text":"rung","minutes":2,"kind":"setup"}]}]}`;

const VALID_KINDS = new Set(['setup', 'work', 'wrap']);

/**
 * Strip code fences and find the first JSON object in a model reply.
 * @param {string} content
 */
export function extractJson(content) {
  const text = String(content || '').trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object in model reply');
  }
  return JSON.parse(unfenced.slice(start, end + 1));
}

/**
 * Validate a decoded model reply. Throws with a specific message on the
 * first problem so tests and logs can say exactly what was wrong.
 * @param {unknown} data
 * @returns {{tasks:Array<{text:string, steps:Array<{text:string, minutes:number, kind:string}>}>}}
 */
export function validateAiReply(data) {
  if (!data || typeof data !== 'object') throw new Error('Reply is not an object');
  const tasks = /** @type {any} */ (data).tasks;
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 10) {
    throw new Error('tasks must be an array of 1 to 10 items');
  }
  for (const task of tasks) {
    if (!task || typeof task.text !== 'string' || !task.text.trim() || task.text.length > 160) {
      throw new Error('task.text must be a non-empty string under 160 characters');
    }
    if (!Array.isArray(task.steps) || task.steps.length < 2 || task.steps.length > 12) {
      throw new Error('task.steps must be an array of 2 to 12 items');
    }
    for (const step of task.steps) {
      if (!step || typeof step.text !== 'string' || step.text.trim().length < 3 || step.text.length > 200) {
        throw new Error('step.text must be a string of 3 to 200 characters');
      }
      if (typeof step.minutes !== 'number' || !Number.isFinite(step.minutes) || step.minutes < 1 || step.minutes > 5) {
        throw new Error('step.minutes must be a number from 1 to 5');
      }
      if (!VALID_KINDS.has(step.kind)) {
        throw new Error('step.kind must be setup, work or wrap');
      }
    }
  }
  return /** @type {any} */ (data);
}

/**
 * Convert a validated reply into a Ladder, applying the same invariants as
 * the template engine (physical first rung, length cap).
 * @param {ReturnType<typeof validateAiReply>} reply
 * @param {string} dump
 * @param {{now?: string|number|Date}} [options]
 * @returns {import('../engine/ladder.js').Ladder}
 */
export function ladderFromAiReply(reply, dump, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const parsed = parseDump(dump);
  const tasks = reply.tasks.map((task, taskIndex) => {
    const steps = task.steps.map((s, i) => ({
      id: `${taskIndex}-${i}`,
      taskId: String(taskIndex),
      text: s.text.trim().replace(/\s+/g, ' '),
      minutes: clampMinutes(s.minutes),
      kind: /** @type {'setup'|'work'|'wrap'} */ (s.kind),
      why: KINDS[/** @type {'setup'|'work'|'wrap'} */ (s.kind)].why,
      loop: false,
      status: /** @type {'todo'} */ ('todo')
    }));
    if (!(steps[0].kind === 'setup' && steps[0].minutes <= MAX_SETUP_MINUTES)) {
      steps.unshift({
        id: `${taskIndex}-setup`,
        taskId: String(taskIndex),
        text: GENERIC.steps[0].t.replace('{object}', task.text.trim()),
        minutes: MAX_SETUP_MINUTES,
        kind: 'setup',
        why: KINDS.setup.why,
        loop: false,
        status: 'todo'
      });
    }
    if (steps.length > MAX_RUNGS) {
      const last = steps[steps.length - 1];
      steps.length = MAX_RUNGS - 1;
      steps.push(last);
    }
    steps.forEach((s, i) => { s.id = `${taskIndex}-${i}`; });
    const matchingPiece = parsed.pieces.find((p) => task.text.toLowerCase().includes(p.object.toLowerCase().slice(0, 12)));
    return {
      id: String(taskIndex),
      text: task.text.trim(),
      archetype: 'ai',
      label: 'AI ladder',
      deadline: Boolean(matchingPiece?.deadline),
      steps
    };
  });
  return {
    id: `ladder-${now.getTime()}`,
    title: dump.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Untitled ladder',
    createdAt: now.toISOString(),
    source: 'ai',
    tasks
  };
}

/**
 * Is the AI config complete enough to try?
 * @param {{baseUrl?:string, apiKey?:string, model?:string, preset?:string}} config
 */
export function aiConfigured(config) {
  if (!config) return false;
  const needsKey = config.preset !== 'ollama';
  return Boolean(config.baseUrl && config.model && (!needsKey || config.apiKey));
}

/**
 * Ask the configured endpoint to build a ladder.
 * @param {string} dump
 * @param {{baseUrl:string, apiKey?:string, model:string, preset?:string}} config
 * @param {{fetch?: typeof fetch, timeoutMs?: number, now?: string|number|Date}} [deps]
 * @returns {Promise<import('../engine/ladder.js').Ladder>}
 */
export async function requestAiLadder(dump, config, deps = {}) {
  if (!aiConfigured(config)) throw new Error('AI is not configured');
  const doFetch = deps.fetch || globalThis.fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), deps.timeoutMs ?? 25000) : null;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    const response = await doFetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller?.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: dump }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Endpoint returned ${response.status}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const reply = validateAiReply(extractJson(content));
    return ladderFromAiReply(reply, dump, { now: deps.now });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
