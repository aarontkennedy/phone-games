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
