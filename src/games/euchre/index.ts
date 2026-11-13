import { cardFace, suitSvg } from '../../core/card-view';
import { SUITS, cardId, cardName, suitName, type Suit } from '../../core/cards';
import { load, save } from '../../core/storage';
import { SEAT_NAMES, type Seat } from '../../core/tricks';
import { handHtml, seatsHtml } from '../../core/trick-view';
import { showOverlay, hideOverlay, confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import {
  applyBid,
  callTrump,
  chooseBid,
  chooseCard,
  chooseDiscard,
  collect,
  discard,
  isValidState,
  legalPlays,
  newGame,
  nextHand,
  orderUp,
  pass,
  play,
  playersIn,
  sittingOut,
  teamOf,
  trickWinner,
  upcard,
  winner,
  type Level,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'euchre:state';
/** Pause before each computer decision, so you can follow along. */
export const AI_DELAY = 600;
/** How long a finished trick stays on the table. */
export const TRICK_PAUSE = 1100;

const lower = (name: string) => name.replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase());
const capital = (word: string) => word[0].toUpperCase() + word.slice(1);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;
  /** Whether your next bid goes alone. */
  let alone = false;

  container.innerHTML = `
    <div class="screen cards eu">
      <div class="stats">
        <div class="stat"><small>Us</small><b data-us></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Them</small><b data-them></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="eu-bid" data-bidding></div>
      </div>
    </div>${settingsHtml(levelSetting('Computer players'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const biddingEl = container.querySelector<HTMLElement>('[data-bidding]')!;
  const usEl = container.querySelector<HTMLElement>('[data-us]')!;
  const themEl = container.querySelector<HTMLElement>('[data-them]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  const bidding = () => state.phase === 'bidding1' || state.phase === 'bidding2';
  const myBid = () => bidding() && state.turn === 0;
  const trickDone = () => state.phase === 'playing' && state.trick.length === playersIn(state);

  function update(next: State | null) {
    if (!next) return;
    state = next;
    alone = false;
    save(STATE_KEY, state);
    render();
    schedule();
  }

  /** Lets the computer players bid, discard and play, and clears finished tricks, one step at a time. */
  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    const seat = state.turn;
    let step: (() => State | null) | null = null;
    if (bidding() && seat !== 0) step = () => applyBid(state, seat, chooseBid(state, seat));
    else if (state.phase === 'discard' && state.dealer !== 0) step = () => discard(state, chooseDiscard(state));
    else if (trickDone()) step = () => collect(state);
    else if (state.phase === 'playing' && seat !== 0) step = () => play(state, seat, chooseCard(state, seat));
    if (step) timer = window.setTimeout(() => update(step()), trickDone() ? TRICK_PAUSE : AI_DELAY);
  }

  // --- Rendering ---

  const name = (seat: Seat) => SEAT_NAMES[seat];
  const we = (seat: Seat) => (teamOf(seat) === 0 ? 'We' : 'They');

  function trumpStrip(): string {
    const up = upcard(state);
    if (state.phase === 'bidding1') return `<span>Turned up</span>${cardFace(up)}`;
    if (state.phase === 'bidding2') return `<span>Turned down: ${lower(cardName(up))}</span>`;
    const t = state.trump!;
    const by = state.maker === 0 ? 'you' : name(state.maker!);
    return `<span class="eu-suit${t === 'H' || t === 'D' ? ' red' : ''}">${suitSvg(t)}</span>
      <span><b>${capital(suitName(t))}</b> are trump, called by ${by}${state.alone ? ', alone' : ''}</span>`;
  }

  function seatInfo(seat: Seat): string {
    const roles = [
      seat === state.dealer ? 'Dealer' : '',
      seat === sittingOut(state) ? 'Out' : '',
    ].filter(Boolean);
    if (!bidding()) roles.push(`<span class="tt-muted">${state.tricks[seat]}</span>`);
    return roles.join(' · ') || '&nbsp;';
  }

  function renderBidding() {
    biddingEl.hidden = !myBid();
    if (!myBid()) return;
    const aloneBtn = `<button class="btn secondary" data-alone aria-pressed="${alone}">Alone</button>`;
    const passBtn = state.phase === 'bidding2' && state.dealer === 0 ? '' : '<button class="btn secondary" data-pass>Pass</button>';
    if (state.phase === 'bidding1') {
      biddingEl.innerHTML = `<button class="btn" data-order>${state.dealer === 0 ? 'Pick it up' : 'Order up'}</button>${aloneBtn}${passBtn}`;
    } else {
      const suits = SUITS.filter((x) => x !== upcard(state).suit)
        .map((x) => `<button class="btn secondary eu-call${x === 'H' || x === 'D' ? ' red' : ''}" data-suit="${x}" aria-label="${capital(suitName(x))}">${suitSvg(x)}</button>`)
        .join('');
      biddingEl.innerHTML = `${suits}${aloneBtn}${passBtn}`;
    }
  }

  function handSummary(): string {
    const r = state.last!;
    const makers = state.maker!;
    const who = makers === 0 ? 'You' : name(makers);
    const called = `${who} called ${suitName(state.trump!)}${state.alone ? ' alone' : ''}`;
    const pts = (n: number) => `${n} point${n > 1 ? 's' : ''}`;
    if (r.euchred) return `${called} but took only ${r.makerTricks}. Euchred! ${we(r.team === 0 ? 0 : 1)} score ${pts(2)}.`;
    const took = r.makerTricks === 5 ? 'took all 5' : `took ${r.makerTricks}`;
    return `${called} and ${took}: ${pts(r.points)} for ${r.team === 0 ? 'us' : 'them'}.`;
  }

  function statusText(): string {
    const up = lower(cardName(upcard(state)));
    switch (state.phase) {
      case 'bidding1':
        if (state.turn !== 0) return `${name(state.turn)} is deciding…`;
        return state.dealer === 0
          ? `Pick up the ${up} to make ${suitName(upcard(state).suit)} trump, or pass.`
          : `Order the dealer to pick up the ${up}, making ${suitName(upcard(state).suit)} trump? Or pass.`;
      case 'bidding2':
        if (state.turn !== 0) return `${name(state.turn)} is deciding…`;
        return state.dealer === 0
          ? 'Everyone passed, so you must name trump.'
          : `Name a trump suit (not ${suitName(upcard(state).suit)}), or pass.`;
      case 'discard':
        return state.dealer === 0 ? `You picked up the ${up}. Tap a card to put back.` : `${name(state.dealer)} is picking up the ${up}…`;
      case 'handOver':
        return handSummary();
      case 'gameOver': {
        const [us, them] = state.scores;
        return `${handSummary()} ${winner(state) === 0 ? `We win ${us} to ${them}!` : `They win ${them} to ${us}.`}`;
      }
    }
    if (trickDone()) {
      const w = trickWinner(state.trick, state.trump!);
      return w === 0 ? 'You take the trick.' : `${name(w)} takes the trick.`;
    }
    if (state.turn !== 0) return `${name(state.turn)} is playing…`;
    return state.trick.length ? 'Your turn. Follow suit if you can.' : 'Your turn to lead.';
  }

  function render() {
    const playable =
      state.phase === 'discard' && state.dealer === 0
        ? ('all' as const)
        : state.phase === 'playing' && state.turn === 0 && !trickDone()
          ? legalPlays(state, 0)
          : [];
    boardEl.innerHTML = `<div class="eu-trump">${trumpStrip()}</div>
      ${seatsHtml((seat) => ({
        info: seatInfo(seat),
        card: state.trick.find((p) => p.seat === seat)?.card,
        turn: (bidding() || (state.phase === 'playing' && !trickDone())) && state.turn === seat,
      }))}
      ${handHtml(state.hands[0], { playable })}`;
    usEl.textContent = String(state.scores[0]);
    themEl.textContent = String(state.scores[1]);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    renderBidding();
    statusEl.textContent = statusText();

    if (state.phase === 'handOver') showOverlay(boardEl, 'Hand over', [['Next hand', () => update(nextHand(state))]]);
    else if (state.phase === 'gameOver') {
      showOverlay(boardEl, winner(state) === 0 ? 'We win!' : 'They win', [['New game', () => update(newGame(state.level))]]);
    } else hideOverlay(boardEl);
  }

  // --- Input ---

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-hand]');
    if (!el) return;
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    update(state.phase === 'discard' ? discard(state, c) : play(state, 0, c));
  });
  biddingEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-alone')) {
      alone = !alone;
      renderBidding();
    } else if (el.hasAttribute('data-pass')) update(pass(state, 0));
    else if (el.hasAttribute('data-order')) update(orderUp(state, 0, alone));
    else update(callTrump(state, 0, el.dataset.suit as Suit, alone));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.scores.some((n) => n > 0) || state.played.length > 0);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  render();
  schedule();

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
