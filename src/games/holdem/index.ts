import { betText } from '../../core/betting';
import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { describeHand } from '../../core/poker';
import { load, save } from '../../core/storage';
import { SEAT_NAMES, type Seat } from '../../core/tricks';
import { SEAT_ORDER } from '../../core/trick-view';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { confirmNew, hideOverlay, showOverlay, levelSetting, settingsHtml } from '../../core/ui';
import {
  STREETS,
  act,
  betSize,
  bigBlind,
  chooseAction,
  handOf,
  isValidState,
  newGame,
  nextHand,
  options,
  pot,
  raiseCost,
  toCall,
  winner,
  type Action,
  type Level,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'holdem:state';
/** Pause before each computer player acts. */
export const AI_DELAY = 800;

const LABELS: Record<Action, string> = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise' };
const lowerFirst = (t: string) => t[0].toLowerCase() + t.slice(1);
const join = (xs: string[], last = 'and') => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${last} ${xs.at(-1)}` : xs[0]);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards he">
      <div class="stats">
        <div class="stat"><small>You</small><b data-chips></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Pot</small><b data-pot></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      ${RECENT_HTML}
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="he-actions" data-actions></div>
      </div>
    </div>${settingsHtml(levelSetting('Computer players'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  const recent = recentMoves(container, 'holdem');

  function update(next: State | null) {
    if (!next) return;
    // A new street dealt (not the rest dealt at once when nobody can bet).
    const dealt = next.phase === 'betting' && next.street > state.street ? `${STREETS[next.street]} is dealt.` : null;
    recent.add(dealt);
    state = next;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.phase === 'betting' && state.turn !== 0) {
      const seat = state.turn;
      timer = window.setTimeout(() => play(seat, chooseAction(state, seat)), AI_DELAY);
    }
  }

  /** A betting action, said in the recent moves list. */
  function play(seat: Seat, a: Action) {
    const next = act(state, seat, a);
    if (next) recent.add(betText(state, seat, a, betSize(state), SEAT_NAMES[seat]));
    update(next);
  }

  /** A new hand or game starts with an empty list. */
  function start(next: State | null) {
    if (!next) return;
    state = next;
    recent.clear();
    update(next);
  }

  function seatHtml(x: Seat): string {
    // Out of chips: not dealt in, or busted in the hand just played.
    const out = state.stacks[x] === 0 && (state.phase !== 'betting' || !state.hole[x].length);
    const reveal = x === 0 || (state.shown && state.live[x]);
    const cards = state.hole[x].length && state.live[x] ? state.hole[x].map((c) => (reveal ? cardFace(c) : cardBack())).join('') : cardSlot();
    const turn = state.phase === 'betting' && state.turn === x;
    const dealer = state.dealer === x ? ' <span class="he-dealer" aria-label="dealer">D</span>' : '';
    const info = out ? 'Out' : `${state.stacks[x]}<br><span class="tt-muted">${state.said[x] || '&nbsp;'}</span>`;
    return `<div class="tt-seat he-seat${turn ? ' turn' : ''}" data-seat="${x}">
      <span class="tt-name">${SEAT_NAMES[x]}${dealer}</span>
      <span class="tt-info">${info}</span>
      <div class="he-hole">${cards}</div>
    </div>`;
  }

  function render() {
    const board = Array.from({ length: 5 }, (_, i) => (state.board[i] ? cardFace(state.board[i]) : cardSlot())).join('');
    const bb = bigBlind(state.hand);
    const mine = state.live[0] ? describeHand(handOf0()) : '';
    boardEl.innerHTML = `
      <div class="tt-seats">${SEAT_ORDER.map(seatHtml).join('')}</div>
      <p class="he-info">Hand ${state.hand} · blinds ${bb / 2} and ${bb}</p>
      <div class="he-board" aria-label="Shared cards">${board}</div>
      <p class="he-info">${mine ? `You have: <b>${lowerFirst(mine)}</b>` : '&nbsp;'}</p>`;
    container.querySelector('[data-chips]')!.textContent = String(state.stacks[0]);
    container.querySelector('[data-pot]')!.textContent = String(state.phase === 'betting' ? pot(state) : 0);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const opts = options(state, 0);
    actionsEl.innerHTML =
      state.phase === 'handOver'
        ? '<button class="btn" data-next>Next hand</button>'
        : opts.map((a) => `<button class="btn${a === 'fold' ? ' secondary' : ''}" data-action="${a}">${LABELS[a]}</button>`).join('');
    statusEl.textContent = statusText(opts);

    if (state.phase === 'gameOver') {
      showOverlay(boardEl, winner(state) ? 'You win every chip!' : 'You’re out of chips', [['New game', () => start(newGame(state.level))]]);
    } else hideOverlay(boardEl);
  }

  /** Your best hand so far: your two cards, plus any shared cards. */
  function handOf0() {
    if (state.board.length) return handOf(state, 0);
    const [a, b] = state.hole[0];
    // Before the flop, just name a pair or the high card.
    const high = (r: number) => (r === 1 ? 14 : r);
    return a.rank === b.rank
      ? { category: 'pair' as const, kickers: [high(a.rank)], score: 0, cards: [] }
      : { category: 'high' as const, kickers: [Math.max(high(a.rank), high(b.rank))], score: 0, cards: [] };
  }

  function resultText(): string {
    return state
      .pots!.map((p, i) => {
        const side = state.pots!.length > 1 ? (i === 0 ? 'the main pot' : 'a side pot') : 'the pot';
        const names = p.winners.map((x) => (x === 0 ? 'you' : SEAT_NAMES[x]));
        const subject = join(names);
        const verb = p.winners.length > 1 ? 'split' : p.winners[0] === 0 ? 'win' : 'wins';
        const how = state.shown ? ` with ${lowerFirst(describeHand(handOf(state, p.winners[0])))}` : '';
        return `${subject[0].toUpperCase()}${subject.slice(1)} ${verb} ${side} of ${p.amount}${how}.`;
      })
      .join(' ');
  }

  function statusText(opts: Action[]): string {
    if (state.phase !== 'betting') {
      const folded = state.shown ? '' : 'Everyone else folded. ';
      return `${folded}${resultText()}`;
    }
    if (state.turn !== 0) return `${STREETS[state.street]}: ${SEAT_NAMES[state.turn]} is thinking…`;
    // e.g. "call 10, raise 20 or fold"; amounts are the chips each puts in now.
    const amount = (n: number) => (n >= state.stacks[0] ? `${state.stacks[0]} (all in)` : String(n));
    const words = [...opts.filter((a) => a !== 'fold'), ...opts.filter((a) => a === 'fold')].map((a) =>
      a === 'call' ? `call ${amount(toCall(state, 0))}` : a === 'bet' || a === 'raise' ? `${a} ${amount(raiseCost(state, 0))}` : a,
    );
    return `${STREETS[state.street]}, your turn: ${join(words, 'or')}.`;
  }

  actionsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-next')) start(nextHand(state));
    else play(0, el.dataset.action as Action);
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.hand > 1 || state.said.some((w) => w && !w.includes('blind')));
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => start(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
