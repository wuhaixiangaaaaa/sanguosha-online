# -*- coding: utf-8 -*-
"""生成「回合播报」语音 + 修正女角色的杀/闪语音。
- 播报：到<武将名>出牌了！  → assets/audio/sfx-turn-<gid>.mp3
- 女声杀/闪：sfx-f-sha.mp3 / sfx-f-shan.mp3（独立女声，不再复用蔡巍素材）
女角色（gender:'f'）用女声，其余用男声播报。
"""
import asyncio, io, os, re, sys, shutil

import edge_tts

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'assets', 'audio')
HTML = os.path.join(BASE, 'index.html')
MALE = os.environ.get('SGS_MALE_VOICE', 'zh-CN-YunxiNeural')
FEMALE = os.environ.get('SGS_FEMALE_VOICE', 'zh-CN-XiaoxiaoNeural')


def read_generals():
    """从 index.html 的 GENERALS 数组里解析可上场武将（id/name/性别）。"""
    txt = io.open(HTML, encoding='utf-8').read()
    m = re.search(r'const GENERALS=\[(.*?)\n\];', txt, re.S)
    body = m.group(1) if m else ''
    out = []
    for chunk in re.split(r'\n\s*(?=\{id:)', body):
        mm = re.match(r"\{id:'([a-z_]+)',name:'([^']+)'", chunk.strip())
        if not mm:
            continue
        if 'soon:true' in chunk:
            continue
        out.append((mm.group(1), mm.group(2), 'f' if "gender:'f'" in chunk else 'm'))
    return out


async def ttg(text, voice, rate, pitch, path, tries=4):
    """edge-tts 偶发 NoAudioReceived（限流），重试几次。"""
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
    gens = read_generals()
    print('武将（%d 个）:' % len(gens), ', '.join('%s(%s)' % (n, g) for _, n, g in gens))

    # 1) 回合播报
    for gid, name, gender in gens:
        voice = FEMALE if gender == 'f' else MALE
        rate, pitch = ('+6%', '+14Hz') if gender == 'f' else ('+4%', '+6Hz')
        path = os.path.join(OUT, 'sfx-turn-%s.mp3' % gid)
        if os.path.exists(path) and os.path.getsize(path) > 800:
            print('  [skip] sfx-turn-%s.mp3' % gid)
            continue
        await ttg('到%s出牌了！' % name, voice, rate=rate, pitch=pitch, path=path)
        print('  [turn] sfx-turn-%-12s %6d bytes  (%s)' % (gid + '.mp3', os.path.getsize(path), voice))

    # 2) 女角色的杀/闪（独立女声）
    for kind, text in (('sha', '杀！'), ('shan', '闪！')):
        path = os.path.join(OUT, 'sfx-f-%s.mp3' % kind)
        await ttg(text, FEMALE, rate='+22%', pitch='+16Hz', path=path)
        print('  [f-  ] sfx-f-%s.mp3 %6d bytes' % (kind, os.path.getsize(path)))

    print('ALL DONE ->', OUT)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as e:
        print('FAILED:', repr(e))
        sys.exit(1)
