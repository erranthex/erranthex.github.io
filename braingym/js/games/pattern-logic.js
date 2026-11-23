// Pattern Logic — procedurally generated matrix reasoning (RAVEN rules + I-RAVEN answer sets).
import { el, svg, frame, intro, sleep, waitResponse, beep, now, T } from '../ui.js';
import { createStaircase, stepStaircase, mean } from '../core.js';
import { generateMatrix } from '../matrix.js';

const ITEMS = 10, TIME_LIMIT = 5 * 60 * 1000;
const COLORS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

function shapePath(kind, cx, cy, r) {
  if (kind === 0) return svg('circle', { cx, cy, r });
  if (kind === 1) return svg('rect', { x: cx - r * 0.85, y: cy - r * 0.85, width: r * 1.7, height: r * 1.7 });
  const n = kind === 2 ? 3 : kind === 3 ? 4 : 6, rot = kind === 3 ? 0 : -Math.PI / 2;
  const pts = Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * 2 * Math.PI; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; });
  return svg('polygon', { points: pts.join(' ') });
}

export function drawCell(c, id) {
  const s = svg('svg', { viewBox: '0 0 100 100', class: 'mcell', role: 'img', 'aria-label': `${c.count + 1} shapes` });
  const color = COLORS[c.color];
  const defs = svg('defs', {}, svg('pattern', { id: `h${id}`, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svg('rect', { width: 3, height: 6, fill: color })));
  s.append(defs);
  const n = c.count + 1, r = n === 1 ? 26 : n === 2 ? 18 : 15;
  const pos = n === 1 ? [[50, 50]] : n === 2 ? [[30, 50], [70, 50]] : [[50, 28], [28, 70], [72, 70]];
  for (const [x, y] of pos) {
    const p = shapePath(c.shape, x, y, r);
    p.setAttribute('stroke', color); p.setAttribute('stroke-width', 4);
    p.setAttribute('fill', c.fill === 0 ? color : c.fill === 1 ? 'none' : `url(#h${id})`);
    s.append(p);
  }
  return s;
}

export default {
  id: 'logic', name: 'Pattern Logic', domain: 'Reasoning', icon: '🔷', minutes: 5,
  tagline: 'Find the rule, complete the matrix.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Pattern Logic · matrix reasoning',
      how: `<p>Each row of the 3×3 grid follows rules about <b>shape, number, colour and fill</b>: a feature may stay the same, step up or down, or cycle through three values.</p>
            <p>Pick the tile that completes the bottom-right cell. More rules are combined as you improve.</p>
            <p>Tip: say the rule out loud for one feature at a time.</p>`,
      keys: '1–8 to choose',
      why: `Matrix problems are the classic measure of fluid reasoning. Practising them improves matrix solving, but improving on a test is not the same as raising intelligence. That's why the Check-up uses different tasks. Every puzzle here is freshly generated, and the answer options are balanced (I-RAVEN, Hu et al. 2021) so you can't shortcut by picking the "most typical" option. You have to find the rules.`,
    }, ctx.signal);

    const f = frame(root, 'Pattern Logic', ctx.quit);
    let st = createStaircase({ level: ctx.level || 1, min: 1, max: 8, down: 2, up: 1 });
    const res = [], start = now();
    let uid = 0;
    for (let t = 0; t < ITEMS && now() - start < T(TIME_LIMIT); t++) {
      f.progress(t / ITEMS);
      f.setStatus(`Level ${st.level}`);
      const m = generateMatrix(st.level, ctx.rng);
      if (globalThis.__ngTest) globalThis.__ngTest.matrix = m; // test hook only
      f.stage.innerHTML = ''; f.controls.innerHTML = '';
      const mg = el('div', { class: 'matrix' });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) mg.append(r === 2 && c === 2 ? el('div', { class: 'mcell q' }, '?') : el('div', { class: 'mwrap' }, drawCell(m.grid[r][c], uid++)));
      f.stage.append(mg);
      const opts = m.options.map((o, i) => el('button', { class: 'opt', 'aria-label': `option ${i + 1}` }, drawCell(o, uid++), el('kbd', {}, String(i + 1))));
      f.controls.append(el('div', { class: 'options' }, opts));
      const keys = Object.fromEntries(opts.map((_, i) => [String(i + 1), i]));
      const t0 = now();
      const r = await waitResponse({ buttons: opts.map((b, i) => [b, i]), keys, signal: ctx.signal, t0 });
      const ok = r.value === m.answerIndex;
      opts[m.answerIndex].classList.add('right');
      if (!ok) opts[r.value].classList.add('wrong');
      beep(ctx.settings, ok);
      res.push({ level: st.level, ok, rt: r.rt, plan: m.plan });
      st = stepStaircase(st, ok);
      await sleep(ok ? 700 : 2200, ctx.signal);
    }
    f.progress(1);
    const acc = mean(res.map(x => +x.ok));
    return {
      level: st.level, score: Math.max(0, ...res.filter(x => x.ok).map(x => x.level)), accuracy: acc,
      summary: [`Solved ${res.filter(x => x.ok).length}/${res.length}`, `Hardest solved: level ${Math.max(0, ...res.filter(x => x.ok).map(x => x.level))}`, `Median time: ${Math.round([...res.map(x => x.rt)].sort((a, b) => a - b)[res.length >> 1] / 1000)} s`],
      metrics: { items: res },
    };
  },
};
