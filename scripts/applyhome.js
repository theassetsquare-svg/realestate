#!/usr/bin/env node
'use strict';
/**
 * 청약홈 어댑터 — 국토교통부_한국부동산원 청약홈 분양정보(공공데이터포털 data.go.kr).
 * 환경변수 DATA_GO_KR_KEY(무료 공공데이터 인증키) 필요.
 *   node scripts/applyhome.js        # 실 fetch → data/listings.json 병합(신규 추가/상태 갱신)
 *   node scripts/applyhome.js --print # fetch 결과만 출력(병합 안 함)
 *
 * 키 미설정 시: 가짜 데이터 생성 금지 → 그대로 종료(SSOT 무변경). 창작 0 원칙.
 * 매핑: 청약홈 필드 → SSOT 스키마. 추정치 없이 공고 실데이터 필드만 채운다.
 */
const fs = require('fs');
const path = require('path');

const KEY = process.env.DATA_GO_KR_KEY || '';
const SSOT = path.resolve(__dirname, '..', 'data', 'listings.json');
// 청약홈 APT 분양정보 상세 (odcloud). 상가/오피스텔/도시형 등은 별도 오퍼레이션으로 확장 가능.
const BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail';

// 청약홈 주택구분 → SSOT 카테고리. 아파트 외 유형도 실데이터로 채움(빈 카테고리 해소).
const HOUSE_TO_CAT = {
  '아파트': 'apt', '오피스텔': 'officetel', '도시형생활주택': 'apt',
  '민간임대': 'apt', '상가': 'commercial', '생활형숙박시설': 'commercial',
  '지식산업센터': 'knowledge', '산업단지': 'industrial', '토지': 'land',
};

function slugify(name, no) {
  // 한글 현장명은 ASCII slug 불가 → 공고번호 기반 결정적 slug
  return 'applyhome-' + String(no).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function mapRow(r) {
  const cat = HOUSE_TO_CAT[r.HOUSE_SECD_NM] || HOUSE_TO_CAT[r.HOUSE_DTL_SECD_NM] || 'apt';
  return {
    slug: slugify(r.HOUSE_NM, r.PBLANC_NO),
    name: r.HOUSE_NM,
    category: cat,
    region: (r.SUBSCRPT_AREA_CODE_NM || r.HSSPLY_ADRES || '').split(' ')[0] || '',
    addressLocality: r.HSSPLY_ADRES || r.SUBSCRPT_AREA_CODE_NM || '',
    builder: r.CNSTRCT_ENTRPS_NM || '',
    units: r.TOT_SUPLY_HSHLDCO ? Number(r.TOT_SUPLY_HSHLDCO) : null,
    subscriptionStart: r.RCEPT_BGNDE || null,   // 청약접수 시작
    subscriptionEnd: r.RCEPT_ENDDE || null,     // 청약접수 종료 → 만료 자동종료 기준
    moveIn: r.MVN_PREARNGE_YM || null,          // 입주예정월
    price: null,                                 // 분양가는 별도 상세 API(가격 미확정 시 null 유지)
    priceSource: r.PBLANC_URL ? '청약홈 입주자모집공고' : null,
    datePosted: r.RCRIT_PBLANC_DE || null,
    status: 'active',
    source: 'applyhome',
    sourceUrl: r.PBLANC_URL || null,
    generated: true,
  };
}

async function fetchAll() {
  if (!KEY) {
    console.error('⚠ DATA_GO_KR_KEY 미설정 — 청약홈 fetch 건너뜀(가짜 데이터 생성 안 함). 사장님 1회 액션 필요.');
    return null;
  }
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const u = `${BASE}?page=${page}&perPage=100&serviceKey=${encodeURIComponent(KEY)}`;
    const res = await fetch(u, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`청약홈 API ${res.status}`);
    const j = await res.json();
    const rows = j.data || [];
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.map(mapRow).filter((x) => x.name);
}

function mergeIntoSSOT(fetched) {
  const ssot = JSON.parse(fs.readFileSync(SSOT, 'utf8'));
  const bySlug = new Map(ssot.listings.map((l) => [l.slug, l]));
  let added = 0, updated = 0;
  for (const f of fetched) {
    if (bySlug.has(f.slug)) {
      const cur = bySlug.get(f.slug);
      if (cur.source === 'applyhome') { Object.assign(cur, f); updated++; } // manual은 덮어쓰지 않음
    } else { ssot.listings.push(f); bySlug.set(f.slug, f); added++; }
  }
  fs.writeFileSync(SSOT, JSON.stringify(ssot, null, 2));
  return { added, updated, total: ssot.listings.length };
}

(async () => {
  try {
    const fetched = await fetchAll();
    if (!fetched) process.exit(0);            // 키 없음 → 정상 종료(무변경)
    console.log(`청약홈 fetch: ${fetched.length}건`);
    if (process.argv.includes('--print')) { console.log(JSON.stringify(fetched.slice(0, 3), null, 2)); return; }
    const r = mergeIntoSSOT(fetched);
    console.log(`SSOT 병합 — 신규 ${r.added} / 갱신 ${r.updated} / 총 ${r.total}`);
  } catch (e) {
    console.error('청약홈 어댑터 실패:', e.message);
    process.exit(1);
  }
})();
