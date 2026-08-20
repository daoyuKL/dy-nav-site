/* ==========================================================================
   《DY导航站》背景音乐播放器
   ==========================================================================
   来源:网易云音乐单曲 2129898729《星河不及你》
   功能:页面打开后自动播放单曲循环;右下角悬浮控件可
        播放/暂停,并可拖动位置。
   说明:页面加载后立即尝试自动播放;若被浏览器策略拦截,
        用户第一次点击/触摸页面任意位置时自动开始播放。
   ========================================================================== */

(function () {
  "use strict";

  /* —— 歌单数据(网易云单曲 2129898729《星河不及你》) —— */
  const PLAYLIST = [
    { id: 2129898729, name: "星河不及你", artist: "" },
  ];

  /* —— 网易云歌曲直链 —— */
  function srcOf(id) {
    return "https://music.163.com/song/media/outer/url?id=" + id + ".mp3";
  }

  const audio = new Audio();
  audio.preload = "none";

  let order = [];      // 当前播放顺序(PLAYLIST 索引)
  let pos = -1;        // 当前在 order 中的位置
  let shuffle = true;  // 默认随机播放

  /* —— 洗牌 —— */
  function shuffleArr(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildOrder() {
    const idx = PLAYLIST.map((_, i) => i);
    return shuffle ? shuffleArr(idx) : idx;
  }

  function current() {
    return PLAYLIST[order[pos]];
  }

  /* —— UI 元素(动态创建) —— */
  const player = document.createElement("div");
  player.className = "music-player";
  player.innerHTML = `
    <div class="mp-disc" id="mp-disc">🎵</div>
    <div class="mp-info">
      <div class="mp-name" id="mp-name">正在加载歌单…</div>
      <div class="mp-artist" id="mp-artist"></div>
    </div>
    <button class="mp-btn" id="mp-shuffle" title="随机/顺序播放">🔀</button>
    <button class="mp-btn" id="mp-prev" title="上一首">⏮</button>
    <button class="mp-btn mp-play" id="mp-play" title="播放/暂停">▶</button>
    <button class="mp-btn" id="mp-next" title="下一首">⏭</button>`;
  document.body.appendChild(player);

  const disc = player.querySelector("#mp-disc");
  const nameEl = player.querySelector("#mp-name");
  const artistEl = player.querySelector("#mp-artist");
  const playBtn = player.querySelector("#mp-play");
  const shuffleBtn = player.querySelector("#mp-shuffle");

  /* 自动播放被拦截时的开启按钮 */
  const openBtn = document.createElement("button");
  openBtn.className = "music-open";
  openBtn.id = "music-open";
  openBtn.textContent = "🎵 开启背景音乐";
  document.body.appendChild(openBtn);

  /* —— 单曲模式:隐藏随机/切歌按钮,改为单曲循环 —— */
  if (PLAYLIST.length === 1) {
    shuffleBtn.style.display = "none";
    player.querySelector("#mp-prev").style.display = "none";
    player.querySelector("#mp-next").style.display = "none";
    audio.loop = true;
  }

  /* —— 状态刷新 —— */
  function updateUI() {
    if (!PLAYLIST.length) return;
    const track = current();
    nameEl.textContent = track.name;
    artistEl.textContent = track.artist;
    playBtn.textContent = audio.paused ? "▶" : "⏸";
    disc.classList.toggle("paused", audio.paused);
    shuffleBtn.classList.toggle("active", shuffle);
  }

  /* —— 跨页面续播:切换页面时保存/恢复播放进度 —— */
  const STATE_KEY = "mp-state";
  let restored = false; // 每次页面加载只恢复一次

  function savePlayState() {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          id: current() ? current().id : null,
          t: audio.currentTime || 0,
          p: !audio.paused,
        })
      );
    } catch (e) { /* 忽略 */ }
  }
  window.addEventListener("pagehide", savePlayState);
  window.addEventListener("beforeunload", savePlayState);

  /* 新页面加载后:把歌曲跳回上次的位置继续播。
     返回 true 表示上次是暂停状态,本次不应自动播放 */
  function tryRestoreState() {
    if (restored) return false;
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STATE_KEY) || "null"); } catch (e) { /* 忽略 */ }
    if (!st || !st.id || st.id !== current().id) return false;
    restored = true;
    const seekTo = function () {
      // 接近结尾则从头播(剩余过短无续播意义)
      if (st.t > 1 && audio.duration && st.t < audio.duration - 3) {
        audio.currentTime = st.t;
      }
    };
    if (audio.readyState >= 1) seekTo();
    else audio.addEventListener("loadedmetadata", seekTo, { once: true });
    return st.p === false; // 上次是暂停 → 本次保持暂停
  }

  /* —— 播放指定位置 —— */
  function playIndex(p) {
    const n = order.length;
    if (!n) return;
    pos = ((p % n) + n) % n;
    audio.src = srcOf(current().id);
    if (tryRestoreState()) { // 上次是暂停状态,保持暂停不自动播放
      updateUI();
      return;
    }
    const pr = audio.play();
    if (pr && pr.catch) {
      pr.then(() => openBtn.classList.remove("show")).catch(() => openBtn.classList.add("show"));
    }
    updateUI();
  }

  function next() {
    // 随机模式下,一轮播完重新洗牌
    if (shuffle && pos >= order.length - 1) {
      order = buildOrder();
      pos = -1;
    }
    playIndex(pos + 1);
  }

  function prev() {
    if (shuffle && pos <= 0) {
      order = buildOrder();
      pos = order.length;
    }
    playIndex(pos - 1);
  }

  /* —— 自动切歌 —— */
  audio.addEventListener("ended", next);
  audio.addEventListener("error", () => setTimeout(next, 800)); // 单曲失效自动跳过

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

  player.querySelector("#mp-next").addEventListener("click", next);
  player.querySelector("#mp-prev").addEventListener("click", prev);

  shuffleBtn.addEventListener("click", () => {
    shuffle = !shuffle;
    const t = current();
    order = buildOrder();
    pos = order.indexOf(PLAYLIST.indexOf(t));
    shuffleBtn.classList.toggle("active", shuffle);
  });

  openBtn.addEventListener("click", () => {
    const pr = audio.play();
    if (pr && pr.catch) pr.then(() => openBtn.classList.remove("show")).catch(() => {});
    updateUI();
  });

  /* —— 播放器拖动(鼠标 + 触屏) —— */
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
    if (e.target.closest("button")) return; // 点击按钮不触发拖动
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

  audio.addEventListener("play", () => { openBtn.classList.remove("show"); updateUI(); });
  audio.addEventListener("pause", updateUI);

  /* —— 启动:进入页面即尝试自动播放 —— */
  window.addEventListener("load", () => {
    order = buildOrder();
    playIndex(0);
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
