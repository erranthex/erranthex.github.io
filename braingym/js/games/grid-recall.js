// Grid Recall — Corsi block span, forward and backward (Corsi 1972; Kessels et al. 2000).
import { introFor, el, frame, intro, sleep, waitResponse, beep } from '../ui.js';
import { t, tl } from '../i18n.js';
import { createStaircase, stepStaircase, shuffle, mean } from '../core.js';

const TRIALS = 12, SIZE = 16;

export default {
  id: 'grid', name: 'Grid Recall', domain: 'Working memory', icon: 'grid', minutes: 3,
  tagline: 'Repeat a lit-up path, sometimes backwards.',
  async run(root, ctx) {
    await intro(root, introFor('grid'), ctx.signal);

    const lv = typeof ctx.level === 'object' && ctx.level ? ctx.level : { f: 3, b: 2 };
    let sF = createStaircase({ level: lv.f, min: 2, max: 12, down: 2, up: 1, fixed: ctx.fixed });
    let sB = createStaircase({ level: lv.b, min: 2, max: 12, down: 2, up: 1, fixed: ctx.fixed });
    const f = frame(root, 'Grid Recall', ctx.quit);
    const tiles = Array.from({ length: SIZE }, (_, i) => el('button', { class: 'tile', 'aria-label': `tile ${i + 1}` }));
    const label = el('div', { class: 'big-label' });
    f.stage.append(label, el('div', { class: 'grid4' }, tiles));
    const res = [];
    for (let ti = 0; ti < TRIALS; ti++) {
      f.progress(ti / TRIALS);
      const back = ti % 2 === 1;
      const s = back ? sB : sF;
      const seq = shuffle([...Array(SIZE).keys()], ctx.rng).slice(0, s.level);
      label.textContent = t(back ? 'g.grid.bwd' : 'g.grid.fwd', { n: s.level }); label.dataset.span = s.level; label.dataset.back = back ? '1' : '';
      label.className = 'big-label' + (back ? ' c-let' : '');
      tiles.forEach(x => { x.disabled = true; x.className = 'tile'; });
      await sleep(900, ctx.signal);
      for (const i of seq) { tiles[i].classList.add('on'); await sleep(650, ctx.signal); tiles[i].classList.remove('on'); await sleep(250, ctx.signal); }
      tiles.forEach(x => (x.disabled = false));
      const want = back ? [...seq].reverse() : seq;
      let ok = true;
      for (let k = 0; k < want.length; k++) {
        const r = await waitResponse({ buttons: tiles.map((b, i) => [b, i]), signal: ctx.signal });
        tiles[r.value].classList.add(r.value === want[k] ? 'hit' : 'bad');
        setTimeout(() => tiles[r.value].classList.remove('hit'), 200);
        if (r.value !== want[k]) { ok = false; break; }
      }
      if (!ok) want.forEach((i, k) => setTimeout(() => tiles[i].classList.add('show'), k * 120));
      beep(ctx.settings, ok); f.hit(ok);
      res.push({ back, span: s.level, ok });
      if (back) sB = stepStaircase(sB, ok); else sF = stepStaircase(sF, ok);
      await sleep(ok ? 500 : 1400, ctx.signal);
    }
    f.progress(1);
    const best = (b) => Math.max(0, ...res.filter(r => r.back === b && r.ok).map(r => r.span));
    return {
      level: { f: sF.level, b: sB.level }, score: best(false) + best(true), accuracy: mean(res.map(r => +r.ok)),
      summary: [t('g.grid.s1', { n: best(false) }), t('g.grid.s2', { n: best(true) }), t('g.grid.s3', { f: sF.level, b: sB.level })],
      metrics: { forward: best(false), backward: best(true), trials: res },
    };
  },
};
