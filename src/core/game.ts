/** A game module renders into a container and returns a cleanup function. */
export interface GameModule {
  mount(container: HTMLElement): () => void;
}

/** Registry entry shown on the home screen. Games are lazy-loaded on open. */
export interface GameMeta {
  id: string;
  title: string;
  description: string;
  icon: string;
  load: () => Promise<GameModule>;
}
