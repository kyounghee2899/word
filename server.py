"""로컬 개발 서버: 사이트 파일을 보여주고, Unsplash API 를 서버에서 대신 호출한다.

    python server.py            (http://localhost:8765)
    python server.py 9000       (포트 바꾸기)

시작할 때 .env.local → .env 순서로 읽어 UNSPLASH_ACCESS_KEY 를 가져온다.
이미 시스템 환경 변수에 있으면 그 값을 쓴다. 파일을 고치면 서버를 다시 시작해야 한다.
키 값은 화면·로그·응답 어디에도 내보내지 않는다.

  GET  /api/unsplash?query=apple&per_page=9   사진 검색
  POST /api/unsplash-select {word, id, query}  사진 선택: 다운로드 추적 후 photos.json 에 저장
  POST /api/unsplash-select {word, id: null}   선택 취소(아이콘으로 되돌리기)

배포(Vercel)에서는 api/unsplash.js, api/unsplash-select.js 가 같은 일을 한다(단, 파일 저장은 못 함).
"""
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent
PHOTOS = ROOT / "photos.json"
API = "https://api.unsplash.com"
UTM = "utm_source=word_playground&utm_medium=referral"
BLOCKED = {".env", ".env.local", ".env.example", "server.py", "make_audio.py"}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
WORD_RE = re.compile(r"^[a-z]{1,20}$")
ERRORS = {
    401: "Access Key가 올바르지 않아요. .env.local의 키를 확인해 주세요.",
    403: "Unsplash 요청 한도를 넘었어요(무료 키는 1시간에 50회). 잠시 후 다시 해 주세요.",
    404: "Unsplash에서 그 사진을 찾지 못했어요.",
}
save_lock = threading.Lock()
search_cache = {}  # 서버가 켜져 있는 동안 같은 검색어는 다시 묻지 않음


def load_env():
    for name in (".env.local", ".env"):
        f = ROOT / name
        if not f.exists():
            continue
        for line in f.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def with_utm(url):
    return url + ("&" if "?" in url else "?") + UTM


def unsplash_get(url):
    """Unsplash 호출. (상태코드, JSON) 반환. 키는 헤더에만 넣고 어디에도 출력하지 않는다."""
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
    if not key:
        return 503, {"error": "missing_key", "message": "서버에 UNSPLASH_ACCESS_KEY가 설정되지 않았어요."}
    req = urllib.request.Request(url, headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return 200, json.load(r)
    except urllib.error.HTTPError as e:
        return (502 if e.code == 401 else e.code), {
            "error": "unsplash_error", "status": e.code,
            "message": ERRORS.get(e.code, f"Unsplash 요청이 실패했어요 (HTTP {e.code})."),
        }
    except Exception:
        return 502, {"error": "network_error", "message": "Unsplash에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."}


def slim(p, query):
    """API가 준 사진 주소(urls)와 출처 링크를 그대로 담는다."""
    return {
        "id": p["id"],
        "alt": p.get("alt_description") or p.get("description") or query,
        "color": p.get("color"),
        "thumb": p["urls"]["small"],
        "src": p["urls"]["regular"],
        "author": p["user"]["name"],
        "authorUrl": with_utm(p["user"]["links"]["html"]),
        "photoUrl": with_utm(p["links"]["html"]),
        "query": query,
    }


def search(query, per_page):
    if not query:
        return 400, {"error": "missing_query", "message": "검색어를 넣어 주세요."}
    ck = (query.lower(), per_page)
    if ck in search_cache:
        return 200, search_cache[ck]
    params = urllib.parse.urlencode({
        "query": query, "per_page": per_page,
        "content_filter": "high", "orientation": "squarish",  # 어린이용: 엄격한 필터
    })
    status, data = unsplash_get(f"{API}/search/photos?{params}")
    if status != 200:
        return status, data
    body = {"query": query, "results": [slim(p, query) for p in data.get("results", [])]}
    search_cache[ck] = body
    return 200, body


def read_photos():
    try:
        return json.loads(PHOTOS.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_photos(data):
    tmp = PHOTOS.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(PHOTOS)


def select(word, photo_id, query):
    if not WORD_RE.match(word or ""):
        return 400, {"error": "bad_word", "message": "단어 이름이 올바르지 않아요."}
    if photo_id is None:  # 아이콘으로 되돌리기
        with save_lock:
            data = read_photos()
            data.pop(word, None)
            write_photos(data)
        return 200, {"word": word, "photo": None, "saved": True}
    if not ID_RE.match(str(photo_id)):
        return 400, {"error": "bad_id", "message": "사진 ID가 올바르지 않아요."}

    status, p = unsplash_get(f"{API}/photos/{photo_id}")
    if status != 200:
        return status, p
    # 공식 지침: 사용자가 사진을 골라 쓸 때 links.download_location 을 호출해 다운로드를 집계한다
    dl = (p.get("links") or {}).get("download_location", "")
    if not dl.startswith(API + "/"):
        return 502, {"error": "no_download_location", "message": "다운로드 추적 주소를 받지 못했어요."}
    t_status, t_data = unsplash_get(dl)
    if t_status != 200:
        return t_status, t_data

    photo = slim(p, (query or word)[:50])
    photo["chosenAt"] = date.today().isoformat()
    with save_lock:
        data = read_photos()
        data[word] = photo
        write_photos(data)
    return 200, {"word": word, "photo": photo, "saved": True, "tracked": True}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def send_json(self, status, body):
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def end_headers(self):
        if self.path.split("?")[0].endswith("photos.json"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        name = Path(urllib.parse.unquote(url.path)).name
        if name in BLOCKED or name.endswith(".tmp") or url.path.startswith("/.git"):
            return self.send_error(404)
        if url.path == "/api/unsplash":
            q = urllib.parse.parse_qs(url.query)
            query = q.get("query", [""])[0].strip()[:50]
            try:
                per_page = min(max(int(q.get("per_page", ["1"])[0]), 1), 12)
            except ValueError:
                per_page = 1
            return self.send_json(*search(query, per_page))
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/api/unsplash-select":
            return self.send_json(404, {"error": "not_found", "message": "없는 주소예요."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 2048:
                raise ValueError
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self.send_json(400, {"error": "bad_body", "message": "요청 형식이 올바르지 않아요."})
        return self.send_json(*select(body.get("word"), body.get("id"), body.get("query")))


if __name__ == "__main__":
    load_env()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    has_key = bool(os.environ.get("UNSPLASH_ACCESS_KEY"))
    print(f"http://localhost:{port}  (UNSPLASH_ACCESS_KEY {'설정됨' if has_key else '비어 있음 → 사진 대신 아이콘 표시'})")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
