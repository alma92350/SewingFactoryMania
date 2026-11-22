# SewingFactoryMania

A management game for desktop and mobile browsers, set in a 1990s Saigon garment factory. You start with six sewing machines in a family shophouse in 1992. By 1997 you run an export factory sewing for buyers in Korea, Japan, Hong Kong, Taiwan and mainland China: you win faxed orders, source fabric, balance sewing lines, pass the buyer's inspection and make the ship before the vessel leaves.

Inspired by [DataCenterMania](https://github.com/alma92350/DataCenterMania).

**Play it:** https://alma92350.github.io/SewingFactoryMania/ (every push runs the tests, builds, and publishes to the `gh-pages` branch)

- Product requirements, brainstorm and phased plan: [`docs/PRD.md`](docs/PRD.md)

## Current build: Phase 0 "Paper Pattern" (prototype)

One shift in Cô Mai's order of school shorts: a single sewing line of 7 machines (6 operations + a spare), 7 seamstresses, bundles flowing down the line, piles growing in front of the bottleneck, needle breakdowns you fix yourself, a learning curve per operation, and a placeholder "the line is the music" soundtrack.

Controls: tap a seamstress, then tap a machine to move her (tapping an occupied machine swaps them). Tap a machine to change its job, seat someone, or fix it. Keys: `Space` pause, `1` / `2` / `3` speed, `Esc` cancel. Add `?seed=N` to the URL to replay a specific day.

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
  data/    content and tuning as data (products, stations, workers, TUNING)
  sim/     pure deterministic simulation, no DOM
    sim.ts        step(): fixed 1-game-minute tick
    commands.ts   the only write path (assign, setOp, fix), validated
    selectors.ts  derived read-only queries (bottleneck, projection, efficiency)
    autopilot.ts  "competent player" bot used by the balance tests
  render/  layout math + Canvas 2D renderer (reads state, never writes)
  ui/      app shell, panels, tips, report, WebAudio rhythm engine
tests/     Vitest suites
e2e/       Playwright smoke test on the production build
```

- **The simulation is headless and deterministic.** Same seed and same commands give the same shift (tested).
- **Balance is a test.** The bot must pass ★ on every seed, doing nothing must fail, and ★★★ must not come free.
- **Pacing is a test.** A shift is 6–8 real minutes at 1×, and something visibly moves at least every 90 seconds.
