import { load, save } from '../../core/storage';
import { chooseMove, isValidState, move, newGame, newRound, type Level, type Mark, type State } from './logic';
import './style.css';

const STATE_KEY = 'tictactoe:state';
/** Pause before the computer moves. */
export const AI_DELAY = 500;

const MARKS: Record<Mark, string> = {
  X: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ttt-x" d="M5 5 19 19M19 5 5 19"/></svg>',
  O: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="ttt-o" cx="12" cy="12" r="7.5"/></svg>',
};

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen ttt">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
      </div>
      <div class="board-frame ttt-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (!state.result && state.turn === 'O') {
      timer = window.setTimeout(() => update(move(state, chooseMove(state))), AI_DELAY);
    }
  }

  function render() {
    boardEl.innerHTML = state.board
      .map((m, i) => {
        const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
        const win = state.line?.includes(i) ? ' win' : '';
        return `<button class="ttt-cell${win}" data-cell="${i}" aria-label="${where}: ${m ?? 'empty'}"${
          m || state.result || state.turn !== 'X' ? ' disabled' : ''
        }>${m ? MARKS[m] : ''}</button>`;
      })
      .join('');
    container.querySelector('[data-you]')!.textContent = String(state.tally.you);
    container.querySelector('[data-computer]')!.textContent = String(state.tally.computer);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const draws = state.tally.draws ? ` Draws so far: ${state.tally.draws}.` : '';
    statusEl.textContent =
      state.result === 'X'
        ? `You win! Tap New for another round.${draws}`
        : state.result === 'O'
          ? `The computer wins. Tap New for another round.${draws}`
          : state.result === 'draw'
            ? `It’s a draw. Tap New for another round.${draws}`
            : state.turn === 'X'
              ? 'Your turn: you’re X. Get three in a row.'
              : 'The computer is thinking…';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-cell]');
    if (el) update(move(state, Number(el.dataset.cell)));
  });
  container.querySelector('[data-new]')!.addEventListener('click', () => update(newRound(state)));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
