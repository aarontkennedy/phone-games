import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHARE_TEXT, SHARE_TITLE, appUrl, openShareSheet, shareLinks } from './share';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  history.replaceState(null, '', '/');
});

describe('sharing', () => {
  it('shares the app’s address without the game in the URL', () => {
    history.replaceState(null, '', '/phone-games/#/hearts');
    expect(appUrl()).toBe(`${location.origin}/phone-games/`);
  });

  it('builds text and email links with the message and address filled in', () => {
    const { text, email } = shareLinks('https://example.com/games/');
    const body = encodeURIComponent(`${SHARE_TEXT} https://example.com/games/`);
    expect(text).toBe(`sms:?&body=${body}`);
    expect(email).toBe(`mailto:?subject=${encodeURIComponent('Try these games on your phone')}&body=${body}`);
  });

  it('opens the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    expect(await openShareSheet('https://example.com/')).toBe(true);
    expect(share).toHaveBeenCalledWith({ title: SHARE_TITLE, text: SHARE_TEXT, url: 'https://example.com/' });
  });

  it('is fine when the share sheet is closed without sharing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    expect(await openShareSheet()).toBe(true);
  });

  it('reports when there is no share sheet', async () => {
    expect(await openShareSheet()).toBe(false);
  });
});
