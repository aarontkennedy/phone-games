// Promises made by index.html itself (docs/DESIGN.md), which no game test would notice
// going missing.
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

describe('index.html', () => {
  it('lets the player zoom in (pinch zoom is never turned off)', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)![1];
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('says what to do when JavaScript is off, in readable text', () => {
    const message = html.match(/<noscript>([\s\S]*?)<\/noscript>/)![1];
    expect(message).toContain('needs JavaScript');
    expect(message).toMatch(/font:\s*(\d+)px/);
    expect(Number(message.match(/font:\s*(\d+)px/)![1])).toBeGreaterThanOrEqual(18);
  });
});
