// Tiny i18n layer: t(key, vars) with {placeholders}, falling back to English, then the key.
import en from './i18n/en.js';

export const LANGS = { en: 'English', es: 'Español', it: 'Italiano', fr: 'Français', de: 'Deutsch', pt: 'Português', zh: '中文' };
const SPEECH = { en: 'en-US', es: 'es-ES', it: 'it-IT', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT', zh: 'zh-CN' };
let cur = 'en', dict = en;
const loaded = { en };

export async function setLang(code) {
  if (!LANGS[code]) code = 'en';
  if (!loaded[code]) loaded[code] = (await import(`./i18n/${code}.js`)).default;
  dict = loaded[code]; cur = code;
  if (typeof document !== 'undefined') document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code;
  return code;
}
export function useDict(code, d) { loaded[code] = d; } // for tests
export const lang = () => cur;
export const speechLang = () => SPEECH[cur];
export function t(key, vars) {
  let s = dict[key] ?? en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, v) => (vars[v] ?? m));
  return s;
}
export const tl = (key) => t(key).split('|');
export function detectLang(navLang = (typeof navigator !== 'undefined' && navigator.language) || 'en') {
  const n = String(navLang).slice(0, 2).toLowerCase();
  return LANGS[n] ? n : 'en';
}
// Locale-aware number/date formatting.
export const fmtDate = (t) => new Date(t).toLocaleDateString(cur === 'zh' ? 'zh-CN' : cur);
