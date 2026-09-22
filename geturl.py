"""提取 cpolar 公网地址 -> 实际访问验证 -> 复制到剪贴板 + 存桌面。

用法：python geturl.py [日志路径] [--offset N]

为什么要这么麻烦：
  1. cpolar 日志如果被多次运行共用，文件里会残留【上一次】的隧道地址，
     脚本一读到就立刻返回 —— 剪贴板里的地址和 cpolar 窗口里显示的对不上。
     → 启动脚本现在每次用「唯一文件名」的日志，并且可以再传 --offset 忽略旧内容。
  2. 只有真正能访问通的地址才值得发给好友（防止拿到还没建立/已失效的隧道）。
"""
import os, re, ssl, sys, time, subprocess, urllib.request

TEMP = os.environ.get('TEMP', '.')
DESK = os.path.join(os.path.expanduser('~'), 'Desktop')
ADDR = re.compile(r'https://[A-Za-z0-9][A-Za-z0-9.\-]*cpolar\.(?:cn|io|top)')


def read_log(path):
    try:
        with open(path, encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception:
        return ''


def candidates(txt, offset=0):
    """返回日志里出现的隧道地址（按出现顺序，最后一条最新）。"""
    seg = txt[offset:] if offset > 0 else txt
    out = []
    for line in seg.splitlines():
        if not any(k in line for k in ('Forwarding', 'Tunnel established')):
            continue
        m = ADDR.search(line)
        if m:
            out.append(m.group(0))
    if not out:                                  # 兜底：抓任意位置的地址
        out = [m.group(0) for m in ADDR.finditer(seg)]
    return out


def alive(url, timeout=8):
    """用 https 实际请求一次，确认这条隧道真的能打开游戏页面。"""
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={'User-Agent': 'sgs-launcher'})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return 200 <= r.status < 400
    except Exception:
        return False


def find(log, offset=0, timeout=150, grace=75):
    """轮询日志，返回【已通过访问验证】的最新地址。"""
    deadline = time.time() + timeout
    first_seen, last_url, told = None, None, set()
    while time.time() < deadline:
        cands = candidates(read_log(log), offset)
        if cands:
            url = cands[-1]
            if url != last_url:
                last_url, first_seen = url, time.time()
            if url not in told:
                told.add(url)
                print('  checking %s ...' % url, flush=True)
            if alive(url):
                print('  verified OK', flush=True)
                return url
            # 隧道可能刚建立还没通，等一会儿再试；超时才降级返回（并提示风险）
            if time.time() - first_seen > grace:
                print('  [WARN] 该地址暂未验证通过，仍先给你（稍等几秒可能就通了）', flush=True)
                return url
        time.sleep(2)
    return None


def copy_to_clipboard(text):
    try:
        p = subprocess.Popen(['clip'], stdin=subprocess.PIPE, shell=True)
        p.communicate(text.encode('utf-16-le') + b'\x00\x00')
        return p.returncode == 0
    except Exception:
        return False


def main():
    log, offset = None, 0
    for a in sys.argv[1:]:
        if a.startswith('--offset='):
            try:
                offset = int(a.split('=', 1)[1])
            except Exception:
                offset = 0
        elif not a.startswith('--'):
            log = a
    if not log:
        log = os.path.join(TEMP, 'cpolar_sgs.log')

    url = find(log, offset)
    if not url:
        print('NOT_FOUND')
        return 1

    print('')
    print('  >>> ' + url)
    try:
        if os.path.isdir(DESK):
            with open(os.path.join(DESK, 'sgs-url.txt'), 'w', encoding='utf-8') as f:
                f.write(url + '\n')
    except Exception:
        pass
    ok = copy_to_clipboard(url)
    print('  ' + ('已复制到剪贴板' if ok else '复制剪贴板失败，请手动复制上面这行'))
    print('CLIPBOARD_OK' if ok else 'CLIPBOARD_FAIL')
    return 0


if __name__ == '__main__':
    sys.exit(main())
