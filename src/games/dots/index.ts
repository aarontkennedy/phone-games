import { load, save } from '../../core/storage';
import { confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import { SIZE, chooseLine, count, isValidState, move, newGame, newRound, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'dots:state';
/** Pause before each of the computer's lines. */
export const AI_DELAY = 600;
const ACROSS = SIZE * (SIZE + 1);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen db">
      <div class="stats">
        <div class="stat"><small><i class="db-key p0" aria-hidden="true"></i>You</small><b data-you></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small><i class="db-key p1" aria-hidden="true"></i>Computer</small><b data-computer></b></div>
      </div>
      <div class="board-frame db-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.result === null && state.turn === 1) timer = window.setTimeout(() => update(move(state, chooseLine(state))), AI_DELAY);
  }

  function lineCell(i: number, across: boolean): string {
    const drawn = state.lines[i];
    const playable = !drawn && state.result === null && state.turn === 0;
    const cls = ['db-line', across ? 'across' : 'down', drawn ? 'drawn' : '', i === state.last ? 'last' : ''].filter(Boolean).join(' ');
    const label = `${across ? 'Across' : 'Down'} line ${across ? i + 1 : i - ACROSS + 1}: ${drawn ? 'drawn' : 'open'}`;
    return `<div class="${cls}" data-line="${i}" role="button" aria-label="${label}" ${playable ? 'tabindex="0"' : 'aria-disabled="true"'}></div>`;
  }

  function render() {
    const cells: string[] = [];
    for (let gr = 0; gr <= 2 * SIZE; gr++) {
      for (let gc = 0; gc <= 2 * SIZE; gc++) {
        const r = Math.floor(gr / 2);
        const c = Math.floor(gc / 2);
        if (gr % 2 === 0 && gc % 2 === 0) cells.push('<span class="db-dot"></span>');
        else if (gr % 2 === 0) cells.push(lineCell(r * SIZE + c, true));
        else if (gc % 2 === 0) cells.push(lineCell(ACROSS + r * (SIZE + 1) + c, false));
        else {
          const owner = state.boxes[r * SIZE + c];
          const label = owner === null ? 'Open box' : owner === 0 ? 'Your box' : 'Computer’s box';
          cells.push(`<span class="db-box${owner === null ? '' : ` p${owner}`}" role="img" aria-label="${label}"></span>`);
        }
      }
    }
    boardEl.innerHTML = cells.join('');
    container.querySelector('[data-you]')!.textContent = String(count(state, 0));
    container.querySelector('[data-computer]')!.textContent = String(count(state, 1));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    const rounds = `Rounds won: you ${state.tally.you}, computer ${state.tally.computer}.`;
    if (state.result === 0) return `You win! ${rounds} Tap New for another round.`;
    if (state.result === 1) return `The computer wins. ${rounds} Tap New for another round.`;
    if (state.result === 'draw') return `It’s a draw. ${rounds} Tap New for another round.`;
    if (state.turn === 1) return 'The computer is thinking…';
    return state.last === null
      ? 'Your turn: tap between two dots to draw a line. Close a box to claim it and go again.'
      : 'Your turn: draw a line. Closing a box gives you another turn.';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-line]');
    if (el && state.turn === 0) update(move(state, Number(el.dataset.line)));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.result === null && state.lines.some(Boolean);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newRound(state))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
