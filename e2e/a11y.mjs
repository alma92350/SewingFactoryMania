// Accessibility audit (PRD §14.3, Phase 4 exit criterion): axe-core on every screen, desktop and phone,
// in English, Vietnamese and French, colour and e-ink. Fails on any WCAG 2.1 A/AA violation.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

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
const allStars = { ch0: 3, ch1: 2, ch2: 2, ch3: 2, ch4: 2, ch5: 2, ch6: 2, ch7: 2 };

const browser = await chromium.launch();
const results = [];

async function audit(page, name) {
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(async () => {
    const out = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return out.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  results.push({ name, violations: r });
  console.log(`${r.length ? 'FAIL' : 'PASS'} ${name}${r.length ? '\n  ' + r.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.join(' | ')}`).join('\n  ') : ''}`);
}

async function clearOverlays(page) {
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    if (await page.locator('#overlay').evaluate((e) => e.hidden)) return;
    const choice = page.locator('#overlay button.choice:not([data-arg$=":play"])').first();
    const tip = page.locator('[data-action="tipOk"]');
    if (await choice.count()) await choice.click();
    else if (await tip.count()) await tip.click();
    else return;
  }
}

async function setProgress(page, extra = {}) {
  await page.evaluate((p) => localStorage.setItem('sfm.progress.v1', JSON.stringify(p)), {
    stars: allStars,
    campaign: { cat: 'adopt', 'ch7.ma': 'keep' },
    difficulty: 'seamstress',
    sound: false,
    seenTips: [],
    achievements: ['doors', 'storm'],
    scrapbook: { ch0: { stars: 3, cash: 0, crew: ['Hoa', 'Thảo', 'Lan'], choices: ['Keep Má’s old machines'] }, ch7: { stars: 2, cash: 4000, crew: ['Lan'], choices: ['“Never lay off the people who built this”'] } },
    ...extra,
  });
}

for (const [device, opts] of [
  ['desktop', { viewport: { width: 1280, height: 800 } }],
  ['phone', devices['Pixel 5']],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(base);
  await setProgress(page);

  for (const lang of ['en', 'vi', 'fr']) {
    await setProgress(page, { lang });
    await page.goto(base);
    await page.waitForFunction((l) => document.documentElement.lang === l, lang, { timeout: 5000 });
    await audit(page, `${device} title ${lang}`);
  }
  await setProgress(page, { lang: 'en' });
  await page.goto(base);
  await page.locator('[data-action="scrapbook"]').first().click();
  await audit(page, `${device} scrapbook`);
  await page.goto(base);
  await page.locator('[data-action="editor"]').click();
  await page.locator('[data-action="scnAdd"]').click();
  await audit(page, `${device} scenario editor`);

  // a chapter: intro, every tab, a fax, a family card
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch7"]').click();
  await audit(page, `${device} intro ch7`);
  await page.locator('[data-action="introOk"]').click();
  await page.waitForTimeout(400);
  await audit(page, `${device} first card ch7`);
  await clearOverlays(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  for (const tab of ['Line', 'Orders', 'Fabric', 'Team', 'Handbook']) {
    await clearOverlays(page);
    await page.getByRole('tab', { name: new RegExp(tab) }).click();
    await audit(page, `${device} ch7 ${tab} tab`);
  }
  // the end of a shift: report screen
  await clearOverlays(page);
  await page.getByRole('tab', { name: /Line/ }).click();
  await page.evaluate(() => {
    const s = window.__app.state;
    s.minute = 16 * 60 + 29;
  });
  await page.evaluate(() => document.querySelector('[data-action="speed"][data-arg="4"]').click());
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(400);
    if (await page.locator('[data-action="sleep"]').count()) break;
    await clearOverlays(page);
  }
  if (await page.locator('[data-action="sleep"]').count()) await audit(page, `${device} shift report`);

  // micro-game: sample check (Chapter 2)
  await page.goto(base);
  await page.locator('[data-action="start"][data-arg="ch2"]').click();
  await page.locator('[data-action="introOk"]').click();
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(250);
    const play = page.getByRole('button', { name: /Check it yourself/ });
    if (await play.count()) break;
    const choice = page.locator('#overlay button.choice').first();
    const tip = page.locator('[data-action="tipOk"]');
    if (await tip.count()) await tip.click();
    else if (await choice.count()) await choice.click();
  }
  const play = page.getByRole('button', { name: /Check it yourself/ });
  if (await play.count()) {
    await play.click();
    await page.locator('#mg-ours').waitFor();
    await audit(page, `${device} sample micro-game`);
  }

  // e-ink
  await page.goto(`${base}&eink=1`);
  await audit(page, `${device} title e-ink`);
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => r.violations.length);
console.log(`\n${results.length - failed.length}/${results.length} screens clean`);
process.exit(failed.length ? 1 : 0);
