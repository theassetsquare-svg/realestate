/**
 * 옛 주소(realestate-ccw.pages.dev) 로 들어온 요청을 새 주소(k.nolcool.com) 로 301 보낸다.
 *
 * 왜 _redirects 가 아니라 Function 인가
 *   두 주소는 같은 Cloudflare Pages 프로젝트다. _redirects 는 **경로만** 보고
 *   호스트를 구분하지 못하므로, 거기에 규칙을 넣으면 k.nolcool.com 도 자기 자신으로
 *   끝없이 되돌게 된다. 호스트를 보고 판단하려면 Function 이어야 한다.
 *
 * 규칙
 *   · 호스트가 *.pages.dev 일 때만 옮긴다. k.nolcool.com 은 그대로 통과시킨다.
 *   · 경로·쿼리는 그대로 유지한다 (/apt.html?a=1 → https://k.nolcool.com/apt.html?a=1)
 *   · 301(영구 이동) — 네이버·구글에 "주소가 완전히 바뀌었다"고 알린다.
 *
 * 위치: 이 폴더는 저장소 상위에 있어야 한다. Cloudflare Pages 는 프로젝트 루트의
 *       functions/ 를 읽는다.
 */
const NEW_HOST = 'k.nolcool.com';


/* NW-HIDE-INTERNAL-v1 — 집안 문서는 밖으로 내보내지 않는다(2026-09-07).
   저장소 뿌리가 곧 배포 뿌리라 /CLAUDE.md · /README.md · /GEMINI.md · /package.json · /skills-lock.json ·
   /src/….template 이 그대로 200 으로 나가고 있었다. 파일은 그대로 두고 응답만 404 로 막는다. */
const 집안이름 = ['/claude.md', '/gemini.md', '/agents.md', '/readme.md', '/package.json', '/package-lock.json', '/skills-lock.json'];
function 집안인가(p) { const q = String(p).toLowerCase(); return 집안이름.includes(q) || q.startsWith(String.fromCharCode(47) + "src" + String.fromCharCode(47)) || q.startsWith(String.fromCharCode(47) + ".env"); }
export async function onRequest(context) {
  if (집안인가(new URL(context.request.url).pathname)) return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });

  const url = new URL(context.request.url);

  if (url.hostname.endsWith('.pages.dev')) {
    url.protocol = 'https:';
    url.hostname = NEW_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  // 새 주소로 들어온 요청은 평소대로 파일을 내보낸다.
  return context.next();
}
