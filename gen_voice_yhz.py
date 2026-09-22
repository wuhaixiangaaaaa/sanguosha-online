# -*- coding: utf-8 -*-
"""生成杨浩展的技能音效（男声 Yunxi）：
- sfx-sk_gy_vocal.mp3  公演·Vocal
- sfx-sk_gy_rap.mp3    公演·Rap
- sfx-sk_gy_dance.mp3  公演·Dance
- sfx-sk_jt.mp3        禁桃
"""
import asyncio, os, sys

import edge_tts

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'assets', 'audio')
MALE = os.environ.get('SGS_MALE_VOICE', 'zh-CN-YunxiNeural')

LINES = [
    ('sfx-sk_gy_vocal.mp3', '公演！Vocal 时间，听我高歌一曲！', '+8%', '+8Hz'),
    ('sfx-sk_gy_rap.mp3', '公演！Rap 炸场，伤害加倍！', '+18%', '+4Hz'),
    ('sfx-sk_gy_dance.mp3', '公演！Dance 全开，装备上身！', '+10%', '+10Hz'),
    ('sfx-sk_jt.mp3', '禁桃！我的桃，就是杀！', '+12%', '+2Hz'),
]


async def ttg(text, voice, rate, pitch, path, tries=4):
    for i in range(tries):
        try:
            c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await c.save(path)
            if os.path.exists(path) and os.path.getsize(path) > 800:
                return
        except Exception as e:
            print('    retry %d/%d: %r' % (i + 1, tries, e))
        await asyncio.sleep(2 + i * 2)
    raise RuntimeError('tts failed: ' + text)


async def main():
    os.makedirs(OUT, exist_ok=True)
    for fname, text, rate, pitch in LINES:
        path = os.path.join(OUT, fname)
        if os.path.exists(path) and os.path.getsize(path) > 800:
            print('  [skip]', fname)
            continue
        await ttg(text, MALE, rate=rate, pitch=pitch, path=path)
        print('  [gen ] %-22s %6d bytes' % (fname, os.path.getsize(path)))
    print('DONE')


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as e:
        print('FAILED:', repr(e))
        sys.exit(1)
