/* ============================================================
 * 三国杀联机版 · 零依赖服务器（Node.js 16+，无需 npm install）
 * 功能：1) 静态文件服务（朋友浏览器直接打开网址即可玩）
 *       2) WebSocket 房间管理与消息转发（房主权威）
 * 启动：node server.js   （或双击 start.bat）
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

/* ---------------- 静态文件 ---------------- */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404 Not Found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

/* ---------------- WebSocket 编解码 ---------------- */
function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}
/* 返回 {opcode, payload, rest} 或 null（数据不完整） */
function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2)); off = 10;
  }
  let mask = null;
  if (masked) {
    if (buf.length < off + 4) return null;
    mask = buf.slice(off, off + 4); off += 4;
  }
  if (buf.length < off + len) return null;
  let payload = buf.slice(off, off + len);
  if (mask) {
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
    payload = out;
  }
  return { opcode, payload, rest: buf.slice(off + len) };
}

/* ---------------- 房间管理 ---------------- */
const rooms = new Map(); // code -> { host, members: Map<seat, client>, started }
let nextId = 1;

function genCode() {
  for (; ;) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
}
function broadcastLobby(room, code) {
  const players = [...room.members.entries()].map(([seat, c]) => ({
    seat, name: c.name, host: c === room.host
  }));
  for (const c of room.members.values()) c.send({ t: 'lobby', players, code });
}
function leave(client) {
  const code = client.room;
  if (!code) return;
  const room = rooms.get(code);
  client.room = null;
  if (!room) return;
  if (client === room.host) {
    for (const c of room.members.values()) {
      if (c !== client) { c.send({ t: 'hostLeft' }); c.room = null; }
    }
    rooms.delete(code);
    log(`房间 ${code} 已解散（房主离开）`);
  } else {
    room.members.delete(client.seat);
    if (room.host) room.host.send({ t: 'peerLeft', seat: client.seat });
    broadcastLobby(room, code);
    log(`${client.name} 离开房间 ${code}（${room.members.size}/5）`);
  }
}
function handleMsg(client, m) {
  switch (m.t) {
    case 'create': {
      leave(client);
      const code = genCode();
      const room = { host: client, members: new Map(), started: false };
      room.members.set(0, client);
      rooms.set(code, room);
      client.room = code; client.seat = 0;
      client.name = String(m.name || '房主').slice(0, 12);
      client.send({ t: 'room', code, seat: 0, host: true });
      broadcastLobby(room, code);
      log(`${client.name} 创建房间 ${code}`);
      break;
    }
    case 'join': {
      const room = rooms.get(String(m.code || ''));
      if (!room) return client.send({ t: 'err', msg: '房间不存在，请检查房间号' });
      if (room.started) return client.send({ t: 'err', msg: '该房间游戏已开始，无法加入' });
      if (room.members.size >= 5) return client.send({ t: 'err', msg: '房间已满（5人）' });
      leave(client);
      let seat = 1;
      while (room.members.has(seat)) seat++;
      room.members.set(seat, client);
      client.room = String(m.code); client.seat = seat;
      client.name = String(m.name || '玩家' + (seat + 1)).slice(0, 12);
      client.send({ t: 'room', code: client.room, seat, host: false });
      broadcastLobby(room, client.room);
      log(`${client.name} 加入房间 ${client.room}（${room.members.size}/5）`);
      break;
    }
    case 'start': {
      const room = rooms.get(client.room);
      if (!room || room.host !== client) return;
      room.started = true;
      for (const c of room.members.values()) c.send({ t: 'started' });
      log(`房间 ${client.room} 开始游戏（${room.members.size} 名玩家）`);
      break;
    }
    case 'msg': {
      const room = rooms.get(client.room);
      if (!room) return;
      const payload = { t: 'msg', from: client.seat, data: m.data };
      if (client.seat === 0) {           // 房主 → 指定座位
        const target = room.members.get(m.to);
        if (target) target.send(payload);
      } else {                            // 客户端 → 房主
        if (room.host) room.host.send(payload);
      }
      break;
    }
    case 'leave': leave(client); break;
    case 'hb': client.send({ t: 'hb' }); break;   /* 应用层心跳：客户端用来探测隧道假死 */
  }
}

/* ---------------- WS 接入 ---------------- */
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);

  const client = {
    id: nextId++, sock, room: null, seat: -1, name: '',
    send(o) { try { sock.write(encodeFrame(JSON.stringify(o))); } catch (e) { } }
  };
  let buf = Buffer.alloc(0);
  sock.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (; ;) {
      const f = decodeFrame(buf);
      if (!f) break;
      buf = f.rest;
      if (f.opcode === 8) { leave(client); try { sock.end(); } catch (e) { } return; }
      if (f.opcode === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, f.payload.length]), f.payload])); } catch (e) { } continue; }
      if (f.opcode !== 1) continue;
      let m; try { m = JSON.parse(f.payload.toString('utf8')); } catch (e) { continue; }
      try { handleMsg(client, m); } catch (e) { console.error('消息处理错误:', e); }
    }
  });
  sock.on('close', () => leave(client));
  sock.on('error', () => { });
});

/* ---------------- 启动 ---------------- */
function log(s) { console.log('[' + new Date().toLocaleTimeString() + '] ' + s); }
server.listen(PORT, () => {
  console.log('');
  console.log('============================================');
  console.log('  三国杀联机服务器已启动！');
  console.log('============================================');
  console.log('  本机访问:   http://localhost:' + PORT);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        console.log('  局域网地址: http://' + n.address + ':' + PORT + '   <-- 发给同一WiFi的朋友');
      }
    }
  }
  console.log('');
  console.log('  玩法：你打开网址 → 联机对局 → 创建房间 → 把房间号告诉朋友');
  console.log('  朋友浏览器打开同一个网址 → 加入房间 → 输入房间号');
  console.log('  不在同一网络？用 cpolar/花生壳 等免费内网穿透暴露 ' + PORT + ' 端口');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('============================================');
});
