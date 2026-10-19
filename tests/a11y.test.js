/**
 * Accessibility tests. Each view is rendered into jsdom inside the real
 * index.html shell and checked with axe-core. Also checks the structural
 * promises the Help page makes: a skip link, live regions, labelled
 * controls, and keyboard shortcuts that never fire while typing.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import axe from 'axe-core';
import { buildLadder, allSteps } from '../src/engine/ladder.js';
import { renderDump, renderLadder, renderFocus, renderDone, renderHelp, renderSettings, renderStuck } from '../src/ui/render.js';
import { DEFAULT_SETTINGS } from '../src/state.js';
import { esc, isTypingTarget } from '../src/ui/a11y.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ladder = buildLadder('write the essay on rivers due friday\nclean my room', { now: 0 });

/** @param {string} inner */
function mount(inner, dialog = null) {
  // axe probes canvas for colour work; jsdom has no canvas, so keep that noise out of the test log.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {});
  const dom = new JSDOM(html, { pretendToBeVisual: true, virtualConsole });
  const { document } = dom.window;
  // Scripts and remote stylesheets are not needed for structural checks.
  document.querySelectorAll('script, link[rel="stylesheet"]').forEach((n) => n.remove());
  document.getElementById('view').innerHTML = inner;
  if (dialog) {
    const body = document.getElementById(dialog.id);
    body.innerHTML = dialog.html;
    body.closest('dialog').setAttribute('open', '');
  }
  return dom;
}

async function audit(dom) {
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  const results = await axe.run(window.document.documentElement, {
    rules: {
      // Colour contrast needs a real layout engine; it is checked in the browser instead.
      'color-contrast': { enabled: false }
    }
  });
  return results.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const settings = structuredClone(DEFAULT_SETTINGS);

describe('axe-core: no violations in any view', () => {
  it('dump view', async () => {
    expect(await audit(mount(renderDump({ settings })))).toEqual([]);
  });
  it('dump view with error', async () => {
    expect(await audit(mount(renderDump({ settings, error: 'Write a task first.' })))).toEqual([]);
  });
  it('ladder view', async () => {
    expect(await audit(mount(renderLadder({ ladder })))).toEqual([]);
  });
  it('focus view with timer', async () => {
    const step = allSteps(ladder)[0];
    const inner = renderFocus({ ladder, step, index: 0, total: allSteps(ladder).length, timer: { visible: true, remaining: 60, total: 120, ended: true, paused: false }, timerText: '1:00' });
    expect(await audit(mount(inner))).toEqual([]);
  });
  it('done view', async () => {
    expect(await audit(mount(renderDone({ ladder, done: 3, skipped: 1, minutes: 12 })))).toEqual([]);
  });
  it('help view', async () => {
    expect(await audit(mount(renderHelp()))).toEqual([]);
  });
  it('settings dialog', async () => {
    expect(await audit(mount(renderHelp(), { id: 'settings-body', html: renderSettings({ settings }) }))).toEqual([]);
  });
  it('stuck dialog', async () => {
    expect(await audit(mount(renderHelp(), { id: 'stuck-body', html: renderStuck() }))).toEqual([]);
  });
});

describe('structural accessibility promises', () => {
  it('has a skip link, a focusable main, and polite and assertive live regions', () => {
    const { window } = mount(renderDump({ settings }));
    const d = window.document;
    expect(d.querySelector('a.skip-link[href="#main"]')).toBeTruthy();
    expect(d.getElementById('main').getAttribute('tabindex')).toBe('-1');
    expect(d.getElementById('announcer').getAttribute('aria-live')).toBe('polite');
    expect(d.getElementById('announcer-assertive').getAttribute('aria-live')).toBe('assertive');
    expect(d.documentElement.getAttribute('lang')).toBe('en');
  });

  it('every form control in every view has an accessible label', () => {
    const views = [
      renderDump({ settings }), renderLadder({ ladder }), renderDone({ ladder, done: 1, skipped: 0, minutes: 2 })
    ];
    for (const inner of views) {
      const { window } = mount(inner, { id: 'settings-body', html: renderSettings({ settings }) });
      const d = window.document;
      for (const el of d.querySelectorAll('input, textarea, select')) {
        const labelled = el.id && d.querySelector(`label[for="${el.id}"]`) || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        expect(labelled, `${el.tagName}#${el.id || el.name}`).toBeTruthy();
      }
    }
  });

  it('focus view exposes every action as a real button with a visible shortcut hint', () => {
    const step = allSteps(ladder)[0];
    const { window } = mount(renderFocus({ ladder, step, index: 0, total: 5, timer: { visible: false, remaining: 0, total: 0, ended: false, paused: false }, timerText: '2:00' }));
    const buttons = [...window.document.querySelectorAll('.focus-actions button')];
    expect(buttons.map((b) => b.dataset.act)).toEqual(['done', 'split', 'again', 'skip', 'timer', 'stuck']);
    for (const b of buttons) expect(b.querySelector('kbd')).toBeTruthy();
    expect(window.document.querySelector('[role="progressbar"]').getAttribute('aria-valuetext')).toMatch(/Rung 1 of 5/);
  });

  it('shortcuts never fire while typing', () => {
    const { window } = mount(renderDump({ settings }));
    const d = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    const area = d.getElementById('dump');
    expect(isTypingTarget({ target: area })).toBe(true);
    expect(isTypingTarget({ target: d.querySelector('button') })).toBe(false);
  });

  it('escapes user text in templates', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    const evil = buildLadder('<script>alert(1)</script> my room', { now: 0 });
    expect(renderLadder({ ladder: evil })).not.toMatch(/<script>alert/);
  });
});
