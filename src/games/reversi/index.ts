import { load, save } from '../../core/storage';
import { confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import { chooseMove, count, isValidState, legalMoves, move, newGame, newRound, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'reversi:state';
/** Pause before the computer moves. */
export const AI_DELAY = 600;

const where = (i: number) => `row ${Math.floor(i / 8) + 1}, column ${(i % 8) + 1}`;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen rv">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame rv-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.result === null && state.turn === 1) {
      timer = window.setTimeout(() => update(move(state, chooseMove(state))), AI_DELAY);
    }
  }

  function render() {
    const mine = new Set(state.result === null && state.turn === 0 ? legalMoves(state.board, 0) : []);
    boardEl.innerHTML = state.board
      .map((c, i) => {
        const cls = ['rv-sq', mine.has(i) ? 'target' : '', i === state.last ? 'last' : ''].filter(Boolean).join(' ');
        const disc = c === null ? '' : `<span class="rv-disc p${c}"></span>`;
        const label = c === 0 ? 'Your disc' : c === 1 ? 'Computer’s disc' : mine.has(i) ? 'You can play here' : 'Empty';
        return `<button class="${cls}" data-sq="${i}" aria-label="${label}, ${where(i)}"${mine.has(i) ? '' : ' disabled'}>${disc}</button>`;
      })
      .join('');
    container.querySelector('[data-you]')!.textContent = String(count(state.board, 0));
    container.querySelector('[data-computer]')!.textContent = String(count(state.board, 1));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    const rounds = `Rounds won: you ${state.tally.you}, computer ${state.tally.computer}.`;
    if (state.result === 0) return `You win! ${rounds} Tap New for another round.`;
    if (state.result === 1) return `The computer wins. ${rounds} Tap New for another round.`;
    if (state.result === 'draw') return `It’s a draw. ${rounds} Tap New for another round.`;
    if (state.turn === 1) return 'The computer is thinking…';
    const pass = state.passed === 1 ? 'The computer can’t move, so it passes. ' : state.passed === 0 ? 'You can’t move, so you pass. ' : '';
    return `${pass}Your turn: tap a square with a ring to place a purple disc.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-sq]');
    if (el && state.turn === 0) update(move(state, Number(el.dataset.sq)));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.result === null && state.last !== null;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newRound(state))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
