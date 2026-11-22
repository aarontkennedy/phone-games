import { load, save } from '../../core/storage';
import { allWords, enter, hint, hinted, isValidState, newRound, points, shuffleLetters, whyNot, type State } from './logic';
import './style.css';

const STATE_KEY = 'anagrams:state';

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newRound();
  /** The tiles you've tapped, by position, spelling the word in progress. */
  let typed: number[] = [];
  let message = '';

  container.innerHTML = `
    <div class="screen an">
      <div class="stats">
        <div class="stat"><small>Found</small><b data-found></b></div>
        <div class="stat"><small>Score</small><b data-score></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame an-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls>
        <button class="btn secondary" data-delete>Delete</button>
        <button class="btn secondary" data-shuffle>Shuffle</button>
        <button class="btn" data-enter>Enter</button>
        <span class="an-break" aria-hidden="true"></span>
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-next>Next word</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null, keepTyped = false) {
    if (!next) return render();
    state = next;
    if (!keepTyped) typed = [];
    save(STATE_KEY, state);
    render();
  }

  const word = () => typed.map((i) => state.letters[i]).join('');

  function render() {
    const found = state.found.length
      ? [...state.found].reverse().map((w) => `<li class="${w.length === 7 ? 'an-seven' : ''}">${w.toUpperCase()}</li>`).join('')
      : '<li class="an-none">Words you find show here.</li>';
    const spelled = Array.from({ length: 7 }, (_, i) => `<span class="an-slot">${(word()[i] ?? '').toUpperCase()}</span>`).join('');
    const tiles = state.letters
      .map((l, i) => {
        const used = typed.includes(i);
        return `<button class="an-tile" data-tile="${i}" aria-label="${l.toUpperCase()}${used ? ', used' : ''}"${used ? ' disabled' : ''}>${l.toUpperCase()}</button>`;
      })
      .join('');
    boardEl.innerHTML = `
      <ul class="an-found" aria-label="Words found">${found}</ul>
      <div class="an-word" role="img" aria-label="${word() ? `Your word: ${word().toUpperCase()}` : 'No letters yet'}">${spelled}</div>
      <div class="an-tiles">${tiles}</div>`;
    container.querySelector('[data-found]')!.textContent = String(state.found.length);
    container.querySelector('[data-score]')!.textContent = String(state.score);
    container.querySelector('[data-best]')!.textContent = String(state.best);
    controlsEl.querySelector<HTMLButtonElement>('[data-delete]')!.disabled = !typed.length;
    controlsEl.querySelector<HTMLButtonElement>('[data-enter]')!.disabled = !typed.length;
    statusEl.textContent = message || statusText();
  }

  function statusText(): string {
    const start = hinted(state).toUpperCase();
    const clue = start ? ` The 7-letter word starts ${start}.` : '';
    if (!state.found.length) return `Tap letters to spell words of 3 or more letters, then tap Enter.${clue}`;
    return `${state.found.length === 1 ? '1 word' : `${state.found.length} words`} so far.${clue}`;
  }

  function nextRound() {
    const words = state.found.length;
    const sevens = allWords(state).filter((w) => w.length === 7).map((w) => w.toUpperCase());
    // Not "of N": the full word list has many obscure words, so the total would discourage.
    message = `Last round: ${words === 1 ? '1 word' : `${words} words`}, for ${state.score} points. The 7-letter ${sevens.length > 1 ? `words were ${sevens.join(' and ')}` : `word was ${sevens[0]}`}.`;
    update(newRound(state.best));
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-tile]');
    if (!el || el.disabled) return;
    typed.push(Number(el.dataset.tile));
    message = '';
    render();
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-delete')) {
      typed.pop();
      message = '';
      render();
    } else if (el.hasAttribute('data-shuffle')) {
      // Keep the word in progress: its letters move with their tiles.
      const spelled = word();
      const next = shuffleLetters(state);
      const free = next.letters.map((_, i) => i);
      typed = [...spelled].map((ch) => free.splice(free.findIndex((i) => next.letters[i] === ch), 1)[0]);
      message = '';
      update(next, true);
    } else if (el.hasAttribute('data-enter')) {
      const w = word();
      const why = whyNot(state, w);
      message = why ?? `${w.toUpperCase()}: ${points(w)} points.${w.length === 7 ? ' All seven letters!' : ''}`;
      update(why ? null : enter(state, w), !!why);
    } else if (el.hasAttribute('data-hint')) {
      const next = hint(state);
      message = next ? '' : state.hints >= 7 ? 'That’s the whole word.' : 'You’ve already found a 7-letter word.';
      update(next, true);
    } else if (el.hasAttribute('data-next')) nextRound();
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
