import { cardFace } from '../../core/card-view';
import { load, save } from '../../core/storage';
import {
  BETS,
  START_CHIPS,
  canPlay,
  deal,
  describeLow,
  isBroke,
  isJoker,
  isValidState,
  newState,
  play,
  rankHigh,
  restart,
  setBet,
  split,
  toggleLow,
  useHint,
  value,
  type PgCard,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'paigow:state';
const BEST_KEY = 'paigow:best';

/** The joker: a flat star where the rank and suit would be. */
const STAR = '<svg class="suit" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6Z"/></svg>';

function face(c: PgCard, button = false, attrs = '', className = ''): string {
  if (!isJoker(c)) return cardFace(c, { button, attrs, className });
  const tag = button ? 'button' : 'div';
  return `<${tag} class="card joker ${className}" data-card="joker" aria-label="Joker"${button ? '' : ' role="img"'} ${attrs}>
    <span class="card-corner">${STAR}</span><span class="card-pip">${STAR}</span></${tag}>`;
}

const LETTERS = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
/** A short name to go under a two-card hand: "Pair" or "A-9". */
function lowCaption(cards: PgCard[]): string {
  const [a, b] = cards.map(value).sort((x, y) => y - x);
  return a === b ? 'Pair' : `${LETTERS[a]}-${LETTERS[b]}`;
}
const lower = (s: string) => s[0].toLowerCase() + s.slice(1);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CHIPS), state.chips);

  container.innerHTML = `
    <div class="screen cards pg">
      <div class="stats">
        <div class="stat"><small>Chips</small><b data-chips></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame pg-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    if (state.chips > best) {
      best = state.chips;
      save(BEST_KEY, best);
    }
    save(STATE_KEY, state);
    render();
  }

  /** A set hand: the five-card high hand, a gap, then the two-card low hand, each named. */
  function setHand(cards: PgCard[], low: number[], who: string, won: [boolean | null, boolean | null]) {
    const hand = split(cards, low);
    const ring = (w: boolean | null) => (w ? ' won' : '');
    return `<div class="pg-set">
      <div class="pg-five${ring(won[0])}" aria-label="${who} high hand: ${rankHigh(hand.high).name}" role="group">${hand.high.map((c) => face(c)).join('')}</div>
      <div class="pg-two${ring(won[1])}" aria-label="${who} low hand: ${describeLow(hand.low)}" role="group">${hand.low.map((c) => face(c)).join('')}</div>
      <p class="pg-caption">${rankHigh(hand.high).name.split(',')[0]}</p>
      <p class="pg-caption">${lowCaption(hand.low)}</p>
    </div>`;
  }

  function render() {
    const done = state.phase === 'done';
    let dealer = '';
    let you = '';
    if (state.phase === 'betting') {
      dealer = '<p class="pg-empty">Seven cards each</p>';
    } else if (done) {
      dealer = setHand(state.dealer, state.dealerLow, 'Dealer’s', [!state.highWon, !state.lowWon]);
      you = setHand(state.hand, state.low, 'Your', [state.highWon, state.lowWon]);
    } else {
      dealer = `<div class="pg-seven">${state.dealer.map(() => '<div class="card back" role="img" aria-label="Face-down card"></div>').join('')}</div>`;
      you = `<div class="pg-seven">${state.hand
        .map((c, i) => {
          const picked = state.low.includes(i);
          const card = face(c, true, `data-pick="${i}" aria-pressed="${picked}"`, picked ? 'picked' : '');
          return `<div class="pg-slot">${card}<span class="pg-mark">${picked ? 'Low' : ''}</span></div>`;
        })
        .join('')}</div>`;
    }
    boardEl.innerHTML = `
      <div class="pg-side"><p class="pg-label">Dealer</p>${dealer}</div>
      <div class="pg-side"><p class="pg-label">You</p>${you}</div>`;

    controlsEl.innerHTML =
      state.phase === 'setting'
        ? `<button class="btn secondary" data-hint>Hint</button><button class="btn" data-play${canPlay(state) ? '' : ' disabled'}>Play</button>`
        : `<div class="segmented" aria-label="Bet">${BETS.map(
            (b) => `<button data-bet="${b}" aria-pressed="${b === state.bet}"${b > state.chips ? ' disabled' : ''}>${b}</button>`,
          ).join('')}</div>
           <button class="btn" data-deal>${isBroke(state) ? 'Start over' : 'Deal'}</button>`;
    container.querySelector('[data-chips]')!.textContent = String(state.chips);
    container.querySelector('[data-best]')!.textContent = String(best);
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    if (state.phase === 'betting') return 'Choose a bet and tap Deal. Win both hands to win your bet, less 5%.';
    if (state.phase === 'setting') {
      if (state.low.length < 2) return 'Tap two cards for your low hand. The other five make your high hand.';
      const mine = split(state.hand, state.low);
      if (!canPlay(state)) return 'Your high hand must beat your low hand: pick two other cards.';
      return `High: ${lower(rankHigh(mine.high).name)}. Low: ${lower(describeLow(mine.low))}. Tap Play.`;
    }
    const each = `High hand: ${state.highWon ? 'you win' : 'dealer wins'}. Low hand: ${state.lowWon ? 'you win' : 'dealer wins'}.`;
    const result =
      state.result === 'win'
        ? ` You win ${state.bet}, less ${state.bet / 20} commission.`
        : state.result === 'push'
          ? ' A push: your bet comes back.'
          : ` You lose ${state.bet}.`;
    const broke = isBroke(state) ? ` You’re out of chips. Tap Start over for ${START_CHIPS} more.` : '';
    return each + result + broke;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-pick]');
    if (el) update(toggleLow(state, Number(el.dataset.pick)));
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) update(useHint(state));
    else if (el.hasAttribute('data-play')) update(play(state));
    else if (el.dataset.bet) update(setBet(state, Number(el.dataset.bet)));
    else if (el.hasAttribute('data-deal')) update(isBroke(state) ? restart(state) : deal(state));
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
