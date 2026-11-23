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
    const title = $('#play .gtitle')?.textContent || '';

    if (title === 'Echo Grid') {
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
    if (title === 'Flash Field') {
      const layer = $('.ufov-layer');
      if (layer && layer !== S.flash.layer) {
        S.flash.layer = layer; S.flash.a1 = S.flash.a2 = false;
        S.flash.central = layer.querySelector('.u-item.center').textContent;
        const p = layer.querySelector('.u-item.periph');
        const dx = parseFloat(p.style.left) - 50, dy = parseFloat(p.style.top) - 50;
        S.flash.slot = ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
      }
      const q = $('.controls .q')?.textContent || '';
      if (q === 'Centre?' && !S.flash.a1) { const bs = $$('.controls .btn.resp'); const i = Math.max(0, bs.findIndex(b => S.flash.central && b.textContent.startsWith(S.flash.central))); S.flash.a1 = true; pd(bs[i]); return; }
      const spots = $$('.spot');
      if (spots.length === 8 && S.flash.a1 && !S.flash.a2 && !spots.some(s => s.classList.contains('right'))) { S.flash.a2 = true; pd(spots[S.flash.slot ?? 0]); }
      return;
    }
    if (title === 'Rule Shift') {
      const card = $('.card-stim'), pair = card?.querySelector('.pair')?.textContent;
      if (!pair || card.classList.contains('good') || card.classList.contains('bad')) { if (!pair) S.shift.done = false; return; }
      if (S.shift.done) return;
      S.shift.done = true;
      const isNum = card.classList.contains('num');
      const ans = isNum ? (+pair[1] % 2 ? 0 : 1) : ('AEIU'.includes(pair[0]) ? 0 : 1);
      pd($$('.controls .btn.resp')[ans]);
      return;
    }
    if (title === 'Arrow Storm') {
      const a = $('.arrows'); const t = a?.textContent || '';
      if (t.length !== 5) { S.arrows.done = false; return; }
      if (S.arrows.done || a.classList.contains('nogo')) return;
      S.arrows.done = true;
      pd($$('.controls .btn.resp')[t[2] === '→' ? 1 : 0]);
      return;
    }
    if (title === 'Grid Recall') {
      const tiles = $$('.grid4 .tile'); const label = $('.big-label')?.textContent || '';
      if (label !== S.grid.lastLabel) { S.grid.lastLabel = label; S.grid.seq = []; S.grid.clicked = 0; }
      const on = tiles.findIndex(t => t.classList.contains('on'));
      if (on >= 0 && S.grid.seq[S.grid.seq.length - 1] !== on) S.grid.seq.push(on);
      const span = +(label.match(/(\d+) tiles/) || [])[1];
      if (!tiles.length || tiles[0].disabled) return;
      if (S.grid.seq.length !== span) { if (!S.grid.seq.length && on < 0) S.grid.seq = Array(span).fill(0).map((_, i) => i); else return; } // resumed mid-trial: give up this round
      const order = label.includes('Backward') ? [...S.grid.seq].reverse() : S.grid.seq;
      if (S.grid.clicked < order.length) {
        const now = performance.now();
        if (S.grid.lastClick && now - S.grid.lastClick < 8) return; // let the game re-arm its listener
        S.grid.lastClick = now; pd(tiles[order[S.grid.clicked++]]);
      }
      return;
    }
    if (title === 'Pattern Logic') {
      const m = window.__ngTest?.matrix; const opts = $$('.opt');
      if (m && opts.length === 8 && S.logic.m !== m) { S.logic.m = m; pd(opts[m.answerIndex]); }
      return;
    }
    if (title === 'Number Sense') {
      const p = $('.problem')?.textContent || '', ans = $('.answer');
      const mm = p.match(/^(\d+) (.) (\d+) =$/);
      if (!mm || !ans || ans.textContent !== '') return;
      const t = performance.now(); if (S.lastMath && t - S.lastMath < 40) return; S.lastMath = t; // human-plausible pace
      const a = +mm[1], b = +mm[3];
      const r = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[mm[2]];
      for (const d of String(r)) key(d);
      return;
    }
    if (title.startsWith('Mind Palace')) {
      const locus = $('.locus')?.textContent; const word = $('.word')?.textContent;
      if (locus && word) { S.palace.map[locus] = word.toLowerCase(); const b = $('.controls .btn.primary'); if (b && !b.disabled) b.click(); return; }
      const inp = $('.word-in');
      if (inp && locus && inp !== S.palace.input && !$('.fb')) { S.palace.input = inp; inp.value = S.palace.map[locus] || ''; $('.controls .btn.primary').click(); }
      return;
    }
    if (title === 'Check-up') {
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
