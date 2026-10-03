# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

The Echo Splitter is a zero-dependency, browser-based four-chapter language puzzle game. The client is native ES modules, Canvas 2D, DOM/CSS UI, Web Speech synthesis, WebAudio effects, and Pointer Events. Game content is stored separately from logic in `content/chapter*.json` and is fetched from the local Node server.

The repository uses Node's built-in test runner and has no build step, package dependencies, linter, or formatter configured.

## Commands

Run these from the repository root (`theechosplitter`). Node 18 or newer is required; the current implementation is tested with Node 24.

```bash
npm test                              # run all tests
node --test test/game.test.js         # run one test file
node --test test/ch2.test.js test/ch3.test.js  # run several files
npm start                             # start the server
PORT=3002 npm start                   # use a different port
AUTH=0 npm start                      # disable Basic auth for local-only use
```

The server listens on port `3001` by default and binds to `0.0.0.0`. Authentication is enabled by default. `npm test` currently runs 155 tests. There is no `npm run build`, lint, or format command.

For browser validation, run `npm start` and open `/` for chapter 1, `/chapter2.html` for chapter 2, `/chapter3.html` for chapter 3, or `/chapter4.html` for chapter 4. The game is designed for a browser because the visual and interaction layers depend on Canvas, DOM, speech synthesis, WebAudio, and pointer input; Node tests cover the importable logic but not the rendered experience.

Useful browser/debug hooks:

- Add `?autostart=1` to skip the title/prologue interaction.
- Use `?autostart=1&beat=<beat>` where supported to jump to a chapter debug beat.
- Inspect `window.__errors` for captured runtime errors.
- `window.G` exposes the active chapter content, game state, and chapter-specific debug jump function after boot.

## Git 约定

分支模型与提交信息规范见 `docs/CONTRIBUTING.md`：日常开发落在 `develop`，`main` 只收稳定节点（`--no-ff` 合并）；提交必须带 type 前缀（`feat/fix/docs/refactor/test/chore/ui`），主题 ≤ 32 汉字，一事一提交，细节进 body。

## Architecture

### Runtime and routing

`server.js` is a small Node ESM HTTP server with no third-party dependencies. It:

- serves files from `public/`;
- serves `content/chapterN.json` through `/api/chapterN` for single-digit chapter numbers;
- applies Basic authentication unless the server is created with `auth: false` or launched with `AUTH=0`;
- supports `PORT` when run directly;
- prevents static path traversal by constraining resolved paths to `public/`.

`package.json` sets `"type": "module"`; all JavaScript uses native ESM imports/exports.

### Chapter entry points and shared shell

Each HTML page selects one chapter module:

- `public/index.html` loads `public/js/main.js` (chapter 1, top-down stone room).
- `public/chapter2.html` loads `public/js/ch2.js` (chapter 2, side-view chasm).
- `public/chapter3.html` loads `public/js/ch3.js` (chapter 3, side-view wall and rope).
- `public/chapter4.html` loads `public/js/ch4.js` (chapter 4, side-view river journey with three rooms).

Chapters 1 and 4 are split into layered modules under `public/js/ch1/` and `public/js/ch4/`. The HTML-facing entries (`main.js`, `ch4.js`) are pure re-export compatibility layers, as is the internal `scene.js` import path; none hold logic, and existing import paths keep working. Chapter 1's layers are strictly one-way — `planners` is the base, `physics` and `render` build on it, and `kit` sits on top; chapter 4 has the smaller `event`/`render`/`kit` stack. In both, the event machines are pure, importing only `chapter.js` and `hotbar.js` (chapter 1's also imports the chapter-specific `door.js`). A new module must never import an entry file.

- `public/js/ch1/planners.js`: chapter 1 layout, deterministic `rng`, wall/light constants, and the pure masonry/slab planners.
- `public/js/ch1/physics.js`: chapter 1 collision, screen-to-logical conversion, walk stepping, and phoneme-stone physics.
- `public/js/ch1/render.js`: chapter 1 scene creation, per-frame update, and top-down rendering.
- `public/js/ch1/event.js` and `public/js/ch4/event.js`: the pure, Node-testable event machine (`createGame`, `startGame`, `gameEvent`, and a debug jump function).
- `public/js/ch1/kit.js` and `public/js/ch4/kit.js`: the browser `kit` passed to `mount()`, with chapter geometry, world creation, input handling, ticking, drawing, and mappings from event instructions to visual effects.
- `public/js/ch4/render.js`: chapter 4 room and object drawing.

Chapters 2 and 3 remain single-file (`ch2.js`, `ch3.js`) with the same two layers — a pure event machine and a browser kit — in one file.

`public/js/shell.js` is the shared runtime. It loads the chapter JSON, scales the logical canvas, initializes speech and sound, loads persistent profile data and sprite atlases, creates the shared hotbar/UI, interprets standard event instructions, handles keyboard/pointer input, runs the animation loop, and saves chapter summaries. Keep chapter-specific rules in the chapter event machine or kit rather than duplicating them in the shell.

`public/js/chapter.js` holds the segments every chapter's event machine and kit share: the event-machine core cases (`pickupStone`, `bankHeld`, `holdItem`, `craftWord` — chapters pass only their first-pickup/craft hints) and common kit behavior (`chapterOnE` stone/bench handling, `syncHeld`, `seedBegin`, the `dropExtra`/`dropBackExtra` instruction factories, `stepWorldStones`). Chapter files keep only what is genuinely chapter-specific (USE/TICK, special targets, staging). When a shared rule changes, edit `chapter.js` once and all four chapters follow — do not re-copy event cases into a chapter file.

### Shared systems

- `public/js/hotbar.js`: inventory counts, stone consumption, craft matching, vowel classification, and the DOM drag/drop hotbar (slot drag/swap/tap-return, craft animation, `getSlots`/`placeNext`).
- `public/js/chapter.js`: shared chapter event-machine core (pickup/bank/hold/craft with per-chapter hint hooks) and shared kit behavior (common E handling, held-item sync, memory-stone seeding, drop instruction factories, stone stepping). The single place to change rules common to all chapters.
- `public/js/workbench.js`: shared crafting-bench operations for every chapter — the standard `bank` instruction (deposit + auto-place into the first empty slot), per-frame `craftSlots` sync into `view`, and the bench-stone world renderer (socket geometry comes from each chapter).
- `public/js/door.js`: chapter 1 door state machine and ritual seat geometry.
- `public/js/profile.js`: `localStorage` profile serialization and cross-chapter memory seeding. Previously picked phonemes, crafted words, abilities, and completed chapters persist as unions. `heard` (echo-object phonemes, the listening layer) is stored separately from `everPicked` (the crafting layer) so seeding is never polluted.
- `public/js/audio.js`: speech-synthesis voice selection/fallback timing, the two-lane `SpeechQueue` (dialogue lines stay serialized; phoneme carrier taps are latest-wins so rapid tapping never builds a speech backlog), and WebAudio sound effects.
- `public/js/ui.js`: hints, toast/reveal/summary UI, and icon-driven presentation.
- `public/js/journal.js`: the rune book UI (word cards with waveforms + the 48-phoneme rune grid), opened via the hotbar `#btn-book` rune button; lit runes = this chapter's picked/heard sounds ∪ the profile's lifetime sets. Echo objects (`ambience[].echo` in content) are pure listening: touch → carrier speech → rune lights, no stones, no inventory.
- `public/js/art.js`: palette, rune stroke data, and Canvas-drawn icons. Do not replace game icons with emoji.
- `public/js/sprites.js`: sprite atlas metadata and drawing helpers for assets under `public/assets/mi/`.
- `public/js/scene.js`: pure re-export entry for chapter 1 (its logic now lives in `public/js/ch1/`); kept so existing imports of `scene.js` keep working.
- `public/js/sideview.js`: shared side-view movement, jumping/climbing, stone physics, and rendering helpers used by chapters 2, 3, and 4, and by chapter 1's kit for the E hint.
- `public/js/actors.js`: player, NPC, and cat state/drawing.

### Content and persistence boundaries

`content/chapter1.json`, `content/chapter2.json`, and `content/chapter3.json` define each chapter's words, phonemes, speech lines, geometry, hints, and other data consumed by its event machine. `public/js/content-fallback.js` is an inline fallback for chapter 1 and must stay structurally identical to `content/chapter1.json`; `test/fallback.test.js` protects this invariant.

Chapter 2 and chapter 3 seed relevant phoneme stones from the profile collected in earlier chapters. Chapter summaries merge progress into the profile through `profile.js`, so changes to content or summary payloads can affect cross-chapter progression.

### Testing boundary and module convention

Tests live in `test/` and use `node:test` with `node:assert`. The test suite primarily exercises pure event machines, inventory/crafting, door transitions, physics/collision, content invariants, profile persistence, audio fallbacks, sprite metadata, and server responses. For the split chapters, tests import the `ch1/`/`ch4/` modules directly to lock the layer boundaries (e.g. `test/ch1-physics.test.js` imports `public/js/ch1/physics.js`), while other tests still import through the `main.js`/`scene.js`/`ch4.js` compatibility entries.

Keep browser-only global access (`document`, `window`, `localStorage`, Canvas setup, and browser APIs) inside functions or browser entry paths so modules can be imported by Node tests. Inject storage or browser-like dependencies where an existing module already supports it. When changing a chapter event instruction, update both the event-machine tests and the corresponding kit/shell handling if the instruction is not already standard.

## Design and Content Constraints

The design specification at `docs/superpowers/specs/2026-10-01-echo-splitter-design.md` is the authoritative description of the game's interaction and teaching model. In particular, preserve the collision of sound, context, and world response: the core loop is touch/interact -> collect phoneme stones -> craft a word item -> use it in the scene. English is presented through sound and context rather than translation; system hints are Chinese; the game does not use microphone input. The specification also defines the 48-phoneme rune system, chapter progression, and the no-emoji visual language.

The implementation plan at `docs/superpowers/plans/2026-10-01-echo-splitter.md` records the original build sequence and historical decisions. Consult current source and tests first when the plan and implementation differ.
