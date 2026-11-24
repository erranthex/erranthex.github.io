// Player profiles: play instantly as a guest, or create named profiles (several people can share
// one device). Each profile's progress is stored separately on this device. An optional 4-digit
// PIN keeps profiles apart on a shared device; it is a convenience lock, not strong security.
// Moving progress between devices uses Export/Import or a backup code (no server, no tracking).

import { createStore, defaultState, migrate } from './core.js';

const INDEX = 'mentaro.profiles', LEGACY = 'mentaro.v1';
const keyOf = (id) => `mentaro.p.${id}`;
export const COLORS = ['#7c5cff', '#0ea5e9', '#f97316', '#10b981', '#ec4899', '#eab308', '#ef4444', '#14b8a6'];
export function pinHash(pin) { let h = 2166136261; for (const c of `mentaro:${pin}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); }

export function createProfiles(backend, { now = () => Date.now(), rid = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const read = () => { try { return JSON.parse(backend.getItem(INDEX)) || null; } catch { return null; } };
  const write = () => { try { backend.setItem(INDEX, JSON.stringify(idx)); } catch { } };
  let idx = read();
  if (!idx) {
    idx = { profiles: [], current: null };
    // Migrate single-profile data from earlier versions.
    let legacy = null; try { legacy = backend.getItem(LEGACY); } catch { }
    if (legacy) {
      const id = 'legacy';
      let name = 'Player'; try { name = JSON.parse(legacy)?.profile?.name || 'Player'; } catch { }
      try { backend.setItem(keyOf(id), legacy); backend.removeItem(LEGACY); } catch { }
      idx.profiles.push({ id, name, guest: false, color: COLORS[0], pin: null, created: now(), lastUsed: now() });
      idx.current = id;
    }
    write();
  }
  let cur = idx.current ? createStore(backend, keyOf(idx.current)) : null;
  const meta = (id) => idx.profiles.find(p => p.id === id);
  const open = (id) => { idx.current = id; const m = meta(id); if (m) m.lastUsed = now(); write(); cur = createStore(backend, keyOf(id)); return cur; };
  const add = (m) => { idx.profiles.push(m); open(m.id); return m; };

  const store = {
    get: () => (cur ? cur.get() : defaultState()),
    set: (fn) => (cur ? cur.set(fn) : defaultState()),
    export: () => (cur ? cur.export() : '{}'),
    import: (json) => cur?.import(json),
    reset: () => cur?.reset(),
  };
  return {
    store,
    list: () => [...idx.profiles].sort((a, b) => b.lastUsed - a.lastUsed),
    current: () => (idx.current ? meta(idx.current) : null),
    createGuest() { return add({ id: 'g_' + rid(), name: 'Guest', guest: true, color: COLORS[1], pin: null, created: now(), lastUsed: now() }); },
    createUser({ name, pin = '', color }) {
      const clean = String(name || '').trim().slice(0, 24);
      if (!clean) throw new Error('name required');
      if (pin && !/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
      const m = add({ id: 'u_' + rid(), name: clean, guest: false, color: color || COLORS[idx.profiles.length % COLORS.length], pin: pin ? pinHash(pin) : null, created: now(), lastUsed: now() });
      store.set(s => { s.profile.name = clean; return s; });
      return m;
    },
    // Keep a guest's progress and turn it into a named profile.
    upgradeGuest({ name, pin = '' }) {
      const m = this.current();
      if (!m?.guest) throw new Error('not a guest');
      const clean = String(name || '').trim().slice(0, 24);
      if (!clean) throw new Error('name required');
      if (pin && !/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
      Object.assign(m, { name: clean, guest: false, pin: pin ? pinHash(pin) : null });
      write();
      store.set(s => { s.profile.name = clean; return s; });
      return m;
    },
    needsPin: (id) => !!meta(id)?.pin,
    switchTo(id, pin = '') {
      const m = meta(id); if (!m) return false;
      if (m.pin && pinHash(pin) !== m.pin) return false;
      open(id); return true;
    },
    signOut() { idx.current = null; cur = null; write(); },
    remove(id) {
      idx.profiles = idx.profiles.filter(p => p.id !== id);
      try { backend.removeItem(keyOf(id)); } catch { }
      if (idx.current === id) { idx.current = null; cur = null; }
      write();
    },
    rename(id, name) { const m = meta(id); if (m && name.trim()) { m.name = name.trim().slice(0, 24); write(); } },
    // Backup code: compact, portable copy of the current profile (paste into another device).
    backupCode() { return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, name: this.current()?.name, data: store.get() })))); },
    restoreCode(code) {
      const o = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
      if (!o || o.v !== 1 || !o.data) throw new Error('invalid code');
      const m = add({ id: 'u_' + rid(), name: o.name || 'Player', guest: false, color: COLORS[idx.profiles.length % COLORS.length], pin: null, created: now(), lastUsed: now() });
      cur.import(JSON.stringify(migrate(o.data)));
      return m;
    },
  };
}
