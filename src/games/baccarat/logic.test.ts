import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import {
  CHIPS,
  CUT,
  DECKS,
  HOUSE_EDGE,
  START_CHIPS,
  bankerDraws,
  clear,
  deal,
  freshShoe,
  handTotal,
  isBroke,
  isValidState,
  newState,
  payout,
  place,
  playHand,
  points,
  restart,
  setChip,
  total,
  winnerOf,
  type State,
} from './logic';
import { cards, stacked } from './test-fixtures';

describe('baccarat', () => {
  it('counts cards and hands: tens and court cards are 0, and only the last digit counts', () => {
    expect(cards('AS 9H 10D KC').map(points)).toEqual([1, 9, 0, 0]);
    expect(handTotal(cards('7S 8H'))).toBe(5);
    expect(handTotal(cards('KS QH'))).toBe(0);
    expect(handTotal(cards('9S 9H 9D'))).toBe(7);
  });

  it('starts with a fresh six-deck shoe', () => {
    const s = newState(seededRng(1));
    expect(s.shoe).toHaveLength(DECKS * 52);
    expect(s.chips).toBe(START_CHIPS);
    expect(isValidState(s)).toBe(true);
    expect(freshShoe(seededRng(2))).toHaveLength(312);
  });

  it('places bets your chips cover, and clears them', () => {
    let s = place(newState(), 'banker')!;
    s = place(setChip(s, 100)!, 'banker')!;
    expect(s.bets).toEqual({ player: 0, banker: 120, tie: 0 });
    expect(total(s.bets)).toBe(120);
    expect(setChip(s, 7)).toBeNull();
    expect(place({ ...s, chips: 200 }, 'tie')).toBeNull(); // 120 + 100 is more than 200
    expect(place(s, 'nothing' as 'tie')).toBeNull();
    expect(clear(s)!.bets).toEqual({ player: 0, banker: 0, tie: 0 });
    expect(clear(newState())).toBeNull();
  });

  it('stands on a natural, and otherwise draws by the rules', () => {
    // Dealt in order: Player, Banker, Player, Banker, then any third cards.
    expect(playHand(stacked('9S 5H KD 2C 3S 4S'))).toMatchObject({ player: cards('9S KD'), banker: cards('5H 2C') }); // natural 9
    // Player 5 draws a 4; Banker 5 draws against a 4.
    expect(playHand(stacked('2S 3H 3D 2C 4S 7S'))).toMatchObject({ player: cards('2S 3D 4S'), banker: cards('3H 2C 7S') });
    // Player 5 draws a 9; Banker 6 stands against a 9.
    expect(playHand(stacked('2S 4H 3D 2C 9S 7S'))).toMatchObject({ player: cards('2S 3D 9S'), banker: cards('4H 2C') });
    // Player stands on 6 and Banker on 7.
    expect(playHand(stacked('3S 4H 3D 3C 9S'))).toMatchObject({ player: cards('3S 3D'), banker: cards('4H 3C') });
    // Player stands on 7; Banker 5 draws.
    expect(playHand(stacked('3S 4H 4D AC 9S'))).toMatchObject({ player: cards('3S 4D'), banker: cards('4H AC 9S') });
  });

  it('follows the banker’s drawing table', () => {
    const third = (p: string) => cards(p)[0];
    expect(bankerDraws(5, null)).toBe(true);
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(2, third('8S'))).toBe(true);
    expect(bankerDraws(3, third('8S'))).toBe(false);
    expect(bankerDraws(3, third('9S'))).toBe(true);
    expect(bankerDraws(4, third('AS'))).toBe(false);
    expect(bankerDraws(4, third('2S'))).toBe(true);
    expect(bankerDraws(5, third('3S'))).toBe(false);
    expect(bankerDraws(5, third('4S'))).toBe(true);
    expect(bankerDraws(6, third('5S'))).toBe(false);
    expect(bankerDraws(6, third('6S'))).toBe(true);
    expect(bankerDraws(7, third('6S'))).toBe(false);
  });

  it('pays Player 1 to 1, Banker 19 to 20, Tie 8 to 1, and returns Player and Banker bets on a tie', () => {
    const bets = { player: 20, banker: 40, tie: 20 };
    expect(payout(bets, 'player')).toBe(40);
    expect(payout(bets, 'banker')).toBe(78);
    expect(payout(bets, 'tie')).toBe(180 + 60);
    expect(winnerOf(cards('9S'), cards('8S'))).toBe('player');
    expect(winnerOf(cards('7S'), cards('8S'))).toBe('banker');
    expect(winnerOf(cards('KS'), cards('QS'))).toBe('tie');
  });

  it('deals a hand: bets come out of your chips, winners are paid, and bets stay down', () => {
    const s: State = { ...newState(), bets: { player: 0, banker: 100, tie: 0 }, shoe: [...freshShoe(seededRng(3)).slice(0, 100), ...stacked('7S 5H 2D 3C')] };
    const n = deal(s)!;
    expect(n.winner).toBe('player'); // 9 to 8
    expect(n.chips).toBe(900);
    expect(n.bets.banker).toBe(100);
    expect(n.shoe).toHaveLength(100 + 4 - 4 - 0); // no third cards
    expect(deal({ ...s, bets: { player: 0, banker: 0, tie: 0 } })).toBeNull();
    expect(deal({ ...s, chips: 50 })).toBeNull(); // bets more than your chips
    // A short shoe is shuffled afresh.
    expect(deal({ ...s, shoe: s.shoe.slice(0, CUT - 1) })!.shoe.length).toBeGreaterThan(300);
    // Bets your chips no longer cover come down.
    const lost = deal({ ...s, chips: 100 })!;
    expect(lost.chips).toBe(0);
    expect(total(lost.bets)).toBe(0);
    expect(isBroke(lost)).toBe(true);
    expect(restart(lost).chips).toBe(START_CHIPS);
  });

  it('keeps the house edges in the rules: worked out exactly from a six-deck shoe', () => {
    // Every order of the up to six cards a hand uses, by count (0 to 9), drawn without
    // replacement from six decks.
    const left = [96, 24, 24, 24, 24, 24, 24, 24, 24, 24];
    let n = 312;
    const odds = { player: 0, banker: 0, tie: 0 };
    const take = (v: number) => {
      const p = left[v] / n;
      left[v]--;
      n--;
      return p;
    };
    const put = (v: number) => {
      left[v]++;
      n++;
    };
    const each = (fn: (v: number, p: number) => void) => {
      for (let v = 0; v < 10; v++) {
        if (!left[v]) continue;
        const p = take(v);
        fn(v, p);
        put(v);
      }
    };
    each((p1, a) => each((b1, b) => each((p2, c) => each((b2, d) => {
      const pp = a * b * c * d;
      const pt = (p1 + p2) % 10;
      const bt = (b1 + b2) % 10;
      const score = (P: number, B: number, w: number) => (odds[P > B ? 'player' : B > P ? 'banker' : 'tie'] += w);
      if (pt >= 8 || bt >= 8) return score(pt, bt, pp);
      if (pt <= 5) {
        each((p3, e) => {
          const P = (pt + p3) % 10;
          const card = { suit: 'S' as const, rank: p3 === 0 ? 10 : p3 };
          if (bankerDraws(bt, card)) each((b3, f) => score(P, (bt + b3) % 10, pp * e * f));
          else score(P, bt, pp * e);
        });
      } else if (bt <= 5) each((b3, f) => score(pt, (bt + b3) % 10, pp * f));
      else score(pt, bt, pp);
    }))));
    const edge = { player: odds.banker - odds.player, banker: odds.player - 0.95 * odds.banker, tie: 1 - 9 * odds.tie };
    expect(edge.banker).toBeCloseTo(HOUSE_EDGE.banker, 4);
    expect(edge.player).toBeCloseTo(HOUSE_EDGE.player, 4);
    expect(edge.tie).toBeCloseTo(HOUSE_EDGE.tie, 4);
    // A fair tie would pay (1 - p) / p: about 9.5 to 1 (the rules tip).
    expect((1 - odds.tie) / odds.tie).toBeCloseTo(9.5, 0);
  }, 60_000);

  it('checks saved games', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ ...newState(), chip: 7 })).toBe(false);
    expect(isValidState({ ...newState(), bets: { player: 5, banker: 0, tie: 0 } })).toBe(false); // not a multiple of 20
    expect(isValidState({ ...newState(), winner: 'nobody' })).toBe(false);
    expect(isValidState({ ...newState(), shoe: [{ suit: 'X', rank: 1 }] })).toBe(false);
    expect(CHIPS.every((c) => c % 20 === 0)).toBe(true);
  });
});
