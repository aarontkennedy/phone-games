import { cardId, cardName, type Card } from '../../core/cards';
import { load, save } from '../../core/storage';
import { SEAT_NAMES, type Seat } from '../../core/tricks';
import { handHtml, seatsHtml } from '../../core/trick-view';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { confirmNew, hideOverlay, showOverlay } from '../../core/ui';
import { applyTurn, ask, bookCount, chooseTurn, draw, isValidState, mustDraw, newGame, nextGame, targets, winners, type Event, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'gofish:state';
/** Pause before each computer turn, long enough to read what happened. */
export const AI_DELAY = 1200;

const NAMES = ['', 'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
/** "7s", "aces", "queens". */
export const plural = (rank: number): string => (rank === 1 || rank > 10 ? `${NAMES[rank]}s` : `${rank}s`);
/** "a 7", "an ace", "an 8". */
const single = (rank: number) => `${rank === 1 || rank === 8 ? 'an' : 'a'} ${NAMES[rank]}`;
const lower = (c: Card) => cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase());
const who = (seat: Seat) => (seat === 0 ? 'You' : SEAT_NAMES[seat]);
const whom = (seat: Seat) => (seat === 0 ? 'you' : SEAT_NAMES[seat]);
const list = (ranks: number[]) => ranks.map(plural).join(' and ');
/** "West, North or East". */
const and = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0]);

/** A short line on what an action did, for the recent moves list. */
export function eventText(e: Event): string {
  const you = e.seat === 0;
  const book = e.books.length ? ` Book of ${list(e.books)}.` : '';
  if (e.kind === 'draw') return `${who(e.seat)} ${you ? `drew the ${lower(e.drew)}` : 'drew a card'}.${book}`;
  const asked = `${who(e.seat)} asked ${whom(e.from)} for ${plural(e.rank)}`;
  if (e.got) return `${asked} and got ${e.got}.${book}`;
  if (!e.drew) return `${asked}: go fish, the deck is empty.${book}`;
  if (e.drew.rank === e.rank) return `${asked}: go fish, drew ${single(e.rank)}, ${you ? 'go' : 'goes'} again.${book}`;
  return `${asked}: go fish${you ? `, drew the ${lower(e.drew)}` : ''}.${book}`;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** The rank you tapped, waiting for you to pick who to ask. */
  let picked: number | null = null;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards gf">
      <div class="stats">
        <div class="stat"><small>Books</small><b data-books></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Deck</small><b data-stock></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      ${RECENT_HTML}
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer players">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <div class="gf-actions" data-actions></div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'gofish');

  function update(next: State | null) {
    if (!next) return;
    if (next.last && JSON.stringify(next.last) !== JSON.stringify(state.last)) recent.add(eventText(next.last));
    state = next;
    picked = null;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.phase === 'playing' && state.turn !== 0) {
      const seat = state.turn;
      timer = window.setTimeout(() => update(applyTurn(state, seat, chooseTurn(state, seat))), AI_DELAY);
    }
  }

  const canAsk = () => state.phase === 'playing' && state.turn === 0 && !mustDraw(state, 0);

  function render() {
    const seats = seatsHtml((seat) => {
      const books = state.books[seat];
      const top = books.at(-1);
      return {
        info: `${state.hands[seat].length} left<br><span class="tt-muted">${books.length} ${books.length === 1 ? 'book' : 'books'}</span>`,
        card: top ? { suit: 'S', rank: top } : undefined,
        turn: state.phase === 'playing' && state.turn === seat,
      };
    });
    const hand = state.hands[0];
    boardEl.innerHTML = seats + handHtml(hand, { playable: canAsk() ? 'all' : [], picked: hand.filter((c) => c.rank === picked) });
    // With a rank picked, the players you can ask become buttons.
    if (picked !== null) {
      for (const x of targets(state, 0)) {
        const el = boardEl.querySelector<HTMLElement>(`[data-seat="${x}"]`)!;
        el.classList.add('gf-target');
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `Ask ${SEAT_NAMES[x]} for ${plural(picked)}`);
        el.dataset.ask = String(x);
      }
    }

    container.querySelector('[data-books]')!.textContent = String(bookCount(state, 0));
    container.querySelector('[data-stock]')!.textContent = String(state.stock.length);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    actionsEl.innerHTML = mustDraw(state, 0) ? '<button class="btn" data-draw>Draw</button>' : '';
    statusEl.textContent = statusText();

    if (state.phase === 'over') {
      const top = winners(state);
      const title = top.length > 1 ? (top.includes(0) ? 'You tie for the win!' : 'A tie') : top[0] === 0 ? 'You win!' : `${SEAT_NAMES[top[0]]} wins`;
      showOverlay(boardEl, title, [['New game', () => start(nextGame(state))]]);
    } else hideOverlay(boardEl);
  }

  /** A new game starts with an empty list. */
  function start(next: State) {
    state = next;
    recent.clear();
    update(next);
  }

  function statusText(): string {
    if (state.phase === 'over') return `You won ${state.tally.won} of ${state.tally.played} games.`;
    if (state.turn !== 0) return `${SEAT_NAMES[state.turn]} is asking…`;
    if (mustDraw(state, 0)) return `${state.hands[0].length ? 'No one else has cards' : 'You have no cards'}: draw one.`;
    if (picked !== null) return `Tap ${and(targets(state, 0).map((x) => SEAT_NAMES[x]))} to ask for ${plural(picked)}.`;
    return `Your turn: tap a card, then ask a player for that rank.`;
  }

  boardEl.addEventListener('click', (e) => {
    const seat = (e.target as Element).closest<HTMLElement>('[data-ask]');
    if (seat) return update(ask(state, 0, Number(seat.dataset.ask) as Seat, picked!));
    const el = (e.target as Element).closest<HTMLElement>('[data-hand]');
    if (!el || !canAsk()) return;
    const rank = state.hands[0].find((h) => cardId(h) === el.dataset.card)!.rank;
    picked = picked === rank ? null : rank;
    render();
  });
  actionsEl.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-draw]')) update(draw(state, 0));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase === 'playing' && state.last !== null;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => start(nextGame(state))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
