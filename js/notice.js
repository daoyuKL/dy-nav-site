(function () {
  "use strict";

  var STORAGE_KEY = "nav-notice-read";
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
  } catch (e) {}
  var overlay = document.createElement("div");
  overlay.className = "notice-overlay";
  overlay.innerHTML = "\n    <div class=\"notice-box\" role=\"dialog\" aria-label=\"\u514D\u8D23\u516C\u544A\">\n      <div class=\"notice-icon\">\uD83E\uDD16</div>\n      <h3 class=\"notice-title\">\u514D\u8D23\u516C\u544A</h3>\n      <p class=\"notice-text\">\n        \u672C\u7F51\u7AD9\u7531 <b>AI \u7F16\u5199</b> \u751F\u6210,\u5185\u5BB9\u4EC5\u4F9B\u4EA4\u6D41\u4E0E\u5A31\u4E50\u53C2\u8003\u3002<br>\n        \u5982\u53D1\u73B0<b>\u7F3A\u6F0F\u3001\u9519\u8BEF\u6216\u4E0D\u8DB3\u4E4B\u5904</b>,\u6B22\u8FCE\u901A\u8FC7\n        <a href=\"contact.html\">\u8054\u7CFB\u793E\u4EA4</a> \u9875\u9762\u7559\u8A00\u8BF4\u660E,\n        \u6211\u4EEC\u4F1A\u6301\u7EED\u5B8C\u5584,\u611F\u8C22\u652F\u6301!\n      </p>\n      <button class=\"notice-btn\" id=\"notice-ok\">\u6211\u77E5\u9053\u4E86</button>\n    </div>";
  document.body.appendChild(overlay);
  function close(remember) {
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch (e) {}
    }
    overlay.classList.add("hide");
    setTimeout(function () {
      return overlay.remove();
    }, 300);
  }
  overlay.querySelector("#notice-ok").addEventListener("click", function () {
    return close(true);
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close(false);
  });
})();
