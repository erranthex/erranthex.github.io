// End-to-end test: serves the app, completes onboarding, then a perfect in-page bot plays all
// 13 exercises at 10× speed. Verifies scoring, adaptivity, XP/gems/streak/quests, path progress,
// persistence, in-page quit confirmation, offline support and phone layout.
// Run from repo root: node braingym/tests/e2e.cjs  [--shots <dir>]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/plain' };
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
const idle = (page, t = 120000) => page.waitForFunction(() => document.getElementById('play').hidden === true, null, { timeout: t });
const st = (page) => page.evaluate(() => window.__mentaro.store.get());

async function newPage(browser, opts, url) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { globalThis.__ngSpeed = 0.1; globalThis.__ngTest = {}; });
  await ctx.addInitScript({ path: path.join(__dirname, 'bot.js') });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.goto(url);
  return { ctx, page, errors };
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function playGame(page, id) {
  const before = await page.evaluate((id) => window.__mentaro.store.get().levels[id], id);
  await page.evaluate((id) => { window.__mentaro.play([window.__mentaro.ALL[id]]); }, id);
  await idle(page);
  const s = await st(page);
  return { before, last: s.results.filter(r => r.game === id).pop(), level: s.levels[id] };
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();

  console.log('Desktop (1360×860)');
  const D = await newPage(browser, { viewport: { width: 1360, height: 860 } }, base);
  // Welcome → guest → onboarding
  await D.page.waitForSelector('.welcome');
  await D.page.evaluate(() => { window.__botOff = true; });
  ok(await D.page.locator('#lang-select option').count() === 7, 'language picker offers 7 languages');
  await D.page.getByRole('button', { name: 'Play as guest' }).click();
  await D.page.waitForSelector('.onb');
  ok((await D.page.evaluate(() => window.__mentaro.profiles.current())).guest === true, 'guest profile created');
  await D.page.getByRole('button', { name: 'Get started' }).click();
  await D.page.getByRole('button', { name: 'Memory' }).click();
  await D.page.getByRole('button', { name: 'Continue' }).click();
  await D.page.getByRole('button', { name: '30–44' }).click();
  await D.page.getByRole('button', { name: 'Continue' }).click();
  await D.page.getByRole('button', { name: 'Continue' }).click();
  if (SHOTS) await D.page.screenshot({ path: `${SHOTS}/desk-onb-promise.png` });
  await D.page.evaluate(() => { window.__botOff = false; });
  await D.page.getByRole('button', { name: 'Start my first workout' }).click();
  await idle(D.page, 180000);
  let s = await st(D.page);
  ok(s.profile.onboarded && s.profile.age === '30–44' && s.profile.focus.includes('memory'), 'onboarding saved profile');
  ok(s.results.length === 3 && s.path.done === 1 && s.workouts === 1, `first workout: 3 exercises, path node 1 complete (${s.results.map(r => r.game)})`);
  ok(s.results.some(r => ['grid', 'palace'].includes(r.game)), 'focus domain (memory) included in first workout');
  ok(s.xp > 0 && s.results.every(r => r.xp >= 10), `XP awarded (${s.xp})`);
  ok(s.achievements.first && s.achievements.workout, 'achievements unlocked: First Spark, Warmed Up');
  ok(await D.page.locator('.stat-pill.streak b').innerText() === '1', 'streak shows 1');
  ok(await D.page.locator('.node.current').count() === 1, 'learning path shows next node');

  // Guest → named profile keeps progress
  ok(await D.page.locator('.banner.guest').count() === 1, 'guest sees "save my progress" banner');
  const xpGuest = (await st(D.page)).xp;
  await D.page.evaluate(() => { location.hash = '#profile'; }); await D.page.waitForSelector('.account.guest');
  await D.page.fill('#acc-name', 'Alex'); await D.page.fill('#acc-pin', '1234');
  await D.page.locator('.acc-form button[type=submit]').click();
  let me = await D.page.evaluate(() => window.__mentaro.profiles.current());
  ok(!me.guest && me.name === 'Alex' && me.pin && (await st(D.page)).xp === xpGuest, 'guest upgraded to profile "Alex" with PIN, progress kept');

  // Manual difficulty: fixed level, Auto level untouched
  await D.page.evaluate(() => window.__mentaro.store.set(s => { s.settings.speech = false; s.settings.sound = false; return s; }));
  const autoFlash = (await st(D.page)).levels.flash;
  await D.page.evaluate(() => { window.__botOff = true; window.__mentaro.play([window.__mentaro.ALL.flash]); });
  await D.page.locator('.seg-b[data-mode=manual]').click();
  await D.page.locator('.chip-b[data-preset=hard]').click();
  await D.page.locator('.step[aria-label="Level up"]').click();
  ok(await D.page.locator('.diff .lvl-num').innerText() === 'Level 19 of 39', 'manual picker: Hard preset + stepper → level 19');
  await D.page.evaluate(() => { window.__botOff = false; });
  await D.page.getByRole('button', { name: "Let's go" }).click(); await idle(D.page);
  let sm = await st(D.page);
  ok(sm.results.at(-1).manual === true && sm.results.at(-1).level === 19 && sm.levels.flash === autoFlash && sm.diff.flash.mode === 'manual', `manual round stays at 19, Auto level kept at ${autoFlash}`);
  await D.page.evaluate(() => { window.__botOff = true; window.__mentaro.play([window.__mentaro.ALL.flash]); });
  ok(await D.page.locator('.seg-b.on').getAttribute('data-mode') === 'manual', 'manual choice remembered next time');
  await D.page.locator('.seg-b[data-mode=auto]').click();
  await D.page.evaluate(() => { window.__botOff = false; });
  await D.page.getByRole('button', { name: "Let's go" }).click(); await idle(D.page);
  sm = await st(D.page);
  ok(sm.levels.flash === autoFlash + 10 && sm.diff.flash.mode === 'auto', `back to Auto: level rose ${autoFlash} → ${sm.levels.flash}`);

  // Every exercise, perfect bot → expected adaptive response.
  const expect = {
    flash: (r) => r.level === Math.min(39, r.before + 10) && r.last.accuracy === 1,
    shift: (r) => r.level === Math.min(20, r.before + 13) && r.last.accuracy === 1,
    arrows: (r) => r.last.accuracy === 1 && (r.level === 20 || r.level > r.before + 5),
    grid: (r) => r.level.f === r.before.f + 3 && r.level.b === r.before.b + 3 && r.last.accuracy === 1,
    math: (r) => r.last.accuracy === 1 && r.last.score > 10,
    palace: (r) => r.last.accuracy === 1 && r.level === r.before + 2,
    logic: (r) => r.last.accuracy === 1 && r.level === Math.min(8, r.before + 5),
    names: (r) => r.last.accuracy === 1 && r.level === r.before + 1,
    word: (r) => r.last.accuracy === 1 && r.level === (r.before ?? 1) + 1 && r.last.m.words >= 10,
    path: (r) => r.last.accuracy === 1 && r.level === r.before + 4,
    orbit: (r) => r.last.accuracy === 1 && r.level === r.before + 10,
    echo: (r) => r.level === 4 && r.last.accuracy === 1,
    active: (r) => r.last.accuracy === 1,
  };
  for (const [id, check] of Object.entries(expect)) {
    const t0 = Date.now();
    const r = await playGame(D.page, id);
    ok(r.last && check(r), `${id}: level ${JSON.stringify(r.before)}→${JSON.stringify(r.level)} acc=${r.last?.accuracy} skill=${r.last?.skill} xp=${r.last?.xp} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  s = await st(D.page);
  ok(Object.keys(s.bests).length === 12, `skill index recorded for all 12 scored exercises (${Object.keys(s.bests).length})`);
  ok(s.results.filter(r => r.skill != null).every(r => r.skill >= 0 && r.skill <= 1000), 'all skills within 0..1000');
  ok(s.achievements.explorer && s.achievements.perfect, 'Explorer and Flawless achievements');
  ok((s.quests[Object.keys(s.quests)[0]] || []).length === 3, 'all 3 daily quests claimed');

  // Brain screen
  await D.page.evaluate(() => { location.hash = '#brain'; }); await D.page.waitForSelector('.bi-num');
  const bi = +(await D.page.locator('.bi-num').innerText());
  ok(bi > 0 && bi <= 1000, `Brain Index shown (${bi})`);
  ok(await D.page.locator('.radar polygon').count() >= 5 && await D.page.locator('.skill-row').count() === 12, 'radar + 12 skill rows render');
  if (SHOTS) await D.page.screenshot({ path: `${SHOTS}/desk-brain.png`, fullPage: true });

  // Palace review via banner
  await D.page.evaluate(() => { window.__mentaro.store.set(s => { s.palace.lists.at(-1).card.due = 0; return s; }); location.hash = '#games'; location.hash = '#learn'; });
  await D.page.getByRole('button', { name: 'Review' }).click(); await idle(D.page);
  s = await st(D.page);
  ok(s.palace.lists.at(-1).history.length === 2 && s.palace.lists.at(-1).card.due > Date.now(), 'memory review graded and rescheduled');

  // Check-up
  await D.page.evaluate(() => { window.__mentaro.play([window.__mentaro.ALL.checkup], { checkup: true }); }); await idle(D.page);
  s = await st(D.page);
  ok(s.checkups.length === 1 && s.checkups[0].m.backwardDigitSpan === 10 && s.checkups[0].m.stroopAccuracy === 1, `check-up saved ${JSON.stringify(s.checkups[0]?.m)}`);

  // Path: complete nodes until a chest, open it.
  await D.page.evaluate(() => { window.__mentaro.store.set(s => { s.path.done = 2; return s; }); location.hash = '#games'; location.hash = '#learn'; });
  const gems0 = (await st(D.page)).gems;
  await D.page.locator('.node.current').click({ force: true });
  await D.page.getByRole('button', { name: 'Collect' }).click();
  s = await st(D.page);
  ok(s.path.done === 3 && s.gems >= gems0 + 20, `chest opened: +${s.gems - gems0} gems`);
  // Lesson node popover → workout
  await D.page.locator('.node.current').click({ force: true });
  ok(await D.page.locator('.popover .pop-g').count() >= 3, 'lesson popover lists exercises');
  await D.page.locator('.popover .btn.primary').click(); await idle(D.page, 180000);
  ok((await st(D.page)).path.done === 4, 'lesson node completed via path');

  // Shop: buy a streak freeze and a theme
  await D.page.evaluate(() => { window.__mentaro.store.set(s => { s.gems = 400; return s; }); location.hash = '#profile'; });
  await D.page.waitForSelector('.shop');
  await D.page.locator('.shop-item', { hasText: 'Streak freeze' }).getByRole('button').click();
  await D.page.locator('.shop-item', { hasText: 'Ocean theme' }).getByRole('button').click();
  s = await st(D.page);
  ok(s.freezes === 1 && s.owned.includes('ocean') && s.settings.theme === 'ocean' && s.gems === 150, 'shop purchases deduct gems and apply');
  ok(await D.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) === '#0ea5e9', 'theme accent applied');

  // Quit mid-game with in-page confirmation
  await D.page.evaluate(() => { window.__botOff = true; });
  const n0 = (await st(D.page)).results.length;
  await D.page.evaluate(() => { window.__mentaro.play([window.__mentaro.ALL.flash]); });
  await D.page.getByRole('button', { name: 'Back' }).click(); await idle(D.page, 10000);
  ok(true, 'Back on intro exits');
  await D.page.evaluate(() => { window.__mentaro.play([window.__mentaro.ALL.math]); });
  await D.page.getByRole('button', { name: "Let's go" }).click();
  await D.page.waitForSelector('#play .icon-btn'); await D.page.waitForTimeout(400);
  await D.page.click('#play .icon-btn');
  await D.page.getByRole('button', { name: 'Keep going' }).click();
  ok(await D.page.locator('#play').isVisible(), '"Keep going" resumes the exercise');
  await D.page.click('#play .icon-btn');
  await D.page.getByRole('button', { name: 'Quit', exact: true }).click(); await idle(D.page, 10000);
  ok(n0 === (await st(D.page)).results.length, 'quitting saves nothing');
  await D.page.evaluate(() => { window.__botOff = false; });

  // Languages: every language renders the main screens without raw keys
  for (const code of ['es', 'it', 'fr', 'de', 'pt', 'zh', 'en']) {
    await D.page.evaluate((c) => window.__mentaro.setLang(c), code); await D.page.waitForTimeout(150);
    for (const r of ['learn', 'games', 'brain', 'profile']) {
      await D.page.evaluate((r) => { location.hash = '#' + r; }, r); await D.page.waitForTimeout(80);
      const raw = await D.page.evaluate(() => (document.body.innerText.match(/\b(?:g|lvl|btn|nav|prof|acc|learn|brain|res|q|dom|diff|onb)\.[a-z][\w.]*/g) || []).slice(0, 3));
      if (raw.length) ok(false, `${code} ${r}: raw keys ${raw}`);
    }
    ok(await D.page.evaluate(() => document.documentElement.lang) === (code === 'zh' ? 'zh-Hans' : code), `${code}: UI switched, no raw keys`);
  }
  // Word Forge in Chinese uses Chinese characters
  await D.page.evaluate(() => window.__mentaro.setLang('zh'));
  await D.page.evaluate(() => { window.__botOff = true; window.__mentaro.play([window.__mentaro.ALL.word]); });
  await D.page.locator('#play .intro .btn.primary').click(); await D.page.waitForSelector('.wf-tile');
  ok(/[\u4e00-\u9fff]/.test(await D.page.locator('.wf-tile').first().innerText()), 'Word Forge uses Chinese characters in Chinese');
  await D.page.click('#play .icon-btn'); await D.page.locator('.modal .btn.danger-solid').click(); await idle(D.page, 10000);
  await D.page.evaluate(() => { window.__botOff = false; return window.__mentaro.setLang('en'); });

  // Profiles: sign out, PIN protection, separate progress
  await D.page.evaluate(() => { window.__mentaro.profiles.signOut(); location.hash = '#learn'; location.reload(); });
  await D.page.waitForSelector('.welcome');
  ok(await D.page.locator('.who-row').count() === 1, 'welcome lists existing profile');
  await D.page.locator('.who-row').first().click(); await D.page.fill('#pin-input', '0000'); await D.page.keyboard.press('Enter');
  ok(await D.page.locator('.welcome').count() === 1, 'wrong PIN rejected');
  await D.page.locator('.who-row').first().click(); await D.page.fill('#pin-input', '1234'); await D.page.keyboard.press('Enter');
  await D.page.waitForSelector('#view .main-col');
  ok((await D.page.evaluate(() => window.__mentaro.profiles.current())).name === 'Alex', 'correct PIN opens profile');
  const alexXp = (await st(D.page)).xp;
  await D.page.evaluate(() => { window.__mentaro.profiles.signOut(); location.reload(); });
  await D.page.waitForSelector('.welcome');
  await D.page.getByRole('button', { name: 'Create my profile' }).click();
  await D.page.fill('#acc-name', 'Sam'); await D.page.locator('.acc-form button[type=submit]').click();
  await D.page.waitForSelector('.onb');
  ok((await st(D.page)).xp === 0 && (await D.page.evaluate(() => window.__mentaro.profiles.list().length)) === 2, 'second profile starts fresh');
  await D.page.evaluate(() => { const p = window.__mentaro.profiles; const alex = p.list().find(x => x.name === 'Alex'); p.switchTo(alex.id, '1234'); location.hash = '#learn'; location.reload(); });
  await D.page.waitForSelector('#view .main-col');
  ok((await st(D.page)).xp === alexXp, 'switching back restores Alex\'s progress');

  // Persistence + routes
  await D.page.reload();
  for (const r of ['learn', 'games', 'brain', 'league', 'profile', 'science']) {
    await D.page.evaluate((r) => { location.hash = '#' + r; }, r); await D.page.waitForTimeout(150);
    ok(await D.page.locator('#view h1, #view h2').count() > 0 && await noOverflow(D.page), `desktop ${r} renders, no overflow`);
  }
  await D.page.evaluate(() => { location.hash = '#games'; }); await D.page.waitForSelector('.lib-card');
  ok(await D.page.locator('.lib-card').count() === 14 && await D.page.locator('.lib-card.locked').count() === 6, 'games library lists 13 exercises + check-up; 6 still locked at workout 4');
  await D.page.evaluate(() => { location.hash = '#science-word'; }); await D.page.waitForTimeout(200);
  ok(await D.page.locator('#sci-word[open]').count() === 1, 'deep link #science-word opens that entry');
  ok(D.errors.length === 0, `desktop: no console errors or native dialogs ${D.errors.join(' | ')}`);

  // Offline
  await D.page.evaluate(() => navigator.serviceWorker.ready);
  await D.page.reload(); await D.page.waitForTimeout(500);
  await D.ctx.setOffline(true);
  await D.page.reload(); await D.page.waitForSelector('#view h1, #view h2', { timeout: 5000 }).catch(() => { });
  ok(await D.page.locator('.statbar').count() === 1, 'works offline after first visit');
  await D.ctx.setOffline(false);
  await D.ctx.close();

  console.log('Phone (iPhone 13 profile)');
  const iphone = devices['iPhone 13'];
  const P = await newPage(browser, { viewport: iphone.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: iphone.userAgent }, base);
  await P.page.waitForSelector('.welcome');
  ok(await noOverflow(P.page), 'phone welcome: no overflow');
  if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-welcome.png` });
  await P.page.getByRole('button', { name: 'Play as guest' }).tap(); await P.page.waitForSelector('.onb');
  ok(await noOverflow(P.page), 'phone onboarding: no overflow');
  await P.page.evaluate(() => { window.__mentaro.store.set(s => { s.profile.onboarded = true; s.path.done = 30; return s; }); location.hash = '#learn'; });
  await P.page.reload();
  for (const r of ['learn', 'games', 'brain', 'league', 'profile', 'science']) {
    await P.page.evaluate((r) => { location.hash = '#' + r; }, r); await P.page.waitForTimeout(200);
    ok(await noOverflow(P.page), `phone ${r}: no horizontal overflow`);
    ok(await P.page.evaluate(() => !/\b(null|undefined|NaN)\b/.test(document.getElementById('view').innerText)), `phone ${r}: no null/undefined/NaN text`);
    ok(await P.page.evaluate(() => { const n = document.querySelector('nav.tabs').getBoundingClientRect(); return n.bottom >= innerHeight - 1 && n.top > innerHeight / 2; }), `phone ${r}: tab bar docked at bottom`);
    if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-${r}.png` });
  }
  for (const g of ['flash', 'shift', 'arrows', 'grid', 'math', 'palace', 'active', 'logic', 'names', 'word', 'path', 'echo', 'orbit']) {
    await P.page.evaluate((id) => { window.__botOff = true; window.__mentaro.play([window.__mentaro.ALL[id]]); }, g);
    await P.page.getByRole('button', { name: "Let's go" }).waitFor();
    ok(await noOverflow(P.page), `phone ${g}: intro fits`);
    if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-intro-${g}.png` });
    await P.page.getByRole('button', { name: "Let's go" }).tap();
    await P.page.waitForSelector('#play .stage');
    await P.page.waitForTimeout(g === 'flash' ? 1500 : g === 'names' ? 300 : 900);
    const fits = await P.page.evaluate(() => { const c = document.querySelector('#play .controls'); const r = c.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1; });
    ok(fits, `phone ${g}: controls on screen, no overflow`);
    if (SHOTS) await P.page.screenshot({ path: `${SHOTS}/phone-play-${g}.png` });
    // leave via quit confirmation (bot stays off)
    await P.page.click('#play .icon-btn'); await P.page.getByRole('button', { name: 'Quit', exact: true }).tap(); await idle(P.page, 15000);
  }
  ok(P.errors.length === 0, `phone: no console errors ${P.errors.join(' | ')}`);
  await P.ctx.close();

  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll e2e checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
