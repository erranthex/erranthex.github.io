// Name Match — face–name associative memory with mnemonic encoding.
// Basis: face-name mnemonic strategy training (Hampstead et al. 2008/2011; randomised fMRI trial
// Simon et al. 2018, Frontiers in Aging Neuroscience). Faces are procedurally drawn: no photos.
import { el, frame, intro, sleep, beep, waitResponse } from '../ui.js';
import { shuffle, clamp, mean, pick } from '../core.js';

export const NAMES = ['Ada', 'Amir', 'Bea', 'Bruno', 'Chen', 'Clara', 'Dario', 'Dina', 'Eli', 'Elena', 'Femi', 'Freya', 'Gus', 'Hana', 'Hugo', 'Ines', 'Ivan', 'Jade', 'Jonah', 'Kai', 'Kira', 'Leo', 'Lina', 'Malik', 'Maya', 'Nico', 'Nora', 'Omar', 'Olga', 'Paolo', 'Priya', 'Quinn', 'Rosa', 'Ravi', 'Sami', 'Sofia', 'Tariq', 'Tess', 'Umar', 'Uma', 'Vera', 'Victor', 'Wen', 'Willa', 'Xavi', 'Yara', 'Yusuf', 'Zane', 'Zoe', 'Mateo', 'Aiko', 'Bao', 'Lucia', 'Kofi', 'Greta', 'Ezra', 'Noor', 'Felix', 'Ivy', 'Rafael'];
const JOBS = ['baker', 'pilot', 'gardener', 'drummer', 'nurse', 'chef', 'painter', 'diver', 'teacher', 'cyclist', 'architect', 'beekeeper', 'violinist', 'farmer', 'astronomer', 'potter', 'surfer', 'librarian', 'carpenter', 'dancer'];
const SKIN = ['#f6d5b8', '#eabf98', '#d39b6f', '#b57a4e', '#8d5a36', '#5e3a22'];
const HAIR = ['#1f1a17', '#4a2f1f', '#7b4a26', '#c08a4a', '#e2c27a', '#a33a1f', '#9aa0a8', '#e9e6df', '#3c5bd1', '#c2428a'];
const SHIRT = ['#5b5bd6', '#e5484d', '#30a46c', '#f5a524', '#0091ff', '#8e4ec6', '#12a594', '#e93d82'];

// Face genome: each field is an index; drawn deterministically.
export function randomFace(rng) {
  return { skin: Math.floor(rng() * SKIN.length), hair: Math.floor(rng() * HAIR.length), style: Math.floor(rng() * 6), eyes: Math.floor(rng() * 3), brows: Math.floor(rng() * 3), glasses: rng() < 0.3 ? 1 + Math.floor(rng() * 2) : 0, beard: rng() < 0.25 ? 1 + Math.floor(rng() * 2) : 0, shirt: Math.floor(rng() * SHIRT.length), ear: rng() < 0.2 ? 1 : 0, freckles: rng() < 0.2 ? 1 : 0, hat: rng() < 0.12 ? 1 : 0, mouth: Math.floor(rng() * 3) };
}
export const faceKey = (g) => Object.values(g).join('.');

export function drawFace(g) {
  const s = SKIN[g.skin], h = HAIR[g.hair], sh = SHIRT[g.shirt];
  const hairBack = [
    '', `<path d="M22 58c-4-30 12-44 28-44s32 14 28 44c-4-6-6-14-6-20-10 4-34 4-44 0 0 6-2 14-6 20z" fill="${h}"/>`,
    `<path d="M20 76c-6-40 8-62 30-62s36 22 30 62c-4 0-6-2-8-6V44H28v26c-2 4-4 6-8 6z" fill="${h}"/>`,
    '', `<circle cx="50" cy="16" r="10" fill="${h}"/>`, `<path d="M18 70c-2-36 12-56 32-56s34 20 32 56l-8-4-2-20H28l-2 20z" fill="${h}"/>`,
  ][g.style];
  const hairFront = [
    `<path d="M26 38c2-16 14-24 24-24s22 8 24 24c-8-6-16-8-24-8s-16 2-24 8z" fill="${h}"/>`,
    `<path d="M26 40c0-18 12-26 24-26s24 8 24 26c-6-10-14-12-24-12-6 6-14 10-24 12z" fill="${h}"/>`,
    `<path d="M26 40c0-16 12-26 24-26s24 10 24 26c-10-8-38-8-48 0z" fill="${h}"/>`,
    `<path d="M30 30c4-10 12-14 20-14s16 4 20 14c-6-2-12-3-20-3s-14 1-20 3z" fill="${h}" opacity=".9"/>`,
    `<path d="M26 40c0-18 12-24 24-24s24 6 24 24c-4-6-12-10-24-10s-20 4-24 10z" fill="${h}"/>`,
    `<path d="M26 42c0-18 10-28 24-28s24 10 24 28c-6-4-8-10-10-14-8 6-20 10-38 14z" fill="${h}"/>`,
  ][g.style];
  const eye = ['<circle cx="40" cy="50" r="3"/><circle cx="60" cy="50" r="3"/>', '<ellipse cx="40" cy="50" rx="4" ry="2.6"/><ellipse cx="60" cy="50" rx="4" ry="2.6"/>', '<path d="M36 50q4-4 8 0M56 50q4-4 8 0" stroke="#222" stroke-width="2.4" fill="none"/>'][g.eyes];
  const brow = ['<path d="M35 43h10M55 43h10"/>', '<path d="M35 44l10-3M55 41l10 3"/>', '<path d="M35 42q5-3 10 0M55 42q5-3 10 0"/>'][g.brows];
  const mouth = ['<path d="M43 64q7 5 14 0" stroke="#7a3b2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>', '<path d="M44 64h12" stroke="#7a3b2e" stroke-width="2.5" stroke-linecap="round"/>', '<path d="M42 62q8 8 16 0z" fill="#7a3b2e"/>'][g.mouth];
  const glasses = g.glasses === 1 ? '<g fill="none" stroke="#222" stroke-width="2"><circle cx="40" cy="50" r="7"/><circle cx="60" cy="50" r="7"/><path d="M47 50h6"/></g>' : g.glasses === 2 ? '<g fill="#e5484d" fill-opacity=".25" stroke="#e5484d" stroke-width="2.4"><rect x="31" y="44" width="17" height="12" rx="3"/><rect x="52" y="44" width="17" height="12" rx="3"/><path d="M48 50h4"/></g>' : '';
  const beard = g.beard === 1 ? `<path d="M30 56c2 16 10 22 20 22s18-6 20-22c-4 6-8 8-10 8-4-4-16-4-20 0-2 0-6-2-10-8z" fill="${h}"/>` : g.beard === 2 ? `<path d="M40 60q10-5 20 0q-2 3-10 2q-8 1-10-2z" fill="${h}"/>` : '';
  const hat = g.hat ? `<path d="M22 34q28-22 56 0z" fill="${sh}"/><rect x="18" y="32" width="64" height="6" rx="3" fill="${sh}"/>` : '';
  const freckles = g.freckles ? '<g fill="#a0522d" opacity=".55"><circle cx="36" cy="58" r="1"/><circle cx="40" cy="60" r="1"/><circle cx="33" cy="61" r="1"/><circle cx="64" cy="58" r="1"/><circle cx="60" cy="60" r="1"/><circle cx="67" cy="61" r="1"/></g>' : '';
  const ear = g.ear ? '<circle cx="27" cy="60" r="2.5" fill="#f5c400"/><circle cx="73" cy="60" r="2.5" fill="#f5c400"/>' : '';
  return `<svg viewBox="0 0 100 100" class="face" role="img" aria-label="face">
    <rect width="100" height="100" rx="18" fill="var(--surface2)"/>
    ${hairBack}
    <path d="M14 100c2-16 16-24 36-24s34 8 36 24z" fill="${sh}"/>
    <rect x="44" y="68" width="12" height="12" fill="${s}"/>
    <ellipse cx="27" cy="54" rx="4" ry="6" fill="${s}"/><ellipse cx="73" cy="54" rx="4" ry="6" fill="${s}"/>
    <ellipse cx="50" cy="50" rx="23" ry="27" fill="${s}"/>
    ${hairFront}${hat}${freckles}${ear}
    <g fill="#222" stroke="#222" stroke-width="2.2" stroke-linecap="round">${eye}${brow}</g>
    <path d="M50 52v7h-3" stroke="#00000055" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${mouth}${beard}${glasses}
  </svg>`;
}

export default {
  id: 'names', name: 'Name Match', domain: 'Memory', icon: 'names', minutes: 4,
  tagline: 'Remember who is who: faces, names and a clue.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Name Match · face–name memory',
      how: `<p>Meet a few people. Each has a <b>name</b> and a <b>job</b>.</p>
            <p>Use the 3-step trick: ① pick a distinctive feature, ② turn the name into an image (Rosa → a rose), ③ link them (a rose tucked behind her glasses).</p>
            <p>After a short break, pick each person's name.</p>`,
      why: `Forgetting names is the most common everyday memory complaint. Face–name mnemonic training improved face–name memory in people with mild cognitive impairment and increased activity in memory-related temporal-lobe regions in a randomised fMRI trial (Simon et al., 2018; Hampstead et al., 2008–2011). It teaches an associative-binding strategy you can use at your next party.`,
    }, ctx.signal);
    const n = clamp(ctx.level || 4, 3, 12);
    const f = frame(root, 'Name Match', ctx.quit);
    const people = [], used = new Set();
    const names = shuffle(NAMES, ctx.rng).slice(0, n);
    for (let i = 0; i < n; i++) {
      let g; do { g = randomFace(ctx.rng); } while (used.has(faceKey(g))); used.add(faceKey(g));
      people.push({ face: g, name: names[i], job: pick(JOBS, ctx.rng) });
    }
    if (globalThis.__ngTest) globalThis.__ngTest.people = people;
    // Study
    for (let i = 0; i < n; i++) {
      f.progress(i / (2 * n)); f.stage.innerHTML = ''; f.controls.innerHTML = '';
      const p = people[i];
      const next = el('button', { class: 'btn primary big' }, i === n - 1 ? 'Done' : 'Next person');
      f.stage.append(el('div', { class: 'muted' }, `Person ${i + 1} of ${n}`), el('div', { class: 'face-wrap', html: drawFace(p.face) }), el('div', { class: 'nm-name', 'data-name': p.name }, p.name), el('div', { class: 'muted' }, `the ${p.job}`), el('p', { class: 'tip' }, 'Feature → name-image → link.'));
      f.controls.append(next); next.disabled = true;
      await sleep(1200, ctx.signal); next.disabled = false;
      await new Promise((res, rej) => { next.onclick = res; ctx.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true }); });
    }
    // Retention interval with an interfering task (count backwards).
    f.stage.innerHTML = ''; f.controls.innerHTML = '';
    const c = el('div', { class: 'problem' }, String(80 + Math.floor(ctx.rng() * 100)));
    f.stage.append(el('p', {}, 'Short break: count backwards by 7 in your head from'), c);
    for (let s = 12; s > 0; s--) { f.setStatus(`${s}s`); await sleep(1000, ctx.signal); }
    f.setStatus('');
    // Test: each face, choose among 4 names (all from the studied set when possible).
    const order = shuffle(people, ctx.rng); const res = [];
    for (let i = 0; i < order.length; i++) {
      f.progress(0.5 + i / (2 * n)); f.stage.innerHTML = ''; f.controls.innerHTML = '';
      const p = order[i];
      const lures = shuffle(people.filter(q => q !== p).map(q => q.name).concat(shuffle(NAMES.filter(x => !names.includes(x)), ctx.rng).slice(0, 2)), ctx.rng).slice(0, 3);
      const opts = shuffle([p.name, ...lures], ctx.rng);
      f.stage.append(el('div', { class: 'face-wrap', html: drawFace(p.face) }), el('div', { class: 'q' }, 'Who is this?'));
      const bs = opts.map(o => el('button', { class: 'btn resp nm-opt', 'data-name': o }, o));
      f.controls.append(el('div', { class: 'nm-opts' }, bs));
      if (globalThis.__ngTest) globalThis.__ngTest.current = p.name; // test hook only
      const r = await waitResponse({ buttons: bs.map((b, k) => [b, k]), keys: { 1: 0, 2: 1, 3: 2, 4: 3 }, signal: ctx.signal });
      const ok = opts[r.value] === p.name;
      bs[opts.indexOf(p.name)].classList.add('right'); if (!ok) bs[r.value].classList.add('wrong');
      beep(ctx.settings, ok); f.hit(ok); res.push(ok);
      await sleep(ok ? 500 : 1300, ctx.signal);
    }
    f.progress(1);
    const p = mean(res.map(Number));
    const next = p >= 0.9 ? Math.min(12, n + 1) : p < 0.6 ? Math.max(3, n - 1) : n;
    return { level: next, score: res.filter(Boolean).length, accuracy: p, summary: [`Recognised ${res.filter(Boolean).length}/${n} people`, `Next time: ${next} people`, 'Try it for real: use the trick on the next person you meet.'], metrics: { recall: p, n } };
  },
};
