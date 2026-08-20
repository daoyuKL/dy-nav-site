/* ==========================================================================
   DY导航站 · 你画我猜(WebSocket 单房间)
   ==========================================================================
   零依赖 WebSocket 服务端(协议 RFC 6455 最小实现) + 单房间游戏状态机。
   规则:满 3 人可开始,轮流当画师,其余玩家猜词;
         猜对 +10 分,画师 +5 分;每人画一轮,结束按总分排名。
   数据:房间与游戏状态仅存内存,服务器重启即清空(无持久化)。
   ========================================================================== */
const crypto = require("crypto");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PLAYERS = 8; // 单房间上限
const MIN_PLAYERS = 3; // 开始所需人数
const ROUND_SECONDS = 75; // 每回合秒数
const MAX_NAME = 12;
const MAX_GUESS = 30;

/* —— 词库 —— */
const WORDS = [
  "苹果", "月亮", "太阳", "星星", "小狗", "小猫", "老虎", "熊猫", "兔子", "大象",
  "长颈鹿", "企鹅", "海豚", "鲨鱼", "鲸鱼", "蝴蝶", "蜜蜂", "蚂蚁", "乌龟", "恐龙",
  "火车", "飞机", "轮船", "汽车", "自行车", "摩托车", "公交车", "热气球", "火箭", "飞船",
  "房子", "大树", "花朵", "高山", "大海", "沙漠", "火山", "彩虹", "雪花", "冰激凌",
  "蛋糕", "西瓜", "香蕉", "葡萄", "汉堡", "披萨", "面条", "饺子", "火锅", "奶茶",
  "手机", "电脑", "电视机", "冰箱", "闹钟", "雨伞", "书包", "铅笔", "足球", "篮球",
  "乒乓球", "羽毛球", "游泳", "跑步", "跳绳", "滑冰", "滑雪", "放风筝", "钓鱼", "野餐",
  "医生", "老师", "警察", "消防员", "厨师", "画家", "宇航员", "圣诞老人", "机器人", "木乃伊",
  "海盗", "国王", "公主", "超人", "蜘蛛侠", "孙悟空", "猪八戒", "哪吒", "葫芦娃", "奥特曼",
  "长城", "天安门", "金字塔", "城堡", "灯塔", "火车道", "地铁", "红绿灯", "加油站", "超市",
];

/* ==========================================================================
   WebSocket 帧编解码
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

/* 从缓冲区解析一帧;数据不足返回 null */
function parseFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
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
  return { fin, opcode, payload, consumed: off + len };
}

/* ==========================================================================
   WebSocket 连接封装
   ========================================================================== */

class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.player = null; // 绑定的玩家对象
    socket.on("data", (d) => this.onData(d));
    socket.on("close", () => onDisconnect(this));
    socket.on("error", () => {});
  }

  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const frame = parseFrame(this.buf);
      if (!frame) return; // 等更多数据
      this.buf = this.buf.slice(frame.consumed);
      if (frame.opcode === 0x8) { // close
        try { this.socket.write(encodeFrame(0x8, frame.payload)); } catch (e) { /* 忽略 */ }
        this.socket.destroy();
        return;
      }
      if (frame.opcode === 0x9) { // ping → pong
        try { this.socket.write(encodeFrame(0xa, frame.payload)); } catch (e) { /* 忽略 */ }
        continue;
      }
      if (frame.opcode === 0x1) { // 文本
        handleMessage(this, frame.payload.toString("utf8"));
      }
      // 其他 opcode(二进制/分片)忽略:客户端只用文本帧
    }
  }

  send(obj) {
    try {
      this.socket.write(encodeFrame(0x1, Buffer.from(JSON.stringify(obj), "utf8")));
    } catch (e) { /* 连接已断 */ }
  }
}

/* ==========================================================================
   单房间游戏状态
   ========================================================================== */

const room = {
  players: [],      // {conn, id, name, score}
  ownerId: null,    // 房主(第一个进入房间的人,只有房主能开始)
  started: false,
  round: 0,
  maxRounds: 0,
  drawerId: null,
  word: "",
  timer: null,
  secondsLeft: 0,
  usedWords: [],
};

function sendJSON(conn, obj) { conn.send(obj); }
function all() { return room.players; }
function byConn(conn) { return room.players.find((p) => p.conn === conn) || null; }
function byId(id) { return room.players.find((p) => p.id === id) || null; }
function isDrawer(conn) { return byConn(conn) && byConn(conn).id === room.drawerId; }

function publicPlayers() {
  return room.players.map((p) => ({ id: p.id, name: p.name, score: p.score, qq: p.qq || "" }));
}

function broadcast(obj, excludeId) {
  const msg = JSON.stringify(obj);
  room.players.forEach((p) => {
    if (p.id !== excludeId) {
      try { p.conn.socket.write(encodeFrame(0x1, Buffer.from(msg, "utf8"))); } catch (e) { /* 忽略 */ }
    }
  });
}

function pickWord() {
  const pool = WORDS.filter((w) => !room.usedWords.includes(w));
  const src = pool.length ? pool : WORDS;
  const w = src[Math.floor(Math.random() * src.length)];
  room.usedWords.push(w);
  if (room.usedWords.length > WORDS.length) room.usedWords = [];
  return w;
}

function clearTimer() {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
}

/* 开始下一回合 */
function nextRound() {
  clearTimer();
  if (!room.started || !room.players.length) {
    // 游戏未开始或房间已没人:安全退出(防止空房间崩溃)
    room.started = false;
    room.drawerId = null;
    room.word = "";
    return;
  }
  room.round++;
  if (room.round > room.maxRounds) return endGame();
  const drawer = room.players[(room.round - 1) % room.players.length];
  room.drawerId = drawer.id;
  room.word = pickWord();
  room.secondsLeft = ROUND_SECONDS;
  broadcast({
    t: "round",
    drawer: drawer.id,
    drawerName: drawer.name,
    wordLen: [...room.word].length,
    round: room.round,
    maxRounds: room.maxRounds,
    seconds: ROUND_SECONDS,
  });
  // 单独告诉画师答案(其他玩家保密)
  const drawerP = byId(room.drawerId);
  if (drawerP) drawerP.conn.send({ t: "yourword", word: room.word });
  room.timer = setInterval(() => {
    room.secondsLeft--;
    if (room.secondsLeft <= 0) {
      clearTimer();
      broadcast({ t: "timeout", answer: room.word, drawer: room.drawerId });
      setTimeout(nextRound, 3500);
    } else {
      broadcast({ t: "tick", seconds: room.secondsLeft });
    }
  }, 1000);
}

function endGame() {
  clearTimer();
  room.started = false;
  room.drawerId = null;
  room.word = "";
  const ranking = room.players
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ name: p.name, score: p.score }));
  broadcast({ t: "over", ranking });
}

/* ==========================================================================
   消息处理
   ========================================================================== */

function handleMessage(conn, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  if (!msg || typeof msg.t !== "string") return;
  const p = byConn(conn);

  switch (msg.t) {
    /* —— 加入房间 —— */
    case "join": {
      if (p) return; // 已加入
      if (room.players.length >= MAX_PLAYERS) {
        conn.send({ t: "full" });
        conn.socket.destroy();
        return;
      }
      const name = String(msg.name || "").trim().slice(0, MAX_NAME) || "玩家" + (room.players.length + 1);
      const qq = /^\d{5,11}$/.test(String(msg.qq || "")) ? String(msg.qq) : "";
      const player = { conn, id: crypto.randomBytes(6).toString("hex"), name, score: 0, qq };
      room.players.push(player);
      conn.player = player;
      // 第一个进入房间的人是房主
      if (!room.ownerId) room.ownerId = player.id;
      conn.send({ t: "joined", id: player.id, name: player.name, players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId });
      broadcast({ t: "players", players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId }, player.id);
      broadcast({ t: "chat", name: "系统", text: name + " 加入了房间" + (room.ownerId === player.id ? "(房主)" : ""), }, player.id);
      return;
    }

    /* —— 开始游戏(仅房主) —— */
    case "start": {
      if (!p) return;
      if (p.id !== room.ownerId) {
        conn.send({ t: "system", text: "只有房主可以开始游戏" });
        return;
      }
      if (room.started) return;
      if (room.players.length < MIN_PLAYERS) {
        conn.send({ t: "need3", n: MIN_PLAYERS - room.players.length });
        return;
      }
      room.started = true;
      room.round = 0;
      room.maxRounds = room.players.length; // 每人画一轮
      room.players.forEach((x) => (x.score = 0));
      broadcast({ t: "started" });
      nextRound();
      return;
    }

    /* —— 再来一局(仅房主) —— */
    case "restart": {
      if (!p || room.started) return;
      if (p.id !== room.ownerId) {
        conn.send({ t: "system", text: "只有房主可以开始游戏" });
        return;
      }
      room.started = true;
      room.round = 0;
      room.maxRounds = room.players.length;
      room.players.forEach((x) => (x.score = 0));
      broadcast({ t: "started" });
      nextRound();
      return;
    }

    /* —— 画师笔画 —— */
    case "draw": {
      if (!p || !room.started || !isDrawer(conn)) return;
      const d = msg;
      broadcast({
        t: "draw",
        x1: +d.x1, y1: +d.y1, x2: +d.x2, y2: +d.y2,
        c: String(d.c || "#000").slice(0, 9),
        w: Math.min(Math.max(+d.w || 3, 1), 60),
      }, p.id);
      return;
    }

    /* —— 清空画布 —— */
    case "clear": {
      if (!p || !room.started || !isDrawer(conn)) return;
      broadcast({ t: "clear" }, p.id);
      return;
    }

    /* —— 猜词 —— */
    case "guess": {
      if (!p || !room.started || isDrawer(conn)) return;
      const text = String(msg.text || "").trim().slice(0, MAX_GUESS);
      if (!text) return;
      if (text === room.word || text.replace(/\s+/g, "") === room.word) {
        p.score += 10;
        const drawer = byId(room.drawerId);
        if (drawer) drawer.score += 5;
        clearTimer();
        broadcast({
          t: "result",
          ok: true,
          name: p.name,
          answer: room.word,
          scores: publicPlayers(),
          drawer: room.drawerId,
        });
        setTimeout(nextRound, 3500);
      } else {
        conn.send({ t: "result", ok: false });
      }
      return;
    }

    /* —— 房间内聊天 —— */
    case "chat": {
      if (!p) return;
      const text = String(msg.text || "").trim().slice(0, 100);
      if (!text) return;
      broadcast({ t: "chat", name: p.name, text });
      return;
    }

    default:
      return;
  }
}

/* ==========================================================================
   断线处理
   ========================================================================== */

function onDisconnect(conn) {
  const idx = room.players.findIndex((x) => x.conn === conn);
  if (idx < 0) return;
  const wasDrawer = room.players[idx].id === room.drawerId;
  const wasOwner = room.players[idx].id === room.ownerId;
  const name = room.players[idx].name;
  room.players.splice(idx, 1);
  // 房主离开:把房主转让给剩余第一个玩家
  if (wasOwner) {
    room.ownerId = room.players.length ? room.players[0].id : null;
    if (room.ownerId) {
      broadcast({ t: "chat", name: "系统", text: "房主已转让给 " + byId(room.ownerId).name });
    }
  }
  broadcast({ t: "players", players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId });
  broadcast({ t: "chat", name: "系统", text: name + " 离开了房间" });
  if (room.started && wasDrawer) {
    // 画师跑了:跳过当前回合
    clearTimer();
    broadcast({ t: "drawer-left" });
    if (room.players.length >= 2) setTimeout(nextRound, 1500);
    else { room.started = false; broadcast({ t: "over", ranking: [] }); }
  }
  if (room.started && room.players.length < 2) {
    // 人太少,结束本局
    clearTimer();
    room.started = false;
    broadcast({ t: "over", ranking: [] });
  }
}

/* ==========================================================================
   HTTP Upgrade 入口
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

module.exports = { handleUpgrade };
