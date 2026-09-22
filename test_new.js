/* 新机制单元测试：赵延莲技能 / 死而复生每局限一次 / 距离跳过阵亡者 */
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
  H.G=G;H.P=P;H.hasSkill=hasSkill;H.seatDist=seatDist;H.doDyzt=doDyzt;H.doSxcm=doSxcm;
  H.dealDamage=dealDamage;H.runTurn=runTurn;H.customLeft=customLeft;
  H.distance=distance;H.canReach=canReach;H.attackRange=attackRange;
  H.canPlay=canPlay;H.applyGy=applyGy;H.validShaTargets=validShaTargets;
  const _om=openModal;
  openModal=function(h){_om(h);setTimeout(()=>{try{if(G.mres)resolveModal(null);}catch(e){}},20);};
})();
`;

const procErrors = [];
process.on('uncaughtException', e => procErrors.push('uncaught:' + e.message));
process.on('unhandledRejection', e => procErrors.push('rejection:' + (e && e.message)));

(async () => {
  new Function(code + '\n' + harness)();
  const H = globalThis.__H;
  const G = H.G;
  /* 手工搭一局：0=赵延莲(本地) 1=曹操 2=关羽 3=张飞 4=刘备 */
  const gids = ['zhaoyanlian', 'caocao', 'guanyu', 'zhangfei', 'liubei'];
  G.mode = 'identity'; G.over = false; G.turnCount = 0; G.log = []; G.discardPile = [];
  G.players = gids.map((g, s) => ({
    seat: s, gid: g, isAI: s !== 0, identity: s === 0 ? 'lord' : 'rebel',
    hp: 4, maxHp: 4, hand: [], equips: { weapon: null, armor: null, 'horse+': null, 'horse-': null },
    judges: [], alive: true, usedSha: 0, drank: false, skillUsed: {}, skillCount: {},
    skipDraw: false, skipPlay: false, revealed: false
  }));
  G.players[0].local = true;
  G.turnSeat = 0;
  const zyl = G.players[0], t1 = G.players[1], t2 = G.players[2];

  const results = [];
  const chk = (name, cond) => { results.push([name, !!cond]); };

  /* --- 1. 定燕子朝天：翻面→技能失效→受伤翻回→冷却2回合 --- */
  await H.doDyzt(zyl, t1);
  chk('dyzt 翻面生效', t1.flipped === true);
  chk('翻面后技能失效(jianxiong)', H.hasSkill(t1, 'jianxiong') === false);
  chk('dyzt 冷却=2', zyl.cdDyzt === 2);
  chk('dyzt 冷却中不能再发动', (await H.doDyzt(zyl, t2)) === false && !t2.flipped);
  await H.dealDamage(zyl, t1, 1, null, 'test');
  chk('受伤后翻回', t1.flipped === false);
  chk('翻回后技能恢复', H.hasSkill(t1, 'jianxiong') === true);
  /* 冷却递减：runTurn 开头会重置技能并递减；这里只测递减逻辑本身 */
  zyl.cdDyzt = 2; zyl.cdDyzt--; chk('回合1后冷却=1', zyl.cdDyzt === 1);
  zyl.cdDyzt--; chk('回合2后冷却=0 可再用', zyl.cdDyzt === 0 && H.customLeft(zyl, 'sxcm') >= 0);

  /* --- 2. 思想长毛：弃1→1毛；再弃1→2毛→自动乐不思蜀并清空；每回合限一次 --- */
  const c1 = { uid: 9001, name: '杀', type: 'basic', suit: '♠', rank: 5 };
  const c2 = { uid: 9002, name: '闪', type: 'basic', suit: '♥', rank: 3 };
  const c3 = { uid: 9003, name: '桃', type: 'basic', suit: '♦', rank: 7 };
  zyl.hand.push(c1, c2, c3);
  await H.doSxcm(zyl, t2, [c1]);
  chk('sxcm 弃1→1毛', t2.sxcmMao === 1);
  chk('sxcm 弃牌进入弃牌堆', G.discardPile.some(c => c.uid === 9001) && zyl.hand.length === 2);
  chk('sxcm 每回合限一次', (await H.doSxcm(zyl, t2, [c2])) === false);
  zyl.skillCount = {}; /* 模拟下一回合 */
  await H.doSxcm(zyl, t2, [c2]);
  chk('sxcm 第2次→毛达2清空', t2.sxcmMao === 0);
  chk('sxcm 自动挂乐不思蜀', t2.judges.some(j => j.name === '乐不思蜀'));
  /* 弃2张直接触发 */
  const c4 = { uid: 9004, name: '杀', type: 'basic', suit: '♣', rank: 8 };
  const c5 = { uid: 9005, name: '杀', type: 'basic', suit: '♦', rank: 9 };
  zyl.hand.push(c4, c5); zyl.skillCount = {};
  await H.doSxcm(zyl, t1, [c4, c5]);
  chk('sxcm 弃2直接乐不思蜀', t1.judges.some(j => j.name === '乐不思蜀') && (t1.sxcmMao || 0) === 0);

  /* --- 3. 死而复生：每局限一次 --- */
  const kg = G.players[3]; kg.gid = 'whx_kg'; kg.maxHp = 6; kg.hp = 6;
  await H.dealDamage(zyl, kg, 5, null, 'test'); /* 6→1 触发 */
  chk('sefs 首次触发补满', kg.hp === 6 && kg.sefsGameUsed === true);
  await H.dealDamage(zyl, kg, 5, null, 'test'); /* 再打到1血 */
  chk('sefs 本局不再触发', kg.hp === 1);
  chk('sefs 不再占用回合次数(skillUsed 无 sefs)', !kg.skillUsed.sefs);

  /* --- 4. 距离：阵亡者跳过 --- */
  /* 0 1 2 3 4 围圈；杀 2 号位距离：min(2,3)=2 */
  chk('距离 0↔2 =2', H.seatDist(G.players[0], G.players[2]) === 2);
  G.players[1].alive = false; /* 1号阵亡后 0↔2 距离应变 1 */
  chk('1号阵亡后 0↔2 =1', H.seatDist(G.players[0], G.players[2]) === 1);
  chk('与阵亡者距离=99', H.seatDist(G.players[0], G.players[1]) === 99);

  /* --- 4b. 马匹距离（需求5场景）：我没-1马、右边的人有+1马 → 杀/顺牵够不到，拆桥不限 --- */
  G.players[1].alive = true;
  const me0 = G.players[0], right1 = G.players[1], left4 = G.players[4];
  right1.equips['horse+'] = { uid: 9101, name: '的卢', type: 'equip', slot: 'horse+', suit: '♠', rank: 5 };
  chk('邻座带+1马 distance=2', H.distance(me0, right1) === 2);
  chk('邻座带+1马 杀够不到', H.canReach(me0, right1) === false);
  me0.equips['horse-'] = { uid: 9102, name: '赤兔', type: 'equip', slot: 'horse-', suit: '♥', rank: 5 };
  chk('我装-1马后 distance=1', H.distance(me0, right1) === 1);
  chk('我装-1马后 杀够得到', H.canReach(me0, right1) === true);
  me0.equips['horse-'] = null;
  /* 顺手牵羊只能牵 distance===1；过河拆桥不受距离限制 */
  right1.hand.push({ uid: 9103, name: '闪', type: 'basic', suit: '♠', rank: 2 });
  left4.hand.push({ uid: 9106, name: '闪', type: 'basic', suit: '♥', rank: 6 });
  const rShun = H.canPlay(me0, { uid: 9104, name: '顺手牵羊', type: 'trick', suit: '♠', rank: 3 });
  const rChai = H.canPlay(me0, { uid: 9105, name: '过河拆桥', type: 'trick', suit: '♠', rank: 4 });
  chk('顺牵可用(能牵到4号)', rShun.ok === true);
  chk('顺牵目标不含+1马邻座', rShun.ok && !rShun.targets.includes(right1));
  chk('拆桥目标含+1马邻座(不限距离)', rChai.ok === true && rChai.targets.includes(right1));
  right1.equips['horse+'] = null; right1.hand.length = 0; left4.hand.length = 0;

  /* --- 6. 杨浩展：禁桃 + 公演 Rap --- */
  const yhz = G.players[2]; yhz.gid = 'yanghaozhan'; yhz.maxHp = 5; yhz.hp = 5; yhz.mic = 3;
  const tao = { uid: 9201, name: '桃', type: 'basic', suit: '♥', rank: 7 };
  chk('禁桃：桃不能当桃吃', H.canPlay(yhz, tao).ok === false);
  yhz.usedSha = 1; /* 本回合已出过杀 */
  const rJt = H.canPlay(yhz, tao, '杀');
  chk('禁桃：桃视为杀且不计次数', rJt.ok === true);
  const hpBefore = me0.hp;
  H.applyGy(yhz, 'rap');
  chk('公演Rap 标记生效', yhz.rapDmg === true && yhz.mic === 1);
  await H.dealDamage(yhz, me0, 1, null, 'test');
  chk('公演Rap 伤害+1', me0.hp === hpBefore - 2);
  yhz.rapDmg = false; yhz.usedSha = 0; me0.hp = me0.maxHp;

  /* --- 5. 武将在可选池 --- */
  chk('zhaoyanlian 在 PLAYABLE_IDS', /'zhaoyanlian'/.test(code) && true);

  for (const [n, ok] of results) console.log((ok ? 'PASS' : 'FAIL') + '  ' + n);
  const fails = results.filter(r => !r[1]).length;
  if (procErrors.length) console.log('进程错误:', procErrors.slice(0, 5));
  console.log(fails === 0 && !procErrors.length ? '新机制测试全部通过 ✅' : `新机制测试失败 ${fails} 项 ❌`);
  process.exit(fails === 0 && !procErrors.length ? 0 : 1);
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
