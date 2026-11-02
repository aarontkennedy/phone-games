import { beforeEach, describe, expect, it, vi } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { contrast, readVars } from '../../test/contrast';
import { answerNewGame, makeContainer, track } from '../../test/helpers';
import { AI_DELAY, mount } from './index';
import { fromFen, newGame, play, positionKey, type Move, type State } from './logic';
import { pieceSvg } from './pieces';

const sq = (name: string) => 'abcdefgh'.indexOf(name[0]) + (8 - Number(name[1])) * 8;
const mv = (text: string): Move => ({ from: sq(text.slice(0, 2)), to: sq(text.slice(2, 4)), ...(text[4] ? { promo: text[4] as Move['promo'] } : {}) });
const game = (fen: string, o: Partial<State> = {}): State => {
  const pos = fromFen(fen);
  return { ...newGame('strong', pos.turn), ...pos, keys: [positionKey(pos)], ...o };
};

function setup(saved: unknown = null) {
  if (saved) save('chess:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...container.querySelectorAll<T>(sel)];
  const stored = () => load<State>('chess:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  const tap = (name: string) => $(`[data-sq="${sq(name)}"]`).click();
  return { container, unmount, $, $$, stored, status, tap };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('Chess screen', () => {
  it('shows the board with your pieces at the bottom', () => {
    const { $, $$, status } = setup();
    const squares = $$('[data-sq]');
    expect(squares).toHaveLength(64);
    expect(squares[0].getAttribute('aria-label')).toBe('Black rook, a8');
    expect(squares[63].getAttribute('aria-label')).toBe('White rook, h1');
    expect($$('[data-sq]:not([disabled])')).toHaveLength(10); // 8 pawns and 2 knights can move
    expect(status()).toBe('Your move: tap one of your white pieces.');
    expect($('[data-you]').textContent).toBe('0');
    document.body.replaceChildren();
    // Playing black, the board turns round (and the computer moves first).
    const black = setup(newGame('strong', 'b'));
    expect(black.$$('[data-sq]')[0].getAttribute('aria-label')).toBe('White rook, h1');
    expect(black.status()).toBe('The computer is thinking…');
  });

  it('moves a piece, then the computer replies', () => {
    const { $, $$, stored, status, tap } = setup();
    tap('e2');
    expect($(`[data-sq="${sq('e2')}"]`).classList.contains('selected')).toBe(true);
    expect($$('.target').map((b) => b.getAttribute('aria-label'))).toEqual(['Empty, e4, move here', 'Empty, e3, move here']);
    expect(status()).toBe('Tap a marked square to move there, or tap another piece.');
    tap('e2'); // tap again to let go
    expect($('.selected')).toBeNull();
    tap('g1');
    tap('f3');
    expect(stored().turn).toBe('b');
    expect(status()).toBe('The computer is thinking…');
    vi.advanceTimersByTime(AI_DELAY);
    expect(stored().turn).toBe('w');
    expect($$('.last')).toHaveLength(2);
    expect(status()).toMatch(/^The computer moved its \w+ from \w\d to \w\d\. Your move/);
  });

  it('describes captures, castling and promotion by the computer', () => {
    const after = (fen: string, move: string) => {
      const s = play(game(fen, { you: fen.includes(' b ') ? 'w' : 'b' }), mv(move))!;
      const t = setup(s).status();
      document.body.replaceChildren();
      return t;
    };
    expect(after('4k3/8/8/8/8/8/3q4/3QK3 b - - 0', 'd2d1')).toBe('The computer moved its queen from d2 to d1 and took your queen. Check! Your move: tap one of your white pieces.');
    expect(after('r3k3/8/8/8/8/8/8/4K3 b q - 0', 'e8c8')).toBe('The computer castled. Your move: tap one of your white pieces.');
    expect(after('4k3/8/8/8/8/8/p6P/4K3 b - - 0', 'a2a1n')).toBe('The computer moved a pawn to a1 and made it a knight. Your move: tap one of your white pieces.');
    expect(after('4k3/8/8/8/8/8/1p6/R3K3 b - - 0', 'b2a1q')).toContain('Check! Your move');
  });

  it('asks which piece a pawn becomes', () => {
    const { $, $$, stored, status, tap } = setup(game('7k/P7/8/8/8/8/8/K7 w - - 0'));
    tap('a7');
    tap('a8');
    expect(status()).toBe('Choose a piece for your pawn.');
    expect($$('[data-promo]').map((b) => b.getAttribute('aria-label'))).toEqual(['Queen', 'Rook', 'Bishop', 'Knight']);
    tap('a7'); // changed your mind
    expect($('[data-promo]')).toBeNull();
    tap('a7');
    tap('a8');
    $('[data-promo="r"]').click();
    expect(stored().board[sq('a8')]).toBe('R');
  });

  it('shows check, the end of the game, and the draw reasons', () => {
    const check = setup(play(game('4k3/8/8/8/8/8/8/R3K3 w - - 0', { you: 'b' }), mv('a1a8'))!);
    expect(check.$('.check').getAttribute('aria-label')).toBe('Black king, e8');
    expect(check.status()).toContain('Check! Your move: tap one of your black pieces.');
    document.body.replaceChildren();
    const ended = (o: Partial<State>) => {
      const t = setup({ ...newGame(), ...o }).status();
      document.body.replaceChildren();
      return t;
    };
    expect(ended({ result: 'w', reason: 'checkmate' })).toBe('Checkmate: you win! Tap New for another game.');
    expect(ended({ result: 'b', reason: 'checkmate' })).toBe('Checkmate: the computer wins. Tap New for another game.');
    expect(ended({ result: 'draw', reason: 'stalemate' })).toBe('Stalemate: the player to move has no legal move but isn’t in check, so it’s a draw. Tap New for another game.');
    expect(ended({ result: 'draw', reason: 'repetition' })).toMatch(/^The same position came up three times/);
    expect(ended({ result: 'draw', reason: 'fifty' })).toMatch(/^50 moves each/);
    expect(ended({ result: 'draw', reason: 'material' })).toMatch(/^Neither side/);
  });

  it('takes back a move with Undo', () => {
    const s = play(play(newGame(), mv('e2e4'))!, mv('e7e5'))!;
    const { $, stored } = setup(s);
    $('[data-undo]').click();
    expect(stored().moves).toEqual([]);
    expect($('[data-undo]')).toBeNull();
  });

  it('asks before abandoning a game, switches level, and stops when closed', () => {
    const fresh = setup();
    fresh.$('[data-new]').click(); // nothing played yet: a new game at once, colors swapped
    expect(fresh.stored().you).toBe('b');
    fresh.unmount();
    vi.advanceTimersByTime(AI_DELAY * 3);
    expect(fresh.stored().moves).toEqual([]);
    document.body.replaceChildren();

    const mid = setup(play(newGame(), mv('e2e4'))!);
    mid.$('[data-level="easy"]').click();
    expect(mid.stored().level).toBe('easy');
    vi.advanceTimersByTime(AI_DELAY);
    mid.$('[data-new]').click();
    answerNewGame();
    expect(mid.stored().moves).toEqual([]);
    mid.$('[data-board]').click();
    mid.$('[data-actions]').click();
    document.body.replaceChildren();
    expect(setup({ board: 2 }).$$('[data-sq]')).toHaveLength(64);
  });

  it('draws pieces in their own colors', () => {
    expect(pieceSvg('N')).toContain('cs-piece w');
    expect(pieceSvg('q')).toContain('cs-piece b');
  });
});

describe('Chess colors', () => {
  const c = readVars(css, /\n\.cs\s*{([^}]*)}/);
  const squares = ['cs-light', 'cs-dark', 'cs-last-light', 'cs-last-dark', 'cs-check'];
  it.each(squares)('pieces stand out on %s (3:1)', (bg) => {
    // White pieces have a dark edge; black pieces are dark with a white edge.
    expect(contrast(c['cs-edge'], c[bg])).toBeGreaterThanOrEqual(3);
  });
  it('move dots stand out on every square they can land on (3:1)', () => {
    for (const bg of ['cs-light', 'cs-last-light']) expect(contrast(c['cs-dark'], c[bg])).toBeGreaterThanOrEqual(3);
    for (const bg of ['cs-dark', 'cs-last-dark']) expect(contrast(c['cs-light'], c[bg])).toBeGreaterThanOrEqual(3);
  });
});
