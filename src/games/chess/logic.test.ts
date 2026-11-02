import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import {
  canUndo,
  chooseMove,
  evaluate,
  fromFen,
  inCheck,
  insufficient,
  isValidState,
  legalMoves,
  makeMove,
  needsPromo,
  newGame,
  newRound,
  play,
  positionKey,
  squareName,
  undo,
  type Move,
  type State,
} from './logic';

const sq = (name: string) => 'abcdefgh'.indexOf(name[0]) + (8 - Number(name[1])) * 8;
const mv = (text: string): Move => ({ from: sq(text.slice(0, 2)), to: sq(text.slice(2, 4)), ...(text[4] ? { promo: text[4] as Move['promo'] } : {}) });
/** A game from a position in FEN, you to move. */
const game = (fen: string, o: Partial<State> = {}): State => {
  const pos = fromFen(fen);
  return { ...newGame('strong', pos.turn), ...pos, keys: [positionKey(pos)], ...o };
};
const playAll = (s: State, moves: string) => moves.split(' ').reduce<State>((st, m) => play(st, mv(m))!, s);

describe('chess rules', () => {
  it('starts with white to move and names squares', () => {
    const s = newGame();
    expect(legalMoves(s)).toHaveLength(20);
    expect([sq('a8'), sq('h1')]).toEqual([0, 63]);
    expect(squareName(sq('e4'))).toBe('e4');
    expect(isValidState(s)).toBe(true);
  });

  it('rejects illegal moves', () => {
    const s = newGame();
    expect(play(s, mv('e2e5'))).toBeNull();
    expect(play(s, mv('e7e5'))).toBeNull(); // not black's turn
    expect(play({ ...s, result: 'draw' }, mv('e2e4'))).toBeNull();
  });

  it('remembers the last move and what it took, including en passant', () => {
    const s = playAll(newGame(), 'e2e4 d7d5 e4d5');
    expect(s.taken).toBe('p');
    expect(s.last).toEqual(mv('e4d5'));
    const ep = playAll(newGame(), 'e2e4 a7a6 e4e5 d7d5');
    expect(ep.ep).toBe(sq('d6'));
    const took = play(ep, mv('e5d6'))!;
    expect(took.board[sq('d5')]).toBe('');
    expect(took.taken).toBe('p');
    // Black takes en passant too.
    const black = playAll(newGame(), 'a2a3 e7e5 a3a4 e5e4 d2d4 e4d3');
    expect(black.taken).toBe('P');
  });

  it('castles both ways, and loses the right when the king or rook moves', () => {
    const s = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0');
    const kingSide = play(s, mv('e1g1'))!;
    expect(kingSide.board[sq('f1')]).toBe('R');
    expect(kingSide.castling).toBe('kq');
    const queenSide = play(kingSide, mv('e8c8'))!;
    expect(queenSide.board[sq('d8')]).toBe('r');
    expect(queenSide.castling).toBe('');
    expect(play(s, mv('h1h2'))!.castling).toBe('Qkq');
    // Not through check.
    expect(legalMoves(game('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0')).some((m) => m.from === sq('e1') && m.to === sq('g1'))).toBe(false);
    // Taking a rook on its corner removes that right.
    expect(makeMove(game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0'), mv('a1a8')).castling).toBe('Kk');
  });

  it('promotes to the piece you choose', () => {
    const s = game('8/P6k/8/8/8/8/8/K7 w - - 0');
    expect(needsPromo(s, sq('a7'), sq('a8'))).toBe(true);
    expect(needsPromo(s, sq('a1'), sq('a2'))).toBe(false);
    expect(play(s, mv('a7a8'))).toBeNull(); // a piece must be chosen
    expect(play(s, mv('a7a8n'))!.board[sq('a8')]).toBe('N');
    expect(makeMove(s, mv('a7a8')).board[sq('a8')]).toBe('Q');
  });

  it('ends in checkmate and counts the win', () => {
    const mated = playAll(newGame('strong', 'b'), 'f2f3 e7e5 g2g4 d8h4');
    expect(mated.result).toBe('b');
    expect(mated.reason).toBe('checkmate');
    expect(inCheck(mated)).toBe(true);
    expect(mated.tally).toEqual({ you: 1, computer: 0, draws: 0 });
    const lost = playAll(newGame('strong', 'w'), 'f2f3 e7e5 g2g4 d8h4');
    expect(lost.tally).toEqual({ you: 0, computer: 1, draws: 0 });
  });

  it('draws by stalemate, repetition, 50 moves, and too little material', () => {
    const stale = play(game('7k/8/6Q1/8/8/8/8/K7 w - - 0'), mv('g6f7'))!;
    expect([stale.result, stale.reason]).toEqual(['draw', 'stalemate']);
    expect(stale.tally.draws).toBe(1);

    const rep = playAll(newGame(), 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
    expect([rep.result, rep.reason]).toEqual(['draw', 'repetition']);

    const fifty = play(game('7k/8/8/8/8/8/R7/K7 w - - 99'), mv('a2b2'))!;
    expect([fifty.result, fifty.reason]).toEqual(['draw', 'fifty']);

    const bare = play(game('7k/8/8/8/8/8/1r6/K7 w - - 0'), mv('a1b2'))!;
    expect([bare.result, bare.reason]).toEqual(['draw', 'material']);
    expect(insufficient(fromFen('7k/8/8/8/8/8/8/KN6 w - - 0').board)).toBe(true);
    expect(insufficient(fromFen('7k/8/8/3b4/8/8/8/KB6 w - - 0').board)).toBe(true); // bishops on one colour
    expect(insufficient(fromFen('7k/8/8/4b3/8/8/8/KB6 w - - 0').board)).toBe(false);
    expect(insufficient(fromFen('7k/8/8/8/8/8/8/KNN5 w - - 0').board)).toBe(false);
    expect(insufficient(fromFen('7k/8/8/8/8/8/P7/K7 w - - 0').board)).toBe(false);
  });

  it('counts en passant in repetition only when it can be taken', () => {
    const pos = fromFen('4k3/8/8/8/4P3/8/8/4K3 b - e3 0');
    expect(positionKey(pos).endsWith(' -')).toBe(true);
    const open = fromFen('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0');
    expect(positionKey(open).endsWith(` ${sq('e3')}`)).toBe(true);
  });

  it('takes back your move and the reply, undoing a result', () => {
    const s = playAll(newGame(), 'e2e4 e7e5');
    expect(canUndo(s)).toBe(true);
    const back = undo(s)!;
    expect(back.moves).toEqual([]);
    expect(back.board).toEqual(newGame().board);
    expect(undo(back)).toBeNull();
    expect(canUndo(play(s, mv('g1f3'))!)).toBe(false); // the computer's turn
    expect(canUndo(playAll(newGame('strong', 'b'), 'e2e4'))).toBe(false); // you haven't moved
    const lost = playAll(newGame('strong', 'w'), 'f2f3 e7e5 g2g4 d8h4');
    const retry = undo(lost)!;
    expect(retry.result).toBeNull();
    expect(retry.tally.computer).toBe(0);
    expect(retry.moves).toHaveLength(2);
    expect(undo({ ...lost, result: 'w', tally: { you: 1, computer: 0, draws: 0 } })!.tally.you).toBe(0);
    expect(undo({ ...lost, result: 'draw', tally: { you: 0, computer: 0, draws: 1 } })!.tally.draws).toBe(0);
  });

  it('swaps colours each game and keeps the tally', () => {
    const next = newRound({ ...newGame('easy'), tally: { you: 2, computer: 1, draws: 0 } });
    expect(next.you).toBe('b');
    expect(next.level).toBe('easy');
    expect(next.tally).toEqual({ you: 2, computer: 1, draws: 0 });
  });
});

describe('chess computer', () => {
  it('scores material and position from the side to move', () => {
    expect(evaluate(newGame())).toBe(0);
    expect(evaluate(fromFen('4k3/8/8/8/8/8/8/Q3K3 w - - 0'))).toBeGreaterThan(800);
    expect(evaluate(fromFen('4k3/8/8/8/8/8/8/Q3K3 b - - 0'))).toBeLessThan(-800);
  });

  it('Strong finds mate in one and takes a free queen', () => {
    const mate = game('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0');
    expect(chooseMove(mate, seededRng(1))).toEqual(mv('a1a8'));
    const queen = game('4k3/8/8/3q4/8/8/8/3RK3 w - - 0');
    expect(chooseMove(queen, seededRng(1))).toEqual(mv('d1d5'));
    // With almost no time, it still answers with its quick look.
    expect(chooseMove(queen, seededRng(1), 10)).toEqual(mv('d1d5'));
  });

  it('Easy plays legal moves, mostly sensible ones', () => {
    const s = { ...newGame('easy') };
    for (let seed = 1; seed < 6; seed++) expect(play(s, chooseMove(s, seededRng(seed)))).not.toBeNull();
  });

  it('rejects broken saves', () => {
    const good = newGame();
    const bad: unknown[] = [
      null,
      { ...good, level: 'hard' },
      { ...good, turn: 'x' },
      { ...good, board: good.board.slice(1) },
      { ...good, board: good.board.map((p) => (p === 'K' ? '' : p)) },
      { ...good, board: good.board.map((p) => (p === 'P' ? 'X' : p)) },
      { ...good, castling: 'KX' },
      { ...good, ep: 64 },
      { ...good, halfmove: 1.5 },
      { ...good, result: 'x' },
      { ...good, moves: [{ from: 1, to: 99 }] },
      { ...good, last: { from: 1, to: 2, promo: 'k' } },
      { ...good, keys: [1] },
      { ...good, taken: null },
      { ...good, tally: null },
    ];
    for (const b of bad) expect(isValidState(b as State)).toBe(false);
  });
});
