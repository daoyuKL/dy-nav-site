/* ==========================================================================
   DY导航站 · 狼人杀(WebSocket 单房间)
   ==========================================================================
   零依赖 WebSocket 服务端 + 单房间狼人杀状态机。
   规则(简化版):
     - 6-12 人,角色:狼人/预言家/女巫/猎人/村民
     - 夜晚:狼人刀人(票多者被刀)→ 预言家查验 → 女巫救/毒
     - 白天:公布死讯 → 讨论 → 投票放逐
     - 猎人出局可开枪带走一人
     - 胜负:狼人全灭 → 好人胜;狼人数 ≥ 存活好人数 → 狼人胜
   连接路径:/ws-werewolf
   ========================================================================== */
const crypto = require("crypto");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MIN_PLAYERS = 6;
const MAX_PLAYERS = 12;
const MAX_NAME = 12;
const MAX_CHAT = 100;
const SECONDS = { kill: 25, seer: 20, witch: 20, discuss: 60, vote: 30, shoot: 20 };

const ROLE_NAMES = { wolf: "🐺 狼人", seer: "🔮 预言家", witch: "🧪 女巫", hunter: "🏹 猎人", villager: "👨‍🌾 村民" };
const GOOD_NAMES = { seer: "预言家", witch: "女巫", hunter: "猎人", villager: "村民" };

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
    len = Number(buf.readBigUInt64BE(2));
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
    // 关闭 Nagle 算法:实时游戏小消息需立即发送,否则合并延迟导致卡顿
    try { socket.setNoDelay(true); } catch (e) {}
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
        try { this.socket.write(encodeFrame(0x8, frame.payload)); } catch (e) {}
        this.socket.destroy();
        return;
      }
      if (frame.opcode === 0x9) {
        try { this.socket.write(encodeFrame(0xa, frame.payload)); } catch (e) {}
        continue;
      }
      if (frame.opcode === 0x1) handleMessage(this, frame.payload.toString("utf8"));
    }
  }
  send(obj) {
    try { this.socket.write(encodeFrame(0x1, Buffer.from(JSON.stringify(obj), "utf8"))); } catch (e) {}
  }
}

/* ==========================================================================
   房间状态
   ========================================================================== */

const room = {
  players: [], // {conn, id, name, qq, role, alive, shot}
  ownerId: null, // 房主(第一个进入房间的人,只有房主能开始)
  phase: "lobby", // lobby|kill|seer|witch|shoot|discuss|vote|over
  timer: null,
  nightNo: 0,
  wolfVotes: {},   // wolfId -> targetId(每狼一票,投了不能改)
  seerResult: null,
  seerUsed: false,       // 预言家本晚是否已查验(每晚一次)
  saveTarget: null,
  poisonTarget: null,
  killedTonight: null,
  witchHasSave: true,
  witchHasPoison: true,
  witchUsedTonight: false, // 女巫本晚是否已用药(每晚只能用一种药一次)
  hunterShots: {}, // hunterId -> targetId
  votes: {},       // voterId -> targetId
  lastDeaths: [],  // 上轮死的人(名字)
};

function byConn(conn) { return room.players.find((p) => p.conn === conn) || null; }
function byId(id) { return room.players.find((p) => p.id === id) || null; }
function aliveList() { return room.players.filter((p) => p.alive); }
function wolves() { return room.players.filter((p) => p.alive && p.role === "wolf"); }

function publicPlayers() {
  return room.players.map((p) => ({ id: p.id, name: p.name, qq: p.qq || "", alive: p.alive, score: 0, bot: !!p.bot }));
}

function broadcast(obj, excludeId) {
  const msg = JSON.stringify(obj);
  room.players.forEach((p) => {
    if (p.id !== excludeId) {
      try { p.conn.socket.write(encodeFrame(0x1, Buffer.from(msg, "utf8"))); } catch (e) {}
    }
  });
}

function sendTo(id, obj) {
  const p = byId(id);
  if (p) p.conn.send(obj);
}

function clearTimer() {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
}

function setPhase(phase, extra) {
  room.phase = phase;
  broadcast({ t: "phase", phase, seconds: SECONDS[phase] || 0, night: room.nightNo, ...extra });
  scheduleBotActions(phase); // 人机开始行动
}

/* ==========================================================================
   角色分配与游戏流程
   ========================================================================== */

function assignRoles() {
  const n = room.players.length;
  const roles = [];
  let wolvesN, seerN = 1, witchN = 1, hunterN = 0;
  if (n <= 6) { wolvesN = 2; hunterN = 0; }
  else if (n <= 8) { wolvesN = 3; hunterN = 1; }
  else if (n <= 10) { wolvesN = 3; hunterN = 1; }
  else { wolvesN = 4; hunterN = 1; }
  for (let i = 0; i < wolvesN; i++) roles.push("wolf");
  roles.push("seer", "witch");
  if (hunterN) roles.push("hunter");
  while (roles.length < n) roles.push("villager");
  // 洗牌
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  room.players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.shot = false;
  });
}

function startGame() {
  room.nightNo = 0;
  room.lastDeaths = [];
  room.witchHasSave = true;
  room.witchHasPoison = true;
  assignRoles();
  broadcast({ t: "game-start", players: publicPlayers() });
  // 每人私发身份;狼人互知
  room.players.forEach((p) => {
    const wolvesList = p.role === "wolf" ? wolves().map((w) => ({ id: w.id, name: w.name })) : [];
    p.conn.send({ t: "role", role: p.role, roleName: ROLE_NAMES[p.role], wolves: wolvesList });
  });
  nightStart();
}

function nightStart() {
  room.nightNo++;
  room.wolfVotes = {};
  room.seerResult = null;
  room.seerUsed = false;
  room.saveTarget = null;
  room.poisonTarget = null;
  room.killedTonight = null;
  room.witchUsedTonight = false;
  room.hunterShots = {};
  clearTimer();
  setPhase("kill");
  // 没有存活狼人(理论上不会发生)直接进入下一阶段
  if (!wolves().length) return afterKill();
  room.timer = setTimeout(afterKill, SECONDS.kill * 1000);
}

/* —— 狼人阶段结束:统计刀人(票多者被刀) —— */
function afterKill() {
  clearTimer();
  const counts = {};
  Object.values(room.wolfVotes).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  let max = 0, target = null;
  Object.entries(counts).forEach(([t, c]) => {
    if (c > max) { max = c; target = t; }
  });
  room.killedTonight = target;
  setPhase("seer");
  if (!room.players.some((p) => p.alive && p.role === "seer")) return afterSeer(); // 无预言家直接过
  room.timer = setTimeout(afterSeer, SECONDS.seer * 1000);
}

function afterSeer() {
  clearTimer();
  setPhase("witch");
  if (!room.players.some((p) => p.alive && p.role === "witch")) return afterWitch(); // 无女巫直接过
  room.timer = setTimeout(afterWitch, SECONDS.witch * 1000);
}

/* —— 夜晚结算:死亡名单 + 猎人开枪 —— */
function afterWitch() {
  clearTimer();
  const dead = [];
  if (room.killedTonight && room.saveTarget !== room.killedTonight) dead.push(room.killedTonight);
  if (room.poisonTarget) {
    if (room.poisonTarget !== room.killedTonight || room.saveTarget !== room.killedTonight) {
      dead.push(room.poisonTarget);
    }
  }
  // 标记死亡
  const hunterDied = [];
  dead.forEach((id) => {
    const p = byId(id);
    if (p && p.alive) {
      p.alive = false;
      if (p.role === "hunter") hunterDied.push(p);
    }
  });
  room.lastDeaths = dead.map((id) => { const p = byId(id); return p ? p.name : "?"; });
  broadcast({ t: "death", deaths: room.lastDeaths });
  // 猎人被刀可开枪
  if (hunterDied.length) {
    setPhase("shoot", { hunter: hunterDied[0].id, hunterName: hunterDied[0].name });
    room.timer = setTimeout(afterShoot, SECONDS.shoot * 1000);
  } else {
    discuss();
  }
}

function afterShoot() {
  clearTimer();
  // 猎人开枪结算
  Object.entries(room.hunterShots).forEach(([hid, tid]) => {
    const t = byId(tid);
    if (t && t.alive && t.id !== hid) {
      t.alive = false;
      broadcast({ t: "shoot-result", hunter: byId(hid) ? byId(hid).name : "猎人", target: t.name });
    }
  });
  if (checkGameOver()) return;
  discuss();
}

function discuss() {
  clearTimer();
  setPhase("discuss");
  room.timer = setTimeout(vote, SECONDS.discuss * 1000);
}

function vote() {
  clearTimer();
  room.votes = {};
  setPhase("vote");
  room.timer = setTimeout(afterVote, SECONDS.vote * 1000);
}

function afterVote() {
  clearTimer();
  const counts = {};
  Object.values(room.votes).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  let max = 0, target = null, top = [];
  Object.entries(counts).forEach(([t, c]) => {
    if (c > max) { max = c; target = t; top = [t]; }
    else if (c === max) { top.push(t); }
  });
  // 平票则无人出局
  if (top.length > 1) target = null;
  let targetName = "无人";
  if (target) {
    const p = byId(target);
    if (p && p.alive) {
      p.alive = false;
      targetName = p.name;
      broadcast({ t: "vote-result", target: target, targetName, votes: room.votes });
      if (p.role === "hunter" && !p.shot) {
        // 被投出局的猎人可以开枪
        setPhase("shoot", { hunter: p.id, hunterName: p.name });
        room.timer = setTimeout(afterShoot, SECONDS.shoot * 1000);
        return;
      }
    }
  } else {
    broadcast({ t: "vote-result", target: null, targetName: "无人(平票)", votes: room.votes });
  }
  if (checkGameOver()) return;
  nightStart();
}

/* —— 胜负判定 —— */
function checkGameOver() {
  const alive = aliveList();
  const w = alive.filter((p) => p.role === "wolf");
  if (!w.length) return gameOver("好人");
  if (w.length >= alive.length - w.length) return gameOver("狼人");
  return false;
}

function gameOver(winner) {
  clearTimer();
  room.phase = "over";
  broadcast({
    t: "gameover",
    winner,
    roles: room.players.map((p) => ({ name: p.name, role: ROLE_NAMES[p.role], alive: p.alive })),
  });
}

/* ==========================================================================
   人机(Bot):房主可添加,用于凑人数陪玩
   ========================================================================== */
const BOT_NAMES = ["小狼崽", "预言家二号", "女巫大人", "猎人老张", "村口老王", "隔壁小李", "小红帽", "大聪明", "糊涂蛋", "潜水员", "气氛组", "吃瓜群众"];
const BOT_WW_CHATS = [
  "我怀疑 {p} 有问题👀", "我是好人,别投我", "大家来分析一下",
  "昨晚我听到点动静", "{p} 怎么不说话?", "跟着感觉走,投 {p}",
  "我投完票了", "这局有点意思", "先别急着投,再聊聊", "预言家出来带带队",
];

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

/* 添加 n 个人机(房主专用,仅大厅可加;返回实际添加数量) */
function addBots(n) {
  if (room.phase !== "lobby") return 0;
  const count = Math.max(0, Math.min(n, MAX_PLAYERS - room.players.length));
  for (let i = 0; i < count; i++) {
    room.players.push({
      conn: makeBotConn(),
      id: crypto.randomBytes(6).toString("hex"),
      name: makeBotName(),
      qq: "",
      role: null,
      alive: true,
      bot: true,
    });
  }
  if (!count) return 0;
  broadcast({ t: "players", players: publicPlayers(), ownerId: room.ownerId });
  room.players.filter((p) => p.bot).slice(-count).forEach((b) => {
    broadcast({ t: "system", text: "🤖 " + b.name + " 加入了房间(人机)" });
  });
  return count;
}

/* 移除玩家(真人掉线 / 房主移除人机共用) */
function removePlayer(id) {
  const idx = room.players.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const removed = room.players[idx];
  room.players.splice(idx, 1);
  // 房主离开:转让给剩余第一个玩家
  if (room.ownerId === removed.id) {
    room.ownerId = room.players.length ? room.players[0].id : null;
    if (room.ownerId) broadcast({ t: "system", text: "房主已转让给 " + byId(room.ownerId).name });
  }
  // 没有真人玩家时,人机全部离场,房间重置回大厅
  if (room.players.length && room.players.every((x) => x.bot)) {
    room.players = [];
    room.ownerId = null;
    clearTimer();
    room.phase = "lobby";
    room.lastDeaths = [];
  }
  broadcast({ t: "players", players: publicPlayers(), ownerId: room.ownerId });
  broadcast({ t: "system", text: removed.name + " 离开了房间" + (removed.bot ? "(人机)" : "") });
  if (room.phase !== "lobby" && room.phase !== "over") {
    if (checkGameOver()) return;
  }
}

/* 人机行动:每个阶段延迟随机秒数后自动操作(与真人走同一套结算逻辑) */
function botAct(act, bot) {
  if (!byId(bot.id) || !bot.alive) return;
  const others = aliveList().filter((p) => p.id !== bot.id);
  if (!others.length) return;

  if (act === "kill") {
    if (room.phase !== "kill" || bot.role !== "wolf" || room.wolfVotes[bot.id]) return;
    // 优先刀特殊身份(预言家/女巫/猎人),其次随机
    const special = others.filter((p) => p.role !== "villager" && p.role !== "wolf");
    const pool = special.length && Math.random() < 0.6 ? special : others.filter((p) => p.role !== "wolf");
    if (!pool.length) return;
    const t = pool[Math.floor(Math.random() * pool.length)];
    room.wolfVotes[bot.id] = t.id;
    sendTo(bot.id, { t: "action-ok", act: "kill", target: t.id });
    if (wolves().every((w) => room.wolfVotes[w.id])) { clearTimer(); afterKill(); }
    return;
  }

  if (act === "seer") {
    if (room.phase !== "seer" || room.seerUsed) return;
    room.seerUsed = true;
    const t = others[Math.floor(Math.random() * others.length)];
    sendTo(bot.id, { t: "seer-result", name: t.name, role: t.role === "wolf" ? "狼人" : "好人" });
    clearTimer();
    afterSeer();
    return;
  }

  if (act === "witch") {
    if (room.phase !== "witch" || room.witchUsedTonight) return;
    // 有刀口时大概率用解药救人,小概率用毒药;都不用则等倒计时结束
    if (room.witchHasSave && room.killedTonight && Math.random() < 0.55) {
      room.witchHasSave = false;
      room.witchUsedTonight = true;
      room.saveTarget = room.killedTonight;
      sendTo(bot.id, { t: "action-ok", act: "save", target: room.killedTonight });
      clearTimer();
      afterWitch();
      return;
    }
    if (room.witchHasPoison && Math.random() < 0.35) {
      const t = others[Math.floor(Math.random() * others.length)];
      room.witchHasPoison = false;
      room.witchUsedTonight = true;
      room.poisonTarget = t.id;
      sendTo(bot.id, { t: "action-ok", act: "poison", target: t.id });
      clearTimer();
      afterWitch();
      return;
    }
    return;
  }

  if (act === "shoot") {
    if (room.phase !== "shoot" || bot.shot) return;
    if (Math.random() < 0.7) {
      const t = others[Math.floor(Math.random() * others.length)];
      bot.shot = true;
      room.hunterShots[bot.id] = t.id;
      sendTo(bot.id, { t: "action-ok", act: "shoot", target: t.id });
      clearTimer();
      afterShoot();
    }
    return;
  }

  if (act === "vote") {
    if (room.phase !== "vote" || room.votes[bot.id]) return;
    const t = others[Math.floor(Math.random() * others.length)];
    room.votes[bot.id] = t.id;
    sendTo(bot.id, { t: "action-ok", act: "vote", target: t.id });
    if (aliveList().every((x) => room.votes[x.id])) { clearTimer(); afterVote(); }
    return;
  }
}

/* 人机讨论发言 */
function botChat(bot) {
  if (!byId(bot.id) || !bot.alive || room.phase !== "discuss") return;
  const humans = aliveList().filter((p) => p.id !== bot.id && !p.bot);
  let text = BOT_WW_CHATS[Math.floor(Math.random() * BOT_WW_CHATS.length)];
  const name = humans.length ? humans[Math.floor(Math.random() * humans.length)].name : "某人";
  broadcast({ t: "chat", name: bot.name, text: text.replace(/\{p\}/g, name) });
}

/* 阶段切换时安排对应的人机行动 */
function scheduleBotActions(phase) {
  const bots = room.players.filter((p) => p.bot);
  if (!bots.length) return;
  if (phase === "kill") {
    bots.filter((p) => p.alive && p.role === "wolf").forEach((b) => {
      setTimeout(() => botAct("kill", b), 1500 + Math.random() * 4000);
    });
  } else if (phase === "seer") {
    const b = bots.find((p) => p.alive && p.role === "seer");
    if (b) setTimeout(() => botAct("seer", b), 1500 + Math.random() * 3500);
  } else if (phase === "witch") {
    const b = bots.find((p) => p.alive && p.role === "witch");
    if (b) setTimeout(() => botAct("witch", b), 1500 + Math.random() * 4000);
  } else if (phase === "shoot") {
    const b = bots.find((p) => p.alive && p.role === "hunter");
    if (b) setTimeout(() => botAct("shoot", b), 1500 + Math.random() * 3000);
  } else if (phase === "vote") {
    bots.filter((p) => p.alive).forEach((b) => {
      setTimeout(() => botAct("vote", b), 2000 + Math.random() * 6000);
    });
  } else if (phase === "discuss") {
    bots.filter((p) => p.alive).forEach((b) => {
      if (Math.random() < 0.7) setTimeout(() => botChat(b), 2000 + Math.random() * 10000);
    });
  }
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
    case "join": {
      if (p) return;
      if (room.players.length >= MAX_PLAYERS) { conn.send({ t: "full" }); conn.socket.destroy(); return; }
      if (room.phase !== "lobby") { conn.send({ t: "system", text: "游戏已在进行中,无法加入" }); return; }
      const name = String(msg.name || "").trim().slice(0, MAX_NAME) || "玩家" + (room.players.length + 1);
      const qq = /^\d{5,11}$/.test(String(msg.qq || "")) ? String(msg.qq) : "";
      const player = { conn, id: crypto.randomBytes(6).toString("hex"), name, qq, role: null, alive: true };
      room.players.push(player);
      conn.player = player;
      // 第一个进入房间的人是房主
      if (!room.ownerId) room.ownerId = player.id;
      conn.send({ t: "joined", id: player.id, name: player.name, players: publicPlayers(), min: MIN_PLAYERS, max: MAX_PLAYERS, ownerId: room.ownerId });
      broadcast({ t: "players", players: publicPlayers(), ownerId: room.ownerId }, player.id);
      broadcast({ t: "system", text: name + " 加入了房间(" + room.players.length + "/" + MAX_PLAYERS + ")" + (room.ownerId === player.id ? " [房主]" : "") });
      return;
    }

    case "start": {
      if (!p || room.phase !== "lobby") return;
      if (p.id !== room.ownerId) { conn.send({ t: "system", text: "只有房主可以开始游戏" }); return; }
      if (room.players.length < MIN_PLAYERS) {
        conn.send({ t: "system", text: "至少需要 " + MIN_PLAYERS + " 人才能开始,还差 " + (MIN_PLAYERS - room.players.length) + " 人" });
        return;
      }
      startGame();
      return;
    }

    case "restart": {
      if (!p || room.phase !== "over") return;
      if (p.id !== room.ownerId) { conn.send({ t: "system", text: "只有房主可以开始游戏" }); return; }
      room.players = room.players.filter((x) => x.conn.socket && !x.conn.socket.destroyed);
      room.players.forEach((x) => { x.role = null; x.alive = true; });
      room.phase = "lobby";
      broadcast({ t: "players", players: publicPlayers(), ownerId: room.ownerId });
      broadcast({ t: "system", text: "已重置,可以重新开始" });
      return;
    }

    /* —— 狼人刀人 —— */
    case "action": {
      if (!p || !p.alive) return;
      const act = msg.act;
      const target = String(msg.target || "");
      if (!byId(target)) return;

      if (act === "kill") {
        // 每狼一票,投了不能改
        if (room.phase !== "kill" || p.role !== "wolf") return;
        if (room.wolfVotes[p.id]) { sendTo(p.id, { t: "system", text: "你已经投过票了" }); return; }
        room.wolfVotes[p.id] = target;
        sendTo(p.id, { t: "action-ok", act: "kill", target });
        // 所有狼人都投完 → 立即结算,不等倒计时
        if (wolves().every((w) => room.wolfVotes[w.id])) {
          clearTimer();
          afterKill();
        }
        return;
      }

      if (act === "seer") {
        // 预言家每晚只能查验一次
        if (room.phase !== "seer" || p.role !== "seer" || room.seerUsed) return;
        room.seerUsed = true;
        const t = byId(target);
        sendTo(p.id, { t: "seer-result", name: t.name, role: t.role === "wolf" ? "狼人" : "好人" });
        // 查验完成 → 立即进入女巫阶段
        clearTimer();
        afterSeer();
        return;
      }

      if (act === "save") {
        // 女巫每晚只能用一种药一次
        if (room.phase !== "witch" || p.role !== "witch" || !room.witchHasSave || room.witchUsedTonight) return;
        if (target === p.id) { sendTo(p.id, { t: "system", text: "不能自救" }); return; }
        room.witchHasSave = false;
        room.witchUsedTonight = true;
        room.saveTarget = target;
        sendTo(p.id, { t: "action-ok", act: "save", target });
        // 用药完成 → 立即天亮结算
        clearTimer();
        afterWitch();
        return;
      }

      if (act === "poison") {
        if (room.phase !== "witch" || p.role !== "witch" || !room.witchHasPoison || room.witchUsedTonight) return;
        if (target === p.id) { sendTo(p.id, { t: "system", text: "不能毒自己" }); return; }
        room.witchHasPoison = false;
        room.witchUsedTonight = true;
        room.poisonTarget = target;
        sendTo(p.id, { t: "action-ok", act: "poison", target });
        clearTimer();
        afterWitch();
        return;
      }

      if (act === "shoot") {
        if (room.phase !== "shoot" || p.role !== "hunter" || p.shot) return;
        if (target === p.id) { sendTo(p.id, { t: "system", text: "不能带走自己" }); return; }
        p.shot = true;
        room.hunterShots[p.id] = target;
        sendTo(p.id, { t: "action-ok", act: "shoot", target });
        // 开枪完成 → 立即结算
        clearTimer();
        afterShoot();
        return;
      }

      if (act === "vote") {
        if (room.phase !== "vote" || !p.alive) return;
        room.votes[p.id] = target;
        sendTo(p.id, { t: "action-ok", act: "vote", target });
        // 所有存活玩家都投完 → 立即计票,不等倒计时
        if (aliveList().every((x) => room.votes[x.id])) {
          clearTimer();
          afterVote();
        }
        return;
      }
      return;
    }

    /* —— 添加人机(仅房主,仅大厅) —— */
    case "addbot": {
      if (!p) return;
      if (p.id !== room.ownerId) { conn.send({ t: "system", text: "只有房主可以添加人机" }); return; }
      if (room.phase !== "lobby") { conn.send({ t: "system", text: "游戏进行中,无法添加人机" }); return; }
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

    /* —— 聊天:白天公共,夜晚狼人阶段仅狼人可互相讨论 —— */
    case "chat": {
      if (!p) return;
      const text = String(msg.text || "").trim().slice(0, MAX_CHAT);
      if (!text) return;
      if (room.phase === "kill") {
        // 夜晚:只有狼人之间可讨论
        if (p.role === "wolf") {
          wolves().forEach((w) => w.conn.send({ t: "chat", name: p.name, text, wolf: true }));
        }
      } else {
        broadcast({ t: "chat", name: p.name, text });
      }
      return;
    }

    default:
      return;
  }
}

function onDisconnect(conn) {
  const p = byConn(conn);
  if (!p) return;
  removePlayer(p.id);
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
