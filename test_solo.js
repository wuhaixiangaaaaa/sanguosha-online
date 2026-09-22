/* 单机回归测试：确保联机改造没有破坏单机模式 */
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
globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.document = {
  querySelector: () => makeEl(), querySelectorAll: () => [],
  getElementById: () => makeEl(), createElement: () => makeEl(), addEventListener() { }
};
globalThis.localStorage = { getItem: k => (k === 'sgs_speed' ? 'fast' : null), setItem() { } };
globalThis.location = { protocol: 'file:', host: '' };
globalThis.confirm = () => true;
globalThis.requestAnimationFrame = f => setTimeout(f, 16);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

const harness = `
;(function(){
  const H={errors:[]};
  globalThis.__H=H;
  H.G=G;H.NET=NET;H.UI=UI;H.Game=Game;
  const _om=openModal;
  openModal=function(h){_om(h);setTimeout(()=>{try{H.answer();}catch(e){H.errors.push('answer:'+e.message);}},40);};
  H.answer=function(){
    if(!G.mres)return;
    if(G.pick){const n=(G.pick.opt&&G.pick.opt.min)||1;resolveModal(G.pick.cards.slice(0,n));return;}
    if(G.gx){resolveModal({top:[...G.gx.top],bottom:[]});return;}
    if(G.yj){resolveModal(null);return;}
    if(G.gcHand){resolveModal(null);return;}
    if(G.regionTarget){resolveModal(null);return;}
    resolveModal(null);
  };
  H.run=function(){
    startGame('identity','caocao');
    setInterval(()=>{
      try{if(G.playResolve&&G.turnSeat===0&&!G.busy&&!G.mres){Game.onEndTurnClick();}}catch(e){H.errors.push('loop:'+e.message);}
    },300);
  };
})();
`;

const procErrors = [];
process.on('uncaughtException', e => procErrors.push('uncaught:' + e.message));
process.on('unhandledRejection', e => procErrors.push('rejection:' + (e && e.message)));

(async () => {
  new Function(code + '\n' + harness)();
  const H = globalThis.__H;
  H.run();
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    await new Promise(r => setTimeout(r, 1000));
    if (H.G.over || H.G.turnCount >= 10 || procErrors.length) break;
  }
  console.log('单机身份局: turnCount=%d, over=%s, log=%d 条', H.G.turnCount, H.G.over, H.G.log.length);
  console.log('玩家:', H.G.players.map(p => `${p.gid}${p.isAI ? '(AI)' : ''} hp=${p.hp} ${p.alive ? '' : '阵亡'}`).join(' | '));
  console.log('日志尾:', H.G.log.slice(-3).map(l => l.msg.replace(/<[^>]+>/g, '')).join(' / '));
  if (H.errors.length) console.log('错误:', H.errors.slice(0, 5));
  if (procErrors.length) console.log('进程错误:', procErrors.slice(0, 5));
  const ok = H.G.turnCount >= 10 && !H.errors.length && !procErrors.length;
  console.log(ok ? '单机回归测试通过 ✅' : '单机回归测试失败 ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
