// Shared UI pieces. Styles live in src/style.css (see docs/DESIGN.md).

export type Action = [label: string, onClick: () => void];

/**
 * Shows a message with buttons over `host` (which must be position: relative,
 * e.g. a .board-frame). The first action is styled as the primary button.
 */
export function showOverlay(host: HTMLElement, message: string, actions: Action[]): void {
  let overlay = host.querySelector<HTMLElement>(':scope > .overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('role', 'dialog');
    host.append(overlay);
  }
  const title = document.createElement('h2');
  title.textContent = message;
  overlay.replaceChildren(title);
  overlay.setAttribute('aria-label', message);
  actions.forEach(([label, onClick], i) => {
    const btn = document.createElement('button');
    btn.className = i === 0 ? 'btn' : 'btn secondary';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    overlay.append(btn);
  });
  overlay.hidden = false;
}

export function hideOverlay(host: HTMLElement): void {
  const overlay = host.querySelector<HTMLElement>(':scope > .overlay');
  if (overlay) overlay.hidden = true;
}

/**
 * Asks before starting over when a game is partway through, so a stray tap on New
 * doesn't throw it away. Starts at once when nothing would be lost. The question covers
 * the whole screen, since some boards are too short to hold it.
 */
export function confirmNew(inProgress: boolean, start: () => void): void {
  if (!inProgress) {
    start();
    return;
  }
  closeConfirm();
  const box = document.createElement('div');
  box.className = 'confirm';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'confirm-title');
  box.innerHTML = `
    <div class="confirm-box">
      <h2 id="confirm-title">Start a new game?</h2>
      <p>The game you’re playing will be lost.</p>
      <button class="btn" data-confirm>New game</button>
      <button class="btn secondary" data-cancel>Keep playing</button>
    </div>`;
  box.querySelector('[data-confirm]')!.addEventListener('click', () => {
    closeConfirm();
    start();
  });
  box.querySelector('[data-cancel]')!.addEventListener('click', closeConfirm);
  document.body.append(box);
  box.querySelector<HTMLElement>('[data-cancel]')!.focus();
}

/** Closes the New game question, e.g. when leaving the game. */
export function closeConfirm(): void {
  document.querySelector('.confirm')?.remove();
}
