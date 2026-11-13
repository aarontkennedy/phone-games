// Line icons shared by the app's buttons and the text that mentions those buttons
// (rules and status lines), so the text shows the same drawing the player taps.
// Drawn here: no icon library. Styled by .top-icon, .inline-icon or the game's CSS.

export const BACK_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>';
export const GEAR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-linejoin="round" d="M19.8 10.3L22.4 10.6L22.4 13.4L19.8 13.7L18.7 16.3L20.4 18.3L18.3 20.4L16.3 18.7L13.7 19.8L13.4 22.4L10.6 22.4L10.3 19.8L7.7 18.7L5.7 20.4L3.6 18.3L5.3 16.3L4.2 13.7L1.6 13.4L1.6 10.6L4.2 10.3L5.3 7.7L3.6 5.7L5.7 3.6L7.7 5.3L10.3 4.2L10.6 1.6L13.4 1.6L13.7 4.2L16.3 5.3L18.3 3.6L20.4 5.7L18.7 7.7Z"/><circle cx="12" cy="12" r="3.5"/></svg>';
/** A circular arrow: start over. */
export const NEW_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path stroke-linejoin="round" d="M18.5 3v4.5H14"/></svg>';
export const INFO_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v6"/><circle class="dot" cx="12" cy="7.5" r="0.6"/></svg>';
/** A flat light bulb, for Hint. */
export const BULB_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/></svg>';
/** Number Place's erase key: an arrow with an X, like a phone keyboard's. */
export const ERASE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg>';

/** An icon inside text, read by screen readers as its button's name. */
export const inlineIcon = (svg: string, label: string): string =>
  `<span class="inline-icon" role="img" aria-label="${label}">${svg}</span>`;

/** The New game button, as it appears in text. */
export const NEW_GAME = inlineIcon(NEW_ICON, 'New game');
/** The Settings button, as it appears in text. */
export const SETTINGS = inlineIcon(GEAR_ICON, 'Settings');

/**
 * Draws `{new}` in an element's text as the New game icon. Call it after setting the
 * text with textContent; the rest stays plain (escaped) text, so nothing can inject markup.
 */
export function showIcons(el: HTMLElement): void {
  const text = el.textContent ?? '';
  if (!text.includes('{new}')) return;
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  el.innerHTML = escaped.replace(/\{new\}/g, NEW_GAME);
}
