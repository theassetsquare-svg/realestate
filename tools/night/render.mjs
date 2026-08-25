/**
 * 나이트 가게 단독페이지 렌더러 (k.nolcool.com)
 *
 * 주소는 도메인 바로 뒤 숫자 하나 — /1 /2 … /40  (파일: <번호>/index.html)
 * 기존 부동산 페이지는 한 글자도 건드리지 않는다. 이 폴더가 만드는 것은 전부 새 파일이다.
 *
 * ★이 페이지에는 사이트 헤더·내비를 넣지 않는다.
 *   규칙: 홈 링크 0 · 기존 페이지로의 링크 0. 헤더를 넣으면 /apartment · / 로 링크가 생긴다.
 *   그래서 CSS 도 이 파일 안에 직접 넣고 /style.css 를 쓰지 않는다.
 */

import { rules, unverified, hours } from './phrases.mjs';

const SITE = 'https://k.nolcool.com';
const KAKAO = 'https://open.kakao.com/o/sBesta12';

/* ★광고주 정답표 — 유일한 기준. 세트(가게이름+닉네임+번호)로만 쓴다. */
export const AD = {
  울산챔피언나이트: { nick: '춘자', phone: '010-5653-0069' },
  창원룰루랄라나이트: { nick: '로또', phone: '010-7528-4936' },
  불광동호박나이트: { nick: '손흥민', phone: '010-2221-1937' },
  청담나이트: { nick: '펩시맨', phone: '010-5655-4866' },
  대전세븐나이트: { nick: '영탁', phone: '010-7770-0869' },
  답십리미라클나이트: { nick: '유재석', phone: '010-8156-6558' },
  부산아시아드나이트: { nick: '새우깡', phone: '010-3614-1056' },
};

/* 기존 페이지에서 그대로 물려받는 인증 태그 (k/realestate index.html) */
const VERIFY = [
  '<meta name="naver-site-verification" content="bdbe793270145676c05362aed730ccf806147f73" />',
  '<meta name="naver-site-verification" content="b831a70c2e9de00029b1472f3b2c0e146ac4bb69" />',
  '<meta name="google-site-verification" content="PmfRK32sSB__iyGIVTwupgP_R45SPUo7QPPtmYJHXIc" />',
  '<meta name="google-site-verification" content="HJjm7MRxykCQ7d_9L7glaTeeaWrmJIzAKY0BcNcfm88" />',
].join('\n');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const digits = (p) => p.replace(/\D/g, '');

const CSS = `
:root{--bg:#0b0d12;--panel:#141824;--line:#242b3d;--ink:#e8ecf5;--dim:#9aa4bd;--gold:#ffd166;--hot:#ff5c7a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;line-height:1.8;padding-bottom:86px;-webkit-text-size-adjust:100%}
.wrap{max-width:760px;margin:0 auto;padding:28px 18px 40px}
h1{font-size:1.72rem;line-height:1.35;margin:0 0 14px;font-weight:800;letter-spacing:-.02em}
h2{font-size:1.18rem;margin:34px 0 12px;font-weight:700;color:#fff;letter-spacing:-.01em}
p{margin:0 0 14px}
.eyebrow{font-size:.76rem;letter-spacing:.22em;color:var(--gold);font-weight:700;margin:0 0 10px}
.lead p{color:#cdd5e8}
.answer{background:var(--panel);border:1px solid var(--gold);border-radius:14px;padding:18px 18px 6px;margin:22px 0}
.answer .t{font-size:.74rem;letter-spacing:.16em;color:var(--gold);font-weight:800;margin:0 0 10px}
.answer ul{margin:0;padding-left:18px}
.answer li{margin:0 0 10px}
figure{margin:22px 0}
figure img{width:100%;max-width:100%;height:auto;border-radius:14px;display:block}
figcaption{font-size:.82rem;color:var(--dim);margin-top:8px}
table{width:100%;border-collapse:collapse;margin:18px 0;font-size:.94rem}
th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}
th{background:var(--panel);color:var(--dim);width:34%;font-weight:600;white-space:nowrap}
.note{border-left:3px solid var(--line);padding:2px 0 2px 14px;color:var(--dim);font-size:.9rem;margin:12px 0}
.reveal{background:linear-gradient(180deg,#1a1426,#141824);border:1px solid var(--hot);border-radius:14px;padding:18px;margin:30px 0 14px}
.reveal .t{font-size:.74rem;letter-spacing:.16em;color:var(--hot);font-weight:800;margin:0 0 10px}
.act{font-weight:700;color:#fff;margin:0 0 18px}
.near{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:24px 0}
.near .t{font-size:.8rem;color:var(--dim);margin:0 0 10px;font-weight:700}
.near a{display:inline-block;margin:0 14px 8px 0;color:var(--gold);text-decoration:none;border-bottom:1px solid rgba(255,209,102,.35)}
details{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 10px;background:var(--panel)}
summary{cursor:pointer;font-weight:700;color:#fff}
details p{margin:10px 0 0;color:#cdd5e8}
.sum{border:1px dashed var(--line);border-radius:12px;padding:14px 16px;margin:24px 0;color:#cdd5e8}
.ad-box{border:2px solid var(--gold);border-radius:14px;padding:18px;margin:28px 0 10px;text-align:center;background:rgba(255,209,102,.06)}
.ad-box b{display:block;font-size:1.24rem;color:var(--gold);letter-spacing:.01em}
footer{color:var(--dim);font-size:.86rem;border-top:1px solid var(--line);margin-top:22px;padding-top:16px}
.callbar{position:fixed;bottom:0;left:0;width:100%;z-index:9999;background:var(--gold);padding-bottom:env(safe-area-inset-bottom)}
.callbar a,.callbar span{display:block;width:100%;text-align:center;padding:16px 10px;font-size:1.06rem;font-weight:800;color:#141010;text-decoration:none}
@media(min-width:760px){h1{font-size:2rem}}
`.trim();

/** 사실 표 — 확인된 값만 들어온다. 셀 값은 페이지끼리 겹쳐도 된다(사실이므로). */
const factTable = (facts, checked) =>
  '<table><tbody>' +
  facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('') +
  `<tr><th>확인일</th><td>${esc(checked)}</td></tr>` +
  '</tbody></table>';

export function renderPage(v, c, today) {
  const ad = AD[v.name] || null;
  /* ★끝에 슬래시를 붙인다. Cloudflare 가 /1 → 308 → /1/ 로 넘기기 때문에
     슬래시 없는 주소를 canonical 로 쓰면 네이버가 리다이렉트를 만난다. */
  const url = `${SITE}/${v.path}/`;
  const og = `${SITE}/og/${v.path}.png`;
  const thumbAlt = `${v.name} ${c.thumbTopic}`;

  /* 하단 고정 바 — 광고주면 그 세트, 아니면 카카오톡 */
  const callbar = ad
    ? `<div class="callbar"><a href="tel:${digits(ad.phone)}" aria-label="${esc(v.name)} ${esc(ad.nick)} ${esc(ad.phone)} 전화">📞 ${esc(v.name)} ${esc(ad.nick)} ${esc(ad.phone)}</a></div>`
    : `<div class="callbar"><a href="${KAKAO}" rel="nofollow noopener" target="_blank">💬 광고문의 카카오톡 besta12</a></div>`;

  /* JSON-LD — NightClub(확인된 것만) + FAQPage. telephone 은 광고주 페이지에만. */
  const addr = v.facts.find(([k]) => k === '주소')?.[1];
  const nightClub = {
    '@context': 'https://schema.org',
    '@type': 'NightClub',
    name: v.name,
    url,
    ...(addr ? { address: { '@type': 'PostalAddress', streetAddress: addr, addressLocality: v.locality, addressRegion: v.region, addressCountry: 'KR' } } : {}),
    ...(ad ? { telephone: ad.phone } : {}),
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  const sections = c.sections
    .map((s) => `<h2>${esc(s.h2)}</h2>\n` + s.body.map((p) => `<p>${esc(p)}</p>`).join('\n') + (s.note ? `\n<p class="note">${esc(s.note)}</p>` : ''))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
${VERIFY}
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="놀쿨">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:secure_url" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="1200">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${esc(thumbAlt)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="${og}">
<meta name="thumbnail" content="${og}">
<link rel="icon" href="/favicon.ico">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(nightClub)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body>
<article class="wrap">
<p class="eyebrow">${esc(v.regionType)}</p>
<h1>${esc(c.title)}</h1>

<div class="lead">
${c.lead.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</div>

<div class="answer"><p class="t">한눈에 보기.</p><ul>
${[...c.answer3, `여는 시간 — ${hours(Number(v.path))}.`].map((a) => `<li>${esc(a)}</li>`).join('\n')}
</ul></div>

<figure>
<img src="/og/${v.path}.png" alt="${esc(v.name)} 안내" width="1200" height="1200" style="max-width:100%;height:auto" loading="eager">
<figcaption>${esc(c.thumbTopic)} — 공개 정보 정리</figcaption>
</figure>

${factTable(v.facts, today)}

${sections}

<div class="reveal"><p class="t">제목의 답</p>
${c.reveal.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</div>
<p class="act">${esc(c.action)}</p>

<div class="near"><p class="t">근처 다른 나이트</p>
${v.near.map((n) => `<a href="/${n.path}/">${esc(n.name)}</a>`).join('\n')}
</div>

<p class="note">${esc(rules(Number(v.path)))} ${esc(unverified(Number(v.path), '그 밖의 항목'))}</p>

<h2>자주 묻는 질문.</h2>
${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}

<div class="sum"><b>정리하자면.</b><br>${esc(c.summary)}</div>

<div class="ad-box"><b>광고문의 카톡: besta12</b></div>

<footer>
<p>공개된 자료를 모아 정리한 내용이라 현장과 차이가 있을 수 있습니다.</p>
<p>작성일 ${esc(today)}.</p>
</footer>
</article>
${callbar}
</body>
</html>`;
}
