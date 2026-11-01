// Dominoes, the draw game, for you against the computer with a double-six set. Each player
// takes 7 tiles. Play a tile that matches an open end of the line; if you can't, draw from
// the boneyard until you can, and pass only when it's empty. The first to play their last
// tile scores the pips left in the other hand. If both players are stuck, the lower pip
// total wins and scores the other hand. First to 100. Whoever won the last round leads.
// Pure functions: every action returns a new State, or null if it isn't allowed.
import { randomInt, shuffle, type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Phase = 'playing' | 'roundOver' | 'gameOver';
export type Player = 0 | 1;
export type Tile = [number, number];
export type End = 'left' | 'right';

export const GAME_POINTS = 100;
export const HAND = 7;

export interface Move {
  tile: Tile;
  end: End;
}

export interface State {
  level: Level;
  phase: Phase;
  hands: Tile[][];
  boneyard: Tile[];
  /** The line of play, left to right, each tile turned so neighbors match. */
  line: Tile[];
  turn: Player;
  /** Passes in a row; two means nobody can play. */
  passes: number;
  /** Numbers each player has been seen unable to play on. */
  missing: number[][];
  scores: [number, number];
  last: { winner: Player | null; points: number; blocked: boolean } | null;
}

const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const pips = (tiles: Tile[]): number => tiles.reduce((t, [a, b]) => t + a + b, 0);
const same = (x: Tile, y: Tile) => (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0]);

export function fullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  return tiles;
}

export function newGame(level: Level = 'strong', rng: Rng = Math.random): State {
  return deal({ level, turn: 0, scores: [0, 0], last: null }, rng);
}

function deal(base: Pick<State, 'level' | 'turn' | 'scores' | 'last'>, rng: Rng): State {
  const tiles = shuffle(fullSet(), rng);
  return { ...base, phase: 'playing', hands: [tiles.slice(0, HAND), tiles.slice(HAND, 2 * HAND)], boneyard: tiles.slice(2 * HAND), line: [], passes: 0, missing: [[], []] };
}

/** The numbers at the two open ends, or null before the first tile. */
export const ends = (s: State): [number, number] | null => (s.line.length ? [s.line[0][0], s.line.at(-1)![1]] : null);

export function legalMoves(s: State, p: Player): Move[] {
  if (s.phase !== 'playing' || s.turn !== p) return [];
  const e = ends(s);
  if (!e) return s.hands[p].map((tile) => ({ tile, end: 'right' as End }));
  return s.hands[p].flatMap((tile) => [
    ...(tile.includes(e[0]) ? [{ tile, end: 'left' as End }] : []),
    ...(tile.includes(e[1]) ? [{ tile, end: 'right' as End }] : []),
  ]);
}

export function play(s: State, p: Player, m: Move): State | null {
  if (!legalMoves(s, p).some((x) => same(x.tile, m.tile) && x.end === m.end)) return null;
  const n = clone(s);
  n.hands[p] = n.hands[p].filter((t) => !same(t, m.tile));
  const e = ends(n);
  const [a, b] = m.tile;
  if (!e) n.line.push([a, b]);
  else if (m.end === 'left') n.line.unshift(b === e[0] ? [a, b] : [b, a]);
  else n.line.push(a === e[1] ? [a, b] : [b, a]);
  n.passes = 0;
  if (!n.hands[p].length) return endRound(n, p, false);
  n.turn = p === 0 ? 1 : 0;
  return n;
}

/** Draws a tile from the boneyard, only when you can't play. */
export function draw(s: State, p: Player): State | null {
  if (s.phase !== 'playing' || s.turn !== p || legalMoves(s, p).length || !s.boneyard.length) return null;
  const n = clone(s);
  n.hands[p].push(n.boneyard.pop()!);
  for (const v of ends(n)!) if (!n.missing[p].includes(v)) n.missing[p].push(v);
  return n;
}

/** Passes, only when you can't play and the boneyard is empty. Two passes in a row ends the round. */
export function pass(s: State, p: Player): State | null {
  if (s.phase !== 'playing' || s.turn !== p || legalMoves(s, p).length || s.boneyard.length) return null;
  const n = clone(s);
  n.passes++;
  if (n.passes >= 2) {
    const [mine, theirs] = [pips(n.hands[0]), pips(n.hands[1])];
    return endRound(n, mine === theirs ? null : mine < theirs ? 0 : 1, true);
  }
  n.turn = p === 0 ? 1 : 0;
  return n;
}

function endRound(n: State, winner: Player | null, blocked: boolean): State {
  const points = winner === null ? 0 : pips(n.hands[winner === 0 ? 1 : 0]);
  if (winner !== null) n.scores[winner] += points;
  n.last = { winner, points, blocked };
  n.phase = winner !== null && n.scores[winner] >= GAME_POINTS ? 'gameOver' : 'roundOver';
  return n;
}

export function nextRound(s: State, rng: Rng = Math.random): State | null {
  if (s.phase !== 'roundOver') return null;
  const turn = s.last!.winner ?? s.turn;
  return deal({ level: s.level, turn, scores: s.scores, last: s.last }, rng);
}

export const winner = (s: State): Player | null => (s.phase === 'gameOver' ? s.last!.winner : null);

// --- Computer player ---

export type Turn = { action: 'play'; move: Move } | { action: 'draw' } | { action: 'pass' };

/**
 * Easy plays any tile that fits. Strong plays heavy tiles and doubles first, and leaves
 * ends on numbers the other player has been seen not to have.
 */
export function chooseTurn(s: State, p: Player, rng: Rng = Math.random): Turn {
  const moves = legalMoves(s, p);
  if (!moves.length) return s.boneyard.length ? { action: 'draw' } : { action: 'pass' };
  if (s.level === 'easy') return { action: 'play', move: moves[randomInt(moves.length, rng)] };
  const other = s.missing[p === 0 ? 1 : 0];
  const rate = ({ tile, end }: Move) => {
    const after = play(s, p, { tile, end })!;
    const open = ends(after);
    const blocks = open ? open.filter((v) => other.includes(v)).length * 6 : 0;
    return tile[0] + tile[1] + (tile[0] === tile[1] ? 4 : 0) + blocks;
  };
  return { action: 'play', move: moves.reduce((a, b) => (rate(b) > rate(a) ? b : a)) };
}

export function applyTurn(s: State, p: Player, t: Turn): State | null {
  if (t.action === 'play') return play(s, p, t.move);
  return t.action === 'draw' ? draw(s, p) : pass(s, p);
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const tile = (t: unknown) => Array.isArray(t) && t.length === 2 && t.every((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  const tiles = (a: unknown) => Array.isArray(a) && a.every(tile);
  if (
    !st ||
    !(st.level === 'easy' || st.level === 'strong') ||
    !['playing', 'roundOver', 'gameOver'].includes(st.phase) ||
    !(st.turn === 0 || st.turn === 1) ||
    !Array.isArray(st.hands) ||
    st.hands.length !== 2 ||
    !st.hands.every(tiles) ||
    !tiles(st.boneyard) ||
    !tiles(st.line) ||
    !Array.isArray(st.missing) ||
    !Array.isArray(st.scores) ||
    st.scores.length !== 2
  ) {
    return false;
  }
  const all = [...st.hands.flat(), ...st.boneyard, ...st.line];
  return all.length === 28 && fullSet().every((t) => all.some((x) => same(x, t)));
}
