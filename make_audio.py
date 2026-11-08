"""edge-tts로 index.html의 단어·예문 발음 MP3를 만든다.

사용법:  python make_audio.py          (이미 있는 파일은 건너뜀)
         python make_audio.py --force  (모두 다시 만들기)
"""
import asyncio
import re
import sys
from pathlib import Path

import edge_tts

sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Git Bash 등 cp1252 콘솔에서도 한글 출력

ROOT = Path(__file__).parent
VOICE = "en-US-JennyNeural"
FORCE = "--force" in sys.argv

html = (ROOT / "index.html").read_text(encoding="utf-8")
# ["apple","사과","🍎","음식","I like apples."],
rows = re.findall(r'\["([a-z]+)","[^"]*","[^"]*","[^"]*","([^"]*)"\]', html)
assert len(rows) == 50, f"단어 {len(rows)}개를 찾았어요 (50개여야 해요)"

jobs = []
for en, ex in rows:
    jobs.append((en, "-10%", ROOT / "audio" / "w" / f"{en}.mp3"))
    jobs.append((ex, "-15%", ROOT / "audio" / "s" / f"{en}.mp3"))


async def make(sem, text, rate, out):
    if out.exists() and not FORCE:
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, VOICE, rate=rate).save(str(out))
                print("ok ", out.relative_to(ROOT))
                return
            except Exception as e:  # 네트워크 오류 시 재시도
                print("retry", out.name, e)
                await asyncio.sleep(1 + attempt)
        raise RuntimeError(f"실패: {out}")


async def main():
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*(make(sem, *j) for j in jobs))
    print(f"완료: {len(jobs)}개 파일")


asyncio.run(main())
