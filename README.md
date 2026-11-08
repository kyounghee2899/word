# 영단어 놀이터

초등 4학년 필수 영단어 50개를 카드, 뜻 맞히기 퀴즈, 받아쓰기로 공부하는 웹사이트입니다.

- `index.html` — 사이트 본체 (파일 하나로 동작, 설치 불필요)
- `guide.html` — 사용법 안내 페이지
- `audio/w/`, `audio/s/` — 단어·예문 발음 MP3 ([edge-tts](https://github.com/rany2/edge-tts), en-US-JennyNeural)
- `make_audio.py` — 발음 MP3 생성 스크립트

## 실행

`index.html`을 브라우저로 열면 됩니다. 발음 파일까지 제대로 불러오려면 간단한 웹 서버로 여는 것이 좋습니다.

```bash
python -m http.server 8765
```

## 단어 바꾸기

`index.html`의 `WORDS` 목록(50줄)을 고친 뒤 발음 파일을 다시 만듭니다.

```bash
pip install edge-tts
python make_audio.py          # 없는 파일만 생성
python make_audio.py --force  # 전부 다시 생성
```
