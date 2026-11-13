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

/**
 * Settings that aren't changed often (the computer's level, a difficulty), kept off the
 * game screen behind the gear in the top bar (docs/DESIGN.md, "Settings"). A game puts this
 * after its `.screen`; the app moves it into the Settings panel and shows the gear. The
 * game's own handlers keep working, since the buttons are the same elements.
 */
export function settingsHtml(...rows: string[]): string {
  return `<div class="settings-rows" data-settings hidden>${rows.join('')}</div>`;
}

/** One setting: a label over a switch of choices, with an optional short note. */
export function settingRow(label: string, choices: string, note = ''): string {
  return `<section class="setting">
    <h3>${label}</h3>
    <div class="segmented" role="group" aria-label="${label}">${choices}</div>
    ${note ? `<p class="setting-note">${note}</p>` : ''}
  </section>`;
}

/** The Easy / Strong computer level, which takes effect at once. */
export function levelSetting(label = 'Computer player'): string {
  return settingRow(label, '<button data-level="easy">Easy</button><button data-level="strong">Strong</button>', 'Changes take effect right away.');
}
