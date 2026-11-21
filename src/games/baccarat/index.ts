import { cardFace, cardSlot } from '../../core/card-view';
import { coach } from '../../core/coach';
import { load, save } from '../../core/storage';
import { CHIPS, START_CHIPS, clear, deal, handTotal, isBroke, isValidState, newState, place, restart, setChip, total, type Spot, type State } from './logic';
import './style.css';

const STATE_KEY = 'baccarat:state';
const BEST_KEY = 'baccarat:best';

const NAMES: Record<Spot, string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };
const PAYS: Record<Spot, string> = { player: 'pays 1 to 1', banker: 'pays 19 to 20', tie: 'pays 8 to 1' };

/** The best bet now (HTML), and the spots to outline. */
function advice(s: State): { text: string; spots: Spot[] } {
  const edges = 'The house keeps about 1.06% of Banker bets (after its 5% commission), 1.24% of Player bets and 14.4% of Tie bets.';
  if (s.bets.tie) return { text: `Best: take the <b>Tie</b> bet down (Clear) and bet <b>Banker</b>. ${edges}`, spots: ['banker'] };
  if (s.bets.banker && !s.bets.player) return { text: 'Best: <b>Deal</b>. Banker is the best bet on the table.', spots: [] };
  return { text: `Best: bet on <b>Banker</b>. ${edges}`, spots: ['banker'] };
}

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CHIPS), state.chips);
  /** Hint: the best bet, by the house's share. No Right score, like Craps: there are better
   *  and worse bets rather than one right one (src/core/coach.ts). */
  const coaching = coach('baccarat');

  container.innerHTML = `
    <div class="screen cards bc">
      <div class="stats">
        <div class="stat"><small>Chips</small><b data-chips></b></div>
        <div class="stat"><small>Bet</small><b data-bet></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame bc-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    coaching.asked = false;
    state = next;
    if (state.chips > best) save(BEST_KEY, (best = state.chips));
    save(STATE_KEY, state);
    render();
  }

  function hand(name: Spot, cards: State['player']) {
    const won = state.winner === name;
    const shown = cards.length ? cards.map((c) => cardFace(c)).join('') : cardSlot() + cardSlot();
    const count = cards.length ? ` <b>${handTotal(cards)}</b>` : '';
    return `<div class="bc-hand${won ? ' won' : ''}"><p class="bc-label">${NAMES[name]}${count}</p><div class="bc-cards">${shown}</div></div>`;
  }

  function render() {
    const hinted = coaching.asked && !isBroke(state) ? advice(state).spots : [];
    const spots = (['player', 'tie', 'banker'] as const)
      .map((x) => {
        const amount = state.bets[x];
        const hint = hinted.includes(x) ? ' hint' : '';
        return `<button class="bc-spot${amount ? ' on' : ''}${hint}" data-spot="${x}" aria-label="${NAMES[x]}, ${PAYS[x]}${amount ? `, bet ${amount}` : ''}">
          <span>${NAMES[x]}</span><small>${PAYS[x]}</small><b>${amount || ''}</b></button>`;
      })
      .join('');
    boardEl.innerHTML = `<div class="bc-hands">${hand('player', state.player)}${hand('banker', state.banker)}</div><div class="bc-spots">${spots}</div>`;
    container.querySelector('[data-chips]')!.textContent = String(state.chips);
    container.querySelector('[data-bet]')!.textContent = String(total(state.bets));
    container.querySelector('[data-best]')!.textContent = String(best);
    const chips = `<div class="segmented" aria-label="Chip">${CHIPS.map((c) => `<button data-chip="${c}" aria-pressed="${c === state.chip}">${c}</button>`).join('')}</div>`;
    controlsEl.innerHTML = isBroke(state)
      ? '<button class="btn" data-restart>Start over</button>'
      : `${coaching.html(coaching.asked ? advice(state).text : '')}${chips}<button class="btn secondary" data-clear${total(state.bets) ? '' : ' disabled'}>Clear</button><button class="btn" data-deal${total(state.bets) ? '' : ' disabled'}>Deal</button>`;
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    const next = 'Tap Player, Banker or Tie to bet, then tap Deal.';
    if (!state.winner) return next;
    const p = handTotal(state.player);
    const b = handTotal(state.banker);
    const natural = (state.player.length === 2 && p >= 8) || (state.banker.length === 2 && b >= 8) ? ' A natural.' : '';
    const result = state.winner === 'tie' ? `A tie, ${p} each.` : `${NAMES[state.winner]} wins, ${Math.max(p, b)} to ${Math.min(p, b)}.`;
    const net = state.paid - state.staked;
    const money = net > 0 ? ` You win ${net}.` : net < 0 ? ` You lose ${-net}.` : ' Your bets come back.';
    const broke = isBroke(state) ? ` You’re out of chips. Tap Start over for ${START_CHIPS} more.` : '';
    return `${result}${natural}${money}${broke}`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-spot]');
    if (el) update(place(state, el.dataset.spot as Spot));
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) {
      coaching.asked = true;
      render();
    } else if (el.dataset.chip) update(setChip(state, Number(el.dataset.chip)));
    else if (el.hasAttribute('data-clear')) update(clear(state));
    else if (el.hasAttribute('data-restart')) update(restart(state));
    else if (el.hasAttribute('data-deal')) update(deal(state));
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
