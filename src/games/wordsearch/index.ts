import { load, save } from '../../core/storage';
import { confirmNew, hideOverlay, showOverlay } from '../../core/ui';
import { SIZE, foundCells, hint, isValidState, isWon, newPuzzle, tap, type Placed, type State } from './logic';
import './style.css';

const STATE_KEY = 'wordsearch:state';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newPuzzle();
  let message = '';
  /** The word Hint pointed to, until your next find. */
  let tip: Placed | null = null;

  container.innerHTML = `
    <div class="screen ws">
      <div class="stats">
        <div class="stat"><small>Found</small><b data-found></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Solved</small><b data-solved></b></div>
      </div>
      <div class="board-frame ws-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <button class="btn secondary" data-hint>Hint</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const hintBtn = container.querySelector<HTMLButtonElement>('[data-hint]')!;

  function update(next: State | null) {
    if (!next) return;
    const before = state.found.length;
    state = next;
    if (state.found.length > before) {
      message = `Found ${state.found.at(-1)}!`;
      tip = null;
    } else message = '';
    save(STATE_KEY, state);
    render();
  }

  function render() {
    const found = foundCells(state);
    const cells = state.grid
      .map((ch, i) => {
        const cls = ['ws-cell', found.has(i) ? 'found' : '', state.start === i ? 'picked' : '', tip?.cells[0] === i ? 'hint' : ''].filter(Boolean).join(' ');
        const row = Math.floor(i / SIZE) + 1;
        const col = (i % SIZE) + 1;
        // Grid squares, like Mines: 26px or more is enough for a square (docs/DESIGN.md, "Touch").
        return `<div class="${cls}" data-cell="${i}" role="gridcell" aria-label="${ch}, row ${row}, column ${col}${found.has(i) ? ', in a found word' : ''}" aria-selected="${state.start === i}">${ch}</div>`;
      })
      .join('');
    const words = [...state.words]
      .sort((a, b) => a.word.localeCompare(b.word))
      .map((w) => `<li class="${state.found.includes(w.word) ? 'found' : ''}">${w.word}</li>`)
      .join('');
    boardEl.innerHTML = `<div class="ws-grid" role="grid" aria-label="Letters">${cells}</div><ul class="ws-words" aria-label="${state.theme}: words to find"><li class="ws-theme">${state.theme}:</li>${words}</ul>`;
    container.querySelector('[data-found]')!.textContent = `${state.found.length}/${state.words.length}`;
    container.querySelector('[data-solved]')!.textContent = String(state.solved);
    hintBtn.disabled = isWon(state);
    statusEl.textContent = isWon(state)
      ? `You found all ${state.words.length} words!`
      : message ||
        (tip
          ? `Hint: ${tip.word} starts at the outlined letter.`
          : state.start !== null
            ? 'Now tap the last letter of the word.'
            : 'Find each word: tap its first letter, then its last. Words read across, down or diagonally.');
    if (isWon(state)) showOverlay(boardEl, 'All found!', [['New puzzle', () => update(newPuzzle(state.solved))]]);
    else hideOverlay(boardEl);
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-cell]');
    if (el) update(tap(state, Number(el.dataset.cell)));
  });
  hintBtn.addEventListener('click', () => {
    tip = hint(state);
    message = '';
    render();
  });
  // A puzzle partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.found.length > 0 && !isWon(state);
  container.querySelector('[data-new]')!.addEventListener('click', () =>
    confirmNew(inProgress(), () => {
      tip = null;
      update(newPuzzle(state.solved));
    }),
  );

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
