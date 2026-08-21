(function () {
  "use strict";

  var lobbyEl = document.getElementById("wl-lobby");
  var roomEl = document.getElementById("wl-room");
  var nameInput = document.getElementById("wl-name");
  var joinBtn = document.getElementById("wl-join-btn");
  var createBtn = document.getElementById("wl-create-btn");
  var roomInput = document.getElementById("wl-room-input");
  var lobbyStatus = document.getElementById("wl-lobby-status");
  var infoEl = document.getElementById("wl-info");
  var startBtn = document.getElementById("wl-start-btn");
  var botBtn = document.getElementById("wl-bot-btn");
  var countEl = document.getElementById("wl-count");
  var playerListEl = document.getElementById("wl-player-list");
  var roleCard = document.getElementById("wl-role-card");
  var roleText = document.getElementById("wl-role-text");
  var stageEl = document.getElementById("wl-stage");
  var actionEl = document.getElementById("wl-action");
  var chatInput = document.getElementById("wl-chat");
  var chatBtn = document.getElementById("wl-chat-btn");
  var logEl = document.getElementById("wl-log");
  var overOverlay = document.getElementById("wl-over-overlay");
  var overTitle = document.getElementById("wl-over-title");
  var overRoles = document.getElementById("wl-over-roles");
  var restartBtn = document.getElementById("wl-restart-btn");
  var overCloseBtn = document.getElementById("wl-over-close");
  if (!lobbyEl) return;
  var ws = null;
  var myId = null;
  var myRole = null;
  var myName = "";
  var roomCode = null;   // 当前房间号
  var retryCount = 0;    // 重连次数(防止房间解散后无限重连)
  /* 稳定身份:刷新/挂后台后自动回房用 */
  var cid = "";
  try {
    cid = localStorage.getItem("dynav-cid") || ("gc" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("dynav-cid", cid);
  } catch (e) { cid = ""; }
  var roomPhase = "lobby";
  var players = [];
  var ownerId = null;
  var countdown = 0;
  var countTimer = null;
  var PHASE_TEXT = {
    kill: "\uD83C\uDF19 \u591C\u665A\u964D\u4E34,\u72FC\u4EBA\u8BF7\u7741\u773C",
    seer: "\uD83D\uDD2E \u9884\u8A00\u5BB6\u8BF7\u7741\u773C",
    witch: "\uD83E\uDDEA \u5973\u5DEB\u8BF7\u7741\u773C",
    shoot: "\uD83C\uDFF9 \u730E\u4EBA\u51FA\u5C40,\u8BF7\u5F00\u67AA",
    discuss: "\u2600\uFE0F \u5929\u4EAE\u4E86,\u8BF7\u8BA8\u8BBA",
    vote: "\uD83D\uDDF3\uFE0F \u6295\u7968\u65F6\u95F4",
    over: "\uD83C\uDFC1 \u6E38\u620F\u7ED3\u675F",
    lobby: "\u7B49\u5F85\u5F00\u59CB\u2026"
  };
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function maskQQ(qq) {
    var s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }
  function avatarUrl(qq) {
    return "https://q1.qlogo.cn/g?b=qq&nk=" + qq + "&s=100";
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
    while (logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
  }
  function renderPlayers() {
    countEl.textContent = players.length;
    playerListEl.innerHTML = players.map(function (p) {
      var av = p.qq ? '<img class="gp-avatar" src="'.concat(avatarUrl(p.qq), '" alt="" onerror="this.remove()" />') : '<span class="gp-avatar">'.concat(esc(p.name.charAt(0)), "</span>");
      var me = p.id === myId ? " (\u6211)" : "";
      var crown = p.id === ownerId ? " \uD83D\uDC51" : "";
      var dead = p.alive ? "" : " \uD83D\uDC80";
      var botTag = p.bot ? " \uD83E\uDD16" : "";
      var rmBtn = p.bot && myId === ownerId ? '<button class="gp-bot-remove" data-id="'.concat(p.id, "\" title=\"\u79FB\u9664\u4EBA\u673A\">\u2715</button>") : "";
      return '\n        <div class="game-player'.concat(p.id === myId ? " me" : "").concat(p.alive ? "" : " wl-dead", '">\n          ').concat(av, '\n          <span class="gp-name">').concat(esc(p.name)).concat(me).concat(crown).concat(dead).concat(botTag, "</span>\n          ").concat(rmBtn, "\n        </div>");
    }).join("");
  }
  function updateStartBtn() {
    if (botBtn) botBtn.style.display = roomPhase === "lobby" && myId && myId === ownerId ? "" : "none";
    if (!startBtn) return;
    if (roomPhase !== "lobby") {
      startBtn.style.display = "none";
      return;
    }
    startBtn.style.display = "";
    var isOwner = myId && myId === ownerId;
    startBtn.disabled = !isOwner;
    startBtn.textContent = isOwner ? "\u5F00\u59CB\u6E38\u620F" : "\u7B49\u5F85\u623F\u4E3B\u5F00\u59CB\u2026";
  }
  function startCountdown(sec) {
    countdown = sec;
    if (countTimer) clearInterval(countTimer);
    countTimer = setInterval(function () {
      countdown--;
      if (countdown <= 0) clearInterval(countTimer);
      updateStage();
    }, 1e3);
  }
  function updateStage() {
    var cd = countdown > 0 ? "(".concat(countdown, "s)") : "";
    stageEl.textContent = (PHASE_TEXT[roomPhase] || roomPhase) + " " + cd;
    if (roomPhase === "discuss" && lastDeaths.length) {
      stageEl.textContent = "\u2600\uFE0F \u6628\u665A ".concat(lastDeaths.join("\u3001"), " \u51FA\u5C40,\u8BF7\u8BA8\u8BBA ").concat(cd);
    }
    if (roomPhase === "vote") {
      stageEl.textContent = "\uD83D\uDDF3\uFE0F \u8BF7\u6295\u7968\u653E\u9010\u4E00\u540D\u73A9\u5BB6 ".concat(cd);
    }
  }
  var lastDeaths = [];
  var acted = false;
  function renderAction() {
    var _a;
    actionEl.innerHTML = "";
    acted = false;
    if (!myRole) return;
    var alive = players.filter(function (p) {
      return p.alive && p.id !== myId;
    });
    function makeButtons(act, label, targets, done) {
      var box = document.createElement("div");
      box.className = "wl-act-group";
      var title = document.createElement("div");
      title.className = "wl-act-label";
      title.textContent = label;
      box.appendChild(title);
      var list = document.createElement("div");
      list.className = "wl-act-list";
      (targets.length ? targets : [{
        id: "none",
        name: "\u6CA1\u6709\u53EF\u9009\u76EE\u6807"
      }]).forEach(function (t) {
        var b = document.createElement("button");
        b.className = "wl-act-btn";
        b.textContent = t.name;
        b.disabled = t.id === "none" || acted;
        b.addEventListener("click", function () {
          send({
            t: "action",
            act: act,
            target: t.id
          });
          b.disabled = true;
          acted = true;
          if (done) done();
        });
        list.appendChild(b);
      });
      box.appendChild(list);
      actionEl.appendChild(box);
    }
    if (roomPhase === "kill" && myRole === "wolf") {
      makeButtons("kill", "\uD83D\uDC3A \u9009\u62E9\u8981\u5200\u6740\u7684\u73A9\u5BB6(\u72FC\u4EBA\u53EF\u8BA8\u8BBA)", alive);
    } else if (roomPhase === "seer" && myRole === "seer") {
      makeButtons("seer", "\uD83D\uDD2E \u9009\u62E9\u8981\u67E5\u9A8C\u7684\u73A9\u5BB6", alive);
    } else if (roomPhase === "witch" && myRole === "witch") {
      actionEl.appendChild(btnNote("\uD83D\uDC8A \u89E3\u836F:" + (witchSaveLeft ? "\u53EF\u7528" : "\u5DF2\u7528")));
      if (witchSaveLeft) makeButtons("save", "\u9009\u62E9\u8981\u6551\u7684\u73A9\u5BB6", alive);
      actionEl.appendChild(btnNote("\u2620\uFE0F \u6BD2\u836F:" + (witchPoisonLeft ? "\u53EF\u7528" : "\u5DF2\u7528")));
      if (witchPoisonLeft) makeButtons("poison", "\u9009\u62E9\u8981\u6BD2\u7684\u73A9\u5BB6", alive);
    } else if (roomPhase === "shoot" && myRole === "hunter") {
      makeButtons("shoot", "\uD83C\uDFF9 \u9009\u62E9\u8981\u5E26\u8D70\u7684\u73A9\u5BB6", alive);
    } else if (roomPhase === "vote" && myRole && ((_a = players.find(function (p) {
      return p.id === myId;
    })) == null ? void 0 : _a.alive) !== false) {
      makeButtons("vote", "\uD83D\uDDF3\uFE0F \u9009\u62E9\u8981\u653E\u9010\u7684\u73A9\u5BB6", alive);
    }
  }
  var witchSaveLeft = true;
  var witchPoisonLeft = true;
  function btnNote(text) {
    var d = document.createElement("div");
    d.className = "wl-act-note";
    d.textContent = text;
    return d;
  }
  function onMessage(data) {
    switch (data.t) {
      case "joined":
        myId = data.id;
        players = data.players || [];
        ownerId = data.ownerId || null;
        lobbyEl.style.display = "none";
        roomEl.style.display = "";
        /* 记住房间:刷新/挂后台后自动回来 */
        try { localStorage.setItem("dynav-room", roomCode || ""); } catch (e) { /* 忽略 */ }
        updateRoomCode();
        renderPlayers();
        updateStartBtn();
        updateStage();
        log("<b>\u5DF2\u52A0\u5165\u623F\u95F4</b>,\u6EE1 ".concat(data.min, " \u4EBA\u53EF\u5F00\u59CB,\u4E0A\u9650 ").concat(data.max, " \u4EBA"), "sys");
        break;
      case "players":
        players = data.players || [];
        ownerId = data.ownerId || null;
        renderPlayers();
        updateStartBtn();
        break;
      case "system":
        log(esc(data.text), "sys");
        break;
      case "game-start":
        log("\uD83D\uDC3A \u6E38\u620F\u5F00\u59CB,\u89D2\u8272\u5DF2\u5206\u914D,\u8BF7\u67E5\u770B\u4F60\u7684\u8EAB\u4EFD!", "sys");
        break;
      case "role":
        myRole = data.role;
        roleCard.style.display = "";
        roleText.textContent = data.roleName;
        if (data.wolves && data.wolves.length) {
          log("\u4F60\u7684\u72FC\u961F\u53CB:".concat(data.wolves.map(function (w) {
            return esc(w.name);
          }).join("\u3001"), " \uD83D\uDC3A"), "sys");
        }
        break;
      case "phase":
        roomPhase = data.phase;
        updateStartBtn();
        if (data.night) log("\uD83C\uDF19 \u7B2C ".concat(data.night, " \u591C\u5F00\u59CB"), "sys");
        startCountdown(data.seconds || 0);
        renderAction();
        if (data.deaths) {
          lastDeaths = data.deaths;
          log("\uD83D\uDC80 \u6628\u665A\u51FA\u5C40:".concat(data.deaths.join("\u3001")), "sys");
        }
        if (data.hunter) {
          log("\uD83C\uDFF9 ".concat(esc(data.hunterName), " \u51FA\u5C40,\u53EF\u4EE5\u5F00\u67AA\u5E26\u8D70\u4E00\u4EBA!"), "sys");
        }
        updateStage();
        break;
      case "action-ok":
        log("\u2705 \u5DF2\u884C\u52A8:".concat(data.act), "sys");
        if (data.act === "save") witchSaveLeft = false;
        if (data.act === "poison") witchPoisonLeft = false;
        break;
      case "seer-result":
        log("\uD83D\uDD2E \u67E5\u9A8C\u7ED3\u679C:<b>".concat(esc(data.name), "</b> \u662F ").concat(data.role === "\u72FC\u4EBA" ? "\uD83D\uDC3A \u72FC\u4EBA" : "\u2705 \u597D\u4EBA"), "ok");
        break;
      case "death":
        lastDeaths = data.deaths || [];
        if (lastDeaths.length) log("\uD83D\uDC80 \u51FA\u5C40:".concat(lastDeaths.map(esc).join("\u3001")), "sys");else log("\uD83C\uDF05 \u5E73\u5B89\u591C,\u65E0\u4EBA\u51FA\u5C40!", "sys");
        break;
      case "shoot-result":
        log("\uD83C\uDFF9 ".concat(esc(data.hunter), " \u5F00\u67AA\u5E26\u8D70\u4E86 ").concat(esc(data.target), "!"), "err");
        break;
      case "vote-result":
        if (data.target) {
          log("\uD83D\uDDF3\uFE0F ".concat(esc(data.targetName), " \u88AB\u6295\u7968\u653E\u9010!"), "err");
        } else {
          log("\uD83D\uDDF3\uFE0F ".concat(esc(data.targetName), ",\u65E0\u4EBA\u51FA\u5C40"), "sys");
        }
        break;
      case "chat":
        if (data.wolf) log("\uD83D\uDC3A <b>".concat(esc(data.name), "</b>(\u72FC): ").concat(esc(data.text)), "sys");else log("<b>".concat(esc(data.name), "</b>: ").concat(esc(data.text)));
        break;
      case "gameover":
        roomPhase = "over";
        updateStage();
        overTitle.textContent = data.winner === "\u72FC\u4EBA" ? "\uD83D\uDC3A \u72FC\u4EBA\u9635\u8425\u80DC\u5229!" : "\uD83C\uDF1F \u597D\u4EBA\u9635\u8425\u80DC\u5229!";
        overRoles.innerHTML = data.roles.map(function (r) {
          return '<div class="game-rank-item">'.concat(r.alive ? "\uD83D\uDFE2" : "\uD83D\uDC80", " ").concat(esc(r.name), " \u2014 ").concat(esc(r.role), "</div>");
        }).join("");
        overOverlay.style.display = "flex";
        log("\uD83C\uDFC1 \u6E38\u620F\u7ED3\u675F,".concat(data.winner, "\u9635\u8425\u83B7\u80DC!"), "sys");
        break;
      default:
        break;
    }
  }
  function doJoin() {
    var name = (nameInput.value || "").trim();
    var qq = "";
    if (window.Account) {
      var u = window.Account.getUser();
      if (u) {
        if (!name) name = u.nickname || "QQ" + maskQQ(u.qq);
        qq = u.qq;
      }
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
    fetch("/api/room?game=ws-werewolf")
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
    var ri = document.getElementById("wl-room-input");
    if (!ri) return;
    var code = ri.value.trim().toUpperCase();
    if (code.length < 4) { lobbyStatus.textContent = "请输入 4 位房间号"; return; }
    fetch("/api/room?game=ws-werewolf&code=" + encodeURIComponent(code))
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
    var el = document.getElementById("wl-room-code");
    if (!el) return;
    if (roomCode) {
      el.style.display = "";
      el.innerHTML = "🏠 房间号:<b>" + roomCode + "</b> " +
        '<button class="br-copy" id="wl-copy-btn" type="button">📋 复制房间链接</button>';
      var btn = document.getElementById("wl-copy-btn");
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
    var b = e.target.closest(".gp-bot-remove");
    if (b) send({
      t: "removebot",
      id: b.dataset.id
    });
  });
  if (restartBtn) restartBtn.addEventListener("click", function () {
    overOverlay.style.display = "none";
    myRole = null;
    roleCard.style.display = "none";
    roomPhase = "lobby";
    updateStartBtn();
    send({
      t: "restart"
    });
  });
  if (overCloseBtn) overCloseBtn.addEventListener("click", function () {
    overOverlay.style.display = "none";
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
  function connect(code) {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws-werewolf?room=" + code);
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
      var ri = document.getElementById("wl-room-input");
      if (ri) ri.value = code;
      setTimeout(joinRoomByCode, 400);
    }
  })();
})();
