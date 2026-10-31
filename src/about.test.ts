import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountAbout, OWNER, YEAR } from './about';
import { flush } from './test/helpers';

function setup() {
  const main = document.createElement('main');
  document.body.append(main);
  mountAbout(main);
  const details = main.querySelector('details')!;
  const notices = main.querySelector<HTMLElement>('[data-notices]')!;
  const toggle = async (open: boolean) => {
    details.open = open;
    details.dispatchEvent(new Event('toggle'));
    await flush();
  };
  return { main, notices, toggle };
}

const respond = (body: string, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 404, text: async () => body }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('About page', () => {
  it('names the owner and reserves rights, matching LICENSE', () => {
    const { main } = setup();
    expect(main.textContent).toContain(`© ${YEAR} ${OWNER}. All rights reserved.`);
  });

  it('explains how to install on iPhone and Android', () => {
    const { main } = setup();
    const headings = [...main.querySelectorAll('h3')].map((h) => h.textContent);
    expect(headings).toEqual(['iPhone or iPad', 'Android']);
    expect(main.textContent).toContain('Add to Home Screen');
    expect(main.textContent).toContain('Install app');
  });

  it('says what happens to your data', () => {
    const { main } = setup();
    expect(main.textContent).toContain('saved only on this device');
  });

  it('loads the license notices the first time they are opened', async () => {
    const fetch = respond('Workbox MIT');
    vi.stubGlobal('fetch', fetch);
    const { notices, toggle } = setup();
    expect(fetch).not.toHaveBeenCalled();

    await toggle(true);
    expect(fetch).toHaveBeenCalledWith('THIRD_PARTY_NOTICES.txt');
    expect(notices.textContent).toBe('Workbox MIT');

    await toggle(false);
    await toggle(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('says so if the notices fail to load, and tries again next time', async () => {
    const fetch = respond('', false);
    vi.stubGlobal('fetch', fetch);
    const { notices, toggle } = setup();

    await toggle(true);
    expect(notices.textContent).toContain("Couldn't load the notices");

    fetch.mockImplementation(async () => ({ ok: true, status: 200, text: async () => 'Workbox MIT' }));
    await toggle(false);
    await toggle(true);
    expect(notices.textContent).toBe('Workbox MIT');
  });
});
