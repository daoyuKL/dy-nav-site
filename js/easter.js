(function () {
  "use strict";

  var KEYWORD = "daoyuKL";
  var TARGET_URL = "https://ys.mihoyo.com/main/";
  var triggered = false;
  function isMatch(v) {
    return v.trim().toLowerCase() === KEYWORD.toLowerCase();
  }
  function launch() {
    if (triggered) return;
    triggered = true;
    var ov = document.createElement("div");
    ov.className = "easter-egg";
    ov.innerHTML = "\n      <div class=\"ee-box\">\n        <div class=\"ee-icon\">\uD83C\uDFAE</div>\n        <div class=\"ee-title\">\u6B63\u5728\u4E0B\u8F7D\u300A\u539F\u795E\u300B\u2026</div>\n        <div class=\"ee-bar\"><div class=\"ee-fill\"></div></div>\n        <div class=\"ee-text\" id=\"ee-text\">0%</div>\n        <div class=\"ee-sub\">\u4E0B\u8F7D\u5B8C\u6210\u540E\u5C06\u81EA\u52A8\u5F00\u59CB\u5B89\u88C5,\u8BF7\u4FDD\u6301\u7F51\u7EDC\u7545\u901A</div>\n      </div>";
    document.body.appendChild(ov);
    var fill = ov.querySelector(".ee-fill");
    var text = ov.querySelector("#ee-text");
    var p = 0;
    var timer = setInterval(function () {
      p += Math.random() * 8 + 2.5;
      if (p >= 100) {
        p = 100;
        clearInterval(timer);
        fill.style.width = "100%";
        text.textContent = "100% \xB7 \u4E0B\u8F7D\u5B8C\u6210!\u6B63\u5728\u6253\u5F00\u5B89\u88C5\u9875\u9762\u2026";
        setTimeout(function () {
          window.location.href = TARGET_URL;
        }, 1400);
      } else {
        fill.style.width = p + "%";
        text.textContent = Math.floor(p) + "%";
      }
    }, 110);
  }
  var home = document.getElementById("home-search");
  if (home) {
    home.addEventListener("input", function () {
      if (isMatch(home.value)) launch();
    });
    home.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && isMatch(home.value)) {
        e.preventDefault();
        launch();
      }
    });
  }
  var pageInput = document.getElementById("search-input");
  if (pageInput) {
    pageInput.addEventListener("input", function () {
      if (isMatch(pageInput.value)) launch();
    });
    pageInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && isMatch(pageInput.value)) {
        e.preventDefault();
        launch();
      }
    });
  }
})();
