/* ==========================================================================
   《DY导航站》狼人杀客户端
   ==========================================================================
   功能:WebSocket 实时连接、加入房间、身份揭示、夜晚/白天行动、
         投票、讨论聊天、胜负结算。6-12 人,单房间。
   ========================================================================== */

(function () {
  "use strict";

  const lobbyEl = document.getElementById("wl-lobby");
  const roomEl = document.getElementById("wl-room");
  const nameInput = document.getElementById("wl-name");
  const joinBtn = document.getElementById("wl-join-btn");
  const lobbyStatus = document.getElementById("wl-lobby-status");
  const infoEl = document.getElementById("wl-info");
  const startBtn = document.getElementById("wl-start-btn");
  const countEl = document.getElementById("wl-count");
  const playerListEl = document.getElementById("wl-player-list");
  const roleCard = document.getElementById("wl-role-card");
  const roleText = document.getElementById("wl-role-text");
  const stageEl = document.getElementById("wl-stage");
  const actionEl = document.getElementById("wl-action");
  const chatInput = document.getElementById("wl-chat");
  const chatBtn = document.getElementById("wl-chat-btn");
  const logEl = document.getElementById("wl-log");
  const overOverlay = document.getElementById("wl-over-overlay");
  const overTitle = document.getElementById("wl-over-title");
  const overRoles = document.getElementById("wl-over-roles");
  const restartBtn = document.getElementById("wl-restart-btn");
  const overCloseBtn = document.getElementById("wl-over-close");

  if (!lobbyEl) return; // 非狼人杀页面

  let ws = null;
  let myId = null;
  let myRole = null;
  let myName = "";
  let roomPhase = "lobby";
  let players = [];
  let ownerId = null; // 房主(第一个进房间的人)
  let countdown = 0;
  let countTimer = null;

  const PHASE_TEXT = {
    kill: "🌙 夜晚降临,狼人请睁眼",
    seer: "🔮 预言家请睁眼",
    witch: "🧪 女巫请睁眼",
    shoot: "🏹 猎人出局,请开枪",
    discuss: "☀️ 天亮了,请讨论",
    vote: "🗳️ 投票时间",
    over: "🏁 游戏结束",
    lobby: "等待开始…",
  };

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

  function avatarUrl(qq) {
    return "https://q1.qlogo.cn/g?b=qq&nk=" + qq + "&s=100";
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
    while (logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
  }

  /* —— 玩家列表 —— */
  function renderPlayers() {
    countEl.textContent = players.length;
    playerListEl.innerHTML = players
      .map((p) => {
        const av = p.qq
          ? `<img class="gp-avatar" src="${avatarUrl(p.qq)}" alt="" onerror="this.remove()" />`
          : `<span class="gp-avatar">${esc(p.name.charAt(0))}</span>`;
        const me = p.id === myId ? " (我)" : "";
        const crown = p.id === ownerId ? " 👑" : "";
        const dead = p.alive ? "" : " 💀";
        return `
        <div class="game-player${p.id === myId ? " me" : ""}${p.alive ? "" : " wl-dead"}">
          ${av}
          <span class="gp-name">${esc(p.name)}${me}${crown}${dead}</span>
        </div>`;
      })
      .join("");
  }

  /* —— 开始按钮:仅房主可用 —— */
  function updateStartBtn() {
    if (!startBtn) return;
    if (roomPhase !== "lobby") {
      startBtn.style.display = "none";
      return;
    }
    startBtn.style.display = "";
    const isOwner = myId && myId === ownerId;
    startBtn.disabled = !isOwner;
    startBtn.textContent = isOwner ? "开始游戏" : "等待房主开始…";
  }

  /* —— 阶段倒计时 —— */
  function startCountdown(sec) {
    countdown = sec;
    if (countTimer) clearInterval(countTimer);
    countTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) clearInterval(countTimer);
      updateStage();
    }, 1000);
  }

  function updateStage() {
    const cd = countdown > 0 ? `(${countdown}s)` : "";
    stageEl.textContent = (PHASE_TEXT[roomPhase] || roomPhase) + " " + cd;
    if (roomPhase === "discuss" && lastDeaths.length) {
      stageEl.textContent = `☀️ 昨晚 ${lastDeaths.join("、")} 出局,请讨论 ${cd}`;
    }
    if (roomPhase === "vote") {
      stageEl.textContent = `🗳️ 请投票放逐一名玩家 ${cd}`;
    }
  }

  let lastDeaths = [];
  let acted = false; // 当前阶段是否已行动

  /* —— 行动区 —— */
  function renderAction() {
    actionEl.innerHTML = "";
    acted = false;
    if (!myRole) return;
    const alive = players.filter((p) => p.alive && p.id !== myId);

    function makeButtons(act, label, targets, done) {
      const box = document.createElement("div");
      box.className = "wl-act-group";
      const title = document.createElement("div");
      title.className = "wl-act-label";
      title.textContent = label;
      box.appendChild(title);
      const list = document.createElement("div");
      list.className = "wl-act-list";
      (targets.length ? targets : [{ id: "none", name: "没有可选目标" }]).forEach((t) => {
        const b = document.createElement("button");
        b.className = "wl-act-btn";
        b.textContent = t.name;
        b.disabled = t.id === "none" || acted;
        b.addEventListener("click", () => {
          send({ t: "action", act, target: t.id });
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
      makeButtons("kill", "🐺 选择要刀杀的玩家(狼人可讨论)", alive);
    } else if (roomPhase === "seer" && myRole === "seer") {
      makeButtons("seer", "🔮 选择要查验的玩家", alive);
    } else if (roomPhase === "witch" && myRole === "witch") {
      // 女巫:救 + 毒(各自独立)
      actionEl.appendChild(btnNote("💊 解药:" + (witchSaveLeft ? "可用" : "已用")));
      if (witchSaveLeft) makeButtons("save", "选择要救的玩家", alive);
      actionEl.appendChild(btnNote("☠️ 毒药:" + (witchPoisonLeft ? "可用" : "已用")));
      if (witchPoisonLeft) makeButtons("poison", "选择要毒的玩家", alive);
    } else if (roomPhase === "shoot" && myRole === "hunter") {
      makeButtons("shoot", "🏹 选择要带走的玩家", alive);
    } else if (roomPhase === "vote" && myRole && players.find((p) => p.id === myId)?.alive !== false) {
      makeButtons("vote", "🗳️ 选择要放逐的玩家", alive);
    }
  }

  let witchSaveLeft = true;
  let witchPoisonLeft = true;

  function btnNote(text) {
    const d = document.createElement("div");
    d.className = "wl-act-note";
    d.textContent = text;
    return d;
  }

  /* —— 消息处理 —— */
  function onMessage(data) {
    switch (data.t) {
      case "joined":
        myId = data.id;
        players = data.players || [];
        ownerId = data.ownerId || null;
        lobbyEl.style.display = "none";
        roomEl.style.display = "";
        renderPlayers();
        updateStartBtn();
        updateStage();
        log(`<b>已加入房间</b>,满 ${data.min} 人可开始,上限 ${data.max} 人`, "sys");
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
        log("🐺 游戏开始,角色已分配,请查看你的身份!", "sys");
        break;

      case "role":
        myRole = data.role;
        roleCard.style.display = "";
        roleText.textContent = data.roleName;
        if (data.wolves && data.wolves.length) {
          log(`你的狼队友:${data.wolves.map((w) => esc(w.name)).join("、")} 🐺`, "sys");
        }
        break;

      case "phase":
        roomPhase = data.phase;
        updateStartBtn();
        if (data.night) log(`🌙 第 ${data.night} 夜开始`, "sys");
        startCountdown(data.seconds || 0);
        renderAction();
        if (data.deaths) {
          lastDeaths = data.deaths;
          log(`💀 昨晚出局:${data.deaths.join("、")}`, "sys");
        }
        if (data.hunter) {
          log(`🏹 ${esc(data.hunterName)} 出局,可以开枪带走一人!`, "sys");
        }
        updateStage();
        break;

      case "action-ok":
        log(`✅ 已行动:${data.act}`, "sys");
        break;

      case "seer-result":
        log(`🔮 查验结果:<b>${esc(data.name)}</b> 是 ${data.role === "狼人" ? "🐺 狼人" : "✅ 好人"}`, "ok");
        break;

      case "death":
        lastDeaths = data.deaths || [];
        if (lastDeaths.length) log(`💀 出局:${lastDeaths.map(esc).join("、")}`, "sys");
        else log("🌅 平安夜,无人出局!", "sys");
        break;

      case "shoot-result":
        log(`🏹 ${esc(data.hunter)} 开枪带走了 ${esc(data.target)}!`, "err");
        break;

      case "vote-result":
        if (data.target) {
          log(`🗳️ ${esc(data.targetName)} 被投票放逐!`, "err");
        } else {
          log(`🗳️ ${esc(data.targetName)},无人出局`, "sys");
        }
        break;

      case "chat":
        if (data.wolf) log(`🐺 <b>${esc(data.name)}</b>(狼): ${esc(data.text)}`, "sys");
        else log(`<b>${esc(data.name)}</b>: ${esc(data.text)}`);
        break;

      case "gameover":
        roomPhase = "over";
        updateStage();
        overTitle.textContent = data.winner === "狼人" ? "🐺 狼人阵营胜利!" : "🌟 好人阵营胜利!";
        overRoles.innerHTML = data.roles
          .map((r) => `<div class="game-rank-item">${r.alive ? "🟢" : "💀"} ${esc(r.name)} — ${esc(r.role)}</div>`)
          .join("");
        overOverlay.style.display = "flex";
        log(`🏁 游戏结束,${data.winner}阵营获胜!`, "sys");
        break;

      default:
        break;
    }
  }

  /* —— 加入 —— */
  function join() {
    let name = (nameInput.value || "").trim();
    let qq = "";
    if (window.Account) {
      const u = window.Account.getUser();
      if (u) {
        if (!name) name = u.nickname || "QQ" + maskQQ(u.qq);
        qq = u.qq;
      }
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
    myRole = null;
    roleCard.style.display = "none";
    roomPhase = "lobby";
    updateStartBtn();
    send({ t: "restart" });
  });
  if (overCloseBtn) overCloseBtn.addEventListener("click", () => { overOverlay.style.display = "none"; });

  /* —— 聊天 —— */
  function sendChat() {
    const text = (chatInput.value || "").trim();
    if (!text) return;
    send({ t: "chat", text });
    chatInput.value = "";
  }
  if (chatBtn) chatBtn.addEventListener("click", sendChat);
  if (chatInput) chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

  /* —— 连接 —— */
  function connect() {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws-werewolf");
    ws.onopen = () => {
      lobbyStatus.textContent = "✅ 已连接,请输入昵称加入房间";
    };
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch (err) { /* 忽略 */ }
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
