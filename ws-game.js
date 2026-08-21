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
const KICK_SECONDS = 30; // 踢人投票时长(秒)
const KICK_RATIO = 3 / 4; // 需所有真人 3/4 同意
const RECONNECT_GRACE = 12000; // 掉线宽限:12 秒内同身份重连恢复状态(刷新/挂后台)

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
    // 关闭 Nagle 算法:实时游戏小消息需立即发送,否则合并延迟导致卡顿
    try { socket.setNoDelay(true); } catch (e) { /* 忽略 */ }
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
  roundOver: false, // 本轮是否已结算(防多人同时猜对导致跳轮)
  usedWords: [],
  kickVote: null,   // 踢人投票 { targetId, targetName, needed, voters, votes, timer }
};

function sendJSON(conn, obj) { conn.send(obj); }
function all() { return room.players; }
function byConn(conn) { return room.players.find((p) => p.conn === conn) || null; }
function byId(id) { return room.players.find((p) => p.id === id) || null; }
function isDrawer(conn) { return byConn(conn) && byConn(conn).id === room.drawerId; }

function publicPlayers() {
  return room.players.map((p) => ({ id: p.id, name: p.name, score: p.score, qq: p.qq || "", bot: !!p.bot }));
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
  room.roundOver = false; // 新一轮开始,重置结算标志
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
      if (!room.roundOver) { // 超时结算(猜对优先,两者互斥)
        room.roundOver = true;
        broadcast({ t: "timeout", answer: room.word, drawer: room.drawerId });
        setTimeout(nextRound, 3500);
      }
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
   人机(Bot):房主可添加,用于凑人数陪玩
   ========================================================================== */
const BOT_NAMES = ["小机灵", "画渣一号", "AI画手", "神秘人", "路小雨", "萌新小白", "老画师", "猜词王", "夜猫子", "小太阳", "摸鱼大师", "快乐星球"];
const BOT_CHATS = ["这画的是啥呀🤔", "我好像猜到了!", "哈哈 好抽象", "有点难啊", "画师加油🎨", "再画两笔呗", "我蒙一个", "这题我熟", "偷偷记笔记📝", "下一题下一题"];
const DRAW_COLORS = ["#e74c3c", "#f39c12", "#2ecc71", "#3498db", "#9b59b6", "#000000"];

/* 人机的"假连接":广播写入、发送消息全部忽略,行为由 botTick 定时驱动 */
function makeBotConn() {
  return {
    player: null,
    send() {},
    socket: { write() {}, destroyed: false },
  };
}

function makeBotName() {
  const base = BOT_NAMES[room.players.filter((p) => p.bot).length % BOT_NAMES.length];
  return room.players.some((p) => p.name === base) ? base + (room.players.length + 1) : base;
}

/* 人机当画师:随机颜色/粗细,画一段涂鸦 */
function botDraw(bot) {
  let x = 40 + Math.random() * 720;
  let y = 40 + Math.random() * 420;
  const c = DRAW_COLORS[Math.floor(Math.random() * DRAW_COLORS.length)];
  const w = Math.round(3 + Math.random() * 17);
  const segs = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < segs; i++) {
    const nx = Math.min(790, Math.max(10, x + (Math.random() - 0.5) * 260));
    const ny = Math.min(490, Math.max(10, y + (Math.random() - 0.5) * 260));
    broadcast({
      t: "draw",
      x1: Math.round(x * 10) / 10, y1: Math.round(y * 10) / 10,
      x2: Math.round(nx * 10) / 10, y2: Math.round(ny * 10) / 10,
      c, w,
    });
    x = nx; y = ny;
  }
}

/* 人机猜词:猜中概率随时间上升(开局 ~5%,60 秒时 ~40%),偶尔蒙个错的活跃气氛 */
function botGuess(bot) {
  const elapsed = ROUND_SECONDS - room.secondsLeft;
  const pCorrect = Math.min(0.05 + elapsed * 0.006, 0.5);
  if (Math.random() < pCorrect) {
    applyGuess(bot, room.word);
  } else if (Math.random() < 0.5) {
    let w = room.word;
    while (w === room.word) w = WORDS[Math.floor(Math.random() * WORDS.length)];
    applyGuess(bot, w);
  }
}

/* 人机心跳:游戏中每 2~3.5 秒行动一次 */
function botTick(bot) {
  if (!room.started) return;
  if (bot.id === room.drawerId) {
    botDraw(bot);
  } else if (!room.roundOver) {
    botGuess(bot);
  }
  if (Math.random() < 0.05) {
    broadcast({ t: "chat", name: bot.name, text: BOT_CHATS[Math.floor(Math.random() * BOT_CHATS.length)] });
  }
}

/* 猜词结算(返回是否猜对),真人/人机共用 */
function applyGuess(p, text) {
  if (room.roundOver) return false; // 本轮已结算,防多人同时猜对跳轮
  if (text === room.word || text.replace(/\s+/g, "") === room.word) {
    room.roundOver = true; // 锁定结算,后续猜对不再触发下一轮
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
    setTimeout(() => { room.roundOver = false; nextRound(); }, 3500);
    return true;
  }
  return false;
}

/* 添加 n 个人机(房主专用,未开局时;返回实际添加数量) */
function addBots(n) {
  if (room.started) return 0;
  const count = Math.max(0, Math.min(n, MAX_PLAYERS - room.players.length));
  for (let i = 0; i < count; i++) {
    const bot = {
      conn: makeBotConn(),
      id: crypto.randomBytes(6).toString("hex"),
      name: makeBotName(),
      score: 0,
      qq: "",
      bot: true,
      _timer: setInterval(() => botTick(bot), 2000 + Math.random() * 1500),
    };
    room.players.push(bot);
  }
  if (!count) return 0;
  broadcast({ t: "players", players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId });
  room.players.filter((p) => p.bot).slice(-count).forEach((b) => {
    broadcast({ t: "chat", name: "系统", text: "🤖 " + b.name + " 加入了房间(人机)" });
  });
  return count;
}

/* 移除玩家(真人掉线 / 房主移除人机 / 投票踢出 共用)
   真人离开时人机自动离场(腾出位置,避免堵住真人进房);
   同时处理房主转让、画师离开与踢人投票结算 */
function removePlayer(id) {
  const idx = room.players.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const pl = room.players[idx];
  const wasDrawer = pl.id === room.drawerId;
  const wasOwner = pl.id === room.ownerId;
  const wasHuman = !pl.bot;
  if (pl.bot && pl._timer) clearInterval(pl._timer);
  room.players.splice(idx, 1);

  // 真人离开 → 人机自动离场
  let botsLeft = 0;
  if (wasHuman && room.players.some((x) => x.bot)) {
    botsLeft = room.players.filter((x) => x.bot).length;
    room.players.forEach((b) => { if (b.bot && b._timer) clearInterval(b._timer); });
    room.players = room.players.filter((x) => !x.bot);
  }

  // 房主离开:把房主转让给剩余第一个玩家
  if (wasOwner) {
    room.ownerId = room.players.length ? room.players[0].id : null;
    if (room.ownerId) {
      broadcast({ t: "chat", name: "系统", text: "房主已转让给 " + byId(room.ownerId).name });
    }
  }
  broadcast({ t: "players", players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId });
  broadcast({ t: "chat", name: "系统", text: pl.name + " 离开了房间" + (pl.bot ? "(人机)" : "") });
  if (botsLeft) {
    broadcast({ t: "chat", name: "系统", text: "真人离开," + botsLeft + " 个人机已自动离场" });
  }

  // 画师离开(或被踢、人机画师被清):跳过当前回合
  const drawerGone = room.started && room.drawerId && !byId(room.drawerId);
  if (room.started && (wasDrawer || drawerGone)) {
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

  // 踢人投票:目标离开则取消;投票人离开则重新结算
  if (room.kickVote && (room.kickVote.targetId === id || !byId(room.kickVote.targetId))) {
    clearTimeout(room.kickVote.timer);
    room.kickVote = null;
    broadcast({ t: "kickvote-end", ok: false, targetId: id, targetName: pl.name, agree: 0, needed: 0, reason: "目标已离开房间" });
  }
  tryResolveKickVote();
}

/* ==========================================================================
   踢人投票:房主发起,需所有真人 3/4 同意(不足 1 人按 1 人计)
   ========================================================================== */

function humanPlayers() {
  return room.players.filter((p) => !p.bot);
}

/* 发起踢人投票(仅房主) */
function startKickVote(initiatorId, targetId) {
  const target = byId(targetId);
  if (!target) return { ok: false, error: "目标玩家不存在" };
  if (target.bot) return { ok: false, error: "人机无需投票,房主可直接移除" };
  if (target.id === initiatorId) return { ok: false, error: "不能踢自己" };
  if (target.id === room.ownerId) return { ok: false, error: "不能踢房主" };
  if (room.kickVote) return { ok: false, error: "已有踢人投票在进行中" };
  const voters = humanPlayers().map((p) => p.id);
  const needed = Math.max(1, Math.ceil(voters.length * KICK_RATIO));
  room.kickVote = {
    targetId: target.id,
    targetName: target.name,
    needed,
    voters,
    votes: {},
    timer: setTimeout(resolveKickVote, KICK_SECONDS * 1000),
  };
  broadcast({
    t: "kickvote-start",
    targetId: target.id,
    targetName: target.name,
    needed,
    humans: voters.length,
    seconds: KICK_SECONDS,
  });
  return { ok: true };
}

/* 真人投票(每人一票,投了不能改) */
function castKickVote(p, agree) {
  const kv = room.kickVote;
  if (!kv || !kv.voters.includes(p.id)) return;
  if (kv.votes[p.id] !== undefined) return;
  kv.votes[p.id] = !!agree;
  broadcast({ t: "kickvote-update", votes: kv.votes, needed: kv.needed });
  tryResolveKickVote();
}

/* 所有仍在房的真人投完票 → 立即结算 */
function tryResolveKickVote() {
  const kv = room.kickVote;
  if (!kv) return;
  const remaining = kv.voters.filter((id) => byId(id));
  if (remaining.every((id) => kv.votes[id] !== undefined)) resolveKickVote();
}

/* 结算投票:同意数 ≥ 需要数则踢出 */
function resolveKickVote() {
  const kv = room.kickVote;
  if (!kv) return;
  clearTimeout(kv.timer);
  room.kickVote = null;
  const agree = Object.values(kv.votes).filter(Boolean).length;
  const ok = agree >= kv.needed;
  broadcast({ t: "kickvote-end", ok, targetId: kv.targetId, targetName: kv.targetName, agree, needed: kv.needed });
  if (ok) setTimeout(() => removePlayer(kv.targetId), 800); // 稍等片刻,让所有人看到结果
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
      const cid = String(msg.cid || "").slice(0, 64);

      /* 掉线宽限期内同身份(cid)重连:恢复原玩家(保留分数等状态),刷新/挂后台能"跟回来" */
      const old = cid ? room.players.find((x) => x.cid === cid && x.offline && x.conn === null) : null;
      if (old) {
        if (old._offlineTimer) { clearTimeout(old._offlineTimer); old._offlineTimer = null; }
        old.offline = 0;
        old.conn = conn;
        old.name = name;
        conn.player = old;
        conn.send({ t: "joined", id: old.id, name: old.name, players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId });
        broadcast({ t: "players", players: publicPlayers(), started: room.started, min: MIN_PLAYERS, ownerId: room.ownerId }, old.id);
        broadcast({ t: "chat", name: "系统", text: name + " 回来了(刷新后自动重连)" }, old.id);
        return;
      }

      const player = { conn, id: crypto.randomBytes(6).toString("hex"), name, score: 0, qq, cid, offline: 0 };
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
      if (!applyGuess(p, text)) conn.send({ t: "result", ok: false });
      return;
    }

    /* —— 添加人机(仅房主,未开局时) —— */
    case "addbot": {
      if (!p) return;
      if (p.id !== room.ownerId) {
        conn.send({ t: "system", text: "只有房主可以添加人机" });
        return;
      }
      if (room.started) {
        conn.send({ t: "system", text: "游戏进行中,无法添加人机" });
        return;
      }
      const n = Math.min(Math.max(parseInt(msg.n, 10) || 1, 1), 8);
      if (!addBots(n)) conn.send({ t: "system", text: "房间已满,无法添加人机" });
      return;
    }

    /* —— 移除人机(仅房主) —— */
    case "removebot": {
      if (!p || p.id !== room.ownerId) return;
      if (msg.all) {
        room.players.filter((x) => x.bot).slice().forEach((b) => removePlayer(b.id));
        return;
      }
      const t = byId(String(msg.id || ""));
      if (t && t.bot) removePlayer(t.id);
      return;
    }

    /* —— 发起踢人投票(仅房主) —— */
    case "kick": {
      if (!p) return;
      if (p.id !== room.ownerId) {
        conn.send({ t: "system", text: "只有房主可以发起踢人投票" });
        return;
      }
      const r = startKickVote(p.id, String(msg.target || ""));
      if (!r.ok) conn.send({ t: "system", text: r.error });
      return;
    }

    /* —— 踢人投票(真人每人一票) —— */
    case "kickvote": {
      if (!p || p.bot) return;
      castKickVote(p, !!msg.agree);
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
  const p = byConn(conn);
  if (!p) return;
  conn.player = null;
  /* 踢人投票目标掉线:立即取消投票 */
  if (room.kickVote && room.kickVote.targetId === p.id) {
    clearTimeout(room.kickVote.timer);
    room.kickVote = null;
    broadcast({ t: "kickvote-end", ok: false, targetId: p.id, targetName: p.name, agree: 0, needed: 0, reason: "目标已离开房间" });
  }
  if (!room.started) {
    /* 大厅:直接移除(无状态可保留) */
    removePlayer(p.id);
    return;
  }
  /* 游戏中掉线:12 秒宽限,同身份重连可恢复(刷新/挂后台),超时再移除 */
  p.offline = Date.now();
  p.conn = null;
  if (p._offlineTimer) clearTimeout(p._offlineTimer);
  p._offlineTimer = setTimeout(() => {
    if (p.offline && p.conn === null && byId(p.id)) removePlayer(p.id);
  }, RECONNECT_GRACE);
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

/* —— 房间解散(超时自动解散):通知所有玩家并断开连接 —— */
function disband(reason) {
  room.players.forEach((p) => {
    try { p.conn.send({ t: "system", text: reason || "房间已解散" }); } catch (e) { /* 忽略 */ }
  });
  setTimeout(() => {
    room.players.forEach((p) => { try { p.conn.socket.destroy(); } catch (e) { /* 忽略 */ } });
    room.players = [];
  }, 900);
}

module.exports = { handleUpgrade, disband, count: () => room.players.length };
