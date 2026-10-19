/**
 * Persistence for Focus Ladder.
 *
 * Everything lives in localStorage on the person's device. There is no
 * account and nothing is sent anywhere, except the brain dump to the AI
 * endpoint the person configured themselves. Exports deliberately leave the
 * API key out so a shared file never leaks a secret.
 */

export const STORAGE_KEY = 'focus-ladder:v1';

/**
 * In-memory stand-in used when localStorage is unavailable (sandboxed
 * iframes, some private modes). The app keeps working for the session.
 */
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear()
  };
}

let fallback = null;

/**
 * Return localStorage if it can actually be used, otherwise a shared
 * in-memory storage. Merely touching window.localStorage can throw a
 * SecurityError, so the access itself is guarded.
 * @returns {Storage}
 */
export function safeStorage() {
  try {
    const storage = globalThis.localStorage;
    const probe = '__focus_ladder_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    if (!fallback) fallback = memoryStorage();
    return /** @type {Storage} */ (fallback);
  }
}

export const DEFAULT_SETTINGS = Object.freeze({
  textSize: 'medium',       // small | medium | large | xlarge
  theme: 'auto',            // auto | light | dark | contrast
  font: 'system',           // system | hyperlegible | mono
  reduceMotion: 'auto',     // auto | on | off
  sound: true,
  timerAuto: false,
  ai: { preset: 'groq', baseUrl: '', apiKey: '', model: '' }
});

/**
 * @typedef {{version:number, settings:typeof DEFAULT_SETTINGS, ladder:(import('./engine/ladder.js').Ladder|null), currentStepId:(string|null), history:Array<{id:string,title:string,finishedAt:string,done:number,skipped:number,minutes:number}>}} AppState
 */

/** @returns {AppState} */
export function emptyState() {
  return {
    version: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    ladder: null,
    currentStepId: null,
    history: []
  };
}

/**
 * Merge stored settings over defaults so new settings get sane values after
 * an upgrade.
 * @param {any} stored
 */
function mergeSettings(stored) {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!stored || typeof stored !== 'object') return base;
  const merged = { ...base, ...stored, ai: { ...base.ai, ...(stored.ai || {}) } };
  return merged;
}

/**
 * @param {Storage} [storage]
 * @returns {AppState}
 */
export function loadState(storage) {
  try {
    const store = storage || safeStorage();
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const state = emptyState();
    state.settings = mergeSettings(parsed.settings);
    state.ladder = parsed.ladder && Array.isArray(parsed.ladder.tasks) ? parsed.ladder : null;
    state.currentStepId = typeof parsed.currentStepId === 'string' ? parsed.currentStepId : null;
    state.history = Array.isArray(parsed.history) ? parsed.history.slice(-50) : [];
    return state;
  } catch {
    return emptyState();
  }
}

/**
 * @param {AppState} state
 * @param {Storage} [storage]
 */
export function saveState(state, storage) {
  try {
    (storage || safeStorage()).setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Export everything except the API key.
 * @param {AppState} state
 */
export function exportState(state) {
  const copy = structuredClone(state);
  copy.settings.ai.apiKey = '';
  return JSON.stringify({ app: 'focus-ladder', exportedAt: new Date().toISOString(), state: copy }, null, 2);
}

/**
 * Import a file produced by exportState. Keeps the current API key.
 * @param {string} json
 * @param {AppState} current
 * @returns {AppState}
 */
export function importState(json, current) {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.app !== 'focus-ladder' || !parsed.state) {
    throw new Error('This is not a Focus Ladder export file');
  }
  const state = emptyState();
  state.settings = mergeSettings(parsed.state.settings);
  state.settings.ai.apiKey = current?.settings?.ai?.apiKey || '';
  state.ladder = parsed.state.ladder && Array.isArray(parsed.state.ladder.tasks) ? parsed.state.ladder : null;
  state.currentStepId = typeof parsed.state.currentStepId === 'string' ? parsed.state.currentStepId : null;
  state.history = Array.isArray(parsed.state.history) ? parsed.state.history.slice(-50) : [];
  return state;
}

/**
 * Render a ladder as plain text, for sharing with a friend, coach or
 * support worker.
 * @param {import('./engine/ladder.js').Ladder} ladder
 */
export function ladderToText(ladder) {
  const lines = [`Focus Ladder: ${ladder.title}`, ''];
  for (const task of ladder.tasks) {
    lines.push(`${task.text}${task.deadline ? ' (deadline)' : ''}`);
    task.steps.forEach((s, i) => {
      const mark = s.status === 'done' ? 'x' : s.status === 'skipped' ? '-' : ' ';
      lines.push(`  [${mark}] ${i + 1}. ${s.text} (${s.minutes} min)`);
    });
    lines.push('');
  }
  return lines.join('\n').trim();
}
