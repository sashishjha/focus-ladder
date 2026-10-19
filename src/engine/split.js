/**
 * "Too big" splitting for Focus Ladder.
 *
 * When a rung still feels like a wall, the person presses "Too big" and the
 * rung is replaced by two or three smaller rungs. The sub-rungs are always
 * shorter than the parent and never longer than 3 minutes, so pressing
 * "Too big" repeatedly converges on something that can be started.
 */

import { clampMinutes } from './ladder.js';

export const SPLIT_WHY = 'Smaller is not cheating. Smaller is the whole method.';

/**
 * Shorten a rung's text so it reads naturally inside a sub-rung.
 * @param {string} text
 */
function shortText(text) {
  const t = text.replace(/\.\s.*$/, '').replace(/[.]+$/, '');
  return t.length > 70 ? `${t.slice(0, 67).trim()}...` : t;
}

/**
 * Produce sub-rung templates for a given parent rung.
 * @param {import('./ladder.js').Step} step
 * @returns {Array<{text:string, minutes:number}>}
 */
export function splitTemplates(step) {
  const short = shortText(step.text);
  const parent = clampMinutes(step.minutes);
  const cap = Math.max(1, Math.min(3, parent - 1));

  if (step.kind === 'setup') {
    return [
      { text: 'Stand up, or turn toward where this happens', minutes: 1 },
      { text: `Do only the first half of: ${short}`, minutes: Math.min(cap, 1) },
      { text: 'Finish the setup and sit down with it in front of you', minutes: Math.min(cap, 1) }
    ];
  }

  if (step.kind === 'wrap') {
    return [
      { text: `Do the first half of: ${short}`, minutes: Math.min(cap, 2) },
      { text: 'Do the other half and stop', minutes: Math.min(cap, 2) }
    ];
  }

  return [
    { text: `Set a two-minute timer and begin: ${short}`, minutes: Math.min(cap, 2) },
    { text: 'Do the next tiny bit of it. Messy counts.', minutes: Math.min(cap, 3) },
    { text: 'Stop and tick this off, finished or not', minutes: 1 }
  ];
}

/**
 * Replace a rung with its sub-rungs inside a ladder. Returns a new ladder;
 * the input is not mutated.
 * @param {import('./ladder.js').Ladder} ladder
 * @param {string} stepId
 * @returns {import('./ladder.js').Ladder}
 */
export function splitStep(ladder, stepId) {
  const tasks = ladder.tasks.map((task) => {
    const index = task.steps.findIndex((s) => s.id === stepId);
    if (index === -1) return task;
    const parent = task.steps[index];
    const children = splitTemplates(parent).map((tpl, i) => ({
      id: `${parent.id}.${i}`,
      taskId: task.id,
      text: tpl.text,
      minutes: clampMinutes(tpl.minutes),
      kind: parent.kind,
      why: SPLIT_WHY,
      loop: false,
      status: 'todo',
      parentId: parent.id
    }));
    const steps = [...task.steps.slice(0, index), ...children, ...task.steps.slice(index + 1)];
    return { ...task, steps };
  });
  return { ...ladder, tasks };
}

/**
 * Duplicate a rung right after itself ("Again" for repeatable work).
 * @param {import('./ladder.js').Ladder} ladder
 * @param {string} stepId
 */
export function repeatStep(ladder, stepId) {
  const tasks = ladder.tasks.map((task) => {
    const index = task.steps.findIndex((s) => s.id === stepId);
    if (index === -1) return task;
    const source = task.steps[index];
    const siblings = task.steps.filter((s) => s.id.startsWith(`${source.id}+`)).length;
    const copy = {
      ...source,
      id: `${source.id}+${siblings + 1}`,
      status: 'todo',
      text: source.text.replace(/\s*\(again\)$/i, '') + ' (again)'
    };
    const steps = [...task.steps.slice(0, index + 1), copy, ...task.steps.slice(index + 1)];
    return { ...task, steps };
  });
  return { ...ladder, tasks };
}
