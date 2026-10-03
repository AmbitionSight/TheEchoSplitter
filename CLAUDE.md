# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

Echo Stone is a zero-dependency, browser-based three-chapter language puzzle game. The client is native ES modules, Canvas 2D, DOM/CSS UI, Web Speech synthesis, WebAudio effects, and Pointer Events. Game content is stored separately from logic in `content/chapter*.json` and is fetched from the local Node server.

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

The server listens on port `3001` by default and binds to `0.0.0.0`. Authentication is enabled by default. `npm test` currently runs 73 tests. There is no `npm run build`, lint, or format command.

For browser validation, run `npm start` and open `/` for chapter 1, `/chapter2.html` for chapter 2, or `/chapter3.html` for chapter 3. The game is designed for a browser because the visual and interaction layers depend on Canvas, DOM, speech synthesis, WebAudio, and pointer input; Node tests cover the importable logic but not the rendered experience.

Useful browser/debug hooks:

- Add `?autostart=1` to skip the title/prologue interaction.
- Use `?autostart=1&beat=<beat>` where supported to jump to a chapter debug beat.
- Inspect `window.__errors` for captured runtime errors.
- `window.G` exposes the active chapter content, game state, and chapter-specific debug jump function after boot.

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

The chapter modules contain two layers in one file:

1. A pure event machine (`createGame`, `startGame`, `gameEvent`, and a debug jump function), which is directly imported by Node tests.
2. A browser `kit` passed to `mount()` with chapter geometry, world creation, input handling, ticking, drawing, and mappings from event instructions to visual effects.

`public/js/shell.js` is the shared runtime. It loads the chapter JSON, scales the logical canvas, initializes speech and sound, loads persistent profile data and sprite atlases, creates the shared hotbar/UI, interprets standard event instructions, handles keyboard/pointer input, runs the animation loop, and saves chapter summaries. Keep chapter-specific rules in the chapter event machine or kit rather than duplicating them in the shell.

### Shared systems

- `public/js/hotbar.js`: inventory counts, stone consumption, craft matching, vowel classification, and the DOM drag/drop hotbar.
- `public/js/door.js`: chapter 1 door state machine and ritual seat geometry.
- `public/js/profile.js`: `localStorage` profile serialization and cross-chapter memory seeding. Previously picked phonemes, crafted words, abilities, and completed chapters persist as unions.
- `public/js/audio.js`: speech-synthesis voice selection/fallback timing and WebAudio sound effects.
- `public/js/ui.js`: hints, toast/reveal/summary UI, and icon-driven presentation.
- `public/js/journal.js`: word cards and the 48-phoneme rune book.
- `public/js/art.js`: palette, rune stroke data, and Canvas-drawn icons. Do not replace game icons with emoji.
- `public/js/sprites.js`: sprite atlas metadata and drawing helpers for assets under `public/assets/mi/`.
- `public/js/scene.js`: chapter 1 layout, coordinate conversion, collision, stone physics, and top-down rendering.
- `public/js/sideview.js`: shared side-view movement, jumping/climbing, stone physics, and rendering helpers used by chapters 2 and 3.
- `public/js/actors.js`: player, NPC, and cat state/drawing.

### Content and persistence boundaries

`content/chapter1.json`, `content/chapter2.json`, and `content/chapter3.json` define each chapter's words, phonemes, speech lines, geometry, hints, and other data consumed by its event machine. `public/js/content-fallback.js` is an inline fallback for chapter 1 and must stay structurally identical to `content/chapter1.json`; `test/fallback.test.js` protects this invariant.

Chapter 2 and chapter 3 seed relevant phoneme stones from the profile collected in earlier chapters. Chapter summaries merge progress into the profile through `profile.js`, so changes to content or summary payloads can affect cross-chapter progression.

### Testing boundary and module convention

Tests live in `test/` and use `node:test` with `node:assert`. The test suite primarily exercises pure event machines, inventory/crafting, door transitions, physics/collision, content invariants, profile persistence, audio fallbacks, sprite metadata, and server responses.

Keep browser-only global access (`document`, `window`, `localStorage`, Canvas setup, and browser APIs) inside functions or browser entry paths so modules can be imported by Node tests. Inject storage or browser-like dependencies where an existing module already supports it. When changing a chapter event instruction, update both the event-machine tests and the corresponding kit/shell handling if the instruction is not already standard.

## Design and Content Constraints

The design specification at `docs/superpowers/specs/2026-10-01-echo-stone-design.md` is the authoritative description of the game's interaction and teaching model. In particular, preserve the collision of sound, context, and world response: the core loop is touch/interact -> collect phoneme stones -> craft a word item -> use it in the scene. English is presented through sound and context rather than translation; system hints are Chinese; the game does not use microphone input. The specification also defines the 48-phoneme rune system, chapter progression, and the no-emoji visual language.

The implementation plan at `docs/superpowers/plans/2026-10-01-echo-stone.md` records the original build sequence and historical decisions. Consult current source and tests first when the plan and implementation differ.
