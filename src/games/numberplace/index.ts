import { load, save } from '../../core/storage';
import { formatTime } from '../../core/time';
import { showOverlay, hideOverlay, confirmNew } from '../../core/ui';
import { LEVELS, clashes, enter, hintSquare, isValidState, newGame, shown, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'numberplace:state';
const BEST_KEY = 'numberplace:best';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  const best = load<Partial<Record<Level, number>>>(BEST_KEY, {});
  let selected = -1;
  /** Says what Hint just filled in, until the next tap. */
  let note = '';

  container.innerHTML = `
    <div class="screen np">
      <div class="stats">
        <div class="stat"><small>Left</small><b data-left></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Time</small><b data-time></b></div>
      </div>
      <div class="board-frame np-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Difficulty">
          ${Object.entries(LEVELS).map(([id, l]) => `<button data-level="${id}">${l.label}</button>`).join('')}
        </div>
        <div class="np-pad" aria-label="Numbers">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="btn secondary" data-num="${n}">${n}</button>`).join('')}
          <button class="btn secondary np-erase" data-num="0" aria-label="Erase"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg></button>
          <button class="btn secondary np-hint" data-hint>Hint</button>
        </div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const timeEl = container.querySelector<HTMLElement>('[data-time]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const padBtns = container.querySelectorAll<HTMLButtonElement>('[data-num]');

  // --- Clock: counts while an unsolved puzzle is on screen ---
  let clockStart = 0;
  let timer: number | undefined;
  const playTime = () => state.elapsed + (timer !== undefined ? Date.now() - clockStart : 0);
  function startClock() {
    if (timer !== undefined || state.won || document.hidden) return;
    clockStart = Date.now();
    timer = window.setInterval(() => (timeEl.textContent = formatTime(playTime())), 1000);
  }
  function stopClock() {
    if (timer === undefined) return;
    state.elapsed += Date.now() - clockStart;
    clearInterval(timer);
    timer = undefined;
  }
  const persist = () => save(STATE_KEY, { ...state, elapsed: playTime() });

  function update(next: State | null) {
    if (!next) return;
    stopClock(); // banks the time so far into state.elapsed
    state = { ...next, elapsed: state.elapsed };
    if (state.won) {
      const seconds = Math.floor(state.elapsed / 1000);
      const prev = best[state.level];
      if (prev === undefined || seconds < prev) {
        best[state.level] = seconds;
        save(BEST_KEY, best);
      }
    } else startClock();
    persist();
    render();
  }

  function render() {
    const grid = shown(state);
    const bad = clashes(state);
    const value = selected >= 0 ? grid[selected] : 0;
    boardEl.innerHTML = grid
      .map((n, i) => {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const given = state.puzzle[i] > 0;
        const cls = [
          'np-cell',
          given ? 'given' : 'mine',
          bad.has(i) ? 'clash' : '',
          i === selected ? 'selected' : '',
          value && n === value && i !== selected ? 'same' : '',
          c % 3 === 2 && c < 8 ? 'edge-r' : '',
          r % 3 === 2 && r < 8 ? 'edge-b' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const label = `Row ${r + 1}, column ${c + 1}: ${n || 'empty'}${given ? ', given' : ''}${bad.has(i) ? ', clashes' : ''}`;
        // Grid squares, like Mines: 26px minimum rather than the 44px button rule (docs/DESIGN.md).
        return `<div class="${cls}" data-cell="${i}" role="button" tabindex="0" aria-label="${label}"${state.won ? ' aria-disabled="true"' : ''}>${n || ''}</div>`;
      })
      .join('');
    container.querySelector('[data-left]')!.textContent = String(grid.filter((n) => !n).length);
    timeEl.textContent = formatTime(playTime());
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const canEnter = selected >= 0 && !state.puzzle[selected] && !state.won;
    padBtns.forEach((b) => (b.disabled = !canEnter));
    const bestTime = best[state.level];
    const bestText = bestTime !== undefined ? ` Best: ${formatTime(bestTime * 1000)}.` : '';
    statusEl.textContent = state.won
      ? `Solved in ${formatTime(state.elapsed)}!${bestText}`
      : note ||
        (bad.size
        ? 'Some numbers clash: they’re marked in red and underlined.'
        : selected < 0
          ? `Tap an empty square, then a number.${bestText}`
          : state.puzzle[selected]
            ? 'That number was given. Tap an empty square.'
            : 'Tap a number to fill the square, or the erase key to clear it.');
    if (state.won) showOverlay(boardEl, 'Solved!', [['New puzzle', () => startNew(state.level)]]);
    else hideOverlay(boardEl);
  }

  function startNew(level: Level) {
    selected = -1;
    note = '';
    stopClock();
    state = newGame(level);
    startClock();
    persist();
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-cell]');
    if (!el || state.won) return;
    selected = Number(el.dataset.cell);
    note = '';
    render();
  });
  padBtns.forEach((b) =>
    b.addEventListener('click', () => {
      note = '';
      update(enter(state, selected, Number(b.dataset.num)));
    }),
  );
  container.querySelector('[data-hint]')!.addEventListener('click', () => {
    const i = hintSquare(state, selected);
    if (i < 0) return;
    selected = i;
    note = `Hint: row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1} is ${state.solution[i]}.`;
    update(enter(state, i, state.solution[i]));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.entries.some(Boolean) && !state.won;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => startNew(state.level)));
  levelBtns.forEach((b) => b.addEventListener('click', () => confirmNew(inProgress(), () => startNew(b.dataset.level as Level))));

  const onVisibility = () => {
    if (document.hidden) {
      stopClock();
      persist();
    } else startClock();
  };
  document.addEventListener('visibilitychange', onVisibility);

  render();
  startClock();

  return () => {
    stopClock();
    persist();
    document.removeEventListener('visibilitychange', onVisibility);
    container.replaceChildren();
  };
}
