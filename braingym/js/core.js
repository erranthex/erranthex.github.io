// Core engine: adaptive difficulty, statistics, spaced repetition, scheduling, storage.
// Pure functions only (no DOM) so it can be unit-tested in Node.

export const DAY = 86400000;

// ---------- Adaptive staircase ----------
// n-down / 1-up staircase (Levitt, 1971). 2-down-1-up converges on ~70.7% correct,
// 3-down-1-up on ~79.4%. Keeps the player in the "desirable difficulty" zone.
// fixed: true holds the level constant (manual difficulty chosen by the player).
export function createStaircase({ level = 1, min = 1, max = 20, down = 2, up = 1, fixed = false } = {}) {
  return { level: clamp(level, min, max), min, max, down, up, fixed, streak: 0, misses: 0, reversals: 0, lastDir: 0, history: [] };
}

export function stepStaircase(s, correct) {
  const next = { ...s, history: [...s.history, { level: s.level, correct }] };
  if (s.fixed) return next;
  let dir = 0;
  if (correct) {
    next.streak = s.streak + 1;
    next.misses = 0;
    if (next.streak >= s.down) { dir = 1; next.streak = 0; }
  } else {
    next.misses = s.misses + 1;
    next.streak = 0;
    if (next.misses >= s.up) { dir = -1; next.misses = 0; }
  }
  if (dir !== 0) {
    if (s.lastDir !== 0 && dir !== s.lastDir) next.reversals = s.reversals + 1;
    next.lastDir = dir;
    next.level = clamp(s.level + dir, s.min, s.max);
  }
  return next;
}

// Threshold estimate = mean level over the last k reversal-free trials (simple, robust).
export function staircaseThreshold(s, lastN = 10) {
  const h = s.history.slice(-lastN);
  if (!h.length) return s.level;
  return mean(h.map(x => x.level));
}

// Jaeggi et al. (2008) block rule for n-back: <3 errors per modality -> N+1, >5 -> N-1.
export function nbackNextLevel(n, errorsPerModality, { min = 1, max = 9 } = {}) {
  const worst = Math.max(...errorsPerModality);
  if (errorsPerModality.every(e => e < 3)) return Math.min(max, n + 1);
  if (worst > 5) return Math.max(min, n - 1);
  return n;
}

// ---------- Statistics ----------
export function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
export function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
export function median(a) {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y), m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}
export function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

// Inverse normal CDF (Acklam's rational approximation, |error| < 1.2e-9).
export function probit(p) {
  if (p <= 0 || p >= 1) throw new RangeError('p must be in (0,1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// Signal-detection sensitivity d' with log-linear correction (Hautus, 1995) so that
// perfect hit / zero false-alarm rates stay finite. Separates skill from response bias.
export function dprime(hits, misses, fas, crs) {
  const hr = (hits + 0.5) / (hits + misses + 1);
  const far = (fas + 0.5) / (fas + crs + 1);
  return probit(hr) - probit(far);
}

// Inverse efficiency: mean correct RT / accuracy. Combines speed and accuracy into one cost.
export function inverseEfficiency(rtsCorrect, accuracy) {
  if (!rtsCorrect.length || accuracy <= 0) return Infinity;
  return mean(rtsCorrect) / accuracy;
}

// ---------- Spaced repetition (SM-2 variant, Wozniak 1990) ----------
// quality 0..5. Returns new card state with due date. Spacing + retrieval practice are the
// two best-supported learning effects (Cepeda 2006; Roediger & Karpicke 2006).
export function newCard(now = Date.now()) { return { reps: 0, interval: 0, ease: 2.5, due: now + DAY, lapses: 0 }; }

export function reviewCard(card, quality, now = Date.now()) {
  const q = clamp(Math.round(quality), 0, 5);
  let { reps, interval, ease, lapses } = card;
  if (q < 3) { reps = 0; interval = 1; lapses += 1; }
  else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { reps, interval, ease: +ease.toFixed(3), lapses, due: now + interval * DAY };
}

// Map recall proportion (0..1) to SM-2 quality.
export function recallToQuality(p) {
  if (p >= 0.95) return 5;
  if (p >= 0.8) return 4;
  if (p >= 0.6) return 3;
  if (p >= 0.4) return 2;
  if (p > 0) return 1;
  return 0;
}

// ---------- Scheduling ----------
// Builds today's session: one game per domain where possible, favouring domains that are
// least recently trained and games that are stale. Variety (interleaving) is deliberate:
// multi-domain programs show broader effects than single-task drilling (Lampit 2014).
export function planSession(games, history, { count = 4, now = Date.now(), rng = Math.random } = {}) {
  const lastPlayed = {};
  for (const h of history) lastPlayed[h.game] = Math.max(lastPlayed[h.game] || 0, h.t);
  const domainLast = {};
  for (const g of games) domainLast[g.domain] = Math.max(domainLast[g.domain] || 0, lastPlayed[g.id] || 0);
  const scored = games.map(g => ({ g, s: (now - (lastPlayed[g.id] || 0)) / DAY + (now - (domainLast[g.domain] || 0)) / DAY * 0.5 + rng() * 0.01 }));
  scored.sort((a, b) => b.s - a.s);
  const picked = [], domains = new Set();
  for (const { g } of scored) { if (picked.length < count && !domains.has(g.domain)) { picked.push(g); domains.add(g.domain); } }
  for (const { g } of scored) { if (picked.length < count && !picked.includes(g)) picked.push(g); }
  return picked;
}

// Weekly dose guidance: Lampit et al. (2014) found <=3 sessions/week more effective than more;
// ACTIVE showed booster sessions mattered. We recommend 3-5 sessions/week of ~15-20 min.
export function weeklyStatus(sessions, now = Date.now()) {
  const days = new Set(sessions.filter(s => now - s.t < 7 * DAY).map(s => new Date(s.t).toDateString()));
  const n = days.size;
  let message;
  if (n === 0) message = 'Start your week: aim for 3–5 short sessions.';
  else if (n < 3) message = `${n} of 3 sessions this week. Keep going.`;
  else if (n <= 5) message = `${n} sessions this week, right in the evidence-based range.`;
  else message = `${n} sessions this week. Rest days help consolidation; more is not better.`;
  return { days: n, target: 3, message };
}

export function streak(sessions, now = Date.now()) {
  const days = new Set(sessions.map(s => dayKey(s.t)));
  let k = 0, d = now;
  if (!days.has(dayKey(d))) d -= DAY; // today not yet done doesn't break the streak
  while (days.has(dayKey(d))) { k++; d -= DAY; }
  return k;
}
export function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

// Check-up (untrained transfer assessment) due every 28 days.
export function checkupDue(checkups, now = Date.now()) {
  if (!checkups.length) return true;
  return now - Math.max(...checkups.map(c => c.t)) >= 28 * DAY;
}

// ---------- Random helpers ----------
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function shuffle(a, rng = Math.random) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export function pick(a, rng = Math.random) { return a[Math.floor(rng() * a.length)]; }

// n-back sequence with a fixed number of targets per modality (Jaeggi used ~6 per block of 20+n).
// Returns arrays of stimuli; targets[i] true when stim[i] === stim[i-n].
export function makeNbackSeq(n, length, alphabetSize, targetCount, rng = Math.random) {
  const seq = [];
  const targetIdx = new Set(shuffle([...Array(length - n).keys()].map(i => i + n), rng).slice(0, targetCount));
  for (let i = 0; i < length; i++) {
    if (targetIdx.has(i)) seq.push(seq[i - n]);
    else {
      let v;
      do { v = Math.floor(rng() * alphabetSize); } while (i >= n && v === seq[i - n]);
      seq.push(v);
    }
  }
  return { seq, targets: seq.map((v, i) => i >= n && v === seq[i - n]) };
}

// ---------- Storage ----------
export const SCHEMA = 1;
export function defaultState() {
  return {
    schema: SCHEMA, created: Date.now(), levels: {}, results: [], sessions: [], checkups: [], palace: { lists: [] }, habits: {},
    settings: { sound: true, speech: true, reduceMotion: false, theme: 'violet', colorScheme: 'auto' },
    profile: { name: '', age: '', focus: [], goal: 50, onboarded: false },
    xp: 0, gems: 50, freezes: 0, freezesUsed: [], path: { done: 0 }, league: { tier: 0, promotions: 0 },
    achievements: {}, quests: {}, workouts: 0, bests: {}, bestStreak: 0, owned: ['violet'],
  };
}
export function migrate(s) {
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;
  return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, palace: { ...d.palace, ...(s.palace || {}) }, profile: { ...d.profile, ...(s.profile || {}) }, path: { ...d.path, ...(s.path || {}) }, league: { ...d.league, ...(s.league || {}) }, schema: SCHEMA };
}
export function createStore(backend, key = 'mentaro.v1') {
  let state;
  try { state = migrate(JSON.parse(backend.getItem(key))); } catch { state = defaultState(); }
  return {
    get: () => state,
    set(fn) { state = fn(state) || state; try { backend.setItem(key, JSON.stringify(state)); } catch { /* storage full / private mode */ } return state; },
    export: () => JSON.stringify(state, null, 2),
    import(json) { state = migrate(JSON.parse(json)); try { backend.setItem(key, JSON.stringify(state)); } catch { } return state; },
    reset() { state = defaultState(); try { backend.removeItem(key); } catch { } return state; },
  };
}
