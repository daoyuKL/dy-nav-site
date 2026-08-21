/* ==========================================================================
   DY导航站 · 一起听(WebSocket 单房间 · 多房间由 ws-router 管理)
   ==========================================================================
   零依赖 WebSocket 服务端 + 共享音乐播放列表状态机。
   规则:
     - 房主(第一个加入者)= DJ,控制 播放/暂停/跳转/下一首
     - 所有成员可搜索推荐歌曲加入播放列表(不打断当前播放)
     - 歌曲按播放列表顺序一首接一首播放(一轮一轮)
     - DJ 每 5 秒上报播放位置,服务器转发给其他成员做同步
   连接路径:/ws-music(需 ?room=XXXX)
   ========================================================================== */
const crypto = require("crypto");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PLAYERS = 20; // 一起听房间人数上限
const MAX_NAME = 12;
const MAX_QUEUE = 50; // 播放列表上限
const MAX_QUEUE_TEXT = 80;

/* ==========================================================================
   WebSocket 帧编解码(与 ws-game.js 相同的最小实现)
   ========================================================================== */

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function parseFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    const big = buf.readBigUInt64BE(2);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    len = Number(big);
    off = 10;
  }
  let maskKey = null;
  if (masked) {
    if (buf.length < off + 4) return null;
    maskKey = buf.slice(off, off + 4);
    off += 4;
  }
  if (buf.length < off + len) return null;
  let payload = buf.slice(off, off + len);
  if (masked && maskKey) {
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
  }
  return { opcode, payload, consumed: off + len };
}

class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.player = null;
    try { socket.setNoDelay(true); } catch (e) { /* 忽略 */ }
    socket.on("data", (d) => this.onData(d));
    socket.on("close", () => onDisconnect(this));
    socket.on("error", () => {});
  }

  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const frame = parseFrame(this.buf);
      if (!frame) return;
      this.buf = this.buf.slice(frame.consumed);
      if (frame.opcode === 0x8) {
        try { this.socket.write(encodeFrame(0x8, frame.payload)); } catch (e) { /* 忽略 */ }
        this.socket.destroy();
        return;
      }
      if (frame.opcode === 0x9) {
        try { this.socket.write(encodeFrame(0xa, frame.payload)); } catch (e) { /* 忽略 */ }
        continue;
      }
      if (frame.opcode === 0x1) {
        handleMessage(this, frame.payload.toString("utf8"));
      }
    }
  }

  send(obj) {
    try {
      this.socket.write(encodeFrame(0x1, Buffer.from(JSON.stringify(obj), "utf8")));
    } catch (e) { /* 连接已断 */ }
  }
}

/* ==========================================================================
   房间状态
   ========================================================================== */

const room = {
  players: [],   // {conn, id, name, qq}
  djId: null,    // 房主(DJ),第一个加入者
  queue: [],     // [{id, name, artist, by}]
  current: null, // {id, name, artist, by}
  playing: false,
  position: 0,
};

function publicPlayer(p) {
  return { id: p.id, name: p.name, qq: p.qq || "" };
}

function broadcast(obj, exceptConn) {
  room.players.forEach((p) => {
    if (p.conn && p.conn !== exceptConn) p.conn.send(obj);
  });
}

function broadcastState() {
  broadcast({
    t: "state",
    players: room.players.map(publicPlayer),
    djId: room.djId,
    queue: room.queue,
    current: room.current,
    playing: room.playing,
    position: room.position,
  });
}

function system(text) {
  broadcast({ t: "system", text });
}

function isDj(conn) {
  return conn.player && conn.player.id === room.djId;
}

/* —— 推进到下一首(轮播) —— */
function advance() {
  if (room.queue.length) {
    room.current = room.queue.shift();
    room.playing = true;
    room.position = 0;
    broadcast({ t: "song", song: room.current, playing: true, position: 0 });
    system(`🎵 开始播放:${room.current.name}${room.current.artist ? " - " + room.current.artist : ""}`);
  } else {
    room.current = null;
    room.playing = false;
    room.position = 0;
    broadcast({ t: "song", song: null, playing: false, position: 0 });
    system("📭 播放列表已空,大家来推荐歌曲吧");
  }
}

/* ==========================================================================
   消息处理
   ========================================================================== */

function handleMessage(conn, raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { return; }
  if (!data || typeof data !== "object") return;

  switch (data.t) {
    case "join":
      doJoin(conn, data);
      break;
    case "rec":
      doRec(conn, data);
      break;
    case "dj-play":
      if (isDj(conn)) {
        room.playing = true;
        broadcast({ t: "play-state", playing: true, position: room.position });
        system("▶️ DJ 开始播放");
      }
      break;
    case "dj-pause":
      if (isDj(conn)) {
        room.playing = false;
        broadcast({ t: "play-state", playing: false, position: room.position });
        system("⏸️ DJ 暂停了播放");
      }
      break;
    case "dj-seek":
      if (isDj(conn)) {
        room.position = Math.max(0, Number(data.position) || 0);
        broadcast({ t: "play-state", playing: room.playing, position: room.position });
      }
      break;
    case "dj-pos":
      if (isDj(conn)) {
        room.position = Math.max(0, Number(data.position) || 0);
        broadcast({ t: "pos-sync", position: room.position });
      }
      break;
    case "dj-next":
      if (isDj(conn)) advance();
      break;
    case "song-end":
      if (isDj(conn)) advance();
      break;
    default:
      break;
  }
}

function doJoin(conn, data) {
  if (conn.player) return;
  if (room.players.length >= MAX_PLAYERS) {
    conn.send({ t: "full", error: `房间已满(${MAX_PLAYERS} 人)` });
    return;
  }
  const name = String(data.name || "").trim().slice(0, MAX_NAME) || "听众" + (room.players.length + 1);
  const cid = String(data.cid || "").slice(0, 64);
  const p = {
    conn,
    id: crypto.randomBytes(6).toString("hex"),
    name,
    qq: String(data.qq || ""),
    cid,
  };

  /* 同身份(cid)重复进入:顶掉旧连接,防止留下"死人"占位 */
  if (cid) {
    const dup = room.players.find((x) => x.cid && x.cid === cid);
    if (dup) {
      if (dup.id === room.djId) room.djId = p.id; // DJ 身份转移给新连接
      try { dup.conn.send({ t: "system", text: "检测到重复进入,旧连接已断开" }); } catch (e) { /* 忽略 */ }
      try { dup.conn.socket.destroy(); } catch (e) { /* 忽略 */ }
      room.players = room.players.filter((x) => x !== dup);
    }
  }

  room.players.push(p);
  conn.player = p;
  if (!room.djId) room.djId = p.id;

  conn.send({
    t: "joined",
    id: p.id,
    djId: room.djId,
    players: room.players.map(publicPlayer),
    queue: room.queue,
    current: room.current,
    playing: room.playing,
    position: room.position,
  });
  broadcastState();
  system(`👤 ${p.name} 加入了房间${p.id === room.djId ? "(成为 DJ)" : ""}`);
  /* 房间刚建,DJ 加入后若列表有歌则自动开播 */
  if (p.id === room.djId && !room.current && room.queue.length) {
    advance();
  }
}

function doRec(conn, data) {
  if (!conn.player) return;
  const id = Number(data.id);
  if (!id) return;
  const name = String(data.name || "").trim().slice(0, MAX_QUEUE_TEXT) || "未知歌曲";
  const artist = String(data.artist || "").trim().slice(0, MAX_QUEUE_TEXT);
  if (room.queue.length >= MAX_QUEUE) {
    system(`⛔ 播放列表已满(${MAX_QUEUE} 首),请等几首播完再推荐`);
    return;
  }
  room.queue.push({ id, name, artist, by: conn.player.name });
  broadcastState();
  system(`🎵 ${conn.player.name} 推荐了《${name}》${artist ? " - " + artist : ""}(已加入列表,稍后播放)`);
  /* 没有正在播放的歌且当前是 DJ → 自动开始 */
  if (!room.current && isDj(conn)) {
    advance();
  }
}

function onDisconnect(conn) {
  const p = conn.player;
  if (!p) return;
  conn.player = null;
  room.players = room.players.filter((x) => x !== p);
  system(`👋 ${p.name} 离开了房间`);
  if (p.id === room.djId) {
    room.djId = room.players.length ? room.players[0].id : null;
    if (room.djId) {
      system(`🎧 ${room.players.find((x) => x.id === room.djId).name} 成为了新的 DJ`);
    }
  }
  if (room.players.length) broadcastState();
}

/* ==========================================================================
   HTTP Upgrade + 房间解散
   ========================================================================== */

function handleUpgrade(req, socket) {
  const upgrade = String(req.headers.upgrade || "").toLowerCase();
  if (upgrade !== "websocket") { socket.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash("sha1").update(key + WS_MAGIC).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
  );
  new WSConn(socket);
}

function disband(reason) {
  room.players.forEach((p) => {
    try { p.conn.send({ t: "system", text: reason || "房间已解散" }); } catch (e) { /* 忽略 */ }
  });
  setTimeout(() => {
    room.players.forEach((p) => { try { p.conn.socket.destroy(); } catch (e) { /* 忽略 */ } });
    room.players = [];
  }, 900);
}

/* —— 房间信息(房间列表展示用) —— */
function info() {
  return {
    players: room.players.length,
    current: room.current ? room.current.name : null,
    queue: room.queue.length,
  };
}

module.exports = { handleUpgrade, disband, count: () => room.players.length, info };
