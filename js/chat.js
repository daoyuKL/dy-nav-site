(function () {
  "use strict";

  var listEl = document.getElementById("chat-list");
  var inputEl = document.getElementById("chat-input");
  var sendBtn = document.getElementById("chat-send");
  var loadingEl = document.getElementById("chat-loading");
  if (!listEl) return;
  var POLL_MS = 2e3;
  var lastTime = 0;
  var allMsgs = [];
  var loadTime = Date.now(); // 页面加载时刻:历史消息不触发彩蛋
  var eggShown = false;      // 一次只弹一个彩蛋
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
      return '<span class="chat-avatar"><img src="'.concat(url, '" alt="" onerror="this.remove()" /><span class="avatar-fallback">').concat(ch, "</span></span>");
    }
    return '<span class="chat-avatar">'.concat(ch, "</span>");
  }
  function fmtTime(t) {
    var diff = Date.now() - t;
    var min = 60 * 1e3;
    var hour = 60 * min;
    if (diff < 10 * 1e3) return "\u521A\u521A";
    if (diff < min) return Math.floor(diff / 1e3) + " \u79D2\u524D";
    if (diff < hour) return Math.floor(diff / min) + " \u5206\u949F\u524D";
    return Math.floor(diff / hour) + " \u5C0F\u65F6\u524D";
  }
  function buildItem(m) {
    var who = m.qq ? "".concat(esc(m.name || "QQ\u7528\u6237"), ' <span class="chat-qq">(QQ ').concat(esc(maskQQ(m.qq)), ")</span>") : esc(m.name || "\u533F\u540D");
    var div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = "\n      ".concat(avatarHTML(m), '\n      <div class="chat-body">\n        <div class="chat-head">\n          <span class="chat-name">').concat(who, '</span>\n          <span class="chat-time">').concat(fmtTime(m.time || Date.now()), '</span>\n        </div>\n        <div class="chat-text">').concat(esc(m.text), "</div>\n      </div>");
    return div;
  }
  function isNearBottom() {
    return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
  }
  function scrollToBottom() {
    listEl.scrollTop = listEl.scrollHeight;
  }
  function appendMessages(msgs) {
    var fresh = (msgs || []).filter(function (m) {
      return (m.time || 0) > lastTime;
    });
    if (!fresh.length) return;
    var stick = isNearBottom();
    fresh.forEach(function (m) {
      listEl.appendChild(buildItem(m));
      maybeEgg(m);
    });
    if (stick) scrollToBottom();
    lastTime = Math.max.apply(null, fresh.map(function (m) {
      return m.time || 0;
    }));
    if (loadingEl) loadingEl.style.display = "none";
    allMsgs = allMsgs.concat(fresh).slice(-300);
    if (window.ChatLocal) window.ChatLocal.save(allMsgs);
  }

  /* —— 彩蛋:有人发 mj/MJ,全屏随机弹出两个视频之一 —— */
  function maybeEgg(m) {
    if (!m || typeof m.text !== "string") return;
    if (m.time && m.time <= loadTime) return; // 历史消息不触发
    var t = m.text.trim().toLowerCase();
    if (t !== "mj") return;
    if (eggShown) return; // 一次只弹一个
    eggShown = true;
    var pick = Math.random() < 0.5 ? "assets/视频1.mp4" : "assets/视频2.mp4";
    var overlay = document.createElement("div");
    overlay.className = "egg-video-overlay";
    overlay.innerHTML = '<div class="egg-video-box">' +
      '<div class="egg-video-title">🎉 彩蛋!' + esc(m.name || "匿名") + " 触发了 MJ</div>" +
      '<video class="egg-video" src="' + pick + '" autoplay playsinline controls preload="auto"></video>' +
      '<button class="egg-video-close" type="button">✕ 关闭</button>' +
      "</div>";
    document.body.appendChild(overlay);

    var close = function () {
      var v = overlay.querySelector("video");
      if (v) { try { v.pause(); } catch (e) { /* 忽略 */ } }
      overlay.remove();
      eggShown = false;
    };
    var closeBtn = overlay.querySelector(".egg-video-close");
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    var v = overlay.querySelector("video");
    if (v) {
      v.addEventListener("ended", function () { setTimeout(close, 800); });
      v.addEventListener("error", function () { setTimeout(close, 1500); });
    }
  }
  function poll() {
    fetch("/api/chat?after=" + (lastTime - 1e3)).then(function (r) {
      return r.json();
    }).then(function (data) {
      if (data && data.ok) appendMessages(data.messages);
    }).catch(function () {
      if (lastTime === 0 && window.ChatLocal) {
        var local = window.ChatLocal.load();
        if (local && local.length) {
          appendMessages(local);
          if (loadingEl) {
            loadingEl.textContent = "\uD83D\uDCF1 \u79BB\u7EBF\u6A21\u5F0F \xB7 \u663E\u793A\u624B\u673A\u672C\u5730\u804A\u5929\u8BB0\u5F55(\u670D\u52A1\u5668\u672A\u8FDE\u63A5)";
            loadingEl.style.display = "block";
          }
        }
      }
    }).finally(function () {
      return setTimeout(poll, POLL_MS);
    });
  }
  function send() {
    var text = (inputEl.value || "").trim();
    if (!text) {
      inputEl.focus();
      return;
    }
    var body = {
      text: text
    };
    var tk = window.Account ? window.Account.getToken() : null;
    if (tk) body.token = tk;
    sendBtn.disabled = true;
    fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json();
    }).then(function (data) {
      if (data && data.ok) {
        inputEl.value = "";
        appendMessages([data.message]);
        scrollToBottom();
      } else {
        alert(data.error || "\u53D1\u9001\u5931\u8D25");
      }
    }).catch(function () {
      return alert("\u53D1\u9001\u5931\u8D25,\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u5DF2\u66F4\u65B0");
    }).finally(function () {
      sendBtn.disabled = false;
      inputEl.focus();
    });
  }
  if (sendBtn) sendBtn.addEventListener("click", send);
  if (inputEl) {
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
  }
  poll();
})();
