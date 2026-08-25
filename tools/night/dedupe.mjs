/**
 * 페이지끼리 겹치는 "안내 문장"을 원고에서 걷어낸다.
 *
 * 왜 필요한가
 *   40개 페이지에는 성격상 같은 말을 해야 하는 자리가 있다(확인 불가·업소 방침 안내).
 *   이걸 원고마다 손으로 쓰면 표현이 겹치고, 겹친 문장이 한 쌍에 3개만 쌓여도 검문 G5 가 막는다.
 *   실제로 고칠 때마다 다른 쌍에서 또 터졌다. 그래서 손으로 막지 않고 구조를 바꾼다.
 *
 * 무엇을 하나
 *   여러 파일에 똑같이 들어간 문장 중 **안내 성격의 문장만** 골라, 가장 앞 번호 파일에만 남기고
 *   나머지에서는 지운다. 지운 자리는 렌더러가 페이지마다 다른 안내 한 줄을 대신 넣는다
 *   (render.mjs 의 노트 줄 — phrases.mjs 의 말투 풀에서 페이지 번호로 뽑는다).
 *
 *   node tools/night/dedupe.mjs          무엇을 지울지 보여만 준다
 *   node tools/night/dedupe.mjs --apply  실제로 지운다
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('D:/naver-watch/repos/realestate/tools/night/content');
const APPLY = process.argv.includes('--apply');

/* 안내 성격인지 판단 — 이 낱말이 들어간 문장만 대상으로 삼는다.
   실제 내용을 담은 문장은 건드리지 않기 위해서다. */
const GENERIC = /(확인|규정|방침|근거|자료|업소|매장|연령|입장 조건|출입)/;

/* ★핵심 3줄(위치·가는 법·특징 …)은 지우면 안 된다. 페이지 구조가 무너진다.
   겹치면 지우는 게 아니라 표현을 바꿔야 하는 자리다. */
const ANSWER_LINE = /^(위치|가는 법|특징|구조|상권|주소)\s*—/;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'))
  .sort((a, b) => Number(path.basename(a, '.mjs')) - Number(path.basename(b, '.mjs')));

/* 파일마다 문장 뽑기 — 원고는 작은따옴표 문자열 배열이라 그대로 읽는다 */
const sentsOf = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/'([^']{20,})'/g)) {
    for (const s of m[1].split(/(?<=[.!?])\s+/)) {
      const t = s.trim();
      if (t.length >= 20) out.add(t);
    }
  }
  return out;
};

const perFile = files.map((f) => ({ f, src: fs.readFileSync(path.join(DIR, f), 'utf8') }));
for (const o of perFile) o.sents = sentsOf(o.src);

/* 문장 → 들어있는 파일들 */
const where = new Map();
for (const o of perFile) for (const s of o.sents) {
  if (!where.has(s)) where.set(s, []);
  where.get(s).push(o.f);
}

const plan = [];
for (const [s, list] of where) {
  if (list.length < 2) continue;
  if (!GENERIC.test(s)) continue;      // 내용 문장은 건드리지 않는다
  if (ANSWER_LINE.test(s)) { console.log(`  ※ 핵심 3줄이라 지우지 않는다 — ${list.join(", ")} : ${s.slice(0, 40)}`); continue; }
  for (const f of list.slice(1)) plan.push({ f, s });   // 첫 파일에만 남긴다
}

if (!plan.length) { console.log('겹치는 안내 문장 없음'); process.exit(0); }

const byFile = new Map();
for (const p of plan) {
  if (!byFile.has(p.f)) byFile.set(p.f, []);
  byFile.get(p.f).push(p.s);
}
for (const [f, list] of byFile) {
  console.log(`  ${f} — ${list.length}문장`);
  for (const s of list) console.log(`     · ${s.slice(0, 46)}`);
}
console.log(`\n총 ${plan.length}문장 (${byFile.size}개 파일)`);

if (!APPLY) { console.log('\n실제로 지우려면 --apply 를 붙여 다시 실행한다'); process.exit(0); }

for (const [f, list] of byFile) {
  const p = path.join(DIR, f);
  let src = fs.readFileSync(p, 'utf8');
  for (const s of list) {
    /* 문단 안에서 그 문장만 지운다. 앞 공백까지 같이 지워 두 칸 공백이 남지 않게 한다. */
    src = src.split(' ' + s).join('').split(s + ' ').join('').split(s).join('');
  }
  /* 문장이 통째로 빠져 빈 문자열이 된 항목은 줄째 없앤다 */
  src = src.replace(/^\s*'',?\n/gm, '');
  fs.writeFileSync(p, src, 'utf8');
  console.log(`  고침 ${f}`);
}
console.log('\n지웠다. 이제 build → gate 를 다시 돌린다.');
