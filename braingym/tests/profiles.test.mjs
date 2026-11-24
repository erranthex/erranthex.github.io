import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfiles, pinHash } from '../js/profiles.js';
import { DIFF, levelNumber, ctxValue, presetOf, levelFraction } from '../js/difficulty.js';
import { createStaircase, stepStaircase } from '../js/core.js';

const memBackend = () => ({ d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); }, removeItem(k) { delete this.d[k]; } });

test('guest → named profile keeps progress; PIN guards switching', () => {
  const b = memBackend(); let n = 0;
  const P = createProfiles(b, { rid: () => 'id' + (n++) });
  assert.equal(P.current(), null);
  P.createGuest();
  assert.equal(P.current().guest, true);
  P.store.set(s => { s.xp = 123; return s; });
  P.upgradeGuest({ name: 'Alex', pin: '1234' });
  assert.equal(P.current().guest, false); assert.equal(P.current().name, 'Alex');
  assert.equal(P.store.get().xp, 123); assert.equal(P.store.get().profile.name, 'Alex');
  const alex = P.current().id;
  P.createUser({ name: 'Sam' });
  assert.equal(P.store.get().xp, 0, 'new profile starts fresh');
  assert.equal(P.switchTo(alex, '0000'), false, 'wrong PIN');
  assert.equal(P.switchTo(alex, '1234'), true);
  assert.equal(P.store.get().xp, 123);
  // reload from same backend
  const P2 = createProfiles(b);
  assert.equal(P2.current().name, 'Alex'); assert.equal(P2.store.get().xp, 123);
  assert.equal(P2.list().length, 2);
  assert.throws(() => P2.createUser({ name: '' }));
  assert.throws(() => P2.createUser({ name: 'X', pin: '12a4' }));
  assert.notEqual(pinHash('1234'), pinHash('1235'));
});

test('backup code round-trips into a new profile; remove deletes data', () => {
  const b = memBackend(); let n = 0;
  const P = createProfiles(b, { rid: () => 'r' + (n++) });
  P.createUser({ name: 'Ana' }); P.store.set(s => { s.xp = 77; s.levels.flash = 9; return s; });
  const code = P.backupCode();
  const b2 = memBackend(); const Q = createProfiles(b2, { rid: () => 'q' + (n++) });
  Q.restoreCode(code);
  assert.equal(Q.current().name, 'Ana'); assert.equal(Q.store.get().xp, 77); assert.equal(Q.store.get().levels.flash, 9);
  assert.throws(() => Q.restoreCode('not a code'));
  const id = Q.current().id; Q.remove(id);
  assert.equal(Q.current(), null); assert.equal(b2.getItem('mentaro.p.' + id), null);
});

test('migrates single-profile data from earlier versions', () => {
  const b = memBackend();
  b.setItem('mentaro.v1', JSON.stringify({ xp: 500, profile: { name: 'Old', onboarded: true } }));
  const P = createProfiles(b);
  assert.equal(P.current().name, 'Old'); assert.equal(P.store.get().xp, 500);
  assert.equal(b.getItem('mentaro.v1'), null);
});

test('difficulty model: ranges, presets, conversions', () => {
  for (const [id, d] of Object.entries(DIFF)) {
    assert.ok(d.min < d.max, id);
    for (const p of ['easy', 'medium', 'hard', 'expert']) { assert.ok(d.presets[p] >= d.min && d.presets[p] <= d.max, `${id} ${p}`); assert.equal(presetOf(id, d.presets[p]), p); }
    assert.ok(d.presets.easy < d.presets.medium && d.presets.medium < d.presets.hard && d.presets.hard < d.presets.expert, `${id} presets ascend`);
    assert.equal(levelNumber(id, ctxValue(id, d.presets.hard)), d.presets.hard);
    assert.equal(levelFraction(id, d.min), 0); assert.equal(levelFraction(id, d.max), 1);
  }
  assert.deepEqual(ctxValue('grid', 6), { f: 6, b: 5 });
  assert.equal(levelNumber('grid', { f: 7, b: 4 }), 7);
  assert.equal(ctxValue('flash', 999), 39);
  assert.equal(levelNumber('echo', undefined), 1);
});

test('fixed staircase never changes level', () => {
  let s = createStaircase({ level: 5, min: 1, max: 9, fixed: true });
  for (let i = 0; i < 10; i++) s = stepStaircase(s, i % 3 !== 0);
  assert.equal(s.level, 5); assert.equal(s.history.length, 10);
});
