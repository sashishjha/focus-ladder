/**
 * Engine tests: parser, archetype matching and ladder invariants.
 * These run on every archetype template, so adding a template that breaks
 * a rule fails the build.
 */
import { describe, it, expect } from 'vitest';
import { parseDump, splitDump, extractQuantity, hasDeadlineHint, cleanPiece } from '../src/engine/parse.js';
import { ARCHETYPES, GENERIC, ALL_ARCHETYPES } from '../src/engine/archetypes.js';
import { buildLadder, matchArchetype, allSteps, MAX_RUNGS, MAX_MINUTES, MAX_SETUP_MINUTES, minutesRemaining } from '../src/engine/ladder.js';

const BANNED = [/\bjust\b/i, /\bsimply\b/i, /should have/i, /\blazy\b/i, /\bfail/i];

describe('parse', () => {
  it('splits a dump into pieces on lines, semicolons and "then"', () => {
    expect(splitDump('write the essay\nclean my room; call the dentist and then pack')).toEqual([
      'write the essay', 'clean my room', 'call the dentist', 'pack'
    ]);
  });

  it('strips bullets and leading filler', () => {
    expect(cleanPiece('- I need to email my tutor.')).toBe('email my tutor');
    expect(cleanPiece('3) really need to study for the exam!')).toBe('study for the exam');
  });

  it('extracts quantities with singular units', () => {
    expect(extractQuantity('read 3 chapters of stats')).toEqual({ count: 3, unit: 'chapters', unitSingular: 'chapter' });
    expect(extractQuantity('call at 3 pm')).toBeNull();
    expect(extractQuantity('read 1 chapter')).toBeNull();
  });

  it('detects deadline hints', () => {
    expect(hasDeadlineHint('essay due friday')).toBe(true);
    expect(hasDeadlineHint('clean the kitchen')).toBe(false);
  });

  it('strips a captured quantity from the object', () => {
    const { pieces } = parseDump('read 3 chapters of the stats textbook');
    expect(pieces[0].object).toBe('the stats textbook');
    expect(parseDump('read 40 pages').pieces[0].object).toBe('the pages');
    expect(parseDump('fold 5 shirts and 2 towels').pieces[0].object).toBe('5 shirts and 2 towels');
  });

  it('extracts verb and object and trims deadline phrases from the object', () => {
    const { pieces } = parseDump('write the essay on rivers by friday');
    expect(pieces[0].verb).toBe('write');
    expect(pieces[0].object).toBe('the essay on rivers');
    expect(pieces[0].deadline).toBe(true);
  });
});

describe('archetype templates', () => {
  it('every template rung is 1 to 5 minutes', () => {
    for (const a of ALL_ARCHETYPES) {
      for (const s of a.steps) {
        expect(s.min, `${a.id}: ${s.t}`).toBeGreaterThanOrEqual(1);
        expect(s.min, `${a.id}: ${s.t}`).toBeLessThanOrEqual(MAX_MINUTES);
      }
    }
  });

  it('every template starts with a physical setup rung of 2 minutes or less', () => {
    for (const a of ALL_ARCHETYPES) {
      expect(a.steps[0].kind, a.id).toBe('setup');
      expect(a.steps[0].min, a.id).toBeLessThanOrEqual(MAX_SETUP_MINUTES);
    }
  });

  it('every template ends with a closing rung and has 4 to 8 rungs', () => {
    for (const a of ALL_ARCHETYPES) {
      expect(a.steps[a.steps.length - 1].kind, a.id).toBe('wrap');
      expect(a.steps.length, a.id).toBeGreaterThanOrEqual(4);
      expect(a.steps.length, a.id).toBeLessThanOrEqual(8);
    }
  });

  it('no template uses shaming language', () => {
    for (const a of ALL_ARCHETYPES) {
      for (const s of a.steps) {
        for (const re of BANNED) expect(s.t, `${a.id}: ${s.t}`).not.toMatch(re);
      }
    }
  });

  it('archetype ids are unique and GENERIC is last', () => {
    const ids = ALL_ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ALL_ARCHETYPES[ALL_ARCHETYPES.length - 1]).toBe(GENERIC);
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(20);
  });
});

describe('archetype matching', () => {
  const cases = [
    ['write the essay on rivers', 'write'],
    ['study for my stats exam', 'study'],
    ['read 3 chapters of the textbook', 'read'],
    ['email my professor about the meeting', 'email'],
    ['call the dentist', 'call'],
    ['clean my room', 'clean'],
    ['do the laundry', 'laundry'],
    ['wash the dishes', 'dishes'],
    ['cook dinner', 'cook'],
    ['buy groceries', 'shop'],
    ['pay the electricity bill', 'admin'],
    ['apply for the summer internship', 'apply'],
    ['finish the problem set for algorithms', 'assignment'],
    ['fix the failing tests in my project', 'code'],
    ['make slides for the group presentation', 'slides'],
    ['prepare for the meeting with my advisor', 'meeting'],
    ['pack for the trip', 'pack'],
    ['go for a run', 'exercise'],
    ['book a doctor appointment', 'health'],
    ['sort my downloads folder', 'files'],
    ['decide which laptop to buy', 'decide'],
    ['start the robotics project', 'project'],
    ['xyzzy plugh', 'generic']
  ];
  it.each(cases)('"%s" matches %s', (text, expected) => {
    const { pieces } = parseDump(text);
    expect(matchArchetype(pieces[0]).id).toBe(expected);
  });
});

describe('buildLadder invariants', () => {
  const dumps = [
    'write the essay on rivers due friday',
    'clean my room and do laundry',
    'read 3 chapters of the stats textbook',
    'read 40 pages',
    'email my tutor\ncall the bank\nsomething completely unrecognisable',
    'fix the bug'
  ];

  it('I1: every rung is 1 to 5 minutes', () => {
    for (const d of dumps) {
      for (const s of allSteps(buildLadder(d))) {
        expect(s.minutes).toBeGreaterThanOrEqual(1);
        expect(s.minutes).toBeLessThanOrEqual(MAX_MINUTES);
      }
    }
  });

  it('I2: the first rung of every task is a setup rung of 2 minutes or less', () => {
    for (const d of dumps) {
      for (const task of buildLadder(d).tasks) {
        expect(task.steps[0].kind).toBe('setup');
        expect(task.steps[0].minutes).toBeLessThanOrEqual(MAX_SETUP_MINUTES);
      }
    }
  });

  it('I3: a task never exceeds MAX_RUNGS, even with a large quantity', () => {
    const ladder = buildLadder('read 40 pages');
    expect(ladder.tasks[0].steps.length).toBeLessThanOrEqual(MAX_RUNGS);
    expect(ladder.tasks[0].steps[ladder.tasks[0].steps.length - 1].kind).toBe('wrap');
  });

  it('I4: tasks with a deadline hint are ordered first, otherwise input order is kept', () => {
    const ladder = buildLadder('clean my room\nwrite the essay due tomorrow\ncall the dentist');
    expect(ladder.tasks.map((t) => t.archetype)).toEqual(['write', 'clean', 'call']);
    expect(ladder.tasks[0].deadline).toBe(true);
  });

  it('I5: the same input produces the same ladder', () => {
    const a = buildLadder('clean my room and do laundry', { now: '2026-10-19T00:00:00Z' });
    const b = buildLadder('clean my room and do laundry', { now: '2026-10-19T00:00:00Z' });
    expect(a).toEqual(b);
  });

  it('expands loop rungs once per unit and numbers them', () => {
    const ladder = buildLadder('read 3 chapters of the stats textbook');
    const texts = ladder.tasks[0].steps.map((s) => s.text);
    expect(texts.filter((t) => /^Read chapter \d/.test(t))).toHaveLength(3);
    expect(texts).toContain('Read chapter 2 for five minutes. Mark anything confusing with a dot.');
  });

  it('fills the object into templates and never leaves a placeholder behind', () => {
    for (const d of dumps) {
      for (const s of allSteps(buildLadder(d))) {
        expect(s.text).not.toMatch(/\{(object|n|unit)\}/);
      }
    }
    const ladder = buildLadder('write the essay on rivers due friday');
    expect(ladder.tasks[0].steps[0].text).toBe('Open a blank document and name it "the essay on rivers"');
  });

  it('every rung has an explanation and a unique id', () => {
    const ladder = buildLadder('clean my room and do laundry');
    const steps = allSteps(ladder);
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of steps) expect(s.why.length).toBeGreaterThan(10);
  });

  it('computes minutes remaining from todo rungs only', () => {
    const ladder = buildLadder('call the dentist');
    const before = minutesRemaining(ladder);
    ladder.tasks[0].steps[0].status = 'done';
    expect(minutesRemaining(ladder)).toBe(before - ladder.tasks[0].steps[0].minutes);
  });

  it('handles empty and whitespace input without throwing', () => {
    expect(buildLadder('').tasks).toEqual([]);
    expect(buildLadder('   \n  ').tasks).toEqual([]);
  });
});
