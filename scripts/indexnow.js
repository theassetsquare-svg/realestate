#!/usr/bin/env node
'use strict';
/**
 * IndexNow — 변경 URL 즉시 색인 통보(Bing·Yandex·Naver 등 IndexNow 지원 엔진).
 *   node scripts/indexnow.js https://realestate-ccw.pages.dev/property/foo ...
 * 환경변수 INDEXNOW_KEY 필요(+ /{KEY}.txt 키파일이 사이트 루트에 있어야 함).
 * 키 미설정 시: 통보 건너뜀(가짜 성공 없음).
 */
const HOST = 'realestate-ccw.pages.dev';
const KEY = process.env.INDEXNOW_KEY || '';

async function ping(urls) {
  if (!KEY) { console.error('⚠ INDEXNOW_KEY 미설정 — 색인 통보 건너뜀. 사장님 1회 액션 필요.'); return; }
  if (!urls.length) { console.log('IndexNow: 변경 URL 없음'); return; }
  const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls };
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  console.log(`IndexNow: ${res.status} (${urls.length}건 통보)`);
}

ping(process.argv.slice(2)).catch((e) => { console.error('IndexNow 실패:', e.message); process.exit(0); });
