/**
 * View templates for Focus Ladder. Each function returns an HTML string;
 * app.js wires the events. All dynamic text passes through esc().
 */

import { esc } from './a11y.js';
import { allSteps, minutesRemaining } from '../engine/ladder.js';
import { PRESETS, aiConfigured } from '../ai/provider.js';

export const EXAMPLES = [
  'Write the essay on rivers due Friday',
  'Clean my room and do laundry',
  'Reply to my supervisor\'s email about the meeting',
  'Read 3 chapters of the stats textbook',
  'Apply for the summer internship',
  'Fix the failing tests in my project'
];

const KIND_LABEL = { setup: 'Starting rung', work: 'Work rung', wrap: 'Closing rung' };

/**
 * @param {{settings:any, busy?:boolean, error?:string}} model
 */
export function renderDump(model) {
  const ai = aiConfigured(model.settings.ai);
  const presetLabel = PRESETS[model.settings.ai.preset]?.label || 'custom endpoint';
  return `
    <h1>What's weighing on you?</h1>
    <p class="lede">Dump it here, messy is fine. Focus Ladder turns it into rungs of five minutes or less and shows you one at a time.</p>
    <div class="mode" role="status">
      <span class="dot" aria-hidden="true"></span>
      ${ai ? `AI mode via ${esc(presetLabel)}. Falls back to templates if it fails.` : 'Template mode. Works offline, nothing is sent anywhere.'}
    </div>
    <form id="dump-form" class="card" ${model.busy ? 'aria-busy="true"' : ''}>
      <label for="dump">Your task, or a few tasks</label>
      <textarea id="dump" name="dump" placeholder="e.g. write the lab report, email my tutor, tidy the desk" required autocomplete="off" spellcheck="true">${esc(model.draft || '')}</textarea>
      <p class="hint">One task per line works best. Mention a deadline and that task goes first.</p>
      <p class="hint" id="examples-label">Or try an example:</p>
      <div class="chips" role="group" aria-labelledby="examples-label">
        ${EXAMPLES.map((e) => `<button type="button" data-example="${esc(e)}">${esc(e)}</button>`).join('')}
      </div>
      ${model.error ? `<div class="notice warn" role="alert">${esc(model.error)}</div>` : ''}
      <div class="actions">
        <button type="submit" class="primary" ${model.busy ? 'disabled' : ''}>${model.busy ? 'Building your ladder…' : 'Build my ladder'}</button>
        <span class="hint">Enter adds a line. <kbd>Ctrl</kbd> + <kbd>Enter</kbd> builds.</span>
      </div>
    </form>
  `;
}

/**
 * @param {{ladder: import('../engine/ladder.js').Ladder}} model
 */
export function renderLadder(model) {
  const { ladder } = model;
  const steps = allSteps(ladder);
  const todo = steps.filter((s) => s.status === 'todo').length;
  const done = steps.filter((s) => s.status === 'done').length;
  const minutes = minutesRemaining(ladder);
  return `
    <h1>Your ladder</h1>
    <p class="lede">${steps.length} rungs, about ${minutes} minutes left${done ? `, ${done} already climbed` : ''}. Remove anything that is not yours to do today.</p>
    <div class="actions" style="margin-top:0">
      <button type="button" class="primary" id="start-climb" ${todo ? '' : 'disabled'}>${done ? 'Keep climbing' : 'Start climbing'}</button>
      <button type="button" id="copy-ladder">Copy as text</button>
      <button type="button" class="quiet" id="new-ladder">New ladder</button>
      <span class="badge">${ladder.source === 'ai' ? 'Built with AI' : 'Built from templates'}</span>
    </div>
    ${ladder.tasks.map((task) => `
      <section class="task card" aria-labelledby="task-${esc(task.id)}">
        <div class="task-head">
          <h2 id="task-${esc(task.id)}">${esc(task.text)}</h2>
          <span class="badge">${esc(task.label)}</span>
          ${task.deadline ? '<span class="badge deadline">Deadline mentioned, so it goes first</span>' : ''}
        </div>
        <ol class="rungs">
          ${task.steps.map((s) => `
            <li class="${esc(s.status)}" data-step="${esc(s.id)}">
              <span class="num" aria-hidden="true"></span>
              <div>
                <div class="text">${esc(s.text)}</div>
                <div class="meta">${esc(KIND_LABEL[s.kind])} · ${s.minutes} min${s.status === 'done' ? ' · done' : s.status === 'skipped' ? ' · skipped' : ''}</div>
              </div>
              <button type="button" class="quiet" data-remove="${esc(s.id)}" aria-label="Remove rung: ${esc(s.text)}">Remove</button>
            </li>`).join('')}
        </ol>
        <form class="add-rung" data-add-task="${esc(task.id)}">
          <label class="sr-only" for="add-${esc(task.id)}">Add a rung to ${esc(task.text)}</label>
          <input id="add-${esc(task.id)}" type="text" placeholder="Add your own rung (5 minutes or less)" maxlength="160">
          <button type="submit">Add</button>
        </form>
      </section>`).join('')}
  `;
}

/**
 * @param {{ladder: import('../engine/ladder.js').Ladder, step: import('../engine/ladder.js').Step, index:number, total:number, timer:{visible:boolean, remaining:number, total:number, ended:boolean, paused:boolean}}} model
 */
export function renderFocus(model) {
  const { ladder, step, index, total, timer } = model;
  const task = ladder.tasks.find((t) => t.id === step.taskId);
  const steps = allSteps(ladder);
  const next = steps.slice(steps.indexOf(step) + 1).find((s) => s.status === 'todo');
  const pct = Math.round((index / total) * 100);
  const minutes = minutesRemaining(ladder);
  return `
    <div class="progress" aria-hidden="true">
      <span>Rung ${index + 1} of ${total}</span>
      <span>${minutes} min left</span>
    </div>
    <div class="progress-bar" role="progressbar" aria-label="Ladder progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${index}" aria-valuetext="Rung ${index + 1} of ${total}, about ${minutes} minutes left">
      <div style="width:${pct}%"></div>
    </div>
    <article class="card rung-card" aria-labelledby="rung-title">
      <div class="kind">
        <span class="badge ${step.kind === 'setup' ? 'setup' : ''}">${esc(KIND_LABEL[step.kind])}</span>
        <span class="minutes">${step.minutes} min</span>
        <span class="hint" style="margin:0">from: ${esc(task?.text || ladder.title)}</span>
      </div>
      <h1 id="rung-title">${esc(step.text)}</h1>
      <p class="why">${esc(step.why)}</p>
      <div class="timer" ${timer.visible ? '' : 'hidden'}>
        <span class="time" role="timer" aria-live="off" id="timer-time">${esc(model.timerText)}</span>
        <div class="timer-bar" aria-hidden="true"><div id="timer-fill" style="width:${timer.total ? Math.round(((timer.total - timer.remaining) / timer.total) * 100) : 0}%"></div></div>
        <button type="button" id="timer-toggle">${timer.paused ? 'Resume' : 'Pause'}</button>
      </div>
      ${timer.ended ? '<div class="notice" role="status">Time is up. Tick it off, or take another five. Both are wins.</div>' : ''}
      <div class="focus-actions">
        <button type="button" class="primary" data-act="done"><span>Done</span><small><kbd>D</kbd></small></button>
        <button type="button" data-act="split"><span>Too big</span><small>make it smaller <kbd>B</kbd></small></button>
        <button type="button" data-act="again"><span>Again</span><small>another ${step.minutes} min <kbd>A</kbd></small></button>
        <button type="button" data-act="skip"><span>Not now</span><small>skip it <kbd>S</kbd></small></button>
        <button type="button" data-act="timer"><span>${timer.visible ? 'Hide timer' : 'Start timer'}</span><small><kbd>T</kbd></small></button>
        <button type="button" data-act="stuck" aria-haspopup="dialog"><span>Stuck?</span><small>three ways out <kbd>?</kbd></small></button>
      </div>
    </article>
    <details class="peek">
      <summary>Peek at what comes next</summary>
      <p>${next ? `${esc(next.text)} (${next.minutes} min)` : 'This is the last rung.'}</p>
    </details>
    <div class="actions">
      <button type="button" class="quiet" id="back-to-ladder">See the whole ladder</button>
    </div>
  `;
}

/**
 * @param {{ladder: import('../engine/ladder.js').Ladder, done:number, skipped:number, minutes:number, note?:string}} model
 */
export function renderDone(model) {
  const { ladder, done, skipped, minutes } = model;
  const headline = done === 0 ? 'You showed up. That counts.' : done < 3 ? 'You started. That was the hard part.' : 'You climbed it.';
  return `
    <h1>${esc(headline)}</h1>
    <p class="lede">${esc(ladder.title)}</p>
    <div class="stats">
      <div class="card"><span class="big">${done}</span>rungs done</div>
      <div class="card"><span class="big">${minutes}</span>minutes of progress</div>
      <div class="card"><span class="big">${skipped}</span>skipped, no judgement</div>
    </div>
    <form id="note-form" class="card">
      <label for="note">One line for next time (optional)</label>
      <input id="note" type="text" maxlength="200" placeholder="e.g. the first rung was easier once the book was already open" value="${esc(model.note || '')}">
      <p class="hint">Saved on this device only, in your history.</p>
      <div class="actions">
        <button type="submit" class="primary">Save and finish</button>
        <button type="button" id="copy-summary">Copy summary</button>
        <button type="button" class="quiet" id="back-to-ladder">Back to the ladder</button>
      </div>
    </form>
  `;
}

export function renderHelp() {
  return `
    <div class="help">
      <h1>How Focus Ladder works</h1>
      <p class="lede">Built for the moment when a task feels like a wall. It does three things, and nothing else.</p>
      <h2>1. Rungs, not tasks</h2>
      <p>Every rung is five minutes or less. The first rung is always physical: open the document, stand in the room, put the book in front of you. Starting is the hardest part, so the ladder makes starting tiny.</p>
      <h2>2. One rung at a time</h2>
      <p>The focus view shows only the current rung. Press <kbd>D</kbd> when it is done, <kbd>B</kbd> if it is still too big and you want it split further, <kbd>A</kbd> to do another five minutes of the same thing, <kbd>S</kbd> to come back to it later, <kbd>T</kbd> for a gentle timer, and <kbd>?</kbd> when you are stuck.</p>
      <h2>3. No shame mechanics</h2>
      <p>No streaks, no red, no overdue counters. Skipping is a decision, not a failure. The summary counts minutes of progress, not minutes you "should" have done.</p>
      <h2>Accessibility</h2>
      <ul>
        <li>Everything works with the keyboard alone, with visible focus.</li>
        <li>Screen readers hear each rung change and each timer end through live regions.</li>
        <li>Text size, contrast theme, font and motion are in Settings and respect your system preferences by default.</li>
        <li>Works offline after the first visit and can be installed as an app.</li>
      </ul>
      <h2>Your data</h2>
      <p>There is no account. Ladders and settings stay in this browser. Export and import them from Settings. If you connect an AI provider, your brain dump is sent only to that provider with your own key; the key is stored on this device and left out of exports.</p>
      <h2>Template mode and AI mode</h2>
      <p>Template mode works everywhere, offline, instantly: it recognises the kind of task (writing, studying, cleaning, admin, applying, coding and more) and fills a proven ladder for it. AI mode asks a language model to write the rungs in your own words, then checks the reply against the same rules: five minutes or less, physical first rung, no shaming language. If the reply fails the check, you get the template ladder instead.</p>
    </div>
  `;
}

/**
 * @param {{settings:any, testResult?:string}} model
 */
export function renderSettings(model) {
  const s = model.settings;
  const radio = (name, value, label, checked) => `
    <label><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}> ${label}</label>`;
  return `
    <div class="dialog-header">
      <h2 id="settings-title">Settings</h2>
      <button type="button" class="quiet" data-close aria-label="Close settings">Close</button>
    </div>
    <form id="settings-form">
      <fieldset>
        <legend>Text size</legend>
        <div class="radios">
          ${radio('textSize', 'small', 'Small', s.textSize === 'small')}
          ${radio('textSize', 'medium', 'Medium', s.textSize === 'medium')}
          ${radio('textSize', 'large', 'Large', s.textSize === 'large')}
          ${radio('textSize', 'xlarge', 'Extra large', s.textSize === 'xlarge')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Colours</legend>
        <div class="radios">
          ${radio('theme', 'auto', 'Match system', s.theme === 'auto')}
          ${radio('theme', 'light', 'Light', s.theme === 'light')}
          ${radio('theme', 'dark', 'Dark', s.theme === 'dark')}
          ${radio('theme', 'contrast', 'High contrast', s.theme === 'contrast')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Font</legend>
        <div class="radios">
          ${radio('font', 'system', 'System', s.font === 'system')}
          ${radio('font', 'hyperlegible', 'Atkinson Hyperlegible', s.font === 'hyperlegible')}
          ${radio('font', 'mono', 'Monospace', s.font === 'mono')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Motion</legend>
        <div class="radios">
          ${radio('reduceMotion', 'auto', 'Match system', s.reduceMotion === 'auto')}
          ${radio('reduceMotion', 'on', 'Allow motion', s.reduceMotion === 'on')}
          ${radio('reduceMotion', 'off', 'Reduce motion', s.reduceMotion === 'off')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Sounds and timer</legend>
        <label class="check"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}> Soft chime when a rung is done or the timer ends</label>
        <label class="check"><input type="checkbox" name="timerAuto" ${s.timerAuto ? 'checked' : ''}> Start the timer automatically on each rung</label>
      </fieldset>
      <fieldset>
        <legend>AI mode (optional, bring your own key)</legend>
        <p class="hint" style="margin-bottom:0.8rem">Template mode already works. AI mode writes rungs in your own words using a provider you choose. Your key stays on this device and is sent only to that provider.</p>
        <div class="field">
          <label for="ai-preset">Provider</label>
          <select id="ai-preset" name="preset">
            ${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${s.ai.preset === k ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="ai-base">Endpoint base URL</label>
          <input id="ai-base" name="baseUrl" type="url" value="${esc(s.ai.baseUrl || PRESETS[s.ai.preset]?.baseUrl || '')}" placeholder="https://api.groq.com/openai/v1">
        </div>
        <div class="field">
          <label for="ai-model">Model</label>
          <input id="ai-model" name="model" type="text" value="${esc(s.ai.model || PRESETS[s.ai.preset]?.model || '')}" placeholder="llama-3.3-70b-versatile">
        </div>
        <div class="field">
          <label for="ai-key">API key</label>
          <div class="row">
            <input id="ai-key" name="apiKey" type="password" value="${esc(s.ai.apiKey || '')}" autocomplete="off" placeholder="${s.ai.preset === 'ollama' ? 'Not needed for Ollama' : 'Paste your key'}">
            <button type="button" id="toggle-key" aria-pressed="false" aria-controls="ai-key">Show</button>
          </div>
          <p class="hint">Groq offers a free key at console.groq.com. Leave empty to stay in template mode.</p>
        </div>
        <div class="actions" style="margin-top:0.4rem">
          <button type="button" id="ai-test">Test connection</button>
          <span id="ai-test-result" role="status" class="hint" style="margin:0">${esc(model.testResult || '')}</span>
        </div>
      </fieldset>
      <fieldset>
        <legend>Your data</legend>
        <div class="actions" style="margin-top:0">
          <button type="button" id="export-data">Export</button>
          <label class="button" for="import-file" style="margin:0">Import<input id="import-file" type="file" accept="application/json" class="sr-only"></label>
          <button type="button" class="danger" id="clear-data">Clear everything</button>
        </div>
        <p class="hint">Exports never include your API key.</p>
      </fieldset>
      <div class="actions">
        <button type="submit" class="primary">Save settings</button>
        <button type="button" class="quiet" data-close>Cancel</button>
      </div>
    </form>
  `;
}

export function renderStuck() {
  return `
    <div class="dialog-header">
      <h2 id="stuck-title">Stuck is normal. Pick one.</h2>
      <button type="button" class="quiet" data-close aria-label="Close">Close</button>
    </div>
    <p class="hint">None of these is giving up. They are three ways past the wall.</p>
    <div class="stuck-options">
      <button type="button" data-stuck="split"><span><strong>Make it a two-minute version.</strong><br>Split this rung into smaller pieces.</span></button>
      <button type="button" data-stuck="move"><span><strong>Change one thing about your body.</strong><br>Stand up, drink water, put on one song. Then come back.</span></button>
      <button type="button" data-stuck="skip"><span><strong>Do the next rung first.</strong><br>Skip this one for now. It will still be here.</span></button>
    </div>
  `;
}
