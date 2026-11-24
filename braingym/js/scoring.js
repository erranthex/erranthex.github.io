// Skill scoring: converts each exercise's mechanism-level metric (the quantity the cited
// research actually measures) into a 0–1000 Skill Index. Pure functions, unit-tested.
//
// Anchors are task-defined (bottom of the staircase = 0, top = 1000), NOT population norms,
// so the index tracks your own improvement honestly. It is not an IQ score.

import { clamp } from './core.js';

const lin = (x, lo, hi) => clamp((x - lo) / (hi - lo), 0, 1);
const num = (x, d = 0) => (Number.isFinite(x) ? x : d);

// Each entry: domain, the metric shown to the user, and a function metrics -> 0..1.
export const SKILLS = {
  flash: { domain: 'speed', metric: 'Useful-field-of-view level (shorter exposure + more clutter = higher)', f: (m, r) => lin(num(m.thresholdLevel, r.level), 1, 39) },
  echo: { domain: 'memory', metric: 'Mean n-back level, weighted by sensitivity (d′)', f: (m) => 0.85 * lin(num(m.meanN, 1), 1, 8) + 0.15 * lin(num(m.dprime), 0, 4) },
  grid: { domain: 'memory', metric: 'Corsi span forward (40%) and backward (60%)', f: (m) => 0.4 * lin(num(m.forward), 2, 9) + 0.6 * lin(num(m.backward), 2, 8) },
  palace: { domain: 'memory', metric: 'Words correctly recalled after a delay', f: (m) => lin(num(m.recall) * num(m.n), 0, 20) },
  names: { domain: 'memory', metric: 'Face–name pairs recalled after a delay', f: (m) => lin(num(m.recall) * num(m.n), 0, 12) },
  path: { domain: 'memory', metric: 'Longest route retraced from memory', f: (m) => lin(num(m.longest), 2, 14) },
  shift: { domain: 'flex', metric: 'Switching level under time pressure (70%) and low switch cost (30%)', f: (m, r) => 0.7 * lin(r.level, 1, 20) + 0.3 * (1 - lin(num(m.switchCost, 600), 0, 600)) },
  arrows: { domain: 'attention', metric: 'Response-window level (60%), low interference (20%), stopping on no-go (20%)', f: (m, r) => 0.6 * lin(r.level, 1, 20) + 0.2 * (1 - lin(num(m.interference, 150), 0, 150)) + 0.2 * (1 - num(m.noGoFalseAlarm, 1)) },
  orbit: { domain: 'attention', metric: 'Objects tracked × speed', f: (m) => lin(num(m.capacity) + 0.5 * num(m.speedLevel), 1, 9) },
  logic: { domain: 'reasoning', metric: 'Hardest rule combination solved', f: (m, r) => lin(num(m.hardest, r.score), 0, 8) },
  word: { domain: 'language', metric: 'Valid words per minute, weighted by length', f: (m) => lin(num(m.points) / Math.max(0.5, num(m.minutes, 2.5)), 0, 30) },
  math: { domain: 'math', metric: 'Problems solved in 90 s (50%) and difficulty reached (50%)', f: (m, r) => 0.5 * lin(r.score, 0, 40) + 0.5 * lin(r.level, 1, 12) },
};

export const DOMAINS = {
  memory: { name: 'Memory', color: 'var(--d-memory)', icon: 'memory' },
  speed: { name: 'Speed', color: 'var(--d-speed)', icon: 'speed' },
  attention: { name: 'Attention', color: 'var(--d-attention)', icon: 'attention' },
  flex: { name: 'Flexibility', color: 'var(--d-flex)', icon: 'flex' },
  reasoning: { name: 'Reasoning', color: 'var(--d-reasoning)', icon: 'reasoning' },
  language: { name: 'Language', color: 'var(--d-language)', icon: 'language' },
  math: { name: 'Math', color: 'var(--d-math)', icon: 'math' },
};

// Raw 0..1000 skill for one result. Returns null for exercises with no skill metric.
export function skillOf(game, result) {
  const s = SKILLS[game];
  if (!s || !result) return null;
  const v = s.f(result.m || result.metrics || {}, result);
  return Number.isFinite(v) ? Math.round(clamp(v, 0, 1) * 1000) : null;
}

// Exponentially-smoothed skill per game (α = 0.35) damps day-to-day noise
// (sleep, mood, device) so the index reflects durable change, not one lucky round.
export function smoothedSkills(results, alpha = 0.35) {
  const out = {};
  for (const r of results) {
    if (r.review) continue;
    const v = r.skill ?? skillOf(r.game, r);
    if (v == null) continue;
    out[r.game] = out[r.game] == null ? v : Math.round(alpha * v + (1 - alpha) * out[r.game]);
  }
  return out;
}

export function domainScores(results) {
  const g = smoothedSkills(results), acc = {};
  for (const [id, v] of Object.entries(g)) { const d = SKILLS[id].domain; (acc[d] ||= []).push(v); }
  const out = {};
  for (const [d, vs] of Object.entries(acc)) out[d] = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
  return out;
}

// Brain Index = mean of trained domains (only domains you have data for).
export function brainIndex(results) {
  const d = Object.values(domainScores(results));
  return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
}

// Brain Index after each training day, for the progress chart.
export function indexHistory(results, dayKey) {
  const days = [];
  results.forEach((r, i) => {
    const k = dayKey(r.t), next = results[i + 1];
    if (next && dayKey(next.t) === k) return; // only the last result of each day
    const bi = brainIndex(results.slice(0, i + 1));
    if (bi != null) days.push({ day: k, t: r.t, value: bi });
  });
  return days;
}

// Age-aware starting points. Adaptive staircases take over after the first rounds; this only
// avoids a discouraging (too hard) or boring (too easy) first session. Processing speed and
// working-memory capacity decline gradually from early adulthood (Salthouse, 2009).
export const AGE_BANDS = ['under 18', '18–29', '30–44', '45–59', '60–74', '75+'];
export function startingLevels(band) {
  const i = Math.max(0, AGE_BANDS.indexOf(band));
  const t = [3, 4, 3, 2, 1, 1][i];
  return {
    flash: t, shift: t, arrows: t, math: [3, 3, 3, 2, 2, 1][i], logic: [2, 2, 2, 1, 1, 1][i],
    grid: { f: [4, 4, 4, 3, 3, 3][i], b: [3, 3, 3, 2, 2, 2][i] }, echo: 1, palace: [6, 6, 6, 6, 5, 4][i],
    names: [4, 4, 4, 4, 3, 3][i], path: [4, 4, 4, 3, 3, 3][i], orbit: [4, 4, 4, 3, 2, 1][i], word: 1,
  };
}
// Older adults get slightly slower default pacing (more time to respond, not easier content).
export const comfortPace = (band) => (band === '75+' ? 1.3 : band === '60–74' ? 1.15 : 1);
