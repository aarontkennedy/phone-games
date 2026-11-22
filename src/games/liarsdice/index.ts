import { coach } from '../../core/coach';
import { dieFace } from '../../core/dice-view';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { load, save } from '../../core/storage';
import { confirmNew, hideOverlay, levelSetting, settingsHtml, showOverlay } from '../../core/ui';
import { NAMES, advice, bid, call, chance, computerMove, isHigher, isValidState, lowestOn, newGame, nextRound, totalDice, type Level, type Player, type State } from './logic';
import './style.css';

const STATE_KEY = 'liarsdice:state';
/** Pause before each computer player's move. */
export const AI_DELAY = 900;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const FACES = ['', '1s', '2s', '3s', '4s', '5s', '6s'];
/** "four 5s", "one 6" */
export const bidWords = (qty: number, face: number): string => `${WORDS[qty] ?? qty} ${qty === 1 ? String(face) : FACES[face]}`;
const pct = (x: number) => `${Math.round(100 * x)}%`;

/** What a move did, for the recent moves list. */
export function moveText(prev: State, next: State): string | null {
  if (!prev.reveal && next.reveal) {
    const r = next.reveal;
    const who = NAMES[r.caller];
    const loser = r.loser === 0 ? 'you lose' : `${NAMES[r.loser]} loses`;
    return `${who} called “Liar!” There were ${bidWords(r.actual, r.bid.face)}: ${loser} a die.`;
  }
  if (next.bid && next.bid !== prev.bid) return `${NAMES[next.bid.by]} ${next.bid.by === 0 ? 'bid' : 'bids'} ${bidWords(next.bid.qty, next.bid.face)}.`;
  return null;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;
  /** The bid you're building. */
  let qty = 1;
  let face = 2;
  /** Hint: the bid's odds and the best move, only when asked (src/core/coach.ts). No Right
   *  score: bluffing has no single right answer. */
  const coaching = coach('liarsdice');

  container.innerHTML = `
    <div class="screen ld-dice">
      <!-- No stats: each seat shows its own dice, so counts would only repeat them (and the
           side bar needs the room, held sideways). New moves to the top bar as usual. -->
      <div class="stats">
        <button class="btn" data-new>New</button>
      </div>
      <div class="board-frame li-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      ${RECENT_HTML}
      <div class="controls" data-controls></div>
    </div>${settingsHtml(levelSetting('Computer players'))}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'liarsdice');

  /** Starts your bid at the lowest legal one on the face you had picked. */
  function resetBid() {
    if (!isHigher(state, lowestOn(state, face), face)) face = 6;
    qty = Math.max(1, Math.min(lowestOn(state, face), totalDice(state)));
  }

  function update(next: State | null) {
    if (!next) return;
    recent.add(moveText(state, next));
    if (!next.reveal && state.reveal) recent.clear(); // a new round
    coaching.asked = false;
    state = next;
    resetBid();
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (!state.reveal && state.winner === null && state.turn !== 0) timer = window.setTimeout(() => update(computerMove(state)), AI_DELAY);
  }

  const myTurn = () => !state.reveal && state.winner === null && state.turn === 0;

  function seat(p: Player): string {
    const shown = !!state.reveal || p === 0;
    const out = !state.dice[p].length;
    const face = state.reveal?.bid.face;
    const dice = state.dice[p]
      .map((d) => (shown ? `<span class="li-die${face === d ? ' match' : ''}" role="img" aria-label="${d}">${dieFace(d)}</span>` : '<span class="li-die hidden" role="img" aria-label="Hidden die"></span>'))
      .join('');
    const lastBid = state.bid?.by === p && !state.reveal ? `<span class="li-said">${bidWords(state.bid.qty, state.bid.face)}</span>` : '';
    const playing = !state.reveal && state.winner === null;
    return `<div class="li-seat${state.turn === p && playing ? ' turn' : ''}" data-seat="${p}">
      <span class="li-name">${NAMES[p]}${lastBid}</span>
      <div class="li-dice">${out ? '<span class="li-out">Out</span>' : dice}</div>
    </div>`;
  }
  function render() {
    const current = state.bid ? `Bid: <b>${bidWords(state.bid.qty, state.bid.face)}</b> by ${NAMES[state.bid.by] === 'You' ? 'you' : NAMES[state.bid.by]}` : 'No bid yet';
    // The faces to bid on sit under your dice, on the board: it has room to spare, the side
    // bar (held sideways) doesn't.
    const faces = myTurn()
      ? `<div class="li-faces" aria-label="Face to bid on">${[1, 2, 3, 4, 5, 6]
          .map((f) => `<button class="btn secondary li-face" data-face="${f}" aria-label="${FACES[f]}" aria-pressed="${f === face}">${dieFace(f)}</button>`)
          .join('')}</div>`
      : '';
    boardEl.innerHTML = `${seat(1)}${seat(2)}<p class="li-bid">${current} · ${totalDice(state)} dice in play</p>${seat(0)}${faces}`;
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    if (state.reveal) controlsEl.innerHTML = state.winner === null ? '<button class="btn" data-next>Next round</button>' : '';
    else if (!myTurn()) controlsEl.innerHTML = '';
    else {
      const tip = advice(state, 0);
      const tipText = tip.call
        ? `Best: call <b>“Liar!”</b> That bid is true only about ${pct(tip.chance)} of the time, given your dice.`
        : `Best: bid <b>${bidWords(tip.qty, tip.face)}</b>: true about ${pct(tip.chance)} of the time, given your dice.${state.bid ? ` The last bid is true about ${pct(chance(state, 0, state.bid.qty, state.bid.face))}.` : ''}`;
      controlsEl.innerHTML = `${coaching.html(coaching.asked ? tipText : '')}
        <div class="li-bidrow actions">
          <button class="btn secondary li-step" data-step="-1" aria-label="Fewer"${isHigher(state, qty - 1, face) ? '' : ' disabled'}>−</button>
          <output class="li-qty" aria-live="polite">${qty}</output>
          <button class="btn secondary li-step" data-step="1" aria-label="More"${isHigher(state, qty + 1, face) ? '' : ' disabled'}>+</button>
          <button class="btn" data-bid${isHigher(state, qty, face) ? '' : ' disabled'}>Bid</button>
          <button class="btn secondary" data-call${state.bid ? '' : ' disabled'}>Liar!</button>
        </div>`;
    }
    statusEl.textContent = statusText();
    if (state.winner !== null) showOverlay(boardEl, state.winner === 0 ? 'You win!' : `${NAMES[state.winner]} wins`, [['New game', () => start()]]);
    else hideOverlay(boardEl);
  }

  function statusText(): string {
    if (state.winner !== null) return state.winner === 0 ? 'You’re the last with dice: you win!' : `${NAMES[state.winner]} is the last with dice.`;
    if (state.reveal) {
      const r = state.reveal;
      const there = `There were ${bidWords(r.actual, r.bid.face)}, so the bid was ${r.actual >= r.bid.qty ? 'right' : 'a lie'}`;
      const loses = r.loser === 0 ? 'you lose' : `${NAMES[r.loser]} loses`;
      // The die comes off at the next round; losing your last one puts you out.
      const out = state.dice[r.loser].length === 1 ? ` ${r.loser === 0 ? 'You’re' : `${NAMES[r.loser]} is`} out.` : '';
      return `${there}: ${loses} a die.${out}`;
    }
    if (state.turn !== 0) return `${NAMES[state.turn]} is thinking…`;
    if (!state.bid) return 'Your bid: pick a face, set the number, tap Bid.';
    return 'Raise the bid, or call “Liar!”';
  }

  function start() {
    recent.clear();
    update(newGame(state.level));
  }

  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) {
      coaching.asked = true;
      return render();
    }
    if (el.hasAttribute('data-next')) return update(nextRound(state));
    if (el.hasAttribute('data-call')) return update(call(state, 0));
    if (el.hasAttribute('data-bid')) return update(bid(state, 0, qty, face));
    if (el.dataset.step) qty += Number(el.dataset.step);
    render();
  });
  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-face]');
    if (!el) return;
    face = Number(el.dataset.face);
    qty = Math.max(qty, lowestOn(state, face));
    render();
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.winner === null && (totalDice(state) < 15 || !!state.bid);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), start));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
