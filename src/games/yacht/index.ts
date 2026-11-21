import { coach } from '../../core/coach';
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
  advice,
  boxValue,
  choose,
  earnsYachtBonus,
  holdValue,
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
  type Advice,
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
  let bestScore = load<number>(BEST_KEY, 0);

  container.innerHTML = `
    <div class="screen ya">
      <div class="stats">
        <div class="stat"><small>Score</small><b data-score></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Best</small><b data-best></b></div>
        <div class="stat"><small>Right</small><b data-accuracy></b></div>
      </div>
      <div class="board-frame ya-card" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls>
        <div class="ya-dice" data-dice></div>
        <button class="btn ya-roll" data-roll></button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const diceEl = container.querySelector<HTMLElement>('[data-dice]')!;
  const rollBtn = container.querySelector<HTMLButtonElement>('[data-roll]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  /** How often your holds and boxes were the best ones by the rule of thumb (src/core/coach.ts). */
  const coaching = coach('yacht');
  /** After your choice: the best one, when yours wasn't, said until your next choice. */
  let missed: string | null = null;
  /** The advice for the dice in front of you, worked out once (it takes a moment). */
  let adviceFor: { key: string; advice: Advice } | null = null;
  const best = (): Advice => {
    const key = JSON.stringify([state.dice, state.rolls, state.scores]);
    if (adviceFor?.key !== key) adviceFor = { key, advice: advice(state) };
    return adviceFor.advice;
  };
  /** "hold 6 6 and roll", "roll all five again", "score Full house" */
  const adviceWords = (a: Advice) =>
    a.roll
      ? a.hold.some(Boolean)
        ? `hold ${state.dice.filter((_, i) => a.hold[i]).join(' ')} and roll`
        : 'roll all five again'
      : `score ${NAMES[a.box]}`;

  function update(next: State | null) {
    if (!next) return;
    if (next.rolls !== state.rolls || next.dice !== state.dice) coaching.asked = false;
    state = next;
    if (isGameOver(state) && total(state) > bestScore) {
      bestScore = total(state);
      save(BEST_KEY, bestScore);
    }
    save(STATE_KEY, state);
    render();
  }

  function boxHtml(box: Box, open: Box[], tip: Advice | null): string {
    const filled = state.scores[box];
    const canPick = open.includes(box);
    const value = filled ?? (canPick ? scoreFor(state, box) : '');
    const label = filled !== null ? `${NAMES[box]}: ${filled}` : canPick ? `Score ${value} in ${NAMES[box]}` : `${NAMES[box]}, empty`;
    const hint = tip && !tip.roll && tip.box === box ? ' hint' : '';
    return `<button class="ya-box${filled !== null ? ' filled' : canPick ? ' open' : ''}${hint}" data-box="${box}" aria-label="${label}"${canPick ? '' : ' disabled'}>
      <span>${NAMES[box]}</span><b>${value}</b></button>`;
  }

  function render() {
    const open = openBoxes(state);
    const deciding = state.rolls > 0 && !isGameOver(state);
    const tip = deciding && coaching.asked ? best() : null;
    const upper = upperTotal(state);
    const bonus = upperBonus(state) ? String(UPPER_BONUS) : `${upper}/${UPPER_TARGET}`;
    boardEl.innerHTML = `
      <div class="ya-col">${UPPER.map((b) => boxHtml(b, open, tip)).join('')}
        <div class="ya-box ya-bonus"><span>Bonus</span><b data-bonus>${bonus}</b></div>
      </div>
      <div class="ya-col">${LOWER.map((b) => boxHtml(b, open, tip)).join('')}</div>`;

    const rolling = state.rolls > 0 && state.rolls < ROLLS;
    diceEl.innerHTML = state.dice
      .map((d, i) => {
        const held = state.held[i] && state.rolls > 0;
        const label = d ? `Die showing ${d}${held ? ', held' : ''}` : 'Die, not rolled yet';
        const hint = tip?.roll && tip.hold[i] ? ' hint' : '';
        return `<button class="ya-die${held ? ' held' : ''}${hint}" data-die="${i}" aria-label="${label}" aria-pressed="${held}"${rolling ? '' : ' disabled'}>${face(d)}</button>`;
      })
      .join('');
    const left = ROLLS - state.rolls;
    rollBtn.textContent = left ? `Roll (${left} left)` : 'Pick a box';
    rollBtn.disabled = !left || isGameOver(state);

    container.querySelector('[data-score]')!.textContent = String(total(state));
    container.querySelector('[data-best]')!.textContent = String(bestScore);
    container.querySelector('[data-accuracy]')!.textContent = coaching.text();
    controlsEl.querySelector('.coach')?.remove();
    if (deciding) controlsEl.insertAdjacentHTML('afterbegin', coaching.html(tip ? tipText(tip) : ''));
    statusEl.textContent = statusText();
    showIcons(statusEl);

    if (isGameOver(state)) {
      const score = total(state);
      showOverlay(boardEl, score >= bestScore ? `New best: ${score}!` : `Final score: ${score}`, [['New game', () => update(newGame())]]);
    } else hideOverlay(boardEl);
  }

  /** The best move now (HTML). */
  function tipText(a: Advice): string {
    if (!a.roll) return `Best: score <b>${NAMES[a.box]}</b>${state.rolls < ROLLS ? ' now' : ''}.`;
    return a.hold.some(Boolean) ? 'Best: hold the <b>outlined dice</b> and roll.' : 'Best: <b>roll all five</b> again.';
  }

  /** Scores a choice against the best one, before it's made; not if you asked for the hint first. */
  function score(value: number) {
    const a = best();
    const right = value >= a.value - 1e-6;
    missed = coaching.score(right) && !right ? `Best was to ${adviceWords(a)}.` : null;
  }

  function statusText(): string {
    return (missed ? `${missed} ` : '') + statusWords();
  }

  function statusWords(): string {
    if (isGameOver(state)) return `Game over. You scored ${total(state)}. Tap {new} to play again.`;
    const turn = `Turn ${turnNumber(state)} of ${BOXES.length}.`;
    if (state.rolls === 0) return `${turn} Tap Roll.`;
    if (earnsYachtBonus(state)) return `Another yacht: ${YACHT_BONUS} bonus points! Pick a box for it.`;
    if (state.rolls < ROLLS) return `${turn} Tap dice to hold them and roll again, or pick a box.`;
    return `${turn} No rolls left: pick a box to score.`;
  }

  boardEl.addEventListener('click', (e) => {
    const box = (e.target as Element).closest<HTMLButtonElement>('[data-box]')?.dataset.box as Box | undefined;
    if (!box || !openBoxes(state).includes(box)) return;
    score(boxValue(state, box));
    update(choose(state, box));
  });
  diceEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-die]');
    if (el) update(toggleHold(state, Number(el.dataset.die)));
  });
  rollBtn.addEventListener('click', () => {
    if (state.rolls > 0 && state.rolls < ROLLS) score(holdValue(state, state.held));
    else missed = null;
    update(roll(state));
  });
  controlsEl.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-hint]')) return;
    coaching.asked = true;
    render();
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => !isGameOver(state) && (state.rolls > 0 || BOXES.some((b) => state.scores[b] !== null));
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newGame())));

  update(state);

  return () => container.replaceChildren();
}
