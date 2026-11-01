import { cardBack, cardFace, cardSlot } from '../../core/card-view';
import { cardId, sameCard, type Card } from '../../core/cards';
import { load, save } from '../../core/storage';
import { handHtml } from '../../core/trick-view';
import { showOverlay, hideOverlay } from '../../core/ui';
import {
  GAME_POINTS,
  PLAYER_NAMES,
  chooseCard,
  discard,
  isValidState,
  legalPlays,
  newGame,
  nextStep,
  pileCount,
  play,
  showHand,
  total,
  winner,
  type Level,
  type Player,
  type ScoreItem,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'cribbage:state';
/** Pause before each computer play, so you can follow along. */
export const AI_DELAY = 700;

/** "2 for fifteen and 3 for a run of 3". */
function describe(items: ScoreItem[]): string {
  const parts = items.map((i) => `${i.points} for ${i.label}`);
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

const whose = (p: Player) => (p === 0 ? 'Your' : 'The computer’s');

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let picked: Card[] = [];
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen cards cb">
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
        <button class="btn" data-crib>Send to crib</button>
        <button class="btn" data-next>Next</button>
      </div>
      <div class="board-frame cb-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const cribBtn = container.querySelector<HTMLButtonElement>('[data-crib]')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('[data-next]')!;
  const scoreEls = container.querySelectorAll<HTMLElement>('[data-score]');
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    picked = [];
    save(STATE_KEY, state);
    render();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    if (state.phase === 'pegging' && state.turn === 1) {
      timer = window.setTimeout(() => update(play(state, 1, chooseCard(state, 1))), AI_DELAY);
    }
  }

  // --- Rendering ---

  function scoreTrack(): string {
    return [0, 1]
      .map((p) => {
        const pts = state.scores[p];
        return `<div class="cb-track" data-player="${p}">
          <span class="cb-who">${PLAYER_NAMES[p]}</span>
          <span class="cb-bar" role="img" aria-label="${pts} of ${GAME_POINTS}"><span style="width:${(pts / GAME_POINTS) * 100}%"></span></span>
          <b class="cb-pts">${pts}</b>
        </div>`;
      })
      .join('');
  }

  function middle(): string {
    const starter = state.starter ? cardFace(state.starter) : cardBack();
    if (state.phase === 'show') {
      const { player, cards, crib } = showHand(state);
      const title = crib ? `${whose(player)} crib` : `${whose(player)} hand`;
      return `<div class="cb-spot"><span>Starter</span>${starter}</div>
        <div class="cb-spot cb-wide"><span>${title}</span><div class="cb-fan">${cards.map((c) => cardFace(c)).join('')}</div></div>`;
    }
    const crib = state.crib.length ? state.crib.map(() => cardBack()).join('') : cardSlot();
    const pile = state.pile.length ? state.pile.map((x) => cardFace(x.card)).join('') : cardSlot();
    return `<div class="cb-spot"><span>Starter</span>${starter}</div>
      <div class="cb-spot cb-crib"><span>Crib</span><div class="cb-fan">${crib}</div></div>
      <div class="cb-spot cb-wide"><span>Count <b data-count>${pileCount(state)}</b></span><div class="cb-fan">${pile}</div></div>`;
  }

  function opponent(): string {
    const backs = state.hands[1].map(() => cardBack()).join('') || cardSlot();
    const role = state.dealer === 1 ? ' · dealer' : '';
    return `<div class="cb-opponent"><span>Computer${role}</span><div class="cb-fan">${backs}</div></div>`;
  }

  function statusText(): string {
    const scored = state.events.map((e) => `${PLAYER_NAMES[e.player]} score${e.player ? 's' : ''} ${describe(e.items)}.`).join(' ');
    switch (state.phase) {
      case 'discard':
        return `Pick 2 cards for ${state.dealer === 0 ? 'your' : 'the computer’s'} crib. ${picked.length} picked.`;
      case 'show': {
        const { player, crib } = showHand(state);
        const items = state.events[0].items; // always set in the show, even when empty
        const title = `${whose(player)} ${crib ? 'crib' : 'hand'}`;
        return items.length ? `${title}: ${describe(items)}. Total ${total(items)}.` : `${title} scores nothing.`;
      }
      case 'gameOver': {
        const [me, cpu] = state.scores;
        return `${scored} ${winner(state) === 0 ? `You win ${me} to ${cpu}!` : `The computer wins ${cpu} to ${me}.`}`.trim();
      }
    }
    if (state.turn === 1) return `${scored} Computer is playing…`.trim();
    const last = state.pile.at(-1) ?? state.pegged.at(-1);
    const go = last?.player === 0 && state.pile.length ? ' The computer says go.' : '';
    return `${scored}${go} Your turn. The count is ${pileCount(state)}.`.trim();
  }

  function render() {
    const playable = state.phase === 'discard' ? ('all' as const) : state.phase === 'pegging' && state.turn === 0 ? legalPlays(state, 0) : [];
    const hand = state.phase === 'show' || state.phase === 'gameOver' ? state.kept[0] : state.hands[0];
    boardEl.innerHTML = `
      <div class="cb-scores">${scoreTrack()}</div>
      ${opponent()}
      <div class="cb-middle">${middle()}</div>
      ${hand.length ? handHtml(hand, { playable: state.phase === 'show' ? [] : playable, picked }) : `<div class="tt-hand">${cardSlot()}</div>`}`;
    scoreEls.forEach((el, p) => (el.textContent = String(state.scores[p])));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    cribBtn.hidden = state.phase !== 'discard';
    cribBtn.disabled = picked.length !== 2;
    nextBtn.hidden = state.phase !== 'show';
    nextBtn.textContent = state.showStep === 2 ? 'Next hand' : 'Next';
    statusEl.textContent = statusText();

    if (state.phase === 'gameOver') {
      showOverlay(boardEl, winner(state) === 0 ? 'You win!' : 'The computer wins', [['New game', () => update(newGame(state.level))]]);
    } else hideOverlay(boardEl);
  }

  // --- Input ---

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-hand]');
    if (!el) return;
    const c = state.hands[0].find((h) => cardId(h) === el.dataset.card)!;
    if (state.phase === 'discard') {
      picked = picked.some((p) => sameCard(p, c)) ? picked.filter((p) => !sameCard(p, c)) : [...picked, c].slice(-2);
      render();
    } else update(play(state, 0, c));
  });
  cribBtn.addEventListener('click', () => update(discard(state, picked)));
  nextBtn.addEventListener('click', () => update(nextStep(state)));
  container.querySelector('[data-new]')!.addEventListener('click', () => update(newGame(state.level)));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  render();
  schedule();

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
