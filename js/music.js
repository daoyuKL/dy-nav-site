/* ==========================================================================
   《DY导航站》背景音乐播放器(网易云:搜歌曲 / 搜歌单 / 我的歌单 / 随机播放)
   ==========================================================================
   功能:
     1. 右下角悬浮播放器,可拖动位置;
     2. 🔍 搜索网易云歌曲点播(经本站 /api/music/search 代理);
     3. 📚 搜索网易云歌单,点开歌单可看歌曲列表、🎲 随机播放全部;
     4. 👤 粘贴网易云网页版 Cookie 里的 MUSIC_U 登录,查看自己的歌单;
     5. 记住上次播放的歌曲与进度,下次打开页面自动继续播放;
     6. 自动播放被浏览器拦截时,首次点击页面任意位置开始播放。
   ========================================================================== */

(function () {
  "use strict";

  const DEFAULT_SONG = { id: 2129898729, name: "星河不及你", artist: "" };

  /* —— 网易云歌曲直链 —— */
  function srcOf(id) {
    return "https://music.163.com/song/media/outer/url?id=" + id + ".mp3";
  }

  const audio = new Audio();
  audio.preload = "none";

  /* —— 当前歌曲:优先恢复上次记忆,否则用默认曲 —— */
  let track = null;
  try {
    const saved = JSON.parse(localStorage.getItem("mp-song") || "null");
    if (saved && saved.id) {
      track = { id: +saved.id, name: String(saved.name || "未知歌曲"), artist: String(saved.artist || "") };
    }
  } catch (e) { /* 忽略损坏的存储 */ }
  if (!track) track = { ...DEFAULT_SONG };

  /* —— 歌单随机播放队列 —— */
  let queue = null;   // 歌曲数组 [{id,name,artist}]
  let qPos = -1;

  function shuffleArr(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* —— UI 元素(动态创建) —— */
  const player = document.createElement("div");
  player.className = "music-player";
  player.innerHTML = `
    <div class="mp-disc" id="mp-disc">🎵</div>
    <div class="mp-info">
      <div class="mp-name" id="mp-name">加载中…</div>
      <div class="mp-artist" id="mp-artist"></div>
    </div>
    <button class="mp-btn" id="mp-search-btn" title="搜索/歌单/登录">🔍</button>
    <button class="mp-btn" id="mp-next" title="下一首(歌单模式)" style="display:none;">⏭</button>
    <button class="mp-btn mp-play" id="mp-play" title="播放/暂停">▶</button>
    <div class="mp-search-box" id="mp-search-box" style="display:none;">
      <div class="mp-search-tabs">
        <button type="button" class="mp-tab-btn active" data-tab="song">🎵 歌曲</button>
        <button type="button" class="mp-tab-btn" data-tab="playlist">📚 歌单</button>
        <button type="button" class="mp-tab-btn" data-tab="mine">👤 我的</button>
      </div>

      <!-- 歌曲搜索 -->
      <div class="mp-tab-panel" data-panel="song">
        <div class="mp-search-row">
          <input class="mp-search-input" type="text" placeholder="搜索网易云歌曲…" maxlength="50" />
          <button class="mp-search-go" type="button">搜索</button>
        </div>
        <div class="mp-search-status"></div>
        <div class="mp-search-list"></div>
      </div>

      <!-- 歌单搜索 / 歌单详情 -->
      <div class="mp-tab-panel" data-panel="playlist" style="display:none;">
        <div class="mp-search-row">
          <input class="mp-search-input" type="text" placeholder="搜索网易云歌单…" maxlength="50" />
          <button class="mp-search-go" type="button">搜索</button>
        </div>
        <div class="mp-pl-tools">
          <button class="mp-search-go" type="button" id="mp-mine-btn">👤 我的歌单</button>
        </div>
        <div class="mp-search-status"></div>
        <div class="mp-search-list"></div>
        <!-- 歌单详情视图 -->
        <div class="mp-pl-detail" style="display:none;">
          <div class="mp-pl-head">
            <button class="mp-search-go" type="button" id="mp-pl-back">← 返回</button>
            <span class="mp-pl-title" id="mp-pl-title"></span>
          </div>
          <button class="mp-pl-shuffle" type="button" id="mp-pl-shuffle">🎲 随机播放全部</button>
          <div class="mp-pl-songs" id="mp-pl-songs"></div>
        </div>
      </div>

      <!-- 我的(登录 / 我的歌单) -->
      <div class="mp-tab-panel" data-panel="mine" style="display:none;">
        <div class="mp-mine-login" id="mp-mine-login">
          <div class="mp-mine-tip">粘贴网易云网页版的 <b>MUSIC_U</b> 即可登录,查看自己的歌单。</div>
          <details class="mp-mine-help">
            <summary>📖 怎么获取 MUSIC_U?(点击展开)</summary>
            <div class="mp-mine-help-body">
              <div class="mh-step"><b>1.</b> 电脑浏览器打开 <a href="https://music.163.com" target="_blank" rel="noopener">music.163.com</a> 并登录你的网易云账号</div>
              <div class="mh-step"><b>2.</b> 按键盘 <b>F12</b> 打开开发者工具</div>
              <div class="mh-step"><b>3.</b> 顶部选「<b>应用 / Application</b>」,左侧选「<b>Cookies</b>」</div>
              <div class="mh-step"><b>4.</b> 展开 <b>https://music.163.com</b> → 找到 <b>MUSIC_U</b> 那一行</div>
              <div class="mh-step"><b>5.</b> 双击 <b>Value</b> 全选复制整串内容</div>
              <div class="mh-step"><b>6.</b> 粘贴到下面输入框 → 点「登录」</div>
              <div class="mh-warn">⚠️ MUSIC_U 是登录凭证,<b>不要发给陌生人</b>;失效后重新复制一次即可。</div>
            </div>
          </details>
          <textarea class="mp-mine-input" id="mp-mine-musicu" rows="2" placeholder="粘贴 MUSIC_U 值…"></textarea>
          <button class="mp-search-go" type="button" id="mp-mine-login-btn">登录</button>
        </div>
        <div class="mp-mine-user" id="mp-mine-user" style="display:none;">
          <div class="mp-mine-tip" id="mp-mine-nick"></div>
          <button class="mp-search-go" type="button" id="mp-mine-logout-btn">退出登录</button>
        </div>
        <div class="mp-search-status" id="mp-mine-status"></div>
        <div class="mp-search-list" id="mp-mine-list"></div>
      </div>
    </div>`;
  document.body.appendChild(player);

  const disc = player.querySelector("#mp-disc");
  const nameEl = player.querySelector("#mp-name");
  const artistEl = player.querySelector("#mp-artist");
  const playBtn = player.querySelector("#mp-play");
  const nextBtn = player.querySelector("#mp-next");
  const searchBtn = player.querySelector("#mp-search-btn");
  const searchBox = player.querySelector("#mp-search-box");

  /* 自动播放被拦截时的开启按钮 */
  const openBtn = document.createElement("button");
  openBtn.className = "music-open";
  openBtn.id = "music-open";
  openBtn.textContent = "🎵 开启背景音乐";
  document.body.appendChild(openBtn);

  /* —— 状态刷新 —— */
  function updateUI() {
    nameEl.textContent = track.name;
    artistEl.textContent = track.artist;
    playBtn.textContent = audio.paused ? "▶" : "⏸";
    disc.classList.toggle("paused", audio.paused);
    nextBtn.style.display = queue ? "" : "none";
  }

  /* —— 记忆:当前歌曲 + 播放进度(跨页续播) —— */
  const SONG_KEY = "mp-song";
  const STATE_KEY = "mp-state";

  function saveProgress() {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({ id: track.id, t: audio.currentTime || 0, p: !audio.paused })
      );
    } catch (e) { /* 忽略 */ }
  }
  window.addEventListener("pagehide", saveProgress);
  window.addEventListener("beforeunload", saveProgress);

  function restoreProgress() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STATE_KEY) || "null"); } catch (e) { /* 忽略 */ }
    if (!st || !st.id || st.id !== track.id) return;
    const seekTo = function () {
      if (st.t > 1 && audio.duration && st.t < audio.duration - 3) {
        audio.currentTime = st.t;
      }
    };
    if (audio.readyState >= 1) seekTo();
    else audio.addEventListener("loadedmetadata", seekTo, { once: true });
  }

  /* —— 播放当前 track —— */
  function playTrack() {
    audio.src = srcOf(track.id);
    updateUI();
    const pr = audio.play();
    if (pr && pr.catch) {
      pr.then(() => openBtn.classList.remove("show")).catch(() => openBtn.classList.add("show"));
    }
  }

  /* —— 点播单曲:退出歌单队列,记住并播放 —— */
  function setTrack(song) {
    queue = null;
    audio.loop = true;
    track = {
      id: +song.id,
      name: String(song.name || "未知歌曲"),
      artist: String(song.artist || ""),
    };
    try { localStorage.setItem(SONG_KEY, JSON.stringify(track)); } catch (e) { /* 忽略 */ }
    saveProgress();
    playTrack();
  }

  /* —— 歌单随机播放 —— */
  function playListShuffle(songs) {
    queue = songs.filter((s) => s && s.id);
    if (!queue.length) return;
    audio.loop = false;
    queue = shuffleArr(queue);
    qPos = 0;
    playQueueAt(0);
  }

  function playQueueAt(i) {
    if (!queue || !queue.length) return;
    qPos = ((i % queue.length) + queue.length) % queue.length;
    setTrack(queue[qPos]);
    updateUI();
  }

  audio.addEventListener("ended", () => {
    if (queue) playQueueAt(qPos + 1); // 歌单模式自动切下一首
  });

  /* —— 通用 fetch JSON 助手 —— */
  function fetchJSON(url) {
    return fetch(url).then((r) => r.json());
  }

  /* —— 渲染歌单列表 —— */
  function renderPlaylists(listEl, playlists, onClick) {
    listEl.innerHTML = "";
    playlists.forEach((p) => {
      const item = document.createElement("div");
      item.className = "mp-playlist-item";
      item.innerHTML = `
        <img class="mpl-cover" src="${p.cover || ""}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="mpl-info">
          <div class="mpl-name"></div>
          <div class="mpl-meta"></div>
        </div>`;
      item.querySelector(".mpl-name").textContent = p.name;
      item.querySelector(".mpl-meta").textContent =
        (p.trackCount ? p.trackCount + " 首 · " : "") + (p.playCount ? Math.round(p.playCount / 10000) + " 万次播放" : "") + (p.creator ? " · " + p.creator : "");
      item.addEventListener("click", () => onClick(p));
      listEl.appendChild(item);
    });
  }

  /* ==========================================================================
     面板交互
     ========================================================================== */
  const panels = {
    song: searchBox.querySelector('[data-panel="song"]'),
    playlist: searchBox.querySelector('[data-panel="playlist"]'),
    mine: searchBox.querySelector('[data-panel="mine"]'),
  };
  const statusEls = {
    song: panels.song.querySelector(".mp-search-status"),
    playlist: panels.playlist.querySelector(".mp-search-status"),
  };
  const listEls = {
    song: panels.song.querySelector(".mp-search-list"),
    playlist: panels.playlist.querySelector(".mp-search-list"),
  };
  const plDetail = panels.playlist.querySelector(".mp-pl-detail");
  const plTitle = panels.playlist.querySelector("#mp-pl-title");
  const plSongs = panels.playlist.querySelector("#mp-pl-songs");

  /* —— tab 切换 —— */
  let currentTab = "song";
  function switchTab(tab) {
    currentTab = tab;
    searchBox.querySelectorAll(".mp-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    Object.keys(panels).forEach((k) => {
      panels[k].style.display = k === tab ? "" : "none";
    });
    if (tab === "mine") loadMine();
    if (tab === "playlist") showPlaylistSearch();
  }
  searchBox.querySelectorAll(".mp-tab-btn").forEach((b) => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });

  function setStatus(which, text) {
    const el = statusEls[which];
    if (el) el.textContent = text || "";
  }

  /* —— 歌曲搜索 —— */
  const songInput = panels.song.querySelector(".mp-search-input");
  const songGo = panels.song.querySelector(".mp-search-go");
  function searchSongs(kw) {
    setStatus("song", "🔍 搜索中…");
    listEls.song.innerHTML = "";
    fetchJSON("/api/music/search?q=" + encodeURIComponent(kw))
      .then((d) => {
        if (!d.ok) { setStatus("song", d.error || "搜索失败"); return; }
        if (!d.songs || !d.songs.length) { setStatus("song", "没有找到相关歌曲"); return; }
        setStatus("song", "");
        d.songs.forEach((s) => {
          const item = document.createElement("div");
          item.className = "mp-search-item";
          const n = document.createElement("span");
          n.className = "msi-name";
          n.textContent = s.name;
          const a = document.createElement("span");
          a.className = "msi-artist";
          a.textContent = s.artist || "未知歌手";
          item.appendChild(n);
          item.appendChild(a);
          item.title = s.name + " - " + (s.artist || "");
          item.addEventListener("click", () => { setTrack(s); closeSearch(); });
          listEls.song.appendChild(item);
        });
      })
      .catch(() => setStatus("song", "搜索失败,请检查网络"));
  }
  songGo.addEventListener("click", () => { const kw = songInput.value.trim(); if (kw) searchSongs(kw); });
  songInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const kw = songInput.value.trim(); if (kw) searchSongs(kw); } });

  /* —— 歌单搜索 / 详情 —— */
  const plInput = panels.playlist.querySelector(".mp-search-input");
  const plGo = panels.playlist.querySelector(".mp-search-go");
  let currentPlaylist = null; // 当前查看的歌单

  function showPlaylistSearch() {
    plDetail.style.display = "none";
  }

  function searchPlaylists(kw) {
    plDetail.style.display = "none";
    setStatus("playlist", "🔍 搜索中…");
    listEls.playlist.innerHTML = "";
    fetchJSON("/api/netease/search?q=" + encodeURIComponent(kw))
      .then((d) => {
        if (!d.ok) { setStatus("playlist", d.error || "搜索失败"); return; }
        if (!d.playlists || !d.playlists.length) { setStatus("playlist", "没有找到相关歌单"); return; }
        setStatus("playlist", "");
        renderPlaylists(listEls.playlist, d.playlists, openPlaylist);
      })
      .catch(() => setStatus("playlist", "搜索失败,请检查网络"));
  }

  function openPlaylist(p) {
    currentPlaylist = p;
    listEls.playlist.innerHTML = "";
    setStatus("playlist", "");
    plDetail.style.display = "block";
    plTitle.textContent = p.name;
    plSongs.innerHTML = '<div class="mp-pl-loading">加载歌单中…</div>';
    fetchJSON("/api/netease/playlist?id=" + p.id)
      .then((d) => {
        if (!d.ok) { plSongs.innerHTML = '<div class="mp-pl-loading">' + (d.error || "加载失败") + "</div>"; return; }
        const tracks = d.playlist.tracks || [];
        plTitle.textContent = d.playlist.name + "（" + tracks.length + " 首）";
        plSongs.innerHTML = "";
        if (!tracks.length) {
          plSongs.innerHTML = '<div class="mp-pl-loading">歌单暂无歌曲(可能有版权限制)</div>';
          return;
        }
        tracks.forEach((s) => {
          const item = document.createElement("div");
          item.className = "mp-search-item";
          const n = document.createElement("span");
          n.className = "msi-name";
          n.textContent = s.name;
          const a = document.createElement("span");
          a.className = "msi-artist";
          a.textContent = s.artist || "未知歌手";
          item.appendChild(n);
          item.appendChild(a);
          item.title = s.name + " - " + (s.artist || "");
          item.addEventListener("click", () => { setTrack(s); closeSearch(); });
          plSongs.appendChild(item);
        });
      })
      .catch(() => { plSongs.innerHTML = '<div class="mp-pl-loading">加载失败,请检查网络</div>'; });
  }

  panels.playlist.querySelector("#mp-pl-back").addEventListener("click", showPlaylistSearch);
  panels.playlist.querySelector("#mp-pl-shuffle").addEventListener("click", () => {
    if (currentPlaylist) {
      fetchJSON("/api/netease/playlist?id=" + currentPlaylist.id).then((d) => {
        if (d.ok && d.playlist.tracks.length) {
          playListShuffle(d.playlist.tracks);
          closeSearch();
          nameEl.textContent = "🎲 " + track.name;
          artistEl.textContent = "歌单随机播放 · " + (d.playlist.tracks.length) + " 首";
        } else {
          setStatus("playlist", d.error || "歌单暂无歌曲");
        }
      });
    }
  });
  panels.playlist.querySelector("#mp-mine-btn").addEventListener("click", () => {
    switchTab("mine");
    loadMine(true);
  });

  plGo.addEventListener("click", () => { const kw = plInput.value.trim(); if (kw) searchPlaylists(kw); });
  plInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const kw = plInput.value.trim(); if (kw) searchPlaylists(kw); } });

  /* —— 我的歌单 / 登录 —— */
  const mineLoginBox = panels.mine.querySelector("#mp-mine-login");
  const mineUserBox = panels.mine.querySelector("#mp-mine-user");
  const mineNick = panels.mine.querySelector("#mp-mine-nick");
  const mineStatus = panels.mine.querySelector("#mp-mine-status");
  const mineList = panels.mine.querySelector("#mp-mine-list");
  let mineLoaded = false;

  function loadMine(force) {
    if (!force && mineLoaded) return;
    mineLoaded = true;
    fetchJSON("/api/netease/me")
      .then((d) => {
        if (d.loggedIn) {
          mineLoginBox.style.display = "none";
          mineUserBox.style.display = "";
          mineNick.textContent = "👋 " + (d.nickname || "网易云用户") + " 的歌单:";
          loadMineList();
        } else {
          mineUserBox.style.display = "none";
          mineLoginBox.style.display = "";
        }
      })
      .catch(() => { mineStatus.textContent = "网络错误"; });
  }

  function loadMineList() {
    mineStatus.textContent = "加载歌单中…";
    mineList.innerHTML = "";
    fetchJSON("/api/netease/mine")
      .then((d) => {
        if (!d.ok) { mineStatus.textContent = d.error || "加载失败"; return; }
        mineStatus.textContent = "";
        if (!d.playlists.length) {
          mineList.innerHTML = '<div class="mp-pl-loading">还没有歌单</div>';
          return;
        }
        renderPlaylists(mineList, d.playlists, openMinePlaylist);
      })
      .catch(() => { mineStatus.textContent = "加载失败,请检查网络"; });
  }

  function openMinePlaylist(p) {
    switchTab("playlist");
    openPlaylist(p);
  }

  panels.mine.querySelector("#mp-mine-login-btn").addEventListener("click", () => {
    const musicu = panels.mine.querySelector("#mp-mine-musicu").value.trim();
    if (!musicu) { mineStatus.textContent = "请先粘贴 MUSIC_U 值"; return; }
    mineStatus.textContent = "登录中…";
    fetch("/api/netease/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ musicu }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { mineStatus.textContent = d.error || "登录失败"; return; }
        mineStatus.textContent = "";
        mineLoaded = false;
        loadMine(true);
      })
      .catch(() => { mineStatus.textContent = "网络错误,请重试"; });
  });
  panels.mine.querySelector("#mp-mine-logout-btn").addEventListener("click", () => {
    fetch("/api/netease/logout", { method: "POST" }).then(() => {
      mineLoaded = false;
      mineUserBox.style.display = "none";
      mineLoginBox.style.display = "";
      mineStatus.textContent = "";
      mineList.innerHTML = "";
    });
  });

  /* —— 搜索面板开关 —— */
  function openSearch() {
    searchBox.style.display = "flex";
    if (currentTab === "song") panels.song.querySelector(".mp-search-input").focus();
  }
  function closeSearch() {
    searchBox.style.display = "none";
  }
  searchBtn.addEventListener("click", () => {
    if (searchBox.style.display === "none") openSearch();
    else closeSearch();
  });
  document.addEventListener("click", (e) => {
    if (searchBox.style.display !== "none" && !e.target.closest(".mp-search-box") && !e.target.closest("#mp-search-btn")) {
      closeSearch();
    }
  });

  /* —— 播放失败提示 —— */
  audio.addEventListener("error", () => {
    nameEl.textContent = track.name + "(无法播放)";
    openBtn.classList.add("show");
  });

  /* —— 控件事件 —— */
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      const pr = audio.play();
      if (pr && pr.catch) pr.catch(() => openBtn.classList.add("show"));
    } else {
      audio.pause();
    }
    updateUI();
  });

  nextBtn.addEventListener("click", () => {
    if (queue) playQueueAt(qPos + 1);
  });

  openBtn.addEventListener("click", () => {
    const pr = audio.play();
    if (pr && pr.catch) pr.then(() => openBtn.classList.remove("show")).catch(() => {});
    updateUI();
  });

  audio.addEventListener("play", () => { openBtn.classList.remove("show"); updateUI(); });
  audio.addEventListener("pause", updateUI);

  /* —— 播放器拖动(鼠标 + 触屏;搜索面板内不触发拖动) —— */
  const dragState = { on: false, moved: false, sx: 0, sy: 0, lx: 0, ly: 0 };

  try {
    const saved = JSON.parse(localStorage.getItem("mp-pos") || "null");
    if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
      const w = player.offsetWidth;
      const h = player.offsetHeight;
      const left = Math.min(Math.max(saved.left, 4), window.innerWidth - w - 4);
      const top = Math.min(Math.max(saved.top, 4), window.innerHeight - h - 4);
      const inside =
        left >= 0 && top >= 0 && left + w <= window.innerWidth && top + h <= window.innerHeight;
      if (inside) {
        player.style.left = left + "px";
        player.style.top = top + "px";
        player.style.right = "auto";
        player.style.bottom = "auto";
      } else {
        localStorage.removeItem("mp-pos");
      }
    }
  } catch (e) { /* 忽略 */ }

  function dragDown(e) {
    if (e.target.closest("button") || e.target.closest(".mp-search-box")) return;
    const t = e.touches ? e.touches[0] : e;
    dragState.on = true;
    dragState.moved = false;
    dragState.sx = t.clientX;
    dragState.sy = t.clientY;
    const rect = player.getBoundingClientRect();
    if (!player.style.left || player.style.left === "auto") {
      player.style.left = rect.left + "px";
      player.style.top = rect.top + "px";
      player.style.right = "auto";
      player.style.bottom = "auto";
    }
    dragState.lx = parseFloat(player.style.left);
    dragState.ly = parseFloat(player.style.top);
    player.classList.add("dragging");
    if (e.cancelable) e.preventDefault();
  }

  function dragMove(e) {
    if (!dragState.on) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - dragState.sx;
    const dy = t.clientY - dragState.sy;
    if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 5) dragState.moved = true;
    if (!dragState.moved) return;
    const w = player.offsetWidth;
    const h = player.offsetHeight;
    const nx = Math.min(Math.max(dragState.lx + dx, 4), window.innerWidth - w - 4);
    const ny = Math.min(Math.max(dragState.ly + dy, 4), window.innerHeight - h - 4);
    player.style.left = nx + "px";
    player.style.top = ny + "px";
    if (e.cancelable) e.preventDefault();
  }

  function dragUp() {
    if (!dragState.on) return;
    dragState.on = false;
    player.classList.remove("dragging");
    if (dragState.moved) {
      try {
        localStorage.setItem("mp-pos", JSON.stringify({ left: parseFloat(player.style.left), top: parseFloat(player.style.top) }));
      } catch (e) { /* 忽略 */ }
    }
  }

  player.addEventListener("mousedown", dragDown);
  document.addEventListener("mousemove", dragMove);
  document.addEventListener("mouseup", dragUp);
  player.addEventListener("touchstart", dragDown, { passive: false });
  document.addEventListener("touchmove", dragMove, { passive: false });
  document.addEventListener("touchend", dragUp, { passive: false });

  /* —— 启动:自动播放记住的歌曲并跳回上次进度 —— */
  window.addEventListener("load", () => {
    playTrack();
    restoreProgress();
  });

  /* —— 自动播放兜底:首次交互即开始播放 —— */
  function startOnFirstInteract() {
    if (audio.paused) {
      const pr = audio.play();
      if (pr && pr.catch) pr.then(() => openBtn.classList.remove("show")).catch(() => {});
      updateUI();
    }
    ["click", "touchstart", "keydown"].forEach((ev) =>
      document.removeEventListener(ev, startOnFirstInteract)
    );
  }
  ["click", "touchstart", "keydown"].forEach((ev) =>
    document.addEventListener(ev, startOnFirstInteract)
  );
})();
