// Vercel 서버리스 함수: POST /api/unsplash-select {word, id, query}
// 사용자가 사진을 골랐을 때 공식 지침대로 download_location 을 호출해 다운로드를 집계한다.
// Vercel 은 파일을 저장할 수 없어서 saved:false 를 돌려주고, 선택은 브라우저(그 기기)에 저장된다.
// 로컬 server.py 는 같은 요청을 받아 photos.json 에 저장한다.
const { API, unsplashGet, slim } = require("./_unsplash");

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const WORD_RE = /^[a-z]{1,20}$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "POST로 요청해 주세요." });
  const { word, id, query } = req.body || {};
  if (!WORD_RE.test(word || "")) return res.status(400).json({ error: "bad_word", message: "단어 이름이 올바르지 않아요." });
  if (id === null) return res.status(200).json({ word, photo: null, saved: false });
  if (!ID_RE.test(String(id || ""))) return res.status(400).json({ error: "bad_id", message: "사진 ID가 올바르지 않아요." });

  const [status, p] = await unsplashGet(`${API}/photos/${id}`);
  if (status !== 200) return res.status(status).json(p);

  const dl = (p.links && p.links.download_location) || "";
  if (!dl.startsWith(API + "/")) {
    return res.status(502).json({ error: "no_download_location", message: "다운로드 추적 주소를 받지 못했어요." });
  }
  const [tStatus, tData] = await unsplashGet(dl);
  if (tStatus !== 200) return res.status(tStatus).json(tData);

  const photo = { ...slim(p, String(query || word).slice(0, 50)), chosenAt: new Date().toISOString().slice(0, 10) };
  return res.status(200).json({ word, photo, saved: false, tracked: true });
};
