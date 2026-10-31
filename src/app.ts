import type { GameMeta } from './core/game';

/** Hash router: `#/` shows the game list, `#/<id>` opens a game. Returns a stop function. */
export function startApp(root: HTMLElement, games: GameMeta[]): () => void {
  let cleanup: (() => void) | null = null;
  let navigation = 0;

  function renderHome() {
    root.innerHTML = `
      <header class="topbar"><h1>Games</h1></header>
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
  }

  async function route() {
    const current = ++navigation;
    cleanup?.();
    cleanup = null;

    const id = location.hash.replace(/^#\/?/, '');
    const meta = games.find((g) => g.id === id);
    if (!meta) {
      renderHome();
      return;
    }

    root.innerHTML = `
      <header class="topbar">
        <a class="back" href="#/">‹ Games</a>
        <h1>${meta.title}</h1>
      </header>
      <main class="game"></main>`;
    const main = root.querySelector<HTMLElement>('.game')!;

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
