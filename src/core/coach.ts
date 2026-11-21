// Coaching, for games with a best play to learn (docs/DESIGN.md, "Coaching"): a Hint
// button that shows the best play for the decision in front of you, only when you ask, and
// a "Right" score: how often your plays matched the best one. Plays you make after asking
// for a hint don't count, so the score shows what you've learned.
import { BULB_ICON } from './icons';
import { load, save } from './storage';

interface Accuracy {
  right: number;
  plays: number;
}

const isAccuracy = (a: unknown): a is Accuracy =>
  !!a && Number.isInteger((a as Accuracy).right) && Number.isInteger((a as Accuracy).plays) && (a as Accuracy).right <= (a as Accuracy).plays;

export interface Coach {
  /** Whether you asked for a hint on this decision. The screen sets it when Hint is tapped. */
  asked: boolean;
  /**
   * The row above the game's buttons: the Hint button, or once asked, the tip (HTML).
   * Empty when there's nothing to advise.
   */
  html(tip: string | null): string;
  /** Scores a decision, unless you asked for a hint first. True if it counted. */
  score(right: boolean): boolean;
  /** The Right stat: "75%", or "–" before any play counts. */
  text(): string;
}

/** Saved as `${id}:accuracy`. */
export function coach(id: string): Coach {
  const key = `${id}:accuracy`;
  const saved = load<unknown>(key, null);
  const accuracy: Accuracy = isAccuracy(saved) ? saved : { right: 0, plays: 0 };
  return {
    asked: false,
    html(tip) {
      if (tip === null) return '';
      const inner = this.asked
        ? `<p class="coach-tip" data-tip>${BULB_ICON}<span>${tip}</span></p>`
        : `<button class="btn secondary coach-hint" data-hint>${BULB_ICON}<span>Hint</span></button>`;
      return `<div class="coach">${inner}</div>`;
    },
    score(right) {
      if (this.asked) return false;
      accuracy.plays++;
      if (right) accuracy.right++;
      save(key, accuracy);
      return true;
    },
    text: () => (accuracy.plays ? `${Math.round((100 * accuracy.right) / accuracy.plays)}%` : '–'),
  };
}
