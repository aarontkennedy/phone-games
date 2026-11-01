import { load, save } from '../../core/storage';
import { confirmNew } from '../../core/ui';
import { LETTERS, MAX_MISSES, guess, isValidState, misses, newGame, newRound, type State } from './logic';
import './style.css';

const STATE_KEY = 'hangman:state';

// The gallows, then a part of the figure for each wrong guess. Flat strokes only.
const GALLOWS = '<path d="M10 112H70M25 112V10H80V24"/>';
const PARTS = [
  '<circle cx="80" cy="33" r="9"/>',
  '<path d="M80 42V72"/>',
  '<path d="M80 50L66 62"/>',
  '<path d="M80 50L94 62"/>',
  '<path d="M80 72L68 92"/>',
  '<path d="M80 72L92 92"/>',
];

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();

  container.innerHTML = `
    <div class="screen hm">
      <div class="stats">
        <div class="stat"><small>Won</small><b data-won></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Streak</small><b data-streak></b></div>
      </div>
      <div class="board-frame hm-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="hm-keys" data-keys></div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const keysEl = container.querySelector<HTMLElement>('[data-keys]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  let lastGuess: string | null = null;

  function update(next: State | null) {
    if (!next) return;
    state = next;
    save(STATE_KEY, state);
    render();
  }

  function render() {
    const wrong = misses(state);
    const over = state.result !== null;
    const word = [...state.word]
      .map((l) => {
        const shown = state.guessed.includes(l);
        const cls = shown ? 'hm-letter' : over ? 'hm-letter missed' : 'hm-letter blank';
        return `<span class="${cls}">${shown || over ? l : ''}</span>`;
      })
      .join('');
    const spoken = [...state.word].map((l) => (state.guessed.includes(l) || over ? l : 'blank')).join(', ');
    boardEl.innerHTML = `
      <svg class="hm-art" viewBox="0 0 120 120" role="img" aria-label="${wrong.length} of ${MAX_MISSES} wrong guesses">${GALLOWS}${PARTS.slice(0, wrong.length).join('')}</svg>
      <div class="hm-word" role="img" aria-label="The word: ${spoken}">${word}</div>`;

    keysEl.innerHTML = over
      ? '<button class="btn hm-next" data-next>Next word</button>'
      : LETTERS.map((l) => {
          const tried = state.guessed.includes(l);
          const cls = !tried ? 'btn secondary' : state.word.includes(l) ? 'btn hm-right' : 'btn hm-wrong';
          const label = !tried ? l : `${l}, ${state.word.includes(l) ? 'in the word' : 'not in the word'}`;
          return `<button class="${cls}" data-letter="${l}" aria-label="${label}"${tried ? ' disabled' : ''}>${l}</button>`;
        }).join('');

    container.querySelector('[data-won]')!.textContent = String(state.stats.won);
    container.querySelector('[data-streak]')!.textContent = String(state.stats.streak);
    statusEl.textContent = statusText(wrong.length);
  }

  function statusText(wrongCount: number): string {
    const left = MAX_MISSES - wrongCount;
    const leftText = `${left} wrong ${left === 1 ? 'guess' : 'guesses'} left.`;
    if (state.result === 'won') return `You got it: ${state.word}! Best streak: ${state.stats.best}.`;
    if (state.result === 'lost') return `Out of guesses. The word was ${state.word}.`;
    if (!lastGuess) return `Guess a letter. ${leftText}`;
    return state.word.includes(lastGuess) ? `Yes, there’s ${/[AEFHILMNORSX]/.test(lastGuess) ? 'an' : 'a'} ${lastGuess}! ${leftText}` : `No ${lastGuess}. ${leftText}`;
  }

  function tryLetter(letter: string) {
    const next = guess(state, letter);
    if (!next) return;
    lastGuess = letter;
    update(next);
  }

  function nextWord() {
    lastGuess = null;
    update(newRound(state));
  }

  keysEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.letter) tryLetter(el.dataset.letter);
    else nextWord();
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.result === null && state.guessed.length > 0;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), nextWord));
  // A hardware keyboard works too.
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) tryLetter(e.key.toUpperCase());
  };
  document.addEventListener('keydown', onKey);

  update(state);

  return () => {
    document.removeEventListener('keydown', onKey);
    container.replaceChildren();
  };
}
