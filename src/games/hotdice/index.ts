import { load, save } from '../../core/storage';
import { showOverlay, hideOverlay, confirmNew } from '../../core/ui';
import { GOAL, bank, computerStep, endBust, isValidState, keep, newGame, roll, scoreDice, winner, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'hotdice:state';
/** Pause between the computer's steps. */
export const AI_DELAY = 800;
/** How long a bust stays on screen before the turn passes. */
export const BUST_PAUSE = 1600;

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};
const face = (n: number) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3"/>`).join('')}</svg>`;
const fmt = (n: number) => n.toLocaleString('en-US');

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let picked: number[] = [];
  let timer: number | undefined;

  container.innerHTML = `
    <div class="screen hd">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score="0"></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-score="1"></b></div>
      </div>
      <div class="board-frame hd-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls">
        <div class="segmented" aria-label="Computer player">
          <button data-level="easy">Easy</button>
          <button data-level="strong">Strong</button>
        </div>
        <div class="hd-actions" data-actions></div>
      </div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');

  function update(next: State | null) {
    if (!next) return;
    state = next;
    picked = [];
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.phase === 'bust') timer = window.setTimeout(() => update(endBust(state)), BUST_PAUSE);
    else if (state.phase !== 'gameOver' && state.turn === 1) timer = window.setTimeout(() => update(computerStep(state)), AI_DELAY);
  }

  const mine = () => state.turn === 0 && state.phase !== 'gameOver';
  const pickedScore = () => scoreDice(picked.map((i) => state.dice[i]));

  function render() {
    const choosing = mine() && state.phase === 'choose';
    const dice = state.dice
      .map((d, i) => {
        const on = picked.includes(i);
        return `<button class="hd-die${on ? ' picked' : ''}" data-die="${i}" aria-label="Die showing ${d}${on ? ', kept' : ''}" aria-pressed="${on}"${choosing ? '' : ' disabled'}>${face(d)}</button>`;
      })
      .join('');
    const kept = state.kept.map((d) => `<span class="hd-die small" role="img" aria-label="Kept ${d}">${face(d)}</span>`).join('');
    boardEl.innerHTML = `
      <p class="hd-turn"><b>${state.turn === 0 ? 'Your turn' : 'Computer’s turn'}</b> · This turn: <b data-turn-points>${fmt(state.turnPoints)}</b></p>
      <div class="hd-dice">${dice || `<span class="hd-hint">${state.remaining} ${state.remaining === 1 ? 'die' : 'dice'} to roll</span>`}</div>
      <div class="hd-kept"><span>Kept</span>${kept || '<span class="tt-muted">none yet</span>'}</div>`;
    container.querySelectorAll<HTMLElement>('[data-score]').forEach((el, p) => (el.textContent = fmt(state.scores[p])));
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));

    const score = pickedScore();
    actionsEl.innerHTML = !mine()
      ? ''
      : state.phase === 'choose'
        ? `<button class="btn" data-act="keep-roll"${score ? '' : ' disabled'}>Keep &amp; roll</button><button class="btn secondary" data-act="keep-bank"${score ? '' : ' disabled'}>Keep &amp; bank</button>`
        : state.phase === 'roll'
          ? `<button class="btn" data-act="roll">Roll ${state.remaining}</button>${state.turnPoints ? '<button class="btn secondary" data-act="bank">Bank</button>' : ''}`
          : '';
    statusEl.textContent = statusText(score);

    if (state.phase === 'gameOver') showOverlay(boardEl, winner(state) === 0 ? 'You win!' : 'The computer wins', [['New game', () => update(newGame(state.level))]]);
    else hideOverlay(boardEl);
  }

  function statusText(score: number | null): string {
    const who = state.turn === 0 ? 'You' : 'The computer';
    if (state.phase === 'gameOver') return `${who} reached ${fmt(GOAL)} with ${fmt(state.scores[state.turn])}!`;
    if (state.phase === 'bust') return `Bust! Nothing scored, so ${state.turn === 0 ? 'your' : 'the computer’s'} turn ends with no points.`;
    if (state.turn === 1) return 'The computer is playing…';
    if (state.phase === 'choose') {
      if (!picked.length) return 'Tap the dice to keep: 1s, 5s and sets of three or more score.';
      return score ? `Keeping these scores ${fmt(score)}. Roll on or bank.` : 'Those dice don’t all score. Keep only scoring dice.';
    }
    return state.turnPoints ? `You have ${fmt(state.turnPoints)} this turn. Roll again, or bank to keep it.` : `First to ${fmt(GOAL)} wins. Tap Roll to start your turn.`;
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-die]');
    if (!el) return;
    const i = Number(el.dataset.die);
    picked = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i];
    render();
  });
  actionsEl.addEventListener('click', (e) => {
    const act = (e.target as Element).closest<HTMLButtonElement>('[data-act]')?.dataset.act;
    if (act === 'roll') update(roll(state));
    else if (act === 'bank') update(bank(state));
    else if (act) {
      const kept = keep(state, picked);
      update(kept && (act === 'keep-roll' ? roll(kept) : bank(kept)));
    }
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.scores.some((n) => n > 0) || state.turnPoints > 0 || state.dice.length > 0);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => update(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
