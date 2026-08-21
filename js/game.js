var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = function __defNormalProp(obj, key, value) {
  return key in obj ? __defProp(obj, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: value
  }) : obj[key] = value;
};
var __spreadValues = function __spreadValues(a, b) {
  for (var prop in b || (b = {})) if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols) for (var props = __getOwnPropSymbols(b), i = 0, n = props.length, prop; i < n; i++) {
    prop = props[i];
    if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  }
  return a;
};
var __spreadProps = function __spreadProps(a, b) {
  return __defProps(a, __getOwnPropDescs(b));
};
(function () {
  "use strict";

  var CW = 800;
  var CH = 500;
  var BG = "#ffffff";
  var lobbyEl = document.getElementById("game-lobby");
  var roomEl = document.getElementById("game-room");
  var nameInput = document.getElementById("game-name");
  var joinBtn = document.getElementById("game-join-btn");
  var createBtn = document.getElementById("game-create-btn");
  var roomInput = document.getElementById("game-room-input");
  var lobbyStatus = document.getElementById("game-lobby-status");
  var infoEl = document.getElementById("game-info");
  var startBtn = document.getElementById("game-start-btn");
  var botBtn = document.getElementById("game-bot-btn");
  var countEl = document.getElementById("game-count");
  var playerListEl = document.getElementById("game-player-list");
  var guessInput = document.getElementById("game-guess");
  var guessBtn = document.getElementById("game-guess-btn");
  var chatInput = document.getElementById("game-chat");
  var chatBtn = document.getElementById("game-chat-btn");
  var logEl = document.getElementById("game-log");
  var canvas = document.getElementById("game-canvas");
  var toolbarEl = document.getElementById("game-toolbar");
  var canvasTip = document.getElementById("game-canvas-tip");
  var overOverlay = document.getElementById("game-over-overlay");
  var rankingEl = document.getElementById("game-ranking");
  var restartBtn = document.getElementById("game-restart-btn");
  var overCloseBtn = document.getElementById("game-over-close");
  var kickOverlay = document.getElementById("game-kick-overlay");
  var kickText = document.getElementById("game-kick-text");
  var kickProgress = document.getElementById("game-kick-progress");
  var kickAgreeBtn = document.getElementById("game-kick-agree");
  var kickAgainstBtn = document.getElementById("game-kick-against");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CW, CH);
  var ws = null;
  var myId = null;
  var myName = "";
  var roomCode = null;   // 当前房间号
  var retryCount = 0;    // 重连次数(防止房间解散后无限重连)
  var isDrawer = false;
  /* 稳定身份:刷新/挂后台后自动回房用 */
  var cid = "";
  try {
    cid = localStorage.getItem("dynav-cid") || ("gc" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("dynav-cid", cid);
  } catch (e) { cid = ""; }
  var started = false;
  var roundNo = 0;
  var maxRounds = 0;
  var wordLen = 0;
  var seconds = 0;
  var players = [];
  var ownerId = null;
  var drawing = false;
  var last = null;
  var curColor = "#000000";
  var curSize = 8;
  var eraser = false;
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function maskQQ(qq) {
    var s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }
  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }
  function log(msg, cls) {
    var d = document.createElement("div");
    d.className = "game-log-item" + (cls ? " " + cls : "");
    d.innerHTML = msg;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
  }
  function wordDots() {
    return Array(Math.max(wordLen, 0)).fill("\uFF3F").join(" ");
  }
  function renderPlayers() {
    countEl.textContent = players.length;
    playerListEl.innerHTML = players.map(function (p) {
      var me = p.id === myId ? " (\u6211)" : "";
      var role = p.id === myId && isDrawer ? " \uD83C\uDFA8" : "";
      var crown = p.id === ownerId ? " \uD83D\uDC51" : "";
      var botTag = p.bot ? " \uD83E\uDD16" : "";
      var rmBtn = p.bot && myId === ownerId ? '<button class="gp-bot-remove" data-id="'.concat(p.id, "\" title=\"\u79FB\u9664\u4EBA\u673A\">\u2715</button>") : "";
      var kickBtn = !p.bot && myId === ownerId && p.id !== myId && p.id !== ownerId ? '<button class="gp-kick" data-id="'.concat(p.id, "\" title=\"\u53D1\u8D77\u8E22\u4EBA\u6295\u7968\">\u8E22</button>") : "";
      var av = p.qq ? '<img class="gp-avatar" src="'.concat(window.Account && window.Account.avatarUrl ? window.Account.avatarUrl(p.qq) : "https://q1.qlogo.cn/g?b=qq&nk=" + p.qq + "&s=100", '" alt="" onerror="this.remove()" />') : '<span class="gp-avatar">'.concat(esc(p.name.charAt(0)), "</span>");
      return '\n        <div class="game-player'.concat(p.id === myId ? " me" : "", '">\n          ').concat(av, '\n          <span class="gp-name">').concat(esc(p.name)).concat(me).concat(crown).concat(role).concat(botTag, "</span>\n          ").concat(rmBtn, "\n          ").concat(kickBtn, '\n          <span class="gp-score">').concat(p.score, " \u5206</span>\n        </div>");
    }).join("");
  }
  function updateStartBtn() {
    if (botBtn) botBtn.style.display = !started && myId && myId === ownerId ? "" : "none";
    if (!startBtn) return;
    if (started) {
      startBtn.style.display = "none";
      return;
    }
    startBtn.style.display = "";
    var isOwner = myId && myId === ownerId;
    startBtn.disabled = !isOwner;
    startBtn.textContent = isOwner ? "\u5F00\u59CB\u6E38\u620F" : "\u7B49\u5F85\u623F\u4E3B\u5F00\u59CB\u2026";
  }
  function renderInfo() {
    if (!started) {
      infoEl.textContent = players.length >= 3 ? "\u5DF2\u5C31\u7EEA ".concat(players.length, " \u4EBA,\u70B9\u51FB\u300C\u5F00\u59CB\u6E38\u620F\u300D\u5F00\u5C40") : "\u7B49\u5F85\u73A9\u5BB6\u52A0\u5165\u2026(".concat(players.length, "/3 \u53EF\u5F00\u5C40)");
      return;
    }
    var meDraw = isDrawer ? " (\u4F60\u6B63\u5728\u753B)" : "";
    infoEl.textContent = "\u7B2C ".concat(roundNo, "/").concat(maxRounds, " \u8F6E \xB7 \u753B\u5E08:").concat(myName === "" ? "?" : getDrawerName()).concat(meDraw, " \xB7 \u5269\u4F59 ").concat(seconds, "s \xB7 \u8BCD:").concat(isDrawer ? "???" : wordDots());
  }
  function getDrawerName() {
    return players.find(function (p) {
      return p.id === myId && isDrawer;
    }) ? myName : "\u2026";
  }
  function posFromEvent(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * CW / r.width,
      y: (e.clientY - r.top) * CH / r.height
    };
  }
  function startStroke(x, y) {
    if (!isDrawer || !started) return;
    drawing = true;
    last = {
      x: x,
      y: y
    };
    lastSend = 0;
  }
  var lastSend = 0;
  function moveStroke(x, y) {
    if (!drawing || !isDrawer || !started) return;
    var p = {
      x: x,
      y: y
    };
    drawLine(last.x, last.y, p.x, p.y, curColor, curSize);
    var now = Date.now();
    if (now - lastSend >= 30) {
      lastSend = now;
      send({
        t: "draw",
        x1: Math.round(last.x * 10) / 10,
        y1: Math.round(last.y * 10) / 10,
        x2: Math.round(p.x * 10) / 10,
        y2: Math.round(p.y * 10) / 10,
        c: curColor,
        w: curSize
      });
    }
    last = p;
  }
  function endStroke() {
    drawing = false;
    last = null;
  }
  function drawLine(x1, y1, x2, y2, c, w) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function clearCanvas() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CW, CH);
  }
  canvas.addEventListener("mousedown", function (e) {
    var p = posFromEvent(e);
    startStroke(p.x, p.y);
  });
  canvas.addEventListener("mousemove", function (e) {
    var p = posFromEvent(e);
    moveStroke(p.x, p.y);
  });
  canvas.addEventListener("mouseup", endStroke);
  canvas.addEventListener("mouseleave", endStroke);
  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    var p = posFromEvent(e.touches[0]);
    startStroke(p.x, p.y);
  }, {
    passive: false
  });
  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    var p = posFromEvent(e.touches[0]);
    moveStroke(p.x, p.y);
  }, {
    passive: false
  });
  canvas.addEventListener("touchend", function (e) {
    e.preventDefault();
    endStroke();
  }, {
    passive: false
  });
  document.querySelectorAll(".tool-color").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".tool-color").forEach(function (x) {
        return x.classList.remove("active");
      });
      b.classList.add("active");
      curColor = b.dataset.c;
      eraser = false;
      document.getElementById("tool-eraser").classList.remove("active");
    });
  });
  document.querySelectorAll(".tool-size").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".tool-size").forEach(function (x) {
        return x.classList.remove("active");
      });
      b.classList.add("active");
      curSize = parseInt(b.dataset.w, 10);
    });
  });
  var eraserBtn = document.getElementById("tool-eraser");
  if (eraserBtn) {
    eraserBtn.addEventListener("click", function () {
      eraser = !eraser;
      eraserBtn.classList.toggle("active", eraser);
      curColor = eraser ? BG : "#000000";
      curSize = eraser ? 24 : 8;
      document.querySelectorAll(".tool-color").forEach(function (x) {
        return x.classList.remove("active");
      });
    });
  }
  document.getElementById("tool-clear").addEventListener("click", function () {
    clearCanvas();
    send({
      t: "clear"
    });
  });
  function sendGuess() {
    var text = (guessInput.value || "").trim();
    if (!text) return;
    send({
      t: "guess",
      text: text
    });
    guessInput.value = "";
  }
  if (guessBtn) guessBtn.addEventListener("click", sendGuess);
  if (guessInput) guessInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendGuess();
  });
  function sendChat() {
    var text = (chatInput.value || "").trim();
    if (!text) return;
    send({
      t: "chat",
      text: text
    });
    chatInput.value = "";
  }
  if (chatBtn) chatBtn.addEventListener("click", sendChat);
  if (chatInput) chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendChat();
  });
  function doJoin() {
    var name = (nameInput.value || "").trim();
    var qq = "";
    if (!name && window.Account) {
      var u = window.Account.getUser();
      if (u) name = u.nickname || "QQ" + maskQQ(u.qq);
    }
    if (window.Account) {
      var _u = window.Account.getUser();
      if (_u) qq = _u.qq;
    }
    myName = name;
    send({
      t: "join",
      name: name,
      qq: qq,
      cid: cid
    });
  }

  /* —— 创建房间 —— */
  function createRoom() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    fetch("/api/room?game=ws")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) {
          lobbyStatus.textContent = "⚠️ " + (d && d.error ? d.error : "创建失败");
          return;
        }
        roomCode = d.code;
        retryCount = 0;
        lobbyStatus.textContent = "🏠 房间 " + roomCode + " 创建成功,正在连接…";
        connect(roomCode);
      })
      .catch(function () { lobbyStatus.textContent = "⚠️ 创建失败,请确认服务端已更新"; });
  }

  /* —— 按房间号加入 —— */
  function joinRoomByCode() {
    var ri = document.getElementById("game-room-input");
    if (!ri) return;
    var code = ri.value.trim().toUpperCase();
    if (code.length < 4) { lobbyStatus.textContent = "请输入 4 位房间号"; return; }
    fetch("/api/room?game=ws&code=" + encodeURIComponent(code))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.exists) {
          lobbyStatus.textContent = "❌ 房间 " + code + " 不存在或已解散";
          return;
        }
        roomCode = code;
        retryCount = 0;
        lobbyStatus.textContent = "🔑 正在加入房间 " + code + " …";
        connect(code);
      })
      .catch(function () { lobbyStatus.textContent = "⚠️ 加入失败,请确认服务端已更新"; });
  }

  /* —— 复制房间链接 —— */
  function copyRoomLink() {
    var url = location.origin + location.pathname + "?room=" + roomCode;
    var done = function () { alert("房间链接已复制,发给朋友即可加入:" + url); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url, done); });
    } else {
      fallbackCopy(url, done);
    }
  }

  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch (e) {
      alert("请手动复制链接:" + text);
    }
  }

  function updateRoomCode() {
    var el = document.getElementById("game-room-code");
    if (!el) return;
    if (roomCode) {
      el.style.display = "";
      el.innerHTML = "🏠 房间号:<b>" + roomCode + "</b> " +
        '<button class="br-copy" id="game-copy-btn" type="button">📋 复制房间链接</button>';
      var btn = document.getElementById("game-copy-btn");
      if (btn) btn.addEventListener("click", copyRoomLink);
    }
  }

  if (createBtn) createBtn.addEventListener("click", createRoom);
  if (joinBtn) joinBtn.addEventListener("click", joinRoomByCode);
  if (roomInput) roomInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") joinRoomByCode();
  });
  if (nameInput) nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") createRoom();
  });
  if (startBtn) startBtn.addEventListener("click", function () {
    return send({
      t: "start"
    });
  });
  if (botBtn) botBtn.addEventListener("click", function () {
    return send({
      t: "addbot",
      n: 1
    });
  });
  playerListEl.addEventListener("click", function (e) {
    var rb = e.target.closest(".gp-bot-remove");
    if (rb) {
      send({
        t: "removebot",
        id: rb.dataset.id
      });
      return;
    }
    var kb = e.target.closest(".gp-kick");
    if (kb) send({
      t: "kick",
      target: kb.dataset.id
    });
  });
  var myKickVoted = false;
  function castKickVote(agree) {
    if (myKickVoted) return;
    myKickVoted = true;
    send({
      t: "kickvote",
      agree: agree
    });
    if (kickAgreeBtn) kickAgreeBtn.disabled = true;
    if (kickAgainstBtn) kickAgainstBtn.disabled = true;
  }
  if (kickAgreeBtn) kickAgreeBtn.addEventListener("click", function () {
    return castKickVote(true);
  });
  if (kickAgainstBtn) kickAgainstBtn.addEventListener("click", function () {
    return castKickVote(false);
  });
  if (restartBtn) restartBtn.addEventListener("click", function () {
    overOverlay.style.display = "none";
    send({
      t: "restart"
    });
  });
  if (overCloseBtn) overCloseBtn.addEventListener("click", function () {
    overOverlay.style.display = "none";
  });
  function applyMode() {
    toolbarEl.style.display = isDrawer ? "" : "none";
    canvas.style.cursor = isDrawer ? "crosshair" : "default";
    guessInput.disabled = isDrawer || !started;
    guessBtn.disabled = isDrawer || !started;
    if (isDrawer) {
      canvasTip.textContent = "\uD83C\uDFA8 \u4F60\u6B63\u5728\u753B!\u8BF7\u753B\u51FA\u4F60\u7684\u8BCD";
    } else if (started) {
      canvasTip.textContent = "\uD83D\uDC40 \u770B\u753B\u731C\u8BCD,\u8F93\u5165\u7B54\u6848\u731C\u5BF9 +10 \u5206";
    } else {
      canvasTip.textContent = "";
    }
  }
  function onMessage(data) {
    switch (data.t) {
      case "joined":
        myId = data.id;
        players = data.players || [];
        ownerId = data.ownerId || null;
        started = data.started;
        lobbyEl.style.display = "none";
        roomEl.style.display = "";
        /* 记住房间:刷新/挂后台后自动回来 */
        try { localStorage.setItem("dynav-room", roomCode || ""); } catch (e) { /* 忽略 */ }
        updateRoomCode();
        renderPlayers();
        renderInfo();
        applyMode();
        updateStartBtn();
        log("<b>\u5DF2\u52A0\u5165\u623F\u95F4</b>,\u7B49\u6EE1 ".concat(data.min, " \u4EBA\u5373\u53EF\u5F00\u59CB"), "sys");
        break;
      case "players":
        players = data.players || [];
        ownerId = data.ownerId || null;
        started = data.started;
        renderPlayers();
        renderInfo();
        applyMode();
        updateStartBtn();
        break;
      case "need3":
        lobbyStatus.textContent = "\u8FD8\u5DEE ".concat(data.n, " \u4EBA\u624D\u80FD\u5F00\u59CB");
        break;
      case "started":
        started = true;
        updateStartBtn();
        log("\uD83C\uDF89 \u6E38\u620F\u5F00\u59CB!", "sys");
        break;
      case "round":
        {
          started = true;
          isDrawer = data.drawer === myId;
          roundNo = data.round;
          maxRounds = data.maxRounds;
          wordLen = data.wordLen;
          seconds = data.seconds;
          clearCanvas();
          players = players.map(function (p) {
            return __spreadProps(__spreadValues({}, p), {
              drawer: p.id === data.drawer
            });
          });
          renderPlayers();
          renderInfo();
          applyMode();
          log("\u7B2C ".concat(data.round, "/").concat(data.maxRounds, " \u8F6E\u5F00\u59CB \xB7 \u753B\u5E08:<b>").concat(esc(data.drawerName), "</b> \xB7 \u8BCD\u957F:").concat(wordDots()), "sys");
          break;
        }
      case "yourword":
        if (isDrawer) {
          canvasTip.textContent = "\uD83C\uDFA8 \u4F60\u753B\u7684\u8BCD\u662F:\u3010".concat(esc(data.word), "\u3011(\u4E0D\u8981\u8BF4\u51FA\u6765!)");
        }
        break;
      case "tick":
        seconds = data.seconds;
        renderInfo();
        break;
      case "draw":
        if (!isDrawer) drawLine(data.x1, data.y1, data.x2, data.y2, data.c, data.w);
        break;
      case "clear":
        if (!isDrawer) clearCanvas();
        break;
      case "result":
        if (data.ok) {
          var scoreText = (data.scores || []).map(function (s) {
            return "".concat(s.name, ":").concat(s.score);
          }).join(" \xB7 ");
          log("\uD83C\uDFAF <b>".concat(esc(data.name), "</b> \u731C\u5BF9\u4E86!\u7B54\u6848\u662F\u300C<b>").concat(esc(data.answer), "</b>\u300D,\u753B\u5E08 +5"), "ok");
          if (data.scores) players = data.scores;
          renderPlayers();
        } else {
          log("\u274C \u4E0D\u5BF9\u54E6,\u518D\u60F3\u60F3", "err");
        }
        break;
      case "timeout":
        log("\u23F0 \u65F6\u95F4\u5230!\u7B54\u6848\u662F\u300C<b>".concat(esc(data.answer), "</b>\u300D"), "sys");
        break;
      case "drawer-left":
        log("\u753B\u5E08\u79BB\u5F00\u4E86,\u8DF3\u8FC7\u5F53\u524D\u56DE\u5408", "sys");
        break;
      case "kickvote-start":
        myKickVoted = false;
        if (kickAgreeBtn) kickAgreeBtn.disabled = false;
        if (kickAgainstBtn) kickAgainstBtn.disabled = false;
        kickText.textContent = "\u623F\u4E3B\u53D1\u8D77\u6295\u7968:\u8E22\u51FA\u300C".concat(esc(data.targetName), "\u300D?");
        kickProgress.textContent = "\u9700\u8981 ".concat(data.needed, "/").concat(data.humans, " \u540D\u771F\u4EBA\u540C\u610F \xB7 ").concat(data.seconds, "s \u5185\u6295\u7968");
        kickOverlay.style.display = "flex";
        break;
      case "kickvote-update":
        {
          var votes = data.votes || {};
          var agree = Object.values(votes).filter(Boolean).length;
          kickProgress.textContent = "\u9700\u8981 ".concat(data.needed, " \u7968\u540C\u610F \xB7 \u5DF2\u540C\u610F ").concat(agree, " \u7968");
          break;
        }
      case "kickvote-end":
        kickOverlay.style.display = "none";
        if (data.ok) log("\uD83D\uDDF3\uFE0F <b>".concat(esc(data.targetName), "</b> \u88AB\u6295\u7968\u8E22\u51FA\u623F\u95F4"), "err");else log("\uD83D\uDDF3\uFE0F \u8E22\u51FA <b>".concat(esc(data.targetName), "</b> \u672A\u901A\u8FC7(\u540C\u610F ").concat(data.agree, "/").concat(data.needed, ")").concat(data.reason ? " \xB7 " + esc(data.reason) : ""), "sys");
        break;
      case "chat":
        if (data.name === "\u7CFB\u7EDF") log('<span class="sys">'.concat(esc(data.text), "</span>"), "sys");else log("<b>".concat(esc(data.name), "</b>: ").concat(esc(data.text)));
        break;
      case "over":
        started = false;
        isDrawer = false;
        renderInfo();
        applyMode();
        updateStartBtn();
        if (data.ranking && data.ranking.length) {
          rankingEl.innerHTML = data.ranking.map(function (r, i) {
            var medal = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"][i] || "".concat(i + 1, ".");
            return '<div class="game-rank-item">'.concat(medal, " <b>").concat(esc(r.name), "</b> \u2014 ").concat(r.score, " \u5206</div>");
          }).join("");
        } else {
          rankingEl.innerHTML = "<div class='game-rank-item'>\u4EBA\u6570\u4E0D\u8DB3,\u672C\u5C40\u7ED3\u675F</div>";
        }
        overOverlay.style.display = "flex";
        log("\uD83C\uDFC1 \u6E38\u620F\u7ED3\u675F,\u67E5\u770B\u6392\u540D!", "sys");
        break;
      case "full":
        alert("\u623F\u95F4\u5DF2\u6EE1(8 \u4EBA),\u8BF7\u7A0D\u540E\u518D\u6765");
        break;
      case "system":
        log('<span class="sys">'.concat(esc(data.text), "</span>"), "sys");
        break;
      default:
        break;
    }
  }
  function connect(code) {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws?room=" + code);
    ws.onopen = function () {
      lobbyStatus.textContent = "✅ 已连接房间 " + code + ",正在加入…";
      doJoin();
    };
    ws.onmessage = function (e) {
      try {
        onMessage(JSON.parse(e.data));
      } catch (err) {}
    };
    ws.onclose = function () {
      if (roomEl.style.display !== "none") {
        alert("连接已断开,即将刷新页面");
        setTimeout(function () {
          return location.reload();
        }, 1200);
      } else {
        retryCount++;
        if (retryCount > 3) {
          roomCode = null;
          lobbyStatus.textContent = "⚠️ 连接失败,房间可能已解散,请重新创建或加入";
          return;
        }
        lobbyStatus.textContent = "⚠️ 连接断开,正在重连…";
        setTimeout(function () { return connect(roomCode); }, 2e3);
      }
    };
    ws.onerror = function () {};
  }

  /* 自动加入:URL 带 ?room=XXXX,或上次的房间(刷新/挂后台后"跟回来") */
  (function () {
    var code = null;
    var m = (location.search || "").match(/[?&]room=([A-Za-z0-9]+)/);
    if (m) code = m[1].toUpperCase();
    if (!code) {
      try { code = localStorage.getItem("dynav-room"); } catch (e) { /* 忽略 */ }
    }
    if (code) {
      var ri = document.getElementById("game-room-input");
      if (ri) ri.value = code;
      setTimeout(joinRoomByCode, 400);
    }
  })();
})();
