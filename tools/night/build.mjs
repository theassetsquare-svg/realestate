/**
 * 나이트 단독페이지 빌더 — 있는 본문만 만든다(집필 중에도 돌려볼 수 있게).
 *   node tools/night/build.mjs            있는 것 전부
 *   node tools/night/build.mjs 1 2 3      지정한 번호만
 *
 * 만드는 것: <번호>/index.html · og/<번호>.png · og/manifest.json
 * 기존 부동산 파일은 건드리지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPage, AD } from './render.mjs';
import { buildThumb } from './og.mjs';

const ROOT = path.resolve('D:/naver-watch/repos/realestate');
const HERE = path.join(ROOT, 'tools/night');
const TODAY = '2026-08-25';

const venues = JSON.parse(fs.readFileSync(path.join(HERE, 'venues.json'), 'utf8'));
const only = process.argv.slice(2);

const manifestPath = path.join(ROOT, 'og/manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

let made = 0, skipped = [];
for (const v of venues) {
  if (only.length && !only.includes(v.path)) continue;
  const cf = path.join(HERE, 'content', `${v.path}.mjs`);
  if (!fs.existsSync(cf)) { skipped.push(v.path); continue; }

  const c = (await import(pathToFileURL(cf).href + '?t=' + Date.now())).default;
  const ad = AD[v.name] || null;

  const m = await buildThumb({ name: v.name, ad, out: path.join(ROOT, 'og', `${v.path}.png`) });
  manifest[`${v.path}.png`] = {
    file: `${v.path}.png`,
    url: `https://k.nolcool.com/og/${v.path}.png`,
    venue: v.name,
    drawn: ad ? [v.name, ad.nick, ad.phone, '광고문의 카톡 besta12'] : [v.name, '광고문의', '카카오톡 besta12'],
    width: m.width, height: m.height, bytes: m.bytes,
    hero: m.hero,
    /* ★행별 실측 폭·높이 — G15(주인공 글자가 실제로 가장 큰가)를 이 값으로 검사한다 */
    rows: Object.fromEntries(Object.entries(m.rows).map(([k, r]) => [k, { w: r.w, h: r.h, pct: Number(r.pct.toFixed(3)) }])),
  };

  const html = renderPage(v, c, TODAY);
  const dir = path.join(ROOT, v.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  made++;
  const bodyLen = [...c.lead, ...c.sections.flatMap((s) => s.body), ...c.reveal].join('').length;
  console.log(`  /${v.path.padEnd(3)} ${v.name.padEnd(20)} 본문 ${String(bodyLen).padStart(4)}자  썸네일 ${m.width}x${m.height} ${(m.bytes / 1024).toFixed(0)}KB`);
}

fs.mkdirSync(path.join(ROOT, 'og'), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf8');
console.log(`\n만든 페이지 ${made}개 / 본문 아직 없는 번호 ${skipped.length}개${skipped.length ? ': ' + skipped.join(',') : ''}`);
