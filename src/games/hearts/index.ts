import { cardId, cardName, sameCard, type Card } from '../../core/cards';
import { load, save } from '../../core/storage';
import { SEATS, SEAT_NAMES, nextSeat, trickWinner, type Seat } from '../../core/tricks';
import { handHtml, seatsHtml } from '../../core/trick-view';
import { showOverlay, hideOverlay, confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import {
  chooseCard,
  collect,
  isValidState,
  legalPlays,
  newGame,
  nextRound,
  passCards,
  passDirection,
  play,
  winners,
  type Level,
  type State,
} from './logic';

const STATE_KEY = 'hearts:state';
/** Pause before each computer play, so you can follow along. */
export const AI_DELAY = 600;
/** How long a finished trick stays on the table. */
export const TRICK_PAUSE = 1100;
const PASS_TO = { left: 'West', right: 'East', across: 'North' } as const;

/** "A, B and C". Always called with at least two items. */
const listOf = (items: string[]) => `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const lower = (c: Card) => cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase());

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let picked: Card[] = [];
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards hrt">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Round</small><b data-round></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <button class="btn" data-pass>Pass</button>
      </div>
    </div>${settingsHtml(levelSetting('Computer players'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const scoreEl = container.querySelector<HTMLElement>('[data-score]')!;
  const roundEl = container.querySelector<HTMLElement>('[data-round]')!;
  const passBtn = container.querySelector<HTMLButtonElement>('[data-pass]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
    schedule();
  }

  /** Lets the computer players take their turns, and clears finished tricks, one step at a time. */
  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    if (state.phase !== 'playing') return;
    if (state.trick.length === 4) timer = window.setTimeout(() => update(collect(state)), TRICK_PAUSE);
    else if (state.turn !== 0) {
      timer = window.setTimeout(() => update(play(state, state.turn, chooseCard(state, state.turn))), AI_DELAY);
    }
  }

  function startGame() {
    picked = [];
    update(newGame(state.level));
  }

  // --- Rendering ---

  const myTurn = () => state.phase === 'playing' && state.turn === 0 && state.trick.length < 4;

  function renderTable(): string {
    const seats = seatsHtml((seat) => ({
      info: `${state.scores[seat]}${state.points[seat] ? `<span class="tt-muted"> +${state.points[seat]}</span>` : ''}`,
      card: state.trick.find((p) => p.seat === seat)?.card,
      turn: state.phase === 'playing' && state.trick.length < 4 && state.turn === seat,
    }));
    const hand = handHtml(state.hands[0], {
      playable: state.phase === 'passing' ? 'all' : myTurn() ? legalPlays(state, 0) : [],
      picked,
      received: state.received,
    });
    return seats + hand;
  }

  function statusText(): string {
    const name = (seat: Seat) => SEAT_NAMES[seat];
    switch (state.phase) {
      case 'passing': {
        const dir = passDirection(state) as keyof typeof PASS_TO;
        return `Pick 3 cards to pass ${dir} to ${PASS_TO[dir]}. ${picked.length} picked.`;
      }
      case 'roundOver':
      case 'gameOver': {
        const moon = state.moon !== null ? `${state.moon === 0 ? 'You' : name(state.moon)} shot the moon! ` : '';
        const round = SEATS.map((s) => `${name(s)} ${state.lastRound[s]}`);
        if (state.phase === 'roundOver') return `${moon}Round points: ${listOf(round)}.`;
        const won = winners(state);
        if (won.length > 1) return `${moon}${listOf(won.map(name))} tie for the win with ${state.scores[won[0]]}.`;
        return won[0] === 0
          ? `${moon}You win with ${state.scores[0]}!`
          : `${moon}${name(won[0])} wins with ${state.scores[won[0]]}. You finished with ${state.scores[0]}.`;
      }
    }
    if (state.trick.length === 4) {
      const winner = trickWinner(state.trick);
      return winner === 0 ? 'You take the trick.' : `${name(winner)} takes the trick.`;
    }
    if (state.turn !== 0) return `${name(state.turn)} is playing…`;
    const from = state.received.length
      ? `${name(nextSeat(0, 4 - [1, 3, 2][state.round % 4]))} passed you the ${listOf(state.received.map(lower))}. `
      : '';
    if (state.tricksPlayed === 0 && !state.trick.length) return `${from}Your turn: lead the 2 of clubs.`;
    if (!state.trick.length) return `${from}Your turn to lead.${state.heartsBroken ? '' : ' Hearts aren’t broken yet.'}`;
    return `${from}Your turn. Follow suit if you can.`;
  }

  function render() {
    boardEl.innerHTML = renderTable();
    scoreEl.textContent = String(state.scores[0]);
    roundEl.textContent = String(state.round + 1);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    passBtn.hidden = state.phase !== 'passing';
    passBtn.disabled = picked.length !== 3;
    if (state.phase === 'passing') passBtn.textContent = `Pass to ${PASS_TO[passDirection(state) as keyof typeof PASS_TO]}`;
    statusEl.textContent = statusText();

    if (state.phase === 'roundOver') showOverlay(boardEl, 'Round over', [['Next round', () => update(nextRound(state))]]);
    else if (state.phase === 'gameOver') {
      const won = winners(state);
      const title = won.length > 1 ? 'It’s a tie' : won[0] === 0 ? 'You win!' : `${SEAT_NAMES[won[0]]} wins`;
      showOverlay(boardEl, title, [['New game', startGame]]);
    } else hideOverlay(boardEl);
  }

  // --- Input ---

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-hand]');
    if (!el) return;
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    if (state.phase === 'passing') {
      picked = picked.some((p) => sameCard(p, c))
        ? picked.filter((p) => !sameCard(p, c))
        : [...picked, c].slice(-3);
      render();
    } else {
      update(play(state, 0, c));
    }
  });
  passBtn.addEventListener('click', () => {
    const next = passCards(state, picked);
    picked = [];
    update(next);
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.round > 0 || state.played.length > 0);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), startGame));
  levelBtns.forEach((b) =>
    b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })),
  );

  render();
  schedule();

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
