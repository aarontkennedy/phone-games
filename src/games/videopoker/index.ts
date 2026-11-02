import { cardFace, cardSlot } from '../../core/card-view';
import { bestHand, describeHand } from '../../core/poker';
import { load, save } from '../../core/storage';
import { MAX_BET, PAYS, START_CREDITS, deal, draw, isBroke, isValidState, newState, payout, restart, setBet, toggleHold, winOf, type State } from './logic';
import './style.css';

const STATE_KEY = 'videopoker:state';
const BEST_KEY = 'videopoker:best';
const BETS = Array.from({ length: MAX_BET }, (_, i) => i + 1);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CREDITS), state.credits);

  container.innerHTML = `
    <div class="screen cards vp">
      <div class="stats">
        <div class="stat"><small>Credits</small><b data-credits></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame vp-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    if (state.credits > best) {
      best = state.credits;
      save(BEST_KEY, best);
    }
    save(STATE_KEY, state);
    render();
  }

  function render() {
    const rows = PAYS.map(
      ([win, name]) =>
        `<li class="${state.phase === 'done' && state.win === win ? 'won' : ''}"><span>${name}</span><b>${payout(win, state.bet)}</b></li>`,
    ).join('');
    const holding = state.phase === 'holding';
    const hand = state.hand.length
      ? state.hand
          .map((c, i) => {
            const held = holding || state.phase === 'done' ? state.held[i] : false;
            const card = cardFace(c, { button: true, className: held ? 'held' : '', attrs: `data-card-index="${i}" aria-pressed="${held}"${holding ? '' : ' disabled'}` });
            return `<div class="vp-slot">${card}<span class="vp-held">${held ? 'Held' : ''}</span></div>`;
          })
          .join('')
      : Array.from({ length: 5 }, () => `<div class="vp-slot">${cardSlot()}<span class="vp-held"></span></div>`).join('');
    boardEl.innerHTML = `<ul class="vp-pays" aria-label="Pays for a bet of ${state.bet}">${rows}</ul><div class="vp-hand">${hand}</div>`;
    container.querySelector('[data-credits]')!.textContent = String(state.credits);
    container.querySelector('[data-best]')!.textContent = String(best);
    controlsEl.innerHTML = holding
      ? '<button class="btn" data-draw>Draw</button>'
      : `<div class="segmented" aria-label="Bet">${BETS.map((b) => `<button data-bet="${b}" aria-pressed="${b === state.bet}">${b}</button>`).join('')}</div>
         <button class="btn" data-deal>${isBroke(state) ? 'Start over' : 'Deal'}</button>`;
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    if (state.phase === 'betting') return 'Choose a bet of 1 to 5 credits and tap Deal.';
    const now = describeHand(bestHand(state.hand));
    if (state.phase === 'holding') {
      const pays = winOf(state.hand) ? ` You already have a winner: ${now.toLowerCase()}.` : '';
      return `Tap the cards to keep, then tap Draw.${pays}`;
    }
    const broke = isBroke(state) ? ` You’re out of credits. Tap Start over for ${START_CREDITS} more.` : '';
    return state.win ? `${now}: you win ${state.paid}.${broke}` : `${now}: no win.${broke}`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-card-index]');
    if (el) update(toggleHold(state, Number(el.dataset.cardIndex)));
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-draw')) update(draw(state));
    else if (el.dataset.bet) update(setBet(state, Number(el.dataset.bet)));
    else update(isBroke(state) ? restart(state) : deal(state));
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
