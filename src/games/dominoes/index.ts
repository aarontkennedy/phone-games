import { load, save } from '../../core/storage';
import { showOverlay, hideOverlay } from '../../core/ui';
import { applyTurn, chooseTurn, draw, ends, isValidState, legalMoves, newGame, nextRound, pass, play, winner, type End, type Level, type State, type Tile } from './logic';
import './style.css';

const STATE_KEY = 'dominoes:state';
/** Pause before each computer turn. */
export const AI_DELAY = 800;

const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};
const half = (n: number) => `<svg viewBox="0 0 24 24" aria-hidden="true">${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</svg>`;
const tileFaces = ([a, b]: Tile) => `${half(a)}<span class="dom-bar"></span>${half(b)}`;
const key = ([a, b]: Tile) => `${a}-${b}`;

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  /** A tile that fits both ends, waiting for you to pick one. */
  let choosing: Tile | null = null;
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen dom">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score="0"></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-score="1"></b></div>
      </div>
      <div class="board-frame dom-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <div class="dom-actions" data-actions></div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    choosing = null;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.phase === 'playing' && state.turn === 1) {
      timer = window.setTimeout(() => update(applyTurn(state, 1, chooseTurn(state, 1))), AI_DELAY);
    }
  }

  const moves = () => legalMoves(state, 0);
  const stuck = () => state.phase === 'playing' && state.turn === 0 && !moves().length;

  function render() {
    const mine = moves();
    const line = state.line.length
      ? state.line.map((t, i) => {
          const end = i === 0 ? ' end' : i === state.line.length - 1 ? ' end' : '';
          return `<span class="dom-tile${end}" role="img" aria-label="${t[0]} and ${t[1]}">${tileFaces(t)}</span>`;
        }).join('')
      : '<span class="dom-empty">Play any tile to start.</span>';
    const hand = state.hands[0]
      .map((t) => {
        const ok = mine.some((m) => key(m.tile) === key(t));
        const picked = choosing && key(choosing) === key(t) ? ' picked' : '';
        return `<button class="dom-tile${ok ? ' lift' : ''}${picked}" data-tile="${key(t)}" aria-label="${t[0]} and ${t[1]}"${ok ? '' : ' disabled'}>${tileFaces(t)}</button>`;
      })
      .join('');
    const theirs = state.phase === 'playing'
      ? `<span class="dom-count">${state.hands[1].length} tiles</span>`
      : state.hands[1].map((t) => `<span class="dom-tile small" role="img" aria-label="${t[0]} and ${t[1]}">${tileFaces(t)}</span>`).join('');
    boardEl.innerHTML = `
      <div class="dom-row"><span>Computer</span>${theirs}<span class="dom-count">Boneyard ${state.boneyard.length}</span></div>
      <div class="dom-line" aria-label="Line of play">${line}</div>
      <div class="dom-hand" aria-label="Your tiles">${hand}</div>`;
    container.querySelectorAll<HTMLElement>('[data-score]').forEach((el, p) => (el.textContent = String(state.scores[p])));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const e = ends(state);
    actionsEl.innerHTML = choosing
      ? `<button class="btn secondary" data-end="left">Left end (${e![0]})</button><button class="btn secondary" data-end="right">Right end (${e![1]})</button>`
      : stuck()
        ? state.boneyard.length
          ? '<button class="btn" data-draw>Draw</button>'
          : '<button class="btn" data-pass>Pass</button>'
        : '';
    statusEl.textContent = statusText();

    if (state.phase === 'roundOver') showOverlay(boardEl, roundTitle(), [['Next round', () => update(nextRound(state))]]);
    else if (state.phase === 'gameOver') showOverlay(boardEl, winner(state) === 0 ? 'You win!' : 'The computer wins', [['New game', () => update(newGame(state.level))]]);
    else hideOverlay(boardEl);
  }

  function roundTitle(): string {
    const w = state.last!.winner;
    return w === null ? 'A tie' : w === 0 ? 'You win the round' : 'The computer wins the round';
  }

  function statusText(): string {
    if (state.phase !== 'playing') {
      const { winner: w, points, blocked } = state.last!;
      const why = blocked ? 'Nobody could play. ' : '';
      if (w === null) return `${why}Your pips and the computer’s are equal, so nobody scores.`;
      const who = w === 0 ? 'You' : 'The computer';
      return `${why}${who} ${blocked ? 'had fewer pips' : 'played the last tile'} and ${w === 0 ? 'score' : 'scores'} ${points}.`;
    }
    if (state.turn === 1) return 'The computer is playing…';
    const e = ends(state);
    if (choosing) return 'That tile fits both ends. Which end?';
    if (!e) return 'Your lead: tap any tile.';
    if (stuck()) return state.boneyard.length ? `Nothing matches ${e[0]} or ${e[1]}. Draw a tile.` : `Nothing matches ${e[0]} or ${e[1]}, and the boneyard is empty: tap Pass.`;
    return `Your turn: play a tile with a ${e[0]} or a ${e[1]}.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-tile]');
    if (!el) return;
    const tile = state.hands[0].find((t) => key(t) === el.dataset.tile)!;
    const options = moves().filter((m) => key(m.tile) === key(tile));
    const sameEnds = ends(state) && ends(state)![0] === ends(state)![1];
    if (options.length === 1 || sameEnds) update(play(state, 0, options[0]));
    else {
      choosing = choosing && key(choosing) === key(tile) ? null : tile;
      render();
    }
  });
  actionsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.dataset.end) update(play(state, 0, { tile: choosing!, end: el.dataset.end as End }));
    else if (el.hasAttribute('data-draw')) update(draw(state, 0));
    else update(pass(state, 0));
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
