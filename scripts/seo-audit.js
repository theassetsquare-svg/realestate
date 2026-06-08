#!/usr/bin/env node
/**
 * SEO + keyword-stuffing audit for the static TheAssetSquare sub-site.
 * Scans every .html page, measures Korean keyword density, detects duplicate
 * titles/descriptions and on-page SEO gaps. Exits non-zero on any ERROR so it
 * can gate CI / the daily GitHub Actions run.
 *
 * Usage:
 *   node scripts/seo-audit.js            # human report
 *   node scripts/seo-audit.js --json     # machine report (writes seo-report.json)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_HOST = 'https://realestate-ccw.pages.dev'; // sub-site self-canonical (matches sitemap)
const MAIN_SITE = 'https://theassetsquare.com'; // traffic destination

// Density thresholds (CLAUDE.md: primary+sub keyword density 1.5–2.5%).
// We gate the PAGE PRIMARY keyword (property name on detail pages, category
// keyword on category pages, 부동산분양 on home). The bare 2-char fragment
// "분양" is informational only: it is a substring of all 7 category keywords
// (아파트분양, 오피스텔분양 …) so on a listing page it is naturally inflated and
// is NOT a reliable stuffing signal — we still hard-gate it at 5% as a safety net.
const PRIMARY_MIN = 1.0;    // below = too thin (WARN)
const PRIMARY_MAX = 2.5;    // above = WARN (CLAUDE.md target ceiling)
const PRIMARY_STUFF = 3.5;  // primary keyword above this = ERROR (real stuffing)
const FRAGMENT_HARD = 5.0;  // bare "분양" fragment safety net (ERROR)
const WORD_STUFF = 5.0;     // any single repeated word above this = stuffing (ERROR)
const WORD_WARN = 4.0;      // 4–5% = investigate (WARN); topical category nouns can hit ~3.7%
const TITLE_MAX = 60;       // chars
const DESC_MIN = 80;
const DESC_MAX = 170;

const KEYWORDS_TRACKED = ['부동산분양', '분양', '청약', '분양가'];

// Per-page primary keyword. Detail pages resolve to the property name (JSON-LD).
const PRIMARY_BY_FILE = {
  'index.html': '부동산분양',
  'apt.html': '아파트분양', 'officetel.html': '오피스텔분양', 'commercial.html': '상가분양',
  'knowledge.html': '지식산업센터분양', 'land.html': '토지분양', 'industrial.html': '산업단지분양',
};
function resolvePrimary(rel, html, h1s) {
  if (PRIMARY_BY_FILE[rel]) return PRIMARY_BY_FILE[rel];
  const m = html.match(/"name":\s*"([^"]+)"/);     // JSON-LD name on detail pages
  if (m && m[1].length >= 3) return m[1];
  if (h1s[0]) return h1s[0].split(/[\s—–-]/)[0];
  return '부동산분양';
}

function listHtml() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;            // skip hidden tool dirs
      if (e.name === 'node_modules' || e.name === 'scripts') continue;
      if (e.name === '404.html') continue;             // utility page (noindex), not a content page
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  walk(ROOT);
  return out.sort();
}

function attr(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function density(text, kw) {
  if (!text.length) return 0;
  let n = 0, i = 0;
  while ((i = text.indexOf(kw, i)) !== -1) { n++; i += kw.length; }
  return { count: n, pct: +(((n * kw.length) / text.length) * 100).toFixed(2) };
}

// Bare-word stuffing detector: groups space-tokens by root (strips common Korean
// particles) and returns the single most-repeated word + its density. Catches
// over-repetition of a plain noun (e.g. 지식산업센터, 오피스텔) that the phrase-level
// primary-keyword check would miss.
const WORD_JOSA = ['으로서','으로써','에서는','에서','으로','이라는','이라고','입니다','습니다','합니다','됩니다','까지','부터','보다','마다','처럼','은','는','이','가','을','를','의','에','도','와','과','로','만'];
const WORD_STOP = new Set(['그리고','하지만','또한','있는','있습니다','없는','위해','통해','대한','가장','매우','모두','직접','바로','한곳']);
function topWord(text) {
  const total = text.replace(/\s/g, '').length || 1;
  const freq = {};
  for (const raw of text.split(' ')) {
    let t = raw.replace(/[^가-힣a-zA-Z0-9]/g, '');
    for (const j of WORD_JOSA) if (t.length > j.length + 1 && t.endsWith(j)) { t = t.slice(0, -j.length); break; }
    if (t.length < 2 || WORD_STOP.has(t) || /^[0-9]+$/.test(t)) continue;
    freq[t] = (freq[t] || 0) + 1;
  }
  let best = { word: '', count: 0, pct: 0 };
  for (const [w, c] of Object.entries(freq)) {
    const pct = +(((c * w.length) / total) * 100).toFixed(2);
    if (pct > best.pct) best = { word: w, count: c, pct };
  }
  return best;
}

function analyze(file) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const text = visibleText(html);
  const charLen = text.replace(/\s/g, '').length;

  const title = attr(html, /<title>([\s\S]*?)<\/title>/i);
  const desc = attr(html, /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
  const canonical = attr(html, /<link\s+rel=["']canonical["']\s+href=["']([\s\S]*?)["']/i);
  const ogImage = attr(html, /<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']/i);
  const ogTitle = attr(html, /<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i);
  const hasJsonLd = /application\/ld\+json/i.test(html);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => visibleText(m[1]));
  const h2count = (html.match(/<h2[^>]*>/gi) || []).length;
  const viewport = /name=["']viewport["']/i.test(html);

  const dens = {};
  for (const kw of KEYWORDS_TRACKED) dens[kw] = density(text, kw);
  const primary = resolvePrimary(rel, html, h1s);
  const primaryDensity = density(text, primary);
  const top = topWord(text);

  return {
    file: rel, title, desc, canonical, ogImage, ogTitle, hasJsonLd,
    h1: h1s, h1count: h1s.length, h2count, viewport, charLen, density: dens,
    primary, primaryDensity, topWord: top,
    rawHtml: html, vtext: text,
  };
}

// ── 2단계 콘텐츠 무결성 게이트 ──────────────────────────────────────────────
// 재발 방지: 본진 home行 광고카드(오인 막다른길)·절대규칙 금지어(무료/체험)·
// 과장(로또/역대급/초프리미엄)·미검증 시세차익·만료 청약 현재형/미래형 노출을 차단.
// 날짜 비교는 실행 시각(CI 매일 실행) 기준 — 하드코딩 아님.
const HYPE_WORDS = ['무료', '체험', '로또', '역대급', '초프리미엄'];
function contentGateIssues(html, vtext) {
  const out = [];
  const scan = html
    .replace(/<!--[\s\S]*?-->/g, ' ')          // 주석 제외
    .replace(/<script[\s\S]*?<\/script>/gi, ' '); // 스크립트(JSON-LD 등) 제외 — 제목/메타/본문은 유지

  // (1) 본진 home으로 가는 '현장 광고 카드'(card-link로 카드 전체를 감쌈) = 오인 막다른길
  if (/<a\b[^>]*href=["']https?:\/\/theassetsquare\.com\/?["'][^>]*class=["']card-link["']/i.test(html) ||
      /<a\b[^>]*class=["']card-link["'][^>]*href=["']https?:\/\/theassetsquare\.com\/?["']/i.test(html))
    out.push('본진 home行 광고 카드(card-link) — 오인 막다른길. 상세링크 or 제거, 콘텐츠 유지 시 card-cta 버튼으로 전환');

  // (2) 절대규칙 금지어 + 과장 (제목/메타/본문, 주석·스크립트 제외)
  for (const w of HYPE_WORDS)
    if (scan.includes(w)) out.push(`금지어 "${w}" — 절대규칙/과장 위반`);

  // (3) 미검증 시세차익 ("주변 시세 대비 N억 차익" 류, 출처 없음)
  if (/시세\s*대비[^<]{0,40}(차익|억\s*원?\s*이상)/.test(scan))
    out.push('미검증 시세차익 표현(출처 없음) — 제거/완화');

  // (5) 내부링크 .html (라이브 308 1홉 유발) — 클린 URL로 통일
  const htmlLink = html.match(/href=["']\/(?:property\/)?[a-z0-9-]+\.html["']/i);
  if (htmlLink) out.push(`내부링크 .html (308 유발): ${htmlLink[0]} — 클린 URL 사용`);

  // (6) JSON-LD url/item 에 .html
  if (/"(?:url|item)":\s*["'][^"']*\.html["']/.test(html))
    out.push('JSON-LD url/item 에 .html — 클린 URL 사용');

  // (4) 만료 청약을 현재형/미래형으로 노출 (오늘 기준)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const Y = today.getFullYear();
  let m;
  // 4a. 활성 배지 "청약접수 M.D~M.D" 의 마감일이 과거
  const reBadge = /청약접수\s*(\d{1,2})\.(\d{1,2})\s*~\s*(\d{1,2})\.(\d{1,2})/g;
  while ((m = reBadge.exec(vtext))) {
    const end = new Date(Y, (+m[3]) - 1, +m[4]);
    if (end < today) out.push(`만료 청약 현재형 배지: "${m[0]}" (마감 ${m[3]}/${m[4]})`);
  }
  // 4b. "YYYY년 M월 … 분양/청약 예정·시작·접수중" 의 해당 월이 과거
  const reYM = /(20\d\d)\s*년\s*(\d{1,2})\s*월[^<。]{0,18}(분양|청약)[^<。]{0,6}(예정|시작|접수\s*중)/g;
  while ((m = reYM.exec(vtext))) {
    const end = new Date(+m[1], +m[2], 0); // 해당 월 말일
    if (end < today) out.push(`만료 분양/청약 미래형: "${m[0].slice(0, 24)}…"`);
  }
  // 4c. "M월 D일 … 청약/접수 예정·시작·중" 의 날짜가 과거(연도 미표기 → 올해)
  const reMD = /(\d{1,2})\s*월\s*(\d{1,2})\s*일[^<。]{0,15}(청약|접수)[^<。]{0,6}(예정|시작|중)/g;
  while ((m = reMD.exec(vtext))) {
    const end = new Date(Y, (+m[1]) - 1, +m[2]);
    if (end < today) out.push(`만료 청약일 현재/미래형: "${m[0].slice(0, 24)}…"`);
  }
  return out;
}

function main() {
  const files = listHtml();
  const pages = files.map(analyze);
  const issues = []; // {sev:'ERROR'|'WARN', file, msg}
  const add = (sev, file, msg) => issues.push({ sev, file, msg });

  // Duplicate detection
  const byTitle = {}, byDesc = {};
  for (const p of pages) {
    if (p.title) (byTitle[p.title] = byTitle[p.title] || []).push(p.file);
    if (p.desc) (byDesc[p.desc] = byDesc[p.desc] || []).push(p.file);
  }
  for (const [t, fs_] of Object.entries(byTitle))
    if (fs_.length > 1) add('ERROR', fs_.join(', '), `중복 <title>: "${t}"`);
  for (const [d, fs_] of Object.entries(byDesc))
    if (fs_.length > 1) add('ERROR', fs_.join(', '), `중복 meta description`);

  for (const p of pages) {
    if (!p.title) add('ERROR', p.file, '<title> 없음');
    else if (p.title.length > TITLE_MAX) add('WARN', p.file, `title ${p.title.length}자 (>${TITLE_MAX})`);
    if (!p.desc) add('ERROR', p.file, 'meta description 없음');
    else if (p.desc.length < DESC_MIN || p.desc.length > DESC_MAX)
      add('WARN', p.file, `meta description ${p.desc.length}자 (권장 ${DESC_MIN}–${DESC_MAX})`);
    if (!p.canonical) add('ERROR', p.file, 'canonical 없음');
    else if (!p.canonical.startsWith(CANONICAL_HOST))
      add('ERROR', p.file, `canonical 도메인 불일치: ${p.canonical}`);
    if (!p.ogImage) add('ERROR', p.file, 'og:image 없음');
    else if (!/^https?:\/\//.test(p.ogImage)) add('WARN', p.file, `og:image 절대경로 아님: ${p.ogImage}`);
    if (!p.hasJsonLd) add('ERROR', p.file, 'JSON-LD 구조화데이터 없음');
    if (p.h1count === 0) add('ERROR', p.file, 'H1 없음');
    else if (p.h1count > 1) add('WARN', p.file, `H1 ${p.h1count}개 (1개 권장)`);
    if (!p.viewport) add('ERROR', p.file, 'viewport meta 없음 (모바일)');

    // Primary-keyword density (the gated metric, per CLAUDE.md)
    const pk = p.primaryDensity;
    if (pk.pct > PRIMARY_STUFF) add('ERROR', p.file, `대표키워드 스터핑 "${p.primary}" ${pk.pct}% (${pk.count}회, 한계 ${PRIMARY_STUFF}%)`);
    else if (pk.pct > PRIMARY_MAX) add('WARN', p.file, `대표키워드 "${p.primary}" 밀도 ${pk.pct}% (>${PRIMARY_MAX}%)`);
    else if (pk.pct < PRIMARY_MIN) add('WARN', p.file, `대표키워드 "${p.primary}" 밀도 ${pk.pct}% (<${PRIMARY_MIN}% 너무 낮음)`);
    // Fragment safety net
    if (p.density['분양'].pct > FRAGMENT_HARD)
      add('ERROR', p.file, `"분양" 단편 과다 ${p.density['분양'].pct}% (안전한계 ${FRAGMENT_HARD}%)`);
    // Bare-word stuffing (any single repeated word)
    const tw = p.topWord;
    if (tw && tw.pct > WORD_STUFF) add('ERROR', p.file, `단어 스터핑 "${tw.word}" ${tw.pct}% (${tw.count}회, 한계 ${WORD_STUFF}%)`);
    else if (tw && tw.pct > WORD_WARN) add('WARN', p.file, `반복 단어 "${tw.word}" ${tw.pct}% (>${WORD_WARN}%)`);

    // ── 2단계 콘텐츠 무결성 게이트 (깨진카드·과장·시세차익·신선도) ──
    for (const g of contentGateIssues(p.rawHtml, p.vtext)) add('ERROR', p.file, g);

    // ── 3단계: 상세 페이지 BreadcrumbList JSON-LD 필수 ──
    if (p.file.startsWith('property/') && !/"@type":\s*"BreadcrumbList"/.test(p.rawHtml))
      add('ERROR', p.file, 'BreadcrumbList JSON-LD 누락 (홈>카테고리>현장)');
  }

  // ── 3단계: sitemap.xml 은 클린 URL만 (.html 금지) ──
  try {
    const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    if (/<loc>[^<]*\.html<\/loc>/.test(sm)) add('ERROR', 'sitemap.xml', 'sitemap <loc> 에 .html — 클린 URL 사용');
  } catch (e) { /* sitemap 없으면 스킵 */ }

  const errors = issues.filter(i => i.sev === 'ERROR');
  const warns = issues.filter(i => i.sev === 'WARN');

  if (process.argv.includes('--json')) {
    // rawHtml/vtext 는 게이트 검사용 내부 필드 — 리포트에서 제외
    const slim = pages.map(({ rawHtml, vtext, ...rest }) => rest);
    fs.writeFileSync(path.join(ROOT, 'seo-report.json'),
      JSON.stringify({ generated: new Date().toISOString(), pageCount: pages.length, pages: slim, issues }, null, 2));
  }

  console.log(`\n=== SEO 감사: ${pages.length}개 페이지 ===\n`);
  for (const p of pages) {
    const bn = p.density['분양'];
    console.log(`${p.file}`);
    console.log(`  title(${p.title ? p.title.length : 0}): ${p.title || '—'}`);
    const tw = p.topWord || { word: '', pct: 0 };
    console.log(`  desc(${p.desc ? p.desc.length : 0})  대표 "${p.primary}" ${p.primaryDensity.pct}%(${p.primaryDensity.count})  분양frag ${bn.pct}%  최다단어 "${tw.word}" ${tw.pct}%  H1:${p.h1count} H2:${p.h2count}`);
  }
  console.log(`\n--- 이슈: ERROR ${errors.length} / WARN ${warns.length} ---`);
  for (const i of [...errors, ...warns]) console.log(`  [${i.sev}] ${i.file} :: ${i.msg}`);

  if (errors.length) { console.error(`\n❌ ERROR ${errors.length}건 — 수정 필요`); process.exit(1); }
  console.log(`\n✅ ERROR 0건${warns.length ? ` (WARN ${warns.length}건)` : ''}`);
}

main();
