/** k 라이브 확인 — 40페이지 + 썸네일 40장 + 사이트맵/키파일. 리다이렉트가 있으면 실패로 본다. */
const SITE = 'https://k.nolcool.com';
const one = async (u) => {
  try {
    const r = await fetch(u, { redirect: 'manual' });
    return { u, s: r.status, loc: r.headers.get('location') || '' };
  } catch (e) { return { u, s: 0, loc: String(e.message) }; }
};
const urls = [];
for (let i = 1; i <= 40; i++) urls.push(`${SITE}/${i}/`);
for (let i = 1; i <= 40; i++) urls.push(`${SITE}/og/${i}.png`);
urls.push(`${SITE}/sitemap.xml`, `${SITE}/robots.txt`, `${SITE}/llms.txt`);
const out = [];
for (let i = 0; i < urls.length; i += 10) out.push(...await Promise.all(urls.slice(i, i + 10).map(one)));
const bad = out.filter((r) => r.s !== 200);
console.log(`확인 ${out.length}개 / 200 아님 ${bad.length}개`);
bad.slice(0, 20).forEach((r) => console.log('  ★', r.s, r.u, r.loc));
