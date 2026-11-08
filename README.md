# 영단어 놀이터

초등 4학년 필수 영단어 50개를 카드, 뜻 맞히기 퀴즈, 받아쓰기로 공부하는 웹사이트입니다.

- `index.html` — 사이트 본체 (파일 하나로 동작, 설치 불필요)
- `guide.html` — 사용법 안내 페이지
- `audio/w/`, `audio/s/` — 단어·예문 발음 MP3 ([edge-tts](https://github.com/rany2/edge-tts), en-US-JennyNeural)
- `make_audio.py` — 발음 MP3 생성 스크립트

## 실행

```bash
python server.py
```

http://localhost:8765 에서 열립니다. `index.html`을 파일로 바로 열어도 동작하지만, 그때는 사진 대신 이모지만 보입니다.

## Unsplash 사진

단어 카드의 사진은 서버를 거쳐 가져옵니다. Access Key는 서버에서만 읽고 브라우저·로그로 내보내지 않습니다. 사진이 없거나 실패하면 원인을 보여주고 이모지로 공부를 이어갑니다.

- `GET /api/unsplash?query=...` — 사진 검색 (같은 검색어는 서버가 기억)
- `POST /api/unsplash-select` — 카드의 **사진 바꾸기**에서 사진을 고르면 Unsplash 지침대로 `download_location`을 호출해 다운로드를 집계하고, 로컬 서버는 `photos.json`에 저장합니다. 저장된 단어는 다시 검색하지 않습니다.
- 사진 주소는 API가 준 `images.unsplash.com` 주소를 그대로 쓰고, 사진마다 사진가와 Unsplash 링크를 표시합니다.
- Vercel에서는 파일을 저장할 수 없어서 새로 고른 사진은 그 기기 브라우저에만 저장됩니다. 모두에게 보일 사진은 로컬에서 고른 뒤 `photos.json`을 커밋하세요.

- **로컬**: `.env.example`을 `.env.local`로 복사하고 `UNSPLASH_ACCESS_KEY=` 뒤에 키를 넣은 뒤 `python server.py`를 다시 시작합니다. `.env.local`은 커밋되지 않습니다.
- **Vercel**: `.env.local`은 배포되지 않습니다. 프로젝트 Settings → Environment Variables에 `UNSPLASH_ACCESS_KEY`를 추가하고 다시 배포하면 `api/unsplash.js`가 그 값을 읽습니다.

## 단어 바꾸기

`index.html`의 `WORDS` 목록(50줄)을 고친 뒤 발음 파일을 다시 만듭니다.

```bash
pip install edge-tts
python make_audio.py          # 없는 파일만 생성
python make_audio.py --force  # 전부 다시 생성
```
