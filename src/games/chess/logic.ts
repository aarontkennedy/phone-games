// Chess, you against the computer. You swap colors each game; white moves first. Full
// rules: castling, en passant, promotion, check, checkmate and stalemate, and draws by
// threefold repetition, 50 moves each with no capture or pawn move, and too little
// material to checkmate. Our own code throughout (docs/LEGAL.md).
// Squares run 0 (a8) to 63 (h1), row by row from black's side. Pieces are letters, white
// in capitals: P N B R Q K; an empty square is ''.
// Pure functions: a move returns a new State, or null.
import { type Rng } from '../../core/random';

export type Level = 'easy' | 'strong';
export type Color = 'w' | 'b';
export type Promo = 'q' | 'r' | 'b' | 'n';
export type Result = Color | 'draw' | null;
export type Reason = 'checkmate' | 'stalemate' | 'repetition' | 'fifty' | 'material';

export interface Move {
  from: number;
  to: number;
  promo?: Promo;
}

export interface Position {
  board: string[];
  turn: Color;
  /** Castling still allowed: K and Q for white's king and queen side, k and q for black's. */
  castling: string;
  /** The square a pawn skipped with its double step, open to en passant for one move. */
  ep: number | null;
  /** Moves by either side since the last capture or pawn move. */
  halfmove: number;
}

export interface State extends Position {
  level: Level;
  you: Color;
  result: Result;
  reason: Reason | null;
  last: Move | null;
  /** The piece the last move captured, or ''. */
  taken: string;
  /** Every move of the game, to take moves back. */
  moves: Move[];
  /** Each position so far, for threefold repetition. */
  keys: string[];
  tally: { you: number; computer: number; draws: number };
}

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0';
/** 50 moves each. */
export const DRAW_AFTER = 100;

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorOf = (p: string): Color | null => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
const typeOf = (p: string) => p.toLowerCase();
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const squareName = (sq: number): string => `${'abcdefgh'[sq & 7]}${8 - (sq >> 3)}`;
const parseSquare = (name: string) => 'abcdefgh'.indexOf(name[0]) + (8 - Number(name[1])) * 8;

/** Reads a position in the usual text form (FEN), e.g. START. */
export function fromFen(fen: string): Position {
  const [rows, turn, castling, ep, halfmove = '0'] = fen.split(' ');
  const board = rows.split('/').flatMap((row) => [...row].flatMap((ch) => (/\d/.test(ch) ? Array(Number(ch)).fill('') : [ch])));
  return { board, turn: turn as Color, castling: castling === '-' ? '' : castling, ep: ep === '-' ? null : parseSquare(ep), halfmove: Number(halfmove) };
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Whether `by` attacks square `sq`. */
export function attacked(board: string[], sq: number, by: Color): boolean {
  const r = sq >> 3;
  const c = sq & 7;
  const mine = (p: string, t: string) => p !== '' && colorOf(p) === by && typeOf(p) === t;
  const pr = by === 'w' ? r + 1 : r - 1; // white pawns attack upwards
  for (const dc of [-1, 1]) if (inside(pr, c + dc) && mine(board[pr * 8 + c + dc], 'p')) return true;
  for (const [dr, dc] of KNIGHT) if (inside(r + dr, c + dc) && mine(board[(r + dr) * 8 + c + dc], 'n')) return true;
  for (const [dr, dc] of KING) if (inside(r + dr, c + dc) && mine(board[(r + dr) * 8 + c + dc], 'k')) return true;
  const ray = (dirs: number[][], types: string) =>
    dirs.some(([dr, dc]) => {
      for (let rr = r + dr, cc = c + dc; inside(rr, cc); rr += dr, cc += dc) {
        const p = board[rr * 8 + cc];
        if (p) return colorOf(p) === by && types.includes(typeOf(p));
      }
      return false;
    });
  return ray(ROOK, 'rq') || ray(BISHOP, 'bq');
}

const kingSquare = (board: string[], color: Color) => board.indexOf(color === 'w' ? 'K' : 'k');
export const inCheck = (pos: Position, color: Color = pos.turn): boolean => attacked(pos.board, kingSquare(pos.board, color), other(color));

/** Moves that follow the pieces' rules, before checking whether they leave the king in check. */
function pseudoMoves(pos: Position, capturesOnly = false): Move[] {
  const { board, turn } = pos;
  const moves: Move[] = [];
  const enemy = other(turn);
  const add = (from: number, to: number, promote: boolean) => {
    if (promote) for (const promo of ['q', 'r', 'b', 'n'] as Promo[]) moves.push({ from, to, promo });
    else moves.push({ from, to });
  };
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p || colorOf(p) !== turn) continue;
    const r = sq >> 3;
    const c = sq & 7;
    const t = typeOf(p);
    if (t === 'p') {
      const dir = turn === 'w' ? -1 : 1;
      const last = turn === 'w' ? 0 : 7;
      const one = (r + dir) * 8 + c;
      if (!capturesOnly && !board[one]) {
        add(sq, one, r + dir === last);
        const two = (r + 2 * dir) * 8 + c;
        if (r === (turn === 'w' ? 6 : 1) && !board[two]) add(sq, two, false);
      }
      for (const dc of [-1, 1]) {
        if (!inside(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if ((board[to] && colorOf(board[to]) === enemy) || to === pos.ep) add(sq, to, r + dir === last);
      }
      continue;
    }
    const step = (dirs: number[][], slide: boolean) => {
      for (const [dr, dc] of dirs) {
        for (let rr = r + dr, cc = c + dc; inside(rr, cc); rr += dr, cc += dc) {
          const to = rr * 8 + cc;
          if (board[to]) {
            if (colorOf(board[to]) === enemy) moves.push({ from: sq, to });
            break;
          }
          if (!capturesOnly) moves.push({ from: sq, to });
          if (!slide) break;
        }
      }
    };
    if (t === 'n') step(KNIGHT, false);
    else if (t === 'b') step(BISHOP, true);
    else if (t === 'r') step(ROOK, true);
    else if (t === 'q') step([...ROOK, ...BISHOP], true);
    else {
      step(KING, false);
      if (!capturesOnly) castles(pos, sq, moves);
    }
  }
  return moves;
}

/** Castling: rights kept, squares between empty, and the king not in, through or into check. */
function castles(pos: Position, sq: number, moves: Move[]) {
  const { board, turn, castling } = pos;
  const home = turn === 'w' ? 60 : 4;
  if (sq !== home) return;
  const enemy = other(turn);
  const rook = turn === 'w' ? 'R' : 'r';
  const safe = (...sqs: number[]) => sqs.every((s) => !attacked(board, s, enemy));
  if (castling.includes(turn === 'w' ? 'K' : 'k') && !board[home + 1] && !board[home + 2] && board[home + 3] === rook && safe(home, home + 1, home + 2)) {
    moves.push({ from: home, to: home + 2 });
  }
  if (castling.includes(turn === 'w' ? 'Q' : 'q') && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === rook && safe(home, home - 1, home - 2)) {
    moves.push({ from: home, to: home - 2 });
  }
}

/** The position after a move (assumed to follow the pieces' rules). */
export function makeMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const p = board[m.from];
  const t = typeOf(p);
  let captured = board[m.to];
  board[m.to] = p;
  board[m.from] = '';
  if (t === 'p' && m.to === pos.ep) {
    board[(m.from >> 3) * 8 + (m.to & 7)] = '';
    captured = 'p';
  }
  if (t === 'p' && (m.to >> 3 === 0 || m.to >> 3 === 7)) board[m.to] = pos.turn === 'w' ? (m.promo ?? 'q').toUpperCase() : (m.promo ?? 'q');
  if (t === 'k' && Math.abs(m.to - m.from) === 2) {
    const [from, to] = m.to > m.from ? [m.from + 3, m.from + 1] : [m.from - 4, m.from - 1];
    board[to] = board[from];
    board[from] = '';
  }
  let castling = pos.castling;
  if (p === 'K') castling = castling.replace(/[KQ]/g, '');
  if (p === 'k') castling = castling.replace(/[kq]/g, '');
  for (const [corner, right] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']] as const) {
    if (m.from === corner || m.to === corner) castling = castling.replace(right, '');
  }
  return {
    board,
    turn: other(pos.turn),
    castling,
    ep: t === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null,
    halfmove: t === 'p' || captured ? 0 : pos.halfmove + 1,
  };
}

/** Every legal move for the side to play. */
export function legalMoves(pos: Position, capturesOnly = false): Move[] {
  return pseudoMoves(pos, capturesOnly).filter((m) => !inCheck(makeMove(pos, m), pos.turn));
}

/** Identifies a position for repetition: pieces, turn, castling and a usable en passant. */
export function positionKey(pos: Position): string {
  const ep = pos.ep !== null && pseudoMoves(pos, true).some((m) => m.to === pos.ep && typeOf(pos.board[m.from]) === 'p') ? pos.ep : '-';
  return `${pos.board.map((p) => p || '.').join('')} ${pos.turn} ${pos.castling} ${ep}`;
}

/** Neither side has enough to checkmate: kings alone, or with one bishop or knight, or bishops all on one color. */
export function insufficient(board: string[]): boolean {
  const pieces = board.flatMap((p, sq) => (p && typeOf(p) !== 'k' ? [{ t: typeOf(p), sq }] : []));
  if (pieces.some((x) => 'pqr'.includes(x.t))) return false;
  if (pieces.length <= 1) return true;
  const shade = (sq: number) => ((sq >> 3) + (sq & 7)) % 2;
  return pieces.every((x) => x.t === 'b') && new Set(pieces.map((x) => shade(x.sq))).size === 1;
}

// --- The game ---

function startPosition(): Position {
  return fromFen(START);
}

export function newGame(level: Level = 'strong', you: Color = 'w'): State {
  const pos = startPosition();
  return { ...pos, level, you, result: null, reason: null, last: null, taken: '', moves: [], keys: [positionKey(pos)], tally: { you: 0, computer: 0, draws: 0 } };
}

/** The next game: colors swap and the tally carries over. */
export function newRound(s: State): State {
  return { ...newGame(s.level, other(s.you)), tally: { ...s.tally } };
}

const sameMove = (a: Move, b: Move) => a.from === b.from && a.to === b.to && (a.promo ?? null) === (b.promo ?? null);

/** Whether a move from `from` to `to` is a pawn reaching the far row, which needs a piece chosen. */
export const needsPromo = (s: State, from: number, to: number): boolean =>
  typeOf(s.board[from] ?? '') === 'p' && (to >> 3 === 0 || to >> 3 === 7);

/** Plays a legal move and works out whether the game is over. */
export function play(s: State, m: Move): State | null {
  if (s.result !== null || !legalMoves(s).some((x) => sameMove(x, m))) return null;
  return advance(s, m);
}

function advance(s: State, m: Move): State {
  const pos = makeMove(s, m);
  const key = positionKey(pos);
  const passant = typeOf(s.board[m.from]) === 'p' && m.to === s.ep;
  const taken = passant ? (s.turn === 'w' ? 'p' : 'P') : s.board[m.to];
  const n: State = { ...s, ...pos, last: m, taken, moves: [...s.moves, m], keys: [...s.keys, key] };
  const end = ending(n, key);
  if (!end) return n;
  const [result, reason] = end;
  return {
    ...n,
    result,
    reason,
    tally: {
      you: s.tally.you + (result === s.you ? 1 : 0),
      computer: s.tally.computer + (result === other(s.you) ? 1 : 0),
      draws: s.tally.draws + (result === 'draw' ? 1 : 0),
    },
  };
}

function ending(n: State, key: string): [Result, Reason] | null {
  if (!legalMoves(n).length) return inCheck(n) ? [other(n.turn), 'checkmate'] : ['draw', 'stalemate'];
  if (n.keys.filter((k) => k === key).length >= 3) return ['draw', 'repetition'];
  if (n.halfmove >= DRAW_AFTER) return ['draw', 'fifty'];
  if (insufficient(n.board)) return ['draw', 'material'];
  return null;
}

/** Whether you can take back your last move (and the computer's reply). */
export const canUndo = (s: State): boolean => s.turn === s.you && s.moves.length >= (s.you === 'w' ? 2 : 3);

/** Takes back your last move and the computer's reply, undoing any result. */
export function undo(s: State): State | null {
  if (!canUndo(s)) return null;
  let n: State = { ...newGame(s.level, s.you), tally: { ...s.tally } };
  if (s.result === s.you) n.tally.you--;
  else if (s.result === 'draw') n.tally.draws--;
  else if (s.result) n.tally.computer--;
  for (const m of s.moves.slice(0, -2)) n = { ...advance(n, m), tally: n.tally };
  return n;
}

// --- Computer player ---

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100_000;

/** How far a square is from the middle of the board: 0 (centre) to 3. */
const off = (sq: number) => Math.max(Math.abs(3.5 - (sq >> 3)), Math.abs(3.5 - (sq & 7))) - 0.5;

/** A piece's worth on its square, for white or black. Our own simple weights. */
function worth(p: string, sq: number, endgame: boolean): number {
  const t = typeOf(p);
  const ahead = colorOf(p) === 'w' ? 6 - (sq >> 3) : (sq >> 3) - 1; // pawn steps from home
  let v = VALUE[t];
  if (t === 'p') v += ahead * (endgame ? 12 : 6) + ((sq & 7) === 3 || (sq & 7) === 4 ? 8 : 0);
  else if (t === 'n') v -= off(sq) * 10;
  else if (t === 'b') v -= off(sq) * 5;
  else if (t === 'q') v -= off(sq) * 3;
  else if (t === 'r') v += ahead === 5 ? 15 : 0; // on the seventh rank
  else if (t === 'k') v += endgame ? -off(sq) * 10 : (sq >> 3 === 0 || sq >> 3 === 7 ? 15 : -20) + off(sq) * 5;
  return v;
}

/** The position from the side to play's view, in hundredths of a pawn. */
export function evaluate(pos: Position): number {
  const endgame = !pos.board.some((p) => typeOf(p) === 'q') || pos.board.filter((p) => p && 'nbrq'.includes(typeOf(p))).length <= 4;
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p) score += (colorOf(p) === 'w' ? 1 : -1) * worth(p, sq, endgame);
  }
  return pos.turn === 'w' ? score : -score;
}

/** Captures first, biggest victim by smallest attacker; then promotions. */
function ordered(pos: Position, moves: Move[]): Move[] {
  const gain = (m: Move) => (pos.board[m.to] ? VALUE[typeOf(pos.board[m.to])] * 10 - VALUE[typeOf(pos.board[m.from])] : 0) + (m.promo === 'q' ? 8000 : 0);
  return moves.map((m) => [m, gain(m)] as const).sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/** A search's work so far, to stop before it takes too long on a phone. */
interface Budget {
  nodes: number;
  limit: number;
}

class OutOfTime extends Error {}

/** Each legal move with the position after it, checking legality only as needed. */
function* children(pos: Position, capturesOnly: boolean): Generator<[Move, Position]> {
  for (const m of ordered(pos, pseudoMoves(pos, capturesOnly))) {
    const next = makeMove(pos, m);
    if (!inCheck(next, pos.turn)) yield [m, next];
  }
}

/** Follows captures until the position is quiet, so a search doesn't stop mid-exchange. */
function quiesce(pos: Position, alpha: number, beta: number, depth: number, b: Budget): number {
  if (++b.nodes > b.limit) throw new OutOfTime();
  const stand = evaluate(pos);
  if (stand >= beta || depth === 0) return stand;
  if (stand > alpha) alpha = stand;
  for (const [, next] of children(pos, true)) {
    const v = -quiesce(next, -beta, -alpha, depth - 1, b);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function search(pos: Position, depth: number, alpha: number, beta: number, ply: number, b: Budget): number {
  if (depth === 0) return quiesce(pos, alpha, beta, 4, b);
  if (++b.nodes > b.limit) throw new OutOfTime();
  let best = -Infinity;
  for (const [, next] of children(pos, false)) {
    const v = -search(next, depth - 1, -beta, -alpha, ply + 1, b);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (best === -Infinity) return inCheck(pos) ? -MATE + ply : 0; // no legal moves
  return best;
}

export const DEPTH = 3;
/** Positions Strong may look at for one move: keeps it to about a second on a phone. */
export const NODE_LIMIT = 40_000;

/** The best move at one depth, or null if the budget ran out. */
function bestAt(s: State, moves: Move[], depth: number, noise: number, rng: Rng, b: Budget): Move | null {
  let best = moves[0];
  let bestScore = -Infinity;
  try {
    for (const m of moves) {
      const next = makeMove(s, m);
      let v = -search(next, depth, -Infinity, Infinity, 1, b);
      if (v > 0 && s.keys.includes(positionKey(next))) v -= 50; // don't drift into a repetition draw
      v += rng() * noise;
      if (v > bestScore) [best, bestScore] = [m, v];
    }
  } catch (e) {
    if (e instanceof OutOfTime) return null;
    throw e;
  }
  return best;
}

/**
 * Easy looks one move ahead, follows captures, and adds a lot of chance, so it blunders.
 * Strong looks two moves ahead, then three if there's time, following captures to the end,
 * with a pinch of chance so games differ. Neither drifts into a repetition when ahead.
 */
export function chooseMove(s: State, rng: Rng = Math.random, limit = NODE_LIMIT): Move {
  const moves = ordered(s, legalMoves(s));
  if (s.level === 'easy') return bestAt(s, moves, 0, 250, rng, { nodes: 0, limit: Infinity })!;
  let best = bestAt(s, moves, DEPTH - 2, 8, rng, { nodes: 0, limit: Infinity })!;
  const deeper = bestAt(s, moves, DEPTH - 1, 8, rng, { nodes: 0, limit });
  if (deeper) best = deeper;
  return best;
}

export function isValidState(s: unknown): s is State {
  const st = s as State | null;
  const color = (c: unknown) => c === 'w' || c === 'b';
  const square = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 64;
  const isMove = (m: Move | null) => !!m && square(m.from) && square(m.to) && (m.promo === undefined || 'qrbn'.includes(m.promo));
  if (!st || (st.level !== 'easy' && st.level !== 'strong') || !color(st.turn) || !color(st.you)) return false;
  if (!Array.isArray(st.board) || st.board.length !== 64 || !st.board.every((p) => p === '' || (typeof p === 'string' && /^[pnbrqkPNBRQK]$/.test(p)))) return false;
  if (st.board.filter((p) => p === 'K').length !== 1 || st.board.filter((p) => p === 'k').length !== 1) return false;
  if (typeof st.castling !== 'string' || !/^K?Q?k?q?$/.test(st.castling) || !(st.ep === null || square(st.ep)) || !Number.isInteger(st.halfmove)) return false;
  if (!(st.result === null || st.result === 'draw' || color(st.result)) || !Array.isArray(st.moves) || !st.moves.every(isMove)) return false;
  if (typeof st.taken !== 'string' || !(st.last === null || isMove(st.last)) || !Array.isArray(st.keys) || !st.keys.every((k) => typeof k === 'string')) return false;
  return !!st.tally && [st.tally.you, st.tally.computer, st.tally.draws].every(Number.isInteger);
}
