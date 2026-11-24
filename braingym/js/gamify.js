// Motivation layer: XP, player level, gems, streak with science-based rest days, daily quests,
// achievements and weekly leagues. Pure functions (time and RNG injected) for testability.
//
// Design principles (from adherence research and app-review complaints):
//  • Reward consistency over volume: XP caps out per day; rest days are built in (Lampit 2014).
//  • Never punish: no "hearts"/lives; mistakes cost nothing.
//  • Positive message framing improved adherence in a 2021 cognitive-training study.

import { DAY, dayKey, mulberry32, clamp } from './core.js';

// ---------- XP & levels ----------
export function xpForResult(r, { leveledUp = false, personalBest = false } = {}) {
  const acc = clamp(Number.isFinite(r.accuracy) ? r.accuracy : 0.5, 0, 1);
  let xp = 10 + Math.round(acc * 10);
  if (acc >= 0.999) xp += 5;          // perfect round
  if (leveledUp) xp += 5;
  if (personalBest) xp += 5;
  return xp;
}
// Level n needs 60·n·(n+1)/2 total XP: L2 at 60, L5 at 600, L10 at 2,700, L20 at 11,400.
export function levelFromXp(xp) { return Math.floor((Math.sqrt(1 + (8 * xp) / 60) - 1) / 2) + 1; }
export function xpForLevel(n) { return (60 * (n - 1) * n) / 2; }
export function levelProgress(xp) {
  const L = levelFromXp(xp), lo = xpForLevel(L), hi = xpForLevel(L + 1);
  return { level: L, into: xp - lo, span: hi - lo, pct: (xp - lo) / (hi - lo) };
}

export const DAILY_GOALS = [
  { xp: 20, name: 'Light', desc: '≈1 exercise · 3 min' },
  { xp: 50, name: 'Regular', desc: '≈3 exercises · 10 min' },
  { xp: 80, name: 'Focused', desc: '≈5 exercises · 15–20 min' },
  { xp: 120, name: 'Intense', desc: '≈7 exercises · 25 min' },
];

// ---------- Streak with built-in rest days ----------
// A day counts as "active" if you trained OR did a light check-in (habit log / memory review).
// Each ISO week grants 2 automatic rest days that keep the streak alive, because spaced
// practice with rest outperforms daily massed practice. Purchased streak freezes cover more.
export function computeStreak({ activeDays, freezesUsed = [], now = Date.now() }) {
  const active = new Set(activeDays), frozen = new Set(freezesUsed);
  let d = now, streak = 0, gap = 0;
  const restUsed = {};
  if (!active.has(dayKey(d))) d -= DAY; // today still open
  for (let i = 0; i < 3650; i++) {
    const k = dayKey(d);
    if (active.has(k)) { streak++; gap = 0; d -= DAY; continue; }
    if (frozen.has(k)) { d -= DAY; continue; }
    const w = weekKey(d);
    // Rest day: ≤2 per week, ≤2 in a row, and only when bridging to earlier activity.
    if ((restUsed[w] || 0) < 2 && gap < 2 && hasActiveBefore(active, d, 2 - gap, frozen)) { restUsed[w] = (restUsed[w] || 0) + 1; gap++; d -= DAY; continue; }
    break;
  }
  return streak;
}
function hasActiveBefore(active, t, within, frozen) { for (let i = 1; i <= within; i++) { const k = dayKey(t - i * DAY); if (active.has(k) || frozen?.has(k)) return true; } return false; }
export function weekKey(t) {
  const d = new Date(t); d.setHours(12, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day + 3);
  const y = d.getFullYear(), w1 = new Date(y, 0, 4);
  return `${y}-W${1 + Math.round(((d - w1) / DAY - 3 + ((w1.getDay() + 6) % 7)) / 7)}`;
}

// ---------- Daily quests ----------
const QUESTS = [
  { id: 'xp', text: (n) => `Earn ${n} XP`, n: [30, 40, 60], test: (d, n) => d.xp >= n },
  { id: 'domains', text: (n) => `Train ${n} different skills`, n: [2, 3], test: (d, n) => d.domains.size >= n },
  { id: 'acc', text: () => 'Score 90%+ accuracy in an exercise', n: [1], test: (d) => d.bestAcc >= 0.9 },
  { id: 'games', text: (n) => `Complete ${n} exercises`, n: [2, 3, 4], test: (d, n) => d.games >= n },
  { id: 'habit', text: () => 'Log a brain habit (exercise, sleep…)', n: [1], test: (d) => d.habits > 0 },
  { id: 'memory', text: () => 'Play a memory exercise', n: [1], test: (d) => d.domains.has('memory') },
  { id: 'pb', text: () => 'Beat a personal best', n: [1], test: (d) => d.pbs > 0 },
];
export function dailyQuests(day) {
  const rng = mulberry32(hash(day));
  const pool = [...QUESTS], out = [];
  while (out.length < 3) {
    const q = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const n = q.n[Math.floor(rng() * q.n.length)];
    out.push({ id: `${q.id}:${n}`, text: q.text(n), gems: 10 + out.length * 5, test: (d) => q.test(d, n) });
  }
  return out;
}
export function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// Summarise one day's activity for quest checks.
export function dayStats(state, day, skillDomain) {
  const rs = state.results.filter(r => dayKey(r.t) === day);
  return {
    xp: rs.reduce((a, r) => a + (r.xp || 0), 0),
    games: rs.length,
    domains: new Set(rs.map(r => skillDomain(r.game)).filter(Boolean)),
    bestAcc: Math.max(0, ...rs.map(r => r.accuracy || 0)),
    pbs: rs.filter(r => r.pb).length,
    habits: Object.values(state.habits?.[day] || {}).filter(Boolean).length,
  };
}

// ---------- Achievements ----------
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Spark', desc: 'Finish your first exercise', test: (s) => s.results.length >= 1 },
  { id: 'workout', name: 'Warmed Up', desc: 'Finish a full workout', test: (s) => (s.workouts || 0) >= 1 },
  { id: 'streak3', name: 'On a Roll', desc: '3-day streak', test: (s, c) => c.streak >= 3 },
  { id: 'streak7', name: 'Week Warrior', desc: '7-day streak', test: (s, c) => c.streak >= 7 },
  { id: 'streak30', name: 'Habit Formed', desc: '30-day streak', test: (s, c) => c.streak >= 30 },
  { id: 'xp1000', name: 'Kilo-Brain', desc: 'Earn 1,000 XP', test: (s) => (s.xp || 0) >= 1000 },
  { id: 'level10', name: 'Double Digits', desc: 'Reach player level 10', test: (s) => levelFromXp(s.xp || 0) >= 10 },
  { id: 'explorer', name: 'Explorer', desc: 'Try all 13 exercises', test: (s, c) => c.gamesTried >= 13 },
  { id: 'nback3', name: 'Three Steps Back', desc: 'Reach 3-back in Echo Grid', test: (s) => (s.levels.echo || 0) >= 3 },
  { id: 'nback5', name: 'Deep Echo', desc: 'Reach 5-back in Echo Grid', test: (s) => (s.levels.echo || 0) >= 5 },
  { id: 'span7', name: 'Magic Seven', desc: 'Forward span of 7 in Grid Recall', test: (s) => (s.levels.grid?.f || 0) >= 7 },
  { id: 'palace10', name: 'Architect', desc: 'Recall 10+ words in Mind Palace', test: (s) => s.results.some(r => r.game === 'palace' && (r.m?.recall || 0) * (r.m?.n || 0) >= 10) },
  { id: 'flash100', name: 'Blink Fast', desc: 'Catch a 100 ms flash', test: (s) => (s.levels.flash || 0) >= 8 },
  { id: 'perfect', name: 'Flawless', desc: 'A perfect round', test: (s) => s.results.some(r => r.accuracy >= 0.999) },
  { id: 'checkup', name: 'Honest Measure', desc: 'Complete a Check-up', test: (s) => s.checkups.length >= 1 },
  { id: 'habits', name: 'Whole-Brain Living', desc: 'Log all 4 habits in one day', test: (s) => Object.values(s.habits || {}).some(h => Object.values(h).filter(Boolean).length >= 4) },
  { id: 'league', name: 'Promoted', desc: 'Finish top 3 in a league', test: (s) => (s.league?.promotions || 0) >= 1 },
];

// ---------- Leagues ----------
// Weekly league of 10. Until online leagues exist, the other 9 are clearly-labelled AI rivals
// whose weekly XP is generated deterministically from the week, so standings are reproducible.
export const TIERS = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby', 'Emerald', 'Diamond'];
const RIVAL_NAMES = ['Ada', 'Bo', 'Cy', 'Dee', 'Eli', 'Fen', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kai', 'Lumi', 'Max', 'Nia', 'Oz', 'Pia', 'Quin', 'Rae', 'Sol', 'Tavi'];
export function leagueTable(week, tier, myXp, now = Date.now()) {
  const rng = mulberry32(hash(week + tier));
  const weekStart = startOfWeek(now), elapsed = clamp((now - weekStart) / (7 * DAY), 0, 1);
  const scale = 1 + tier * 0.35;
  const names = [...RIVAL_NAMES].sort(() => rng() - 0.5).slice(0, 9);
  const rivals = names.map((n) => {
    const total = Math.round((40 + rng() * 360) * scale);
    // Rivals accumulate in a slightly front- or back-loaded curve.
    const curve = 0.7 + rng() * 0.6;
    return { name: n, bot: true, xp: Math.round(total * elapsed ** curve) };
  });
  const table = [...rivals, { name: 'You', bot: false, xp: myXp }].sort((a, b) => b.xp - a.xp || (a.bot ? 1 : -1));
  return table.map((r, i) => ({ ...r, rank: i + 1, zone: i < 3 ? 'up' : i >= 8 ? 'down' : '' }));
}
export function startOfWeek(t) { const d = new Date(t); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); return d.getTime() - day * DAY; }
export function settleLeague(prev, table) {
  const me = table.find(r => !r.bot);
  let tier = prev.tier;
  if (me.zone === 'up') tier = Math.min(TIERS.length - 1, tier + 1);
  if (me.zone === 'down' && me.xp < 1) tier = Math.max(0, tier - 1); // only demote inactive weeks
  return { tier, promotions: (prev.promotions || 0) + (me.zone === 'up' ? 1 : 0), lastRank: me.rank };
}

// ---------- Learning path ----------
// Units of 6 nodes; node 3 is a treasure chest, node 6 a unit checkpoint (mini check-up every
// other unit). A node completes when a workout is finished.
export const UNIT_NAMES = ['First Sparks', 'Quick Eyes', 'Steady Focus', 'Memory Lane', 'Rule Breaker', 'Deep Echo', 'Pattern Seeker', 'Word Smith', 'Navigator', 'Master Mind'];
export function pathNodes(done) {
  const units = [];
  const total = Math.max(18, Math.ceil((done + 7) / 6) * 6);
  for (let i = 0; i < total; i++) {
    const u = Math.floor(i / 6), k = i % 6;
    (units[u] ||= { name: UNIT_NAMES[u % UNIT_NAMES.length] + (u >= UNIT_NAMES.length ? ` ${Math.floor(u / UNIT_NAMES.length) + 1}` : ''), nodes: [] })
      .nodes.push({ i, type: k === 2 ? 'chest' : k === 5 ? 'trophy' : 'lesson', state: i < done ? 'done' : i === done ? 'current' : 'locked' });
  }
  return units;
}

// Streak freezes: when you come back after a gap longer than the 2 built-in rest days, owned
// freezes are spent automatically to cover the extra missed days (if you own enough).
export function applyFreezes({ activeDays, freezesUsed = [], freezes = 0, now = Date.now() }) {
  const active = new Set(activeDays), used = new Set(freezesUsed);
  let d = now - DAY, gap = [];
  for (let i = 0; i < 60; i++, d -= DAY) { const k = dayKey(d); if (active.has(k)) break; if (!used.has(k)) gap.push(k); if (i === 59) return { freezesUsed, freezes, spent: 0 }; }
  const need = gap.length - 2;
  if (need <= 0 || need > freezes) return { freezesUsed, freezes, spent: 0 };
  const cover = gap.slice(-need); // earliest missed days; most recent 2 stay as rest days
  return { freezesUsed: [...freezesUsed, ...cover], freezes: freezes - need, spent: need };
}
