var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
var __spreadProps = function __spreadProps(a, b) {
  return __defProps(a, __getOwnPropDescs(b));
};
var SITE_DATA = {
  /* —— 工具导航(按分类) —— */
  tools: [{
    category: "\u5F00\u53D1\u5DE5\u5177",
    icon: "\uD83D\uDCBB",
    desc: "\u5199\u4EE3\u7801\u3001\u9020\u8F6E\u5B50\u3001\u4E0A\u5F00\u6E90",
    color: ["#4f6ef7", "#7c5cff"],
    items: [{
      name: "GitHub",
      url: "https://github.com",
      desc: "\u5168\u7403\u6700\u5927\u4EE3\u7801\u6258\u7BA1\u5E73\u53F0",
      icon: "\uD83D\uDC19",
      tag: "\u63A8\u8350"
    }, {
      name: "Stack Overflow",
      url: "https://stackoverflow.com",
      desc: "\u7A0B\u5E8F\u5458\u95EE\u7B54\u793E\u533A",
      icon: "\uD83D\uDCDA"
    }, {
      name: "MDN Web Docs",
      url: "https://developer.mozilla.org",
      desc: "Web \u5F00\u53D1\u6743\u5A01\u6587\u6863",
      icon: "\uD83D\uDCD6"
    }, {
      name: "\u83DC\u9E1F\u6559\u7A0B",
      url: "https://www.runoob.com",
      desc: "\u7F16\u7A0B\u5165\u95E8\u5B66\u4E60\u6559\u7A0B",
      icon: "\uD83D\uDC26"
    }, {
      name: "LeetCode",
      url: "https://leetcode.cn",
      desc: "\u7B97\u6CD5\u5237\u9898\u5E73\u53F0",
      icon: "\uD83D\uDCBB"
    }, {
      name: "V2EX",
      url: "https://www.v2ex.com",
      desc: "\u521B\u610F\u5DE5\u4F5C\u8005\u793E\u533A",
      icon: "\uD83D\uDCAC"
    }]
  }, {
    category: "\u5728\u7EBF\u5DE5\u5177",
    icon: "\uD83D\uDD27",
    desc: "\u6253\u5F00\u5373\u7528,\u65E0\u9700\u5B89\u88C5",
    color: ["#0ea5e9", "#22d3ee"],
    items: [{
      name: "JSON \u89E3\u6790",
      url: "https://www.json.cn",
      desc: "\u5728\u7EBF JSON \u683C\u5F0F\u5316",
      icon: "\uD83D\uDD27"
    }, {
      name: "TinyPNG",
      url: "https://tinypng.com",
      desc: "\u56FE\u7247\u65E0\u635F\u538B\u7F29",
      icon: "\uD83D\uDDBC\uFE0F"
    }, {
      name: "\u8349\u6599\u4E8C\u7EF4\u7801",
      url: "https://cli.im",
      desc: "\u4E8C\u7EF4\u7801\u751F\u6210\u5668",
      icon: "\uD83D\uDD33"
    }, {
      name: "Convertio",
      url: "https://convertio.co",
      desc: "\u6587\u4EF6\u683C\u5F0F\u5728\u7EBF\u8F6C\u6362",
      icon: "\uD83D\uDD04"
    }, {
      name: "\u5728\u7EBF PS",
      url: "https://www.gaoding.com",
      desc: "\u5728\u7EBF\u56FE\u7247\u7F16\u8F91",
      icon: "\uD83C\uDFA8"
    }]
  }, {
    category: "\u8BBE\u8BA1\u5DE5\u5177",
    icon: "\uD83C\uDFA8",
    desc: "\u7075\u611F\u4E0E\u50CF\u7D20\u7684\u78B0\u649E",
    color: ["#d946ef", "#ec4899"],
    items: [{
      name: "Figma",
      url: "https://www.figma.com",
      desc: "UI \u534F\u4F5C\u8BBE\u8BA1\u5DE5\u5177",
      icon: "\uD83C\uDFA8",
      tag: "\u63A8\u8350"
    }, {
      name: "Canva",
      url: "https://www.canva.cn",
      desc: "\u5728\u7EBF\u5E73\u9762\u8BBE\u8BA1",
      icon: "\u2728"
    }, {
      name: "\u7A3F\u5B9A\u8BBE\u8BA1",
      url: "https://www.gaoding.com",
      desc: "\u7535\u5546\u8BBE\u8BA1\u6A21\u677F",
      icon: "\uD83D\uDD8C\uFE0F"
    }, {
      name: "\u82B1\u74E3\u7F51",
      url: "https://huaban.com",
      desc: "\u8BBE\u8BA1\u5E08\u7075\u611F\u91C7\u96C6",
      icon: "\uD83C\uDF38"
    }, {
      name: "\u7AD9\u9177",
      url: "https://www.zcool.com.cn",
      desc: "\u8BBE\u8BA1\u5E08\u4F5C\u54C1\u793E\u533A",
      icon: "\uD83C\uDFD4\uFE0F"
    }]
  }, {
    category: "\u6548\u7387\u529E\u516C",
    icon: "\uD83D\uDCDD",
    desc: "\u534F\u4F5C\u529E\u516C,\u6548\u7387\u7FFB\u500D",
    color: ["#10b981", "#34d399"],
    items: [{
      name: "\u77F3\u58A8\u6587\u6863",
      url: "https://shimo.im",
      desc: "\u5728\u7EBF\u534F\u4F5C\u6587\u6863",
      icon: "\uD83D\uDCDD"
    }, {
      name: "\u8BED\u96C0",
      url: "https://www.yuque.com",
      desc: "\u77E5\u8BC6\u5E93\u4E0E\u6587\u6863",
      icon: "\uD83D\uDCD3"
    }, {
      name: "Notion",
      url: "https://www.notion.so",
      desc: "\u4E00\u4F53\u5316\u7B14\u8BB0\u7BA1\u7406",
      icon: "\uD83D\uDDC2\uFE0F"
    }, {
      name: "\u98DE\u4E66",
      url: "https://www.feishu.cn",
      desc: "\u4F01\u4E1A\u534F\u4F5C\u5E73\u53F0",
      icon: "\uD83E\uDE81"
    }, {
      name: "\u817E\u8BAF\u6587\u6863",
      url: "https://docs.qq.com",
      desc: "\u817E\u8BAF\u5728\u7EBF\u6587\u6863",
      icon: "\uD83D\uDCC4"
    }]
  }, {
    category: "AI \u5DE5\u5177",
    icon: "\uD83E\uDD16",
    desc: "\u667A\u80FD\u65F6\u4EE3,\u5BF9\u8BDD\u5373\u751F\u4EA7\u529B",
    color: ["#8b5cf6", "#d946ef"],
    items: [{
      name: "ChatGPT",
      url: "https://chat.openai.com",
      desc: "OpenAI \u5BF9\u8BDD\u52A9\u624B",
      icon: "\uD83E\uDD16",
      tag: "\u70ED\u95E8"
    }, {
      name: "\u6587\u5FC3\u4E00\u8A00",
      url: "https://yiyan.baidu.com",
      desc: "\u767E\u5EA6\u5927\u6A21\u578B\u52A9\u624B",
      icon: "\uD83E\uDDE0"
    }, {
      name: "\u901A\u4E49\u5343\u95EE",
      url: "https://tongyi.aliyun.com",
      desc: "\u963F\u91CC\u5927\u6A21\u578B\u52A9\u624B",
      icon: "\uD83D\uDCA1"
    }, {
      name: "Kimi",
      url: "https://kimi.moonshot.cn",
      desc: "\u957F\u6587\u672C\u667A\u80FD\u52A9\u624B",
      icon: "\uD83D\uDE80"
    }, {
      name: "\u8C46\u5305",
      url: "https://www.doubao.com",
      desc: "\u5B57\u8282\u8DF3\u52A8 AI \u52A9\u624B",
      icon: "\uD83E\uDED8"
    }]
  }, {
    category: "\u8F6F\u4EF6\u4E0B\u8F7D",
    icon: "\u2B07\uFE0F",
    desc: "\u6B63\u7248\u8F6F\u4EF6,\u5B89\u5FC3\u4E0B\u8F7D",
    color: ["#f59e0b", "#f97316"],
    items: [{
      name: "\u817E\u8BAF\u8F6F\u4EF6\u4E2D\u5FC3",
      url: "https://pc.qq.com",
      desc: "\u6B63\u7248\u8F6F\u4EF6\u4E0B\u8F7D",
      icon: "\u2B07\uFE0F"
    }, {
      name: "\u534E\u519B\u8F6F\u4EF6\u56ED",
      url: "https://www.onlinedown.net",
      desc: "\u8F6F\u4EF6\u4E0B\u8F7D\u7AD9",
      icon: "\uD83D\uDDC2\uFE0F"
    }, {
      name: "\u5FAE\u8F6F\u5B98\u65B9\u4E0B\u8F7D",
      url: "https://www.microsoft.com/zh-cn/software-download",
      desc: "Windows/Office \u4E0B\u8F7D",
      icon: "\uD83E\uDE9F"
    }, {
      name: "360 \u8F6F\u4EF6\u7BA1\u5BB6",
      url: "https://www.360.cn",
      desc: "\u8F6F\u4EF6\u7BA1\u7406\u5DE5\u5177",
      icon: "\uD83E\uDDF0"
    }]
  }],
  /* —— 游戏导航(按分类) —— */
  games: [{
    category: "\u6211\u7684\u4E16\u754C\u4E13\u533A",
    icon: "\u26CF\uFE0F",
    desc: "\u65B9\u5757\u4E16\u754C,\u8D44\u6E90\u4E00\u7AD9\u96C6\u9F50",
    color: ["#22c55e", "#84cc16"],
    items: [{
      name: "Minecraft \u5B98\u7F51",
      url: "https://www.minecraft.net/zh-hans",
      desc: "\u5B98\u65B9\u6E38\u620F\u5B98\u7F51",
      icon: "\u26CF\uFE0F",
      tag: "\u5B98\u65B9"
    }, {
      name: "\u4E2D\u6587 Minecraft Wiki",
      url: "https://zh.minecraft.wiki",
      desc: "\u6700\u5168\u65B9\u5757\u767E\u79D1",
      icon: "\uD83D\uDCD6",
      tag: "\u63A8\u8350"
    }, {
      name: "MC\u767E\u79D1",
      url: "https://www.mcmod.cn",
      desc: "\u6A21\u7EC4/\u6574\u5408\u5305\u767E\u79D1",
      icon: "\uD83D\uDCDA"
    }, {
      name: "CurseForge",
      url: "https://www.curseforge.com/minecraft",
      desc: "\u5168\u7403\u6700\u5927\u6A21\u7EC4\u5E73\u53F0",
      icon: "\uD83E\uDDE9"
    }, {
      name: "Modrinth",
      url: "https://modrinth.com",
      desc: "\u73B0\u4EE3\u8F7B\u91CF\u6A21\u7EC4\u5E73\u53F0",
      icon: "\uD83D\uDD2E"
    }, {
      name: "\u82E6\u529B\u6015\u8BBA\u575B",
      url: "https://www.klpbbs.com",
      desc: "\u4E2D\u6587 MC \u73A9\u5BB6\u793E\u533A",
      icon: "\uD83D\uDCAC"
    }, {
      name: "XyeBBS",
      url: "https://www.xyebbs.com",
      desc: "MC \u8D44\u6E90\u793E\u533A",
      icon: "\uD83E\uDDE9",
      tag: "30W+"
    }, {
      name: "NameMC",
      url: "https://namemc.com",
      desc: "\u76AE\u80A4/\u62AB\u98CE/\u6539\u540D\u67E5\u8BE2",
      icon: "\uD83D\uDC64"
    }, {
      name: "LittleSkin",
      url: "https://littleskin.cn",
      desc: "\u514D\u8D39\u76AE\u80A4\u7AD9",
      icon: "\uD83C\uDFA8"
    }, {
      name: "HMCL \u542F\u52A8\u5668",
      url: "https://hmcl.huangyuhui.net",
      desc: "\u7B2C\u4E09\u65B9\u542F\u52A8\u5668",
      icon: "\uD83D\uDE80"
    }, {
      name: "PCL2 \u7231\u53D1\u7535",
      url: "https://afdian.com/p/520b5b9c296b11f19d5c52540025c377",
      desc: "PCL2 \u4F5C\u8005\u8D5E\u52A9\u652F\u6301\u9875",
      icon: "\u2764\uFE0F",
      tag: "\u70ED"
    }, {
      name: "PCL2 GitHub",
      url: "https://github.com/Hex-Dragon/PCL2",
      desc: "PCL2 \u5B98\u65B9\u5F00\u6E90\u4ED3\u5E93",
      icon: "\uD83D\uDC19"
    }, {
      name: "QQ \u4EA4\u6D41\u7FA4",
      url: "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=935977221",
      desc: "\u7FA4\u53F7 935977221,\u70B9\u51FB\u52A0\u7FA4",
      icon: "\uD83D\uDC27",
      tag: "\u52A0\u7FA4",
      noblank: true
    }, {
      name: "\u7F51\u6613\u6211\u7684\u4E16\u754C",
      url: "https://mc.163.com",
      desc: "\u4E2D\u56FD\u7248\u5B98\u7F51",
      icon: "\uD83E\uDDF1"
    }]
  }, {
    category: "\u6CF0\u62C9\u745E\u4E9A\u4E13\u533A",
    icon: "\uD83C\uDF1E",
    desc: "\u6316\u6398\u3001\u5EFA\u9020\u3001\u6218\u6597\u7684\u6C99\u76D2\u5192\u9669",
    color: ["#f97316", "#ef4444"],
    items: [{
      name: "Terraria \u5B98\u7F51",
      url: "https://terraria.org",
      desc: "\u5B98\u65B9\u6E38\u620F\u5B98\u7F51",
      icon: "\uD83C\uDF1E",
      tag: "\u5B98\u65B9"
    }, {
      name: "Steam \u5546\u5E97\u9875",
      url: "https://store.steampowered.com/app/105600/Terraria/",
      desc: "Steam \u8D2D\u4E70\u4E0E\u4E0B\u8F7D",
      icon: "\uD83C\uDFAE",
      tag: "\u63A8\u8350"
    }, {
      name: "\u6CF0\u62C9\u745E\u4E9A\u4E2D\u6587 Wiki",
      url: "https://terraria.wiki.gg/zh",
      desc: "\u88C5\u5907/Boss/\u5408\u6210\u5168\u767E\u79D1",
      icon: "\uD83D\uDCD6"
    }, {
      name: "tModLoader",
      url: "https://store.steampowered.com/app/1281930/tModLoader/",
      desc: "\u5B98\u65B9\u6A21\u7EC4\u52A0\u8F7D\u5668",
      icon: "\uD83D\uDD27"
    }, {
      name: "Terraria \u5B98\u65B9\u8BBA\u575B",
      url: "https://forums.terraria.org",
      desc: "\u5B98\u65B9\u73A9\u5BB6\u793E\u533A",
      icon: "\uD83D\uDCAC"
    }, {
      name: "\u6CF0\u62C9\u745E\u4E9A\u8D34\u5427",
      url: "https://tieba.baidu.com/f?kw=terraria",
      desc: "\u4E2D\u6587\u73A9\u5BB6\u805A\u96C6\u5730",
      icon: "\uD83D\uDCF1"
    }]
  }, {
    category: "\u6E38\u620F\u5E73\u53F0",
    icon: "\uD83C\uDFAE",
    desc: "\u4F60\u7684\u6E38\u620F,\u4E00\u7AD9\u76F4\u8FBE",
    color: ["#ef4444", "#f97316"],
    items: [{
      name: "Steam",
      url: "https://store.steampowered.com",
      desc: "\u5168\u7403\u6700\u5927 PC \u6E38\u620F\u5E73\u53F0",
      icon: "\uD83C\uDFAE",
      tag: "\u63A8\u8350"
    }, {
      name: "Epic Games",
      url: "https://www.epicgames.com",
      desc: "\u6BCF\u5468\u514D\u8D39\u9886\u6E38\u620F",
      icon: "\uD83C\uDFAF",
      tag: "\u514D\u8D39"
    }, {
      name: "TapTap",
      url: "https://www.taptap.cn",
      desc: "\u624B\u6E38\u793E\u533A\u4E0E\u4E0B\u8F7D",
      icon: "\uD83D\uDCF1"
    }, {
      name: "WeGame",
      url: "https://www.wegame.com.cn",
      desc: "\u817E\u8BAF\u6E38\u620F\u5E73\u53F0",
      icon: "\uD83D\uDC27"
    }, {
      name: "\u80B2\u78A7 Ubisoft",
      url: "https://www.ubisoft.com",
      desc: "\u80B2\u78A7\u6E38\u620F\u5E73\u53F0",
      icon: "\uD83C\uDF96\uFE0F"
    }]
  }, {
    category: "\u6E38\u620F\u4E0B\u8F7D",
    icon: "\u2B07\uFE0F",
    desc: "\u5927\u4F5C\u65B0\u6E38,\u4E00\u952E\u83B7\u53D6",
    color: ["#3b82f6", "#06b6d4"],
    items: [{
      name: "Steam \u4E0B\u8F7D",
      url: "https://store.steampowered.com/about/",
      desc: "Steam \u5BA2\u6237\u7AEF\u4E0B\u8F7D",
      icon: "\uD83C\uDFAE"
    }, {
      name: "Epic \u4E0B\u8F7D",
      url: "https://www.epicgames.com/store/zh-CN/download",
      desc: "Epic \u5BA2\u6237\u7AEF\u4E0B\u8F7D",
      icon: "\uD83C\uDFAF"
    }, {
      name: "3DM",
      url: "https://www.3dmgame.com",
      desc: "\u5355\u673A\u6E38\u620F\u4E0B\u8F7D",
      icon: "\u2B07\uFE0F"
    }, {
      name: "\u6E38\u4FA0\u7F51",
      url: "https://www.ali213.net",
      desc: "\u5355\u673A\u6E38\u620F\u4E0B\u8F7D",
      icon: "\uD83D\uDDE1\uFE0F"
    }, {
      name: "\u6E38\u6C11\u661F\u7A7A",
      url: "https://www.gamersky.com",
      desc: "\u6E38\u620F\u8D44\u8BAF\u4E0E\u4E0B\u8F7D",
      icon: "\uD83C\uDF0C"
    }]
  }, {
    category: "\u7F51\u9875\u6E38\u620F",
    icon: "\uD83D\uDD79\uFE0F",
    desc: "\u65E0\u9700\u4E0B\u8F7D,\u6253\u5F00\u5373\u73A9",
    color: ["#f97316", "#fbbf24"],
    items: [{
      name: "4399 \u5C0F\u6E38\u620F",
      url: "https://www.4399.com",
      desc: "\u5728\u7EBF\u5C0F\u6E38\u620F\u5E73\u53F0",
      icon: "\uD83D\uDD79\uFE0F"
    }, {
      name: "7k7k \u5C0F\u6E38\u620F",
      url: "https://www.7k7k.com",
      desc: "\u5728\u7EBF\u5C0F\u6E38\u620F",
      icon: "\uD83C\uDFB2"
    }, {
      name: "\u5C0F\u9738\u738B\u5176\u4E50\u65E0\u7A77",
      url: "https://www.yikm.net",
      desc: "\u6000\u65E7\u7EA2\u767D\u673A\u6E38\u620F",
      icon: "\uD83D\uDD79\uFE0F"
    }]
  }, {
    category: "\u6E38\u620F\u8D44\u8BAF",
    icon: "\uD83D\uDCF0",
    desc: "\u5708\u5185\u70ED\u70B9,\u5C3D\u5728\u638C\u63E1",
    color: ["#64748b", "#94a3b8"],
    items: [{
      name: "IGN \u4E2D\u56FD",
      url: "https://www.ign.com.cn",
      desc: "\u6E38\u620F\u8BC4\u6D4B\u4E0E\u8D44\u8BAF",
      icon: "\uD83D\uDCF0"
    }, {
      name: "\u6E38\u6C11\u661F\u7A7A",
      url: "https://www.gamersky.com",
      desc: "\u6E38\u620F\u7EFC\u5408\u8D44\u8BAF",
      icon: "\uD83C\uDF0C"
    }, {
      name: "NGA",
      url: "https://nga.cn",
      desc: "\u6E38\u620F\u73A9\u5BB6\u793E\u533A",
      icon: "\uD83D\uDCAC"
    }, {
      name: "\u673A\u6838\u7F51",
      url: "https://www.gcores.com",
      desc: "\u6E38\u620F\u6587\u5316\u7535\u53F0",
      icon: "\uD83C\uDF99\uFE0F"
    }]
  }],
  /* —— 音乐导航(按分类) —— */
  music: [{
    category: "\u534E\u8BED\u97F3\u4E50\u5E73\u53F0",
    icon: "\uD83C\uDFB5",
    desc: "\u60F3\u542C\u7684\u6B4C,\u8FD9\u91CC\u90FD\u6709",
    color: ["#ef4444", "#f97316"],
    items: [{
      name: "\u7F51\u6613\u4E91\u97F3\u4E50",
      url: "https://music.163.com",
      desc: "\u60C5\u6000\u4E0E\u6B4C\u5355",
      icon: "\uD83C\uDFB5",
      tag: "\u63A8\u8350"
    }, {
      name: "QQ \u97F3\u4E50",
      url: "https://y.qq.com",
      desc: "\u817E\u8BAF\u97F3\u4E50\u5E73\u53F0",
      icon: "\uD83D\uDC27"
    }, {
      name: "\u9177\u72D7\u97F3\u4E50",
      url: "https://www.kugou.com",
      desc: "\u6D77\u91CF\u66F2\u5E93",
      icon: "\uD83D\uDC36"
    }, {
      name: "\u9177\u6211\u97F3\u4E50",
      url: "https://www.kuwo.cn",
      desc: "\u8001\u724C\u97F3\u4E50\u5E73\u53F0",
      icon: "\uD83C\uDFA7"
    }, {
      name: "\u54AA\u5495\u97F3\u4E50",
      url: "https://music.migu.cn",
      desc: "\u6B63\u7248\u65E0\u635F\u97F3\u4E50",
      icon: "\uD83C\uDFBC"
    }, {
      name: "\u6C7D\u6C34\u97F3\u4E50",
      url: "https://music.douyin.com",
      desc: "\u6296\u97F3\u65D7\u4E0B\u97F3\u4E50",
      icon: "\uD83E\uDD64"
    }]
  }, {
    category: "\u56FD\u9645\u97F3\u4E50\u5E73\u53F0",
    icon: "\uD83C\uDF0D",
    desc: "\u5168\u7403\u97F3\u4E50,\u4E00\u7F51\u6253\u5C3D",
    color: ["#3b82f6", "#06b6d4"],
    items: [{
      name: "Spotify",
      url: "https://open.spotify.com",
      desc: "\u5168\u7403\u6700\u5927\u6D41\u5A92\u4F53\u97F3\u4E50",
      icon: "\uD83D\uDFE2",
      tag: "\u70ED\u95E8"
    }, {
      name: "Apple Music",
      url: "https://music.apple.com",
      desc: "\u82F9\u679C\u97F3\u4E50\u670D\u52A1",
      icon: "\uD83C\uDF4E"
    }, {
      name: "YouTube Music",
      url: "https://music.youtube.com",
      desc: "\u8C37\u6B4C\u97F3\u4E50\u670D\u52A1",
      icon: "\u25B6\uFE0F"
    }, {
      name: "SoundCloud",
      url: "https://soundcloud.com",
      desc: "\u72EC\u7ACB\u97F3\u4E50\u4EBA\u793E\u533A",
      icon: "\u2601\uFE0F"
    }]
  }, {
    category: "\u7535\u53F0\u4E0E\u6709\u58F0",
    icon: "\uD83D\uDCFB",
    desc: "\u542C\u7535\u53F0\u3001\u542C\u4E66\u3001\u542C\u4E16\u754C",
    color: ["#8b5cf6", "#d946ef"],
    items: [{
      name: "\u559C\u9A6C\u62C9\u96C5",
      url: "https://www.ximalaya.com",
      desc: "\u6709\u58F0\u4E66\u4E0E\u7535\u53F0",
      icon: "\uD83D\uDCFB",
      tag: "\u63A8\u8350"
    }, {
      name: "\u8354\u679DFM",
      url: "https://www.lizhi.fm",
      desc: "\u8F7B\u7535\u53F0\u793E\u533A",
      icon: "\uD83C\uDF99\uFE0F"
    }, {
      name: "\u873B\u8713FM",
      url: "https://www.qingting.fm",
      desc: "\u7F51\u7EDC\u7535\u53F0\u805A\u5408",
      icon: "\uD83E\uDD9F"
    }]
  }, {
    category: "\u6B4C\u8BCD\u4E0E\u8BC6\u522B",
    icon: "\uD83D\uDD0D",
    desc: "\u627E\u6B4C\u8BCD\u3001\u8BC6\u6B4C\u66F2",
    color: ["#10b981", "#34d399"],
    items: [{
      name: "Musixmatch",
      url: "https://www.musixmatch.com",
      desc: "\u5168\u7403\u6B4C\u8BCD\u5E93",
      icon: "\uD83D\uDCDD"
    }, {
      name: "Shazam",
      url: "https://www.shazam.com",
      desc: "\u542C\u6B4C\u8BC6\u66F2\u795E\u5668",
      icon: "\uD83D\uDCF1",
      tag: "\u5B9E\u7528"
    }]
  }],
  /* —— 联系与社交 —— */
  contacts: [{
    name: "\u90AE\u7BB1",
    url: "mailto:13584534484@163.com",
    desc: "13584534484@163.com",
    icon: "\uD83D\uDCE7"
  }, {
    name: "QQ",
    url: "https://wpa.qq.com/msgrd?v=3&uin=3037347653&site=qq&menu=yes",
    desc: "3037347653",
    icon: "\uD83D\uDC27"
  }],
  /* —— 首页热门推荐 —— */
  hot: [{
    name: "GitHub",
    url: "https://github.com",
    desc: "\u4EE3\u7801\u6258\u7BA1\u5E73\u53F0",
    icon: "\uD83D\uDC19"
  }, {
    name: "ChatGPT",
    url: "https://chat.openai.com",
    desc: "AI \u5BF9\u8BDD\u52A9\u624B",
    icon: "\uD83E\uDD16"
  }, {
    name: "Steam",
    url: "https://store.steampowered.com",
    desc: "PC \u6E38\u620F\u5E73\u53F0",
    icon: "\uD83C\uDFAE"
  }, {
    name: "Figma",
    url: "https://www.figma.com",
    desc: "UI \u8BBE\u8BA1\u5DE5\u5177",
    icon: "\uD83C\uDFA8"
  }, {
    name: "LeetCode",
    url: "https://leetcode.cn",
    desc: "\u7B97\u6CD5\u5237\u9898",
    icon: "\uD83D\uDCBB"
  }, {
    name: "Notion",
    url: "https://www.notion.so",
    desc: "\u7B14\u8BB0\u7BA1\u7406",
    icon: "\uD83D\uDDC2\uFE0F"
  }, {
    name: "Epic Games",
    url: "https://www.epicgames.com",
    desc: "\u6BCF\u5468\u514D\u8D39\u6E38\u620F",
    icon: "\uD83C\uDFAF"
  }, {
    name: "\u8BED\u96C0",
    url: "https://www.yuque.com",
    desc: "\u77E5\u8BC6\u5E93\u6587\u6863",
    icon: "\uD83D\uDCD3"
  }]
};
function getAllLinks() {
  var list = [];
  SITE_DATA.tools.forEach(function (c) {
    return c.items.forEach(function (it) {
      return list.push(__spreadProps(__spreadValues({}, it), {
        type: "tool",
        category: c.category
      }));
    });
  });
  SITE_DATA.games.forEach(function (c) {
    return c.items.forEach(function (it) {
      return list.push(__spreadProps(__spreadValues({}, it), {
        type: "game",
        category: c.category
      }));
    });
  });
  SITE_DATA.music.forEach(function (c) {
    return c.items.forEach(function (it) {
      return list.push(__spreadProps(__spreadValues({}, it), {
        type: "music",
        category: c.category
      }));
    });
  });
  return list;
}
function cardHTML(item) {
  var icon = item.icon || (item.name || "?").charAt(0);
  var tag = item.tag ? '<span class="card-tag">'.concat(item.tag, "</span>") : "";
  var desc = item.desc ? '<div class="card-desc">'.concat(item.desc, "</div>") : "";
  var blank = item.noblank ? "" : ' target="_blank" rel="noopener"';
  return '\n    <a class="card" href="'.concat(item.url, '"').concat(blank, ">\n      ").concat(tag, '\n      <div class="card-icon">').concat(icon, '</div>\n      <div class="card-body">\n        <div class="card-title">').concat(item.name, "</div>\n        ").concat(desc, "\n      </div>\n    </a>");
}
function renderCategories(containerId, data, hideOnEmpty) {
  if (hideOnEmpty === void 0) hideOnEmpty = true;
  var container = document.getElementById(containerId);
  if (!container) return;
  var html = "";
  data.forEach(function (cat) {
    if (hideOnEmpty && cat.items.length === 0) return;
    var color = cat.color || ["#4f6ef7", "#7c5cff"];
    var c1 = color[0];
    var c2 = color[1];
    var bgStyle = cat.bg ? "background-image:url('".concat(cat.bg, "');background-size:cover;background-position:center;background-color:rgba(0,0,0,0.35);background-blend-mode:multiply;") : "background:linear-gradient(135deg, ".concat(c1, ", ").concat(c2, ");");
    html += '\n      <div class="category" data-category="'.concat(cat.category, '">\n        <div class="cat-banner" style="').concat(bgStyle, '" data-emoji="').concat(cat.icon || "\uD83D\uDD16", '">\n          <div class="cat-banner-icon">').concat(cat.icon || "\uD83D\uDD16", '</div>\n          <div class="cat-banner-info">\n            <h2>').concat(cat.category, "</h2>\n            <p>").concat(cat.desc || "\u5E38\u7528\u7AD9\u70B9,\u4E00\u952E\u76F4\u8FBE", '</p>\n          </div>\n          <span class="cat-banner-count">').concat(cat.items.length, " \u4E2A</span>\n        </div>\n        <div class=\"grid\">").concat(cat.items.map(cardHTML).join(""), "</div>\n      </div>");
  });
  container.innerHTML = html;
}
function renderGrid(containerId, items) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map(cardHTML).join("");
}
function renderContacts() {
  var container = document.getElementById("contacts-container");
  if (!container) return;
  container.innerHTML = SITE_DATA.contacts.map(function (it) {
    return '\n        <a class="social-card" href="'.concat(it.url, '" target="_blank" rel="noopener">\n          <div class="s-icon">').concat(it.icon || "\uD83D\uDD17", '</div>\n          <div class="s-body">\n            <div class="s-name">').concat(it.name, '</div>\n            <div class="s-value">').concat(it.desc || it.url, "</div>\n          </div>\n        </a>");
  }).join("");
}
function setupPageSearch() {
  var input = document.getElementById("search-input");
  if (!input) return;
  var scope = document.getElementById("search-scope");
  input.addEventListener("input", function () {
    var kw = input.value.trim().toLowerCase();
    var target = SITE_DATA.tools;
    if (scope) {
      if (scope.dataset.scope === "games") target = SITE_DATA.games;else if (scope.dataset.scope === "music") target = SITE_DATA.music;
    }
    var total = 0;
    target.forEach(function (cat) {
      var catEl = document.querySelector('.category[data-category="'.concat(cat.category, '"]'));
      if (!catEl) return;
      var shown = 0;
      var cards = catEl.querySelectorAll(".card");
      cards.forEach(function (card) {
        var text = card.textContent.toLowerCase();
        var match = !kw || text.includes(kw);
        card.style.display = match ? "" : "none";
        if (match) shown++;
      });
      catEl.style.display = shown === 0 ? "none" : "";
      total += shown;
    });
    var empty = document.getElementById("empty-tip");
    if (empty) empty.style.display = total === 0 ? "block" : "none";
  });
}
function setupHomeSearch() {
  var input = document.getElementById("home-search");
  var box = document.getElementById("search-results");
  if (!input || !box) return;
  var all = getAllLinks();
  input.addEventListener("input", function () {
    var kw = input.value.trim().toLowerCase();
    if (!kw) {
      box.style.display = "none";
      return;
    }
    var matched = all.filter(function (it) {
      return (it.name + it.desc + it.category).toLowerCase().includes(kw);
    }).slice(0, 8);
    if (matched.length === 0) {
      box.innerHTML = "<div class=\"search-empty\">\u6CA1\u6709\u627E\u5230\u4E0E\u300C".concat(input.value.trim(), "\u300D\u76F8\u5173\u7684\u5185\u5BB9</div>");
    } else {
      box.innerHTML = matched.map(function (it) {
        return '\n          <a class="search-item" href="'.concat(it.url, '" target="_blank" rel="noopener">\n            <span class="si-icon">').concat(it.icon || "\uD83D\uDD17", '</span>\n            <span class="si-body">\n              <span class="si-name">').concat(it.name, '</span>\n              <span class="si-desc">').concat(it.type === "tool" ? "\u5DE5\u5177" : it.type === "music" ? "\u97F3\u4E50" : "\u6E38\u620F", " \xB7 ").concat(it.category, "</span>\n            </span>\n          </a>");
      }).join("");
    }
    box.style.display = "block";
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-wrap")) box.style.display = "none";
  });
}
function setupTheme() {
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;
  var saved = localStorage.getItem("nav-theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    btn.textContent = "\u2600\uFE0F";
  } else {
    btn.textContent = "\uD83C\uDF19";
  }
  btn.addEventListener("click", function () {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("nav-theme", "light");
      btn.textContent = "\uD83C\uDF19";
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("nav-theme", "dark");
      btn.textContent = "\u2600\uFE0F";
    }
  });
}
function setupBackTop() {
  var btn = document.getElementById("back-top");
  if (!btn) return;
  window.addEventListener("scroll", function () {
    btn.classList.toggle("show", window.scrollY > 400);
  });
  btn.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}
function setupActiveNav() {
  var current = (location.pathname.split("/").pop() || "index.html").split("?")[0];
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    var href = a.getAttribute("href") || "";
    if (href === current || current === "" && href === "index.html") {
      a.classList.add("active");
    }
  });
}
function setupYear() {
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = (/* @__PURE__ */new Date()).getFullYear();
  });
}
document.addEventListener("DOMContentLoaded", function () {
  renderCategories("tools-container", SITE_DATA.tools);
  renderCategories("games-container", SITE_DATA.games);
  renderCategories("music-container", SITE_DATA.music);
  renderGrid("hot-container", SITE_DATA.hot);
  renderContacts();
  setupPageSearch();
  setupHomeSearch();
  setupTheme();
  setupBackTop();
  setupActiveNav();
  setupYear();
});
