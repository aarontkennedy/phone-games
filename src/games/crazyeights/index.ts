import { cardBack, cardFace, suitSvg } from '../../core/card-view';
import { SUITS, cardId, cardName, sameCard, suitName, type Card, type Suit } from '../../core/cards';
import { load, save } from '../../core/storage';
import { SEAT_NAMES } from '../../core/tricks';
import { handHtml, seatsHtml } from '../../core/trick-view';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { showOverlay, hideOverlay, confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import { applyTurn, chooseTurn, draw, isValidState, newGame, nextRound, pass, play, playable, winner, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'crazyeights:state';
/** Pause before each computer turn. */
export const AI_DELAY = 700;

const lower = (c: Card) => cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase());
const capital = (w: string) => w[0].toUpperCase() + w.slice(1);

/** What a turn just did, for the recent moves list; null if nobody moved. */
export function moveText(prev: State, next: State): string | null {
  if (prev.phase !== 'playing') return null;
  const seat = prev.turn;
  const who = seat === 0 ? 'You' : SEAT_NAMES[seat];
  const had = prev.hands[seat].length;
  const has = next.hands[seat].length;
  if (has < had) {
    const c = next.lastPlay[seat]!;
    return `${who} played the ${lower(c)}${c.rank === 8 ? `: ${suitName(next.suit)} now` : ''}.`;
  }
  if (has > had) {
    if (seat !== 0) return `${who} drew a card.`;
    return `You drew the ${lower(next.hands[0].find((c) => !prev.hands[0].some((p) => sameCard(p, c)))!)}.`;
  }
  return next.turn !== seat ? `${who} passed.` : null;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** An 8 you tapped, waiting for you to name a suit. */
  let eight: Card | null = null;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards ce">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Deck</small><b data-stock></b></div>
      </div>
      <div class="board-frame tt-table" data-board></div>
      ${RECENT_HTML}
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="ce-actions" data-actions></div>
      </div>
    </div>${settingsHtml(levelSetting('Computer players'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'crazyeights');

  function update(next: State | null) {
    if (!next) return;
    recent.add(moveText(state, next));
    state = next;
    eight = null;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.phase === 'playing' && state.turn !== 0) {
      const seat = state.turn;
      timer = window.setTimeout(() => update(applyTurn(state, seat, chooseTurn(state, seat))), AI_DELAY);
    }
  }

  /** A new round or game starts with an empty list. */
  function start(next: State | null) {
    if (!next) return;
    state = next;
    recent.clear();
    update(next);
  }

  const myTurn = () => state.phase === 'playing' && state.turn === 0;
  const canDraw = () => myTurn() && !playable(state, 0).length && state.stock.length + state.discard.length > 1;
  const mustPass = () => myTurn() && !playable(state, 0).length && !canDraw();

  function render() {
    const seats = seatsHtml((seat) => ({
      info: `${state.hands[seat].length} left<span class="tt-muted"> · ${state.scores[seat]} pts</span>`,
      card: state.lastPlay[seat] ?? undefined,
      turn: state.phase === 'playing' && state.turn === seat,
    }));
    const top = state.discard.at(-1)!;
    const changed = top.rank === 8;
    const middle = `<div class="ce-middle">
      <div class="ce-pile"><span>Deck</span>${cardBack({ button: canDraw(), attrs: 'data-draw', label: 'Draw a card' })}</div>
      <div class="ce-pile"><span>Top card</span>${cardFace(top)}</div>
      ${changed ? `<div class="ce-pile ce-suit${state.suit === 'H' || state.suit === 'D' ? ' red' : ''}"><span>Suit now</span>${suitSvg(state.suit)}<b>${capital(suitName(state.suit))}</b></div>` : ''}
    </div>`;
    boardEl.innerHTML = seats + middle + handHtml(state.hands[0], { playable: myTurn() ? playable(state, 0) : [], picked: eight ? [eight] : [] });

    container.querySelector('[data-score]')!.textContent = String(state.scores[0]);
    container.querySelector('[data-stock]')!.textContent = String(state.stock.length);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    actionsEl.innerHTML = eight
      ? SUITS.map((x) => `<button class="btn secondary ce-pick${x === 'H' || x === 'D' ? ' red' : ''}" data-suit="${x}" aria-label="${capital(suitName(x))}">${suitSvg(x)}</button>`).join('')
      : canDraw()
        ? '<button class="btn" data-draw>Draw</button>'
        : mustPass()
          ? '<button class="btn" data-pass>Pass</button>'
          : '';
    statusEl.textContent = statusText(top);

    if (state.phase === 'roundOver') {
      showOverlay(boardEl, state.last!.seat === 0 ? 'You win the round!' : `${SEAT_NAMES[state.last!.seat]} wins the round`, [['Next round', () => start(nextRound(state))]]);
    } else if (state.phase === 'gameOver') {
      showOverlay(boardEl, winner(state) === 0 ? 'You win!' : `${SEAT_NAMES[winner(state)!]} wins`, [['New game', () => start(newGame(state.level))]]);
    } else hideOverlay(boardEl);
  }

  function statusText(top: Card): string {
    if (state.phase !== 'playing') {
      const { seat, points } = state.last!;
      const who = seat === 0 ? 'You' : SEAT_NAMES[seat];
      return `${who} played the last card and ${seat === 0 ? 'score' : 'scores'} ${points} for the cards left in the other hands.`;
    }
    if (state.turn !== 0) return `${SEAT_NAMES[state.turn]} is playing…`;
    if (eight) return 'Name the next suit.';
    const suit = `a ${suitName(state.suit).slice(0, -1)}`; // "a heart"
    const rank = top.rank === 1 ? 'an ace' : top.rank > 10 ? `a ${lower(top).split(' ')[0]}` : `a ${top.rank}`;
    const match = top.rank === 8 ? suit : `${suit} or ${rank}`;
    if (mustPass()) return 'You can’t play and the deck is empty: tap Pass.';
    if (canDraw()) return `You have nothing to play on the ${lower(top)}. Draw a card.`;
    return `Your turn: play ${match}, or an 8.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-hand], [data-draw]');
    if (!el) return;
    if (el.hasAttribute('data-draw')) return update(draw(state, 0));
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    if (c.rank === 8) {
      eight = eight && sameCard(eight, c) ? null : c;
      render();
    } else update(play(state, 0, c));
  });
  actionsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.suit) update(play(state, 0, eight!, el.dataset.suit as Suit));
    else if (el.hasAttribute('data-draw')) update(draw(state, 0));
    else update(pass(state, 0));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.scores.some((n) => n > 0) || state.lastPlay.some(Boolean));
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => start(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
