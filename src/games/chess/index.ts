import { load, save } from '../../core/storage';
import { confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import {
  canUndo,
  chooseMove,
  colorOf,
  inCheck,
  isValidState,
  legalMoves,
  needsPromo,
  newGame,
  newRound,
  play,
  squareName,
  undo,
  type Level,
  type Move,
  type Promo,
  type State,
} from './logic';
import { pieceSvg } from './pieces';
import './style.css';

const STATE_KEY = 'chess:state';
/** Pause before the computer moves. */
export const AI_DELAY = 500;

const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const PROMOS: Promo[] = ['q', 'r', 'b', 'n'];
const capital = (w: string) => w[0].toUpperCase() + w.slice(1);
const colorName = (p: string) => (colorOf(p) === 'w' ? 'White' : 'Black');

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let selected: number | null = null;
  /** A pawn move to the far row, waiting for you to choose a piece. */
  let promoting: Move | null = null;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cs">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame cs-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="cs-actions" data-actions></div>
      </div>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  const myTurn = () => state.result === null && state.turn === state.you;
  const myMoves = (): Move[] => (myTurn() ? legalMoves(state) : []);

  function update(next: State | null) {
    if (!next) return;
    state = next;
    selected = null;
    promoting = null;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.result === null && state.turn !== state.you) {
      timer = window.setTimeout(() => update(play(state, chooseMove(state))), AI_DELAY);
    }
  }

  function render() {
    const moves = myMoves();
    const movable = new Set(moves.map((m) => m.from));
    const targets = new Set(moves.filter((m) => m.from === selected).map((m) => m.to));
    const last = state.last ? [state.last.from, state.last.to] : [];
    const checked = inCheck(state) ? state.board.indexOf(state.turn === 'w' ? 'K' : 'k') : -1;
    // Your pieces at the bottom: flip the board when you play black.
    const order = Array.from({ length: 64 }, (_, i) => (state.you === 'w' ? i : 63 - i));
    boardEl.innerHTML = order
      .map((sq) => {
        const p = state.board[sq];
        const shade = ((sq >> 3) + (sq & 7)) % 2 ? 'dark' : 'light';
        const cls = ['cs-sq', shade, sq === selected ? 'selected' : '', last.includes(sq) ? 'last' : '', sq === checked ? 'check' : '', targets.has(sq) ? (p ? 'target take' : 'target') : '']
          .filter(Boolean)
          .join(' ');
        const what = p ? `${colorName(p)} ${NAMES[p.toLowerCase()]}` : 'Empty';
        const label = `${what}, ${squareName(sq)}${targets.has(sq) ? ', move here' : ''}`;
        const tappable = movable.has(sq) || targets.has(sq);
        return `<button class="${cls}" data-sq="${sq}" aria-label="${label}"${tappable ? '' : ' disabled'}>${p ? pieceSvg(p) : ''}</button>`;
      })
      .join('');
    container.querySelector('[data-you]')!.textContent = String(state.tally.you);
    container.querySelector('[data-computer]')!.textContent = String(state.tally.computer);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const white = state.you === 'w';
    actionsEl.innerHTML = promoting
      ? PROMOS.map((x) => `<button class="btn cs-promo" data-promo="${x}" aria-label="${capital(NAMES[x])}">${pieceSvg(white ? x.toUpperCase() : x)}</button>`).join('')
      : canUndo(state)
        ? '<button class="btn secondary" data-undo>Undo</button>'
        : '';
    statusEl.textContent = statusText();
  }

  /** What the computer's last move did, in words. */
  function lastMoveText(): string {
    const m = state.last!;
    const p = state.board[m.to];
    const took = state.taken ? ` and took your ${NAMES[state.taken.toLowerCase()]}` : '';
    if (p.toLowerCase() === 'k' && Math.abs(m.to - m.from) === 2) return 'The computer castled.';
    if (m.promo) return `The computer moved a pawn to ${squareName(m.to)}${took} and made it a ${NAMES[m.promo]}.`;
    return `The computer moved its ${NAMES[p.toLowerCase()]} from ${squareName(m.from)} to ${squareName(m.to)}${took}.`;
  }

  function statusText(): string {
    const again = ' Tap New for another game.';
    if (state.result !== null) {
      if (state.reason === 'checkmate') return state.result === state.you ? `Checkmate: you win!${again}` : `Checkmate: the computer wins.${again}`;
      const why = {
        stalemate: 'Stalemate: the player to move has no legal move but isn’t in check',
        repetition: 'The same position came up three times',
        fifty: '50 moves each with no capture or pawn move',
        material: 'Neither side has enough pieces left to checkmate',
      }[state.reason as 'stalemate'];
      return `${why}, so it’s a draw.${again}`;
    }
    if (state.turn !== state.you) return 'The computer is thinking…';
    if (promoting) return 'Choose a piece for your pawn.';
    const before = state.last ? `${lastMoveText()} ` : '';
    const check = inCheck(state) ? 'Check! ' : '';
    if (selected !== null) return `${check}Tap a marked square to move there, or tap another piece.`;
    return `${before}${check}Your move: tap one of your ${state.you === 'w' ? 'white' : 'black'} pieces.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-sq]');
    if (!el) return;
    const sq = Number(el.dataset.sq);
    const chosen = myMoves().find((m) => m.from === selected && m.to === sq);
    if (chosen && needsPromo(state, chosen.from, chosen.to)) {
      promoting = { from: chosen.from, to: chosen.to };
      render();
    } else if (chosen) update(play(state, chosen));
    else {
      selected = selected === sq ? null : sq;
      promoting = null;
      render();
    }
  });
  actionsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.promo) update(play(state, { ...promoting!, promo: el.dataset.promo as Promo }));
    else update(undo(state));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.result === null && state.moves.some((_, i) => (i % 2 === 0 ? 'w' : 'b') === state.you);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newRound(state))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
