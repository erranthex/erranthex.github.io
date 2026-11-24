// Word Forge — timed anagram word-building (verbal fluency / lexical retrieval).
// Basis: letter-fluency tasks (Lezak's FAS); word puzzles in the COG-IT trial (Devanand et al.,
// NEJM Evidence 2022) outperformed a brain-games program in mild cognitive impairment.
import { introFor, el, frame, intro, sleep, beep, now, T } from '../ui.js';
import { t, tl, lang } from '../i18n.js';
import { shuffle, clamp } from '../core.js';

let DICT = null, COMMON = null, LOADED = null;
export async function loadWords(code = lang()) {
  if (LOADED === code) return;
  const txt = await (await fetch(new URL(`../../data/words-${code}.txt`, import.meta.url))).text();
  setWords(txt.split('\n').map(w => w.trim()).filter(Boolean), code);
}
export function setWords(list, code = 'en') { DICT = new Set(list); COMMON = list.slice(0, 9000); LOADED = code; }

const counts = (w) => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
export function canMake(word, letters) {
  const have = counts(letters);
  for (const ch of word) { if (!have[ch]) return false; have[ch]--; }
  return true;
}
export const points = (w, zh = false) => (zh ? { 2: 2, 3: 4, 4: 7 }[[...w].length] : { 3: 1, 4: 2, 5: 4, 6: 6, 7: 9, 8: 12 }[w.length]) || 0;
export const levelSpec = (level) => ({ L: level <= 3 ? 6 : level <= 7 ? 7 : 8, seconds: 150 });

// Latin alphabets: a seed word of length L whose letters form at least `min` common words.
export function pickSeed(L, rng, min = 10) {
  const seeds = COMMON.filter(w => w.length === L && new Set(w).size >= L - 1);
  for (let tries = 0; tries < 400; tries++) {
    const s = seeds[Math.floor(rng() * seeds.length)];
    const answers = COMMON.filter(w => w.length >= 3 && w.length <= L && canMake(w, s));
    if (answers.length >= min) return { seed: s, answers };
  }
  const s = seeds[0]; return { seed: s, answers: COMMON.filter(w => w.length >= 3 && canMake(w, s)) };
}
// Chinese: a set of L characters drawn from common 2-character words, forming ≥ min words.
export function pickSeedZh(L, rng, min = 6) {
  const pairs = COMMON.slice(0, 3000).filter(w => w.length === 2);
  let best = null;
  for (let tries = 0; tries < 300; tries++) {
    const set = new Set();
    while (set.size < L) { const w = pairs[Math.floor(rng() * pairs.length)]; for (const ch of w) if (set.size < L) set.add(ch); }
    const seed = [...set].join('');
    const answers = COMMON.filter(w => w.length >= 2 && canMake(w, seed));
    if (!best || answers.length > best.answers.length) best = { seed, answers };
    if (answers.length >= min) return { seed, answers };
  }
  return best;
}

export default {
  id: 'word', name: 'Word Forge', domain: 'Language', icon: 'word', minutes: 3,
  tagline: 'Forge as many words as you can from a set of tiles.',
  async run(root, ctx) {
    await intro(root, introFor('word', { min: lang() === 'zh' ? 2 : 3, unit: t(lang() === 'zh' ? 'g.word.chars' : 'g.word.letters') }), ctx.signal);
    const zh = lang() === 'zh', minLen = zh ? 2 : 3;
    await loadWords();
    const level = ctx.level || 1;
    const { L, seconds } = levelSpec(level);
    const { seed, answers } = zh ? pickSeedZh(L, ctx.rng) : pickSeed(L, ctx.rng);
    if (globalThis.__ngTest) globalThis.__ngTest.word = { seed, answers };
    const f = frame(root, t('g.word.name'), ctx.quit);
    let letters = shuffle([...seed], ctx.rng);
    const found = new Set(); let pts = 0, picked = [], fullWord = false;
    const cur = el('div', { class: 'wf-current', 'aria-live': 'polite' });
    const msg = el('div', { class: 'wf-msg' });
    const tilesBox = el('div', { class: 'wf-tiles' });
    const list = el('div', { class: 'wf-found' });
    const score = el('div', { class: 'wf-score' });
    f.stage.append(score, cur, msg, tilesBox, list);
    const bShuffle = el('button', { class: 'btn' }, t('g.word.shuffle'));
    const bClear = el('button', { class: 'btn' }, t('g.word.clear'));
    const bEnter = el('button', { class: 'btn primary' }, t('g.word.enter'));
    f.controls.append(bShuffle, bClear, bEnter);
    const render = () => {
      tilesBox.innerHTML = '';
      letters.forEach((ch, i) => tilesBox.append(el('button', { class: 'wf-tile' + (picked.includes(i) ? ' used' : ''), 'data-i': i, 'aria-label': ch }, ch.toUpperCase())));
      cur.textContent = picked.map(i => letters[i]).join('').toUpperCase() || ' ';
      score.textContent = t('g.word.score', { p: pts, f: found.size, n: answers.length });
    };
    const say = (txt, cls) => { msg.textContent = txt; msg.className = 'wf-msg ' + (cls || ''); };
    const submit = () => {
      const w = picked.map(i => letters[i]).join('');
      picked = [];
      if ([...w].length < minLen) say(t('g.word.short'), 'bad');
      else if (found.has(w)) say(t('g.word.dup'), 'bad');
      else if (!DICT.has(w)) { say(t('g.word.notWord'), 'bad'); beep(ctx.settings, false); f.hit(false); }
      else {
        found.add(w); let p = points(w, zh);
        if (!zh && w.length === L) { p += 5; fullWord = true; say(t('g.word.all', { n: p }), 'good big'); } else say(`+${p}`, 'good');
        pts += p; beep(ctx.settings, true); f.hit(true);
        list.prepend(el('span', { class: 'wf-word' }, w));
      }
      render();
    };
    const typeLetter = (ch) => { const i = letters.findIndex((c, k) => c === ch && !picked.includes(k)); if (i >= 0) { picked.push(i); render(); } };
    tilesBox.addEventListener('pointerdown', (e) => { const b = e.target.closest('.wf-tile'); if (!b) return; e.preventDefault(); const i = +b.dataset.i; if (picked.includes(i)) { picked = picked.slice(0, picked.indexOf(i)); } else picked.push(i); render(); });
    bShuffle.onclick = () => { letters = shuffle(letters, ctx.rng); picked = []; render(); };
    bClear.onclick = () => { picked = []; render(); };
    bEnter.onclick = submit;
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Backspace') { picked.pop(); render(); }
      else if (e.key === ' ') { e.preventDefault(); bShuffle.onclick(); }
      else if (/^[a-z]$/i.test(e.key)) typeLetter(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    render();
    const start = now(), dur = T(seconds * 1000);
    try {
      while (now() - start < dur) { f.progress((now() - start) / dur); f.setStatus(`${Math.ceil((dur - (now() - start)) / 1000 / (globalThis.__ngSpeed || 1) / (globalThis.__ngPace || 1))} s`); await sleep(200, ctx.signal); }
    } finally { window.removeEventListener('keydown', onKey); }
    f.progress(1);
    const share = found.size / Math.max(1, answers.length);
    const next = ctx.fixed ? level : clamp(level + (share >= 0.35 ? 1 : share < 0.12 ? -1 : 0), 1, 10);
    const longest = [...found].sort((a, b) => b.length - a.length)[0] || '–';
    const missed = answers.filter(w => !found.has(w) && COMMON.indexOf(w) < 4000).sort((a, b) => b.length - a.length).slice(0, 6);
    return {
      level: next, score: pts, accuracy: clamp(share * 2, 0, 1),
      summary: [t('g.word.s1', { w: found.size, p: pts }), t('g.word.s2', { w: longest.toUpperCase() + (fullWord ? ' ★' : '') }), t('g.word.s3', { list: missed.join(', ') || '—' })],
      metrics: { points: pts, words: found.size, minutes: seconds / 60, share, seed },
    };
  },
};
