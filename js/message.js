(function () {
  "use strict";

  var listEl = document.getElementById("msg-list");
  var form = document.getElementById("msg-form");
  var tip = document.getElementById("msg-empty");
  if (!listEl) return;
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
      return '<span class="msg-avatar"><img src="'.concat(url, '" alt="" onerror="this.remove()" /><span class="avatar-fallback">').concat(ch, "</span></span>");
    }
    return '<span class="msg-avatar">'.concat(ch, "</span>");
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
      var who = m.qq ? "".concat(esc(m.name || "QQ\u7528\u6237"), ' <span class="msg-qq">(QQ ').concat(esc(maskQQ(m.qq)), ")</span>") : esc(m.name || "\u533F\u540D");
      return '\n      <div class="msg-item">\n        <div class="msg-head">\n          '.concat(avatarHTML(m), '\n          <span class="msg-name">').concat(who, '</span>\n          <span class="msg-time">').concat(fmtTime(m.time || Date.now()), '</span>\n        </div>\n        <div class="msg-text">').concat(esc(m.text), "</div>\n      </div>");
    }).join("");
  }
  function load() {
    fetch("/api/messages").then(function (r) {
      return r.json();
    }).then(function (data) {
      if (data && data.ok) render(data.messages || []);
    }).catch(function () {
      if (tip) {
        tip.innerHTML = "\u26A0\uFE0F \u7559\u8A00\u52A0\u8F7D\u5931\u8D25,\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u5DF2\u66F4\u65B0(\u91CD\u542F server.js)";
        tip.style.display = "block";
      }
    });
  }
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameInput = form.querySelector("#msg-name");
      var textInput = form.querySelector("#msg-text");
      var btn = form.querySelector("#msg-submit");
      var text = (textInput.value || "").trim();
      if (!text) {
        textInput.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "\u63D0\u4EA4\u4E2D\u2026";
      var body = {
        text: text
      };
      var tk = window.Account ? window.Account.getToken() : null;
      if (tk) {
        body.token = tk;
      } else {
        body.name = (nameInput.value || "").trim();
      }
      fetch("/api/messages", {
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
          render(data.messages || []);
        } else {
          alert(data.error || "\u63D0\u4EA4\u5931\u8D25,\u8BF7\u91CD\u8BD5");
        }
      }).catch(function () {
        return alert("\u63D0\u4EA4\u5931\u8D25,\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u5DF2\u66F4\u65B0");
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = "\u2709\uFE0F \u53D1\u8868\u7559\u8A00";
      });
    });
  }
  load();
})();
