// Vercel 서버리스 함수: GET /api/unsplash?query=apple&per_page=9  (사진 검색)
// 로컬에서는 server.py 가 같은 주소, 같은 응답 형식으로 처리한다.
const { API, unsplashGet, slim } = require("./_unsplash");

module.exports = async function handler(req, res) {
  const query = String(req.query.query || "").trim().slice(0, 50);
  if (!query) return res.status(400).json({ error: "missing_query", message: "검색어를 넣어 주세요." });
  const perPage = Math.min(Math.max(parseInt(req.query.per_page, 10) || 1, 1), 12);

  const url = new URL(`${API}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("content_filter", "high"); // 어린이용: 엄격한 필터
  url.searchParams.set("orientation", "squarish");

  const [status, data] = await unsplashGet(url);
  if (status !== 200) return res.status(status).json(data);
  // 같은 검색어는 CDN이 하루 동안 기억 → Unsplash에 다시 묻지 않음
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({ query, results: (data.results || []).map((p) => slim(p, query)) });
};
