// Shared DOM / timing / audio helpers for games.
import { icon, mascot } from './icons.js';

export class Aborted extends Error { constructor() { super('aborted'); this.name = 'Aborted'; } }

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? n.style.setProperty(sk, sv) : (n.style[sk] = sv); }
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}

export function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of kids.flat()) if (c) n.append(c);
  return n;
}

// Time scale hook: automated tests set globalThis.__ngSpeed < 1 to fast-forward. Default 1.
export const T = (ms) => ms * (globalThis.__ngSpeed || 1) * (globalThis.__ngPace || 1); // __ngPace: comfort pacing for older users

export function sleep(ms, signal) {
  ms = T(ms);
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(new Aborted());
    const t = setTimeout(() => { signal?.removeEventListener('abort', on); res(); }, ms);
    const on = () => { clearTimeout(t); rej(new Aborted()); };
    signal?.addEventListener('abort', on, { once: true });
  });
}

export const now = () => performance.now();
export const raf = () => new Promise(r => requestAnimationFrame(r));

// Estimate display refresh interval (ms) so brief exposures can be frame-locked.
export async function measureFrame(frames = 20) {
  let t0 = await new Promise(r => requestAnimationFrame(r));
  const ds = [];
  for (let i = 0; i < frames; i++) { const t = await new Promise(r => requestAnimationFrame(r)); ds.push(t - t0); t0 = t; }
  ds.sort((a, b) => a - b);
  const m = ds[ds.length >> 1];
  return m > 4 && m < 60 ? m : 16.67;
}

// Show something for an exact number of frames. Returns the measured on-screen duration.
export async function showForFrames(showFn, hideFn, frames) {
  const t0 = await raf();
  showFn();
  let t = t0;
  for (let i = 0; i < frames; i++) t = await raf();
  hideFn();
  return t - t0;
}

// Wait for one of several inputs (buttons or keys). Resolves {value, rt} or {value:null} on timeout.
export function waitResponse({ buttons = [], keys = {}, timeout = 0, signal, t0 = now() } = {}) {
  return new Promise((res, rej) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      buttons.forEach(([b, , h]) => b.removeEventListener('pointerdown', h));
      signal?.removeEventListener('abort', onAbort);
    };
    const done = (value) => { cleanup(); res({ value, rt: now() - t0 }); };
    const onKey = (e) => { if (e.repeat) return; if (e.key in keys) { e.preventDefault(); done(keys[e.key]); } };
    const onAbort = () => { cleanup(); rej(new Aborted()); };
    buttons.forEach(entry => { const [b, v] = entry; const h = (e) => { e.preventDefault(); done(v); }; entry[2] = h; b.addEventListener('pointerdown', h); });
    window.addEventListener('keydown', onKey);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (timeout) timer = setTimeout(() => done(null), T(timeout));
  });
}

// ---------- Audio ----------
let actx;
function ctx() { if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (A) actx = new A(); } return actx; }
export function unlockAudio() { const c = ctx(); if (c && c.state === 'suspended') c.resume(); }
export function beep(settings, good = true) {
  if (!settings?.sound) return;
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = good ? 880 : 220; o.type = good ? 'sine' : 'square';
  g.gain.setValueAtTime(0.06, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.16);
}
export function speechAvailable() { return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; }
export function speak(text, settings) {
  if (!settings?.speech || !speechAvailable()) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1; u.lang = 'en-US';
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export function vibrate(ms) { try { navigator.vibrate?.(ms); } catch { } }

// Current game meta (set by the app before each run) for themed headers and intros.
let current = null;
export function setCurrentGame(meta) { current = meta; }

// Standard game frame: header with quit, title, combo meter and progress bar.
export function frame(root, title, onQuit) {
  root.innerHTML = '';
  root.style.setProperty('--game', current?.color || 'var(--accent)');
  const bar = el('div', { class: 'progress' }, el('div', { class: 'progress-fill' }));
  const status = el('div', { class: 'gstatus', 'aria-live': 'polite' });
  const combo = el('div', { class: 'combo', 'aria-live': 'polite' });
  const stage = el('div', { class: 'stage' });
  const controls = el('div', { class: 'controls' });
  root.append(
    el('div', { class: 'ghead' },
      el('button', { class: 'icon-btn', 'aria-label': 'Quit exercise', onclick: onQuit, html: icon('close', 20) }),
      bar, combo),
    el('div', { class: 'gsub' }, el('span', { class: 'gtitle' }, title), status),
    stage, controls);
  let streak = 0, best = 0;
  return {
    stage, controls, status,
    progress(p) { bar.firstChild.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`; },
    setStatus(t) { status.textContent = t; },
    // Combo meter: consecutive correct answers. Pure encouragement — not used for scoring.
    hit(ok) {
      streak = ok ? streak + 1 : 0; best = Math.max(best, streak);
      combo.innerHTML = streak >= 3 ? `${icon('flame', 16)}<b>${streak}</b>` : '';
      combo.classList.toggle('hot', streak >= 3);
      if (streak >= 3) { combo.classList.remove('bump'); void combo.offsetWidth; combo.classList.add('bump'); }
      stage.classList.remove('pop-good', 'pop-bad'); void stage.offsetWidth; stage.classList.add(ok ? 'pop-good' : 'pop-bad');
      if (!ok) vibrate(30);
    },
    get bestCombo() { return best; },
  };
}

export function flash(node, cls, ms = 250) { node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }

// Instruction card shown before a game; resolves on start.
export function intro(root, { title, how, why, keys }, signal) {
  return new Promise((res, rej) => {
    root.innerHTML = '';
    root.style.setProperty('--game', current?.color || 'var(--accent)');
    const start = el('button', { class: 'btn primary big grow', onclick: () => { unlockAudio(); res(); } }, "Let's go");
    const onAbort = () => rej(new Aborted());
    signal?.addEventListener('abort', onAbort, { once: true });
    const [name, sub] = title.split(' · ');
    root.append(el('div', { class: 'intro' },
      el('div', { class: 'intro-head' },
        el('div', { class: 'gtile big', html: icon(current?.icon || 'star', 40) }),
        el('div', {}, el('h2', {}, name), sub ? el('div', { class: 'muted' }, sub) : null,
          current?.domainName ? el('span', { class: 'chip' }, current.domainName) : null)),
      el('div', { class: 'card how' }, el('div', { html: how })),
      keys ? el('p', { class: 'muted small keys-hint' }, 'Keyboard: ', keys) : null,
      el('details', { class: 'card why' }, el('summary', {}, el('span', { html: mascot('think', 32) }), 'Why this is good for your brain'), el('p', { class: 'small', html: why })),
      el('div', { class: 'row gap sticky-cta' }, el('button', { class: 'btn ghost', onclick: () => { signal?.removeEventListener('abort', onAbort); rej(new Aborted()); } }, 'Back'), start)));
    start.focus();
  });
}

// Short synthesized jingles for celebrations (no audio files needed).
export function chime(settings, kind = 'win') {
  if (!settings?.sound) return;
  const c = (() => { try { const A = window.AudioContext || window.webkitAudioContext; return A ? (chime.ctx ||= new A()) : null; } catch { return null; } })();
  if (!c) return;
  const notes = { win: [523, 659, 784, 1047], level: [392, 523, 659, 784, 1047], streak: [659, 880, 1175], gem: [1319, 1760] }[kind] || [880];
  notes.forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.09;
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.32);
  });
}

// Lightweight confetti burst on a full-screen canvas.
export function confetti(colors = ['#7c5cff', '#ffc94d', '#3ddc97', '#ff6b9a', '#4cc9f0']) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.append(cv);
  const dpr = devicePixelRatio || 1, w = innerWidth, h = innerHeight; cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const ps = Array.from({ length: 140 }, () => ({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: colors[Math.floor(Math.random() * colors.length)] }));
  let t0 = performance.now();
  (function loop(t) {
    const dt = Math.min(2, (t - t0) / 16.7); t0 = t;
    g.clearRect(0, 0, w, h);
    let alive = 0;
    for (const p of ps) { p.vy += 0.28 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; if (p.y < h + 20) alive++; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); }
    if (alive) requestAnimationFrame(loop); else cv.remove();
  })(t0);
  setTimeout(() => cv.remove(), 5000);
}

// In-page confirmation (native confirm() is unavailable in some embedded viewers).
export function askConfirm(message, { yes = 'Yes', no = 'Cancel', danger = false } = {}) {
  return new Promise(res => {
    const close = (v) => { m.remove(); res(v); };
    const bYes = el('button', { class: 'btn ' + (danger ? 'danger-solid' : 'primary'), onclick: () => close(true) }, yes);
    const m = el('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true' },
      el('div', { class: 'modal-card' }, el('p', { class: 'modal-msg' }, message), el('div', { class: 'row gap end' }, el('button', { class: 'btn ghost', onclick: () => close(false) }, no), bYes)));
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    document.body.append(m); bYes.focus();
  });
}
