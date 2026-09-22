# -*- coding: utf-8 -*-
"""生成自定义武将技能语音（edge-tts）"""
import asyncio, os
import edge_tts

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)

LINES = [
    # (文件名, 语音, 台词, rate, pitch)
    # 赵延莲：东北幽默女声（凶萌傲娇）
    ('sfx-sk_dyzt', 'zh-CN-liaoning-XiaobeiNeural', '哼！你抹布！姐让你定燕子朝天！给姐翻过去吧你～', '+8%', '+5Hz'),
    ('sfx-sk_sxcm', 'zh-CN-liaoning-XiaobeiNeural', '哎哟喂！你抹布！你的思想长毛了吗？来来来，姐给你薅一薅～', '+8%', '+5Hz'),
    # 吴海湘开挂：阳光活泼男声（嚣张搞笑）
    ('sfx-sk_hjlb', 'zh-CN-YunxiNeural', '皇家礼炮！轰！！你们的手牌，统统给老子交出来！哇哈哈哈！', '+18%', '+12Hz'),
    ('sfx-sk_jdqs', 'zh-CN-YunxiNeural', '绝地求生！我命由我不由天！杀杀杀！今天一个都别想跑！', '+18%', '+12Hz'),
    ('sfx-sk_sefs', 'zh-CN-YunxiNeural', '嘿嘿嘿～惊不惊喜？意不意外？老子又满血复活啦！气不气？哈哈哈！', '+18%', '+12Hz'),
]

async def gen(name, voice, text, rate, pitch):
    path = os.path.join(OUT, name + '.mp3')
    tts = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await tts.save(path)
    print(name, os.path.getsize(path), 'bytes')

async def main():
    for item in LINES:
        await gen(*item)
    print('ALL_DONE')

asyncio.run(main())
