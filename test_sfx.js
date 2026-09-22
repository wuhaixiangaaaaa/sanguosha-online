/* 音效系统专项测试：解锁 / 分批激活 / 失败重试 / 待播补播 / 自检
   覆盖「房主听得到、好友听不到」这一类问题的修复逻辑 */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl() {
  return {
    innerHTML: '', textContent: '', value: '', dataset: {},
    style: new Proxy({ setProperty() { }, cssText: '' }, { get: (t, k) => t[k], set: (t, k, v) => (t[k] = v, true) }),
    classList: { add() { }, remove() { }, toggle() { }, contains: () => false },
    clientWidth: 800, scrollTop: 0, scrollHeight: 0,
    addEventListener() { }, appendChild() { }, remove() { }, replaceWith() { },
    querySelector: () => makeEl(), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    play() { return { catch() { } }; }, pause() { }, paused: true, volume: 1, loop: false, currentTime: 0
  };
}
/* 造一组 audio 元素；fail=true 的元素模拟「浏览器拒绝播放」 */
function mkAudio(id, fail) {
  const a = {
    id, tagName: 'AUDIO', readyState: 4, volume: 1, muted: false, paused: true, currentTime: 0, _plays: 0,
    play() { a._plays++; if (fail) return Promise.reject(new Error('NotAllowedError')); a.paused = false; return Promise.resolve(); },
    pause() { a.paused = true; }, load() { a.readyState = 4; },
    addEventListener() { }, removeEventListener() { },
    getAttribute: () => 'assets/audio/' + id + '.mp3',
    classList: { add() { }, remove() { }, toggle() { }, contains: () => false },
    style: {}
  };
  return a;
}
const els = ['sfx-sha', 'sfx-shan', 'sfx-tao', 'sfx-hurt', 'sfx-f-sha'].map(id => mkAudio(id, false));
const failEl = mkAudio('sfx-fail', true);
els.push(failEl);
const map = {}; els.forEach(a => { map[a.id] = a; });

globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.document = {
  querySelector: () => makeEl(),
  querySelectorAll(sel) { return /audio\[id\^="sfx-"\]/.test(sel) ? els : []; },
  /* 未知的音效 id 必须返回 null，才能测到「元素缺失」这条分支 */
  getElementById(id) { if (map[id]) return map[id]; if (/^sfx-/.test(id) || id === 'bgm') return null; return makeEl(); },
  createElement: () => makeEl(), addEventListener() { }
};
globalThis.localStorage = { getItem: () => null, setItem() { } };
globalThis.location = { protocol: 'file:', host: '' };
globalThis.confirm = () => true;
globalThis.requestAnimationFrame = f => setTimeout(f, 16);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

const harness = `;(function(){const H={};globalThis.__H=H;H.SFX=SFX;H.Loader=Loader;})();`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const procErrors = [];
process.on('uncaughtException', e => procErrors.push('uncaught:' + e.message));
process.on('unhandledRejection', e => procErrors.push('rejection:' + (e && e.message)));

(async () => {
  new Function(code + '\n' + harness)();
  const H = globalThis.__H, SFX = H.SFX;
  let ok = true;
  const chk = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) ok = false; };

  const sha = map['sfx-sha'], tao = map['sfx-tao'];

  /* ---- 1. 未解锁：不播放，进待播队列 ---- */
  chk(SFX._unlocked === false, '初始状态未解锁');
  SFX.play('sha', .9);
  chk(sha._plays === 0, '未解锁时不直接播放（不会静默丢弃）');
  chk(SFX._pending.length === 1, '未解锁时进入待播队列');

  /* ---- 2. 手势解锁：WebAudio 上下文 + 全量激活 + 补播 ---- */
  SFX.pulse(true);
  await sleep(40);
  chk(SFX._unlocked === true, '手势后已解锁');
  chk(sha._plays >= 1, '解锁后补播了待播队列里的音效');
  chk(SFX._primed.size === els.length - 1, '可用元素全部激活（got=' + SFX._primed.size + '）');
  chk(!SFX._primed.has('sfx-fail'), '播放失败的元素未被误判为已激活');
  chk(failEl._plays >= 1, '失败元素确实尝试过播放');

  /* ---- 3. 失败元素在下一次手势重试（旧实现只试一次，永久静音） ---- */
  const before = failEl._plays;
  SFX.pulse(true);
  await sleep(20);
  chk(failEl._plays > before, '失败元素在下一次手势会重试');

  /* ---- 4. 解锁后即时播放 ---- */
  const t0 = tao._plays;
  SFX.play('tao', .9);
  await sleep(10);
  chk(tao._plays > t0, '解锁后音效立即播放');

  /* ---- 5. 缺元素 / 静音 ---- */
  const m0 = SFX._miss;
  SFX.play('nonexistent', .9);
  chk(SFX._miss === m0 + 1, '缺失的 audio 元素被计数（便于自检发现）');
  SFX.muted = true; const t1 = tao._plays;
  SFX.play('tao', .9); await sleep(10);
  chk(tao._plays === t1, '静音时不播放');
  SFX.muted = false;

  /* ---- 6. WebAudio 解锁分支 ---- */
  globalThis.AudioContext = function () {
    return {
      state: 'suspended', resume() { this.state = 'running'; },
      createBuffer: () => ({}), createBufferSource: () => ({ connect() { }, start() { } }), destination: {}
    };
  };
  SFX._wa = null; SFX._unlocked = false;
  SFX.pulse(true); await sleep(20);
  chk(!!SFX._wa, '存在 AudioContext 时已创建并 resume（不依赖网络）');

  /* ---- 7. 自检输出 ---- */
  const txt = SFX.diagText();
  chk(/解锁:/.test(txt) && /已下载:/.test(txt) && /已激活:/.test(txt), '自检文本可读：' + txt);

  console.log('');
  console.log(ok && !procErrors.length ? '音效系统测试全部通过 ✅' : '音效系统测试失败 ❌ ' + JSON.stringify(procErrors));
  process.exit(ok && !procErrors.length ? 0 : 1);
})();
