/* ==========================================================================
   《DY导航站》彩蛋
   ==========================================================================
   在任意搜索栏输入关键词 daoyuKL(不区分大小写),
   触发「下载原神」彩蛋动画,进度跑满后跳转原神官网下载页。
   ========================================================================== */

(function () {
  "use strict";

  const KEYWORD = "daoyuKL";
  const TARGET_URL = "https://ys.mihoyo.com/main/"; // 原神官网(下载入口)
  let triggered = false;

  function isMatch(v) {
    return v.trim().toLowerCase() === KEYWORD.toLowerCase();
  }

  function launch() {
    if (triggered) return;
    triggered = true;

    /* —— 全屏彩蛋覆盖层 —— */
    const ov = document.createElement("div");
    ov.className = "easter-egg";
    ov.innerHTML = `
      <div class="ee-box">
        <div class="ee-icon">🎮</div>
        <div class="ee-title">正在下载《原神》…</div>
        <div class="ee-bar"><div class="ee-fill"></div></div>
        <div class="ee-text" id="ee-text">0%</div>
        <div class="ee-sub">下载完成后将自动开始安装,请保持网络畅通</div>
      </div>`;
    document.body.appendChild(ov);

    /* —— 进度条动画 —— */
    const fill = ov.querySelector(".ee-fill");
    const text = ov.querySelector("#ee-text");
    let p = 0;

    const timer = setInterval(() => {
      p += Math.random() * 8 + 2.5;
      if (p >= 100) {
        p = 100;
        clearInterval(timer);
        fill.style.width = "100%";
        text.textContent = "100% · 下载完成!正在打开安装页面…";
        setTimeout(() => {
          window.location.href = TARGET_URL;
        }, 1400);
      } else {
        fill.style.width = p + "%";
        text.textContent = Math.floor(p) + "%";
      }
    }, 110);
  }

  /* —— 绑定首页搜索框(home-search) —— */
  const home = document.getElementById("home-search");
  if (home) {
    home.addEventListener("input", () => {
      if (isMatch(home.value)) launch();
    });
    home.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && isMatch(home.value)) {
        e.preventDefault();
        launch();
      }
    });
  }

  /* —— 绑定工具/游戏页搜索框(search-input) —— */
  const pageInput = document.getElementById("search-input");
  if (pageInput) {
    pageInput.addEventListener("input", () => {
      if (isMatch(pageInput.value)) launch();
    });
    pageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && isMatch(pageInput.value)) {
        e.preventDefault();
        launch();
      }
    });
  }
})();
