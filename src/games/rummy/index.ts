import { cardBack, cardFace } from '../../core/card-view';
import { cardId, cardName, sameCard, suitName, type Card } from '../../core/cards';
import { load, save } from '../../core/storage';
import { handColumns, handHtml } from '../../core/trick-view';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { confirmNew, hideOverlay, showOverlay } from '../../core/ui';
import {
  GAME_POINTS,
  applyTurn,
  canTake,
  chooseTurn,
  discard,
  drawStock,
  fits,
  isMeld,
  isSet,
  isValidState,
  layOff,
  meld,
  newGame,
  nextHand,
  sortMeld,
  takePile,
  undoTake,
  winner,
  type Action,
  type Level,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'rummy:state';
/** Pause before each of the computer's moves. */
export const AI_DELAY = 900;

const NAMES = ['', 'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
const COUNTS = ['', '', '', 'three', 'four'];
const lower = (c: Card) => cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase());
const and = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]);

/** "three 7s", "the 5, 6 and 7 of hearts". */
export function meldText(m: Card[]): string {
  if (isSet(m)) return `${COUNTS[m.length]} ${m[0].rank === 1 || m[0].rank > 10 ? `${NAMES[m[0].rank]}s` : `${m[0].rank}s`}`;
  return `the ${and(sortMeld(m).map((c) => NAMES[c.rank]))} of ${suitName(m[0].suit)}`;
}

/** What a player just did, for the recent moves list. */
export function actionText(a: Action): string {
  const who = a.player === 0 ? 'You' : 'The computer';
  if (a.kind === 'stock') return `${who} drew from the deck.`;
  if (a.kind === 'pile') return `${who} took the ${lower(a.cards[0])} from the pile${a.cards.length > 1 ? ` and ${a.cards.length - 1} more` : ''}.`;
  if (a.kind === 'meld') return `${who} melded ${meldText(a.cards)}.`;
  if (a.kind === 'layoff') return `${who} laid off the ${and(a.cards.map(lower))}.`;
  return `${who} discarded the ${lower(a.cards[0])}.`;
}

/** What a step just did, for the recent moves list; null if nobody moved. */
export function moveText(prev: State, next: State): string | null {
  if (next.action && next.action !== prev.action) return actionText(next.action);
  return !next.action && prev.action?.kind === 'pile' ? 'You put the pile cards back.' : null;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** Cards you've tapped, to meld, lay off or discard. */
  let picked: Card[] = [];
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards rm">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score="0"></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-score="1"></b></div>
      </div>
      <div class="board-frame rm-table" data-board></div>
      ${RECENT_HTML}
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <div class="rm-actions" data-actions></div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'rummy');

  function update(next: State | null) {
    if (!next) return;
    recent.add(moveText(state, next));
    state = next;
    picked = [];
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if ((state.phase === 'draw' || state.phase === 'play') && state.turn === 1) {
      timer = window.setTimeout(() => update(applyTurn(state, 1, chooseTurn(state, 1))), AI_DELAY);
    }
  }

  /** A new hand or game starts with an empty list. */
  function start(next: State | null) {
    if (!next) return;
    state = next;
    recent.clear();
    update(next);
  }

  const myDraw = () => state.phase === 'draw' && state.turn === 0;
  const myPlay = () => state.phase === 'play' && state.turn === 0;
  const mustOk = () => !state.mustUse || picked.some((c) => sameCard(c, state.mustUse!));
  const canMeld = () => myPlay() && mustOk() && isMeld(picked);
  const layTarget = () => (myPlay() && mustOk() ? fits(state.table, picked) : -1);
  const canDiscard = () => myPlay() && !state.mustUse && picked.length === 1;

  function render() {
    const melds = state.table.length
      ? state.table.map((m) => `<div class="rm-meld" role="img" aria-label="Meld: ${meldText(m)}">${m.map((c) => cardFace(c)).join('')}</div>`).join('')
      : '<span class="tt-muted">No melds yet</span>';
    const pile = state.discard
      .map((c, i) => cardFace(c, { button: true, className: i >= handColumns(state.discard.length) ? 'next-row' : '', attrs: `data-pile="${i}"${myDraw() && canTake(state, 0, i) ? '' : ' disabled'}` }))
      .join('');
    const cols = handColumns(state.discard.length);
    boardEl.innerHTML = `
      <p class="rm-info">Computer ${state.hands[1].length} cards<span class="tt-muted"> · Melded: you ${state.melded[0]}, it ${state.melded[1]}</span></p>
      <div class="rm-melds">${melds}</div>
      <div class="rm-piles">
        <div class="rm-deck"><span>Deck ${state.stock.length}</span>${cardBack({ button: myDraw(), attrs: 'data-stock', label: 'Draw from the deck' })}</div>
        <div class="rm-pile-wrap"><span>Pile</span><div class="tt-hand rm-pile" aria-label="Discard pile"${cols === 7 ? '' : ` style="--hand-cols:${cols}"`}>${pile}</div></div>
      </div>
      ${handHtml(state.hands[0], { playable: myPlay() ? 'all' : [], picked, received: state.mustUse ? [state.mustUse] : [] })}`;

    container.querySelectorAll<HTMLElement>('[data-score]').forEach((el, p) => (el.textContent = String(state.scores[p])));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    actionsEl.innerHTML = [
      canMeld() ? '<button class="btn" data-meld>Meld</button>' : '',
      layTarget() >= 0 ? '<button class="btn" data-layoff>Lay off</button>' : '',
      canDiscard() ? '<button class="btn" data-discard>Discard</button>' : '',
      myPlay() && state.before ? '<button class="btn secondary" data-undo>Undo</button>' : '',
    ].join('');
    statusEl.textContent = statusText();

    if (state.phase === 'handOver') showOverlay(boardEl, handTitle(), [['Next hand', () => start(nextHand(state))]]);
    else if (state.phase === 'gameOver') showOverlay(boardEl, winner(state) === 0 ? 'You win!' : 'The computer wins', [['New game', () => start(newGame(state.level))]]);
    else hideOverlay(boardEl);
  }

  function handTitle(): string {
    const [mine, theirs] = state.last!.points;
    return mine > theirs ? 'You win the hand' : mine < theirs ? 'The computer wins the hand' : 'A tied hand';
  }

  function statusText(): string {
    if (state.phase === 'handOver' || state.phase === 'gameOver') {
      const { melded, held, points, out } = state.last!;
      const how = out === null ? 'The deck ran out.' : out === 0 ? 'You went out.' : 'The computer went out.';
      const end = state.phase === 'gameOver' ? ` First to ${GAME_POINTS}: ${winner(state) === 0 ? 'you win!' : 'the computer wins.'}` : '';
      return `${how} You melded ${melded[0]} and held ${held[0]}: ${points[0]}. The computer melded ${melded[1]} and held ${held[1]}: ${points[1]}.${end}`;
    }
    if (state.turn === 1) return 'The computer is playing…';
    if (myDraw()) return `Your turn: tap the deck, or a pile card you can meld. You take every card above it too.`;
    if (state.mustUse) return `Meld the ${lower(state.mustUse)} (dashed outline): tap it and the cards that go with it, then Meld or Lay off.`;
    if (picked.length) return 'Tap Meld or Lay off for a meld; Discard for one card to end your turn.';
    return 'Tap cards to meld or lay off, or tap one card and Discard to end your turn.';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-hand], [data-stock], [data-pile]');
    if (!el) return;
    if (el.hasAttribute('data-stock')) return update(drawStock(state, 0));
    if (el.dataset.pile) return update(takePile(state, 0, Number(el.dataset.pile)));
    if (!myPlay()) return;
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    picked = picked.some((p) => sameCard(p, c)) ? picked.filter((p) => !sameCard(p, c)) : [...picked, c];
    render();
  });
  actionsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-meld')) update(meld(state, 0, picked));
    else if (el.hasAttribute('data-layoff')) update(layOff(state, 0, picked, layTarget()));
    else if (el.hasAttribute('data-discard')) update(discard(state, 0, picked[0]));
    else update(undoTake(state, 0));
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.scores.some((n) => n !== 0) || state.action !== null);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => start(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
