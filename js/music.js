/* ==========================================================================
   《DY导航站》背景音乐播放器(网易云搜索点播)
   ==========================================================================
   功能:
     1. 右下角悬浮播放器,可拖动位置;
     2. 🔍 搜索网易云歌曲(经本站服务器 /api/music/search 代理),点击即播放;
     3. 记住上次播放的歌曲与进度(localStorage),下次打开页面自动继续播放;
     4. 页面加载后立即尝试自动播放;被浏览器拦截时,
        用户第一次点击/触摸页面任意位置自动开始播放。
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
  audio.loop = true; // 单曲循环(点播模式)

  /* —— 当前歌曲:优先恢复上次记忆,否则用默认曲 —— */
  let track = null;
  try {
    const saved = JSON.parse(localStorage.getItem("mp-song") || "null");
    if (saved && saved.id) {
      track = {
        id: +saved.id,
        name: String(saved.name || "未知歌曲"),
        artist: String(saved.artist || ""),
      };
    }
  } catch (e) { /* 忽略损坏的存储 */ }
  if (!track) track = { ...DEFAULT_SONG };

  /* —— UI 元素(动态创建) —— */
  const player = document.createElement("div");
  player.className = "music-player";
  player.innerHTML = `
    <div class="mp-disc" id="mp-disc">🎵</div>
    <div class="mp-info">
      <div class="mp-name" id="mp-name">加载中…</div>
      <div class="mp-artist" id="mp-artist"></div>
    </div>
    <button class="mp-btn" id="mp-search-btn" title="搜索网易云歌曲">🔍</button>
    <button class="mp-btn mp-play" id="mp-play" title="播放/暂停">▶</button>
    <div class="mp-search-box" id="mp-search-box" style="display:none;">
      <div class="mp-search-row">
        <input class="mp-search-input" id="mp-search-input" type="text" placeholder="搜索网易云歌曲…" autocomplete="off" maxlength="50" />
        <button class="mp-search-go" id="mp-search-go" type="button">搜索</button>
      </div>
      <div class="mp-search-status" id="mp-search-status"></div>
      <div class="mp-search-list" id="mp-search-list"></div>
    </div>`;
  document.body.appendChild(player);

  const disc = player.querySelector("#mp-disc");
  const nameEl = player.querySelector("#mp-name");
  const artistEl = player.querySelector("#mp-artist");
  const playBtn = player.querySelector("#mp-play");
  const searchBtn = player.querySelector("#mp-search-btn");
  const searchBox = player.querySelector("#mp-search-box");
  const searchInput = player.querySelector("#mp-search-input");
  const searchGo = player.querySelector("#mp-search-go");
  const searchStatus = player.querySelector("#mp-search-status");
  const searchList = player.querySelector("#mp-search-list");

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

  /* 新页面加载后:把播放进度跳回上次的位置继续播 */
  function restoreProgress() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STATE_KEY) || "null"); } catch (e) { /* 忽略 */ }
    if (!st || !st.id || st.id !== track.id) return;
    const seekTo = function () {
      // 接近结尾则从头播(剩余过短无续播意义)
      if (st.t > 1 && audio.duration && st.t < audio.duration - 3) {
        audio.currentTime = st.t;
      }
    };
    if (audio.readyState >= 1) seekTo();
    else audio.addEventListener("loadedmetadata", seekTo, { once: true });
  }

  /* —— 播放当前 track(自动尝试播放,被拦截时提示) —— */
  function playTrack() {
    audio.src = srcOf(track.id);
    updateUI();
    const pr = audio.play();
    if (pr && pr.catch) {
      pr.then(() => openBtn.classList.remove("show")).catch(() => openBtn.classList.add("show"));
    }
  }

  /* —— 点播新歌:记住并立即播放 —— */
  function setTrack(song) {
    track = {
      id: +song.id,
      name: String(song.name || "未知歌曲"),
      artist: String(song.artist || ""),
    };
    try { localStorage.setItem(SONG_KEY, JSON.stringify(track)); } catch (e) { /* 忽略 */ }
    saveProgress(); // 新歌从头播,清掉旧进度
    playTrack();
  }

  /* —— 搜索网易云 —— */
  function doSearch(kw) {
    searchStatus.textContent = "🔍 搜索中…";
    searchList.innerHTML = "";
    fetch("/api/music/search?q=" + encodeURIComponent(kw))
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok || !d.songs || !d.songs.length) {
          searchStatus.textContent = "没有找到相关歌曲,换个关键词试试";
          return;
        }
        searchStatus.textContent = "";
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
          item.addEventListener("click", () => {
            setTrack(s);
            closeSearch();
          });
          searchList.appendChild(item);
        });
      })
      .catch(() => {
        searchStatus.textContent = "搜索失败,请稍后再试";
      });
  }

  /* —— 搜索面板开关 —— */
  function openSearch() {
    searchBox.style.display = "flex";
    searchInput.focus();
  }
  function closeSearch() {
    searchBox.style.display = "none";
  }
  searchBtn.addEventListener("click", () => {
    if (searchBox.style.display === "none") openSearch();
    else closeSearch();
  });
  searchGo.addEventListener("click", () => {
    const kw = searchInput.value.trim();
    if (kw) doSearch(kw);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const kw = searchInput.value.trim();
      if (kw) doSearch(kw);
    }
  });
  /* 点击面板外部关闭搜索 */
  document.addEventListener("click", (e) => {
    if (searchBox.style.display !== "none" && !e.target.closest(".mp-search-box") && !e.target.closest("#mp-search-btn")) {
      closeSearch();
    }
  });

  /* —— 播放失败提示(单曲直链偶发失效) —— */
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

  openBtn.addEventListener("click", () => {
    const pr = audio.play();
    if (pr && pr.catch) pr.then(() => openBtn.classList.remove("show")).catch(() => {});
    updateUI();
  });

  audio.addEventListener("play", () => { openBtn.classList.remove("show"); updateUI(); });
  audio.addEventListener("pause", updateUI);

  /* —— 播放器拖动(鼠标 + 触屏;搜索面板内不触发拖动) —— */
  const dragState = { on: false, moved: false, sx: 0, sy: 0, lx: 0, ly: 0 };

  // 恢复上次拖动后的位置(自动限制在视口内,
  // 若保存的位置已跑到屏幕外(如窗口变小),则丢弃记忆回到默认右下角)
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
        localStorage.removeItem("mp-pos"); // 位置已失效,回到默认位置
      }
    }
  } catch (e) { /* 忽略损坏的存储 */ }

  function dragDown(e) {
    if (e.target.closest("button") || e.target.closest(".mp-search-box")) return; // 按钮/搜索面板不触发拖动
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
        localStorage.setItem(
          "mp-pos",
          JSON.stringify({
            left: parseFloat(player.style.left),
            top: parseFloat(player.style.top),
          })
        );
      } catch (e) { /* 忽略 */ }
    }
  }

  player.addEventListener("mousedown", dragDown);
  document.addEventListener("mousemove", dragMove);
  document.addEventListener("mouseup", dragUp);
  player.addEventListener("touchstart", dragDown, { passive: false });
  document.addEventListener("touchmove", dragMove, { passive: false });
  document.addEventListener("touchend", dragUp, { passive: false });

  /* —— 启动:进入页面即自动播放记住的歌曲,并跳回上次进度 —— */
  window.addEventListener("load", () => {
    playTrack();
    restoreProgress();
  });

  /* —— 自动播放兜底:首次交互(点击/触摸/按键)即开始播放 —— */
  // 浏览器禁止无用户交互的自动出声,此监听让用户第一次点击页面时立即听到音乐
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
