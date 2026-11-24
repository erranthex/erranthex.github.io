// In-page "perfect player" used by the end-to-end test. It reads only what a human sees on
// screen (plus the matrix test hook) and answers correctly, so the test can verify that
// scoring and adaptive difficulty respond the way they should.
(() => {
  const S = { echo: { hist: [], block: '', lastOn: null }, flash: { layer: null, central: null, slot: null, a1: false, a2: false },
    shift: { done: false }, arrows: { done: false }, grid: { seq: [], clicked: 0, wasEnabled: false, lastLabel: '' },
    logic: { m: null }, palace: { map: {}, input: null }, crt: { done: false }, ds: { seq: [], prev: '', typed: false }, stroop: { word: null } };
  window.__botState = S;
  const pd = (n) => n && n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const RGB = { 'rgb(229, 72, 77)': 0, 'rgb(62, 99, 221)': 1, 'rgb(48, 164, 108)': 2, 'rgb(245, 217, 10)': 3 };
  let busy = false;
  function tick() {
    if (busy) return; busy = true;
    try { step(); } finally { busy = false; }
  }
  function step() {
    if (window.__botOff) return;
    const play = $('#play'); if (!play || play.hidden) return;
    const start = $('#play .intro .btn.primary'); if (start) { start.click(); return; }
    const gid = play.dataset.game || '';

    if (gid === 'echo') {
      const label = $('.big-label')?.textContent || '';
      const m = label.match(/Block (\d+)\/\d+ · N = (\d+)/);
      if (m && m[1] !== S.echo.block) { S.echo.block = m[1]; S.echo.hist = []; S.echo.n = +m[2]; }
      const cells = $$('.grid3 .cell'); const on = cells.findIndex(c => c.classList.contains('on'));
      if (on < 0) { S.echo.lastOn = null; return; }
      if (S.echo.lastOn !== null) return;
      const letter = cells[on].textContent; if (!letter) return; // wait until the letter is drawn
      S.echo.lastOn = on;
      const h = S.echo.hist; h.push([on, letter]);
      const n = S.echo.n;
      if (h.length > n) {
        const prev = h[h.length - 1 - n];
        const [bp, bl] = $$('.controls .btn.resp');
        if (prev[0] === on) pd(bp);
        if (prev[1] === letter) pd(bl);
      }
      return;
    }
    if (gid === 'flash') {
      const layer = $('.ufov-layer');
      if (layer && layer !== S.flash.layer) {
        S.flash.layer = layer; S.flash.a1 = S.flash.a2 = false;
        S.flash.central = layer.querySelector('.u-item.center').dataset.kind;
        const p = layer.querySelector('.u-item.periph');
        const dx = parseFloat(p.style.left) - 50, dy = parseFloat(p.style.top) - 50;
        S.flash.slot = ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
      }
      const q = $('.controls .q')?.textContent || '';
      if ($('.controls .veh-btn') && !S.flash.a1) { const bs = $$('.controls .btn.resp'); const i = Math.max(0, bs.findIndex(b => b.dataset.kind === S.flash.central)); S.flash.a1 = true; pd(bs[i]); return; }
      const spots = $$('.spot');
      if (spots.length === 8 && S.flash.a1 && !S.flash.a2 && !spots.some(s => s.classList.contains('right'))) { S.flash.a2 = true; pd(spots[S.flash.slot ?? 0]); }
      return;
    }
    if (gid === 'shift') {
      const card = $('.card-stim'), pair = card?.querySelector('.pair')?.textContent;
      if (!pair || card.classList.contains('good') || card.classList.contains('bad')) { if (!pair) S.shift.done = false; return; }
      if (S.shift.done) return;
      S.shift.done = true;
      const isNum = card.classList.contains('num');
      const ans = isNum ? (+pair[1] % 2 ? 0 : 1) : ('AEIU'.includes(pair[0]) ? 0 : 1);
      pd($$('.controls .btn.resp')[ans]);
      return;
    }
    if (gid === 'arrows') {
      const a = $('.arrows'); const t = a?.textContent || '';
      if (t.length !== 5) { S.arrows.done = false; return; }
      if (S.arrows.done || a.classList.contains('nogo')) return;
      S.arrows.done = true;
      pd($$('.controls .btn.resp')[t[2] === '→' ? 1 : 0]);
      return;
    }
    if (gid === 'grid') {
      const tiles = $$('.grid4 .tile'); const label = $('.big-label')?.textContent || '';
      if (label !== S.grid.lastLabel) { S.grid.lastLabel = label; S.grid.seq = []; S.grid.clicked = 0; }
      const on = tiles.findIndex(t => t.classList.contains('on'));
      if (on >= 0 && S.grid.seq[S.grid.seq.length - 1] !== on) S.grid.seq.push(on);
      const span = +($('.big-label')?.dataset.span || 0);
      if (!tiles.length || tiles[0].disabled) return;
      if (S.grid.seq.length !== span) { if (!S.grid.seq.length && on < 0) S.grid.seq = Array(span).fill(0).map((_, i) => i); else return; } // resumed mid-trial: give up this round
      const order = $('.big-label')?.dataset.back ? [...S.grid.seq].reverse() : S.grid.seq;
      if (S.grid.clicked < order.length) {
        const now = performance.now();
        if (S.grid.lastClick && now - S.grid.lastClick < 8) return; // let the game re-arm its listener
        S.grid.lastClick = now; pd(tiles[order[S.grid.clicked++]]);
      }
      return;
    }
    if (gid === 'logic') {
      const m = window.__ngTest?.matrix; const opts = $$('.opt');
      if (m && opts.length === 8 && S.logic.m !== m) { S.logic.m = m; pd(opts[m.answerIndex]); }
      return;
    }
    if (gid === 'math') {
      const p = $('.problem')?.textContent || '', ans = $('.answer');
      const mm = p.match(/^(\d+) (.) (\d+) =$/);
      if (!mm || !ans || ans.textContent !== '') return;
      const t = performance.now(); if (S.lastMath && t - S.lastMath < 40) return; S.lastMath = t; // human-plausible pace
      const a = +mm[1], b = +mm[3];
      const r = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[mm[2]];
      for (const d of String(r)) key(d);
      return;
    }
    if (gid === 'palace') {
      const locus = $('.locus')?.textContent; const word = $('.word')?.textContent;
      if (locus && word) { S.palace.map[locus] = word.toLowerCase(); const b = $('.controls .btn.primary'); if (b && !b.disabled) b.click(); return; }
      const inp = $('.word-in');
      if (inp && locus && inp !== S.palace.input && !$('.fb')) { S.palace.input = inp; inp.value = S.palace.map[locus] || ''; $('.controls .btn.primary').click(); }
      return;
    }
    const T = window.__ngTest || {}, tnow = performance.now();
    const throttle = (k, ms) => { if (S[k] && tnow - S[k] < ms) return true; S[k] = tnow; return false; };
    if (gid === 'word') {
      if (!T.word || !$('.wf-tiles')) return;
      if (S.wordSeed !== T.word.seed) { S.wordSeed = T.word.seed; S.wordQueue = [...T.word.answers]; }
      if (!S.wordQueue.length || throttle('lastWord', 30)) return;
      const w = S.wordQueue.shift();
      for (const ch of w) key(ch);
      key('Enter');
      return;
    }
    if (gid === 'names') {
      const next = $('.controls .btn.primary');
      if (next && !next.disabled && $('.nm-name')) { if (!throttle('lastNm', 15)) next.click(); return; }
      const opts = $$('.nm-opt');
      if (opts.length && T.current && !opts.some(o => o.classList.contains('right'))) {
        if (S.nmOpts === opts[0]) return;
        S.nmOpts = opts[0]; pd(opts.find(o => o.dataset.name === T.current));
      }
      return;
    }
    if (gid === 'path') {
      if (!T.route || play.dataset.phase !== 'walk') return;
      const cells = $$('.pf-cell');
      if (S.pfRoute !== T.route.route) { S.pfRoute = T.route.route; S.pfPos = 0; }
      if (S.pfPos >= T.route.route.length - 1 || throttle('lastPf', 10)) return;
      const [r, c] = T.route.route[++S.pfPos];
      pd(cells.find(x => +x.dataset.r === r && +x.dataset.c === c));
      return;
    }
    if (gid === 'orbit') {
      const st = $('.gstatus')?.textContent || '', o = T.orbit, cv = $('canvas.orbit');
      if (!o || !cv || play.dataset.phase !== 'pick') return;
      if (S.orbBalls !== o.balls) { S.orbBalls = o.balls; S.orbDone = new Set(); }
      if (throttle('lastOrb', 10)) return;
      const i = o.balls.findIndex((b, k) => b.target && !S.orbDone.has(k));
      if (i < 0) return;
      S.orbDone.add(i);
      const rc = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rc.left + o.balls[i].x, clientY: rc.top + o.balls[i].y }));
      return;
    }
    if (gid === 'active') {
      const bigEl = $('.ab-big'), big = bigEl?.textContent || '', tap = $('.ab-tap');
      if (!tap || !/^\d+$/.test(big)) { S.abNode = null; return; }
      if (S.abNode === big) return;
      S.abNode = big;
      if (+big % 3 === 0) pd(tap);
      return;
    }
    if (gid === 'checkup') {
      const dot = $('.crt .dot');
      if ($('.crt')) {
        if (!dot) { S.crt.done = false; return; }
        if (!S.crt.done) { S.crt.done = true; const side = [...$('.crt').children].indexOf(dot); const b = $$('.controls .btn.resp')[side]; setTimeout(() => pd(b), 40); } // fixed 40 ms "human" latency
        return;
      }
      const show = $('.problem');
      if (show && $('.answer')) {
        const t = show.textContent;
        if (/^\d$/.test(t) && t !== S.ds.prev) S.ds.seq.push(t);
        if (t === '' && S.ds.prev !== '' && !/^\d$/.test(S.ds.prev)) { /* between feedback and next trial */ }
        if (t.startsWith('✓') || t.startsWith('✗')) { S.ds.seq = []; S.ds.typed = false; }
        S.ds.prev = t;
        if (t === '?' && $('.numpad') && !S.ds.typed && S.ds.seq.length) { S.ds.typed = true; for (const d of [...S.ds.seq].reverse()) key(d); }
        return;
      }
      const w = $('.stroop');
      if (w) {
        if (!w.textContent) { S.stroop.word = null; return; }
        if (S.stroop.word) return;
        S.stroop.word = w.textContent;
        const i = RGB[w.style.color];
        pd($$('.controls .btn.swatch')[i]);
      }
    }
  }
  new MutationObserver(tick).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  setInterval(tick, 3);
})();
