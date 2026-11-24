// Arrow Storm — flanker + go/no-go (Eriksen & Eriksen 1974; inhibitory control, Diamond 2013).
import { introFor, el, frame, intro, sleep, waitResponse, beep, now } from '../ui.js';
import { t, tl } from '../i18n.js';
import { createStaircase, stepStaircase, mean, median } from '../core.js';

const TRIALS = 48, NOGO_P = 0.2;
export const deadline = (level) => Math.max(400, Math.round(1500 * 0.92 ** (level - 1)));

export default {
  id: 'arrows', name: 'Arrow Storm', domain: 'Attention & inhibition', icon: 'arrows', minutes: 3,
  tagline: 'Follow the middle arrow, ignore the crowd.',
  async run(root, ctx) {
    await intro(root, introFor('arrows'), ctx.signal);

    const f = frame(root, 'Arrow Storm', ctx.quit);
    const stim = el('div', { class: 'arrows' });
    f.stage.append(stim);
    const bl = el('button', { class: 'btn resp' }, t('g.arrows.left'), el('kbd', {}, '←'));
    const br = el('button', { class: 'btn resp' }, t('g.arrows.right'), el('kbd', {}, '→'));
    f.controls.append(bl, br);
    let st = createStaircase({ level: ctx.level || 1, min: 1, max: 20, down: 3, up: 1, fixed: ctx.fixed });
    const trials = [];
    for (let ti = 0; ti < TRIALS; ti++) {
      f.progress(ti / TRIALS);
      const dir = ctx.rng() < 0.5 ? 0 : 1, congruent = ctx.rng() < 0.5, nogo = ctx.rng() < NOGO_P;
      const c = dir ? '→' : '←', fl = congruent ? c : (dir ? '←' : '→');
      stim.className = 'arrows' + (nogo ? ' nogo' : '');
      stim.textContent = '+';
      await sleep(300 + Math.floor(ctx.rng() * 400), ctx.signal); // jittered fixation prevents rhythmic anticipation
      stim.textContent = fl + fl + c + fl + fl;
      const dl = deadline(st.level);
      f.setStatus(t('g.arrows.window', { n: dl }));
      const r = await waitResponse({ buttons: [[bl, 0], [br, 1]], keys: { ArrowLeft: 0, f: 0, F: 0, ArrowRight: 1, j: 1, J: 1 }, timeout: dl, signal: ctx.signal, t0: now() });
      const ok = nogo ? r.value == null : r.value === dir;
      trials.push({ congruent, nogo, ok, rt: r.rt, responded: r.value != null });
      if (!ok || nogo) beep(ctx.settings, ok); f.hit(ok);
      stim.textContent = ok ? '✓' : '✗';
      stim.className = 'arrows ' + (ok ? 'good' : 'bad');
      if (!nogo) st = stepStaircase(st, ok); // staircase on go trials; no-go accuracy reported separately
      await sleep(ok ? 200 : 500, ctx.signal);
    }
    f.progress(1);
    const go = trials.filter(x => !x.nogo), ng = trials.filter(x => x.nogo);
    const rtOf = (cong) => median(go.filter(x => x.ok && x.congruent === cong).map(x => x.rt));
    const interference = Math.round(rtOf(false) - rtOf(true));
    const faRate = ng.length ? mean(ng.map(x => +x.responded)) : 0;
    const acc = mean(trials.map(x => +x.ok));
    return {
      level: st.level, score: st.level, accuracy: acc,
      summary: [t('g.arrows.s1', { n: Math.round(acc * 100) }), t('g.arrows.s2', { n: Number.isFinite(interference) ? interference + ' ms' : t('common.na') }), t('g.arrows.s3', { n: Math.round((1 - faRate) * 100) })],
      metrics: { interference, noGoFalseAlarm: faRate, trials },
    };
  },
};
