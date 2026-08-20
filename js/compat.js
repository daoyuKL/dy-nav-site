/* ==========================================================================
   《DY导航站》老 WebView 兼容垫片(纯 ES5)
   ==========================================================================
   给较旧的手机 WebView(Chrome 45~53 时代,常见于无谷歌服务的国产手机)
   补齐 Object.assign / Array.from / Object.values / String.includes 等
   运行时 API,保证转译后的 ES5 代码在这些机器上也能跑。
   此文件必须最先加载(在 main.js 等所有脚本之前)。
   ========================================================================== */
(function () {
  "use strict";

  /* Object.assign(Chrome 45+) */
  if (typeof Object.assign !== "function") {
    Object.assign = function (target) {
      if (target == null) throw new TypeError("Cannot convert undefined or null to object");
      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (src == null) continue;
        for (var k in src) {
          if (Object.prototype.hasOwnProperty.call(src, k)) to[k] = src[k];
        }
      }
      return to;
    };
  }

  /* Array.from(Chrome 45+) */
  if (typeof Array.from !== "function") {
    Array.from = function (arrayLike, mapFn, thisArg) {
      var out = [];
      var len = arrayLike == null ? 0 : arrayLike.length;
      for (var i = 0; i < len; i++) {
        var v = arrayLike[i];
        out.push(mapFn ? mapFn.call(thisArg, v, i) : v);
      }
      return out;
    };
  }

  /* Object.values(Chrome 54+) */
  if (typeof Object.values !== "function") {
    Object.values = function (o) {
      var out = [];
      for (var k in o) {
        if (Object.prototype.hasOwnProperty.call(o, k)) out.push(o[k]);
      }
      return out;
    };
  }

  /* String.prototype.includes(Chrome 41+) */
  if (typeof String.prototype.includes !== "function") {
    String.prototype.includes = function (s, pos) {
      return this.indexOf(s, pos || 0) !== -1;
    };
  }

  /* String.prototype.startsWith(Chrome 41+) */
  if (typeof String.prototype.startsWith !== "function") {
    String.prototype.startsWith = function (s, pos) {
      return this.substr(pos || 0, s.length) === s;
    };
  }

  /* String.prototype.endsWith(Chrome 41+) */
  if (typeof String.prototype.endsWith !== "function") {
    String.prototype.endsWith = function (s, pos) {
      var t = this.toString();
      var len = pos === undefined ? t.length : pos;
      return t.substring(len - s.length, len) === s;
    };
  }

  /* NodeList.forEach(Chrome 51+) */
  if (window.NodeList && typeof NodeList.prototype.forEach !== "function") {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
})();
