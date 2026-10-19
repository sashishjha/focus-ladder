/**
 * Ladder builder for Focus Ladder.
 *
 * Takes parsed task pieces, matches each to an archetype, fills the step
 * templates and enforces the invariants that make a ladder climbable:
 *
 *   I1. Every rung is 1 to 5 minutes.
 *   I2. The first rung of every task is a `setup` rung of 2 minutes or less.
 *   I3. A task has at most MAX_RUNGS rungs; repetition is handled by the
 *       "Again" affordance in the UI, not by an endless list.
 *   I4. Tasks with a deadline hint come first; otherwise input order is kept.
 *   I5. Same input produces the same ladder (no randomness in here).
 */

import { parseDump } from './parse.js';
import { ALL_ARCHETYPES, GENERIC, KINDS } from './archetypes.js';

export const MAX_RUNGS = 10;
export const MAX_MINUTES = 5;
export const MAX_SETUP_MINUTES = 2;
const MAX_LOOP_COPIES = 6;
const VERB_BONUS = 1.5;

/**
 * Escape a string for use inside a RegExp.
 * @param {string} s
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Score how well an archetype matches a piece of text. Multi-word keywords
 * score one point per word; a keyword that matches the piece's verb earns a
 * bonus because the verb is the strongest signal of what the person is
 * actually going to do. Broad archetypes carry a weight below 1 so a
 * specific match ("problem set") beats a generic verb ("finish").
 * @param {import('./archetypes.js').Archetype} archetype
 * @param {string} text lower-cased piece text
 * @param {string} verb lower-cased verb
 * @returns {number}
 */
export function scoreArchetype(archetype, text, verb) {
  let score = 0;
  for (const kw of archetype.match) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(kw)}(s|es|ing|ed)?(?=$|[^a-z])`, 'i');
    if (re.test(text)) {
      score += kw.split(' ').length;
      if (verb && (kw === verb || kw.startsWith(`${verb} `) || verb.startsWith(kw))) {
        score += VERB_BONUS;
      }
    }
  }
  return score * (archetype.weight ?? 1);
}

/**
 * Pick the best archetype for a piece. Ties resolve to the archetype listed
 * first, so more specific archetypes are listed before broad ones.
 * @param {{text:string, verb:string}} piece
 * @returns {import('./archetypes.js').Archetype}
 */
export function matchArchetype(piece) {
  const text = piece.text.toLowerCase();
  let best = GENERIC;
  let bestScore = 0;
  for (const archetype of ALL_ARCHETYPES) {
    const score = scoreArchetype(archetype, text, piece.verb);
    if (score > bestScore) {
      best = archetype;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Fill a template string.
 * @param {string} template
 * @param {{object:string, n?:number, unit?:string, hasQuantity:boolean}} vars
 */
export function fillTemplate(template, vars) {
  let out = template;
  if (!vars.hasQuantity) {
    out = out.replace(/\{unit\} \{n\}/g, 'the next part');
  }
  out = out
    .replace(/\{object\}/g, vars.object)
    .replace(/\{unit\}/g, vars.unit || 'part')
    .replace(/\{n\}/g, String(vars.n ?? 1));
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Clamp a minute value into [1, MAX_MINUTES].
 * @param {number} m
 */
export function clampMinutes(m) {
  const n = Math.round(Number(m) || 1);
  return Math.min(MAX_MINUTES, Math.max(1, n));
}

/**
 * Build the rungs for a single parsed piece.
 * @param {ReturnType<typeof parseDump>['pieces'][number]} piece
 * @param {number} taskIndex
 * @returns {{id:string, text:string, archetype:string, label:string, deadline:boolean, steps:Step[]}}
 */
export function buildTask(piece, taskIndex) {
  const archetype = matchArchetype(piece);
  const object = piece.object || piece.text;
  const quantity = piece.quantity;
  const hasQuantity = Boolean(quantity && archetype.steps.some((s) => s.loop));
  const copies = hasQuantity ? Math.min(quantity.count, MAX_LOOP_COPIES) : 1;

  /** @type {Step[]} */
  const steps = [];
  const push = (template, n) => {
    const text = fillTemplate(template.t, {
      object,
      n,
      unit: quantity?.unitSingular,
      hasQuantity
    });
    steps.push({
      id: `${taskIndex}-${steps.length}`,
      taskId: String(taskIndex),
      text,
      minutes: clampMinutes(template.min),
      kind: template.kind,
      why: KINDS[template.kind].why,
      loop: Boolean(template.loop),
      status: 'todo'
    });
  };

  for (const template of archetype.steps) {
    if (template.loop && hasQuantity) {
      for (let n = 1; n <= copies; n += 1) push(template, n);
    } else {
      push(template, 1);
    }
  }

  // I2: physical first rung.
  if (!(steps[0] && steps[0].kind === 'setup' && steps[0].minutes <= MAX_SETUP_MINUTES)) {
    steps.unshift({
      id: `${taskIndex}-setup`,
      taskId: String(taskIndex),
      text: fillTemplate(GENERIC.steps[0].t, { object, hasQuantity: false }),
      minutes: MAX_SETUP_MINUTES,
      kind: 'setup',
      why: KINDS.setup.why,
      loop: false,
      status: 'todo'
    });
  }

  // I3: cap length, keeping the first and last rungs so the task still
  // starts physically and still closes.
  if (steps.length > MAX_RUNGS) {
    const last = steps[steps.length - 1];
    steps.length = MAX_RUNGS - 1;
    steps.push(last);
  }
  steps.forEach((s, i) => { s.id = `${taskIndex}-${i}`; });

  return {
    id: String(taskIndex),
    text: piece.text,
    archetype: archetype.id,
    label: archetype.label,
    deadline: piece.deadline,
    steps
  };
}

/**
 * Build a full ladder from a brain dump.
 * @param {string} dump
 * @param {{now?: string|number|Date}} [options]
 * @returns {Ladder}
 */
export function buildLadder(dump, options = {}) {
  const parsed = parseDump(dump);
  const now = options.now ? new Date(options.now) : new Date();
  const ordered = [...parsed.pieces]
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => Number(b.piece.deadline) - Number(a.piece.deadline) || a.index - b.index);

  const tasks = ordered.map(({ piece }, i) => buildTask(piece, i));
  const title = parsed.raw.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Untitled ladder';

  return {
    id: `ladder-${now.getTime()}`,
    title,
    createdAt: now.toISOString(),
    source: 'template',
    tasks
  };
}

/**
 * Flatten a ladder into its ordered rungs.
 * @param {Ladder} ladder
 * @returns {Step[]}
 */
export function allSteps(ladder) {
  return ladder.tasks.flatMap((t) => t.steps);
}

/**
 * Total minutes still to do.
 * @param {Ladder} ladder
 */
export function minutesRemaining(ladder) {
  return allSteps(ladder)
    .filter((s) => s.status === 'todo')
    .reduce((sum, s) => sum + s.minutes, 0);
}

/**
 * @typedef {{id:string, taskId:string, text:string, minutes:number, kind:'setup'|'work'|'wrap', why:string, loop:boolean, status:'todo'|'done'|'skipped'}} Step
 * @typedef {{id:string, title:string, createdAt:string, source:'template'|'ai', tasks:Array<{id:string, text:string, archetype:string, label:string, deadline:boolean, steps:Step[]}>}} Ladder
 */
