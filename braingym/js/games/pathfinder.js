// Pathfinder — route learning in a landmark map, with map rotation at higher levels.
// Basis: spatial-navigation training preserved hippocampal volume in younger and older adults
// (Lövdén et al., Neurobiology of Aging 2012); hippocampal place/route memory (Maguire et al. 2000).
import { el, frame, intro, sleep, beep, waitResponse } from '../ui.js';
import { createStaircase, stepStaircase, shuffle, mean } from '../core.js';
import { icon } from '../icons.js';

const N = 6, TRIALS = 8;
const LANDMARKS = ['palace', 'trophy', 'leaf', 'star', 'gem', 'book', 'flame', 'shield'];

// Self-avoiding random walk of `len` steps on an N×N grid.
export function makeRoute(len, rng) {
  for (let tries = 0; tries < 500; tries++) {
    const start = [Math.floor(rng() * N), Math.floor(rng() * N)];
    const path = [start], seen = new Set([start.join()]);
    let ok = true;
    while (path.length <= len) {
      const [r, c] = path[path.length - 1];
      const nb = shuffle([[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]], rng).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen.has(`${a},${b}`));
      if (!nb.length) { ok = false; break; }
      path.push(nb[0]); seen.add(nb[0].join());
    }
    if (ok) return path;
  }
  throw new Error('route generation failed');
}
// Rotate a cell index by k quarter-turns clockwise.
export const rot = ([r, c], k) => { for (let i = 0; i < k; i++) [r, c] = [c, N - 1 - r]; return [r, c]; };
export const rotationFor = (len) => (len >= 9 ? 2 : len >= 6 ? 1 : 0); // quarter turns at harder levels

export default {
  id: 'path', name: 'Pathfinder', domain: 'Memory', icon: 'path', minutes: 3,
  tagline: 'Learn a route through town, then walk it from memory.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Pathfinder · spatial navigation',
      how: `<p>Watch the explorer walk a route through a town with landmarks.</p>
            <p>Then retrace it from the start, one step at a time, by tapping neighbouring squares.</p>
            <p>At higher levels the <b>map turns</b> before you walk, so use the landmarks, not the screen direction.</p>`,
      why: `Route learning relies on the hippocampus, the brain's map-maker. In a 4-month study, spatial-navigation training kept hippocampal volume stable in younger and older adults while untrained controls showed age-typical shrinkage (Lövdén et al., 2012). Rotating the map forces landmark-based (allocentric) navigation rather than memorising screen positions.`,
    }, ctx.signal);
    let st = createStaircase({ level: ctx.level || 4, min: 2, max: 14, down: 2, up: 1 });
    const f = frame(root, 'Pathfinder', ctx.quit);
    const res = [];
    for (let t = 0; t < TRIALS; t++) {
      f.progress(t / TRIALS);
      const len = st.level, route = makeRoute(len, ctx.rng), k = rotationFor(len);
      const marks = shuffle([...Array(N * N).keys()], ctx.rng).filter(i => !route.some(([r, c]) => r * N + c === i)).slice(0, 6);
      const lm = Object.fromEntries(marks.map((m, i) => [m, LANDMARKS[i % LANDMARKS.length]]));
      if (globalThis.__ngTest) globalThis.__ngTest.route = { route, k };
      const draw = (turn) => {
        f.stage.innerHTML = '';
        const map = el('div', { class: 'pf-map' + (turn ? ' turned' : '') });
        const cells = [];
        for (let i = 0; i < N * N; i++) {
          const src = rot([Math.floor(i / N), i % N], (4 - turn) % 4); // which original cell is drawn here
          const idx = src[0] * N + src[1];
          const cell = el('button', { class: 'pf-cell', 'data-r': src[0], 'data-c': src[1], html: lm[idx] ? icon(lm[idx], 22) : '' });
          if (lm[idx]) cell.classList.add('lm');
          cells.push(cell); map.append(cell);
        }
        f.stage.append(el('div', { class: 'big-label' }, `${len} steps${turn ? ` · map turned ${turn * 90}°` : ''}`), map);
        return cells;
      };
      const at = (cells, [r, c]) => cells.find(x => +x.dataset.r === r && +x.dataset.c === c);
      let cells = draw(0);
      at(cells, route[0]).classList.add('start');
      await sleep(900, ctx.signal);
      for (let i = 1; i < route.length; i++) { at(cells, route[i]).classList.add('trail'); at(cells, route[i]).classList.add('walker'); await sleep(450, ctx.signal); at(cells, route[i]).classList.remove('walker'); }
      await sleep(500, ctx.signal);
      cells = draw(k);
      at(cells, route[0]).classList.add('start', 'here');
      f.setStatus('Your turn');
      let pos = 0, ok = true;
      while (pos < route.length - 1) {
        const r = await waitResponse({ buttons: cells.map(b => [b, [+b.dataset.r, +b.dataset.c]]), signal: ctx.signal });
        const want = route[pos + 1], [cr, cc] = route[pos];
        const adj = Math.abs(r.value[0] - cr) + Math.abs(r.value[1] - cc) === 1;
        if (!adj) continue; // ignore taps that aren't a single step
        if (r.value[0] === want[0] && r.value[1] === want[1]) { at(cells, route[pos]).classList.remove('here'); pos++; at(cells, want).classList.add('trail', 'here'); }
        else { ok = false; at(cells, r.value).classList.add('bad'); break; }
      }
      if (!ok) route.forEach((p, i) => setTimeout(() => at(cells, p)?.classList.add('show'), i * 80));
      beep(ctx.settings, ok); f.hit(ok);
      res.push({ len, ok, rotated: k > 0 });
      st = stepStaircase(st, ok);
      f.setStatus('');
      await sleep(ok ? 600 : 1500, ctx.signal);
    }
    f.progress(1);
    const longest = Math.max(0, ...res.filter(r => r.ok).map(r => r.len));
    return { level: st.level, score: longest, accuracy: mean(res.map(r => +r.ok)), summary: [`Longest route: ${longest} steps`, `Routes walked: ${res.filter(r => r.ok).length}/${res.length}`, `Next start: ${st.level} steps`], metrics: { longest } };
  },
};
