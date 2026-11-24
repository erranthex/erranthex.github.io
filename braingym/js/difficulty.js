// Difficulty model per exercise: level range, presets, and conversion between the single level
// number the player sees and the value the exercise uses. In Auto mode the exercise's adaptive
// staircase moves the level after every trial/block; in Manual mode the level stays fixed.

export const DIFF = {
  flash: { min: 1, max: 39, presets: { easy: 2, medium: 8, hard: 18, expert: 30 } },
  shift: { min: 1, max: 20, presets: { easy: 1, medium: 6, hard: 12, expert: 18 } },
  arrows: { min: 1, max: 20, presets: { easy: 1, medium: 6, hard: 12, expert: 18 } },
  orbit: { min: 1, max: 18, presets: { easy: 1, medium: 5, hard: 10, expert: 15 } },
  grid: { min: 2, max: 10, presets: { easy: 3, medium: 5, hard: 7, expert: 9 }, toCtx: (L) => ({ f: L, b: Math.max(2, L - 1) }), fromCtx: (v) => (v && typeof v === 'object' ? v.f : v) },
  echo: { min: 1, max: 9, presets: { easy: 1, medium: 2, hard: 4, expert: 6 } },
  palace: { min: 4, max: 20, presets: { easy: 4, medium: 8, hard: 12, expert: 16 } },
  names: { min: 3, max: 12, presets: { easy: 3, medium: 5, hard: 8, expert: 11 } },
  path: { min: 2, max: 14, presets: { easy: 3, medium: 5, hard: 8, expert: 12 } },
  logic: { min: 1, max: 8, presets: { easy: 1, medium: 3, hard: 5, expert: 7 } },
  word: { min: 1, max: 10, presets: { easy: 1, medium: 3, hard: 6, expert: 9 } },
  math: { min: 1, max: 12, presets: { easy: 1, medium: 4, hard: 8, expert: 11 } },
};
export const PRESETS = ['easy', 'medium', 'hard', 'expert'];

export function levelNumber(id, ctxValue) {
  const d = DIFF[id]; if (!d) return null;
  const v = d.fromCtx ? d.fromCtx(ctxValue) : ctxValue;
  return Number.isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : d.min;
}
export function ctxValue(id, level) {
  const d = DIFF[id]; if (!d) return level;
  const L = Math.min(d.max, Math.max(d.min, Math.round(level)));
  return d.toCtx ? d.toCtx(L) : L;
}
export function presetOf(id, level) {
  const d = DIFF[id]; if (!d) return null;
  let best = null, bd = Infinity;
  for (const p of PRESETS) { const dd = Math.abs(d.presets[p] - level); if (dd < bd) { bd = dd; best = p; } }
  return best;
}
// Fraction 0..1 of the level range, for progress bars.
export function levelFraction(id, level) { const d = DIFF[id]; return d ? (level - d.min) / (d.max - d.min) : 0; }
