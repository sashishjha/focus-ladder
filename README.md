# Focus Ladder

[![tests](https://github.com/sashishjha/focus-ladder/actions/workflows/test.yml/badge.svg)](https://github.com/sashishjha/focus-ladder/actions/workflows/test.yml)

**Turn a task you cannot start into a ladder of five-minute rungs, and climb one rung at a time.**

Focus Ladder is a small, keyboard-first web app for the moment when a task feels like a wall. It is built for people with ADHD, executive-dysfunction, anxiety or burnout, and for anyone whose to-do list has stopped being a list and become a weight.

- **Dump** what is weighing on you, messy is fine.
- **Get a ladder**: every rung is five minutes or less, and the first rung of every task is physical (open the document, stand in the room, put the book in front of you).
- **Climb** in a focus view that shows one rung at a time. `D` done, `B` too big (split it further), `A` again, `S` not now, `T` gentle timer, `?` stuck.
- **No shame mechanics**: no streaks, no red, no overdue counters. Skipping is a decision, not a failure.

Works offline, installs as an app, needs no account, and sends nothing anywhere unless you connect your own AI provider.

> Built for [Taskforge](https://taskforge.devpost.com) (October 2026), an online student hackathon for accessible productivity tools.

## Try it

- Live demo: <https://sashishjha.github.io/focus-ladder/>
- Locally: clone, then `npm run dev` and open <http://localhost:4173>. There is no build step; the app is plain ES modules served as static files.

```bash
git clone https://github.com/sashishjha/focus-ladder.git
cd focus-ladder
npm install        # dev tooling only: vitest, jsdom, axe-core, esbuild
npm run dev        # static server on :4173
npm test           # 82 tests: engine invariants, splitting, AI validation, state, axe-core
```

## Why rungs, not tasks

Task initiation is the hard part of executive dysfunction. The research-backed moves are small: externalise the next action, make it tiny, make it physical, remove the choice of what to do next, time-box gently, and keep the person's dignity intact. Focus Ladder encodes those moves as **invariants** the code enforces and the test suite checks:

| Invariant | Meaning |
| --- | --- |
| I1 | Every rung is 1 to 5 minutes. |
| I2 | The first rung of every task is a `setup` rung of 2 minutes or less, and it is physical. |
| I3 | A task has at most 10 rungs; repetition is handled by the **Again** button, not an endless list. |
| I4 | Tasks that mention a deadline go first; otherwise your order is kept. |
| I5 | The same input always produces the same ladder (no randomness). |

"Too big" always produces rungs that are shorter than the parent and never longer than three minutes, so pressing it repeatedly converges on something you can start.

## How it works

```
src/
  engine/
    parse.js        brain dump -> task pieces (verb, object, quantity, deadline hint)
    archetypes.js   23 task families (writing, studying, admin, cleaning, coding...) with step templates
    ladder.js       archetype matching, template filling, invariants I1-I5
    split.js        "Too big" splitting and "Again" repetition
  ai/
    provider.js     optional bring-your-own-key AI mode (OpenAI-compatible), strict validation, fallback
  ui/
    render.js       view templates (dump, ladder, focus, done, help, settings, stuck)
    a11y.js         live-region announcer, focus management, HTML escaping
    timer.js        gentle countdown (never auto-advances)
    sound.js        two-note Web Audio chime, no audio files
  state.js          localStorage persistence (safe fallback), export/import, plain-text export
  app.js            controller: hash routing, event delegation, keyboard shortcuts
tests/              vitest: engine, split, ai, state, axe-core accessibility on every view
tools/              dev server and single-file bundler (no runtime dependencies)
```

**Template mode** (default) works offline and instantly. The parser splits the dump into tasks, scores each against the archetype keyword lists (verb matches count extra, broad archetypes are down-weighted), fills the matching template with the person's own words, expands repeatable rungs by any quantity mentioned ("read 3 chapters" gives three reading rungs), then enforces the invariants.

**AI mode** (optional) sends the dump to an OpenAI-compatible endpoint you configure in Settings (presets for Groq's free tier, OpenAI, Gemini and local Ollama). The reply must be strict JSON; it is validated field by field, passed through the same invariants, and if anything fails you get the template ladder with a note. The key is stored only in this browser and is left out of exports.

## Accessibility

- Semantic HTML, a skip link, and focus moved to the heading on every view change.
- Every control is a real `<button>`, `<input>` or `<select>` with a label; all targets are at least 44 px.
- Keyboard shortcuts work only in the focus view and never while typing.
- `aria-live` regions announce rung changes, timer events and results.
- Text size (4 steps), colour theme (system / light / dark / high contrast), font (system / Atkinson Hyperlegible / monospace) and motion are user-controlled and default to system preferences.
- axe-core runs against every rendered view in the test suite; colour contrast was checked in a real browser in light, dark and high-contrast themes.
- Works offline after the first visit (service worker) and can be installed as a PWA.

## Privacy

No account, no analytics, no server. Ladders, history and settings live in `localStorage` on your device. If `localStorage` is unavailable the app keeps working in memory for the session. Exports never include your API key.

## Limitations and honest notes

- Template mode recognises 23 task families; an unrecognised task gets a sensible generic ladder, not a tailored one.
- English only for now. The parser's deadline and quantity detection are heuristic.
- AI mode depends on the provider you choose and on CORS being allowed by that provider (Groq, OpenAI and Gemini allow browser calls; Ollama needs `OLLAMA_ORIGINS` set).
- The gentle timer is a countdown, not a scheduler. Focus Ladder does not plan your day.
- Tested with keyboard navigation and automated checks; a full screen-reader audit with real users is the next step.

## AI assistance disclosure

Built during the Taskforge event window; no pre-existing codebase was used. The code, tests and documentation were written with substantial AI pair-programming assistance (Claude, via Hyperagent), working from my concept, design principles and scope decisions. I reviewed the output, ran the test suite and tested the app in the browser before submitting.

## Licence

MIT. See `LICENSE`.
