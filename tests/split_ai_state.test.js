/**
 * Tests for splitting, the AI layer's validation and fallback behaviour,
 * and persistence. The AI tests use a fake fetch; no network is touched.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildLadder, allSteps, MAX_MINUTES, MAX_SETUP_MINUTES, MAX_RUNGS } from '../src/engine/ladder.js';
import { splitStep, repeatStep, splitTemplates } from '../src/engine/split.js';
import { extractJson, validateAiReply, ladderFromAiReply, requestAiLadder, aiConfigured, SYSTEM_PROMPT, PRESETS } from '../src/ai/provider.js';
import { loadState, saveState, exportState, importState, ladderToText, emptyState, STORAGE_KEY, memoryStorage, safeStorage } from '../src/state.js';


describe('split', () => {
  it('replaces a rung with 2 or 3 sub-rungs that are shorter than the parent and at most 3 minutes', () => {
    const ladder = buildLadder('write the essay on rivers');
    const parent = allSteps(ladder).find((s) => s.kind === 'work' && s.minutes === 5);
    const next = splitStep(ladder, parent.id);
    const children = allSteps(next).filter((s) => s.parentId === parent.id);
    expect(children.length).toBeGreaterThanOrEqual(2);
    expect(children.length).toBeLessThanOrEqual(3);
    for (const c of children) {
      expect(c.minutes).toBeLessThan(parent.minutes);
      expect(c.minutes).toBeLessThanOrEqual(3);
      expect(c.minutes).toBeGreaterThanOrEqual(1);
    }
    expect(allSteps(next).find((s) => s.id === parent.id)).toBeUndefined();
  });

  it('does not mutate the input ladder', () => {
    const ladder = buildLadder('clean my room');
    const snapshot = JSON.stringify(ladder);
    splitStep(ladder, ladder.tasks[0].steps[1].id);
    expect(JSON.stringify(ladder)).toBe(snapshot);
  });

  it('converges: splitting repeatedly never produces a rung above 3 minutes and never throws', () => {
    let ladder = buildLadder('fix the bug');
    for (let i = 0; i < 6; i += 1) {
      const target = allSteps(ladder).find((s) => s.status === 'todo');
      ladder = splitStep(ladder, target.id);
    }
    for (const s of allSteps(ladder)) expect(s.minutes).toBeLessThanOrEqual(MAX_MINUTES);
    const deep = allSteps(ladder).filter((s) => (s.id.match(/\./g) || []).length >= 2);
    for (const s of deep) expect(s.minutes).toBeLessThanOrEqual(3);
  });

  it('split templates for a 1-minute rung still have at least 1 minute each', () => {
    const tiny = { id: 'x', taskId: '0', text: 'Stand up', minutes: 1, kind: 'setup', why: '', loop: false, status: 'todo' };
    for (const t of splitTemplates(tiny)) expect(t.minutes).toBeGreaterThanOrEqual(1);
  });

  it('repeatStep inserts a copy right after the rung with a unique id', () => {
    const ladder = buildLadder('clean my room');
    const target = ladder.tasks[0].steps[2];
    const next = repeatStep(ladder, target.id);
    const steps = next.tasks[0].steps;
    const i = steps.findIndex((s) => s.id === target.id);
    expect(steps[i + 1].id).toBe(`${target.id}+1`);
    expect(steps[i + 1].text).toMatch(/\(again\)$/);
    const again = repeatStep(next, target.id);
    const ids = allSteps(again).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ai: extraction and validation', () => {
  it('extracts JSON from fenced and prose-wrapped replies', () => {
    expect(extractJson('```json\n{"tasks":[]}\n```')).toEqual({ tasks: [] });
    expect(extractJson('Sure! {"tasks":[{"text":"x","steps":[]}]} hope that helps')).toEqual({ tasks: [{ text: 'x', steps: [] }] });
    expect(() => extractJson('no json here')).toThrow(/No JSON/);
  });

  const good = {
    tasks: [{
      text: 'write the essay',
      steps: [
        { text: 'Open a blank document', minutes: 1, kind: 'setup' },
        { text: 'Write one ugly sentence', minutes: 3, kind: 'work' },
        { text: 'Save and close', minutes: 1, kind: 'wrap' }
      ]
    }]
  };

  it('accepts a well-formed reply', () => {
    expect(validateAiReply(good)).toBe(good);
  });

  it.each([
    [{}, /tasks must be/],
    [{ tasks: [] }, /tasks must be/],
    [{ tasks: [{ text: '', steps: good.tasks[0].steps }] }, /task.text/],
    [{ tasks: [{ text: 'x', steps: [good.tasks[0].steps[0]] }] }, /task.steps/],
    [{ tasks: [{ text: 'x', steps: [...good.tasks[0].steps, { text: 'Work for an hour', minutes: 60, kind: 'work' }] }] }, /minutes/],
    [{ tasks: [{ text: 'x', steps: [...good.tasks[0].steps, { text: 'Meh', minutes: '3', kind: 'work' }] }] }, /minutes/],
    [{ tasks: [{ text: 'x', steps: [...good.tasks[0].steps, { text: 'Do it', minutes: 3, kind: 'play' }] }] }, /kind/],
    [{ tasks: [{ text: 'x', steps: [...good.tasks[0].steps, { text: 'ab', minutes: 3, kind: 'work' }] }] }, /step.text/]
  ])('rejects malformed reply %#', (data, message) => {
    expect(() => validateAiReply(data)).toThrow(message);
  });

  it('enforces the physical first rung and length cap on AI ladders', () => {
    const reply = {
      tasks: [{
        text: 'write the essay',
        steps: [
          { text: 'Write the introduction', minutes: 5, kind: 'work' },
          ...Array.from({ length: 11 }, (_, i) => ({ text: `Write paragraph ${i + 1}`, minutes: 5, kind: 'work' })),
          { text: 'Save and close', minutes: 1, kind: 'wrap' }
        ].slice(0, 12)
      }]
    };
    const ladder = ladderFromAiReply(validateAiReply(reply), 'write the essay', { now: 0 });
    const steps = ladder.tasks[0].steps;
    expect(steps[0].kind).toBe('setup');
    expect(steps[0].minutes).toBeLessThanOrEqual(MAX_SETUP_MINUTES);
    expect(steps.length).toBeLessThanOrEqual(MAX_RUNGS);
    expect(ladder.source).toBe('ai');
    for (const s of steps) expect(s.minutes).toBeLessThanOrEqual(MAX_MINUTES);
  });

  it('the system prompt states the five-minute rule, the physical first rung and the no-shame rule', () => {
    expect(SYSTEM_PROMPT).toMatch(/5 minutes or less/);
    expect(SYSTEM_PROMPT).toMatch(/physical setup/);
    expect(SYSTEM_PROMPT).toMatch(/shames/);
    expect(SYSTEM_PROMPT).toMatch(/JSON only/);
  });
});

describe('ai: requests', () => {
  const config = { preset: 'groq', baseUrl: PRESETS.groq.baseUrl, model: PRESETS.groq.model, apiKey: 'test-key' };

  it('aiConfigured requires a key except for Ollama', () => {
    expect(aiConfigured({ ...config, apiKey: '' })).toBe(false);
    expect(aiConfigured(config)).toBe(true);
    expect(aiConfigured({ preset: 'ollama', baseUrl: PRESETS.ollama.baseUrl, model: 'llama3.2', apiKey: '' })).toBe(true);
    expect(aiConfigured(null)).toBe(false);
  });

  it('sends the key only as a bearer header to the configured endpoint and parses the reply', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(init.headers.Authorization).toBe('Bearer test-key');
      const body = JSON.parse(init.body);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].content).toBe('write the essay');
      expect(init.body).not.toMatch(/test-key/);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ tasks: [{ text: 'write the essay', steps: [
          { text: 'Open a blank document', minutes: 1, kind: 'setup' },
          { text: 'Write one ugly sentence', minutes: 3, kind: 'work' },
          { text: 'Save and close', minutes: 1, kind: 'wrap' }
        ] }] }) } }] })
      };
    });
    const ladder = await requestAiLadder('write the essay', config, { fetch: fetchMock, now: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ladder.source).toBe('ai');
    expect(allSteps(ladder)).toHaveLength(3);
  });

  it('throws on HTTP errors and on malformed JSON so the caller can fall back', async () => {
    await expect(requestAiLadder('x', config, { fetch: async () => ({ ok: false, status: 401 }) })).rejects.toThrow(/401/);
    await expect(requestAiLadder('x', config, { fetch: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) }) })).rejects.toThrow(/No JSON/);
    await expect(requestAiLadder('x', { ...config, apiKey: '' }, { fetch: async () => { throw new Error('should not be called'); } })).rejects.toThrow(/not configured/);
  });
});

describe('state', () => {
  it('round-trips through storage and merges new default settings', () => {
    const storage = memoryStorage();
    const state = emptyState();
    state.ladder = buildLadder('clean my room', { now: 0 });
    state.settings.ai.apiKey = 'secret';
    delete state.settings.timerAuto;
    saveState(state, storage);
    const loaded = loadState(storage);
    expect(loaded.ladder).toEqual(state.ladder);
    expect(loaded.settings.ai.apiKey).toBe('secret');
    expect(loaded.settings.timerAuto).toBe(false);
  });

  it('falls back to in-memory storage when localStorage throws (sandboxed iframes)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      const store = safeStorage();
      const state = emptyState();
      state.ladder = buildLadder('pack', { now: 0 });
      expect(saveState(state)).toBe(true);
      expect(loadState().ladder).toEqual(state.ladder);
      expect(store).toBe(safeStorage());
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete globalThis.localStorage;
    }
  });

  it('returns an empty state for missing or corrupt storage', () => {
    const storage = memoryStorage();
    expect(loadState(storage).ladder).toBeNull();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadState(storage).ladder).toBeNull();
  });

  it('export omits the API key and import keeps the current key', () => {
    const state = emptyState();
    state.settings.ai.apiKey = 'secret';
    state.ladder = buildLadder('call the bank', { now: 0 });
    const json = exportState(state);
    expect(json).not.toMatch(/secret/);
    const current = emptyState();
    current.settings.ai.apiKey = 'mine';
    const imported = importState(json, current);
    expect(imported.ladder).toEqual(state.ladder);
    expect(imported.settings.ai.apiKey).toBe('mine');
    expect(() => importState('{"app":"other"}', current)).toThrow(/not a Focus Ladder/);
  });

  it('renders a ladder as plain text with status marks', () => {
    const ladder = buildLadder('call the bank', { now: 0 });
    ladder.tasks[0].steps[0].status = 'done';
    const text = ladderToText(ladder);
    expect(text).toMatch(/^Focus Ladder: call the bank/);
    expect(text).toMatch(/\[x\] 1\./);
    expect(text).toMatch(/\[ \] 2\./);
  });
});
