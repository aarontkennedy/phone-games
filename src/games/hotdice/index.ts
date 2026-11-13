import { dieFace } from '../../core/dice-view';
import { load, save } from '../../core/storage';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { showOverlay, hideOverlay, confirmNew, levelSetting, settingsHtml } from '../../core/ui';
import { GOAL, bank, computerStep, endBust, isValidState, keep, newGame, roll, scoreDice, winner, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'hotdice:state';
/** Pause between the computer's steps. */
export const AI_DELAY = 800;
/** How long a bust stays on screen before the turn passes. */
export const BUST_PAUSE = 1600;

const face = dieFace;
const fmt = (n: number) => n.toLocaleString('en-US');
const spaced = (dice: number[]) => dice.join(' ');

/** What a step just did, for the recent moves list; null if it says nothing new. */
export function moveText(prev: State, next: State): string | null {
  const who = prev.turn === 0 ? 'You' : 'The computer';
  if (prev.phase === 'roll' && next.phase === 'bust') return `${who} rolled ${spaced(next.dice)}: bust.`;
  if (prev.phase === 'choose' && next.phase === 'roll') {
    const points = fmt(next.turnPoints - prev.turnPoints);
    // Every die scored: they all go back in (hot dice), so `kept` starts again.
    if (next.kept.length <= prev.kept.length) return `${who} rolled ${spaced(prev.dice)}, kept all for ${points}: hot dice!`;
    return `${who} rolled ${spaced(prev.dice)}, kept ${spaced(next.kept.slice(prev.kept.length))} for ${points}.`;
  }
  const banked = next.scores[prev.turn] - prev.scores[prev.turn];
  return banked > 0 ? `${who} banked ${fmt(banked)}.` : null;
}

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
      ${RECENT_HTML}
      <div class="controls">
        <div class="hd-actions" data-actions></div>
      </div>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const actionsEl = container.querySelector<HTMLElement>('[data-actions]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'hotdice');

  function update(next: State | null) {
    if (!next) return;
    recent.add(moveText(state, next));
    state = next;
    picked = [];
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.phase === 'bust') timer = window.setTimeout(() => update(endBust(state)), BUST_PAUSE);
    else if (state.phase !== 'gameOver' && state.turn === 1) timer = window.setTimeout(() => update(computerStep(state)), AI_DELAY);
  }

  /** A new game starts with an empty list. */
  function start(next: State) {
    state = next;
    recent.clear();
    update(next);
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

    if (state.phase === 'gameOver') showOverlay(boardEl, winner(state) === 0 ? 'You win!' : 'The computer wins', [['New game', () => start(newGame(state.level))]]);
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
      if (!kept) return;
      update(kept); // one step at a time, so the recent moves list sees each
      update(act === 'keep-roll' ? roll(state) : bank(state));
    }
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.phase !== 'gameOver' && (state.scores.some((n) => n > 0) || state.turnPoints > 0 || state.dice.length > 0);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => start(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    container.replaceChildren();
  };
}
