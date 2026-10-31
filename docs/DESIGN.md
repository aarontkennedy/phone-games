# Design standards

## Principles

1. **Yours alone.** No ads, accounts, nags, notifications, analytics or network calls.
2. **Works anywhere.** Fully offline after the first visit.
3. **One thumb, portrait first.** Everything reachable and readable while holding the
   phone in one hand. Turning the phone sideways also works (see "Landscape").
4. **Instant resume.** Every move auto-saves, so closing the app never loses a game.
5. **Calm.** Quick, subtle motion and no flashing. Celebrate wins briefly.
6. **One family.** Every game uses the same tokens, components and screen layout.
7. **Flat design.** Minimalist, two-dimensional shapes, solid colors and clean lines.
   No realistic textures, shadows, bevels, gradients, glows or 3D effects.
8. **No reading glasses needed.** All text is large enough to read at arm's length
   without reading glasses.

## Flat design

This style contrasts with realistic designs (skeuomorphism).

- **Solid colors only.** No `linear-gradient`, `radial-gradient` or SVG gradients.
- **No depth effects:** no `box-shadow`, `text-shadow`, `filter` (including
  `drop-shadow` and `blur`), `backdrop-filter`, or inset bevels. Show separation with
  color, spacing or a 1px solid border.
- **No textures or images** for surfaces (no `url()` backgrounds, noise or patterns).
- **Icons:** simple geometric 2D shapes as inline SVG with solid `fill` and `stroke`
  only. No gradients, filters, patterns, embedded images or opacity tricks. Game icons
  live in `src/games/icons.ts`. The app icon is drawn by `scripts/make-icons.mjs`.
- **Pressed and selected states:** change the solid color or opacity, never the depth.
- **Playing pieces** (cards, tiles, dice, chess pieces) follow the same rules: flat
  shapes and solid fills, with no glossy or 3D rendering.
- **Enforced by tests:** `src/design.test.ts` scans every stylesheet for gradients,
  shadows, filters and `url()`. `src/games/index.test.ts` checks every game icon is a
  flat SVG, and each game's tests check its board symbols.
- **Board symbols** (flags, mines and marks) are inline SVG too, kept with the game
  (e.g. `src/games/minesweeper/symbols.ts`). Give each one `role="img"` and an
  `aria-label`, and color it from CSS tokens so it works in light and dark mode.
- **No emoji anywhere.** Phones draw them glossy and shaded. `scripts/no-emoji.test.mjs`
  fails if any app source file contains one.

## Tokens

All colors, spacing, radii, type sizes and timings are CSS custom properties in
`src/style.css`. **Don't hard-code values a token covers.** Game-specific colors (tile
and number colors) live in the game's own CSS, defined for both themes.

| Group | Tokens |
|---|---|
| Color | `--bg --surface --surface-2 --border --text --muted --accent --on-accent --link --danger --danger-soft --board --cell-empty --scrim` |
| Spacing (4px scale) | `--space-1` (4) `--space-2` (8) `--space-3` (12) `--space-4` (16) `--space-5` (24) `--space-6` (32) |
| Radius | `--radius-sm` (6) `--radius` (10) `--radius-lg` (16) |
| Type | `--text-sm` (18) `--text-md` (20, body) `--text-lg` (22) `--text-xl` (28) `--text-2xl` (36) |
| Layout | `--tap` (44px touch target), `--content-max` (480px) |
| Motion | `--dur` (150ms) |

## Readable text (no reading glasses)

The player needs reading glasses for small text, so this app never uses it.

- **Minimum 18px** for all text: labels, hints, status lines, captions and board
  numbers. There's no smaller size to fall back on, so `--text-sm` (18px) is the floor.
- **Body text is 20px** (`--text-md`, set on `body`). Buttons and controls inherit it.
- **Use the `--text-*` tokens** for every fixed size. Never hard-code a `font-size` in
  px, rem or em.
- **Board numbers** (tiles, cell counts) scale with the board using `cqw` and must
  still be **18px or larger on a 390px-wide phone** at every difficulty and for the
  longest value. If they can't be, make the board smaller or simplify it.
- **When large text doesn't fit,** wrap onto another line (as `.controls` does) or
  shorten the words. Never shrink the text below 18px to make it fit.
- **Enforced by tests:** `src/design.test.ts` checks the tokens, the body size, and that
  every stylesheet uses tokens or board units. The E2E `expectReadableText()` helper
  checks that every visible piece of text renders at 18px or larger, on the home screen,
  every game, every Mines difficulty and a 5-digit 2048 tile.

## Theme

- Light and dark follow the phone's setting (`prefers-color-scheme`).
- Every themed color token has a dark value. `src/design.test.ts` enforces this.

## Screen layout

Every game screen uses this structure, top to bottom:

```
topbar        ‹ Games   Title                    (app shell)
.screen
  .stats      [stat] [New] [stat]                score/time and the main action
  .controls   [segmented options] [toggle]       optional
  .board-frame                                   the playing surface; hosts .overlay
  .status-line                                   hint, or result (aria-live)
```

### Landscape

When a phone is turned sideways (landscape and at most 560px tall), every game screen
switches to a side bar layout automatically:

```
| ‹ Games  Title   Rules |                    |
| [stat] [New] [stat]    |      board         |
| [options] [toggle]     |  (fills the        |
| status line            |   screen height)   |
```

- **Pure CSS** in `src/style.css`. It works for any screen built from the structure
  above, so new games get it for free. Don't add game-specific landscape rules unless a
  game truly needs them.
- **Everything fits on one screen.** No scrolling either way, the board fully visible,
  every control left of the board. Touch target, cell size and text size rules still
  apply.
- **Gesture surfaces** set `touch-action: none` on the board itself, not only on the
  `.screen` wrapper, because the wrapper has no box in this layout.
- **Tested** by `e2e/landscape.spec.ts` at iPhone 13 (844x390) and iPhone SE (667x375)
  sizes, for every game and Mines difficulty.
- **Tablets** are taller than 560px, so they keep the portrait layout.
- The manifest allows any orientation.

Shared components live in `src/style.css` and `src/core/ui.ts`:

| Component | Use |
|---|---|
| `.btn` / `.btn.secondary` | Primary / secondary buttons. Toggles use `aria-pressed`. |
| `.stat` | A labeled number (Score, Best, Time, Mines). |
| `.segmented` | Mutually exclusive options (difficulty). The chosen one gets `aria-pressed="true"`. |
| `.board-frame` | The board container. |
| `showOverlay()` / `hideOverlay()` | Win or lose messages with actions. |
| `.status-line` | A one-line hint or result under the board. |

## Touch

- **Buttons and links:** at least `--tap` (44px) tall. The E2E tests check this.
- **Grid cells:** at least **26px** wide on a 390px-wide phone. The E2E tests check
  this for every difficulty. If a board can't meet it, make the board smaller.
- **No horizontal scrolling,** ever. The E2E tests check this. Vertical scrolling is
  allowed only when unavoidable.
- **Every gesture has a tap alternative.** For example, long-press to flag is also
  available through the Dig/Flag toggle.
- **Gesture values:** long-press is 350ms, swipe threshold is 24px, and finger wobble
  tolerance is 10px.
- **No hover-only features.** Double-tap zoom is disabled.
- **Safe areas:** respect the notch and home bar. The app shell already does this.

## Color and contrast

- **Normal text:** at least **4.5:1** against its background (WCAG AA).
- **Large bold numerals** (tiles, counts): at least **3:1**.
- **Symbols** (flags, mines, marks): at least **3:1** against the square they sit on. If
  a color can't reach that, add a solid edge in a color that can (as the dark-mode flag
  does).
- These are tested in `src/design.test.ts` and in each game's tests. Every new color
  pair that carries text needs a contrast test.
- **Never use color alone** to carry meaning. Pair it with a number, symbol or text
  (e.g. the flag, X and mine symbols).

## Motion and feedback

- **Animations:** `--dur` (150ms) or less, and only on things that changed.
- **Reduced motion:** `prefers-reduced-motion` turns animation off. This is handled
  globally.
- **Haptics:** `navigator.vibrate?.(15)` for small confirmations. It works on Android
  only, so it's always optional.
- **Sound (future):** off by default, synthesized in code.

## How to play

Every game has a **How to play** page, written for someone who has never played it.

- **Where:** the **Rules** button in the top bar opens it. It never opens by itself.
- **Content:** the `howToPlay` field in `src/games/index.ts`: a one-sentence `goal`,
  at least 3 `steps` and optional `tips`.
- **Steps:** explain a turn in the order a new player needs it. Name the on-screen
  buttons and numbers exactly as they appear (**New**, **Best**, **Flag**). Say what
  ends the game and how you win. Use plain words, not jargon (say "join", not "merge").
- **Tips:** a few beginner strategies.
- **Enforced by tests:** `src/games/index.test.ts` requires rules for every game, with
  no emoji and no protected names. `e2e/help.spec.ts` checks it stays closed until Rules
  is tapped, reads without glasses and closes.

## About page

`#/about`, linked from **About** on the home screen (`src/about.ts`). It covers what the
app is, how to add it to the home screen on iPhone and Android, privacy, copyright and
third-party software. The license notices load from `public/THIRD_PARTY_NOTICES.txt`,
which is precached so they work offline. No game may use the id `about`.

## Persistence

- **Keys:** `<game-id>:state` for the game in progress and `<game-id>:best` for
  records, through `src/core/storage.ts`.
- **Validate saved data on load** (`isValidState`). If it's invalid, start a new game.
  Never crash.
- **When a change makes old records meaningless** (e.g. a board is resized), add a
  version suffix to the key (`minesweeper:best:v3`).

## Writing

- Sentence case, short. Address the player as "you".
- **Status line:** how to play while playing, the result when finished.
- **Emoji:** don't add new ones. They aren't flat (see "Flat design"). Use flat SVG
  icons instead.

## Accessibility

- **Real elements:** use real `<button>`s and `<a>`s for actions.
- **Toggles and option groups:** expose state with `aria-pressed`.
- **Announcements:** results are announced through `aria-live` on the status line.
  Overlays are `role="dialog"` with a label.
