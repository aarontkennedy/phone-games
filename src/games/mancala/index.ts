import { load, save } from '../../core/storage';
import { confirmNew } from '../../core/ui';
import { STORE, choosePit, isValidState, legalPits, move, newGame, newRound, pitsOf, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'mancala:state';
/** Pause before the computer moves, and between its moves when it goes again. */
export const AI_DELAY = 900;

const seeds = (n: number) => `${n} ${n === 1 ? 'seed' : 'seeds'}`;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen mc">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame mc-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.result === null && state.turn === 1) {
      timer = window.setTimeout(() => update(move(state, choosePit(state))), AI_DELAY);
    }
  }

  function pitHtml(i: number, playable: boolean): string {
    const n = state.board[i];
    const mine = i < 6;
    const cls = ['mc-pit', state.last?.pit === i ? 'played' : '', state.last?.end === i ? 'landed' : ''].filter(Boolean).join(' ');
    const label = `${mine ? 'Your' : 'Computer’s'} pit ${mine ? i + 1 : i - 6}: ${seeds(n)}`;
    return mine
      ? `<button class="${cls}" data-pit="${i}" aria-label="${label}"${playable ? '' : ' disabled'}>${n}</button>`
      : `<span class="${cls}" role="img" aria-label="${label}">${n}</span>`;
  }

  function render() {
    const mine = new Set(state.result === null && state.turn === 0 ? legalPits(state.board, 0) : []);
    const store = (side: 0 | 1) => {
      const i = STORE[side];
      const cls = ['mc-store', side === 0 ? 'you' : 'them', state.last?.end === i ? 'landed' : ''].filter(Boolean).join(' ');
      return `<span class="${cls}" role="img" aria-label="${side === 0 ? 'Your' : 'Computer’s'} store: ${seeds(state.board[i])}">${state.board[i]}</span>`;
    };
    // Top row runs right to left, so sowing goes around counter-clockwise.
    boardEl.innerHTML = `${store(1)}
      <div class="mc-row them">${[...pitsOf(1)].reverse().map((i) => pitHtml(i, false)).join('')}</div>
      <div class="mc-row you">${pitsOf(0).map((i) => pitHtml(i, mine.has(i))).join('')}</div>
      ${store(0)}`;
    container.querySelector('[data-you]')!.textContent = String(state.board[STORE[0]]);
    container.querySelector('[data-computer]')!.textContent = String(state.board[STORE[1]]);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    const rounds = `Rounds won: you ${state.tally.you}, computer ${state.tally.computer}.`;
    if (state.result === 0) return `You win! ${rounds} Tap New for another round.`;
    if (state.result === 1) return `The computer wins. ${rounds} Tap New for another round.`;
    if (state.result === 'draw') return `It’s a draw. ${rounds} Tap New for another round.`;
    const last = state.last;
    const whoDid = last?.side === 0 ? 'You' : 'The computer';
    const what = !last ? '' : last.captured ? `${whoDid} captured ${seeds(last.captured)}. ` : last.again ? `${whoDid} ended in the store, so ${last.side === 0 ? 'you go' : 'it goes'} again. ` : '';
    if (state.turn === 1) return `${what}The computer is thinking…`;
    return `${what}Your turn: tap one of your pits on the bottom row.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-pit]');
    if (el && state.turn === 0) update(move(state, Number(el.dataset.pit)));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.result === null && state.last !== null;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newRound(state))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
