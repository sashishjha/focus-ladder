/**
 * Focus Ladder application controller.
 *
 * Owns the state, routes between views with the URL hash, wires events by
 * delegation, and keeps the screen reader informed. No framework: the whole
 * app is a handful of ES modules served as static files.
 */

import { buildLadder, allSteps, minutesRemaining, clampMinutes } from './engine/ladder.js';
import { splitStep, repeatStep } from './engine/split.js';
import { requestAiLadder, aiConfigured, PRESETS } from './ai/provider.js';
import { loadState, saveState, exportState, importState, ladderToText, emptyState } from './state.js';
import { announce, focusHeading, isTypingTarget, applyAppearance } from './ui/a11y.js';
import { GentleTimer, formatTime } from './ui/timer.js';
import { chime } from './ui/sound.js';
import { renderDump, renderLadder, renderFocus, renderDone, renderHelp, renderSettings, renderStuck } from './ui/render.js';

const REPO_URL = 'https://github.com/sashishjha/focus-ladder';

const view = /** @type {HTMLElement} */ (document.getElementById('view'));
const settingsDialog = /** @type {HTMLDialogElement} */ (document.getElementById('settings-dialog'));
const stuckDialog = /** @type {HTMLDialogElement} */ (document.getElementById('stuck-dialog'));

let state = loadState();
let draft = '';
let busy = false;
let dumpError = '';
let doneNote = '';
const timerUi = { visible: false, remaining: 0, total: 0, ended: false, paused: false };

const timer = new GentleTimer({
  onTick: (remaining, total) => {
    timerUi.remaining = remaining;
    timerUi.total = total;
    const time = document.getElementById('timer-time');
    const fill = document.getElementById('timer-fill');
    if (time) time.textContent = formatTime(remaining);
    if (fill) fill.style.width = `${total ? Math.round(((total - remaining) / total) * 100) : 0}%`;
    if (remaining === 60) announce('One minute left on this rung.');
  },
  onEnd: () => {
    timerUi.ended = true;
    if (state.settings.sound) chime('end');
    announce('Time is up. Tick it off, or take another five.', 'assertive');
    render();
  }
});

function persist() {
  saveState(state);
}

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'dump';
  return hash.split('?')[0];
}

function go(name) {
  const target = `#/${name}`;
  if (location.hash === target) render();
  else location.hash = target;
}

function currentStep() {
  if (!state.ladder) return null;
  const steps = allSteps(state.ladder);
  const byId = steps.find((s) => s.id === state.currentStepId && s.status === 'todo');
  if (byId) return byId;
  const first = steps.find((s) => s.status === 'todo');
  state.currentStepId = first ? first.id : null;
  return first || null;
}

function setStepStatus(stepId, status) {
  if (!state.ladder) return;
  for (const task of state.ladder.tasks) {
    const step = task.steps.find((s) => s.id === stepId);
    if (step) step.status = status;
  }
}

function render() {
  const name = route();
  timerUi.visible = timerUi.visible && name === 'focus';
  if (name !== 'focus') timer.reset();

  document.getElementById('nav-ladder')?.toggleAttribute('disabled', !state.ladder);

  if (name === 'help') {
    view.innerHTML = renderHelp();
  } else if (name === 'ladder' && state.ladder) {
    view.innerHTML = renderLadder({ ladder: state.ladder });
  } else if (name === 'focus' && state.ladder) {
    const step = currentStep();
    if (!step) {
      go('done');
      return;
    }
    const steps = allSteps(state.ladder);
    const total = steps.length;
    const index = steps.filter((s) => s.status !== 'todo').length;
    view.innerHTML = renderFocus({
      ladder: state.ladder,
      step,
      index,
      total,
      timer: timerUi,
      timerText: formatTime(timerUi.visible ? timerUi.remaining : step.minutes * 60)
    });
    if (state.settings.timerAuto && !timerUi.visible) startTimer(step);
  } else if (name === 'done' && state.ladder) {
    const steps = allSteps(state.ladder);
    const done = steps.filter((s) => s.status === 'done');
    view.innerHTML = renderDone({
      ladder: state.ladder,
      done: done.length,
      skipped: steps.filter((s) => s.status === 'skipped').length,
      minutes: done.reduce((sum, s) => sum + s.minutes, 0),
      note: doneNote
    });
  } else {
    view.innerHTML = renderDump({ settings: state.settings, busy, error: dumpError, draft });
  }
  persist();
  focusHeading(view);
}

function startTimer(step) {
  timerUi.visible = true;
  timerUi.ended = false;
  timerUi.paused = false;
  timer.start(step.minutes);
  render();
  announce(`Timer started, ${step.minutes} minutes.`);
}

async function buildFromDump(dump) {
  draft = dump;
  dumpError = '';
  if (!dump.trim()) {
    dumpError = 'Write at least one task first. One word is enough.';
    render();
    return;
  }
  busy = true;
  render();
  let ladder;
  let note = '';
  if (aiConfigured(state.settings.ai)) {
    try {
      ladder = await requestAiLadder(dump, state.settings.ai);
    } catch (error) {
      note = `AI mode could not build the ladder (${error.message}). Here is the template ladder instead.`;
    }
  }
  if (!ladder) ladder = buildLadder(dump);
  busy = false;
  draft = '';
  doneNote = '';
  state.ladder = ladder;
  state.currentStepId = null;
  persist();
  const count = allSteps(ladder).length;
  announce(`${note ? note + ' ' : ''}Ladder ready with ${count} rungs, about ${minutesRemaining(ladder)} minutes.`);
  go('ladder');
}

function finishLadder() {
  if (!state.ladder) return;
  const steps = allSteps(state.ladder);
  const done = steps.filter((s) => s.status === 'done');
  state.history.push({
    id: state.ladder.id,
    title: state.ladder.title,
    finishedAt: new Date().toISOString(),
    done: done.length,
    skipped: steps.filter((s) => s.status === 'skipped').length,
    minutes: done.reduce((sum, s) => sum + s.minutes, 0),
    note: doneNote
  });
  state.history = state.history.slice(-50);
  state.ladder = null;
  state.currentStepId = null;
  doneNote = '';
  persist();
  announce('Saved. Ready for a new ladder.');
  go('dump');
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    announce(successMessage);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    announce(successMessage);
  }
}

function act(action) {
  if (!state.ladder) return;
  const step = currentStep();
  if (!step) return;
  const steps = allSteps(state.ladder);
  const nextAfter = (id) => {
    const all = allSteps(state.ladder);
    const i = all.findIndex((s) => s.id === id);
    const after = all.slice(i + 1).find((s) => s.status === 'todo') || all.find((s) => s.status === 'todo');
    state.currentStepId = after ? after.id : null;
  };

  switch (action) {
    case 'done': {
      setStepStatus(step.id, 'done');
      if (state.settings.sound) chime('done');
      nextAfter(step.id);
      timerUi.visible = false;
      timer.reset();
      const remaining = allSteps(state.ladder).filter((s) => s.status === 'todo').length;
      announce(remaining ? `Done. ${remaining} rungs left.` : 'Done. That was the last rung.');
      if (!remaining) { go('done'); return; }
      render();
      return;
    }
    case 'skip': {
      setStepStatus(step.id, 'skipped');
      nextAfter(step.id);
      timerUi.visible = false;
      timer.reset();
      announce('Skipped for now. Next rung.');
      if (!state.currentStepId) { go('done'); return; }
      render();
      return;
    }
    case 'split': {
      state.ladder = splitStep(state.ladder, step.id);
      state.currentStepId = `${step.id}.0`;
      timerUi.visible = false;
      timer.reset();
      announce('Split into smaller rungs. Here is the first one.');
      render();
      return;
    }
    case 'again': {
      state.ladder = repeatStep(state.ladder, step.id);
      setStepStatus(step.id, 'done');
      if (state.settings.sound) chime('done');
      nextAfter(step.id);
      timerUi.visible = false;
      timer.reset();
      announce(`Another ${step.minutes} minutes of the same rung.`);
      render();
      return;
    }
    case 'timer': {
      if (timerUi.visible) {
        timerUi.visible = false;
        timer.reset();
        render();
        announce('Timer hidden.');
      } else {
        startTimer(step);
      }
      return;
    }
    case 'stuck': {
      document.getElementById('stuck-body').innerHTML = renderStuck();
      stuckDialog.showModal();
      return;
    }
    default:
      return;
  }
}

function openSettings(testResult = '') {
  document.getElementById('settings-body').innerHTML = renderSettings({ settings: state.settings, testResult });
  if (!settingsDialog.open) settingsDialog.showModal();
}

function readSettingsForm() {
  const form = /** @type {HTMLFormElement} */ (document.getElementById('settings-form'));
  const data = new FormData(form);
  const preset = String(data.get('preset') || 'groq');
  const baseUrl = String(data.get('baseUrl') || '').trim() || PRESETS[preset]?.baseUrl || '';
  const model = String(data.get('model') || '').trim() || PRESETS[preset]?.model || '';
  return {
    ...state.settings,
    textSize: String(data.get('textSize') || 'medium'),
    theme: String(data.get('theme') || 'auto'),
    font: String(data.get('font') || 'system'),
    reduceMotion: String(data.get('reduceMotion') || 'auto'),
    sound: data.get('sound') === 'on',
    timerAuto: data.get('timerAuto') === 'on',
    ai: { preset, baseUrl, model, apiKey: String(data.get('apiKey') || '').trim() }
  };
}

/* ---------- events ---------- */

view.addEventListener('click', (event) => {
  const target = /** @type {HTMLElement} */ (event.target).closest('button, a');
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.example) {
    const area = /** @type {HTMLTextAreaElement} */ (document.getElementById('dump'));
    area.value = target.dataset.example;
    draft = area.value;
    area.focus();
    return;
  }
  if (target.id === 'start-climb') { go('focus'); return; }
  if (target.id === 'new-ladder') {
    if (!state.ladder || confirm('Start a new ladder? The current one is kept in your history summary only.')) {
      if (state.ladder) finishLadder(); else go('dump');
    }
    return;
  }
  if (target.id === 'copy-ladder' && state.ladder) { copyText(ladderToText(state.ladder), 'Ladder copied as text.'); return; }
  if (target.id === 'copy-summary' && state.ladder) {
    const steps = allSteps(state.ladder);
    const done = steps.filter((s) => s.status === 'done');
    copyText(`${state.ladder.title}\n${done.length} rungs done, ${done.reduce((a, s) => a + s.minutes, 0)} minutes of progress.\n\n${ladderToText(state.ladder)}`, 'Summary copied.');
    return;
  }
  if (target.id === 'back-to-ladder') { go('ladder'); return; }
  if (target.dataset.remove && state.ladder) {
    const id = target.dataset.remove;
    state.ladder.tasks.forEach((t) => { t.steps = t.steps.filter((s) => s.id !== id); });
    state.ladder.tasks = state.ladder.tasks.filter((t) => t.steps.length > 0);
    if (state.currentStepId === id) state.currentStepId = null;
    announce('Rung removed.');
    if (!state.ladder.tasks.length) { state.ladder = null; go('dump'); return; }
    render();
    return;
  }
  if (target.dataset.act) { act(target.dataset.act); return; }
  if (target.id === 'timer-toggle') {
    if (timerUi.paused) { timer.resume(); timerUi.paused = false; announce('Timer resumed.'); }
    else { timer.pause(); timerUi.paused = true; announce('Timer paused.'); }
    target.textContent = timerUi.paused ? 'Resume' : 'Pause';
  }
});

view.addEventListener('submit', (event) => {
  const form = /** @type {HTMLFormElement} */ (event.target);
  if (form.id === 'dump-form') {
    event.preventDefault();
    const area = /** @type {HTMLTextAreaElement} */ (form.querySelector('#dump'));
    buildFromDump(area.value);
    return;
  }
  if (form.dataset.addTask && state.ladder) {
    event.preventDefault();
    const input = /** @type {HTMLInputElement} */ (form.querySelector('input'));
    const text = input.value.trim();
    if (!text) return;
    const task = state.ladder.tasks.find((t) => t.id === form.dataset.addTask);
    if (!task) return;
    task.steps.push({
      id: `${task.id}-u${Date.now()}`,
      taskId: task.id,
      text,
      minutes: clampMinutes(5),
      kind: 'work',
      why: 'You added this one yourself, so you already know why it matters.',
      loop: false,
      status: 'todo'
    });
    announce('Rung added.');
    render();
    return;
  }
  if (form.id === 'note-form') {
    event.preventDefault();
    doneNote = /** @type {HTMLInputElement} */ (form.querySelector('#note')).value.trim();
    finishLadder();
  }
});

view.addEventListener('input', (event) => {
  const t = event.target;
  if (t instanceof HTMLTextAreaElement && t.id === 'dump') draft = t.value;
});

view.addEventListener('keydown', (event) => {
  const t = event.target;
  if (t instanceof HTMLTextAreaElement && t.id === 'dump' && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    buildFromDump(t.value);
  }
});

document.addEventListener('keydown', (event) => {
  if (route() !== 'focus' || isTypingTarget(event) || settingsDialog.open || stuckDialog.open) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const map = { d: 'done', b: 'split', a: 'again', s: 'skip', t: 'timer', '?': 'stuck', '/': 'stuck' };
  if (map[key]) {
    event.preventDefault();
    act(map[key]);
  }
});

document.querySelector('nav.app-nav').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button');
  if (!button) return;
  if (button.dataset.nav) go(button.dataset.nav);
  if (button.dataset.open === 'settings') openSettings();
});

settingsDialog.addEventListener('click', async (event) => {
  const target = /** @type {HTMLElement} */ (event.target).closest('button, [data-close]');
  if (!(target instanceof HTMLElement)) return;
  if (target.hasAttribute('data-close')) { settingsDialog.close(); return; }
  if (target.id === 'toggle-key') {
    const input = /** @type {HTMLInputElement} */ (document.getElementById('ai-key'));
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    target.textContent = show ? 'Hide' : 'Show';
    target.setAttribute('aria-pressed', String(show));
    return;
  }
  if (target.id === 'ai-test') {
    const settings = readSettingsForm();
    const result = document.getElementById('ai-test-result');
    if (!aiConfigured(settings.ai)) { result.textContent = 'Add an endpoint, model and key first.'; return; }
    result.textContent = 'Testing…';
    try {
      const ladder = await requestAiLadder('Reply to one email', settings.ai, { timeoutMs: 20000 });
      result.textContent = `Connected. Sample ladder has ${allSteps(ladder).length} rungs.`;
    } catch (error) {
      result.textContent = `Could not connect: ${error.message}`;
    }
    return;
  }
  if (target.id === 'export-data') {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focus-ladder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    announce('Export downloaded.');
    return;
  }
  if (target.id === 'clear-data') {
    if (confirm('Clear your ladder, history and settings on this device? Your API key is cleared too.')) {
      state = emptyState();
      persist();
      applyAppearance(state.settings);
      settingsDialog.close();
      announce('Everything cleared.');
      go('dump');
    }
  }
});

settingsDialog.addEventListener('change', (event) => {
  const t = event.target;
  if (t instanceof HTMLSelectElement && t.id === 'ai-preset') {
    const preset = PRESETS[t.value];
    if (preset) {
      /** @type {HTMLInputElement} */ (document.getElementById('ai-base')).value = preset.baseUrl;
      /** @type {HTMLInputElement} */ (document.getElementById('ai-model')).value = preset.model;
    }
    return;
  }
  if (t instanceof HTMLInputElement && t.id === 'import-file' && t.files?.[0]) {
    t.files[0].text().then((json) => {
      state = importState(json, state);
      persist();
      applyAppearance(state.settings);
      openSettings('Import complete.');
      announce('Import complete.');
      render();
    }).catch((error) => openSettings(`Import failed: ${error.message}`));
  }
});

settingsDialog.addEventListener('submit', (event) => {
  event.preventDefault();
  state.settings = readSettingsForm();
  applyAppearance(state.settings);
  persist();
  settingsDialog.close();
  announce('Settings saved.');
  render();
});

stuckDialog.addEventListener('click', (event) => {
  const target = /** @type {HTMLElement} */ (event.target).closest('button');
  if (!target) return;
  if (target.hasAttribute('data-close')) { stuckDialog.close(); return; }
  const choice = target.dataset.stuck;
  stuckDialog.close();
  if (choice === 'split') act('split');
  if (choice === 'skip') act('skip');
  if (choice === 'move') announce('Stand up, drink some water, put on one song. The rung will be here when you are back.', 'assertive');
});

for (const dialog of [settingsDialog, stuckDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

window.addEventListener('hashchange', render);

/* ---------- boot ---------- */

applyAppearance(state.settings);
document.getElementById('repo-link')?.setAttribute('href', REPO_URL);
if (!state.ladder && ['ladder', 'focus', 'done'].includes(route())) location.hash = '#/';
render();

try {
  // Sandboxed iframes throw on the property access itself, so guard it.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
} catch {
  /* offline support is a bonus, never a requirement */
}
