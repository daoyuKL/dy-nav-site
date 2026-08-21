/* ==========================================================================
   《DY导航站》恶魔轮盘客户端(2-4 人联机 · WebSocket)
   ==========================================================================
   功能:加入房间 → 房主开局 → 轮流开枪/使用道具 → 活到最后的人赢。
   道具:🚬香烟 🍺啤酒 🔍放大镜 🔪小刀 🧤手铐;3 人以上额外
         🔄逆转器(反转剩余子弹顺序) 📱手机(随机告知一颗子弹类型)。
   连接:/ws-buckshot
   注意:本文件为 ES5(兼容老手机 WebView),请勿使用箭头函数/模板字符串。
   ========================================================================== */

(function () {
  "use strict";

  var ITEM_NAMES = {
    cig: "🚬 香烟", beer: "🍺 啤酒", lens: "🔍 放大镜",
    knife: "🔪 小刀", cuffs: "🧤 手铐", reverser: "🔄 逆转器", phone: "📱 手机"
  };
  var ITEM_DESC = {
    cig: "恢复 1 点生命(上限 6)",
    beer: "退出当前一发子弹,不触发",
    lens: "查看弹仓当前子弹",
    knife: "下一发实弹伤害翻倍(2 点)",
    cuffs: "铐住下一位玩家,跳过其回合",
    reverser: "反转剩余子弹顺序(3 人以上)",
    phone: "随机告诉你第几颗是实弹/空包(3 人以上)"
  };

  var ws = null;
  var myId = null;
  var roomOwnerId = null;
  var players = [];
  var phase = "lobby"; // lobby | playing | over
  var roundInfo = null; // {round, total, live, blank, remaining}
  var myItems = {};
  var turnId = null;
  var myTurn = false;
  var knifeArmed = false;
  var roomCode = null;   // 当前房间号
  var retryCount = 0;    // 重连次数(防止房间解散后无限重连)
  /* 稳定身份:刷新/挂后台后自动回房用 */
  var cid = "";
  try {
    cid = localStorage.getItem("dynav-cid") || ("gc" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("dynav-cid", cid);
  } catch (e) { cid = ""; }

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    var el = $("br-log");
    if (!el) return;
    var d = document.createElement("div");
    d.className = "br-log-item" + (cls ? " " + cls : "");
    d.innerHTML = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
    while (el.children.length > 100) el.removeChild(el.firstChild);
  }

  function setStatus(t) {
    var el = $("br-lobby-status");
    if (el) el.textContent = t;
  }

  function nameOf(id) {
    for (var i = 0; i < players.length; i++) {
      if (players[i].id === id) return players[i].name;
    }
    return "?";
  }

  function isHost() {
    return myId && myId === roomOwnerId;
  }

  /* ==========================================================================
     渲染
     ========================================================================== */

  function renderAll() {
    renderLobby();
    renderRoomCode();
    renderPlayers();
    renderChamber();
    renderItems();
    renderActions();
    renderRound();
  }

  function renderLobby() {
    var lobby = $("br-lobby");
    var roomEl = $("br-room");
    if (!lobby || !roomEl) return;
    if (phase === "lobby") {
      lobby.style.display = "";
      roomEl.style.display = "none";
      var box = $("br-lobby-players");
      if (box) {
        box.innerHTML = (players.length ? players.map(function (p) {
          return '<div class="br-lp">' + esc(p.name) + (p.id === myId ? " (我)" : "") + (p.id === roomOwnerId ? " 👑" : "") + "</div>";
        }).join("") : '<div class="br-lp muted">还没有玩家,把链接发给朋友吧</div>');
      }
      var startBtn = $("br-start-btn");
      if (startBtn) {
        if (!myId) {
          startBtn.style.display = "none";
        } else {
          startBtn.style.display = "";
          var can = isHost() && players.length >= 2;
          startBtn.disabled = !can;
          startBtn.textContent = can ? "开始游戏" : (isHost() ? "至少需要 2 人" : "等待房主开始…");
        }
      }
    } else {
      lobby.style.display = "none";
      roomEl.style.display = "";
    }
  }

  function renderPlayers() {
    var box = $("br-players");
    if (!box) return;
    box.innerHTML = players.map(function (p) {
      var pct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
      var cls = "br-pcard";
      if (p.id === myId) cls += " me";
      if (!p.alive) cls += " dead";
      if (phase === "playing" && p.id === turnId && p.alive) cls += " turn";
      return '<div class="' + cls + '">' +
        '<div class="br-pname">' + esc(p.name) + (p.losses > 0 ? " ⚔️" + p.losses + "败" : "") + (p.cuffed ? " 🧤" : "") + (p.id === myId ? " (我)" : "") + "</div>" +
        '<div class="br-hpbar"><div class="br-hpfill" style="width:' + pct + '%"></div></div>' +
        '<div class="br-hpnum">' + p.hp + "/" + p.maxHp + (p.alive ? "" : " 💀") + "</div>" +
        "</div>";
    }).join("");
  }

  function renderChamber() {
    var el = $("br-chamber");
    if (!el) return;
    if (!roundInfo) { el.textContent = ""; return; }
    var remain = roundInfo.remaining;
    var bullets = "";
    for (var i = 0; i < remain; i++) bullets += "🟥";
    for (var j = 0; j < Math.max(0, roundInfo.total - remain); j++) bullets += "⬛";
    el.innerHTML = "弹仓剩余 <b>" + remain + "</b> 发 · 本回合 实弹 " + roundInfo.live + " / 空包 " + roundInfo.blank +
      '<div class="br-bullets">' + bullets + "</div>";
  }

  function renderItems() {
    var box = $("br-items");
    if (!box) return;
    var keys = [];
    for (var k in myItems) {
      if (myItems.hasOwnProperty(k) && myItems[k] > 0) keys.push(k);
    }
    if (!keys.length) {
      box.innerHTML = '<div class="br-items-empty">🎒 本回合没有道具</div>';
      return;
    }
    var html = '<div class="br-items-title">🎒 你的道具</div>';
    html += '<div class="br-items-row">';
    for (var i = 0; i < keys.length; i++) {
      var k2 = keys[i];
      html += '<button class="br-item" data-item="' + k2 + '" title="' + ITEM_DESC[k2] + '"' +
        (myTurn ? "" : " disabled") + ">" + ITEM_NAMES[k2] + "</button>";
    }
    html += "</div>";
    box.innerHTML = html;
    var btns = box.querySelectorAll(".br-item");
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          useItem(btn.getAttribute("data-item"));
        });
      })(btns[b]);
    }
  }

  function renderActions() {
    var box = $("br-actions");
    if (!box) return;
    if (phase !== "playing") { box.innerHTML = ""; return; }
    if (!myTurn) {
      box.innerHTML = '<div class="br-turn-wait">⏳ 等待 ' + esc(nameOf(turnId)) + " 行动…</div>";
      return;
    }
    var html = '<button class="br-btn br-btn-self" data-target="self">🔫 射向自己</button>';
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (p.alive && p.id !== myId) {
        html += '<button class="br-btn br-btn-dealer" data-target="' + p.id + '">🔫 射向 ' + esc(p.name) + "</button>";
      }
    }
    html += '<div class="br-tip">💡 空包打自己可保留回合 · 实弹 1 点伤害' +
      (knifeArmed ? " · 🔪 小刀已上膛!" : "") + "</div>";
    box.innerHTML = html;
    var btns = box.querySelectorAll(".br-btn");
    for (var b2 = 0; b2 < btns.length; b2++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          shoot(btn.getAttribute("data-target"));
        });
      })(btns[b2]);
    }
  }

  function renderRound() {
    var el = $("br-round");
    var info = $("br-info");
    if (el && roundInfo) {
      el.textContent = "第 " + roundInfo.round + " 回合 · 共 " + roundInfo.total + " 发:实弹 " + roundInfo.live + " / 空包 " + roundInfo.blank;
    }
    if (info) {
      if (phase === "playing") {
        info.textContent = myTurn
          ? "🎯 轮到你了!" + (knifeArmed ? " (小刀已上膛)" : "")
          : "⏳ 等待 " + nameOf(turnId) + " 行动…";
      } else {
        info.textContent = "等待游戏开始…";
      }
    }
  }

  /* ==========================================================================
     操作
     ========================================================================== */

  function doJoin() {
    var input = $("br-name");
    var name = (input ? input.value : "") || "";
    name = name.trim();
    var qq = "";
    if (window.Account) {
      var u = window.Account.getUser();
      if (u) {
        if (!name) name = u.nickname || "QQ" + maskQQ(u.qq);
        qq = u.qq;
      }
    }
    send({ t: "join", name: name, qq: qq, cid: cid });
  }

  /* —— 创建房间:向服务器申请房间号并连接 —— */
  function createRoom() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    fetch("/api/room?game=ws-buckshot")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) {
          setStatus("⚠️ " + (d && d.error ? d.error : "创建失败"));
          return;
        }
        roomCode = d.code;
        retryCount = 0;
        setStatus("🏠 房间 " + roomCode + " 创建成功,正在连接…");
        connect(roomCode);
      })
      .catch(function () { setStatus("⚠️ 创建失败,请确认服务端已更新"); });
  }

  /* —— 按房间号加入 —— */
  function joinRoomByCode() {
    var input = $("br-room-input");
    if (!input) return;
    var code = input.value.trim().toUpperCase();
    if (code.length < 4) { setStatus("请输入 4 位房间号"); return; }
    fetch("/api/room?game=ws-buckshot&code=" + encodeURIComponent(code))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.exists) {
          setStatus("❌ 房间 " + code + " 不存在或已解散");
          return;
        }
        roomCode = code;
        retryCount = 0;
        setStatus("🔑 正在加入房间 " + code + " …");
        connect(code);
      })
      .catch(function () { setStatus("⚠️ 加入失败,请确认服务端已更新"); });
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

  function renderRoomCode() {
    var el = $("br-roomcode");
    if (!el) return;
    if (roomCode) {
      el.style.display = "";
      el.innerHTML = "🏠 房间号:<b>" + roomCode + "</b> " +
        '<button class="br-copy" id="br-copy-btn" type="button">📋 复制房间链接</button>';
      var btn = $("br-copy-btn");
      if (btn) btn.addEventListener("click", copyRoomLink);
    } else {
      el.style.display = "none";
    }
  }

  function startGame() {
    send({ t: "start" });
  }

  function useItem(item) {
    if (!myTurn) return;
    send({ t: "item", item: item });
  }

  function shoot(target) {
    if (!myTurn) return;
    send({ t: "shoot", target: target });
  }

  function sendChat() {
    var input = $("br-chat");
    if (!input) return;
    var t = input.value.trim();
    if (!t) return;
    send({ t: "chat", text: t });
    input.value = "";
  }

  /* ==========================================================================
     消息处理
     ========================================================================== */

  function onMessage(data) {
    switch (data.t) {
      case "joined":
        myId = data.id;
        players = data.players || [];
        roomOwnerId = data.ownerId || null;
        phase = data.phase || "lobby";
        /* 记住房间:刷新/挂后台后自动回来 */
        try { localStorage.setItem("dynav-room", roomCode || ""); } catch (e) { /* 忽略 */ }
        renderAll();
        log("🔫 已加入房间,等满 2 人即可开始", "sys");
        break;

      case "players":
        players = data.players || [];
        roomOwnerId = data.ownerId || null;
        phase = data.phase || phase;
        renderAll();
        break;

      case "need2":
        setStatus("还差 " + data.n + " 人才能开始");
        break;

      case "full":
        alert(data.error || "房间已满,请稍后再来");
        break;

      case "game-start":
        phase = "playing";
        renderAll();
        log("🔫 游戏开始!活到最后的人赢", "sys");
        break;

      case "round-start":
        roundInfo = {
          round: data.round, total: data.total,
          live: data.live, blank: data.blank, remaining: data.remaining
        };
        players = data.players || [];
        turnId = null;
        myTurn = false;
        knifeArmed = false;
        renderAll();
        log("第 " + data.round + " 回合 · 装填 " + data.total + " 发:实弹 " + data.live + " / 空包 " + data.blank, "sys");
        break;

      case "my-items":
        myItems = data.items || {};
        renderItems();
        break;

      case "turn":
        turnId = data.id;
        myTurn = data.id === myId;
        if (!data.again) knifeArmed = false; // 新的一轮重置小刀显示
        renderAll();
        if (myTurn) {
          log("🎯 轮到你行动了!" + (data.again ? "(空包保留回合,再来一次)" : ""), "sys");
        }
        break;

      case "chamber":
        if (roundInfo) roundInfo.remaining = data.remaining;
        renderChamber();
        break;

      case "lens-result":
        log("🔍 放大镜:当前子弹是 " +
          (data.shell === "live" ? "💥 <b>实弹</b>!" : data.shell === "blank" ? "💨 <b>空包</b>!" : "?(弹仓已空)"), "ok");
        break;

      case "phone-result":
        log("📱 手机:第 <b>" + data.pos + "</b> 颗子弹是 " +
          (data.type === "live" ? "💥 实弹" : "💨 空包") + "!", "ok");
        break;

      case "shot":
        players = data.hp || players;
        renderPlayers();
        break;

      case "player-dead":
        players = data.players || players;
        renderAll();
        log("💀 " + esc(data.name) + " 倒下了", "err");
        break;

      case "chat":
        log(esc(data.name) + ": " + esc(data.text));
        break;

      case "system":
        log(esc(data.text), "sys");
        break;

      case "game-over":
        phase = "over";
        renderAll();
        showOver(data);
        break;

      default:
        break;
    }
  }

  function showOver(data) {
    var overlay = $("br-overlay");
    if (!overlay) return;
    var title = $("br-over-title");
    var rank = $("br-ranking");
    if (title) {
      title.textContent = data.winner ? "🏆 " + data.winner.name + " 赢了!" : "🏁 游戏结束";
    }
    if (rank) {
      var list = (data.ranking || []).map(function (p, i) {
        var medal = ["🥇", "🥈", "🥉", "4"][i] || (i + 1) + ".";
        return '<div class="game-rank-item">' + medal + " " + esc(p.name) + (p.alive ? " — 幸存" : " — 出局") + "</div>";
      }).join("");
      rank.innerHTML = list || "";
    }
    overlay.style.display = "flex";
  }

  /* ==========================================================================
     连接
     ========================================================================== */

  function connect(code) {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws-buckshot?room=" + code);
    ws.onopen = function () {
      setStatus("✅ 已连接房间 " + code + ",正在加入…");
      doJoin();
    };
    ws.onmessage = function (e) {
      try { onMessage(JSON.parse(e.data)); } catch (err) { /* 忽略坏消息 */ }
    };
    ws.onclose = function () {
      var roomEl = $("br-room");
      if (roomEl && roomEl.style.display !== "none") {
        alert("连接已断开,即将刷新页面");
        setTimeout(function () { location.reload(); }, 1200);
      } else {
        retryCount++;
        if (retryCount > 3) {
          roomCode = null;
          setStatus("⚠️ 连接失败,房间可能已解散,请重新创建或加入");
          return;
        }
        setStatus("⚠️ 连接断开,正在重连…");
        setTimeout(function () { connect(roomCode); }, 2000);
      }
    };
    ws.onerror = function () { /* onclose 处理 */ };
  }

  /* ==========================================================================
     事件绑定
     ========================================================================== */

  var joinBtn = $("br-join-btn");
  if (joinBtn) joinBtn.addEventListener("click", joinRoomByCode);
  var createBtn = $("br-create-btn");
  if (createBtn) createBtn.addEventListener("click", createRoom);
  var nameInput = $("br-name");
  if (nameInput) {
    nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") createRoom(); });
  }
  var roomInput = $("br-room-input");
  if (roomInput) {
    roomInput.addEventListener("keydown", function (e) { if (e.key === "Enter") joinRoomByCode(); });
  }
  var startBtn = $("br-start-btn");
  if (startBtn) startBtn.addEventListener("click", startGame);
  var chatBtn = $("br-chat-btn");
  if (chatBtn) chatBtn.addEventListener("click", sendChat);
  var chatInput = $("br-chat");
  if (chatInput) {
    chatInput.addEventListener("keydown", function (e) { if (e.key === "Enter") sendChat(); });
  }
  var restartBtn = $("br-restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      var overlay = $("br-overlay");
      if (overlay) overlay.style.display = "none";
      /* 服务器会重置回大厅,等待房主重新开始 */
    });
  }
  var overClose = $("br-over-close");
  if (overClose) {
    overClose.addEventListener("click", function () {
      var overlay = $("br-overlay");
      if (overlay) overlay.style.display = "none";
    });
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
      var ri = $("br-room-input");
      if (ri) ri.value = code;
      setTimeout(joinRoomByCode, 400);
    }
  })();
})();
