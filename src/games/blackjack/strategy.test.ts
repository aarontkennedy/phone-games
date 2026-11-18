import { describe, expect, it } from 'vitest';
import { DECK_CHOICES, UPCARDS, bestPlay, chartFor, chartHtml } from './strategy';

// The full chart for each number of decks, from an exact calculation of each play's
// expected value for these rules (dealer stands on soft 17 and checks for blackjack,
// double after split, one split, split aces get one card, no surrender). Columns are the
// dealer's card, 2 to 10 then ace. H/S/Dh/Ds rows are hard (H5) and soft (S13) totals;
// P rows say whether to split a pair (P1 is aces). The calculation, for reference: each
// play's value is the chance-weighted result over every card that can come, with the
// cards already seen removed from the shoe, and the dealer's hole card not making blackjack.
const COMPUTED: Record<number, string> = {
  6: `
H5   H  H  H  H  H  H  H  H  H  H
H6   H  H  H  H  H  H  H  H  H  H
H7   H  H  H  H  H  H  H  H  H  H
H8   H  H  H  H  H  H  H  H  H  H
H9   H  Dh Dh Dh Dh H  H  H  H  H
H10  Dh Dh Dh Dh Dh Dh Dh Dh H  H
H11  Dh Dh Dh Dh Dh Dh Dh Dh Dh H
H12  H  H  S  S  S  H  H  H  H  H
H13  S  S  S  S  S  H  H  H  H  H
H14  S  S  S  S  S  H  H  H  H  H
H15  S  S  S  S  S  H  H  H  H  H
H16  S  S  S  S  S  H  H  H  H  H
H17  S  S  S  S  S  S  S  S  S  S
H18  S  S  S  S  S  S  S  S  S  S
H19  S  S  S  S  S  S  S  S  S  S
S13  H  H  H  Dh Dh H  H  H  H  H
S14  H  H  H  Dh Dh H  H  H  H  H
S15  H  H  Dh Dh Dh H  H  H  H  H
S16  H  H  Dh Dh Dh H  H  H  H  H
S17  H  Dh Dh Dh Dh H  H  H  H  H
S18  S  Ds Ds Ds Ds S  S  H  H  H
S19  S  S  S  S  S  S  S  S  S  S
S20  S  S  S  S  S  S  S  S  S  S
P2   P  P  P  P  P  P  -  -  -  -
P3   P  P  P  P  P  P  -  -  -  -
P4   -  -  -  P  P  -  -  -  -  -
P5   -  -  -  -  -  -  -  -  -  -
P6   P  P  P  P  P  -  -  -  -  -
P7   P  P  P  P  P  P  -  -  -  -
P8   P  P  P  P  P  P  P  P  P  P
P9   P  P  P  P  P  -  P  P  -  -
P10  -  -  -  -  -  -  -  -  -  -
P1   P  P  P  P  P  P  P  P  P  P
`,
  8: `
H5   H  H  H  H  H  H  H  H  H  H
H6   H  H  H  H  H  H  H  H  H  H
H7   H  H  H  H  H  H  H  H  H  H
H8   H  H  H  H  H  H  H  H  H  H
H9   H  Dh Dh Dh Dh H  H  H  H  H
H10  Dh Dh Dh Dh Dh Dh Dh Dh H  H
H11  Dh Dh Dh Dh Dh Dh Dh Dh Dh H
H12  H  H  S  S  S  H  H  H  H  H
H13  S  S  S  S  S  H  H  H  H  H
H14  S  S  S  S  S  H  H  H  H  H
H15  S  S  S  S  S  H  H  H  H  H
H16  S  S  S  S  S  H  H  H  H  H
H17  S  S  S  S  S  S  S  S  S  S
H18  S  S  S  S  S  S  S  S  S  S
H19  S  S  S  S  S  S  S  S  S  S
S13  H  H  H  Dh Dh H  H  H  H  H
S14  H  H  H  Dh Dh H  H  H  H  H
S15  H  H  Dh Dh Dh H  H  H  H  H
S16  H  H  Dh Dh Dh H  H  H  H  H
S17  H  Dh Dh Dh Dh H  H  H  H  H
S18  S  Ds Ds Ds Ds S  S  H  H  H
S19  S  S  S  S  S  S  S  S  S  S
S20  S  S  S  S  S  S  S  S  S  S
P2   P  P  P  P  P  P  -  -  -  -
P3   P  P  P  P  P  P  -  -  -  -
P4   -  -  -  P  P  -  -  -  -  -
P5   -  -  -  -  -  -  -  -  -  -
P6   P  P  P  P  P  -  -  -  -  -
P7   P  P  P  P  P  P  -  -  -  -
P8   P  P  P  P  P  P  P  P  P  P
P9   P  P  P  P  P  -  P  P  -  -
P10  -  -  -  -  -  -  -  -  -  -
P1   P  P  P  P  P  P  P  P  P  P
`,
  2: `
H5   H  H  H  H  H  H  H  H  H  H
H6   H  H  H  H  H  H  H  H  H  H
H7   H  H  H  H  H  H  H  H  H  H
H8   H  H  H  H  H  H  H  H  H  H
H9   Dh Dh Dh Dh Dh H  H  H  H  H
H10  Dh Dh Dh Dh Dh Dh Dh Dh H  H
H11  Dh Dh Dh Dh Dh Dh Dh Dh Dh H
H12  H  H  S  S  S  H  H  H  H  H
H13  S  S  S  S  S  H  H  H  H  H
H14  S  S  S  S  S  H  H  H  H  H
H15  S  S  S  S  S  H  H  H  H  H
H16  S  S  S  S  S  H  H  H  H  H
H17  S  S  S  S  S  S  S  S  S  S
H18  S  S  S  S  S  S  S  S  S  S
H19  S  S  S  S  S  S  S  S  S  S
S13  H  H  H  Dh Dh H  H  H  H  H
S14  H  H  H  Dh Dh H  H  H  H  H
S15  H  H  Dh Dh Dh H  H  H  H  H
S16  H  H  Dh Dh Dh H  H  H  H  H
S17  H  Dh Dh Dh Dh H  H  H  H  H
S18  S  Ds Ds Ds Ds S  S  H  H  H
S19  S  S  S  S  S  S  S  S  S  S
S20  S  S  S  S  S  S  S  S  S  S
P2   P  P  P  P  P  P  -  -  -  -
P3   P  P  P  P  P  P  -  -  -  -
P4   -  -  -  P  P  -  -  -  -  -
P5   -  -  -  -  -  -  -  -  -  -
P6   P  P  P  P  P  P  -  -  -  -
P7   P  P  P  P  P  P  P  -  -  -
P8   P  P  P  P  P  P  P  P  P  P
P9   P  P  P  P  P  -  P  P  -  -
P10  -  -  -  -  -  -  -  -  -  -
P1   P  P  P  P  P  P  P  P  P  P
`,
  1: `
H5   H  H  H  H  H  H  H  H  H  H
H6   H  H  H  H  H  H  H  H  H  H
H7   H  H  H  H  H  H  H  H  H  H
H8   H  H  H  Dh Dh H  H  H  H  H
H9   Dh Dh Dh Dh Dh H  H  H  H  H
H10  Dh Dh Dh Dh Dh Dh Dh Dh H  H
H11  Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh
H12  H  H  S  S  S  H  H  H  H  H
H13  S  S  S  S  S  H  H  H  H  H
H14  S  S  S  S  S  H  H  H  H  H
H15  S  S  S  S  S  H  H  H  H  H
H16  S  S  S  S  S  H  H  H  H  H
H17  S  S  S  S  S  S  S  S  S  S
H18  S  S  S  S  S  S  S  S  S  S
H19  S  S  S  S  S  S  S  S  S  S
S13  H  H  Dh Dh Dh H  H  H  H  H
S14  H  H  Dh Dh Dh H  H  H  H  H
S15  H  H  Dh Dh Dh H  H  H  H  H
S16  H  H  Dh Dh Dh H  H  H  H  H
S17  Dh Dh Dh Dh Dh H  H  H  H  H
S18  S  Ds Ds Ds Ds S  S  H  H  S
S19  S  S  S  S  Ds S  S  S  S  S
S20  S  S  S  S  S  S  S  S  S  S
P2   P  P  P  P  P  P  -  -  -  -
P3   P  P  P  P  P  P  P  -  -  -
P4   -  -  P  P  P  -  -  -  -  -
P5   -  -  -  -  -  -  -  -  -  -
P6   P  P  P  P  P  P  -  -  -  -
P7   P  P  P  P  P  P  P  -  -  -
P8   P  P  P  P  P  P  P  P  P  P
P9   P  P  P  P  P  -  P  P  -  -
P10  -  -  -  -  -  -  -  -  -  -
P1   P  P  P  P  P  P  P  P  P  P
`,
};

function rows(text: string) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const [key, ...cells] = line.trim().split(/\s+/);
      return { kind: key[0], n: Number(key.slice(1)), cells };
    });
}

describe('basic strategy', () => {
  it.each(DECK_CHOICES.map((d) => [d]))('matches the exact calculation for %i deck(s), square by square', (decks) => {
    for (const { kind, n, cells } of rows(COMPUTED[decks])) {
      UPCARDS.forEach((up, i) => {
        const where = `${kind}${n} vs ${up}`;
        if (kind === 'P') {
          const pair = n === 1 ? 11 : n;
          expect(bestPlay(decks, pair === 11 ? 12 : 2 * pair, pair === 11, up, pair) === 'P', where).toBe(cells[i] === 'P');
        } else {
          expect(bestPlay(decks, n, kind === 'S', up), where).toBe(cells[i]);
        }
      });
    }
  });

  it('plays hands off the chart sensibly', () => {
    expect(bestPlay(6, 4, false, 6)).toBe('H'); // two 2s you can't split
    expect(bestPlay(6, 12, true, 6)).toBe('H'); // two aces you can't split
    expect(bestPlay(6, 21, true, 10)).toBe('S');
    expect(bestPlay(6, 20, false, 11)).toBe('S');
  });

  it('shares one chart between 6 and 8 decks', () => {
    expect(chartFor(8)).toBe(chartFor(6));
  });

  it('draws a titled chart for each number of decks, with every row and a name for every square', () => {
    const page = document.createElement('div');
    page.innerHTML = chartHtml();
    expect([...page.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Best plays: 6 or 8 decks', 'Best plays: 2 decks', 'Best plays: 1 deck',
    ]);
    const tables = [...page.querySelectorAll('table')];
    expect(tables).toHaveLength(3);
    // Each title sits right above its table.
    for (const t of tables) expect(t.previousElementSibling!.tagName).toBe('H3');
    const rows = (table: Element) => [...table.querySelectorAll('tbody tr')];
    const labels = (table: Element) => rows(table).map((r) => r.querySelector('th')!.textContent);
    const row = (table: Element, label: string) =>
      [...rows(table)[labels(table).indexOf(label)].querySelectorAll('td')].map((td) => td.textContent);
    const [shoe, two, one] = tables;
    for (const t of tables) {
      expect(labels(t)).toEqual([
        'Hard', '5–7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17+',
        'Soft', 'A,2', 'A,3', 'A,4', 'A,5', 'A,6', 'A,7', 'A,8', 'A,9',
        'Pairs', '2,2', '3,3', '4,4', '5,5', '6,6', '7,7', '8,8', '9,9', '10,10', 'A,A',
      ]);
      expect(row(t, 'A,9').every((c) => c === 'S')).toBe(true);
    }
    expect(row(shoe, '11')).toEqual(['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H']);
    expect(row(shoe, 'A,7')).toEqual(['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H']);
    expect(row(shoe, '9,9')).toEqual(['P', 'P', 'P', 'P', 'P', '', 'P', 'P', '', '']);
    expect(row(shoe, '9')[0]).toBe('H');
    expect(row(two, '9')[0]).toBe('D');
    expect(row(two, '11')[9]).toBe('H');
    expect(row(one, '11')[9]).toBe('D');
    expect(row(one, 'A,7')[9]).toBe('S');
    for (const td of page.querySelectorAll('tbody td')) expect(td.getAttribute('aria-label')).toMatch(/^(Hit|Stand|Double|Split|Play the total)$/);
    expect(page.textContent).not.toContain('With 1 deck:');
  });
});
