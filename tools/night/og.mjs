/**
 * 썸네일 1200×1200 PNG 생성기 — /og/<번호>.png
 *
 * 시스템 폰트를 쓰지 않는다. 한글 볼드 TTF 를 opentype.js 로 글자 path 로 바꾼 뒤
 * sharp 로 굽는다. 그래야 어느 컴퓨터에서 돌려도 같은 그림이 나온다.
 *
 * (A) 광고주 7곳 — 번호가 주인공(가장 큰 글자)
 *     1행 가게이름 55~65% / 2행 닉네임 45~60%·높이 170px+ / 3행 ★번호 90~96% / 4행 광고문의
 * (B) 나머지 — "광고문의"가 주인공
 *     1행 가게이름 55~65% / 2행 ★광고문의 75~85%·높이 240px+ / 3행 카카오톡 besta12 70~80%
 */
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const W = 1200, H = 1200, MARGIN = 56;
const USABLE = W - MARGIN * 2;   // 1088

const FONT_PATH = 'D:/naver-watch/repos/ulsan/tools/fonts/Pretendard-Bold.ttf';
const FONT = opentype.parse(fs.readFileSync(FONT_PATH).buffer.slice(0));

/** 글자의 실제 잉크 상자(그려지는 범위)를 잰다. advanceWidth 가 아니라 잉크 기준이어야 눈에 보이는 크기와 맞는다. */
function ink(text, size) {
  const p = FONT.getPath(text, 0, 0, size);
  const b = p.getBoundingBox();
  return { p, w: b.x2 - b.x1, h: b.y2 - b.y1, x1: b.x1, y1: b.y1 };
}

/** 목표 잉크 폭에 맞는 글자 크기를 이분 탐색으로 찾는다 */
function fitWidth(text, targetW) {
  let lo = 8, hi = 1600;
  for (let i = 0; i < 70; i++) {
    const m = (lo + hi) / 2;
    if (ink(text, m).w > targetW) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

/** opentype.js 의 toPathData 가 특정 크기에서 NaN 을 뱉은 전례가 있어 직접 직렬화하고 검증한다 */
function pathData(p) {
  const n = (v) => {
    if (!Number.isFinite(v)) throw new Error('글자 path 에 NaN 좌표가 나왔다');
    return (Math.round(v * 100) / 100).toString();
  };
  let out = '';
  for (const c of p.commands) {
    if (c.type === 'M') out += `M${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'L') out += `L${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'C') out += `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'Q') out += `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'Z') out += 'Z';
  }
  return out;
}

/**
 * 한 줄을 그린다. 폭 비율(pct)을 맞추고, minH 가 있으면 세로로 늘려 최소 높이를 보장한다.
 * 반환값에 실측 폭·높이를 담아 검문에서 그대로 쓴다.
 */
function line(text, { pct, minH = 0, color, y }) {
  const targetW = USABLE * pct;
  let size = fitWidth(text, targetW);
  let m = ink(text, size);
  let sy = 1;
  if (minH && m.h < minH) sy = minH / m.h;
  const drawnW = m.w, drawnH = m.h * sy;
  const x = (W - drawnW) / 2 - m.x1;
  const svg =
    `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(1,${sy.toFixed(4)})">` +
    `<path d="${pathData(m.p)}" fill="${color}"/></g>`;
  return { svg, w: Math.round(drawnW), h: Math.round(drawnH), pct: drawnW / USABLE };
}

/**
 * @param {{name:string, ad:{nick:string,phone:string}|null, out:string}} o
 * @returns 실측값 (검문 G9/G15 에서 쓴다)
 */
export function buildThumb({ name, ad, out }) {
  const parts = [];
  const measured = {};

  if (ad) {
    /* (A) 광고주 — 번호가 주인공 */
    const l1 = line(name, { pct: 0.60, color: '#ffffff', y: 250 });
    const l2 = line(ad.nick, { pct: 0.52, minH: 175, color: '#ffd166', y: 500 });
    const l3 = line(ad.phone, { pct: 0.94, color: '#39ff88', y: 760 });
    const l4 = line('광고문의 카톡 besta12', { pct: 0.55, color: '#9aa4bd', y: 950 });
    parts.push(l1.svg, l2.svg, l3.svg, l4.svg);
    measured.rows = { name: l1, nick: l2, phone: l3, ad: l4 };
    measured.hero = 'phone';
    measured.heroW = l3.w;
  } else {
    /* (B) 비광고주 — 광고문의가 주인공 */
    const l1 = line(name, { pct: 0.60, color: '#ffffff', y: 300 });
    const l2 = line('광고문의', { pct: 0.80, minH: 245, color: '#39ff88', y: 640 });
    const l3 = line('카카오톡 besta12', { pct: 0.75, minH: 125, color: '#ffd166', y: 900 });
    parts.push(l1.svg, l2.svg, l3.svg);
    measured.rows = { name: l1, hero: l2, kakao: l3 };
    measured.hero = 'ad';
    measured.heroH = l2.h;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#0b0d12"/>` +
    `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#242b3d" stroke-width="4" rx="28"/>` +
    parts.join('') +
    `</svg>`;

  fs.mkdirSync(path.dirname(out), { recursive: true });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(out).then((info) => ({
    ...measured, file: out, width: info.width, height: info.height, bytes: info.size,
  }));
}
