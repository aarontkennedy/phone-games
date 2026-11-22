import { load, save } from '../../core/storage';
import { enter, finish, hint, isValidState, missed, neighbors, newRound, points, whyNot, type State } from './logic';
import './style.css';

const STATE_KEY = 'wordgrid:state';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newRound();
  /** The letters you've tapped, by cell, spelling the word in progress. */
  let path: number[] = [];
  let message = '';
  /** Where Hint's word starts, until your next word. */
  let tipStart: number | null = null;

  container.innerHTML = `
    <div class="screen wg">
      <div class="stats">
        <div class="stat"><small>Words</small><b data-words></b></div>
        <div class="stat"><small>Score</small><b data-score></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame wg-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return render();
    state = next;
    path = [];
    tipStart = null;
    save(STATE_KEY, state);
    render();
  }

  const word = () => path.map((c) => state.grid[c]).join('');

  function render() {
    const cells = state.grid
      .map((l, i) => {
        const at = path.indexOf(i);
        const cls = ['wg-cell', at >= 0 ? 'picked' : '', at === path.length - 1 && at >= 0 ? 'last' : '', tipStart === i ? 'hint' : ''].filter(Boolean).join(' ');
        return `<button class="${cls}" data-cell="${i}" aria-label="${l.toUpperCase()}${at >= 0 ? `, letter ${at + 1} of your word` : ''}" aria-pressed="${at >= 0}"${state.done ? ' disabled' : ''}>${l.toUpperCase()}</button>`;
      })
      .join('');
    const found = state.found.length
      ? [...state.found].reverse().map((w) => `<li>${w.toUpperCase()}</li>`).join('')
      : '<li class="wg-none">Words you find show here.</li>';
    boardEl.innerHTML = `
      <p class="wg-word" aria-live="polite">${word().toUpperCase() || '&nbsp;'}</p>
      <div class="wg-grid">${cells}</div>
      <ul class="wg-found" aria-label="Words found">${found}</ul>`;
    container.querySelector('[data-words]')!.textContent = String(state.found.length);
    container.querySelector('[data-score]')!.textContent = String(state.score);
    container.querySelector('[data-best]')!.textContent = String(state.best);
    controlsEl.innerHTML = state.done
      ? '<button class="btn" data-new-round>New grid</button>'
      : `<button class="btn secondary" data-clear${path.length ? '' : ' disabled'}>Clear</button>
         <button class="btn" data-enter${path.length ? '' : ' disabled'}>Enter</button>
         <span class="wg-break" aria-hidden="true"></span>
         <button class="btn secondary" data-hint>Hint</button>
         <button class="btn secondary" data-done>Done</button>`;
    statusEl.textContent = message || statusText();
  }

  function statusText(): string {
    if (state.done) {
      const left = missed(state).slice(0, 8).map((w) => w.toUpperCase());
      const some = left.length ? ` Some you missed: ${left.join(', ')}.` : ' You found every word!';
      return `${state.found.length === 1 ? '1 word' : `${state.found.length} words`} for ${state.score} points.${some}`;
    }
    if (path.length) return 'Tap a touching letter to go on, the last letter again to take it back, or Enter.';
    return 'Tap touching letters (diagonals too) to spell words of 3 or more letters, then tap Enter.';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-cell]');
    if (!el || el.disabled) return;
    const i = Number(el.dataset.cell);
    message = '';
    if (path.at(-1) === i) path.pop(); // take back the last letter
    else if (path.includes(i)) path = path.slice(0, path.indexOf(i) + 1); // back to that letter
    else if (!path.length || neighbors(path.at(-1)!).includes(i)) path.push(i);
    else path = [i]; // not touching: start a new word here
    render();
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-clear')) {
      path = [];
      message = '';
      render();
    } else if (el.hasAttribute('data-enter')) {
      const w = word();
      const why = whyNot(state, path);
      message = why ?? `${w.toUpperCase()}: ${points(w)} ${points(w) === 1 ? 'point' : 'points'}.`;
      if (why) render();
      else update(enter(state, path));
    } else if (el.hasAttribute('data-hint')) {
      const tip = hint(state)!;
      path = [];
      tipStart = tip.start;
      message = `Hint: a ${tip.word.length}-letter word starts at the outlined letter.`;
      render();
    } else if (el.hasAttribute('data-done')) {
      message = '';
      update(finish(state));
    } else if (el.hasAttribute('data-new-round')) {
      message = '';
      update(newRound(state.best));
    }
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
