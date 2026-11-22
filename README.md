# SewingFactoryMania

A management game for desktop and mobile browsers, set in a 1990s Saigon garment factory. You start with six sewing machines in a family shophouse in 1992. By 1997 you run an export factory sewing for buyers in Korea, Japan, Hong Kong, Taiwan and mainland China: you win faxed orders, source fabric, balance sewing lines, pass the buyer's inspection and make the ship before the vessel leaves.

Inspired by [DataCenterMania](https://github.com/alma92350/DataCenterMania).

**Play it:** https://alma92350.github.io/SewingFactoryMania/ (every push runs the tests, builds, and publishes to the `gh-pages` branch)

- Product requirements, brainstorm and phased plan: [`docs/PRD.md`](docs/PRD.md)

## Current build: Part II "2002–2008"

Two campaigns: Part I, eight chapters from 1992 to 1997, and Part II, three chapters from 2002 to 2008, plus a Daily Challenge, an endless Sandbox with seasons, and a **scenario editor** whose creations you can share as a code or a link, and a community gallery of curated scenarios:

| Ch | Name | New systems |
|---|---|---|
| 0 | The Family Workshop (one-shift tutorial) | the line: assign, bundles, bottlenecks, breakdowns |
| 1 | The First Fax (6 shifts) | orders (faxes, quotes, vessel cut-off, overtime, money) and hiring |
| 2 | The Man with the Ruler (6 shifts) | quality (defects, QC table, AQL inspection, sample check) and mechanics |
| 3 | The Fabric Hunt (7 shifts) | sourcing (FOB orders, suppliers, shipments, fabric inspection) and the cutting table (marker) |
| 4 | Rain and Darkness (7 shifts) | power cuts, the generator and rain; two lines with line leaders |
| 5 | Before Tết (three lines) | morale, welfare, sick days, quits, the overtime cap, the 13th-month bonus, Tết and the return; mentoring |
| 6 | The Export Zone (four lines) | the production planner and the merchandiser (quote policy); padded jackets, yukata, baby wear; overflow orders |
| 7 | The Storm from the North (finale) | the 1997 crisis cancels most Korean work; new markets (Saigon, Europe via Hong Kong, Japanese uniforms); Má's advice on layoffs; the epilogue and the scrapbook |
| 8 | The American Order (2002) | US export quota (a price that moves every night) and the buyer's compliance audit |
| 9 | Two Cities (2005) | a second factory near Hà Nội: you are in one city at a time and fly between them |
| 10 | Our Own Label (2008) | your own brand: a collection, nightly shop sales, price and advertising; the Lehman shock |

Family choices (Má's machines, Uncle Sáu's letter, Út's future, Má's savings, the flood, the cat, Bác Tư's scissors, Tết at home, Út's return, Má's advice) change the game and the ending. 18 achievements, a career title, the factory scrapbook, and looks unlocked by stars (caps, the cat's collar, calendars, four original radio songs); an opt-in play log kept only on your device. Scenarios: choose lines, length, cash, the era (1990s, or 2007 with American buyers), the season (Tết, monsoon, Mid-Autumn, Christmas), the buyers, and invent up to two of your own. Four difficulty levels (the last, Ship Leaves Thursday, unlocks after Chapter 4), ★/★★/★★★ goals per chapter, autosave at every shift end, Handbook with Bác Tư's tips and a glossary, four micro-games, bottleneck and quality overlays, **English, Vietnamese and French**, an **e-ink mode** (`?eink=1`), works offline.

Controls: tap a seamstress, then tap a machine to move her (tapping an occupied machine swaps them). Tap a machine to change its job, seat someone, or fix it. Tabs: Line, Orders (overtime), Fabric (suppliers, warehouse), Team (hire, line leaders, welfare, mentors, office), Handbook. Keys: `Space` pause, `1` / `2` / `3` speed, `O` map overlay, line chips to switch lines when there are more than two, `Esc` cancel. Add `?seed=N` to the URL to replay a specific day.

## Develop

```bash
npm install
```

```bash
npm run dev        # local dev server
```

```bash
npm test           # simulation, line-math, balance and pacing tests (Vitest)
```

```bash
npm run build      # typecheck + production build into dist/
```

```bash
npm run e2e        # builds, plays the real game in Chromium (desktop + phone), then runs the axe-core audit
```

## Architecture

Same rules as DataCenterMania:

```
src/
  core/    seeded serializable RNG
  data/    content and tuning as data: products, buyers, chapters, people, difficulty, handbook, tuning, generated chapters
  sim/     pure deterministic simulation, no DOM
    sim.ts         step(): fixed 1-game-minute tick; endDay(); scripts and the day cycle
    production.ts  stations, defects, routing, the QC table
    orders.ts      faxes, changeovers, shipping, cut-off, inspection, decisions
    agents.ts      director and mechanics
    sourcing.ts    suppliers, shipments, rolls, inspection, cutting table
    power.ts       power cuts, generator, rain, flood
    leader.ts      line balancing shared by line leaders and the bot
    commands.ts    the only write path (assign, setOp, fix, decide, sample, hire, letGo, overtime, sleep)
    selectors.ts   derived read-only queries (bottleneck, projections, AQL plan)
    morale.ts      morale, welfare, sick days, quits, bonus, Tết, mentoring
    macro.ts       the 1997 shock, new markets, Má's advice and layoffs
    us.ts          US quota and compliance audits (Part II)
    sites.ts       two cities, the director's location and flights (Part II)
    brand.ts       your own label and its shops (Part II)
  data/scenario.ts scenarios, share codes, player-made buyers, seasons, the 2007 era
    office.ts      the planner and the merchandiser
    meta.ts        achievements, career title, Daily Challenge calibration
    objectives.ts  chapter stars
    autopilot.ts   "competent player" bot used by the balance tests
  render/  layout math + Canvas 2D renderer (reads state, never writes)
  ui/      app shell, views, micro-games, i18n (EN/VI translator + dictionary), storage, WebAudio rhythm engine
tests/     Vitest suites
e2e/       Playwright smoke test on the production build
```

- **The simulation is headless and deterministic.** Same seed and same commands give the same shift (tested).
- **Balance is a test.** In every chapter the bot must pass ★ on every seed, doing nothing must fail, and ★★★ must not come free.
- **Translation is a test.** A harvest of every string seen while the bot plays all chapters must be ≥ 99% covered in Vietnamese and in French.
- **Every difficulty is a test.** The bot must earn a star in every chapter on all four difficulties.
- **Accessibility is a test.** axe-core (WCAG 2.1 A/AA) must find nothing on 40 screens.
- **Shared scenarios are untrusted.** Codes are checksummed and every field is clamped; random scenarios are fuzz-tested for winnability.
- **Fair play is a test.** From Chapter 5, a bot that exploits its workers must not earn more stars than one that cares for them.
- **Progressive disclosure is data.** Chapters declare their systems; a test fails if a chapter adds more than two.
- **Pacing is a test.** A shift is 6–8 real minutes at 1×, and something visibly moves at least every 90 seconds.
