import { load, save } from '../../core/storage';
import { confirmNew } from '../../core/ui';
import { current, hint, isValidState, newPuzzle, step, steps, undo, whyNot, type State } from './logic';
import './style.css';

const STATE_KEY = 'ladder:state';
const SOLVED_KEY = 'ladder:solved';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newPuzzle();
  let solved = load<number>(SOLVED_KEY, 0);
  /** Which letter of the current word you're changing (0 to 3), or null. */
  let at: number | null = null;
  let message = '';
  /** The word Hint suggested, until your next step. */
  let tip: string | null = null;

  container.innerHTML = `
    <div class="screen ld">
      <div class="stats">
        <div class="stat"><small>Steps</small><b data-steps></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Par</small><b data-par></b></div>
        <div class="stat"><small>Solved</small><b data-solved></b></div>
      </div>
      <div class="board-frame ld-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls>
        <div class="ld-keys" data-keys></div>
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const keysEl = container.querySelector<HTMLElement>('[data-keys]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const hintBtn = container.querySelector<HTMLButtonElement>('[data-hint]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;

  function update(next: State | null, fail = '') {
    if (!next) {
      message = fail;
      return render();
    }
    if (next.won && !state.won) save(SOLVED_KEY, ++solved);
    state = next;
    at = null;
    tip = null;
    message = '';
    save(STATE_KEY, state);
    render();
  }

  const tiles = (word: string, cls: string, editable = false) =>
    `<div class="ld-word ${cls}" role="${editable ? 'group' : 'img'}" aria-label="${editable ? `Change a letter of ${word.toUpperCase()}` : word.toUpperCase()}">${word
      .toUpperCase()
      .split('')
      .map((ch, i) => {
        if (!editable) return `<span class="ld-tile">${ch}</span>`;
        const hinted = tip && tip[i] !== word[i] ? ' hint' : '';
        return `<button class="ld-tile${at === i ? ' picked' : ''}${hinted}" data-at="${i}" aria-label="Letter ${i + 1}, ${ch}" aria-pressed="${at === i}">${ch}</button>`;
      })
      .join('')}</div>`;

  function render() {
    const now = current(state);
    const earlier = state.path.slice(0, -1).map((w) => w.toUpperCase());
    boardEl.innerHTML = `
      <p class="ld-path" aria-label="Your ladder so far">${earlier.length ? `${earlier.join(' → ')} →` : 'Start'}</p>
      ${tiles(now, 'ld-now', !state.won)}
      <p class="ld-to">${state.won ? 'Done!' : 'To'}</p>
      ${tiles(state.target, 'ld-target')}`;
    keysEl.innerHTML = state.won
      ? '<button class="btn ld-next" data-next>Next puzzle</button>'
      : LETTERS.map((l) => `<button class="btn secondary" data-letter="${l}">${l}</button>`).join('');
    hintBtn.hidden = undoBtn.hidden = state.won;
    undoBtn.disabled = !steps(state);
    container.querySelector('[data-steps]')!.textContent = String(steps(state));
    container.querySelector('[data-par]')!.textContent = String(state.par);
    container.querySelector('[data-solved]')!.textContent = String(solved);
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    if (state.won) {
      const n = steps(state);
      const vs = n === state.par ? 'right on par' : n < state.par ? `${state.par - n} under par` : `${n - state.par} over par`;
      return `You made ${state.target.toUpperCase()} in ${n} ${n === 1 ? 'step' : 'steps'}, ${vs}.`;
    }
    if (message) return message;
    if (tip) return `Hint: change ${current(state).toUpperCase()} to ${tip.toUpperCase()}.`;
    if (at === null) return `Turn ${state.start.toUpperCase()} into ${state.target.toUpperCase()}. Tap a letter to change.`;
    return `Now tap the new letter for letter ${at + 1}.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-at]');
    if (!el) return;
    at = Number(el.dataset.at); // tapping it again keeps it picked, ready for a letter
    message = '';
    render();
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-next')) return update(newPuzzle());
    if (el.hasAttribute('data-undo')) return update(undo(state));
    if (el.hasAttribute('data-hint')) {
      tip = hint(state);
      message = tip ? '' : 'No ladder reaches the target from here. Tap Undo to go back.';
      at = tip ? [...tip].findIndex((ch, i) => ch !== current(state)[i]) : at;
      return render();
    }
    if (at === null) {
      message = 'First tap the letter you want to change.';
      return render();
    }
    const now = current(state);
    const word = now.slice(0, at) + el.dataset.letter!.toLowerCase() + now.slice(at + 1);
    if (word === now) return;
    update(step(state, word), whyNot(state, word) ?? '');
  });
  // A puzzle partway through: New asks first (docs/DESIGN.md, "Screen layout").
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(steps(state) > 0 && !state.won, () => update(newPuzzle())));

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}

