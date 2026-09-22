# -*- coding: utf-8 -*-
"""生成女性角色的卡牌语音（sfx-f-*.mp3）。
不满意可随时自己替换同名文件，位置：assets/audio/
女声：zh-CN-XiaoxiaoNeural（温柔女声），可换成 zh-CN-XiaoyiNeural（活泼）/ zh-CN-liaoning-XiaobeiNeural（东北）
"""
import asyncio, os, shutil, sys

import edge_tts

VOICE = os.environ.get('SGS_F_VOICE', 'zh-CN-XiaoxiaoNeural')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'audio')

# (文件名后缀, 台词, rate, pitch)
LINES = [
    ('tao',        '桃！我来救你，快好起来！',            '+12%', '+6Hz'),
    ('jiu',        '喝！痛快！再来一杯！',                  '+12%', '+4Hz'),
    ('wuzhong',    '无中生有！凭空变出来，惊喜吧？',        '+10%', '+6Hz'),
    ('guohe',      '过河拆桥！这张牌，归我啦！',            '+12%', '+6Hz'),
    ('shunshou',   '顺手牵羊～嘿嘿，借我用用嘛！',          '+10%', '+8Hz'),
    ('juedou',     '决斗吧！你敢不敢接？',                  '+14%', '+8Hz'),
    ('nanman',     '南蛮入侵！小的们，给我上！',            '+14%', '+6Hz'),
    ('wanjian',    '万箭齐发！放箭！',                      '+16%', '+10Hz'),
    ('lebu',       '乐不思蜀～你就乖乖在这儿待着吧！',      '+8%',  '+8Hz'),
    ('bingliang',  '兵粮寸断！看你还怎么打仗！',            '+12%', '+6Hz'),
    ('wuxie',      '无懈可击！给我破！',                    '+14%', '+8Hz'),
    ('zl_nu',      '诸葛连弩！射射射，停不下来！',          '+14%', '+6Hz'),
    ('qinggang',   '青釭剑出鞘，谁敢挡我！',                '+12%', '+6Hz'),
    ('hanbing',    '寒冰剑！给你冻住！',                    '+12%', '+8Hz'),
    ('bagua',      '八卦阵起，万事不惧～',                  '+8%',  '+4Hz'),
    ('horse_atk',  '驾！冲啊，别想跑！',                    '+14%', '+8Hz'),
    ('horse_def',  '嘿嘿～追不上我吧！',                    '+10%', '+10Hz'),
    ('hurt',       '哎呀！疼死我了！',                      '+12%', '+10Hz'),
]


async def gen(text, voice, rate, pitch, path):
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await c.save(path)


async def main():
    os.makedirs(OUT, exist_ok=True)
    # 杀 / 闪 直接复用蔡巍（女声）已有的专属语音，风格统一
    for kind in ('sha', 'shan'):
        src = os.path.join(OUT, 'sfx-cw-%s.mp3' % kind)
        dst = os.path.join(OUT, 'sfx-f-%s.mp3' % kind)
        if os.path.exists(src):
            shutil.copyfile(src, dst)
            print('[copy ] sfx-f-%s.mp3  <- sfx-cw-%s.mp3' % (kind, kind))
        else:
            await gen('杀！' if kind == 'sha' else '闪！', VOICE, rate='+18%', pitch='+10Hz', path=dst)
            print('[gen  ] sfx-f-%s.mp3' % kind)
    for kind, text, rate, pitch in LINES:
        dst = os.path.join(OUT, 'sfx-f-%s.mp3' % kind)
        await gen(text, VOICE, rate=rate, pitch=pitch, path=dst)
        print('[gen  ] sfx-f-%s.mp3  %5d bytes' % (kind, os.path.getsize(dst)))
    print('ALL DONE ->', OUT)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as e:
        print('FAILED:', e)
        sys.exit(1)
