// Word Forge — timed anagram word-building (verbal fluency / lexical retrieval).
// Basis: letter-fluency tasks (Lezak's FAS); word puzzles in the COG-IT trial (Devanand et al.,
// NEJM Evidence 2022) outperformed a brain-games program in mild cognitive impairment.
import { el, frame, intro, sleep, beep, now, T } from '../ui.js';
import { shuffle, clamp } from '../core.js';

let DICT = null, COMMON = null;
export async function loadWords(url = new URL('../../data/words.txt', import.meta.url)) {
  if (DICT) return;
  const txt = await (await fetch(url)).text();
  const list = txt.split('\n').map(w => w.trim()).filter(Boolean);
  DICT = new Set(list);
  COMMON = list.slice(0, 9000);
}
export function setWords(list) { DICT = new Set(list); COMMON = list.slice(0, 9000); }

const counts = (w) => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
export function canMake(word, letters) {
  const have = counts(letters);
  for (const ch of word) { if (!have[ch]) return false; have[ch]--; }
  return true;
}
export const points = (w) => ({ 3: 1, 4: 2, 5: 4, 6: 6, 7: 9, 8: 12 })[w.length] || 0;

// Pick a seed word of length L whose letters form at least `min` common words.
export function pickSeed(L, rng, min = 10) {
  const seeds = COMMON.filter(w => w.length === L && new Set(w).size >= L - 1);
  for (let tries = 0; tries < 400; tries++) {
    const s = seeds[Math.floor(rng() * seeds.length)];
    const answers = COMMON.filter(w => w.length >= 3 && w.length <= L && canMake(w, s));
    if (answers.length >= min) return { seed: s, answers };
  }
  const s = seeds[0]; return { seed: s, answers: COMMON.filter(w => w.length >= 3 && canMake(w, s)) };
}
export const levelSpec = (level) => ({ L: level <= 3 ? 6 : level <= 7 ? 7 : 8, seconds: 150 });

export default {
  id: 'word', name: 'Word Forge', domain: 'Language', icon: 'word', minutes: 3,
  tagline: 'Forge as many words as you can from 6–8 letters.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Word Forge · verbal fluency',
      how: `<p>You get a set of letter tiles. Make as many <b>English words of 3+ letters</b> as you can, using each tile once per word.</p>
            <p>Longer words score more (3→1 · 4→2 · 5→4 · 6→6 · 7→9 · 8→12). Find the word that uses <b>every tile</b> for a bonus.</p>`,
      keys: 'Type letters · Enter = submit · Backspace · Space = shuffle',
      why: `Generating words from cues exercises lexical retrieval and executive search through memory, measured clinically by verbal-fluency tests. In a 78-week randomised trial in mild cognitive impairment (COG-IT, NEJM Evidence 2022), word puzzles beat a computerised brain-games program on cognition and daily function. Large surveys also link regular word-puzzle use with better cognition in later life (Brooker et al., 2019), though that link may partly reflect who enjoys puzzles.`,
    }, ctx.signal);
    await loadWords();
    const level = ctx.level || 1;
    const { L, seconds } = levelSpec(level);
    const { seed, answers } = pickSeed(L, ctx.rng);
    if (globalThis.__ngTest) globalThis.__ngTest.word = { seed, answers };
    const f = frame(root, 'Word Forge', ctx.quit);
    let letters = shuffle(seed.split(''), ctx.rng);
    const found = new Set(); let pts = 0, picked = [], fullWord = false;
    const cur = el('div', { class: 'wf-current', 'aria-live': 'polite' });
    const msg = el('div', { class: 'wf-msg' });
    const tilesBox = el('div', { class: 'wf-tiles' });
    const list = el('div', { class: 'wf-found' });
    const score = el('div', { class: 'wf-score' });
    f.stage.append(score, cur, msg, tilesBox, list);
    const bShuffle = el('button', { class: 'btn' }, 'Shuffle');
    const bClear = el('button', { class: 'btn' }, 'Clear');
    const bEnter = el('button', { class: 'btn primary' }, 'Enter');
    f.controls.append(bShuffle, bClear, bEnter);
    const render = () => {
      tilesBox.innerHTML = '';
      letters.forEach((ch, i) => tilesBox.append(el('button', { class: 'wf-tile' + (picked.includes(i) ? ' used' : ''), 'data-i': i, 'aria-label': ch }, ch.toUpperCase())));
      cur.textContent = picked.map(i => letters[i]).join('').toUpperCase() || ' ';
      score.textContent = `${pts} pts · ${found.size}/${answers.length} common words`;
    };
    const say = (t, cls) => { msg.textContent = t; msg.className = 'wf-msg ' + (cls || ''); };
    const submit = () => {
      const w = picked.map(i => letters[i]).join('');
      picked = [];
      if (w.length < 3) say('Too short', 'bad');
      else if (found.has(w)) say('Already found', 'bad');
      else if (!DICT.has(w)) { say('Not in word list', 'bad'); beep(ctx.settings, false); f.hit(false); }
      else {
        found.add(w); let p = points(w);
        if (w.length === L) { p += 5; fullWord = true; say(`All tiles! +${p}`, 'good big'); } else say(`+${p}`, 'good');
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
    const next = clamp(level + (share >= 0.35 ? 1 : share < 0.12 ? -1 : 0), 1, 10);
    const longest = [...found].sort((a, b) => b.length - a.length)[0] || '–';
    const missed = answers.filter(w => !found.has(w)).sort((a, b) => b.length - a.length).slice(0, 6);
    return {
      level: next, score: pts, accuracy: clamp(share * 2, 0, 1),
      summary: [`${found.size} words · ${pts} points`, `Longest: ${longest.toUpperCase()}${fullWord ? ' (all tiles!)' : ''}`, `You could also try: ${missed.join(', ') || '—'}`],
      metrics: { points: pts, words: found.size, minutes: seconds / 60, share, seed },
    };
  },
};
