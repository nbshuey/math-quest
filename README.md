# Math Quest 🧮

A fun, interactive math practice web app for kids, built for **2nd** and **4th** grade.

## Features

- **Player profiles**: each kid gets a name, an avatar and a grade level.
- **Grade-matched quests** (10 questions per round):
  - **Grade 2** (11 topics): addition & subtraction within 100 (including word problems), place value, skip counting, comparing numbers, even & odd (partner dots), equal groups & arrays, counting coins, telling time (clock face, elapsed time), picture & bar graphs, shapes (sides, corners, halves/thirds/fourths)
  - **Grade 4** (15 topics): times tables to 12, multi-digit multiplication, division with remainders, multi-digit add & subtract (carrying, borrowing across zeros), factors, multiples & primes, equivalent fractions, comparing fractions (with fraction bars), adding & subtracting fractions, decimals (tenths & hundredths, with hundred grids), rounding, place value to millions, area & perimeter, measurement conversions, angles (acute/right/obtuse/straight, reading a two-scale protractor, missing angles), line plots (whole numbers, quarters and eighths of an inch)
  - **Mixed Challenge** for each grade
- **⚡ Speed Round**: answer as many quick facts as you can in 1 or 2 minutes (grade 2: add & subtract within 20, plus tens on Hard; grade 4: times tables, plus division facts on Hard). Answers check by themselves, a miss shows the right answer and keeps going, and missed facts come back more often until they're right. 1 coin per right answer, +5 for a new best, with bests kept per level and time.
- **Difficulty levels**: 🌱 Easy (warm-up), ⭐ Medium (on grade level) and 🔥 Hard (challenge). Harder levels pay more coins, and a perfect round offers to bump up a level.
- **🧭 Auto level**: each topic (and the Speed Round) keeps its own level. During a round it goes up after 3 first-try answers in a row and down after 2 misses in a row, with the buddy announcing the change. Coins and stars follow the level each question was at. The Speed Round levels up after a fast round (15+ a minute, 90% right) and down when under 70% are right. Kids pick it on the quest screen; grown-ups can switch it on the Grown-ups page and see each topic's current level.
- **👣 Step-by-step hints**: every question type has its own worked steps, shown one tap at a time ("Ones: 8 + 9 = 17. Write 7 and carry 1." → "Tens: 4 + 1 carried = ?"). The last step always leaves the final bit for the kid. Each step has a 🔊 button. Many steps come with a picture: adding and subtracting lined up in columns (with carried and borrowed digits), hops on a number line for counting on and skip counting, dot rows and area models for multiplying, a number line for rounding, and fraction bars and hundred grids for fractions and decimals.
- **Kid-friendly feedback**: the next hint step after the first miss, the answer shown after the second, and a review list at the end
- **Reasoning practice**:
  - **🧠 How do you know?**: on questions 3, 6 and 9 (or the next one answered right first try), kids pick the explanation that matches the thinking. Many come with a picture model: area models for multiplication, number lines for rounding, fraction bars. Right explanations earn bonus coins.
  - **🕵️ Fix the Mistake**: the buddy answers a question (sometimes right, often with a common mistake). Kids decide if the buddy is right, then pick the right thinking.
  - **🗣️ Tell your grown-up**: up to twice a round, after picking an explanation, kids explain it out loud using sentence starters ("First I…, then I…", "I can check it by…"). A grown-up taps ⭐ Great explaining (bonus coins) or 💪 Getting there; "No grown-up here right now" skips it for the round. Can be turned off on the Grown-ups page.
- **Reading help** (per player, in ✏️ Edit player):
  - **🔊 Read aloud**: every question, hint and explanation has a speaker button, and math is read as words ("3 eighths", "remainder 2"). Can also read every question automatically.
  - **🔤 Easy-reading text**: Lexend font, extra letter and line spacing, left-aligned word problems, a softer background and no floating decorations.
- **Buddy & shop**: each player has a buddy who cheers them on. Coins buy new buddies (wizard, dragon, unicorn, robot…), hats, and themes that restyle the whole app (Animal Jungle, Under the Sea, Wizard Tower, Dragon's Lair, Outer Space). Buying takes two taps to avoid accidents.
- **🌱 Growing buddies**: buddies grow with every coin earned together: 🍼 Baby → 🌱 Little (40) → 🌿 Big (120) → ✨ Super (260, sparkles) → 🌟 Legend (500, golden glow). Each buddy grows on its own, a progress bar on the quest screen shows the next stage, and growing up gets a celebration on the results screen. Spending coins never shrinks a buddy; older saves start the current buddy with credit for rounds already played.
- **Rewards**: up to 3 stars per quest and level, coins for first-try answers (×1 / ×2 / ×3 by level), streaks 🔥, confetti and sounds
- **👪 Grown-ups page** (button on the home screen, optional 4-digit PIN):
  - **Focus areas**: tick the topics a kid is struggling with. They show first with a ⭐ badge, pay bonus coins, and come up about 4× as often in Mixed Challenge and Fix the Mistake.
  - **Progress per topic**: how often they're right the first time and how many explanations they got, counted under the real topic even in mixed rounds. 🔎 flags topics under 70%, 🧠 flags trouble explaining, 💡 flags topics where they use hints on half the questions or more.
  - **Explaining**: optionally ask "How do you know?" after every right answer.
  - **Speed Round**: best scores and the facts to practice, plus a switch to hide the Speed Round if the clock is stressful.
  - **Weekly goal**: 3–10 quests a week, with a progress bar on the kid's screen and a bonus when it's reached.
  - **Note**: a short message the buddy shows on the quest screen ("Line up the places!").
  - **Recent quests**: the last 10 rounds with scores.
  - **📄 Weekly report**: one page per week (Sunday to Saturday), with ‹ Earlier / Later › to look back. It shows quests (against the weekly goal), days practiced, first-try % and the change from last week, questions, coins, a day-by-day strip, per-topic bars (Mixed rounds count under each real topic), what's going well, what's worth practicing (with a one-tap "Make it a focus area"), explaining, hints and Speed Round results, plus a few ideas for next week. 🖨️ Print uses a clean print layout, and you can also save it as a PDF from the print dialog.
  - Forgot the PIN? It's stored with the rest of the app's data; clearing this site's data in the browser resets it (and the kids' progress).
- On-screen number pad (tablet friendly) plus keyboard support
- Progress is saved in the browser (localStorage)

## Running it

No build step or dependencies. From this folder, run:

```bash
python3 serve.py
```

Then open http://localhost:8000. `serve.py` is a tiny static server that tells the browser to always check for newer files, so updates show up with a normal refresh. (`python3 -m http.server` works too, but the browser may keep old files after an update; press Cmd+Shift+R if the page is blank.)

Progress is saved per address, so keep using the same port (8000) to keep the kids' progress.

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

Write a generator in `js/problems.js` that takes a level (1–3) and returns `{ prompt, answer, hint, steps, why }` (plus optional `choices`, `visual`, `summary`, `spoken`, `mistake`), then add it to the grade's list in `TOPICS`. `why` is `{ right, wrong: [two wrong ideas], visual? }`, and `mistake` is a believable wrong answer for Fix the Mistake. `steps` is 2–5 short hints; the last one should leave the final step to the kid (end with "= ?" or a question).

### Adding shop items

Add an entry to `BUDDIES`, `HATS` or `THEMES` in `js/shop.js`. A new theme also needs a `body[data-theme='…']` block in `css/styles.css`.

## Ideas for later

