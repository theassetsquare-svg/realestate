/**
 * description 을 70~80자에 맞춘다.
 *
 * 왜 필요한가
 *   규정은 70~80자인데 한국어는 눈으로 세기 어렵다. 매번 짧게 써 놓고
 *   검문에서 걸리고 다시 고치기를 반복했다. 그 왕복을 없앤다.
 *
 * 어떻게 하나
 *   짧으면 뒤에 덧붙일 말을 하나씩 붙여 보고 70~80 안에 들어오는 조합을 쓴다.
 *   길면 손대지 않고 알려만 준다(줄이는 건 뜻이 상할 수 있어 사람이 해야 한다).
 *   description 은 <meta> 속성이라 본문 문장 겹침(G5) 계산에 들어가지 않는다.
 *   그래서 덧붙이는 말이 페이지끼리 같아도 문제되지 않는다.
 *
 *   node tools/night/fit-desc.mjs          무엇을 바꿀지 보여만 준다
 *   node tools/night/fit-desc.mjs --apply  실제로 고친다
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('D:/naver-watch/repos/realestate/tools/night/content');
const APPLY = process.argv.includes('--apply');
const MIN = 70, MAX = 80;

/* 뒤에 덧붙일 말 — 짧은 것부터 긴 것까지 */
const TAILS = [
  ' 방문 전 확인이 필요한 항목도 함께 적었습니다.',
  ' 확인된 사실과 확인 안 된 것을 나눠 적었습니다.',
  ' 공개된 정보를 기준으로 정리한 내용입니다.',
  ' 확인되지 않은 항목은 비워 두었습니다.',
  ' 확인된 것만 골라 정리했습니다.',
  ' 공개 정보 기준입니다.',
];

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'))
  .sort((a, b) => Number(path.basename(a, '.mjs')) - Number(path.basename(b, '.mjs')));

let fixed = 0, tooLong = [], ok = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  const m = src.match(/description:\s*\n?\s*'([^']*)'/);
  if (!m) { console.log(`★ ${f} description 을 못 찾음`); continue; }
  const cur = m[1];
  if (cur.length >= MIN && cur.length <= MAX) { ok++; continue; }
  if (cur.length > MAX) { tooLong.push(`${f} ${cur.length}자`); continue; }

  /* 덧붙여 범위 안에 들어오는 조합 찾기 */
  const pick = TAILS.find((t) => {
    const n = cur.length + t.length;
    return n >= MIN && n <= MAX;
  });
  if (!pick) { console.log(`★ ${f} ${cur.length}자 — 붙일 말로는 범위를 못 맞춘다. 본문을 손봐야 한다`); continue; }
  const next = cur + pick;
  console.log(`  ${f} ${cur.length} → ${next.length}자`);
  if (APPLY) fs.writeFileSync(p, src.replace(m[0], `description:\n    '${next}'`), 'utf8');
  fixed++;
}

console.log(`\n이미 맞는 것 ${ok}개 / 고칠 것 ${fixed}개${tooLong.length ? ' / 너무 긴 것: ' + tooLong.join(', ') : ''}`);
if (!APPLY && fixed) console.log('실제로 고치려면 --apply 를 붙인다');
