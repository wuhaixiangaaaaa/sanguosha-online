/* 端到端测试：同一进程内跑「真实房主引擎 + 真实客户端代码」，通过 server.js 通信
 * 用 DOM 桩替代浏览器；自动答弹窗、自动结束回合，验证联机全链路 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------- DOM 桩 ---------- */
function makeEl() {
  const el = {
    innerHTML: '', textContent: '', value: '', dataset: {},
    style: new Proxy({ setProperty() { }, cssText: '' }, { get: (t, k) => t[k], set: (t, k, v) => (t[k] = v, true) }),
    classList: { add() { }, remove() { }, toggle() { }, contains: () => false },
    clientWidth: 800, scrollTop: 0, scrollHeight: 0,
    addEventListener() { }, appendChild() { }, remove() { }, replaceWith() { },
    querySelector: () => makeEl(), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    play() { return { catch() { } }; }, pause() { }, paused: true, volume: 1, loop: false, currentTime: 0
  };
  return el;
}
globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.document = {
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  getElementById: () => makeEl(),
  createElement: () => makeEl(),
  addEventListener() { }
};
globalThis.localStorage = {
  getItem: k => (k === 'sgs_speed' ? 'fast' : null),
  setItem() { }
};
globalThis.location = { protocol: 'http:', host: 'localhost:8080' };
globalThis.confirm = () => true;
globalThis.requestAnimationFrame = f => setTimeout(f, 16);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

/* ---------- 每个角色的注入脚本 ---------- */
const harness = role => `
;(function(){
  const H={role:'${role}',errors:[],actedTurns:0};
  globalThis.__H_${role}=H;
  H.G=G;H.NET=NET;H.UI=UI;H.Game=Game;H.human=human;H.distance=distance;H.seatDist=seatDist;H.tableOrderIndex=tableOrderIndex;
  // 聊天断言用：记录 UI.chat 收到的消息
  H.chats=[];
  const _chat=UI.chat;
  UI.chat=function(n,t){try{H.chats.push(String(n)+'|'+String(t));}catch(e){}return _chat.apply(UI,arguments);};
  const _om=openModal;
  openModal=function(h){_om(h);setTimeout(()=>{try{H.answer();}catch(e){H.errors.push('answer:'+e.message);}},40);};
  const _onMsg=NET.onMsg;
  NET.onMsg=function(m){try{_onMsg.call(NET,m);}catch(e){H.errors.push('onMsg['+(m&&m.t)+']:'+e.message+' | '+((e.stack||'').split('\\n')[1]||''));}};
  H.answer=function(){
    const fn=NET.currentAsk?NET.currentAsk.fn:null;
    if(!G.mres&&!NET.currentAsk)return;
    const html=(document.querySelector('#modal-box')||{}).innerHTML||'';
    if(fn==='chooseGeneral'){const m=html.match(/resolveModal\\\\('([^']+)'\\\\)/);resolveModal(m?m[1]:null);return;}
    if(G.pick){const n=(G.pick.opt&&G.pick.opt.min)||1;resolveModal(G.pick.cards.slice(0,n));return;}
    if(fn==='pickSeat'){const o=G.players.find(q=>q.alive&&q!==human());resolveModal(o||null);return;}
    if(fn==='guanxingHuman'){resolveModal({top:[...(G.gx?G.gx.top:[])],bottom:[]});return;}
    if(fn==='chooseRegionHuman'){resolveModal({place:'hand'});return;}
    if(fn==='yesNo'){resolveModal(false);return;}
    if(fn==='chooseAction'){resolveModal('damage');return;}
    resolveModal(null);
  };
  ${role === 'host' ? `
  H.run=function(){
    NET.connect().then(()=>NET.send({t:'create',name:'房主'})).catch(e=>H.errors.push('conn:'+e.message));
    setInterval(()=>{
      try{
        if(NET.roomCode&&!H.roomAnnounced){H.roomAnnounced=true;}
        if(NET.roomCode&&NET.remotes.length>=1&&!H.startedSent){
          H.startedSent=true;NET.send({t:'start'});
          setTimeout(()=>{try{UI.pickGeneral('caocao');UI.confirmGeneral();}catch(e){H.errors.push('pick:'+e.message);}},400);
        }
        if(G.playResolve&&G.turnSeat===0&&!G.busy&&!G.mres){Game.onEndTurnClick();}
      }catch(e){H.errors.push('loop:'+e.message);}
    },300);
  };` : `
  H.run=function(code){
    NET.connect().then(()=>NET.send({t:'join',code:code,name:'老二'})).catch(e=>H.errors.push('conn:'+e.message));
    const _as=NET.applyState;
    NET.applyState=function(v){_as.call(NET,v);
      if(v.youAct&&H.lastTurn!==v.turnCount+':'+v.turnSeat){
        H.lastTurn=v.turnCount+':'+v.turnSeat;H.actedTurns++;
        setTimeout(()=>NET.act({act:'endTurn'}),250);
      }
    };
  };`}
})();
`;

function runGame(role) {
  const fn = new Function(code + '\n' + harness(role));
  fn();
  return globalThis['__H_' + role];
}

/* ---------- 错误捕获 ---------- */
const procErrors = [];
process.on('uncaughtException', e => procErrors.push('uncaught:' + e.message));
process.on('unhandledRejection', e => procErrors.push('rejection:' + (e && e.message)));

(async () => {
  const host = runGame('host');
  host.run();
  // 等房号
  let code = null;
  for (let i = 0; i < 50 && !code; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (host.NET.roomCode) code = host.NET.roomCode;
  }
  if (!code) throw new Error('房主未创建房间');
  console.log('房间号:', code);

  const client = runGame('client');
  client.run(code);

  // 跑到第 8 个回合数（约两轮）或超时 150 秒
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    await new Promise(r => setTimeout(r, 1000));
    if (host.G.over || host.G.turnCount >= 8) break;
    if (procErrors.length) break;
  }

  console.log('\n===== 结果 =====');
  console.log('房主: turnCount=%d, over=%s, log=%d 条', host.G.turnCount, host.G.over, host.G.log.length);
  console.log('客户端: turnCount=%d, over=%s, log=%d 条, 主动出牌次数=%d', client.G.turnCount, client.G.over, client.G.log.length, client.actedTurns);
  console.log('房主玩家:', host.G.players.map(p => `${p.seat}:${p.gid}${p.isAI ? '(AI)' : p.remote ? '(远端)' : '(本地)'} hp=${p.hp} 手牌=${p.hand.length} ${p.alive ? '' : '阵亡'}`).join(' | '));
  console.log('客户端视角:', client.G.players.map(p => `${p.seat}:${p.gid} hp=${p.hp} 手牌数=${p.hand.length}`).join(' | '));
  const hostLogTail = host.G.log.slice(-3).map(l => l.msg.replace(/<[^>]+>/g, '')).join(' / ');
  const cliLogTail = client.G.log.slice(-3).map(l => l.msg.replace(/<[^>]+>/g, '')).join(' / ');
  console.log('房主日志尾:', hostLogTail);
  console.log('客户端日志尾:', cliLogTail);
  // 设计如此：快照只带最近 40 条；客户端窗口可能比房主当前窗口旧几条（渲染滞后）
  // 验证方式：客户端日志必须是房主日志的「连续子序列」
  const hAll = host.G.log.map(l => l.msg);
  const cN = client.G.log.map(l => l.msg);
  let syncOk = false;
  if (cN.length) {
    for (let s = hAll.length - cN.length; s >= 0 && !syncOk; s--) {
      syncOk = true;
      for (let i = 0; i < cN.length && syncOk; i++) if (hAll[s + i] !== cN[i]) syncOk = false;
    }
  }
  console.log('日志同步:', syncOk ? '一致 ✅（客户端日志为主机日志连续子序列）' : `不一致 ❌ (${host.G.log.length} vs ${client.G.log.length})`);
  if (host.errors.length) console.log('房主错误:', host.errors.slice(0, 5));
  if (client.errors.length) console.log('客户端错误:', client.errors.slice(0, 5));
  if (procErrors.length) console.log('进程错误:', procErrors.slice(0, 8));

  const hostBench = host.G.players.filter(p => !p.local).length;
  const clientBench = client.G.players.filter(p => !p.local).length;
  const humanOk = !!(host.human() && host.human().local && host.human().seat === 0);
  const remoteOnTable = host.G.players.some(p => p.remote && !p.local) && hostBench === 4;
  console.log('房主牌桌席位渲染数（应为4，含远程玩家）:', hostBench, remoteOnTable ? '✅' : '❌');
  console.log('客户端牌桌席位渲染数（应为4）:', clientBench, clientBench === 4 ? '✅' : '❌');
  console.log('human() 指向本地房主:', humanOk ? '是 ✅' : '否 ❌');

  // 座位显示顺序必须与座号环一致：left/top-left/top-right/right == 我+1,+2,+3,+4
  // （否则会出现「顺手牵羊牵不到挨着自己的那个人」的距离错觉）
  const ord = host.tableOrderIndex(host.human());
  const seatsInOrder = host.G.players.filter(p => !p.local).sort((a, b) => ord(a) - ord(b)).map(p => p.seat);
  const expectOrder = [1, 2, 3, 4].map(k => (host.human().seat + k) % host.G.players.length);
  const orderOk = JSON.stringify(seatsInOrder) === JSON.stringify(expectOrder);
  console.log('牌桌座位顺序（屏幕邻居==座号邻居）:', JSON.stringify(seatsInOrder), orderOk ? '✅' : '❌ 期望 ' + JSON.stringify(expectOrder));

  // 距离自检（用不含马匹修正的座号环距离，避免装备干扰）：
  // 显示在屏幕最左和最右（即挨着本机的两个位置）的人，座号环距离必须都是 1
  const me = host.human();
  const bySeat = s => host.G.players.find(p => p.seat === s);
  const leftP = bySeat(seatsInOrder[0]), rightP = bySeat(seatsInOrder[seatsInOrder.length - 1]);
  // 只在双方都存活时校验（阵亡者的距离恒为 99，那是规则本身，不是 bug）
  const aliveSides = [leftP, rightP].filter(q => q && q.alive);
  const sideOk = !(me && me.alive) || aliveSides.length === 0
    ? true
    : aliveSides.every(q => host.seatDist(me, q) === 1);
  console.log('距离自检（屏幕左右两侧存活邻居座号距离=1）:',
    leftP ? leftP.seat + (leftP.alive ? '' : '(亡)') : '?',
    rightP ? rightP.seat + (rightP.alive ? '' : '(亡)') : '?',
    sideOk ? '✅' : '❌');

  // 快照必须带 actorSeat（否则客户端会拿自己当参照人算距离，徽章数字会错）
  const viewProbe = host.NET.buildView(1);
  const actorOk = Object.prototype.hasOwnProperty.call(viewProbe, 'actorSeat');
  console.log('快照包含 actorSeat（客户端距离参照人正确）:', actorOk ? '✅' : '❌');

  // 联机聊天：房主发一条，客户端必须收到
  host.chats.length = 0; client.chats.length = 0;
  host.NET.hostChat(0, '测试聊天E2E');
  await new Promise(r => setTimeout(r, 800));
  const chatOk = client.chats.some(s => s.indexOf('测试聊天E2E') >= 0) && host.chats.some(s => s.indexOf('测试聊天E2E') >= 0);
  console.log('联机聊天转发:', JSON.stringify(client.chats.slice(-2)), chatOk ? '✅' : '❌');

  // 游戏可能因为主公阵亡提前结束，这属于正常结局：要么跑满 8 回合，要么对局已结束
  const progressed = host.G.turnCount >= 8 || host.G.over;
  // 远程玩家若已阵亡（或对局已结束），就不再要求它出过牌
  const remoteP = host.G.players.find(p => p.remote && !p.local);
  const clientOk = client.actedTurns >= 1 || host.G.over || !(remoteP && remoteP.alive);
  const ok = progressed && clientOk && syncOk
    && hostBench === 4 && clientBench === 4 && humanOk && orderOk && sideOk
    && actorOk && chatOk
    && !host.errors.length && !client.errors.length && !procErrors.length;
  console.log(ok ? '\n端到端测试通过 ✅' : '\n端到端测试未完全通过 ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
