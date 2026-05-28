#!/usr/bin/env node
/**
 * Generate unique 1200x1200 (1:1) OG images for every page.
 * Reads each page's <title>, derives a main line + hook, renders a premium
 * branded card to og/<slug>.png. Needs Noto Sans KR (auto-downloaded if absent)
 * and sharp. Run once after content changes:  node scripts/gen-og.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'og');
const FONT_DIR = path.join(os.homedir(), '.fonts');
const FONTS = {
  bold: { file: 'NotoSansKR-Bold.otf', url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf' },
  reg: { file: 'NotoSansKR-Regular.otf', url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf' },
};

function ensureFonts() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  for (const k of Object.keys(FONTS)) {
    const dest = path.join(FONT_DIR, FONTS[k].file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100000) continue;
    console.log('downloading font', FONTS[k].file);
    execFileSync('curl', ['-sL', FONTS[k].url, '-o', dest]);
  }
  // fontconfig file so sharp/resvg can find the fonts without system fc-cache
  const conf = path.join(os.tmpdir(), 'tas-fonts.conf');
  fs.writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${FONT_DIR}</dir><cachedir>${path.join(os.tmpdir(), 'tas-fontcache')}</cachedir></fontconfig>`);
  process.env.FONTCONFIG_FILE = conf;
}

const ACCENT = {
  'index.html': '#d4af37',
  'apt.html': '#2563eb', 'officetel.html': '#0891b2', 'commercial.html': '#d97706',
  'knowledge.html': '#7c3aed', 'land.html': '#16a34a', 'industrial.html': '#dc2626',
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pages() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'scripts' || e.name === 'og') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  walk(ROOT);
  return out.sort();
}

function deriveText(file) {
  const html = fs.readFileSync(file, 'utf8');
  const rawTitle = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1].trim();
  const parts = rawTitle.split(/\s+—\s+/);
  let main = parts[0] || '더에셋스퀘어';
  let sub = parts.slice(1).join(' — ') || '2026 부동산분양 핵심 현장';
  // index special-case for cleaner brand framing
  if (path.basename(file) === 'index.html') { main = '더에셋스퀘어'; sub = '2026 부동산분양 가장 뜨거운 곳'; }
  if (sub.length > 26) sub = sub.slice(0, 25) + '…';
  return { main, sub };
}

function svgFor(main, sub, accent) {
  const n = [...main].length;
  const mainSize = Math.max(52, Math.min(104, Math.floor(1000 / Math.max(n, 1))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16243f"/><stop offset="1" stop-color="#0b1426"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="12" fill="${accent}"/>
  <rect x="0" y="1188" width="1200" height="12" fill="${accent}"/>
  <text x="600" y="330" font-family="Noto Sans CJK KR, Noto Sans KR" font-size="40" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="14">더에셋스퀘어</text>
  <text x="600" y="380" font-family="Noto Sans CJK KR, Noto Sans KR" font-size="24" fill="#9fb2cc" text-anchor="middle" letter-spacing="8">THE ASSET SQUARE</text>
  <text x="600" y="600" font-family="Noto Sans CJK KR, Noto Sans KR" font-size="${mainSize}" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(main)}</text>
  <rect x="540" y="660" width="120" height="6" rx="3" fill="${accent}"/>
  <text x="600" y="760" font-family="Noto Sans CJK KR, Noto Sans KR" font-size="46" fill="#dbe5f3" text-anchor="middle">${esc(sub)}</text>
  <rect x="430" y="900" width="340" height="84" rx="42" fill="none" stroke="${accent}" stroke-width="3"/>
  <text x="600" y="955" font-family="Noto Sans CJK KR, Noto Sans KR" font-size="40" font-weight="700" fill="${accent}" text-anchor="middle">2026 부동산분양</text>
</svg>`;
}

async function main() {
  ensureFonts();
  const sharp = require('sharp');
  fs.mkdirSync(OUT, { recursive: true });
  const list = pages();
  let count = 0;
  for (const file of list) {
    const rel = path.relative(ROOT, file);
    const base = path.basename(file);
    const accent = ACCENT[rel] || '#d4af37';
    const { main: m, sub } = deriveText(file);
    const slug = rel.replace(/\.html$/, '').replace(/[\/]/g, '-'); // property/foo -> property-foo
    const svg = svgFor(m, sub, accent);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, slug + '.png'));
    count++;
    console.log('og/' + slug + '.png  <-  ' + rel + '  [' + m + ']');
  }
  // default fallback used by root og-image.png reference
  fs.copyFileSync(path.join(OUT, 'index.png'), path.join(ROOT, 'og-image.png'));
  console.log(`\n✅ ${count} OG images generated in og/  (+ og-image.png fallback)`);
}
main().catch(e => { console.error(e); process.exit(1); });
