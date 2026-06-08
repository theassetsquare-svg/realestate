#!/usr/bin/env node
'use strict';
/**
 * 생성 엔진 — SSOT(data/listings.json) → 정적 페이지 + sitemap.
 *   node scripts/generate.js          # 실 생성/갱신
 *   node scripts/generate.js --dry    # 검증(파일 미기록, 샘플만 STDOUT 카운트)
 *
 * 동작:
 *  1) 만료 자동종료: subscriptionEnd < 오늘 → status='closed' (배지 '청약 접수 마감')
 *  2) 신규 현장(generated:true & 파일 없음) → 상세 HTML 생성 (게이트 통과형 템플릿)
 *  3) manual(수기 작성 18개)은 본문 미덮어쓰기 — 회귀 0
 *  4) sitemap.xml 재생성(전 페이지 + lastmod=오늘)
 *  5) 빈 카테고리(아파트 외 5종): 실데이터 있으면 채우고, 없으면 정직 가이드 유지(창작 0)
 */
const fs = require('fs');
const path = require('path');
const { renderPropertyPage, CAT_PATH } = require('./lib/template');

const ROOT = path.resolve(__dirname, '..');
const SSOT = path.join(ROOT, 'data', 'listings.json');
const HOST = 'https://realestate-ccw.pages.dev';
const DRY = process.argv.includes('--dry');
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const ymd = (d) => d.toISOString().slice(0, 10);

function relatedFor(slug, all) {
  const me = all.find((l) => l.slug === slug);
  const same = all.filter((l) => l.slug !== slug && l.category === me.category && l.region === me.region).sort((a, b) => a.slug < b.slug ? -1 : 1);
  const other = all.filter((l) => l.slug !== slug && !(l.category === me.category && l.region === me.region)).sort((a, b) => a.slug < b.slug ? -1 : 1);
  return [...same, ...other].slice(0, 4).map((l) => ({ slug: l.slug, name: l.name, addressLocality: l.addressLocality, category: l.category }));
}

function main() {
  const ssot = JSON.parse(fs.readFileSync(SSOT, 'utf8'));
  const listings = ssot.listings;
  let expired = 0, created = 0;

  // 1) 만료 자동종료
  for (const l of listings) {
    if (l.subscriptionEnd && l.status === 'active') {
      const end = new Date(l.subscriptionEnd + 'T23:59:59');
      if (end < TODAY) { l.status = 'closed'; expired++; }
    }
  }

  // 2) 신규 현장 생성 (manual 미덮어쓰기)
  for (const l of listings) {
    const fp = path.join(ROOT, 'property', `${l.slug}.html`);
    const exists = fs.existsSync(fp);
    if (l.source === 'manual') continue;          // 수기 작성 보존
    if (l.generated && !exists) {
      const html = renderPropertyPage(l, relatedFor(l.slug, listings), TODAY);
      if (!DRY) fs.writeFileSync(fp, html);
      created++;
    }
  }

  // 2.5) 생성 현장을 카테고리 페이지에 연동 (inbound 확보 → 고아 방지 + 빈 카테고리 실데이터 채움)
  //      실데이터(generated) 있을 때만 채우고, 없으면 정직 가이드 유지(창작 0). 마커로 멱등.
  const CAT_KO = { apt: '아파트분양', officetel: '오피스텔분양', commercial: '상가분양',
    industrial: '산업단지분양', land: '토지분양', knowledge: '지식산업센터분양' };
  const CAT_FILE = { apt: 'apt.html', officetel: 'officetel.html', commercial: 'commercial.html',
    industrial: 'industrial.html', land: 'land.html', knowledge: 'knowledge.html' };
  for (const cat of Object.keys(CAT_FILE)) {
    const gen = listings.filter((l) => l.category === cat && l.source === 'applyhome');
    const fp = path.join(ROOT, CAT_FILE[cat]);
    if (!fs.existsSync(fp)) continue;
    let html = fs.readFileSync(fp, 'utf8');
    let block = '';
    if (gen.length) {
      const cards = gen.map((l) =>
        `      <a href="/property/${l.slug}" class="related-card"><span class="related-name">${l.name}</span><span class="related-loc">${l.addressLocality} · ${CAT_KO[cat]}</span></a>`).join('\n');
      block = `<!-- AUTO-LISTINGS -->\n<section class="section auto-listings">\n  <div class="container">\n    <h2 class="section-title">청약홈 연동 최신 ${CAT_KO[cat]} 현장</h2>\n    <div class="related-grid">\n${cards}\n    </div>\n  </div>\n</section>\n<!-- /AUTO-LISTINGS -->\n`;
    }
    const re = /<!-- AUTO-LISTINGS -->[\s\S]*?<!-- \/AUTO-LISTINGS -->\n?/;
    let next = re.test(html) ? html.replace(re, block) : html.replace('</main>', block + '</main>');
    if (next !== html && !DRY) fs.writeFileSync(fp, next);
  }

  // 3) sitemap 재생성 (전 페이지 + lastmod)
  const staticPages = ['', 'apt', 'officetel', 'commercial', 'knowledge', 'land', 'industrial'];
  const urls = [...staticPages.map((p) => `${HOST}/${p}`),
    ...listings.map((l) => `${HOST}/property/${l.slug}`),
    `${HOST}/llms.txt`];
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><lastmod>${ymd(TODAY)}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  if (!DRY) fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm);
  if (!DRY) fs.writeFileSync(SSOT, JSON.stringify(ssot, null, 2));

  console.log(`생성 엔진${DRY ? '(DRY)' : ''}: 만료종료 ${expired} / 신규생성 ${created} / sitemap ${urls.length}개 URL`);
  // 변경 여부(워크플로 push 판단용)
  console.log(`CHANGED=${expired + created > 0 ? '1' : '0'}`);
}

main();
