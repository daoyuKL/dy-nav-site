/* ==========================================================================
   DY导航站 · 恶魔轮盘(WebSocket 单房间 · 2-4 人联机)
   ==========================================================================
   零依赖 WebSocket 服务端(协议 RFC 6455 最小实现) + 轮盘赌状态机。
   规则:
     - 2-4 人,每人 4 点生命,活到最后的人赢
     - 每回合装填 人数×2 发子弹(实弹/空包随机),生命回满
     - 回合制:开枪后轮到下一位存活玩家;空包打自己可保留回合
     - 实弹 1 点伤害,小刀可使下一发实弹伤害翻倍(2 点)
     - 道具(每回合随机 2 件):香烟/啤酒/放大镜/小刀/手铐
       ≥3 人额外加入:逆转器(反转剩余子弹顺序)、手机(随机告知某颗子弹类型)
     - 有人生命归零即出局,重新装填进入下一回合,直到只剩 1 人
   连接路径:/ws-buckshot
   ========================================================================== */
const crypto = require("crypto");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const MAX_NAME = 12;
const MAX_HP = 6; // 每人 6 滴血(所有模式一致),香烟可回满
const LOSS_TO_ELIMINATE = 2; // 累计 2 次本回合出局即淘汰(多回合制,2 人局至少 3 回合)
const RECONNECT_GRACE = 12000; // 掉线宽限:12 秒内同身份重连恢复血量/败场(刷新/挂后台)
const TURN_SECONDS = 60; // 每回合限时,超时自动跳过
const MAX_CHAT = 100;

/* —— 道具定义 —— */
const ITEM_POOL_2P = ["cig", "beer", "lens", "knife", "cuffs"];
const ITEM_POOL_3P = ["cig", "beer", "lens", "knife", "cuffs", "reverser", "phone"];
const ITEM_NAMES = {
  cig: "🚬 香烟", beer: "🍺 啤酒", lens: "🔍 放大镜",
  knife: "🔪 小刀", cuffs: "🧤 手铐", reverser: "🔄 逆转器", phone: "📱 手机",
};

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
   单房间游戏状态
   ========================================================================== */

const room = {
  players: [],   // {conn, id, name, qq, hp, maxHp, alive, items:{}, cuffed, losses}
  ownerId: null,
  phase: "lobby", // lobby | playing | over
  round: 0,
  roundOver: false, // 本回合是否已结束(有人出局,等待进入下一回合)
  shells: [],     // 'live' | 'blank'
  index: 0,
  liveLeft: 0,
  blankLeft: 0,
  turnPos: 0,     // 当前轮到第几个存活玩家
  knifeArmed: false,
  timer: null,
};

function aliveList() {
  return room.players.filter((p) => p.alive);
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, qq: p.qq || "", hp: p.hp, maxHp: p.maxHp, alive: p.alive, cuffed: !!p.cuffed, losses: p.losses || 0 };
}

function broadcast(obj, exceptConn) {
  room.players.forEach((p) => {
    if (p.conn && p.conn !== exceptConn) p.conn.send(obj);
  });
}

function broadcastPlayers() {
  broadcast({
    t: "players",
    players: room.players.map(publicPlayer),
    ownerId: room.ownerId,
    phase: room.phase,
    round: room.round,
  });
}

function system(text) {
  broadcast({ t: "system", text });
}

function clearTimer() {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function rollItems(pool) {
  const p = shuffle(pool);
  const out = {};
  out[p[0]] = 1;
  out[p[1]] = 1;
  return out;
}

function currentPlayer() {
  const list = aliveList();
  if (!list.length) return null;
  return list[room.turnPos % list.length];
}

/* —— 装填子弹(按回合数):第1把 3 发,第2把 4 发,第3把及以后 5-9 发 —— */
function rackShells(round) {
  let total;
  if (round <= 1) total = 3;
  else if (round === 2) total = 4;
  else total = 5 + Math.floor(Math.random() * 5); // 5-9 发
  const live = 1 + Math.floor(Math.random() * (total - 1)); // 至少1实弹1空包
  const shells = [];
  for (let i = 0; i < live; i++) shells.push("live");
  for (let j = live; j < total; j++) shells.push("blank");
  room.shells = shuffle(shells);
  room.index = 0;
  room.liveLeft = live;
  room.blankLeft = total - live;
  room.knifeArmed = false;
  room.roundInfo = { total, live, blank: total - live }; // 重连时补发用
  return { total, live, blank: total - live };
}

/* —— 开始新回合 —— */
function startRound() {
  clearTimer();
  const alive = aliveList();
  alive.forEach((p) => {
    p.hp = p.maxHp;
    p.cuffed = false;
    p.items = rollItems(alive.length >= 3 ? ITEM_POOL_3P : ITEM_POOL_2P);
  });
  room.round++;
  room.roundOver = false;
  const info = rackShells(room.round);
  room.turnPos = 0;

  broadcast({
    t: "round-start",
    round: room.round,
    total: info.total,
    live: info.live,
    blank: info.blank,
    remaining: room.shells.length,
    players: room.players.map(publicPlayer),
    maxHp: MAX_HP,
  });
  alive.forEach((p) => {
    if (p.conn) p.conn.send({ t: "my-items", items: p.items });
  });
  system(`第 ${room.round} 回合!装填 ${info.total} 发:实弹 ${info.live} / 空包 ${info.blank},生命回满`);
  startTurn();
}

function startTurn() {
  clearTimer();
  const p = currentPlayer();
  if (!p) return;
  broadcast({ t: "turn", id: p.id, name: p.name, seconds: TURN_SECONDS });
  /* 被手铐铐住:跳过回合 */
  if (p.cuffed) {
    p.cuffed = false;
    system(`🧤 ${p.name} 被手铐铐住,跳过了回合`);
    nextTurn(p.id);
    return;
  }
  /* 回合限时:超时自动跳过 */
  room.timer = setTimeout(() => {
    if (room.phase !== "playing") return;
    system(`⏰ ${p.name} 超时未操作,自动跳过`);
    nextTurn(p.id);
  }, TURN_SECONDS * 1000);
}

/* —— 轮到下一位存活玩家(从 afterId 之后开始找) —— */
function nextTurn(afterId) {
  clearTimer();
  const alive = aliveList();
  if (alive.length <= 1) {
    endGame();
    return;
  }
  const idx = alive.findIndex((p) => p.id === afterId);
  room.turnPos = (idx + 1) % alive.length;
  startTurn();
}

/* —— 开枪 —— */
function shoot(conn, targetId) {
  const shooter = conn.player;
  if (room.phase !== "playing" || !shooter || !shooter.alive) return;
  if (room.roundOver) return; // 本回合已结束,等待下一回合
  if (currentPlayer() && currentPlayer().id !== shooter.id) return; // 还没轮到你
  if (room.index >= room.shells.length) return; // 弹仓空

  const shell = room.shells[room.index++];
  if (shell === "live") room.liveLeft--;
  else room.blankLeft--;
  const isLive = shell === "live";

  /* 弹仓剩余同步 */
  broadcast({ t: "chamber", remaining: room.shells.length - room.index, liveLeft: room.liveLeft, blankLeft: room.blankLeft });

  let target = shooter;
  let targetSelf = false;
  if (targetId === "self" || targetId === shooter.id) {
    targetSelf = true;
  } else {
    target = room.players.find((p) => p.id === targetId && p.alive);
    if (!target) return;
  }

  let dmg = 0;
  if (isLive) {
    dmg = room.knifeArmed ? 2 : 1;
    target.hp -= dmg;
  }
  room.knifeArmed = false;

  const shellTxt = isLive ? "💥 实弹" : "💨 空包";
  const targetTxt = targetSelf ? "自己" : target.name;
  broadcast({
    t: "shot",
    shooter: shooter.id,
    shooterName: shooter.name,
    target: target.id,
    targetName: targetTxt,
    shell,
    dmg,
    hp: room.players.map(publicPlayer),
    nextId: null,
  });
  if (targetSelf && isLive) {
    system(`${shellTxt}!${shooter.name} 朝自己开枪,受到 ${dmg} 点伤害`);
  } else if (targetSelf) {
    system(`${shellTxt}!${shooter.name} 朝自己开枪,没有受伤,保留回合!`);
  } else if (isLive) {
    system(`${shellTxt}!${shooter.name} 开枪击中 ${target.name},造成 ${dmg} 点伤害`);
  } else {
    system(`${shellTxt}!${shooter.name} 开枪,${target.name} 安然无恙`);
  }

  /* 出局判定:本回合出局 → 累计败场;累计 2 败 → 淘汰出局
     多回合制:回合结束,存活玩家下一回合生命回满重新装填 */
  if (target.hp <= 0) {
    target.hp = 0;
    room.roundOver = true;
    clearTimer();
    target.losses = (target.losses || 0) + 1;
    broadcast({ t: "player-dead", id: target.id, name: target.name, players: room.players.map(publicPlayer) });
    system(`💀 ${target.name} 本回合出局!(累计 ${target.losses}/${LOSS_TO_ELIMINATE} 败)`);
    if (target.losses >= LOSS_TO_ELIMINATE) {
      target.alive = false;
      system(`⚔️ ${target.name} 已累计 ${LOSS_TO_ELIMINATE} 败,被淘汰出局!`);
    }
    const remaining = room.players.filter((p) => p.alive);
    if (remaining.length <= 1) {
      endGame();
      return;
    }
    /* 进入下一回合 */
    setTimeout(() => {
      if (room.phase !== "playing") return;
      startRound();
    }, 2200);
    return;
  }

  /* 弹仓打空且无人出局:本回合平局,自动进入下一回合(子弹更多)
     避免 6 血 + 少数子弹的回合无人能打死而卡死 */
  if (room.index >= room.shells.length) {
    room.roundOver = true;
    clearTimer();
    system(`🔁 弹仓已空,无人出局,进入下一回合`);
    setTimeout(() => {
      if (room.phase !== "playing") return;
      startRound();
    }, 1800);
    return;
  }

  /* 回合流转:空包打自己 → 保留回合;否则下一位 */
  if (targetSelf && !isLive) {
    broadcast({ t: "turn", id: shooter.id, name: shooter.name, seconds: TURN_SECONDS, again: true });
    room.timer = setTimeout(() => {
      if (room.phase !== "playing") return;
      system(`⏰ ${shooter.name} 超时未操作,自动跳过`);
      nextTurn(shooter.id);
    }, TURN_SECONDS * 1000);
  } else {
    nextTurn(shooter.id);
  }
}

/* —— 使用道具 —— */
function useItem(conn, item) {
  const p = conn.player;
  if (room.phase !== "playing" || !p || !p.alive) return;
  if (room.roundOver) return; // 本回合已结束
  if (currentPlayer() && currentPlayer().id !== p.id) return;
  if (!p.items[item]) return;

  /* 无效使用不消耗道具 */
  if (item === "cig" && p.hp >= p.maxHp) {
    system(`🚬 ${p.name} 生命已满,香烟无法使用`);
    return;
  }
  if (item === "beer" && room.index >= room.shells.length) {
    system(`🍺 ${p.name} 弹仓已空,啤酒无法使用`);
    return;
  }

  p.items[item]--;
  if (p.items[item] <= 0) delete p.items[item];

  const alive = aliveList();
  const multiplayer = alive.length >= 3;

  if (item === "cig") {
    p.hp = Math.min(p.maxHp, p.hp + 1);
    system(`🚬 ${p.name} 抽了根烟,恢复 1 点生命(${p.hp}/${p.maxHp})`);
    broadcastPlayers();
  } else if (item === "beer") {
    const sh = room.shells[room.index++];
    if (sh === "live") room.liveLeft--;
    else room.blankLeft--;
    broadcast({ t: "chamber", remaining: room.shells.length - room.index, liveLeft: room.liveLeft, blankLeft: room.blankLeft });
    system(`🍺 ${p.name} 灌了瓶啤酒,退出一发子弹:${sh === "live" ? "💥 实弹" : "💨 空包"}`);
  } else if (item === "lens") {
    const cur = room.index < room.shells.length ? room.shells[room.index] : null;
    p.conn.send({ t: "lens-result", shell: cur });
    system(`🔍 ${p.name} 用放大镜观察了弹仓`);
  } else if (item === "knife") {
    room.knifeArmed = true;
    system(`🔪 ${p.name} 给霰弹枪装上了小刀,下一发实弹伤害翻倍`);
  } else if (item === "cuffs") {
    /* 手铐:铐住下一位存活玩家,其回合跳过 */
    const idx = alive.findIndex((x) => x.id === p.id);
    const next = alive[(idx + 1) % alive.length];
    if (next) {
      next.cuffed = true;
      system(`🧤 ${p.name} 用手铐铐住了 ${next.name}!(其下一回合将被跳过)`);
      broadcastPlayers();
    }
  } else if (item === "reverser" && multiplayer) {
    const remain = room.shells.slice(room.index).reverse();
    room.shells = room.shells.slice(0, room.index).concat(remain);
    system(`🔄 ${p.name} 启动了逆转器,剩余子弹顺序被反转!`);
  } else if (item === "phone" && multiplayer) {
    const remain = room.shells.slice(room.index);
    if (remain.length) {
      const pos = Math.floor(Math.random() * remain.length) + 1; // 1-based(相对当前)
      p.conn.send({ t: "phone-result", pos, type: remain[pos - 1] });
      system(`📱 ${p.name} 掏出手机,扫描了弹仓`);
    }
  }
  broadcastPlayers();
}

/* —— 聊天 —— */
function chat(conn, text) {
  const p = conn.player;
  if (!p) return;
  const t = String(text || "").trim().slice(0, MAX_CHAT);
  if (!t) return;
  broadcast({ t: "chat", name: p.name, text: t });
}

/* —— 结束游戏 —— */
function endGame() {
  clearTimer();
  room.phase = "over";
  const alive = aliveList();
  const winner = alive.length === 1 ? alive[0] : null;
  const ranking = room.players.slice().sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0));
  broadcast({
    t: "game-over",
    winner: winner ? { id: winner.id, name: winner.name } : null,
    ranking: ranking.map(publicPlayer),
  });
  if (winner) system(`🏆 ${winner.name} 是最后的赢家!`);
  room.players.forEach((p) => { p.items = {}; });
  /* 稍后重置回大厅,可再来一局 */
  setTimeout(() => {
    room.phase = "lobby";
    room.round = 0;
    room.players.forEach((p) => { p.hp = p.maxHp; p.alive = true; p.cuffed = false; p.items = {}; p.losses = 0; });
    if (!room.ownerId || !room.players.find((x) => x.id === room.ownerId)) {
      const first = room.players.find((x) => x.conn);
      room.ownerId = first ? first.id : null;
    }
    broadcastPlayers();
    system("🔁 可以再来一局,房主点击「开始游戏」");
  }, 2500);
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
    case "start":
      doStart(conn);
      break;
    case "item":
      useItem(conn, String(data.item || ""));
      break;
    case "shoot":
      shoot(conn, String(data.target || "self"));
      break;
    case "chat":
      chat(conn, String(data.text || ""));
      break;
    default:
      break;
  }
}

function doJoin(conn, data) {
  if (conn.player) return; // 已加入
  const cid = String(data.cid || "").slice(0, 64);

  /* 掉线宽限内同身份(cid)重连:恢复原玩家(保留血量/败场),刷新/挂后台能"跟回来" */
  const old = cid ? room.players.find((x) => x.cid === cid && x.offline && x.conn === null) : null;
  if (old) {
    if (old._offlineTimer) { clearTimeout(old._offlineTimer); old._offlineTimer = null; }
    old.offline = 0;
    old.conn = conn;
    old.name = String(data.name || "").trim().slice(0, MAX_NAME) || old.name;
    conn.player = old;
    conn.send({ t: "joined", id: old.id, players: room.players.map(publicPlayer), ownerId: room.ownerId, min: MIN_PLAYERS, max: MAX_PLAYERS, phase: room.phase });
    broadcastPlayers();
    system(`👤 ${old.name} 回来了(刷新后自动重连)`);
    /* 游戏中重连:补发回合状态,让玩家接着玩 */
    if (room.phase === "playing") {
      const ri = room.roundInfo || { total: room.shells.length, live: room.liveLeft, blank: room.blankLeft };
      conn.send({
        t: "round-start",
        round: room.round,
        total: ri.total,
        live: ri.live,
        blank: ri.blank,
        remaining: room.shells.length - room.index,
        players: room.players.map(publicPlayer),
        maxHp: MAX_HP,
      });
      conn.send({ t: "my-items", items: old.items });
      const cur = currentPlayer();
      conn.send({ t: "turn", id: cur ? cur.id : old.id, name: cur ? cur.name : "", seconds: TURN_SECONDS });
    }
    return;
  }

  if (room.phase === "playing") {
    conn.send({ t: "full", error: "游戏进行中,请稍后再来" });
    return;
  }
  if (room.players.length >= MAX_PLAYERS) {
    conn.send({ t: "full", error: `房间已满(${MAX_PLAYERS} 人)` });
    return;
  }
  const name = String(data.name || "").trim().slice(0, MAX_NAME) || "玩家" + (room.players.length + 1);
  const p = {
    conn,
    id: crypto.randomBytes(6).toString("hex"),
    name,
    qq: String(data.qq || ""),
    hp: MAX_HP,
    maxHp: MAX_HP,
    alive: true,
    items: {},
    cuffed: false,
    losses: 0,
    cid,
    offline: 0,
  };
  room.players.push(p);
  conn.player = p;
  if (!room.ownerId) room.ownerId = p.id;

  conn.send({
    t: "joined",
    id: p.id,
    players: room.players.map(publicPlayer),
    ownerId: room.ownerId,
    min: MIN_PLAYERS,
    max: MAX_PLAYERS,
    phase: room.phase,
  });
  broadcastPlayers();
  system(`👤 ${p.name} 加入了房间`);
}

function doStart(conn) {
  const p = conn.player;
  if (!p || p.id !== room.ownerId) return;
  const alive = room.players.filter((x) => x.conn);
  if (alive.length < MIN_PLAYERS) {
    conn.send({ t: "need2", n: MIN_PLAYERS - alive.length });
    return;
  }
  if (room.phase === "playing") return;
  room.phase = "playing";
  room.round = 0;
  room.players.forEach((x) => { x.alive = true; x.hp = x.maxHp; x.cuffed = false; x.losses = 0; });
  broadcast({ t: "game-start", players: room.players.map(publicPlayer), min: MIN_PLAYERS, max: MAX_PLAYERS });
  startRound();
}

function onDisconnect(conn) {
  const p = conn.player;
  if (!p) return;
  conn.player = null;
  if (room.phase === "lobby") {
    room.players = room.players.filter((x) => x !== p);
    if (room.ownerId === p.id) room.ownerId = room.players.length ? room.players[0].id : null;
    if (room.players.length) {
      broadcastPlayers();
      system(`👋 ${p.name} 离开了房间`);
    }
    return;
  }
  /* 游戏中掉线:12 秒宽限,同身份重连可恢复(刷新/挂后台);超时视作出局 */
  p.offline = Date.now();
  p.conn = null;
  if (p._offlineTimer) clearTimeout(p._offlineTimer);
  p._offlineTimer = setTimeout(() => {
    if (!p.offline || p.conn !== null) return;
    if (!room.players.find((x) => x.id === p.id)) return;
    if (p.alive) {
      p.alive = false;
      broadcast({ t: "player-dead", id: p.id, name: p.name + "(掉线)", players: room.players.map(publicPlayer) });
      system(`💀 ${p.name} 掉线超时,视作出局`);
      const alive = aliveList();
      if (alive.length <= 1) {
        endGame();
        return;
      }
      if (currentPlayer() && currentPlayer().id === p.id) {
        nextTurn(p.id);
      }
    }
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
