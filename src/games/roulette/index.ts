import { load, save } from '../../core/storage';
import {
  CHIPS,
  OUTSIDE,
  START_CHIPS,
  clear,
  colorOf,
  covers,
  isBroke,
  isValidState,
  newState,
  place,
  repeat,
  restart,
  setChip,
  spin,
  total,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'roulette:state';
const BEST_KEY = 'roulette:best';
/** How long the ball spins before the number shows. */
export const SPIN_DELAY = 1200;
/** Previous numbers shown beside the last one. */
const SHOWN = 6;

/** Red and black bets are drawn as diamonds of their color, like on a real table. */
const DIAMOND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 12 12 21 3 12Z"/></svg>';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CHIPS), state.chips + total(state.bets));
  let spinning = false;
  /** Best as shown: it waits for the spin to finish, so the stats don't give away the result. */
  let shownBest = best;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen rl">
      <div class="stats">
        <div class="stat"><small>Chips</small><b data-chips></b></div>
        <div class="stat"><small>Bet</small><b data-bet></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame rl-table" data-board></div>
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

  const pocket = (n: number, big = false) =>
    `<span class="rl-pocket ${colorOf(n)}${big ? ' big' : ''}" role="img" aria-label="${n} ${colorOf(n)}">${n}</span>`;

  /** One place to bet: a number, a column, a dozen or an even-money bet. */
  function spot(id: string, label: string, name: string, extra = '') {
    const amount = state.bets[id];
    const won = !total(state.bets) && state.history.length && !spinning && covers(id, state.history[0]) ? ' won' : '';
    const aria = `${name}${amount ? `, bet ${amount}` : ''}`;
    return `<button class="rl-spot${amount ? ' bet' : ''}${won}${extra}" data-spot="${id}" aria-label="${aria}"${spinning ? ' disabled' : ''}>${label}</button>`;
  }

  function renderTable() {
    const [last, ...earlier] = state.history;
    const result = spinning
      ? '<span class="rl-pocket big spinning" role="img" aria-label="Spinning">…</span>'
      : last !== undefined
        ? pocket(last, true) + earlier.slice(0, SHOWN).map((n) => pocket(n)).join('')
        : '<span class="rl-muted">Place your bets</span>';
    // Laid out like the table seen from the side: 0, then twelve columns of three.
    const numbers = [3, 2, 1]
      .map((rowTop) => {
        const cells = Array.from({ length: 12 }, (_, k) => {
          const n = 3 * k + rowTop;
          return spot(String(n), String(n), `${n} ${colorOf(n)}`, ` ${colorOf(n)}`);
        }).join('');
        const col = `c${rowTop}`;
        return cells + spot(col, '2:1', `${OUTSIDE[col].name}, pays 2 to 1`, ' outside');
      })
      .join('');
    const dozens = ['d1', 'd2', 'd3'].map((id) => spot(id, OUTSIDE[id].name, `${OUTSIDE[id].name}, pays 2 to 1`, ' outside dozen')).join('');
    const even = [
      ['low', '1–18'],
      ['even', 'Even'],
      ['red', DIAMOND],
      ['black', DIAMOND],
      ['odd', 'Odd'],
      ['high', '19–36'],
    ]
      .map(([id, label]) => spot(id, label, `${OUTSIDE[id].name}, pays even money`, ` outside even ${id}`))
      .join('');
    boardEl.innerHTML = `
      <div class="rl-result" data-result>${result}</div>
      <div class="rl-grid">${spot('0', '0', '0 green', ' green zero')}${numbers}${dozens}${even}</div>`;
  }

  function renderControls() {
    const chips = `<div class="segmented" aria-label="Chip">${CHIPS.map(
      (c) => `<button data-chip="${c}" aria-pressed="${c === state.chip}">${c}</button>`,
    ).join('')}</div>`;
    const onTable = total(state.bets) > 0;
    const second = onTable
      ? '<button class="btn secondary" data-clear>Clear</button>'
      : `<button class="btn secondary" data-repeat${repeat(state) ? '' : ' disabled'}>Repeat</button>`;
    const main = isBroke(state)
      ? '<button class="btn" data-restart>Start over</button>'
      : `<button class="btn" data-spin${onTable ? '' : ' disabled'}>Spin</button>`;
    controlsEl.innerHTML = spinning ? '' : chips + second + main;
  }

  function statusText(): string {
    if (spinning) return 'The ball is spinning…';
    const bets = Object.entries(state.bets);
    if (bets.length) {
      const names = bets.map(([id, amount]) => `${id in OUTSIDE ? OUTSIDE[id].name : id} (${amount})`);
      const list = bets.length <= 3 ? names.join(', ') : `${total(state.bets)} on ${bets.length} bets`;
      return `On the table: ${list}. Tap Spin.`;
    }
    const broke = isBroke(state) ? ` You’re out of chips. Tap Start over for ${START_CHIPS} more.` : '';
    if (!state.history.length) return `Choose a chip, then tap the table to bet. A number pays 35 to 1.${broke}`;
    const n = state.history[0];
    const net = state.paid - state.staked;
    const outcome = net > 0 ? `You win ${net}.` : net === 0 ? 'You break even.' : state.paid ? `You lose ${-net}.` : `No win: you lose ${state.staked}.`;
    return `${n} ${colorOf(n)}. ${outcome}${broke}`;
  }

  function render() {
    renderTable();
    renderControls();
    // While the ball spins, the stats still show the table as it was.
    if (!spinning) shownBest = best;
    container.querySelector('[data-chips]')!.textContent = String(spinning ? state.chips - state.paid : state.chips);
    container.querySelector('[data-bet]')!.textContent = String(spinning ? state.staked : total(state.bets));
    container.querySelector('[data-best]')!.textContent = String(shownBest);
    statusEl.textContent = statusText();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-spot]');
    if (el && !spinning) update(place(state, el.dataset.spot!));
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.chip) update(setChip(state, Number(el.dataset.chip)));
    else if (el.hasAttribute('data-clear')) update(clear(state));
    else if (el.hasAttribute('data-repeat')) update(repeat(state));
    else if (el.hasAttribute('data-restart')) update(restart(state));
    else {
      const next = spin(state);
      if (!next) return;
      // The result is decided (and saved) now; the wheel just takes a moment to show it.
      spinning = true;
      update(next);
      timer = window.setTimeout(() => {
        spinning = false;
        render();
      }, SPIN_DELAY);
    }
  });

  render();

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
