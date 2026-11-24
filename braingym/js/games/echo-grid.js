// Echo Grid — adaptive dual n-back (Jaeggi, Buschkuehl, Jonides & Perrig, PNAS 2008).
import { el, frame, intro, sleep, now, speak, speechAvailable, beep, flash } from '../ui.js';
import { makeNbackSeq, nbackNextLevel, dprime, mean } from '../core.js';

const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T']; // Jaeggi's consonant set
const POS = [0, 1, 2, 3, 5, 6, 7, 8]; // 3x3 grid without centre
const BLOCKS = 3, STIM_MS = 500, TRIAL_MS = 3000;

export default {
  id: 'echo', name: 'Echo Grid', domain: 'Working memory', icon: 'echo', minutes: 4,
  tagline: 'Track positions and letters N steps back.',
  async run(root, ctx) {
    const audio = ctx.settings.speech && speechAvailable();
    await intro(root, {
      title: 'Echo Grid · dual n-back',
      how: `<p>Each turn a square lights up ${audio ? 'and a letter is spoken' : 'with a letter inside it'}.</p>
            <p>Press <b>Position</b> when the square is in the same place as <b>N turns ago</b>, and <b>Letter</b> when the letter matches N turns ago. Both, one, or neither can match.</p>
            <p>You start at <b>N = ${ctx.level || 1}</b>. N rises after a block with fewer than 3 errors per stream and falls after more than 5.</p>`,
      keys: 'A = Position · L = Letter',
      why: `Dual n-back loads working-memory updating and binding. Jaeggi et al. (2008) reported dose-dependent gains on fluid-reasoning tests; later meta-analyses found the far-transfer effect is small (g≈0.24, Au et al. 2015) to near zero against active controls (Melby-Lervåg et al. 2016). Expect solid gains on working-memory tasks; treat IQ claims cautiously.`,
    }, ctx.signal);

    let n = ctx.level || 1;
    const f = frame(root, 'Echo Grid', ctx.quit);
    const cells = Array.from({ length: 9 }, (_, i) => el('div', { class: 'cell' + (i === 4 ? ' center' : '') }));
    const grid = el('div', { class: 'grid3' }, cells);
    const nLabel = el('div', { class: 'big-label' });
    f.stage.append(nLabel, grid);
    const bPos = el('button', { class: 'btn resp' }, 'Position', el('kbd', {}, 'A'));
    const bLet = el('button', { class: 'btn resp' }, 'Letter', el('kbd', {}, 'L'));
    f.controls.append(bPos, bLet);

    const blocks = [];
    for (let b = 0; b < BLOCKS; b++) {
      nLabel.textContent = `Block ${b + 1}/${BLOCKS} · N = ${n}`;
      await sleep(1500, ctx.signal);
      const len = 20 + n;
      const P = makeNbackSeq(n, len, 8, 6, ctx.rng), L = makeNbackSeq(n, len, 8, 6, ctx.rng);
      const tally = { pos: { h: 0, m: 0, fa: 0, cr: 0 }, let: { h: 0, m: 0, fa: 0, cr: 0 } };
      for (let i = 0; i < len; i++) {
        f.progress((b * len + i) / (BLOCKS * len));
        let rp = false, rl = false;
        const onPos = (e) => { e?.preventDefault?.(); if (!rp) { rp = true; flash(bPos, 'pressed'); } };
        const onLet = (e) => { e?.preventDefault?.(); if (!rl) { rl = true; flash(bLet, 'pressed'); } };
        const onKey = (e) => { if (e.repeat) return; const k = e.key.toLowerCase(); if (k === 'a') onPos(e); if (k === 'l') onLet(e); };
        bPos.onpointerdown = onPos; bLet.onpointerdown = onLet;
        window.addEventListener('keydown', onKey);
        const cell = cells[POS[P.seq[i]]], letter = LETTERS[L.seq[i]];
        cell.classList.add('on');
        if (audio) speak(letter, ctx.settings); else cell.textContent = letter;
        try {
          await sleep(STIM_MS, ctx.signal);
          cell.classList.remove('on'); cell.textContent = '';
          await sleep(TRIAL_MS - STIM_MS, ctx.signal);
        } finally { window.removeEventListener('keydown', onKey); cell.classList.remove('on'); cell.textContent = ''; }
        if (i < n) continue; // nothing to compare yet
        for (const [key, target, resp, btn] of [['pos', P.targets[i], rp, bPos], ['let', L.targets[i], rl, bLet]]) {
          const t = tally[key];
          if (target && resp) { t.h++; f.hit(true); } else if (target) { t.m++; flash(btn, 'miss', 400); f.hit(false); } else if (resp) { t.fa++; flash(btn, 'wrong', 400); f.hit(false); } else t.cr++;
        }
      }
      const errs = [tally.pos.m + tally.pos.fa, tally.let.m + tally.let.fa];
      const d = mean([dprime(tally.pos.h, tally.pos.m, tally.pos.fa, tally.pos.cr), dprime(tally.let.h, tally.let.m, tally.let.fa, tally.let.cr)]);
      const next = nbackNextLevel(n, errs);
      blocks.push({ n, errs, d });
      beep(ctx.settings, next >= n);
      nLabel.textContent = next > n ? `Great: up to N = ${next}` : next < n ? `Down to N = ${next}` : `Stay at N = ${n}`;
      n = next;
      await sleep(1200, ctx.signal);
    }
    f.progress(1);
    const meanN = mean(blocks.map(b => b.n));
    return {
      level: n, score: +meanN.toFixed(2),
      accuracy: 1 - mean(blocks.map(b => (b.errs[0] + b.errs[1]) / 40)),
      summary: [`Mean N: ${meanN.toFixed(2)}`, `Next session starts at N = ${n}`, `Sensitivity d′: ${mean(blocks.map(b => b.d)).toFixed(2)}`],
      metrics: { blocks, meanN, dprime: mean(blocks.map(b => b.d)) },
    };
  },
};
