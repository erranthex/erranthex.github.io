// Check-up — monthly untrained assessment battery. These tasks are NOT used in daily training,
// so changes here are a fairer (if still imperfect) signal of transfer than game scores
// (Simons et al., 2016 recommend measuring untrained outcomes).
import { el, frame, intro, sleep, waitResponse, beep, now } from '../ui.js';
import { median, mean, shuffle, pick } from '../core.js';

const COLORS = [['RED', '#e5484d'], ['BLUE', '#3e63dd'], ['GREEN', '#30a46c'], ['YELLOW', '#f5d90a']];

async function choiceRT(f, ctx) {
  f.stage.innerHTML = ''; f.controls.innerHTML = '';
  const box = el('div', { class: 'crt' }, el('div', {}), el('div', {}));
  const bl = el('button', { class: 'btn resp' }, 'Left', el('kbd', {}, '←'));
  const br = el('button', { class: 'btn resp' }, 'Right', el('kbd', {}, '→'));
  f.stage.append(el('p', {}, '1/3 · Reaction: tap the side where the dot appears, as fast as you can.'), box);
  f.controls.append(bl, br);
  await sleep(1200, ctx.signal);
  const rts = []; let errors = 0;
  for (let i = 0; i < 16; i++) {
    f.progress(i / 48);
    await sleep(600 + ctx.rng() * 900, ctx.signal);
    const side = ctx.rng() < 0.5 ? 0 : 1;
    box.children[side].classList.add('dot');
    const r = await waitResponse({ buttons: [[bl, 0], [br, 1]], keys: { ArrowLeft: 0, ArrowRight: 1, f: 0, j: 1 }, timeout: 2000, signal: ctx.signal, t0: now() });
    box.children[side].classList.remove('dot');
    if (r.value === side) rts.push(r.rt); else errors++;
  }
  return { choiceRT: Math.round(median(rts)), choiceErrors: errors };
}

async function digitSpan(f, ctx) {
  f.stage.innerHTML = ''; f.controls.innerHTML = '';
  const show = el('div', { class: 'problem' });
  const typed = el('div', { class: 'answer' });
  f.stage.append(el('p', {}, '2/3 · Digits backward: watch the digits, then type them in REVERSE order.'), show, typed);
  let len = 3, best = 0, fails = 0;
  while (fails < 2 && len <= 10) {
    const seq = Array.from({ length: len }, () => Math.floor(ctx.rng() * 10));
    f.controls.innerHTML = ''; typed.textContent = '';
    await sleep(800, ctx.signal);
    for (const d of seq) { show.textContent = d; await sleep(800, ctx.signal); show.textContent = ''; await sleep(200, ctx.signal); }
    show.textContent = '?';
    const want = [...seq].reverse().join('');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
    const pad = el('div', { class: 'numpad' }, keys.map(k => el('button', { class: 'btn key', 'data-k': k }, k)));
    f.controls.append(pad);
    const got = await new Promise((res, rej) => {
      let s = '';
      const inp = (k) => { if (k === 'OK') { cleanup(); res(s); return; } s = k === '⌫' ? s.slice(0, -1) : s + k; typed.textContent = s; if (s.length === want.length) { cleanup(); res(s); } };
      const onKey = (e) => { if (/^\d$/.test(e.key)) inp(e.key); else if (e.key === 'Backspace') inp('⌫'); else if (e.key === 'Enter') inp('OK'); };
      const onPad = (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); inp(b.dataset.k); } };
      const ab = () => { cleanup(); rej(new DOMException('aborted', 'AbortError')); };
      const cleanup = () => { window.removeEventListener('keydown', onKey); pad.removeEventListener('pointerdown', onPad); ctx.signal.removeEventListener('abort', ab); };
      window.addEventListener('keydown', onKey); pad.addEventListener('pointerdown', onPad); ctx.signal.addEventListener('abort', ab, { once: true });
    });
    const ok = got === want;
    beep(ctx.settings, ok);
    show.textContent = ok ? '✓' : `✗ ${want}`;
    if (ok) { best = len; len++; fails = 0; } else fails++;
    f.progress((16 + Math.min(16, (len - 3) * 3)) / 48);
    await sleep(900, ctx.signal);
  }
  return { backwardDigitSpan: best };
}

async function stroop(f, ctx) {
  f.stage.innerHTML = ''; f.controls.innerHTML = '';
  const word = el('div', { class: 'stroop' });
  f.stage.append(el('p', {}, '3/3 · Colours: tap the INK colour of the word, not what it says.'), word);
  const btns = COLORS.map(([n, c], i) => el('button', { class: 'btn resp swatch', style: { background: c }, 'aria-label': n }, String(i + 1)));
  f.controls.append(...btns);
  await sleep(1500, ctx.signal);
  const trials = shuffle(Array.from({ length: 24 }, (_, i) => i % 2 === 0), ctx.rng);
  const res = [];
  for (let i = 0; i < trials.length; i++) {
    f.progress((32 + (i / trials.length) * 16) / 48);
    const ink = Math.floor(ctx.rng() * 4);
    const w = trials[i] ? ink : pick([0, 1, 2, 3].filter(k => k !== ink), ctx.rng);
    word.textContent = COLORS[w][0]; word.style.color = COLORS[ink][1];
    const r = await waitResponse({ buttons: btns.map((b, k) => [b, k]), keys: { '1': 0, '2': 1, '3': 2, '4': 3 }, timeout: 3000, signal: ctx.signal, t0: now() });
    res.push({ congruent: trials[i], ok: r.value === ink, rt: r.rt });
    word.textContent = '';
    await sleep(350, ctx.signal);
  }
  const rt = (c) => median(res.filter(x => x.ok && x.congruent === c).map(x => x.rt));
  return { stroopCost: Math.round(rt(false) - rt(true)), stroopAccuracy: mean(res.map(x => +x.ok)) };
}

export default {
  id: 'checkup', name: 'Monthly Check-up', domain: 'Assessment', icon: 'checkup', minutes: 4, assessment: true,
  tagline: 'Untrained tasks that test whether gains transfer.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Monthly Check-up',
      how: `<p>Three short tasks you <b>don't</b> practise in daily training: reaction time, backward digit span and a colour-word (Stroop) test.</p><p>Do it rested, in a quiet place, ideally at the same time of day each month.</p>`,
      why: `Brain-game scores always go up with practice; that's task learning. The real question is whether skills <i>transfer</i>. Independent reviews (Simons et al., 2016) found that most programs never test this properly. Re-testing on untrained tasks every 4 weeks gives you an honest signal. Expect some improvement simply from re-taking (practice effects), so watch the trend over several months.`,
    }, ctx.signal);
    const f = frame(root, 'Check-up', ctx.quit);
    const a = await choiceRT(f, ctx);
    const b = await digitSpan(f, ctx);
    const c = await stroop(f, ctx);
    f.progress(1);
    const m = { ...a, ...b, ...c };
    return {
      level: 1, score: m.backwardDigitSpan, accuracy: m.stroopAccuracy,
      summary: [`Choice reaction time: ${m.choiceRT} ms`, `Backward digit span: ${m.backwardDigitSpan}`, `Stroop interference: ${m.stroopCost} ms (accuracy ${Math.round(m.stroopAccuracy * 100)}%)`],
      metrics: m,
    };
  },
};
