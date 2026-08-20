(function () {
  "use strict";

  var layer = document.getElementById("bg-layer");
  if (!layer) return;
  var KEY = "nav-bg-mode";
  var DAY_VIDEO = encodeURI("assets/\u65E5\u95F4.mp4");
  var NIGHT_VIDEO = encodeURI("assets/\u591C\u95F4.mp4");
  var mode = localStorage.getItem(KEY) || "auto";
  var raf = null;
  var canvas = null;
  var ctx = null;
  var video = null;
  var particles = [];
  var meteors = [];
  var lastMeteorAt = 0;
  var lastSlot = null;
  function themeIsDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function hourSlot() {
    var h = (/* @__PURE__ */new Date()).getHours();
    return h >= 6 && h < 18 ? "day" : "night";
  }
  function clearMode() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    if (canvas) {
      canvas.remove();
      canvas = null;
      ctx = null;
    }
    if (video) {
      video.pause();
      video.removeAttribute("src");
      try {
        video.load();
      } catch (e) {}
      video.remove();
      video = null;
    }
    particles = [];
    meteors = [];
    layer.classList.remove("bg-aurora", "bg-video");
    layer.style.background = "";
  }
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
    if (mode === "stars") initStars();else if (mode === "petals") initPetals();
  }
  window.addEventListener("resize", fitCanvas);
  function videoSrcForMode() {
    if (mode === "day") return DAY_VIDEO;
    if (mode === "night") return NIGHT_VIDEO;
    return hourSlot() === "day" ? DAY_VIDEO : NIGHT_VIDEO;
  }
  function setupVideo() {
    video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "metadata");
    layer.appendChild(video);
    layer.classList.add("bg-video");
    loadVideo(videoSrcForMode());
  }
  function loadVideo(src) {
    if (!video || !src) return;
    if (video.getAttribute("src") === src) return;
    video.setAttribute("src", src);
    video.load();
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }
  function checkAuto() {
    if (mode !== "auto") return;
    var slot = hourSlot();
    if (slot !== lastSlot) {
      lastSlot = slot;
      loadVideo(videoSrcForMode());
    }
  }
  setInterval(checkAuto, 6e4);
  function initStars() {
    var area = canvas.width * canvas.height;
    var n = Math.min(220, Math.floor(area / 5500));
    particles = Array.from({
      length: n
    }, function () {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        base: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.03 + 8e-3
      };
    });
  }
  function drawStars(now) {
    var dark = themeIsDark();
    var color = function color(a) {
      return dark ? "rgba(226, 232, 255, ".concat(a, ")") : "rgba(70, 82, 130, ".concat(a, ")");
    };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function (s) {
      var a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(now * s.sp + s.base));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = color(a);
      ctx.fill();
    });
    if (now - lastMeteorAt > 4500 + Math.random() * 4e3) {
      lastMeteorAt = now;
      meteors.push({
        x: Math.random() * canvas.width * 0.7 + canvas.width * 0.1,
        y: Math.random() * canvas.height * 0.4,
        vx: 6 + Math.random() * 4,
        vy: 2.5 + Math.random() * 2,
        len: 80 + Math.random() * 60,
        life: 1
      });
    }
    meteors = meteors.filter(function (m) {
      return m.life > 0;
    });
    meteors.forEach(function (m) {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.02;
      var grad = ctx.createLinearGradient(m.x, m.y, m.x - m.len, m.y - m.len * 0.45);
      grad.addColorStop(0, color(0.9 * m.life));
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.len, m.y - m.len * 0.45);
      ctx.stroke();
    });
    raf = requestAnimationFrame(function (t) {
      return drawStars(t);
    });
  }
  function initPetals() {
    var n = Math.min(38, Math.floor(canvas.width / 28));
    particles = Array.from({
      length: n
    }, function () {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: 7 + Math.random() * 9,
        speedY: 0.5 + Math.random() * 0.9,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 8e-3 + Math.random() * 0.02,
        swayAmp: 20 + Math.random() * 40,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        hue: 320 + Math.random() * 50,
        alpha: 0.45 + Math.random() * 0.4
      };
    });
  }
  function drawPetals(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function (p) {
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
      ctx.fillStyle = "hsla(".concat(p.hue, ", 75%, 78%, 0.9)");
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    raf = requestAnimationFrame(function (t) {
      return drawPetals(t);
    });
  }
  function applyAurora() {
    layer.classList.add("bg-aurora");
    layer.style.background = "var(--bg)";
  }
  function setMode(m) {
    mode = m;
    localStorage.setItem(KEY, m);
    clearMode();
    layer.style.background = "var(--bg)";
    if (m === "auto") {
      lastSlot = hourSlot();
      setTimeout(setupVideo, 1800);
    } else if (m === "day" || m === "night") {
      setTimeout(setupVideo, 1800);
    } else if (m === "stars") {
      setupCanvas();
      drawStars(performance.now());
    } else if (m === "petals") {
      setupCanvas();
      drawPetals(performance.now());
    } else if (m === "aurora") {
      applyAurora();
    }
    syncMenu();
  }
  var toggleBtn = document.getElementById("bg-toggle");
  var menu = document.getElementById("bg-menu");
  function syncMenu() {
    if (!menu) return;
    menu.querySelectorAll("[data-bg]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.bg === mode);
    });
  }
  if (toggleBtn && menu) {
    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    menu.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-bg]");
      if (!btn) return;
      setMode(btn.dataset.bg);
      menu.classList.remove("open");
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".bg-toggle-wrap")) menu.classList.remove("open");
    });
  }
  setMode(mode);
})();
