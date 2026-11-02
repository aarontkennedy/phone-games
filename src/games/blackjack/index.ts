import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { load, save } from '../../core/storage';
import {
  BETS,
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
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CHIPS), state.chips);
  /** Whether you asked for a hint on this decision. Cleared by your next move. */
  let showHint = false;

  container.innerHTML = `
    <div class="screen cards bj">
      <div class="stats">
        <div class="stat"><small>Chips</small><b data-chips></b></div>
        <button class="btn secondary bj-hint" data-hint aria-label="Hint" hidden>${BULB_ICON}</button>
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
  const hintBtn = container.querySelector<HTMLButtonElement>('[data-hint]')!;

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

  function renderHand(label: string, cardsHtml: string, extra = '', active = false) {
    return `<div class="bj-hand${active ? ' active' : ''}">
      <p class="bj-label">${label}${extra}</p>
      <div class="bj-cards">${cardsHtml}</div>
    </div>`;
  }

  function renderTable(): string {
    if (!state.hands.length) {
      const empty = cardSlot() + cardSlot();
      return renderHand('Dealer', empty) + `<div class="bj-player">${renderHand('You', empty)}</div>`;
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
    return renderHand(dealerLabel, dealerCards) + `<div class="bj-player">${hands}</div>`;
  }

  function renderControls() {
    if (state.phase === 'playing') {
      controlsEl.innerHTML = `<div class="bj-actions">${ACTIONS.map(
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
    if (state.phase === 'playing') {
      const tip = hint(state);
      return showHint && tip
        ? `Hint: the best play here is to ${tip}.`
        : 'Hit to take a card, or stand to keep your total.';
    }
    if (state.phase === 'betting') return 'Choose a bet and tap Deal. Blackjack pays 3 to 2.';
    const net = state.hands.reduce((sum, h) => sum + h.payout! - h.bet, 0);
    const parts: string[] = [];
    if (state.hands.some((h) => h.outcome === 'blackjack')) parts.push('Blackjack!');
    else if (handValue(state.dealer).total > 21) parts.push('Dealer busts.');
    parts.push(net > 0 ? `You win ${net}.` : net < 0 ? `You lose ${-net}.` : 'Push: your bet comes back.');
    if (isBroke(state)) parts.push(`You're out of chips. Tap Start over for ${START_CHIPS} more.`);
    return parts.join(' ');
  }

  function render() {
    boardEl.innerHTML = renderTable();
    renderControls();
    chipsEl.textContent = String(state.chips);
    bestEl.textContent = String(best);
    statusEl.textContent = statusText();
    // Only while a hand is in play: a narrow icon, so the stats still fit one row sideways.
    hintBtn.hidden = state.phase !== 'playing';
  }

  // --- Input ---

  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-deal')) update(isBroke(state) ? restart(state) : deal(state));
    else if (el.dataset.action) update(act(state, el.dataset.action as Action));
    else if (el.dataset.bet) update(setBet(state, Number(el.dataset.bet)));
  });
  hintBtn.addEventListener('click', () => {
    showHint = true;
    render();
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
