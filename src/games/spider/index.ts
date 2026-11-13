import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { showIcons } from '../../core/icons';
import { cardName, type Card } from '../../core/cards';
import { load, save } from '../../core/storage';
import { formatTime } from '../../core/time';
import { confirmNew, hideOverlay, showOverlay, settingRow, settingsHtml } from '../../core/ui';
import { COLUMNS, RUNS, bestTarget, cardsAt, deal, findHint, isStuck, isValidState, move, newGame, type Hint, type State, type Suits } from './logic';
import './style.css';

const STATE_KEY = 'spider:state';
const BEST_KEY = 'spider:best';
const UNDO_LIMIT = 200;
/** Smallest gap between face-up cards in a column: enough to read the rank. */
const MIN_PEEK_PX = 22;

const name = (c: Card) => cardName(c).toLowerCase();

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame(1);
  const best = load<Partial<Record<Suits, number>>>(BEST_KEY, {});
  let history: State[] = [];
  let message = '';
  let hint: Hint | null = null;

  container.innerHTML = `
    <div class="screen cards sp">
      <div class="stats">
        <div class="stat"><small>Moves</small><b data-moves></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Time</small><b data-time></b></div>
      </div>
      <div class="board-frame sp-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>${settingsHtml(settingRow('Suits', '<button data-suits="1">1 suit</button><button data-suits="2">2 suits</button><button data-suits="4">4 suits</button>', 'Fewer suits is easier. Starts a new game.'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const timeEl = container.querySelector<HTMLElement>('[data-time]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;
  const suitBtns = container.querySelectorAll<HTMLButtonElement>('[data-suits]');

  // --- Clock: starts on the first move, and only counts while the game is on screen ---
  let clockStart = 0;
  let timer: number | undefined;
  const playing = () => state.moves > 0 && !state.won;
  const playTime = () => state.elapsed + (timer !== undefined ? Date.now() - clockStart : 0);
  function startClock() {
    if (timer !== undefined || !playing() || document.hidden) return;
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

  /** Applies a move's result, keeping Undo, the clock, records, storage and screen in sync. */
  function commit(next: State | null, fail = '') {
    hint = null;
    message = next ? '' : fail;
    if (next) {
      stopClock();
      history = [...history.slice(-(UNDO_LIMIT - 1)), state];
      state = { ...next, elapsed: state.elapsed };
      if (state.won) {
        const seconds = Math.floor(state.elapsed / 1000);
        const prev = best[state.suits];
        if (prev === undefined || seconds < prev) save(BEST_KEY, Object.assign(best, { [state.suits]: seconds }));
      } else startClock();
      persist();
    }
    render();
  }

  function startNew(suits: Suits) {
    stopClock();
    state = newGame(suits);
    history = [];
    message = '';
    hint = null;
    persist();
    render();
  }

  function undo() {
    const prev = history.pop();
    if (!prev) return;
    stopClock();
    state = { ...prev, elapsed: state.elapsed };
    message = '';
    hint = null;
    startClock();
    persist();
    render();
  }

  function showHint() {
    hint = findHint(state);
    if (!hint) message = 'No moves left. Tap Undo to try another way, or {new} for a new deal.';
    else if ('deal' in hint) message = 'Hint: tap the deck to deal a card onto every column.';
    else {
      const cards = cardsAt(state, hint.src);
      const what = `the ${name(cards[0])}${cards.length > 1 ? ` and the ${cards.length - 1} below it` : ''}`;
      const onto = state.tableau[hint.to].up.at(-1);
      message = onto ? `Hint: move ${what} onto the ${name(onto)}.` : `Hint: move ${what} to the empty column.`;
    }
    render();
  }

  // --- Rendering ---

  function render() {
    const deals = Math.floor(state.stock.length / COLUMNS);
    const stock = deals
      ? cardBack({ button: true, attrs: 'data-deal', label: `Deal a card onto every column, ${deals} ${deals === 1 ? 'deal' : 'deals'} left` })
      : cardSlot({ label: 'No deals left' });
    const done = Array.from({ length: RUNS }, (_, i) => {
      const suit = state.done[i];
      return suit ? cardFace({ suit, rank: 13 }) : cardSlot();
    }).join('');
    const columns = state.tableau
      .map((col, c) => {
        const down = col.down.map(() => cardBack()).join('');
        const up = col.up.map((card, i) => cardFace(card, { button: true, attrs: `data-src="${c}:${i}"` })).join('');
        return `<div class="sp-col" data-col="${c}">${col.down.length || col.up.length ? down + up : cardSlot()}</div>`;
      })
      .join('');
    boardEl.innerHTML = `<div class="sp-top"><div class="sp-stock">${stock}</div><div class="sp-done" aria-label="Finished runs: ${state.done.length} of ${RUNS}">${done}</div></div>
      <div class="sp-tableau">${columns}</div>`;
    if (hint) boardEl.querySelector('deal' in hint ? '[data-deal]' : `[data-src="${hint.src.col}:${hint.src.index}"]`)?.classList.add('hint');

    container.querySelector('[data-moves]')!.textContent = String(state.moves);
    timeEl.textContent = formatTime(playTime());
    suitBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.suits) === state.suits)));
    undoBtn.disabled = !history.length;
    const bestTime = best[state.suits];
    const bestText = bestTime !== undefined ? ` Best: ${formatTime(bestTime * 1000)}.` : '';
    statusEl.textContent = state.won
      ? `You won in ${formatTime(state.elapsed)} with ${state.moves} moves!${bestText}`
      : message ||
        (isStuck(state)
          ? 'No moves left. Tap Undo to try another way, or {new} for a new deal.'
          : `Build runs from King down to Ace in one suit. Tap a card to move it.${bestText}`);
    showIcons(statusEl);
    if (state.won) showOverlay(boardEl, 'You win!', [['New game', () => startNew(state.suits)]]);
    else hideOverlay(boardEl);
    fitColumns();
  }

  /** Squeezes long columns so the board fits the screen, never hiding a rank. */
  function fitColumns() {
    const tableau = boardEl.querySelector<HTMLElement>('.sp-tableau')!;
    const top = tableau.getBoundingClientRect().top;
    const status = statusEl.getBoundingClientRect();
    const available = window.innerHeight - top - (status.top >= top ? status.height + 16 : 8);
    tableau.querySelectorAll<HTMLElement>('.sp-col').forEach((colEl, c) => {
      colEl.style.removeProperty('--peek-up');
      const ups = state.tableau[c].up.length;
      const extra = colEl.getBoundingClientRect().height - available;
      if (ups < 2 || extra <= 0) return;
      const cards = [...colEl.children].slice(-ups);
      const peek = cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top;
      colEl.style.setProperty('--peek-up', `${Math.max(MIN_PEEK_PX, peek - extra / (ups - 1))}px`);
    });
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-deal], [data-src]');
    if (!el) return;
    if (el.hasAttribute('data-deal')) {
      commit(deal(state), 'Fill every empty column before dealing.');
      return;
    }
    const [col, index] = el.dataset.src!.split(':').map(Number);
    const to = bestTarget(state, { col, index });
    commit(to === null ? null : move(state, { col, index }, to), 'That can’t move: only a run of one suit moves together, onto a card one higher.');
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.moves > 0 && !state.won;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => startNew(state.suits)));
  suitBtns.forEach((b) => b.addEventListener('click', () => confirmNew(inProgress(), () => startNew(Number(b.dataset.suits) as Suits))));
  container.querySelector('[data-hint]')!.addEventListener('click', showHint);
  undoBtn.addEventListener('click', undo);

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
