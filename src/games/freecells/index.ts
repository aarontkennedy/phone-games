import { cardFace, cardSlot, suitSvg } from '../../core/card-view';
import { SUITS, cardName, suitName } from '../../core/cards';
import { load, save } from '../../core/storage';
import { formatTime } from '../../core/time';
import { showOverlay, hideOverlay, confirmNew } from '../../core/ui';
import { bestTarget, cardsAt, findHint, isStuck, isValidState, move, newGame, type Source, type State } from './logic';
import './style.css';

const STATE_KEY = 'freecells:state';
const BEST_KEY = 'freecells:best';
/** Smallest gap between cards in a column: enough to read the rank. */
const MIN_PEEK_PX = 24;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let best = load<number | null>(BEST_KEY, null);
  let history: State[] = [];
  let message = '';
  /** The move suggested by Hint, outlined until the next move. */
  let hint: ReturnType<typeof findHint> = null;

  container.innerHTML = `
    <div class="screen cards fc">
      <div class="stats">
        <div class="stat"><small>Moves</small><b data-moves></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Time</small><b data-time></b></div>
      </div>
      <div class="board-frame fc-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const timeEl = container.querySelector<HTMLElement>('[data-time]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;

  // --- Clock: starts on the first move, counts only while on screen ---
  let clockStart = 0;
  let timer: number | undefined;
  const playTime = () => state.elapsed + (timer !== undefined ? Date.now() - clockStart : 0);
  function startClock() {
    if (timer !== undefined || !state.moves || state.won || document.hidden) return;
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

  function commit(next: State | null, fail = '') {
    message = next ? '' : fail;
    hint = null;
    if (next) {
      stopClock();
      history = [...history.slice(-199), state];
      state = { ...next, elapsed: state.elapsed };
      if (state.won) {
        const seconds = Math.floor(state.elapsed / 1000);
        if (best === null || seconds < best) save(BEST_KEY, (best = seconds));
      } else startClock();
      persist();
    }
    render();
  }

  function render() {
    const cells = state.cells
      .map((c, i) => (c ? cardFace(c, { button: true, attrs: `data-src="cell:${i}"` }) : cardSlot({ label: 'Empty free cell' })))
      .join('');
    const foundations = state.foundations
      .map((f, i) => (f.length ? cardFace(f.at(-1)!) : cardSlot({ label: `Empty ${suitName(SUITS[i])} pile` }, suitSvg(SUITS[i]))))
      .join('');
    const columns = state.columns
      .map((col, c) => `<div class="fc-col" data-col="${c}">${col.length ? col.map((card, i) => cardFace(card, { button: true, attrs: `data-src="col:${c}:${i}"` })).join('') : cardSlot()}</div>`)
      .join('');
    boardEl.innerHTML = `<div class="fc-top">${cells}${foundations}</div><div class="fc-cols">${columns}</div>`;
    container.querySelector('[data-moves]')!.textContent = String(state.moves);
    timeEl.textContent = formatTime(playTime());
    undoBtn.disabled = !history.length;
    const bestText = best !== null ? ` Best: ${formatTime(best * 1000)}.` : '';
    statusEl.textContent = state.won
      ? `You won in ${formatTime(state.elapsed)} with ${state.moves} move${state.moves === 1 ? '' : 's'}!${bestText}`
      : message ||
        (isStuck(state)
          ? 'No moves left. Tap Undo to try another way, or New for a new deal.'
          : `Tap a card to move it. The four spaces on the left hold one card each.${bestText}`);
    if (hint) {
      const src = hint.src;
      boardEl.querySelector(src.from === 'cell' ? `[data-src="cell:${src.i}"]` : `[data-src="col:${src.col}:${src.index}"]`)?.classList.add('hint');
    }
    if (state.won) showOverlay(boardEl, 'You win!', [['New game', startNew]]);
    else hideOverlay(boardEl);
    fitColumns();
  }

  /** Squeezes long columns so the board fits the screen, never hiding a rank. */
  function fitColumns() {
    const cols = boardEl.querySelector<HTMLElement>('.fc-cols')!;
    const top = cols.getBoundingClientRect().top;
    const status = statusEl.getBoundingClientRect();
    const available = window.innerHeight - top - (status.top >= top ? status.height + 16 : 8);
    cols.querySelectorAll<HTMLElement>('.fc-col').forEach((colEl) => {
      colEl.style.removeProperty('--peek');
      const n = colEl.children.length;
      const extra = colEl.getBoundingClientRect().height - available;
      if (n < 2 || extra <= 0) return;
      const peek = colEl.children[1].getBoundingClientRect().top - colEl.children[0].getBoundingClientRect().top;
      colEl.style.setProperty('--peek', `${Math.max(MIN_PEEK_PX, peek - extra / (n - 1))}px`);
    });
  }

  /** What Hint suggests, in words; the card is outlined on the board. */
  function showHint() {
    hint = findHint(state);
    if (!hint) message = 'No moves left. Tap Undo to try another way, or New for a new deal.';
    else {
      const cards = cardsAt(state, hint.src);
      const what = `the ${cardName(cards[0]).toLowerCase()}${cards.length > 1 ? ` and the ${cards.length - 1} below it` : ''}`;
      const tgt = hint.tgt;
      const onto = tgt.to === 'col' ? state.columns[tgt.col].at(-1) : undefined;
      message =
        tgt.to === 'foundation'
          ? `Hint: move ${what} up to its pile.`
          : tgt.to === 'cell'
            ? `Hint: move ${what} to a free space.`
            : onto
              ? `Hint: move ${what} onto the ${cardName(onto).toLowerCase()}.`
              : `Hint: move ${what} to the empty column.`;
    }
    render();
  }

  function startNew() {
    stopClock();
    state = newGame();
    history = [];
    message = '';
    hint = null;
    persist();
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-src]');
    if (!el) return;
    const [kind, a, b] = el.dataset.src!.split(':');
    const src: Source = kind === 'cell' ? { from: 'cell', i: Number(a) } : { from: 'col', col: Number(a), index: Number(b) };
    const tgt = bestTarget(state, src);
    commit(tgt && move(state, src, tgt), "That card can't move right now.");
  });
  undoBtn.addEventListener('click', () => {
    stopClock();
    state = { ...history.pop()!, elapsed: state.elapsed };
    message = '';
    hint = null;
    startClock();
    persist();
    render();
  });
  container.querySelector('[data-hint]')!.addEventListener('click', showHint);
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.moves > 0 && !state.won;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), startNew));
  const onVisibility = () => (document.hidden ? (stopClock(), persist()) : startClock());
  const onResize = () => fitColumns();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  render();
  startClock();

  return () => {
    stopClock();
    persist();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    container.replaceChildren();
  };
}
