import type { GameMeta } from '../core/game';
import { cardsIcon, chipIcon, heartIcon, mineIcon, tilesIcon } from './icons';

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
  {
    id: 'solitaire',
    title: 'Solitaire',
    description: 'Sort the deck into four suit piles',
    icon: cardsIcon,
    howToPlay: {
      goal: 'Move all 52 cards onto the four piles at the top right, one pile per suit, from ace up to king.',
      steps: [
        'The seven columns are the main play area. Only the face-up cards can be moved.',
        'In a column, you can put a card on one that is <b>one higher</b> and the <b>other color</b>: a red 6 on a black 7, a black 9 on a red 10.',
        'To move several face-up cards together, tap the highest card of the group you want to move. The cards below it come along.',
        'When you move the last face-up card off a column, the face-down card under it turns over.',
        'Only a <b>king</b> (or a run starting with a king) can go in an empty column.',
        'Tap the <b>deck</b> at the top left to turn over cards. When it runs out, tap the empty space to turn them all back over.',
        'Aces start the piles at the top right. Then add the 2, 3 and so on of the same suit.',
        '<b>Tap a card to move it.</b> It goes to the best place it can: its suit pile first, then a column.',
        'Made a mistake? Tap <b>Undo</b>. Your game is saved after every move.',
      ],
      tips: [
        '<b>Draw 1</b> turns over one card at a time and is easier. <b>Draw 3</b> turns over three, and you can only play the top one.',
        'Turning over face-down cards in the columns matters most. Work on the longest columns first.',
        'Don\'t empty a column unless you have a king ready to move into it.',
        'Once every card is face up, the game finishes itself.',
      ],
    },
    load: () => import('./solitaire'),
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    description: 'Get closer to 21 than the dealer',
    icon: chipIcon,
    howToPlay: {
      goal: 'Finish with a hand closer to 21 than the dealer’s, without going over 21.',
      steps: [
        'Cards 2 to 10 count their number. Jacks, queens and kings count 10. An ace counts 11, or 1 if 11 would take you over 21. A hand with an ace counting 11 is called <b>soft</b>.',
        'Choose a bet (10, 20, 50 or 100 chips) and tap <b>Deal</b>. You and the dealer each get two cards. One of the dealer’s cards stays face down.',
        'An ace with a 10, jack, queen or king is a <b>blackjack</b>. It wins at once and pays 3 to 2 (a 20 bet wins 30), unless the dealer has one too.',
        '<b>Hit</b> to take another card. <b>Stand</b> to keep your total. Go over 21 and you <b>bust</b>: you lose straight away.',
        '<b>Double</b> on your first two cards to double your bet and take exactly one more card.',
        '<b>Split</b> two cards of the same value into two hands, with a second bet. You play them one after the other. Split aces get one card each.',
        'When you’re done, the dealer turns over the face-down card and must take cards until reaching 17 or more.',
        'You win if the dealer busts or you’re closer to 21. A win pays even money (a 20 bet wins 20). A tie is a <b>push</b>: your bet comes back.',
        'These are play chips, not money. If you run out, tap <b>Start over</b> for 1000 more. <b>Best</b> is the most chips you’ve ever had.',
      ],
      tips: [
        'Turn on <b>Hints</b> and the line under the table tells you the best play for every hand.',
        'Always split aces and eights. Never split tens or fives.',
        'Stand on 12 to 16 when the dealer shows 2 to 6 (the dealer is likely to bust), and hit when the dealer shows 7 or higher.',
        'Double on 11 unless the dealer shows an ace.',
      ],
    },
    load: () => import('./blackjack'),
  },
  {
    id: 'hearts',
    title: 'Hearts',
    description: 'Avoid hearts and the queen of spades',
    icon: heartIcon,
    howToPlay: {
      goal: 'Take as few points as you can. When anyone reaches 100 points, the game ends and the lowest score wins.',
      steps: [
        'You play against three computer players: West, North and East. Everyone gets 13 cards.',
        'First, pick 3 cards to pass, then tap <b>Pass</b>. The direction changes each round: left, right, across, then no passing.',
        'Whoever has the 2 of clubs plays it to start. Then everyone plays one card in turn. That’s a <b>trick</b>.',
        'You must play the same suit as the first card of the trick if you can. If you can’t, play anything.',
        'The highest card of the suit that was led wins the trick. Aces are high. The winner starts the next trick.',
        'Every heart you win is <b>1 point</b>. The queen of spades is <b>13 points</b>. Points are bad!',
        'You can’t start a trick with a heart until someone has played a heart. And nobody can play points on the very first trick.',
        'Win <b>all</b> the hearts and the queen of spades and you <b>shoot the moon</b>: you get 0 and everyone else gets 26.',
        'Cards you can play right now sit a little higher. Tap one to play it.',
      ],
      tips: [
        '<b>Easy</b> computer players play almost at random. <b>Strong</b> ones dodge points and remember what’s been played. You can switch at any time.',
        'Pass the queen of spades, and the ace and king of spades unless you have plenty of low spades to protect them.',
        'Try to run out of a suit early. Then you can throw away hearts or the queen when that suit is led.',
        'When you can’t win a trick safely, play the highest card that still loses.',
      ],
    },
    load: () => import('./hearts'),
  },
];
