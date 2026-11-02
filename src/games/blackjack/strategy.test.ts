import { describe, expect, it } from 'vitest';
import { DECK_CHOICES, UPCARDS, bestPlay, changesText, chartFor, chartHtml } from './strategy';

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

  it('says in words what fewer decks change', () => {
    expect(changesText(2)).toBe('With 2 decks: double hard 9 against a 2; split 6s against a 7; split 7s against an 8.');
    expect(changesText(1)).toBe(
      'With 1 deck: double hard 8 against a 5 or 6; double hard 9 against a 2; double hard 11 against an ace; double A,2 against a 4; double A,3 against a 4; double A,6 against a 2; stand on A,7 against an ace; double A,8 against a 6; split 3s against an 8; split 4s against a 4; split 6s against a 7; split 7s against an 8.',
    );
  });

  it('draws the chart for the rules, with every row and a name for every square', () => {
    const table = document.createElement('div');
    table.innerHTML = chartHtml();
    const body = [...table.querySelectorAll('tbody tr')];
    const labels = body.map((r) => r.querySelector('th')!.textContent);
    expect(labels).toEqual([
      'Hard', '5–7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17+',
      'Soft', 'A,2', 'A,3', 'A,4', 'A,5', 'A,6', 'A,7', 'A,8', 'A,9',
      'Pairs', '2,2', '3,3', '4,4', '5,5', '6,6', '7,7', '8,8', '9,9', '10,10', 'A,A',
    ]);
    const row = (label: string) => [...body[labels.indexOf(label)].querySelectorAll('td')].map((td) => td.textContent);
    expect(row('11')).toEqual(['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H']);
    expect(row('A,7')).toEqual(['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H']);
    expect(row('9,9')).toEqual(['P', 'P', 'P', 'P', 'P', '', 'P', 'P', '', '']);
    expect(row('A,9').every((c) => c === 'S')).toBe(true);
    for (const td of table.querySelectorAll('tbody td')) expect(td.getAttribute('aria-label')).toMatch(/^(Hit|Stand|Double|Split|Play the total)$/);
    expect(table.textContent).toContain('With 1 deck:');
  });
});
