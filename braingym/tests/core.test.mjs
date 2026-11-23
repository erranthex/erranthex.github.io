// Unit tests for the pure engine. Run: node --test braingym/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { generateMatrix, satisfiesRules, same, ATTRS } from '../js/matrix.js';

test('staircase 2-down-1-up moves correctly and respects bounds', () => {
  let s = C.createStaircase({ level: 3, min: 1, max: 5, down: 2, up: 1 });
  s = C.stepStaircase(s, true); assert.equal(s.level, 3);
  s = C.stepStaircase(s, true); assert.equal(s.level, 4);
  s = C.stepStaircase(s, false); assert.equal(s.level, 3);
  assert.equal(s.reversals, 1);
  for (let i = 0; i < 20; i++) s = C.stepStaircase(s, true);
  assert.equal(s.level, 5);
  for (let i = 0; i < 20; i++) s = C.stepStaircase(s, false);
  assert.equal(s.level, 1);
});

test('staircase converges near 70.7% for a 2-down-1-up rule', () => {
  // Simulated observer whose p(correct) falls with level: p = 1 - level/20.
  const rng = C.mulberry32(42);
  let s = C.createStaircase({ level: 1, min: 1, max: 20 });
  for (let i = 0; i < 4000; i++) s = C.stepStaircase(s, rng() < 1 - s.level / 20);
  const th = C.mean(s.history.slice(-2000).map(h => h.level));
  // p=0.707 at level ~5.86
  assert.ok(Math.abs(th - 5.86) < 1.0, `threshold ${th}`);
});

test('n-back block rule follows Jaeggi 2008', () => {
  assert.equal(C.nbackNextLevel(2, [0, 2]), 3);
  assert.equal(C.nbackNextLevel(2, [3, 2]), 2);
  assert.equal(C.nbackNextLevel(2, [6, 0]), 1);
  assert.equal(C.nbackNextLevel(1, [9, 9]), 1);
  assert.equal(C.nbackNextLevel(9, [0, 0]), 9);
});

test('probit matches known quantiles', () => {
  assert.ok(Math.abs(C.probit(0.5)) < 1e-9);
  assert.ok(Math.abs(C.probit(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(C.probit(0.01) + 2.326348) < 1e-5);
  assert.throws(() => C.probit(0));
});

test('dprime is finite at ceiling and zero at chance', () => {
  const d = C.dprime(6, 0, 0, 14);
  assert.ok(Number.isFinite(d) && d > 2);
  assert.ok(Math.abs(C.dprime(5, 5, 5, 5)) < 1e-9);
});

test('stats helpers', () => {
  assert.equal(C.median([3, 1, 2]), 2);
  assert.equal(C.median([4, 1, 2, 3]), 2.5);
  assert.ok(Math.abs(C.sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 1e-3);
  assert.equal(C.inverseEfficiency([500, 700], 0.5), 1200);
  assert.equal(C.inverseEfficiency([], 1), Infinity);
});

test('SM-2 review schedules expanding intervals and resets on lapse', () => {
  const t = 0;
  let c = C.newCard(t);
  c = C.reviewCard(c, 5, t); assert.equal(c.interval, 1);
  c = C.reviewCard(c, 5, t); assert.equal(c.interval, 3);
  c = C.reviewCard(c, 4, t); assert.ok(c.interval >= 7, `interval ${c.interval}`);
  const prevEase = c.ease;
  c = C.reviewCard(c, 1, t); assert.equal(c.interval, 1); assert.equal(c.reps, 0); assert.equal(c.lapses, 1);
  assert.ok(c.ease < prevEase && c.ease >= 1.3);
  assert.equal(c.due, t + C.DAY);
  assert.equal(C.recallToQuality(1), 5);
  assert.equal(C.recallToQuality(0.5), 2);
  assert.equal(C.recallToQuality(0), 0);
});

test('n-back sequence has exactly the requested targets', () => {
  for (let seed = 1; seed < 200; seed++) {
    const rng = C.mulberry32(seed);
    const n = 1 + (seed % 4);
    const { seq, targets } = C.makeNbackSeq(n, 20 + n, 8, 6, rng);
    assert.equal(seq.length, 20 + n);
    assert.equal(targets.filter(Boolean).length, 6, `seed ${seed}`);
    targets.forEach((t, i) => assert.equal(t, i >= n && seq[i] === seq[i - n]));
  }
});

test('planSession covers distinct domains and prefers stale games', () => {
  const games = [
    { id: 'a', domain: 'mem' }, { id: 'b', domain: 'mem' }, { id: 'c', domain: 'speed' },
    { id: 'd', domain: 'flex' }, { id: 'e', domain: 'reason' },
  ];
  const now = 100 * C.DAY;
  const history = [{ game: 'c', t: now - C.DAY }, { game: 'a', t: now - 2 * C.DAY }];
  const p = C.planSession(games, history, { count: 4, now, rng: C.mulberry32(1) });
  assert.equal(p.length, 4);
  assert.equal(new Set(p.map(g => g.domain)).size, 4);
  assert.ok(p.some(g => g.id === 'b'), 'unplayed memory game preferred over recently played one');
  assert.ok(C.planSession(games, [], { count: 10 }).length === 5);
});

test('weekly status, streak and check-up timing', () => {
  const now = new Date(2026, 10, 23, 12).getTime();
  const s = [0, 1, 2].map(d => ({ t: now - d * C.DAY }));
  assert.equal(C.weeklyStatus(s, now).days, 3);
  assert.equal(C.streak(s, now), 3);
  assert.equal(C.streak([{ t: now - C.DAY }], now), 1, 'today not done yet keeps streak');
  assert.equal(C.streak([{ t: now - 3 * C.DAY }], now), 0);
  assert.equal(C.checkupDue([], now), true);
  assert.equal(C.checkupDue([{ t: now - 10 * C.DAY }], now), false);
  assert.equal(C.checkupDue([{ t: now - 29 * C.DAY }], now), true);
});

test('store survives corrupt data and round-trips export/import', () => {
  const mem = { d: { 'braingym.v1': '{not json' }, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
  const st = C.createStore(mem);
  assert.equal(st.get().schema, C.SCHEMA);
  st.set(s => { s.levels.x = 4; return s; });
  const json = st.export();
  const st2 = C.createStore(mem);
  assert.equal(st2.get().levels.x, 4);
  st2.reset();
  st2.import(json);
  assert.equal(st2.get().levels.x, 4);
  assert.equal(st2.get().settings.sound, true);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { } };
  const st3 = C.createStore(broken);
  st3.set(s => { s.levels.y = 1; return s; });
  assert.equal(st3.get().levels.y, 1);
});

test('matrix generator: rules hold, 8 unique options, one correct answer, balanced attributes', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const rng = C.mulberry32(seed);
    const level = 1 + (seed % 8);
    const m = generateMatrix(level, rng);
    assert.ok(satisfiesRules(m.grid, m.plan), `rules seed ${seed} ${JSON.stringify(m.plan)}`);
    assert.equal(m.options.length, 8);
    const keys = new Set(m.options.map(o => JSON.stringify(o)));
    assert.equal(keys.size, 8, 'options unique');
    assert.ok(same(m.options[m.answerIndex], m.grid[2][2]));
    assert.equal(m.options.filter(o => same(o, m.grid[2][2])).length, 1);
    for (const o of m.options) for (const [a, n] of Object.entries(ATTRS)) assert.ok(o[a] >= 0 && o[a] < n);
    // I-RAVEN balance: each attribute value of the answer appears in exactly 4 or 8 options.
    for (const a of Object.keys(ATTRS)) {
      const k = m.options.filter(o => o[a] === m.grid[2][2][a]).length;
      assert.ok(k === 4 || k === 8, `balance ${a}=${k}`);
    }
    // Every wrong option breaks at least one rule when placed in the grid.
    m.options.forEach((o, i) => {
      if (i === m.answerIndex) return;
      const g = m.grid.map(r => r.map(c => ({ ...c })));
      g[2][2] = o;
      assert.equal(satisfiesRules(g, m.plan), false, `distractor valid seed ${seed}`);
    });
  }
});
