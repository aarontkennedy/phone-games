// Builds src/core/words/enable.txt, the word list the word games check words against,
// from the ENABLE word list (public domain; see public/THIRD_PARTY_NOTICES.txt):
//
//   curl -L -o enable1.txt https://norvig.com/ngrams/enable1.txt
//   node scripts/make-words.mjs enable1.txt
//
// It keeps words of 3 to 8 letters (the most any of our games use), and drops the
// slurs, vulgar and sexual words in BLOCKED, so a game never offers or shows one.
// Ordinary words that merely start the same way (cockpit, spice, hello) stay.
import { readFileSync, writeFileSync } from 'node:fs';

export const MIN = 3;
export const MAX = 8;

/** Words never to offer or accept. Every form ENABLE lists is spelled out. */
export const BLOCKED = new Set(
  `
  fuck fucked fucker fuckers fucking fucks fuckup fuckups shit shits shitted shitting shitty shithead
  cunt cunts twat twats asshole assholes bitch bitched bitchery bitches bitchier bitchily bitching bitchy
  bastard bastards bastardy slut sluts sluttier sluttish slutty whore whored whoredom whores whoreson
  dildo dildoe dildoes dildos porn porno pornos porns porny pornier porniest tits titty boobs boobies boobie
  piss pissed pisser pissers pisses pissing pissant pissants cock cocks dick dicks pussy cum
  crap crapped crapper crappers crapping crappy damn damned damning damns damndest damneder damner damners
  turd turds orgasm orgasmic orgasms sodomy sodomies sodomist sodomite sodomize rape raped raper rapers rapes
  incest incests semen semens bugger buggered buggers buggery bollocks pimp pimped pimping pimps
  nigger niggers niggard niggards kike kikes spic spics spick spicks chink chinks chinky gook gooks gooky
  wetback wetbacks wop wops dago dagoes dagos coon coons darkie darkies kraut krauts
  fag fags fagged fagging faggot faggots faggoted faggotry faggoty faggy fagot fagots fagoted fagoter fagoters fagoting
  dyke dykes dyked dykey homo homos retard retarded retards gyp gyps gypped gypper gyppers gypping
  negroid negroids nazi nazis nazified nazifies nazify
`
    .trim()
    .split(/\s+/),
);

/** The kept words, in ENABLE's order. */
export function makeWords(source) {
  return source
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => /^[a-z]+$/.test(w) && w.length >= MIN && w.length <= MAX && !BLOCKED.has(w));
}

if (process.argv[1]?.endsWith('make-words.mjs')) {
  const [file] = process.argv.slice(2);
  if (!file) throw new Error('Usage: node scripts/make-words.mjs enable1.txt');
  const words = makeWords(readFileSync(file, 'utf8'));
  writeFileSync(new URL('../src/core/words/enable.txt', import.meta.url), `${words.join('\n')}\n`);
  console.log(`Wrote ${words.length} words.`);
}
