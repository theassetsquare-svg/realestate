/**
 * 분량이 모자란 페이지와 **부족한 글자 수**를 한 번에 보여 준다.
 *
 * 왜 필요한가
 *   검문은 실패 목록을 화면에 잘라서 보여 준다. 그래서 한두 개씩 고치다 보면
 *   뒤에 가려진 페이지를 놓치고 같은 왕복을 반복하게 된다.
 *   여기서는 전 페이지를 한 번에 재고 몇 자가 모자란지 숫자로 준다.
 *
 *   node tools/night/short.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('D:/naver-watch/repos/realestate');
const MIN = 1800, TARGET = 1900;   // 목표를 1,900 으로 잡아 여유를 둔다
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const rows = [];
for (let i = 1; i <= 40; i++) {
  const f = path.join(ROOT, String(i), 'index.html');
  if (!fs.existsSync(f)) continue;
  const body = strip(fs.readFileSync(f, 'utf8').replace(/<table[\s\S]*?<\/table>/gi, ' ')).replace(/\s/g, '');
  rows.push({ n: i, len: body.length });
}
const short = rows.filter((r) => r.len < MIN);
const over = rows.filter((r) => r.len > 2500);

console.log(`만들어진 페이지 ${rows.length}개 — 모자란 것 ${short.length}개 / 넘친 것 ${over.length}개\n`);
if (short.length) {
  console.log('부족분 (목표 1,900자 기준):');
  for (const r of short) console.log(`  /${String(r.n).padEnd(3)} ${r.len}자  → ${TARGET - r.len}자 더 필요`);
}
if (over.length) for (const r of over) console.log(`  ★ /${r.n} ${r.len}자 — 2,500 초과, 줄여야 함`);
if (!short.length && !over.length) console.log('전부 범위 안에 있다 (1,800 ~ 2,500)');
