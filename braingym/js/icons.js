// Original SVG icon set + mascot ("Nuri", a friendly neuron). All artwork drawn for this app.

const P = {
  flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  echo: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M14 6.5h3.5a2 2 0 0 1 2 2V11M10 17.5H6.5a2 2 0 0 1-2-2V13"/><path d="m17 9 2.5 2.5L22 9M7 15l-2.5-2.5L2 15"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  shift: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  arrows: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  logic: '<path d="M12 2 22 12 12 22 2 12z"/><path d="M12 7l5 5-5 5-5-5z" fill="currentColor"/>',
  palace: '<path d="M3 9 12 3l9 6M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18M3 18h18"/>',
  math: '<path d="M7 4v6M4 7h6M14 7h6M5 15l4 4M9 15l-4 4M14 15.5h6M14 18.5h6"/>',
  word: '<rect x="2.5" y="5" width="9" height="11" rx="2"/><rect x="12.5" y="8" width="9" height="11" rx="2"/><path d="m5 13 2-5 2 5M5.8 11.5h2.4M15 15.5v-5h2a1.25 1.25 0 0 1 0 2.5h-2 2.4a1.25 1.25 0 0 1 0 2.5z"/>',
  names: '<circle cx="9" cy="9" r="5"/><path d="M2 21c1-4 4-6 7-6s6 2 7 6"/><path d="M15 5h6M15 9h6M17 13h4"/>',
  path: '<path d="M6 19c0-4 12-2 12-7s-8-3-8-7"/><circle cx="6" cy="19" r="2.2" fill="currentColor"/><path d="M10 2.5c-1.6 0-3 1.2-3 2.9C7 7.6 10 10 10 10s3-2.4 3-4.6c0-1.7-1.4-2.9-3-2.9z"/>',
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  active: '<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v4M6 12l3-4 4 1 3 4 3 1M11 15l1-6"/>',
  checkup: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3 7 9l5 12 5-12-2-6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9a7 5 0 0 1 14 0"/><rect x="10" y="11.5" width="4" height="4" rx="1" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  home: '<path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4z"/><path d="M12 5v16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  leaf: '<path d="M5 19C5 9 12 4 20 4c0 9-5 15-15 15zM5 19l8-8"/>',
  memory: '<path d="M12 3a6 6 0 0 0-6 6c0 3 2 4 2 7h8c0-3 2-4 2-7a6 6 0 0 0-6-6zM9 19h6M10 22h4"/>',
  speed: '<path d="M4 18a8 8 0 1 1 16 0M12 18l4-6"/>',
  attention: '<circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>',
  flex: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  reasoning: '<path d="M12 2 22 12 12 22 2 12z"/>',
  language: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
};

export function icon(name, size = 24, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.star}</svg>`;
}
export function iconEl(name, size, cls) { const t = document.createElement('template'); t.innerHTML = icon(name, size, cls).trim(); return t.content.firstChild; }

// Nuri the neuron. moods: happy | cheer | think | sleepy | wow
export function mascot(mood = 'happy', size = 96) {
  const eyes = {
    happy: '<circle cx="40" cy="52" r="5"/><circle cx="60" cy="52" r="5"/>',
    cheer: '<path d="M34 53q6-8 12 0M54 53q6-8 12 0" stroke="#1d1b3a" stroke-width="4" fill="none" stroke-linecap="round"/>',
    think: '<circle cx="42" cy="50" r="5"/><circle cx="62" cy="50" r="5"/>',
    sleepy: '<path d="M34 53h12M54 53h12" stroke="#1d1b3a" stroke-width="4" stroke-linecap="round"/>',
    wow: '<circle cx="40" cy="51" r="6.5"/><circle cx="60" cy="51" r="6.5"/>',
  }[mood] || '';
  const mouth = {
    happy: '<path d="M42 64q8 7 16 0" stroke="#1d1b3a" stroke-width="4" fill="none" stroke-linecap="round"/>',
    cheer: '<path d="M40 62q10 14 20 0z" fill="#1d1b3a"/><path d="M44 66q6 4 12 0" fill="#ff7a9a"/>',
    think: '<path d="M45 66h10" stroke="#1d1b3a" stroke-width="4" stroke-linecap="round"/>',
    sleepy: '<ellipse cx="50" cy="66" rx="4" ry="3" fill="#1d1b3a"/>',
    wow: '<ellipse cx="50" cy="67" rx="5" ry="6" fill="#1d1b3a"/>',
  }[mood] || '';
  return `<svg class="mascot m-${mood}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <g stroke="#7c5cff" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M30 30 18 14M18 14l-8 2M18 14l1-9"/><path d="M70 30 82 14M82 14l8 2M82 14l-1-9"/>
      <path d="M22 70 8 80M78 70l14 10"/>
    </g>
    <circle cx="10" cy="16" r="4.5" fill="#ffc94d"/><circle cx="90" cy="16" r="4.5" fill="#ffc94d"/><circle cx="8" cy="80" r="4.5" fill="#3ddc97"/><circle cx="92" cy="80" r="4.5" fill="#3ddc97"/>
    <ellipse cx="50" cy="56" rx="34" ry="31" fill="#8f73ff"/>
    <ellipse cx="50" cy="60" rx="27" ry="23" fill="#a995ff"/>
    <ellipse cx="38" cy="38" rx="8" ry="5" fill="#fff" opacity=".35"/>
    <g fill="#1d1b3a">${eyes}</g>
    <circle cx="31" cy="63" r="4.5" fill="#ff8fb0" opacity=".7"/><circle cx="69" cy="63" r="4.5" fill="#ff8fb0" opacity=".7"/>
    ${mouth}
    ${mood === 'think' ? '<circle cx="84" cy="40" r="3" fill="#ffc94d"/><circle cx="91" cy="31" r="4.5" fill="#ffc94d"/>' : ''}
    ${mood === 'sleepy' ? '<text x="76" y="30" font-size="16" font-weight="900" fill="#a995ff">z</text>' : ''}
  </svg>`;
}
export function mascotEl(mood, size) { const t = document.createElement('template'); t.innerHTML = mascot(mood, size).trim(); return t.content.firstChild; }
