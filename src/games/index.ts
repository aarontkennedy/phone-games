import type { GameMeta } from '../core/game';
import { mineIcon, tilesIcon } from './icons';

// Add new games here. Each one is code-split and only loaded when opened.
// Titles must pass the naming rules in docs/LEGAL.md; icons must be flat SVG (docs/DESIGN.md).
export const games: GameMeta[] = [
  {
    id: '2048',
    title: '2048',
    description: 'Slide and merge tiles',
    icon: tilesIcon,
    load: () => import('./2048'),
  },
  {
    id: 'minesweeper',
    title: 'Mines',
    description: 'Clear the field without hitting a mine',
    icon: mineIcon,
    load: () => import('./minesweeper'),
  },
];
