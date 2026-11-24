// Active Break — simultaneous cognitive–motor dual-task training.
// Basis: dual-task (motor + cognitive) training improved global cognition and inhibitory control
// in older adults (systematic review & meta-analysis, Eur Rev Aging Phys Act 2020); exercise
// improves cognition in adults over 50 (Northey et al., BJSM 2018).
import { introFor, el, frame, intro, sleep, beep, waitResponse, now, T } from '../ui.js';
import { t, tl } from '../i18n.js';
import { mean, pick, randInt } from '../core.js';

const CATEGORIES = () => tl('g.active.cats');
const MOVES = () => tl('g.active.moves');

// Simple step detector from accelerometer magnitude peaks (when motion sensors are available).
function stepCounter() {
  let steps = 0, last = 0, above = false, on = false;
  const h = (e) => {
    const a = e.accelerationIncludingGravity; if (!a) return;
    const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const t = performance.now();
    if (!above && m > 12.5 && t - last > 280) { above = true; steps++; last = t; }
    if (above && m < 10.5) above = false;
  };
  return {
    async start() {
      try {
        if (typeof DeviceMotionEvent === 'undefined') return false;
        if (typeof DeviceMotionEvent.requestPermission === 'function') { const p = await DeviceMotionEvent.requestPermission(); if (p !== 'granted') return false; }
        window.addEventListener('devicemotion', h); on = true; return true;
      } catch { return false; }
    },
    stop() { if (on) window.removeEventListener('devicemotion', h); },
    get steps() { return steps; },
  };
}

export default {
  id: 'active', name: 'Active Break', domain: 'Body & mind', icon: 'active', minutes: 3,
  tagline: 'Move and think at the same time: 3 short rounds.',
  async run(root, ctx) {
    await intro(root, introFor('active'), ctx.signal);
    const f = frame(root, 'Active Break', ctx.quit);
    const sc = stepCounter(); const motion = await sc.start();
    const ROUND = 40000;
    const big = el('div', { class: 'ab-big' }), move = el('div', { class: 'ab-move' }), sub = el('div', { class: 'muted' });
    f.stage.append(move, big, sub);
    const timer = async (ms, p0, p1) => { const t0 = now(), d = T(ms); while (now() - t0 < d) { f.progress(p0 + (p1 - p0) * (now() - t0) / d); f.setStatus(`${Math.ceil((d - (now() - t0)) / T(1000))} s${motion ? ' · ' + t('g.active.steps', { n: sc.steps }) : ''}`); await sleep(250, ctx.signal); } };
    // Round 1
    move.textContent = pick(MOVES(), ctx.rng); big.textContent = `${randInt(ctx.rng, 120, 200)} − 3 …`; sub.textContent = t('g.active.count');
    await timer(ROUND, 0, 1 / 3);
    // Round 2
    move.textContent = pick(MOVES(), ctx.rng); big.textContent = pick(CATEGORIES(), ctx.rng); sub.textContent = t('g.active.name2');
    await timer(ROUND, 1 / 3, 2 / 3);
    // Round 3: go/no-go while stepping
    move.textContent = t('g.active.march'); sub.textContent = t('g.active.tapHelp');
    const tap = el('button', { class: 'btn primary big ab-tap' }, t('g.active.tap'));
    f.controls.append(tap);
    const trials = []; const t0 = now();
    while (now() - t0 < T(ROUND)) {
      const nTarget = ctx.rng() < 0.3;
      let v; do { v = randInt(ctx.rng, 2, 40); } while ((v % 3 === 0) !== nTarget);
      big.textContent = v;
      const r = await waitResponse({ buttons: [[tap, 1]], keys: { ' ': 1, Enter: 1 }, timeout: 1400, signal: ctx.signal, t0: now() });
      const ok = nTarget ? r.value === 1 : r.value == null;
      trials.push({ target: nTarget, ok }); if (r.value === 1 || nTarget) { beep(ctx.settings, ok); f.hit(ok); }
      big.textContent = ''; await sleep(250, ctx.signal);
      f.progress(2 / 3 + (now() - t0) / T(ROUND) / 3);
    }
    sc.stop(); f.progress(1);
    const acc = trials.length ? mean(trials.map(t => +t.ok)) : 0;
    return { level: 1, score: Math.round(acc * 100), accuracy: acc, summary: [t('g.active.s1', { n: Math.round(acc * 100) }), motion ? t('g.active.s2', { n: sc.steps }) : t('g.active.s2b'), t('g.active.s3')], metrics: { dualTaskAccuracy: acc, steps: sc.steps, motion } };
  },
};
