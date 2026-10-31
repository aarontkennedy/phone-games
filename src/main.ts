import './style.css';
import { games } from './games';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;
let navigation = 0;

function renderHome() {
  app.innerHTML = `
    <header class="topbar"><h1>Games</h1></header>
    <main class="home">
      ${games
        .map(
          (g) => `
        <a class="game-card" href="#/${g.id}">
          <span class="game-icon">${g.icon}</span>
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

  app.innerHTML = `
    <header class="topbar">
      <a class="back" href="#/">‹ Games</a>
      <h1>${meta.title}</h1>
    </header>
    <main class="game"></main>`;

  const module = await meta.load();
  if (current !== navigation) return; // user navigated away while loading
  cleanup = module.mount(app.querySelector<HTMLElement>('.game')!);
}

window.addEventListener('hashchange', route);
route();
