import { describe, expect, it, vi } from 'vitest';
import { startApp } from './app';
import type { GameMeta, GameModule } from './core/game';
import { flush } from './test/helpers';

function game(id: string, load: () => Promise<GameModule>): GameMeta {
  return {
    id,
    title: `Title ${id}`,
    description: `About ${id}`,
    icon: '🎲',
    howToPlay: { goal: `Win ${id}`, steps: ['First', 'Second'], tips: ['Hint'] },
    load,
  };
}

function setup(games: GameMeta[]) {
  const root = document.createElement('div');
  document.body.append(root);
  const stop = startApp(root, games);
  const go = async (hash: string) => {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await flush();
  };
  return { root, stop, go };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('startApp', () => {
  it('renders a card for each game on the home screen', () => {
    const { root, stop } = setup([game('a', vi.fn()), game('b', vi.fn())]);
    const cards = root.querySelectorAll<HTMLAnchorElement>('.game-card');
    expect([...cards].map((c) => c.getAttribute('href'))).toEqual(['#/a', '#/b']);
    expect(cards[0].textContent).toContain('Title a');
    expect(cards[0].textContent).toContain('About a');
    stop();
  });

  it('mounts a game into the game area and unmounts it when leaving', async () => {
    const unmount = vi.fn();
    const mount = vi.fn((el: HTMLElement) => {
      el.textContent = 'playing';
      return unmount;
    });
    const { root, stop, go } = setup([game('a', async () => ({ mount }))]);

    await go('#/a');
    expect(root.querySelector('h1')!.textContent).toBe('Title a');
    expect(root.querySelector('.back')!.getAttribute('href')).toBe('#/');
    expect(root.querySelector('.game')!.textContent).toBe('playing');

    await go('#/');
    expect(unmount).toHaveBeenCalledOnce();
    expect(root.querySelector('.home')).not.toBeNull();
    stop();
  });

  describe('how to play', () => {
    const noop = async () => ({ mount: () => () => {} });
    const panel = (root: HTMLElement) => root.querySelector<HTMLElement>('.help')!;

    it('opens by itself the first time a game is opened', async () => {
      const { root, stop, go } = setup([game('a', noop)]);
      await go('#/a');
      const help = panel(root);
      expect(help.hidden).toBe(false);
      expect(help.getAttribute('role')).toBe('dialog');
      expect(help.querySelector('h2')!.textContent).toBe('How to play Title a');
      expect(document.activeElement).toBe(help.querySelector('h2'));
      expect(help.textContent).toContain('Win a');
      expect([...help.querySelectorAll('ol li')].map((li) => li.textContent)).toEqual(['First', 'Second']);
      expect(help.querySelector('ul li')!.textContent).toBe('Hint');
      stop();
    });

    it('stays closed after Got it, and Rules opens it again', async () => {
      const { root, stop, go } = setup([game('a', noop)]);
      await go('#/a');
      panel(root).querySelector<HTMLButtonElement>('[data-help-close]')!.click();
      expect(panel(root).hidden).toBe(true);
      expect(document.activeElement).toBe(root.querySelector('[data-help]'));

      await go('#/');
      await go('#/a');
      expect(panel(root).hidden).toBe(true);

      root.querySelector<HTMLButtonElement>('[data-help]')!.click();
      expect(panel(root).hidden).toBe(false);
      stop();
    });

    it('remembers each game separately', async () => {
      const { root, stop, go } = setup([game('a', noop), game('b', noop)]);
      await go('#/a');
      panel(root).querySelector<HTMLButtonElement>('[data-help-close]')!.click();
      await go('#/b');
      expect(panel(root).hidden).toBe(false);
      stop();
    });

    it('leaves out the tips heading when a game has no tips', async () => {
      const g = game('a', noop);
      g.howToPlay = { goal: 'Win', steps: ['Play'] };
      const { root, stop, go } = setup([g]);
      await go('#/a');
      expect(panel(root).querySelector('h3')).toBeNull();
      stop();
    });
  });

  it('opens the game in the URL on startup', async () => {
    history.replaceState(null, '', '#/a');
    const mount = vi.fn(() => () => {});
    const { stop } = setup([game('a', async () => ({ mount }))]);
    await flush();
    expect(mount).toHaveBeenCalledOnce();
    stop();
  });

  it('shows the home screen for unknown games', async () => {
    const { root, stop, go } = setup([game('a', vi.fn())]);
    await go('#/nope');
    expect(root.querySelector('.home')).not.toBeNull();
    stop();
  });

  it('does not mount a game the user navigated away from while it loaded', async () => {
    const slow = deferred<GameModule>();
    const mount = vi.fn(() => () => {});
    const { root, stop, go } = setup([game('a', () => slow.promise)]);

    await go('#/a');
    await go('#/');
    slow.resolve({ mount });
    await flush();

    expect(mount).not.toHaveBeenCalled();
    expect(root.querySelector('.home')).not.toBeNull();
    stop();
  });

  it('shows an error if a game fails to load', async () => {
    const { root, stop, go } = setup([game('a', () => Promise.reject(new Error('offline')))]);
    await go('#/a');
    expect(root.querySelector('.game')!.textContent).toContain("Couldn't load this game");
    stop();
  });

  it('ignores a load failure after the user navigated away', async () => {
    const slow = deferred<GameModule>();
    const { root, stop, go } = setup([game('a', () => slow.promise)]);
    await go('#/a');
    await go('#/');
    slow.reject(new Error('offline'));
    await flush();
    expect(root.textContent).not.toContain("Couldn't load");
    stop();
  });

  it('stops routing and unmounts the current game when stopped', async () => {
    const unmount = vi.fn();
    const mount = vi.fn(() => unmount);
    const { root, stop, go } = setup([game('a', async () => ({ mount })), game('b', vi.fn())]);
    await go('#/a');

    stop();
    expect(unmount).toHaveBeenCalledOnce();
    const before = root.innerHTML;
    await go('#/');
    expect(root.innerHTML).toBe(before);
  });
});
