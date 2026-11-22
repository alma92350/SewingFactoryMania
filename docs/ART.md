# SewingFactoryMania: Art Bible (Canvas 2D)

Status: spec for implementation. Target files: `src/render/renderer.ts` (drawing), `src/ui/style.css`
(chrome tokens), `public/icon.svg` (app icon), `index.html` (`theme-color`). `layout.ts` is **not** changed:
every recipe below is expressed in the units it already produces.

Read with PRD §15 ("top-down 2.5D, clean flat style, readable silhouettes, warm palette, pale green walls,
cream floors, fabrics as the main colour source … E-ink greyscale versions of every sprite").

---

## 0. Conventions used in this document

0.1 **Units.**
- `cell`, `table` (`t`), `pile`, `label` are the `StationCell` rects from `layout.ts`.
- `mx, my, mw, mh` are the machine box already computed in `drawStation`
  (`mw = min(t.w*0.42, 38)`, `mh = min(t.h*0.55, 24)`). Machine recipes are written as fractions of `mw`/`mh`.
- `R` = `layout.radius` (8..20). `r` = the radius passed to `body()` (workers `R`, agents `0.85R`, staff `0.8R`).
- All coordinates are CSS pixels (the context already has `setTransform(dpr…)`).

0.2 **Recipe notation.** `rr(x,y,w,h,k)` = the existing `roundRect` helper followed by `fill()`.
`ell(cx,cy,rx,ry)` = `beginPath(); ellipse(cx,cy,rx,ry,0,0,2π); fill()`. `circ(cx,cy,rad)` = same with `arc`.
`line(x1,y1,x2,y2,w,col)` = stroked segment, `lineCap='round'`. `cap(x,y,w,h)` = a capsule
(`rr` with `k = min(w,h)/2`). Several shapes of one colour are **added to one path and filled once**.

0.3 **Animation clock.** Add to the renderer:
```ts
let motionOn = true;                      // false when einkOn or prefers-reduced-motion
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const syncMotion = () => (motionOn = !einkOn && !mq.matches);
mq.addEventListener('change', syncMotion); // also call syncMotion() inside setEink()
// in draw():  const T = motionOn ? timeMs : 0;   pass T (not timeMs) to every sub-draw
```
Every animated value in this document is a function of `T`; with `T = 0` each one must give a sensible
**rest pose** (needle up, fan blades at 0 rad, cat sitting, walk frame 0). The existing `bob`, `snip`,
selection pulse, "z" bob, cat tail and rain offset switch to `T` too.

0.4 **Frame-quantised sprites.** Two-frame cycles use `f = (T / 180 | 0) & 1`. No per-frame randomness:
use `hash(id)` (the existing `workerColor` hash) or `st.index` for phase offsets.

0.5 **E-ink rule.** In e-ink every filled shape that would otherwise be identified only by colour gets a
`1px #000` outline, and state is carried by shape (outline weight, hatch, dash), never by grey level alone.

---

## 1. Direction

1.1 **Camera.** Top-down with a 2.5D cheat: objects are seen from straight above **except people and
machines**, which are drawn as small upright icons (head above shoulders on screen, machine heads in side
profile), like a board game with standees. Every solid object casts a soft drop shadow offset `(0, +2px)`
(tables, cartons) or a flat ellipse under it (people, cat). No light direction other than "from the top of
the screen".

1.2 **Mood.** A family workshop in Hồ Chí Minh City, 1990s: worn cream terrazzo, pale green lime-washed
walls, varnished wood tables, black-enamel lockstitch machines with gold decals, a red telephone and a red
thermos in the office, fluorescent tubes, ceiling fans, tin lunch boxes, a supplier's wall calendar. Fabrics
and the workers' coats are the **only saturated colours**; everything else is warm and muted so the fabric
flow and the people read first. No conical hats, no lanterns, no clichés.

1.3 **Shape language.** Rounded rectangles (corner `k` 2–6 px), ellipses and capsules. Strokes are rare
(1–1.5 px, darker shade of the fill) and used for edges and outlines, never for decoration. No gradients at
draw time except pre-built ones in the static layer (§3.1).

1.4 **Readability first.** Station labels, zone labels, line tags and initials keep their current
position, font and size. Nothing decorative is drawn inside a `label` rect. Decorative contrast on the floor
is capped (terrazzo chips differ from the floor by ≤ 12 % lightness) so text on the floor stays ≥ 4.5:1.

---

## 2. Palette

2.1 **Tokens** — replace `COLOUR` / `EINK` with this set (keep the existing keys, add the new ones).

| key | normal | e-ink | use |
|---|---|---|---|
| floor | `#efe4cc` | `#ffffff` | terrazzo base |
| floorJoint | `#ddd0b2` | `#e6e6e6` | tile joints (1 px) |
| chipA / chipB / chipC / chipD | `#d6c7a6` / `#f8f1e0` / `#c9b48f` / `#bfcab2` | none | terrazzo chips |
| wall | `#cfe0c6` | `#d9d9d9` | wall frame (pale green lime-wash) |
| wallTrim | `#8fae86` | `#000000` | skirting line |
| window | `#bcd6e6` | `#ffffff` | window slits in top wall |
| tube | `#fdfdf6` | `#ffffff` | fluorescent tube |
| zoneOffice | `#e8d6b4` | `#f2f2f2` | office floor (parquet) |
| zoneOfficeLine | `#d6bf95` | `#d9d9d9` | parquet seams |
| zoneBench | `#dfe8d8` | `#ececec` | rest area |
| zoneCut | `#e3e5dc` | `#ffffff` | cut-fabric store (cool concrete) |
| zonePacked | `#ead9b8` | `#f2f2f2` | packing area (kraft) |
| zoneEdge | `rgba(90,70,40,0.18)` | `#000000` | 1 px zone border |
| ink | `#2b2a26` | `#000000` | all primary text |
| muted | `#5f5a4f` | `#333333` | secondary text (darker than today's `#6f6a5e` for contrast on tinted zones) |
| zoneLabel | `#4a463d` | `#000000` | zone names |
| table | `#cfa86f` | `#d9d9d9` | machine table top |
| tableHi | `#dfbf8c` | `#ffffff` | 1 px top-edge highlight |
| tableEdge | `#8f6c3e` | `#000000` | table outline |
| tableShadow | `rgba(70,45,10,0.20)` | `rgba(0,0,0,0.25)` | drop shadow |
| cutTable | `#dcc79c` | `#ececec` | cutting table |
| qcTable | `#ece6d3` | `#ffffff` | QC table |
| stool / stoolTop | `#8a5f30` / `#b88a50` | `#000000` / `#bbbbbb` | seats |
| wood / woodTop / woodEdge | `#9c6b3c` / `#b07a45` / `#6e4a28` | `#888888` / `#cccccc` / `#000000` | desk, bench |
| lockstitch / lockDecal | `#2e3438` / `#c9a24a` | `#222222` / `#ffffff` | black enamel + gold |
| overlock / overlockCover | `#7fa596` / `#e9efe9` | `#888888` / `#ffffff` | mint-grey |
| buttonhole / buttonholeClamp | `#cdc5ad` / `#5b6b78` | `#dddddd` / `#444444` | cream + slate |
| bartack / bartackBox | `#4f6b5a` / `#2b3a31` | `#555555` / `#000000` | bottle green |
| metal / metalDark / needle | `#b8bec2` / `#7d868c` / `#e6eaec` | `#bbbbbb` / `#444444` / `#000000` | wheels, knife, needles |
| dustCover / dustFold | `#d8ccb0` / `#bfae8a` | `#ffffff` / `#000000` | spare-machine cover |
| broken | `#c0392b` | `#000000` | |
| warn | `#d98a00` | `#555555` | |
| warnSign | `#f2c230` | `#ffffff` | hazard triangle fill |
| danger | `#c0392b` | `#000000` | |
| ok | `#2e7d32` | `#000000` | speed ring good |
| select | `#1f7a5c` | `#000000` | |
| carton / cartonDark / cartonTape | `#c09a62` / `#8a6a3a` / `#d9bd85` | `#cccccc` / `#000000` / `#ffffff` | |
| shipMark | `#2b2a26` | `#000000` | carton stencil |
| greige | `#d8cfbd` | `#eeeeee` | undyed fabric rolls |
| skin / hair | `#e2b48a` / `#2b2320` | `#dddddd` / `#000000` | |
| trousers | `#3b3a40` | `#000000` | walking legs |
| director | `#1f7a5c` | `#000000` | marker diamond + "You" |
| shirt | `#f4f1e8` | `#ffffff` | director shirt |
| mechanicSuit / mechanicStrap | `#2f5f9e` / `#5d86c0` | `#444444` / `#bbbbbb` | blue overalls |
| mechanic | `#d35400` | `#333333` | toolbox, service badge, repair arc (unchanged) |
| electrician / helmet | `#6f6a2e` / `#f2c230` | `#444444` / `#ffffff` | khaki shirt + yellow helmet |
| leader | `#6a1b9a` | `#222222` | |
| clip / clipPaper | `#a5773f` / `#fffaf0` | `#000000` / `#ffffff` | clipboard |
| sweat / heart | `#5aa9e6` / `#e0475b` | `#ffffff` / `#000000` | mood cues |
| catFur / catStripe / catBelly | `#e08a2e` / `#b5651d` / `#f6d7a8` | `#888888` / `#000000` / `#ffffff` | |
| phone / thermos / teaGlass / fax | `#b23a3a` / `#d64541` / `#c98a2b` / `#e7e2d3` | `#444444` / `#888888` / `#bbbbbb` / `#ffffff` | office props |

2.2 **Line colours** (tags, tint, lane): `LINE = ['#8e2453', '#2f4b7c', '#1f6b6b', '#8a5a00']`, picked by
`lineId % 4` (today `i % 2`). All four carry white 10 px bold text at ≥ 5:1. Tint = line colour at
`alpha 0.06`. E-ink: tag `#000`, no tint.

2.3 **Worker coats** stay as they are (`WORKER_COLORS`, `HIRE_COLORS`) — they are identity. Derived shades
are computed once per colour and memoised: `shade(hex, -0.18)` for arms/sleeves (`coatDark`).
Initials text colour: `#ffffff`, or `ink` when the coat's relative luminance > 0.55 (only `#c0ca33` today).

2.4 **Product fabrics** (`PRODUCTS[*].fabric/tie`) stay the main colour source for bundles, lays, rolls,
spool thread and cartons' contents. Rework bundles stay `#e57373` / `#fff`.

---

## 3. Factory floor and zones

### 3.1 Static layer (the single biggest win)

3.1.1 Add `private bg: HTMLCanvasElement` sized `width*dpr × height*dpr`. Rebuild it when any of these
change: layout object (`relayout`/`resize`), `einkOn`, the station signature
`stations.map(s => s.machine + (s.opId ? 1 : 0)).join()`, `s.welfare.fans` (§6.2), `cosmetics.calendar`.
Keep the key as a string; compare each frame (cheap).

3.1.2 `draw()` starts with:
```ts
ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(this.bg, 0, 0); ctx.setTransform(dpr,0,0,dpr,0,0);
```
and the old floor fill + tile loop are deleted.

3.1.3 Static layer contents, **in this order**: floor (3.2), light pools (3.4), wall frame (3.3), zone bases
and furniture (3.5–3.8), line tints and lanes (3.9), for every station: table shadow, table, stool (4.1),
QC lamp light pool (4.7). Nothing that moves or changes with game state goes here.

### 3.2 Terrazzo floor

```
fill floor over the whole canvas
TILE = 32
rng = mulberry32(1990)                       // fixed seed: the floor never "shimmers" between rebuilds
for each tile (tx, ty):                       // tx, ty in steps of TILE from 0
  for k in 0..5:
    x = tx + rng()*TILE; y = ty + rng()*TILE; s = 0.8 + rng()*1.4
    colour = [chipA, chipA, chipB, chipC, chipD][rng()*5|0]
    rng() < 0.5 ? fillRect(x, y, s, s) : circ(x, y, s*0.6)
joints: one path of all vertical lines x = n*TILE+0.5 and horizontal lines y = n*TILE+0.5,
        stroke floorJoint, lineWidth 1
every 4th tile (tx/TILE + ty/TILE) % 4 == 0: fillRect(tile, 'rgba(255,255,255,0.10)')   // worn patches
```
E-ink: white floor, joints only, no chips, no worn patches.

### 3.3 Wall frame

The 8 px `PAD` margin around the canvas is the wall.
```
fill wall in the 4 margin bands (0..PAD on each side)
stroke wallTrim, 1.5 px, rect(PAD-0.75, PAD-0.75, W+1.5, H+1.5)       // skirting
top band only: every 140 px starting at x = 40:
  window: fillRect(x, 1.5, 30, 4) window colour; 1 px wallTrim outline
  tube:   at x + 70: fillRect(x+70, 2, 24, 3) tube; strokeRect 1px 'rgba(0,0,0,0.15)'
```
During rain (`s.power?.rain`) windows are drawn **in the dynamic pass** over the static ones in `#9fb2c0`
(4 rects, negligible).

### 3.4 Fluorescent light pools

For each line group (each `lineRects[k]`, or the bounding box of all stations when there is one line):
one elliptical radial gradient, built once in the static layer:
```
cx = rect centre; rx = rect.w*0.55; ry = rect.h*0.55
g = createRadialGradient(cx, cy, 0, cx, cy, max(rx, ry)) ; stops 0: 'rgba(255,250,232,0.30)', 1: 'rgba(255,250,232,0)'
ctx.save(); translate(cx,cy); scale(rx/max, ry/max); fill circle radius max with g; restore
```
E-ink: skip.

### 3.5 Zone base (replaces `zone()`)

```
zoneBase(r, fill):  shadow rr(r.x, r.y+2, r.w, r.h, 8) tableShadow at 0.5 alpha
                    rr(r.x, r.y, r.w, r.h, 8) fill ; stroke zoneEdge 1 px
zoneLabel(r, text): font '600 11px system-ui'; fillStyle zoneLabel; fillText(text, r.x+6, r.y+13)   // same spot as today
```
The base and furniture go in the static layer; the label (it is translated text) is drawn in the dynamic
pass right after the blit so translation changes apply without a rebuild.

### 3.6 Office

Base `zoneOffice`. Parquet: inside the rect, clip to the rounded rect and stroke horizontal seams every 8 px
(`zoneOfficeLine`, 1 px) and short vertical seams staggered every 24 px (offset 12 px on odd rows).

Desk (landscape): `D = { x: o.x + o.w*0.40, y: o.y + 18, w: o.w*0.38, h: min(o.h*0.30, 26) }`.
Portrait (`o.w < 110`): `D = { x: o.x + o.w*0.42, y: o.y + 16, w: o.w*0.52, h: min(o.h*0.28, 20) }`.
The officeSpot people (y = 0.62h) stand just below it; the calendar (landscape) is to its right.
```
desk:    rr(D.x, D.y+2, D.w, D.h, 3) tableShadow; rr(D) woodTop; stroke woodEdge 1px
fax (landscape only), left end:  fw = D.h*0.9, fh = D.h*0.6, fx = D.x+3, fy = D.y + (D.h-fh)/2
         rr(fx, fy, fw, fh, 2) fax; stroke '#8f8670' 1px
         fillRect(fx+fw*0.15, fy+fh*0.30, fw*0.70, 1.5) ink            // paper slot
         fillRect(fx+fw*0.22, fy-fh*0.25, fw*0.56, fh*0.35) '#ffffff'   // sheet sticking out
         2×3 key dots, 1px, metalDark at (fx+fw*0.2 + i*fw*0.15, fy+fh*0.65)
phone:   px = D.x + D.w*(landscape ? 0.48 : 0.12), py = D.y + D.h*0.5, s = D.h*0.32
         rr(px, py - s*0.7, s*2, s*1.4, s*0.35) phone
         cap(px - s*0.15, py - s*0.95, s*2.3, s*0.5) '#2b2320'            // handset
         circ(px + s, py + s*0.15, s*0.35) '#f0e6d2'                       // dial
thermos: tx = D.x + D.w - D.h*0.30, ty = D.y + D.h*0.5
         circ(tx, ty, D.h*0.24) thermos ; circ(tx, ty, D.h*0.13) '#f0e6d2' (cap) ; circ(tx, ty, D.h*0.05) thermos
tea:     two glasses: circ(tx - D.h*0.45, ty - D.h*0.15 / +D.h*0.18, D.h*0.10) teaGlass alpha 0.85, 1px '#ffffff' rim
```
The generator badge (bottom-left) and electrician spot are unchanged.

### 3.7 Bench (rest area)

Base `zoneBench`. In the **dynamic** pass (the row count depends on how many people sit there), before
workers: for each occupied bench row (from `benchSlot`) draw one plank under the sitters:
```
y = slotRowY + 0.30R ; x0 = b.x + 4 ; w = min(b.w - 8, perRowUsed * step + 6)
rr(x0, y+2, w, 0.55R, 3) tableShadow ; rr(x0, y, w, 0.55R, 3) wood ; stroke woodEdge 1px
seam: fillRect(x0+2, y + 0.27R, w-4, 1) woodEdge alpha 0.5
legs: fillRect(x0+3, y+0.55R, 3, 2) and fillRect(x0+w-6, …) woodEdge
```
Landscape only, when the free space at the right of the bench is ≥ 40 px: a radio at the far right
(`rr(bx, b.y+18, 22, 12, 3)` '#6b4a2b'; grille = 3×4 dots `#d9c39a`; dial `circ` `#e8c547` r 2) and a
**tin lunch-box stack** (§6.5 recipe) next to it. In portrait the right 45 % of the bench is the line picker:
draw nothing decorative there.

### 3.8 Cut fabric and Packed

**Cut fabric.** Base `zoneCut`. Rolls (dynamic, they depend on `s.warehouse`):
```
n = min(rolls in store, landscape ? 6 : 2)
landscape: roll i: x = r.x+6, y = r.y + 46 + i*(rh+3), w = r.w - 12, rh = min(9, (r.h*0.30)/6)
           stop before y > r.y + r.h*0.45 so bundles (drawn bottom-up) keep the lower half
portrait:  roll i: end-on circles at (r.x + r.w - 8 - i*13, r.y + 9), radius 5 (top-right corner, clear of text)
roll (lying):  cap(x, y, w, rh) colour ; fillRect(x+rh/2, y+rh*0.15, w-rh, 1) 'rgba(255,255,255,0.35)' (sheen)
               ell(x + w - rh/2, y + rh/2, rh*0.28, rh/2) shade(colour,-0.15) (end) ; circ(same, rh*0.12) '#fffaf0' (core)
roll (end-on): circ(cx, cy, 5) colour ; stroke shade(colour,-0.2) 1px ; circ(cx, cy, 1.6) '#fffaf0'
colour: roll 0 = active product fabric, then alternate greige / shade(fabric, +0.15)
e-ink:  white with 1px black outline, core black dot
```
Text lines (`… bundles`, `rolls in store`) keep their positions; rolls never overlap y ∈ [r.y+16, r.y+44].

**Packed.** Base `zonePacked`; cartons per §5.3 at the current carton positions and size (`cw`, `cw*0.7`).

### 3.9 Line tints, lanes and tags

Static: per `lineRects[k]`, `rr(r.x+1, r.y+1, r.w-2, r.h-2, 8)` with line colour at `alpha 0.06`; then
**painted safety lanes** along the two long edges: stroke `'rgba(217,179,16,0.55)'` (`#d9b310`), 2 px,
`setLineDash([10,6])`, inset 2 px. E-ink: `#000`, 1 px, dash `[4,4]`, no tint.

Dynamic tag (same rect and text position as today: `x = r.x+4, y = r.y+1, h = 14`, bold 10 px, text at
`r.x+9, r.y+12`): `rr(…, 4)` line colour; inner stroke `rgba(255,255,255,0.35)` 1 px; a 2 px bottom
shadow `rr(x, y+1.5, w, 14, 4)` `rgba(0,0,0,0.18)` drawn first. **Cache the measured width** per
label string (`Map<string, number>`, cleared on language change).

---

## 4. Stations and machines

### 4.1 Table and seat (static layer)

```
rr(t.x, t.y+2, t.w, t.h, 5) tableShadow
rr(t.x, t.y, t.w, t.h, 5) table  (cutTable for cutting, qcTable for qc) ; stroke tableEdge 1.5px
fillRect(t.x+4, t.y+1.5, t.w-8, 1) tableHi                                   // varnish highlight
stool at seat (x, y): circ(x, y + 0.35R, 0.55R) stool ; circ(x, y + 0.30R, 0.42R) stoolTop
```
The worker body covers the stool when seated; an empty stool is the "nobody here" cue.

### 4.2 Draw order inside `drawStation` (dynamic)

1 selection outline (unchanged) → 2 pile (§5.2) → 3 machine by type (4.3–4.7) → 4 state layer (4.8) →
5 current bundle on the machine (unchanged rect, new bundle recipe) → 6 progress bar (unchanged, colours
`rgba(0,0,0,0.15)` / `select`) → 7 broken/service badge (4.8) → 8 labels (unchanged).

Thread colour for spools: `tc = PRODUCTS[active product].tie` (fallback `#f3ead7`). E-ink: `#ffffff` with
black outline.

### 4.3 Lockstitch — slim C-arm, one spool (black enamel, gold decal)

```
path (one fill, lockstitch):
  rr(mx,           my+0.68mh, mw,      0.32mh, 0.08mh)   // bed
  rr(mx+0.74mw,    my+0.08mh, 0.20mw,  0.70mh, 0.06mh)   // pillar
  rr(mx+0.10mw,    my+0.08mh, 0.84mw,  0.24mh, 0.12mh)   // arm
  rr(mx+0.08mw,    my+0.08mh, 0.20mw,  0.50mh, 0.06mh)   // head
fillRect(mx+0.34mw, my+0.17mh, 0.32mw, max(1, 0.05mh)) lockDecal
ell(mx+0.97mw, my+0.30mh, 0.07mw, 0.20mh) metal                         // handwheel
line(mx+0.55mw, my+0.08mh, mx+0.55mw, my-0.06mh, 1, metalDark)          // spool pin
rr(mx+0.50mw, my-0.18mh, 0.10mw, 0.14mh, 1) tc                           // spool
needle: line(mx+0.18mw, my+0.58mh, mx+0.18mw, my+0.70mh + bob, 1.5, needle)
foot:   fillRect(mx+0.12mw, my+0.66mh + bob*0.3, 0.12mw, 1.5) metalDark
```

### 4.4 Overlock — compact dome + row of four cones

```
fillRect(mx+0.12mw, my+0.10mh, 0.76mw, 1) metalDark                       // cone stand bar
cones k=0..3: circ(mx + (0.20 + 0.20k)mw, my+0.10mh, min(mw,mh)*0.11)  colours [tc, '#f3ead7', tc, '#f3ead7']
rr(mx+0.05mw, my+0.30mh, 0.90mw, 0.70mh, 0.30mh) overlock                 // dome body
rr(mx+0.12mw, my+0.50mh, 0.36mw, 0.40mh, 0.10mh) overlockCover            // looper cover
circ(mx+0.82mw, my+0.60mh, 0.14mh) metalDark                              // handwheel
4 threads: one path, lines from each cone to (mx+0.30mw, my+0.32mh), 1px 'rgba(0,0,0,0.25)'
needle: line(mx+0.30mw, my+0.36mh, mx+0.30mw, my+0.48mh + bob, 1.5, needle)
```

### 4.5 Buttonhole — flat wide head + sliding clamp plate

```
path (buttonhole): rr(mx, my+0.10mh, 0.86mw, 0.48mh, 0.06mh) + rr(mx+0.66mw, my+0.10mh, 0.20mw, 0.76mh, 0.05mh)
stroke '#8f8670' 1px
fillRect(mx+0.06mw, my+0.22mh, 0.50mw, 1) '#8f8670'                       // panel seam
spool: rr(mx+0.10mw, my-0.06mh, 0.10mw, 0.14mh, 1) tc
slide = running ? sin(T/260 + index)*0.04mw : 0
rr(mx+0.04mw + slide, my+0.66mh, 0.56mw, 0.24mh, 0.05mh) buttonholeClamp  // clamp plate
fillRect(mx+0.12mw + slide, my+0.75mh, 0.40mw, 0.06mh) needle             // the buttonhole slot
needle: line(mx+0.30mw, my+0.58mh, mx+0.30mw, my+0.66mh + bob*0.6, 1.5, needle)
```

### 4.6 Bartack — thick C-arm + control box + square clamp

```
path (bartack):
  rr(mx,          my+0.64mh, mw,     0.36mh, 0.08mh)   // bed
  rr(mx+0.70mw,   my+0.06mh, 0.26mw, 0.70mh, 0.06mh)   // pillar
  rr(mx+0.06mw,   my+0.06mh, 0.90mw, 0.34mh, 0.14mh)   // arm (thicker than lockstitch)
  rr(mx+0.04mw,   my+0.06mh, 0.28mw, 0.52mh, 0.06mh)   // head (wider)
rr(mx+0.66mw, my-0.16mh, 0.32mw, 0.22mh, 1.5) bartackBox                 // control box on top
circ(mx+0.92mw, my-0.05mh, max(1, 0.05mh)) running ? '#e74c3c' : '#5a2a2a' // pilot light
rr(mx+0.06mw, my+0.60mh, 0.28mw, 0.14mh, 1) metalDark                    // square clamp foot
zigzag on the clamp: one path M(mx+0.09mw, my+0.67mh) then 4 segments of ±0.03mh every 0.05mw, 1px '#ffffff'
needle: line(mx+0.18mw, my+0.58mh, mx+0.18mw, my+0.66mh + bob*0.5, 1.5, needle)
```
Silhouette test: lockstitch = thin C + one spool on top; overlock = rounded blob + 4 dots in a row;
buttonhole = wide box + bar below; bartack = fat C + block on top. They must be told apart in e-ink
(fills `#222` / `#888` / `#ddd` / `#555`, all with 1px black outline).

### 4.7 Cutting table and QC table

**Cutting table** (no machine box; uses the whole table `t`):
```
lay = { x: t.x+3, y: t.y+3, w: t.w*0.78, h: t.h-10 }     // leaves room for the progress bar
if st.current:                                            // fabric laid out
  fillRect(lay.x, lay.y+1, lay.w, lay.h) shade(fabric,-0.18)   // ply edge peeking below
  fillRect(lay) fabric
  marker paper: fillRect(lay.x+2, lay.y+2, lay.w-4, lay.h-4) 'rgba(255,255,255,0.80)'
  2 chalk pattern pieces, stroke 1px '#8a8578', in lay-relative units (u = lay.w, v = lay.h):
     piece A: M(.08u,.20v) L(.40u,.15v) L(.44u,.80v) L(.10u,.85v) Z
     piece B: M(.52u,.15v) L(.86u,.20v) Q(.92u,.50v, .86u,.82v) L(.54u,.85v) Z
roll at the right end: cap(t.x+t.w*0.82, t.y+4, t.w*0.14, t.h-12) fabric ; ends ell(…, rx 0.07*t.w*0.14…) shade -0.15
straight knife: kh = min(t.h*0.5, 14)
  kx = lay.x + lay.w * (working ? 0.2 + 0.6*(0.5 + 0.5*sin(T/700 + index)) : 0.7); ky = t.y + t.h*0.45
  rr(kx - kh*0.35, ky - kh*0.15, kh*0.7, kh*0.5, 2) metalDark         // base plate
  line(kx, ky - kh*0.55, kx, ky + kh*0.25, 1.5, needle)               // upright blade
  rr(kx - kh*0.12, ky - kh*0.75, kh*0.24, kh*0.25, 1) '#c0392b'         // handle
```
**QC table**:
```
lamp: arm = one path M(t.x+t.w-3, t.y+3) L(t.x+t.w*0.86, t.y+t.h*0.22) L(t.x+t.w*0.74, t.y+t.h*0.35), 1.5px metalDark
      L = min(t.h*0.20, 7); circ(t.x+t.w*0.74, t.y+t.h*0.35, L) '#f4e9c8', stroke muted 1px ; circ(same, L*0.45) '#fffbe8'
      light pool (static layer): radial 'rgba(255,240,190,0.45)'→0 radius 2.4L centred under the lamp
magnifier: M = min(t.h*0.18, 6); c = (t.x+t.w*0.38, t.y+t.h*0.45)
      circ(c, M) 'rgba(170,210,230,0.45)' ; stroke circle '#6b5a3e' 2px ; line(c + M*0.7(1,1), c + M*1.8(1,1), 2, '#6b5a3e')
folded garments: 2 offset rects at (t.x+5, t.y+t.h*0.55) size (t.w*0.18, t.h*0.18), fabric, 1px shade -0.2
```

### 4.8 Machine states

| state | test | recipe |
|---|---|---|
| running | `isWorking(s, st)` | `bob = abs(sin(T/70 + index)) * 0.12mh`; spool tick: on the first spool/cone draw a 1px `ink` radius line at angle `T/120`; pilot light on (bartack). |
| waiting | staffed, opId set, no `current` | rest pose (`bob = 0`), no extra marks. |
| spare | `opId === null` | draw the machine, then a **dust cover**: `rr(mx-1, my-0.2mh, mw+2, 1.2mh, 0.3mh)` dustCover; 2 fold lines `dustFold` 1px: `M(mx+0.3mw, my) Q(mx+0.35mw, my+0.5mh, mx+0.25mw, my+mh)` and the same at 0.7mw. |
| unstaffed | `!w && opId` | nothing on the machine; the empty stool (static) shows; label already red. |
| broken | `st.broken` | machine drawn normally, then `rr(mx-1, my-1, mw+2, mh+2, 3)` `rgba(192,57,43,0.22)`; **smoke**: 2 puffs, `ph = ((T/900) + index*0.37 + k*0.5) % 1`, `circ(mx+0.2mw + k*0.15mw, my - ph*0.9mh, 0.12mh + ph*0.18mh)` `rgba(140,140,140, 0.35*(1-ph))`; **spark**: when `((T/150|0) + index) % 6 === 0`, a 4-ray star of 1.5px `#f2c230` lines length `0.12mh` at the needle tip. |
| serviced | `st.serviceUntil > s.minute` or a fixing agent | badge = wrench (below). |

**Hazard badge** (broken; replaces the red triangle, same anchor `cx = mx+mw/2, cy = my-1`):
```
path M(cx, cy-13) L(cx+8, cy+2) L(cx-8, cy+2) Z ; fill warnSign ; stroke broken 1.5px, lineJoin 'round'
fillText('!', cx, cy) bold 10px ink, centred
```
**Wrench badge** (service, replaces the `'n'`):
```
circ(cx, cy-5, 8) mechanic
line(cx-3.5, cy-1.5, cx+2.5, cy-7.5, 2.2, '#ffffff')
beginPath(); arc(cx+3.2, cy-8.2, 2.6, 0.75π, 2.25π - 0.5π) ; stroke '#ffffff' 2px     // open jaw
```
The existing progress arc around the badge (radius 12, 3 px, mechanic/director colour) stays.
E-ink: broken = black triangle, white "!", plus `strokeRect` 2px `#000` around the table and a 1px X across
the machine box; serviced = black disc, white wrench, dashed (`[2,2]`) table outline.

---

## 5. Bundles, piles, cartons, rolls

### 5.1 Bundle (replaces `bundleRect`, same signature and footprint)

```
bundle(x, y, w, h, fabric, tie):
  rr(x, y, w, h, 1.5) fabric
  fillRect(x, y + h*0.72, w, h*0.28) shade(fabric, -0.18)          // ply edges: the cut stack seen from above
  fillRect(x + w*0.45, y, max(2, w*0.1), h) tie                     // the tie strip (unchanged)
  if w >= 12: circ(x + w*0.5, y + h*0.5, max(1, h*0.16)) shade(tie, -0.2)   // knot
  if w >= 14: fillRect(x + w*0.78, y + 1, w*0.14, h*0.4) '#fffaf0'           // bundle ticket
  stroke rr outline 'rgba(0,0,0,0.30)' 1px
```
E-ink: keep today's hatch (dense for rework, sparse otherwise) and the black outline; add the tie as a
solid black strip so the bundle still reads as tied.

### 5.2 Piles

Same grid as `drawPile`; add a hand-stacked jitter: `x += ((i * 7 + k) % 3) - 1` (−1, 0, +1 px,
deterministic). One `tableShadow` rect under each column: `fillRect(colX, r.y + r.h - 1, bw, 2)`.
The warning outlines (4+ dashed amber, 7+ solid red) and the count text stay exactly as they are.

### 5.3 Cartons (Packed zone)

```
carton(x, y, w, h):                         // w = cw, h = cw*0.7 as today
  fillRect(x+1, y+2, w, h) tableShadow
  fillRect(x, y, w, h) carton ; strokeRect(x+0.5, y+0.5, w-1, h-1) cartonDark 1px
  fillRect(x + w*0.44, y, w*0.12, h) cartonTape                    // tape over the flap seam
  line(x, y + h*0.5, x + w, y + h*0.5, 1, 'rgba(0,0,0,0.12)')       // flap seam
  if w >= 16: shipping mark in the lower-left quarter, shipMark 1px:
     diamond centre (x + w*0.22, y + h*0.70), half-size w*0.10 × h*0.12
     two short lines under it: fillRect(x + w*0.10, y + h*0.86, w*0.24, 1)
```
E-ink: white carton, black outline, black tape edges (two 1px lines), diamond black.

### 5.4 Flights

Bundles in flight keep their arc. Add a floor shadow at the un-lifted position:
`ell(xLinear, yLinear + 4, 6, 2)` `rgba(0,0,0,0.12)`, drawn before the bundle. (Already disabled in e-ink.)

---

## 6. Small animated life

6.1 **Budget.** All life together ≤ 1.5 ms per frame on a 4× CPU-throttled phone. Every item below is
gated by `motionOn` through `T`, and stops (rest pose) in e-ink and under reduced motion.

6.2 **Ceiling fans** — drawn only when `s.welfare.fans` (a visible reward for buying fans), after stations
and flights, before people. One fan per line group (centre of `lineRects[k]`; with one line, one fan every
4 cells along the line, centred between cells). Fans **stop** during a power cut without generator.
```
Rf = min(46, 1.4 * min(cell.w, cell.h)) ; a = (T * 0.0025) % (2π)       // ~0.4 rev/s: no strobing
one path: for k in 0..2: ellipse(cx + cos(a+k·2π/3)*Rf*0.5, cy + sin(…)*Rf*0.5, Rf*0.5, Rf*0.11, a+k·2π/3, 0, 2π)
          plus circle(cx, cy, Rf*0.1)
fill 'rgba(30,30,20,0.06)' (fill once → overlapping blades do not darken)
```

6.3 **Machines**: needle bob, spool tick, buttonhole slide, knife glide, smoke and spark (§4.8).

6.4 **People**: walk two-frame cycle, selection pulse, mood cue blink (§7). **Cat**: tail, walking legs (§8).

6.5 **Lunch** (replaces the bare wash; keep the text and its position):
```
wash: fillRect(all) 'rgba(243,234,215,0.55)'   (e-ink 'rgba(255,255,255,0.6)')
per staffed station: a tin lunch box (tiffin, top-down) at (t.x + t.w - 0.6R, t.y + 0.6R):
   circ(…, 0.38R) metal ; stroke metalDark 1px ; circ(…, 0.22R) shade(metal,+0.1) ; line across the lid 1px metalDark (handle)
text backing pill: measure text once (cache), rr(cx - w/2 - 10, cy - fs, w + 20, fs*1.5, fs*0.75) 'rgba(255,250,240,0.92)', stroke zoneEdge
tiffin icon left of the text (side view, 3 stacked tins): for k in 0..2: rr(ix, iy + k*fs*0.42, fs*0.9, fs*0.38, 2) metal, 1px metalDark; handle arc above
```

6.6 **Rain**: pre-render a 48×48 rain tile once (3 streaks, `rgba(80,120,190,0.18)`, 1 px, slant +10/26)
into a pattern; per frame `pattern.setTransform(new DOMMatrix().translate(off, off*2.6))` with
`off = (T/20) % 48`, then one `fillRect` over the canvas. Windows turn `#9fb2c0` (§3.3). E-ink: no streaks;
windows get a 1px black diagonal.

---

## 7. People

### 7.1 `body(x, y, r, opts)` — new signature

```ts
interface BodyOpts {
  coat: string; label: string;
  facing: 'up' | 'left' | 'down' | 'right';
  pose: 'seated' | 'walk' | 'stand';
  cap?: string | null;            // cloth cap colour (cosmetics.cap) or null
  hat?: 'helmet' | null;
  prop?: 'toolbox' | 'clipboard' | 'magnifier' | 'cable' | null;
  labelInk?: string;              // default: white / ink by luminance (§2.3)
  outline?: boolean;              // light coats (director, QC white)
}
```
2.5D rule: the head is **always** above the shoulders on screen; `facing` only changes the arms, which
side of the head shows skin, and whether the face is visible.

**Facing per situation.** Seated at a vertical cell (machine above the seat) → `up`. Seated at a
horizontal cell (machine left of the seat) → `left`. On the bench, in the office → `down` (towards the
viewer). Walking → `left`/`right` by `sign(dx)` when `|dx| > |dy|`, else `up`/`down`.

**Recipe** (draw order; `k = r` for readability):
```
1 shadow     ell(x, y + 0.80r, 0.90r, 0.30r) 'rgba(40,30,10,0.16)'          // director: diamond instead (7.3)
2 legs       walk only: f = (T/180|0)&1 ; s = f ? 0.15r : -0.15r
             ell(x - 0.30r, y + 0.82r + s, 0.18r, 0.24r) trousers ; ell(x + 0.30r, y + 0.82r - s, 0.18r, 0.24r) trousers
3 arms       coatDark, lineWidth 0.34r, round caps; hands circ radius 0.16r skin at the arm ends (skip if r < 11)
   seated up:   (x∓0.72r, y-0.05r) → (x∓0.60r, y-0.80r)              // reaching past the head to the machine
   seated left: (x-0.40r, y-0.05r) → (x-1.05r, y-0.15r) ; (x+0.30r, y+0.12r) → (x-1.00r, y+0.22r)
   down/stand:  (x∓0.80r, y) → (x∓0.74r, y+0.50r)                     // at the sides; hands on lap
   walk:        (x∓0.82r, y) → (x∓0.86r, y+0.45r ± (f ? 0.18r : -0.18r))   // opposite swing to the legs
4 torso      bob = walk && f ? -0.06r : 0 (apply to steps 4–7)
             ell(x, y + 0.22r, 0.92r, 0.66r) coat ; outline? stroke 'rgba(43,42,38,0.45)' 1px
             r >= 11: ell(x, y + 0.02r, 0.62r, 0.22r) 'rgba(255,255,255,0.14)'      // shoulder light
5 head       hx = x, hy = y - 0.48r, hr = 0.48r
   up:    circ(hx, hy, hr) hair ; r >= 11: circ(hx, y - 0.10r, 0.15r) hair (bun at the nape)
   down:  circ(hx, hy, hr) skin ; arc(hx, hy - 0.08r, hr, π, 2π) hair (fill, top half) ;
          r >= 10: eyes circ(hx ∓ 0.16r, hy + 0.06r, 0.06r) ink
   left:  circ(hx, hy, hr) skin ; arc(hx, hy, hr, -0.5π, 0.5π) hair (back = right half) + top cap of hair
          arc(hx, hy - 0.06r, hr, π, 2π) ; r >= 10: eye circ(hx - 0.22r, hy + 0.04r, 0.06r) ink
   right: mirror of left
6 cap        cloth cap: ell(hx, hy - 0.22r, 0.44r, 0.26r) cap ; band fillRect(hx - 0.44r, hy - 0.10r, 0.88r, max(1, 0.08r)) shade(cap,-0.15)
             helmet: ell(hx, hy - 0.16r, 0.52r, 0.34r) helmet ; fillRect(hx - 0.56r, hy + 0.02r, 1.12r, 0.08r) shade(helmet,-0.2) (brim)
7 prop       toolbox:   rr(x + 0.70r, y + 0.20r, 0.70r, 0.45r, 0.08r) mechanic ; line handle 1px ink across the top
             clipboard: rr(x + 0.30r, y - 0.05r, 0.58r, 0.72r, 0.06r) clip ; fillRect(inset 0.06r) clipPaper ;
                        fillRect(x + 0.48r, y - 0.09r, 0.22r, 0.10r) metalDark (clip) ; 2 text lines 1px muted
             magnifier: circ(x + 0.75r, y + 0.10r, 0.22r) stroke '#6b5a3e' 1.5px, glass 'rgba(170,210,230,0.5)'
             cable:     circle stroke ink, lineWidth 0.12r, at (x - 0.75r, y + 0.25r) radius 0.28r
8 label      unchanged position and size: bold max(8, round(0.62r)) px at (x, y + 0.42r), middle/centre
```
Cost: ≈ 10 fills per person. Below `r < 11` skip hands, bun, shoulder light, eyes, ticket marks.

### 7.2 Floor workers (`drawWorker`)

- Seamstress / any worker at a machine: `pose: 'seated'`, `facing` per 7.1, `cap: cosmetics.cap`,
  coat = `workerColor(w)` (identity), label = first two letters of the name (unchanged).
- QC inspector (`role === 'qc'`): same identity coat, label `'QC'`, `prop: 'magnifier'`.
- Walking between places (`w.arriveAt > now`): `pose: 'walk'`, facing from the movement vector.
- Bench: `pose: 'stand'` (sitting on the plank), `facing: 'down'`; name label below (unchanged,
  `y + r + 11`).

**Speed ring** (unchanged geometry `radius r + 3`, width 3): track `rgba(43,42,38,0.15)`, value
`ok`/`warn`/`danger`, `lineCap = 'round'`. E-ink: black arc, and the dash carries the meaning:
eff ≥ 0.8 solid, 0.6–0.8 `[6,3]`, < 0.6 `[2,3]`.

**Selection**: `circ(x, y, 1.6r + sin(T/200)*2)` `rgba(31,122,92,0.25)` (unchanged; frozen when `T = 0`).

### 7.3 Staff and agents

| who | coat | head | prop | label | notes |
|---|---|---|---|---|---|
| Director (agent) | `shirt` + outline | hair, no cap | — | `'You'` in `director` green on the shirt | instead of the shadow, a ground diamond `M(x, y+0.40r) L(x+1.05r, y+0.80r) L(x, y+1.20r) L(x-1.05r, y+0.80r) Z` `director` alpha 0.9. Jig while fixing unchanged. |
| Mechanic (agent) | `mechanicSuit`; two straps `fillRect(x∓0.35r, y-0.30r, 0.12r, 0.70r)` `mechanicStrap` | hair | toolbox (orange: keeps the orange "service" identity) | `'M'` white | walk pose while moving. |
| Electrician (staff) | `electrician` | helmet | cable | `'E'` white | stands at `officeSpot(l, 2)`, facing down. |
| Line leader (staff) | `leader` | hair | clipboard | `'L'` white | stands by the line tag, facing down. |
| Office staff (planner, merchandiser) — *optional, not drawn today* | `#5d7a99` / `#b5476b` | hair | — | `'P'` / `'Me'` | if added: seated `facing: 'up'` at the desk at `officeSpot(l, 0.4)`; skip in portrait. |

### 7.4 Mood cues (one per person, priority sweat > tired > happy)

Anchor top-right of the head: `(cx, cy) = (x + 0.66r, y - 0.92r)`. Skip all cues when `r < 9`.
```
hot(s, w) = (s.power?.off && !s.power.generator.running) || (!s.welfare.fans && w.fatigue > 0.4)
sweat:  d = 0.24r ; M(cx, cy-d) Q(cx+0.9d, cy+0.4d, cx, cy+0.8d) Q(cx-0.9d, cy+0.4d, cx, cy-d) ; fill sweat ; stroke '#ffffff' 1px
        motion: cy += ((T/600 + hash) % 1) * 0.25r  (slides down, snaps back)
tired:  w.fatigue > 0.55 → existing 'z' (muted, bold 0.7r) with the bob on T; at r >= 12 add a yawn: ell(x, y-0.36r, 0.10r, 0.13r) '#7a3b2e' (facing 'down' only)
happy:  w.morale >= 0.8 && w.fatigue < 0.4, visible while ((T + hash*997) % 6000) < 1200
        (static modes: always shown, but only when r >= 12); hx = x - 0.66r, h = 0.20r
        M(hx, cy+0.9h) C(hx-1.6h, cy-0.2h, hx-0.6h, cy-1.3h, hx, cy-0.4h) C(hx+0.6h, cy-1.3h, hx+1.6h, cy-0.2h, hx, cy+0.9h) ; fill heart
```
E-ink: sweat white with black stroke; heart black; 'z' black.

---

## 8. The cat and the wall calendar

### 8.1 Cat (behaviour, path and timing unchanged; `c = layout.radius * 0.55`)

Awake (walking along the bench, `dir = ±1`):
```
ell(x, y + 0.75c, 1.2c, 0.28c) 'rgba(40,30,10,0.14)'                      // shadow
legs: f = (T/220|0)&1 ; 4 rects 0.22c × 0.45c catFur at x + dir*(±0.75c, ±0.35c), y + 0.45c, the pair (front-left, back-right) lifted 0.12c when f
ell(x, y, 1.3c, 0.70c) catFur                                             // body
stripes: one path, 3 strokes catStripe 0.18c: from (x + dir*(-0.60 + 0.5k)c, y - 0.66c) to (x + dir*(-0.72 + 0.5k)c, y - 0.20c)
tail: existing quadratic curve, catFur, lineWidth 0.30c, + a catStripe dot at its tip (circ 0.16c)
head: existing circle + ears; muzzle ell(hx + dir*0.25c, hy + 0.18c, 0.25c, 0.18c) catBelly ; nose dot '#c46a6a' 0.07c ; eye circ(hx + dir*0.18c, hy - 0.08c, 0.07c) ink
collar: existing arc in cosmetics.collar + a bell circ(hx, hy + 0.62c, 0.12c) '#e8c547'
```
Asleep (lunch / outside the shift) — a curled loaf instead of the walking pose:
```
ell(x, y + 0.55c, 1.1c, 0.3c) shadow ; circ(x, y, 1.0c) catFur
tail wrap: arc(x, y, 0.82c, 0.15π, 1.05π) stroke catStripe 0.24c
head tucked: circ(x + dir*0.55c, y - 0.20c, 0.50c) catFur + ears ; closed eye: arc 0.12c, 1px ink
'z' text unchanged
```
E-ink: fur `#888`, stripes black, belly white, no motion.

### 8.2 Wall calendar (supplier's calendar; same position and size `w = min(26, o.w*0.18)`, `h = 1.25w`)

```
nail: circ(x + w/2, y - 3, 1.2) ink ; string: M(x + w*0.2, y) L(x + w/2, y - 3) L(x + w*0.8, y) 1px muted
fillRect(x + 1, y + 2, w, h) tableShadow                                  // hangs off the wall
fillRect(x, y, w, h) '#fffdf6'
fillRect(x, y, w, h*0.42) cal.colour                                      // supplier header band
"logo": fillRect(x + w*0.18, y + h*0.12, w*0.64, max(1, h*0.05)) '#ffffff' ; fillRect(x + w*0.3, y + h*0.24, w*0.4, 1) 'rgba(255,255,255,0.7)'
ring binding: 3 dots circ(x + w*(0.25|0.5|0.75), y + 1.5, 0.9) metalDark
year: existing text (bold 0.32w, ink) at y + h*0.85
tear-off edge: line(x, y + h*0.52, x + w, y + h*0.52, 1, 'rgba(0,0,0,0.12)') dashed [2,1.5]
outline 1px 'rgba(0,0,0,0.25)' (e-ink: black; header #444)
```
It goes into the static layer (it depends only on cosmetics and the chapter year; add the year to the
static key). Portrait: still skipped.

---

## 9. UI chrome (CSS only) and app icon

### 9.1 Tokens (`src/ui/style.css`, `:root`)

```css
:root {
  --bg: #efe4cc;  --surface: #fffaf0;  --ink: #2b2a26;  --muted: #5f5a4f;
  --accent: #1f7a5c;  --accent-ink: #ffffff;  --line: #d9cdb3;  --bad: #c0392b;  --ok: #2e7d32;
  --top: #2d4a6e;  --top-ink: #f6eedb;       /* work-coat blue */
  --wall: #cfe0c6;  --gold: #e8c547;  --kraft: #c09a62;  --wood: #b07a45;
  --press: inset 0 -2px 0 rgba(43,42,38,0.14);
}
#topbar { border-bottom: 2px solid var(--gold); }                 /* gold decal stripe of the machines */
#panel  { border-top: 3px solid var(--wall); }                    /* pale-green skirting */
#panel button, .card button { box-shadow: var(--press); }
#panel button:active, .card button:active { box-shadow: none; transform: translateY(1px); }
.card { border-top: 4px solid var(--top); }
.card.fax { border-top-color: #b23a3a; }                          /* the red fax/phone */
.toast { background: rgba(45,74,110,0.94); }                      /* --top, translucent */
body.eink { --wall: #000000; --gold: #000000; --press: none; }
body.eink #panel button:active { transform: none; }
```
`index.html`: `<meta name="theme-color" content="#2d4a6e">`. Everything else in the stylesheet stays.

### 9.2 App icon — replace `public/icon.svg`

A cream lockstitch machine on work-coat blue, gold handwheel, a pink spool (Hoa's coat colour) threading
down to a stitched seam. All content sits inside the maskable safe circle (radius 205 around the centre).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2d4a6e"/>
  <rect x="96" y="340" width="320" height="40" rx="12" fill="#cfa86f"/>
  <rect x="96" y="368" width="320" height="12" rx="6" fill="#8f6c3e"/>
  <g fill="#f3ead7">
    <rect x="120" y="284" width="272" height="56" rx="14"/>
    <rect x="320" y="136" width="72" height="176" rx="18"/>
    <rect x="136" y="136" width="256" height="64" rx="28"/>
    <rect x="136" y="136" width="76" height="124" rx="18"/>
  </g>
  <rect x="226" y="156" width="80" height="10" rx="5" fill="#e8c547"/>
  <circle cx="400" cy="200" r="34" fill="#e8c547"/>
  <circle cx="400" cy="200" r="12" fill="#2d4a6e"/>
  <rect x="256" y="92" width="8" height="44" fill="#f3ead7"/>
  <rect x="236" y="84" width="48" height="36" rx="6" fill="#c2185b"/>
  <rect x="230" y="78" width="60" height="10" rx="4" fill="#f3ead7"/>
  <rect x="230" y="116" width="60" height="10" rx="4" fill="#f3ead7"/>
  <path d="M248 100 C 200 70 150 100 172 256" fill="none" stroke="#c2185b" stroke-width="5" stroke-linecap="round"/>
  <rect x="104" y="300" width="148" height="28" rx="6" fill="#c2185b"/>
  <line x1="112" y1="314" x2="244" y2="314" stroke="#f3ead7" stroke-width="5" stroke-dasharray="14 10" stroke-linecap="round"/>
  <rect x="164" y="256" width="16" height="30" fill="#f3ead7"/>
  <line x1="172" y1="286" x2="172" y2="318" stroke="#e8c547" stroke-width="6" stroke-linecap="round"/>
</svg>
```
The manifest entry (`sizes: "any"`, `purpose: "any maskable"`) stays as it is.

---

## 10. Priorities and performance

### 10.1 Implementation order (largest visual gain first)

1. **Palette swap + static layer** (§2, §3.1–3.5, §4.1): terrazzo, walls, zone bases, tables with shadows,
   stools. Changes the whole look in one step and makes frames *cheaper*.
2. **New `body()`** with facing, poses, cap and the role table (§7.1–7.3). People are the heart of it.
3. **Machine silhouettes and states** (§4.3–4.8), hazard and wrench badges.
4. **Bundles, piles, cartons, rolls** (§5, §3.8).
5. **Furniture and line dressing**: office desk props, bench planks, line tags and lanes, light pools
   (§3.6, 3.7, 3.9, 3.4).
6. **Life**: mood cues, fans, smoke/sparks, lunch tiffins, cat, calendar, rain pattern (§6, §7.4, §8).
7. **Chrome**: CSS tokens, theme colour, icon (§9).

Each step is shippable alone; e-ink and reduced motion must be correct at every step.

### 10.2 Performance rules (60 fps on a 4×-throttled mid phone, 4 lines × 15 stations, ~70 people)

1. Anything that does not change during a shift lives in the static layer (§3.1); the per-frame floor cost is
   one `drawImage`. Never re-draw tiles, chips or parquet per frame.
2. No `shadowBlur`, `filter`, `globalCompositeOperation` tricks, or `getImageData` in the frame loop.
   Shadows are plain translucent shapes.
3. No gradient or pattern objects created per frame: build them once (static layer, rain tile) and reuse.
4. Merge same-colour shapes into one path and one `fill()` (machine bodies, fan blades, cat stripes,
   threads, joints). Set `font`, `fillStyle`, `textAlign` once per group, not per item.
5. Cache `measureText` results for constant strings (line tags, lunch text, zone labels); clear on language
   change. Keep `fit()` for station labels but memoise by `(text, maxW, font)`.
6. Memoise colour math (`shade()`, luminance) in a `Map<string,string>`; never parse hex in the loop.
7. Level of detail: below `r < 11` (and machine `mh < 14`) skip hands, eyes, bun, knots, tickets, decal,
   shipping marks and chalk pieces. Portrait phones hit this most and gain the most.
8. Animation only through `T` (0 when `motionOn` is false); no extra work for animation in e-ink or reduced
   motion, and no per-frame `Math.random()` (flicker).
9. Cull: skip `drawStation` for cells outside the canvas (3+ lines view) — already true via `byIndex`.
10. Budget per frame on the throttled phone: static blit < 0.5 ms, stations < 5 ms, people < 4 ms,
    life < 1.5 ms, text < 3 ms. Measure with `performance.now()` around each group behind a debug flag
    (`?perf=1`) before and after each step of 10.1.
11. Rebuild the static layer at most once per `resize`/state-key change, never inside `draw()` more than
    once; if a rebuild is needed mid-shift (machine bought), do it at the start of the next frame.
