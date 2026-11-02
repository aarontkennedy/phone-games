import { dieFace } from '../../core/dice-view';
import { load, save } from '../../core/storage';
import {
  CHIPS,
  NAMES,
  POINTS,
  START_CHIPS,
  isBroke,
  isValidState,
  newState,
  oddsRoom,
  onTable,
  place,
  restart,
  roll,
  setChip,
  takeDown,
  type Kind,
  type LineBet,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'craps:state';
const BEST_KEY = 'craps:best';
/** How long the dice tumble before the roll shows. */
export const ROLL_DELAY = 700;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newState();
  let best = Math.max(load(BEST_KEY, START_CHIPS), state.chips + onTable(state));
  /** The table before the roll in progress, shown while the dice tumble. */
  let before: State | null = null;
  let timer: number | undefined;
  /** Best as shown: it waits for the dice to land, so the stats don't give away the roll. */
  let shownBest = best;

  container.innerHTML = `
    <div class="screen cr">
      <div class="stats">
        <div class="stat"><small>Chips</small><b data-chips></b></div>
        <div class="stat"><small>Bet</small><b data-bet></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame cr-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    if (state.chips + onTable(state) > best) {
      best = state.chips + onTable(state);
      save(BEST_KEY, best);
    }
    save(STATE_KEY, state);
    render();
  }

  const amount = (b: LineBet | undefined) => (!b ? '' : b.odds ? `${b.flat} · odds ${b.odds}` : String(b.flat));
  const describe = (b: LineBet | undefined) => (!b ? '' : `, bet ${b.flat}${b.odds ? ` with ${b.odds} odds` : ''}`);

  /** A bet area: tap to bet, or to add odds once the bet has a number. */
  function area(kind: Kind, s: State, rolling: boolean) {
    const line = kind === 'pass' || kind === 'dontPass';
    const bet = s.bets.find((b) => b.kind === kind && (line || b.point === null));
    let target = '';
    if (line) target = s.point === null ? kind : bet && oddsRoom(s, bet) > 0 ? `odds:${kind}` : '';
    else target = s.point !== null ? kind : '';
    const odds = target.startsWith('odds:') ? ', tap to add odds' : '';
    return `<button class="cr-bet${bet ? ' on' : ''}" data-target="${target}" aria-label="${NAMES[kind]}${describe(bet)}${odds}"${target && !rolling ? '' : ' disabled'}>
      <span>${NAMES[kind]}</span><b>${amount(bet)}</b></button>`;
  }

  function renderTable(s: State, rolling: boolean) {
    const dice = rolling || !s.dice ? [0, 0] : s.dice;
    const diceHtml = dice
      .map((d) => (d ? `<span class="cr-die" role="img" aria-label="Die showing ${d}">${dieFace(d)}</span>` : `<span class="cr-die blank" role="img" aria-label="${rolling ? 'Rolling' : 'Not rolled yet'}"></span>`))
      .join('');
    const numbers = POINTS.map((p) => {
      const bets = s.bets.filter((b) => (b.kind === 'come' || b.kind === 'dontCome') && b.point === p);
      const sum = bets.reduce((t, b) => t + b.flat + b.odds, 0);
      const room = bets.some((b) => oddsRoom(s, b) > 0);
      const what = bets.map((b) => `${NAMES[b.kind]}${describe(b)}`).join(', ');
      const label = `${p}${s.point === p ? ', the point' : ''}${what ? `: ${what}${room ? ', tap to add odds' : ''}` : ''}`;
      return `<button class="cr-number${s.point === p ? ' point' : ''}${bets.length ? ' on' : ''}" data-target="odds:${p}" aria-label="${label}"${room && !rolling ? '' : ' disabled'}>
        <span>${p}</span><b>${sum || ''}</b></button>`;
    }).join('');
    const field = `<button class="cr-bet field${s.field ? ' on' : ''}" data-target="field" aria-label="Field: 2, 3, 4, 9, 10, 11 or 12${s.field ? `, bet ${s.field}` : ''}"${rolling ? ' disabled' : ''}>
      <span>Field 2 3 4 9 10 11 12</span><b>${s.field || ''}</b></button>`;
    boardEl.innerHTML = `
      <div class="cr-top"><div class="cr-dice">${diceHtml}</div>
        <p class="cr-puck${s.point ? ' on' : ''}">${s.point ? `Point <b>${s.point}</b>` : 'No point'}</p></div>
      <div class="cr-numbers">${numbers}</div>
      <div class="cr-bets">${area('pass', s, rolling)}${area('dontPass', s, rolling)}${area('come', s, rolling)}${area('dontCome', s, rolling)}${field}</div>`;
  }

  function renderControls(rolling: boolean) {
    if (rolling) {
      controlsEl.innerHTML = '';
      return;
    }
    const chips = `<div class="segmented" aria-label="Chip">${CHIPS.map(
      (c) => `<button data-chip="${c}" aria-pressed="${c === state.chip}">${c}</button>`,
    ).join('')}</div>`;
    const main = isBroke(state) ? '<button class="btn" data-restart>Start over</button>' : '<button class="btn" data-roll>Roll</button>';
    controlsEl.innerHTML = `${chips}<button class="btn secondary" data-clear${takeDown(state) ? '' : ' disabled'}>Clear</button>${main}`;
  }

  function statusText(): string {
    if (before) return 'Rolling…';
    const next =
      state.point === null
        ? 'Come-out roll: bet the pass line or don’t pass, then tap Roll.'
        : `The point is ${state.point}: pass wins if it comes before a 7. Tap a bet to add odds.`;
    if (!state.dice) return next;
    const total = state.dice[0] + state.dice[1];
    const results = state.outcomes;
    let what = '';
    if (results.length > 2) {
      const net = results.reduce((t, o) => t + o.net, 0);
      what = net > 0 ? ` You win ${net}.` : net < 0 ? ` You lose ${-net}.` : ' You break even.';
    } else {
      what = results
        .map((o) => ` ${o.moved ? `${o.name} moves to ${o.moved}` : o.net > 0 ? `${o.name} wins ${o.net}` : o.net < 0 ? `${o.name} loses ${-o.net}` : `${o.name} ties`}.`)
        .join('');
    }
    const broke = isBroke(state) ? ` You’re out of chips. Tap Start over for ${START_CHIPS} more.` : '';
    const point = state.point === null ? '' : ` The point is ${state.point}.`;
    return `Rolled ${total}.${what}${broke || point || ' New come-out roll.'}`;
  }

  function render() {
    const shown = before ?? state;
    renderTable(shown, !!before);
    renderControls(!!before);
    container.querySelector('[data-chips]')!.textContent = String(shown.chips);
    container.querySelector('[data-bet]')!.textContent = String(onTable(shown));
    if (!before) shownBest = best;
    container.querySelector('[data-best]')!.textContent = String(shownBest);
    statusEl.textContent = statusText();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-target]');
    if (el && !before) update(place(state, el.dataset.target!));
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.chip) update(setChip(state, Number(el.dataset.chip)));
    else if (el.hasAttribute('data-clear')) update(takeDown(state));
    else if (el.hasAttribute('data-restart')) update(restart(state));
    else if (el.hasAttribute('data-roll')) {
      // The roll is decided (and saved) now; the dice just take a moment to land.
      before = state;
      update(roll(state));
      timer = window.setTimeout(() => {
        before = null;
        render();
      }, ROLL_DELAY);
    }
  });

  render();

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
