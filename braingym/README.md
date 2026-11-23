# NeuroGym: an evidence-based brain gym

Live at **https://erranthex.github.io/braingym/** once this branch is merged and published to GitHub Pages.

A free, private, offline-capable web app (PWA) that runs on Mac, Windows, iPhone, iPad and Android from one codebase. You can install it to the home screen or dock. All data stays on the device, and you can export it as JSON from Settings.

## Exercises

| Exercise | Skill | Based on | Evidence for far transfer |
|---|---|---|---|
| ⚡ Flash Field | Processing speed | UFOV / ACTIVE speed training (Ball, Owsley, Edwards) | **Strongest.** ACTIVE 20-yr: −25% diagnosed dementia *with boosters* |
| 🔁 Echo Grid | Working memory | Dual n-back (Jaeggi et al. 2008) | Small/mixed (g≈0.24 → ~0 with active controls) |
| 🧩 Grid Recall | Visuospatial WM | Corsi span, forward + backward | Near transfer only |
| 🔀 Rule Shift | Flexibility | Cued task switching (Rogers & Monsell; Karbach & Kray 2009) | Moderate near transfer |
| 🎯 Arrow Storm | Attention / inhibition | Flanker + go/no-go (Eriksen; Diamond; Anguera 2013) | Limited |
| 🔷 Pattern Logic | Fluid reasoning | Procedural RAVEN rules + I-RAVEN balanced answers | Practice ≠ IQ |
| 🏛️ Mind Palace | Long-term memory | Method of loci (Dresler 2017) + SM-2 spaced retrieval | **Strong** for memory |
| ➗ Number Sense | Numeracy | Speeded arithmetic (Takeuchi 2011) | Domain-specific |
| 🩺 Check-up | *Assessment* | Untrained choice RT, backward digit span, Stroop | Measures transfer |

## How NeuroGym improves on Lumosity, Elevate and memoryOS

- **Psychophysical staircases** (Levitt 1971) in every game keep you at about 70–80% success, which is where "desirable difficulty" sits.
- **Mechanism metrics, not points.** You see switch cost, flanker interference, d′ and exposure threshold in ms.
- **An honest transfer check.** A monthly Check-up runs on tasks you never train.
- **Dosing from the evidence.** The app recommends 3–5 short sessions a week (Lampit 2014), and the daily plan rotates domains and resurfaces neglected skills, which works like booster sessions.
- **Frame-locked flashes and backward masking** make the speed task accurate on 60/120 Hz screens.
- **Unbiased reasoning puzzles.** Answer sets follow the I-RAVEN design, so the "pick the most common features" shortcut does not work.
- **Memory palace done properly.** A distractor interval comes before recall, each list is re-tested with SM-2 spacing, and answer matching tolerates typos.
- **Lifestyle habits** with stronger evidence than any game: exercise, sleep, learning new skills and social contact.
- **No overclaiming.** The app links the evidence grade and the references for every exercise.

## Development

No build step. These are plain ES modules.

```bash
cd braingym
python3 -m http.server 8000        # open http://localhost:8000
node --test tests/core.test.mjs    # unit tests: staircase, d′, SM-2, scheduler, matrix generator
node tests/e2e.cjs                 # Playwright: a bot plays every game; checks scoring, adaptivity, persistence, offline, phone layout
```

The research summary and full reference list are on the in-app **Science** tab (`js/science.js`).

*NeuroGym is a training tool, not a medical device.*
