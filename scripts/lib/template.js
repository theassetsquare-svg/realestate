'use strict';
/**
 * 더에셋스퀘어 자동 생성 템플릿 — SSOT(listings.json) → 게이트 통과형 정적 HTML.
 * 기존 결함 무재발 원칙: 무료/체험·과장(로또/역대급/초프리미엄)·미검증 시세차익 금지,
 * canonical clean·og PNG 1200²·RealEstateListing+BreadcrumbList·내부 같은탭·본진 0홉 CTA.
 * 추정치 금지: SSOT에 값이 있는 필드만 렌더한다(없으면 생략). per-수치 출처 표기.
 */
const HOST = 'https://realestate-ccw.pages.dev';
const MAIN = 'https://theassetsquare.com/';
const CAT_KO = { apt: '아파트분양', officetel: '오피스텔분양', commercial: '상가분양',
  industrial: '산업단지분양', land: '토지분양', knowledge: '지식산업센터분양' };
const CAT_PATH = { apt: '/apt', officetel: '/officetel', commercial: '/commercial',
  industrial: '/industrial', land: '/land', knowledge: '/knowledge' };

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 상태 라벨: 청약 종료일이 지났으면 자동 '청약 접수 마감'(만료 자동 종료)
function statusLabel(l, today) {
  if (l.subscriptionEnd) {
    const end = new Date(l.subscriptionEnd + 'T23:59:59');
    if (end < today) return { text: '청약 접수 마감', cls: 'badge-upcoming' };
    return { text: `청약 접수 ${l.subscriptionStart || ''}~${l.subscriptionEnd}`.trim(), cls: 'badge-selling' };
  }
  return { text: '분양 단지', cls: 'badge-upcoming' };
}

function headerNav(active) {
  const items = [['/', '홈'], ['/apt', '아파트분양'], ['/officetel', '오피스텔분양'],
    ['/commercial', '상가분양'], ['/knowledge', '지식산업센터'], ['/land', '토지분양'], ['/industrial', '산업단지']];
  return `<header class="header"><div class="container"><div class="header-logo"><a href="/">더에셋<span>스퀘어</span></a></div><nav class="header-nav">` +
    items.map(([h, t]) => `<a href="${h}"${h === active ? ' class="active"' : ''}>${t}</a>`).join('') +
    `</nav></div></header>`;
}

function fixedBars() {
  return `<div style="position:fixed;bottom:48px;left:0;width:100%;height:48px;background:#111;display:flex;align-items:center;justify-content:center;z-index:9999">
<a href="${MAIN}" target="_blank" rel="noopener noreferrer" style="color:#fff;font-size:20px;font-weight:900;text-decoration:none;min-height:48px;display:flex;align-items:center">📞 분양 상담 문의 · 더에셋스퀘어 &nbsp; Email: theassetsquare@gmail.com</a>
</div>
<div style="position:fixed;bottom:0;left:0;width:100%;height:48px;background:#2563EB;display:flex;align-items:center;justify-content:center;z-index:9999">
<a href="${MAIN}" target="_blank" rel="noopener noreferrer" style="color:#fff;font-size:16px;font-weight:700;text-decoration:none;min-height:48px;display:flex;align-items:center">더에셋스퀘어에서 더 보기 →</a>
</div>`;
}

function relatedBlock(related) {
  const cards = related.map((r) =>
    `        <a href="/property/${r.slug}" class="related-card"><span class="related-name">${esc(r.name)}</span><span class="related-loc">${esc(r.addressLocality)} · ${CAT_KO[r.category]}</span></a>`
  ).join('\n');
  return `<section class="section related-properties">
  <div class="container">
    <h2 class="section-title">관련 분양 현장</h2>
    <p class="section-sub">같은 지역·유형의 다른 분양 현장도 비교해 보세요.</p>
    <div class="related-grid">
${cards}
    </div>
  </div>
</section>
`;
}

/** 상세 페이지 렌더 (related: [{slug,name,addressLocality,category}] 4개) */
function renderPropertyPage(l, related, today = new Date()) {
  const kw = CAT_KO[l.category];
  const st = statusLabel(l, today);
  const title = `${l.name} — ${esc(l.addressLocality.split(' ').slice(-1)[0] || l.region)} ${kw}`.slice(0, 58);
  const desc = `${l.name} 분양 정보를 전문가가 분석합니다. ${esc(l.addressLocality)} ${l.builder ? l.builder + ' ' : ''}${kw} ${l.name}의 입지·청약 일정·분양 개요를 확인하세요.`.slice(0, 165);
  const og = `${HOST}/og/property-${l.slug}.png`;
  const url = `${HOST}/property/${l.slug}`;

  // per-수치 출처: SSOT에 값+출처가 있을 때만 표기 (추정치 금지)
  const facts = [];
  if (l.builder) facts.push(['시공사', l.builder]);
  facts.push(['유형', kw]);
  if (l.units) facts.push(['세대수', `${l.units}세대`]);
  if (l.price && l.priceSource) facts.push(['분양가', `${l.price} <small>(출처: ${esc(l.priceSource)})</small>`]);
  if (l.moveIn) facts.push(['입주 예정', l.moveIn]);
  const infoGrid = facts.map(([k, v]) =>
    `      <div class="detail-info-item"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('\n');

  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'RealEstateListing', name: l.name, url,
    datePosted: l.datePosted || undefined,
    address: { '@type': 'PostalAddress', addressLocality: l.addressLocality, addressCountry: 'KR' },
  });
  const crumb = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: `${HOST}/` },
      { '@type': 'ListItem', position: 2, name: kw, item: `${HOST}${CAT_PATH[l.category]}` },
      { '@type': 'ListItem', position: 3, name: l.name, item: url },
    ],
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${og}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="1200">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="더에셋스퀘어">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:image" content="${og}">
  <link rel="canonical" href="${url}">
  <link href="/style.css" rel="stylesheet">
  <script type="application/ld+json">
  ${ld}
  </script>
  <script type="application/ld+json">
  ${crumb}
  </script>
</head>
<body>
${headerNav(CAT_PATH[l.category])}
<main>

<section class="detail-hero">
  <div class="container">
    <span class="badge ${st.cls}">${esc(st.text)}</span>
    <h1>${esc(l.name)} — ${esc(l.addressLocality)} ${kw}</h1>
    <p class="location">${esc(l.addressLocality)}${l.builder ? ' · ' + esc(l.builder) : ''}</p>
    <div class="detail-info-grid">
${infoGrid}
    </div>
  </div>
</section>

<section class="detail-content">
  <div class="container">
    <h2>${esc(l.name)} 분양 개요</h2>
    <p>${esc(l.name)}는 ${esc(l.addressLocality)}에 ${l.builder ? esc(l.builder) + '이(가) ' : ''}공급하는 ${kw} 현장입니다. 해당 단지의 청약 일정과 공급 개요는 청약홈에 공개된 입주자 모집공고를 기준으로 안내하며, 평형 구성과 공급 가구 수, 계약 조건 등 세부 사항은 공고문에서 확인하실 수 있습니다. 이 페이지의 정보는 참고용이므로, 실제 계약 전에는 반드시 현장과 공고 원문을 통해 최신 내용을 확인하시기 바랍니다.</p>
    <h3>입지와 생활 여건</h3>
    <p>${esc(l.region)} 일대는 교통망과 생활 인프라가 함께 형성되는 지역으로, 인근 역세권 접근성과 학교·상업시설·공원 등 주변 편의 여건이 실수요자의 관심을 모으는 요소입니다. 이 현장이 자리한 ${esc(l.addressLocality)}의 입지 특성은 출퇴근 동선, 자녀 교육 환경, 주변 개발 계획에 따라 평가가 달라지므로, 본인의 거주·투자 목적에 맞춰 입지 조건을 직접 비교해 보시는 것을 권합니다.</p>
    <h3>청약 전 확인할 점</h3>
    <p>청약을 준비하신다면 청약통장 가입 기간과 예치금, 무주택 기간, 거주 지역 우선공급 요건을 먼저 점검하는 것이 좋습니다. 해당 단지의 당첨자 발표일과 계약 일정, 전매 제한 및 실거주 의무 여부도 공고를 통해 확인해야 합니다. 자금 계획은 중도금 대출 가능 범위와 자기자본 비율을 함께 따져 보수적으로 세우는 것이 안전합니다. 더 자세한 상담과 다른 ${kw} 현장 정보는 더에셋스퀘어 본사이트에서 확인하실 수 있습니다.</p>

    <a href="${MAIN}" target="_blank" rel="noopener noreferrer" class="alert-teaser">
      <div class="alert-teaser-text">이 현장의 가격 변동, 청약 일정을 알림받으세요<small>더에셋스퀘어에서 알림 받기 →</small></div>
      <span class="alert-teaser-btn">알림 등록하기 →</span>
    </a>
  </div>
</section>
${relatedBlock(related)}</main>
<footer class="footer"><div class="container"><strong>더에셋스퀘어</strong> — 부동산분양 정보 플랫폼<br>${esc(l.name)} 분양 정보는 참고용이며, 정확한 분양가와 일정은 현장에 직접 확인하시기 바랍니다.<br><div class="footer-links"><a href="/">홈</a> <a href="${CAT_PATH[l.category]}">${kw}</a></div></div></footer>
${fixedBars()}
<script src="/main.js" defer></script>
<div style="height:96px"></div>
</body>
</html>
`;
}

module.exports = { renderPropertyPage, statusLabel, CAT_KO, CAT_PATH, HOST, MAIN };
