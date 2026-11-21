import { coach } from '../../core/coach';
import { dieFace } from '../../core/dice-view';
import { load, save } from '../../core/storage';
import {
  TILES,
  bestDice,
  bestShut,
  canRollOne,
  isShut,
  isValidState,
  newRound,
  roll,
  rollTotal,
  score,
  shut,
  shutOptions,
  shutValue,
  type State,
} from './logic';
import './style.css';

const STATE_KEY = 'shutbox:state';
const BEST_KEY = 'shutbox:best';

/** "4 and 5", "1, 3 and 5" */
const listOf = (ns: number[]) => (ns.length > 1 ? `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}` : String(ns[0]));

export function mount(container: HTMLElement): () => void {
  const saved = load<unknown>(STATE_KEY, null);
  let state: State = isValidState(saved) ? saved : newRound();
  /** Your lowest finished round (0 is shutting the box), or null before the first. */
  let best = load<number | null>(BEST_KEY, null);
  /** Tiles you've picked to shut. */
  let picked: number[] = [];
  /** How often your choices were the best ones (src/core/coach.ts). */
  const coaching = coach('shutbox');
  /** After a choice: the best one, when yours wasn't, said until your next choice. */
  let missed: string | null = null;

  container.innerHTML = `
    <div class="screen sb">
      <div class="stats">
        <div class="stat"><small>Score</small><b data-score></b></div>
        <div class="stat"><small>Best</small><b data-best></b></div>
        <div class="stat"><small>Right</small><b data-accuracy></b></div>
      </div>
      <div class="board-frame sb-table" data-board></div>
      <p class="status-line" data-status aria-live="polite"></p>
      <div class="controls" data-controls></div>
    </div>`;

  const boardEl = container.querySelector<HTMLElement>('[data-board]')!;
  const controlsEl = container.querySelector<HTMLElement>('[data-controls]')!;
  const statusEl = container.querySelector<HTMLElement>('[data-status]')!;

  function update(next: State | null) {
    if (!next) return;
    if (next.phase !== state.phase || next.dice !== state.dice) coaching.asked = false;
    state = next;
    picked = [];
    if (state.phase === 'over' && (best === null || score(state) < best)) save(BEST_KEY, (best = score(state)));
    save(STATE_KEY, state);
    render();
  }

  const pickedSum = () => picked.reduce((a, b) => a + b, 0);
  /** Whether there's a real choice to make now (and so a hint to give, and a play to score). */
  const choosing = () => state.phase === 'choose' && shutOptions(state).length > 1;
  const choosingDice = () => state.phase === 'roll' && canRollOne(state);

  function render() {
    const tip = coaching.asked ? (choosing() ? bestShut(state) : null) : null;
    boardEl.innerHTML = `
      <div class="sb-tiles">${TILES.map((n, i) => {
        const open = state.open[i];
        const on = picked.includes(n);
        const hint = tip?.includes(n) ? ' hint' : '';
        const label = `Tile ${n}${open ? (on ? ', picked' : '') : ', shut'}`;
        return `<button class="sb-tile${open ? '' : ' shut'}${on ? ' picked' : ''}${hint}" data-tile="${n}" aria-label="${label}" aria-pressed="${on}"${open && state.phase === 'choose' ? '' : ' disabled'}>${open ? n : ''}</button>`;
      }).join('')}</div>
      <div class="sb-dice">${
        state.dice.length
          ? state.dice.map((d) => `<span class="sb-die" role="img" aria-label="Die showing ${d}">${dieFace(d)}</span>`).join('')
          : '<span class="sb-none">Not rolled yet</span>'
      }</div>`;
    container.querySelector('[data-score]')!.textContent = String(score(state));
    container.querySelector('[data-best]')!.textContent = best === null ? '–' : String(best);
    container.querySelector('[data-accuracy]')!.textContent = coaching.text();

    let coachRow = '';
    if (choosing()) coachRow = coaching.html(coaching.asked ? 'Best: shut the <b>outlined tiles</b>.' : '');
    else if (choosingDice()) coachRow = coaching.html(coaching.asked ? `Best: roll <b>${bestDice(state) === 1 ? 'one die' : 'two dice'}</b>.` : '');
    controlsEl.innerHTML =
      coachRow +
      (state.phase === 'roll'
        ? canRollOne(state)
          ? '<button class="btn secondary" data-roll="1">Roll 1 die</button><button class="btn" data-roll="2">Roll 2 dice</button>'
          : '<button class="btn" data-roll="2">Roll</button>'
        : state.phase === 'choose'
          ? `<button class="btn" data-shut${pickedSum() === rollTotal(state) ? '' : ' disabled'}>Shut</button>`
          : '<button class="btn" data-new-round>New round</button>');
    statusEl.textContent = (missed ? `${missed} ` : '') + statusText();
  }

  function statusText(): string {
    const total = rollTotal(state);
    if (state.phase === 'over') {
      // A finished round always has a best: this one, or a lower one from before.
      if (isShut(state)) return `You shut the box! Score 0. Best: ${best}.`;
      return `No open tiles make ${total}. Round over: score ${score(state)}. Best: ${best}.`;
    }
    if (state.phase === 'choose') {
      const sum = pickedSum();
      if (!sum) return `You rolled ${total}. Tap open tiles that add up to ${total}.`;
      return sum === total ? `Those make ${total}. Tap Shut.` : `Picked ${sum} of ${total}.`;
    }
    if (canRollOne(state)) return '7, 8 and 9 are shut, so you may roll one die or two.';
    return state.dice.length ? 'Roll again.' : 'Roll the dice, then shut tiles that add up to the roll. Low score wins.';
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('[data-tile]');
    if (!el || state.phase !== 'choose') return;
    const n = Number(el.dataset.tile);
    picked = picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n];
    render();
  });
  controlsEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!el) return;
    if (el.hasAttribute('data-hint')) {
      coaching.asked = true;
      render();
    } else if (el.dataset.roll) {
      const dice = Number(el.dataset.roll) as 1 | 2;
      // Scored before the roll when you had a choice of dice; not if you asked first.
      if (choosingDice()) {
        const best = bestDice(state);
        missed = coaching.score(dice === best) && dice !== best ? `Best was to roll ${best === 1 ? 'one die' : 'two dice'}.` : null;
      } else missed = null;
      update(roll(state, dice));
    } else if (el.hasAttribute('data-shut')) {
      if (choosing()) {
        const best = bestShut(state);
        const right = shutValue(state, picked) <= shutValue(state, best) + 1e-12;
        missed = coaching.score(right) && !right ? `Best was to shut ${listOf(best)}.` : null;
      } else missed = null;
      update(shut(state, picked));
    } else if (el.hasAttribute('data-new-round')) {
      missed = null;
      update(newRound());
    }
  });

  render();

  return () => {
    save(STATE_KEY, state);
    container.replaceChildren();
  };
}
