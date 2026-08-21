/* ==========================================================================
   《DY导航站》一起听(在线同步听歌 · WebSocket)
   ==========================================================================
   功能:
     - 播放器右下角 🎧 按钮打开面板;面板可拖拽缩放(resize)、最小化/关闭
     - 创建/加入 4 位房间号;房主 = DJ,控制 播放/暂停/下一首/跳转
     - 所有成员可搜索推荐歌曲加入播放列表(不打断当前播放,一首接一首轮播)
     - DJ 每 5 秒上报播放位置,其他成员自动同步(漂移 >3 秒自动纠正)
   依赖:music.js 暴露的 window.MusicAPI
   注意:本文件为 ES5(兼容老手机 WebView)
   ========================================================================== */

(function () {
  "use strict";

  var ws = null;
  var roomCode = null;
  var myId = null;
  var djId = null;     // 当前 DJ(房主)
  var isDj = false;
  var joined = false;
  var players = [];
  var queue = [];
  var current = null;
  var playing = false;
  var posTimer = null; // DJ 位置上报定时器
  var lastSkipAt = 0;  // 自动跳歌防抖
  var panel = null;
  var panelOpen = false;
  var minimized = false;
  var searchLock = false;
  var leaving = false;

  /* 稳定身份:同一浏览器重复进入用同一 cid,服务器据此顶掉旧连接,不留"死人" */
  var cid = "";
  try {
    cid = localStorage.getItem("lt-cid") || ("lt" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("lt-cid", cid);
  } catch (e) { cid = ""; }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }
  function M() { return window.MusicAPI; }

  /* ==========================================================================
     面板
     ========================================================================== */

  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "lt-panel";
    panel.id = "lt-panel";
    panel.innerHTML =
      '<div class="lt-head">' +
        '<span class="lt-title">🎧 一起听</span>' +
        '<span class="lt-code" id="lt-code"></span>' +
        '<span class="lt-head-btns">' +
          '<button type="button" class="lt-hbtn" id="lt-min" title="最小化/还原">—</button>' +
          '<button type="button" class="lt-hbtn" id="lt-close" title="关闭">✕</button>' +
        "</span>" +
      "</div>" +
      '<div class="lt-body" id="lt-body">' +
        /* —— 未加入视图:系统房间列表 —— */
        '<div class="lt-lobby" id="lt-lobby">' +
          '<p class="lt-tip">系统常驻 5 个房间,选择一间加入,和大家同步听歌。</p>' +
          '<div class="lt-roomlist" id="lt-roomlist"><div class="lt-status">加载房间中…</div></div>' +
          '<div class="lt-join-row">' +
            '<input class="lt-input" id="lt-room-input" type="text" maxlength="4" placeholder="或输入房间号" autocomplete="off" />' +
            '<button type="button" class="lt-btn" id="lt-join">🔑 加入</button>' +
          "</div>" +
          '<div class="lt-status" id="lt-status"></div>' +
        "</div>" +
        /* —— 房间视图 —— */
        '<div class="lt-room" id="lt-room" style="display:none;">' +
          '<div class="lt-members" id="lt-members"></div>' +
          '<div class="lt-now" id="lt-now"></div>' +
          '<div class="lt-queue-title">📜 播放列表(<span id="lt-qcount">0</span>)</div>' +
          '<div class="lt-queue" id="lt-queue"></div>' +
          '<div class="lt-rec">' +
            '<input class="lt-input" id="lt-rec-input" type="text" maxlength="50" placeholder="搜索网易云歌曲推荐到列表…" autocomplete="off" />' +
            '<button type="button" class="lt-btn" id="lt-rec-btn">🔍</button>' +
          "</div>" +
          '<div class="lt-rec-results" id="lt-rec-results"></div>' +
          '<div class="lt-dj" id="lt-dj" style="display:none;">' +
            '<button type="button" class="lt-btn" id="lt-playbtn">⏯ 播放/暂停</button>' +
            '<button type="button" class="lt-btn" id="lt-next">⏭ 下一首</button>' +
          "</div>" +
          '<div class="lt-leave"><button type="button" class="lt-btn lt-leave-btn" id="lt-leave">🚪 离开房间</button></div>' +
        "</div>" +
      "</div>";
    document.body.appendChild(panel);

    $("lt-close").addEventListener("click", function () { toggle(); });
    $("lt-min").addEventListener("click", function () {
      minimized = !minimized;
      var body = $("lt-body");
      var min = $("lt-min");
      if (body) body.style.display = minimized ? "none" : "";
      if (min) min.textContent = minimized ? "＋" : "—";
    });
    $("lt-join").addEventListener("click", joinRoom);
    var ri = $("lt-room-input");
    if (ri) ri.addEventListener("keydown", function (e) { if (e.key === "Enter") joinRoom(); });
    $("lt-rec-btn").addEventListener("click", doSearch);
    var recIn = $("lt-rec-input");
    if (recIn) recIn.addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });
    $("lt-playbtn").addEventListener("click", togglePlay);
    $("lt-next").addEventListener("click", function () { send({ t: "dj-next" }); });
    $("lt-leave").addEventListener("click", leaveRoom);
    return panel;
  }

  function toggle() {
    buildPanel();
    panelOpen = !panelOpen;
    panel.style.display = panelOpen ? "" : "none";
    if (panelOpen) {
      if (!minimized) $("lt-body").style.display = "";
      if (!joined) {
        loadRoomList();
        if (!listTimer) listTimer = setInterval(loadRoomList, 5000);
      }
    } else {
      if (listTimer) { clearInterval(listTimer); listTimer = null; }
    }
  }

  /* ==========================================================================
     房间操作
     ========================================================================== */

  function status(text) {
    var el = $("lt-status");
    if (el) el.textContent = text;
  }

  function defaultName() {
    if (window.Account) {
      var u = window.Account.getUser();
      if (u && u.nickname) return u.nickname;
    }
    return "";
  }

  var listTimer = null; // 房间列表自动刷新

  function loadRoomList() {
    if (!panelOpen || joined) return;
    fetch("/api/room?game=ws-music&list=1")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var box = $("lt-roomlist");
        if (!box) return;
        if (!d || !d.ok) {
          box.innerHTML = '<div class="lt-status">⚠️ 加载失败,请确认服务端已更新</div>';
          return;
        }
        var rooms = d.rooms || [];
        if (!rooms.length) {
          box.innerHTML = '<div class="lt-status">暂无房间</div>';
          return;
        }
        box.innerHTML = rooms.map(function (r) {
          var now = r.current ? "🎵 " + esc(r.current) : "📭 空闲";
          return '<div class="lt-room-item" data-code="' + r.code + '">' +
            '<span class="lt-room-code">' + r.code + "</span>" +
            '<span class="lt-room-now">' + now + "</span>" +
            '<span class="lt-room-num">' + r.players + " 人</span>" +
            "</div>";
        }).join("");
        var items = box.querySelectorAll(".lt-room-item");
        for (var i = 0; i < items.length; i++) {
          (function (it) {
            it.addEventListener("click", function () {
              joinCode(it.getAttribute("data-code"));
            });
          })(items[i]);
        }
      })
      .catch(function () {
        var box = $("lt-roomlist");
        if (box) box.innerHTML = '<div class="lt-status">⚠️ 加载失败,请检查网络</div>';
      });
  }

  function joinCode(code) {
    if (!code) return;
    if (ws && ws.readyState !== WebSocket.CLOSED) { status("已在房间中"); return; }
    fetch("/api/room?game=ws-music&code=" + encodeURIComponent(code))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.exists) { status("❌ 房间 " + code + " 不存在"); return; }
        roomCode = code;
        status("🔑 正在加入房间 " + code + " …");
        connect(code);
      })
      .catch(function () { status("⚠️ 加入失败,请确认服务端已更新"); });
  }

  function joinRoom() {
    var input = $("lt-room-input");
    if (!input) return;
    var code = input.value.trim().toUpperCase();
    if (code.length < 4) { status("请输入 4 位房间号"); return; }
    joinCode(code);
  }

  function connect(code) {
    /* 先关掉旧连接,避免重复进入叠出多个玩家 */
    if (ws) {
      try { ws.onclose = null; ws.close(); } catch (e) { /* 忽略 */ }
      ws = null;
    }
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws-music?room=" + code);
    ws.onopen = function () {
      var name = defaultName() || "听众";
      var qq = "";
      if (window.Account && window.Account.getUser()) qq = window.Account.getUser().qq || "";
      send({ t: "join", name: name, qq: qq, cid: cid });
    };
    ws.onmessage = function (e) {
      try { onMessage(JSON.parse(e.data)); } catch (err) { /* 忽略坏消息 */ }
    };
    ws.onclose = function () {
      if (joined && !leaving) {
        /* 页面跳转/断线:不弹窗,稍后自动重连回房间 */
        joined = false;
        isDj = false;
        var rc = roomCode;
        setTimeout(function () {
          if (!leaving && rc) joinCode(rc);
        }, 1200);
      } else if (!joined) {
        status("⚠️ 连接失败,房间可能已解散,请重新选择房间");
      }
    };
    ws.onerror = function () { /* onclose 处理 */ };
  }

  function leaveRoom() {
    leaving = true;
    joined = false;
    isDj = false;
    if (posTimer) { clearInterval(posTimer); posTimer = null; }
    if (M() && M().stop) M().stop();
    if (M() && M().setRoomMode) M().setRoomMode(false);
    if (ws) { try { ws.close(); } catch (e) { /* 忽略 */ } }
    ws = null;
    roomCode = null;
    players = [];
    queue = [];
    current = null;
    playing = false;
    /* 退出房间后不再自动回来 */
    try { localStorage.removeItem("lt-active-room"); } catch (e) { /* 忽略 */ }
    renderLobby();
    status("已离开房间");
    /* 回到大厅:恢复房间列表刷新 */
    if (listTimer) { clearInterval(listTimer); listTimer = null; }
    if (panelOpen) {
      loadRoomList();
      listTimer = setInterval(loadRoomList, 5000);
    }
  }

  /* ==========================================================================
     消息处理
     ========================================================================== */

  function onMessage(d) {
    switch (d.t) {
      case "joined":
        myId = d.id;
        djId = d.djId;
        isDj = d.djId === myId;
        joined = true;
        players = d.players || [];
        queue = d.queue || [];
        current = d.current || null;
        playing = !!d.playing;
        /* 记住当前房间:跳转页面后自动回来 */
        try { localStorage.setItem("lt-active-room", roomCode || ""); } catch (e) { /* 忽略 */ }
        buildPanel();
        renderRoom();
        $("lt-lobby").style.display = "none";
        $("lt-room").style.display = "";
        if (M() && M().setRoomMode) M().setRoomMode(true);
        if (isDj) startDjSync();
        if (current) {
          M().playSong(current.id, current.name, current.artist);
          if (!playing) M().pause();
          /* 中途进入/跳页回来:对齐播放位置 */
          if (d.position > 0) M().seek(d.position);
        }
        break;

      case "state":
        players = d.players || [];
        queue = d.queue || [];
        djId = d.djId || djId;
        var wasDj = isDj;
        isDj = d.djId === myId;
        if (isDj && !wasDj) startDjSync();
        renderRoom();
        break;

      case "song":
        current = d.song || null;
        playing = !!d.playing;
        if (current) {
          M().playSong(current.id, current.name, current.artist);
          if (!playing) M().pause();
        } else {
          if (M() && M().stop) M().stop();
        }
        renderRoom();
        break;

      case "queue":
        /* 播放推进后同步最新列表(播完的歌从列表消失) */
        queue = d.queue || [];
        renderRoom();
        break;

      case "play-state":
        playing = !!d.playing;
        if (!isDj) {
          if (playing) {
            if (M().isPaused()) M().play();
            if (Math.abs(M().getPos() - (d.position || 0)) > 3) M().seek(d.position || 0);
          } else {
            if (!M().isPaused()) M().pause();
          }
        }
        renderRoom();
        break;

      case "pos-sync":
        if (!isDj && playing) {
          var p = d.position || 0;
          if (Math.abs(M().getPos() - p) > 3) M().seek(p);
        }
        break;

      case "system":
        toast(d.text);
        break;

      case "full":
        status(d.error || "房间已满");
        break;

      default:
        break;
    }
  }

  /* —— DJ:位置上报 + 歌曲结束推进 + VIP/版权歌自动跳过 —— */
  function startDjSync() {
    if (posTimer) clearInterval(posTimer);
    if (M() && M().onEnded) M().onEnded(function () {
      if (isDj && joined) send({ t: "song-end" });
    });
    if (M() && M().onError) M().onError(function () {
      /* 当前歌曲无法播放(常见于未登录听 VIP/版权受限),自动跳下一首,5 秒防抖 */
      if (isDj && joined) {
        var now = Date.now();
        if (now - lastSkipAt < 5000) return;
        lastSkipAt = now;
        toast("⚠️ 当前歌曲无法播放(VIP/版权限制),已自动跳过");
        send({ t: "song-end" });
      }
    });
    posTimer = setInterval(function () {
      if (isDj && joined && playing && M()) {
        send({ t: "dj-pos", position: Math.floor(M().getPos()) });
      }
    }, 5000);
  }

  function togglePlay() {
    if (!isDj) return;
    if (M().isPaused()) {
      M().play();
      send({ t: "dj-play" });
    } else {
      M().pause();
      send({ t: "dj-pause" });
    }
  }

  /* ==========================================================================
     推荐搜索
     ========================================================================== */

  function doSearch() {
    var input = $("lt-rec-input");
    var kw = input ? input.value.trim() : "";
    if (!kw || searchLock) return;
    searchLock = true;
    var box = $("lt-rec-results");
    box.innerHTML = '<div class="lt-status">🔍 搜索中…</div>';
    fetch("/api/music/search?q=" + encodeURIComponent(kw))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        searchLock = false;
        if (!d.ok) { box.innerHTML = '<div class="lt-status">' + esc(d.error || "搜索失败") + "</div>"; return; }
        if (!d.songs || !d.songs.length) { box.innerHTML = '<div class="lt-status">没有找到相关歌曲</div>'; return; }
        box.innerHTML = "";
        d.songs.slice(0, 10).forEach(function (s) {
          var item = document.createElement("div");
          item.className = "lt-rec-item";
          item.innerHTML = "<b>" + esc(s.name) + "</b><span>" + esc(s.artist || "未知歌手") + "</span>";
          item.addEventListener("click", function () {
            send({ t: "rec", id: s.id, name: s.name, artist: s.artist || "" });
            box.innerHTML = '<div class="lt-status">✅ 已推荐《' + esc(s.name) + "》,加入播放列表</div>";
          });
          box.appendChild(item);
        });
      })
      .catch(function () {
        searchLock = false;
        box.innerHTML = '<div class="lt-status">搜索失败,请检查网络</div>';
      });
  }

  /* ==========================================================================
     渲染
     ========================================================================== */

  function renderLobby() {
    var lobby = $("lt-lobby");
    var roomEl = $("lt-room");
    if (lobby) lobby.style.display = "";
    if (roomEl) roomEl.style.display = "none";
    var code = $("lt-code");
    if (code) code.textContent = "";
  }

  function renderRoom() {
    var code = $("lt-code");
    if (code) code.textContent = roomCode ? "房间 " + roomCode : "";
    var members = $("lt-members");
    if (members) {
      members.innerHTML = players.map(function (p) {
        return '<span class="lt-member' + (p.id === myId ? " me" : "") + '">' + esc(p.name) +
          (p.id === myId ? "(我)" : "") + (p.id === djId ? " 🎧" : "") + "</span>";
      }).join("");
    }
    var now = $("lt-now");
    if (now) {
      if (current) {
        now.innerHTML = "<div class=\"lt-now-label\">▶ 正在播放</div><div class=\"lt-now-song\">" + esc(current.name) +
          (current.artist ? "<span>" + esc(current.artist) + "</span>" : "") +
          (current.by ? "<em>由 " + esc(current.by) + " 推荐</em>" : "") + "</div>";
      } else {
        now.innerHTML = '<div class="lt-now-empty">📭 还没有播放,推荐一首吧</div>';
      }
    }
    var qcount = $("lt-qcount");
    if (qcount) qcount.textContent = queue.length;
    var qbox = $("lt-queue");
    if (qbox) {
      qbox.innerHTML = queue.length ? queue.map(function (s, i) {
        return '<div class="lt-qitem"><span class="lt-qidx">' + (i + 1) + "</span><span class=\"lt-qname\">" +
          esc(s.name) + "</span><span class=\"lt-qby\">" + esc(s.by || "") + "</span></div>";
      }).join("") : '<div class="lt-status">列表为空,搜索推荐一首吧</div>';
    }
  var dj = $("lt-dj");
  if (dj) dj.style.display = isDj ? "" : "none";
  }

  /* —— 轻提示 —— */
  var toastTimer = null;
  function toast(text) {
    buildPanel();
    var t = document.createElement("div");
    t.className = "lt-toast";
    t.textContent = text;
    panel.appendChild(t);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      var list = panel.querySelectorAll(".lt-toast");
      for (var i = 0; i < list.length; i++) list[i].remove();
    }, 3500);
  }

  /* ==========================================================================
     入口
     ========================================================================== */

  window.ListenTogether = {
    toggle: toggle,
    isOpen: function () { return panelOpen; }
  };

  /* 🎧 按钮绑定(由 music.js 创建) */
  function bindBtn() {
    var btn = document.getElementById("mp-listen");
    if (btn) {
      btn.addEventListener("click", toggle);
      return;
    }
    setTimeout(bindBtn, 500);
  }
  bindBtn();

  /* —— 自动回到上次的房间:跳转站内其他页面后不掉出一起听 —— */
  (function autoRejoin() {
    var saved = null;
    try { saved = localStorage.getItem("lt-active-room"); } catch (e) { /* 忽略 */ }
    if (!saved) return;
    setTimeout(function () {
      /* 打开面板,展示房间状态 */
      panelOpen = true;
      buildPanel();
      panel.style.display = "";
      joinCode(saved);
    }, 600);
  })();
})();
