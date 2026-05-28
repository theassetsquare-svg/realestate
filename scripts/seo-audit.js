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

  return {
    file: rel, title, desc, canonical, ogImage, ogTitle, hasJsonLd,
    h1: h1s, h1count: h1s.length, h2count, viewport, charLen, density: dens,
    primary, primaryDensity,
  };
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
  }

  const errors = issues.filter(i => i.sev === 'ERROR');
  const warns = issues.filter(i => i.sev === 'WARN');

  if (process.argv.includes('--json')) {
    fs.writeFileSync(path.join(ROOT, 'seo-report.json'),
      JSON.stringify({ generated: new Date().toISOString(), pageCount: pages.length, pages, issues }, null, 2));
  }

  console.log(`\n=== SEO 감사: ${pages.length}개 페이지 ===\n`);
  for (const p of pages) {
    const bn = p.density['분양'];
    console.log(`${p.file}`);
    console.log(`  title(${p.title ? p.title.length : 0}): ${p.title || '—'}`);
    console.log(`  desc(${p.desc ? p.desc.length : 0})  대표 "${p.primary}" ${p.primaryDensity.pct}%(${p.primaryDensity.count})  분양frag ${bn.pct}%  H1:${p.h1count} H2:${p.h2count}  text:${p.charLen}자`);
  }
  console.log(`\n--- 이슈: ERROR ${errors.length} / WARN ${warns.length} ---`);
  for (const i of [...errors, ...warns]) console.log(`  [${i.sev}] ${i.file} :: ${i.msg}`);

  if (errors.length) { console.error(`\n❌ ERROR ${errors.length}건 — 수정 필요`); process.exit(1); }
  console.log(`\n✅ ERROR 0건${warns.length ? ` (WARN ${warns.length}건)` : ''}`);
}

main();
