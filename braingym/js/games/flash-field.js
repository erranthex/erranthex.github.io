// Flash Field — speed-of-processing / useful-field-of-view training
// (Ball & Owsley UFOV; ACTIVE trial: Ball et al. JAMA 2002, Edwards et al. 2017, Coe et al. 2026).
import { introFor, el, frame, intro, sleep, raf, measureFrame, showForFrames, waitResponse, beep } from '../ui.js';
import { t, tl } from '../i18n.js';
import { createStaircase, stepStaircase, staircaseThreshold, mean, shuffle } from '../core.js';

const DUR = [500, 400, 320, 250, 200, 160, 130, 100, 83, 67, 50, 33, 17]; // ms, log-ish spacing
const STAGES = () => [t('g.flash.stage0'), t('g.flash.stage1'), t('g.flash.stage2')];
const MAXLEVEL = DUR.length * 3; // 3 stages
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
    await intro(root, introFor('flash'), ctx.signal);

    const frameMs = await measureFrame();
    const f = frame(root, 'Flash Field', ctx.quit);
    const field = el('div', { class: 'ufov' });
    f.stage.append(field);
    let st = createStaircase({ level: Math.min(ctx.level || 1, MAXLEVEL), min: 1, max: MAXLEVEL, down: 3, up: 1, fixed: ctx.fixed });
    const results = [];

    for (let ti = 0; ti < TRIALS; ti++) {
      f.progress(ti / TRIALS);
      const { stage, ms } = levelParams(st.level);
      f.setStatus(`${STAGES()[stage]} · ${ms} ms`);
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
      const bc = CENTRAL.map((c, i) => el('button', { class: 'btn resp veh-btn', 'data-kind': CENTRAL_NAMES[i], 'aria-label': t('g.flash.' + CENTRAL_NAMES[i]) }, el('span', { html: c }), el('kbd', {}, String(i + 1))));
      f.controls.append(el('div', { class: 'q' }, t('g.flash.centre')), ...bc);
      const r1 = await waitResponse({ buttons: bc.map((b, i) => [b, i]), keys: { '1': 0, '2': 1 }, signal: ctx.signal });
      f.controls.innerHTML = '';
      // Q2: peripheral location
      f.controls.append(el('div', { class: 'q' }, t('g.flash.where')));
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
      summary: [t('g.flash.s1', { stage: STAGES()[p.stage], ms: p.ms }), t('g.flash.s2', { n: Math.round(100 * mean(results.map(r => +r.centralOk))) }), t('g.flash.s3', { n: Math.round(100 * mean(results.map(r => +r.periphOk))) }), t('g.flash.s4', { hz: Math.round(1000 / frameMs) })],
      metrics: { thresholdLevel: th, frameMs, trials: results },
    };
  },
};
