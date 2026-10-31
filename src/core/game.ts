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
}

/** Registry entry shown on the home screen. Games are lazy-loaded on open. */
export interface GameMeta {
  id: string;
  title: string;
  description: string;
  /** Inline flat SVG markup (see src/games/icons.ts). */
  icon: string;
  howToPlay: HowToPlay;
  load: () => Promise<GameModule>;
}
