// Mentaro app shell: profiles (guest + local accounts), onboarding, learning path, games library,
// brain scores, leagues, profile, session flow, celebrations and i18n. All data stays on device.
import { el, svg, Aborted, setCurrentGame, chime, confetti, unlockAudio, askConfirm } from './ui.js';
import * as C from './core.js';
import * as G from './gamify.js';
import * as S from './scoring.js';
import { icon, mascot } from './icons.js';
import { GAME_SCIENCE, FINDINGS, REFERENCES } from './science.js';
import { t, tl, setLang, lang, LANGS, detectLang, fmtDate, speechLang } from './i18n.js';
import { createProfiles, COLORS } from './profiles.js';
import { DIFF, levelNumber, levelFraction } from './difficulty.js';
import { defaultLoci } from './games/mind-palace.js';
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
const UNLOCK = { flash: 0, shift: 0, arrows: 0, grid: 0, math: 0, palace: 0, active: 0, logic: 6, names: 6, word: 12, path: 12, echo: 18, orbit: 18 };
const DEFAULT_LEVEL = { orbit: 4, grid: { f: 3, b: 2 }, palace: 6, names: 4, path: 4 };
const EVIDENCE = { flash: 'strong', echo: 'mixed', grid: 'moderate', palace: 'strong', names: 'moderate', path: 'moderate', shift: 'moderate', arrows: 'limited', orbit: 'limited', logic: 'specific', word: 'moderate', math: 'specific', active: 'moderate', checkup: 'strong' };
const THEMES = { violet: '#7c5cff', ocean: '#0ea5e9', sunset: '#f97316', forest: '#16a34a', rose: '#e11d74' };
const HABITS = [['exercise', 'active'], ['sleep', 'leaf'], ['learn', 'book'], ['social', 'names']];

let storage; try { storage = window.localStorage; } catch { storage = null; }
const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const backend = storage || mem;
export const profiles = createProfiles(backend);
export const store = profiles.store;

const $ = (s, r = document) => r.querySelector(s);
const view = () => $('#view');
const today = () => C.dayKey(Date.now());
const H = (html) => el('span', { html });
const gName = (g) => t(`g.${g.id}.name`);
const gTag = (g) => t(`g.${g.id}.tag`);
const domName = (id) => (id === 'checkup' ? t('dom.check') : id === 'active' ? t('dom.body') : t('dom.' + domainOf(id)));
const tierName = (i) => tl('tiers')[i];
const achText = (id) => t('ach.' + id).split('|');
const questText = (q) => { const [type, n] = q.id.split(':'); return t('q.' + type, { n }); };
let playing = false;

// ---------- Language ----------
const deviceLang = () => { try { return backend.getItem('mentaro.lang'); } catch { return null; } };
async function applyLang() {
  const code = (profiles.current() && store.get().settings.lang) || deviceLang() || detectLang();
  await setLang(code);
  document.querySelectorAll('nav.tabs a[data-ic]').forEach(a => { a.querySelector('em').textContent = t('nav.' + a.getAttribute('href').slice(1)); });
}
async function changeLang(code) {
  try { backend.setItem('mentaro.lang', code); } catch { }
  if (profiles.current()) store.set(s => { s.settings.lang = code; return s; });
  await applyLang(); route();
}
const langSelect = () => { const sel = el('select', { class: 'inp lang-sel', 'aria-label': t('prof.language'), id: 'lang-select' }, Object.entries(LANGS).map(([k, v]) => el('option', { value: k, selected: k === lang() }, v))); sel.onchange = () => changeLang(sel.value); return sel; };

// ---------- Derived state ----------
const activeDays = (s) => [...new Set([...s.results.map(r => C.dayKey(r.t)), ...Object.entries(s.habits).filter(([, h]) => Object.values(h).some(Boolean)).map(([d]) => d)])];
const streakOf = (s) => G.computeStreak({ activeDays: activeDays(s), freezesUsed: s.freezesUsed });
const todayXp = (s) => s.results.filter(r => C.dayKey(r.t) === today()).reduce((a, r) => a + (r.xp || 0), 0);
const weekXp = (s, wk = G.weekKey(Date.now())) => s.results.filter(r => G.weekKey(r.t) === wk).reduce((a, r) => a + (r.xp || 0), 0);
const unlocked = (s, id) => (UNLOCK[id] ?? 0) <= s.path.done;
const autoValue = (s, id) => s.levels[id] ?? DEFAULT_LEVEL[id] ?? 1;
const diffOf = (s, id) => s.diff?.[id] || { mode: 'auto' };
function levelBadge(g) {
  const s = store.get(); if (!DIFF[g.id]) return '';
  const d = diffOf(s, g.id);
  const n = d.mode === 'manual' && d.level ? d.level : levelNumber(g.id, autoValue(s, g.id));
  return t('lvl.of', { n, max: DIFF[g.id].max });
}
const duePalace = () => (store.get().palace.lists || []).filter(l => l.card.due <= Date.now()).sort((a, b) => a.card.due - b.card.due);
const gameColor = (g) => S.DOMAINS[domainOf(g.id)]?.color || (g.id === 'active' ? 'var(--d-body)' : g.id === 'checkup' ? 'var(--d-check)' : 'var(--accent)');
const gtile = (g, size = 28, extra = '') => el('div', { class: `gtile ${extra}`, style: { '--game': gameColor(g) }, html: icon(g.icon, size) });

// ---------- Housekeeping ----------
function housekeeping() {
  if (!profiles.current()) return;
  store.set(s => {
    const r = G.applyFreezes({ activeDays: activeDays(s), freezesUsed: s.freezesUsed, freezes: s.freezes });
    if (r.spent) { s.freezesUsed = r.freezesUsed; s.freezes = r.freezes; s._toast = t('learn.freezeUsed', { n: r.spent }); }
    const wk = G.weekKey(Date.now());
    if (s.league.week && s.league.week !== wk) {
      const end = G.startOfWeek(s.league.weekStart || Date.now() - 7 * C.DAY) + 7 * C.DAY - 1000;
      const out = G.settleLeague(s.league, G.leagueTable(s.league.week, s.league.tier, weekXp(s, s.league.week), end));
      s._leagueResult = { rank: out.lastRank, from: s.league.tier, to: out.tier };
      s.league = { ...s.league, ...out };
    }
    s.league.week = wk; s.league.weekStart = G.startOfWeek(Date.now());
    return s;
  });
}

// ---------- Welcome & accounts ----------
function welcome() {
  const v = view(); v.innerHTML = '';
  document.body.classList.add('onboarding');
  const list = profiles.list();
  const restore = el('details', { class: 'card' }, el('summary', {}, t('welcome.restore')),
    el('textarea', { class: 'inp', rows: 3, id: 'restore-code', placeholder: t('acc.paste') }),
    el('button', { class: 'btn', onclick: () => { try { profiles.restoreCode($('#restore-code').value); toast(t('acc.restored')); boot(); } catch { toast(t('acc.badCode')); } } }, t('acc.restore')));
  v.append(el('div', { class: 'onb welcome' },
    el('div', { class: 'row end' }, langSelect()),
    el('div', { class: 'onb-body' }, H(mascot('cheer', 130)), el('h1', {}, t('welcome.title')), el('p', { class: 'lead' }, t('welcome.lead')),
      el('div', { class: 'welcome-cta' },
        el('button', { class: 'btn primary big', onclick: () => { profiles.createGuest(); boot(); } }, t('welcome.guest')),
        el('button', { class: 'btn big', onclick: createProfileScreen }, t('welcome.create'))),
      list.length ? el('section', { class: 'card who' }, el('h3', {}, t('welcome.have')), list.map(p => el('button', { class: 'who-row', onclick: () => pickProfile(p) },
        el('span', { class: 'who-av', style: { background: p.color } }, (p.name[0] || '?').toUpperCase()), el('span', { class: 'grow' }, p.guest ? t('acc.guest') : p.name), p.pin ? H(icon('lock', 16)) : null))) : null,
      restore,
      el('p', { class: 'small muted' }, t('welcome.note')))));
}
async function pickProfile(p) {
  if (!profiles.needsPin(p.id)) { profiles.switchTo(p.id); return boot(); }
  const pin = await askPin(p.name);
  if (pin == null) return;
  if (profiles.switchTo(p.id, pin)) boot(); else toast(t('acc.wrongPin'));
}
function askPin(name) {
  return new Promise(res => {
    const inp = el('input', { class: 'inp pin', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', 'aria-label': 'PIN', id: 'pin-input' });
    const close = (v) => { m.remove(); res(v); };
    const m = el('div', { class: 'modal' }, el('div', { class: 'modal-card' }, el('p', { class: 'modal-msg' }, t('acc.enterPin', { name })), inp,
      el('div', { class: 'row gap end' }, el('button', { class: 'btn ghost', onclick: () => close(null) }, t('btn.cancel')), el('button', { class: 'btn primary', onclick: () => close(inp.value) }, t('btn.continue')))));
    inp.onkeydown = (e) => { if (e.key === 'Enter') close(inp.value); if (e.key === 'Escape') close(null); };
    document.body.append(m); inp.focus();
  });
}
function accountForm({ upgrade = false, onDone }) {
  let color = COLORS[profiles.list().length % COLORS.length];
  const name = el('input', { class: 'inp', id: 'acc-name', maxlength: 24, placeholder: t('acc.name'), autocomplete: 'nickname' });
  const pin = el('input', { class: 'inp', id: 'acc-pin', inputmode: 'numeric', maxlength: 4, placeholder: '••••', autocomplete: 'off' });
  const swatches = el('div', { class: 'swatches' }, COLORS.map(c => { const b = el('button', { class: 'sw' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': c, type: 'button' }); b.onclick = () => { color = c; swatches.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); }; return b; }));
  const err = el('p', { class: 'small err', 'aria-live': 'polite' });
  const submit = el('button', { class: 'btn primary big', type: 'submit' }, upgrade ? t('acc.saveProgress') : t('acc.create'));
  const form = el('form', { class: 'form acc-form' },
    el('label', {}, t('acc.name'), name), el('label', {}, t('acc.pin'), pin, el('span', { class: 'small muted' }, t('acc.pinHelp'))),
    upgrade ? null : swatches, err, submit);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!name.value.trim()) { err.textContent = t('acc.nameRequired'); return; }
    if (pin.value && !/^\d{4}$/.test(pin.value)) { err.textContent = t('acc.pinFormat'); return; }
    if (upgrade) profiles.upgradeGuest({ name: name.value, pin: pin.value });
    else profiles.createUser({ name: name.value, pin: pin.value, color });
    onDone();
  });
  return form;
}
function createProfileScreen() {
  const v = view(); v.innerHTML = '';
  v.append(el('div', { class: 'onb' }, el('div', { class: 'row' }, el('button', { class: 'btn ghost', onclick: welcome }, t('btn.back'))),
    el('div', { class: 'onb-body' }, H(mascot('happy', 96)), el('h2', {}, t('welcome.create')), accountForm({ onDone: () => boot() }))));
  $('#acc-name')?.focus();
}

// ---------- Top bar ----------
function statBar() {
  const s = store.get(), st = streakOf(s), lp = G.levelProgress(s.xp), goal = s.profile.goal || 50, tx = todayXp(s), me = profiles.current();
  return el('div', { class: 'statbar' },
    el('a', { class: 'stat-pill streak' + (s.results.some(r => C.dayKey(r.t) === today()) ? ' lit' : ''), href: '#profile', title: t('prof.streak'), html: `${icon('flame', 22)}<b>${st}</b>` }),
    el('a', { class: 'stat-pill gems', href: '#profile', title: t('prof.gems'), html: `${icon('gem', 20)}<b>${s.gems}</b>` }),
    el('a', { class: 'stat-pill xp', href: '#brain', title: 'XP', html: `${icon('bolt', 20)}<b>${tx}/${goal}</b>` }),
    el('a', { class: 'stat-pill lvl', href: '#profile', title: me?.guest ? t('acc.guest') : me?.name, html: `<span class="lvl-badge" style="background:${me?.color || 'var(--accent)'}">${lp.level}</span>` }));
}
function goalRing(value, max, size = 64, label = '') {
  const r = size / 2 - 6, c = 2 * Math.PI * r, p = Math.min(1, value / max);
  return el('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` }, html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--xp)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="ring-label">${label}</div>` });
}

// ---------- Rail ----------
function questsCard() {
  const s = store.get(), d = today(), qs = G.dailyQuests(d), stats = G.dayStats(s, d, domainOf), claimed = s.quests[d] || [];
  return el('section', { class: 'card quests' },
    el('div', { class: 'card-h' }, el('h3', {}, t('quests.title')), el('span', { class: 'muted small' }, t('quests.reset'))),
    qs.map(q => { const done = q.test(stats), got = claimed.includes(q.id);
      return el('div', { class: 'quest' + (done ? ' done' : '') }, el('div', { class: 'q-ic', html: icon(done ? 'check' : 'bolt', 18) }),
        el('div', { class: 'q-body' }, el('div', {}, questText(q)), el('div', { class: 'bar' }, el('i', { style: { width: done ? '100%' : '0%' } }))),
        got ? el('span', { class: 'q-gem got', html: icon('check', 14) }) : el('span', { class: 'q-gem', html: `${icon('gem', 14)}${q.gems}` })); }));
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
  const me = G.leagueTable(s.league.week, s.league.tier, weekXp(s)).find(r => !r.bot);
  return el('aside', { class: 'rail' },
    el('section', { class: 'card goal' }, goalRing(tx, goal, 72, `<b>${Math.min(100, Math.round(100 * tx / goal))}%</b>`),
      el('div', {}, el('h3', {}, t('rail.goal')), el('div', { class: 'muted small' }, t('rail.today', { x: tx, goal })), el('div', { class: 'muted small' }, tx >= goal ? t('rail.reached') : t('rail.toGo', { n: goal - tx })))),
    el('a', { class: 'card league-mini', href: '#league' }, el('div', { class: `tier-badge t${s.league.tier}`, html: icon('shield', 26) }), el('div', {}, el('h3', {}, t('rail.league', { tier: tierName(s.league.tier) })), el('div', { class: 'muted small' }, t('rail.rank', { rank: me.rank, xp: me.xp })))),
    questsCard(),
    el('p', { class: 'legal-mini small muted' }, el('a', { href: 'privacy.html' }, t('legal.privacy')), ' · ', el('a', { href: 'terms.html' }, t('legal.terms')), ' · ', el('a', { href: '#science' }, t('btn.science'))));
}

// ---------- Learn ----------
function nextWorkout(s, size = 3) {
  const pool = SKILL_GAMES.filter(g => unlocked(s, g.id));
  const plan = C.planSession(pool, s.results, { count: size });
  const focus = s.profile.focus || [];
  if (focus.length && !plan.some(g => focus.includes(domainOf(g.id)))) { const f = C.planSession(pool.filter(g => focus.includes(domainOf(g.id))), s.results, { count: 1 })[0]; if (f) plan[plan.length - 1] = f; }
  if (s.path.done % 4 === 3 && plan.length >= 3) plan[plan.length - 1] = active;
  return plan;
}
function learn() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const units = G.pathNodes(s.path.done), unitNames = tl('units');
  const due = duePalace(), cuDue = C.checkupDue(s.checkups) && s.results.length >= 3;
  const main = el('div', { class: 'main-col' });
  if (profiles.current()?.guest && s.results.length >= 3) main.append(el('div', { class: 'banner guest' }, H(icon('user', 22)), el('div', { class: 'grow' }, el('b', {}, t('acc.guestCard')), el('div', { class: 'small' }, t('acc.guestHelp'))), el('a', { class: 'btn sm', href: '#profile' }, t('acc.saveProgress'))));
  if (s._toast) { main.append(el('div', { class: 'toast-inline' }, s._toast)); store.set(st => { delete st._toast; return st; }); }
  if (s._leagueResult) { const L = s._leagueResult; main.append(el('div', { class: 'banner' }, H(icon('trophy', 22)), el('div', {}, el('b', {}, t('learn.lastWeek', { rank: L.rank }) + ' '), L.to > L.from ? t('learn.promoted', { tier: tierName(L.to) }) : t('learn.stay', { tier: tierName(L.to) })))); store.set(st => { delete st._leagueResult; return st; }); }
  if (due.length) main.append(el('div', { class: 'banner alt' }, H(icon('palace', 22)), el('div', { class: 'grow' }, el('b', {}, `${t('learn.reviewsDue')} (${due.length})`), el('div', { class: 'small' }, t('learn.reviewsHelp'))), el('button', { class: 'btn sm', onclick: () => play([palace], { review: due[0] }) }, t('btn.review'))));
  if (cuDue) main.append(el('div', { class: 'banner' }, H(icon('checkup', 22)), el('div', { class: 'grow' }, el('b', {}, s.checkups.length ? t('learn.checkup') : t('learn.checkupFirst')), el('div', { class: 'small' }, t('learn.checkupHelp'))), el('button', { class: 'btn sm', onclick: () => play([checkup], { checkup: true }) }, t('btn.start'))));
  for (const [ui, u] of units.entries()) {
    const hue = ['var(--u1)', 'var(--u2)', 'var(--u3)', 'var(--u4)', 'var(--u5)'][ui % 5];
    const unlocksHere = Object.entries(UNLOCK).filter(([, n]) => n === ui * 6 + 6).map(([id]) => gName(ALL[id]));
    main.append(el('div', { class: 'unit-head', style: { '--unit': hue } },
      el('div', {}, el('div', { class: 'unit-k' }, t('learn.unit', { n: ui + 1 })), el('h2', {}, unitNames[ui % unitNames.length]), unlocksHere.length ? el('div', { class: 'small' }, t('learn.unlock', { games: unlocksHere.join(' & ') })) : null),
      el('a', { class: 'btn unit-guide', href: '#science', html: `${icon('book', 18)} ${t('learn.guide')}` })));
    const pathEl = el('div', { class: 'path', style: { '--unit': hue } });
    u.nodes.forEach((n, k) => {
      const off = [0, 1, 1.6, 1, 0, -1][k % 6] * 46;
      const ic = n.state === 'done' && n.type === 'lesson' ? 'check' : n.type === 'chest' ? 'chest' : n.type === 'trophy' ? 'trophy' : n.state === 'locked' ? 'lock' : 'star';
      const node = el('button', { class: `node ${n.state} ${n.type}`, style: { transform: `translateX(${off}px)` }, 'aria-label': `${n.type} ${n.i + 1}`, html: icon(ic, 30) });
      const wrap = el('div', { class: 'node-wrap' }, node);
      if (n.state === 'current') { wrap.prepend(el('div', { class: 'start-bubble', style: { transform: `translateX(${off}px)` } }, n.type === 'lesson' ? t('learn.start') : t('learn.open'))); node.onclick = () => openNode(n, node); }
      else if (n.state === 'done') node.onclick = () => (n.type === 'lesson' ? play(nextWorkout(store.get()), { practice: true }) : null);
      else node.disabled = true;
      pathEl.append(wrap);
      if (k === 2) pathEl.append(el('div', { class: 'path-mascot', style: { transform: `translateX(${ui % 2 ? -120 : 120}px)` }, html: mascot(ui * 6 + k <= s.path.done ? 'happy' : 'sleepy', 84) }));
    });
    main.append(pathEl);
    if (ui * 6 > s.path.done + 6) break;
  }
  main.append(habitsCard());
  v.append(el('div', { class: 'two-col' }, main, rail()));
  setTimeout(() => $('.node.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
}
function openNode(n, anchor) {
  const s = store.get(); closePop();
  if (n.type === 'chest') {
    const gems = 20 + Math.floor(Math.random() * 21);
    store.set(st => { st.gems += gems; st.path.done++; return st; });
    chime(s.settings, 'gem'); confetti();
    return modal(el('div', { class: 'center' }, H(mascot('wow', 110)), el('h2', {}, t('chest.title')), el('p', {}, H(`${icon('gem', 22)} <b>${t('chest.gems', { n: gems })}</b>`)), el('p', { class: 'muted small' }, t('chest.help'))), t('btn.collect'), () => route());
  }
  const isTrophy = n.type === 'trophy', plan = nextWorkout(s, isTrophy ? 4 : 3);
  const pop = el('div', { class: 'popover', role: 'dialog' },
    el('h3', {}, isTrophy ? t('learn.challenge') : t('learn.workout', { n: n.i + 1 })),
    el('p', { class: 'small' }, t('learn.meta', { n: plan.length, min: plan.reduce((a, g) => a + g.minutes, 0) }) + (isTrophy ? t('learn.bonus') : '')),
    el('div', { class: 'pop-games' }, plan.map(g => el('div', { class: 'pop-g' }, gtile(g, 18, 'sm'), el('span', {}, gName(g))))),
    el('button', { class: 'btn primary big', onclick: () => { closePop(); play(plan, { node: true, bonus: isTrophy ? 20 : 0 }); } }, isTrophy ? t('learn.startChallenge') : t('btn.start')));
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
    el('div', { class: 'card-h' }, el('h3', {}, t('habits.title')), el('span', { class: 'muted small' }, t('habits.help'))),
    el('div', { class: 'habit-grid' }, HABITS.map(([id, ic]) => {
      const b = el('button', { class: 'habit' + (h[id] ? ' on' : ''), title: t(`habit.${id}Why`), 'aria-pressed': h[id] ? 'true' : 'false' }, H(icon(ic, 22)), el('span', {}, t('habit.' + id)));
      b.onclick = () => { store.set(st => { st.habits[k] = { ...(st.habits[k] || {}), [id]: !h[id] }; return st; }); claimQuests(); checkAchievements(); route(); };
      return b;
    })));
}

// ---------- Games library ----------
function games() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const main = el('div', { class: 'main-col' }, el('h1', {}, t('lib.title')), el('p', { class: 'muted' }, t('lib.lead')));
  const sk = S.smoothedSkills(s.results), gridEl = el('div', { class: 'lib' });
  for (const g of [...GAMES, checkup]) {
    const isUnlocked = g === checkup || unlocked(s, g.id), d = diffOf(s, g.id);
    const lvlN = DIFF[g.id] ? (d.mode === 'manual' && d.level ? d.level : levelNumber(g.id, autoValue(s, g.id))) : null;
    gridEl.append(el('div', { class: 'lib-card' + (isUnlocked ? '' : ' locked'), 'data-game': g.id, style: { '--game': gameColor(g) } },
      el('div', { class: 'lib-top' }, el('div', { class: 'gtile', html: icon(isUnlocked ? g.icon : 'lock', 30) }), sk[g.id] != null ? el('div', { class: 'lib-skill' }, el('b', {}, sk[g.id]), el('span', {}, t('lib.skill'))) : null),
      el('h3', {}, gName(g)), el('div', { class: 'chip' }, domName(g.id)),
      el('p', { class: 'small' }, gTag(g)),
      lvlN != null ? el('div', { class: 'lib-lvl' }, el('div', { class: 'small' }, el('b', {}, t('lvl.of', { n: lvlN, max: DIFF[g.id].max })), el('span', { class: 'mode-tag ' + d.mode }, t('lvl.' + d.mode))), el('div', { class: 'lvl-track' }, el('i', { style: { width: `${levelFraction(g.id, lvlN) * 100}%` } }))) : el('div', { class: 'lib-meta small muted' }, g === checkup ? t('lib.monthly') : ''),
      el('div', { class: 'lib-actions' },
        isUnlocked ? el('button', { class: 'btn primary', onclick: () => play([g], { checkup: g === checkup }) }, t('btn.play')) : el('span', { class: 'small muted' }, t('lib.unlocks', { n: UNLOCK[g.id] })),
        GAME_SCIENCE[g.id] ? el('a', { class: 'btn ghost', href: `#science-${g.id}` }, t('btn.science')) : null)));
  }
  main.append(gridEl);
  v.append(el('div', { class: 'two-col' }, main, rail()));
}

// ---------- Brain ----------
function radar(scores) {
  const keys = Object.keys(S.DOMAINS), n = keys.length, R = 110, cx = 150, cy = 140;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const ring = (v) => keys.map((_, i) => pt(i, v).join(',')).join(' ');
  return svg('svg', { viewBox: '0 0 300 290', class: 'radar', role: 'img', 'aria-label': t('brain.profile') },
    ...[0.25, 0.5, 0.75, 1].map(v => svg('polygon', { points: ring(v), fill: 'none', stroke: 'var(--track)', 'stroke-width': 1.5 })),
    ...keys.map((_, i) => svg('line', { x1: cx, y1: cy, x2: pt(i, 1)[0], y2: pt(i, 1)[1], stroke: 'var(--track)' })),
    svg('polygon', { points: keys.map((k, i) => pt(i, (scores[k] || 0) / 1000).join(',')).join(' '), fill: 'color-mix(in srgb, var(--accent) 30%, transparent)', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    ...keys.map((k, i) => { const [x, y] = pt(i, 1.2); const tx = svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'radar-l' }); tx.textContent = t('dom.' + k); return tx; }));
}
function lineChart(pts, { w = 560, h = 160 } = {}) {
  if (pts.length < 2) return el('p', { class: 'muted small' }, t('brain.trend'));
  const ys = pts.map(p => p.value), lo = Math.max(0, Math.min(...ys) - 40), hi = Math.min(1000, Math.max(...ys) + 40);
  const X = (i) => 30 + (i / (pts.length - 1)) * (w - 40), Y = (v) => h - 22 - ((v - lo) / (hi - lo || 1)) * (h - 40);
  const d = ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const tick = (v) => { const tx = svg('text', { x: 2, y: Y(v) + 4, class: 'axis' }); tx.textContent = Math.round(v); return tx; };
  return svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'line-chart', role: 'img', 'aria-label': `${t('brain.index')}: ${ys[0]} → ${ys[ys.length - 1]}` },
    svg('line', { x1: 30, x2: w - 10, y1: Y(lo), y2: Y(lo), stroke: 'var(--track)' }), svg('line', { x1: 30, x2: w - 10, y1: Y(hi), y2: Y(hi), stroke: 'var(--track)', 'stroke-dasharray': '3 4' }), tick(lo), tick(hi),
    svg('path', { d: `${d}L${X(ys.length - 1)},${h - 22}L${X(0)},${h - 22}Z`, fill: 'color-mix(in srgb, var(--accent) 16%, transparent)' }),
    svg('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    svg('circle', { cx: X(ys.length - 1), cy: Y(ys[ys.length - 1]), r: 5, fill: 'var(--accent)' }));
}
function brain() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const bi = S.brainIndex(s.results), ds = S.domainScores(s.results), hist = S.indexHistory(s.results, C.dayKey), sk = S.smoothedSkills(s.results);
  const delta = bi != null && hist[0] ? bi - hist[0].value : 0;
  const main = el('div', { class: 'main-col' }, el('h1', {}, t('brain.title')),
    el('section', { class: 'card bi-card' },
      el('div', { class: 'bi' }, el('div', { class: 'bi-num' }, bi ?? '–'), el('div', {}, el('div', { class: 'bi-label' }, t('brain.index')), el('div', { class: 'small ' + (delta > 0 ? 'up' : 'muted') }, bi == null ? t('brain.empty') : delta > 0 ? t('brain.since', { n: delta }) : t('brain.start')))),
      el('p', { class: 'small muted' }, t('brain.explain')), lineChart(hist)),
    el('section', { class: 'card' }, el('h2', {}, t('brain.profile')), el('div', { class: 'radar-wrap' }, radar(ds),
      el('div', { class: 'dom-list' }, Object.entries(S.DOMAINS).map(([k, d]) => el('div', { class: 'dom' }, el('span', { class: 'dot', style: { background: d.color } }), el('span', { class: 'grow' }, t('dom.' + k)), el('b', {}, ds[k] ?? '–')))))),
    el('section', { class: 'card' }, el('h2', {}, t('brain.skills')), el('div', { class: 'skill-list' }, SKILL_GAMES.map(g => {
      const val = sk[g.id], n = s.results.filter(r => r.game === g.id && !r.review && r.skill != null).length;
      return el('div', { class: 'skill-row' }, gtile(g, 18, 'sm'), el('div', { class: 'grow' }, el('div', {}, el('b', {}, gName(g)), el('span', { class: 'muted small' }, ' · ' + t('brain.sessions', { n }))), el('div', { class: 'small muted' }, levelBadge(g)), el('div', { class: 'bar' }, el('i', { style: { width: `${(val || 0) / 10}%`, background: gameColor(g) } }))), el('b', { class: 'skill-val' }, val ?? '–'));
    }))),
    el('section', { class: 'card' }, el('h2', {}, t('brain.checkup')),
      s.checkups.length ? el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('tr', {}, el('th', {}, t('brain.date')), el('th', {}, t('brain.reaction')), el('th', {}, t('brain.digits')), el('th', {}, t('brain.stroop'))), s.checkups.map(c => el('tr', {}, el('td', {}, fmtDate(c.t)), el('td', {}, `${c.m.choiceRT} ms`), el('td', {}, c.m.backwardDigitSpan), el('td', {}, `${c.m.stroopCost} ms`))))) : el('p', { class: 'muted small' }, t('brain.noCheckup')),
      el('button', { class: 'btn', onclick: () => play([checkup], { checkup: true }) }, t('brain.takeCheckup'))));
  v.append(el('div', { class: 'two-col' }, main, rail()));
}

// ---------- League ----------
function league() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const tbl = G.leagueTable(s.league.week, s.league.tier, weekXp(s)), left = G.startOfWeek(Date.now()) + 7 * C.DAY - Date.now();
  const me = profiles.current();
  const main = el('div', { class: 'main-col' },
    el('div', { class: 'league-head' }, el('div', { class: 'tier-row' }, tl('tiers').map((n, i) => el('div', { class: `tier-badge t${i}` + (i === s.league.tier ? ' me' : i > s.league.tier ? ' dim' : ''), title: n, html: icon('shield', i === s.league.tier ? 44 : 28) }))),
      el('h1', {}, t('league.title', { tier: tierName(s.league.tier) })), el('p', { class: 'muted' }, t('league.meta', { d: Math.floor(left / C.DAY), h: Math.floor((left % C.DAY) / 3600e3) }))),
    el('ol', { class: 'league' }, tbl.map(r => el('li', { class: `lrow ${r.zone}` + (r.bot ? '' : ' me') }, el('span', { class: 'rank' }, r.rank),
      el('span', { class: 'avatar', html: r.bot ? icon('brain', 20) : mascot('happy', 30) }), el('span', { class: 'grow' }, r.bot ? r.name : (me?.guest ? t('league.you') : me?.name || t('league.you')), r.bot ? el('span', { class: 'bot-tag' }, t('league.rival')) : null), el('b', {}, `${r.xp} XP`)))),
    el('p', { class: 'small muted' }, t('league.note')));
  v.append(el('div', { class: 'two-col' }, main, rail()));
}

// ---------- Profile ----------
function accountCard() {
  const me = profiles.current();
  if (me.guest) return el('section', { class: 'card account guest' }, el('div', { class: 'acc-h' }, el('span', { class: 'who-av', style: { background: me.color } }, 'G'), el('div', {}, el('h2', {}, t('acc.guestCard')), el('p', { class: 'small muted' }, t('acc.guestHelp')))),
    accountForm({ upgrade: true, onDone: () => { toast(t('acc.saveProgress') + ' ✓'); route(); } }),
    el('div', { class: 'row gap' }, el('button', { class: 'btn ghost', onclick: () => { profiles.signOut(); boot(); } }, t('acc.switch'))));
  const codeBox = el('div', { class: 'backup hidden' }, el('p', { class: 'small muted' }, t('acc.backupHelp')), el('textarea', { class: 'inp code', rows: 3, readonly: true, id: 'backup-code' }),
    el('button', { class: 'btn sm', onclick: async () => { const ta = $('#backup-code'); try { await navigator.clipboard.writeText(ta.value); toast(t('acc.copied')); } catch { ta.select(); toast(t('acc.copyBlocked')); } } }, t('acc.copy')));
  return el('section', { class: 'card account' },
    el('div', { class: 'acc-h' }, el('span', { class: 'who-av', style: { background: me.color } }, (me.name[0] || '?').toUpperCase()), el('div', { class: 'grow' }, el('h2', {}, me.name), el('p', { class: 'small muted' }, `${t('acc.local')}${me.pin ? ' · PIN' : ''}`))),
    el('div', { class: 'row gap' },
      el('button', { class: 'btn sm', onclick: () => { codeBox.classList.toggle('hidden'); $('#backup-code').value = profiles.backupCode(); } }, t('acc.backup')),
      el('button', { class: 'btn sm', onclick: () => { profiles.signOut(); boot(); } }, t('acc.switch')),
      el('button', { class: 'btn sm danger', onclick: async () => { if (await askConfirm(t('acc.deleteConfirm', { name: me.name }), { yes: t('acc.delete'), danger: true })) { profiles.remove(me.id); boot(); } } }, t('acc.delete'))),
    codeBox);
}
function profile() {
  const s = store.get(), v = view(); v.innerHTML = '';
  const lp = G.levelProgress(s.xp), st = streakOf(s), me = profiles.current();
  const minutes = Math.round(s.results.reduce((a, r) => a + (ALL[r.game]?.minutes || 3), 0));
  const tile = (ic, val, lab) => el('div', { class: 'ptile' }, H(icon(ic, 22)), el('b', {}, val), el('span', {}, lab));
  const toggle = (key, label) => { const cb = el('input', { type: 'checkbox', checked: !!s.settings[key], id: 'set-' + key }); cb.onchange = () => store.set(x => { x.settings[key] = cb.checked; return x; }); return el('label', { class: 'row' }, cb, label); };
  const ageSel = el('select', { class: 'inp', id: 'set-age' }, el('option', { value: '' }, t('prof.preferNot')), S.AGE_BANDS.map(a => el('option', { value: a, selected: s.profile.age === a }, a)));
  ageSel.onchange = () => store.set(x => { x.profile.age = ageSel.value; return x; });
  const goals = el('div', { class: 'goal-opts' }, G.DAILY_GOALS.map((g, i) => { const k = ['light', 'regular', 'focused', 'intense'][i]; const b = el('button', { class: 'goal-opt' + (s.profile.goal === g.xp ? ' on' : '') }, el('b', {}, t('goal.' + k)), el('span', {}, `${g.xp} XP · ${t('goal.d' + g.xp)}`)); b.onclick = () => { store.set(x => { x.profile.goal = g.xp; return x; }); route(); }; return b; }));
  const loci = el('textarea', { rows: 6, class: 'inp', id: 'set-loci', 'aria-label': t('prof.palace') }, (s.palace.loci || defaultLoci()).join('\n'));
  const file = el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  file.onchange = async () => { try { store.import(await file.files[0].text()); toast(t('prof.imported')); route(); } catch { toast(t('prof.badFile')); } };
  const buy = (cost, fn) => { if (store.get().gems < cost) return toast(t('prof.needGems', { n: cost })); store.set(x => { x.gems -= cost; fn(x); return x; }); chime(s.settings, 'gem'); applyTheme(); route(); };
  const scheme = el('select', { class: 'inp', id: 'set-scheme' }, ['auto', 'light', 'dark'].map(o => el('option', { value: o, selected: s.settings.colorScheme === o }, t('prof.' + o))));
  scheme.onchange = () => { store.set(x => { x.settings.colorScheme = scheme.value; return x; }); applyTheme(); };
  const main = el('div', { class: 'main-col' },
    el('section', { class: 'profile-head' }, H(mascot('cheer', 96)), el('div', {}, el('h1', {}, me.guest ? t('acc.guest') : me.name || t('prof.athlete')), el('div', { class: 'muted' }, t('prof.meta', { n: lp.level, date: fmtDate(s.created) })),
      el('div', { class: 'lvl-bar' }, el('i', { style: { width: `${lp.pct * 100}%` } })), el('div', { class: 'small muted' }, t('prof.toNext', { a: lp.into, b: lp.span, n: lp.level + 1 })))),
    accountCard(),
    el('div', { class: 'ptiles' }, tile('flame', st, t('prof.streak')), tile('bolt', s.xp, t('prof.xp')), tile('trophy', tierName(s.league.tier), t('prof.league')), tile('check', s.workouts, t('prof.workouts')), tile('brain', `${minutes} min`, t('prof.trained')), tile('gem', s.gems, t('prof.gems'))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.achievements')), el('div', { class: 'badges' }, G.ACHIEVEMENTS.map(a => { const [n, d] = achText(a.id); return el('div', { class: 'badge' + (s.achievements[a.id] ? ' got' : ''), title: d }, H(icon(s.achievements[a.id] ? 'star' : 'lock', 26)), el('b', {}, n), el('span', {}, d)); }))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.shop')), el('div', { class: 'shop' },
      el('div', { class: 'shop-item' }, H(icon('flame', 30)), el('div', { class: 'grow' }, el('b', {}, t('prof.freeze')), el('div', { class: 'small muted' }, t('prof.freezeHelp', { n: s.freezes }))), el('button', { class: 'btn sm', disabled: s.freezes >= 3, 'data-buy': 'freeze', onclick: () => buy(100, x => x.freezes++) }, H(`${icon('gem', 14)} 100`))),
      Object.entries(THEMES).map(([k, c]) => el('div', { class: 'shop-item' }, el('span', { class: 'swatch-dot', style: { background: c } }), el('div', { class: 'grow' }, el('b', {}, t('prof.theme', { name: k[0].toUpperCase() + k.slice(1) }))),
        s.owned.includes(k) ? el('button', { class: 'btn sm' + (s.settings.theme === k ? ' primary' : ''), onclick: () => { store.set(x => { x.settings.theme = k; return x; }); applyTheme(); route(); } }, s.settings.theme === k ? t('btn.active') : t('btn.use')) : el('button', { class: 'btn sm', 'data-buy': k, onclick: () => buy(150, x => { x.owned.push(k); x.settings.theme = k; }) }, H(`${icon('gem', 14)} 150`)))))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.goal')), goals),
    el('section', { class: 'card' }, el('h2', {}, t('prof.settings')), el('div', { class: 'form' }, el('label', {}, t('prof.language'), langSelect()), el('label', {}, t('prof.ageBand'), ageSel), el('label', {}, t('prof.appearance'), scheme)),
      toggle('sound', t('prof.sounds')), toggle('speech', t('prof.speech')), toggle('reduceMotion', t('prof.motion'))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.reminders')), el('p', { class: 'small muted' }, t('prof.remindersHelp')),
      el('div', { class: 'row gap' }, el('input', { type: 'time', class: 'inp time', value: '19:00', id: 'rtime' }), el('button', { class: 'btn', onclick: () => downloadIcs($('#rtime').value) }, H(`${icon('calendar', 18)} ${t('prof.addCal')}`)))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.palace')), el('p', { class: 'small muted' }, t('prof.palaceHelp')), loci,
      el('button', { class: 'btn', onclick: () => { const L = loci.value.split('\n').map(x => x.trim()).filter(Boolean); if (L.length < 4) return toast(t('prof.routeMin')); store.set(x => { x.palace.loci = L.slice(0, 30); return x; }); toast(t('prof.routeSaved')); } }, t('prof.saveRoute'))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.data')), el('p', { class: 'small muted' }, t('prof.dataHelp')),
      el('div', { class: 'row gap' }, el('button', { class: 'btn', onclick: exportData }, t('prof.export')),
        el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(store.export()); toast(t('toast.copied')); } catch { toast(t('toast.copyBlocked')); } } }, t('prof.copyBackup')),
        el('button', { class: 'btn', onclick: () => file.click() }, t('prof.import')), file,
        el('button', { class: 'btn danger', onclick: async () => { if (await askConfirm(t('prof.resetConfirm'), { yes: t('prof.reset'), danger: true })) { store.reset(); store.set(x => { x.profile.onboarded = true; x.profile.name = me.name; return x; }); route(); } } }, t('prof.reset')))),
    el('section', { class: 'card' }, el('h2', {}, t('prof.install')), el('p', { class: 'small', html: t('prof.installText') })),
    el('p', { class: 'small muted center' }, el('a', { href: '#science' }, t('btn.science')), ' · ', el('a', { href: 'privacy.html' }, t('legal.privacy')), ' · ', el('a', { href: 'terms.html' }, t('legal.terms')), el('br'), t('prof.disclaimer', { brand: BRAND })));
  v.append(el('div', { class: 'two-col' }, main, rail()));
}
function exportData() { const a = el('a', { href: URL.createObjectURL(new Blob([store.export()], { type: 'application/json' })), download: `mentaro-${today()}.json` }); document.body.append(a); a.click(); a.remove(); }
function downloadIcs(time = '19:00') {
  const [hh, mm] = time.split(':'); const d = new Date(); d.setHours(+hh, +mm, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0'), stamp = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mentaro//Reminder//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@mentaro`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(d)}`, 'DURATION:PT15M', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', `SUMMARY:${BRAND}`, `DESCRIPTION:${location.origin}${location.pathname}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${BRAND}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = el('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'mentaro-reminder.ics' }); document.body.append(a); a.click(); a.remove();
}

// ---------- Science ----------
function science(focus) {
  const v = view(); v.innerHTML = '';
  const main = el('div', { class: 'main-col' }, el('h1', {}, t('sci.title')), el('p', { class: 'muted' }, t('sci.lead', { brand: BRAND })),
    lang() !== 'en' ? el('p', { class: 'small chip' }, t('sci.englishOnly')) : null,
    el('section', { class: 'card' }, el('h2', {}, t('sci.evidence')), FINDINGS.map(([a, b]) => el('div', { class: 'finding' }, el('b', {}, a), el('p', { class: 'small' }, b)))));
  for (const g of GAMES) {
    const sc = GAME_SCIENCE[g.id];
    main.append(el('details', { class: 'card sci', id: `sci-${g.id}`, open: focus === g.id },
      el('summary', {}, gtile(g, 20, 'sm'), el('b', {}, gName(g)), el('span', { class: 'ev ev-' + EVIDENCE[g.id] }, t('ev.' + EVIDENCE[g.id]))),
      el('p', { class: 'small' }, t(`g.${g.id}.why`)),
      el('dl', {}, ...[[t('sci.method'), sc.method], [t('sci.researchers'), sc.researchers], [t('sci.papers'), sc.paper], [t('sci.how'), sc.how], [t('sci.why'), sc.why], [t('sci.brain'), sc.brain], [t('sci.score'), sc.score], [t('intro.evidence'), sc.evidence[1]], [t('sci.improves', { brand: BRAND }), sc.improved]].flatMap(([a, b]) => [el('dt', {}, a), el('dd', {}, b)]))));
  }
  main.append(el('section', { class: 'card' }, el('h2', {}, t('sci.refs')), el('ol', { class: 'refs small' }, REFERENCES.map(r => el('li', {}, r)))), el('p', { class: 'small muted' }, t('sci.disclaimer', { brand: BRAND })));
  v.append(el('div', { class: 'two-col' }, main, rail()));
  if (focus) setTimeout(() => document.getElementById(`sci-${focus}`)?.scrollIntoView({ block: 'start' }), 0);
}

// ---------- Onboarding ----------
function onboarding() {
  const v = view(); v.innerHTML = '';
  document.body.classList.add('onboarding');
  const data = { focus: [], age: '', goal: 50 };
  const steps = [
    () => [el('div', { class: 'row end' }, langSelect()), H(mascot('cheer', 140)), el('h1', {}, t('onb.hi')), el('p', { class: 'lead' }, t('onb.lead', { brand: BRAND }))],
    () => [H(mascot('think', 96)), el('h2', {}, t('onb.focus')), el('p', { class: 'muted' }, t('onb.focusHelp')),
      el('div', { class: 'choice-grid' }, Object.entries(S.DOMAINS).map(([k, d]) => { const b = el('button', { class: 'choice', 'data-focus': k, style: { '--c': d.color } }, H(icon(d.icon, 26)), el('span', {}, t('dom.' + k))); b.onclick = () => { b.classList.toggle('on'); data.focus = b.classList.contains('on') ? [...data.focus, k] : data.focus.filter(x => x !== k); }; return b; }))],
    () => [H(mascot('happy', 96)), el('h2', {}, t('onb.age')), el('p', { class: 'muted' }, t('onb.ageHelp')),
      el('div', { class: 'choice-grid' }, [...S.AGE_BANDS, 'skip'].map(a => { const b = el('button', { class: 'choice pill', 'data-age': a }, a === 'skip' ? t('onb.skip') : a); b.onclick = () => { $('.choice.on', v)?.classList.remove('on'); b.classList.add('on'); data.age = a === 'skip' ? '' : a; }; return b; }))],
    () => [H(mascot('wow', 96)), el('h2', {}, t('onb.goal')), el('p', { class: 'muted' }, t('onb.goalHelp')),
      el('div', { class: 'goal-opts' }, G.DAILY_GOALS.map((g, i) => { const k = ['light', 'regular', 'focused', 'intense'][i]; const b = el('button', { class: 'goal-opt' + (g.xp === 50 ? ' on' : '') }, el('b', {}, t('goal.' + k)), el('span', {}, `${g.xp} XP · ${t('goal.d' + g.xp)}`)); b.onclick = () => { $('.goal-opt.on', v)?.classList.remove('on'); b.classList.add('on'); data.goal = g.xp; }; return b; }))],
    () => [H(mascot('think', 96)), el('h2', {}, t('onb.promise')), el('ul', { class: 'promise' }, ['check', 'check', 'check', 'close', 'leaf'].map((ic, i) => el('li', {}, H(`${icon(ic, 18)} <span>${t('onb.p' + (i + 1))}</span>`))))],
  ];
  let i = 0;
  const render = () => {
    v.innerHTML = '';
    const next = el('button', { class: 'btn primary big', 'data-onb': 'next', onclick: () => { if (i < steps.length - 1) { i++; render(); } else finish(); } }, i === 0 ? t('onb.getStarted') : i === steps.length - 1 ? t('onb.startFirst') : t('btn.continue'));
    v.append(el('div', { class: 'onb' }, el('div', { class: 'onb-progress' }, el('i', { style: { width: `${(i / (steps.length - 1)) * 100}%` } })), el('div', { class: 'onb-body' }, ...steps[i]()), el('div', { class: 'onb-cta' }, i > 0 ? el('button', { class: 'btn ghost', onclick: () => { i--; render(); } }, t('btn.back')) : null, next)));
  };
  const finish = () => {
    store.set(s => { s.profile = { ...s.profile, ...data, onboarded: true }; s.settings.lang = lang(); for (const [k, val] of Object.entries(S.startingLevels(data.age || '30–44'))) s.levels[k] ??= val; return s; });
    document.body.classList.remove('onboarding');
    applyTheme(); unlockAudio();
    play(nextWorkout(store.get()), { node: true });
  };
  render();
}

// ---------- Playing ----------
function trimMetrics(m) { const o = {}; for (const [k, v] of Object.entries(m || {})) if (v == null || typeof v !== 'object') o[k] = v; return o; }
const scienceMeta = (g) => { const sc = GAME_SCIENCE[g.id]; const ev = EVIDENCE[g.id]; return sc ? { cite: sc.paper.split(' · ')[0], level: ev, grade: `${t('intro.evidence')}: ${t('ev.' + ev)}` } : (g === checkup ? { cite: 'Simons et al. (2016) Psychol Sci Public Interest 17:103', level: 'strong', grade: `${t('intro.evidence')}: ${t('ev.strong')}` } : null); };

export async function play(queue, opts = {}) {
  if (playing) return;
  playing = true; closePop();
  document.body.classList.add('playing');
  const root = $('#play'); root.hidden = false;
  const s0 = store.get();
  const before = { streak: streakOf(s0), level: G.levelFromXp(s0.xp), goalMet: todayXp(s0) >= (s0.profile.goal || 50) };
  const t0 = Date.now(); let done = 0, xpGained = 0; const accs = [];
  globalThis.__ngPace = S.comfortPace(s0.profile.age);
  for (let i = 0; i < queue.length; i++) {
    const g = queue[i], ac = new AbortController();
    const quit = async () => { if (await askConfirm(t('play.quitConfirm'), { yes: t('btn.quit'), no: t('btn.keepGoing'), danger: true })) ac.abort(); };
    const s = store.get();
    const ctx = { level: autoValue(s, g.id), fixed: false, settings: { ...s.settings, speechLang: speechLang() }, signal: ac.signal, rng: Math.random, quit, palace: s.palace, review: opts.review };
    const dd = diffOf(s, g.id);
    setCurrentGame({ id: g.id, icon: g.icon, color: gameColor(g), domainName: domName(g.id), ctx, autoValue: autoValue(s, g.id), mode: dd.mode, manualLevel: dd.level, science: scienceMeta(g),
      onDiff: ({ mode, level }) => store.set(x => { x.diff ||= {}; x.diff[g.id] = { mode, level }; return x; }) });
    let result;
    try { result = await g.run(root, ctx); }
    catch (e) { if (e instanceof Aborted || e?.name === 'AbortError' || ac.signal.aborted) break; console.error(e); toast(t('play.error', { msg: e.message })); break; }
    const before1 = levelNumber(g.id, ctx.fixed ? ctx.level : autoValue(s, g.id));
    const xp = save(g, result, opts, ctx);
    xpGained += xp; done++; if (Number.isFinite(result.accuracy)) accs.push(result.accuracy);
    const after1 = DIFF[g.id] && !ctx.fixed ? levelNumber(g.id, result.level) : before1;
    if (!(await resultScreen(root, g, result, xp, queue[i + 1], { before: before1, after: after1, fixed: ctx.fixed }))) break;
  }
  const completedAll = done === queue.length && done > 0;
  if (completedAll && (opts.node || opts.practice)) store.set(s => { if (opts.node) s.path.done++; s.workouts++; if (opts.bonus) { s.xp += opts.bonus; s.results[s.results.length - 1].xp += opts.bonus; } return s; });
  if (opts.bonus && completedAll) xpGained += opts.bonus;
  try { speechSynthesis?.cancel(); } catch { }
  globalThis.__ngPace = 1;
  if (done > 0) await celebrate(root, { before, xpGained, accs, minutes: Math.max(1, Math.round((Date.now() - t0) / 60000)), workout: queue.length > 1 });
  root.hidden = true; root.innerHTML = ''; delete root.dataset.game;
  document.body.classList.remove('playing');
  playing = false;
  route();
}

function save(g, r, opts, ctx) {
  let xp = 0;
  store.set(s => {
    const tm = Date.now();
    if (g.assessment) { s.checkups.push({ t: tm, m: r.metrics }); xp = 20; s.xp += xp; s.results.push({ game: 'checkup', t: tm, xp, accuracy: r.accuracy, review: true, m: {} }); return s; }
    const prev = s.levels[g.id];
    const res = { game: g.id, t: tm, score: r.score, accuracy: +(r.accuracy ?? 0).toFixed(3), level: r.level, review: !!opts.review, manual: !!ctx.fixed, m: trimMetrics(r.metrics) };
    res.skill = opts.review ? null : S.skillOf(g.id, res);
    const pb = res.skill != null && s.bests[g.id] != null && res.skill > s.bests[g.id];
    if (res.skill != null) s.bests[g.id] = Math.max(s.bests[g.id] ?? 0, res.skill);
    const leveledUp = !opts.review && !ctx.fixed && prev != null && (typeof r.level === 'number' ? r.level > prev : !!(r.level && prev && r.level.f + r.level.b > prev.f + prev.b));
    xp = G.xpForResult(res, { leveledUp, personalBest: pb });
    res.xp = xp; res.pb = pb;
    if (!opts.review && !ctx.fixed) s.levels[g.id] = r.level; // manual rounds never change the Auto level
    s.results.push(res); s.xp += xp;
    s.sessions.push({ t: tm }); if (s.sessions.length > 3000) s.sessions = s.sessions.slice(-3000);
    const pu = r.palaceUpdate;
    if (pu?.type === 'new') { s.palace.lists.push(pu.list); s.palace.lists = s.palace.lists.slice(-60); }
    if (pu?.type === 'review') { const L = s.palace.lists.find(l => l.id === pu.id); if (L) { L.card = pu.card; L.history.push({ t: tm, recall: pu.recall }); } }
    r._pb = pb;
    return s;
  });
  return xp;
}

function resultScreen(root, g, r, xp, next, lv) {
  return new Promise(res => {
    root.innerHTML = '';
    const sk = store.get().results.at(-1)?.skill;
    const cont = el('button', { class: 'btn primary big', onclick: () => res(true) }, next ? t('res.nextGame', { name: gName(next) }) : t('btn.finish'));
    root.style.setProperty('--game', gameColor(g));
    const lvChip = DIFF[g.id] && lv.before != null ? el('div', { class: 'lvl-change ' + (lv.after > lv.before ? 'up' : lv.after < lv.before ? 'down' : '') }, lv.fixed ? `${t('lvl.manual')} · ${t('lvl.of', { n: lv.before, max: DIFF[g.id].max })}` : lv.after !== lv.before ? (lv.after > lv.before ? '▲ ' : '▼ ') + t('diff.change', { a: lv.before, b: lv.after }) : t('lvl.of', { n: lv.after, max: DIFF[g.id].max })) : null;
    root.append(el('div', { class: 'intro result' },
      el('div', { class: 'res-head' }, el('div', { class: 'gtile big', html: icon(g.icon, 40) }), H(mascot(r.accuracy >= 0.8 ? 'cheer' : r.accuracy >= 0.5 ? 'happy' : 'think', 90))),
      el('h2', {}, r.accuracy >= 0.9 ? t('res.amazing') : r.accuracy >= 0.7 ? t('res.nice') : r.accuracy >= 0.5 ? t('res.good') : t('res.tough')),
      lvChip,
      el('div', { class: 'res-tiles' }, el('div', { class: 'rt xp' }, el('span', {}, t('res.xp')), el('b', {}, `+${xp}`)), el('div', { class: 'rt acc' }, el('span', {}, t('res.accuracy')), el('b', {}, `${Math.round((r.accuracy || 0) * 100)}%`)), sk != null ? el('div', { class: 'rt sk' }, el('span', {}, t('res.skill')), el('b', {}, sk)) : null),
      r._pb ? el('div', { class: 'pb-flag', html: `${icon('star', 18)} ${t('res.pb')}` }) : null,
      el('ul', { class: 'summary' }, r.summary.map(x => el('li', {}, x))),
      cont, next ? el('button', { class: 'btn ghost', onclick: () => res(false) }, t('btn.endHere')) : null));
    chime(store.get().settings, r.accuracy >= 0.7 ? 'win' : 'gem');
    cont.focus();
  });
}

async function celebrate(root, { before, xpGained, accs, minutes, workout }) {
  const s = store.get(), quests = claimQuests(), achievements = checkAchievements();
  const after = store.get(), streak = streakOf(after), level = G.levelFromXp(after.xp), goal = after.profile.goal || 50, tx = todayXp(after);
  const streakUp = streak > before.streak, levelUp = level > before.level, goalNow = tx >= goal && !before.goalMet;
  store.set(x => { x.bestStreak = Math.max(x.bestStreak || 0, streak); return x; });
  const wd = t('res.weekdays');
  const screens = [() => el('div', { class: 'celebrate' }, H(mascot('cheer', 150)), el('h1', {}, workout ? t('res.workout') : t('res.exercise')),
    el('div', { class: 'res-tiles' }, el('div', { class: 'rt xp' }, el('span', {}, t('res.total')), el('b', {}, `+${xpGained}`)), el('div', { class: 'rt acc' }, el('span', {}, t('res.accuracy')), el('b', {}, `${Math.round(C.mean(accs) * 100)}%`)), el('div', { class: 'rt sk' }, el('span', {}, t('res.time')), el('b', {}, `${minutes} min`))))];
  if (streakUp) screens.push(() => el('div', { class: 'celebrate' }, el('div', { class: 'big-flame', html: icon('flame', 120) }), el('div', { class: 'streak-num' }, streak), el('h1', {}, t('res.streak')),
    el('div', { class: 'week-dots' }, [...Array(7)].map((_, i) => { const d = Date.now() - (6 - i) * C.DAY; const on = activeDays(after).includes(C.dayKey(d)); return el('div', { class: 'wd' + (on ? ' on' : '') }, el('span', {}, [...wd][(new Date(d).getDay() + 6) % 7]), H(icon(on ? 'flame' : 'leaf', 18))); })),
    el('p', { class: 'muted' }, t('res.restNote'))));
  if (goalNow || levelUp || quests.length || achievements.length) screens.push(() => el('div', { class: 'celebrate' }, H(mascot('wow', 110)), el('h1', {}, levelUp ? t('res.level', { n: level }) : t('res.rewards')),
    el('div', { class: 'rewards' },
      goalNow ? el('div', { class: 'reward' }, H(icon('bolt', 22)), el('span', {}, t('res.goal', { n: goal }))) : null,
      levelUp ? el('div', { class: 'reward' }, H(icon('star', 22)), el('span', {}, t('res.playerLevel', { n: level }))) : null,
      ...quests.map(q => el('div', { class: 'reward' }, H(icon('check', 22)), el('span', { class: 'grow' }, t('res.quest', { text: questText(q) })), H(`${icon('gem', 16)} +${q.gems}`))),
      ...achievements.map(a => el('div', { class: 'reward' }, H(icon('trophy', 22)), el('span', { class: 'grow' }, t('res.ach', { name: achText(a.id)[0] })), H(`${icon('gem', 16)} +25`))))));
  for (let i = 0; i < screens.length; i++) {
    root.innerHTML = '';
    const btn = el('button', { class: 'btn primary big' }, i === screens.length - 1 ? t('btn.continue') : t('btn.next'));
    root.append(el('div', { class: 'intro' }, screens[i](), btn));
    confetti(); chime(s.settings, i === 0 ? 'win' : i === 1 && streakUp ? 'streak' : 'level');
    btn.focus();
    await new Promise(r => (btn.onclick = r));
  }
}

// ---------- Toast & modal ----------
function toast(msg) { const tt = el('div', { class: 'toast', role: 'status' }, msg); document.body.append(tt); setTimeout(() => tt.classList.add('show'), 10); setTimeout(() => { tt.classList.remove('show'); setTimeout(() => tt.remove(), 300); }, 2600); }
function modal(content, cta, onClose) {
  const close = () => { m.remove(); onClose?.(); };
  const m = el('div', { class: 'modal', role: 'dialog' }, el('div', { class: 'modal-card' }, content, el('button', { class: 'btn primary big', onclick: close }, cta)));
  document.body.append(m); m.querySelector('button').focus();
}

// ---------- Theme ----------
function applyTheme() {
  const s = store.get(), root = document.documentElement;
  root.style.setProperty('--accent', THEMES[s.settings.theme] || THEMES.violet);
  if (s.settings.colorScheme === 'auto') { if (root.dataset.mentaroTheme) { root.removeAttribute('data-theme'); delete root.dataset.mentaroTheme; } }
  else { root.setAttribute('data-theme', s.settings.colorScheme); root.dataset.mentaroTheme = '1'; }
  root.classList.toggle('reduce-motion', !!s.settings.reduceMotion);
}

// ---------- Router ----------
const ROUTES = { learn, games, brain, league, profile, science };
export function route() {
  if (playing) return;
  const bar = $('#statbar'); bar.innerHTML = '';
  if (!profiles.current()) return welcome();
  if (!store.get().profile.onboarded) return onboarding();
  document.body.classList.remove('onboarding');
  bar.append(statBar());
  const h = (location.hash || '#learn').slice(1).replace(/^\//, ''), parts = h.split(/[-/]/), name = parts[0] || 'learn', arg = parts.slice(1).join('-');
  (ROUTES[name] || learn)(arg);
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${ROUTES[name] ? name : 'learn'}`));
  if (!arg) window.scrollTo(0, 0);
}
async function boot() { await applyLang(); applyTheme(); housekeeping(); route(); }
window.addEventListener('hashchange', route);
document.querySelectorAll('nav.tabs a[data-ic]').forEach(a => { a.querySelector('i').innerHTML = icon(a.dataset.ic, 26); });
boot();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude|claudeusercontent/.test(location.hostname)) navigator.serviceWorker.register('./sw.js').catch(() => { });
window.__mentaro = { store, profiles, GAMES, play, ALL, setLang: changeLang };
