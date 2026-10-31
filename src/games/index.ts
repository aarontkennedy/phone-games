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
    howToPlay: {
      goal: 'Join numbered tiles until you make a tile that says 2048.',
      steps: [
        'Swipe up, down, left or right anywhere on the board. <b>Every</b> tile slides as far as it can that way.',
        'When two tiles with the <b>same number</b> bump into each other, they join into one tile with the two numbers added: 2 and 2 make 4, 4 and 4 make 8, 8 and 8 make 16, and so on.',
        'Tiles with different numbers never join. They just stop next to each other.',
        'After every swipe, a new 2 (or sometimes a 4) appears in an empty square.',
        'Each time tiles join, the new number is added to your <b>Score</b>. <b>Best</b> is your highest score ever.',
        'The game is over when the board is full and no swipe can join anything. Tap <b>New</b> to start again at any time.',
        'Your game is saved after every swipe, so you can close the app and carry on later.',
      ],
      tips: [
        'Pick a corner and keep your biggest tile in it.',
        'Mostly swipe in just two directions, such as left and down. Use a third only when you have to, and avoid the fourth.',
        'Line up tiles from biggest to smallest along one edge, so they can join one after another.',
        'After you make 2048, you can keep going for a higher score.',
      ],
    },
    load: () => import('./2048'),
  },
  {
    id: 'minesweeper',
    title: 'Mines',
    description: 'Clear the field without hitting a mine',
    icon: mineIcon,
    howToPlay: {
      goal: 'Open every square that doesn’t hide a mine.',
      steps: [
        'Tap a square to open it. Your first tap is always safe.',
        'An open square with a number tells you how many mines touch it, counting the squares diagonally next to it too.',
        'An open square with no number has no mines around it, so its neighbors open by themselves.',
        'When you’re sure a square hides a mine, flag it: press and hold it, or switch the <b>Dig</b> button to <b>Flag</b> and tap it. Do the same again to remove a flag.',
        'Opening a mine ends the game. You win when every square without a mine is open.',
        '<b>Mines</b> shows how many mines are left to flag. <b>Time</b> counts the seconds. Choose <b>Easy</b>, <b>Medium</b> or <b>Hard</b> for a bigger board with more mines.',
      ],
      tips: [
        'If a 1 touches only one closed square, that square is a mine.',
        'Once a number already touches that many flags, its other closed neighbors are safe.',
        'Start in an open area and work outward from the numbers.',
      ],
    },
    load: () => import('./minesweeper'),
  },
];
