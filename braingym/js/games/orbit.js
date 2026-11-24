// Orbit Tracker — multiple-object tracking (Pylyshyn & Storm 1988).
// Basis: older adults show training gains equivalent to young adults (Legault, Allard & Faubert,
// Frontiers in Psychology 2013); preliminary transfer to hazard detection in driving (2023).
import { el, frame, intro, sleep, beep, raf, now, T } from '../ui.js';
import { mean, clamp } from '../core.js';

const TRIALS = 10, TOTAL = 10;
export const spec = (L) => ({ k: clamp(2 + Math.floor((L - 1) / 3), 2, 7), speed: 1 + ((L - 1) % 3), total: TOTAL + Math.floor((L - 1) / 6) * 2 });

export function stepBalls(balls, dt, w, h, r) {
  for (const b of balls) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); } if (b.x > w - r) { b.x = w - r; b.vx = -Math.abs(b.vx); }
    if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); } if (b.y > h - r) { b.y = h - r; b.vy = -Math.abs(b.vy); }
  }
  // elastic-ish separation so objects don't overlap (prevents ambiguous crossings)
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = 2 * r + 2;
    if (d > 0 && d < m) { const ux = dx / d, uy = dy / d, push = (m - d) / 2; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; [a.vx, b.vx] = [b.vx, a.vx]; [a.vy, b.vy] = [b.vy, a.vy]; }
  }
}

export default {
  id: 'orbit', name: 'Orbit Tracker', domain: 'Attention', icon: 'orbit', minutes: 3,
  tagline: 'Keep your eyes on the glowing orbs as they mingle.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Orbit Tracker · multiple-object tracking',
      how: `<p>Some orbs glow for a moment. Then they all look the same and drift around.</p>
            <p>Keep tracking the glowing ones with your attention, eyes relaxed near the centre. When they stop, <b>tap the ones you tracked</b>.</p>
            <p>Perfect rounds add speed, then more targets.</p>`,
      why: `Tracking several moving objects at once draws on sustained, divided attention and is the basis of 3D multiple-object-tracking training used with athletes and older drivers. Older adults improve at the same rate as young adults (Legault et al., 2013). Evidence for broad real-world transfer is still limited, so think of this as focused attention practice.`,
    }, ctx.signal);
    let L = typeof ctx.level === 'number' ? ctx.level : 4;
    const f = frame(root, 'Orbit Tracker', ctx.quit);
    const canvas = el('canvas', { class: 'orbit', 'aria-label': 'tracking arena' });
    f.stage.append(canvas);
    const cs = getComputedStyle(root);
    const col = (v) => cs.getPropertyValue(v).trim() || '#888';
    const res = [];
    for (let t = 0; t < TRIALS; t++) {
      f.progress(t / TRIALS);
      const { k, speed, total } = spec(L);
      f.setStatus(`${k} targets · speed ${speed}`);
      const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = rect.width, h = rect.height; canvas.width = w * dpr; canvas.height = h * dpr;
      const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = Math.max(11, Math.min(w, h) * 0.04);
      const v = Math.min(w, h) * (0.12 + speed * 0.06); // px/s
      const balls = [];
      while (balls.length < total) {
        const b = { x: r + ctx.rng() * (w - 2 * r), y: r + ctx.rng() * (h - 2 * r) };
        if (balls.some(o => Math.hypot(o.x - b.x, o.y - b.y) < 3 * r)) continue;
        const a = ctx.rng() * 2 * Math.PI; b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; balls.push(b);
      }
      balls.forEach((b, i) => (b.target = i < k));
      if (globalThis.__ngTest) globalThis.__ngTest.orbit = { balls, r };
      const paint = (mode, picked = new Set()) => {
        g.clearRect(0, 0, w, h);
        balls.forEach((b, i) => {
          g.beginPath(); g.arc(b.x, b.y, r, 0, 2 * Math.PI);
          let fill = col('--orb');
          if (mode === 'cue' && b.target) fill = col('--game');
          if (mode === 'pick' && picked.has(i)) fill = col('--game');
          if (mode === 'reveal') fill = b.target ? (picked.has(i) ? col('--good') : col('--warn')) : picked.has(i) ? col('--bad') : col('--orb');
          g.fillStyle = fill; g.fill();
          if (mode === 'cue' && b.target) { g.lineWidth = 3; g.strokeStyle = col('--text'); g.stroke(); }
        });
      };
      paint('cue');
      await sleep(1800, ctx.signal);
      // Move for ~5 s, frame-rate independent.
      const dur = T(5000); let last = now(); const t0 = last;
      while (now() - t0 < dur) {
        if (ctx.signal.aborted) throw new DOMException('aborted', 'AbortError');
        await raf(); const tn = now(); const dt = Math.min(0.05, (tn - last) / 1000); last = tn;
        stepBalls(balls, dt, w, h, r); paint('move');
      }
      paint('move');
      // Selection phase
      const picked = new Set();
      const done = new Promise((res, rej) => {
        const onDown = (e) => {
          const p = canvas.getBoundingClientRect(), x = e.clientX - p.left, y = e.clientY - p.top;
          let best = -1, bd = Infinity;
          balls.forEach((b, i) => { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = i; } });
          if (best < 0 || bd > r * 2.2) return;
          if (picked.has(best)) picked.delete(best); else picked.add(best);
          paint('pick', picked);
          if (picked.size === k) { canvas.removeEventListener('pointerdown', onDown); res(); }
        };
        canvas.addEventListener('pointerdown', onDown);
        ctx.signal.addEventListener('abort', () => { canvas.removeEventListener('pointerdown', onDown); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
      });
      f.setStatus(`Tap ${k}`);
      await done;
      const correct = [...picked].filter(i => balls[i].target).length;
      const ok = correct === k;
      paint('reveal', picked);
      beep(ctx.settings, ok); f.hit(ok);
      res.push({ k, speed, correct, ok });
      if (ok) L = Math.min(18, L + 1); else if (correct < k - 1) L = Math.max(1, L - 1); // 1-up on perfect, down only on clear failure
      await sleep(ok ? 700 : 1400, ctx.signal);
    }
    f.progress(1);
    const perfect = res.filter(r => r.ok);
    const capacity = perfect.length ? Math.max(...perfect.map(r => r.k)) : Math.max(1, ...res.map(r => r.correct));
    const speedLevel = perfect.length ? Math.max(...perfect.filter(r => r.k === capacity).map(r => r.speed)) : 0;
    return { level: L, score: capacity, accuracy: mean(res.map(r => r.correct / r.k)), summary: [`Tracked up to ${capacity} orbs${speedLevel ? ` at speed ${speedLevel}` : ''}`, `Perfect rounds: ${perfect.length}/${res.length}`, `Next: ${spec(L).k} targets · speed ${spec(L).speed}`], metrics: { capacity, speedLevel } };
  },
};
