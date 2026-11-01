import { load, save } from '../../core/storage';
import {
  LEVELS,
  countAt,
  flagsLeft,
  isFinished,
  isValidState,
  newState,
  open,
  toggleFlag,
  type Level,
  type State,
} from './logic';
import * as sym from './symbols';
import './style.css';

const STATE_KEY = 'minesweeper:state';
const BEST_KEY = 'minesweeper:best:v3'; // bumped when levels are resized, old times don't compare
export const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE = 10;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState('easy');
  const best = load<Partial<Record<Level, number>>>(BEST_KEY, {});
  let flagMode = false;

  container.innerHTML = `
    <div class="screen ms">
      <div class="stats">
        <div class="stat"><small>Mines</small><b data-mines></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Time</small><b data-time></b></div>
      </div>
      <div class="board-frame ms-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented">
          ${Object.entries(LEVELS)
            .map(([id, l]) => `<button data-level="${id}">${l.label}</button>`)
            .join('')}
        </div>
        <button class="btn secondary ms-mode" data-mode></button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const minesEl = container.querySelector<HTMLElement>('[data-mines]')!;
  const timeEl = container.querySelector<HTMLElement>('[data-time]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const modeBtn = container.querySelector<HTMLButtonElement>('[data-mode]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  let cells: HTMLElement[] = [];

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

  // --- Actions ---

  /** Runs a logic action, then keeps the clock, best time, storage and screen in sync. */
  function act(action: () => void) {
    const wasFinished = isFinished(state);
    action();
    if (state.status === 'playing') startClock();
    if (isFinished(state) && !wasFinished) {
      stopClock();
      if (state.status === 'won') recordBest();
    }
    commit();
  }

  function recordBest() {
    const seconds = Math.floor(state.elapsed / 1000);
    const prev = best[state.level];
    if (prev === undefined || seconds < prev) {
      best[state.level] = seconds;
      save(BEST_KEY, best);
    }
  }

  function flag(i: number) {
    act(() => {
      if (toggleFlag(state, i)) navigator.vibrate?.(15);
    });
  }

  function tap(i: number) {
    if (flagMode && !state.revealed[i]) flag(i);
    else act(() => open(state, i));
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
    const { cols, rows } = LEVELS[state.level];
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
      let symbol = '';
      delete cell.dataset.n;
      if (state.revealed[i] && !isMine) {
        cls += ' revealed';
        const n = countAt(state, i);
        if (n) {
          text = String(n);
          cell.dataset.n = text;
        }
      } else if (lost && isMine && !state.flagged[i]) {
        cls += i === state.exploded ? ' revealed exploded' : ' revealed';
        symbol = sym.mine;
      } else if (state.flagged[i]) {
        const wrong = lost && !isMine;
        if (wrong) cls += ' wrong';
        symbol = wrong ? sym.wrongFlag : sym.flag;
      }
      cell.className = cls;
      if (symbol) cell.innerHTML = symbol;
      else cell.textContent = text;
    });

    minesEl.textContent = String(flagsLeft(state));
    renderClock();

    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    modeBtn.textContent = flagMode ? 'Flag' : 'Dig';
    modeBtn.setAttribute('aria-pressed', String(flagMode));

    const bestTime = best[state.level];
    const bestText = bestTime !== undefined ? ` Best: ${bestTime}s.` : '';
    statusEl.textContent =
      state.status === 'won'
        ? `Cleared in ${Math.floor(state.elapsed / 1000)}s!${bestText}`
        : lost
          ? 'Boom! Tap New to try again.'
          : `Tap to dig. Long-press to flag.${bestText}`;
  }

  // --- Input: tap to dig, long-press (or right-click) to flag ---

  let press: { i: number; x: number; y: number; timer: number; fired: boolean } | null = null;

  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  function cellIndex(target: EventTarget | null): number {
    const cell = (target as Element).closest<HTMLElement>('[data-i]');
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
        press!.fired = true;
        flag(press!.i);
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
    if (i >= 0) flag(i);
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
