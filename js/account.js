(function () {
  "use strict";

  var TOKEN_KEY = "nav-token";
  var token = null;
  var user = null;
  window.Account = {
    getToken: function getToken() {
      return token;
    },
    getUser: function getUser() {
      return user;
    },
    isLoggedIn: function isLoggedIn() {
      return !!(token && user);
    },
    /* QQ 头像公开接口:输入 QQ 号返回头像 URL */
    avatarUrl: function avatarUrl(qq) {
      return "https://q1.qlogo.cn/g?b=qq&nk=" + encodeURIComponent(String(qq || "")) + "&s=100";
    }
  };
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function maskQQ(qq) {
    var s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }
  var navLoginBtn = document.getElementById("nav-login-btn");
  var navUser = document.getElementById("nav-user");
  var navUserName = document.getElementById("nav-user-name");
  var navLogoutBtn = document.getElementById("nav-logout-btn");
  function applyNav() {
    if (user && navUser && navLoginBtn) {
      navUser.style.display = "";
      navLoginBtn.style.display = "none";
      var av = document.getElementById("nav-avatar");
      if (!av) {
        av = document.createElement("img");
        av.id = "nav-avatar";
        av.className = "nav-avatar";
        av.alt = "";
        av.onerror = function () {
          this.remove();
        };
        navUser.insertBefore(av, navUser.firstChild);
      }
      av.src = window.Account.avatarUrl(user.qq);
      navUserName.textContent = "";
      var nick = document.createElement("span");
      nick.className = "acct-nav-nick";
      nick.textContent = user.nickname || "QQ\u7528\u6237";
      var qqSpan = document.createElement("span");
      qqSpan.className = "acct-nav-qq";
      qqSpan.textContent = "(" + maskQQ(user.qq) + ")";
      navUserName.appendChild(nick);
      navUserName.appendChild(qqSpan);
    } else if (navUser && navLoginBtn) {
      navUser.style.display = "none";
      navLoginBtn.style.display = "";
    }
  }
  var overlay = null;
  var mode = "login";
  function buildModal() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "acct-overlay";
    overlay.innerHTML = "\n      <div class=\"acct-modal\" role=\"dialog\" aria-label=\"\u8D26\u53F7\u767B\u5F55\">\n        <button class=\"acct-close\" id=\"acct-close\" title=\"\u5173\u95ED\">\u2715</button>\n        <div class=\"acct-modal-icon\">\uD83D\uDC64</div>\n        <h3 class=\"acct-modal-title\" id=\"acct-modal-title\">\u767B\u5F55</h3>\n        <div class=\"acct-modal-field\">\n          <input class=\"acct-modal-input\" id=\"acct-modal-qq\" type=\"text\" inputmode=\"numeric\" maxlength=\"11\" placeholder=\"QQ \u53F7\" autocomplete=\"off\" />\n        </div>\n        <div class=\"acct-modal-field\" id=\"acct-modal-nick-field\" style=\"display:none;\">\n          <input class=\"acct-modal-input\" id=\"acct-modal-nick\" type=\"text\" maxlength=\"20\" placeholder=\"\u6635\u79F0(\u9009\u586B)\" autocomplete=\"off\" />\n        </div>\n        <div class=\"acct-modal-field\">\n          <input class=\"acct-modal-input\" id=\"acct-modal-pwd\" type=\"password\" maxlength=\"32\" placeholder=\"\u5BC6\u7801(6-32 \u4F4D)\" />\n        </div>\n        <div class=\"acct-modal-tip\" id=\"acct-modal-tip\"></div>\n        <button class=\"acct-modal-btn\" id=\"acct-modal-submit\">\u767B \u5F55</button>\n        <div class=\"acct-modal-switch\">\n          <span id=\"acct-modal-switch-text\">\u8FD8\u6CA1\u6709\u8D26\u53F7?</span>\n          <a href=\"javascript:void(0)\" id=\"acct-modal-switch\">\u7ACB\u5373\u6CE8\u518C</a>\n        </div>\n      </div>";
    document.body.appendChild(overlay);
    var closeBtn = overlay.querySelector("#acct-close");
    var qqInput = overlay.querySelector("#acct-modal-qq");
    var nickField = overlay.querySelector("#acct-modal-nick-field");
    var nickInput = overlay.querySelector("#acct-modal-nick");
    var pwdInput = overlay.querySelector("#acct-modal-pwd");
    var tipEl = overlay.querySelector("#acct-modal-tip");
    var titleEl = overlay.querySelector("#acct-modal-title");
    var submitBtn = overlay.querySelector("#acct-modal-submit");
    var switchLink = overlay.querySelector("#acct-modal-switch");
    function showTip(msg, isError) {
      tipEl.textContent = msg;
      tipEl.className = "acct-modal-tip" + (isError ? " err" : "");
    }
    function setMode(m) {
      mode = m;
      titleEl.textContent = m === "login" ? "\u767B\u5F55" : "\u6CE8\u518C";
      submitBtn.textContent = m === "login" ? "\u767B \u5F55" : "\u6CE8 \u518C";
      nickField.style.display = m === "register" ? "" : "none";
      switchLink.textContent = m === "login" ? "\u7ACB\u5373\u6CE8\u518C" : "\u8FD4\u56DE\u767B\u5F55";
      overlay.querySelector("#acct-modal-switch-text").textContent = m === "login" ? "\u8FD8\u6CA1\u6709\u8D26\u53F7?" : "\u5DF2\u6709\u8D26\u53F7?";
      showTip("");
    }
    function doSubmit() {
      var qq = (qqInput.value || "").trim();
      var password = pwdInput.value || "";
      if (!/^\d{5,11}$/.test(qq)) return showTip("QQ \u53F7\u683C\u5F0F\u4E0D\u6B63\u786E(5-11 \u4F4D\u6570\u5B57)", true);
      if (password.length < 6 || password.length > 32) return showTip("\u5BC6\u7801\u957F\u5EA6\u9700\u4E3A 6-32 \u4F4D", true);
      var url = mode === "login" ? "/api/login" : "/api/register";
      var body = {
        qq: qq,
        password: password
      };
      if (mode === "register") body.nickname = (nickInput.value || "").trim();
      submitBtn.disabled = true;
      submitBtn.textContent = "\u8BF7\u7A0D\u5019\u2026";
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json();
      }).then(function (data) {
        if (data.ok) {
          token = data.token;
          user = data.user;
          try {
            localStorage.setItem(TOKEN_KEY, token);
          } catch (e) {}
          applyNav();
          closeModal();
          document.dispatchEvent(new CustomEvent("nav:auth", {
            detail: {
              user: user
            }
          }));
        } else {
          showTip(data.error || (mode === "login" ? "\u767B\u5F55\u5931\u8D25" : "\u6CE8\u518C\u5931\u8D25"), true);
        }
      }).catch(function () {
        return showTip("\u8BF7\u6C42\u5931\u8D25,\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u5DF2\u66F4\u65B0", true);
      }).finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "\u767B \u5F55" : "\u6CE8 \u518C";
      });
    }
    submitBtn.addEventListener("click", doSubmit);
    switchLink.addEventListener("click", function () {
      return setMode(mode === "login" ? "register" : "login");
    });
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
    pwdInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doSubmit();
    });
    return overlay;
  }
  function openModal() {
    var m = buildModal();
    mode = "login";
    m.style.display = "flex";
    var qqInput = m.querySelector("#acct-modal-qq");
    var pwdInput = m.querySelector("#acct-modal-pwd");
    var nickInput = m.querySelector("#acct-modal-nick");
    var titleEl = m.querySelector("#acct-modal-title");
    var nickField = m.querySelector("#acct-modal-nick-field");
    var submitBtn = m.querySelector("#acct-modal-submit");
    var tipEl = m.querySelector("#acct-modal-tip");
    var switchLink = m.querySelector("#acct-modal-switch");
    titleEl.textContent = "\u767B\u5F55";
    submitBtn.textContent = "\u767B \u5F55";
    nickField.style.display = "none";
    switchLink.textContent = "\u7ACB\u5373\u6CE8\u518C";
    m.querySelector("#acct-modal-switch-text").textContent = "\u8FD8\u6CA1\u6709\u8D26\u53F7?";
    tipEl.textContent = "";
    qqInput.value = "";
    pwdInput.value = "";
    nickInput.value = "";
    setTimeout(function () {
      return qqInput.focus();
    }, 50);
  }
  function closeModal() {
    if (overlay) overlay.style.display = "none";
  }
  if (navLoginBtn) navLoginBtn.addEventListener("click", openModal);
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", function () {
      var t = token;
      token = null;
      user = null;
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (e) {}
      if (t) {
        fetch("/api/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token: t
          })
        }).catch(function () {});
      }
      applyNav();
      document.dispatchEvent(new CustomEvent("nav:auth"));
    });
  }
  var saved = function () {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }();
  if (saved) {
    fetch("/api/me", {
      headers: {
        Authorization: "Bearer " + saved
      }
    }).then(function (r) {
      return r.json();
    }).then(function (data) {
      if (data && data.ok) {
        token = saved;
        user = data.user;
      } else {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
      }
      applyNav();
    }).catch(function () {
      return applyNav();
    });
  } else {
    applyNav();
  }
})();
