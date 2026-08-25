/**
 * 검문 G1~G17 — 하나라도 실패하면 배포 금지 (exit 1)
 *   node tools/night/gate.mjs
 *
 * 만든 페이지만 검사한다(집필 중에도 돌릴 수 있게). 40개가 다 있어야 통과하는 항목은
 * "전부 있을 때만" 검사한다고 표시한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AD } from './render.mjs';

const ROOT = path.resolve('D:/naver-watch/repos/realestate');
const HERE = path.join(ROOT, 'tools/night');
const venues = JSON.parse(fs.readFileSync(path.join(HERE, 'venues.json'), 'utf8'));

const AD_DIGITS = new Set(Object.values(AD).map((a) => a.phone.replace(/\D/g, '')));
const digits = (s) => String(s).replace(/\D/g, '');
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const fails = [];
const fail = (g, msg, samples = []) => fails.push({ g, msg, samples: samples.slice(0, 6) });

/* 만들어진 페이지 모으기 */
const pages = [];
for (const v of venues) {
  const f = path.join(ROOT, v.path, 'index.html');
  if (fs.existsSync(f)) pages.push({ v, html: read(f), rel: `${v.path}/index.html` });
}
const complete = pages.length === venues.length;
console.log(`검사 대상 ${pages.length}/${venues.length}개${complete ? '' : ' (아직 집필 중)'}\n`);

/* 기존 페이지(부동산) 목록 — G4·G5 대조용. 새로 만든 폴더는 뺀다. */
const newDirs = new Set(venues.map((v) => v.path));
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'tools', 'og'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!newDirs.has(e.name)) walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const oldFiles = walk(ROOT);
const oldTitles = oldFiles.map((f) => read(f).match(/<title>([^<]*)<\/title>/i)?.[1] || '').filter(Boolean);
const oldSentences = new Set();
for (const f of oldFiles) for (const s of strip(read(f)).split(/[.!?]/).map((x) => x.trim())) if (s.length >= 20) oldSentences.add(s);

/**
 * ★사이트 교차 검사 — 이미 배포한 다른 부동산 사이트의 나이트 페이지도 대조 대상에 넣는다.
 *
 * 같은 가게 40곳을 네 사이트에 쓰기 때문에, 사이트 안에서만 검사하면
 * k 와 m 이 서로 비슷해지는 것을 못 잡는다. 네이버는 비슷한 문서 중 원본만 남기고
 * 나머지를 검색에서 뺀다. 그러면 한쪽 40개가 통째로 버려진다.
 */
const SIBLINGS = [
  { key: 'm', root: 'D:/naver-watch/repos/realestate2' },
  { key: 'n', root: 'D:/naver-watch/repos/realestate3' },
  { key: 'l', root: 'D:/naver-watch/repos/realestate1' },
];
const sibSentences = new Map();   // 문장 → "m/12" 처럼 어디 것인지
let sibPages = 0;
for (const s of SIBLINGS) {
  for (let i = 1; i <= 40; i++) {
    const f = path.join(s.root, String(i), 'index.html');
    if (!fs.existsSync(f)) continue;
    sibPages++;
    const html = read(f).replace(/<table[\s\S]*?<\/table>/gi, ' ');
    for (const t of strip(html).split(/[.!?]/).map((x) => x.trim())) {
      if (t.length >= 20 && !sibSentences.has(t)) sibSentences.set(t, `${s.key}/${i}`);
    }
  }
}
if (sibPages) console.log(`다른 사이트 나이트 페이지 ${sibPages}개와도 문장을 대조한다\n`);

/* ── G1 금지어 ───────────────────────────────────── */
const BAN = ['룸살롱', '룸싸롱', '노래방', '밤문화', '유흥', '2차'];
{
  const hit = [];
  for (const p of pages) {
    const txt = strip(p.html);
    for (const b of BAN) {
      /* "업종: 나이트클럽 (유흥주점)" 은 사실 표의 확정 업종 표기다. 그 형태만 예외. */
      if (b === '유흥' && !txt.replace(/유흥주점/g, '').includes('유흥')) continue;
      if (txt.includes(b)) hit.push(`${p.rel} → ${b}`);
    }
  }
  if (hit.length) fail('G1', `금지어 ${hit.length}건`, hit);
}

/* ── G2 평점·별점 ────────────────────────────────── */
{
  const hit = pages.filter((p) => /aggregateRating|★|별점|평점/.test(p.html)).map((p) => p.rel);
  if (hit.length) fail('G2', `평점·별 표기 ${hit.length}건`, hit);
}

/* ── G3 창작 수치 (방문자수·잔여석·후기 인용) ─────── */
{
  const hit = [];
  for (const p of pages) {
    const t = strip(p.html);
    for (const re of [/방문자\s*\d/, /잔여\s*\d/, /남은\s*자리\s*\d/, /후기에?\s*따르면/, /\d+\s*명이\s*다녀/]) {
      if (re.test(t)) hit.push(`${p.rel} → ${re}`);
    }
  }
  if (hit.length) fail('G3', `확인 안 된 수치 ${hit.length}건`, hit);
}

/* ── G4 제목 ─────────────────────────────────────── */
{
  const seen = new Map(), bad = [];
  for (const p of pages) {
    const t = p.html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
    if (!t.startsWith(p.v.name)) bad.push(`${p.rel} → 제목이 가게이름으로 시작하지 않음: ${t}`);
    if (t.length < 20 || t.length > 30) bad.push(`${p.rel} → 제목 ${t.length}자 (20~30 아님): ${t}`);
    if (seen.has(t)) bad.push(`${p.rel} → 제목 중복 (${seen.get(t)})`);
    seen.set(t, p.rel);
    if (oldTitles.includes(t)) bad.push(`${p.rel} → 기존 페이지 제목과 중복`);
    const h1 = p.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.trim();
    const ogt = p.html.match(/property="og:title" content="([^"]*)"/)?.[1];
    if (h1 !== t || ogt !== t) bad.push(`${p.rel} → title·h1·og:title 불일치`);
    if ((p.html.match(/<h1[^>]*>/gi) || []).length !== 1) bad.push(`${p.rel} → h1 이 1개가 아님`);
  }
  if (bad.length) fail('G4', `제목 문제 ${bad.length}건`, bad);
}

/* ── G5 문장 재사용 (신규끼리 + 신규↔기존). 사실 표는 제외(태그 밖 텍스트만 본다) ── */
{
  const sentsOf = (p) => {
    const body = p.html.replace(/<table[\s\S]*?<\/table>/gi, ' ');
    return [...new Set(strip(body).split(/[.!?]/).map((s) => s.trim()).filter((s) => s.length >= 20))];
  };
  const map = pages.map((p) => ({ rel: p.rel, s: sentsOf(p) }));
  const bad = [];
  for (let i = 0; i < map.length; i++) {
    const vsOld = map[i].s.filter((s) => oldSentences.has(s));
    if (vsOld.length >= 3) bad.push(`${map[i].rel} ↔ 기존 페이지 : ${vsOld.length}문장 공유`);
    /* ★다른 부동산 사이트의 나이트 페이지와도 대조 */
    const vsSib = map[i].s.filter((s) => sibSentences.has(s));
    if (vsSib.length >= 3) {
      const where = [...new Set(vsSib.map((s) => sibSentences.get(s)))].join(', ');
      bad.push(`${map[i].rel} ↔ 다른 사이트(${where}) : ${vsSib.length}문장 공유 (예: ${vsSib[0].slice(0, 30)})`);
    }
    for (let j = i + 1; j < map.length; j++) {
      const set = new Set(map[j].s);
      const sh = map[i].s.filter((s) => set.has(s));
      if (sh.length >= 3) bad.push(`${map[i].rel} ↔ ${map[j].rel} : ${sh.length}문장 공유 (예: ${sh[0].slice(0, 30)})`);
    }
  }
  if (bad.length) fail('G5', `20자+ 동일 문장 3개 이상 공유 ${bad.length}쌍`, bad);
}

/* ── G6 본문 분량 ────────────────────────────────── */
{
  const bad = [];
  for (const p of pages) {
    const body = strip(p.html.replace(/<table[\s\S]*?<\/table>/gi, ' ')).replace(/\s/g, '');
    if (body.length < 1800) bad.push(`${p.rel} → ${body.length}자 (1,800 미만)`);
    if (body.length > 2500) bad.push(`${p.rel} → ${body.length}자 (2,500 초과)`);
  }
  if (bad.length) fail('G6', `분량 문제 ${bad.length}건`, bad);
}

/* ── G7 링크가 실제로 존재하는가 ─────────────────── */
{
  const bad = [];
  for (const p of pages) {
    for (const m of p.html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
      const h = m[1];
      if (/^(tel:|https:\/\/open\.kakao\.com)/.test(h)) continue;
      /* ★끝에 슬래시가 있어야 한다. Cloudflare 가 /1 → 308 → /1/ 로 넘기기 때문에
         슬래시 없는 주소를 쓰면 링크마다 리다이렉트가 한 번씩 낀다. */
      if (!/^\/\d+\/$/.test(h)) { bad.push(`${p.rel} → 허용 안 된 링크 ${h}`); continue; }
      const dir = h.replace(/^\//, '').replace(/\/$/, '');
      if (!fs.existsSync(path.join(ROOT, dir, 'index.html'))) bad.push(`${p.rel} → 없는 주소 ${h}`);
    }
  }
  if (bad.length) fail('G7', `링크 문제 ${bad.length}건`, bad);
}

/* ── G8 필수 요소 ────────────────────────────────── */
{
  const need = [
    ['naver-site-verification', /naver-site-verification/],
    ['canonical', /rel="canonical"/],
    ['NightClub JSON-LD', /"@type":"NightClub"/],
    ['FAQPage JSON-LD', /"@type":"FAQPage"/],
    ['전화바', /class="callbar"/],
    ['푸터 besta12', /광고문의 카톡: besta12/],
    ['og:image', /property="og:image"/],
  ];
  const bad = [];
  for (const p of pages) for (const [n, re] of need) if (!re.test(p.html)) bad.push(`${p.rel} → ${n} 없음`);
  if (bad.length) fail('G8', `필수 요소 누락 ${bad.length}건`, bad);
}

/* ── G9 썸네일 실측 + 메타 9종 ───────────────────── */
{
  const mf = path.join(ROOT, 'og/manifest.json');
  const man = fs.existsSync(mf) ? JSON.parse(read(mf)) : {};
  const metas = ['property="og:image"', 'og:image:secure_url', 'og:image:width" content="1200"',
    'og:image:height" content="1200"', 'og:image:type" content="image/png"', 'og:image:alt',
    'name="twitter:card"', 'name="twitter:image"', 'name="thumbnail"'];
  const bad = [];
  for (const p of pages) {
    const png = path.join(ROOT, 'og', `${p.v.path}.png`);
    if (!fs.existsSync(png)) { bad.push(`${p.rel} → 썸네일 파일 없음`); continue; }
    const sz = fs.statSync(png).size;
    if (sz > 300 * 1024) bad.push(`${p.rel} → 썸네일 ${(sz / 1024).toFixed(0)}KB (300KB 초과)`);
    const r = man[`${p.v.path}.png`];
    if (!r) bad.push(`${p.rel} → manifest 누락`);
    else if (r.width !== 1200 || r.height !== 1200) bad.push(`${p.rel} → 썸네일 ${r.width}x${r.height}`);
    for (const m of metas) if (!p.html.includes(m)) bad.push(`${p.rel} → 메타 없음 ${m}`);
    if (!new RegExp(`<img src="/og/${p.v.path}\\.png"[^>]*width="1200"[^>]*height="1200"`).test(p.html))
      bad.push(`${p.rel} → 본문 img 누락`);
  }
  if (bad.length) fail('G9', `썸네일 문제 ${bad.length}건`, bad);
}

/* ── G10 광고주 번호 ─────────────────────────────── */
{
  const bad = [];
  for (const p of pages) {
    const nums = [...new Set([...p.html.matchAll(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/g)].map((m) => digits(m[0])))];
    for (const n of nums) if (!AD_DIGITS.has(n)) bad.push(`${p.rel} → 정답표에 없는 번호 ${n}`);
    if (nums.length > 1) bad.push(`${p.rel} → 한 페이지에 ${nums.length}개 번호`);
    const mine = AD[p.v.name];
    if (mine && !nums.includes(digits(mine.phone))) bad.push(`${p.rel} → 자기 광고주 번호가 없음`);
    if (!mine && nums.length) bad.push(`${p.rel} → 광고주 아닌데 번호가 있음`);
  }
  if (bad.length) fail('G10', `번호 문제 ${bad.length}건`, bad);
}

/* ── G11 키워드 배치 ─────────────────────────────── */
{
  const bad = [];
  for (const p of pages) {
    const n = p.v.name;
    const t = p.html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
    if (!t.startsWith(n)) bad.push(`${p.rel} → title 맨 앞 아님`);
    const d = p.html.match(/name="description" content="([^"]*)"/)?.[1] || '';
    const dn = (d.match(new RegExp(n, 'g')) || []).length;
    if (dn !== 1) bad.push(`${p.rel} → description 안 가게이름 ${dn}회 (1회여야 함)`);
    if (d.length < 70 || d.length > 80) bad.push(`${p.rel} → description ${d.length}자 (70~80 아님)`);
    const h2s = [...p.html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1]));
    if (!h2s.some((h) => h.includes(n))) bad.push(`${p.rel} → H2 중 가게이름 든 것이 없음`);
    const q = h2s.filter((h) => h.includes('?')).length;
    if (q < 2) bad.push(`${p.rel} → 질문형 H2 ${q}개 (2개 이상 필요)`);
    if (h2s.length < 5 || h2s.length > 7) bad.push(`${p.rel} → H2 ${h2s.length}개 (앵글 4~6 + FAQ 1)`);
    const body = strip(p.html.replace(/<table[\s\S]*?<\/table>/gi, ' '));
    const cnt = (body.match(new RegExp(n, 'g')) || []).length;
    if (cnt < 3 || cnt > 5) bad.push(`${p.rel} → 본문 가게이름 ${cnt}회 (3~5 아님)`);
  }
  if (bad.length) fail('G11', `키워드 배치 ${bad.length}건`, bad);
}

/* ── G13 다른 가게이름이 새 페이지에 있는가 (근처 링크는 예외) ── */
{
  const names = venues.map((v) => v.name);
  const bad = [];
  for (const p of pages) {
    const near = new Set(p.v.near.map((n) => n.name));
    const body = strip(p.html.replace(/<div class="near">[\s\S]*?<\/div>/i, ' '));
    for (const n of names) {
      if (n === p.v.name || near.has(n)) continue;
      if (body.includes(n)) bad.push(`${p.rel} → ${n}`);
    }
  }
  if (bad.length) fail('G13', `남의 가게이름 ${bad.length}건`, bad);
}

/* ── G15 썸네일 주인공 크기 ──────────────────────── */
{
  const mf = path.join(ROOT, 'og/manifest.json');
  const man = fs.existsSync(mf) ? JSON.parse(read(mf)) : {};
  const bad = [];
  for (const p of pages) {
    const r = man[`${p.v.path}.png`];
    if (!r?.rows) { bad.push(`${p.rel} → 실측값 없음`); continue; }
    if (AD[p.v.name]) {
      if (r.rows.phone.w < 972) bad.push(`${p.rel} → 번호 폭 ${r.rows.phone.w}px (972 미만)`);
      const others = [r.rows.name.w, r.rows.nick.w, r.rows.ad.w];
      if (others.some((w) => w >= r.rows.phone.w)) bad.push(`${p.rel} → 번호가 가장 큰 글자가 아님`);
      if (r.rows.nick.h < 170) bad.push(`${p.rel} → 닉네임 높이 ${r.rows.nick.h}px (170 미만)`);
    } else {
      if (r.rows.hero.h < 240) bad.push(`${p.rel} → 광고문의 높이 ${r.rows.hero.h}px (240 미만)`);
      if (r.rows.kakao.h < 120) bad.push(`${p.rel} → 카카오톡 높이 ${r.rows.kakao.h}px (120 미만)`);
      if (r.rows.hero.pct < 0.75 || r.rows.hero.pct > 0.85) bad.push(`${p.rel} → 광고문의 폭 ${(r.rows.hero.pct * 100).toFixed(0)}% (75~85 아님)`);
      if (r.rows.name.pct < 0.55 || r.rows.name.pct > 0.65) bad.push(`${p.rel} → 가게이름 폭 ${(r.rows.name.pct * 100).toFixed(0)}%`);
    }
  }
  if (bad.length) fail('G15', `썸네일 크기 ${bad.length}건`, bad);
}

/* ── G16 FAQ 질문이 전부 다른가 ──────────────────── */
{
  const seen = new Map(), bad = [];
  for (const p of pages) {
    for (const m of p.html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)) {
      const q = strip(m[1]);
      if (seen.has(q)) bad.push(`${p.rel} → FAQ 중복 "${q}" (${seen.get(q)})`);
      seen.set(q, p.rel);
    }
    const n = [...p.html.matchAll(/<details>/g)].length;
    if (n !== 3) bad.push(`${p.rel} → FAQ ${n}문항 (3문항이어야 함)`);
  }
  if (bad.length) fail('G16', `FAQ 문제 ${bad.length}건`, bad);
}

/* ── G17 링크 사슬 (전부 만들어졌을 때만) ────────── */
if (complete) {
  const graph = new Map(venues.map((v) => [v.path, v.near.map((n) => n.path)]));
  const seen = new Set(); const stack = [venues[0].path];
  while (stack.length) { const c = stack.pop(); if (seen.has(c)) continue; seen.add(c); for (const n of graph.get(c) || []) stack.push(n); }
  if (seen.size !== venues.length) fail('G17', `사슬이 끊겼다 — ${seen.size}/${venues.length}만 순회됨`);
  for (const v of venues) if (v.near.length < 2 || v.near.length > 3) fail('G17', `/${v.path} 근처 링크 ${v.near.length}개 (2~3 아님)`);
}

/* ── 결과 ────────────────────────────────────────── */
console.log('='.repeat(60));
if (!fails.length) {
  console.log(`검문 통과 — ${pages.length}개 페이지 이상 없음${complete ? '' : ' (아직 집필 중이라 G17 은 보류)'}`);
  process.exit(0);
}
console.log(`★ 검문 실패 ${fails.length}항목`);
for (const f of fails) {
  console.log(`\n[${f.g}] ${f.msg}`);
  for (const s of f.samples) console.log('   · ' + s);
}
process.exit(1);
