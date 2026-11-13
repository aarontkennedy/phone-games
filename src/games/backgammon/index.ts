import { load, save } from '../../core/storage';
import { showIcons } from '../../core/icons';
import { confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import { CHECKERS, chooseTurn, isValidState, legalMoves, move, newGame, newRound, roll, undoTurn, type From, type Level, type Move, type State } from './logic';
import './style.css';

const STATE_KEY = 'backgammon:state';
/** Pause between the computer's roll and each of its moves. */
export const AI_DELAY = 700;
const SHOWN = 5; // checkers drawn on a point before the rest become a number

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};
const die = (n: number, used: boolean) =>
  `<svg class="bg-die${used ? ' used' : ''}" viewBox="0 0 24 24" role="img" aria-label="${n}${used ? ', used' : ''}"><rect x="1" y="1" width="22" height="22" rx="4"/>${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3"/>`).join('')}</svg>`;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let selected: From | null = null;
  let timer: number | undefined;
  /** "You rolled 6 and 6 but can't move", kept while the computer plays. */
  let note = '';

  container.innerHTML = `
    <div class="screen bg">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame bg-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="bg-dice" data-dice></div>
        <button class="btn" data-roll>Roll</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const diceEl = container.querySelector<HTMLElement>('[data-dice]')!;
  const rollBtn = container.querySelector<HTMLButtonElement>('[data-roll]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    selected = null;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.result === null && state.turn === 1) timer = window.setTimeout(computerStep, AI_DELAY);
  }

  /** The computer rolls, then plays its moves one at a time so you can follow them. */
  function computerStep() {
    if (!state.dice.length) {
      const next = roll(state);
      if (next?.turn === 0) note = '';
      return update(next);
    }
    const [first] = chooseTurn(state);
    update(move(state, first));
  }

  const mineNow = () => (state.result === null && state.turn === 0 ? legalMoves(state) : []);

  function checkers(n: number, top: boolean): string {
    const count = Math.abs(n);
    const cls = n > 0 ? 'p0' : 'p1';
    const shown = Math.min(count, SHOWN);
    const stack = Array.from({ length: shown }, (_, k) => `<span class="bg-ck ${cls}">${k === shown - 1 && count > SHOWN ? count : ''}</span>`);
    return `<span class="bg-stack${top ? ' top' : ''}">${stack.join('')}</span>`;
  }

  function cell(id: From | 'off', content: string, cls: string, label: string, moves: Move[]): string {
    const isSource = moves.some((m) => m.from === id);
    const isTarget = selected !== null && moves.some((m) => m.from === selected && m.to === id);
    const classes = [cls, isSource ? 'source' : '', isTarget ? 'target' : '', selected === id ? 'selected' : ''].filter(Boolean).join(' ');
    const tappable = isSource || isTarget;
    return `<div class="${classes}" data-pt="${id}" role="button" aria-label="${label}" ${tappable ? 'tabindex="0"' : 'aria-disabled="true"'}>${content}</div>`;
  }

  function render() {
    const moves = mineNow();
    const point = (i: number, top: boolean) => {
      const n = state.points[i];
      const who = n > 0 ? 'yours' : 'the computer’s';
      const label = `Point ${i + 1}: ${n ? `${Math.abs(n)} ${who}` : 'empty'}`;
      return cell(i, checkers(n, top), `bg-pt ${top ? 'top' : 'bottom'} ${i % 2 ? 'a' : 'b'}`, label, moves);
    };
    const bar = (side: 0 | 1) => {
      const n = state.bar[side];
      const label = `${side === 0 ? 'Your' : 'Computer’s'} checkers on the bar: ${n}`;
      return side === 0 ? cell('bar', checkers(n, false), 'bg-bar bottom', label, moves) : `<div class="bg-bar top" role="img" aria-label="${label}">${checkers(-n, true)}</div>`;
    };
    const off = (side: 0 | 1) => {
      const label = `${side === 0 ? 'Yours' : 'Computer’s'} borne off: ${state.off[side]} of ${CHECKERS}`;
      const content = `<b>${state.off[side]}</b>`;
      return side === 0 ? cell('off', content, 'bg-off bottom', label, moves) : `<div class="bg-off top" role="img" aria-label="${label}">${content}</div>`;
    };
    const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, k) => (a < b ? a + k : a - k));
    boardEl.innerHTML =
      range(12, 17).map((i) => point(i, true)).join('') + bar(1) + range(18, 23).map((i) => point(i, true)).join('') + off(1) +
      range(11, 6).map((i) => point(i, false)).join('') + bar(0) + range(5, 0).map((i) => point(i, false)).join('') + off(0);

    const remaining = [...state.dice];
    const shownDice = state.lastRoll.length ? (state.lastRoll[0] === state.lastRoll[1] ? Array(4).fill(state.lastRoll[0]) : state.lastRoll) : [];
    diceEl.innerHTML = shownDice
      .map((d) => {
        const k = remaining.indexOf(d);
        if (k >= 0) remaining.splice(k, 1);
        return die(d, k < 0);
      })
      .join('');
    rollBtn.disabled = !(state.result === null && state.turn === 0 && !state.dice.length);
    undoBtn.disabled = state.turn !== 0 || !undoTurn(state);
    container.querySelector('[data-you]')!.textContent = String(state.tally.you);
    container.querySelector('[data-computer]')!.textContent = String(state.tally.computer);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    statusEl.textContent = statusText();
    showIcons(statusEl);
  }

  function statusText(): string {
    const rolled = state.lastRoll.length ? `${state.lastRoll[0]} and ${state.lastRoll[1]}` : '';
    if (state.result !== null) {
      const who = state.result === 0 ? 'You win' : 'The computer wins';
      return `${who}${state.gammon ? ' a gammon, worth 2' : ''}! Tap {new} for another game.`;
    }
    if (state.turn === 1) return note + (state.dice.length ? `The computer rolled ${rolled}…` : 'The computer is rolling…');
    if (!state.dice.length) return state.lastRoll.length ? 'Your turn: tap Roll.' : 'Your turn: tap Roll. You move counter-clockwise, toward your home at the bottom right.';
    if (state.bar[0]) return `You rolled ${rolled}. Bring your checker in from the bar first: tap it.`;
    return selected === null ? `You rolled ${rolled}. Tap a checker to move.` : 'Tap a marked point to move there, or another checker.';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-pt]');
    if (!el || state.turn !== 0) return;
    const raw = el.dataset.pt!;
    const id: From | 'off' = raw === 'bar' || raw === 'off' ? raw : Number(raw);
    const moves = mineNow();
    const chosen = moves.filter((m) => m.from === selected && m.to === id).sort((a, b) => a.die - b.die)[0];
    if (chosen) return update(move(state, chosen));
    if (id !== 'off' && moves.some((m) => m.from === id)) selected = selected === id ? null : id;
    else selected = null;
    render();
  });
  rollBtn.addEventListener('click', () => {
    const next = roll(state);
    note = next && next.turn === 1 ? `You rolled ${next.lastRoll[0]} and ${next.lastRoll[1]} but can’t move. ` : '';
    update(next);
  });
  undoBtn.addEventListener('click', () => update(undoTurn(state)));
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.result === null && (state.lastRoll.length > 0 || state.turn === 1);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newRound(state))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
