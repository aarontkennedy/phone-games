import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { load, save } from '../../core/storage';
import {
  BETS,
  DECK_CHOICES,
  START_CHIPS,
  act,
  canAct,
  deal,
  handValue,
  hint,
  isBlackjack,
  isBroke,
  isValidState,
  newState,
  points,
  restart,
  setBet,
  setDecks,
  upgrade,
  type Action,
  type Hand,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'blackjack:state';
/** A flat light bulb, for Hint. */
const BULB_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/></svg>';
const BEST_KEY = 'blackjack:best';
/** How many of your plays matched the best play (see strategy.ts), over all your hands. */
const ACCURACY_KEY = 'blackjack:accuracy';

interface Accuracy {
  right: number;
  plays: number;
}

const isAccuracy = (a: unknown): a is Accuracy =>
  !!a && Number.isInteger((a as Accuracy).right) && Number.isInteger((a as Accuracy).plays) && (a as Accuracy).right <= (a as Accuracy).plays;

const ACTIONS: [Action, string][] = [
  ['hit', 'Hit'],
  ['stand', 'Stand'],
  ['double', 'Double'],
  ['split', 'Split'],
];

/** "Soft 17", "Bust", "Blackjack" or just the total. */
function describe(cards: Hand['cards'], split = false): string {
  const { total, soft } = handValue(cards);
  if (total > 21) return 'Bust';
  if (isBlackjack(cards, split)) return 'Blackjack';
  return soft && total < 21 ? `Soft ${total}` : String(total);
}

export function mount(container: HTMLElement): () => void {
  const saved = upgrade(load<unknown>(STATE_KEY, null));
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CHIPS), state.chips);
  const savedAccuracy = load<unknown>(ACCURACY_KEY, null);
  const accuracy: Accuracy = isAccuracy(savedAccuracy) ? savedAccuracy : { right: 0, plays: 0 };
  /** Whether you asked for a hint on this decision. Cleared by your next move. */
  let showHint = false;
  /** The best play, when your last play wasn't it. */
  let missed: Action | null = null;

  container.innerHTML = `
    <div class="screen cards bj">
      <div class="stats">
        <div class="stat"><small>Chips</small><b data-chips></b></div>
        <div class="stat"><small>Right</small><b data-accuracy></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame bj-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const chipsEl = container.querySelector<HTMLElement>('[data-chips]')!;
  const bestEl = container.querySelector<HTMLElement>('[data-best]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const accuracyEl = container.querySelector<HTMLElement>('[data-accuracy]')!;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    showHint = false;
    if (state.chips > best) {
      best = state.chips;
      save(BEST_KEY, best);
    }
    save(STATE_KEY, state);
    render();
  }

  // --- Rendering ---

  function renderHand(label: string, cardsHtml: string, extra = '', active = false, side = '') {
    return `<div class="bj-hand${active ? ' active' : ''}">
      <div class="bj-top"><p class="bj-label">${label}${extra}</p>${side}</div>
      <div class="bj-cards">${cardsHtml}</div>
    </div>`;
  }

  /** The number of decks, top right of the table: a button to change it between hands. */
  function decksHtml(): string {
    const text = `${state.decks} ${state.decks === 1 ? 'deck' : 'decks'}`;
    return state.phase === 'playing'
      ? `<span class="bj-decks">${text}</span>`
      : `<button class="btn secondary bj-decks" data-decks aria-label="${text}. Tap to change.">${text}</button>`;
  }

  function renderTable(): string {
    if (!state.hands.length) {
      const empty = cardSlot() + cardSlot();
      return renderHand('Dealer', empty, '', false, decksHtml()) + `<div class="bj-player">${renderHand('You', empty)}</div>`;
    }
    const hidden = state.phase === 'playing';
    const [up, hole, ...rest] = state.dealer;
    const dealerCards = cardFace(up) + (hidden ? cardBack() : cardFace(hole)) + rest.map((c) => cardFace(c)).join('');
    const dealerLabel = hidden
      ? `Dealer shows <b>${up.rank === 1 ? 'an ace' : points(up)}</b>`
      : `Dealer <b>${describe(state.dealer)}</b>`;

    const hands = state.hands
      .map((h, i) => {
        const name = state.hands.length > 1 ? `Hand ${i + 1}` : 'You';
        const active = state.phase === 'playing' && i === state.active;
        const net = h.payout !== undefined ? h.payout - h.bet : 0;
        const result =
          h.outcome === undefined
            ? ''
            : ` <span class="bj-result ${net > 0 ? 'won' : net < 0 ? 'lost' : ''}">${
                net > 0 ? `+${net}` : net < 0 ? String(net) : 'Push'
              }</span>`;
        return renderHand(
          `${name} <b>${describe(h.cards, h.split)}</b> <span class="bj-bet">Bet ${h.bet}</span>`,
          h.cards.map((c) => cardFace(c)).join(''),
          result,
          active,
        );
      })
      .join('');
    return renderHand(dealerLabel, dealerCards, '', false, decksHtml()) + `<div class="bj-player">${hands}</div>`;
  }

  function renderControls() {
    if (state.phase === 'playing') {
      // The hint sits just above the buttons it's about, and doesn't replace the instructions.
      const tip = hint(state);
      const coach = showHint && tip
        ? `<p class="bj-tip" data-tip>${BULB_ICON}<span>Best play: <b>${new Map(ACTIONS).get(tip)}</b></span></p>`
        : `<button class="btn secondary bj-hint" data-hint>${BULB_ICON}<span>Hint</span></button>`;
      controlsEl.innerHTML = `<div class="bj-coach">${coach}</div><div class="bj-actions">${ACTIONS.map(
        ([a, label]) => `<button class="btn secondary" data-action="${a}"${canAct(state, a) ? '' : ' disabled'}>${label}</button>`,
      ).join('')}</div>`;
      return;
    }
    // Deal sits with the bets at the bottom, under the thumb: it's tapped every hand.
    controlsEl.innerHTML = `
      <div class="segmented" aria-label="Bet">
        ${BETS.map(
          (b) =>
            `<button data-bet="${b}" aria-pressed="${b === state.bet}"${b > state.chips ? ' disabled' : ''}>${b}</button>`,
        ).join('')}
      </div>
      <button class="btn" data-deal>${isBroke(state) ? 'Start over' : 'Deal'}</button>`;
  }

  function statusText(): string {
    const lesson = missed ? `Best was to ${missed}. ` : '';
    if (state.phase === 'playing') return `${lesson}Hit for another card, or stand.`;
    if (state.phase === 'betting') return 'Choose a bet and tap Deal. Blackjack pays 3 to 2.';
    const net = state.hands.reduce((sum, h) => sum + h.payout! - h.bet, 0);
    const parts: string[] = [];
    if (state.hands.some((h) => h.outcome === 'blackjack')) parts.push('Blackjack!');
    else if (handValue(state.dealer).total > 21) parts.push('Dealer busts.');
    parts.push(net > 0 ? `You win ${net}.` : net < 0 ? `You lose ${-net}.` : 'Push: your bet comes back.');
    if (isBroke(state)) parts.push(`You're out of chips. Tap Start over for ${START_CHIPS} more.`);
    else if (missed) parts.push(lesson.trim());
    return parts.join(' ');
  }

  function render() {
    boardEl.innerHTML = renderTable();
    renderControls();
    chipsEl.textContent = String(state.chips);
    bestEl.textContent = String(best);
    accuracyEl.textContent = accuracy.plays ? `${Math.round((100 * accuracy.right) / accuracy.plays)}%` : '–';
    statusEl.textContent = statusText();
  }

  /** Scores a play against the best one, unless you looked at the hint first. */
  function score(action: Action) {
    const bestPlay = hint(state);
    missed = null;
    if (showHint || !bestPlay) return;
    accuracy.plays++;
    if (action === bestPlay) accuracy.right++;
    else missed = bestPlay;
    save(ACCURACY_KEY, accuracy);
  }

  // --- Input ---

  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) {
      showHint = true;
      render();
    } else if (el.hasAttribute('data-deal')) {
      missed = null;
      update(isBroke(state) ? restart(state) : deal(state));
    } else if (el.dataset.action) {
      const action = el.dataset.action as Action;
      const next = act(state, action);
      if (next) score(action);
      update(next);
    } else if (el.dataset.bet) update(setBet(state, Number(el.dataset.bet)));
  });
  boardEl.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-decks]')) return;
    const i = DECK_CHOICES.indexOf(state.decks as (typeof DECK_CHOICES)[number]);
    update(setDecks(state, DECK_CHOICES[(i + 1) % DECK_CHOICES.length]));
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
