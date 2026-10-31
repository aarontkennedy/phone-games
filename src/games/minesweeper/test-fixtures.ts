import { newState, type State } from './logic';

/**
 * Easy board (6x6) with the 5 mines across the top row:
 *   * * * * * .
 *   . . . . . .   <- numbers
 *   . . . . . .   <- all zeros below
 * Cell 5 (top-right) is the only safe cell not reached by flood fill from the bottom.
 */
export function fixture(): State {
  const s = newState('easy');
  s.mines = s.revealed.map((_, i) => i < 5);
  s.status = 'playing';
  return s;
}
