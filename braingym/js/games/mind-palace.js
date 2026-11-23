// Mind Palace — method of loci + retrieval practice + spaced repetition
// (Yates 1966; Bower 1970; Dresler et al., Neuron 2017; Roediger & Karpicke 2006; Cepeda et al. 2006).
import { el, frame, intro, sleep, beep, T } from '../ui.js';
import { shuffle, mean, newCard, reviewCard, recallToQuality, clamp } from '../core.js';

export const DEFAULT_LOCI = ['Front door', 'Doormat', 'Coat hook', 'Hallway mirror', 'Light switch', 'Kitchen sink', 'Fridge', 'Stove', 'Dining table', 'Window', 'Sofa', 'TV', 'Bookshelf', 'Stairs', 'Bathroom mirror', 'Bathtub', 'Bed', 'Wardrobe', 'Desk', 'Balcony'];

// High-imageability concrete nouns (imageable words benefit most from loci; Paivio 1971).
export const WORDS = ('anchor apple balloon banana barrel basket bell bicycle blanket bottle bucket butterfly cactus camel candle carrot castle cat chain cheese cherry clock cloud coconut compass crab crown cup diamond dolphin donkey drum duck eagle egg elephant envelope feather fence flag flute fork fox frog ghost giraffe glove goat guitar hammer harp helmet honey horse igloo jellyfish kettle key kite ladder lamp lemon lion lizard lobster magnet map mask mirror monkey moon mushroom needle nest octopus onion orange owl paddle panda parrot peach pencil penguin piano pillow pineapple pirate pizza pumpkin rabbit rainbow robot rocket rose saddle scissors shark sheep shoe skull snail snake spider spoon squirrel star sword teapot tiger tomato tractor trumpet turtle umbrella vase violin volcano wagon whale wheel witch wolf zebra').split(' ');

const PROMPTS = ['Make it huge.', 'Make it move or make a noise.', 'Add a smell or a taste.', 'Make it absurd or funny.', 'Have it interact with the spot: break it, cover it, set it on fire.', 'Picture yourself touching it.', 'Make it glow in a strange colour.'];

export function normalise(s) { return s.trim().toLowerCase().replace(/[^a-z]/g, ''); }
export function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Lenient on typos and plurals: one edit allowed for words of 5+ letters.
export function matches(guess, target) {
  const g = normalise(guess), t = normalise(target);
  if (!g) return false;
  if (g === t || g === t + 's' || g + 's' === t) return true;
  return t.length >= 5 && lev(g, t) <= 1;
}

export function newList(length, rng, recent = []) {
  const avoid = new Set(recent);
  const pool = WORDS.filter(w => !avoid.has(w));
  return shuffle(pool.length >= length ? pool : WORDS, rng).slice(0, length);
}

async function recallRound(f, ctx, loci, words, title) {
  const answers = [];
  for (let i = 0; i < words.length; i++) {
    f.progress(i / words.length);
    f.stage.innerHTML = ''; f.controls.innerHTML = '';
    const inp = el('input', { class: 'word-in', type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': `Word at ${loci[i]}` });
    const go = el('button', { class: 'btn primary' }, 'Next');
    const pass = el('button', { class: 'btn' }, "Don't know");
    f.stage.append(el('div', { class: 'muted' }, `${title} · ${i + 1}/${words.length}`), el('div', { class: 'locus' }, `📍 ${loci[i]}`), el('p', {}, 'Walk to this spot. What did you leave here?'), inp);
    f.controls.append(pass, go);
    inp.focus();
    const val = await new Promise((res, rej) => {
      const ab = () => rej(new DOMException('aborted', 'AbortError'));
      ctx.signal.addEventListener('abort', ab, { once: true });
      go.onclick = () => res(inp.value); pass.onclick = () => res('');
      inp.onkeydown = (e) => { if (e.key === 'Enter') res(inp.value); };
    });
    const ok = matches(val, words[i]);
    answers.push({ guess: val, word: words[i], ok });
    f.stage.append(el('div', { class: ok ? 'fb good' : 'fb bad' }, ok ? '✓ ' + words[i] : `✗ It was “${words[i]}”`));
    beep(ctx.settings, ok);
    await sleep(ok ? 500 : 1500, ctx.signal);
  }
  return answers;
}

export default {
  id: 'palace', name: 'Mind Palace', domain: 'Long-term memory', icon: '🏛️', minutes: 6,
  tagline: 'Store words along a familiar route, then recall them.',
  // ctx.palace: { loci:[...], lists:[{id, words, card, created, history}] }; ctx.review: list to review (optional)
  async run(root, ctx) {
    const loci = (ctx.palace?.loci?.length ? ctx.palace.loci : DEFAULT_LOCI);
    if (ctx.review) {
      const L = ctx.review;
      await intro(root, {
        title: 'Mind Palace · spaced review',
        how: `<p>You stored ${L.words.length} words in your palace ${Math.max(1, Math.round((Date.now() - L.created) / 86400000))} day(s) ago. Walk the route and recall each one.</p>`,
        why: `Recalling at expanding intervals, just as you're about to forget, is one of the most robust findings in learning science (spacing effect, Cepeda et al. 2006; testing effect, Roediger & Karpicke 2006). Each review strengthens the trace far more than re-reading would.`,
      }, ctx.signal);
      const f = frame(root, 'Mind Palace · review', ctx.quit);
      const ans = await recallRound(f, ctx, loci, L.words, 'Review');
      const p = mean(ans.map(a => +a.ok));
      const card = reviewCard(L.card, recallToQuality(p));
      f.progress(1);
      return {
        level: ctx.level, score: Math.round(p * 100), accuracy: p,
        summary: [`Recalled ${ans.filter(a => a.ok).length}/${ans.length}`, `Next review in ${card.interval} day(s)`],
        metrics: { review: L.id, recall: p }, palaceUpdate: { type: 'review', id: L.id, card, recall: p },
      };
    }

    const n = clamp(ctx.level || 6, 4, loci.length);
    await intro(root, {
      title: 'Mind Palace · method of loci',
      how: `<p>Your palace is a route through a place you know well (edit it in <b>Settings</b>). Here are the first ${n} spots: <i>${loci.slice(0, n).join(' → ')}</i>.</p>
            <p>You'll see ${n} words. For each, <b>picture the object at that spot</b> as a vivid, bizarre scene, then tap <b>Placed</b>.</p>
            <p>After a short break, walk the route and recall each word. It's saved for <b>spaced reviews</b> over the coming days.</p>`,
      why: `The method of loci is the technique memory champions use. In Dresler et al. (Neuron, 2017), novices who practised it for 6 weeks (30 min/day) roughly doubled their word-list recall, kept much of the gain 4 months later, and their brain connectivity shifted toward that of memory athletes. Unlike most brain games, this is a <i>strategy</i> you can use in real life: shopping lists, speeches, names.`,
    }, ctx.signal);

    const f = frame(root, 'Mind Palace', ctx.quit);
    const recent = (ctx.palace?.lists || []).slice(-5).flatMap(l => l.words);
    const words = newList(n, ctx.rng, recent);
    for (let i = 0; i < n; i++) {
      f.progress(i / (n * 2));
      f.stage.innerHTML = ''; f.controls.innerHTML = '';
      const placed = el('button', { class: 'btn primary big' }, 'Placed ✓');
      f.stage.append(el('div', { class: 'muted' }, `Spot ${i + 1}/${n}`), el('div', { class: 'locus' }, `📍 ${loci[i]}`), el('div', { class: 'word' }, words[i].toUpperCase()), el('p', { class: 'tip' }, `${PROMPTS[i % PROMPTS.length]}`));
      f.controls.append(placed);
      placed.disabled = true;
      await sleep(1500, ctx.signal); // minimum encoding time
      placed.disabled = false;
      await new Promise((res, rej) => { placed.onclick = res; ctx.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true }); setTimeout(res, T(20000)); });
    }
    // Brief filler task to clear working memory, so recall depends on the loci (long-term) trace.
    f.stage.innerHTML = ''; f.controls.innerHTML = '';
    const cnt = el('div', { class: 'problem' });
    f.stage.append(el('p', {}, 'Short break. Count backwards by 3 in your head from:'), cnt);
    let start = 100 + Math.floor(ctx.rng() * 100);
    for (let s = 15; s > 0; s--) { cnt.textContent = `${start}`; f.setStatus(`${s}s`); await sleep(1000, ctx.signal); }
    const ans = await recallRound(f, ctx, loci, words, 'Recall');
    const p = mean(ans.map(a => +a.ok));
    const nextLevel = p >= 0.9 ? Math.min(loci.length, n + 2) : p < 0.5 ? Math.max(4, n - 1) : n;
    f.progress(1);
    const id = 'L' + Date.now().toString(36);
    return {
      level: nextLevel, score: Math.round(p * n), accuracy: p,
      summary: [`Recalled ${ans.filter(a => a.ok).length}/${n}`, nextLevel > n ? `Next time: ${nextLevel} words` : `Next time: ${nextLevel} words`, 'First spaced review: tomorrow'],
      metrics: { recall: p, n, answers: ans },
      palaceUpdate: { type: 'new', list: { id, words, created: Date.now(), card: newCard(), history: [{ t: Date.now(), recall: p }] } },
    };
  },
};
