import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { cardName, type Card } from '../../core/cards';
import { showIcons } from '../../core/icons';
import { load, save } from '../../core/storage';
import { confirmNew, hideOverlay, showOverlay, stuckText } from '../../core/ui';
import {
  PASSES,
  ROWS,
  cardAt,
  cardsLeft,
  draw,
  findHint,
  indexOf,
  isFree,
  isStuck,
  isValidState,
  newGame,
  passesLeft,
  remove,
  type Hint,
  type Source,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'pyramid:state';
const BEST_KEY = 'pyramid:best';

const named = (c: Card) => `the ${cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase())}`;
const sameSource = (a: Source | null, b: Source) => !!a && a.from === b.from && (a.from === 'waste' || a.i === (b as typeof a).i);

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** The fewest pyramid cards ever left at the end of a deal (0 is a win), or null. */
  let best = load<number | null>(BEST_KEY, null);
  let history: State[] = [];
  /** The card you've picked, waiting for one that makes 13 with it. */
  let picked: Source | null = null;
  let message = '';
  /** What Hint suggested, outlined until the next move. */
  let hint: Hint | null = null;

  container.innerHTML = `
    <div class="screen cards py">
      <div class="stats">
        <div class="stat"><small>Left</small><b data-left></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Deck</small><b data-deck></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
      </div>
      <div class="board-frame py-board" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <button class="btn secondary" data-hint>Hint</button>
        <button class="btn secondary" data-undo>Undo</button>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const undoBtn = container.querySelector<HTMLButtonElement>('[data-undo]')!;

  function commit(next: State | null, fail = '') {
    picked = null;
    hint = null;
    message = next ? '' : fail;
    if (next) {
      history = [...history.slice(-199), state];
      state = next;
      if ((state.won || isStuck(state)) && (best === null || cardsLeft(state) < best)) save(BEST_KEY, (best = cardsLeft(state)));
      save(STATE_KEY, state);
    }
    render();
  }

  const hinted = (src: Source) => !!hint && 'remove' in hint && hint.remove.some((h) => sameSource(h, src));

  function render() {
    const rows = Array.from({ length: ROWS }, (_, r) => {
      const cards = Array.from({ length: r + 1 }, (_, c) => {
        const i = indexOf(r, c);
        const card = state.pyramid[i];
        if (!card) return '<span class="py-gap"></span>';
        const src: Source = { from: 'pyramid', i };
        const cls = [sameSource(picked, src) ? 'picked' : '', hinted(src) ? 'hint' : ''].filter(Boolean).join(' ');
        return cardFace(card, { button: true, className: cls, attrs: `data-i="${i}"${isFree(state, i) ? '' : ' disabled'}` });
      }).join('');
      return `<div class="py-row" style="--row:${r}">${cards}</div>`;
    }).join('');
    const top = state.waste.at(-1);
    const wasteSrc: Source = { from: 'waste' };
    const waste = top
      ? cardFace(top, { button: true, className: [sameSource(picked, wasteSrc) ? 'picked' : '', hinted(wasteSrc) ? 'hint' : ''].filter(Boolean).join(' '), attrs: 'data-waste' })
      : cardSlot({ label: 'No turned-over card' });
    const canTurnBack = !state.stock.length && passesLeft(state) > 0 && state.waste.length > 0;
    const stock = state.stock.length
      ? cardBack({ button: true, attrs: 'data-stock', label: `Deck, ${state.stock.length} left: tap to turn a card` })
      : cardSlot({ button: canTurnBack, attrs: 'data-stock', label: canTurnBack ? 'Turn the pile back over for another pass' : 'Deck used up' });
    boardEl.innerHTML = `<div class="py-pyramid">${rows}</div><div class="py-deck">${stock}${waste}<span class="py-pass">Pass ${state.pass} of ${PASSES}</span></div>`;
    if (hint && 'draw' in hint) boardEl.querySelector('[data-stock]')!.classList.add('hint');
    container.querySelector('[data-left]')!.textContent = String(cardsLeft(state));
    container.querySelector('[data-deck]')!.textContent = String(state.stock.length);
    container.querySelector('[data-best]')!.textContent = best === null ? '–' : String(best);
    undoBtn.disabled = !history.length;
    statusEl.textContent = state.won
      ? 'You cleared the pyramid!'
      : message ||
        (isStuck(state)
          ? stuckText(true).replace('No moves left.', `No moves left: ${cardsLeft(state)} cards in the pyramid.`)
          : picked
            ? `Now tap a card that makes 13 with ${named(cardAt(state, picked)!)}, or tap it again to let it go.`
            : 'Tap two free cards that add up to 13, or a king. Tap the deck to turn a card.');
    showIcons(statusEl);
    if (state.won) showOverlay(boardEl, 'You win!', [['New game', startNew]]);
    else hideOverlay(boardEl);
  }

  function tap(src: Source) {
    const card = cardAt(state, src);
    if (!card) return;
    if (card.rank === 13) return commit(remove(state, [src]));
    if (sameSource(picked, src)) picked = null;
    else if (picked && cardAt(state, picked)!.rank + card.rank === 13) return commit(remove(state, [picked, src]));
    else picked = src; // a new pick (it didn't make 13 with the last one)
    message = '';
    hint = null;
    render();
  }

  function showHint() {
    hint = findHint(state);
    picked = null;
    message = !hint
      ? stuckText(true)
      : 'draw' in hint
        ? state.stock.length
          ? 'Hint: turn a card from the deck.'
          : 'Hint: turn the pile back over for another pass through the deck.'
        : hint.remove.length === 1
          ? `Hint: remove ${named(cardAt(state, hint.remove[0])!)}.`
          : `Hint: pair ${named(cardAt(state, hint.remove[0])!)} with ${named(cardAt(state, hint.remove[1])!)}.`;
    render();
  }

  function startNew() {
    state = newGame();
    history = [];
    picked = null;
    hint = null;
    message = '';
    save(STATE_KEY, state);
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-i], [data-waste], [data-stock]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.hasAttribute('data-stock')) commit(draw(state), 'The deck is used up.');
    else if (el.hasAttribute('data-waste')) tap({ from: 'waste' });
    else tap({ from: 'pyramid', i: Number(el.dataset.i) });
  });
  undoBtn.addEventListener('click', () => {
    state = history.pop()!;
    picked = null;
    hint = null;
    message = '';
    save(STATE_KEY, state);
    render();
  });
  container.querySelector('[data-hint]')!.addEventListener('click', showHint);
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.moves > 0 && !state.won;
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), startNew));

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
