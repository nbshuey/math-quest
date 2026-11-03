# Math Quest 🧮

A fun, interactive math practice web app for kids, built for **2nd** and **4th** grade.

## Features

- **Player profiles**: each kid gets a name, an avatar and a grade level.
- **Grade-matched quests** (10 questions per round):
  - **Grade 2**: addition & subtraction within 100 (including word problems), place value, skip counting, comparing numbers, counting coins
  - **Grade 4**: times tables to 12, multi-digit multiplication, division with remainders, equivalent fractions, comparing fractions (with fraction bars), rounding, place value to hundred-thousands
  - **Mixed Challenge** for each grade
- **Difficulty levels**: 🌱 Easy (warm-up), ⭐ Medium (on grade level) and 🔥 Hard (challenge). Harder levels pay more coins, and a perfect round offers to bump up a level.
- **Kid-friendly feedback**: a hint after the first miss, the answer shown after the second, and a review list at the end
- **Reasoning practice**:
  - **🧠 How do you know?**: on questions 3, 6 and 9 (or the next one answered right first try), kids pick the explanation that matches the thinking. Many come with a picture model: area models for multiplication, number lines for rounding, fraction bars. Right explanations earn bonus coins.
  - **🕵️ Fix the Mistake**: the buddy answers a question (sometimes right, often with a common mistake). Kids decide if the buddy is right, then pick the right thinking.
- **Reading help** (per player, in ✏️ Edit player):
  - **🔊 Read aloud**: every question, hint and explanation has a speaker button, and math is read as words ("3 eighths", "remainder 2"). Can also read every question automatically.
  - **🔤 Easy-reading text**: Lexend font, extra letter and line spacing, left-aligned word problems, a softer background and no floating decorations.
- **Buddy & shop**: each player has a buddy who cheers them on. Coins buy new buddies (wizard, dragon, unicorn, robot…), hats, and themes that restyle the whole app (Animal Jungle, Under the Sea, Wizard Tower, Dragon's Lair, Outer Space). Buying takes two taps to avoid accidents.
- **Rewards**: up to 3 stars per quest and level, coins for first-try answers (×1 / ×2 / ×3 by level), streaks 🔥, confetti and sounds
- On-screen number pad (tablet friendly) plus keyboard support
- Progress is saved in the browser (localStorage)

## Running it

No build step or dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Project layout

```
index.html        page shell
css/styles.css    all styling
js/app.js         screens, game loop, keyboard handling
js/problems.js    problem generators per grade and level (add new topics here)
js/shop.js        buddies, hats and themes with their prices
js/speech.js      read-aloud, turning math symbols into spoken words
js/storage.js     saving profiles & progress
js/effects.js     confetti and sound effects
```

### Adding a topic

Write a generator in `js/problems.js` that takes a level (1–3) and returns `{ prompt, answer, hint, why }` (plus optional `choices`, `visual`, `summary`, `mistake`), then add it to the grade's list in `TOPICS`. `why` is `{ right, wrong: [two wrong ideas], visual? }`, and `mistake` is a believable wrong answer for Fix the Mistake.

### Adding shop items

Add an entry to `BUDDIES`, `HATS` or `THEMES` in `js/shop.js`. A new theme also needs a `body[data-theme='…']` block in `css/styles.css`.

## Ideas for later

- Telling time (grade 2) and area & perimeter / angles (grade 4)
- Timed "speed round" for times tables
- Buddies that grow or evolve as kids earn stars
- Step-by-step picture hints (tap through an area model or number line)
- "Tell your grown-up" prompts to explain answers out loud, with sentence starters
- Parent goals page tracking specific learning goals and which topics need practice
- Adaptive difficulty based on recent answers
