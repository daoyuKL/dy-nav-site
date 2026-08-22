/* ==========================================================================
   DY导航站 · 多房间路由器
   ==========================================================================
   为 你画我猜(/ws) / 狼人杀(/ws-werewolf) / 恶魔轮盘(/ws-buckshot)
   提供统一的多房间管理:
     - 每个房间 = 游戏模块的一个独立实例(require 缓存剔除后重新加载,
       各实例内部仍按"单房间"逻辑运行,互不干扰)
     - 房间号:4 位字母数字(不含易混淆字符)
     - 房间上限(按 2GB 内存 / 2 核 CPU 评估):
         你画我猜 30 间 / 狼人杀 20 间 / 恶魔轮盘 40 间,全局合计 100 间
       说明:单房间状态仅几 KB,瓶颈在并发连接与定时器数量;
             上述上限已远低于服务器可承受量,同时防止恶意刷房拖垮服务。
     - 每个房间最多存在 1 小时,超时无论游戏是否进行中一律强制解散;
       空房间(无人在线)立即回收。

   HTTP 接口:
     GET /api/room?game=ws|ws-werewolf|ws-buckshot          -> 创建房间,返回 {ok, code}
     GET /api/room?game=xxx&code=XXXX                       -> 查询房间是否存在 {ok, exists}
   WebSocket 连接:
     ws://host/<game路径>?room=XXXX                          -> 加入指定房间
   ========================================================================== */

const GAME_PATHS = {
  "ws":          { file: "./ws-game",       maxRooms: 30, name: "你画我猜" },
  "ws-werewolf": { file: "./ws-werewolf",   maxRooms: 20, name: "狼人杀" },
  "ws-buckshot": { file: "./ws-buckshot",   maxRooms: 40, name: "恶魔轮盘" },
  "ws-music":    { file: "./ws-music",      maxRooms: 5,  name: "一起听" },
};

const TOTAL_MAX_ROOMS = 100; // 全局房间上限
const ROOM_TTL = 60 * 60 * 1000; // 房间最多存在 1 小时
const SWEEP_MS = 30000; // 清理间隔 30 秒
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆的 I/O/0/1
const CODE_LEN = 4;

/* key = game:CODE -> { mod, createdAt } */
const instances = new Map();

function makeCode() {
  let c = "";
  for (let i = 0; i < CODE_LEN; i++) {
    c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return c;
}

function key(game, code) {
  return game + ":" + code;
}

/* 重新加载游戏模块,得到全新的房间实例 */
function loadModule(game) {
  const full = require.resolve(GAME_PATHS[game].file);
  delete require.cache[full];
  return require(full);
}

/* —— HTTP:创建房间 / 查询房间 —— */
function handleRoomApi(req, res, params) {
  const game = String(params.game || "");
  const cfg = GAME_PATHS[game];
  if (!cfg) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "未知游戏" }));
    return;
  }

  /* 查询:加入前检查房间是否存在 */
  if (params.code) {
    const code = String(params.code).trim().toUpperCase();
    const exists = instances.has(key(game, code));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, exists, code }));
    return;
  }

  /* 房间列表:返回该游戏所有房间(含人数/当前播放),一起听面板用 */
  if (params.list) {
    const list = [];
    instances.forEach((inst, k) => {
      if (k.indexOf(game + ":") !== 0) return;
      const info = { code: k.slice(game.length + 1), players: 0, current: null, queue: 0 };
      try { info.players = inst.mod.count ? inst.mod.count() : 0; } catch (e) { /* 忽略 */ }
      try {
        if (inst.mod.info) {
          const x = inst.mod.info();
          if (x && typeof x === "object") {
            if (typeof x.players === "number") info.players = x.players;
            info.current = x.current || null;
            info.queue = x.queue || 0;
          }
        }
      } catch (e) { /* 忽略 */ }
      list.push(info);
    });
    list.sort((a, b) => (a.code < b.code ? -1 : 1));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, rooms: list }));
    return;
  }

  /* 一起听:房间由系统管理(固定 5 间),不允许用户创建 */
  if (game === "ws-music") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "一起听房间由系统管理,请从房间列表直接加入" }));
    return;
  }

  /* 创建房间:上限检查 */
  let gameCount = 0;
  instances.forEach((v, k) => { if (k.indexOf(game + ":") === 0) gameCount++; });
  if (gameCount >= cfg.maxRooms) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: cfg.name + "房间已满(" + cfg.maxRooms + " 间),请稍后再试" }));
    return;
  }
  if (instances.size >= TOTAL_MAX_ROOMS) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "服务器房间已满,请稍后再试" }));
    return;
  }

  let code;
  do {
    code = makeCode();
  } while (instances.has(key(game, code)));

  instances.set(key(game, code), { mod: loadModule(game), createdAt: Date.now() });
  console.log("[room] 创建 " + cfg.name + " 房间 " + code + "(当前 " + (gameCount + 1) + "/" + cfg.maxRooms + ")");
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: true, code }));
}

/* —— WebSocket 升级分发:按 ?room=CODE 找到房间实例并交给它 —— */
function handleUpgrade(req, socket, game) {
  const raw = req.url || "";
  const m = raw.match(/[?&]room=([A-Za-z0-9]+)/);
  const code = m ? m[1].toUpperCase() : null;
  const inst = code ? instances.get(key(game, code)) : null;
  if (!inst) {
    /* 房间不存在/已解散/被回收 */
    console.log("[room] 拒绝连接 " + game + ":" + code + "(房间不存在)");
    try {
      socket.write(
        "HTTP/1.1 404 Not Found\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
        "房间不存在或已解散"
      );
    } catch (e) { /* 忽略 */ }
    socket.destroy();
    return;
  }
  try {
    inst.mod.handleUpgrade(req, socket);
  } catch (e) {
    console.log("[room] 房间 " + game + ":" + code + " 模块异常: " + e.message);
    try { socket.destroy(); } catch (e2) { /* 忽略 */ }
  }
}

/* —— 定时清理:空房间立即回收;超 1 小时强制解散(系统常驻房间除外) —— */
setInterval(() => {
  const now = Date.now();
  instances.forEach((inst, k) => {
    if (inst.system) return; // 系统房间(一起听)永久存在,不清理
    /* 刚创建的房间给 15 秒缓冲,避免创建后还没人连上就被回收 */
    if (now - inst.createdAt < 15000) return;
    let cnt = 0;
    try { cnt = inst.mod.count(); } catch (e) { /* 模块异常按空处理 */ }
    if (now - inst.createdAt > ROOM_TTL) {
      console.log("[room] 超时解散 " + k + "(" + cnt + " 人在线)");
      try { inst.mod.disband("⏰ 房间已存在超过 1 小时,自动解散"); } catch (e) { /* 忽略 */ }
      instances.delete(k);
    } else if (cnt === 0) {
      console.log("[room] 空房间回收 " + k);
      instances.delete(k);
    }
  });
}, SWEEP_MS);

/* —— 一起听:系统常驻 5 个房间(0001-0005),无需用户创建,永久存在 —— */
(function initMusicRooms() {
  const game = "ws-music";
  for (let i = 1; i <= 5; i++) {
    const code = "000" + i;
    instances.set(key(game, code), { mod: loadModule(game), createdAt: Date.now(), system: true });
  }
  console.log("[room] 一起听系统房间已就绪:0001-0005");
})();

module.exports = { handleRoomApi, handleUpgrade };
