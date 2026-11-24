// Active Break — simultaneous cognitive–motor dual-task training.
// Basis: dual-task (motor + cognitive) training improved global cognition and inhibitory control
// in older adults (systematic review & meta-analysis, Eur Rev Aging Phys Act 2020); exercise
// improves cognition in adults over 50 (Northey et al., BJSM 2018).
import { el, frame, intro, sleep, beep, waitResponse, now, T } from '../ui.js';
import { mean, pick, randInt } from '../core.js';

const CATEGORIES = ['animals', 'fruits', 'countries', 'things in a kitchen', 'jobs', 'sports', 'colours', 'cities', 'musical instruments', 'vegetables', 'things that fly', 'clothing'];
const MOVES = ['March in place, knees up', 'Step side to side', 'Slow heel raises (hold a chair if needed)', 'Arm circles while stepping'];

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
    await intro(root, {
      title: 'Active Break · move + think',
      how: `<p>Stand up (or sit tall if standing isn't safe). Three 40-second rounds, each pairing a <b>movement</b> with a <b>thinking task</b>:</p>
            <p>① Count backwards out loud · ② Name things in a category · ③ Tap the screen on <b>multiples of 3</b> while stepping.</p>
            <p class="small muted">Stop if you feel pain or dizziness. Keep a chair nearby for balance.</p>`,
      why: `Doing physical and mental work together (dual-tasking) trains the executive control you need to walk while talking or cross a busy street. A 2020 meta-analysis of cognitive–motor training in older adults found improvements in global cognition and inhibitory control, and regular moderate exercise improves cognition in adults over 50 (Northey et al., 2018). It's also a healthy break from sitting.`,
    }, ctx.signal);
    const f = frame(root, 'Active Break', ctx.quit);
    const sc = stepCounter(); const motion = await sc.start();
    const ROUND = 40000;
    const big = el('div', { class: 'ab-big' }), move = el('div', { class: 'ab-move' }), sub = el('div', { class: 'muted' });
    f.stage.append(move, big, sub);
    const timer = async (ms, p0, p1) => { const t0 = now(), d = T(ms); while (now() - t0 < d) { f.progress(p0 + (p1 - p0) * (now() - t0) / d); f.setStatus(`${Math.ceil((d - (now() - t0)) / T(1000))} s${motion ? ` · ${sc.steps} steps` : ''}`); await sleep(250, ctx.signal); } };
    // Round 1
    move.textContent = pick(MOVES, ctx.rng); big.textContent = `${randInt(ctx.rng, 120, 200)} − 3 …`; sub.textContent = 'Count backwards by 3, out loud, while you move.';
    await timer(ROUND, 0, 1 / 3);
    // Round 2
    move.textContent = pick(MOVES, ctx.rng); big.textContent = pick(CATEGORIES, ctx.rng); sub.textContent = 'Name as many as you can, out loud, while you move.';
    await timer(ROUND, 1 / 3, 2 / 3);
    // Round 3: go/no-go while stepping
    move.textContent = 'March in place'; sub.textContent = 'Tap anywhere below on multiples of 3. Ignore other numbers.';
    const tap = el('button', { class: 'btn primary big ab-tap' }, 'TAP');
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
    return { level: 1, score: Math.round(acc * 100), accuracy: acc, summary: [`Dual-task accuracy: ${Math.round(acc * 100)}%`, motion ? `Steps counted: ${sc.steps}` : 'Movement: 2 min of active time', 'Counts toward your daily movement habit'], metrics: { dualTaskAccuracy: acc, steps: sc.steps, motion } };
  },
};
