import { mountAbout } from './about';
import { openShareSheet, shareLinks } from './share';
import type { GameMeta } from './core/game';

const list = (tag: string, items: string[]) => `<${tag}>${items.map((s) => `<li>${s}</li>`).join('')}</${tag}>`;

/** Full-screen How to play page, opened by the Rules button. */
function setUpHelp(root: HTMLElement, meta: GameMeta): void {
  const { goal, steps, tips } = meta.howToPlay;
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="help prose" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden>
      <h2 id="help-title" tabindex="-1">How to play ${meta.title}</h2>
      <p><b>Goal:</b> ${goal}</p>
      ${list('ol', steps)}
      ${tips?.length ? `<h3>Tips</h3>${list('ul', tips)}` : ''}
      <button class="btn" data-help-close>Got it</button>
    </div>`,
  );
  const panel = root.querySelector<HTMLElement>('.help')!;
  const openBtn = root.querySelector<HTMLButtonElement>('[data-help]')!;

  openBtn.addEventListener('click', () => {
    panel.hidden = false;
    panel.scrollTop = 0;
    panel.querySelector<HTMLElement>('h2')!.focus();
  });
  panel.querySelector('[data-help-close]')!.addEventListener('click', () => {
    panel.hidden = true;
    openBtn.focus();
  });
}

/**
 * Hash router: `#/` shows the game list, `#/about` the About page, and `#/<id>` opens a
 * game. Returns a stop function.
 */
export function startApp(root: HTMLElement, games: GameMeta[]): () => void {
  let cleanup: (() => void) | null = null;
  let navigation = 0;

  function renderHome() {
    const links = shareLinks();
    root.innerHTML = `
      <header class="topbar">
        <h1>Games</h1>
        <button class="top-action" data-share aria-expanded="false">Share</button>
        <a class="top-action" href="#/about">About</a>
      </header>
      <div class="share-menu" data-share-menu hidden>
        <a class="btn" href="${links.text}">Send a text</a>
        <a class="btn secondary" href="${links.email}">Send an email</a>
      </div>
      <main class="home">
        ${games
          .map(
            (g) => `
          <a class="game-card" href="#/${g.id}">
            <span class="game-icon" aria-hidden="true">${g.icon}</span>
            <span class="game-title">${g.title}</span>
            <span class="game-desc">${g.description}</span>
          </a>`,
          )
          .join('')}
      </main>`;
    const shareBtn = root.querySelector<HTMLButtonElement>('[data-share]')!;
    const menu = root.querySelector<HTMLElement>('[data-share-menu]')!;
    shareBtn.addEventListener('click', async () => {
      if (await openShareSheet()) return;
      menu.hidden = !menu.hidden; // no share sheet: offer text and email links instead
      shareBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
  }

  function renderAbout() {
    root.innerHTML = `
      <header class="topbar">
        <a class="back" href="#/">‹ Games</a>
        <h1>About</h1>
      </header>
      <main class="about prose"></main>`;
    mountAbout(root.querySelector<HTMLElement>('.about')!);
  }

  async function route() {
    const current = ++navigation;
    cleanup?.();
    cleanup = null;

    const id = location.hash.replace(/^#\/?/, '');
    if (id === 'about') {
      renderAbout();
      return;
    }
    const meta = games.find((g) => g.id === id);
    if (!meta) {
      renderHome();
      return;
    }

    root.innerHTML = `
      <header class="topbar">
        <a class="back" href="#/">‹ Games</a>
        <h1>${meta.title}</h1>
        <button class="top-action" data-help aria-haspopup="dialog">Rules</button>
      </header>
      <main class="game"></main>`;
    const main = root.querySelector<HTMLElement>('.game')!;
    setUpHelp(root, meta);

    try {
      const module = await meta.load();
      if (current !== navigation) return; // user navigated away while loading
      cleanup = module.mount(main);
    } catch {
      if (current !== navigation) return;
      main.innerHTML = `<p class="status-line">Couldn't load this game. Connect to the internet once and try again.</p>`;
    }
  }

  window.addEventListener('hashchange', route);
  route();

  return () => {
    window.removeEventListener('hashchange', route);
    navigation++;
    cleanup?.();
    cleanup = null;
  };
}
