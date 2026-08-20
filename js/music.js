var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = function __defNormalProp(obj, key, value) {
  return key in obj ? __defProp(obj, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: value
  }) : obj[key] = value;
};
var __spreadValues = function __spreadValues(a, b) {
  for (var prop in b || (b = {})) if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols) for (var props = __getOwnPropSymbols(b), i = 0, n = props.length, prop; i < n; i++) {
    prop = props[i];
    if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  }
  return a;
};
(function () {
  "use strict";

  var DEFAULT_SONG = {
    id: 2129898729,
    name: "\u661F\u6CB3\u4E0D\u53CA\u4F60",
    artist: ""
  };
  function srcOf(id) {
    return "https://music.163.com/song/media/outer/url?id=" + id + ".mp3";
  }
  var audio = new Audio();
  audio.preload = "none";
  var track = null;
  try {
    var saved = JSON.parse(localStorage.getItem("mp-song") || "null");
    if (saved && saved.id) {
      track = {
        id: +saved.id,
        name: String(saved.name || "\u672A\u77E5\u6B4C\u66F2"),
        artist: String(saved.artist || "")
      };
    }
  } catch (e) {}
  if (!track) track = __spreadValues({}, DEFAULT_SONG);
  var queue = null;
  var qPos = -1;
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  var player = document.createElement("div");
  player.className = "music-player";
  player.innerHTML = "\n    <div class=\"mp-disc\" id=\"mp-disc\">\uD83C\uDFB5</div>\n    <div class=\"mp-info\">\n      <div class=\"mp-name\" id=\"mp-name\">\u52A0\u8F7D\u4E2D\u2026</div>\n      <div class=\"mp-artist\" id=\"mp-artist\"></div>\n    </div>\n    <button class=\"mp-btn\" id=\"mp-search-btn\" title=\"\u641C\u7D22/\u6B4C\u5355/\u767B\u5F55\">\uD83D\uDD0D</button>\n    <button class=\"mp-btn\" id=\"mp-next\" title=\"\u4E0B\u4E00\u9996(\u6B4C\u5355\u6A21\u5F0F)\" style=\"display:none;\">\u23ED</button>\n    <button class=\"mp-btn mp-play\" id=\"mp-play\" title=\"\u64AD\u653E/\u6682\u505C\">\u25B6</button>\n    <div class=\"mp-search-box\" id=\"mp-search-box\" style=\"display:none;\">\n      <div class=\"mp-search-tabs\">\n        <button type=\"button\" class=\"mp-tab-btn active\" data-tab=\"song\">\uD83C\uDFB5 \u6B4C\u66F2</button>\n        <button type=\"button\" class=\"mp-tab-btn\" data-tab=\"playlist\">\uD83D\uDCDA \u6B4C\u5355</button>\n        <button type=\"button\" class=\"mp-tab-btn\" data-tab=\"mine\">\uD83D\uDC64 \u6211\u7684</button>\n      </div>\n\n      <!-- \u6B4C\u66F2\u641C\u7D22 -->\n      <div class=\"mp-tab-panel\" data-panel=\"song\">\n        <div class=\"mp-search-row\">\n          <input class=\"mp-search-input\" type=\"text\" placeholder=\"\u641C\u7D22\u7F51\u6613\u4E91\u6B4C\u66F2\u2026\" maxlength=\"50\" />\n          <button class=\"mp-search-go\" type=\"button\">\u641C\u7D22</button>\n        </div>\n        <div class=\"mp-search-status\"></div>\n        <div class=\"mp-search-list\"></div>\n      </div>\n\n      <!-- \u6B4C\u5355\u641C\u7D22 / \u6B4C\u5355\u8BE6\u60C5 -->\n      <div class=\"mp-tab-panel\" data-panel=\"playlist\" style=\"display:none;\">\n        <div class=\"mp-search-row\">\n          <input class=\"mp-search-input\" type=\"text\" placeholder=\"\u641C\u7D22\u7F51\u6613\u4E91\u6B4C\u5355\u2026\" maxlength=\"50\" />\n          <button class=\"mp-search-go\" type=\"button\">\u641C\u7D22</button>\n        </div>\n        <div class=\"mp-pl-tools\">\n          <button class=\"mp-search-go\" type=\"button\" id=\"mp-mine-btn\">\uD83D\uDC64 \u6211\u7684\u6B4C\u5355</button>\n        </div>\n        <div class=\"mp-search-status\"></div>\n        <div class=\"mp-search-list\"></div>\n        <!-- \u6B4C\u5355\u8BE6\u60C5\u89C6\u56FE -->\n        <div class=\"mp-pl-detail\" style=\"display:none;\">\n          <div class=\"mp-pl-head\">\n            <button class=\"mp-search-go\" type=\"button\" id=\"mp-pl-back\">\u2190 \u8FD4\u56DE</button>\n            <span class=\"mp-pl-title\" id=\"mp-pl-title\"></span>\n          </div>\n          <button class=\"mp-pl-shuffle\" type=\"button\" id=\"mp-pl-shuffle\">\uD83C\uDFB2 \u968F\u673A\u64AD\u653E\u5168\u90E8</button>\n          <div class=\"mp-pl-songs\" id=\"mp-pl-songs\"></div>\n        </div>\n      </div>\n\n      <!-- \u6211\u7684(\u767B\u5F55 / \u6211\u7684\u6B4C\u5355) -->\n      <div class=\"mp-tab-panel\" data-panel=\"mine\" style=\"display:none;\">\n        <div class=\"mp-mine-login\" id=\"mp-mine-login\">\n          <div class=\"mp-mine-tip\">\u7C98\u8D34\u7F51\u6613\u4E91\u7F51\u9875\u7248\u7684 <b>MUSIC_U</b> \u5373\u53EF\u767B\u5F55,\u67E5\u770B\u81EA\u5DF1\u7684\u6B4C\u5355\u3002</div>\n          <details class=\"mp-mine-help\">\n            <summary>\uD83D\uDCD6 \u600E\u4E48\u83B7\u53D6 MUSIC_U?(\u70B9\u51FB\u5C55\u5F00)</summary>\n            <div class=\"mp-mine-help-body\">\n              <div class=\"mh-step\"><b>1.</b> \u7535\u8111\u6D4F\u89C8\u5668\u6253\u5F00 <a href=\"https://music.163.com\" target=\"_blank\" rel=\"noopener\">music.163.com</a> \u5E76\u767B\u5F55\u4F60\u7684\u7F51\u6613\u4E91\u8D26\u53F7</div>\n              <div class=\"mh-step\"><b>2.</b> \u6309\u952E\u76D8 <b>F12</b> \u6253\u5F00\u5F00\u53D1\u8005\u5DE5\u5177</div>\n              <div class=\"mh-step\"><b>3.</b> \u9876\u90E8\u9009\u300C<b>\u5E94\u7528 / Application</b>\u300D,\u5DE6\u4FA7\u9009\u300C<b>Cookies</b>\u300D</div>\n              <div class=\"mh-step\"><b>4.</b> \u5C55\u5F00 <b>https://music.163.com</b> \u2192 \u627E\u5230 <b>MUSIC_U</b> \u90A3\u4E00\u884C</div>\n              <div class=\"mh-step\"><b>5.</b> \u53CC\u51FB <b>Value</b> \u5168\u9009\u590D\u5236\u6574\u4E32\u5185\u5BB9</div>\n              <div class=\"mh-step\"><b>6.</b> \u7C98\u8D34\u5230\u4E0B\u9762\u8F93\u5165\u6846 \u2192 \u70B9\u300C\u767B\u5F55\u300D</div>\n              <div class=\"mh-warn\">\u26A0\uFE0F MUSIC_U \u662F\u767B\u5F55\u51ED\u8BC1,<b>\u4E0D\u8981\u53D1\u7ED9\u964C\u751F\u4EBA</b>;\u5931\u6548\u540E\u91CD\u65B0\u590D\u5236\u4E00\u6B21\u5373\u53EF\u3002</div>\n            </div>\n          </details>\n          <textarea class=\"mp-mine-input\" id=\"mp-mine-musicu\" rows=\"2\" placeholder=\"\u7C98\u8D34 MUSIC_U \u503C\u2026\"></textarea>\n          <button class=\"mp-search-go\" type=\"button\" id=\"mp-mine-login-btn\">\u767B\u5F55</button>\n        </div>\n        <div class=\"mp-mine-user\" id=\"mp-mine-user\" style=\"display:none;\">\n          <div class=\"mp-mine-tip\" id=\"mp-mine-nick\"></div>\n          <button class=\"mp-search-go\" type=\"button\" id=\"mp-mine-logout-btn\">\u9000\u51FA\u767B\u5F55</button>\n        </div>\n        <div class=\"mp-search-status\" id=\"mp-mine-status\"></div>\n        <div class=\"mp-search-list\" id=\"mp-mine-list\"></div>\n      </div>\n    </div>";
  document.body.appendChild(player);
  var disc = player.querySelector("#mp-disc");
  var nameEl = player.querySelector("#mp-name");
  var artistEl = player.querySelector("#mp-artist");
  var playBtn = player.querySelector("#mp-play");
  var nextBtn = player.querySelector("#mp-next");
  var searchBtn = player.querySelector("#mp-search-btn");
  var searchBox = player.querySelector("#mp-search-box");
  var openBtn = document.createElement("button");
  openBtn.className = "music-open";
  openBtn.id = "music-open";
  openBtn.textContent = "\uD83C\uDFB5 \u5F00\u542F\u80CC\u666F\u97F3\u4E50";
  document.body.appendChild(openBtn);
  function updateUI() {
    nameEl.textContent = track.name;
    artistEl.textContent = track.artist;
    playBtn.textContent = audio.paused ? "\u25B6" : "\u23F8";
    disc.classList.toggle("paused", audio.paused);
    nextBtn.style.display = queue ? "" : "none";
  }
  var SONG_KEY = "mp-song";
  var STATE_KEY = "mp-state";
  function saveProgress() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        id: track.id,
        t: audio.currentTime || 0,
        p: !audio.paused
      }));
    } catch (e) {}
  }
  window.addEventListener("pagehide", saveProgress);
  window.addEventListener("beforeunload", saveProgress);
  function restoreProgress() {
    var st = null;
    try {
      st = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    } catch (e) {}
    if (!st || !st.id || st.id !== track.id) return;
    var seekTo = function seekTo() {
      if (st.t > 1 && audio.duration && st.t < audio.duration - 3) {
        audio.currentTime = st.t;
      }
    };
    if (audio.readyState >= 1) seekTo();else audio.addEventListener("loadedmetadata", seekTo, {
      once: true
    });
  }
  function playTrack() {
    audio.src = srcOf(track.id);
    updateUI();
    var pr = audio.play();
    if (pr && pr.catch) {
      pr.then(function () {
        return openBtn.classList.remove("show");
      }).catch(function () {
        return openBtn.classList.add("show");
      });
    }
  }
  function setTrack(song) {
    queue = null;
    audio.loop = true;
    track = {
      id: +song.id,
      name: String(song.name || "\u672A\u77E5\u6B4C\u66F2"),
      artist: String(song.artist || "")
    };
    try {
      localStorage.setItem(SONG_KEY, JSON.stringify(track));
    } catch (e) {}
    saveProgress();
    playTrack();
  }
  function playListShuffle(songs) {
    queue = songs.filter(function (s) {
      return s && s.id;
    });
    if (!queue.length) return;
    audio.loop = false;
    queue = shuffleArr(queue);
    qPos = 0;
    playQueueAt(0);
  }
  function playQueueAt(i) {
    if (!queue || !queue.length) return;
    qPos = (i % queue.length + queue.length) % queue.length;
    setTrack(queue[qPos]);
    updateUI();
  }
  audio.addEventListener("ended", function () {
    if (queue) playQueueAt(qPos + 1);
  });
  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      return r.json();
    });
  }
  function renderPlaylists(listEl, playlists, onClick) {
    listEl.innerHTML = "";
    playlists.forEach(function (p) {
      var item = document.createElement("div");
      item.className = "mp-playlist-item";
      item.innerHTML = '\n        <img class="mpl-cover" src="'.concat(p.cover || "", '" alt="" onerror="this.style.visibility=\'hidden\'" />\n        <div class="mpl-info">\n          <div class="mpl-name"></div>\n          <div class="mpl-meta"></div>\n        </div>');
      item.querySelector(".mpl-name").textContent = p.name;
      item.querySelector(".mpl-meta").textContent = (p.trackCount ? p.trackCount + " \u9996 \xB7 " : "") + (p.playCount ? Math.round(p.playCount / 1e4) + " \u4E07\u6B21\u64AD\u653E" : "") + (p.creator ? " \xB7 " + p.creator : "");
      item.addEventListener("click", function () {
        return onClick(p);
      });
      listEl.appendChild(item);
    });
  }
  var panels = {
    song: searchBox.querySelector('[data-panel="song"]'),
    playlist: searchBox.querySelector('[data-panel="playlist"]'),
    mine: searchBox.querySelector('[data-panel="mine"]')
  };
  var statusEls = {
    song: panels.song.querySelector(".mp-search-status"),
    playlist: panels.playlist.querySelector(".mp-search-status")
  };
  var listEls = {
    song: panels.song.querySelector(".mp-search-list"),
    playlist: panels.playlist.querySelector(".mp-search-list")
  };
  var plDetail = panels.playlist.querySelector(".mp-pl-detail");
  var plTitle = panels.playlist.querySelector("#mp-pl-title");
  var plSongs = panels.playlist.querySelector("#mp-pl-songs");
  var currentTab = "song";
  function switchTab(tab) {
    currentTab = tab;
    searchBox.querySelectorAll(".mp-tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    Object.keys(panels).forEach(function (k) {
      panels[k].style.display = k === tab ? "" : "none";
    });
    if (tab === "mine") loadMine();
    if (tab === "playlist") showPlaylistSearch();
  }
  searchBox.querySelectorAll(".mp-tab-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      return switchTab(b.dataset.tab);
    });
  });
  function setStatus(which, text) {
    var el = statusEls[which];
    if (el) el.textContent = text || "";
  }
  var songInput = panels.song.querySelector(".mp-search-input");
  var songGo = panels.song.querySelector(".mp-search-go");
  function searchSongs(kw) {
    setStatus("song", "\uD83D\uDD0D \u641C\u7D22\u4E2D\u2026");
    listEls.song.innerHTML = "";
    fetchJSON("/api/music/search?q=" + encodeURIComponent(kw)).then(function (d) {
      if (!d.ok) {
        setStatus("song", d.error || "\u641C\u7D22\u5931\u8D25");
        return;
      }
      if (!d.songs || !d.songs.length) {
        setStatus("song", "\u6CA1\u6709\u627E\u5230\u76F8\u5173\u6B4C\u66F2");
        return;
      }
      setStatus("song", "");
      d.songs.forEach(function (s) {
        var item = document.createElement("div");
        item.className = "mp-search-item";
        var n = document.createElement("span");
        n.className = "msi-name";
        n.textContent = s.name;
        var a = document.createElement("span");
        a.className = "msi-artist";
        a.textContent = s.artist || "\u672A\u77E5\u6B4C\u624B";
        item.appendChild(n);
        item.appendChild(a);
        item.title = s.name + " - " + (s.artist || "");
        item.addEventListener("click", function () {
          setTrack(s);
          closeSearch();
        });
        listEls.song.appendChild(item);
      });
    }).catch(function () {
      return setStatus("song", "\u641C\u7D22\u5931\u8D25,\u8BF7\u68C0\u67E5\u7F51\u7EDC");
    });
  }
  songGo.addEventListener("click", function () {
    var kw = songInput.value.trim();
    if (kw) searchSongs(kw);
  });
  songInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var kw = songInput.value.trim();
      if (kw) searchSongs(kw);
    }
  });
  var plInput = panels.playlist.querySelector(".mp-search-input");
  var plGo = panels.playlist.querySelector(".mp-search-go");
  var currentPlaylist = null;
  function showPlaylistSearch() {
    plDetail.style.display = "none";
  }
  function searchPlaylists(kw) {
    plDetail.style.display = "none";
    setStatus("playlist", "\uD83D\uDD0D \u641C\u7D22\u4E2D\u2026");
    listEls.playlist.innerHTML = "";
    fetchJSON("/api/netease/search?q=" + encodeURIComponent(kw)).then(function (d) {
      if (!d.ok) {
        setStatus("playlist", d.error || "\u641C\u7D22\u5931\u8D25");
        return;
      }
      if (!d.playlists || !d.playlists.length) {
        setStatus("playlist", "\u6CA1\u6709\u627E\u5230\u76F8\u5173\u6B4C\u5355");
        return;
      }
      setStatus("playlist", "");
      renderPlaylists(listEls.playlist, d.playlists, openPlaylist);
    }).catch(function () {
      return setStatus("playlist", "\u641C\u7D22\u5931\u8D25,\u8BF7\u68C0\u67E5\u7F51\u7EDC");
    });
  }
  function openPlaylist(p) {
    currentPlaylist = p;
    listEls.playlist.innerHTML = "";
    setStatus("playlist", "");
    plDetail.style.display = "block";
    plTitle.textContent = p.name;
    plSongs.innerHTML = "<div class=\"mp-pl-loading\">\u52A0\u8F7D\u6B4C\u5355\u4E2D\u2026</div>";
    fetchJSON("/api/netease/playlist?id=" + p.id).then(function (d) {
      if (!d.ok) {
        plSongs.innerHTML = '<div class="mp-pl-loading">' + (d.error || "\u52A0\u8F7D\u5931\u8D25") + "</div>";
        return;
      }
      var tracks = d.playlist.tracks || [];
      plTitle.textContent = d.playlist.name + "\uFF08" + tracks.length + " \u9996\uFF09";
      plSongs.innerHTML = "";
      if (!tracks.length) {
        plSongs.innerHTML = "<div class=\"mp-pl-loading\">\u6B4C\u5355\u6682\u65E0\u6B4C\u66F2(\u53EF\u80FD\u6709\u7248\u6743\u9650\u5236)</div>";
        return;
      }
      tracks.forEach(function (s) {
        var item = document.createElement("div");
        item.className = "mp-search-item";
        var n = document.createElement("span");
        n.className = "msi-name";
        n.textContent = s.name;
        var a = document.createElement("span");
        a.className = "msi-artist";
        a.textContent = s.artist || "\u672A\u77E5\u6B4C\u624B";
        item.appendChild(n);
        item.appendChild(a);
        item.title = s.name + " - " + (s.artist || "");
        item.addEventListener("click", function () {
          setTrack(s);
          closeSearch();
        });
        plSongs.appendChild(item);
      });
    }).catch(function () {
      plSongs.innerHTML = "<div class=\"mp-pl-loading\">\u52A0\u8F7D\u5931\u8D25,\u8BF7\u68C0\u67E5\u7F51\u7EDC</div>";
    });
  }
  panels.playlist.querySelector("#mp-pl-back").addEventListener("click", showPlaylistSearch);
  panels.playlist.querySelector("#mp-pl-shuffle").addEventListener("click", function () {
    if (currentPlaylist) {
      fetchJSON("/api/netease/playlist?id=" + currentPlaylist.id).then(function (d) {
        if (d.ok && d.playlist.tracks.length) {
          playListShuffle(d.playlist.tracks);
          closeSearch();
          nameEl.textContent = "\uD83C\uDFB2 " + track.name;
          artistEl.textContent = "\u6B4C\u5355\u968F\u673A\u64AD\u653E \xB7 " + d.playlist.tracks.length + " \u9996";
        } else {
          setStatus("playlist", d.error || "\u6B4C\u5355\u6682\u65E0\u6B4C\u66F2");
        }
      });
    }
  });
  panels.playlist.querySelector("#mp-mine-btn").addEventListener("click", function () {
    switchTab("mine");
    loadMine(true);
  });
  plGo.addEventListener("click", function () {
    var kw = plInput.value.trim();
    if (kw) searchPlaylists(kw);
  });
  plInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var kw = plInput.value.trim();
      if (kw) searchPlaylists(kw);
    }
  });
  var mineLoginBox = panels.mine.querySelector("#mp-mine-login");
  var mineUserBox = panels.mine.querySelector("#mp-mine-user");
  var mineNick = panels.mine.querySelector("#mp-mine-nick");
  var mineStatus = panels.mine.querySelector("#mp-mine-status");
  var mineList = panels.mine.querySelector("#mp-mine-list");
  var mineLoaded = false;
  function loadMine(force) {
    if (!force && mineLoaded) return;
    mineLoaded = true;
    fetchJSON("/api/netease/me").then(function (d) {
      if (d.loggedIn) {
        mineLoginBox.style.display = "none";
        mineUserBox.style.display = "";
        mineNick.textContent = "\uD83D\uDC4B " + (d.nickname || "\u7F51\u6613\u4E91\u7528\u6237") + " \u7684\u6B4C\u5355:";
        loadMineList();
      } else {
        mineUserBox.style.display = "none";
        mineLoginBox.style.display = "";
      }
    }).catch(function () {
      mineStatus.textContent = "\u7F51\u7EDC\u9519\u8BEF";
    });
  }
  function loadMineList() {
    mineStatus.textContent = "\u52A0\u8F7D\u6B4C\u5355\u4E2D\u2026";
    mineList.innerHTML = "";
    fetchJSON("/api/netease/mine").then(function (d) {
      if (!d.ok) {
        mineStatus.textContent = d.error || "\u52A0\u8F7D\u5931\u8D25";
        return;
      }
      mineStatus.textContent = "";
      if (!d.playlists.length) {
        mineList.innerHTML = "<div class=\"mp-pl-loading\">\u8FD8\u6CA1\u6709\u6B4C\u5355</div>";
        return;
      }
      renderPlaylists(mineList, d.playlists, openMinePlaylist);
    }).catch(function () {
      mineStatus.textContent = "\u52A0\u8F7D\u5931\u8D25,\u8BF7\u68C0\u67E5\u7F51\u7EDC";
    });
  }
  function openMinePlaylist(p) {
    switchTab("playlist");
    openPlaylist(p);
  }
  panels.mine.querySelector("#mp-mine-login-btn").addEventListener("click", function () {
    var musicu = panels.mine.querySelector("#mp-mine-musicu").value.trim();
    if (!musicu) {
      mineStatus.textContent = "\u8BF7\u5148\u7C98\u8D34 MUSIC_U \u503C";
      return;
    }
    mineStatus.textContent = "\u767B\u5F55\u4E2D\u2026";
    fetch("/api/netease/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        musicu: musicu
      })
    }).then(function (r) {
      return r.json();
    }).then(function (d) {
      if (!d.ok) {
        mineStatus.textContent = d.error || "\u767B\u5F55\u5931\u8D25";
        return;
      }
      mineStatus.textContent = "";
      mineLoaded = false;
      loadMine(true);
    }).catch(function () {
      mineStatus.textContent = "\u7F51\u7EDC\u9519\u8BEF,\u8BF7\u91CD\u8BD5";
    });
  });
  panels.mine.querySelector("#mp-mine-logout-btn").addEventListener("click", function () {
    fetch("/api/netease/logout", {
      method: "POST"
    }).then(function () {
      mineLoaded = false;
      mineUserBox.style.display = "none";
      mineLoginBox.style.display = "";
      mineStatus.textContent = "";
      mineList.innerHTML = "";
    });
  });
  function openSearch() {
    searchBox.style.display = "flex";
    if (currentTab === "song") panels.song.querySelector(".mp-search-input").focus();
  }
  function closeSearch() {
    searchBox.style.display = "none";
  }
  searchBtn.addEventListener("click", function () {
    if (searchBox.style.display === "none") openSearch();else closeSearch();
  });
  document.addEventListener("click", function (e) {
    if (searchBox.style.display !== "none" && !e.target.closest(".mp-search-box") && !e.target.closest("#mp-search-btn")) {
      closeSearch();
    }
  });
  audio.addEventListener("error", function () {
    nameEl.textContent = track.name + "(\u65E0\u6CD5\u64AD\u653E)";
    openBtn.classList.add("show");
  });
  playBtn.addEventListener("click", function () {
    if (audio.paused) {
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () {
        return openBtn.classList.add("show");
      });
    } else {
      audio.pause();
    }
    updateUI();
  });
  nextBtn.addEventListener("click", function () {
    if (queue) playQueueAt(qPos + 1);
  });
  openBtn.addEventListener("click", function () {
    var pr = audio.play();
    if (pr && pr.catch) pr.then(function () {
      return openBtn.classList.remove("show");
    }).catch(function () {});
    updateUI();
  });
  audio.addEventListener("play", function () {
    openBtn.classList.remove("show");
    updateUI();
  });
  audio.addEventListener("pause", updateUI);
  var dragState = {
    on: false,
    moved: false,
    sx: 0,
    sy: 0,
    lx: 0,
    ly: 0
  };
  try {
    var _saved = JSON.parse(localStorage.getItem("mp-pos") || "null");
    if (_saved && typeof _saved.left === "number" && typeof _saved.top === "number") {
      var w = player.offsetWidth;
      var h = player.offsetHeight;
      var left = Math.min(Math.max(_saved.left, 4), window.innerWidth - w - 4);
      var top = Math.min(Math.max(_saved.top, 4), window.innerHeight - h - 4);
      var inside = left >= 0 && top >= 0 && left + w <= window.innerWidth && top + h <= window.innerHeight;
      if (inside) {
        player.style.left = left + "px";
        player.style.top = top + "px";
        player.style.right = "auto";
        player.style.bottom = "auto";
      } else {
        localStorage.removeItem("mp-pos");
      }
    }
  } catch (e) {}
  function dragDown(e) {
    if (e.target.closest("button") || e.target.closest(".mp-search-box")) return;
    var t = e.touches ? e.touches[0] : e;
    dragState.on = true;
    dragState.moved = false;
    dragState.sx = t.clientX;
    dragState.sy = t.clientY;
    var rect = player.getBoundingClientRect();
    if (!player.style.left || player.style.left === "auto") {
      player.style.left = rect.left + "px";
      player.style.top = rect.top + "px";
      player.style.right = "auto";
      player.style.bottom = "auto";
    }
    dragState.lx = parseFloat(player.style.left);
    dragState.ly = parseFloat(player.style.top);
    player.classList.add("dragging");
    if (e.cancelable) e.preventDefault();
  }
  function dragMove(e) {
    if (!dragState.on) return;
    var t = e.touches ? e.touches[0] : e;
    var dx = t.clientX - dragState.sx;
    var dy = t.clientY - dragState.sy;
    if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 5) dragState.moved = true;
    if (!dragState.moved) return;
    var w = player.offsetWidth;
    var h = player.offsetHeight;
    var nx = Math.min(Math.max(dragState.lx + dx, 4), window.innerWidth - w - 4);
    var ny = Math.min(Math.max(dragState.ly + dy, 4), window.innerHeight - h - 4);
    player.style.left = nx + "px";
    player.style.top = ny + "px";
    if (e.cancelable) e.preventDefault();
  }
  function dragUp() {
    if (!dragState.on) return;
    dragState.on = false;
    player.classList.remove("dragging");
    if (dragState.moved) {
      try {
        localStorage.setItem("mp-pos", JSON.stringify({
          left: parseFloat(player.style.left),
          top: parseFloat(player.style.top)
        }));
      } catch (e) {}
    }
  }
  player.addEventListener("mousedown", dragDown);
  document.addEventListener("mousemove", dragMove);
  document.addEventListener("mouseup", dragUp);
  player.addEventListener("touchstart", dragDown, {
    passive: false
  });
  document.addEventListener("touchmove", dragMove, {
    passive: false
  });
  document.addEventListener("touchend", dragUp, {
    passive: false
  });
  window.addEventListener("load", function () {
    playTrack();
    restoreProgress();
  });
  function startOnFirstInteract() {
    if (audio.paused) {
      var pr = audio.play();
      if (pr && pr.catch) pr.then(function () {
        return openBtn.classList.remove("show");
      }).catch(function () {});
      updateUI();
    }
    ["click", "touchstart", "keydown"].forEach(function (ev) {
      return document.removeEventListener(ev, startOnFirstInteract);
    });
  }
  ["click", "touchstart", "keydown"].forEach(function (ev) {
    return document.addEventListener(ev, startOnFirstInteract);
  });
})();
