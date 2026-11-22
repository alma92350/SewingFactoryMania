# SewingFactoryMania

A management game for desktop and mobile browsers, set in a 1990s Saigon garment factory. You start with six sewing machines in a family shophouse in 1992. By 1997 you run an export factory sewing for buyers in Korea, Japan, Hong Kong, Taiwan and mainland China: you win faxed orders, source fabric, balance sewing lines, pass the buyer's inspection and make the ship before the vessel leaves.

Inspired by [DataCenterMania](https://github.com/alma92350/DataCenterMania).

**Play it:** https://alma92350.github.io/SewingFactoryMania/ (every push runs the tests, builds, and publishes to the `gh-pages` branch)

- Product requirements, brainstorm and phased plan: [`docs/PRD.md`](docs/PRD.md)

## Current build: Phase 1 "The Family Workshop"

Three chapters, 1992–1993:

| Ch | Name | New systems |
|---|---|---|
| 0 | The Family Workshop (one-shift tutorial) | the line: assign, bundles, bottlenecks, breakdowns |
| 1 | The First Fax (6 shifts) | orders (faxes, quotes, vessel cut-off, overtime, money) and hiring |
| 2 | The Man with the Ruler (6 shifts) | quality (defects, QC table, AQL inspection, sample check) and mechanics |

Family choices (Má's machines, Uncle Sáu's letter, Út's future) change later chapters. Three difficulty levels, ★/★★/★★★ goals per chapter, autosave at every shift end, Handbook with Bác Tư's tips and a glossary, works offline.

Controls: tap a seamstress, then tap a machine to move her (tapping an occupied machine swaps them). Tap a machine to change its job, seat someone, or fix it. Tabs: Line, Orders (overtime), Team (hire), Handbook. Keys: `Space` pause, `1` / `2` / `3` speed, `Esc` cancel. Add `?seed=N` to the URL to replay a specific day.

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
npm run e2e        # builds, then plays the real game in Chromium (desktop + phone)
```

## Architecture

Same rules as DataCenterMania:

```
src/
  core/    seeded serializable RNG
  data/    content and tuning as data: products, buyers, chapters, people, difficulty, handbook, tuning
  sim/     pure deterministic simulation, no DOM
    sim.ts         step(): fixed 1-game-minute tick; endDay(); scripts and the day cycle
    production.ts  stations, defects, routing, the QC table
    orders.ts      faxes, changeovers, shipping, cut-off, inspection, decisions
    agents.ts      director and mechanics
    commands.ts    the only write path (assign, setOp, fix, decide, sample, hire, letGo, overtime, sleep)
    selectors.ts   derived read-only queries (bottleneck, projections, AQL plan)
    objectives.ts  chapter stars
    autopilot.ts   "competent player" bot used by the balance tests
  render/  layout math + Canvas 2D renderer (reads state, never writes)
  ui/      app shell, views, Spot the Defect, storage, WebAudio rhythm engine
tests/     Vitest suites
e2e/       Playwright smoke test on the production build
```

- **The simulation is headless and deterministic.** Same seed and same commands give the same shift (tested).
- **Balance is a test.** In every chapter the bot must pass ★ on every seed, doing nothing must fail, and ★★★ must not come free.
- **Progressive disclosure is data.** Chapters declare their systems; a test fails if a chapter adds more than two.
- **Pacing is a test.** A shift is 6–8 real minutes at 1×, and something visibly moves at least every 90 seconds.
