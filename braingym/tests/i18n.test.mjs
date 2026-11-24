// Every language must define every English key, keep the same {placeholders} and list lengths.
import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../js/i18n/en.js';
const CODES = ['es', 'it', 'fr', 'de', 'pt', 'zh'];
const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
for (const code of CODES) {
  test(`i18n ${code}: complete and consistent`, async () => {
    const d = (await import(`../js/i18n/${code}.js`)).default;
    const missing = Object.keys(en).filter(k => !(k in d));
    assert.deepEqual(missing, [], `${code} missing keys`);
    const extra = Object.keys(d).filter(k => !(k in en));
    assert.deepEqual(extra, [], `${code} unknown keys`);
    for (const k of Object.keys(en)) {
      assert.equal(ph(d[k]), ph(en[k]), `${code} ${k} placeholders`);
      if (en[k].includes('|') && !/^g\.(palace\.words|names\.jobs)$/.test(k)) assert.equal(d[k].split('|').length, en[k].split('|').length, `${code} ${k} list length`);
      if (en[k] !== '' ) assert.ok(String(d[k]).length > 0, `${code} ${k} empty`);
    }
    assert.ok(d['g.palace.words'].split('|').length >= 60, `${code} palace words`);
    assert.equal(d['g.names.jobs'].split('|').length, 20);
    assert.equal(d['res.weekdays'].length >= 7, true);
  });
}
