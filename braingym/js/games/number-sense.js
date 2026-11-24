// Number Sense — adaptive mental arithmetic sprint (Elevate-style; Takeuchi et al., J Neurosci 2011).
import { el, frame, intro, sleep, beep, now, T } from '../ui.js';
import { createStaircase, stepStaircase, mean, randInt, pick } from '../core.js';

const DURATION = 90 * 1000;

export function makeProblem(level, rng) {
  const ops = level <= 2 ? ['+', '−'] : level <= 5 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const op = pick(ops, rng);
  const hi = level <= 1 ? 9 : level <= 3 ? 20 : level <= 6 ? 50 : level <= 9 ? 99 : 199;
  let a, b, ans;
  if (op === '+') { a = randInt(rng, 2, hi); b = randInt(rng, 2, hi); ans = a + b; }
  else if (op === '−') { a = randInt(rng, 2, hi); b = randInt(rng, 1, a); ans = a - b; }
  else if (op === '×') { const m = level <= 5 ? 9 : level <= 8 ? 12 : 19; a = randInt(rng, 2, m); b = randInt(rng, 2, Math.max(2, Math.floor(hi / 4))); ans = a * b; }
  else { const m = level <= 8 ? 9 : 15; b = randInt(rng, 2, m); ans = randInt(rng, 2, Math.max(2, Math.floor(hi / 4))); a = b * ans; }
  return { text: `${a} ${op} ${b}`, ans };
}

export default {
  id: 'math', name: 'Number Sense', domain: 'Numeracy', icon: 'math', minutes: 2,
  tagline: '90-second adaptive mental math sprint.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Number Sense · mental math',
      how: `<p>Solve as many problems as you can in <b>90 seconds</b>. Type the answer; it submits automatically when correct.</p><p>Press <b>Skip</b> if you're stuck. Difficulty adapts after every problem.</p>`,
      keys: 'Type digits · Backspace · Enter = skip',
      why: `Mental calculation trains numerical working memory and retrieval of arithmetic facts. Speeded arithmetic training produced gains in processing speed in a controlled study (Takeuchi et al., 2011), and fluency frees working memory for everyday quantitative decisions. Expect domain-specific gains: you'll get faster at arithmetic.`,
    }, ctx.signal);

    const f = frame(root, 'Number Sense', ctx.quit);
    const prob = el('div', { class: 'problem' });
    const ans = el('div', { class: 'answer', 'aria-live': 'polite' });
    f.stage.append(prob, ans);
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', 'Skip'];
    const pad = el('div', { class: 'numpad' }, keys.map(k => el('button', { class: 'btn key' + (k === 'Skip' ? ' skip' : ''), 'data-k': k }, k)));
    f.controls.append(pad);
    let st = createStaircase({ level: ctx.level || 1, min: 1, max: 12, down: 2, up: 1 });
    const res = [];
    const start = now();
    let cur, typed = '', t0, resolveItem;
    const next = () => { cur = makeProblem(st.level, ctx.rng); typed = ''; prob.textContent = cur.text + ' ='; ans.textContent = ''; t0 = now(); f.setStatus(`Level ${st.level}`); };
    const input = (k) => {
      if (!cur) return;
      if (k === 'Skip') { finish(false); return; }
      if (k === '⌫') typed = typed.slice(0, -1);
      else if (/^\d$/.test(k) && typed.length < 5) typed += k;
      ans.textContent = typed;
      if (typed !== '' && Number(typed) === cur.ans) finish(true);
      else if (typed.length >= String(cur.ans).length && Number(typed) !== cur.ans) ans.classList.add('off');
      else ans.classList.remove('off');
    };
    const finish = (ok) => { res.push({ level: st.level, ok, rt: now() - t0 }); st = stepStaircase(st, ok); beep(ctx.settings, ok); f.hit(ok); ans.classList.remove('off'); prob.classList.add(ok ? 'good' : 'bad'); setTimeout(() => prob.classList.remove('good', 'bad'), 200); next(); };
    pad.addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); input(b.dataset.k); } });
    const onKey = (e) => { if (/^\d$/.test(e.key)) input(e.key); else if (e.key === 'Backspace') input('⌫'); else if (e.key === 'Enter') input('Skip'); };
    window.addEventListener('keydown', onKey);
    next();
    try {
      while (now() - start < T(DURATION)) { f.progress((now() - start) / T(DURATION)); await sleep(100, ctx.signal); }
    } finally { window.removeEventListener('keydown', onKey); }
    cur = null;
    f.progress(1);
    const solved = res.filter(r => r.ok).length;
    return {
      level: st.level, score: solved, accuracy: res.length ? solved / res.length : 0,
      summary: [`Solved: ${solved}`, `Skipped: ${res.length - solved}`, `Reached level ${st.level}`],
      metrics: { items: res, meanRt: mean(res.filter(r => r.ok).map(r => r.rt)) },
    };
  },
};
