(function () {
  "use strict";

  var listEl = document.getElementById("fun-list");
  var form = document.getElementById("fun-form");
  var tip = document.getElementById("fun-empty");
  var newsEl = document.getElementById("fun-news");
  if (!listEl) return;
  /* 新闻速递已改为静态 HTML 渲染(fun.html),这里不再需要 JS 生成 */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function maskQQ(qq) {
    var s = String(qq || "");
    if (s.length <= 5) return s;
    return s.slice(0, 3) + "****" + s.slice(-2);
  }
  function avatarHTML(m) {
    var ch = esc((m.name || (m.qq ? "Q" : "\u533F")).charAt(0));
    if (m.qq) {
      var url = window.Account && window.Account.avatarUrl ? window.Account.avatarUrl(m.qq) : "https://q1.qlogo.cn/g?b=qq&nk=" + m.qq + "&s=100";
      return '<span class="fun-avatar"><img src="'.concat(url, '" alt="" onerror="this.remove()" /><span class="avatar-fallback">').concat(ch, "</span></span>");
    }
    return '<span class="fun-avatar">'.concat(ch, "</span>");
  }
  function fmtTime(t) {
    var diff = Date.now() - t;
    var min = 60 * 1e3;
    var hour = 60 * min;
    var day = 24 * hour;
    if (diff < min) return "\u521A\u521A";
    if (diff < hour) return Math.floor(diff / min) + " \u5206\u949F\u524D";
    if (diff < day) return Math.floor(diff / hour) + " \u5C0F\u65F6\u524D";
    return Math.floor(diff / day) + " \u5929\u524D";
  }
  function render(list) {
    list.sort(function (a, b) {
      return (b.time || 0) - (a.time || 0);
    });
    if (!list.length) {
      listEl.innerHTML = "";
      if (tip) tip.style.display = "block";
      return;
    }
    if (tip) tip.style.display = "none";
    listEl.innerHTML = list.map(function (m) {
      var who = m.qq ? "".concat(esc(m.name || "QQ\u7528\u6237"), ' <span class="fun-qq">(QQ ').concat(esc(maskQQ(m.qq)), ")</span>") : esc(m.name || "\u533F\u540D");
      return '\n      <div class="fun-item">\n        <div class="fun-head">\n          '.concat(avatarHTML(m), '\n          <span class="fun-name">').concat(who, '</span>\n          <span class="fun-time">').concat(fmtTime(m.time || Date.now()), '</span>\n        </div>\n        <div class="fun-text">').concat(esc(m.text), "</div>\n      </div>");
    }).join("");
  }
  function load() {
    if (typeof fetch !== "function") {
      if (tip) {
        tip.innerHTML = "\u26A0\uFE0F \u6D4F\u89C8\u5668\u592A\u65E7,\u65E0\u6CD5\u8FDE\u63A5\u670D\u52A1\u5668";
        tip.style.display = "block";
      }
      return;
    }
    fetch("/api/fun").then(function (r) {
      return r.json();
    }).then(function (data) {
      if (data && data.ok) render(data.posts || []);
    }).catch(function () {
      if (tip) {
        tip.innerHTML = "\u26A0\uFE0F \u8DA3\u4E8B\u52A0\u8F7D\u5931\u8D25,\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u5DF2\u66F4\u65B0(\u91CD\u542F server.js)";
        tip.style.display = "block";
      }
    });
  }
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameInput = form.querySelector("#fun-name");
      var textInput = form.querySelector("#fun-text");
      var btn = form.querySelector("#fun-submit");
      var text = (textInput.value || "").trim();
      if (!text) {
        textInput.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "\u53D1\u5E03\u4E2D\u2026";
      var body = {
        text: text
      };
      var tk = window.Account ? window.Account.getToken() : null;
      if (tk) {
        body.token = tk;
      } else {
        body.name = (nameInput.value || "").trim();
      }
      fetch("/api/fun", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json();
      }).then(function (data) {
        if (data && data.ok) {
          textInput.value = "";
          render(data.posts || []);
        } else {
          alert(data.error || "\u53D1\u5E03\u5931\u8D25,\u8BF7\u91CD\u8BD5");
        }
      }).catch(function () {
        return alert("\u53D1\u5E03\u5931\u8D25,\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u5DF2\u66F4\u65B0");
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = "\uD83C\uDF89 \u53D1\u5E03\u8DA3\u4E8B";
      });
    });
  }
  load();
  setInterval(load, 2e4);
})();
