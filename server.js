/* ==========================================================================
   DY导航站 · 本地 HTTP 服务器
   双击「启动网站.bat」即可运行,监听 8080 端口
   ==========================================================================
   留言板 API:
     GET  /api/messages        -> 返回留言列表(自动清理超过 7 天的留言)
     POST /api/messages        -> 提交留言 { name, text, token? }
   ==========================================================================
   账号 API(QQ 号当账号的简化方案,无需腾讯审核):
     POST /api/register  { qq, password, nickname? } -> 注册并自动登录
     POST /api/login     { qq, password }            -> 登录,返回 token
     POST /api/logout    { token }                   -> 退出登录
     GET  /api/me        (Authorization: Bearer xxx) -> 校验登录态
   说明:密码使用 scrypt 加盐哈希存储,不保存明文;
         登录态(token)有效期 7 天,服务器重启后需重新登录;
         留言仅保留最近 7 天,超过自动清空(即"每 7 天重置")。
   ========================================================================== */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { handleUpgrade } = require("./ws-game"); // 你画我猜 WebSocket 服务
const { handleUpgrade: handleWerewolfUpgrade } = require("./ws-werewolf"); // 狼人杀 WebSocket 服务

const ROOT = __dirname;
const PORT = process.env.PORT || 8080; // 云平台会注入 PORT 环境变量,本地默认 8080

/* 数据目录:所有运行数据放在 data/ 下,方便云平台挂载持久化磁盘(Volume)
   Zeabur 部署时把 Volume 挂载到 /app/data,重新部署数据不丢 */
const DATA_DIR = path.join(ROOT, "data");
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* 忽略 */ }
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 留言保留 7 天
const MAX_MESSAGES = 500; // 最多保留条数(防刷屏)
const MAX_NAME = 20; // 昵称最长字符数
const MAX_TEXT = 300; // 留言最长字符数
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 登录态有效 30 天(持久化到文件,重启不丢)
const CHAT_TTL = 8 * 60 * 60 * 1000; // 聊天消息保留 8 小时
const MAX_CHAT = 1000; // 聊天最多保留条数(防刷屏)
const MAX_CHAT_TEXT = 200; // 单条聊天消息最长字符数

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

/* ==========================================================================
   通用工具
   ========================================================================== */

/* 读取 JSON 文件(兼容 BOM),失败返回 fallback */
function readJSON(file, fallback) {
  try {
    let raw = fs.readFileSync(file, "utf8");
    raw = raw.replace(/^\uFEFF/, "");
    const d = JSON.parse(raw);
    return d === undefined ? fallback : d;
  } catch (e) {
    return fallback;
  }
}

/* 异步写文件(不阻塞事件循环;数据以内存为准,文件仅作持久化备份) */
function writeJSON(file, data) {
  fs.writeFile(file, JSON.stringify(data, null, 2), "utf8", (e) => {
    if (e) console.error("[writeJSON]", file, e.message);
  });
}

/* 内存缓存:避免每次请求同步读磁盘阻塞事件循环(多人轮询时性能关键) */
const cache = { messages: null, users: null, chat: null };

/* 读取 POST 请求体(带大小限制) */
function readBody(req, limit, cb) {
  let size = 0;
  const chunks = [];
  req.on("data", (c) => {
    size += c.length;
    if (size > limit) {
      req.destroy();
      cb(new Error("too large"));
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
  req.on("error", (e) => cb(e));
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

/* ==========================================================================
   网易云音乐搜索代理
   浏览器直接请求 music.163.com 会被跨域(CORS)拦截,由本服务器转发;
   且网易云对无 Cookie 的请求(尤其海外服务器 IP)会拒绝,
   因此带上浏览器样式 Cookie 并多接口并行容错。
   前端调用:GET /api/music/search?q=关键词
   ========================================================================== */

/* 随机 NMTID(网易云匿名访客标识,任意 32 位十六进制即可) */
function makeNMTID() {
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

const NETBASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Referer: "https://music.163.com/",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

/* 单个接口请求:url 成功且解析出歌曲则回调 songs,否则回调 null */
function fetchNeteaseSongs(url, cb) {
  let settled = false;
  const req = https.get(
    url,
    {
      headers: { ...NETBASE_HEADERS, Cookie: "os=pc; appver=2.9.7; NMTID=" + makeNMTID() },
      timeout: 8000,
    },
    (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        if (settled) return;
        settled = true;
        try {
          const d = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const songs = (d && d.result && d.result.songs) || [];
          const list = songs.slice(0, 20).map((s) => ({
            id: s.id,
            name: s.name || "未知歌曲",
            artist: (s.artists || []).map((a) => a.name).join(" / "),
            album: (s.album && s.album.name) || "",
          }));
          cb(list.length ? list : null);
        } catch (e) {
          cb(null);
        }
      });
    }
  );
  req.on("timeout", () => { req.destroy(); if (!settled) { settled = true; cb(null); } });
  req.on("error", () => { if (!settled) { settled = true; cb(null); } });
}

function handleMusicSearch(res, rawUrl) {
  const m = (rawUrl || "").match(/[?&]q=([^&]*)/);
  const kw = m ? decodeURIComponent(m[1]).trim().slice(0, 50) : "";
  if (!kw) return sendJSON(res, 400, { ok: false, error: "请输入搜索关键词" });

  const q = encodeURIComponent(kw);
  // 多接口并行,谁先返回结果用谁(提高海外服务器可用性)
  const sources = [
    "https://music.163.com/api/search/get/web?s=" + q + "&type=1&limit=20",
    "https://music.163.com/api/cloudsearch/pc?s=" + q + "&type=1&limit=20",
    "https://music.163.com/api/search/get?s=" + q + "&type=1&limit=20",
  ];

  let done = false;
  let pending = sources.length;
  const sendOnce = (code, obj) => {
    if (done) return;
    done = true;
    sendJSON(res, code, obj);
  };

  sources.forEach((url) => {
    fetchNeteaseSongs(url, (list) => {
      if (done) return;
      if (list) return sendOnce(200, { ok: true, songs: list });
      if (--pending <= 0) {
        sendOnce(502, { ok: false, error: "网易云搜索暂时不可用(所有接口均失败),请稍后再试" });
      }
    });
  });
}

/* ==========================================================================
   网易云账号与歌单
   登录方式:粘贴网易云网页版 cookie 中的 MUSIC_U(无需密码与加密登录),
   之后用该 cookie 调用公开接口读取歌单。会话保存在 data/netease.json。
   ========================================================================== */
const NETBASE_COOKIE_BASE = "os=pc; appver=2.9.7; ";
const NETBASE_SESSION_FILE = path.join(DATA_DIR, "netease.json");
let neteaseSession = null; // { cookie, uid, nickname, time }
try {
  neteaseSession = readJSON(NETBASE_SESSION_FILE, null);
} catch (e) { /* 忽略 */ }

/* 带当前会话 cookie 请求网易云 GET 接口(失败回调 null) */
function neteaseGet(path, cb) {
  const cookie = neteaseSession
    ? NETBASE_COOKIE_BASE + neteaseSession.cookie
    : NETBASE_COOKIE_BASE;
  let settled = false;
  const req = https.get(
    "https://music.163.com" + path,
    { headers: { ...NETBASE_HEADERS, Cookie: cookie }, timeout: 8000 },
    (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        if (settled) return;
        settled = true;
        try {
          cb(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (e) {
          cb(null);
        }
      });
    }
  );
  req.on("timeout", () => { req.destroy(); if (!settled) { settled = true; cb(null); } });
  req.on("error", () => { if (!settled) { settled = true; cb(null); } });
}

/* 歌单列表 → 前端字段 */
function mapPlaylists(list) {
  return (list || []).map((p) => ({
    id: p.id,
    name: p.name || "未命名歌单",
    cover: p.coverImgUrl || "",
    playCount: p.playCount || 0,
    trackCount: p.trackCount || 0,
    creator: (p.creator && p.creator.nickname) || "",
  }));
}

/* —— 搜索歌单 —— */
function handleNeteaseSearchPlaylist(res, rawUrl) {
  const m = (rawUrl || "").match(/[?&]q=([^&]*)/);
  const kw = m ? decodeURIComponent(m[1]).trim().slice(0, 50) : "";
  if (!kw) return sendJSON(res, 400, { ok: false, error: "请输入歌单关键词" });
  neteaseGet(
    "/api/search/get/web?s=" + encodeURIComponent(kw) + "&type=1000&limit=30",
    (d) => {
      if (!d) return sendJSON(res, 502, { ok: false, error: "网易云暂时不可用,请稍后再试" });
      const pls = (d.result && d.result.playlists) || [];
      sendJSON(res, 200, { ok: true, playlists: mapPlaylists(pls.slice(0, 30)) });
    }
  );
}

/* —— 歌单详情(歌曲列表) —— */
function handleNeteasePlaylistDetail(res, rawUrl) {
  const m = (rawUrl || "").match(/[?&]id=(\d+)/);
  const id = m ? m[1] : "";
  if (!id) return sendJSON(res, 400, { ok: false, error: "缺少歌单 id" });
  neteaseGet("/api/playlist/detail?id=" + id, (d) => {
    if (!d || !d.result) return sendJSON(res, 502, { ok: false, error: "获取歌单失败" });
    const r = d.result;
    const tracks = (r.tracks || [])
      .filter(Boolean)
      .map((t) => ({
        id: t.id,
        name: t.name || "未知歌曲",
        artist: (t.artists || []).map((a) => a.name).join(" / "),
      }));
    sendJSON(res, 200, {
      ok: true,
      playlist: { id: r.id, name: r.name || "", trackCount: r.trackCount || tracks.length, tracks },
    });
  });
}

/* —— 我的歌单(需登录) —— */
function handleNeteaseMine(res) {
  if (!neteaseSession) return sendJSON(res, 200, { ok: false, error: "未登录" });
  neteaseGet(
    "/api/user/playlist?uid=" + neteaseSession.uid + "&limit=100&offset=0",
    (d) => {
      if (!d) return sendJSON(res, 502, { ok: false, error: "网易云暂时不可用,请稍后再试" });
      sendJSON(res, 200, { ok: true, playlists: mapPlaylists(d.playlist || []) });
    }
  );
}

/* —— 当前登录态 —— */
function handleNeteaseMe(res) {
  if (!neteaseSession) {
    return sendJSON(res, 200, { ok: true, loggedIn: false });
  }
  sendJSON(res, 200, {
    ok: true,
    loggedIn: true,
    nickname: neteaseSession.nickname || "",
    uid: neteaseSession.uid || 0,
  });
}

/* —— 登录:粘贴 MUSIC_U —— */
function handleNeteaseLogin(req, res) {
  readBody(req, 16 * 1024, (err, body) => {
    if (err) return sendJSON(res, 413, { ok: false, error: "Payload Too Large" });
    let data;
    try { data = JSON.parse(body || "{}"); } catch (e) { return sendJSON(res, 400, { ok: false, error: "Bad JSON" }); }
    const musicu = String(data.musicu || "").trim();
    if (!musicu) return sendJSON(res, 400, { ok: false, error: "请输入 MUSIC_U 值" });

    // 用该 cookie 请求账号信息验证有效性
    let settled = false;
    const req2 = https.get(
      "https://music.163.com/api/nuser/account/get",
      {
        headers: { ...NETBASE_HEADERS, Cookie: NETBASE_COOKIE_BASE + "MUSIC_U=" + musicu },
        timeout: 8000,
      },
      (r) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => {
          if (settled) return;
          settled = true;
          let d = null;
          try { d = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { /* 忽略 */ }
          if (d && d.profile && d.profile.userId) {
            neteaseSession = {
              cookie: "MUSIC_U=" + musicu,
              uid: d.profile.userId,
              nickname: d.profile.nickname || "网易云用户",
              time: Date.now(),
            };
            writeJSON(NETBASE_SESSION_FILE, neteaseSession);
            return sendJSON(res, 200, { ok: true, nickname: neteaseSession.nickname, uid: neteaseSession.uid });
          }
          sendJSON(res, 200, { ok: false, error: "MUSIC_U 无效或已过期,请重新从网易云获取" });
        });
      }
    );
    req2.on("timeout", () => { req2.destroy(); if (!settled) { settled = true; sendJSON(res, 502, { ok: false, error: "验证超时,请重试" }); } });
    req2.on("error", () => { if (!settled) { settled = true; sendJSON(res, 502, { ok: false, error: "连接网易云失败" }); } });
  });
}

/* —— 退出登录 —— */
function handleNeteaseLogout(req, res) {
  readBody(req, 16 * 1024, () => {
    neteaseSession = null;
    try { fs.unlinkSync(NETBASE_SESSION_FILE); } catch (e) { /* 忽略 */ }
    sendJSON(res, 200, { ok: true });
  });
}

/* ==========================================================================
   留言板
   ========================================================================== */

function loadMessages() {
  if (cache.messages === null) {
    const list = readJSON(MESSAGES_FILE, []);
    cache.messages = Array.isArray(list) ? list : [];
  }
  const now = Date.now();
  cache.messages = cache.messages.filter((m) => now - (m.time || 0) < MAX_AGE);
  return cache.messages;
}

function saveMessages(list) {
  const now = Date.now();
  const fresh = list
    .filter((m) => now - (m.time || 0) < MAX_AGE)
    .slice(-MAX_MESSAGES);
  cache.messages = fresh; // 更新内存
  writeJSON(MESSAGES_FILE, fresh); // 异步落盘
  return fresh;
}

/* ==========================================================================
   聊天室(消息仅保留 8 小时,自动清空)
   ========================================================================== */

function loadChat() {
  if (cache.chat === null) {
    const list = readJSON(CHAT_FILE, []);
    cache.chat = Array.isArray(list) ? list : [];
  }
  const now = Date.now();
  cache.chat = cache.chat.filter((m) => now - (m.time || 0) < CHAT_TTL);
  return cache.chat;
}

function saveChat(list) {
  const now = Date.now();
  const fresh = list
    .filter((m) => now - (m.time || 0) < CHAT_TTL)
    .slice(-MAX_CHAT);
  cache.chat = fresh;
  writeJSON(CHAT_FILE, fresh);
  return fresh;
}

/* ==========================================================================
   账号系统(QQ 号当账号)
   ========================================================================== */

function loadUsers() {
  if (cache.users === null) {
    const list = readJSON(USERS_FILE, []);
    cache.users = Array.isArray(list) ? list : [];
  }
  return cache.users;
}

function saveUsers(list) {
  cache.users = list;
  writeJSON(USERS_FILE, list);
}

function findUser(qq) {
  return loadUsers().find((u) => u.qq === qq) || null;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

/* —— 会话:持久化到文件,30 天有效,服务器重启登录态不丢 —— */
let sessions = new Map();

/* 启动时从文件加载会话(自动清理过期) */
function loadSessions() {
  const data = readJSON(SESSIONS_FILE, {});
  const now = Date.now();
  sessions = new Map();
  if (data && typeof data === "object") {
    Object.entries(data).forEach(([t, s]) => {
      if (s && s.qq && now - (s.time || 0) < SESSION_TTL) sessions.set(t, s);
    });
  }
  saveSessions();
}

function saveSessions() {
  const obj = {};
  sessions.forEach((s, t) => { obj[t] = s; });
  writeJSON(SESSIONS_FILE, obj);
}

function cleanupSessions() {
  const now = Date.now();
  let changed = false;
  for (const [t, s] of sessions) {
    if (now - s.time > SESSION_TTL) { sessions.delete(t); changed = true; }
  }
  if (changed) saveSessions();
}

function createSession(qq) {
  cleanupSessions();
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { qq, time: Date.now() });
  saveSessions();
  return token;
}

function deleteSession(token) {
  if (sessions.delete(token)) saveSessions();
}

function userByToken(token) {
  if (!token) return null;
  cleanupSessions();
  const s = sessions.get(token);
  if (!s) return null;
  // 滑动续期:用户每次访问(调 /api/me)刷新过期时间,
  // 只要 30 天内用过就保持登录;连续 30 天不使用才自动退出。
  // 为避免频繁写盘,间隔超过 1 小时才写一次。
  const now = Date.now();
  if (now - s.time > 60 * 60 * 1000) {
    s.time = now;
    saveSessions();
  }
  return findUser(s.qq);
}

/* 从请求头读取 token:Authorization: Bearer xxx */
function tokenFromReq(req) {
  const h = req.headers["authorization"] || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function publicUser(u) {
  return { qq: u.qq, nickname: u.nickname || "" };
}

/* ==========================================================================
   API 处理(返回 true 表示已处理)
   ========================================================================== */

/* —— 留言:GET 列表 / POST 提交 —— */
function handleMessages(req, res) {
  if (req.method === "GET") {
    sendJSON(res, 200, { ok: true, messages: loadMessages() });
    return;
  }
  if (req.method === "POST") {
    readBody(req, 16 * 1024, (err, body) => {
      if (err) return sendJSON(res, 413, { ok: false, error: "Payload Too Large" });
      let data;
      try {
        data = JSON.parse(body || "{}");
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: "Bad JSON" });
      }
      const text = String(data.text || "").trim().slice(0, MAX_TEXT);
      if (!text) return sendJSON(res, 400, { ok: false, error: "留言内容不能为空" });

      const list = loadMessages();
      const user = userByToken(String(data.token || ""));
      if (user) {
        // 登录用户留言:绑定 QQ 账号
        list.push({
          name: (user.nickname || "QQ用户").slice(0, MAX_NAME),
          text,
          time: Date.now(),
          qq: user.qq,
        });
      } else {
        // 未登录:匿名留言
        const name = String(data.name || "匿名").trim().slice(0, MAX_NAME);
        list.push({ name: name || "匿名", text, time: Date.now() });
      }
      sendJSON(res, 200, { ok: true, messages: saveMessages(list) });
    });
    return;
  }
  sendJSON(res, 405, { ok: false, error: "Method Not Allowed" });
}

/* —— 注册(成功即自动登录) —— */
function handleRegister(req, res) {
  readBody(req, 16 * 1024, (err, body) => {
    if (err) return sendJSON(res, 413, { ok: false, error: "Payload Too Large" });
    let data;
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: "Bad JSON" });
    }
    const qq = String(data.qq || "").trim();
    const password = String(data.password || "");
    const nickname = String(data.nickname || "").trim().slice(0, MAX_NAME);

    if (!/^\d{5,11}$/.test(qq)) {
      return sendJSON(res, 400, { ok: false, error: "QQ 号格式不正确(5-11 位数字)" });
    }
    if (password.length < 6 || password.length > 32) {
      return sendJSON(res, 400, { ok: false, error: "密码长度需为 6-32 位" });
    }
    if (findUser(qq)) {
      return sendJSON(res, 400, { ok: false, error: "该 QQ 号已注册,请直接登录" });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const users = loadUsers();
    users.push({
      qq,
      nickname,
      salt,
      hash: hashPassword(password, salt),
      time: Date.now(),
    });
    saveUsers(users);

    const user = findUser(qq);
    sendJSON(res, 200, { ok: true, token: createSession(qq), user: publicUser(user) });
  });
}

/* —— 登录 —— */
function handleLogin(req, res) {
  readBody(req, 16 * 1024, (err, body) => {
    if (err) return sendJSON(res, 413, { ok: false, error: "Payload Too Large" });
    let data;
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: "Bad JSON" });
    }
    const qq = String(data.qq || "").trim();
    const password = String(data.password || "");
    const user = findUser(qq);
    if (!user) {
      return sendJSON(res, 400, { ok: false, error: "该 QQ 号未注册" });
    }
    const hash = hashPassword(password, user.salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"))) {
      return sendJSON(res, 400, { ok: false, error: "QQ 号或密码错误" });
    }
    sendJSON(res, 200, { ok: true, token: createSession(qq), user: publicUser(user) });
  });
}

/* —— 退出 —— */
function handleLogout(req, res) {
  readBody(req, 16 * 1024, (err, body) => {
    if (err) return sendJSON(res, 413, { ok: false, error: "Payload Too Large" });
    let data;
    try {
      data = JSON.parse(body || "{}");
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: "Bad JSON" });
    }
    deleteSession(String(data.token || ""));
    sendJSON(res, 200, { ok: true });
  });
}

/* —— 校验登录态 —— */
function handleMe(req, res) {
  const user = userByToken(tokenFromReq(req));
  if (!user) return sendJSON(res, 200, { ok: false });
  sendJSON(res, 200, { ok: true, user: publicUser(user) });
}

/* —— 聊天:GET 增量拉取 / POST 发送 —— */
function handleChat(req, res) {
  if (req.method === "GET") {
    // 支持 ?after=<时间戳>:只返回该时间之后的新消息
    const qs = (req.url || "").split("?")[1] || "";
    const m = qs.match(/after=(\d+)/);
    const after = m ? parseInt(m[1], 10) : 0;
    const list = loadChat();
    const messages = after ? list.filter((x) => x.time > after) : list;
    sendJSON(res, 200, { ok: true, messages, now: Date.now() });
    return;
  }
  if (req.method === "POST") {
    readBody(req, 16 * 1024, (err, body) => {
      if (err) return sendJSON(res, 413, { ok: false, error: "Payload Too Large" });
      let data;
      try {
        data = JSON.parse(body || "{}");
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: "Bad JSON" });
      }
      const text = String(data.text || "").trim().slice(0, MAX_CHAT_TEXT);
      if (!text) return sendJSON(res, 400, { ok: false, error: "消息不能为空" });

      const user = userByToken(String(data.token || ""));
      const msg = user
        ? {
            name: (user.nickname || "QQ用户").slice(0, MAX_NAME),
            text,
            time: Date.now(),
            qq: user.qq,
          }
        : { name: "匿名", text, time: Date.now() };

      const list = loadChat();
      list.push(msg);
      saveChat(list);
      sendJSON(res, 200, { ok: true, message: msg });
    });
    return;
  }
  sendJSON(res, 405, { ok: false, error: "Method Not Allowed" });
}

/* —— API 路由 —— */
function handleApi(req, res, url) {
  if (url === "/api/messages") return handleMessages(req, res), true;
  if (url === "/api/chat") return handleChat(req, res), true;
  if (url === "/api/register") return handleRegister(req, res), true;
  if (url === "/api/login") return handleLogin(req, res), true;
  if (url === "/api/logout") return handleLogout(req, res), true;
  if (url === "/api/me") return handleMe(req, res), true;
  return false;
}

/* ==========================================================================
   HTTP 服务
   ========================================================================== */
/* 启动时加载持久化的登录会话 */
loadSessions();

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);

  /* 网易云搜索代理(需要 query,单独处理) */
  if (url === "/api/music/search") {
    handleMusicSearch(res, req.url);
    return;
  }
  /* 网易云歌单与账号 */
  if (url === "/api/netease/search") { handleNeteaseSearchPlaylist(res, req.url); return; }
  if (url === "/api/netease/playlist") { handleNeteasePlaylistDetail(res, req.url); return; }
  if (url === "/api/netease/mine") { handleNeteaseMine(res); return; }
  if (url === "/api/netease/me") { handleNeteaseMe(res); return; }
  if (url === "/api/netease/login") { handleNeteaseLogin(req, res); return; }
  if (url === "/api/netease/logout") { handleNeteaseLogout(req, res); return; }

  /* API 优先处理 */
  if (url.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }

  if (url === "/") url = "/index.html";
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": st.size,
    };
    // 缓存策略:
    // - html/js/css 用协商缓存(no-cache + ETag):部署更新后用户刷新即拿到新文件;
    //   文件未变化时服务器返回 304,浏览器用本地缓存,不浪费流量。
    // - 图片/视频/音频缓存 7 天(大文件,不缓存会导致每次切页重新下载,加载极慢)
    if (ext === ".html" || ext === ".js" || ext === ".css") {
      headers["Cache-Control"] = "no-cache";
      headers["ETag"] = '"' + st.size + "-" + Math.floor(st.mtimeMs) + '"';
      if (req.headers["if-none-match"] === headers["ETag"]) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
    } else {
      headers["Cache-Control"] = "public, max-age=604800";
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
});

/* WebSocket 升级:按路径分发
   /ws           → 你画我猜
   /ws-werewolf  → 狼人杀 */
server.on("upgrade", (req, socket) => {
  const wsPath = (req.url || "").split("?")[0];
  if (wsPath === "/ws-werewolf") handleWerewolfUpgrade(req, socket);
  else handleUpgrade(req, socket);
});

server.listen(PORT, () => {
  console.log("========================================");
  console.log("  DY导航站 已启动!");
  console.log("  本机访问: http://localhost:" + PORT);
  console.log("  局域网访问: http://你的IP:" + PORT);
  console.log("  留言板: 留言保留 7 天,自动清空重置");
  console.log("  聊天室: 消息保留 8 小时,自动清空重置");
  console.log("  你画我猜: /ws 单房间,满 3 人开始");
  console.log("  账号: QQ 号注册/登录(简化方案,密码加盐存储)");
  console.log("  关闭本窗口即停止服务");
  console.log("========================================");
});
