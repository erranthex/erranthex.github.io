# Mentaro Brain Gym

A free, private, science-based brain gym with 13 adaptive games and a full motivation system. It is one installable web app (PWA) that runs on Mac, Windows, iPhone, iPad and Android, and works offline.

Live once merged to the default branch: **https://erranthex.github.io/braingym/**

> "Mentaro" is a working name. "NeuroGym", the earlier name, is a registered US trademark (No. 5225722), so it can't be used. Clear the new name with a trademark search before launch. It is set as `BRAND` in `js/app.js`, the `<title>`, `manifest.webmanifest` and the legal pages.

## Exercises (13) and how each is scored

| Game | Skill | Research method | Skill Index (0–1000) is based on |
|---|---|---|---|
| Flash Field | Speed | UFOV speed-of-processing (Ball; ACTIVE) | Shortest exposure + clutter level reached |
| Rule Shift | Flexibility | Cued task switching (Rogers & Monsell; Karbach & Kray) | Switching level + switch cost (ms) |
| Arrow Storm | Attention | Flanker + go/no-go (Eriksen; Diamond) | Response window, interference cost, no-go accuracy |
| Orbit Tracker | Attention | Multiple-object tracking (Pylyshyn; Legault & Faubert) | Objects tracked × speed |
| Grid Recall | Memory | Corsi span forward/backward | Forward (40%) + backward (60%) span |
| Echo Grid | Memory | Dual n-back (Jaeggi) | Mean N weighted by d′ |
| Mind Palace | Memory | Method of loci + spaced retrieval (Dresler; Roediger & Karpicke) | Words recalled after a delay |
| Name Match | Memory | Face–name mnemonic training (Hampstead; Simon 2018) | Pairs recalled after a delay |
| Pathfinder | Memory | Route learning with map rotation (Lövdén 2012) | Longest route retraced |
| Pattern Logic | Reasoning | Matrix reasoning (RAVEN rules, I-RAVEN answers) | Hardest rule set solved |
| Word Forge | Language | Letter fluency / word puzzles (COG-IT 2022) | Points per minute |
| Number Sense | Math | Speeded arithmetic (Takeuchi 2011) | Problems solved + difficulty |
| Active Break | Body & mind | Cognitive–motor dual-task training | Not scored as a skill (XP + movement habit) |
| Check-up | Assessment | Untrained choice RT, backward digit span, Stroop | Transfer measure (monthly) |

The Brain Index is the mean of the domain scores. Each per-game skill is smoothed over sessions (EMA, α = 0.35). Anchors are task-defined rather than population norms, so the index tracks your own change. It is not an IQ score.

## Motivation system

- **XP and player levels.** Accuracy, perfect rounds, level-ups and personal bests all earn bonus XP.
- **Daily goal.** Choose 20, 50, 80 or 120 XP; a ring shows today's progress.
- **Streak with 2 built-in rest days per week.** Rest supports consolidation (Lampit 2014). Logging a brain habit also counts as an active day. Streak freezes, bought with gems, cover longer gaps.
- **Learning path.** Units of 6 nodes, with a treasure chest at node 3 and a unit challenge at node 6. Exercises unlock progressively.
- **Daily quests (3)** paying gems, plus **17 achievements**.
- **Weekly leagues.** 7 tiers; the top 3 are promoted. Rivals are clearly labelled AI until online leagues exist.
- **Shop.** Streak freezes and colour themes.
- **Mascot and celebrations.** Nuri the neuron, confetti, synthesized chimes, and streak and level-up screens.
- **Reminders.** A recurring calendar file (.ics) that needs no server or account.
- **Age-aware starting levels and comfort pacing.** After that, adaptive staircases take over.

## Copyright and IP notes

- **Original work.** All code, game designs, artwork, the mascot and the icons are original. Faces in Name Match are drawn procedurally, and vehicles are original SVGs.
- **Mechanics, not expression.** Mechanics come from public academic paradigms; no competitor screens, art, sounds or level designs are copied.
- **Word list.** `data/words.txt` is derived from *wordfreq* and licensed CC BY-SA 4.0; see `data/LICENSE-words.md`.
- **Health claims.** Copy describes what research found for each *method* and states that the app itself has not been clinically tested. There are no disease-prevention claims.
- **Before commercial launch:**
  - Clear the trademark.
  - Run a patent freedom-to-operate search (Posit Science and Lumos Labs hold training patents).
  - Move to a proprietary license. This repo is MIT.
  - Get a legal review of the privacy policy and terms.

## Development

There is no build step; the app is plain ES modules.

```bash
cd braingym && python3 -m http.server 8000      # http://localhost:8000
node --test tests/*.test.mjs                     # 23 unit tests: staircase, d′, SM-2, scheduler, matrices, XP, streak, quests, league, scoring
node tests/e2e.cjs                               # 92 Playwright checks: a bot plays all 13 games; onboarding, path, shop, quit, offline, phone layout
```

*Mentaro is a training tool, not a medical device.*
