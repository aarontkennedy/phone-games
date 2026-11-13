import { describe, expect, it } from 'vitest';
import { NEW_GAME, SETTINGS, showIcons } from './icons';

describe('icons in text', () => {
  it('draws {new} as the New game icon, named for screen readers', () => {
    const el = document.createElement('p');
    el.textContent = 'You win! Tap {new} for another round.';
    showIcons(el);
    const icon = el.querySelector('.inline-icon')!;
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toBe('New game');
    expect(icon.querySelector('svg')).not.toBeNull();
    expect(el.textContent).toBe('You win! Tap  for another round.');
  });

  it('leaves other text alone, and never turns it into markup', () => {
    const el = document.createElement('p');
    el.textContent = 'Your turn <b>';
    showIcons(el);
    expect(el.innerHTML).toBe('Your turn &lt;b&gt;');
    el.textContent = '<i>x</i> & {new}';
    showIcons(el);
    expect(el.querySelector('i')).toBeNull();
    expect(el.textContent).toBe('<i>x</i> & ');
  });

  it('labels the Settings icon', () => {
    expect(SETTINGS).toContain('aria-label="Settings"');
    expect(NEW_GAME).toContain('aria-label="New game"');
  });
});
