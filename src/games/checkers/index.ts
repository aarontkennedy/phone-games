import { load, save } from '../../core/storage';
import { showIcons } from '../../core/icons';
import { confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import { chooseMove, isDark, isValidState, legalMoves, move, newGame, newRound, type Level, type Move, type State } from './logic';
import './style.css';

const STATE_KEY = 'checkers:state';
/** Pause before the computer moves. */
export const AI_DELAY = 600;

const where = (i: number) => `row ${Math.floor(i / 8) + 1}, column ${(i % 8) + 1}`;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let selected: number | null = null;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen ck">
      <div class="stats">
        <div class="stat"><small>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame ck-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  const myMoves = (): Move[] => (state.result === null && state.turn === 0 ? legalMoves(state.board, 0) : []);

  function update(next: State | null) {
    if (!next) return;
    state = next;
    selected = null;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.result === null && state.turn === 1) {
      timer = window.setTimeout(() => update(move(state, chooseMove(state))), AI_DELAY);
    }
  }

  function render() {
    const moves = myMoves();
    const movable = new Set(moves.map((m) => m.from));
    const targets = new Map(moves.filter((m) => m.from === selected).map((m) => [m.path.at(-1)!, m]));
    const lastSquares = new Set(state.last ? [state.last.from, ...state.last.path] : []);
    boardEl.innerHTML = state.board
      .map((p, i) => {
        if (!isDark(i)) return '<span class="ck-sq light"></span>';
        const cls = ['ck-sq', i === selected ? 'selected' : '', targets.has(i) ? 'target' : '', lastSquares.has(i) ? 'last' : '']
          .filter(Boolean)
          .join(' ');
        const piece = p ? `<span class="ck-piece p${p.side}${p.king ? ' king' : ''}"></span>` : '';
        const label = p ? `${p.side === 0 ? 'Your' : 'Computer’s'} ${p.king ? 'king' : 'piece'}` : targets.has(i) ? 'Move here' : 'Empty';
        const tappable = movable.has(i) || targets.has(i);
        return `<button class="${cls}" data-sq="${i}" aria-label="${label}, ${where(i)}"${tappable ? '' : ' disabled'}>${piece}</button>`;
      })
      .join('');
    container.querySelector('[data-you]')!.textContent = String(state.tally.you);
    container.querySelector('[data-computer]')!.textContent = String(state.tally.computer);
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const mustJump = moves.some((m) => m.captured.length);
    statusEl.textContent =
      state.result === 0
        ? 'You win! Tap {new} for another round.'
        : state.result === 1
          ? 'The computer wins. Tap {new} for another round.'
          : state.result === 'draw'
            ? 'Fifty moves each with no capture: it’s a draw. Tap {new} for another round.'
            : state.turn === 1
              ? 'The computer is thinking…'
              : selected !== null
                ? 'Tap a marked square to move there, or tap another piece.'
                : mustJump
                  ? 'Your turn. You must jump: tap a piece that can take one.'
                  : 'Your turn: tap one of your purple pieces.';
    showIcons(statusEl);
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-sq]');
    if (!el) return;
    const i = Number(el.dataset.sq);
    const chosen = myMoves().find((m) => m.from === selected && m.path.at(-1) === i);
    if (chosen) update(move(state, chosen));
    else {
      selected = i;
      render();
    }
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
