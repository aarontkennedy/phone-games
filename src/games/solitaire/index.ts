import { cardBack, cardFace, cardSlot, suitSvg } from '../../core/card-view';
import { SUITS, cardName, suitName } from '../../core/cards';
import { load, save } from '../../core/storage';
import { formatTime } from '../../core/time';
import { showOverlay, hideOverlay, confirmNew } from '../../core/ui';
import {
  autoFinish,
  bestTarget,
  canAutoFinish,
  cardsAt,
  draw,
  findHint,
  isStuck,
  isValidState,
  move,
  newState,
  type DrawCount,
  type Hint,
  type Source,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'solitaire:state';
const BEST_KEY = 'solitaire:best';
const UNDO_LIMIT = 200;
/** Smallest gap between face-up cards in a column: enough to read the rank. */
const MIN_PEEK_PX = 24;

export { formatTime };

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState(1);
  const best = load<Partial<Record<DrawCount, number>>>(BEST_KEY, {});
  let history: State[] = [];
  let message = '';
  /** The move suggested by Hint, outlined until the next move. */
  let hint: Hint | null = null;

  container.innerHTML = `
    <div class="screen cards sol">
      <div class="stats">
        <div class="stat"><small>Moves</small><b data-moves></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Time</small><b data-time></b></div>
      </div>
      <div class="board-frame sol-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented">
          <button data-draw="1">Draw 1</button>
          <button data-draw="3">Draw 3</button>
        </div>
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const movesEl = container.querySelector<HTMLElement>('[data-moves]')!;
  const timeEl = container.querySelector<HTMLElement>('[data-time]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;
  const drawBtns = container.querySelectorAll<HTMLButtonElement>('[data-draw]');

  // --- Clock: starts on the first move, and only counts while the game is on screen ---
  let clockStart = 0;
  let timer: number | undefined;
  const playing = () => state.moves > 0 && !state.won;

  function playTime() {
    return state.elapsed + (timer !== undefined ? Date.now() - clockStart : 0);
  }
  function startClock() {
    if (timer !== undefined || !playing() || document.hidden) return;
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
    timeEl.textContent = formatTime(playTime());
  }

  // --- Actions ---

  function persist() {
    save(STATE_KEY, { ...state, elapsed: playTime() });
  }

  /** Applies a move's result, keeping Undo, the clock, records, storage and screen in sync. */
  function commit(next: State | null, failMessage = '') {
    hint = null;
    if (!next) {
      message = failMessage;
      render();
      return;
    }
    stopClock();
    history = [...history.slice(-(UNDO_LIMIT - 1)), state];
    next.elapsed = state.elapsed;
    state = canAutoFinish(next) ? autoFinish(next) : next;
    message = '';
    if (state.won) recordBest();
    else startClock();
    persist();
    render();
  }

  function recordBest() {
    const seconds = Math.floor(state.elapsed / 1000);
    const prev = best[state.draw];
    if (prev === undefined || seconds < prev) {
      best[state.draw] = seconds;
      save(BEST_KEY, best);
    }
  }

  function newGame(drawCount: DrawCount) {
    stopClock();
    state = newState(drawCount);
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
    prev.elapsed = state.elapsed;
    state = prev;
    message = '';
    hint = null;
    startClock();
    persist();
    render();
  }

  function parseSource(el: HTMLElement): Source {
    if (el.dataset.src === 'waste') return { from: 'waste' };
    const [col, index] = el.dataset.src!.split(':').map(Number);
    return { from: 'tableau', col, index };
  }

  function tapCard(el: HTMLElement) {
    const src = parseSource(el);
    const tgt = bestTarget(state, src);
    commit(tgt && move(state, src, tgt), "That card can't move right now.");
  }

  /** What Hint suggests, in words; the card (or the deck) is outlined on the board. */
  function showHint() {
    hint = findHint(state);
    if (!hint) message = 'No moves left. Tap Undo to try another way, or New for a new deal.';
    else if ('draw' in hint) message = 'Turn over the deck: a card in it can be played.';
    else {
      const card = cardName(cardsAt(state, hint.src)[0]).toLowerCase(); // "queen of hearts"
      const tgt = hint.tgt;
      const onto = tgt.to === 'tableau' ? state.tableau[tgt.col].up.at(-1) : undefined;
      message =
        tgt.to === 'foundation'
          ? `Hint: move the ${card} up to its pile.`
          : onto
            ? `Hint: move the ${card} onto the ${cardName(onto).toLowerCase()}.`
            : `Hint: move the ${card} to the empty column.`;
    }
    render();
  }

  /** Outlines the hinted card, or the deck. */
  function markHint() {
    if (!hint) return;
    const src = 'draw' in hint ? null : hint.src;
    const sel = !src ? '[data-stock]' : src.from === 'tableau' ? `[data-src="${src.col}:${src.index}"]` : '[data-src="waste"]';
    boardEl.querySelector(sel)?.classList.add('hint');
  }

  // --- Rendering ---

  function renderTop(): string {
    const stock = state.stock.length
      ? cardBack({ button: true, attrs: 'data-stock', label: 'Turn over cards' })
      : state.waste.length
        ? cardSlot({ button: true, attrs: 'data-stock', label: 'Turn the pile back over' })
        : cardSlot();
    const shown = state.waste.slice(state.draw === 3 ? -3 : -1);
    const waste = shown
      .map((c, i) => {
        const top = i === shown.length - 1;
        return cardFace(c, { button: top, attrs: `style="--i:${i}"${top ? ' data-src="waste"' : ''}` });
      })
      .join('');
    const foundations = state.foundations
      .map((f, i) =>
        f.length
          ? `<div class="sol-found">${cardFace(f.at(-1)!)}</div>`
          : `<div class="sol-found">${cardSlot({ label: `Empty ${suitName(SUITS[i])} pile` }, suitSvg(SUITS[i]))}</div>`,
      )
      .join('');
    return `<div class="sol-top">
      <div class="sol-stock">${stock}</div>
      <div class="sol-waste" aria-label="Turned-over cards">${waste}</div>
      ${foundations}
    </div>`;
  }

  function renderTableau(): string {
    const cols = state.tableau
      .map((col, c) => {
        const down = col.down.map(() => cardBack()).join('');
        const up = col.up.map((card, i) => cardFace(card, { button: true, attrs: `data-src="${c}:${i}"` })).join('');
        const empty = col.down.length || col.up.length ? '' : cardSlot();
        return `<div class="sol-col" data-col="${c}">${empty}${down}${up}</div>`;
      })
      .join('');
    return `<div class="sol-tableau">${cols}</div>`;
  }

  /** Squeezes long columns so the board fits the screen, without hiding any card's rank. */
  function fitColumns() {
    const tableau = boardEl.querySelector<HTMLElement>('.sol-tableau')!;
    const top = tableau.getBoundingClientRect().top;
    const status = statusEl.getBoundingClientRect();
    const below = status.top >= top ? status.height + 16 : 8; // status line under the board (portrait)
    const available = window.innerHeight - top - below;
    tableau.querySelectorAll<HTMLElement>('.sol-col').forEach((colEl, c) => {
      colEl.style.removeProperty('--peek-up');
      const ups = state.tableau[c].up.length;
      const extra = colEl.getBoundingClientRect().height - available;
      if (ups < 2 || extra <= 0) return;
      const cards = [...colEl.children].slice(-ups);
      const peek = cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top;
      colEl.style.setProperty('--peek-up', `${Math.max(MIN_PEEK_PX, peek - extra / (ups - 1))}px`);
    });
  }

  function render() {
    boardEl.innerHTML = renderTop() + renderTableau();
    movesEl.textContent = String(state.moves);
    renderClock();
    drawBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.draw) === state.draw)));
    undoBtn.disabled = !history.length;

    const bestTime = best[state.draw];
    const bestText = bestTime !== undefined ? ` Best: ${formatTime(bestTime * 1000)}.` : '';
    statusEl.textContent = state.won
      ? `You won in ${formatTime(state.elapsed)} with ${state.moves} moves!${bestText}`
      : message ||
        (isStuck(state)
          ? 'No moves left. Tap Undo to try another way, or New for a new deal.'
          : `Tap a card to move it. Tap the deck to turn cards over.${bestText}`);
    markHint();

    if (state.won) showOverlay(boardEl, 'You win!', [['New game', () => newGame(state.draw)]]);
    else hideOverlay(boardEl);
    fitColumns();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-stock], [data-src]');
    if (!el) return;
    if (el.hasAttribute('data-stock')) commit(draw(state));
    else tapCard(el);
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.moves > 0 && !state.won;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => newGame(state.draw)));
  drawBtns.forEach((b) => b.addEventListener('click', () => confirmNew(inProgress(), () => newGame(Number(b.dataset.draw) as DrawCount))));
  undoBtn.addEventListener('click', undo);
  container.querySelector('[data-hint]')!.addEventListener('click', showHint);

  const onVisibility = () => {
    if (document.hidden) {
      stopClock();
      persist();
    } else {
      startClock();
    }
  };
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
