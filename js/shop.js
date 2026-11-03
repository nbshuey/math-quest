// Everything kids can spend coins on. Items with price 0 are free for everyone.

export const BUDDIES = [
  { id: 'cat', name: 'Whiskers', emoji: '🐱', price: 0, cheer: ['Purr-fect!', 'Meow-velous!'], oops: ['Paws and think!'] },
  { id: 'puppy', name: 'Biscuit', emoji: '🐶', price: 0, cheer: ['Woof! Good job!', 'Pawsome!'], oops: ['Sniff it out again!'] },
  { id: 'owl', name: 'Hoot', emoji: '🦉', price: 0, cheer: ['Whoo-hoo! So wise!', 'Hoot hoot, hooray!'], oops: ['Whooo needs a hint? Try again!'] },
  { id: 'frog', name: 'Hopper', emoji: '🐸', price: 40, cheer: ['Ribbit! Right!', 'Toad-ally awesome!'], oops: ['Hop back and try again!'] },
  { id: 'panda', name: 'Bamboo', emoji: '🐼', price: 40, cheer: ['Panda-tastic!', 'Bear-y good!'], oops: ['No worries, try again!'] },
  { id: 'unicorn', name: 'Sparkle', emoji: '🦄', price: 80, cheer: ['Magical!', 'Sparkly smart!'], oops: ['Sprinkle some thinking on it!'] },
  { id: 'fairy', name: 'Pip the Fairy', emoji: '🧚', price: 90, cheer: ['Fairy-tastic!', 'You shine bright!'], oops: ['A little more pixie power!'] },
  { id: 'wizard', name: 'Merlo the Wizard', emoji: '🧙', price: 110, cheer: ['Abracadabra, correct!', 'Spell-tacular!'], oops: ['Even wizards practice. Try again!'] },
  { id: 'dino', name: 'Rex', emoji: '🦖', price: 120, cheer: ['ROAR-some!', 'Dino-mite!'], oops: ['Stomp and try again!'] },
  { id: 'robot', name: 'Bolt', emoji: '🤖', price: 120, cheer: ['Beep boop! Correct!', 'Math circuits: ON!'], oops: ['Recalculating... try again!'] },
  { id: 'dragon', name: 'Ember the Dragon', emoji: '🐉', price: 150, cheer: ['ROAR! On fire!', 'Dragon-sized brain!'], oops: ['Breathe a little fire and try again!'] },
];

export const HATS = [
  { id: 'none', name: 'No hat', emoji: '🚫', price: 0 },
  { id: 'flower', name: 'Flower', emoji: '🌸', price: 15 },
  { id: 'bow', name: 'Bow', emoji: '🎀', price: 20 },
  { id: 'cap', name: 'Ball cap', emoji: '🧢', price: 25 },
  { id: 'tophat', name: 'Top hat', emoji: '🎩', price: 35 },
  { id: 'grad', name: 'Smarty cap', emoji: '🎓', price: 50 },
  { id: 'crown', name: 'Crown', emoji: '👑', price: 80 },
];

export const THEMES = [
  { id: 'sunny', name: 'Sunny Day', emoji: '☀️', price: 0, decor: ['☁️', '🌈', '☀️', '🎈'], swatch: 'linear-gradient(135deg,#ffe3f1,#fff7e8,#dff6ff)' },
  { id: 'jungle', name: 'Animal Jungle', emoji: '🌴', price: 60, decor: ['🐒', '🦜', '🌴', '🐘', '🦓', '🍃'], swatch: 'linear-gradient(135deg,#d3f9d8,#b2f2bb,#8ce99a)' },
  { id: 'ocean', name: 'Under the Sea', emoji: '🐠', price: 60, decor: ['🐠', '🐙', '🐚', '🫧', '🐳', '🦀'], swatch: 'linear-gradient(135deg,#d0ebff,#a5d8ff,#74c0fc)' },
  { id: 'wizard', name: 'Wizard Tower', emoji: '🔮', price: 100, decor: ['✨', '🔮', '🌙', '⭐', '📜', '🪄'], swatch: 'linear-gradient(135deg,#3b2a7a,#1d1442)' },
  { id: 'dragon', name: "Dragon's Lair", emoji: '🌋', price: 120, decor: ['🔥', '🐉', '💎', '🏰', '🌋', '🛡️'], swatch: 'linear-gradient(135deg,#7a1f0f,#3b0d0d)' },
  { id: 'space', name: 'Outer Space', emoji: '🚀', price: 150, decor: ['🪐', '⭐', '🚀', '🌙', '☄️', '👽'], swatch: 'linear-gradient(135deg,#1b2a5c,#0b1026)' },
];

export const CATALOG = {
  buddies: { label: 'Buddies', items: BUDDIES, slot: 'buddy' },
  hats: { label: 'Hats', items: HATS, slot: 'hat' },
  themes: { label: 'Themes', items: THEMES, slot: 'theme' },
};
