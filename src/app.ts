import { mountAbout } from './about';
import { storageWorks } from './core/storage';
import { closeConfirm } from './core/ui';
import { reportProblem } from './report';
import { openShareSheet, shareLinks } from './share';
import { CATEGORIES, type GameMeta } from './core/game';
import { mostPlayed, recordPlay } from './plays';

// Top bar icons: flat line drawings in the link color. Share is three joined dots, not
// a square with an arrow, so it isn't confused with Safari's own Share button.
const SHARE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/></svg>';
const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>';
const INFO_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v6"/><circle class="dot" cx="12" cy="7.5" r="0.6"/></svg>';

const card = (g: GameMeta) => `
  <a class="game-card" href="#/${g.id}">
    <span class="game-icon" aria-hidden="true">${g.icon}</span>
    <span class="game-title">${g.title}</span>
    <span class="game-desc">${g.description}</span>
  </a>`;

/** A titled group of game cards on the home screen. */
const group = (id: string, title: string, list: GameMeta[]) => `
  <section class="home-group" aria-labelledby="group-${id}">
    <h2 id="group-${id}">${title}</h2>
    <div class="home-grid">${list.map(card).join('')}</div>
  </section>`;

/** Most played first (once anything has been played), then each category A to Z. */
export function homeGroups(games: GameMeta[]): string {
  const byId = new Map(games.map((g) => [g.id, g]));
  const top = mostPlayed(games.map((g) => g.id)).map((id) => byId.get(id)!);
  const sections = CATEGORIES.map((c) => {
    const list = games.filter((g) => g.category === c.id).sort((a, b) => a.title.localeCompare(b.title));
    return list.length ? group(c.id, c.title, list) : '';
  });
  return (top.length ? group('most-played', 'Most played', top) : '') + sections.join('');
}

/** Shown on the home screen when the browser won't keep saved games. */
const NOT_SAVING = `<p class="notice" role="status">This browser isn’t saving your games, so they’ll be lost when you close it. Turning off private browsing, or allowing website data in your browser’s settings, usually fixes this.</p>`;

const list = (tag: string, items: string[]) => `<${tag}>${items.map((s) => `<li>${s}</li>`).join('')}</${tag}>`;

/** Full-screen How to play page, opened by the Rules button. */
function setUpHelp(root: HTMLElement, meta: GameMeta): void {
  const { goal, steps, tips } = meta.howToPlay;
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="help prose" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden>
      <header class="topbar sub help-bar">
        <button class="back top-icon" data-help-close aria-label="Back to the game">${BACK_ICON}</button>
        <h2 id="help-title" tabindex="-1">How to play ${meta.title}</h2>
      </header>
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
  // The back arrow at the top and Got it at the bottom both close the rules.
  panel.querySelectorAll('[data-help-close]').forEach((btn) =>
    btn.addEventListener('click', () => {
      panel.hidden = true;
      openBtn.focus();
    }),
  );
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
        <button class="top-action top-icon" data-share aria-label="Share" aria-expanded="false">${SHARE_ICON}</button>
        <a class="top-action top-icon" href="#/about" aria-label="About">${INFO_ICON}</a>
      </header>
      <div class="share-menu" data-share-menu hidden>
        <a class="btn" href="${links.text}">Send a text</a>
        <a class="btn secondary" href="${links.email}">Send an email</a>
      </div>
      <main class="home">${storageWorks() ? '' : NOT_SAVING}${homeGroups(games)}</main>`;
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
      <header class="topbar sub">
        <a class="back top-icon" href="#/" aria-label="Back to games">${BACK_ICON}</a>
        <h1>About</h1>
      </header>
      <main class="about prose"></main>`;
    mountAbout(root.querySelector<HTMLElement>('.about')!);
  }

  async function route() {
    const current = ++navigation;
    closeConfirm(); // a pending "Start a new game?" belongs to the game being left
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
    recordPlay(meta.id);

    root.innerHTML = `
      <header class="topbar sub">
        <a class="back top-icon" href="#/" aria-label="Back to games">${BACK_ICON}</a>
        <h1>${meta.title}</h1>
        <button class="top-action top-icon" data-help aria-haspopup="dialog" aria-label="Rules">${INFO_ICON}</button>
      </header>
      <main class="game"></main>`;
    const main = root.querySelector<HTMLElement>('.game')!;
    setUpHelp(root, meta);

    let module: Awaited<ReturnType<GameMeta['load']>>;
    try {
      module = await meta.load();
    } catch {
      if (current !== navigation) return;
      main.innerHTML = `<p class="status-line">Couldn't load this game. Connect to the internet once and try again.</p>`;
      return;
    }
    if (current !== navigation) return; // user navigated away while loading
    try {
      cleanup = module.mount(main);
    } catch (error) {
      main.innerHTML = `<p class="status-line">This game couldn't start. Go back to Games and try again.</p>`;
      reportProblem(error);
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
