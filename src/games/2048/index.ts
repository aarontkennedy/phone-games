import { load, save } from '../../core/storage';
import { onArrowKeys, onSwipe, type Direction } from '../../core/input';
import { showOverlay, hideOverlay, confirmNew } from '../../core/ui';
import { SIZE, WIN_TILE, applyMove, isValidState, newState, type State } from './logic';
import './style.css';

const STATE_KEY = '2048:state';
const BEST_KEY = '2048:best';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, 0), state.score);

  container.innerHTML = `
    <div class="screen g2048">
      <div class="stats">
        <div class="stat"><small>Score</small><b data-score></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
        <button class="btn" data-new>New</button>
      </div>
      <div class="board-frame g2048-board" data-board></div>
      <p class="status-line">Swipe to slide every tile. Two matching numbers join into one.</p>
    </div>`;

  const root = container.querySelector<HTMLElement>('.g2048')!;
  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const scoreEl = container.querySelector<HTMLElement>('[data-score]')!;
  const bestEl = container.querySelector<HTMLElement>('[data-best]')!;

  const cells = Array.from({ length: SIZE * SIZE }, () => {
    const cell = document.createElement('div');
    boardEl.append(cell);
    return cell;
  });

  function render(fresh = -1, merged = new Set<number>()) {
    state.board.forEach((v, i) => {
      const cell = cells[i];
      let cls = 'g2048-cell';
      if (v) cls += ` t-${v > WIN_TILE ? 'big' : v}`;
      if (i === fresh) cls += ' new';
      if (merged.has(i)) cls += ' merged';
      cell.className = cls;
      cell.dataset.digits = v ? String(String(v).length) : '';
      cell.textContent = v ? String(v) : '';
    });
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(best);

    if (state.over) {
      showOverlay(boardEl, 'Game over', [['Try again', restart]]);
    } else if (state.won && !state.keepPlaying) {
      showOverlay(boardEl, 'You win!', [
        ['Keep going', () => update({ ...state, keepPlaying: true })],
        ['New game', restart],
      ]);
    } else {
      hideOverlay(boardEl);
    }
  }

  function update(next: State, fresh = -1, merged = new Set<number>()) {
    state = next;
    if (state.score > best) {
      best = state.score;
      save(BEST_KEY, best);
    }
    save(STATE_KEY, state);
    render(fresh, merged);
  }

  function restart() {
    update(newState());
  }

  function handle(dir: Direction) {
    const turn = applyMove(state, dir);
    if (turn) update(turn.state, turn.fresh, turn.merged);
  }

  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.score > 0 && !state.over;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), restart));
  const stopSwipe = onSwipe(root, handle);
  const stopKeys = onArrowKeys(handle);
  render();

  return () => {
    stopSwipe();
    stopKeys();
    container.replaceChildren();
  };
}
