/* ==========================================================================
   《DY导航站》你画我猜客户端
   ==========================================================================
   功能:WebSocket 实时连接、Canvas 画板(画师绘制/全员同步)、
         猜词、房间聊天、得分排名。单房间,满 3 人可开始。
   ========================================================================== */

(function () {
  "use strict";

  const CW = 800; // 画布逻辑宽
  const CH = 500; // 画布逻辑高
  const BG = "#ffffff"; // 画板背景

  /* —— DOM —— */
  const lobbyEl = document.getElementById("game-lobby");
  const roomEl = document.getElementById("game-room");
  const nameInput = document.getElementById("game-name");
  const joinBtn = document.getElementById("game-join-btn");
  const lobbyStatus = document.getElementById("game-lobby-status");
  const infoEl = document.getElementById("game-info");
  const startBtn = document.getElementById("game-start-btn");
  const countEl = document.getElementById("game-count");
  const playerListEl = document.getElementById("game-player-list");
  const guessInput = document.getElementById("game-guess");
  const guessBtn = document.getElementById("game-guess-btn");
  const chatInput = document.getElementById("game-chat");
  const chatBtn = document.getElementById("game-chat-btn");
  const logEl = document.getElementById("game-log");
  const canvas = document.getElementById("game-canvas");
  const toolbarEl = document.getElementById("game-toolbar");
  const canvasTip = document.getElementById("game-canvas-tip");
  const overOverlay = document.getElementById("game-over-overlay");
  const rankingEl = document.getElementById("game-ranking");
  const restartBtn = document.getElementById("game-restart-btn");
  const overCloseBtn = document.getElementById("game-over-close");

  if (!canvas) return; // 非游戏页面

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CW, CH);

  /* —— 状态 —— */
  let ws = null;
  let myId = null;
  let myName = "";
  let isDrawer = false;
  let started = false;
  let roundNo = 0;
  let maxRounds = 0;
  let wordLen = 0;
  let seconds = 0;
  let players = [];
  let ownerId = null; // 房主(第一个进房间的人)
  let drawing = false;
  let last = null;
  let curColor = "#000000";
  let curSize = 8;
  let eraser = false;

  /* —— 工具 —— */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function maskQQ(qq) {
    const s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  function log(msg, cls) {
    const d = document.createElement("div");
    d.className = "game-log-item" + (cls ? " " + cls : "");
    d.innerHTML = msg;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild); // 防爆
  }

  function wordDots() {
    return Array(Math.max(wordLen, 0)).fill("＿").join(" ");
  }

  /* —— 玩家列表渲染 —— */
  function renderPlayers() {
    countEl.textContent = players.length;
    playerListEl.innerHTML = players
      .map((p) => {
        const me = p.id === myId ? " (我)" : "";
        const role = p.id === myId && isDrawer ? " 🎨" : "";
        const crown = p.id === ownerId ? " 👑" : "";
        const av = p.qq
          ? `<img class="gp-avatar" src="${(window.Account && window.Account.avatarUrl) ? window.Account.avatarUrl(p.qq) : "https://q1.qlogo.cn/g?b=qq&nk=" + p.qq + "&s=100"}" alt="" onerror="this.remove()" />`
          : `<span class="gp-avatar">${esc(p.name.charAt(0))}</span>`;
        return `
        <div class="game-player${p.id === myId ? " me" : ""}">
          ${av}
          <span class="gp-name">${esc(p.name)}${me}${crown}${role}</span>
          <span class="gp-score">${p.score} 分</span>
        </div>`;
      })
      .join("");
  }

  /* —— 开始按钮:仅房主可用 —— */
  function updateStartBtn() {
    if (!startBtn) return;
    if (started) {
      startBtn.style.display = "none";
      return;
    }
    startBtn.style.display = "";
    const isOwner = myId && myId === ownerId;
    startBtn.disabled = !isOwner;
    startBtn.textContent = isOwner ? "开始游戏" : "等待房主开始…";
  }

  /* —— 状态栏 —— */
  function renderInfo() {
    if (!started) {
      infoEl.textContent = players.length >= 3
        ? `已就绪 ${players.length} 人,点击「开始游戏」开局`
        : `等待玩家加入…(${players.length}/3 可开局)`;
      return;
    }
    const meDraw = isDrawer ? " (你正在画)" : "";
    infoEl.textContent = `第 ${roundNo}/${maxRounds} 轮 · 画师:${myName === "" ? "?" : getDrawerName()}${meDraw} · 剩余 ${seconds}s · 词:${isDrawer ? "???" : wordDots()}`;
  }

  function getDrawerName() {
    return players.find((p) => p.id === myId && isDrawer) ? myName : "…";
  }

  /* —— 画板 —— */
  function posFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * CW) / r.width,
      y: ((e.clientY - r.top) * CH) / r.height,
    };
  }

  function startStroke(x, y) {
    if (!isDrawer || !started) return;
    drawing = true;
    last = { x, y };
  }

  function moveStroke(x, y) {
    if (!drawing || !isDrawer || !started) return;
    const p = { x, y };
    drawLine(last.x, last.y, p.x, p.y, curColor, curSize);
    send({
      t: "draw",
      x1: Math.round(last.x * 10) / 10,
      y1: Math.round(last.y * 10) / 10,
      x2: Math.round(p.x * 10) / 10,
      y2: Math.round(p.y * 10) / 10,
      c: curColor,
      w: curSize,
    });
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

  canvas.addEventListener("mousedown", (e) => {
    const p = posFromEvent(e);
    startStroke(p.x, p.y);
  });
  canvas.addEventListener("mousemove", (e) => {
    const p = posFromEvent(e);
    moveStroke(p.x, p.y);
  });
  canvas.addEventListener("mouseup", endStroke);
  canvas.addEventListener("mouseleave", endStroke);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const p = posFromEvent(e.touches[0]);
    startStroke(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const p = posFromEvent(e.touches[0]);
    moveStroke(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    endStroke();
  }, { passive: false });

  /* —— 工具条 —— */
  document.querySelectorAll(".tool-color").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tool-color").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      curColor = b.dataset.c;
      eraser = false;
      document.getElementById("tool-eraser").classList.remove("active");
    });
  });
  document.querySelectorAll(".tool-size").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tool-size").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      curSize = parseInt(b.dataset.w, 10);
    });
  });
  const eraserBtn = document.getElementById("tool-eraser");
  if (eraserBtn) {
    eraserBtn.addEventListener("click", () => {
      eraser = !eraser;
      eraserBtn.classList.toggle("active", eraser);
      curColor = eraser ? BG : "#000000";
      curSize = eraser ? 24 : 8;
      document.querySelectorAll(".tool-color").forEach((x) => x.classList.remove("active"));
    });
  }
  document.getElementById("tool-clear").addEventListener("click", () => {
    clearCanvas();
    send({ t: "clear" });
  });

  /* —— 猜词 —— */
  function sendGuess() {
    const text = (guessInput.value || "").trim();
    if (!text) return;
    send({ t: "guess", text });
    guessInput.value = "";
  }
  if (guessBtn) guessBtn.addEventListener("click", sendGuess);
  if (guessInput) guessInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendGuess(); });

  /* —— 房间聊天 —— */
  function sendChat() {
    const text = (chatInput.value || "").trim();
    if (!text) return;
    send({ t: "chat", text });
    chatInput.value = "";
  }
  if (chatBtn) chatBtn.addEventListener("click", sendChat);
  if (chatInput) chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

  /* —— 加入房间 —— */
  function join() {
    let name = (nameInput.value || "").trim();
    let qq = "";
    if (!name && window.Account) {
      const u = window.Account.getUser();
      if (u) name = (u.nickname || "QQ" + maskQQ(u.qq));
    }
    if (window.Account) {
      const u = window.Account.getUser();
      if (u) qq = u.qq; // 登录用户带 QQ 号,用于显示头像
    }
    myName = name;
    send({ t: "join", name, qq });
  }
  if (joinBtn) joinBtn.addEventListener("click", join);
  if (nameInput) nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") join(); });

  /* —— 开始/再来一局 —— */
  if (startBtn) startBtn.addEventListener("click", () => send({ t: "start" }));
  if (restartBtn) restartBtn.addEventListener("click", () => {
    overOverlay.style.display = "none";
    send({ t: "restart" });
  });
  if (overCloseBtn) overCloseBtn.addEventListener("click", () => { overOverlay.style.display = "none"; });

  /* —— 游戏模式切换 —— */
  function applyMode() {
    toolbarEl.style.display = isDrawer ? "" : "none";
    canvas.style.cursor = isDrawer ? "crosshair" : "default";
    guessInput.disabled = isDrawer || !started;
    guessBtn.disabled = isDrawer || !started;
    if (isDrawer) {
      canvasTip.textContent = "🎨 你正在画!请画出你的词";
    } else if (started) {
      canvasTip.textContent = "👀 看画猜词,在右侧输入答案";
    } else {
      canvasTip.textContent = "";
    }
  }

  /* —— 消息处理 —— */
  function onMessage(data) {
    switch (data.t) {
      case "joined":
        myId = data.id;
        players = data.players || [];
        ownerId = data.ownerId || null;
        started = data.started;
        lobbyEl.style.display = "none";
        roomEl.style.display = "";
        renderPlayers();
        renderInfo();
        applyMode();
        updateStartBtn();
        log(`<b>已加入房间</b>,等满 ${data.min} 人即可开始`, "sys");
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
        lobbyStatus.textContent = `还差 ${data.n} 人才能开始`;
        break;

      case "started":
        started = true;
        updateStartBtn();
        log("🎉 游戏开始!", "sys");
        break;

      case "round": {
        started = true;
        isDrawer = data.drawer === myId;
        roundNo = data.round;
        maxRounds = data.maxRounds;
        wordLen = data.wordLen;
        seconds = data.seconds;
        clearCanvas();
        players = players.map((p) => ({ ...p, drawer: p.id === data.drawer }));
        renderPlayers();
        renderInfo();
        applyMode();
        log(`第 ${data.round}/${data.maxRounds} 轮开始 · 画师:<b>${esc(data.drawerName)}</b> · 词长:${wordDots()}`, "sys");
        break;
      }

      case "yourword": // 只发给画师
        if (isDrawer) {
          canvasTip.textContent = `🎨 你画的词是:【${esc(data.word)}】(不要说出来!)`;
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
          const scoreText = (data.scores || []).map((s) => `${s.name}:${s.score}`).join(" · ");
          log(`🎯 <b>${esc(data.name)}</b> 猜对了!答案是「<b>${esc(data.answer)}</b>」,画师 +5`, "ok");
          if (data.scores) players = data.scores;
          renderPlayers();
        } else {
          log("❌ 不对哦,再想想", "err");
        }
        break;

      case "timeout":
        log(`⏰ 时间到!答案是「<b>${esc(data.answer)}</b>」`, "sys");
        break;

      case "drawer-left":
        log("画师离开了,跳过当前回合", "sys");
        break;

      case "chat":
        if (data.name === "系统") log(`<span class="sys">${esc(data.text)}</span>`, "sys");
        else log(`<b>${esc(data.name)}</b>: ${esc(data.text)}`);
        break;

      case "over":
        started = false;
        isDrawer = false;
        renderInfo();
        applyMode();
        updateStartBtn();
        if (data.ranking && data.ranking.length) {
          rankingEl.innerHTML = data.ranking
            .map((r, i) => {
              const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
              return `<div class="game-rank-item">${medal} <b>${esc(r.name)}</b> — ${r.score} 分</div>`;
            })
            .join("");
        } else {
          rankingEl.innerHTML = "<div class='game-rank-item'>人数不足,本局结束</div>";
        }
        overOverlay.style.display = "flex";
        log("🏁 游戏结束,查看排名!", "sys");
        break;

      case "full":
        alert("房间已满(8 人),请稍后再来");
        break;

      case "system":
        log(`<span class="sys">${esc(data.text)}</span>`, "sys");
        break;

      default:
        break;
    }
  }

  /* —— WebSocket 连接 —— */
  function connect() {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws");
    ws.onopen = () => {
      lobbyStatus.textContent = "✅ 已连接,请输入昵称加入房间";
      log("已连接到房间服务器", "sys");
    };
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch (err) { /* 忽略坏消息 */ }
    };
    ws.onclose = () => {
      if (roomEl.style.display !== "none") {
        alert("连接已断开,即将刷新页面");
        setTimeout(() => location.reload(), 1200);
      } else {
        lobbyStatus.textContent = "⚠️ 连接断开,正在重连…";
        setTimeout(connect, 2000);
      }
    };
    ws.onerror = () => { /* onclose 处理 */ };
  }

  connect();
})();
