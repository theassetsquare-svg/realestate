/**
 * sitemap.xml 과 llms.txt 에 새 나이트 페이지 40개를 넣는다.
 *
 * 왜 중요한가
 *   이 페이지들은 홈이나 기존 페이지에서 링크를 걸지 않는다(규칙: 홈 링크 0 · 기존 페이지 링크 0).
 *   그래서 네이버가 사이트를 홈에서부터 훑어 내려와도 /1 ~ /40 에 닿을 길이 없다.
 *   **sitemap.xml 이 유일한 발견 경로다.** 여기 빠지면 색인 자체가 안 되고,
 *   색인이 안 되면 상위노출은 아예 이야기가 안 된다.
 *
 *   node tools/night/sitemap.mjs          무엇이 바뀔지 보여만 준다
 *   node tools/night/sitemap.mjs --apply  실제로 고친다
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('D:/naver-watch/repos/realestate');
const SITE = 'https://k.nolcool.com';
const TODAY = '2026-08-25';
const APPLY = process.argv.includes('--apply');

const venues = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/night/venues.json'), 'utf8'));

/* ── sitemap.xml ── */
const smPath = path.join(ROOT, 'sitemap.xml');
let sm = fs.readFileSync(smPath, 'utf8');
const already = venues.filter((v) => sm.includes(`<loc>${SITE}/${v.path}</loc>`));
const missing = venues.filter((v) => !sm.includes(`<loc>${SITE}/${v.path}</loc>`));

const rows = missing.map((v) =>
  `  <url><loc>${SITE}/${v.path}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
).join('\n');

console.log(`sitemap — 이미 있는 것 ${already.length}개 / 넣을 것 ${missing.length}개`);
if (missing.length) {
  const next = sm.replace('</urlset>', rows + '\n</urlset>');
  if (APPLY) { fs.writeFileSync(smPath, next, 'utf8'); console.log('  sitemap.xml 갱신'); }
}

/* ── llms.txt ── */
const llmsPath = path.join(ROOT, 'llms.txt');
let llms = fs.readFileSync(llmsPath, 'utf8');
const MARK = '## 나이트 가게 안내';
if (llms.includes(MARK)) {
  console.log('llms.txt — 이미 들어 있음');
} else {
  const block = '\n\n' + MARK + '\n' +
    '> 전국 나이트 가게 40곳의 위치·영업시간을 공개 정보 기준으로 정리한 단독 안내 페이지입니다.\n\n' +
    venues.map((v) => {
      const addr = v.facts.find((f) => f[0] === '주소')?.[1] || v.area;
      return `- [${v.name}](${SITE}/${v.path}): ${addr}`;
    }).join('\n') + '\n';
  console.log(`llms.txt — 나이트 항목 ${venues.length}개 추가`);
  if (APPLY) { fs.writeFileSync(llmsPath, llms + block, 'utf8'); console.log('  llms.txt 갱신'); }
}

/* ── robots.txt 확인 (고치지는 않는다) ── */
const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
const blocked = /Disallow:\s*\/(?!\s*$)/.test(robots);
console.log(`robots.txt — ${blocked ? '★막는 규칙 있음, 확인 필요' : '전체 허용 (Yeti 포함)'} / sitemap 선언 ${robots.includes('Sitemap:') ? '있음' : '★없음'}`);

if (!APPLY) console.log('\n실제로 고치려면 --apply 를 붙인다');
