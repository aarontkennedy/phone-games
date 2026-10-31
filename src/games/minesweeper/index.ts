import { load, save } from '../../core/storage';
import './style.css';

type Level = 'easy' | 'medium' | 'hard';
type Status = 'ready' | 'playing' | 'won' | 'lost';

const LEVELS: Record<Level, { label: string; cols: number; rows: number; mines: number }> = {
  easy: { label: 'Easy', cols: 6, rows: 6, mines: 5 },
  medium: { label: 'Medium', cols: 9, rows: 9, mines: 10 },
  hard: { label: 'Hard', cols: 12, rows: 12, mines: 22 },
};
const STATE_KEY = 'minesweeper:state';
const BEST_KEY = 'minesweeper:best:v3'; // bumped when levels are resized, old times don't compare
const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE = 10;

interface State {
  level: Level;
  mines: boolean[] | null; // null until the first dig, so the first tap is always safe
  revealed: boolean[];
  flagged: boolean[];
  status: Status;
  elapsed: number; // ms of play time
  exploded: number; // index of the mine that ended the game, or -1
}

function newState(level: Level): State {
  const { cols, rows } = LEVELS[level];
  const n = cols * rows;
  return {
    level,
    mines: null,
    revealed: Array<boolean>(n).fill(false),
    flagged: Array<boolean>(n).fill(false),
    status: 'ready',
    elapsed: 0,
    exploded: -1,
  };
}

function isValidState(s: State | null): s is State {
  if (!s || !(s.level in LEVELS)) return false;
  const { cols, rows } = LEVELS[s.level];
  return Array.isArray(s.revealed) && s.revealed.length === cols * rows;
}

function neighbors(i: number, cols: number, rows: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

/** Places mines anywhere except the first tapped cell and its neighbors. */
function placeMines(level: Level, safe: number): boolean[] {
  const { cols, rows, mines } = LEVELS[level];
  const excluded = new Set([safe, ...neighbors(safe, cols, rows)]);
  const candidates = [...Array(cols * rows).keys()].filter((i) => !excluded.has(i));
  const result = Array<boolean>(cols * rows).fill(false);
  for (let k = 0; k < mines; k++) {
    const j = k + Math.floor(Math.random() * (candidates.length - k));
    [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
    result[candidates[k]] = true;
  }
  return result;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<State | null>(STATE_KEY, null);
  let state = isValidState(saved) ? saved : newState('easy');
  const best = load<Partial<Record<Level, number>>>(BEST_KEY, {});
  let flagMode = false;

  container.innerHTML = `
    <div class="ms">
      <div class="ms-bar">
        <div class="ms-stat"><small>Mines</small><b data-mines></b></div>
        <button class="btn" data-new>New</button>
        <div class="ms-stat"><small>Time</small><b data-time></b></div>
      </div>
      <div class="ms-controls">
        <div class="ms-levels">
          ${Object.entries(LEVELS)
            .map(([id, l]) => `<button data-level="${id}">${l.label}</button>`)
            .join('')}
        </div>
        <button class="ms-mode" data-mode></button>
      </div>
      <div class="ms-board" data-board></div>
      <p class="ms-status" data-status></p>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const minesEl = container.querySelector<HTMLElement>('[data-mines]')!;
  const timeEl = container.querySelector<HTMLElement>('[data-time]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const modeBtn = container.querySelector<HTMLButtonElement>('[data-mode]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  let cells: HTMLElement[] = [];

  const dims = () => LEVELS[state.level];
  const around = (i: number) => neighbors(i, dims().cols, dims().rows);
  const countAt = (i: number) => around(i).filter((j) => state.mines?.[j]).length;
  const finished = () => state.status === 'won' || state.status === 'lost';

  // --- Clock: only counts while the game is on screen ---
  let clockStart = 0;
  let timer: number | undefined;

  function playTime() {
    return state.elapsed + (timer !== undefined ? Date.now() - clockStart : 0);
  }
  function startClock() {
    if (timer !== undefined || state.status !== 'playing' || document.hidden) return;
    clockStart = Date.now();
    timer = window.setInterval(renderClock, 1000);
  }
  function stopClock() {
    if (timer === undefined) return;
    state.elapsed += Date.now() - clockStart;
    clearInterval(timer);
    timer = undefined;
  }
  function renderClock() {
    timeEl.textContent = String(Math.min(999, Math.floor(playTime() / 1000)));
  }

  // --- Game logic ---

  /** Reveals a cell, flood-filling through empty areas. Returns true if it was a mine. */
  function reveal(start: number): boolean {
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (state.revealed[i] || state.flagged[i]) continue;
      state.revealed[i] = true;
      if (state.mines![i]) return true;
      if (countAt(i) === 0) stack.push(...around(i));
    }
    return false;
  }

  function lose(i: number) {
    stopClock();
    state.status = 'lost';
    state.exploded = i;
  }

  function checkWin() {
    if (state.status !== 'playing') return;
    const safeCells = state.revealed.length - dims().mines;
    if (state.revealed.filter(Boolean).length < safeCells) return;
    stopClock();
    state.status = 'won';
    state.flagged = state.mines!.slice();
    const seconds = Math.floor(state.elapsed / 1000);
    if (best[state.level] === undefined || seconds < best[state.level]!) {
      best[state.level] = seconds;
      save(BEST_KEY, best);
    }
  }

  function dig(i: number) {
    if (state.flagged[i]) return;
    if (!state.mines) {
      state.mines = placeMines(state.level, i);
      state.status = 'playing';
      startClock();
    }
    if (reveal(i)) lose(i);
  }

  /** Tapping a number whose flags are all placed reveals its other neighbors. */
  function chord(i: number) {
    const n = countAt(i);
    const nb = around(i);
    if (!n || nb.filter((j) => state.flagged[j]).length !== n) return;
    for (const j of nb) {
      if (!state.revealed[j] && !state.flagged[j] && reveal(j)) {
        lose(j);
        return;
      }
    }
  }

  function toggleFlag(i: number) {
    if (finished() || state.revealed[i]) return;
    state.flagged[i] = !state.flagged[i];
    navigator.vibrate?.(15);
    commit();
  }

  function tap(i: number) {
    if (finished()) return;
    if (state.revealed[i]) chord(i);
    else if (flagMode) {
      toggleFlag(i);
      return;
    } else dig(i);
    checkWin();
    commit();
  }

  function newGame(level: Level) {
    stopClock();
    state = newState(level);
    buildBoard();
    commit();
  }

  function persist() {
    save(STATE_KEY, { ...state, elapsed: playTime() });
  }

  function commit() {
    persist();
    render();
  }

  // --- Rendering ---

  function buildBoard() {
    const { cols, rows } = dims();
    boardEl.style.setProperty('--cols', String(cols));
    cells = Array.from({ length: cols * rows }, (_, i) => {
      const cell = document.createElement('div');
      cell.dataset.i = String(i);
      return cell;
    });
    boardEl.replaceChildren(...cells);
  }

  function render() {
    const lost = state.status === 'lost';
    cells.forEach((cell, i) => {
      const isMine = !!state.mines?.[i];
      let cls = 'ms-cell';
      let text = '';
      delete cell.dataset.n;
      if (state.revealed[i] && !isMine) {
        cls += ' revealed';
        const n = countAt(i);
        if (n) {
          text = String(n);
          cell.dataset.n = text;
        }
      } else if (lost && isMine && !state.flagged[i]) {
        cls += i === state.exploded ? ' revealed exploded' : ' revealed';
        text = '💣';
      } else if (state.flagged[i]) {
        cls += lost && !isMine ? ' wrong' : '';
        text = lost && !isMine ? '❌' : '🚩';
      }
      cell.className = cls;
      cell.textContent = text;
    });

    const flags = state.flagged.filter(Boolean).length;
    minesEl.textContent = String(dims().mines - flags);
    renderClock();

    levelBtns.forEach((b) => b.classList.toggle('active', b.dataset.level === state.level));
    modeBtn.textContent = flagMode ? '🚩 Flag' : '⛏️ Dig';
    modeBtn.classList.toggle('flag', flagMode);

    const bestTime = best[state.level];
    const bestText = bestTime !== undefined ? ` Best: ${bestTime}s.` : '';
    statusEl.textContent =
      state.status === 'won'
        ? `🎉 Cleared in ${Math.floor(state.elapsed / 1000)}s!${bestText}`
        : state.status === 'lost'
          ? '💥 Boom! Tap New to try again.'
          : `Tap to dig. Long-press to flag.${bestText}`;
  }

  // --- Input: tap to dig, long-press (or right-click) to flag ---

  let press: { i: number; x: number; y: number; timer: number; fired: boolean } | null = null;

  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  function cellIndex(target: EventTarget | null): number {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
    return cell ? Number(cell.dataset.i) : -1;
  }

  boardEl.addEventListener('pointerdown', (e) => {
    const i = cellIndex(e.target);
    if (i < 0 || e.button !== 0) return;
    cancelPress();
    press = {
      i,
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: window.setTimeout(() => {
        if (!press) return;
        press.fired = true;
        toggleFlag(press.i);
      }, LONG_PRESS_MS),
    };
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
  });
  boardEl.addEventListener('pointerup', () => {
    if (!press) return;
    const { i, fired } = press;
    cancelPress();
    if (!fired) tap(i);
  });
  boardEl.addEventListener('pointercancel', cancelPress);
  boardEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (press) return; // touch long-press already handled by the timer
    const i = cellIndex(e.target);
    if (i >= 0) toggleFlag(i);
  });

  container.querySelector('[data-new]')!.addEventListener('click', () => newGame(state.level));
  levelBtns.forEach((b) => b.addEventListener('click', () => newGame(b.dataset.level as Level)));
  modeBtn.addEventListener('click', () => {
    flagMode = !flagMode;
    render();
  });

  const onVisibility = () => {
    if (document.hidden) {
      stopClock();
      persist();
    } else {
      startClock();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  buildBoard();
  render();
  startClock();

  return () => {
    cancelPress();
    stopClock();
    persist();
    document.removeEventListener('visibilitychange', onVisibility);
    container.replaceChildren();
  };
}
