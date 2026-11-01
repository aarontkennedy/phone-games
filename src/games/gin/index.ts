import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { cardId, cardName, sameCard, type Card } from '../../core/cards';
import { sortHand } from '../../core/tricks';
import { load, save } from '../../core/storage';
import { handHtml } from '../../core/trick-view';
import { showOverlay, hideOverlay } from '../../core/ui';
import {
  GAME_POINTS,
  KNOCK_AT,
  applyTurn,
  bestMelds,
  canKnockWith,
  chooseTurn,
  discard,
  drawDiscard,
  drawStock,
  isValidState,
  newGame,
  nextHand,
  winner,
  type Level,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'gin:state';
/** Pause between the computer's draw and discard. */
export const AI_DELAY = 800;

const lower = (c: Card) => cardName(c).replace(/^(Ace|Jack|Queen|King)/, (w) => w.toLowerCase());

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let knocking = false;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards gin">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score="0"></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-score="1"></b></div>
      </div>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <button class="btn secondary" data-knock aria-pressed="false">Knock</button>
      </div>
      <div class="board-frame gin-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const knockBtn = container.querySelector<HTMLButtonElement>('[data-knock]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    knocking = false;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if ((state.phase === 'draw' || state.phase === 'discard') && state.turn === 1) {
      timer = window.setTimeout(() => update(applyTurn(state, 1, chooseTurn(state, 1))), AI_DELAY);
    }
  }

  const myDraw = () => state.phase === 'draw' && state.turn === 0;
  const myDiscard = () => state.phase === 'discard' && state.turn === 0;
  const canKnock = () => myDiscard() && state.hands[0].some((c) => !(state.taken && sameCard(c, state.taken)) && canKnockWith(state, 0, c));

  /** Your hand with melds first, then loose cards in suit order. */
  function arranged(hand: Card[]) {
    const { melds, deadwood } = bestMelds(hand);
    return { order: [...melds.flat(), ...sortHand(deadwood)], loose: deadwood };
  }

  function render() {
    const done = state.phase === 'handOver' || state.phase === 'gameOver';
    const theirs = done
      ? arranged(state.hands[1]).order.map((c) => cardFace(c)).join('')
      : state.hands[1].map(() => cardBack()).join('');
    const top = state.discard.at(-1);
    const pile = top ? cardFace(top, { button: myDraw(), attrs: 'data-pile' }) : cardSlot();
    const { order, loose } = arranged(state.hands[0]);
    const playable = myDiscard()
      ? state.hands[0].filter((c) => !(state.taken && sameCard(c, state.taken)) && (!knocking || canKnockWith(state, 0, c)))
      : [];
    boardEl.innerHTML = `
      <div class="gin-row"><span>Computer${state.dealer === 1 ? ' · dealer' : ''}</span><div class="gin-fan${done ? ' open' : ''}">${theirs}</div></div>
      <div class="gin-row gin-piles">
        <div><span>Deck ${state.stock.length}</span>${cardBack({ button: myDraw(), attrs: 'data-stock', label: 'Draw from the deck' })}</div>
        <div><span>Pile</span>${pile}</div>
      </div>
      ${handHtml(order, { playable, marked: { loose }, keepOrder: true })}`;
    container.querySelectorAll<HTMLElement>('[data-score]').forEach((el, p) => (el.textContent = String(state.scores[p])));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    knockBtn.hidden = !canKnock();
    knockBtn.setAttribute('aria-pressed', String(knocking));
    statusEl.textContent = statusText(loose);

    if (state.phase === 'handOver') showOverlay(boardEl, handTitle(), [['Next hand', () => update(nextHand(state))]]);
    else if (state.phase === 'gameOver') showOverlay(boardEl, winner(state) === 0 ? 'You win!' : 'The computer wins', [['New game', () => update(newGame(state.level))]]);
    else hideOverlay(boardEl);
  }

  function handTitle(): string {
    const r = state.last!;
    if (r.kind === 'draw') return 'No winner';
    if (r.kind === 'gin') return r.winner === 0 ? 'Gin!' : 'The computer has gin';
    if (r.kind === 'undercut') return r.winner === 0 ? 'Undercut!' : 'You were undercut';
    return r.winner === 0 ? 'You win the hand' : 'The computer wins the hand';
  }

  function statusText(loose: Card[]): string {
    const dw = loose.reduce((t, c) => t + Math.min(c.rank, 10), 0);
    if (state.phase === 'handOver' || state.phase === 'gameOver') {
      const r = state.last!;
      if (r.kind === 'draw') return 'The deck ran low, so nobody scores this hand.';
      const who = r.knocker === 0 ? 'You' : 'The computer';
      const [mine, cpu] = r.deadwood;
      const how = r.kind === 'gin' ? `${who} went gin` : `${who} knocked`;
      const scorer = r.winner === 0 ? 'you score' : 'the computer scores';
      const end = state.phase === 'gameOver' ? ` First to ${GAME_POINTS}: ${winner(state) === 0 ? 'you win!' : 'the computer wins.'}` : '';
      return `${how}. Deadwood: you ${mine}, computer ${cpu}, so ${scorer} ${r.points}.${end}`;
    }
    if (state.turn === 1) return 'The computer is playing…';
    const tip = ` Your deadwood: ${dw}. Loose cards have a dashed outline.`;
    if (myDraw()) return `Your turn: take the ${top()} from the pile, or draw from the deck.${tip}`;
    if (knocking) return `Tap a card to discard and knock (you need ${KNOCK_AT} or less deadwood).`;
    return `Tap a card to discard.${canKnock() ? ' You can knock: tap Knock first.' : ''}${tip}`;
  }

  const top = () => lower(state.discard.at(-1)!);

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-hand], [data-stock], [data-pile]');
    if (!el) return;
    if (el.hasAttribute('data-stock')) return update(drawStock(state, 0));
    if (el.hasAttribute('data-pile')) return update(drawDiscard(state, 0));
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    update(discard(state, 0, c, knocking));
  });
  knockBtn.addEventListener('click', () => {
    knocking = !knocking;
    render();
  });
  container.querySelector('[data-new]')!.addEventListener('click', () => update(newGame(state.level)));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
