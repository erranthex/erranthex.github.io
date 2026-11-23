// End-to-end test: serves the app, drives every exercise with a perfect in-page bot at 10x
// speed, and checks scoring, adaptivity, persistence, layout (desktop + phone) and offline.
// Run from repo root: node braingym/tests/e2e.cjs  [--shots <dir>]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failures++; };

async function newPage(browser, opts, url) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { globalThis.__ngSpeed = 0.1; globalThis.__ngTest = {}; });
  await ctx.addInitScript({ path: path.join(__dirname, 'bot.js') });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { if (page.__acceptDialogs) return d.accept(); errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto(url);
  await page.waitForSelector('#view h1');
  await page.evaluate(() => window.__neurogym.store.set(s => { s.settings.speech = false; s.settings.sound = false; return s; }));
  return { ctx, page, errors };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function playGame(page, id) {
  await page.evaluate((id) => { window.__neurogym.play([window.__neurogym.GAMES.find(g => g.id === id)]); }, id);
  await page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 120000 });
  return page.evaluate((id) => { const s = window.__neurogym.store.get(); return { last: s.results.filter(r => r.game === id).pop(), level: s.levels[id], s }; }, id);
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();

  console.log('Desktop (1280×800)');
  const D = await newPage(browser, { viewport: { width: 1280, height: 800 } }, base);
  for (const r of ['home', 'games', 'progress', 'habits', 'science', 'settings']) {
    await D.page.goto(base + '#/' + r); await D.page.waitForSelector('#view h1');
    ok(await D.page.locator('#view h1').count() === 1, `route ${r} renders`);
  }
  await D.page.goto(base + '#/home');

  const expectations = {
    echo: (r) => r.level === 4 && r.last.accuracy === 1,        // perfect blocks: N 1→2→3→4
    flash: (r) => r.level === 11 && r.last.accuracy === 1,      // 30 correct, 3-down → +10
    shift: (r) => r.level === 14 && r.last.accuracy === 1,      // 40 correct, 3-down → +13
    arrows: (r) => r.last.accuracy === 1 && r.level >= 12,      // 48 trials, ~38 go trials, 3-down
    grid: (r) => r.level.f === 6 && r.level.b === 5 && r.last.accuracy === 1,
    logic: (r) => r.level === 6 && r.last.accuracy === 1,       // 10 correct, 2-down → +5
    math: (r) => r.last.accuracy === 1 && r.last.score > 10,
    palace: (r) => r.level === 8 && r.last.accuracy === 1,      // 6 words, ≥90% → +2
  };
  for (const [id, check] of Object.entries(expectations)) {
    const t0 = Date.now();
    const r = await playGame(D.page, id);
    ok(r.last && check(r), `${id}: level=${JSON.stringify(r.level)} acc=${r.last?.accuracy} score=${r.last?.score} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  // Level persists and the next run starts from it.
  const r2 = await playGame(D.page, 'logic');
  ok(r2.level === 8, `logic resumes from saved level 6 and climbs to the cap 8 (got ${r2.level})`);

  // Palace list scheduled for review tomorrow; force it due and review via the home banner.
  let st = await D.page.evaluate(() => window.__neurogym.store.get().palace.lists);
  ok(st.length === 1 && st[0].card.due > Date.now() + 23 * 3600e3, 'palace list scheduled ~1 day ahead');
  await D.page.evaluate(() => { window.__neurogym.store.set(s => { s.palace.lists[0].card.due = 0; return s; }); location.hash = '#/games'; location.hash = '#/home'; });
  await D.page.getByRole('button', { name: 'Review' }).click();
  await D.page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 60000 });
  st = await D.page.evaluate(() => window.__neurogym.store.get().palace.lists[0]);
  ok(st.history.length === 2 && st.history[1].recall === 1 && st.card.reps === 1 && st.card.due > Date.now(), 'palace review graded and rescheduled');

  // Check-up via the banner.
  await D.page.goto(base + '#/home');
  await D.page.locator('.banner', { hasText: 'Check-up' }).getByRole('button').click();
  await D.page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 120000 });
  const cu = await D.page.evaluate(() => window.__neurogym.store.get().checkups);
  ok(cu.length === 1 && cu[0].m.backwardDigitSpan === 10 && cu[0].m.stroopAccuracy === 1 && cu[0].m.choiceErrors === 0 && cu[0].m.choiceRT >= 38 && cu[0].m.choiceRT < 120, `check-up saved: ${JSON.stringify(cu[0]?.m)}`);
  ok(await D.page.locator('.banner', { hasText: 'Check-up' }).count() === 0, 'check-up banner hidden after completion');

  // Full workout from the home screen.
  const before = await D.page.evaluate(() => window.__neurogym.store.get().results.length);
  await D.page.getByRole('button', { name: /Start workout|Train again/ }).click();
  await D.page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 300000 });
  const after = await D.page.evaluate(() => window.__neurogym.store.get().results.slice(-4).map(r => r.game));
  ok(after.length === 4 && new Set(after).size === 4, `workout ran 4 distinct exercises: ${after.join(', ')}`);
  ok(before + 4 === await D.page.evaluate(() => window.__neurogym.store.get().results.length), 'workout saved 4 results');

  // Quit mid-game discards the round; Back on the intro exits cleanly.
  await D.page.evaluate(() => { window.__botOff = true; });
  const n0 = await D.page.evaluate(() => window.__neurogym.store.get().results.length);
  await D.page.evaluate(() => { window.__neurogym.play([window.__neurogym.GAMES[0]]); });
  await D.page.getByRole('button', { name: 'Back' }).click();
  await D.page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 10000 });
  ok(true, 'Back on intro returns to app');
  await D.page.evaluate(() => { window.__neurogym.play([window.__neurogym.GAMES[0]]); });
  await D.page.getByRole('button', { name: 'Start' }).click();
  await D.page.waitForSelector('#play .icon-btn');
  await D.page.waitForTimeout(800);
  D.page.__acceptDialogs = true;
  await D.page.click('#play .icon-btn');
  await D.page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 10000 });
  D.page.__acceptDialogs = false;
  ok(n0 === await D.page.evaluate(() => window.__neurogym.store.get().results.length), 'quitting mid-game saves nothing');
  await D.page.evaluate(() => { window.__botOff = false; });

  // Persistence across reload + progress charts.
  await D.page.reload(); await D.page.goto(base + '#/progress'); await D.page.waitForSelector('#view h1');
  ok(await D.page.locator('svg.chart').count() >= 1, 'progress charts render after reload');
  ok(await noOverflow(D.page), 'desktop: no horizontal overflow');
  ok(D.errors.length === 0, `desktop: no console errors ${D.errors.join(' | ')}`);

  // Offline: service worker serves the shell.
  await D.page.evaluate(() => navigator.serviceWorker.ready);
  await D.page.reload(); await D.page.waitForSelector('#view h1');
  await D.ctx.setOffline(true);
  await D.page.reload(); await D.page.waitForSelector('#view h1', { timeout: 5000 }).catch(() => { });
  ok(await D.page.locator('#view h1').count() === 1, 'works offline after first visit');
  await D.ctx.setOffline(false);
  if (SHOTS) await D.page.screenshot({ path: `${SHOTS}/desktop-progress.png` });
  await D.ctx.close();

  console.log('Phone (iPhone 13 profile, touch)');
  const iphone = devices['iPhone 13'];
  const P = await newPage(browser, { viewport: iphone.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: iphone.userAgent }, base);
  for (const r of ['home', 'games', 'progress', 'habits', 'science', 'settings']) {
    await P.page.goto(base + '#/' + r); await P.page.waitForSelector('#view h1');
    ok(await noOverflow(P.page), `phone ${r}: no horizontal overflow`);
    ok(await P.page.evaluate(() => !/\b(null|undefined|NaN)\b/.test(document.getElementById('view').innerText)), `phone ${r}: no null/undefined/NaN text`);
    ok(await P.page.evaluate(() => { const n = document.querySelector('nav').getBoundingClientRect(); return n.bottom >= window.innerHeight - 1 && n.top > window.innerHeight / 2; }), `phone ${r}: tab bar docked at bottom`);
    if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-${r}.png` });
  }
  // Inspect each game's in-play layout with the bot paused, then let it finish.
  for (const g of ['flash', 'echo', 'grid', 'shift', 'arrows', 'logic', 'math', 'palace']) {
    await P.page.evaluate((id) => { window.__botOff = true; window.__neurogym.play([window.__neurogym.GAMES.find(x => x.id === id)]); }, g);
    if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-intro-${g}.png` });
    await P.page.getByRole('button', { name: 'Start' }).tap();
    await P.page.waitForSelector('#play .stage', { timeout: 15000 });
    await P.page.waitForTimeout(g === 'flash' ? 1500 : 700);
    const fits = await P.page.evaluate(() => { const c = document.querySelector('#play .controls'); const r = c.getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
    ok(fits, `phone ${g}: controls on screen, no overflow`);
    if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-play-${g}.png` });
    await P.page.evaluate(() => { window.__botOff = false; });
    await P.page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: 120000 });
  }
  ok(P.errors.length === 0, `phone: no console errors ${P.errors.join(' | ')}`);
  await P.ctx.close();

  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll e2e checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
