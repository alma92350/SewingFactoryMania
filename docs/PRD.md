# SewingFactoryMania — Product Requirements Document (v0.1, phased)

*Status: draft v0.2 (open questions 1, 7, 8 decided: D13–D15) · Date: 2026-11-22 · Inspired by [DataCenterMania](https://github.com/alma92350/DataCenterMania) (its PRD v0.2, PRD v2.0 and product review).*

> A management game for the browser (desktop and mobile). It is **1992 in Saigon**. You inherit a family workshop of six sewing machines in a shophouse, and by 1997 you run an export factory in an industrial zone, sewing shirts, jeans, padded jackets and yukata for buyers in **Korea, Japan, Hong Kong, Taiwan and mainland China**. You win faxed orders, source fabric and trims, balance sewing lines, pass the buyer's inspection and make the ship before the vessel leaves. Mostly by putting the right worker on the right machine at the right moment.

---

## How this document was made

DataCenterMania (DCM) is a shipped browser game with a strong, tested foundation: a deterministic headless simulation, one write path for commands, progressive disclosure through chapters, an autopilot bot that fails CI when pacing breaks, an e-ink mode, and a phased release plan with exit criteria. Its product review also taught some hard lessons: dead air, chapters too long for a phone session, too many systems in one chapter, money that is invisible, and ★★★ that comes for free.

We ran a brainstorm with six fictional personas, each bringing a view the game must respect:

| Persona | Role | Brings |
|---|---|---|
| **Chị Lan** (Nguyễn Thị Lan) | Senior seamstress, 14 years on the line, started at a state garment cooperative | What the work feels like, what makes a good or bad day, what workers talk about |
| **Anh Hùng** (Trần Văn Hùng) | Machine mechanic and line leader | Breakdowns, needles, line balancing on the floor, the 1990s machines |
| **Bà Hà** (Phạm Thu Hà) | Factory director; moved a state-owned factory into a joint venture in 1993 | Orders, buyers, cash, deadlines, the business of CMT vs FOB |
| **Chị Thư** (Vũ Minh Thư) | Merchandiser, speaks Korean and some Japanese, lives on the fax machine | Buyer personalities, samples, inspections, sourcing |
| **Sofia** | Lead game designer | Loops, pacing, fun, systems that interact |
| **Ngọc** (Huỳnh Bảo Ngọc) | Art director / graphic designer | Look, readability, period detail without clichés |
| **Camille** | Game product manager (from DCM) | Facilitator. Session fit on a phone, scope, phases, lessons from DCM |

Part I is the condensed record of the session, each topic ending with a decision. Part II is the PRD. Part III is the phased plan.

---

# Part I: Brainstorm (condensed)

### Topic 1: What is the core verb?

**Camille:** In DCM the verb is *dispatch*: select a problem, pick a technician, confirm. Two taps on a phone. What is ours?
**Anh Hùng:** On the floor, the job of the line leader is moving people. Lan is fast on collars, so when collars pile up you move her there. When a machine breaks you move the girl to the spare machine, and you call me.
**Sofia:** So the verb is *assign*: drag a worker onto a station. And the problem is visible: bundles piling up in front of a slow station.
**Chị Lan:** The pile is the first thing you see when you walk in. A pile in front of you is shame. An empty table after you is also shame, because the next girl is waiting.
**Sofia:** That is our "readable chaos". Piles are alarms. No need for a red icon if the pile of fabric is big and growing.
**Ngọc:** I can draw the bundle piles in three heights and tie them with coloured strings per order. You read the line in one glance.

> **Decision D1.** The core verb is **Assign**: tap a worker, tap a station (or drag on desktop). The primary alarm is the **WIP pile** in front of a station, drawn physically and growing; a number and a countdown appear only when you tap it. Secondary verb: **Call the mechanic** for broken machines.

### Topic 2: Line balancing as the heart of the game

**Bà Hà:** A shirt is about 25 operations. Collar, cuff, placket, sleeve, side seam, buttonhole, button, hem. Each has a standard time. The line is as fast as its slowest operation. Everybody in the industry knows this; few factories did it well in 1992.
**Sofia:** Then each product is a little graph of operations with times, and the player builds a line from stations. The bottleneck is the fun.
**Anh Hùng:** And the machine matters. A buttonhole needs a buttonhole machine. If you only have one and it breaks, the whole line stops.
**Chị Lan:** And a new style is always slow the first days. We learn. Day one we make maybe 40% of target, by day five we are at 80%.
**Sofia:** The learning curve is a beautiful mechanic. Long runs of the same style are efficient; switching styles costs you. That makes accepting orders a real choice.
**Camille:** Careful: DCM Ch3 dumped five systems at once. A full shirt with 25 operations is too much for chapter one.
**Sofia:** Tutorial products have 4–6 operations (a school uniform shorts, a pillowcase). A shirt arrives in chapter 1 with 8 grouped operations. The full detail is only for later products, and an "auto-group" button always exists.

> **Decision D2.** Each product is an **operation sequence** with a standard minute value (SMV) and a machine type per operation. Line output = the slowest station. **Learning curve** per worker per style (starts 40–60%, rises daily). Operation counts grow by chapter: 4–6 → 8 → 12 → 15+. A "suggest balance" assist exists from Chapter 1.

### Topic 3: Buyers with personalities

**Chị Thư:** The buyers are the drama. The Japanese buyer comes with white gloves and a ruler. If one stitch is wrong per inch, the lot is rejected. They pay well and they are loyal for years.
**Bà Hà:** The Korean buying office in Saigon is fast. Big quantity, short time, they bring their own fabric — CMT, cut-make-trim. They phone at 9 pm.
**Chị Thư:** The Hong Kong traders are middlemen. They squeeze the price per dozen and they change the colour after you cut. But they bring volume and they pay on time if you are friends.
**Sofia:** Three archetypes that are mechanically distinct: Japan = quality and loyalty, Korea = volume and speed, Hong Kong/China = price and changes. Taiwan can be a fourth: the trims and the machines come from there.
**Camille:** We must avoid national caricature.
**Ngọc:** Then each buyer company is a person with a name and a habit, not a flag. Mr. Watanabe who brings a ruler. Ms. Park who always calls at night. Mr. Leung who loves karaoke and hates surprises.
**Chị Thư:** And they are real habits. I worked with all of them, and they were kind people with impossible deadlines.

> **Decision D3.** Buyers are **fictional companies with a named contact and 1–2 habits**, built on three mechanical archetypes (Quality, Volume, Price/Change) with regional flavour. No real brands. National traits are expressed as business practice, never as caricature. A Vietnamese cultural reviewer and buyers' perspectives are part of content review.

### Topic 4: Inspection, the "boss fight"

**Chị Thư:** The final inspection decides everything. The buyer's QC opens random cartons, counts defects. Pass, you ship. Fail, you open every carton and check again, and maybe you miss the vessel.
**Sofia:** That is our boss fight. Every order ends with an inspection scene. AQL sampling, simplified: the lot size gives a sample size, the buyer's tolerance gives the maximum defects.
**Anh Hùng:** And the defects come from somewhere: a tired girl, a blunt needle, wrong thread tension, a cheap machine.
**Sofia:** So defects are traceable, like DCM's "every outage traceable to an ignored signal". After a fail, the post-mortem shows: "62% of defects came from station 7 (Hoa, day 2 of the style, needle not changed for 3 days)."
**Chị Lan:** Also show when we did well. When the Japanese pass you, you remember it for years.

> **Decision D4.** Every order ends with a **Final Inspection** scene (simplified AQL). Defects are produced by named causes (skill, fatigue, learning curve, needle and machine condition, fabric) and caught partially by end-of-line QC. A **pass** is celebrated (the buyer bows, stamps "PASSED", confetti of thread). A **fail** triggers re-inspection choices and a defect post-mortem with one-tap remedies.

### Topic 5: The ship leaves on Thursday

**Bà Hà:** The real clock is the vessel. The container must be at the port before the cut-off. Miss it and you pay air freight, which eats the whole profit, or the buyer cancels.
**Sofia:** That's DCM's SLA, but sharper: one deadline per order, visible as a ship on a calendar strip. Every order card shows "projected finish vs cut-off".
**Camille:** And it fixes DCM's invisible money problem. Show the margin per order live: "On track: +$1,840 · if air freight: −$600".
**Chị Lan:** When the ship is close, we do overtime. Everybody hates it and everybody wants the money.

> **Decision D5.** Each order has a **vessel cut-off** shown on a calendar strip, with a live projection and margin. Missing it means choosing between **air freight** (expensive), **partial shipment** (penalty) or **cancellation** (reputation). Overtime is the main crunch lever (Topic 7 sets its cost).

### Topic 6: Sourcing

**Bà Hà:** CMT is simple: the buyer sends fabric, you sew, you are paid per dozen. FOB is where the money is: you buy the fabric and trims yourself. But then you carry the risk.
**Chị Thư:** The fabric from the local state mill is cheap but the shade changes between rolls. Korean fabric is perfect but three weeks by sea, and customs at the port can hold it for days. Hong Kong traders have everything in a week, at a price. Zippers from Japan never fail; cheap zippers break at inspection.
**Sofia:** Suppliers as cards with price, quality, lead time and reliability. The warehouse is on the map. And a fabric inspection micro-game: tap the flaws as the roll unwinds.
**Anh Hùng:** And the cutting room. The marker is a puzzle: you lay the pattern pieces on the fabric to waste the least. Good markers save 5%.
**Sofia:** A marker puzzle on a phone is perfect: drag pieces, it snaps, shows efficiency. Optional, with auto-marker at a lower efficiency, like DCM's auto-defend.

> **Decision D6.** Orders come as **CMT** (materials supplied by the buyer; low margin, low risk) or **FOB** (you source; higher margin, more risk). Sourcing uses **supplier cards** (price, quality, shade consistency, lead time, reliability) and **shipments** that can be delayed. The **warehouse** and **cutting room** are physical rooms. Two optional micro-games: **Fabric Inspection** and **Marker Puzzle**, each with an auto-resolve at lower efficiency.

### Topic 7: People first

**Chị Lan:** Please don't make us machines. We come on bicycles at 6:30, we eat rice from the tin box at lunch, we listen to the radio, we send money home to the countryside. When the factory is hot we sew slower. When the boss is fair we stay.
**Bà Hà:** Turnover was the big problem. After Tết, maybe 20% don't come back. You have to train new girls again.
**Sofia:** Fatigue, morale and skills, like DCM technicians. But we make care pay: fans, a better lunch, the 13th-month salary before Tết, a fair overtime limit. Those raise morale, lower defects and raise the return rate after Tết.
**Camille:** And never the opposite. No mechanic where abusing workers wins.
**Bà Hà:** The 1994 Labour Code capped overtime. Use it as a rule from Chapter 5: it is history and it is the right design.
**Ngọc:** Each worker gets a portrait, a home province and one small story line in a speech bubble: "My brother passed the university exam!"

> **Decision D7.** Workers have **skills per machine type**, **speed**, **fatigue**, **morale**, **traits** and a **home province**. Welfare investments (fans, lunch, bonuses, training, fair overtime) measurably improve output, quality and post-Tết return. **Exploitative play never wins**: excessive overtime raises defects, accidents and quits faster than it raises output, and the bot tests prove it. Child labour, violence or humiliation do not exist in the game.

### Topic 8: 1990s flavour

**Anh Hùng:** The power cuts! Every week. The lights go off, all machines stop, and you hear the girls sigh together. If you have a generator, you start it. If not, everybody sits.
**Chị Thư:** The fax. All orders came by fax, at night, curled thermal paper. And the telephone with a cord, in the director's office.
**Bà Hà:** Monsoon floods in the street, typhoons in the north, the dong losing value, the US embargo lifted in 1994, the move to the export processing zones. And 1997, when the Korean won fell and the Korean orders disappeared overnight.
**Sofia:** Each of those is an event or a chapter: power cuts in the rainy-season chapter, the EPZ move as a chapter, 1997 as the finale.
**Camille:** Fax as the UI for orders. An inbox of curled paper. That's charming and readable.

> **Decision D8.** Period flavour is **mechanical, not decoration**: the **fax** is the order inbox; **power cuts** and the **generator** are a system; **monsoon** and **typhoon** are events; the **dong exchange rate** drifts; the campaign moves through history (1992 shophouse → 1995 export zone → 1997 crisis). Real dates and events are used as backdrop; companies and people are fictional.

### Topic 9: Look and feel

**Ngọc:** Top-down with a light 2.5D, like DCM's racks. The floor is a grid of tables and machines in rows, ceiling fans turning, fluorescent tubes, a wall clock, a calendar from a supplier, a thermos of tea. Warm palette: pale green walls, cream floor, fabric is the colour. Every order has its fabric colour, so the line is a river of colour.
**Ngọc:** No conical hats on every head, no lotus everywhere, no "exotic Asia" filter. Real 1990s Saigon: Honda Cub motorbikes in the yard, blue work coats, cloth caps, plastic sandals, colourful thread cones.
**Sofia:** And e-ink mode stays, like DCM: fabrics become patterns (stripes, dots, checks) instead of colours. That also makes it colour-blind safe.
**Anh Hùng:** And the sound! A good line has a rhythm. Tac-tac-tac, pause, tac-tac-tac. When the line is balanced, it sounds like music.
**Sofia:** That's the best idea of the day. The sewing machines are a percussion ensemble. Each station is an instrument. A balanced line plays in time; a bottleneck stutters; the radio plays a period-style tune on top.

> **Decision D9.** Art: **top-down 2.5D, warm 1990s Saigon**, period-accurate details, no clichés; fabrics carry colour **and pattern** (colour-blind and e-ink safe). Audio: **the line is the music**. Each station adds a rhythmic layer; balance sounds in time, bottlenecks stutter, power cuts drop to silence. Generated with WebAudio, as in DCM.

### Topic 10: Phone session and pacing

**Camille:** DCM learned it the hard way: one session = one shift, 6–9 minutes. The tutorial ≤ 7 minutes. Quiet time ≤ 50%. No more than two new systems per chapter. All checked by a bot in CI.
**Sofia:** One shift is 07:00–16:30 with lunch at 11:30. Optional overtime until 19:00. At the end a **shift report** on a school-notebook page: pieces made, efficiency, defects, money, one story of the day.
**Chị Lan:** Lunch is important. In the game too: the floor goes quiet, people eat and nap at their machines.
**Sofia:** Lunch is a natural 30-second breather and the moment for calm-time decisions: answer faxes, plan tomorrow's line, order fabric.

> **Decision D10.** **One shift ≈ 6–8 real minutes** at 1×. Lunch is a built-in breather for planning. The DCM guardrails are kept and enforced by an autopilot bot in CI (session length, quiet time, systems per chapter, ★★★ not reached by the default bot).

### Topic 11: Automation and growth

**Bà Hà:** At first I did everything. Then I had line leaders, then a production planner, then a merchandising team. That's how you grow.
**Sofia:** Same as DCM's Shift Lead. Hire a **line leader** and that line auto-balances by your priority. A **production planner** schedules orders across lines. A **merchandiser** answers routine faxes. The player's workload stays flat while the factory grows.

> **Decision D11.** Automation by hiring: **Line Leader** (auto-rebalance one line, Ch4), **QC Supervisor** (end-of-line tuning, Ch3), **Production Planner** (order-to-line schedule, Ch6), **Merchandiser** (routine buyer requests, Ch6). Player taps per minute stay roughly flat from Ch2 onward (bot-measured).

### Topic 12: What we will not do

- No bribery or "tea money" mechanics, even though the period had them. It is not fun and it is not respectful.
- No real brands (buyers, mills, machine makers). Machines use fictional makers (e.g. *Kiruna* lockstitch, *Hoshi* overlock).
- No exploitative win paths (D7). No energy timers, ads or purchases: the game is free, as DCM is.
- No full textile engineering (no GSM, yarn counts, colorimetry). Simplify into "quality", "shade lot" and "shrinkage risk".
- No 3D, no multiplayer, no backend in v1.

> **Decision D12.** The list above is binding for v1. Additions require a decision log entry.

---

# Part II: PRD

## 1. Vision & Pillars

**Elevator pitch:** *Overcooked's line pressure meets Game Dev Tycoon's growth, in a 1990s Saigon garment factory.* You are the director. Faxes arrive, a needle breaks, the buttonhole machine jams, it rains into the warehouse, the Japanese inspector opens carton 14. You don't sew yourself for long: you hire, assign, train and organise a growing team, from six machines to six lines.

| # | Pillar | In practice |
|---|---|---|
| 1 | **The line is readable** | Piles, colours and rhythm tell you where the bottleneck is in under 2 seconds. |
| 2 | **Assign is the core verb** | Tap worker → tap station. Two taps on a phone. |
| 3 | **Systems that interact** | Skill, fatigue, machines, fabric and deadlines chain: a tired worker on a blunt needle makes defects; defects fail inspection; a failed inspection misses the ship. |
| 4 | **Learn by layering** | ≤ 2 new systems per chapter (tested). |
| 5 | **Workshop → Factory** | Early: you move every worker. Late: you design lines, set priorities and step in on the crises. |
| 6 | **Warm, funny, respectful** | Gentle humour from real factory life. Workers are people with names and stories. Care is good business. |
| 7 | **History as gameplay** | 1992–1997 Vietnam (Đổi Mới, embargo lifted, export zones, the 1997 crisis) shapes events and chapters. |

**Target audience:** casual-to-midcore management players (Two Point, Game Dev Tycoon, Overcooked, Mini Metro), the Vietnamese and diaspora audience who will recognise the setting, and people in the garment industry.

**Session shape:** 6–8 min on mobile (one shift), 30–90 min on desktop. Pause at any time.

**Business model:** free, no ads, no purchases, no accounts, static site (as DCM).

### 1.1 What we take from DataCenterMania

| DCM element | SewingFactoryMania equivalent |
|---|---|
| Rack, server, device | Line, station, machine |
| Alarm feed | WIP piles + fax inbox + mechanic calls |
| Dispatch technician | Assign worker / call mechanic |
| Contract + SLA | Order + vessel cut-off + inspection |
| Customer archetypes | Buyer contacts (Quality / Volume / Price-change) |
| Shop & deliveries | Supplier cards & shipments |
| Heat & power systems | Hot floor (fans), power cuts & generator |
| Technician fatigue/morale/traits | Worker fatigue/morale/traits, Tết return rate |
| Shift Lead auto-dispatch | Line Leader auto-balance |
| Hacker Weekend micro-games | Fabric inspection, Marker puzzle, Spot the defect, Carton packing |
| Outage post-mortem | Defect post-mortem / missed-ship post-mortem |
| Shift report card | Notebook-page shift report |
| Deterministic sim, bot guardrails, e-ink, PWA, FR | Same, with **Vietnamese** as second language |

## 2. Platform & Technical Constraints

Same as DCM: SPA in TypeScript + Vite, Canvas 2D map and DOM panels, no backend, GitHub Pages, PWA offline, autosave at every shift and on `visibilitychange`, export/import JSON saves, 60 fps on a mid-range 2022 Android phone, initial load < 3 MB, touch targets ≥ 44 px, no hover-only information, portrait-first on mobile, **e-ink mode** (patterns instead of colours, no animation, ≤ 2 redraws/s).

**Languages:** EN and **VI** at launch (Phase 2); FR in Phase 4. Buyer faxes can include short KO/JA/ZH greetings as flavour, always translated.

## 3. Core Loops

```
MICRO (seconds)  Pile grows → spot bottleneck → assign worker / call mechanic → pile shrinks
MID   (shift)    Plan the line → run the shift → lunch planning → overtime? → shift report
MACRO (orders)   Fax inquiry → quote → sample → materials → cut → sew → QC → inspection → ship → get paid → grow
```

### 3.1 Time model

| Speed | Real → game | One shift (07:00–16:30) | Use |
|---|---|---|---|
| ⏸ | — | — | Planning and assigning allowed while paused |
| 1× | 1 s → 1.5 min | ≈ 6.3 min | Default |
| 2× | 1 s → 3 min | ≈ 3.2 min | Steady runs |
| 4× | 1 s → 6 min | ≈ 1.6 min | Waiting for shipments |
| Overtime | 16:30–19:00 | +1.7 min at 1× | Optional, costs fatigue and wages |
| Night | Skipped | Night recap | "The fax machine rang 3 times." |

- **Week:** Monday–Saturday shifts (6-day week, period-accurate); Sunday is skipped with a family-day recap (morale +).
- **Orders** run 5–20 game days. A chapter is 4–10 shifts (≈ 25–60 real minutes).
- **Job durations:** a sewing operation is 0.3–3 SMV per piece; bundles of 10–20 pieces move every 10–40 game minutes (5–25 real seconds), so the flow is always visible.
- **Mechanic repair:** needle change 2 game min, belt/tension 10, motor 45 (and a spare machine can be swapped in).
- **Incident target:** Ch0–1: 2–4 interventions per shift; Ch3+: 8–12, with growing automation. No stretch over 90 real seconds without something to look at or decide.

## 4. World Model

### 4.1 Spatial hierarchy

```
Factory (shophouse → rented hall → export-zone factory)
 └─ Rooms: warehouse, inspection table, cutting room, sewing floor, finishing (ironing, trimming),
           QC, packing, loading yard, office (fax, phone), canteen, generator shed, mechanic corner
     └─ Sewing line (row of stations, bundle flow direction)
         └─ Station = machine + worker + WIP pile in/out
             └─ Machine: type, condition, needle wear, maker tier
```

### 4.2 Production model

- **Product** = list of operations `{name, SMV, machineType, skillKey, defectRisk}`, plus fabric need per piece and trims.
- **Station output/hour** = `60 / SMV × skill × learning(style, days) × fatigue × morale × machine condition × heat`.
- **Line output** = min of station outputs along the sequence; surplus accumulates as WIP piles; starved stations idle (worker shown waiting, morale dips slightly).
- **Bundle flow:** cut pieces leave the cutting room in bundles with an order ticket; bundles move along the line; finished garments go to finishing, QC, packing.
- **Learning curve:** first day of a new style ≈ 50% (40% on hard styles), +10 points per day to the worker's ceiling. Style changeover resets part of it. Long runs reward the player.
- **Machine types** (unlocked progressively): single-needle lockstitch, overlock, flatlock/coverstitch, buttonhole, button sewer, bartack, multi-needle (jeans), iron/press, manual (trimming, folding).
- **Defects:** each piece rolls defect risk from skill, fatigue, learning, needle wear, machine tier and fabric quality. End-of-line **QC** catches a share (depends on QC worker skill); caught defects go to a **rework** pile (returns to the station that caused it). Missed defects remain in the lot for the inspection.
- **Fabric:** each roll has a **quality** and a **shade lot**. Mixing shade lots in one garment = defect at inspection. Fabric inspection (micro-game or auto) flags bad rolls. Rain leaks in the warehouse damage rolls unless stored on pallets.
- **Cutting:** marker efficiency (70–90%) turns rolls into pieces. Better markers = less fabric bought.

### 4.3 Factory subsystems

| Subsystem | Elements | Key stat | Introduced |
|---|---|---|---|
| Line | Stations, workers, bundles | Pieces/hour, efficiency % | Ch0 |
| Machines | Types, condition, needles, mechanic | Uptime, defect contribution | Ch0 (basic), Ch2 (mechanic) |
| Orders | Fax, quote, deadline, vessel | Margin, projected finish | Ch1 |
| Quality | QC, rework, inspection | Defect rate, pass rate | Ch2 |
| Sourcing | Suppliers, shipments, warehouse, cutting | Material cost, lead time, shade | Ch3 |
| Power & climate | Power cuts, generator, fans, heat, rain | Lost minutes, heat penalty | Ch4 |
| People | Fatigue, morale, Tết, turnover, training | Return rate, skill | Ch1 (hire), Ch5 (full) |
| Planning | Multi-line, planner, merchandiser | Orders on time | Ch6 |
| Macro economy | Exchange rate, quota, market shock | Order volume by country | Ch7 |

## 5. Buyers, Orders & Products

### 5.1 Order card (arrives as a fax)

Buyer, contact, product, quantity (in **dozens**), size/colour breakdown, **price per dozen** (USD), CMT or FOB, sample required, inspection level (strict / normal / relaxed), **vessel cut-off date**, penalties, possible repeat order.

**Quote choice** (from DCM's negotiation idea): three cards trading price, quantity and deadline ("$14/dz, 1,200 dz, 15 days" vs "$15.5/dz, 900 dz, 12 days" vs "$13/dz, 1,500 dz, 20 days + repeat").

### 5.2 Buyer archetypes (fictional)

| Buyer | Contact & habit | Archetype | Behaviour |
|---|---|---|---|
| *Cô Mai's School Uniforms* (local) | Cô Mai, the headmistress; pays in cash, brings cakes | Tutorial | Small, forgiving, Ch0 only |
| *Hanil Apparel Buying Office* (Korea) | Ms. Park; calls at 21:00 with "one more thing" | Volume | CMT, big lots, tight ships, padded jackets in autumn |
| *Sakura-ya Department Store* (Japan) | Mr. Watanabe; brings a ruler and white gloves | Quality | Small lots, many sizes, strict inspection, pays premium, very loyal |
| *Golden Harbour Trading* (Hong Kong) | Mr. Leung; loves karaoke, hates surprises; introduced by Uncle Sáu (§11.1) | Price/Change | Arrives early: small CMT trial orders from Ch1, then FOB from Ch3; squeezes price, changes colours mid-order, big volumes |
| *Formosa Threadworks* (Taiwan) | Mrs. Lin; also sells you machines | Partner | Mid orders, offers machine financing |
| *Pearl River Garments* (mainland China) | Mr. Zhou; subcontracts overflow to you | Overflow | Arrives late (Ch6): sudden urgent orders, low price, short deadlines |

### 5.3 Products (unlocked by chapter)

| Product | Ops | Machines | Notes |
|---|---:|---|---|
| School shorts, pillowcases | 4–5 | Lockstitch, overlock | Ch0 |
| Basic shirt | 8 (grouped) | + buttonhole, button | Ch1 |
| Polo shirt | 10 | + flatlock | Japan likes polos |
| Baby wear | 9 | + snap press | Strict safety: no loose buttons |
| Jeans | 14 | + multi-needle, bartack | Heavy fabric, wash outsourced |
| Yukata (summer kimono) | 7 | Lockstitch, manual | Japan seasonal, long seams, delicate cotton |
| Padded winter jacket | 16 | All + quilting | Korea autumn peak, the final big product |
| Workwear | 10 | Heavy lockstitch | Steady, low margin, good for learning |

### 5.4 Order lifecycle (simplified for the game)

1. **Fax inquiry** → choose a quote card.
2. **Sample** (from Ch2): one worker sews a sample; quality roll + "Spot the defect" micro-game; approval or comments.
3. **Materials:** CMT (buyer's fabric arrives on a date) or FOB (you buy from suppliers).
4. **Fabric inspection** → **cutting** (marker) → **sewing** → **finishing** → **QC** → **packing** (carton ratio).
5. **Final inspection** (buyer's QC) → pass / re-inspect / fail.
6. **Truck to port** before the **cut-off** → payment (CMT: on shipment; FOB: by letter of credit after 5–10 days).

## 6. Sourcing

| Supplier (fictional) | Origin | Sells | Price | Quality | Shade consistency | Lead time | Risk |
|---|---|---|---|---|---|---|---|
| *Bình Minh Textile Union* (state mill) | Vietnam | Cotton, poplin | Low | Medium | Poor | 4–7 days | Late, inconsistent |
| *Daegu Weaving Co.* | Korea (via Busan) | Synthetics, padding, denim | Medium | High | Good | 18–24 days | Customs hold |
| *Kowloon Fabric House* | Hong Kong | Everything | High | Varies | Medium | 6–9 days | Wrong colour shipped |
| *Nanami Fasteners* | Japan | Zippers, snaps | High | Excellent | — | 12 days | Rarely fails |
| *Cheap trims market stall* | Chợ Lớn | Buttons, thread, zippers | Very low | Low | — | Same day | Breaks at inspection |
| *Formosa Threadworks* | Taiwan | Thread, machines, needles | Medium | High | — | 10 days | Steady |

- **Shipments** appear on a sea-route mini-map (Busan / Hong Kong / Osaka → Saigon Port), with weather and customs events.
- **Warehouse capacity** is limited; overstock costs money and space; rain leaks threaten rolls on the floor.
- **Stock of spare parts** (needles, belts, bobbins) is the DCM "spare disks" lesson: no needles = machine idle.

## 7. Workers

### 7.1 Roles

| Role | Does | Unlock |
|---|---|---|
| **You (Director)** | Can sew slowly or fix simple jams in Ch0; later only boosts morale by visiting a line | Ch0 |
| **Sewing operator** | Runs one station; skills per machine type | Ch0 |
| **Helper / trimmer** | Moves bundles, trims threads, folds; can float to fill gaps | Ch1 |
| **Mechanic** | Fixes machines, changes needles, preventive maintenance | Ch2 |
| **QC inspector** | End-of-line checks; catch rate by skill | Ch2 |
| **Cutter** | Spreads and cuts; marker skill | Ch3 |
| **Warehouse keeper** | Receives shipments, fabric inspection, storage | Ch3 |
| **Presser / packer** | Finishing and cartons | Ch3 |
| **Line Leader** | Auto-balances a line by your priorities | Ch4 |
| **Generator operator / electrician** | Starts the generator, maintains it | Ch4 |
| **Production Planner** | Assigns orders to lines and dates | Ch6 |
| **Merchandiser** | Handles routine buyer faxes, samples, inspection prep | Ch6 |

### 7.2 Worker stats

- **Skill** per machine type (1–5 ★), plus **style learning** per product.
- **Speed**, **fatigue** (rises with work, heat and overtime; lunch and Sunday reset it), **morale** (pay vs market, fans, lunch quality, fairness, overtime, team mood).
- **Traits** (1–2): *Collar Queen* (+30% on collar/placket ops), *Fast Hands, Loose Stitches* (fast, more defects), *Old Cooperative Hand* (slow on new machines, never defects on lockstitch), *Radio Singer* (raises neighbours' morale), *Night Student* (refuses overtime, levels up faster), *Big Family* (wants overtime, higher Tết risk), *Machine Whisperer* (mechanic, half repair time).
- **Home province** (Mekong Delta, Central coast, North) → Tết travel, typhoon news affects morale ("Storm in Quảng Ngãi, Thảo is worried about her parents").
- **Training:** pair a junior with a senior (mentoring takes some of the senior's output, builds skill); later a training room.

### 7.3 Welfare that pays

| Investment | Effect |
|---|---|
| Ceiling fans → industrial fans → (1996) air extraction | Heat penalty down, fatigue slower |
| Lunch: rice tin → canteen → canteen with fruit | Morale up, afternoon fatigue down |
| Fair pay vs market | Fewer quits, easier hiring |
| **13th-month bonus** before Tết | Post-Tết return rate up (e.g. 80% → 95%) |
| Overtime within the 1994 Labour Code cap (from Ch5) | Defects and accident risk stay low |
| Clean water, first-aid corner | Prevents sick days |

Excessive overtime and no welfare **must lose** against fair play over a chapter: guarded by a bot test (§17).

## 8. Incidents & Events

| Incident | Cause / chain | Counter-play |
|---|---|---|
| Needle break | Wear, heavy fabric | Needle stock, preventive changes |
| Machine breakdown | Condition, cheap maker | Mechanic, spare machine, maintenance |
| Skipped stitches / bad tension | Wear, wrong thread | Mechanic check, better thread |
| Bottleneck | Unbalanced line, absent worker | Re-assign, helper, line leader |
| Absent worker (sick, family) | Morale, season | Floaters, cross-training |
| Power cut | Grid (weekly in Ch4+) | Generator (needs diesel and tests), schedule |
| Heat wave (April–May) | Season | Fans, shorter lines, water |
| Monsoon flood / roof leak | Rainy season | Pallets, roof repair, move stock |
| Typhoon | Central/North news, delays shipping | Buffer days, morale care |
| Shade mismatch | Mixed fabric lots | Fabric inspection, bundle by lot |
| Wrong colour shipped | Supplier | Second supplier, early check |
| Customs hold | Port | Buffer days, better paperwork (planner) |
| Late fabric | Supplier | Reschedule, air shipment of fabric |
| Buyer changes colour mid-order | Golden Harbour habit | Negotiate (cost them) or rework |
| Surprise inspector visit | Japanese buyer | Clean floor, QC log |
| Fax at 21:00 | Ms. Park | Morning response or lose the repeat order |
| Tết | Calendar | Bonus, buffer stock, rehiring |
| "The radio is broken" | Comic | Morale −; buy a new radio (cheap, very popular) |
| Mouse in the warehouse | Comic | Cat (adopt the factory cat: cosmetic + small bonus) |

**Incident director** (from DCM): calm → build-up → peak → relief, with intensity per difficulty.

## 9. Micro-games (optional, ≤ 15 seconds, auto-resolve at lower efficiency)

1. **Fabric Inspection:** a roll scrolls; tap holes, stains and slubs. Score = roll grade.
2. **Marker Puzzle:** drag pattern pieces onto a fabric strip; snaps to grain; efficiency %. Saved markers reused for the order.
3. **Spot the Defect:** sample vs approved photo: find 3 differences (crooked label, open seam, wrong button).
4. **Carton Packing:** fill a carton with the right size ratio (S/M/L/XL) before the truck leaves.
5. **Threading Rush** (tutorial joke): thread the needle in one tap with good timing.

## 10. Economy

- **Income:** price per dozen × dozens shipped; repeat-order bonus; selling fabric remnants; early-ship bonus.
- **Costs:** wages (VND), overtime premium, rent, electricity, diesel, materials (FOB), spare parts, machines (buy / lease / second-hand from Taiwan), air freight, penalties, welfare.
- **Currency:** contracts in USD, costs in VND; the exchange rate drifts (period flavour: the dong lost value in the early 1990s), shown simply as "1 USD = 10,800 ₫ (+2% this month)".
- **Live money** (DCM lesson): money pops on finished cartons and shipments, per-order margin on every card, a HUD goal chip with projection.
- **Reputation** per buyer (0–5 ★) gates order size and price; overall reputation unlocks new buyers.
- **Upgrades tree:** machines (tiers, types), floor (fans, lighting, canteen), process (bundle system → line leaders → planning board → "1997 computer" for planning), quality (QC table, lightbox, metal detector for baby wear).

## 11. Chapters (single campaign, progressive disclosure)

Rule: **≤ 2 new systems per chapter**, each taught by Introduce → Practise → Twist.

| Ch | Year | Name | Place | New systems | Twist | Win (★) |
|---|---|---|---|---|---|---|
| 0 | 1992 | **The Family Workshop** (tutorial, 1 shift) | Shophouse, 6 machines | Assign, bundle flow | A machine jams before Cô Mai's pickup | Deliver 200 school shorts |
| 1 | 1992 | **The First Fax** | Shophouse + back room, 12 machines | Orders & vessel, hiring | Ms. Park adds 20% quantity while Mr. Leung's trial order is due the same week | Ship the Korean shirt order on time |
| 2 | 1993 | **The Man with the Ruler** | Rented hall, 1 line of 20 | Quality & inspection, mechanic | Inspection on a day the best seamstress is sick | Pass a Sakura-ya inspection |
| 3 | 1994 | **The Fabric Hunt** | Hall + warehouse + cutting room | Sourcing (FOB), cutting & fabric inspection | Wrong colour from Kowloon | Profit $X on an FOB order |
| 4 | 1994 | **Rain and Darkness** | 2 lines | Power cuts & generator, Line Leader | Flood in the street + vessel day | Two orders on time in rainy season |
| 5 | 1995 | **Before Tết** | 3 lines | Fatigue/morale/turnover in full, Labour Code overtime cap | 18% don't return after Tết | Post-Tết return ≥ 90% and ship |
| 6 | 1996 | **The Export Zone** | New factory in an EPZ, 6 lines | Multi-line planning (Planner, Merchandiser), padded jackets | Korean autumn peak + Mr. Zhou's overflow | 5 buyers, all ships on time |
| 7 | 1997 | **The Storm from the North** (finale) | Full factory | Macro shock (orders vanish), diversification | Korean orders drop 60% overnight | Survive the year with no layoffs (★★★: grow) |
| ∞ | — | **Sandbox** | Choose factory size, year, buyers | Everything | Director | High score / years survived |

### 11.1 Family storyline (decided: yes, because it changes the game)

The director is the eldest child of **Má**, who opened the shophouse workshop in 1979. The family is a light narrative layer of **1–2 scenes per chapter**, shown at lunch or in the shift report, never during a crisis. It is content, not a new system: every choice changes values in systems the player already knows, so the "≤ 2 new systems per chapter" rule still holds.

**Rules**
- Every scene ends with **one choice of 2–3 options**, and every option has a **visible game effect** stated on the card before choosing (no hidden traps).
- No option is strictly best: each trades cash, time, morale, buyers or a unique worker.
- Skipping a scene picks the neutral option; the campaign stays winnable on every path (bot-tested across all choice combinations).
- Effects are logged in the factory scrapbook, so players can see how the family shaped the factory.

**Family members and their mechanical role**

| Character | Role in the story | Game effect |
|---|---|---|
| **Má** (mother, founder) | Retires in Ch0, stays upstairs, still knows every customer from before | **Family loan** once per chapter (cash now, repaid from profits; missing a repayment lowers Má's trust and removes the next loan). Her visits to the floor give a morale boost to long-serving workers |
| **Út** (youngest sibling) | Finishes school in 1993 | **Ch2 choice:** join the factory now (a unique helper with the *Fast Learner* trait who becomes a free Merchandiser in Ch6) **or** study in Osaka (absent until Ch6, then returns: Sakura-ya reputation +1★, unlocks yukata orders a chapter early, Japanese faxes answered automatically) |
| **Uncle Sáu** (in Hong Kong since 1979) | Writes letters; knows traders in Kowloon | **Ch1:** introduces Mr. Leung (Golden Harbour's trial orders). **Ch3:** can vouch for you (Kowloon Fabric House lead time −2 days) at the cost of a favour later (a rush order you cannot refuse in Ch6) |
| **Bác Tư** (mentor, Má's old tailor) | Delivers tips; slowly hands over | Tips and Handbook. **Ch5:** retires; the player chooses which senior worker inherits his scissors (that worker gets +1★ in every skill and becomes Line Leader at half salary) |
| **The director's spouse/partner** (optional name and gender chosen at start) | Works as a teacher | **Ch5 Tết scene:** go home for Tết (the factory runs one shift on autopilot; director morale aura +, family trust +) or stay (one extra shift of output, no aura in Ch6) |

**Scenes per chapter (proposed)**

| Ch | Scene | Choice → effect |
|---|---|---|
| 0 | Má hands over the keys | Keep Má's old machines (free, slower) or sell them for a better one (cash −, speed +) |
| 1 | A letter from Uncle Sáu | Accept Mr. Leung's trial order (more work this week, new buyer) or decline (calmer chapter, Golden Harbour arrives only in Ch3) |
| 2 | Út's future | Join the factory or study in Osaka (see above) |
| 3 | The family loan | Borrow to buy a cutting table now or wait two orders |
| 4 | Flood in the old street | Use the trucks to help neighbours move stock (one lost afternoon, local hiring +) or keep producing |
| 5 | Tết at home; Bác Tư retires | See above |
| 6 | Út comes back (or is promoted) | Merchandiser assignment; Uncle Sáu's favour comes due |
| 7 | 1997: Má's advice | "Never lay off people who built this" (no-layoff path, hard) or "Keep the factory alive" (shrink a line, easier) — both can win; ★★★ needs the first |

### 11.2 Disclosure

**Disclosure:** panels appear only when unlocked; first-time tips by the mentor **Bác Tư** (an old tailor who taught the director's mother), short and funny; the **Handbook** replays every tip and explains industry terms.

**Learning curve:** complexity rises by chapter, player taps/minute stays roughly flat thanks to Line Leaders (Ch4) and Planner/Merchandiser (Ch6).

## 12. Difficulty

| | **Apprentice** | **Seamstress** (default) | **Line Leader** | **Ship Leaves Thursday** |
|---|---|---|---|---|
| Unlock | Always | Always | Always | After Ch4 |
| Starting cash | ×2 | ×1 | ×0.8 | ×0.6 |
| Incident frequency | ×0.5 | ×1 | ×1.3 | ×1.7 |
| Inspection strictness | Relaxed | Normal | Normal+ | Strict |
| Supplier delays | Rare | Normal | ×1.5 | ×2 + wrong shipments |
| Defect rates | ×0.5 | ×1 | ×1.2 | ×1.5 |
| Auto-pause on breakdown | Forced | On (mobile) | Optional | Off |
| Score multiplier | ×0.5 | ×1 | ×1.5 | ×2 |

Plus **chapter stars** (★ pass, ★★ pro, ★★★ constraint challenge the default bot does not meet, e.g. "no overtime", "zero rework", "max 1 mechanic"). Stars unlock cosmetics only: uniforms colours, factory cat outfits, radio songs, wall calendars.

## 13. Automation Layer

1. **Manual assign** (Ch0).
2. **Suggest balance** button (Ch1): shows the best move, one tap to apply.
3. **Helpers float** to the biggest pile automatically (Ch1 hire).
4. **Line Leader** (Ch4): auto-rebalances by priority cards: `Priority: on-time > quality > cost`, `Never move Lan off collars`.
5. **Mechanic preventive rounds** (Ch2, idle mechanics change needles: badge "prevented 3 breakdowns today").
6. **Production Planner** (Ch6): drag orders onto a line calendar; planner fills gaps.
7. **Merchandiser** (Ch6): auto-answers routine faxes with your quote policy.

Card-based, touch-friendly, never a code editor (DCM rule).

## 14. UX / UI

### 14.1 Screens

- **Factory Floor** (main): top-down rooms, lines as rows, bundles visibly moving, piles at stations, fans turning. Tap a station → worker card + machine + pile count + "Assign / Call mechanic".
- **Line View:** horizontal strip of operations with output/hour bars; the bottleneck bar glows; drag workers between operations.
- **Fax Inbox:** curled-paper cards; quote choices; buyer portraits.
- **Order Board:** calendar strip with vessel icons, projected finish, margin.
- **Warehouse / Sourcing:** supplier cards, shipments mini-map, stock.
- **Team:** portraits, skills, fatigue, morale, traits, province.
- **Handbook, Settings, Achievements.**
- **Overlays:** Bottleneck (heat map of piles), Quality (defects by station), Heat, Fatigue.

### 14.2 Layouts

```
DESKTOP                                         MOBILE (portrait)
┌──────────────────────────────────────────┐    ┌──────────────────┐
│ $8,420 · 10,800₫ · Tue 14:20 · ⛴ Thu ⏸1×2×│    │ $8.4k ⛴Thu 14:20⏸│
├──────┬────────────────────────────┬──────┤    ├──────────────────┤
│ Team │                            │ Fax  │    │   FACTORY FLOOR  │
│      │      FACTORY FLOOR         │Orders│    │  (pinch / pan)   │
│      │                            │      │    │                  │
├──────┴────────────────────────────┴──────┤    ├──────────────────┤
│ [Line] [Orders] [Sourcing] [Team] [Book] │    │ 📠2  ▲ swipe up  │
└──────────────────────────────────────────┘    │ 🧵 📋 📦 👥 ☰    │
                                                └──────────────────┘
```

- Assign in 2 taps; long-press a worker for details.
- Shift report on a school notebook page, shareable as an image.

### 14.3 Accessibility

Colour + pattern for fabrics and severity, scalable text, reduced motion, every sound has a visual (the "rhythm" has a visual metronome bar), full keyboard play, axe-core clean.

## 15. Art & Audio Direction

- **Art:** top-down 2.5D, clean flat style, readable silhouettes. Warm palette (pale green walls, cream floors), fabrics as the main colour source. Period details: Honda Cub motorbikes and bicycles in the yard, wall calendar from a supplier, thermos and tea glasses, radio, fluorescent tubes, ceiling fans, blue work coats, cloth caps, tin lunch boxes. No exotic clichés. E-ink greyscale versions of every sprite.
- **Characters:** expressive small figures; sweat drops when hot, yawns when tired, a little heart when morale is high; portraits hand-drawn SVG like DCM.
- **Audio:** **the line is the music** (D9): each station is a percussion layer; balance = groove, bottleneck = stutter, power cut = silence and cicadas, generator = low drone. Radio plays original period-style instrumentals (no licensed songs). Fax machine screech for new orders. Inspector's stamp "THUNK" on pass.
- **Tone:** gentle humour ("Mr. Watanabe measured the stitch. Then he measured the ruler."; "Ms. Park: one small change. The small change: the colour.").

## 16. Meta & Retention

- **Achievements:** "Perfect Balance" (line efficiency ≥ 85%), "Watanabe Smiled", "Zero Rework Week", "Everyone Came Back" (100% post-Tết return), "Monsoon Proof", "The Cat Stays".
- **Career title:** Apprentice → Line Leader → Factory Manager → Director → "Garment Tycoon".
- **Daily Challenge:** date-seeded one-shift scenario, emoji share line ("SewingFactoryMania #12 ★★☆ 92% eff 🧵🧵⛴").
- **Factory scrapbook:** a photo for each chapter ending, with workers who were there.
- **Sandbox** unlocks after Ch3.

## 17. Technical Architecture

Reuse DCM's proven layout and rules:

```
src/
  core/   seeded serializable RNG, time model (1 real s = 1.5 game min at 1×)
  data/   products & operations, machines, buyers, suppliers, chapters, difficulty, traits, strings (EN/VI)
  sim/    pure deterministic simulation, no DOM
          production (stations, bundles, learning), machines, quality, inspection, orders, sourcing,
          shipments, power, climate, people, economy, director, events, objectives, automation
          commands.ts (only write path), selectors.ts
  render/ Canvas 2D floor renderer, camera, sprites
  ui/     app shell, views, clock, storage, audio (rhythm engine), i18n
tests/    Vitest + autopilot bot ("competent director")
e2e/      Playwright, desktop + phone
```

**Design rules carried over:** headless deterministic sim; one write path (`applyCommand`); pacing is a test; balance is a test; progressive disclosure is data (chapter feature flags); content as data.

**New tests specific to this game:**
- *Line math:* line output = bottleneck, property tested.
- *Fair play wins:* a bot that maximises overtime with no welfare loses to the fair bot over every chapter from Ch5.
- *Family paths:* the bot wins every chapter on default difficulty for every combination of family choices, and every choice changes at least one measured outcome.
- *Traceable defects:* every failed inspection has ≥ 1 cause the player could have seen.
- *Rhythm sync:* audio layers derive from sim output only (no audio state in the sim).

## 18. Success Metrics

| Metric | Target |
|---|---|
| Tutorial completion | > 80% |
| Tutorial length | ≤ 7 real min |
| Shift length (1×, default) | 6–8 real min |
| Quiet time (no decision available) | ≤ 50% of shift, no stretch > 90 s |
| New systems per chapter | ≤ 2 |
| ★ / ★★ / ★★★ | ≈ 80% / 40% / 10% |
| Ch2 completion | > 50% of starters |
| Median mobile session | ≥ 8 min |
| "Unfair" fails (no prior signal) | ≈ 0 |
| Performance | 60 fps with 6 lines × 25 stations on a mid-range phone |
| Vietnamese players' rating of authenticity | ≥ 4/5 in playtests |

## 19. Risks & Open Questions

1. **Sensitivity of labour history.** Mitigated by D7, D12, a Vietnamese cultural reviewer, and playtests with people who worked in garment factories. ~~Real stories page~~ **Decided (D15):** no real interviews in the game; the Handbook covers game terms and fictional characters only.
2. **Line view on a phone.** 25 stations is dense. LOD: grouped operations at low zoom, expand on tap.
3. **Production math feels like a spreadsheet.** Mitigation: piles, rhythm and colour carry the information; numbers only on tap.
4. **Too many order steps.** Lifecycle is staged by chapter; CMT orders hide sourcing until Ch3.
5. **Historical accuracy vs fun.** History is a backdrop, never a quiz. Dates/events reviewed for accuracy; fictional companies only.
6. **Audio rhythm on low-end phones.** Fallback: simplified loop; tested on the throttled-phone probe.
7. ~~Family storyline~~ **Decided (D13):** yes, because every scene changes the game (§11.1). Risk: branching choices multiply balance cases; mitigated by bot tests over every choice combination.
8. ~~Chinese buyer split~~ **Decided (D14):** Hong Kong early (trial CMT orders in Ch1, FOB from Ch3), mainland overflow late (Ch6).

---

# Part III: Phased plan

Every phase keeps DCM's discipline: tests first, bot guardrails in CI, phone e2e, auto-deploy to GitHub Pages, and a results section appended to this PRD.

## Phase 0 — "Paper Pattern" (prototype, 2–3 weeks)

**Goal:** prove the core verb is fun on a phone.

- Grey-box single line (6 stations), one product, bundle flow, WIP piles, assign by tap.
- Bottleneck math, learning curve, one breakdown type.
- Placeholder rhythm audio (one layer per station).
- Headless sim + 1 bot + deterministic tests.

**Exit criteria:** 5-person phone playtest: ≥ 4/5 say "I wanted to fix the line"; players find the bottleneck in < 5 s; sim deterministic across seeds; 60 fps on throttled phone.

## Phase 1 — "The Family Workshop" (MVP vertical slice: Ch0–Ch2, ~8 weeks)

- Chapters 0–2: assign, bundles, orders & vessel, hiring, quality & inspection, mechanic.
- Family scenes for Ch0–Ch2 (Má, Uncle Sáu, Út's choice) with their effects; Golden Harbour trial CMT order in Ch1.
- Products: school shorts, basic shirt, polo. Buyers: Cô Mai, Hanil (Ms. Park), Sakura-ya (Mr. Watanabe).
- Fax inbox with quote cards; order board with vessel; live money and margins.
- Final inspection scene + defect post-mortem; Spot the Defect micro-game.
- Workers with skills, fatigue (basic), traits; mentor Bác Tư; Handbook v1.
- Shift report card; autosave per shift; PWA; desktop + mobile layouts; difficulty Apprentice/Seamstress/Line Leader; chapter stars.
- First art pass (floor, machines, workers, portraits), rhythm engine v1.

**Exit criteria:** tutorial ≤ 7 min (bot); shift 6–8 min; quiet ≤ 60% (target 50% by Phase 2); ≤ 2 systems per chapter (test); bot wins all chapters on default, doing nothing loses; ★★★ not reached by default bot; 10-player playtest: tutorial completion > 80%.

## Phase 2 — "The Fabric Hunt" (Ch3–Ch4 + Vietnamese, ~8 weeks)

- Ch3: FOB orders, supplier cards, shipments mini-map, warehouse, cutting room; Fabric Inspection and Marker Puzzle micro-games.
- Ch4: power cuts & generator, rain/flood events, second line, **Line Leader** automation.
- Products: workwear, jeans. Buyers: Golden Harbour moves to FOB orders (Mr. Leung), Formosa (Mrs. Lin). Family scenes Ch3–Ch4 (family loan, the flood).
- **Full Vietnamese localisation**; cultural review pass.
- Overlays (bottleneck, quality, heat); e-ink mode.

**Exit criteria:** quiet ≤ 50%; with Line Leaders the bot's taps/min in Ch4 ≤ Ch2 by hand; micro-games ≤ 15 s and ≥ 44 px targets; VI covers ≥ 95% of harvested strings; Vietnamese playtesters rate authenticity ≥ 4/5.

## Phase 3 — "Before Tết" (Ch5–Ch6, ~8 weeks)

- Family scenes Ch5–Ch6 (Tết at home, Bác Tư's scissors, Út returns, Uncle Sáu's favour).
- Ch5: full people system (morale, turnover, Tết return, 13th-month bonus, Labour Code overtime cap), training/mentoring, welfare upgrades.
- Ch6: Export Zone factory with up to 6 lines; Production Planner and Merchandiser; padded jackets, baby wear, yukata; Pearl River overflow orders.
- Achievements, career title, Daily Challenge with share line; Sandbox mode.

**Exit criteria:** "fair play wins" bot test green in every chapter from Ch5; taps/min flat Ch2→Ch6 (±20%); 60 fps with 6 lines on throttled phone; D1 retention measured in local opt-in telemetry.

## Phase 4 — "1997" (finale + polish, ~6 weeks)

- Ch7 finale: macro shock, diversification, Má's advice scene, ending scrapbook showing the family's choices.
- Difficulty "Ship Leaves Thursday"; ★★★ tuning; factory cat and cosmetics; radio songs.
- Accessibility audit (axe-core clean), French localisation, Handbook complete, performance pass.

**Exit criteria:** §18 metrics validated in a 20-player playtest (desktop + phone, including Vietnamese players); axe-core clean on every screen; campaign completable on every difficulty by the bot.

## Phase 5 — "Sandbox & Beyond" (post-launch, parked)

Scenario editor and share codes; multiple factories (Saigon + Hà Nội); a domestic brand storyline (ready-to-wear for the new Vietnamese middle class); a 2000s sequel era (WTO 2007, computerised planning); seasonal events; community-made buyers.

---

## Appendix A: Glossary (shown in the Handbook)

| Term | Meaning in the game |
|---|---|
| **CMT** | Cut-Make-Trim: buyer supplies fabric, you are paid for sewing |
| **FOB** | You source materials and deliver to the ship; more margin, more risk |
| **SMV** | Standard Minute Value: minutes one operation takes at 100% efficiency |
| **Bundle** | A tied pack of cut pieces that travels through the line with its ticket |
| **WIP** | Work in progress: the pile in front of a station |
| **Bottleneck** | The slowest station; it sets the line's speed |
| **Marker** | The layout of pattern pieces on fabric before cutting |
| **Shade lot** | Rolls dyed together; mixing lots shows colour differences |
| **AQL** | Acceptable Quality Level: how many defects the buyer tolerates in a sample |
| **PP sample** | Pre-production sample approved before bulk sewing |
| **Vessel cut-off** | Last moment the container can reach the ship |
| **Per dozen** | Garment prices are quoted per 12 pieces |
| **13th-month salary** | The Tết bonus, traditionally one extra month's pay |

## Appendix B: Decision log

| # | Decision |
|---|---|
| D1 | Core verb = Assign; WIP piles are the alarms |
| D2 | Products as operation sequences with SMV; learning curve; staged complexity |
| D3 | Buyers = fictional companies with named contacts and habits; no caricature |
| D4 | Final inspection as the order's boss fight; traceable defects |
| D5 | Vessel cut-off with live margin projection |
| D6 | CMT vs FOB; supplier cards; fabric inspection & marker micro-games |
| D7 | Workers are people; welfare pays; exploitative play never wins |
| D8 | 1990s history as mechanics (fax, power cuts, monsoon, EPZ, 1997) |
| D9 | Warm top-down 2.5D art; the line is the music |
| D10 | One shift ≈ 6–8 min; DCM guardrails in CI |
| D11 | Automation by hiring (Line Leader, Planner, Merchandiser) |
| D12 | Out of scope list (no bribery, no real brands, no exploitation wins, no 3D/multiplayer/backend) |
| D13 | Family storyline: yes, 1–2 scenes per chapter, every choice has a visible game effect, all paths winnable (§11.1) |
| D14 | Hong Kong buyers early (trial CMT in Ch1, FOB from Ch3); mainland China overflow late (Ch6) |
| D15 | No real-interview "stories" page; Handbook stays game terms and fictional characters |

---

## Phase 0 results (build 0.0.1, "Paper Pattern")

**Shipped:** one shift (07:00–16:30, lunch 11:30–12:00) of Cô Mai's school shorts. One line of 7 machines (5 lockstitch, 2 overlock; 6 operations + 1 spare), 7 seamstresses with skills per machine type and a per-operation learning curve (50% → 100%, +2 points per piece; 85% on yesterday's operation). Bundles of 10 flow down the line; piles show the bottleneck (dashed amber ≥ 4 bundles, solid red ≥ 7). Needle breakdowns (wear-driven) are fixed by the director, who walks to the machine. Assign by tap (swap if occupied); any machine can be retargeted to an operation of its type. Placeholder rhythm audio (one percussion pattern per working station), mentor tips (Bác Tư), notebook shift report, date-seeded day with `?seed=`. Deployed to GitHub Pages on every push.

**Measured with the bot** (Sysadmin-equivalent default, 12–16 seeds):

| Player | Pieces (avg) | Range | Notes |
|---|---:|---|---|
| Does nothing | ≈ 95 | 30–190 | Lan stays on the bench, spare idle, broken machines stay broken |
| Autopilot (competent) | ≈ 310 | 300–350 | Fixes, seats the bench, points the spare at the bottleneck |
| Smart opening (Lan + Hương both on pockets) | ≈ 350 | 340–360 | One good insight at 07:00 |
| Best possible seating (brute force, 5,040 × 4 plans) | ≈ 400 | — | Ceiling, no walking cost |

Stars set from these: ★ 290 · ★★ 340 · ★★★ 370. Breakdowns average ≈ 3 per shift (1–8). One shift = 6.3 real minutes at 1×. Bundle 12 KB gzipped JS.

**Exit criteria status**

| Criterion | Status |
|---|---|
| Sim deterministic across seeds | ✅ tested (JSON round trip mid-shift continues identically) |
| Line output = bottleneck | ✅ property test (±7%) |
| Bot passes, doing nothing fails, ★★★ not free | ✅ tested on 16 seeds |
| Shift 6–8 min; no 90 s stretch with nothing moving | ✅ tested |
| Plays on desktop and phone without errors | ✅ Playwright smoke (1280×800 and Pixel 5) |
| 60 fps on a throttled phone | ⏳ to measure (port DCM's `perf-probe.mjs`) |
| 5-person phone playtest: ≥ 4/5 "wanted to fix the line"; bottleneck found in < 5 s | ⏳ needs humans |

**Next:** run the playtest, then decide whether moving people mid-shift (and losing the learning) feels like a good trade-off or like a punishment, before Phase 1 builds on it.

---

## Phase 1 results (build 0.1.0, "The Family Workshop")

**Shipped**
- **Campaign:** title screen with chapter select (unlock by ★), three difficulties, autosave at every shift end and "Continue", chapter intro cards with star goals, chapter-end notebook with ★ checklist, Next/Replay.
- **Chapter 0 · The Family Workshop** (1 shift): the Phase 0 line, now inside the campaign. Family scene at the end: *Má's machines* (keep: +$40 and 20% more breakdowns later; sell: −$40 and 30% fewer).
- **Chapter 1 · The First Fax** (6 shifts): Hanil's shirt fax with three quote cards, Ms. Park's "+15%, same vessel" change, Uncle Sáu's letter (accept → Mr. Leung's trial order of shorts on day 2), 10 machines and 7 seamstresses so hiring is required, changeovers between products, overtime, vessel cut-off (air freight in 2 days for half the order value, or a short shipment with a penalty), wages/rent/electricity every evening, bankruptcy after 2 days in the red.
- **Chapter 2 · The Man with the Ruler** (6 shifts): Sakura-ya polo order with strict AQL inspection, Spot the Defect sample check (3 differences in 15 s; up to −30% defects), traceable defects (skill, learning, needle wear, fatigue) with a post-mortem table and remedies, QC table and QC inspectors with rework back to the operation that caused the defect, re-check after a rejection, mechanics who fix breakdowns unasked and change worn needles, Hanil's reorder fax, Lan absent on day 4, Út's choice (join: a free quick learner; Osaka: Sakura-ya samples approved with the best rating).
- **People:** skills per machine type (lockstitch, overlock, buttonhole, QC), learning per operation, basic fatigue (overtime), six traits, four applicants every morning, hire / let go.
- **UI:** bottom panel tabs (Line, Orders, Team, Handbook), fax cards, inspection stamp, day report on a notebook page, Bác Tư tips at teaching moments (stored, replayable in the Handbook), glossary.
- **Art pass v1:** top-down seamstresses (cap, hair, coat colour, efficiency ring, "z" when tired), three machine silhouettes plus the QC table, per-product fabric colours, rework bundles in red, mechanic and director agents, tiled floor; layouts for 7–13 machines in portrait (two columns) and landscape (two rows).
- **Rhythm engine v1:** any number of stations, pitch by machine type; fax screech, cash register, needle twang.
- **PWA:** manifest and offline service worker. Bundle: 31 KB gzipped JS.

**Measured with the bot** (Seamstress difficulty, 8 seeds per chapter)

| Chapter | Bot stars | Cash at end | Overtime days | Breakdowns | Quiet time |
|---|---|---:|---:|---:|---:|
| 0 | ★★ ×7, ★ ×1 | — | 0 | 0–6 | 29–30% |
| 1 | ★★ ×8 | $1,051–1,058 | 2–3 | 19–40 | 17–26% |
| 2 | ★★ ×4, ★ ×4 | $1,355–1,556 | 1–2 | 14–27 | 32–43% |

Doing nothing earns no star in any chapter. In Chapter 1 the bot always needs overtime, so it never gets ★★★ (which requires no overtime); in Chapter 2 it fails the first inspection on some seeds.

**Exit criteria status**

| Criterion | Status |
|---|---|
| Tutorial ≤ 7 min | ✅ Chapter 0 is one 6.3-minute shift |
| Shift 6–8 min | ✅ tested |
| Quiet ≤ 60% | ✅ tested per chapter (17–43%; the 50% Phase 2 target is already met) |
| ≤ 2 new systems per chapter | ✅ tested (line → orders + hiring → quality + mechanic) |
| Bot wins every chapter, doing nothing loses, ★★★ not free | ✅ tested on 8 seeds per chapter |
| Every family path winnable and changes the game | ✅ tested (Má's machines, Uncle Sáu, Út) |
| Every failed inspection traceable to recorded causes | ✅ tested |
| Plays on desktop and phone without errors | ✅ Playwright: Ch0 seating, Ch1 fax + hiring, Ch2 sample micro-game |
| 10-player playtest, tutorial completion > 80% | ⏳ needs humans |

**Deviations from the plan**
- Buyer reputation is not modelled yet; "Sakura-ya will remember" is flavour until Phase 2. Uncle Sáu's later favour (Ch6) and the family loan (Ch3) are Phase 2/3 content.
- Hong Kong's trial order is shorts (CMT), matching D14; FOB sourcing starts in Ch3 as planned.
- The QC table only inspects when someone sits there; an empty QC table lets garments through unchecked (a softer failure than blocking the line).
- No e-ink mode yet (planned for Phase 2).

---

## Phase 2 results (build 0.2.0, "The Fabric Hunt")

**Shipped**
- **Chapter 3 · The Fabric Hunt** (7 shifts, 1994): FOB orders where you buy the fabric. Three suppliers (Bình Minh: cheap, close, uneven shade; Daegu: excellent, 3 days, customs holds; Kowloon: fast, dear, wrong colour sometimes), shipments that arrive at 10:00 or a day late, fabric rolls that can be flawed or off-shade, inspection on arrival (micro-game, the cutter, or skip) with refunds for bad rolls, marker efficiency (micro-game or standard 78%), a **cutting table** that feeds every line, re-cutting of pieces scrapped for fabric defects. Orders: Hanil CMT shirts, Mr. Leung's FOB work jackets, Mrs. Lin's optional rush shorts. Family: **Má's savings** (+$300 now, −$330 at the end).
- **Chapter 4 · Rain and Darkness** (7 shifts, rainy season 1994): **two lines** (orders only go to a line that has the machines they need; jeans need the bartack machine on line B), **power cuts** that stop the sewing machines (QC and cutting are by hand), a **generator** started by you (8 minutes, may fail if untested) or by an **electrician** (3 minutes, always), diesel costs, **roof leaks** on rainy days that spoil rolls unless the warehouse has **pallets**, the **flood** day (shipments delayed; family scene: close the afternoon to help the neighbours → two strong applicants the next morning), **line leaders** who balance their own line every 15 minutes. Orders: Mrs. Lin's jeans (CMT), Mr. Leung's jackets (FOB), Sakura-ya's optional polo reorder. Products added: work jackets (10 operations), jeans (11, including bartacks).
- **People:** new roles (cutter, electrician, line leader), eight veteran crew members, six applicants a day in Chapter 4, specialists on the first morning in addition to the usual applicants.
- **UI:** Fabric tab (suppliers with prices, lead times and notes, shipments with expected day and customs holds, warehouse, pallets), Team tab leader assignment, line badges and per-line counts, power and rain indicators, **bottleneck and quality overlays** (◐ button or `O`), two micro-games (**Fabric Inspection**, **Marker Puzzle**), new Bác Tư tips for every new system.
- **Vietnamese:** a number- and name-aware translator over every panel, card, toast, micro-game and canvas label, a 600-entry dictionary with garment-trade vocabulary (chuyền, bó hàng, KCS, thùa khuy, giác sơ đồ, gia công…), whole-text tips, language switch on the title screen (defaults to Vietnamese on Vietnamese devices).
- **E-ink mode:** auto-detected (`update: slow` / `monochrome`) or chosen on the title screen or with `?eink=1`; greys only, hatched bundles instead of fabric colours, no flights or needle animation, at most two redraws per second.

**Measured with the bot** (Seamstress difficulty, 8 seeds per chapter)

| Chapter | Bot stars | Cash at end | Overtime days | Quiet time (avg, max) | Bot actions per game hour |
|---|---|---:|---:|---:|---:|
| 0 | ★★ ×6, ★ ×2 | — | 0 | 23%, 24% | 0.56 |
| 1 | ★★ ×8 | $1,020–1,034 | 1–3 | 22%, 23% | 0.73 |
| 2 | ★★ ×7, ★ ×1 | $1,535–1,546 | 2–3 | 20%, 21% | 0.55 |
| 3 | ★★ ×8 | $1,704–1,754 | 1–4 | 25%, 32% | 0.54 |
| 4 | ★★ ×7, ★ ×1 | $2,174–2,290 | 2–6 | 27%, 42% | 0.54 |

The bot never reaches ★★★ in any chapter; doing nothing earns no star in any chapter; every family choice (Má's machines, Uncle Sáu, Út, Má's savings, the flood) still wins.

**Exit criteria status**

| Criterion | Status |
|---|---|
| Quiet ≤ 50% | ✅ tested per chapter on the average of 8 seeds (no seed above 75%); measured 20–27% |
| With line leaders, taps/min in Ch4 ≤ Ch2 by hand | ✅ tested (0.54 vs 0.55 actions per game hour) |
| Micro-games ≤ 15 s, targets ≥ 44 px | ✅ Spot the Defect 15 s, Fabric Inspection ≤ 13 s, Marker Puzzle 15 s; marker cells ≥ 44 px, roll swatch 120 px |
| VI covers ≥ 95% of harvested strings | ✅ tested: 100% of ≈160,000 segments harvested from all five chapters (views + canvas) |
| Vietnamese playtesters rate authenticity ≥ 4/5; cultural review | ⏳ needs native speakers: the dictionary is marked for review |
| Bot wins every chapter, ★★★ not free, ≤ 2 systems per chapter | ✅ tested (Ch3: sourcing + cutting; Ch4: power + leaders) |
| Desktop and phone without errors | ✅ Playwright: Ch0 seating, Ch1 hiring, Ch2 sample, Ch3 marker + buying, Ch4 two lines + overlay, Vietnamese title |

**Notable fixes found while building**
- A needle change late in the day kept a machine blocked the next morning (service time carried across days).
- An order missing a few scrapped pieces could never finish; scrapped pieces are now re-cut rounded up to a whole bundle.
- The flood "help" choice closed the whole day instead of the afternoon.
- Answering one card could open another (fax → marker) that froze the world until answered; the bot and the test helper now loop.

**Deviations from the plan**
- Trims (zippers, buttons) are not modelled; fabric is the only material.
- Heat overlay not built (heat is not simulated yet); bottleneck and quality overlays shipped instead.
- The marker puzzle uses tap-to-place on a 4-wide strip (no free dragging) to keep 44 px targets on phones.
- Line leaders reuse the bot's balancing rules; there is no priority setting yet.
