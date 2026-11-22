// Everyday 7-letter words for Anagrams: each round's letters are one of these, shuffled.
// Written for this app; keep them common and kind. (The words you find are checked
// against the full word list, src/core/dictionary.ts.)
export const BASES: readonly string[] = `
balloon bedroom biscuit blanket blossom cabbage capital captain caramel carrots cartoon
catalog ceiling chapter charity cheetah chicken circles classic climate cottage cowboys
crystal cupcake curtain cushion daytime diamond dolphin drawing dynamic eastern elegant
explore fantasy farming feather fishing flowers forests freedom friends gallery garbage
general giraffe glasses gravity harmony harvest helping history holiday horizon
hunters imagine insects islands jackets journal journey jumping kitchen kittens lantern
laundry leaders lettuce library lobster machine magical mansion masters meadows minutes
monster morning mustard napkins natural neutral nothing numbers oatmeal octopus orchard
outside painter pancake parents parties peanuts pelican penguin perfect picture pirates
planets plastic popcorn posters pottery pretzel printer pudding puppets pyramid rainbow
raisins readers rescues respect riddles rockets rooster sailing saucers science seasons
seaweed shelter shingle singers skating sketchy slipper snowman spinach stadium station
stories strange student sunbeam sunrise surface teacher theater thunder tickets toaster
tornado tractor traffic trainer travels trumpet turkeys turtles twinkle unicorn
uniform vampire village vintage visitor volcano walnuts warrior weather wedding weekend
welcome western whisper winners wizards wonders workers writing
`
  .trim()
  .split(/\s+/);
