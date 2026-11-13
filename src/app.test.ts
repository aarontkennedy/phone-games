import { afterEach, describe, expect, it, vi } from 'vitest';
import { startApp } from './app';
import type { Category, GameMeta, GameModule } from './core/game';
import { levelSetting, settingRow, settingsHtml } from './core/ui';
import { flush } from './test/helpers';

function game(id: string, load: () => Promise<GameModule>, category: Category = 'cards', title = `Title ${id}`): GameMeta {
  return {
    id,
    title,
    description: `About ${id}`,
    icon: '🎲',
    category,
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

  it('warns on the home screen when the browser won’t save games', () => {
    const ok = setup([game('a', vi.fn())]);
    expect(ok.root.querySelector('.notice')).toBeNull();
    ok.stop();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const blocked = setup([game('a', vi.fn())]);
    expect(blocked.root.querySelector('.notice')!.textContent).toContain('isn’t saving your games');
    spy.mockRestore();
    blocked.stop();
  });

  it('groups games by kind, A to Z within each group', () => {
    const { root, stop } = setup([
      game('z', vi.fn(), 'board', 'Zebra'),
      game('y', vi.fn(), 'cards', 'Yak'),
      game('x', vi.fn(), 'board', 'Antelope'),
    ]);
    const headings = [...root.querySelectorAll('.home-group h2')].map((h) => h.textContent);
    expect(headings).toEqual(['Card games', 'Board games']); // empty groups are left out
    const board = root.querySelector('[aria-labelledby="group-board"]')!;
    expect([...board.querySelectorAll('.game-title')].map((t) => t.textContent)).toEqual(['Antelope', 'Zebra']);
    stop();
  });

  it('shows the two most played games first, once any have been played', async () => {
    const mount = () => () => {};
    const games = ['a', 'b', 'c'].map((id) => game(id, async () => ({ mount })));
    const { root, stop, go } = setup(games);
    expect(root.querySelector('#group-most-played')).toBeNull();
    for (const hash of ['#/b', '#/', '#/c', '#/', '#/b', '#/', '#/a', '#/']) await go(hash);
    const top = root.querySelector('[aria-labelledby="group-most-played"]')!;
    expect(top.querySelector('h2')!.textContent).toBe('Most played');
    // b twice; a and c once each, a more recently.
    expect([...top.querySelectorAll('.game-card')].map((c) => c.getAttribute('href'))).toEqual(['#/b', '#/a']);
    expect(root.querySelectorAll('.home-group')[0]).toBe(top);
    expect(root.querySelectorAll('[href="#/b"]')).toHaveLength(2); // also in its own group
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

  describe('settings', () => {
    const gear = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-settings-open]');
    const panel = (root: HTMLElement) => root.querySelector<HTMLElement>('.settings')!;
    const withSettings = async () => ({
      mount(container: HTMLElement) {
        container.innerHTML = `<div class="screen"></div>${settingsHtml(levelSetting())}`;
        const level = container.querySelector<HTMLButtonElement>('[data-level="strong"]')!;
        level.addEventListener('click', () => level.setAttribute('aria-pressed', 'true'));
        return () => {};
      },
    });

    it('has no gear when the game has no settings', async () => {
      const { root, stop, go } = setup([game('a', async () => ({ mount: () => () => {} }))]);
      await go('#/a');
      expect(gear(root)).toBeNull();
      expect(root.querySelector('.settings')).toBeNull();
      stop();
    });

    it('puts a gear beside Rules that opens the game’s settings, still wired to the game', async () => {
      const { root, stop, go } = setup([game('a', withSettings)]);
      await go('#/a');
      const button = gear(root)!;
      expect(button.getAttribute('aria-label')).toBe('Settings');
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.nextElementSibling).toBe(root.querySelector('[data-help]'));
      expect(root.querySelector('.game [data-level]')).toBeNull(); // off the game screen
      expect(panel(root).hidden).toBe(true);

      button.click();
      expect(panel(root).hidden).toBe(false);
      expect(panel(root).getAttribute('role')).toBe('dialog');
      expect(document.activeElement).toBe(panel(root).querySelector('h2'));
      const rows = panel(root).querySelector<HTMLElement>('[data-settings]')!;
      expect(rows.hidden).toBe(false);
      expect(rows.querySelector('h3')!.textContent).toBe('Computer player');
      expect(rows.querySelector('.setting-note')!.textContent).toBe('Changes take effect right away.');
      panel(root).querySelector<HTMLButtonElement>('[data-level="strong"]')!.click();
      expect(panel(root).querySelector('[data-level="strong"]')!.getAttribute('aria-pressed')).toBe('true');
      stop();
    });

    it('closes with the back arrow or Done, returning focus to the gear', async () => {
      const { root, stop, go } = setup([game('a', withSettings)]);
      await go('#/a');
      const [back, done] = [...panel(root).querySelectorAll<HTMLButtonElement>('[data-settings-close]')];
      expect(back.getAttribute('aria-label')).toBe('Back to the game');
      expect(done.textContent).toBe('Done');
      for (const close of [back, done]) {
        gear(root)!.click();
        close.click();
        expect(panel(root).hidden).toBe(true);
        expect(document.activeElement).toBe(gear(root));
      }
      stop();
    });

    it('leaves the note out when a setting has none', () => {
      expect(settingRow('Suits', '<button>1</button>')).not.toContain('setting-note');
      expect(levelSetting('Computer players')).toContain('aria-label="Computer players"');
    });
  });

  describe('how to play', () => {
    const noop = async () => ({ mount: () => () => {} });
    const panel = (root: HTMLElement) => root.querySelector<HTMLElement>('.help')!;
    const rules = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-help]')!;

    it('stays closed until Rules is tapped', async () => {
      const { root, stop, go } = setup([game('a', noop)]);
      await go('#/a');
      expect(panel(root).hidden).toBe(true);
      expect(rules(root).getAttribute('aria-label')).toBe('Rules');
      expect(rules(root).querySelector('svg')).not.toBeNull();
      stop();
    });

    it('shows the goal, steps and tips when Rules is tapped', async () => {
      const { root, stop, go } = setup([game('a', noop)]);
      await go('#/a');
      rules(root).click();
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

    it('closes with the back arrow at the top or Got it at the bottom, returning focus to Rules', async () => {
      const { root, stop, go } = setup([game('a', noop)]);
      await go('#/a');
      const [back, gotIt] = [...panel(root).querySelectorAll<HTMLButtonElement>('[data-help-close]')];
      expect(back.getAttribute('aria-label')).toBe('Back to the game');
      expect(gotIt.textContent).toBe('Got it');
      for (const close of [back, gotIt]) {
        rules(root).click();
        close.click();
        expect(panel(root).hidden).toBe(true);
        expect(document.activeElement).toBe(rules(root));
      }
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

    it('adds a game’s extra reference, such as a chart, after the tips', async () => {
      const g = game('a', noop);
      g.howToPlay = { goal: 'Win', steps: ['Play'], tips: ['Tip'], extra: '<table class="chart"></table>' };
      const { root, stop, go } = setup([g]);
      await go('#/a');
      expect(panel(root).querySelector('ul + table.chart')).not.toBeNull();
      stop();
    });
  });

  describe('share', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'share');
    });

    it('opens the phone’s share sheet from the home screen', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { configurable: true, value: share });
      const { root, stop } = setup([game('a', vi.fn())]);
      root.querySelector<HTMLButtonElement>('[data-share]')!.click();
      await flush();
      expect(share).toHaveBeenCalledOnce();
      expect(root.querySelector<HTMLElement>('[data-share-menu]')!.hidden).toBe(true);
      stop();
    });

    it('offers text and email links when there’s no share sheet', async () => {
      const { root, stop } = setup([game('a', vi.fn())]);
      const btn = root.querySelector<HTMLButtonElement>('[data-share]')!;
      const menu = root.querySelector<HTMLElement>('[data-share-menu]')!;
      expect(menu.hidden).toBe(true);
      btn.click();
      await flush();
      expect(menu.hidden).toBe(false);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      const links = [...menu.querySelectorAll('a')];
      expect(links.map((a) => a.textContent)).toEqual(['Send a text', 'Send an email']);
      expect(links[0].getAttribute('href')).toMatch(/^sms:\?&body=/);
      expect(links[1].getAttribute('href')).toMatch(/^mailto:\?subject=/);
      btn.click();
      await flush();
      expect(menu.hidden).toBe(true);
      stop();
    });
  });

  describe('about', () => {
    it('is linked from the home screen', () => {
      const { root, stop } = setup([game('a', vi.fn())]);
      const about = root.querySelector('.topbar a[href="#/about"]')!;
      expect(about.getAttribute('aria-label')).toBe('About');
      expect(about.querySelector('svg')).not.toBeNull();
      expect(root.querySelector('[data-share]')!.getAttribute('aria-label')).toBe('Share');
      stop();
    });

    it('opens the About page with a way back', async () => {
      const unmount = vi.fn();
      const { root, stop, go } = setup([game('a', async () => ({ mount: () => unmount }))]);
      await go('#/a');
      await go('#/about');
      expect(unmount).toHaveBeenCalledOnce();
      expect(root.querySelector('h1')!.textContent).toBe('About');
      expect(root.querySelector('.back')!.getAttribute('href')).toBe('#/');
      expect(root.querySelector('.about')!.textContent).toContain('All rights reserved');
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

  it('offers a problem report if a game crashes while starting', async () => {
    const mount = () => {
      throw new Error('bad save');
    };
    const { root, stop, go } = setup([game('a', async () => ({ mount }))]);
    await go('#/a');
    expect(root.querySelector('.game')!.textContent).toContain("This game couldn't start");
    const report = document.querySelector<HTMLAnchorElement>('.problem-banner [data-report]')!;
    expect(decodeURIComponent(report.href)).toContain('Error: bad save');
    expect(decodeURIComponent(report.href)).toContain('Screen: #/a');
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
