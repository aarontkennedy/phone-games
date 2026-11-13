import { load, save } from '../../core/storage';
import { showIcons } from '../../core/icons';
import { showOverlay, hideOverlay, confirmNew } from '../../core/ui';
import {
  BOXES,
  LOWER,
  ROLLS,
  UPPER,
  UPPER_BONUS,
  UPPER_TARGET,
  YACHT_BONUS,
  choose,
  earnsYachtBonus,
  isGameOver,
  isValidState,
  newGame,
  openBoxes,
  roll,
  scoreFor,
  toggleHold,
  total,
  turnNumber,
  upperBonus,
  upperTotal,
  type Box,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'yacht:state';
const BEST_KEY = 'yacht:best';

export const NAMES: Record<Box, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  three: '3 of a kind',
  four: '4 of a kind',
  full: 'Full house',
  small: 'Small straight',
  large: 'Large straight',
  yacht: 'Yacht',
  chance: 'Chance',
};

const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};
const face = (n: number) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3"/>`).join('')}</svg>`;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let best = load<number>(BEST_KEY, 0);

  container.innerHTML = `
    <div class="screen ya">
      <div class="stats">
        <div class="stat"><small>Score</small><b data-score></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame ya-card" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="ya-dice" data-dice></div>
        <button class="btn ya-roll" data-roll></button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const diceEl = container.querySelector<HTMLElement>('[data-dice]')!;
  const rollBtn = container.querySelector<HTMLButtonElement>('[data-roll]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    if (isGameOver(state) && total(state) > best) {
      best = total(state);
      save(BEST_KEY, best);
    }
    save(STATE_KEY, state);
    render();
  }

  function boxHtml(box: Box, open: Box[]): string {
    const filled = state.scores[box];
    const canPick = open.includes(box);
    const value = filled ?? (canPick ? scoreFor(state, box) : '');
    const label = filled !== null ? `${NAMES[box]}: ${filled}` : canPick ? `Score ${value} in ${NAMES[box]}` : `${NAMES[box]}, empty`;
    return `<button class="ya-box${filled !== null ? ' filled' : canPick ? ' open' : ''}" data-box="${box}" aria-label="${label}"${canPick ? '' : ' disabled'}>
      <span>${NAMES[box]}</span><b>${value}</b></button>`;
  }

  function render() {
    const open = openBoxes(state);
    const upper = upperTotal(state);
    const bonus = upperBonus(state) ? String(UPPER_BONUS) : `${upper}/${UPPER_TARGET}`;
    boardEl.innerHTML = `
      <div class="ya-col">${UPPER.map((b) => boxHtml(b, open)).join('')}
        <div class="ya-box ya-bonus"><span>Bonus</span><b data-bonus>${bonus}</b></div>
      </div>
      <div class="ya-col">${LOWER.map((b) => boxHtml(b, open)).join('')}</div>`;

    const rolling = state.rolls > 0 && state.rolls < ROLLS;
    diceEl.innerHTML = state.dice
      .map((d, i) => {
        const held = state.held[i] && state.rolls > 0;
        const label = d ? `Die showing ${d}${held ? ', held' : ''}` : 'Die, not rolled yet';
        return `<button class="ya-die${held ? ' held' : ''}" data-die="${i}" aria-label="${label}" aria-pressed="${held}"${rolling ? '' : ' disabled'}>${face(d)}</button>`;
      })
      .join('');
    const left = ROLLS - state.rolls;
    rollBtn.textContent = left ? `Roll (${left} left)` : 'Pick a box';
    rollBtn.disabled = !left || isGameOver(state);

    container.querySelector('[data-score]')!.textContent = String(total(state));
    container.querySelector('[data-best]')!.textContent = String(best);
    statusEl.textContent = statusText();
    showIcons(statusEl);

    if (isGameOver(state)) {
      const score = total(state);
      showOverlay(boardEl, score >= best ? `New best: ${score}!` : `Final score: ${score}`, [['New game', () => update(newGame())]]);
    } else hideOverlay(boardEl);
  }

  function statusText(): string {
    if (isGameOver(state)) return `Game over. You scored ${total(state)}. Tap {new} to play again.`;
    const turn = `Turn ${turnNumber(state)} of ${BOXES.length}.`;
    if (state.rolls === 0) return `${turn} Tap Roll.`;
    if (earnsYachtBonus(state)) return `Another yacht: ${YACHT_BONUS} bonus points! Pick a box for it.`;
    if (state.rolls < ROLLS) return `${turn} Tap dice to hold them and roll again, or pick a box.`;
    return `${turn} No rolls left: pick a box to score.`;
  }

  boardEl.addEventListener('click', (e) => {
    const box = (e.target as Element).closest<HTMLButtonElement>('[data-box]')?.dataset.box as Box | undefined;
    if (box) update(choose(state, box));
  });
  diceEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-die]');
    if (el) update(toggleHold(state, Number(el.dataset.die)));
  });
  rollBtn.addEventListener('click', () => update(roll(state)));
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => !isGameOver(state) && (state.rolls > 0 || BOXES.some((b) => state.scores[b] !== null));
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newGame())));

  update(state);

  return () => container.replaceChildren();
}
