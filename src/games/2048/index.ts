import { load, save } from '../../core/storage';
import { onArrowKeys, onSwipe, type Direction } from '../../core/input';
import './style.css';

const SIZE = 4;
const STATE_KEY = '2048:state';
const BEST_KEY = '2048:best';
const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

interface State {
  board: number[]; // SIZE*SIZE cells, row-major, 0 = empty
  score: number;
  over: boolean;
  won: boolean;
  keepPlaying: boolean;
}

function newState(): State {
  const board = Array<number>(SIZE * SIZE).fill(0);
  addRandomTile(board);
  addRandomTile(board);
  return { board, score: 0, over: false, won: false, keepPlaying: false };
}

/** Places a 2 (90%) or 4 in a random empty cell. Returns its index, or -1 if full. */
function addRandomTile(board: number[]): number {
  const empty = board.flatMap((v, i) => (v === 0 ? [i] : []));
  if (empty.length === 0) return -1;
  const i = empty[Math.floor(Math.random() * empty.length)];
  board[i] = Math.random() < 0.9 ? 2 : 4;
  return i;
}

/** Cell indices for each row/column, ordered so tiles slide toward index 0. */
function lines(dir: Direction): number[][] {
  const result: number[][] = [];
  for (let a = 0; a < SIZE; a++) {
    const line: number[] = [];
    for (let b = 0; b < SIZE; b++) {
      const r = SIZE - 1 - b;
      switch (dir) {
        case 'left': line.push(a * SIZE + b); break;
        case 'right': line.push(a * SIZE + r); break;
        case 'up': line.push(b * SIZE + a); break;
        case 'down': line.push(r * SIZE + a); break;
      }
    }
    result.push(line);
  }
  return result;
}

interface MoveResult {
  board: number[];
  gained: number;
  merged: Set<number>;
  moved: boolean;
}

function move(board: number[], dir: Direction): MoveResult {
  const next = board.slice();
  const merged = new Set<number>();
  let gained = 0;

  for (const line of lines(dir)) {
    const values = line.map((i) => board[i]).filter((v) => v !== 0);
    let out = 0;
    for (let k = 0; k < values.length; k++) {
      let v = values[k];
      const idx = line[out];
      if (values[k + 1] === v) {
        v *= 2;
        gained += v;
        merged.add(idx);
        k++;
      }
      next[idx] = v;
      out++;
    }
    for (; out < SIZE; out++) next[line[out]] = 0;
  }

  return { board: next, gained, merged, moved: next.some((v, i) => v !== board[i]) };
}

function canMove(board: number[]): boolean {
  return DIRECTIONS.some((d) => move(board, d).moved);
}

function isValidState(s: State | null): s is State {
  return !!s && Array.isArray(s.board) && s.board.length === SIZE * SIZE;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<State | null>(STATE_KEY, null);
  let state = isValidState(saved) ? saved : newState();
  let best = load(BEST_KEY, 0);

  container.innerHTML = `
    <div class="g2048">
      <div class="g2048-bar">
        <div class="g2048-score"><small>Score</small><b data-score></b></div>
        <div class="g2048-score"><small>Best</small><b data-best></b></div>
        <button class="btn" data-new>New</button>
      </div>
      <div class="g2048-board" data-board></div>
      <p class="g2048-hint">Swipe to move. Merge matching tiles to reach 2048.</p>
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

  const overlay = document.createElement('div');
  overlay.className = 'g2048-overlay';
  boardEl.append(overlay);

  function showOverlay(message: string, actions: [string, () => void][]) {
    overlay.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = message;
    overlay.append(title);
    actions.forEach(([label, action], i) => {
      const btn = document.createElement('button');
      btn.className = i === 0 ? 'btn' : 'btn secondary';
      btn.textContent = label;
      btn.addEventListener('click', action);
      overlay.append(btn);
    });
    overlay.hidden = false;
  }

  function render(fresh = -1, merged = new Set<number>()) {
    state.board.forEach((v, i) => {
      const cell = cells[i];
      let cls = 'g2048-cell';
      if (v) cls += ` t-${v > 2048 ? 'big' : v}`;
      if (i === fresh) cls += ' new';
      if (merged.has(i)) cls += ' merged';
      cell.className = cls;
      cell.dataset.digits = v ? String(String(v).length) : '';
      cell.textContent = v ? String(v) : '';
    });
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(best);

    if (state.over) {
      showOverlay('Game over', [['Try again', restart]]);
    } else if (state.won && !state.keepPlaying) {
      showOverlay('You win!', [
        ['Keep going', () => update({ ...state, keepPlaying: true })],
        ['New game', restart],
      ]);
    } else {
      overlay.hidden = true;
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
    if (state.over || (state.won && !state.keepPlaying)) return;
    const result = move(state.board, dir);
    if (!result.moved) return;
    const fresh = addRandomTile(result.board);
    update(
      {
        ...state,
        board: result.board,
        score: state.score + result.gained,
        won: state.won || result.board.includes(2048),
        over: !canMove(result.board),
      },
      fresh,
      result.merged,
    );
  }

  container.querySelector('[data-new]')!.addEventListener('click', restart);
  const stopSwipe = onSwipe(root, handle);
  const stopKeys = onArrowKeys(handle);
  render();

  return () => {
    stopSwipe();
    stopKeys();
    container.replaceChildren();
  };
}
