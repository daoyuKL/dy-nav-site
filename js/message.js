/* ==========================================================================
   《DY导航站》留言板脚本
   ==========================================================================
   功能:留言读写(API 由 server.js 提供);
         登录态来自全局 account.js(window.Account),登录用户留言自动
         绑定 QQ 账号,未登录可匿名留言;
         留言仅保留最近 1 年,到期自动清空。
   ========================================================================== */

(function () {
  "use strict";

  const listEl = document.getElementById("msg-list");
  const form = document.getElementById("msg-form");
  const tip = document.getElementById("msg-empty");

  if (!listEl) return; // 非留言板页面直接跳过

  /* —— HTML 转义(防 XSS) —— */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* —— QQ 号脱敏显示:123****45 —— */
  function maskQQ(qq) {
    const s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }

  /* —— 头像:登录用户显示 QQ 头像(加载失败回退首字符),匿名显示首字符 —— */
  function avatarHTML(m) {
    const ch = esc((m.name || (m.qq ? "Q" : "匿")).charAt(0));
    if (m.qq) {
      const url = (window.Account && window.Account.avatarUrl)
        ? window.Account.avatarUrl(m.qq)
        : "https://q1.qlogo.cn/g?b=qq&nk=" + m.qq + "&s=100";
      return `<span class="msg-avatar"><img src="${url}" alt="" onerror="this.remove()" /><span class="avatar-fallback">${ch}</span></span>`;
    }
    return `<span class="msg-avatar">${ch}</span>`;
  }

  /* —— 时间格式化:7 天内显示相对时间 —— */
  function fmtTime(t) {
    const diff = Date.now() - t;
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    if (diff < min) return "刚刚";
    if (diff < hour) return Math.floor(diff / min) + " 分钟前";
    if (diff < day) return Math.floor(diff / hour) + " 小时前";
    return Math.floor(diff / day) + " 天前";
  }

  /* —— 渲染留言列表 —— */
  function render(list) {
    list.sort((a, b) => (b.time || 0) - (a.time || 0)); // 最新在前
    if (!list.length) {
      listEl.innerHTML = "";
      if (tip) tip.style.display = "block";
      return;
    }
    if (tip) tip.style.display = "none";
    listEl.innerHTML = list
      .map((m) => {
        const who = m.qq
          ? `${esc(m.name || "QQ用户")} <span class="msg-qq">(QQ ${esc(maskQQ(m.qq))})</span>`
          : esc(m.name || "匿名");
        return `
      <div class="msg-item">
        <div class="msg-head">
          ${avatarHTML(m)}
          <span class="msg-name">${who}</span>
          <span class="msg-time">${fmtTime(m.time || Date.now())}</span>
        </div>
        <div class="msg-text">${esc(m.text)}</div>
      </div>`;
      })
      .join("");
  }

  /* —— 加载留言 —— */
  function load() {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok) render(data.messages || []);
      })
      .catch(() => {
        if (tip) {
          tip.innerHTML = "⚠️ 留言加载失败,请确认服务端已更新(重启 server.js)";
          tip.style.display = "block";
        }
      });
  }

  /* —— 提交留言 —— */
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = form.querySelector("#msg-name");
      const textInput = form.querySelector("#msg-text");
      const btn = form.querySelector("#msg-submit");
      const text = (textInput.value || "").trim();
      if (!text) {
        textInput.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "提交中…";

      const body = { text };
      const tk = window.Account ? window.Account.getToken() : null;
      if (tk) {
        body.token = tk; // 登录用户留言绑定账号
      } else {
        body.name = (nameInput.value || "").trim(); // 匿名留言
      }

      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.ok) {
            textInput.value = "";
            render(data.messages || []);
          } else {
            alert(data.error || "提交失败,请重试");
          }
        })
        .catch(() => alert("提交失败,请确认服务端已更新"))
        .finally(() => {
          btn.disabled = false;
          btn.textContent = "✉️ 发表留言";
        });
    });
  }

  /* —— 初始化:加载已有留言 —— */
  load();
})();
