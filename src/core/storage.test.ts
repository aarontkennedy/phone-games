import { describe, expect, it, vi } from 'vitest';
import { load, remove, save } from './storage';

describe('storage', () => {
  it('round-trips JSON values under a namespaced key', () => {
    save('thing', { a: 1, b: [true] });
    expect(load('thing', null)).toEqual({ a: 1, b: [true] });
    expect(localStorage.getItem('pg:thing')).toBe('{"a":1,"b":[true]}');
  });

  it('returns the fallback for missing keys', () => {
    expect(load('missing', 5)).toBe(5);
  });

  it('returns the fallback for corrupt data', () => {
    localStorage.setItem('pg:bad', '{not json');
    expect(load('bad', 'fallback')).toBe('fallback');
  });

  it('returns the fallback when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(load('x', 1)).toBe(1);
  });

  it('ignores write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => save('x', 1)).not.toThrow();
  });

  it('removes keys', () => {
    save('gone', 1);
    remove('gone');
    expect(load('gone', null)).toBeNull();
  });

  it('ignores remove failures', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => remove('x')).not.toThrow();
  });
});

describe('storageWorks', () => {
  it('is true when saving works, and false when the browser refuses', async () => {
    const { storageWorks } = await import('./storage');
    expect(storageWorks()).toBe(true);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(storageWorks()).toBe(false);
    spy.mockRestore();
  });
});
