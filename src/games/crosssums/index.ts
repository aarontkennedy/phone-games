import { ERASE_ICON } from '../../core/icons';
import { load, save } from '../../core/storage';
import { confirmNew, hideOverlay, showOverlay } from '../../core/ui';
import { SIZE, hint, isValidState, isWon, left, newPuzzle, repeats, runs, select, write, type State } from './logic';
import './style.css';

const STATE_KEY = 'crosssums:state';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newPuzzle();

  container.innerHTML = `
    <div class="screen cs-sums">
      <div class="stats">
        <div class="stat"><small>Left</small><b data-left></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Solved</small><b data-solved></b></div>
      </div>
      <div class="board-frame xs-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="xs-pad" aria-label="Numbers" data-pad>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="btn secondary" data-num="${n}">${n}</button>`).join('')}
          <button class="btn secondary xs-erase" data-num="0" aria-label="Erase">${ERASE_ICON}</button>
          <button class="btn secondary xs-hint" data-hint>Hint</button>
        </div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const padEl = container.querySelector<HTMLElement>('[data-pad]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
  }

  function render() {
    const clues = new Map<number, { across?: number; down?: number }>();
    for (const r of runs(state)) clues.set(r.clue, { ...clues.get(r.clue), [r.down ? 'down' : 'across']: r.sum });
    const wrong = repeats(state);
    const cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
      if (state.white[i]) {
        const d = state.grid[i];
        const cls = ['xs-cell', state.selected === i ? 'picked' : '', wrong.has(i) ? 'wrong' : '', state.hinted[i] ? 'given' : ''].filter(Boolean).join(' ');
        const r = Math.floor(i / SIZE);
        const c = i % SIZE;
        return `<button class="${cls}" data-cell="${i}" aria-label="Row ${r}, column ${c}: ${d || 'empty'}${wrong.has(i) ? ', repeats in its run' : ''}" aria-pressed="${state.selected === i}">${d || ''}</button>`;
      }
      const clue = clues.get(i);
      if (!clue) return '<span class="xs-black"></span>';
      const label = [clue.across ? `across ${clue.across}` : '', clue.down ? `down ${clue.down}` : ''].filter(Boolean).join(', ');
      return `<span class="xs-clue" role="img" aria-label="Clue: ${label}">
        <svg viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L10 10"/></svg>
        <b class="xs-across">${clue.across ?? ''}</b><b class="xs-down">${clue.down ?? ''}</b></span>`;
    }).join('');
    boardEl.innerHTML = `<div class="xs-grid">${cells}</div>`;
    container.querySelector('[data-left]')!.textContent = String(left(state));
    container.querySelector('[data-solved]')!.textContent = String(state.solved);
    padEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = isWon(state)));
    statusEl.textContent = statusText(wrong.size > 0);
    if (isWon(state)) showOverlay(boardEl, 'Solved!', [['New puzzle', () => update(newPuzzle(state.solved))]]);
    else hideOverlay(boardEl);
  }

  function statusText(repeated: boolean): string {
    if (isWon(state)) return 'Every run adds up. Solved!';
    if (repeated) return 'A digit repeats in a run (shown in red). Each run uses a digit only once.';
    if (!left(state)) return 'Every square is filled, but some don’t add up. Tap Hint to fix one.';
    if (state.selected === null) return 'Tap a white square, then a number. Each clue is the total of the squares to its right (top number) or below it (bottom number).';
    return 'Now tap a number, or erase.';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-cell]');
    if (el) update(select(state, Number(el.dataset.cell)));
  });
  padEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) update(hint(state));
    else update(write(state, Number(el.dataset.num)));
  });
  // A puzzle partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.grid.some(Boolean) && !isWon(state);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newPuzzle(state.solved))));

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
