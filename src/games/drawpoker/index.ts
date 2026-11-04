import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { cardId, cardName, sameCard, type Card } from '../../core/cards';
import { CATEGORY_NAMES, describeHand, type HandRank } from '../../core/poker';
import { load, save } from '../../core/storage';
import { SEAT_NAMES, type Seat } from '../../core/tricks';
import { SEAT_ORDER } from '../../core/trick-view';
import { confirmNew, hideOverlay, showOverlay } from '../../core/ui';
import {
  MAX_DRAW,
  act,
  applyTurn,
  bigBlind,
  chooseTurn,
  handOf,
  isValidState,
  newGame,
  nextHand,
  options,
  pot,
  raiseCost,
  swap,
  toCall,
  winner,
  type Action,
  type Level,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'drawpoker:state';
/** Pause before each computer player acts. */
export const AI_DELAY = 800;

const LABELS: Record<Action, string> = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise' };
const ROUNDS = ['Before the draw', 'After the draw'];
/** The kind of hand, short enough for a seat: the full name ("Two pair, kings and fives") won't fit. */
const shortName = (h: HandRank) => (h.category === 'three' ? '3 of a kind' : h.category === 'four' ? '4 of a kind' : CATEGORY_NAMES[h.category]);

const lowerFirst = (t: string) => t[0].toLowerCase() + t.slice(1);
const join = (xs: string[], last = 'and') => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${last} ${xs.at(-1)}` : xs[0]);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** Cards you've picked to swap. */
  let picked: Card[] = [];
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards dp">
      <div class="stats">
        <div class="stat"><small>You</small><b data-chips></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Pot</small><b data-pot></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer players">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <div class="dp-actions" data-actions></div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    picked = [];
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if ((state.phase === 'betting' || state.phase === 'drawing') && state.turn !== 0) {
      const seat = state.turn;
      timer = window.setTimeout(() => update(applyTurn(state, seat, chooseTurn(state, seat))), AI_DELAY);
    }
  }

  const myDraw = () => state.phase === 'drawing' && state.turn === 0;

  function seatHtml(x: Seat): string {
    const out = state.stacks[x] === 0 && (state.phase === 'handOver' || state.phase === 'gameOver' || !state.hands[x].length);
    const reveal = state.shown && state.live[x];
    const hand = state.hands[x];
    const cards = x === 0 ? '' : hand.length && state.live[x] ? hand.map((c) => (reveal ? cardFace(c) : cardBack())).join('') : cardSlot();
    const turn = (state.phase === 'betting' || state.phase === 'drawing') && state.turn === x;
    const dealer = state.dealer === x ? ' <span class="dp-dealer">D</span>' : '';
    const named = reveal ? shortName(handOf(state, x)) : state.said[x];
    const info = out ? 'Out' : `${state.stacks[x]}<br><span class="tt-muted">${named || '&nbsp;'}</span>`;
    const label = reveal ? ` aria-label="${SEAT_NAMES[x]}’s cards: ${hand.map(cardName).join(', ')}, ${lowerFirst(describeHand(handOf(state, x)))}"` : '';
    return `<div class="tt-seat dp-seat${turn ? ' turn' : ''}" data-seat="${x}">
      <span class="tt-name">${SEAT_NAMES[x]}${dealer}</span>
      <span class="tt-info">${info}</span>
      ${x === 0 ? '' : `<div class="dp-fan" role="img"${label || ' aria-hidden="true"'}>${cards}</div>`}
    </div>`;
  }

  function render() {
    const bb = bigBlind(state.hand);
    const mine = state.hands[0];
    const drawing = myDraw();
    const hand = mine.length
      ? mine
          .map((c) => {
            const out = picked.some((p) => sameCard(p, c));
            const card = cardFace(c, { button: true, className: out ? 'swap' : '', attrs: `data-hand aria-pressed="${out}"${drawing ? '' : ' disabled'}` });
            return `<div class="dp-slot">${card}<span class="dp-mark">${out ? 'Swap' : ''}</span></div>`;
          })
          .join('')
      : '';
    const yours = state.live[0] ? lowerFirst(describeHand(handOf(state, 0))) : '';
    boardEl.innerHTML = `
      <div class="tt-seats">${SEAT_ORDER.map(seatHtml).join('')}</div>
      <p class="dp-info">Hand ${state.hand} · blinds ${bb / 2} and ${bb}</p>
      <div class="dp-hand" aria-label="Your cards">${hand}</div>
      <p class="dp-info">${yours ? `You have: <b>${yours}</b>` : '&nbsp;'}</p>`;
    container.querySelector('[data-chips]')!.textContent = String(state.stacks[0]);
    container.querySelector('[data-pot]')!.textContent = String(state.phase === 'betting' || state.phase === 'drawing' ? pot(state) : 0);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const opts = options(state, 0);
    actionsEl.innerHTML =
      state.phase === 'handOver'
        ? '<button class="btn" data-next>Next hand</button>'
        : drawing
          ? `<button class="btn" data-swap>${picked.length ? `Swap ${picked.length}` : 'Stand pat'}</button>`
          : opts.map((a) => `<button class="btn${a === 'fold' ? ' secondary' : ''}" data-action="${a}">${LABELS[a]}</button>`).join('');
    statusEl.textContent = statusText(opts);

    if (state.phase === 'gameOver') {
      showOverlay(boardEl, winner(state) ? 'You win every chip!' : 'You’re out of chips', [['New game', () => update(newGame(state.level))]]);
    } else hideOverlay(boardEl);
  }

  function resultText(): string {
    return state
      .pots!.map((p, i) => {
        const side = state.pots!.length > 1 ? (i === 0 ? 'the main pot' : 'a side pot') : 'the pot';
        const subject = join(p.winners.map((x) => (x === 0 ? 'you' : SEAT_NAMES[x])));
        const verb = p.winners.length > 1 ? 'split' : p.winners[0] === 0 ? 'win' : 'wins';
        const how = state.shown ? ` with ${lowerFirst(describeHand(handOf(state, p.winners[0])))}` : '';
        return `${subject[0].toUpperCase()}${subject.slice(1)} ${verb} ${side} of ${p.amount}${how}.`;
      })
      .join(' ');
  }

  function statusText(opts: Action[]): string {
    if (state.phase === 'handOver' || state.phase === 'gameOver') return `${state.shown ? '' : 'Everyone else folded. '}${resultText()}`;
    if (state.phase === 'drawing') {
      if (state.turn !== 0) return `The draw: ${SEAT_NAMES[state.turn]} is choosing cards…`;
      return picked.length
        ? `Tap Swap to trade ${picked.length === 1 ? 'that card' : `those ${picked.length} cards`} for new ones, or tap a card again to keep it.`
        : `The draw: tap up to ${MAX_DRAW} cards to swap, or tap Stand pat to keep them all.`;
    }
    if (state.turn !== 0) return `${ROUNDS[state.round]}: ${SEAT_NAMES[state.turn]} is thinking…`;
    const amount = (n: number) => (n >= state.stacks[0] ? `${state.stacks[0]} (all in)` : String(n));
    const words = [...opts.filter((a) => a !== 'fold'), ...opts.filter((a) => a === 'fold')].map((a) =>
      a === 'call' ? `call ${amount(toCall(state, 0))}` : a === 'bet' || a === 'raise' ? `${a} ${amount(raiseCost(state, 0))}` : a,
    );
    return `${ROUNDS[state.round]}, your turn: ${join(words, 'or')}.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-hand]');
    if (!el || !myDraw()) return;
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    if (picked.some((p) => sameCard(p, c))) picked = picked.filter((p) => !sameCard(p, c));
    else if (picked.length < MAX_DRAW) picked = [...picked, c];
    render();
  });
  actionsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-next')) update(nextHand(state));
    else if (el.hasAttribute('data-swap')) update(swap(state, 0, picked));
    else update(act(state, 0, el.dataset.action as Action));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.hand > 1 || state.said.some((w) => w && !w.includes('blind')));
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
