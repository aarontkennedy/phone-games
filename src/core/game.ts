/** A game module renders into a container and returns a cleanup function. */
export interface GameModule {
  mount(container: HTMLElement): () => void;
}

/** Rules for the game's How to play screen. Written for a first-time player. */
export interface HowToPlay {
  /** One sentence: how you win. */
  goal: string;
  /** How a turn works, in the order a new player needs it. */
  steps: string[];
  /** Optional strategy hints. */
  tips?: string[];
  /** Optional reference after the tips, as HTML, such as a strategy chart. */
  extra?: string;
}

/** Home screen groups, in the order they appear. Games are A to Z within a group. */
export const CATEGORIES = [
  { id: 'cards', title: 'Card games' },
  { id: 'puzzles', title: 'Puzzles' },
  { id: 'board', title: 'Board games' },
  { id: 'dice', title: 'Dice and tiles' },
] as const;

export type Category = (typeof CATEGORIES)[number]['id'];

/** Registry entry shown on the home screen. Games are lazy-loaded on open. */
export interface GameMeta {
  id: string;
  title: string;
  description: string;
  /** Inline flat SVG markup (see src/games/icons.ts). */
  icon: string;
  /** Which home screen group it's listed in. */
  category: Category;
  howToPlay: HowToPlay;
  load: () => Promise<GameModule>;
}
