import { coach } from '../../core/coach';
import { dieFace } from '../../core/dice-view';
import { RECENT_HTML, recentMoves } from '../../core/recent';
import { load, save } from '../../core/storage';
import { confirmNew, hideOverlay, levelSetting, settingsHtml, showOverlay } from '../../core/ui';
import { GOAL, best, computerStep, endBust, hold, isValidState, newGame, roll, type Level, type State } from './logic';
import './style.css';

const STATE_KEY = 'pig:state';
/** Pause between the computer's rolls. */
export const AI_DELAY = 700;
/** How long a rolled 1 stays on screen before the turn passes. */
export const BUST_PAUSE = 1300;

/** What a step did, for the recent moves list: a turn's end. Null mid-turn. */
export function moveText(prev: State, next: State): string | null {
  const who = prev.turn === 0 ? 'You' : 'The computer';
  if (!prev.bust && next.bust) return `${who} rolled a 1 and lost ${prev.turnPoints === 0 ? 'nothing' : `${prev.turnPoints} points`}.`;
  if (next.scores[prev.turn] > prev.scores[prev.turn]) return `${who} held ${prev.turnPoints}, for ${next.scores[prev.turn]}.`;
  return null;
}

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newGame();
  let timer: number | undefined;
  /** How often your rolls and holds were the best plays to win (src/core/coach.ts). */
  const coaching = coach('pig');
  let missed: string | null = null;

  container.innerHTML = `
    <div class="screen pi">
      <div class="stats">
        <div class="stat"><small>You</small><b data-score="0"></b></div>
        <button class="btn" data-new>New</button>
        <div class="stat"><small>Computer</small><b data-score="1"></b></div>
        <div class="stat"><small>Right</small><b data-accuracy></b></div>
      </div>
      <div class="board-frame pi-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      ${RECENT_HTML}
      <div class="controls" data-controls></div>
    </div>${settingsHtml(levelSetting())}`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;
  const levelBtns = container.querySelectorAll<HTMLButtonElement>('[data-level]');
  const recent = recentMoves(container, 'pig');

  function update(next: State | null) {
    if (!next) return;
    recent.add(moveText(state, next));
    if (next.turnPoints !== state.turnPoints || next.turn !== state.turn) coaching.asked = false;
    state = next;
    save(STATE_KEY, state);
    render();
    clearTimeout(timer);
    if (state.winner !== null) return;
    if (state.bust) timer = window.setTimeout(() => update(endBust(state)), BUST_PAUSE);
    else if (state.turn === 1) timer = window.setTimeout(() => update(computerStep(state)), AI_DELAY);
  }

  function start(next: State) {
    state = next;
    recent.clear();
    missed = null;
    update(next);
  }

  const mine = () => state.turn === 0 && state.winner === null && !state.bust;

  function render() {
    const die = state.roll ? `<span class="pi-die${state.bust ? ' bust' : ''}" role="img" aria-label="Die showing ${state.roll}">${dieFace(state.roll)}</span>` : '<span class="pi-die blank" role="img" aria-label="Not rolled yet"></span>';
    boardEl.innerHTML = `
      <p class="pi-turn"><b>${state.turn === 0 ? 'Your turn' : 'Computer’s turn'}</b></p>
      ${die}
      <p class="pi-total">This turn: <b data-turn-points>${state.turnPoints}</b></p>
      <div class="pi-bars" aria-hidden="true">${([0, 1] as const)
        .map((p) => `<div class="pi-bar p${p}"><span style="width:${Math.min(100, state.scores[p])}%"></span></div>`)
        .join('')}</div>`;
    container.querySelectorAll<HTMLElement>('[data-score]').forEach((el, p) => (el.textContent = String(state.scores[p])));
    container.querySelector('[data-accuracy]')!.textContent = coaching.text();
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
    const tip = mine() && state.turnPoints > 0 ? `Best: <b>${best(state) === 'hold' ? `hold ${state.turnPoints}` : 'roll again'}</b>.` : null;
    controlsEl.innerHTML = mine()
      ? `${coaching.html(tip && (coaching.asked ? tip : ''))}<button class="btn" data-roll>Roll</button><button class="btn secondary" data-hold${state.turnPoints ? '' : ' disabled'}>Hold</button>`
      : '';
    statusEl.textContent = statusText();
    if (state.winner !== null) showOverlay(boardEl, state.winner === 0 ? 'You win!' : 'The computer wins', [['New game', () => start(newGame(state.level))]]);
    else hideOverlay(boardEl);
  }

  function statusText(): string {
    const lesson = missed && state.turn === 0 ? `${missed} ` : '';
    if (state.winner !== null) return state.winner === 0 ? `You reached ${GOAL}!` : `The computer reached ${GOAL}.`;
    if (state.bust) return `A 1! ${state.turn === 0 ? 'Your' : 'The computer’s'} turn ends with nothing banked.`;
    if (state.turn === 1) return 'The computer is rolling…';
    if (!state.turnPoints) return `${lesson}Roll the die. Hold to bank your turn’s points, but a 1 loses them. First to ${GOAL} wins.`;
    return `${lesson}You have ${state.turnPoints} this turn, ${state.scores[0] + state.turnPoints} if you hold. Roll again, or hold.`;
  }

  /** Scores a roll or hold against the best play, before it's made. */
  function score(play: 'roll' | 'hold') {
    if (!state.turnPoints) return void (missed = null); // the first roll of a turn isn't a choice
    const right = play === best(state);
    missed = coaching.score(right) && !right ? `Best was to ${play === 'hold' ? 'roll again' : `hold ${state.turnPoints}`}.` : null;
  }

  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) {
      coaching.asked = true;
      render();
    } else if (el.hasAttribute('data-roll')) {
      score('roll');
      update(roll(state));
    } else if (el.hasAttribute('data-hold')) {
      score('hold');
      update(hold(state));
    }
  });
  // A game partway through: New asks first (docs/DESIGN.md, "Screen layout").
  const inProgress = () => state.winner === null && (state.scores.some((n) => n > 0) || state.turnPoints > 0);
  container.querySelector('[data-new]')!.addEventListener('click', () => confirmNew(inProgress(), () => start(newGame(state.level))));
  levelBtns.forEach((b) => b.addEventListener('click', () => update({ ...state, level: b.dataset.level as Level })));

  update(state);

  return () => {
    clearTimeout(timer);
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
