import { load, save } from '../../core/storage';
import { confirmNew, hideOverlay, showOverlay } from '../../core/ui';
import { CENTER, HOLES, SIDE, hint, isOver, isValidState, isWon, jumpsFrom, newGame, pegsLeft, tap, type State } from './logic';
import './style.css';

const STATE_KEY = 'pegs:state';
const BEST_KEY = 'pegs:best';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** The fewest pegs ever left at the end of a game, or null. */
  let best = load<number | null>(BEST_KEY, null);
  let history: State[] = [];
  let message = '';
  /** Hint's jump, outlined until your next move. */
  let tip: readonly [number, number, number] | null = null;

  container.innerHTML = `
    <div class="screen pg">
      <div class="stats">
        <div class="stat"><small>Pegs</small><b data-pegs></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame pg-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;
  const hintBtn = container.querySelector<HTMLButtonElement>('[data-hint]')!;

  function update(next: State | null) {
    if (!next) {
      message = 'That peg has no jump. Pick a peg next to another, with an empty hole beyond.';
      return render();
    }
    if (next.moves > state.moves) history = [...history.slice(-99), state];
    state = next;
    tip = null;
    message = '';
    if (isOver(state) && (best === null || pegsLeft(state) < best)) save(BEST_KEY, (best = pegsLeft(state)));
    save(STATE_KEY, state);
    render();
  }

  function render() {
    const targets = state.picked === null ? [] : jumpsFrom(state, state.picked).map(([, , t]) => t);
    const cells = Array.from({ length: SIDE * SIDE }, (_, i) => {
      if (!HOLES.includes(i)) return '<span class="pg-off"></span>';
      const peg = state.pegs[i];
      const cls = [
        'pg-hole',
        peg ? 'peg' : '',
        state.picked === i ? 'picked' : '',
        targets.includes(i) ? 'target' : '',
        tip && (tip[0] === i || tip[2] === i) ? 'hint' : '',
        i === CENTER ? 'center' : '',
      ].filter(Boolean).join(' ');
      const r = Math.floor(i / SIDE) + 1;
      const c = (i % SIDE) + 1;
      return `<button class="${cls}" data-cell="${i}" aria-label="${peg ? 'Peg' : 'Empty hole'}, row ${r}, column ${c}${state.picked === i ? ', picked up' : ''}" aria-pressed="${state.picked === i}"></button>`;
    }).join('');
    boardEl.innerHTML = `<div class="pg-grid">${cells}</div>`;
    container.querySelector('[data-pegs]')!.textContent = String(pegsLeft(state));
    container.querySelector('[data-best]')!.textContent = best === null ? '–' : String(best);
    undoBtn.disabled = !history.length;
    hintBtn.disabled = isOver(state);
    statusEl.textContent = statusText();
    if (isOver(state)) {
      const title = isWon(state) ? (state.pegs[CENTER] ? 'Perfect!' : 'One peg left!') : `${pegsLeft(state)} pegs left`;
      showOverlay(boardEl, title, [['New game', startNew]]);
    } else hideOverlay(boardEl);
  }

  function statusText(): string {
    if (isWon(state)) return state.pegs[CENTER] ? 'One peg, right in the center: a perfect game!' : 'One peg left: you win! Ending in the center is perfect.';
    if (isOver(state)) return `No jumps left, with ${pegsLeft(state)} pegs. Tap Undo to try another way.`;
    if (message) return message;
    if (tip) return 'Hint: jump the outlined peg into the outlined hole. From there you can still get down to one peg.';
    if (state.picked !== null) return 'Now tap the empty hole to jump to.';
    return 'Tap a peg, then the empty hole two away, to jump over the peg between. Leave one peg to win.';
  }

  function startNew() {
    history = [];
    tip = null;
    message = '';
    state = newGame();
    save(STATE_KEY, state);
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-cell]');
    if (!el) return;
    const cell = Number(el.dataset.cell);
    // Tapping another peg while one is picked picks that one instead.
    const next = tap(state.picked !== null && state.pegs[cell] && cell !== state.picked ? { ...state, picked: null } : state, cell);
    if (next && next.moves === state.moves) {
      state = next;
      message = '';
      save(STATE_KEY, state);
      return render();
    }
    update(next);
  });
  undoBtn.addEventListener('click', () => {
    state = history.pop()!;
    tip = null;
    message = '';
    save(STATE_KEY, state);
    render();
  });
  hintBtn.addEventListener('click', () => {
    const result = hint(state);
    tip = typeof result === 'string' ? null : result;
    message =
      result === 'none'
        ? 'There’s no way to get down to one peg from here. Tap Undo to try another way.'
        : result === 'unknown'
          ? 'Hint can’t tell from here whether one peg is still possible: too many ways to try. Tap Undo a few times, or play on.'
          : '';
    render();
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(state.moves > 0 && !isOver(state), startNew));

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
