# Design standards

## Principles

1. **Yours alone.** No ads, accounts, nags, notifications, analytics or network calls.
2. **Works anywhere.** Fully offline after the first visit.
3. **One thumb, portrait first.** Everything reachable and readable while holding the
   phone in one hand, with the buttons you tap during play at the bottom (see "Screen
   layout"). Turning the phone sideways also works (see "Landscape").
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
topbar        [‹] Title  [new] [gear] [i]       (app shell: back, title, New game, Settings, Rules)
.screen
  .stats      [stat] [stat]                      score/time (the game's New moves to the top bar)
  .board-frame                                   the playing surface; hosts .overlay
  .recent                                        optional: recent moves ("Recent moves")
  .status-line                                   hint, or result (aria-live)
  .controls   [buttons]                          optional; pinned to the bottom
settingsHtml(...)                                optional, after .screen: moved into Settings
```

- **Thumb first.** Most people hold the phone in their right hand and tap with the
  thumb, which reaches the bottom of the screen most easily. So scores and timers go at
  the top, the board in the middle, and the buttons you tap during play at the bottom.
  `.controls` gets `margin-top: auto`, so it sits at the bottom of the screen even when
  the board is short. Put the markup in this order too, so screen readers and the Tab
  key follow what's on screen.
- **New stays at the top.** The game puts its New button (`data-new`) in `.stats`; the app
  (src/app.ts) moves it into the top bar as a circular-arrow icon labeled "New game", away
  from the thumb, so a stray tap doesn't throw away a game. The game's handler still works:
  it's the same button. And when a game is partway through, New (and switching
  difficulty when that restarts) asks first, using `confirmNew()` from `src/core/ui.ts`
  with the game's own `inProgress()` test. A fresh or finished game starts at once. A button tapped every round, like Blackjack's Deal or
  Tic-Tac-Toe's New (rounds take seconds), goes in `.controls` instead.
- **Leave slack in every row.** CI runs on Linux, whose fallback font is wider than the
  phones' system fonts, so a row that just fits on a Mac can overflow there (and on a
  phone with a wider font). Let labels wrap and let rows wrap (`flex-wrap`) rather than
  sizing anything to fit exactly.
- **Tested** by `e2e/app.spec.ts` for every game.

### Landscape

When a phone is turned sideways (landscape and at most 560px tall), every game screen
switches to a side bar layout automatically:

```
|                    | [‹] Title [new][gear][i]|
|      board         | [stat] [stat]          |
|  (fills the        | status line            |
|   screen height)   |                        |
|                    | [options] [toggle]     |
```

The side bar is on the right, under a right thumb, with the controls at its bottom.

- **Pure CSS** in `src/style.css`. It works for any screen built from the structure
  above, so new games get it for free. Don't add game-specific landscape rules unless a
  game truly needs them.
- **Everything fits on one screen.** No scrolling either way, the board fully visible,
  every control right of the board. Touch target, cell size and text size rules still
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
| `.segmented` | Mutually exclusive options. The chosen one gets `aria-pressed="true"`. In Settings via `settingRow()`, or on screen for choices made every hand (Bet, Chip). |
| `settingsHtml()` / `settingRow()` / `levelSetting()` | Settings behind the gear (src/core/ui.ts; see "Settings"). |
| `.board-frame` | The board container. |
| `showOverlay()` / `hideOverlay()` | Win or lose messages with actions. |
| `.status-line` | A one-line hint or result under the board. |
| `RECENT_HTML` / `recentMoves()` | The recent moves list (src/core/recent.ts; see "Recent moves"). |

### Steady controls

Buttons shouldn't move while you play, because your thumb learns where they are.

- **Things that come and go get their own reserved space.** Backgammon's dice have a row
  of their own above the buttons, kept at full height with no dice.
- **Settings stay off the game screen** (see "Settings"), so the game's buttons have the
  row to themselves and never get squeezed by a switch beside them.

### Settings

Choices you rarely change live behind the gear beside Rules in the top bar, not on the
game screen: the computer's level (Easy / Strong), Mines and Number Place difficulty,
Spider's suits, Solitaire's Draw 1 / Draw 3, and Blackjack's decks. Choices made every
hand (the casino games' Bet and Chip) stay on screen.

- **How:** the game ends its template with `settingsHtml(...rows)` from src/core/ui.ts,
  one `settingRow(label, choices, note)` per setting (`levelSetting()` for Easy / Strong).
  The app (src/app.ts) moves the rows into a full-screen Settings panel like the Rules
  page and adds the gear only for games that have settings. The game's own click handlers
  keep working: they're the same buttons.
- **Notes say when a change applies:** the level at once ("Changes take effect right
  away."), a difficulty by starting a new game (it asks first if one is in progress, via
  `confirmNew`), Blackjack's decks only between hands (the buttons are disabled during one).
- **Top bar** (`.game-bar`): back, title, New game, gear, Rules. The title is body-sized
  (20px) and may wrap to two lines, which still fit the 44px row, so the bar never grows,
  even in CI's wider font. Where the bar is under 340px wide (sideways on an iPhone SE),
  the title is hidden from sight but still read by screen readers: four icons and
  "Backgammon" don't fit.
- **Rules say where it is:** "Change it any time in **Settings** (the gear at the top)."
- **Tested** by `e2e/settings.spec.ts` for every game with settings, including the top
  bar fitting sideways on an iPhone SE with four icons.

### Recent moves

In games where the computer makes several moves between your turns (Go Fish, Crazy
Eights, Rummy 500, Gin Rummy, Texas Hold'em, Five-Card Draw, Dominoes, Hot Dice), a short
list between the board and the status line shows the last 4 moves, so none flash by
unseen. Your own moves are in it too, so it reads in order.

- **Shared:** `RECENT_HTML` for the markup and `recentMoves(container, id)` from
  `src/core/recent.ts`. It saves the list as `${id}:recent`, so it survives leaving the game.
- **One line per move,** written by a pure `moveText(prev, next)` (or the action itself, as
  in the poker games' `betText`) and added in the screen's `update()`. Keep lines short
  ("West asked North for 7s and got 2."): about 40 characters fit one line on a small phone.
- **Cleared** at a new game, round or hand (each screen's `start()`), so it's always about
  the play in front of you.
- **The status line no longer repeats the last move;** it says what to do next.
- **Steady:** the list's height comes from the screen's spare room, not from the moves, so
  the controls don't move as moves come in. Upright it's 1 to 4 lines tall (the card games
  leave little room on an iPhone 13, so the screen's gaps also tighten to `--space-2`);
  sideways it takes the side bar's spare height. Older moves scroll inside it; it's a
  reversed column (newest first in the page), so the newest move stays in view.
- **Tested** by `e2e/recent.spec.ts`, upright and sideways, with 4 long moves.

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

## Playing cards

Every card game uses the shared card pieces, so cards look and behave the same
everywhere.

- **Model:** `src/core/cards.ts` (suits, ranks, names, decks, shuffling with an `rng`).
- **Drawing:** `src/core/card-view.ts` and `src/core/cards.css`. `cardFace()`,
  `cardBack()` and `cardSlot()` return HTML. Tappable cards are real `<button>`s with a
  spoken name ("Queen of hearts"). Put the `cards` class on the game's `.screen` for the
  card color tokens.
- **Look:** flat, light card faces in both themes (like real cards), a 1px solid edge,
  a solid purple back, and our own simple suit shapes. No pictures on court cards: the
  rank letter and suit say it all.
- **Readable:** the corner rank is `--text-md` (20px). When cards overlap, at least
  24px of each card must show so the rank stays readable. Squeeze overlaps to fit the
  screen, but never below that.
- **Contrast:** card text 4.5:1 on the face. Card edges, backs and empty-pile outlines
  3:1 against the table. Tested in `src/core/card-view.test.ts`.
- **Tap to move:** tapping a card moves it to the best legal place. No dragging is
  needed. If it can't move, the status line says so.
- **Undo** wherever a game has no hidden information to protect (Solitaire).
- **Computer players** (Hearts, Spades, Euchre, Cribbage): an **Easy / Strong** choice
  in Settings, like the Mines difficulty. Switching it applies at once and never
  restarts the game.
- **Their turns are paced** so you can follow along: about 0.6 seconds per computer play,
  and a finished trick stays on the table about 1 second before it's collected. The
  status line says whose turn it is, and the current seat is outlined.
- **Playable cards lift** a few pixels on your turn. Cards you can't play stay put and
  are disabled, but are never dimmed, so every rank stays readable.
- **Trick games** share `src/core/tricks.ts`: seats (You, West, North, East, played
  clockwise), aces-high ranking, trick winners with optional trump, follow-suit rules,
  hand sorting and dealing. They also share the table in `src/core/trick-view.ts`: a row
  of seats in play order (West, North, East, You), each with its name, one line of game
  info (score, or bid and tricks) and the card it played, then your hand in two rows.

## How to play

Every game has a **How to play** page, written for someone who has never played it.

- **Where:** the **Rules** button (an "i" icon, named Rules for screen readers) in the top bar opens it. It never opens by itself.
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
