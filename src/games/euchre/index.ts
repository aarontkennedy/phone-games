import { cardFace, suitSvg } from '../../core/card-view';
import { SUITS, cardId, cardName, suitName, type Suit } from '../../core/cards';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { coach } from '../../core/coach';
import { load, save } from '../../core/storage';
import { SEAT_NAMES, theCard, trickText, type Seat } from '../../core/tricks';
import { handHtml, seatsHtml } from '../../core/trick-view';
import { showOverlay, hideOverlay, confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import {
  ALONE,
  CALL,
  applyBid,
  bidAdvice,
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
  sameBid,
  sittingOut,
  teamOf,
  trickWinner,
  upcard,
  winner,
  type Bid,
  type BidAdvice,
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

/**
 * What a step just did, for the recent moves list: who made trump, and each finished
 * trick (who led what, and who won it with what). Null for anything else.
 */
export function moveText(prev: State, next: State): string | null {
  if (!prev.trump && next.trump) {
    const who = SEAT_NAMES[next.maker!];
    const alone = next.alone ? ' alone' : '';
    if (prev.phase === 'bidding2') return `${who} called ${suitName(next.trump)}${alone}.`;
    return `${who} ${next.maker === prev.dealer ? 'picked' : 'ordered'} up ${theCard(upcard(prev))}${alone}.`;
  }
  if (prev.phase !== 'playing' || prev.trick.length !== playersIn(prev) || next.trick.length) return null;
  return trickText(prev.trick, trickWinner(prev.trick, prev.trump!));
}

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
        <div class="stat"><small>Right</small><b data-accuracy></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      ${RECENT_HTML}
      <div class="controls" data-controls>
        <div class="eu-bid actions" data-bidding></div>
      </div>
    </div>${settingsHtml(levelSetting('Computer players'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const biddingEl = container.querySelector<HTMLElement>('[data-bidding]')!;
  const usEl = container.querySelector<HTMLElement>('[data-us]')!;
  const themEl = container.querySelector<HTMLElement>('[data-them]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'euchre');
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  /** How often your bids and discards were the best ones by the count (src/core/coach.ts). */
  const coaching = coach('euchre');
  /** After your bid or discard: the best one, when yours wasn't, said until your next one. */
  let missed: string | null = null;

  const bidding = () => state.phase === 'bidding1' || state.phase === 'bidding2';
  const myBid = () => bidding() && state.turn === 0;
  const trickDone = () => state.phase === 'playing' && state.trick.length === playersIn(state);

  function update(next: State | null) {
    if (!next) return;
    // A new hand (or game) starts the list over; otherwise say what just happened.
    if (next.phase === 'bidding1' && state.phase !== 'bidding1') {
      recent.clear();
      missed = null;
    } else recent.add(moveText(state, next));
    if (next.phase !== state.phase || next.turn !== state.turn) coaching.asked = false;
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

  const myDiscard = () => state.phase === 'discard' && state.dealer === 0;

  /** "Your hand counts about 8.3 with hearts as trump: 7 or more is worth calling." */
  function countText(a: BidAdvice): string {
    const n = Math.max(0, a.strength).toFixed(1).replace(/\.0$/, ''); // the dealer's gift can take it below 0
    const need = a.bid.action === 'pass' ? `${CALL} is needed to call` : a.strength >= ALONE ? `${ALONE} or more is worth going alone` : `${CALL} or more is worth calling`;
    return `Your hand counts about ${n} with ${suitName(a.suit)} as trump: ${need}.`;
  }

  /** "order up", "pick it up alone", "call spades", "pass" */
  function bidWords(b: Bid): string {
    if (b.action === 'pass') return 'pass';
    const alone = b.alone ? ' alone' : '';
    if (b.action === 'call') return `call ${suitName(b.suit)}${alone}`;
    return `${state.dealer === 0 ? 'pick it up' : 'order up'}${alone}`;
  }

  /** The best play now (HTML), or null when there's nothing to advise. */
  function tipText(): string | null {
    if (myBid()) {
      const a = bidAdvice(state, 0);
      return `Best: <b>${bidWords(a.bid)}</b>. ${countText(a)}`;
    }
    if (myDiscard()) return 'Best: put back the <b>outlined card</b>, keeping trump and aces and emptying a short suit if you can.';
    return null;
  }

  /** Scores your bid against the best one, before it's made. */
  function scoreBid(b: Bid) {
    const a = bidAdvice(state, 0);
    const right = sameBid(b, a.bid);
    missed = coaching.score(right) && !right ? `Best was to ${bidWords(a.bid)}. ${countText(a)}` : null;
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
    return (missed ? `${missed} ` : '') + statusWords();
  }

  function statusWords(): string {
    const up = lower(cardName(upcard(state)));
    switch (state.phase) {
      case 'bidding1':
        if (state.turn !== 0) return `${name(state.turn)} is deciding…`;
        return state.dealer === 0
          ? `Pick up the ${up} to make ${suitName(upcard(state).suit)} trump, or pass.`
          : `Order up the ${up} to make ${suitName(upcard(state).suit)} trump, or pass.`;
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
      ${handHtml(state.hands[0], { playable, marked: { hint: myDiscard() && coaching.asked ? [chooseDiscard(state)] : [] } })}`;
    usEl.textContent = String(state.scores[0]);
    themEl.textContent = String(state.scores[1]);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    renderBidding();
    container.querySelector('[data-accuracy]')!.textContent = coaching.text();
    controlsEl.querySelector('.coach')?.remove();
    const tip = tipText();
    if (tip) controlsEl.insertAdjacentHTML('afterbegin', coaching.html(coaching.asked ? tip : ''));
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
    if (myDiscard()) {
      const best = chooseDiscard(state);
      const right = best.suit === c.suit && best.rank === c.rank;
      missed = coaching.score(right) && !right ? `Best was to put back ${theCard(best)}.` : null;
      update(discard(state, c));
    } else {
      if (state.phase === 'playing') missed = null;
      update(play(state, 0, c));
    }
  });
  controlsEl.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-hint]')) return;
    coaching.asked = true;
    render();
  });
  biddingEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-alone')) {
      alone = !alone;
      renderBidding();
    } else if (el.hasAttribute('data-pass')) {
      scoreBid({ action: 'pass' });
      update(pass(state, 0));
    } else if (el.hasAttribute('data-order')) {
      scoreBid({ action: 'order', alone });
      update(orderUp(state, 0, alone));
    } else {
      scoreBid({ action: 'call', suit: el.dataset.suit as Suit, alone });
      update(callTrump(state, 0, el.dataset.suit as Suit, alone));
    }
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
