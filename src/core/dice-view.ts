// Flat die faces (solid pips on a square), shared by the dice games. Color comes from the
// surrounding CSS: the pips are filled with currentColor unless a game sets `fill`.

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};

/** The pips of a die showing `n` (1 to 6), as an SVG for a game to frame. */
export const dieFace = (n: number): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3"/>`).join('')}</svg>`;
