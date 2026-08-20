/* ==========================================================================
   《DY导航站》聊天室脚本
   ==========================================================================
   功能:公共聊天室,消息仅保留 8 小时自动清空(服务端 chat.json);
         每 2 秒增量轮询新消息;登录用户发言自动署名,匿名可聊。
   ========================================================================== */

(function () {
  "use strict";

  const listEl = document.getElementById("chat-list");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const loadingEl = document.getElementById("chat-loading");

  if (!listEl) return; // 非聊天页面直接跳过

  const POLL_MS = 2000; // 轮询间隔
  let lastTime = 0; // 已渲染消息的最大时间(用于增量拉取 + 去重)

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
      return `<span class="chat-avatar"><img src="${url}" alt="" onerror="this.remove()" /><span class="avatar-fallback">${ch}</span></span>`;
    }
    return `<span class="chat-avatar">${ch}</span>`;
  }

  /* —— 时间格式化 —— */
  function fmtTime(t) {
    const diff = Date.now() - t;
    const min = 60 * 1000;
    const hour = 60 * min;
    if (diff < 10 * 1000) return "刚刚";
    if (diff < min) return Math.floor(diff / 1000) + " 秒前";
    if (diff < hour) return Math.floor(diff / min) + " 分钟前";
    return Math.floor(diff / hour) + " 小时前";
  }

  /* —— 构造消息气泡 —— */
  function buildItem(m) {
    const who = m.qq
      ? `${esc(m.name || "QQ用户")} <span class="chat-qq">(QQ ${esc(maskQQ(m.qq))})</span>`
      : esc(m.name || "匿名");
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = `
      ${avatarHTML(m)}
      <div class="chat-body">
        <div class="chat-head">
          <span class="chat-name">${who}</span>
          <span class="chat-time">${fmtTime(m.time || Date.now())}</span>
        </div>
        <div class="chat-text">${esc(m.text)}</div>
      </div>`;
    return div;
  }

  function isNearBottom() {
    return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
  }

  function scrollToBottom() {
    listEl.scrollTop = listEl.scrollHeight;
  }

  /* —— 追加消息(去重) —— */
  function appendMessages(msgs) {
    const fresh = (msgs || []).filter((m) => (m.time || 0) > lastTime);
    if (!fresh.length) return;
    const stick = isNearBottom();
    fresh.forEach((m) => listEl.appendChild(buildItem(m)));
    if (stick) scrollToBottom();
    lastTime = Math.max.apply(null, fresh.map((m) => m.time || 0));
    if (loadingEl) loadingEl.style.display = "none";
  }

  /* —— 轮询新消息 —— */
  function poll() {
    fetch("/api/chat?after=" + (lastTime - 1000)) // 1 秒重叠兜底,避免漏消息
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok) appendMessages(data.messages);
      })
      .catch(() => { /* 网络异常静默重试 */ })
      .finally(() => setTimeout(poll, POLL_MS));
  }

  /* —— 发送消息 —— */
  function send() {
    const text = (inputEl.value || "").trim();
    if (!text) {
      inputEl.focus();
      return;
    }
    const body = { text };
    const tk = window.Account ? window.Account.getToken() : null;
    if (tk) body.token = tk;

    sendBtn.disabled = true;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok) {
          inputEl.value = "";
          appendMessages([data.message]);
          scrollToBottom();
        } else {
          alert(data.error || "发送失败");
        }
      })
      .catch(() => alert("发送失败,请确认服务端已更新"))
      .finally(() => {
        sendBtn.disabled = false;
        inputEl.focus();
      });
  }

  if (sendBtn) sendBtn.addEventListener("click", send);
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
  }

  /* —— 启动:先拉全量,再开始轮询 —— */
  poll();
})();
