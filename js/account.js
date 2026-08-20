/* ==========================================================================
   《DY导航站》全局账号 · 顶部导航登录
   ==========================================================================
   功能:导航栏右侧提供「登录」入口,点击弹出登录/注册弹窗;
         登录态(QQ 号 + 密码,简化方案)全局共享,保存于 localStorage;
         其他页面通过 window.Account 获取登录态与 token。
   依赖:server.js 提供的 /api/register /api/login /api/logout /api/me
   ========================================================================== */

(function () {
  "use strict";

  const TOKEN_KEY = "nav-token";
  let token = null;
  let user = null;

  /* —— 全局接口(供留言板等页面使用) —— */
  window.Account = {
    getToken: function () { return token; },
    getUser: function () { return user; },
    isLoggedIn: function () { return !!(token && user); },
    /* QQ 头像公开接口:输入 QQ 号返回头像 URL */
    avatarUrl: function (qq) {
      return "https://q1.qlogo.cn/g?b=qq&nk=" + encodeURIComponent(String(qq || "")) + "&s=100";
    },
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* QQ 号脱敏:123****45 */
  function maskQQ(qq) {
    const s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }

  /* —— 导航栏元素 —— */
  const navLoginBtn = document.getElementById("nav-login-btn");
  const navUser = document.getElementById("nav-user");
  const navUserName = document.getElementById("nav-user-name");
  const navLogoutBtn = document.getElementById("nav-logout-btn");

  function applyNav() {
    if (user && navUser && navLoginBtn) {
      navUser.style.display = "";
      navLoginBtn.style.display = "none";
      // 头像(QQ 头像,加载失败自动隐藏露出首字符)
      let av = document.getElementById("nav-avatar");
      if (!av) {
        av = document.createElement("img");
        av.id = "nav-avatar";
        av.className = "nav-avatar";
        av.alt = "";
        av.onerror = function () { this.remove(); };
        navUser.insertBefore(av, navUser.firstChild);
      }
      av.src = window.Account.avatarUrl(user.qq);
      /* 昵称与 QQ 分开放,手机端可只显示昵称,避免挤占导航栏 */
      navUserName.textContent = "";
      const nick = document.createElement("span");
      nick.className = "acct-nav-nick";
      nick.textContent = user.nickname || "QQ用户";
      const qqSpan = document.createElement("span");
      qqSpan.className = "acct-nav-qq";
      qqSpan.textContent = "(" + maskQQ(user.qq) + ")";
      navUserName.appendChild(nick);
      navUserName.appendChild(qqSpan);
    } else if (navUser && navLoginBtn) {
      navUser.style.display = "none";
      navLoginBtn.style.display = "";
    }
  }

  /* —— 登录/注册弹窗 —— */
  let overlay = null;
  let mode = "login"; // login | register

  function buildModal() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "acct-overlay";
    overlay.innerHTML = `
      <div class="acct-modal" role="dialog" aria-label="账号登录">
        <button class="acct-close" id="acct-close" title="关闭">✕</button>
        <div class="acct-modal-icon">👤</div>
        <h3 class="acct-modal-title" id="acct-modal-title">登录</h3>
        <div class="acct-modal-field">
          <input class="acct-modal-input" id="acct-modal-qq" type="text" inputmode="numeric" maxlength="11" placeholder="QQ 号" autocomplete="off" />
        </div>
        <div class="acct-modal-field" id="acct-modal-nick-field" style="display:none;">
          <input class="acct-modal-input" id="acct-modal-nick" type="text" maxlength="20" placeholder="昵称(选填)" autocomplete="off" />
        </div>
        <div class="acct-modal-field">
          <input class="acct-modal-input" id="acct-modal-pwd" type="password" maxlength="32" placeholder="密码(6-32 位)" />
        </div>
        <div class="acct-modal-tip" id="acct-modal-tip"></div>
        <button class="acct-modal-btn" id="acct-modal-submit">登 录</button>
        <div class="acct-modal-switch">
          <span id="acct-modal-switch-text">还没有账号?</span>
          <a href="javascript:void(0)" id="acct-modal-switch">立即注册</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("#acct-close");
    const qqInput = overlay.querySelector("#acct-modal-qq");
    const nickField = overlay.querySelector("#acct-modal-nick-field");
    const nickInput = overlay.querySelector("#acct-modal-nick");
    const pwdInput = overlay.querySelector("#acct-modal-pwd");
    const tipEl = overlay.querySelector("#acct-modal-tip");
    const titleEl = overlay.querySelector("#acct-modal-title");
    const submitBtn = overlay.querySelector("#acct-modal-submit");
    const switchLink = overlay.querySelector("#acct-modal-switch");

    function showTip(msg, isError) {
      tipEl.textContent = msg;
      tipEl.className = "acct-modal-tip" + (isError ? " err" : "");
    }

    function setMode(m) {
      mode = m;
      titleEl.textContent = m === "login" ? "登录" : "注册";
      submitBtn.textContent = m === "login" ? "登 录" : "注 册";
      nickField.style.display = m === "register" ? "" : "none";
      switchLink.textContent = m === "login" ? "立即注册" : "返回登录";
      overlay.querySelector("#acct-modal-switch-text").textContent =
        m === "login" ? "还没有账号?" : "已有账号?";
      showTip("");
    }

    function doSubmit() {
      const qq = (qqInput.value || "").trim();
      const password = pwdInput.value || "";
      if (!/^\d{5,11}$/.test(qq)) return showTip("QQ 号格式不正确(5-11 位数字)", true);
      if (password.length < 6 || password.length > 32) return showTip("密码长度需为 6-32 位", true);

      const url = mode === "login" ? "/api/login" : "/api/register";
      const body = { qq, password };
      if (mode === "register") body.nickname = (nickInput.value || "").trim();

      submitBtn.disabled = true;
      submitBtn.textContent = "请稍候…";
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            token = data.token;
            user = data.user;
            try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* 忽略 */ }
            applyNav();
            closeModal();
            document.dispatchEvent(new CustomEvent("nav:auth", { detail: { user } }));
          } else {
            showTip(data.error || (mode === "login" ? "登录失败" : "注册失败"), true);
          }
        })
        .catch(() => showTip("请求失败,请确认服务端已更新", true))
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = mode === "login" ? "登 录" : "注 册";
        });
    }

    submitBtn.addEventListener("click", doSubmit);
    switchLink.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    pwdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSubmit();
    });
    return overlay;
  }

  function openModal() {
    const m = buildModal();
    mode = "login";
    m.style.display = "flex";
    const qqInput = m.querySelector("#acct-modal-qq");
    const pwdInput = m.querySelector("#acct-modal-pwd");
    const nickInput = m.querySelector("#acct-modal-nick");
    const titleEl = m.querySelector("#acct-modal-title");
    const nickField = m.querySelector("#acct-modal-nick-field");
    const submitBtn = m.querySelector("#acct-modal-submit");
    const tipEl = m.querySelector("#acct-modal-tip");
    const switchLink = m.querySelector("#acct-modal-switch");
    titleEl.textContent = "登录";
    submitBtn.textContent = "登 录";
    nickField.style.display = "none";
    switchLink.textContent = "立即注册";
    m.querySelector("#acct-modal-switch-text").textContent = "还没有账号?";
    tipEl.textContent = "";
    qqInput.value = "";
    pwdInput.value = "";
    nickInput.value = "";
    setTimeout(() => qqInput.focus(), 50);
  }

  function closeModal() {
    if (overlay) overlay.style.display = "none";
  }

  /* —— 事件绑定 —— */
  if (navLoginBtn) navLoginBtn.addEventListener("click", openModal);
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", () => {
      const t = token;
      token = null;
      user = null;
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 忽略 */ }
      if (t) {
        fetch("/api/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        }).catch(() => {});
      }
      applyNav();
      document.dispatchEvent(new CustomEvent("nav:auth"));
    });
  }

  /* —— 页面加载:校验登录态 —— */
  const saved = (function () {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  })();
  if (saved) {
    fetch("/api/me", { headers: { Authorization: "Bearer " + saved } })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok) {
          token = saved;
          user = data.user;
        } else {
          try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 忽略 */ }
        }
        applyNav();
      })
      .catch(() => applyNav());
  } else {
    applyNav();
  }
})();
