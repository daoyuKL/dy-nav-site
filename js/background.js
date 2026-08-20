/* ==========================================================================
   《DY导航站》动态壁纸背景
   ==========================================================================
   模式:
     auto   自动:6:00-18:00 播放日间视频,其余播放夜间视频
     day    固定日间视频    night 固定夜间视频
     stars  星空(Canvas)    petals 花瓣(Canvas)    aurora 极光(CSS)
     off    关闭(纯色背景)
   导航栏 🎨 按钮切换,选择保存在 localStorage 中。
   ========================================================================== */

(function () {
  "use strict";

  const layer = document.getElementById("bg-layer");
  if (!layer) return;

  const KEY = "nav-bg-mode";
  const DAY_VIDEO = encodeURI("assets/日间.mp4");
  const NIGHT_VIDEO = encodeURI("assets/夜间.mp4");

  let mode = localStorage.getItem(KEY) || "auto";
  let raf = null;
  let canvas = null;
  let ctx = null;
  let video = null;
  let particles = [];
  let meteors = [];
  let lastMeteorAt = 0;
  let lastSlot = null;

  /* —— 当前是否为暗色主题 —— */
  function themeIsDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  /* —— 当前时段:6-18 点为日间,其余为夜间 —— */
  function hourSlot() {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? "day" : "night";
  }

  /* —— 清空当前模式 —— */
  function clearMode() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    if (video) {
      video.pause();
      video.removeAttribute("src");
      try { video.load(); } catch (e) { /* 忽略 */ }
      video.remove();
      video = null;
    }
    particles = [];
    meteors = [];
    layer.classList.remove("bg-aurora", "bg-video");
    layer.style.background = "";
  }

  /* —— Canvas 通用 —— */
  function setupCanvas() {
    canvas = document.createElement("canvas");
    layer.appendChild(canvas);
    ctx = canvas.getContext("2d");
    fitCanvas();
  }

  function fitCanvas() {
    if (!canvas) return;
    canvas.width = Math.max(1, layer.clientWidth);
    canvas.height = Math.max(1, layer.clientHeight);
    if (mode === "stars") initStars();
    else if (mode === "petals") initPetals();
  }

  window.addEventListener("resize", fitCanvas);

  /* ============ 视频壁纸 ============ */
  function videoSrcForMode() {
    if (mode === "day") return DAY_VIDEO;
    if (mode === "night") return NIGHT_VIDEO;
    return hourSlot() === "day" ? DAY_VIDEO : NIGHT_VIDEO; // auto
  }

  function setupVideo() {
    video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "auto");
    layer.appendChild(video);
    layer.classList.add("bg-video");
    loadVideo(videoSrcForMode());
  }

  function loadVideo(src) {
    if (!video || !src) return;
    if (video.getAttribute("src") === src) return;
    video.setAttribute("src", src);
    video.load();
    const p = video.play();
    if (p && p.catch) p.catch(() => { /* 用户未交互时自动播放被拦,忽略 */ });
  }

  /* 自动模式:每分钟检查一次时段,必要时切换视频 */
  function checkAuto() {
    if (mode !== "auto") return;
    const slot = hourSlot();
    if (slot !== lastSlot) {
      lastSlot = slot;
      loadVideo(videoSrcForMode());
    }
  }
  setInterval(checkAuto, 60000);

  /* ============ 星空模式 ============ */
  function initStars() {
    const area = canvas.width * canvas.height;
    const n = Math.min(220, Math.floor(area / 5500));
    particles = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.3,
      base: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.03 + 0.008,
    }));
  }

  function drawStars(now) {
    const dark = themeIsDark();
    const color = (a) =>
      dark ? `rgba(226, 232, 255, ${a})` : `rgba(70, 82, 130, ${a})`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((s) => {
      const a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(now * s.sp + s.base));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = color(a);
      ctx.fill();
    });

    if (now - lastMeteorAt > 4500 + Math.random() * 4000) {
      lastMeteorAt = now;
      meteors.push({
        x: Math.random() * canvas.width * 0.7 + canvas.width * 0.1,
        y: Math.random() * canvas.height * 0.4,
        vx: 6 + Math.random() * 4,
        vy: 2.5 + Math.random() * 2,
        len: 80 + Math.random() * 60,
        life: 1,
      });
    }
    meteors = meteors.filter((m) => m.life > 0);
    meteors.forEach((m) => {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.02;
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.len, m.y - m.len * 0.45);
      grad.addColorStop(0, color(0.9 * m.life));
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.len, m.y - m.len * 0.45);
      ctx.stroke();
    });

    raf = requestAnimationFrame((t) => drawStars(t));
  }

  /* ============ 花瓣模式 ============ */
  function initPetals() {
    const n = Math.min(38, Math.floor(canvas.width / 28));
    particles = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: 7 + Math.random() * 9,
      speedY: 0.5 + Math.random() * 0.9,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.008 + Math.random() * 0.02,
      swayAmp: 20 + Math.random() * 40,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      hue: 320 + Math.random() * 50,
      alpha: 0.45 + Math.random() * 0.4,
    }));
  }

  function drawPetals(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.y += p.speedY;
      p.sway += p.swaySpeed;
      p.rot += p.rotSpeed;
      p.x += Math.sin(p.sway) * p.swayAmp * 0.02;

      if (p.y > canvas.height + 30) {
        p.y = -30;
        p.x = Math.random() * canvas.width;
      }
      if (p.x > canvas.width + 40) p.x = -40;
      if (p.x < -40) p.x = canvas.width + 40;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = `hsla(${p.hue}, 75%, 78%, 0.9)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    raf = requestAnimationFrame((t) => drawPetals(t));
  }

  /* ============ 极光模式(CSS 动画) ============ */
  function applyAurora() {
    layer.classList.add("bg-aurora");
    layer.style.background = "var(--bg)";
  }

  /* ============ 切换模式 ============ */
  function setMode(m) {
    mode = m;
    localStorage.setItem(KEY, m);
    clearMode();
    layer.style.background = "var(--bg)";

    if (m === "auto") {
      lastSlot = hourSlot();
      setupVideo();
    } else if (m === "day" || m === "night") {
      setupVideo();
    } else if (m === "stars") {
      setupCanvas();
      drawStars(performance.now());
    } else if (m === "petals") {
      setupCanvas();
      drawPetals(performance.now());
    } else if (m === "aurora") {
      applyAurora();
    }
    // off:仅纯色背景
    syncMenu();
  }

  /* ============ 菜单交互 ============ */
  const toggleBtn = document.getElementById("bg-toggle");
  const menu = document.getElementById("bg-menu");

  function syncMenu() {
    if (!menu) return;
    menu.querySelectorAll("[data-bg]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.bg === mode);
    });
  }

  if (toggleBtn && menu) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bg]");
      if (!btn) return;
      setMode(btn.dataset.bg);
      menu.classList.remove("open");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".bg-toggle-wrap")) menu.classList.remove("open");
    });
  }

  /* —— 启动:应用上次保存的模式 —— */
  setMode(mode);
})();
