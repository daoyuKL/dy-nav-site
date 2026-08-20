/* ==========================================================================
   《DY导航站》免责公告
   ==========================================================================
   功能:首次进入网站时弹出免责公告,点击「我知道了」后记录已读,
         之后不再弹出;点击遮罩空白处仅关闭本次,不记录。
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "nav-notice-read";

  /* —— 已读则直接跳过 —— */
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
  } catch (e) { /* 隐私模式下忽略,继续弹出 */ }

  /* —— 弹窗 DOM —— */
  const overlay = document.createElement("div");
  overlay.className = "notice-overlay";
  overlay.innerHTML = `
    <div class="notice-box" role="dialog" aria-label="免责公告">
      <div class="notice-icon">🤖</div>
      <h3 class="notice-title">免责公告</h3>
      <p class="notice-text">
        本网站由 <b>AI 编写</b> 生成,内容仅供交流与娱乐参考。<br>
        如发现<b>缺漏、错误或不足之处</b>,欢迎通过
        <a href="contact.html">联系社交</a> 页面留言说明,
        我们会持续完善,感谢支持!
      </p>
      <button class="notice-btn" id="notice-ok">我知道了</button>
    </div>`;
  document.body.appendChild(overlay);

  /* —— 关闭(remember=true 时记录已读) —— */
  function close(remember) {
    if (remember) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) { /* 忽略 */ }
    }
    overlay.classList.add("hide");
    setTimeout(() => overlay.remove(), 300);
  }

  /* —— 按钮:关闭并记住已读 —— */
  overlay.querySelector("#notice-ok").addEventListener("click", () => close(true));

  /* —— 点击遮罩空白:仅关闭不记录(下次进入仍提示) —— */
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(false);
  });

  /* —— Esc 键也可关闭(不记录) —— */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close(false);
  });
})();
