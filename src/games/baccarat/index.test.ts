import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { load, save } from '../../core/storage';
import { makeContainer, track } from '../../test/helpers';
import { mount } from './index';
import { freshShoe, newState, type State } from './logic';
import { stacked } from './test-fixtures';
import { seededRng } from '../../core/random';

function setup(saved: unknown = null) {
  if (saved) save('baccarat:state', saved);
  const container = makeContainer();
  const unmount = track(mount(container));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
  const stored = () => load<State>('baccarat:state', null as unknown as State);
  const status = () => $('[data-status]').textContent;
  return { container, unmount, $, stored, status };
}

/** A table whose next hand deals these cards: Player, Banker, Player, Banker, then thirds. */
const next = (ids: string, o: Partial<State> = {}): State => ({ ...newState(), shoe: [...freshShoe(seededRng(1)).slice(0, 100), ...stacked(ids)], ...o });

describe('Baccarat screen', () => {
  it('bets, deals, and pays the winner', () => {
    const { $, stored, status } = setup(next('7S 5H 2D 3C'));
    expect(status()).toBe('Tap Player, Banker or Tie to bet, then tap Deal.');
    expect($<HTMLButtonElement>('[data-deal]').disabled).toBe(true);
    expect($<HTMLButtonElement>('[data-clear]').disabled).toBe(true);
    $('[data-chip="100"]').click();
    $('[data-spot="player"]').click();
    expect($('[data-bet]').textContent).toBe('100');
    expect($('[data-spot="player"]').getAttribute('aria-label')).toBe('Player, pays 1 to 1, bet 100');
    $('[data-deal]').click();
    expect(stored().winner).toBe('player');
    expect(status()).toBe('Player wins, 9 to 8. A natural. You win 100.');
    expect($('[data-chips]').textContent).toBe('1100');
    expect($('[data-best]').textContent).toBe('1100');
    expect($('.bc-hand.won .bc-label').textContent).toBe('Player 9');
    expect(stored().bets.player).toBe(100); // still down for the next hand
    $('[data-board]').click(); // not on a spot
    $('[data-controls]').click(); // not on a button
  });

  it('says when a bet loses, when bets come back on a tie, and clears', () => {
    const lose = setup(next('2S 5H 3D 3C', { bets: { player: 20, banker: 0, tie: 0 } }));
    lose.$('[data-deal]').click();
    expect(lose.status()).toBe('Banker wins, 8 to 5. A natural. You lose 20.');
    document.body.replaceChildren();
    const tie = setup(next('9S 9H KD KC', { bets: { player: 20, banker: 0, tie: 0 } }));
    tie.$('[data-deal]').click();
    expect(tie.status()).toBe('A tie, 9 each. A natural. Your bets come back.');
    tie.$('[data-clear]').click();
    expect(tie.stored().bets).toEqual({ player: 0, banker: 0, tie: 0 });
  });

  it('offers Start over when out of chips', () => {
    const { $, stored, status } = setup(next('7S 5H 2D 3C', { chips: 20, bets: { player: 0, banker: 20, tie: 0 } }));
    $('[data-deal]').click();
    expect(status()).toMatch(/You’re out of chips\. Tap Start over for 1000 more\.$/);
    $('[data-restart]').click();
    expect(stored().chips).toBe(1000);
  });

  it('points to Banker when asked, and away from Tie', () => {
    const { $, container } = setup();
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toMatch(/^Best: bet on Banker\. The house keeps about 1\.06% of Banker bets/);
    expect([...container.querySelectorAll<HTMLElement>('.bc-spot.hint')].map((b) => b.dataset.spot)).toEqual(['banker']);
    $('[data-spot="tie"]').click(); // a bet: ask again for the next one
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toMatch(/^Best: take the Tie bet down \(Clear\) and bet Banker\./);
    $('[data-clear]').click();
    $('[data-spot="banker"]').click();
    $('[data-hint]').click();
    expect($('[data-tip]').textContent).toBe('Best: Deal. Banker is the best bet on the table.');
    expect($('[data-accuracy]')).toBeNull(); // no Right score
  });

  it('ignores a broken save and saves when closed', () => {
    const { stored, unmount } = setup({ chips: 'x' });
    unmount();
    expect(stored().chips).toBe(1000);
  });
});

describe('Baccarat colors', () => {
  it('uses only the shared color tokens (checked for contrast in src/design.test.ts)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb/i);
  });
});
