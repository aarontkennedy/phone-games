import { load, save } from '../../core/storage';
import { cardId } from '../../core/cards';
import { SEAT_NAMES, trickWinner, type Seat } from '../../core/tricks';
import { handHtml, seatsHtml } from '../../core/trick-view';
import { showOverlay, hideOverlay } from '../../core/ui';
import {
  bid,
  chooseBid,
  chooseCard,
  collect,
  estimateTricks,
  isValidState,
  legalPlays,
  newGame,
  nextRound,
  partnerOf,
  play,
  teamBid,
  teamTricks,
  winner,
  type Level,
  type State,
  type Team,
} from './logic';
import './style.css';

const STATE_KEY = 'spades:state';
/** Pause before each computer bid or play, so you can follow along. */
export const AI_DELAY = 600;
/** How long a finished trick stays on the table. */
export const TRICK_PAUSE = 1100;

const bidText = (b: number) => (b === 0 ? 'Nil' : `Bid ${b}`);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;
  /** The bid you're about to make; starts at a suggestion for your hand. */
  let myBid = 0;

  container.innerHTML = `
    <div class="screen cards spd">
      <div class="stats">
        <div class="stat"><small>Us</small><b data-us></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Them</small><b data-them></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer players">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <div class="spd-bid" data-bidding>
          <button class="btn secondary" data-step="-1" aria-label="Bid fewer">−</button>
          <output class="spd-amount" data-amount aria-live="polite"></output>
          <button class="btn secondary" data-step="1" aria-label="Bid more">+</button>
          <button class="btn" data-bid></button>
        </div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const usEl = container.querySelector<HTMLElement>('[data-us]')!;
  const themEl = container.querySelector<HTMLElement>('[data-them]')!;
  const biddingEl = container.querySelector<HTMLElement>('[data-bidding]')!;
  const amountEl = container.querySelector<HTMLElement>('[data-amount]')!;
  const bidBtn = container.querySelector<HTMLButtonElement>('[data-bid]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  const suggestion = () => Math.round(estimateTricks(state.hands[0]));
  const myBidTurn = () => state.phase === 'bidding' && state.turn === 0;
  const myPlayTurn = () => state.phase === 'playing' && state.turn === 0 && state.trick.length < 4;

  function update(next: State | null) {
    if (!next) return;
    const wasMyBid = myBidTurn();
    state = next;
    if (myBidTurn() && !wasMyBid) myBid = suggestion();
    save(STATE_KEY, state);
    render();
    schedule();
  }

  /** Lets the computer players bid and play, and clears finished tricks, one step at a time. */
  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    const seat = state.turn;
    if (state.phase === 'bidding' && seat !== 0) {
      timer = window.setTimeout(() => update(bid(state, seat, chooseBid(state, seat))), AI_DELAY);
    } else if (state.phase === 'playing' && state.trick.length === 4) {
      timer = window.setTimeout(() => update(collect(state)), TRICK_PAUSE);
    } else if (state.phase === 'playing' && seat !== 0) {
      timer = window.setTimeout(() => update(play(state, seat, chooseCard(state, seat))), AI_DELAY);
    }
  }

  // --- Rendering ---

  function teamLine(team: Team, name: string) {
    return `${name} bid ${teamBid(state, team)} and took ${teamTricks(state, team)}`;
  }

  function statusText(): string {
    const name = (seat: Seat) => SEAT_NAMES[seat];
    if (state.phase === 'roundOver' || state.phase === 'gameOver') {
      const r = state.last!;
      const part = (team: Team, who: string) => {
        const bags = r.bags[team] ? ` with ${r.bags[team]} bag${r.bags[team] > 1 ? 's' : ''}` : '';
        const penalty = r.bagPenalty[team] ? ' (10 bags: −100)' : '';
        return `${teamLine(team, who)}${bags}: ${signed(r.points[team])}${penalty}.`;
      };
      const summary = `${part(0, 'We')} ${part(1, 'They')}`;
      if (state.phase === 'roundOver') return summary;
      const [us, them] = state.scores;
      return `${summary} ${winner(state) === 0 ? `We win ${us} to ${them}!` : `They win ${them} to ${us}.`}`;
    }
    if (state.phase === 'bidding') {
      if (state.turn !== 0) return `${name(state.turn)} is bidding…`;
      const partner = state.bids[partnerOf(0)];
      const said = partner === null ? '' : `North bid ${partner === 0 ? 'nil' : partner}. `;
      return `${said}How many tricks? Your hand looks like about ${suggestion()}. 0 is nil.`;
    }
    if (state.trick.length === 4) {
      const w = trickWinner(state.trick, 'S');
      return w === 0 ? 'You take the trick.' : `${name(w)} takes the trick.`;
    }
    if (state.turn !== 0) return `${name(state.turn)} is playing…`;
    if (!state.trick.length) return `Your turn to lead.${state.spadesBroken ? '' : ' Spades aren’t broken yet.'}`;
    return 'Your turn. Follow suit, or play a spade to trump.';
  }

  function render() {
    const seats = seatsHtml((seat) => ({
      info: state.bids[seat] === null ? '&nbsp;' : `${bidText(state.bids[seat]!)}<span class="tt-muted"> · ${state.tricks[seat]}</span>`,
      card: state.trick.find((p) => p.seat === seat)?.card,
      turn: (state.phase === 'bidding' || (state.phase === 'playing' && state.trick.length < 4)) && state.turn === seat,
    }));
    boardEl.innerHTML = seats + handHtml(state.hands[0], { playable: myPlayTurn() ? legalPlays(state, 0) : [] });

    usEl.textContent = String(state.scores[0]);
    themEl.textContent = String(state.scores[1]);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    biddingEl.hidden = !myBidTurn();
    amountEl.textContent = String(myBid);
    bidBtn.textContent = myBid === 0 ? 'Bid nil' : `Bid ${myBid}`;
    container.querySelector<HTMLButtonElement>('[data-step="-1"]')!.disabled = myBid <= 0;
    container.querySelector<HTMLButtonElement>('[data-step="1"]')!.disabled = myBid >= 13;
    statusEl.textContent = statusText();

    if (state.phase === 'roundOver') showOverlay(boardEl, 'Round over', [['Next round', () => update(nextRound(state))]]);
    else if (state.phase === 'gameOver') {
      showOverlay(boardEl, winner(state) === 0 ? 'We win!' : 'They win', [['New game', () => update(newGame(state.level))]]);
    } else hideOverlay(boardEl);
  }

  // --- Input ---

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-hand]');
    if (el) update(play(state, 0, state.hands[0].find((c) => cardId(c) === el.dataset.card)!));
  });
  biddingEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.step) {
      myBid = Math.max(0, Math.min(13, myBid + Number(el.dataset.step)));
      render();
    } else update(bid(state, 0, myBid));
  });
  container.querySelector('[data-new]')!.addEventListener('click', () => update(newGame(state.level)));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  if (myBidTurn()) myBid = suggestion();
  render();
  schedule();

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
