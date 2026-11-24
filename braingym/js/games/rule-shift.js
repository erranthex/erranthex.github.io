// Rule Shift — cued task switching (Rogers & Monsell 1995; Monsell 2003; Karbach & Kray 2009).
import { el, frame, intro, sleep, waitResponse, beep, now } from '../ui.js';
import { createStaircase, stepStaircase, mean, median, pick } from '../core.js';

const VOWELS = 'AEIU', CONS = 'GKMR';
const TRIALS = 40;
export const deadline = (level) => Math.max(700, Math.round(3000 * 0.9 ** (level - 1)));
export const switchProb = (level) => Math.min(0.5, 0.25 + level * 0.02);

export default {
  id: 'shift', name: 'Rule Shift', domain: 'Cognitive flexibility', icon: 'shift', minutes: 3,
  tagline: 'Switch between number and letter rules.',
  async run(root, ctx) {
    await intro(root, {
      title: 'Rule Shift · task switching',
      how: `<p>A letter–number pair appears, like <b>K7</b>.</p>
            <p>If the card is <b class="c-num">blue (NUMBER)</b>: is the number <b>odd</b> (left) or <b>even</b> (right)?</p>
            <p>If the card is <b class="c-let">orange (LETTER)</b>: is the letter a <b>vowel</b> (left) or <b>consonant</b> (right)?</p>
            <p>The rule changes unpredictably. Answer fast; the time limit shrinks as you improve.</p>`,
      keys: '← / F = left · → / J = right',
      why: `Switching rules engages prefrontal control networks. Training with variable task switching improved switching on new tasks in children and older adults (Karbach & Kray, 2009). We track your <i>switch cost</i> (extra time on switch trials vs repeat trials), the classic index of flexibility, so you can see it shrink.`,
    }, ctx.signal);

    const f = frame(root, 'Rule Shift', ctx.quit);
    const card = el('div', { class: 'card-stim' });
    f.stage.append(card);
    const bl = el('button', { class: 'btn resp' }, 'Odd · Vowel', el('kbd', {}, '←'));
    const br = el('button', { class: 'btn resp' }, 'Even · Consonant', el('kbd', {}, '→'));
    f.controls.append(bl, br);
    let st = createStaircase({ level: ctx.level || 1, min: 1, max: 20, down: 3, up: 1 });
    let task = pick(['num', 'let'], ctx.rng);
    const trials = [];
    for (let t = 0; t < TRIALS; t++) {
      f.progress(t / TRIALS);
      const prev = task;
      if (t > 0 && ctx.rng() < switchProb(st.level)) task = task === 'num' ? 'let' : 'num';
      const isSwitch = t > 0 && task !== prev;
      const isVowel = ctx.rng() < 0.5, num = 1 + Math.floor(ctx.rng() * 9);
      const letter = pick((isVowel ? VOWELS : CONS).split(''), ctx.rng);
      const correct = task === 'num' ? (num % 2 ? 0 : 1) : (isVowel ? 0 : 1);
      card.className = 'card-stim ' + (task === 'num' ? 'num' : 'let');
      card.innerHTML = '';
      card.append(el('div', { class: 'cue' }, task === 'num' ? 'NUMBER' : 'LETTER'), el('div', { class: 'pair' }, letter + num));
      const dl = deadline(st.level);
      f.setStatus(`Limit ${(dl / 1000).toFixed(1)} s`);
      const r = await waitResponse({ buttons: [[bl, 0], [br, 1]], keys: { ArrowLeft: 0, f: 0, F: 0, ArrowRight: 1, j: 1, J: 1 }, timeout: dl, signal: ctx.signal, t0: now() });
      const ok = r.value === correct;
      trials.push({ isSwitch, ok, rt: r.rt, timeout: r.value == null });
      beep(ctx.settings, ok); f.hit(ok);
      card.classList.add(ok ? 'good' : 'bad');
      st = stepStaircase(st, ok);
      await sleep(ok ? 250 : 600, ctx.signal);
      card.innerHTML = '';
      await sleep(200, ctx.signal);
    }
    f.progress(1);
    const rt = (sw) => median(trials.filter((x, i) => i > 0 && x.ok && x.isSwitch === sw).map(x => x.rt));
    const cost = Math.round(rt(true) - rt(false));
    const acc = mean(trials.map(x => +x.ok));
    return {
      level: st.level, score: st.level, accuracy: acc,
      summary: [`Accuracy: ${Math.round(acc * 100)}%`, `Switch cost: ${Number.isFinite(cost) ? cost + ' ms' : 'n/a'}`, `Next time limit: ${(deadline(st.level) / 1000).toFixed(1)} s`],
      metrics: { switchCost: cost, rtSwitch: rt(true), rtRepeat: rt(false), trials },
    };
  },
};
