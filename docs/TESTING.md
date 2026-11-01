# Testing standards

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit, screen and design tests, with the coverage report and thresholds |
| `npm run test:sim` | Simulation tests: thousands of whole games per run, without coverage |
| `npm run test:watch` | Same, re-running on save |
| `npm run test:e2e` | Builds the app and plays it in iPhone (WebKit) and Android (Chromium) browsers |
| `npm run licenses` | Dependency license check (docs/LEGAL.md) |
| `npm run check` | Everything CI runs: types, licenses, unit, simulation and e2e tests |

CI runs all of it on every push. A failure blocks deployment.

## Coverage

- **Thresholds:** 95% lines, branches, functions and statements, enforced in
  `vitest.config.ts`. **Never lower them.** If code is hard to test, restructure it.
- **Not counted:** `src/main.ts` (a three-line entry point), test helpers, and
  fixtures. Everything else counts, including `scripts/check-licenses.mjs`.
- **Coverage ignore comments** (`/* v8 ignore */`) need a comment explaining why. Use
  them only for code that truly can't run in jsdom.

## Test layers

| Layer | Where | Covers |
|---|---|---|
| **Logic** | `src/games/<game>/logic.test.ts` | Rules, scoring, win and lose conditions, edge cases. Pure functions, no DOM. |
| **Screen** | `src/games/<game>/index.test.ts` | Rendering, input (tap, long-press, swipe, keys), saving and restoring, timers, cleanup. Runs in jsdom. |
| **Design** | `src/design.test.ts` plus a color section in each game's screen test | Contrast ratios and theme completeness |
| **Simulation** | `src/games/<game>/simulate.test.ts` | Many whole games played automatically (see below). |
| **Registry** | `src/games/index.test.ts` | Every game loads, mounts and unmounts. Ids are valid. Names avoid trademarks. |
| **End-to-end** | `e2e/*.spec.ts` | Real browsers at phone sizes: gestures, layout fit, touch target sizes, reloads, light and dark mode, offline. |

## Simulation tests

Hand-picked tests only check the situations someone thought of. Each game also has a
`simulate.test.ts` that plays many complete games with `simulate()` from
`src/test/simulate.ts`: the computer players play every seat, or random legal moves
for games without opponents, with seeded randomness so a failure names a seed that
reproduces it.

After every move it checks that the state is valid and survives a save. It also checks
the game's own rules: no card lost or copied, scores moving only by what the rules
allow, every round adding up (26 points in Hearts, 13 tricks in Spades), and each game
finishing with the right winner. A game that never finishes fails.

- Mix Easy and Strong, and let your seat play random legal moves where it can, to reach
  situations a sensible player wouldn't.
- Keep the whole run under about 20 seconds: thousands of games for quick games, a few
  dozen for card games with a Strong computer.
- They run without coverage (`npm run test:sim`), because coverage makes them several
  times slower. CI runs them on every push.

They have already found real bugs: a Cribbage back peg that marked only the last part
of a two-part score, and Hard number puzzles that sometimes had one extra given.

## Rules

1. **Separate logic from UI.** Each game has a `logic.ts` with no DOM access and a thin
   `index.ts` screen.
2. **Inject randomness.** Logic functions take an `rng` argument (default
   `Math.random`). Tests use `seededRng(seed)` from `src/core/random.ts`. E2E tests
   use `seedRandom(page)`.
3. **Deterministic only.** Use fake timers (`vi.useFakeTimers()`), not real waits. The
   only real waits allowed are E2E long-presses.
4. **Every bug fix gets a test** that fails without the fix.
5. **Test behavior, not implementation.** Screen tests act like a player (tap,
   long-press, swipe, keys) and check what's on screen and in storage.
6. **Use the shared helpers** in `src/test/helpers.ts` (`tap`, `pointer`, `press`,
   `setHidden`, `makeContainer`) and `e2e/helpers.ts` (`swipe`, `longPress`,
   `seedRandom`, layout checks).

## Checklist for a new game

- [ ] `src/games/<id>/logic.ts`: pure rules with an injected `rng`
- [ ] `src/games/<id>/logic.test.ts`: every rule, every edge case
- [ ] `src/games/<id>/index.ts`: the screen, using the shared components (docs/DESIGN.md)
- [ ] `src/games/<id>/index.test.ts`: every interaction, persistence, cleanup, color contrast
- [ ] `src/games/<id>/simulate.test.ts`: many whole games, checking the rules after every move
- [ ] Registered in `src/games/index.ts` with a generic name (docs/LEGAL.md)
- [ ] `e2e/<id>.spec.ts`: plays a real game on both phones, and cell or target sizes
- [ ] Added to the `GAMES` list in `e2e/app.spec.ts`
- [ ] `npm run check` passes
