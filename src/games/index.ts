import type { GameMeta } from '../core/game';

// Add new games here. Each one is code-split and only loaded when opened.
export const games: GameMeta[] = [
  {
    id: '2048',
    title: '2048',
    description: 'Slide and merge tiles',
    icon: '🔢',
    load: () => import('./2048'),
  },
];
