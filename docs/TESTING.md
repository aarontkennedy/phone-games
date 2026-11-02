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
- Play as many games as it takes to reach the rare situations: thousands for quick
  games, a few dozen for slow ones like Chess and Hold'em. There's no time limit, but
  don't pad a run with games that add nothing.
- They run without coverage (`npm run test:sim`), because coverage makes them several
  times slower. CI runs them on every push.

They have already found real bugs: a Cribbage back peg that marked only the last part
of a two-part score, and Hard number puzzles that sometimes had one extra given.

### Strong beats Easy

Every game with an Easy/Strong choice also checks, in its `simulate.test.ts`, that
Strong really is stronger, using `strongShare()` from `src/test/strength.ts`. It plays
Strong against Easy and fails if Strong's share of wins drops below a threshold set
safely under the measured rate. Without it, a change could leave Strong playing like
Easy and every other test would still pass.

- One-on-one games swap who moves first; a draw counts as half a win.
- Four-player games put one Strong seat against three Easy ones (an even share is 0.25),
  or a Strong team against an Easy team.
- Games that are mostly luck (Hot Dice, Crazy Eights) have lower thresholds and more games.

## Reference tests

`src/games/reference.test.ts` checks the rules against answers published elsewhere,
because the other tests encode our own reading of the rules and would agree with a
misunderstanding. It includes:

- **Move counts ("perft")** from the start position for Checkers (7, 49, 302, 1,469,
  7,361, 36,768), Reversi (OEIS A124004: 4, 12, 56, 244, 1,396, 8,200), Four in a Row
  (7, 49, 343, ..., 5,673,234 at eight moves) and Chess (the start and four standard
  test positions from the Chess Programming Wiki, which between them cover castling,
  en passant, promotion and pins). An exact match means moves follow the real rules.
- **Tic-Tac-Toe:** all 255,168 possible games: 131,184 X wins, 77,904 O wins, 46,080 draws.
- **Poker hands:** all 2,598,960 five-card hands sort into the known totals (40 straight
  flushes, 624 four of a kinds, ... 1,302,540 high cards).
- **Cribbage:** the 29 and 28 hands, flush rules for hands and cribs, pegging, and the
  known fact that no hand scores 19, 25, 26 or 27 (checked on 20,000 random hands).
- **Number Place:** Wikipedia's example puzzle has exactly one answer, the published one.
- **Scoring tables** for Hot Dice, Yacht, Spades and Blackjack hand values, and the 2048
  merge rules.

When a rule has common variants, the test names the one we chose. Add a reference test
whenever a game has published numbers to check against.

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
- [ ] `src/games/<id>/simulate.test.ts`: many whole games, checking the rules after every move, and Strong beats Easy if it has computer players
- [ ] A reference test in `src/games/reference.test.ts` if the game has published numbers to check against
- [ ] Registered in `src/games/index.ts` with a generic name (docs/LEGAL.md)
- [ ] `e2e/<id>.spec.ts`: plays a real game on both phones, and cell or target sizes
- [ ] Added to the `GAMES` list in `e2e/app.spec.ts`
- [ ] `npm run check` passes
