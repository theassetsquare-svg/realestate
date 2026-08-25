/**
 * 초안 자가검사 — 빌드하기 전에 길이와 겹침을 먼저 본다.
 *   node tools/night/check-draft.mjs
 *
 * 검문(gate.mjs)은 만들어진 HTML 을 보지만, 이건 원고(content/*.mjs)를 본다.
 * 매번 빌드 → 검문 → 되돌아와 고치기를 반복하지 않으려고 만들었다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.resolve('D:/naver-watch/repos/realestate/tools/night');
const DIR = path.join(HERE, 'content');
const venues = JSON.parse(fs.readFileSync(path.join(HERE, 'venues.json'), 'utf8'));
const byPath = Object.fromEntries(venues.map((v) => [v.path, v]));

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'))
  .sort((a, b) => Number(path.basename(a, '.mjs')) - Number(path.basename(b, '.mjs')));

const bad = [];
const allSent = new Map();   // 문장 → [페이지…]

for (const f of files) {
  const n = path.basename(f, '.mjs');
  const c = (await import(pathToFileURL(path.join(DIR, f)).href + '?t=' + Date.now())).default;
  const v = byPath[n];
  const name = v?.name || '?';

  /* 본문 = 렌더러가 실제로 검문 대상으로 삼는 범위(사실 표 제외)에 맞춘 근사치 */
  const bodyParts = [
    c.title, ...c.lead, ...c.answer3, ...c.sections.flatMap((s) => [s.h2, ...s.body, s.note || '']),
    ...c.reveal, c.action, ...c.faq.flatMap((q) => [q.q, q.a]), c.summary, c.thumbTopic,
  ];
  const body = bodyParts.join('').replace(/\s/g, '');
  /* <title> 과 <h1> 로 제목이 두 번 들어가므로 한 번 더 더하고,
     렌더러가 고정으로 넣는 글자(머리말·캡션·"핵심 3줄"·"제목의 답"·근처 링크 이름·
     "자주 묻는 질문"·"한 줄 정리"·푸터·광고문의 상자·작성일)를 더한다.
     ★이 보정값 90 은 검문(gate.mjs) 실측과 맞춰 정한 값이다.
     보정 전에는 검문보다 90자쯤 낮게 나와, 통과한 페이지를 미달로 잘못 표시했다. */
  const nearChars = (v?.near || []).reduce((a, x) => a + x.name.length, 0);
  const approx = body.length + c.title.replace(/\s/g, '').length + 90 + nearChars;

  const t = c.title.length, d = c.description.length;
  const h2s = c.sections.map((s) => s.h2);
  const q = h2s.filter((h) => h.includes('?')).length;
  const nameInH2 = h2s.filter((h) => h.includes(name)).length;
  const nameCount = (bodyParts.join(' ').match(new RegExp(name, 'g')) || []).length + 1; // <title>+<h1>

  const issues = [];
  if (t < 20 || t > 30) issues.push(`제목 ${t}자`);
  if (!c.title.startsWith(name)) issues.push('제목이 가게이름으로 시작 안 함');
  if (d < 70 || d > 80) issues.push(`설명 ${d}자`);
  if ((c.description.match(new RegExp(name, 'g')) || []).length !== 1) issues.push('설명 안 가게이름 1회 아님');
  if (approx < 1850) issues.push(`본문 약 ${approx}자 (여유 없음)`);
  if (approx > 2450) issues.push(`본문 약 ${approx}자 (초과 위험)`);
  if (q < 2) issues.push(`질문형 H2 ${q}개`);
  if (nameInH2 !== 1) issues.push(`H2 속 가게이름 ${nameInH2}개`);
  if (nameCount < 3 || nameCount > 5) issues.push(`가게이름 총 ${nameCount}회`);
  if (c.sections.length < 4 || c.sections.length > 6) issues.push(`구역 ${c.sections.length}개`);
  if (c.faq.length !== 3) issues.push(`FAQ ${c.faq.length}문항`);
  if (!c.lead[0].includes(name)) issues.push('첫 문장에 가게이름 없음');

  for (const s of bodyParts.join('\n').split(/[.!?\n]/).map((x) => x.trim())) {
    if (s.length < 20) continue;
    if (!allSent.has(s)) allSent.set(s, []);
    allSent.get(s).push(n);
  }

  console.log(`  /${n.padEnd(3)} ${name.padEnd(20)} 제목 ${t} · 설명 ${d} · 본문≈${approx} ${issues.length ? '★ ' + issues.join(' / ') : ''}`);
  if (issues.length) bad.push(n);
}

/* 페이지 쌍별 공유 문장 수 */
const pairs = new Map();
for (const [s, list] of allSent) {
  if (list.length < 2) continue;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const k = `${list[i]}↔${list[j]}`;
    if (!pairs.has(k)) pairs.set(k, []);
    pairs.get(k).push(s);
  }
}
const risky = [...pairs].filter(([, v]) => v.length >= 2);
console.log('');
if (risky.length) {
  console.log('겹치는 문장이 있는 쌍 (3개 이상이면 검문 실패):');
  for (const [k, v] of risky) console.log(`  ${k} : ${v.length}문장 — 예) ${v[0].slice(0, 34)}`);
} else console.log('겹치는 문장 없음');

console.log(`\n손볼 페이지 ${bad.length}개${bad.length ? ': ' + bad.join(',') : ''}`);
process.exit(bad.length || risky.some(([, v]) => v.length >= 3) ? 1 : 0);
