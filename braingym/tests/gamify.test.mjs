import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, dayKey } from '../js/core.js';
import * as G from '../js/gamify.js';
import * as S from '../js/scoring.js';

test('xp and levels', () => {
  assert.equal(G.xpForResult({ accuracy: 0.5 }), 15);
  assert.equal(G.xpForResult({ accuracy: 1 }, { leveledUp: true, personalBest: true }), 35);
  assert.equal(G.levelFromXp(0), 1);
  assert.equal(G.levelFromXp(59), 1);
  assert.equal(G.levelFromXp(60), 2);
  assert.equal(G.levelFromXp(2700), 10);
  for (let n = 1; n < 30; n++) assert.equal(G.levelFromXp(G.xpForLevel(n)), n);
  const p = G.levelProgress(90);
  assert.equal(p.level, 2); assert.equal(p.into, 30); assert.equal(p.span, 120);
});

test('streak counts active days and allows 2 rest days per week', () => {
  const now = new Date(2026, 10, 25, 12).getTime(); // Wed
  const k = (d) => dayKey(now - d * DAY);
  assert.equal(G.computeStreak({ activeDays: [k(0), k(1), k(2)], now }), 3);
  assert.equal(G.computeStreak({ activeDays: [k(1), k(2)], now }), 2, 'today open');
  // gap of one day bridged by a rest day
  assert.equal(G.computeStreak({ activeDays: [k(0), k(2), k(3)], now }), 3);
  // 3+ consecutive missed days breaks the streak
  assert.equal(G.computeStreak({ activeDays: [k(0), k(4), k(5)], now }), 1);
  // freezes bridge as well
  assert.equal(G.computeStreak({ activeDays: [k(0), k(4)], freezesUsed: [k(1), k(2), k(3)], now }), 2);
  assert.equal(G.computeStreak({ activeDays: [], now }), 0);
});

test('weekKey groups Monday..Sunday', () => {
  const mon = new Date(2026, 10, 23, 9).getTime(), sun = new Date(2026, 10, 29, 22).getTime(), nextMon = new Date(2026, 10, 30, 1).getTime();
  assert.equal(G.weekKey(mon), G.weekKey(sun));
  assert.notEqual(G.weekKey(sun), G.weekKey(nextMon));
});

test('daily quests are deterministic, 3 distinct, testable', () => {
  const a = G.dailyQuests('2026-11-24'), b = G.dailyQuests('2026-11-24');
  assert.deepEqual(a.map(q => q.id), b.map(q => q.id));
  assert.equal(new Set(a.map(q => q.id.split(':')[0])).size, 3);
  const full = { xp: 999, games: 9, domains: new Set(['memory', 'speed', 'flex']), bestAcc: 1, pbs: 1, habits: 2 };
  const none = { xp: 0, games: 0, domains: new Set(), bestAcc: 0, pbs: 0, habits: 0 };
  for (let d = 1; d <= 28; d++) for (const q of G.dailyQuests(`2026-11-${d}`)) { assert.ok(q.test(full)); assert.ok(!q.test(none)); }
});

test('league: 10 players, ranks, zones, rivals labelled, reproducible', () => {
  const now = new Date(2026, 10, 26, 12).getTime();
  const t = G.leagueTable('2026-W48', 0, 150, now);
  assert.equal(t.length, 10);
  assert.equal(t.filter(r => !r.bot).length, 1);
  assert.deepEqual(t.map(r => r.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(t.filter(r => r.zone === 'up').length, 3);
  assert.deepEqual(G.leagueTable('2026-W48', 0, 150, now), t);
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1].xp >= t[i].xp);
  assert.equal(G.leagueTable('2026-W48', 0, 99999, now)[0].name, 'You');
  const up = G.settleLeague({ tier: 0 }, G.leagueTable('2026-W48', 0, 99999, now));
  assert.equal(up.tier, 1); assert.equal(up.promotions, 1);
  const stay = G.settleLeague({ tier: 2 }, G.leagueTable('2026-W48', 2, 0, now));
  assert.ok(stay.tier <= 2 && stay.tier >= 1);
});

test('path nodes', () => {
  const u = G.pathNodes(4);
  assert.ok(u.length >= 3);
  const nodes = u.flatMap(x => x.nodes);
  assert.equal(nodes.filter(n => n.state === 'done').length, 4);
  assert.equal(nodes.find(n => n.state === 'current').i, 4);
  assert.equal(nodes[2].type, 'chest'); assert.equal(nodes[5].type, 'trophy');
});

test('skill index maps mechanism metrics into 0..1000 monotonically', () => {
  assert.equal(S.skillOf('echo', { m: { meanN: 1, dprime: 0 } }), 0);
  assert.equal(S.skillOf('echo', { m: { meanN: 8, dprime: 4 } }), 1000);
  assert.ok(S.skillOf('echo', { m: { meanN: 3, dprime: 2 } }) > S.skillOf('echo', { m: { meanN: 2, dprime: 2 } }));
  assert.ok(S.skillOf('shift', { level: 5, m: { switchCost: 100 } }) > S.skillOf('shift', { level: 5, m: { switchCost: 400 } }));
  assert.equal(S.skillOf('flash', { level: 39, m: { thresholdLevel: 39 } }), 1000);
  assert.equal(S.skillOf('nope', {}), null);
  for (const id of Object.keys(S.SKILLS)) {
    const v = S.skillOf(id, { level: 5, score: 10, m: {} });
    assert.ok(v >= 0 && v <= 1000, `${id} ${v}`);
  }
});

test('smoothing, domains and brain index', () => {
  const rs = [
    { game: 'echo', t: 0, skill: 100 }, { game: 'echo', t: DAY, skill: 300 },
    { game: 'flash', t: DAY, skill: 500 }, { game: 'palace', t: 2 * DAY, skill: 900, review: true },
  ];
  const sm = S.smoothedSkills(rs);
  assert.equal(sm.echo, 170); assert.equal(sm.flash, 500); assert.equal(sm.palace, undefined);
  assert.deepEqual(S.domainScores(rs), { memory: 170, speed: 500 });
  assert.equal(S.brainIndex(rs), 335);
  assert.equal(S.brainIndex([]), null);
  const h = S.indexHistory(rs, dayKey);
  assert.equal(h.length, 3); // day0, day1, day2 (review day still records index)
  assert.equal(h[1].value, 335);
});

test('age-aware starting levels are gentler for older bands', () => {
  const y = S.startingLevels('18–29'), o = S.startingLevels('75+');
  assert.ok(y.flash > o.flash && y.shift > o.shift);
  assert.equal(S.comfortPace('75+'), 1.3);
  assert.equal(S.comfortPace('30–44'), 1);
});

test('streak survives an open today after a rest day', () => {
  const now = new Date(2026, 10, 25, 12).getTime();
  const k = (d) => dayKey(now - d * DAY);
  assert.equal(G.computeStreak({ activeDays: [k(2), k(3)], now }), 2);
  assert.equal(G.computeStreak({ activeDays: [k(4)], now }), 0);
});

test('streak freezes cover gaps beyond the two rest days', () => {
  const now = new Date(2026, 10, 25, 12).getTime();
  const k = (d) => dayKey(now - d * DAY);
  const active = [k(5), k(6)]; // missed 4 days: k1..k4
  const r = G.applyFreezes({ activeDays: active, freezes: 3, now });
  assert.equal(r.spent, 2); assert.equal(r.freezes, 1);
  assert.deepEqual(r.freezesUsed.sort(), [k(3), k(4)].sort());
  assert.equal(G.computeStreak({ activeDays: [...active, k(0)], freezesUsed: r.freezesUsed, now }), 3);
  assert.equal(G.applyFreezes({ activeDays: active, freezes: 1, now }).spent, 0, 'not enough freezes');
  assert.equal(G.applyFreezes({ activeDays: [k(1)], freezes: 2, now }).spent, 0, 'no gap');
});
