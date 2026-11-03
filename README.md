# Math Quest 🧮

A fun, interactive math practice web app for kids, built for **2nd** and **4th** grade.

## Features

- **Player profiles**: each kid gets a name, an avatar and a grade level.
- **Grade-matched quests** (10 questions per round):
  - **Grade 2**: addition & subtraction within 100 (including word problems), place value, skip counting, comparing numbers, counting coins
  - **Grade 4**: times tables to 12, multi-digit multiplication, division with remainders, equivalent fractions, comparing fractions (with fraction bars), rounding, place value to hundred-thousands
  - **Mixed Challenge** for each grade
- **Kid-friendly feedback**: a hint after the first miss, the answer shown after the second, and a review list at the end
- **Rewards**: up to 3 stars per quest, coins for first-try answers, streaks 🔥, confetti and sounds
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
js/problems.js    problem generators per grade (add new topics here)
js/storage.js     saving profiles & progress
js/effects.js     confetti and sound effects
```

### Adding a topic

Write a generator in `js/problems.js` that returns `{ prompt, answer, hint }` (plus optional `choices`, `visual`, `summary`), then add it to the grade's list in `TOPICS`.

## Ideas for later

- Telling time (grade 2) and area & perimeter / angles (grade 4)
- Timed "speed round" for times tables
- A shop to spend coins on avatars or themes
- Parent dashboard showing which topics need practice
- Adaptive difficulty based on recent answers
