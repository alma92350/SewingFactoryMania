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

/** Answer decisions (never a micro-game) and dismiss tips until no overlay is left. */
async function clearOverlays(page) {
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    if (await page.locator('#overlay').evaluate((e) => e.hidden)) return;
    const choice = page.locator('#overlay button.choice:not([data-arg$=":play"])').first();
    const tip = page.locator('[data-action="tipOk"]');
    if (await choice.count()) await choice.click();
    else if (await tip.count()) await tip.click();
    else return;
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
    const c = window.__app.rendererForTests.layout.byIndex[3].table;
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

  // ── Chapter 5: morale panel, bonus decision, mentor
  const allStars = JSON.stringify({ stars: { ch0: 2, ch1: 1, ch2: 1, ch3: 1, ch4: 1, ch5: 1 }, campaign: {}, difficulty: 'seamstress', sound: false, seenTips: [] });
  await page.evaluate((p) => localStorage.setItem('sfm.progress.v1', p), allStars);
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch5"]').click();
  await page.locator('[data-action="introOk"]').click();
  await dismissTips(page);
  await clearOverlays(page);
  await page.getByRole('tab', { name: /Team/ }).click();
  const welfareBtn = page.locator('[data-action="welfare"]').first();
  await welfareBtn.waitFor({ timeout: 5000 });
  await welfareBtn.click();
  const c5 = await page.evaluate(() => ({ lines: window.__app.state.lines.length, welfare: Object.values(window.__app.state.welfare).filter(Boolean).length, morale: window.__app.state.workers[0].morale }));
  const picker5 = await page.locator('#linePicker button').count();
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch5.png` });
  check(`${name} ch5`, c5.lines === 3 && picker5 === 2 && c5.welfare === 1 && c5.morale > 0, `lines=${c5.lines} picker=${picker5} welfare=${c5.welfare} morale=${c5.morale}`);

  // ── Chapter 6: four lines, line picker, office
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch6"]').click();
  await page.locator('[data-action="introOk"]').click();
  await dismissTips(page);
  await clearOverlays(page);
  await page.locator('#linePicker button[data-arg="2,3"]').click();
  const visible = await page.evaluate(() => window.__app.rendererForTests.layout.lineIds);
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch6.png` });
  await page.getByRole('tab', { name: /Team/ }).click();
  await page.locator('#panel h3', { hasText: /office/i }).waitFor({ timeout: 5000 }).catch(() => {});
  const office = await page.locator('#panel').innerText();
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch6-team.png` });
  check(`${name} ch6`, JSON.stringify(visible) === '[2,3]' && /office/i.test(office), `visible=${JSON.stringify(visible)} office=${/office/i.test(office)}`);

  // ── Daily Challenge and Sandbox
  await page.goto(base);
  if (shots) await page.screenshot({ path: `${shots}/${name}-title3.png` });
  await page.locator('[data-action="daily"]').click();
  await page.locator('[data-action="introOk"]').click();
  await dismissTips(page);
  const daily = await page.evaluate(() => ({ id: window.__app.state.chapterId, orders: window.__app.state.orders.length }));
  check(`${name} daily`, daily.id.startsWith('daily-') && daily.orders === 1, JSON.stringify(daily));
  await page.goto(base);
  await page.locator('[data-action="sandbox"][data-arg="2"]').click();
  await page.locator('[data-action="introOk"]').click();
  await dismissTips(page);
  const sandbox = await page.evaluate(() => ({ id: window.__app.state.chapterId, lines: window.__app.state.lines.length }));
  check(`${name} sandbox`, sandbox.id.startsWith('sandbox-2-') && sandbox.lines === 2, JSON.stringify(sandbox));

  // ── Chapter 7: the shock, new markets, Má's advice
  await page.evaluate(() => localStorage.setItem('sfm.progress.v1', JSON.stringify({ stars: { ch0: 2, ch1: 1, ch2: 1, ch3: 1, ch4: 1, ch5: 1, ch6: 1 }, campaign: { cat: 'adopt' }, difficulty: 'seamstress', sound: false, seenTips: [] })));
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch7"]').click();
  await page.locator('[data-action="introOk"]').click();
  await clearOverlays(page);
  await page.getByRole('tab', { name: /Orders/ }).click();
  const look = page.locator('[data-action="prospect"][data-arg="saigon"]');
  await look.waitFor({ timeout: 5000 });
  await look.click();
  const c7 = await page.evaluate(() => ({ prospects: window.__app.state.prospects.length, cat: !!window.__app.rendererForTests.cosmetics.collar }));
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch7.png` });
  check(`${name} ch7`, c7.prospects === 1 && c7.cat, JSON.stringify(c7));

  // ── Scenario editor: add a buyer, play; then a shared link
  await page.goto(base);
  await page.locator('[data-action="editor"]').click();
  await page.locator('#scn-lines').selectOption('1');
  await page.locator('#scn-days').selectOption('3');
  await page.locator('[data-action="scnAdd"]').click();
  await page.locator('[data-cb="0:name"]').fill('Chợ Đêm Traders');
  await page.locator('[data-cb="0:product"]').selectOption('shorts');
  await page.locator('#scn-name').fill('Night market');
  await page.locator('#scn-name').blur();
  const code = await page.locator('#scn-codeview').textContent();
  if (shots) await page.screenshot({ path: `${shots}/${name}-editor.png`, fullPage: true });
  await page.locator('[data-action="scnPlay"]').click();
  await page.locator('[data-action="introOk"]').click();
  const scn = await page.evaluate(() => ({ id: window.__app.state.chapterId, lines: window.__app.state.lines.length, days: window.__app.state.history.length }));
  check(`${name} scenario`, scn.id.startsWith('scn:') && scn.lines === 1 && (code ?? '').startsWith('SFM1-'), JSON.stringify({ lines: scn.lines, code: code?.slice(0, 12) }));
  await page.goto(`${base}&scenario=${encodeURIComponent(code ?? '')}`);
  const shared = await page.locator('#scn-name').inputValue();
  check(`${name} shared link`, shared === 'Night market', shared);

  // ── Part II: quota and audit (Ch8), two cities (Ch9), your own label (Ch10), the gallery
  const part2 = JSON.stringify({ stars: { ch0: 2, ch1: 1, ch2: 1, ch3: 1, ch4: 1, ch5: 1, ch6: 1, ch7: 1, ch8: 1, ch9: 1 }, campaign: { cat: 'adopt' }, difficulty: 'seamstress', sound: false, seenTips: [] });
  await page.evaluate((p) => localStorage.setItem('sfm.progress.v1', p), part2);
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch8"]').click();
  await page.locator('[data-action="introOk"]').click();
  for (let i = 0; i < 10 && !(await page.evaluate(() => window.__app.state.orders.length)); i++) await clearOverlays(page);
  await clearOverlays(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('tab', { name: /Orders/ }).click();
  const buyQuota = page.locator('[data-action="quota"]').first();
  await buyQuota.waitFor({ timeout: 5000 });
  await buyQuota.click();
  const c8 = await page.evaluate(() => window.__app.state.orders.filter((o) => o.buyer === 'atlantic' && o.quotaPaid).length);
  await page.getByRole('tab', { name: /Team/ }).click();
  await page.locator('#panel h3', { hasText: /conduct/i }).waitFor({ timeout: 5000 }).catch(() => {});
  const conduct = await page.locator('#panel').innerText();
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch8.png` });
  check(`${name} ch8`, c8 >= 1 && /code of conduct/i.test(conduct), `quota=${c8}`);

  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch9"]').click();
  await page.locator('[data-action="introOk"]').click();
  await clearOverlays(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('tab', { name: /Line/ }).click();
  await page.locator('[data-action="travel"][data-arg="hanoi"]').click();
  await page.locator('#linePicker button[data-arg="2,3"]').click();
  const c9 = await page.evaluate(() => ({ flight: window.__app.state.director.flightUntil, site: window.__app.state.director.site }));
  const picker = await page.locator('#linePicker').innerText();
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch9.png` });
  check(`${name} ch9`, c9.site === 'hanoi' && c9.flight > 0 && /Hà Nội/.test(picker), JSON.stringify(c9));

  await page.evaluate((p) => localStorage.setItem('sfm.progress.v1', p), part2);
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch10"]').click();
  await page.locator('[data-action="introOk"]').click();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    const col = page.locator('[data-action="decide"][data-arg$=":polo"]');
    if (await col.count()) {
      if (shots) await page.screenshot({ path: `${shots}/${name}-ch10-collection.png` });
      await col.click();
      break;
    }
    const choice = page.locator('#overlay button.choice').first();
    const tip = page.locator('[data-action="tipOk"]');
    if (await tip.count()) await tip.click();
    else if (await choice.count()) await choice.click();
  }
  await clearOverlays(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('tab', { name: /Orders/ }).click();
  await page.locator('[data-action="advertise"]').click();
  await page.locator('[data-action="price"][data-arg="-1"]').click();
  const c10 = await page.evaluate(() => ({ col: window.__app.state.brand?.collection, ad: window.__app.state.brand?.adUntil, price: window.__app.state.brand?.priceLevel }));
  if (shots) await page.screenshot({ path: `${shots}/${name}-ch10.png` });
  check(`${name} ch10`, c10.col === 'polo' && c10.ad > 0 && c10.price === -1, JSON.stringify(c10));

  await page.goto(base);
  await page.locator('[data-action="gallery"]').click();
  await page.locator('[data-action="galPlay"]').first().click();
  await page.locator('[data-action="introOk"]').click();
  const gal = await page.evaluate(() => window.__app.state.chapterId);
  check(`${name} gallery`, gal.startsWith('scn:'), gal.slice(0, 12));

  // ── Scrapbook and French
  await page.goto(base);
  await page.locator('[data-action="scrapbook"]').first().click();
  const sb = await page.locator('#overlay').innerText();
  check(`${name} scrapbook`, /scrapbook/i.test(sb), '');
  await page.goto(base);
  await page.locator('[data-action="lang"][data-arg="fr"]').click();
  // the dictionary is its own chunk: wait for it
  await page.waitForFunction(() => document.querySelector('#overlay').innerText.includes('Difficulté'), null, { timeout: 5000 }).catch(() => {});
  const fr = await page.locator('#overlay').innerText();
  check(`${name} fr`, fr.includes('L’atelier familial') && fr.includes('Difficulté'), '');
  await page.locator('[data-action="lang"][data-arg="en"]').click();

  // ── Vietnamese
  await page.goto(base);
  await page.locator('[data-action="lang"][data-arg="vi"]').click();
  await page.waitForFunction(() => document.querySelector('#overlay').innerText.includes('Độ khó'), null, { timeout: 5000 }).catch(() => {});
  const title = await page.locator('#overlay').innerText();
  check(`${name} vi`, title.includes('Xưởng may gia đình') && title.includes('Độ khó'), '');

  check(`${name} errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
