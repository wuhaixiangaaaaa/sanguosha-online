/* 服务器协议冒烟测试：两个 WebSocket 客户端模拟建房、加入、转发 */
const assert = require('assert');
const URL = 'ws://localhost:8080';

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, inbox: [], waiters: [] };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    c.inbox.push(m);
    c.waiters = c.waiters.filter(w => {
      if (w.pred(m)) { w.res(m); return false; }
      return true;
    });
  };
  c.send = o => ws.send(JSON.stringify(o));
  c.waitFor = (pred, ms = 3000) => new Promise((res, rej) => {
    const hit = c.inbox.find(pred);
    if (hit) return res(hit);
    const tm = setTimeout(() => rej(new Error(name + ' 等待消息超时')), ms);
    c.waiters.push({ pred, res: m => { clearTimeout(tm); res(m); } });
  });
  c.open = () => new Promise(r => ws.onopen = r);
  return c;
}

(async () => {
  const host = client('host');
  await host.open();
  host.send({ t: 'create', name: '房主' });
  const room = await host.waitFor(m => m.t === 'room');
  assert(room.host === true && room.seat === 0 && /^\d{4}$/.test(room.code));
  console.log('OK 创建房间:', room.code);

  const p2 = client('p2');
  await p2.open();
  p2.send({ t: 'join', code: room.code, name: '老二' });
  const room2 = await p2.waitFor(m => m.t === 'room');
  assert(room2.seat === 1 && room2.host === false);
  console.log('OK 加入房间 seat=1');

  const lobby = await host.waitFor(m => m.t === 'lobby' && m.players.length === 2);
  assert(lobby.players[1].name === '老二');
  console.log('OK 大厅广播:', lobby.players.map(p => p.name).join(','));

  // 转发：client -> host
  p2.send({ t: 'msg', to: 0, data: { k: 'hello' } });
  const mh = await host.waitFor(m => m.t === 'msg' && m.from === 1 && m.data.k === 'hello');
  console.log('OK 客户端→房主转发');
  // 转发：host -> seat1
  host.send({ t: 'msg', to: 1, data: { k: 'state', x: 1 } });
  await p2.waitFor(m => m.t === 'msg' && m.from === 0 && m.data.k === 'state');
  console.log('OK 房主→客户端转发');

  // start
  host.send({ t: 'start' });
  await p2.waitFor(m => m.t === 'started');
  console.log('OK started 广播');

  // 加入已开始房间应被拒绝
  const p3 = client('p3');
  await p3.open();
  p3.send({ t: 'join', code: room.code, name: '老三' });
  await p3.waitFor(m => m.t === 'err');
  console.log('OK 已开始房间拒绝加入');

  // p2 离开 → host 收 peerLeft
  p2.send({ t: 'leave' });
  await host.waitFor(m => m.t === 'peerLeft' && m.seat === 1);
  console.log('OK peerLeft 通知');

  // 房主离开 → p3? p3 不在房内。新建房间测试 hostLeft
  host.send({ t: 'create', name: '房主' });
  const r2 = await host.waitFor(m => m.t === 'room' && m.code !== room.code);
  const p4 = client('p4');
  await p4.open();
  p4.send({ t: 'join', code: r2.code, name: '老四' });
  await p4.waitFor(m => m.t === 'room');
  host.send({ t: 'leave' });
  await p4.waitFor(m => m.t === 'hostLeft');
  console.log('OK hostLeft 解散通知');

  console.log('\n全部通过 ✅');
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
