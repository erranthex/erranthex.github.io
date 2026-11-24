// Mind Palace — method of loci + retrieval practice + spaced repetition
// (Dresler et al., Neuron 2017; Roediger & Karpicke 2006; Cepeda et al. 2006).
import { introFor, el, frame, intro, sleep, beep, T } from '../ui.js';
import { t, tl } from '../i18n.js';
import { shuffle, mean, newCard, reviewCard, recallToQuality, clamp } from '../core.js';

export const defaultLoci = () => tl('g.palace.loci');
export const DEFAULT_LOCI = defaultLoci(); // English fallback for callers that need a constant
// High-imageability concrete nouns (imageable words benefit most from loci; Paivio 1971), localised.
export const words = () => tl('g.palace.words');

// Accent- and case-insensitive; keeps letters of any script (so Chinese works too).
export function normalise(s) { return String(s).trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}]/gu, ''); }
export function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Lenient on typos and plurals: one edit allowed for words of 5+ letters.
export function matches(guess, target) {
  const g = normalise(guess), w = normalise(target);
  if (!g) return false;
  if (g === w || g === w + 's' || g + 's' === w || g === w + 'es') return true;
  return w.length >= 5 && lev(g, w) <= 1;
}
export function newList(length, rng, recent = [], pool = words()) {
  const avoid = new Set(recent);
  const fresh = pool.filter(w => !avoid.has(w));
  return shuffle(fresh.length >= length ? fresh : pool, rng).slice(0, length);
}

async function recallRound(f, ctx, loci, list, title) {
  const answers = [];
  for (let i = 0; i < list.length; i++) {
    f.progress(i / list.length);
    f.stage.innerHTML = ''; f.controls.innerHTML = '';
    const inp = el('input', { class: 'word-in', type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': loci[i] });
    const go = el('button', { class: 'btn primary' }, t('btn.next'));
    const pass = el('button', { class: 'btn' }, t('g.palace.dontKnow'));
    f.stage.append(el('div', { class: 'muted' }, `${title} · ${i + 1}/${list.length}`), el('div', { class: 'locus' }, `📍 ${loci[i]}`), el('p', {}, t('g.palace.ask')), inp);
    f.controls.append(pass, go);
    inp.focus();
    const val = await new Promise((res, rej) => {
      ctx.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true });
      go.onclick = () => res(inp.value); pass.onclick = () => res('');
      inp.onkeydown = (e) => { if (e.key === 'Enter') res(inp.value); };
    });
    const ok = matches(val, list[i]);
    answers.push({ guess: val, word: list[i], ok });
    f.stage.append(el('div', { class: ok ? 'fb good' : 'fb bad' }, ok ? '✓ ' + list[i] : '✗ ' + t('g.palace.it', { w: list[i] })));
    beep(ctx.settings, ok); f.hit(ok);
    await sleep(ok ? 500 : 1500, ctx.signal);
  }
  return answers;
}

export default {
  id: 'palace', name: 'Mind Palace', domain: 'Long-term memory', icon: 'palace', minutes: 6,
  tagline: 'Store words along a familiar route, then recall them.',
  async run(root, ctx) {
    const loci = ctx.palace?.loci?.length ? ctx.palace.loci : defaultLoci();
    if (ctx.review) {
      const L = ctx.review;
      await intro(root, { title: `${t('g.palace.name')} · ${t('g.palace.reviewSub')}`, how: t('g.palace.reviewHow', { n: L.words.length, d: Math.max(1, Math.round((Date.now() - L.created) / 86400000)) }), why: t('g.palace.reviewWhy') }, ctx.signal);
      const f = frame(root, t('g.palace.name'), ctx.quit);
      const ans = await recallRound(f, ctx, loci, L.words, t('g.palace.review'));
      const p = mean(ans.map(a => +a.ok));
      const card = reviewCard(L.card, recallToQuality(p));
      f.progress(1);
      return { level: ctx.level, score: Math.round(p * 100), accuracy: p, summary: [t('g.palace.s1', { a: ans.filter(a => a.ok).length, b: ans.length }), t('g.palace.s4', { n: card.interval })], metrics: { review: L.id, recall: p }, palaceUpdate: { type: 'review', id: L.id, card, recall: p } };
    }
    await intro(root, introFor('palace', { spots: loci.slice(0, 6).join(' → ') + ' …' }), ctx.signal);
    const n = clamp(ctx.level || 6, 4, loci.length); // read after the intro: the player may have chosen a level
    const f = frame(root, t('g.palace.name'), ctx.quit);
    const prompts = tl('g.palace.prompts');
    const recent = (ctx.palace?.lists || []).slice(-5).flatMap(l => l.words);
    const list = newList(n, ctx.rng, recent);
    for (let i = 0; i < n; i++) {
      f.progress(i / (n * 2));
      f.stage.innerHTML = ''; f.controls.innerHTML = '';
      const placed = el('button', { class: 'btn primary big' }, t('g.palace.placed'));
      f.stage.append(el('div', { class: 'muted' }, t('g.palace.spot', { i: i + 1, n })), el('div', { class: 'locus' }, `📍 ${loci[i]}`), el('div', { class: 'word' }, list[i].toUpperCase()), el('p', { class: 'tip' }, prompts[i % prompts.length]));
      f.controls.append(placed);
      placed.disabled = true;
      await sleep(1500, ctx.signal); // minimum encoding time
      placed.disabled = false;
      await new Promise((res, rej) => { placed.onclick = res; ctx.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true }); setTimeout(res, T(20000)); });
    }
    // Filler task clears working memory so recall depends on the loci (long-term) trace.
    f.stage.innerHTML = ''; f.controls.innerHTML = '';
    const cnt = el('div', { class: 'problem' }, String(100 + Math.floor(ctx.rng() * 100)));
    f.stage.append(el('p', {}, t('g.palace.break')), cnt);
    for (let s = 15; s > 0; s--) { f.setStatus(`${s}s`); await sleep(1000, ctx.signal); }
    f.setStatus('');
    const ans = await recallRound(f, ctx, loci, list, t('g.palace.recall'));
    const p = mean(ans.map(a => +a.ok));
    const nextLevel = ctx.fixed ? n : p >= 0.9 ? Math.min(loci.length, n + 2) : p < 0.5 ? Math.max(4, n - 1) : n;
    f.progress(1);
    const id = 'L' + Date.now().toString(36);
    return {
      level: nextLevel, score: Math.round(p * n), accuracy: p,
      summary: [t('g.palace.s1', { a: ans.filter(a => a.ok).length, b: n }), t('g.palace.s2', { n: nextLevel }), t('g.palace.s3')],
      metrics: { recall: p, n },
      palaceUpdate: { type: 'new', list: { id, words: list, created: Date.now(), card: newCard(), history: [{ t: Date.now(), recall: p }] } },
    };
  },
};
