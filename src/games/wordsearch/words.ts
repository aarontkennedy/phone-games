// Themed word lists for Word Search: each puzzle hides 8 words from one theme. Written for
// this app; keep them everyday, kind, and 9 letters or fewer (the grid is 10 across).
export const THEMES: Record<string, readonly string[]> = {
  Animals: ['tiger', 'zebra', 'monkey', 'giraffe', 'rabbit', 'turtle', 'donkey', 'beaver', 'kangaroo', 'panda', 'camel', 'otter', 'walrus', 'leopard'],
  Fruit: ['apple', 'banana', 'cherry', 'grape', 'lemon', 'mango', 'orange', 'peach', 'pear', 'plum', 'melon', 'papaya', 'apricot', 'kiwi'],
  Vegetables: ['carrot', 'potato', 'onion', 'pepper', 'celery', 'lettuce', 'spinach', 'radish', 'turnip', 'cabbage', 'pumpkin', 'squash', 'garlic', 'pea'],
  Weather: ['rain', 'snow', 'cloud', 'thunder', 'storm', 'breeze', 'sunny', 'frost', 'drizzle', 'rainbow', 'fog', 'hail', 'tornado', 'mist'],
  Kitchen: ['spoon', 'fork', 'knife', 'kettle', 'toaster', 'oven', 'teapot', 'plate', 'bowl', 'whisk', 'ladle', 'napkin', 'pantry', 'saucer'],
  Garden: ['flower', 'tulip', 'daisy', 'rose', 'shovel', 'hose', 'seeds', 'soil', 'weeds', 'bench', 'fence', 'pond', 'hedge', 'sprout'],
  Ocean: ['wave', 'shark', 'whale', 'coral', 'dolphin', 'octopus', 'crab', 'shell', 'tide', 'reef', 'seaweed', 'lobster', 'oyster', 'island'],
  Birds: ['robin', 'eagle', 'owl', 'parrot', 'sparrow', 'pigeon', 'swan', 'heron', 'falcon', 'penguin', 'crow', 'duck', 'pelican', 'goose'],
  Music: ['piano', 'violin', 'guitar', 'drum', 'flute', 'trumpet', 'banjo', 'harp', 'cello', 'song', 'choir', 'melody', 'rhythm', 'tuba'],
  Space: ['planet', 'star', 'moon', 'comet', 'rocket', 'galaxy', 'orbit', 'meteor', 'saturn', 'mars', 'venus', 'jupiter', 'nebula', 'sun'],
  Trees: ['oak', 'maple', 'willow', 'birch', 'cedar', 'pine', 'spruce', 'elm', 'aspen', 'walnut', 'cherry', 'palm', 'hickory', 'beech'],
  Sports: ['soccer', 'tennis', 'golf', 'hockey', 'rugby', 'cricket', 'bowling', 'skiing', 'rowing', 'boxing', 'cycling', 'archery', 'diving', 'sailing'],
};
