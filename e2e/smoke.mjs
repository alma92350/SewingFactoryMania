// Drives the production build in Chromium, desktop and phone: start the shift,
// move Lan onto the spare machine, fast-forward, and check the line is producing.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html?seed=3`;
const shots = process.env.SHOTS ?? '';

const browser = await chromium.launch();
let failed = false;
for (const [name, opts] of [
  ['desktop', { viewport: { width: 1280, height: 800 } }],
  ['phone', devices['Pixel 5']],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  if (shots) await page.screenshot({ path: `${shots}/${name}-tip.png` });
  await page.getByRole('button', { name: 'Start the shift' }).click();

  // tap the spare machine and give it the pocket job, then seat Lan there via the canvas
  const canvas = page.locator('#floor');
  const box = await canvas.boundingBox();
  const lan = await page.evaluate(() => window.__app.workerScreenPos('lan'));
  await page.mouse.click(box.x + lan.x, box.y + lan.y);
  const spare = await page.evaluate(() => {
    const c = window.__app.renderer.layout.stations[3].table;
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
  });
  await page.mouse.click(box.x + spare.x, box.y + spare.y);
  const seated = await page.evaluate(() => window.__app.state.stations[3].workerId);
  await page.mouse.click(box.x + spare.x, box.y + spare.y);
  await page.getByRole('button', { name: /Back pocket/ }).click();
  const op = await page.evaluate(() => window.__app.state.stations[3].opId);

  await page.getByRole('button', { name: '4× speed' }).click();
  await page.waitForTimeout(6000);
  // dismiss any tip that paused the game
  for (let i = 0; i < 3; i++) {
    const ok = page.locator('[data-action="tipOk"]');
    if (await ok.count()) await ok.click();
    await page.waitForTimeout(1500);
  }
  const st = await page.evaluate(() => ({ minute: window.__app.state.minute, finished: window.__app.state.finished, sewn: window.__app.state.stations.reduce((a, s) => a + s.output, 0) }));
  if (shots) await page.screenshot({ path: `${shots}/${name}-play.png` });

  const ok = errors.length === 0 && seated === 'lan' && op === 'pocket' && st.minute > 480 && st.sewn > 50;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: seated=${seated} op=${op} minute=${st.minute} sewn=${Math.round(st.sewn)} errors=${errors.length}`);
  if (errors.length) console.log(errors.join('\n'));
  failed ||= !ok;
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
