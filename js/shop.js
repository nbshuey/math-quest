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
  { id: 'bunny', name: 'Clover', emoji: '🐰', price: 30, cheer: ['Hop-tastic!', 'Some-bunny is smart!'], oops: ['Hop to it, try again!'] },
  { id: 'penguin', name: 'Waddles', emoji: '🐧', price: 40, cheer: ['Ice job!', 'Cool as ice!'], oops: ['Slide back and try again!'] },
  { id: 'bee', name: 'Buzz', emoji: '🐝', price: 40, cheer: ['Bee-autiful!', 'You’re the bee’s knees!'], oops: ['Buzz back and try again!'] },
  { id: 'fox', name: 'Rusty', emoji: '🦊', price: 50, cheer: ['Fox-tastic!', 'Clever as a fox!'], oops: ['Sneak another look!'] },
  { id: 'koala', name: 'Gumnut', emoji: '🐨', price: 50, cheer: ['Koala-fied genius!', 'G’day, great job!'], oops: ['Hang on and try again!'] },
  { id: 'sloth', name: 'Snooze', emoji: '🦥', price: 55, cheer: ['Slow and steady, and right!', 'Sloth-tastic!'], oops: ['No rush. Try again!'] },
  { id: 'turtle', name: 'Shelly', emoji: '🐢', price: 55, cheer: ['Turtle-y awesome!', 'Shell yeah!'], oops: ['Take it slow and try again!'] },
  { id: 'octopus', name: 'Inky', emoji: '🐙', price: 70, cheer: ['Eight arms of applause!', 'Ink-credible!'], oops: ['Wiggle and try again!'] },
  { id: 'lion', name: 'Leo the Lion', emoji: '🦁', price: 80, cheer: ['ROAR-some!', 'King of math!'], oops: ['Even lions practice!'] },
  { id: 'shark', name: 'Finn', emoji: '🦈', price: 90, cheer: ['Fin-tastic!', 'Jaw-some!'], oops: ['Swim back and try again!'] },
  { id: 'ghost', name: 'Boo', emoji: '👻', price: 90, cheer: ['Boo-tiful!', 'Spook-tacular!'], oops: ['No scare, try again!'] },
  { id: 'alien', name: 'Zib', emoji: '👽', price: 110, cheer: ['Out of this world!', 'Beep! Earth math solved!'], oops: ['Recalibrating... try again!'] },
  { id: 'mermaid', name: 'Coral the Mermaid', emoji: '🧜', price: 120, cheer: ['Fin-tastic splash!', 'Shell-ebrate!'], oops: ['Dive back in!'] },
  { id: 'ninja', name: 'Shadow the Ninja', emoji: '🥷', price: 130, cheer: ['Hi-yah! Correct!', 'Ninja-level thinking!'], oops: ['Sneak back and try again!'] },
  { id: 'astronaut', name: 'Nova the Astronaut', emoji: '🧑‍🚀', price: 150, cheer: ['Blast off! Correct!', 'Stellar work!'], oops: ['Houston, let’s try again!'] },
  { id: 'hero', name: 'Captain Count', emoji: '🦸', price: 180, cheer: ['Super math powers!', 'Saved the day!'], oops: ['Every hero tries again!'] },
  { id: 'eagle', name: 'Blaze the Eagle', emoji: '🦅', price: 0, needs: 4, cheer: ['Soaring high!', 'Legendary!'], oops: ['Rise up and try again!'] },
];

export const HATS = [
  { id: 'none', name: 'No hat', emoji: '🚫', price: 0 },
  { id: 'flower', name: 'Flower', emoji: '🌸', price: 15 },
  { id: 'bow', name: 'Bow', emoji: '🎀', price: 20 },
  { id: 'cap', name: 'Ball cap', emoji: '🧢', price: 25 },
  { id: 'tophat', name: 'Top hat', emoji: '🎩', price: 35 },
  { id: 'grad', name: 'Smarty cap', emoji: '🎓', price: 50 },
  { id: 'crown', name: 'Crown', emoji: '👑', price: 80 },
  { id: 'sunhat', name: 'Sun hat', emoji: '👒', price: 30 },
  { id: 'helmet', name: 'Helmet', emoji: '⛑️', price: 40 },
  { id: 'cupcake', name: 'Cupcake hat', emoji: '🧁', price: 45 },
  { id: 'pumpkin', name: 'Pumpkin', emoji: '🎃', price: 45 },
  { id: 'icecream', name: 'Ice cream', emoji: '🍦', price: 55 },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈', price: 65 },
  { id: 'starclip', name: 'Star clip', emoji: '🌟', price: 0, needs: 3 },
];

// Things a buddy holds next to it.
export const EXTRAS = [
  { id: 'none', name: 'Nothing', emoji: '🚫', price: 0 },
  { id: 'balloon', name: 'Balloon', emoji: '🎈', price: 15 },
  { id: 'lollipop', name: 'Lollipop', emoji: '🍭', price: 20 },
  { id: 'sunflower', name: 'Sunflower', emoji: '🌻', price: 20 },
  { id: 'ball', name: 'Soccer ball', emoji: '⚽', price: 25 },
  { id: 'teddy', name: 'Teddy bear', emoji: '🧸', price: 35 },
  { id: 'books', name: 'Books', emoji: '📚', price: 40 },
  { id: 'pencil', name: 'Pencil', emoji: '✏️', price: 40 },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', price: 60 },
  { id: 'telescope', name: 'Telescope', emoji: '🔭', price: 70 },
  { id: 'skateboard', name: 'Skateboard', emoji: '🛹', price: 75 },
  { id: 'wand', name: 'Magic wand', emoji: '🪄', price: 90 },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', price: 120 },
  { id: 'gem', name: 'Giant gem', emoji: '💎', price: 0, needs: 2 },
  { id: 'trophy', name: 'Math trophy', emoji: '🏆', price: 0, needs: 4 },
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
  extras: { label: 'Extras', items: EXTRAS, slot: 'extra' },
  themes: { label: 'Themes', items: THEMES, slot: 'theme' },
};

// Items with `needs` can't be bought: they unlock for free once any buddy reaches that stage.
// Buddies grow as kids earn coins with them. `xp` is the coins needed for each stage.
export const STAGES = [
  { name: 'Baby', emoji: '🍼', xp: 0 },
  { name: 'Little', emoji: '🌱', xp: 40 },
  { name: 'Big', emoji: '🌿', xp: 120 },
  { name: 'Super', emoji: '✨', xp: 260 },
  { name: 'Legend', emoji: '🌟', xp: 500 },
];
export const stageFor = (xp) => STAGES.reduce((stage, s, i) => (xp >= s.xp ? i : stage), 0);
