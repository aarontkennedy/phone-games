import { describe, expect, it } from 'vitest';
import { dieFace } from './dice-view';

describe('die faces', () => {
  it('draws as many pips as the number', () => {
    for (let n = 1; n <= 6; n++) expect(dieFace(n).match(/<circle/g)).toHaveLength(n);
  });
});
