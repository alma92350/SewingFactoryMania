// Drives the production build in Chromium (desktop + phone):
//  1. Chapter 0: start from the title screen, seat Lan via the canvas, give the spare machine a job, fast-forward.
//  2. Chapter 1: family letter, fax quote, hire from the Team tab, fast-forward, check money and production.
//  3. Chapter 2: sample check micro-game, QC tip, fast-forward.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/index.html?seed=3`;
const shots = process.env.SHOTS ?? '';

async function dismissTips(page) {
  await page.waitForTimeout(250);
  for (let i = 0; i < 6; i++) {
    const tip = page.locator('[data-action="tipOk"]');
    if (!(await tip.count())) return;
    await tip.click();
    await page.waitForTimeout(150);
  }
}

async function chooseFirst(page, kind) {
  const btn = page.locator(`#overlay button.choice`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  void kind;
}

const browser = await chromium.launch();
let failed = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
  failed ||= !ok;
};

for (const [name, opts] of [
  ['desktop', { viewport: { width: 1280, height: 800 } }],
  ['phone', devices['Pixel 5']],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // ── Chapter 0
  await page.goto(base);
  if (shots) await page.screenshot({ path: `${shots}/${name}-title.png` });
  await page.locator('[data-action="start"][data-arg="ch0"]').click();
  await page.locator('[data-action="introOk"]').click();
  await dismissTips(page);
  const canvas = page.locator('#floor');
  const box = await canvas.boundingBox();
  const lan = await page.evaluate(() => {
    const app = window.__app;
    const w = app.state.workers.find((x) => x.id === 'lan');
    return app.rendererForTests.workerPos(app.state, w, 0);
  });
  await page.mouse.click(box.x + lan.x, box.y + lan.y);
  const spare = await page.evaluate(() => {
    const c = window.__app.rendererForTests.layout.stations[3].table;
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
  });
  await page.mouse.click(box.x + spare.x, box.y + spare.y);
  const seated = await page.evaluate(() => window.__app.state.stations[3].workerId);
  await page.mouse.click(box.x + spare.x, box.y + spare.y);
  await page.getByRole('button', { name: /Back pocket/ }).click();
  const op = await page.evaluate(() => window.__app.state.stations[3].opId);
  await page.getByRole('button', { name: '4× speed' }).click();
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1500);
    await dismissTips(page);
  }
  const c0 = await page.evaluate(() => ({ minute: window.__app.state.minute, sewn: window.__app.state.stations.reduce((a, s) => a + s.output, 0) }));
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch0.png` });
  check(`${name} ch0`, seated === 'lan' && op === 'shorts.pocket' && c0.minute > 470 && c0.sewn > 50, `seated=${seated} op=${op} minute=${c0.minute} sewn=${Math.round(c0.sewn)}`);

  // ── Chapter 1 (unlock through saved progress)
  await page.evaluate(() => localStorage.setItem('sfm.progress.v1', JSON.stringify({ stars: { ch0: 2, ch1: 1 }, campaign: {}, difficulty: 'seamstress', sound: false, seenTips: [] })));
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch1"]').click();
  await page.locator('[data-action="introOk"]').click();
  await chooseFirst(page, 'family');
  if (shots) await page.screenshot({ path: `${shots}/${name}-fax.png` });
  await chooseFirst(page, 'fax');
  await dismissTips(page);
  await page.getByRole('tab', { name: /Team/ }).click();
  const before = await page.evaluate(() => window.__app.state.workers.length);
  await page.locator('[data-action="hire"]').first().click();
  const after = await page.evaluate(() => window.__app.state.workers.length);
  await page.getByRole('tab', { name: /Orders/ }).click();
  await page.getByRole('button', { name: '4× speed' }).click();
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1500);
    await dismissTips(page);
  }
  const c1 = await page.evaluate(() => ({ minute: window.__app.state.minute, orders: window.__app.state.orders.length, sewn: window.__app.state.stations.reduce((a, s) => a + s.output, 0) }));
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch1.png` });
  check(`${name} ch1`, after === before + 1 && c1.orders === 1 && c1.minute > 450, `hired=${after - before} orders=${c1.orders} minute=${c1.minute} sewn=${Math.round(c1.sewn)}`);

  // ── Chapter 2: sample micro-game
  await page.evaluate(() => localStorage.setItem('sfm.progress.v1', JSON.stringify({ stars: { ch0: 2, ch1: 1 }, campaign: {}, difficulty: 'seamstress', sound: false, seenTips: [] })));
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch2"]').click();
  await page.locator('[data-action="introOk"]').click();
  await chooseFirst(page, 'family');
  await dismissTips(page);
  await chooseFirst(page, 'fax');
  await page.getByRole('button', { name: /Check it yourself/ }).click();
  await page.locator('#mg-ours').waitFor();
  if (shots) await page.screenshot({ path: `${shots}/${name}-sample.png` });
  await page.locator('[data-mg="stop"]').click();
  await page.locator('[data-mg="ok"]').click();
  await dismissTips(page);
  const c2 = await page.evaluate(() => ({ sampled: window.__app.state.orders[0].sampled, factor: window.__app.state.orders[0].sampleFactor }));
  check(`${name} ch2`, c2.sampled === true && c2.factor === 1, `sampled=${c2.sampled} factor=${c2.factor}`);

  // ── Chapter 3: marker game and buying fabric
  await page.evaluate(() => localStorage.setItem('sfm.progress.v1', JSON.stringify({ stars: { ch0: 2, ch1: 1, ch2: 1, ch3: 1 }, campaign: {}, difficulty: 'seamstress', sound: false, seenTips: [] })));
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch3"]').click();
  await page.locator('[data-action="introOk"]').click();
  await chooseFirst(page, 'family');
  await dismissTips(page);
  await chooseFirst(page, 'fax'); // Hanil CMT
  await dismissTips(page);
  await chooseFirst(page, 'fax'); // Mr. Leung FOB
  await page.getByRole('button', { name: /Lay it yourself/ }).click();
  await page.locator('.mcell').first().click();
  if (shots) await page.screenshot({ path: `${shots}/${name}-marker.png` });
  await page.locator('[data-mk="done"]').click();
  await page.locator('[data-mg="ok"]').click();
  await dismissTips(page);
  const marker = await page.evaluate(() => window.__app.state.orders.find((o) => o.tag === 'golden').markerSet);
  await page.getByRole('tab', { name: /Fabric/ }).click();
  await page.locator('[data-action="buy"]').first().click();
  const shipments = await page.evaluate(() => window.__app.state.shipments.length);
  if (shots) await page.screenshot({ path: `${shots}/${name}-fabric.png` });
  check(`${name} ch3`, marker === true && shipments === 1, `markerSet=${marker} shipments=${shipments}`);

  // ── Chapter 4: two lines, overlay
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch4"]').click();
  await page.locator('[data-action="introOk"]').click();
  await dismissTips(page);
  for (let i = 0; i < 6; i++) {
    const choice = page.locator('#overlay button.choice:not([data-arg$=":play"])').first();
    if (await choice.count()) await choice.click();
    await dismissTips(page);
  }
  await page.locator('#overlayBtn').click();
  const lines = await page.evaluate(() => window.__app.state.lines.map((l) => l.activeOrderId !== null));
  const overlayText = await page.locator('#overlayBtn').textContent();
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch4.png` });
  check(`${name} ch4`, lines.length === 2 && lines.every(Boolean) && /slowest/.test(overlayText ?? ''), `lines=${JSON.stringify(lines)} overlay=${overlayText}`);

  // ── Vietnamese
  await page.goto(base);
  await page.locator('[data-action="lang"][data-arg="vi"]').click();
  const title = await page.locator('#overlay').innerText();
  check(`${name} vi`, title.includes('Xưởng may gia đình') && title.includes('Độ khó'), '');

  check(`${name} errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
