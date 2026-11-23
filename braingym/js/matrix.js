// Procedural matrix-reasoning generator (pure, testable).
// Rules per attribute follow the RAVEN taxonomy (Zhang et al., CVPR 2019): constant,
// progression, distribute-three. Answer options use the I-RAVEN balanced tree (Hu et al.,
// AAAI 2021): 8 options built from all combinations of {correct, alternative} on three
// attributes, so every attribute value appears in exactly half of the options and the
// answer cannot be found by picking the "most common" features without solving the rules.

import { shuffle, pick } from './core.js';

export const ATTRS = { shape: 5, count: 3, color: 4, fill: 3 };
const NAMES = Object.keys(ATTRS);

// Difficulty 1..8 -> how many attributes vary and which rule types are allowed.
export function difficultySpec(level) {
  const varying = Math.min(4, 1 + Math.floor((level - 1) / 2));
  const rules = level <= 2 ? ['progression', 'constant'] : level <= 4 ? ['progression', 'distribute'] : ['distribute', 'progression', 'distribute'];
  return { varying, rules };
}

function rowValues(rule, size, rng, rowIdx, shared) {
  if (rule === 'constant') return [shared.c[rowIdx], shared.c[rowIdx], shared.c[rowIdx]];
  if (rule === 'progression') {
    const d = shared.d, start = shared.starts[rowIdx];
    return [start, start + d, start + 2 * d];
  }
  // distribute-three: same 3 values in each row, cyclically shifted (Latin square).
  const v = shared.vals, k = shared.shift * rowIdx;
  return [0, 1, 2].map(j => v[(j + k) % 3]);
}

function makeShared(rule, size, rng) {
  if (rule === 'constant') return { c: [0, 1, 2].map(() => Math.floor(rng() * size)) };
  if (rule === 'progression') {
    const d = rng() < 0.5 ? 1 : -1;
    const lo = d > 0 ? 0 : 2, hi = d > 0 ? size - 3 : size - 1; // start range so start+2d stays in [0,size)
    return { d, starts: [0, 1, 2].map(() => lo + Math.floor(rng() * (hi - lo + 1))) };
  }
  return { vals: shuffle([...Array(size).keys()], rng).slice(0, 3), shift: rng() < 0.5 ? 1 : 2 };
}

export function generateMatrix(level, rng = Math.random) {
  const { varying, rules } = difficultySpec(level);
  const varyAttrs = new Set(shuffle(NAMES, rng).slice(0, varying));
  const plan = {};
  for (const a of NAMES) {
    plan[a] = varyAttrs.has(a) ? pick(rules, rng) : 'fixed';
  }
  const grid = [[], [], []];
  for (const a of NAMES) {
    const size = ATTRS[a];
    if (plan[a] === 'fixed') { const v = Math.floor(rng() * size); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) (grid[r][c] ||= {})[a] = v; continue; }
    const shared = makeShared(plan[a], size, rng);
    for (let r = 0; r < 3; r++) { const vals = rowValues(plan[a], size, rng, r, shared); for (let c = 0; c < 3; c++) (grid[r][c] ||= {})[a] = vals[c]; }
  }
  const answer = { ...grid[2][2] };
  // I-RAVEN tree: perturb 3 attributes (prefer varying ones so distractors are rule violations).
  const order = [...shuffle([...varyAttrs], rng), ...shuffle(NAMES.filter(a => !varyAttrs.has(a)), rng)];
  const perturb = order.slice(0, 3);
  const alt = {};
  for (const a of perturb) { let v; do { v = Math.floor(rng() * ATTRS[a]); } while (v === answer[a]); alt[a] = v; }
  const options = [];
  for (let m = 0; m < 8; m++) {
    const o = { ...answer };
    perturb.forEach((a, i) => { if (m & (1 << i)) o[a] = alt[a]; });
    options.push(o);
  }
  const shuffled = shuffle(options, rng);
  const answerIndex = shuffled.findIndex(o => same(o, answer));
  return { grid, plan, options: shuffled, answerIndex, level };
}

export function same(a, b) { return NAMES.every(k => a[k] === b[k]); }

// Verifies every row of the full grid satisfies its rule (used by tests).
export function satisfiesRules(grid, plan) {
  for (const a of NAMES) {
    const rows = grid.map(r => r.map(c => c[a]));
    for (const row of rows) {
      if (plan[a] === 'fixed' && !(row[0] === row[1] && row[1] === row[2])) return false;
      if (plan[a] === 'constant' && !(row[0] === row[1] && row[1] === row[2])) return false;
      if (plan[a] === 'progression' && !(row[1] - row[0] === row[2] - row[1] && row[1] !== row[0])) return false;
      if (plan[a] === 'distribute' && new Set(row).size !== 3) return false;
    }
    if (plan[a] === 'fixed' && new Set(rows.flat()).size !== 1) return false;
    if (plan[a] === 'distribute') { const s = rows.map(r => [...r].sort().join()); if (new Set(s).size !== 1) return false; }
  }
  return true;
}
