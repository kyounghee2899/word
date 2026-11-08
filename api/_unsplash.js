// Vercel 함수 공용 도구 (밑줄로 시작하는 파일은 주소로 열리지 않음).
// UNSPLASH_ACCESS_KEY 는 Vercel 환경 변수에서만 읽고, 응답이나 로그에 내보내지 않는다.

const API = "https://api.unsplash.com";
const UTM = "utm_source=word_playground&utm_medium=referral";
const withUtm = (url) => url + (url.includes("?") ? "&" : "?") + UTM;
const ERRORS = {
  401: "Access Key가 올바르지 않아요. Vercel 환경 변수의 키를 확인해 주세요.",
  403: "Unsplash 요청 한도를 넘었어요(무료 키는 1시간에 50회). 잠시 후 다시 해 주세요.",
  404: "Unsplash에서 그 사진을 찾지 못했어요.",
};

async function unsplashGet(url) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [503, { error: "missing_key", message: "서버에 UNSPLASH_ACCESS_KEY가 설정되지 않았어요." }];
  try {
    const r = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
    if (!r.ok) {
      return [r.status === 401 ? 502 : r.status, {
        error: "unsplash_error", status: r.status,
        message: ERRORS[r.status] || `Unsplash 요청이 실패했어요 (HTTP ${r.status}).`,
      }];
    }
    return [200, await r.json()];
  } catch (e) {
    return [502, { error: "network_error", message: "Unsplash에 연결하지 못했어요." }];
  }
}

// API가 준 사진 주소(urls)와 출처 링크를 그대로 담는다
function slim(p, query) {
  return {
    id: p.id,
    alt: p.alt_description || p.description || query,
    color: p.color,
    thumb: p.urls.small,
    src: p.urls.regular,
    author: p.user.name,
    authorUrl: withUtm(p.user.links.html),
    photoUrl: withUtm(p.links.html),
    query,
  };
}

module.exports = { API, unsplashGet, slim };
