// App shell: routing, screens, session flow, persistence.
import { el, svg, Aborted } from './ui.js';
import * as C from './core.js';
import { GAME_SCIENCE, FINDINGS, REFERENCES } from './science.js';
import { DEFAULT_LOCI } from './games/mind-palace.js';
import echo from './games/echo-grid.js';
import flash from './games/flash-field.js';
import shift from './games/rule-shift.js';
import arrows from './games/arrow-storm.js';
import grid from './games/grid-recall.js';
import logic from './games/pattern-logic.js';
import math from './games/number-sense.js';
import palace from './games/mind-palace.js';
import checkup from './games/checkup.js';

export const GAMES = [flash, echo, grid, shift, arrows, logic, palace, math];
const ALL = Object.fromEntries([...GAMES, checkup].map(g => [g.id, g]));
const HABITS = [
  ['exercise', '🏃', '30+ min moderate exercise', 'Strongest lifestyle evidence for cognition (Northey 2018).'],
  ['sleep', '😴', '7–9 hours of sleep', 'Sleep consolidates newly learned skills and memories.'],
  ['learn', '📚', 'Practised a demanding new skill', 'Learning complex skills boosted memory in the Synapse Project (Park 2014).'],
  ['social', '🗣️', 'Meaningful social interaction', 'Part of multidomain programmes like FINGER (Ngandu 2015).'],
];

let storage; try { storage = window.localStorage; } catch { storage = null; }
const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
export const store = C.createStore(storage || mem);

const $ = (s) => document.querySelector(s);
const view = () => $('#view');
const today = () => C.dayKey(Date.now());
let session = null; // { queue:[game], index, results:[] }

function levelOf(id) { return store.get().levels[id]; }
function levelText(g) {
  const l = levelOf(g.id);
  if (l == null) return 'New';
  if (g.id === 'echo') return `N = ${l}`;
  if (g.id === 'grid') return `Span ${l.f}/${l.b}`;
  if (g.id === 'palace') return `${l} words`;
  return `Level ${l}`;
}
function duePalace() { const t = Date.now(); return (store.get().palace.lists || []).filter(l => l.card.due <= t).sort((a, b) => a.card.due - b.card.due); }

// ---------- Screens ----------
function home() {
  const s = store.get();
  const plan = C.planSession(GAMES, s.results, { count: 4 });
  const doneToday = new Set(s.results.filter(r => C.dayKey(r.t) === today()).map(r => r.game));
  const wk = C.weeklyStatus(s.sessions), stk = C.streak(s.sessions);
  const due = duePalace();
  const v = view(); v.innerHTML = '';
  v.append(...[
    el('section', { class: 'hero' },
      el('h1', {}, 'Today\'s workout'),
      el('p', { class: 'muted' }, `About ${plan.reduce((a, g) => a + g.minutes, 0)} minutes · ${plan.length} exercises across different skills`),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', {}, String(stk)), el('span', {}, 'day streak')),
        el('div', { class: 'stat' }, el('b', {}, `${wk.days}/${wk.target}+`), el('span', {}, 'sessions this week'))),
      el('p', { class: 'small' }, wk.message)),
    C.checkupDue(s.checkups) ? el('div', { class: 'banner' }, el('div', {}, el('b', {}, '🩺 Check-up due. '), s.checkups.length ? 'It\'s been 4 weeks. See whether your gains transfer.' : 'Take a 4-minute baseline so you can measure real progress.'), el('button', { class: 'btn', onclick: () => play([checkup]) }, 'Start')) : null,
    due.length ? el('div', { class: 'banner alt' }, el('div', {}, el('b', {}, `🏛️ ${due.length} memory review${due.length > 1 ? 's' : ''} due. `), 'Recall now, right before you forget, for the strongest effect.'), el('button', { class: 'btn', onclick: () => play([palace], { review: due[0] }) }, 'Review')) : null,
    el('div', { class: 'plan' }, plan.map((g, i) => el('div', { class: 'gcard' + (doneToday.has(g.id) ? ' done' : '') },
      el('div', { class: 'gicon' }, g.icon),
      el('div', { class: 'gmeta' }, el('b', {}, `${i + 1}. ${g.name}`), el('span', { class: 'small muted' }, `${g.domain} · ${levelText(g)}`)),
      doneToday.has(g.id) ? el('span', { class: 'check' }, '✓') : null))),
    el('button', { class: 'btn primary big', onclick: () => play(plan) }, doneToday.size ? 'Train again' : 'Start workout'),
    el('p', { class: 'small muted center' }, 'Train 3–5 days a week for 15–20 minutes. Rest days are part of the plan.')].filter(Boolean));
}

function games() {
  const v = view(); v.innerHTML = '';
  v.append(el('h1', {}, 'Exercises'));
  for (const g of [...GAMES, checkup]) {
    const sci = GAME_SCIENCE[g.id];
    v.append(el('div', { class: 'gcard tall' },
      el('div', { class: 'gicon' }, g.icon),
      el('div', { class: 'gmeta' },
        el('b', {}, g.name), el('span', { class: 'small muted' }, `${g.domain} · ~${g.minutes} min · ${g.assessment ? 'Assessment' : levelText(g)}`),
        el('span', { class: 'small' }, g.tagline),
        sci ? el('span', { class: 'pill' }, `Evidence: ${sci.evidence[0]}`) : null),
      el('div', { class: 'gactions' },
        el('button', { class: 'btn primary', onclick: () => play([g]) }, 'Play'),
        sci ? el('a', { class: 'btn ghost', href: `#/science/${g.id}` }, 'Science') : null)));
  }
}

function chart(points, { w = 320, h = 90, label = '' } = {}) {
  if (points.length < 2) return el('p', { class: 'small muted' }, points.length ? 'Play again to see a trend.' : 'No data yet.');
  const xs = points.map((_, i) => i), ys = points.map(p => p);
  const minY = Math.min(...ys), maxY = Math.max(...ys), span = maxY - minY || 1;
  const px = (i) => 8 + (i / (xs.length - 1)) * (w - 16), py = (y) => h - 10 - ((y - minY) / span) * (h - 24);
  const d = ys.map((y, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(y).toFixed(1)}`).join(' ');
  return svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img', 'aria-label': `${label} trend from ${ys[0]} to ${ys[ys.length - 1]}` },
    svg('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    ...ys.map((y, i) => svg('circle', { cx: px(i), cy: py(y), r: i === ys.length - 1 ? 4 : 2.5, fill: 'var(--accent)' })),
    svg('text', { x: 8, y: 12, class: 'axis' }, `max ${+maxY.toFixed(2)}`), svg('text', { x: 8, y: h - 1, class: 'axis' }, `min ${+minY.toFixed(2)}`));
}

function progress() {
  const s = store.get();
  const v = view(); v.innerHTML = '';
  v.append(el('h1', {}, 'Progress'), el('p', { class: 'muted small' }, 'Training scores show practice on each exercise. The Check-up shows transfer to untrained tasks; that\'s the number that matters.'));
  const cu = s.checkups;
  v.append(el('section', { class: 'card' }, el('h2', {}, '🩺 Check-up (untrained tasks)'),
    cu.length ? el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Reaction'), el('th', {}, 'Digits ←'), el('th', {}, 'Stroop cost')),
      cu.map(c => el('tr', {}, el('td', {}, new Date(c.t).toLocaleDateString()), el('td', {}, `${c.m.choiceRT} ms`), el('td', {}, c.m.backwardDigitSpan), el('td', {}, `${c.m.stroopCost} ms`))))
      : el('p', { class: 'small muted' }, 'No check-ups yet.'),
    el('p', { class: 'small muted' }, 'Lower reaction time & Stroop cost = better. Higher digit span = better.')));
  for (const g of GAMES) {
    const rs = s.results.filter(r => r.game === g.id && !r.review);
    v.append(el('section', { class: 'card' }, el('h2', {}, `${g.icon} ${g.name}`), el('p', { class: 'small muted' }, `${rs.length} session${rs.length === 1 ? '' : 's'} · ${levelText(g)}`), chart(rs.slice(-30).map(r => r.score), { label: g.name })));
  }
}

function habits() {
  const s = store.get(); const k = today();
  const v = view(); v.innerHTML = '';
  v.append(el('h1', {}, 'Brain habits'), el('p', { class: 'muted small' }, 'Lifestyle factors have stronger evidence for long-term brain health than any game. Check off what you did today.'));
  const todayH = s.habits[k] || {};
  for (const [id, icon, label, why] of HABITS) {
    const cb = el('input', { type: 'checkbox', id: `h-${id}`, checked: !!todayH[id] });
    cb.addEventListener('change', () => store.set(st => { st.habits[k] = { ...(st.habits[k] || {}), [id]: cb.checked }; return st; }));
    v.append(el('label', { class: 'habit', for: `h-${id}` }, cb, el('span', { class: 'gicon' }, icon), el('span', {}, el('b', {}, label), el('br'), el('span', { class: 'small muted' }, why))));
  }
  const last7 = [...Array(7)].map((_, i) => C.dayKey(Date.now() - i * C.DAY)).reverse();
  v.append(el('section', { class: 'card' }, el('h2', {}, 'Last 7 days'), el('div', { class: 'week' }, last7.map(d => {
    const h = s.habits[d] || {}; const n = Object.values(h).filter(Boolean).length;
    const trained = s.sessions.some(x => C.dayKey(x.t) === d);
    return el('div', { class: 'day', title: d }, el('div', { class: 'dots' }, '●'.repeat(n) + '○'.repeat(4 - n)), el('div', { class: 'small' }, trained ? '🧠' : '·'), el('div', { class: 'small muted' }, d.split('-').slice(1).join('/')));
  }))));
}

function science(focus) {
  const v = view(); v.innerHTML = '';
  v.append(el('h1', {}, 'The science'),
    el('p', { class: 'muted' }, 'NeuroGym is inspired by the exercise types in Lumosity, Elevate and memoryOS, rebuilt around what peer-reviewed research supports. We say plainly where evidence is weak.'),
    el('section', { class: 'card' }, el('h2', {}, 'What the evidence says'), FINDINGS.map(([t, d]) => el('div', { class: 'finding' }, el('b', {}, t), el('p', { class: 'small' }, d)))));
  for (const g of GAMES) {
    const s = GAME_SCIENCE[g.id];
    const det = el('details', { class: 'card sci', id: `sci-${g.id}`, open: focus === g.id },
      el('summary', {}, el('span', { class: 'gicon' }, g.icon), el('b', {}, `${g.name}`), el('span', { class: 'pill' }, s.evidence[0])),
      el('dl', {},
        el('dt', {}, 'Inspired by'), el('dd', {}, s.inspired),
        el('dt', {}, 'Researchers'), el('dd', {}, s.researchers),
        el('dt', {}, 'How it works'), el('dd', {}, s.how),
        el('dt', {}, 'Why it should work'), el('dd', {}, s.why),
        el('dt', {}, 'Evidence'), el('dd', {}, s.evidence[1]),
        el('dt', {}, 'What NeuroGym improves'), el('dd', {}, s.improved)));
    v.append(det);
  }
  v.append(el('section', { class: 'card' }, el('h2', {}, 'References'), el('ol', { class: 'refs small' }, REFERENCES.map(r => el('li', {}, r)))),
    el('p', { class: 'small muted' }, 'NeuroGym is a training tool, not a medical device. It does not diagnose, treat or prevent any disease.'));
  if (focus) setTimeout(() => document.getElementById(`sci-${focus}`)?.scrollIntoView({ block: 'start' }), 0);
}

function settings() {
  const s = store.get();
  const v = view(); v.innerHTML = '';
  const toggle = (key, label) => {
    const cb = el('input', { type: 'checkbox', checked: !!s.settings[key] });
    cb.addEventListener('change', () => store.set(st => { st.settings[key] = cb.checked; return st; }));
    return el('label', { class: 'row' }, cb, ' ', label);
  };
  const loci = el('textarea', { rows: 10, class: 'loci', 'aria-label': 'Memory palace spots, one per line' }, (s.palace.loci || DEFAULT_LOCI).join('\n'));
  const saveLoci = el('button', { class: 'btn', onclick: () => { const L = loci.value.split('\n').map(x => x.trim()).filter(Boolean); if (L.length < 4) { alert('Add at least 4 spots.'); return; } store.set(st => { st.palace.loci = L.slice(0, 30); return st; }); saveLoci.textContent = 'Saved ✓'; } }, 'Save route');
  const file = el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  file.addEventListener('change', async () => { try { store.import(await file.files[0].text()); alert('Imported.'); route(); } catch { alert('That file could not be read.'); } });
  v.append(el('h1', {}, 'Settings'),
    el('section', { class: 'card' }, el('h2', {}, 'Sound'), toggle('sound', 'Feedback sounds'), toggle('speech', 'Spoken letters in Echo Grid (otherwise shown visually)')),
    el('section', { class: 'card' }, el('h2', {}, '🏛️ Your memory palace'), el('p', { class: 'small muted' }, 'List spots along a route you know well (your home, commute, school), one per line, in walking order.'), loci, saveLoci),
    el('section', { class: 'card' }, el('h2', {}, 'Your data'), el('p', { class: 'small muted' }, 'Everything stays on this device. Nothing is uploaded. Export a backup to move to another device.'),
      el('div', { class: 'row gap' },
        el('button', { class: 'btn', onclick: () => { const a = el('a', { href: URL.createObjectURL(new Blob([store.export()], { type: 'application/json' })), download: `neurogym-${today()}.json` }); document.body.append(a); a.click(); a.remove(); } }, 'Export'),
        el('button', { class: 'btn', onclick: () => file.click() }, 'Import'), file,
        el('button', { class: 'btn danger', onclick: () => { if (confirm('Delete all progress on this device?')) { store.reset(); route(); } } }, 'Reset'))),
    el('section', { class: 'card' }, el('h2', {}, 'Install the app'), el('p', { class: 'small' }, el('b', {}, 'iPhone / iPad: '), 'Safari → Share → Add to Home Screen. ', el('b', {}, 'Android: '), 'Chrome menu → Install app. ', el('b', {}, 'Mac / PC: '), 'Chrome or Edge → install icon in the address bar; Safari on macOS → File → Add to Dock. Works offline after the first visit.')));
}

// ---------- Playing ----------
function trimMetrics(m) { const o = {}; for (const [k, v] of Object.entries(m || {})) if (!Array.isArray(v) && typeof v !== 'object') o[k] = v; else if (k === 'blocks') o[k] = v; return o; }

async function play(queue, opts = {}) {
  session = { queue, index: 0, results: [] };
  document.body.classList.add('playing');
  const root = $('#play'); root.hidden = false;
  for (; session.index < queue.length; session.index++) {
    const g = queue[session.index];
    const ac = new AbortController();
    const quit = () => { if (confirm('Quit this exercise? Progress for this round won\'t be saved.')) ac.abort(); };
    const s = store.get();
    const ctx = { level: s.levels[g.id], settings: s.settings, signal: ac.signal, rng: Math.random, quit, palace: s.palace, review: opts.review };
    let result;
    try { result = await g.run(root, ctx); }
    catch (e) { if (e instanceof Aborted || e?.name === 'AbortError' || ac.signal.aborted) break; console.error(e); alert('Something went wrong: ' + e.message); break; }
    save(g, result, opts);
    const last = session.index === queue.length - 1;
    const goOn = await resultScreen(root, g, result, last ? null : queue[session.index + 1]);
    if (!goOn) break;
  }
  try { speechSynthesis?.cancel(); } catch { }
  root.hidden = true; root.innerHTML = '';
  document.body.classList.remove('playing');
  session = null;
  route();
}

function save(g, r, opts) {
  store.set(s => {
    const t = Date.now();
    if (g.assessment) s.checkups.push({ t, m: r.metrics });
    else {
      if (!opts.review) s.levels[g.id] = r.level;
      s.results.push({ game: g.id, t, score: r.score, accuracy: +(r.accuracy ?? 0).toFixed(3), level: r.level, review: !!opts.review, m: trimMetrics(r.metrics) });
    }
    s.sessions.push({ t });
    if (s.sessions.length > 2000) s.sessions = s.sessions.slice(-2000);
    const pu = r.palaceUpdate;
    if (pu?.type === 'new') { s.palace.lists.push(pu.list); s.palace.lists = s.palace.lists.slice(-60); }
    if (pu?.type === 'review') { const L = s.palace.lists.find(l => l.id === pu.id); if (L) { L.card = pu.card; L.history.push({ t, recall: pu.recall }); } }
    return s;
  });
}

function resultScreen(root, g, r, next) {
  return new Promise(res => {
    root.innerHTML = '';
    const cont = el('button', { class: 'btn primary big', onclick: () => res(true) }, next ? `Next: ${next.icon} ${next.name}` : 'Done');
    root.append(el('div', { class: 'intro card result' },
      el('div', { class: 'gicon xl' }, g.icon), el('h2', {}, `${g.name} complete`),
      el('ul', { class: 'summary' }, r.summary.map(x => el('li', {}, x))),
      cont, next ? el('button', { class: 'btn ghost', onclick: () => res(false) }, 'Stop here') : null));
    cont.focus();
  });
}

// ---------- Router ----------
const ROUTES = { home, games, progress, habits, science, settings };
export function route() {
  if (session) return;
  const [, name = 'home', arg] = (location.hash || '#/home').split('/');
  (ROUTES[name] || home)(arg);
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#/${name}`));
  view().focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => { });
window.__neurogym = { store, GAMES, play };
