// Mentaro app shell: onboarding, learning path, games library, brain scores, leagues, profile,
// session flow and celebrations. All state is local (localStorage) and exportable.
import { el, svg, Aborted, setCurrentGame, chime, confetti, unlockAudio, askConfirm } from './ui.js';
import * as C from './core.js';
import * as G from './gamify.js';
import * as S from './scoring.js';
import { icon, mascot } from './icons.js';
import { GAME_SCIENCE, FINDINGS, REFERENCES } from './science.js';
import { DEFAULT_LOCI } from './games/mind-palace.js';
import flash from './games/flash-field.js';
import echo from './games/echo-grid.js';
import grid from './games/grid-recall.js';
import shift from './games/rule-shift.js';
import arrows from './games/arrow-storm.js';
import logic from './games/pattern-logic.js';
import math from './games/number-sense.js';
import palace from './games/mind-palace.js';
import word from './games/word-forge.js';
import names from './games/name-match.js';
import pathG from './games/pathfinder.js';
import orbit from './games/orbit.js';
import active from './games/active-break.js';
import checkup from './games/checkup.js';

export const BRAND = 'Mentaro';
export const GAMES = [flash, shift, arrows, grid, math, palace, active, logic, names, word, pathG, echo, orbit];
const ALL = Object.fromEntries([...GAMES, checkup].map(g => [g.id, g]));
const SKILL_GAMES = GAMES.filter(g => S.SKILLS[g.id]);
const domainOf = (id) => S.SKILLS[id]?.domain;
// Progressive unlocks along the path (curiosity + manageable onboarding).
const UNLOCK = { flash: 0, shift: 0, arrows: 0, grid: 0, math: 0, palace: 0, active: 0, logic: 6, names: 6, word: 12, path: 12, echo: 18, orbit: 18 };
const THEMES = { violet: '#7c5cff', ocean: '#0ea5e9', sunset: '#f97316', forest: '#16a34a', rose: '#e11d74' };
const HABITS = [
  ['exercise', 'active', 'Moved 30+ minutes', 'Exercise has the strongest lifestyle evidence for cognition.'],
  ['sleep', 'leaf', 'Slept 7–9 hours', 'Sleep consolidates new skills and memories.'],
  ['learn', 'book', 'Learned something challenging', 'Demanding new skills boosted memory (Synapse Project).'],
  ['social', 'names', 'Had a real conversation', 'Social engagement is part of multidomain brain-health programmes.'],
];

let storage; try { storage = window.localStorage; } catch { storage = null; }
const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
export const store = C.createStore(storage || mem);

const $ = (s, r = document) => r.querySelector(s);
const view = () => $('#view');
const today = () => C.dayKey(Date.now());
const H = (html) => el('span', { html });
let playing = false;

// ---------- Derived state ----------
const activeDays = (s) => [...new Set([...s.results.map(r => C.dayKey(r.t)), ...Object.entries(s.habits).filter(([, h]) => Object.values(h).some(Boolean)).map(([d]) => d)])];
const streakOf = (s) => G.computeStreak({ activeDays: activeDays(s), freezesUsed: s.freezesUsed });
const todayXp = (s) => s.results.filter(r => C.dayKey(r.t) === today()).reduce((a, r) => a + (r.xp || 0), 0);
const weekXp = (s, wk = G.weekKey(Date.now())) => s.results.filter(r => G.weekKey(r.t) === wk).reduce((a, r) => a + (r.xp || 0), 0);
const unlocked = (s, id) => (UNLOCK[id] ?? 0) <= s.path.done;
function levelText(g) {
  const l = store.get().levels[g.id];
  if (l == null) return 'New';
  if (g.id === 'echo') return `${l}-back`;
  if (g.id === 'grid') return `Span ${l.f}/${l.b}`;
  if (g.id === 'palace') return `${l} words`;
  if (g.id === 'names') return `${l} people`;
  if (g.id === 'path') return `${l} steps`;
  if (g.id === 'active') return 'Done';
  return `Level ${typeof l === 'object' ? '' : l}`;
}
const duePalace = () => (store.get().palace.lists || []).filter(l => l.card.due <= Date.now()).sort((a, b) => a.card.due - b.card.due);
const gameColor = (g) => S.DOMAINS[domainOf(g.id)]?.color || (g.id === 'active' ? 'var(--d-body)' : 'var(--accent)');
const gtile = (g, size = 28, extra = '') => el('div', { class: `gtile ${extra}`, style: { '--game': gameColor(g) }, html: icon(g.icon, size) });

// ---------- Housekeeping on load ----------
function housekeeping() {
  store.set(s => {
    // Streak freezes
    const r = G.applyFreezes({ activeDays: activeDays(s), freezesUsed: s.freezesUsed, freezes: s.freezes });
    if (r.spent) { s.freezesUsed = r.freezesUsed; s.freezes = r.freezes; s._toast = `Streak saved! ${r.spent} streak freeze${r.spent > 1 ? 's' : ''} used.`; }
    // League rollover
    const wk = G.weekKey(Date.now());
    if (s.league.week && s.league.week !== wk) {
      const end = G.startOfWeek(s.league.weekStart || Date.now() - 7 * C.DAY) + 7 * C.DAY - 1000;
      const table = G.leagueTable(s.league.week, s.league.tier, weekXp(s, s.league.week), end);
      const out = G.settleLeague(s.league, table);
      s._leagueResult = { rank: out.lastRank, from: s.league.tier, to: out.tier };
      s.league = { ...s.league, ...out };
    }
    s.league.week = wk; s.league.weekStart = G.startOfWeek(Date.now());
    return s;
  });
}

// ---------- Top bar (stats) ----------
function statBar() {
  const s = store.get();
  const st = streakOf(s), lp = G.levelProgress(s.xp);
  const goal = s.profile.goal || 50, tx = todayXp(s);
  return el('div', { class: 'statbar' },
    el('a', { class: 'stat-pill streak' + (s.results.some(r => C.dayKey(r.t) === today()) ? ' lit' : ''), href: '#profile', title: 'Day streak', html: `${icon('flame', 22)}<b>${st}</b>` }),
    el('a', { class: 'stat-pill gems', href: '#profile', title: 'Gems', html: `${icon('gem', 20)}<b>${s.gems}</b>` }),
    el('a', { class: 'stat-pill xp', href: '#brain', title: `Level ${lp.level}`, html: `${icon('bolt', 20)}<b>${tx}/${goal}</b>` }),
    el('a', { class: 'stat-pill lvl', href: '#profile', title: 'Player level', html: `<span class="lvl-badge">${lp.level}</span>` }));
}

function goalRing(value, max, size = 64, label = '') {
  const r = size / 2 - 6, c = 2 * Math.PI * r, p = Math.min(1, value / max);
  return el('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` }, html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--xp)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="ring-label">${label}</div>` });
}

// ---------- Side rail: daily goal + quests ----------
function questsCard() {
  const s = store.get(), d = today();
  const qs = G.dailyQuests(d), stats = G.dayStats(s, d, domainOf), claimed = s.quests[d] || [];
  return el('section', { class: 'card quests' },
    el('div', { class: 'card-h' }, el('h3', {}, 'Daily quests'), el('span', { class: 'muted small' }, 'Reset at midnight')),
    qs.map(q => {
      const done = q.test(stats), got = claimed.includes(q.id);
      return el('div', { class: 'quest' + (done ? ' done' : '') },
        el('div', { class: 'q-ic', html: icon(done ? 'check' : 'bolt', 18) }),
        el('div', { class: 'q-body' }, el('div', {}, q.text), el('div', { class: 'bar' }, el('i', { style: { width: done ? '100%' : '0%' } }))),
        got ? el('span', { class: 'q-gem got', html: `${icon('check', 14)}` }) : el('span', { class: 'q-gem', html: `${icon('gem', 14)}${q.gems}` }));
    }));
}
function claimQuests() {
  const s = store.get(), d = today(), stats = G.dayStats(s, d, domainOf);
  const newly = G.dailyQuests(d).filter(q => q.test(stats) && !(s.quests[d] || []).includes(q.id));
  if (newly.length) store.set(st => { st.quests[d] = [...(st.quests[d] || []), ...newly.map(q => q.id)]; st.gems += newly.reduce((a, q) => a + q.gems, 0); return st; });
  return newly;
}
function checkAchievements() {
  const s = store.get(), ctx = { streak: streakOf(s), gamesTried: new Set(s.results.map(r => r.game)).size };
  const newly = G.ACHIEVEMENTS.filter(a => !s.achievements[a.id] && a.test(s, ctx));
  if (newly.length) store.set(st => { newly.forEach(a => (st.achievements[a.id] = Date.now())); st.gems += 25 * newly.length; return st; });
  return newly;
}
function rail() {
  const s = store.get(), tx = todayXp(s), goal = s.profile.goal || 50;
  const lt = G.leagueTable(s.league.week, s.league.tier, weekXp(s));
  const me = lt.find(r => !r.bot);
  return el('aside', { class: 'rail' },
    el('section', { class: 'card goal' }, goalRing(tx, goal, 72, `<b>${Math.min(100, Math.round(100 * tx / goal))}%</b>`),
      el('div', {}, el('h3', {}, 'Daily goal'), el('div', { class: 'muted small' }, `${tx} / ${goal} XP today`), el('div', { class: 'muted small' }, tx >= goal ? 'Goal reached! 🎉' : `${goal - tx} XP to go`))),
    el('a', { class: 'card league-mini', href: '#league' }, el('div', { class: `tier-badge t${s.league.tier}`, html: icon('shield', 26) }), el('div', {}, el('h3', {}, `${G.TIERS[s.league.tier]} League`), el('div', { class: 'muted small' }, `You're #${me.rank} with ${me.xp} XP this week`))),
    questsCard(),
    el('p', { class: 'legal-mini small muted' }, el('a', { href: 'privacy.html' }, 'Privacy'), ' · ', el('a', { href: 'terms.html' }, 'Terms'), ' · ', el('a', { href: '#science' }, 'Science')));
}

// ---------- Learn (path) ----------
function nextWorkout(s, size = 3) {
  const pool = SKILL_GAMES.filter(g => unlocked(s, g.id));
  let plan = C.planSession(pool, s.results, { count: size });
  const focus = s.profile.focus || [];
  if (focus.length && !plan.some(g => focus.includes(domainOf(g.id)))) {
    const f = C.planSession(pool.filter(g => focus.includes(domainOf(g.id))), s.results, { count: 1 })[0];
    if (f) plan[plan.length - 1] = f;
  }
  if (s.path.done % 4 === 3 && plan.length >= 3) plan[plan.length - 1] = active; // movement break every 4th lesson
  return plan;
}

function learn() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const units = G.pathNodes(s.path.done);
  const due = duePalace(), cuDue = C.checkupDue(s.checkups) && s.results.length >= 3;
  const main = el('div', { class: 'main-col' });
  if (s._toast) { main.append(el('div', { class: 'toast-inline' }, s._toast)); store.set(st => { delete st._toast; return st; }); }
  if (s._leagueResult) { const L = s._leagueResult; main.append(el('div', { class: 'banner' }, el('span', { html: icon('trophy', 22) }), el('div', {}, el('b', {}, `Last week: #${L.rank}. `), L.to > L.from ? `Promoted to ${G.TIERS[L.to]}!` : `You stay in ${G.TIERS[L.to]}.`))); store.set(st => { delete st._leagueResult; return st; }); }
  if (due.length) main.append(el('div', { class: 'banner alt' }, el('span', { html: icon('palace', 22) }), el('div', { class: 'grow' }, el('b', {}, `${due.length} memory review${due.length > 1 ? 's' : ''} due`), el('div', { class: 'small' }, 'Recall now, right before you forget, for the strongest memory.')), el('button', { class: 'btn sm', onclick: () => play([palace], { review: due[0] }) }, 'Review')));
  if (cuDue) main.append(el('div', { class: 'banner' }, el('span', { html: icon('checkup', 22) }), el('div', { class: 'grow' }, el('b', {}, s.checkups.length ? 'Monthly Check-up' : 'Take your baseline Check-up'), el('div', { class: 'small' }, 'Untrained tasks that show whether gains carry over.')), el('button', { class: 'btn sm', onclick: () => play([checkup], { checkup: true }) }, 'Start')));

  for (const [ui, u] of units.entries()) {
    const unitDone = u.nodes.every(n => n.state === 'done');
    const hue = ['var(--u1)', 'var(--u2)', 'var(--u3)', 'var(--u4)', 'var(--u5)'][ui % 5];
    const unlocksHere = Object.entries(UNLOCK).filter(([, n]) => n === ui * 6 + 6).map(([id]) => ALL[id].name);
    main.append(el('div', { class: 'unit-head', style: { '--unit': hue } },
      el('div', {}, el('div', { class: 'unit-k' }, `UNIT ${ui + 1}`), el('h2', {}, u.name), unlocksHere.length ? el('div', { class: 'small' }, `Complete to unlock ${unlocksHere.join(' & ')}`) : null),
      el('a', { class: 'btn unit-guide', href: '#science', html: `${icon('book', 18)} Guide` })));
    const pathEl = el('div', { class: 'path', style: { '--unit': hue } });
    u.nodes.forEach((n, k) => {
      const off = [0, 1, 1.6, 1, 0, -1][k % 6] * 46;
      const ic = n.state === 'done' && n.type === 'lesson' ? 'check' : n.type === 'chest' ? 'chest' : n.type === 'trophy' ? 'trophy' : n.state === 'locked' ? 'lock' : 'star';
      const node = el('button', { class: `node ${n.state} ${n.type}`, style: { transform: `translateX(${off}px)` }, 'aria-label': `${n.type} ${n.i + 1} ${n.state}`, html: icon(ic, 30) });
      const wrap = el('div', { class: 'node-wrap' }, node);
      if (n.state === 'current') { wrap.prepend(el('div', { class: 'start-bubble', style: { transform: `translateX(${off}px)` } }, n.type === 'lesson' ? 'START' : 'OPEN')); node.onclick = () => openNode(n, node); }
      else if (n.state === 'done') node.onclick = () => n.type === 'lesson' ? play(nextWorkout(store.get()), { practice: true }) : null;
      else node.disabled = true;
      pathEl.append(wrap);
      if (k === 2) pathEl.append(el('div', { class: 'path-mascot', style: { transform: `translateX(${ui % 2 ? -120 : 120}px)` }, html: mascot(n.state === 'current' || ui * 6 + k <= s.path.done ? 'happy' : 'sleepy', 84) }));
    });
    main.append(pathEl);
    if (!unitDone && ui * 6 > s.path.done + 6) break;
  }
  // Habits check-in (counts as an active day: rest days stay productive)
  main.append(habitsCard());
  v.append(el('div', { class: 'two-col' }, main, rail()));
  setTimeout(() => $('.node.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
}

function openNode(n, anchor) {
  const s = store.get();
  closePop();
  if (n.type === 'chest') {
    const gems = 20 + Math.floor(Math.random() * 21);
    store.set(st => { st.gems += gems; st.path.done++; return st; });
    chime(s.settings, 'gem'); confetti();
    return modal(el('div', { class: 'center' }, H(mascot('wow', 110)), el('h2', {}, 'Treasure!'), el('p', {}, H(`${icon('gem', 22)} <b>+${gems} gems</b>`)), el('p', { class: 'muted small' }, 'Spend gems on streak freezes and themes in your profile.')), 'Collect', () => route());
  }
  const isTrophy = n.type === 'trophy';
  const plan = isTrophy ? nextWorkout(s, 4) : nextWorkout(s);
  const pop = el('div', { class: 'popover', role: 'dialog' },
    el('h3', {}, isTrophy ? 'Unit challenge' : `Workout ${n.i + 1}`),
    el('p', { class: 'small' }, `${plan.length} exercises · ~${plan.reduce((a, g) => a + g.minutes, 0)} min${isTrophy ? ' · +20 bonus XP' : ''}`),
    el('div', { class: 'pop-games' }, plan.map(g => el('div', { class: 'pop-g' }, gtile(g, 18, 'sm'), el('span', {}, g.name)))),
    el('button', { class: 'btn primary big', onclick: () => { closePop(); play(plan, { node: true, bonus: isTrophy ? 20 : 0 }); } }, isTrophy ? 'Start challenge' : 'Start'));
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${r.bottom + window.scrollY + 12}px`;
  pop.style.left = `${Math.max(12, Math.min(window.innerWidth - pop.offsetWidth - 12, r.left + r.width / 2 - pop.offsetWidth / 2))}px`;
  setTimeout(() => document.addEventListener('pointerdown', onDocDown), 0);
}
function onDocDown(e) { if (!e.target.closest('.popover')) closePop(); }
function closePop() { document.querySelector('.popover')?.remove(); document.removeEventListener('pointerdown', onDocDown); }

function habitsCard() {
  const s = store.get(), k = today(), h = s.habits[k] || {};
  return el('section', { class: 'card habits' },
    el('div', { class: 'card-h' }, el('h3', {}, 'Brain habits today'), el('span', { class: 'muted small' }, 'Logging one keeps your streak on rest days')),
    el('div', { class: 'habit-grid' }, HABITS.map(([id, ic, label, why]) => {
      const b = el('button', { class: 'habit' + (h[id] ? ' on' : ''), title: why, 'aria-pressed': h[id] ? 'true' : 'false' }, H(icon(ic, 22)), el('span', {}, label));
      b.onclick = () => { store.set(st => { st.habits[k] = { ...(st.habits[k] || {}), [id]: !h[id] }; return st; }); claimQuests(); checkAchievements(); route(); };
      return b;
    })));
}

// ---------- Games library ----------
function games() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const main = el('div', { class: 'main-col' }, el('h1', {}, 'Exercises'), el('p', { class: 'muted' }, '13 exercises across 7 skills, each based on a published research method. New ones unlock as you progress.'));
  const grid = el('div', { class: 'lib' });
  for (const g of [...GAMES, checkup]) {
    const isUnlocked = g === checkup || unlocked(s, g.id), sci = GAME_SCIENCE[g.id];
    const skill = S.smoothedSkills(s.results)[g.id];
    grid.append(el('div', { class: 'lib-card' + (isUnlocked ? '' : ' locked'), style: { '--game': g === checkup ? 'var(--d-check)' : gameColor(g) } },
      el('div', { class: 'lib-top' }, el('div', { class: 'gtile', html: icon(isUnlocked ? g.icon : 'lock', 30) }), skill != null ? el('div', { class: 'lib-skill' }, el('b', {}, skill), el('span', {}, 'skill')) : null),
      el('h3', {}, g.name), el('div', { class: 'chip' }, g === checkup ? 'Assessment' : S.DOMAINS[domainOf(g.id)]?.name || 'Body & mind'),
      el('p', { class: 'small' }, g.tagline),
      el('div', { class: 'lib-meta small muted' }, `~${g.minutes} min · ${g === checkup ? 'monthly' : levelText(g)}`),
      el('div', { class: 'lib-actions' },
        isUnlocked ? el('button', { class: 'btn primary', onclick: () => play([g], { checkup: g === checkup }) }, 'Play') : el('span', { class: 'small muted' }, `Unlocks after workout ${UNLOCK[g.id]}`),
        sci ? el('a', { class: 'btn ghost', href: `#science-${g.id}` }, 'Science') : null)));
  }
  main.append(grid);
  v.append(el('div', { class: 'two-col' }, main, rail()));
}

// ---------- Brain (scores) ----------
function radar(scores) {
  const keys = Object.keys(S.DOMAINS), n = keys.length, R = 110, cx = 150, cy = 140;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const ring = (v) => keys.map((_, i) => pt(i, v).join(',')).join(' ');
  const poly = keys.map((k, i) => pt(i, (scores[k] || 0) / 1000).join(',')).join(' ');
  return svg('svg', { viewBox: '0 0 300 290', class: 'radar', role: 'img', 'aria-label': 'Skill profile across 7 domains' },
    ...[0.25, 0.5, 0.75, 1].map(v => svg('polygon', { points: ring(v), fill: 'none', stroke: 'var(--track)', 'stroke-width': 1.5 })),
    ...keys.map((_, i) => svg('line', { x1: cx, y1: cy, x2: pt(i, 1)[0], y2: pt(i, 1)[1], stroke: 'var(--track)' })),
    svg('polygon', { points: poly, fill: 'color-mix(in srgb, var(--accent) 30%, transparent)', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    ...keys.map((k, i) => { const [x, y] = pt(i, 1.2); const t = svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'radar-l' }); t.textContent = `${S.DOMAINS[k].name}`; return t; }));
}
function lineChart(pts, { w = 560, h = 160 } = {}) {
  if (pts.length < 2) return el('p', { class: 'muted small' }, 'Train on a few different days to see your trend.');
  const ys = pts.map(p => p.value), lo = Math.max(0, Math.min(...ys) - 40), hi = Math.min(1000, Math.max(...ys) + 40);
  const X = (i) => 30 + (i / (pts.length - 1)) * (w - 40), Y = (v) => h - 22 - ((v - lo) / (hi - lo || 1)) * (h - 40);
  const d = ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const area = `${d}L${X(ys.length - 1)},${h - 22}L${X(0)},${h - 22}Z`;
  const tick = (v) => { const t = svg('text', { x: 2, y: Y(v) + 4, class: 'axis' }); t.textContent = Math.round(v); return t; };
  return svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'line-chart', role: 'img', 'aria-label': `Brain Index from ${ys[0]} to ${ys[ys.length - 1]}` },
    svg('line', { x1: 30, x2: w - 10, y1: Y(lo), y2: Y(lo), stroke: 'var(--track)' }), svg('line', { x1: 30, x2: w - 10, y1: Y(hi), y2: Y(hi), stroke: 'var(--track)', 'stroke-dasharray': '3 4' }),
    tick(lo), tick(hi),
    svg('path', { d: area, fill: 'color-mix(in srgb, var(--accent) 16%, transparent)' }),
    svg('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    svg('circle', { cx: X(ys.length - 1), cy: Y(ys[ys.length - 1]), r: 5, fill: 'var(--accent)' }));
}
function brain() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const bi = S.brainIndex(s.results), ds = S.domainScores(s.results), hist = S.indexHistory(s.results, C.dayKey), sk = S.smoothedSkills(s.results);
  const first = hist[0]?.value, delta = bi != null && first != null ? bi - first : 0;
  const main = el('div', { class: 'main-col' },
    el('h1', {}, 'Your brain'),
    el('section', { class: 'card bi-card' },
      el('div', { class: 'bi' }, el('div', { class: 'bi-num' }, bi ?? '–'), el('div', {}, el('div', { class: 'bi-label' }, 'Brain Index'), el('div', { class: 'small ' + (delta > 0 ? 'up' : 'muted') }, bi == null ? 'Play a few exercises to get your index' : delta > 0 ? `▲ +${delta} since you started` : 'Your starting point'))),
      el('p', { class: 'small muted' }, 'Average of your 7 skill scores (0–1000). Each is calculated from the measure the research uses, e.g. n-back level, flash duration, switch cost. Smoothed over sessions so one bad day doesn\'t count. It is not an IQ score.'),
      lineChart(hist)),
    el('section', { class: 'card' }, el('h2', {}, 'Skill profile'), el('div', { class: 'radar-wrap' }, radar(ds),
      el('div', { class: 'dom-list' }, Object.entries(S.DOMAINS).map(([k, d]) => el('div', { class: 'dom' }, el('span', { class: 'dot', style: { background: d.color } }), el('span', { class: 'grow' }, d.name), el('b', {}, ds[k] ?? '–')))))),
    el('section', { class: 'card' }, el('h2', {}, 'Exercise skills'), el('div', { class: 'skill-list' }, SKILL_GAMES.map(g => {
      const val = sk[g.id], rs = s.results.filter(r => r.game === g.id && !r.review && r.skill != null);
      return el('div', { class: 'skill-row' }, gtile(g, 18, 'sm'), el('div', { class: 'grow' }, el('div', {}, el('b', {}, g.name), el('span', { class: 'muted small' }, ` · ${rs.length} sessions`)), el('div', { class: 'small muted' }, S.SKILLS[g.id].metric), el('div', { class: 'bar' }, el('i', { style: { width: `${(val || 0) / 10}%`, background: gameColor(g) } }))), el('b', { class: 'skill-val' }, val ?? '–'));
    }))),
    el('section', { class: 'card' }, el('h2', {}, 'Check-up: transfer to untrained tasks'),
      s.checkups.length ? el('table', { class: 'tbl' }, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Reaction'), el('th', {}, 'Digits backward'), el('th', {}, 'Stroop cost')), s.checkups.map(c => el('tr', {}, el('td', {}, new Date(c.t).toLocaleDateString()), el('td', {}, `${c.m.choiceRT} ms`), el('td', {}, c.m.backwardDigitSpan), el('td', {}, `${c.m.stroopCost} ms`)))) : el('p', { class: 'muted small' }, 'No check-ups yet. Your first one becomes your baseline.'),
      el('button', { class: 'btn', onclick: () => play([checkup], { checkup: true }) }, 'Take a Check-up')));
  v.append(el('div', { class: 'two-col' }, main, rail()));
}

// ---------- League ----------
function league() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const t = G.leagueTable(s.league.week, s.league.tier, weekXp(s));
  const end = G.startOfWeek(Date.now()) + 7 * C.DAY, left = end - Date.now();
  const main = el('div', { class: 'main-col' },
    el('div', { class: 'league-head' }, el('div', { class: 'tier-row' }, G.TIERS.map((n, i) => el('div', { class: `tier-badge t${i}` + (i === s.league.tier ? ' me' : i > s.league.tier ? ' dim' : ''), title: n, html: icon('shield', i === s.league.tier ? 44 : 28) }))),
      el('h1', {}, `${G.TIERS[s.league.tier]} League`), el('p', { class: 'muted' }, `Top 3 advance · ${Math.floor(left / C.DAY)}d ${Math.floor((left % C.DAY) / 3600e3)}h left`)),
    el('ol', { class: 'league' }, t.map(r => el('li', { class: `lrow ${r.zone}` + (r.bot ? '' : ' me') },
      el('span', { class: 'rank' }, r.rank), el('span', { class: 'avatar', html: r.bot ? icon('brain', 20) : mascot('happy', 30) }), el('span', { class: 'grow' }, r.name, r.bot ? el('span', { class: 'bot-tag' }, 'AI rival') : null), el('b', {}, `${r.xp} XP`)))),
    el('p', { class: 'small muted' }, 'Online leagues with real players are coming. Until then you compete against AI rivals whose pace is set for your tier, and everything stays private on your device.'));
  v.append(el('div', { class: 'two-col' }, main, rail()));
}

// ---------- Profile & settings ----------
function profile() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const lp = G.levelProgress(s.xp), st = streakOf(s);
  const minutes = Math.round(s.results.reduce((a, r) => a + (ALL[r.game]?.minutes || 3), 0));
  const tile = (ic, val, lab) => el('div', { class: 'ptile' }, H(icon(ic, 22)), el('b', {}, val), el('span', {}, lab));
  const toggle = (key, label) => { const cb = el('input', { type: 'checkbox', checked: !!s.settings[key] }); cb.onchange = () => store.set(x => { x.settings[key] = cb.checked; return x; }); return el('label', { class: 'row' }, cb, label); };
  const name = el('input', { class: 'inp', value: s.profile.name || '', placeholder: 'Your name', maxlength: 24, 'aria-label': 'Name' });
  name.onchange = () => store.set(x => { x.profile.name = name.value.trim(); return x; });
  const ageSel = el('select', { class: 'inp', 'aria-label': 'Age band' }, el('option', { value: '' }, 'Prefer not to say'), S.AGE_BANDS.map(a => el('option', { value: a, selected: s.profile.age === a }, a)));
  ageSel.onchange = () => store.set(x => { x.profile.age = ageSel.value; return x; });
  const goalSel = el('div', { class: 'goal-opts' }, G.DAILY_GOALS.map(g => { const b = el('button', { class: 'goal-opt' + (s.profile.goal === g.xp ? ' on' : '') }, el('b', {}, g.name), el('span', {}, `${g.xp} XP · ${g.desc}`)); b.onclick = () => { store.set(x => { x.profile.goal = g.xp; return x; }); route(); }; return b; }));
  const loci = el('textarea', { rows: 6, class: 'inp', 'aria-label': 'Memory palace spots, one per line' }, (s.palace.loci || DEFAULT_LOCI).join('\n'));
  const file = el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  file.onchange = async () => { try { store.import(await file.files[0].text()); toast('Progress imported'); route(); } catch { toast('That file could not be read'); } };
  const buy = (what, cost, fn) => { if (store.get().gems < cost) return toast(`You need ${cost} gems`); store.set(x => { x.gems -= cost; fn(x); return x; }); chime(s.settings, 'gem'); route(); };
  const main = el('div', { class: 'main-col' },
    el('section', { class: 'profile-head' }, H(mascot('cheer', 96)), el('div', {}, el('h1', {}, s.profile.name || 'Brain athlete'), el('div', { class: 'muted' }, `Level ${lp.level} · joined ${new Date(s.created).toLocaleDateString()}`),
      el('div', { class: 'lvl-bar' }, el('i', { style: { width: `${lp.pct * 100}%` } })), el('div', { class: 'small muted' }, `${lp.into}/${lp.span} XP to level ${lp.level + 1}`))),
    el('div', { class: 'ptiles' }, tile('flame', st, 'day streak'), tile('bolt', s.xp, 'total XP'), tile('trophy', G.TIERS[s.league.tier], 'league'), tile('check', s.workouts, 'workouts'), tile('brain', `${minutes} min`, 'trained'), tile('gem', s.gems, 'gems')),
    el('section', { class: 'card' }, el('h2', {}, 'Achievements'), el('div', { class: 'badges' }, G.ACHIEVEMENTS.map(a => el('div', { class: 'badge' + (s.achievements[a.id] ? ' got' : ''), title: a.desc }, H(icon(s.achievements[a.id] ? 'star' : 'lock', 26)), el('b', {}, a.name), el('span', {}, a.desc))))),
    el('section', { class: 'card' }, el('h2', {}, 'Shop'), el('div', { class: 'shop' },
      el('div', { class: 'shop-item' }, H(icon('flame', 30)), el('div', { class: 'grow' }, el('b', {}, 'Streak freeze'), el('div', { class: 'small muted' }, `Covers missed days beyond your 2 weekly rest days. Owned: ${s.freezes}/3`)), el('button', { class: 'btn sm', disabled: s.freezes >= 3, onclick: () => buy('freeze', 100, x => x.freezes++) }, H(`${icon('gem', 14)} 100`))),
      Object.entries(THEMES).map(([k, c]) => el('div', { class: 'shop-item' }, el('span', { class: 'swatch-dot', style: { background: c } }), el('div', { class: 'grow' }, el('b', {}, `${k[0].toUpperCase() + k.slice(1)} theme`)),
        s.owned.includes(k) ? el('button', { class: 'btn sm' + (s.settings.theme === k ? ' primary' : ''), onclick: () => { store.set(x => { x.settings.theme = k; return x; }); applyTheme(); route(); } }, s.settings.theme === k ? 'Active' : 'Use') : el('button', { class: 'btn sm', onclick: () => buy(k, 150, x => { x.owned.push(k); x.settings.theme = k; }) || applyTheme() }, H(`${icon('gem', 14)} 150`)))))),
    el('section', { class: 'card' }, el('h2', {}, 'Daily goal'), goalSel),
    el('section', { class: 'card' }, el('h2', {}, 'Reminders'), el('p', { class: 'small muted' }, 'Add a recurring reminder to your calendar app. It works on every device and needs no account.'),
      el('div', { class: 'row gap' }, el('input', { type: 'time', class: 'inp', value: '19:00', id: 'rtime', 'aria-label': 'Reminder time' }), el('button', { class: 'btn', onclick: () => downloadIcs($('#rtime').value) }, H(`${icon('calendar', 18)} Add to calendar`)))),
    el('section', { class: 'card' }, el('h2', {}, 'Settings'), el('div', { class: 'form' }, el('label', {}, 'Name', name), el('label', {}, 'Age band (sets comfortable starting levels)', ageSel)),
      toggle('sound', 'Sounds'), toggle('speech', 'Spoken letters in Echo Grid'), toggle('reduceMotion', 'Reduce motion'),
      el('label', { class: 'row' }, 'Appearance ', (() => { const sel = el('select', { class: 'inp' }, ['auto', 'light', 'dark'].map(o => el('option', { value: o, selected: s.settings.colorScheme === o }, o))); sel.onchange = () => { store.set(x => { x.settings.colorScheme = sel.value; return x; }); applyTheme(); }; return sel; })())),
    el('section', { class: 'card' }, el('h2', {}, 'Memory palace route'), el('p', { class: 'small muted' }, 'Spots along a route you know well, one per line, in walking order.'), loci,
      el('button', { class: 'btn', onclick: () => { const L = loci.value.split('\n').map(x => x.trim()).filter(Boolean); if (L.length < 4) return toast('Add at least 4 spots'); store.set(x => { x.palace.loci = L.slice(0, 30); return x; }); toast('Route saved'); } }, 'Save route')),
    el('section', { class: 'card' }, el('h2', {}, 'Your data'), el('p', { class: 'small muted' }, 'Everything stays on this device: no account, no tracking, no ads. Export a backup to move to another device.'),
      el('div', { class: 'row gap' }, el('button', { class: 'btn', onclick: exportData }, 'Export file'), el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(store.export()); toast('Backup copied to clipboard'); } catch { toast('Copy is blocked here. Use Export file instead.'); } } }, 'Copy backup'), el('button', { class: 'btn', onclick: () => file.click() }, 'Import'), file,
        el('button', { class: 'btn danger', onclick: async () => { if (await askConfirm('Delete all progress on this device? This cannot be undone.', { yes: 'Delete everything', danger: true })) { store.reset(); route(); } } }, 'Reset'))),
    el('section', { class: 'card' }, el('h2', {}, 'Install the app'), el('p', { class: 'small' }, el('b', {}, 'iPhone/iPad: '), 'Safari → Share → Add to Home Screen. ', el('b', {}, 'Android: '), 'Chrome menu → Install app. ', el('b', {}, 'Mac/PC: '), 'Chrome/Edge install icon in the address bar · Safari → File → Add to Dock. Works offline.')),
    el('p', { class: 'small muted center' }, el('a', { href: '#science' }, 'Science & references'), ' · ', el('a', { href: 'privacy.html' }, 'Privacy'), ' · ', el('a', { href: 'terms.html' }, 'Terms'), el('br'), `${BRAND} is a training tool, not a medical device. It does not diagnose, treat or prevent any condition.`));
  v.append(el('div', { class: 'two-col' }, main, rail()));
}
function exportData() { const a = el('a', { href: URL.createObjectURL(new Blob([store.export()], { type: 'application/json' })), download: `mentaro-${today()}.json` }); document.body.append(a); a.click(); a.remove(); }
function downloadIcs(time = '19:00') {
  const [hh, mm] = time.split(':'); const d = new Date(); d.setHours(+hh, +mm, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0'), stamp = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mentaro//Reminder//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@mentaro`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(d)}`, 'DURATION:PT15M', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', `SUMMARY:${BRAND}: 15-minute brain workout`, `DESCRIPTION:Keep your streak alive. Open ${location.origin}${location.pathname}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Brain workout time', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = el('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'mentaro-reminder.ics' }); document.body.append(a); a.click(); a.remove();
}

// ---------- Science ----------
function science(focus) {
  const v = view(); v.innerHTML = '';
  const main = el('div', { class: 'main-col' }, el('h1', {}, 'The science'),
    el('p', { class: 'muted' }, `Every ${BRAND} exercise is based on a published research method. Here is what each trains, the papers behind it, how your score is calculated, and how strong the evidence is. We say plainly where evidence is weak.`),
    el('section', { class: 'card' }, el('h2', {}, 'What the evidence says'), FINDINGS.map(([t, d]) => el('div', { class: 'finding' }, el('b', {}, t), el('p', { class: 'small' }, d)))));
  for (const g of GAMES) {
    const sc = GAME_SCIENCE[g.id];
    main.append(el('details', { class: 'card sci', id: `sci-${g.id}`, open: focus === g.id },
      el('summary', {}, gtile(g, 20, 'sm'), el('b', {}, g.name), el('span', { class: 'chip' }, sc.evidence[0])),
      el('dl', {}, ...[['Research method', sc.method], ['Key researchers', sc.researchers], ['Key papers', sc.paper], ['How it works', sc.how], ['Why it\'s good for your brain', sc.why], ['Brain networks involved', sc.brain], ['Your score measures', sc.score], ['Evidence', sc.evidence[1]], [`What ${BRAND} improves`, sc.improved]].flatMap(([a, b]) => [el('dt', {}, a), el('dd', {}, b)]))));
  }
  main.append(el('section', { class: 'card' }, el('h2', {}, 'References'), el('ol', { class: 'refs small' }, REFERENCES.map(r => el('li', {}, r)))),
    el('p', { class: 'small muted' }, `${BRAND} is a training tool, not a medical device. It has not been evaluated in clinical trials and does not diagnose, treat or prevent any disease.`));
  v.append(el('div', { class: 'two-col' }, main, rail()));
  if (focus) setTimeout(() => document.getElementById(`sci-${focus}`)?.scrollIntoView({ block: 'start' }), 0);
}

// ---------- Onboarding ----------
function onboarding() {
  const v = view(); v.innerHTML = '';
  document.body.classList.add('onboarding');
  const data = { focus: [], age: '', goal: 50, name: '' };
  const steps = [
    () => [H(mascot('cheer', 140)), el('h1', {}, `Hi! I'm Nuri.`), el('p', { class: 'lead' }, `Welcome to ${BRAND}, your science-based brain gym. 13 games, 5 minutes at a time, built on published research.`)],
    () => [H(mascot('think', 96)), el('h2', {}, 'What would you like to sharpen?'), el('p', { class: 'muted' }, 'Pick any. Your workouts will lean toward these.'),
      el('div', { class: 'choice-grid' }, Object.entries(S.DOMAINS).map(([k, d]) => { const b = el('button', { class: 'choice', style: { '--c': d.color } }, H(icon(d.icon, 26)), el('span', {}, d.name)); b.onclick = () => { b.classList.toggle('on'); data.focus = b.classList.contains('on') ? [...data.focus, k] : data.focus.filter(x => x !== k); }; return b; }))],
    () => [H(mascot('happy', 96)), el('h2', {}, 'How old are you?'), el('p', { class: 'muted' }, 'Used only to set comfortable starting levels and pacing. It stays on this device.'),
      el('div', { class: 'choice-grid' }, [...S.AGE_BANDS, 'Skip'].map(a => { const b = el('button', { class: 'choice pill' }, a); b.onclick = () => { $('.choice.on', v)?.classList.remove('on'); b.classList.add('on'); data.age = a === 'Skip' ? '' : a; }; return b; }))],
    () => [H(mascot('wow', 96)), el('h2', {}, 'Pick a daily goal'), el('p', { class: 'muted' }, 'Research favours short, regular sessions. You can change this any time.'),
      el('div', { class: 'goal-opts' }, G.DAILY_GOALS.map(g => { const b = el('button', { class: 'goal-opt' + (g.xp === 50 ? ' on' : '') }, el('b', {}, g.name), el('span', {}, `${g.xp} XP · ${g.desc}`)); b.onclick = () => { $('.goal-opt.on', v)?.classList.remove('on'); b.classList.add('on'); data.goal = g.xp; }; return b; }))],
    () => [H(mascot('think', 96)), el('h2', {}, 'Our honest promise'), el('ul', { class: 'promise' },
      el('li', {}, H(`${icon('check', 18)} You <b>will</b> get better at the skills you train: speed, memory span, focus, switching.`)),
      el('li', {}, H(`${icon('check', 18)} Memory <b>strategies</b> (memory palace, face–name links) work in real life.`)),
      el('li', {}, H(`${icon('check', 18)} A monthly <b>Check-up</b> on untrained tasks shows whether gains carry over.`)),
      el('li', {}, H(`${icon('close', 18)} No app can promise a higher IQ or prevent disease, and we won't pretend.`)),
      el('li', {}, H(`${icon('leaf', 18)} Best results: 15–20 min, 3–5 days a week, plus exercise and sleep.`)))],
  ];
  let i = 0;
  const render = () => {
    v.innerHTML = '';
    const next = el('button', { class: 'btn primary big', onclick: () => { if (i < steps.length - 1) { i++; render(); } else finish(); } }, i === 0 ? 'Get started' : i === steps.length - 1 ? 'Start my first workout' : 'Continue');
    v.append(el('div', { class: 'onb' }, el('div', { class: 'onb-progress' }, el('i', { style: { width: `${(i / (steps.length - 1)) * 100}%` } })), el('div', { class: 'onb-body' }, ...steps[i]()), el('div', { class: 'onb-cta' }, i > 0 ? el('button', { class: 'btn ghost', onclick: () => { i--; render(); } }, 'Back') : null, next)));
  };
  const finish = () => {
    store.set(s => { s.profile = { ...s.profile, ...data, onboarded: true }; for (const [k, val] of Object.entries(S.startingLevels(data.age || '30–44'))) s.levels[k] ??= val; return s; });
    document.body.classList.remove('onboarding');
    applyTheme();
    unlockAudio();
    play(nextWorkout(store.get()), { node: true });
  };
  render();
}

// ---------- Playing a workout ----------
function trimMetrics(m) { const o = {}; for (const [k, v] of Object.entries(m || {})) if (v == null || typeof v !== 'object') o[k] = v; return o; }

export async function play(queue, opts = {}) {
  if (playing) return;
  playing = true; closePop();
  document.body.classList.add('playing');
  const root = $('#play'); root.hidden = false;
  const before = { xp: store.get().xp, streak: streakOf(store.get()), level: G.levelFromXp(store.get().xp), goalMet: todayXp(store.get()) >= (store.get().profile.goal || 50) };
  const t0 = Date.now(); let done = 0, xpGained = 0; const accs = [];
  globalThis.__ngPace = S.comfortPace(store.get().profile.age);
  for (let i = 0; i < queue.length; i++) {
    const g = queue[i], ac = new AbortController();
    const quit = async () => { if (await askConfirm('Quit this workout? This round won\'t be saved.', { yes: 'Quit', no: 'Keep going', danger: true })) ac.abort(); };
    const s = store.get();
    setCurrentGame({ id: g.id, icon: g.icon, color: g === checkup ? 'var(--d-check)' : gameColor(g), domainName: S.DOMAINS[domainOf(g.id)]?.name || (g === checkup ? 'Assessment' : 'Body & mind') });
    const ctx = { level: s.levels[g.id], settings: s.settings, signal: ac.signal, rng: Math.random, quit, palace: s.palace, review: opts.review };
    let result;
    try { result = await g.run(root, ctx); }
    catch (e) { if (e instanceof Aborted || e?.name === 'AbortError' || ac.signal.aborted) break; console.error(e); toast('Something went wrong: ' + e.message); break; }
    const xp = save(g, result, opts);
    xpGained += xp; done++; if (Number.isFinite(result.accuracy)) accs.push(result.accuracy);
    const goOn = await resultScreen(root, g, result, xp, queue[i + 1]);
    if (!goOn) break;
  }
  const completedAll = done === queue.length && done > 0;
  if (completedAll && (opts.node || opts.practice)) store.set(s => { if (opts.node) s.path.done++; s.workouts++; if (opts.bonus) { s.xp += opts.bonus; s.results[s.results.length - 1].xp += opts.bonus; } return s; });
  if (opts.bonus && completedAll) xpGained += opts.bonus;
  try { speechSynthesis?.cancel(); } catch { }
  globalThis.__ngPace = 1;
  if (done > 0) await celebrate(root, { before, xpGained, accs, minutes: Math.max(1, Math.round((Date.now() - t0) / 60000)), completedAll, workout: queue.length > 1 });
  root.hidden = true; root.innerHTML = '';
  document.body.classList.remove('playing');
  playing = false;
  route();
}

function save(g, r, opts) {
  let xp = 0;
  store.set(s => {
    const t = Date.now();
    if (g.assessment) { s.checkups.push({ t, m: r.metrics }); xp = 20; s.xp += xp; s.results.push({ game: 'checkup', t, xp, accuracy: r.accuracy, review: true, m: {} }); return s; }
    const prev = s.levels[g.id];
    const res = { game: g.id, t, score: r.score, accuracy: +(r.accuracy ?? 0).toFixed(3), level: r.level, review: !!opts.review, m: trimMetrics(r.metrics) };
    res.skill = opts.review ? null : S.skillOf(g.id, res);
    const pb = res.skill != null && res.skill > (s.bests[g.id] ?? -1) && s.bests[g.id] != null;
    if (res.skill != null) s.bests[g.id] = Math.max(s.bests[g.id] ?? 0, res.skill);
    const leveledUp = !opts.review && prev != null && (typeof r.level === 'number' ? r.level > prev : !!(r.level && prev && r.level.f + r.level.b > prev.f + prev.b));
    xp = G.xpForResult(res, { leveledUp, personalBest: pb });
    res.xp = xp; res.pb = pb;
    if (!opts.review) s.levels[g.id] = r.level;
    s.results.push(res); s.xp += xp;
    s.sessions.push({ t }); if (s.sessions.length > 3000) s.sessions = s.sessions.slice(-3000);
    const pu = r.palaceUpdate;
    if (pu?.type === 'new') { s.palace.lists.push(pu.list); s.palace.lists = s.palace.lists.slice(-60); }
    if (pu?.type === 'review') { const L = s.palace.lists.find(l => l.id === pu.id); if (L) { L.card = pu.card; L.history.push({ t, recall: pu.recall }); } }
    r._pb = pb; r._leveledUp = leveledUp;
    return s;
  });
  return xp;
}

function resultScreen(root, g, r, xp, next) {
  return new Promise(res => {
    root.innerHTML = '';
    const sk = store.get().results.at(-1)?.skill;
    const cont = el('button', { class: 'btn primary big', onclick: () => res(true) }, next ? `Next: ${next.name}` : 'Finish');
    root.style.setProperty('--game', g === checkup ? 'var(--d-check)' : gameColor(g));
    root.append(el('div', { class: 'intro result' },
      el('div', { class: 'res-head' }, el('div', { class: 'gtile big', html: icon(g.icon, 40) }), H(mascot(r.accuracy >= 0.8 ? 'cheer' : r.accuracy >= 0.5 ? 'happy' : 'think', 90))),
      el('h2', {}, r.accuracy >= 0.9 ? 'Amazing!' : r.accuracy >= 0.7 ? 'Nice work!' : r.accuracy >= 0.5 ? 'Good effort!' : 'Tough one. That\'s where growth happens.'),
      el('div', { class: 'res-tiles' },
        el('div', { class: 'rt xp' }, el('span', {}, 'XP'), el('b', {}, `+${xp}`)),
        el('div', { class: 'rt acc' }, el('span', {}, 'Accuracy'), el('b', {}, `${Math.round((r.accuracy || 0) * 100)}%`)),
        sk != null ? el('div', { class: 'rt sk' }, el('span', {}, 'Skill'), el('b', {}, sk)) : null),
      r._pb ? el('div', { class: 'pb-flag', html: `${icon('star', 18)} New personal best!` }) : null,
      el('ul', { class: 'summary' }, r.summary.map(x => el('li', {}, x))),
      cont, next ? el('button', { class: 'btn ghost', onclick: () => res(false) }, 'End workout here') : null));
    chime(store.get().settings, r.accuracy >= 0.7 ? 'win' : 'gem');
    cont.focus();
  });
}

async function celebrate(root, { before, xpGained, accs, minutes, workout }) {
  const s = store.get();
  const quests = claimQuests(), achievements = checkAchievements();
  const after = store.get(), streak = streakOf(after), level = G.levelFromXp(after.xp);
  const goal = after.profile.goal || 50, tx = todayXp(after);
  const streakUp = streak > before.streak, levelUp = level > before.level, goalNow = tx >= goal && !before.goalMet;
  store.set(x => { x.bestStreak = Math.max(x.bestStreak || 0, streak); return x; });
  const screens = [];
  screens.push(() => el('div', { class: 'celebrate' }, H(mascot('cheer', 150)), el('h1', {}, workout ? 'Workout complete!' : 'Exercise complete!'),
    el('div', { class: 'res-tiles' }, el('div', { class: 'rt xp' }, el('span', {}, 'Total XP'), el('b', {}, `+${xpGained}`)), el('div', { class: 'rt acc' }, el('span', {}, 'Accuracy'), el('b', {}, `${Math.round(C.mean(accs) * 100)}%`)), el('div', { class: 'rt sk' }, el('span', {}, 'Time'), el('b', {}, `${minutes} min`)))));
  if (streakUp) screens.push(() => el('div', { class: 'celebrate' }, el('div', { class: 'big-flame', html: icon('flame', 120) }), el('div', { class: 'streak-num' }, streak), el('h1', {}, 'day streak!'),
    el('div', { class: 'week-dots' }, [...Array(7)].map((_, i) => { const d = Date.now() - (6 - i) * C.DAY; const on = activeDays(after).includes(C.dayKey(d)); return el('div', { class: 'wd' + (on ? ' on' : '') }, el('span', {}, 'MTWTFSS'[(new Date(d).getDay() + 6) % 7]), H(icon(on ? 'flame' : 'leaf', 18))); })),
    el('p', { class: 'muted' }, 'Two rest days a week are built in, because rest helps your brain consolidate.')));
  if (goalNow || levelUp || quests.length || achievements.length) screens.push(() => el('div', { class: 'celebrate' }, H(mascot('wow', 110)), el('h1', {}, levelUp ? `Level ${level}!` : 'Rewards'),
    el('div', { class: 'rewards' },
      goalNow ? el('div', { class: 'reward' }, H(icon('bolt', 22)), el('span', {}, `Daily goal reached (${goal} XP)`)) : null,
      levelUp ? el('div', { class: 'reward' }, H(icon('star', 22)), el('span', {}, `You reached player level ${level}`)) : null,
      ...quests.map(q => el('div', { class: 'reward' }, H(icon('check', 22)), el('span', { class: 'grow' }, `Quest: ${q.text}`), H(`${icon('gem', 16)} +${q.gems}`))),
      ...achievements.map(a => el('div', { class: 'reward' }, H(icon('trophy', 22)), el('span', { class: 'grow' }, `Achievement: ${a.name}`), H(`${icon('gem', 16)} +25`))))));
  for (let i = 0; i < screens.length; i++) {
    root.innerHTML = '';
    const btn = el('button', { class: 'btn primary big' }, i === screens.length - 1 ? 'Continue' : 'Next');
    root.append(el('div', { class: 'intro' }, screens[i](), btn));
    confetti(); chime(s.settings, i === 0 ? 'win' : i === 1 && streakUp ? 'streak' : 'level');
    btn.focus();
    await new Promise(r => (btn.onclick = r));
  }
}

// ---------- Toast & modal ----------
function toast(msg) { const t = el('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600); }
function modal(content, cta, onClose) {
  const close = () => { m.remove(); onClose?.(); };
  const m = el('div', { class: 'modal', role: 'dialog' }, el('div', { class: 'modal-card' }, content, el('button', { class: 'btn primary big', onclick: close }, cta)));
  document.body.append(m); m.querySelector('button').focus();
}

// ---------- Theme ----------
function applyTheme() {
  const s = store.get();
  document.documentElement.style.setProperty('--accent', THEMES[s.settings.theme] || THEMES.violet);
  const root = document.documentElement;
  if (s.settings.colorScheme === 'auto') { if (root.dataset.mentaroTheme) { root.removeAttribute('data-theme'); delete root.dataset.mentaroTheme; } }
  else { root.setAttribute('data-theme', s.settings.colorScheme); root.dataset.mentaroTheme = '1'; }
  document.documentElement.classList.toggle('reduce-motion', !!s.settings.reduceMotion);
}

// ---------- Router ----------
const ROUTES = { learn, games, brain, league, profile, science };
export function route() {
  if (playing) return;
  const s = store.get();
  const bar = $('#statbar'); bar.innerHTML = '';
  if (!s.profile.onboarded) { document.body.classList.add('onboarding'); return onboarding(); }
  bar.append(statBar());
  const h = (location.hash || '#learn').slice(1).replace(/^\//, ''), [name, arg] = [h.split(/[-/]/)[0] || 'learn', h.split(/[-/]/).slice(1).join('-')];
  (ROUTES[name] || learn)(arg);
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${ROUTES[name] ? name : 'learn'}`));
  if (!arg) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
document.querySelectorAll('nav.tabs a[data-ic]').forEach(a => { a.querySelector('i').innerHTML = icon(a.dataset.ic, 26); });
applyTheme();
housekeeping();
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude|claudeusercontent/.test(location.hostname)) navigator.serviceWorker.register('./sw.js').catch(() => { });
window.__mentaro = { store, GAMES, play, ALL };
