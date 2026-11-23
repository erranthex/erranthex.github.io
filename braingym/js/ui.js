// Shared DOM / timing / audio helpers for games.

export class Aborted extends Error { constructor() { super('aborted'); this.name = 'Aborted'; } }

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
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
export const T = (ms) => ms * (globalThis.__ngSpeed || 1);

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

// Standard game frame: header with title, progress bar and quit.
export function frame(root, title, onQuit) {
  root.innerHTML = '';
  const bar = el('div', { class: 'progress' }, el('div', { class: 'progress-fill' }));
  const status = el('div', { class: 'gstatus', 'aria-live': 'polite' });
  const stage = el('div', { class: 'stage' });
  const controls = el('div', { class: 'controls' });
  root.append(
    el('div', { class: 'ghead' },
      el('button', { class: 'icon-btn', 'aria-label': 'Quit game', onclick: onQuit }, '✕'),
      el('div', { class: 'gtitle' }, title), status),
    bar, stage, controls);
  return {
    stage, controls, status,
    progress(p) { bar.firstChild.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`; },
    setStatus(t) { status.textContent = t; },
  };
}

export function flash(node, cls, ms = 250) { node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }

// Instruction card shown before a game; resolves on start.
export function intro(root, { title, how, why, keys }, signal) {
  return new Promise((res, rej) => {
    root.innerHTML = '';
    const start = el('button', { class: 'btn primary big grow', onclick: () => { unlockAudio(); res(); } }, 'Start');
    const onAbort = () => rej(new Aborted());
    signal?.addEventListener('abort', onAbort, { once: true });
    root.append(el('div', { class: 'intro card' },
      el('h2', {}, title),
      el('h3', {}, 'How to play'), el('div', { class: 'how', html: how }),
      keys ? el('p', { class: 'muted small' }, '⌨️ ', keys) : null,
      el('details', {}, el('summary', {}, 'Why this exercise?'), el('p', { class: 'small', html: why })),
      el('div', { class: 'row gap' }, start, el('button', { class: 'btn ghost', onclick: () => { signal?.removeEventListener('abort', onAbort); rej(new Aborted()); } }, 'Back'))));
    start.focus();
  });
}
