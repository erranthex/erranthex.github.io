// Flash Field — speed-of-processing / useful-field-of-view training
// (Ball & Owsley UFOV; ACTIVE trial: Ball et al. JAMA 2002, Edwards et al. 2017, Coe et al. 2026).
import { el, frame, intro, sleep, raf, measureFrame, showForFrames, waitResponse, beep } from '../ui.js';
import { createStaircase, stepStaircase, staircaseThreshold, mean, shuffle } from '../core.js';

const DUR = [500, 400, 320, 250, 200, 160, 130, 100, 83, 67, 50, 33, 17]; // ms, log-ish spacing
const STAGES = ['Centre + edge', 'Centre + edge + clutter', 'Wider field + clutter'];
const MAXLEVEL = DUR.length * STAGES.length;
const TRIALS = 30;
// Original vehicle glyphs (car / truck) drawn as inline SVG.
const CAR = '<svg viewBox="0 0 64 40" class="veh"><path d="M6 28v-7l8-2 8-9h18l10 9 8 2v7z" fill="currentColor"/><circle cx="18" cy="30" r="6" fill="var(--text)"/><circle cx="46" cy="30" r="6" fill="var(--text)"/><path d="M24 12h7v7h-13zM34 12h6l7 7H34z" fill="var(--surface)"/></svg>';
const TRUCK = '<svg viewBox="0 0 64 40" class="veh"><rect x="2" y="6" width="36" height="22" rx="2" fill="currentColor"/><path d="M40 12h12l8 9v7H40z" fill="currentColor"/><path d="M44 15h7l5 6H44z" fill="var(--surface)"/><circle cx="14" cy="30" r="6" fill="var(--text)"/><circle cx="50" cy="30" r="6" fill="var(--text)"/></svg>';
const CENTRAL = [CAR, TRUCK];
export const CENTRAL_NAMES = ['car', 'truck'];

export function levelParams(level) {
  const i = level - 1;
  return { stage: Math.floor(i / DUR.length), ms: DUR[i % DUR.length] };
}

export default {
  id: 'flash', name: 'Flash Field', domain: 'Processing speed', icon: 'flash', minutes: 4,
  tagline: 'Catch the centre and the edge in a flash.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Flash Field · useful field of view',
      how: `<p>Look at the centre. A <b>car or truck</b> flashes in the middle while a <b>car</b> appears somewhere on the edge of the circle.</p>
            <p>Then a mask hides everything. Answer two questions: <b>what was in the centre?</b> and <b>where was the edge car?</b></p>
            <p>The flash gets shorter as you improve, then clutter is added.</p>`,
      keys: '1 = car · 2 = truck, then tap a position',
      why: `Speed-of-processing training under divided attention is the most studied form of cognitive training for older adults. In the large ACTIVE trial, about 10 hours of this type of training (with later booster sessions) improved processing speed and was associated with better long-term outcomes (Ball et al., 2002; Edwards et al., 2017). Boosters mattered, so regular return visits are built into your plan. <i>Mentaro is inspired by this research method; Mentaro itself has not been tested in that trial.</i>`,
    }, ctx.signal);

    const frameMs = await measureFrame();
    const f = frame(root, 'Flash Field', ctx.quit);
    const field = el('div', { class: 'ufov' });
    f.stage.append(field);
    let st = createStaircase({ level: Math.min(ctx.level || 1, MAXLEVEL), min: 1, max: MAXLEVEL, down: 3, up: 1 });
    const results = [];

    for (let t = 0; t < TRIALS; t++) {
      f.progress(t / TRIALS);
      const { stage, ms } = levelParams(st.level);
      f.setStatus(`${STAGES[stage]} · ${ms} ms`);
      const frames = Math.max(1, Math.round(ms / frameMs));
      const centralIdx = Math.floor(ctx.rng() * 2), slot = Math.floor(ctx.rng() * 8);
      const radius = stage === 2 ? 46 : 38;
      field.innerHTML = '';
      const fix = el('div', { class: 'fix' }, '+');
      field.append(fix);
      await sleep(600, ctx.signal);
      // Build the display off-screen, then show for an exact number of frames.
      const disp = el('div', { class: 'ufov-layer' });
      disp.append(el('div', { class: 'u-item center', 'data-kind': CENTRAL_NAMES[centralIdx], html: CENTRAL[centralIdx] }));
      const put = (r, a, html, cls) => disp.append(el('div', { class: 'u-item ' + cls, style: { left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%` }, html }));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 2 * Math.PI - Math.PI / 2;
        if (k === slot) put(radius, a, CAR, 'periph');
        else if (stage >= 1) put(radius, a, '▲', 'distract');
        if (stage >= 1) { put(radius * 0.55, a + Math.PI / 8, '▲', 'distract'); }
      }
      disp.style.visibility = 'hidden';
      field.append(disp);
      await raf();
      const shown = await showForFrames(() => { fix.style.visibility = 'hidden'; disp.style.visibility = 'visible'; }, () => { disp.remove(); }, frames);
      // Pattern mask (backward masking stops after-images from extending exposure).
      const mask = el('div', { class: 'mask' }, Array.from({ length: 64 }, () => el('i', { style: { opacity: (0.2 + ctx.rng() * 0.8).toFixed(2), transform: `rotate(${Math.floor(ctx.rng() * 4) * 45}deg)` } })));
      field.append(mask);
      await sleep(250, ctx.signal);
      mask.remove();

      // Q1: central identity
      f.controls.innerHTML = '';
      const bc = CENTRAL.map((c, i) => el('button', { class: 'btn resp veh-btn', 'data-kind': CENTRAL_NAMES[i], 'aria-label': CENTRAL_NAMES[i] }, el('span', { html: c }), el('kbd', {}, String(i + 1))));
      f.controls.append(el('div', { class: 'q' }, 'Centre?'), ...bc);
      const r1 = await waitResponse({ buttons: bc.map((b, i) => [b, i]), keys: { '1': 0, '2': 1 }, signal: ctx.signal });
      f.controls.innerHTML = '';
      // Q2: peripheral location
      f.controls.append(el('div', { class: 'q' }, 'Where was the edge car? Tap its spot.'));
      const spots = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 2 * Math.PI - Math.PI / 2;
        const s = el('button', { class: 'spot', 'aria-label': `position ${k + 1}`, style: { left: `${50 + radius * Math.cos(a)}%`, top: `${50 + radius * Math.sin(a)}%` } });
        spots.push(s); field.append(s);
      }
      const r2 = await waitResponse({ buttons: spots.map((b, i) => [b, i]), signal: ctx.signal });
      const ok = r1.value === centralIdx && r2.value === slot;
      spots[slot].classList.add('right');
      if (!ok && r2.value !== slot) spots[r2.value]?.classList.add('wrongspot');
      beep(ctx.settings, ok); f.hit(ok);
      results.push({ level: st.level, ms, shown, ok, centralOk: r1.value === centralIdx, periphOk: r2.value === slot });
      st = stepStaircase(st, ok);
      f.controls.innerHTML = '';
      await sleep(500, ctx.signal);
    }
    f.progress(1);
    const th = staircaseThreshold(st, 12);
    const p = levelParams(Math.round(th));
    return {
      level: st.level, score: +th.toFixed(1), accuracy: mean(results.map(r => +r.ok)),
      summary: [`Threshold: ${STAGES[p.stage]} at ~${p.ms} ms`, `Centre correct: ${Math.round(100 * mean(results.map(r => +r.centralOk)))}%`, `Edge correct: ${Math.round(100 * mean(results.map(r => +r.periphOk)))}%`, `Display refresh ≈ ${Math.round(1000 / frameMs)} Hz`],
      metrics: { thresholdLevel: th, frameMs, trials: results },
    };
  },
};
