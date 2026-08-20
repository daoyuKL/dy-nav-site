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
  return room.players.map((p) => ({ id: p.id, name: p.name, qq: p.qq || "", alive: p.alive, score: 0 }));
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
  const idx = room.players.findIndex((x) => x.conn === conn);
  if (idx < 0) return;
  const removedId = room.players[idx].id;
  const name = room.players[idx].name;
  room.players.splice(idx, 1);
  // 房主离开:转让给剩余第一个玩家
  if (room.ownerId === removedId) {
    room.ownerId = room.players.length ? room.players[0].id : null;
    if (room.ownerId) {
      broadcast({ t: "system", text: "房主已转让给 " + byId(room.ownerId).name });
    }
  }
  broadcast({ t: "players", players: publicPlayers(), ownerId: room.ownerId });
  broadcast({ t: "system", text: name + " 离开了房间" });
  if (room.phase !== "lobby" && room.phase !== "over") {
    if (checkGameOver()) return;
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
