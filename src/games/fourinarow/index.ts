import { load, save } from '../../core/storage';
import { COLS, ROWS, chooseColumn, drop, isValidState, landingRow, newGame, newRound, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'fourinarow:state';
/** Pause before the computer moves. */
export const AI_DELAY = 500;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen fir">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame fir-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
      </div>
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
    if (!state.result && state.turn === 1) {
      timer = window.setTimeout(() => update(drop(state, chooseColumn(state))), AI_DELAY);
    }
  }

  function render() {
    // One button per column; each holds that column's six spaces, top to bottom.
    boardEl.innerHTML = Array.from({ length: COLS }, (_, c) => {
      const full = landingRow(state.board, c) < 0;
      const spaces = Array.from({ length: ROWS }, (_, r) => {
        const i = r * COLS + c;
        const d = state.board[i];
        const cls = [d === null ? '' : `p${d}`, state.line?.includes(i) ? 'win' : '', state.last === i ? 'last' : '']
          .filter(Boolean)
          .join(' ');
        return `<span class="fir-space ${cls}"></span>`;
      }).join('');
      const disabled = full || !!state.result || state.turn !== 0;
      return `<button class="fir-col" data-col="${c}" aria-label="Column ${c + 1}${full ? ', full' : ''}"${disabled ? ' disabled' : ''}>${spaces}</button>`;
    }).join('');
    container.querySelector('[data-you]')!.textContent = String(state.tally.you);
    container.querySelector('[data-computer]')!.textContent = String(state.tally.computer);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    statusEl.textContent =
      state.result === 0
        ? 'You win! Tap New for another round.'
        : state.result === 1
          ? 'The computer wins. Tap New for another round.'
          : state.result === 'draw'
            ? 'The board is full: it’s a draw. Tap New for another round.'
            : state.turn === 0
              ? 'Your turn: tap a column to drop a purple disc.'
              : 'The computer is thinking…';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-col]');
    if (el) update(drop(state, Number(el.dataset.col)));
  });
  container.querySelector('[data-new]')!.addEventListener('click', () => update(newRound(state)));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
