/* ==========================================================================
   《DY导航站》趣事广场脚本
   ==========================================================================
   功能:① 顶部新闻速递(精选热点资讯入口,静态);
         ② 趣事动态:发布/加载(API 由 server.js 提供,data/fun.json),
            登录态来自 account.js(window.Account),登录用户发布自动绑定
            QQ 账号,未登录可匿名发布;动态保留 30 天,每 20 秒自动刷新。
   ========================================================================== */

(function () {
  "use strict";

  const listEl = document.getElementById("fun-list");
  const form = document.getElementById("fun-form");
  const tip = document.getElementById("fun-empty");
  const newsEl = document.getElementById("fun-news");

  if (!listEl) return; // 非趣事页面直接跳过

  /* —— 新闻速递(静态精选资讯入口) —— */
  const NEWS = [
    { name: "微博热搜", url: "https://s.weibo.com/top/summary", desc: "微博实时热搜榜", icon: "🔥" },
    { name: "百度热搜", url: "https://top.baidu.com/board?tab=realtime", desc: "百度实时热点", icon: "🐻" },
    { name: "知乎热榜", url: "https://www.zhihu.com/hot", desc: "知乎热议话题", icon: "🤔" },
    { name: "抖音热点", url: "https://www.douyin.com/hot", desc: "抖音热门视频", icon: "🎬" },
    { name: "今日头条", url: "https://www.toutiao.com", desc: "头条资讯", icon: "📰" },
    { name: "腾讯新闻", url: "https://news.qq.com", desc: "腾讯新闻中心", icon: "🐧" },
    { name: "网易新闻", url: "https://news.163.com", desc: "网易新闻", icon: "📰" },
    { name: "人民网", url: "http://www.people.com.cn", desc: "权威时政新闻", icon: "🇨🇳" },
  ];
  if (newsEl) {
    newsEl.innerHTML = NEWS.map(
      (n) => `
      <a class="fun-news-card" href="${n.url}" target="_blank" rel="noopener">
        <span class="fun-news-icon">${n.icon}</span>
        <span class="fun-news-body">
          <span class="fun-news-name">${n.name}</span>
          <span class="fun-news-desc">${n.desc}</span>
        </span>
        <span class="fun-news-arrow">→</span>
      </a>`
    ).join("");
  }

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
      return `<span class="fun-avatar"><img src="${url}" alt="" onerror="this.remove()" /><span class="avatar-fallback">${ch}</span></span>`;
    }
    return `<span class="fun-avatar">${ch}</span>`;
  }

  /* —— 时间格式化:相对时间 —— */
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

  /* —— 渲染动态列表 —— */
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
          ? `${esc(m.name || "QQ用户")} <span class="fun-qq">(QQ ${esc(maskQQ(m.qq))})</span>`
          : esc(m.name || "匿名");
        return `
      <div class="fun-item">
        <div class="fun-head">
          ${avatarHTML(m)}
          <span class="fun-name">${who}</span>
          <span class="fun-time">${fmtTime(m.time || Date.now())}</span>
        </div>
        <div class="fun-text">${esc(m.text)}</div>
      </div>`;
      })
      .join("");
  }

  /* —— 加载动态 —— */
  function load() {
    fetch("/api/fun")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok) render(data.posts || []);
      })
      .catch(() => {
        if (tip) {
          tip.innerHTML = "⚠️ 趣事加载失败,请确认服务端已更新(重启 server.js)";
          tip.style.display = "block";
        }
      });
  }

  /* —— 发布动态 —— */
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = form.querySelector("#fun-name");
      const textInput = form.querySelector("#fun-text");
      const btn = form.querySelector("#fun-submit");
      const text = (textInput.value || "").trim();
      if (!text) {
        textInput.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "发布中…";

      const body = { text };
      const tk = window.Account ? window.Account.getToken() : null;
      if (tk) {
        body.token = tk; // 登录用户发布绑定账号
      } else {
        body.name = (nameInput.value || "").trim(); // 匿名发布
      }

      fetch("/api/fun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.ok) {
            textInput.value = "";
            render(data.posts || []);
          } else {
            alert(data.error || "发布失败,请重试");
          }
        })
        .catch(() => alert("发布失败,请确认服务端已更新"))
        .finally(() => {
          btn.disabled = false;
          btn.textContent = "🎉 发布趣事";
        });
    });
  }

  /* —— 初始化:加载已有动态 + 每 20 秒自动刷新 —— */
  load();
  setInterval(load, 20000);
})();
