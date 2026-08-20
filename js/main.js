/* ==========================================================================
   《工具导航站》核心脚本
   ==========================================================================
   使用说明(重要):
   1. 所有工具/游戏/社交链接都在下方的 SITE_DATA 里管理,
      想增删改链接,只需修改 SITE_DATA 中的数组即可,无需改 HTML。
   2. 每个链接的字段:
       name  : 网站名称(必填)
       url   : 跳转地址(必填,http/https)
       desc  : 一句话描述(选填)
       icon  : 图标(建议用 emoji,选填,不填则显示首字母)
       tag   : 右上角小标签,如"推荐""热"(选填)
   ========================================================================== */

const SITE_DATA = {
  /* —— 工具导航(按分类) —— */
  tools: [
    {
      category: "开发工具",
      icon: "💻",
      desc: "写代码、造轮子、上开源",
      color: ["#4f6ef7", "#7c5cff"],
      items: [
        { name: "GitHub", url: "https://github.com", desc: "全球最大代码托管平台", icon: "🐙", tag: "推荐" },
        { name: "Stack Overflow", url: "https://stackoverflow.com", desc: "程序员问答社区", icon: "📚" },
        { name: "MDN Web Docs", url: "https://developer.mozilla.org", desc: "Web 开发权威文档", icon: "📖" },
        { name: "菜鸟教程", url: "https://www.runoob.com", desc: "编程入门学习教程", icon: "🐦" },
        { name: "LeetCode", url: "https://leetcode.cn", desc: "算法刷题平台", icon: "💻" },
        { name: "V2EX", url: "https://www.v2ex.com", desc: "创意工作者社区", icon: "💬" },
      ],
    },
    {
      category: "在线工具",
      icon: "🔧",
      desc: "打开即用,无需安装",
      color: ["#0ea5e9", "#22d3ee"],
      items: [
        { name: "JSON 解析", url: "https://www.json.cn", desc: "在线 JSON 格式化", icon: "🔧" },
        { name: "TinyPNG", url: "https://tinypng.com", desc: "图片无损压缩", icon: "🖼️" },
        { name: "草料二维码", url: "https://cli.im", desc: "二维码生成器", icon: "🔳" },
        { name: "Convertio", url: "https://convertio.co", desc: "文件格式在线转换", icon: "🔄" },
        { name: "在线 PS", url: "https://www.gaoding.com", desc: "在线图片编辑", icon: "🎨" },
      ],
    },
    {
      category: "设计工具",
      icon: "🎨",
      desc: "灵感与像素的碰撞",
      color: ["#d946ef", "#ec4899"],
      items: [
        { name: "Figma", url: "https://www.figma.com", desc: "UI 协作设计工具", icon: "🎨", tag: "推荐" },
        { name: "Canva", url: "https://www.canva.cn", desc: "在线平面设计", icon: "✨" },
        { name: "稿定设计", url: "https://www.gaoding.com", desc: "电商设计模板", icon: "🖌️" },
        { name: "花瓣网", url: "https://huaban.com", desc: "设计师灵感采集", icon: "🌸" },
        { name: "站酷", url: "https://www.zcool.com.cn", desc: "设计师作品社区", icon: "🏔️" },
      ],
    },
    {
      category: "效率办公",
      icon: "📝",
      desc: "协作办公,效率翻倍",
      color: ["#10b981", "#34d399"],
      items: [
        { name: "石墨文档", url: "https://shimo.im", desc: "在线协作文档", icon: "📝" },
        { name: "语雀", url: "https://www.yuque.com", desc: "知识库与文档", icon: "📓" },
        { name: "Notion", url: "https://www.notion.so", desc: "一体化笔记管理", icon: "🗂️" },
        { name: "飞书", url: "https://www.feishu.cn", desc: "企业协作平台", icon: "🪁" },
        { name: "腾讯文档", url: "https://docs.qq.com", desc: "腾讯在线文档", icon: "📄" },
      ],
    },
    {
      category: "AI 工具",
      icon: "🤖",
      desc: "智能时代,对话即生产力",
      color: ["#8b5cf6", "#d946ef"],
      items: [
        { name: "ChatGPT", url: "https://chat.openai.com", desc: "OpenAI 对话助手", icon: "🤖", tag: "热门" },
        { name: "文心一言", url: "https://yiyan.baidu.com", desc: "百度大模型助手", icon: "🧠" },
        { name: "通义千问", url: "https://tongyi.aliyun.com", desc: "阿里大模型助手", icon: "💡" },
        { name: "Kimi", url: "https://kimi.moonshot.cn", desc: "长文本智能助手", icon: "🚀" },
        { name: "豆包", url: "https://www.doubao.com", desc: "字节跳动 AI 助手", icon: "🫘" },
      ],
    },
    {
      category: "软件下载",
      icon: "⬇️",
      desc: "正版软件,安心下载",
      color: ["#f59e0b", "#f97316"],
      items: [
        { name: "腾讯软件中心", url: "https://pc.qq.com", desc: "正版软件下载", icon: "⬇️" },
        { name: "华军软件园", url: "https://www.onlinedown.net", desc: "软件下载站", icon: "🗂️" },
        { name: "微软官方下载", url: "https://www.microsoft.com/zh-cn/software-download", desc: "Windows/Office 下载", icon: "🪟" },
        { name: "360 软件管家", url: "https://www.360.cn", desc: "软件管理工具", icon: "🧰" },
      ],
    },
  ],

  /* —— 游戏导航(按分类) —— */
  games: [
    {
      category: "我的世界专区",
      icon: "⛏️",
      desc: "方块世界,资源一站集齐",
      color: ["#22c55e", "#84cc16"],
      items: [
        { name: "Minecraft 官网", url: "https://www.minecraft.net/zh-hans", desc: "官方游戏官网", icon: "⛏️", tag: "官方" },
        { name: "中文 Minecraft Wiki", url: "https://zh.minecraft.wiki", desc: "最全方块百科", icon: "📖", tag: "推荐" },
        { name: "MC百科", url: "https://www.mcmod.cn", desc: "模组/整合包百科", icon: "📚" },
        { name: "CurseForge", url: "https://www.curseforge.com/minecraft", desc: "全球最大模组平台", icon: "🧩" },
        { name: "Modrinth", url: "https://modrinth.com", desc: "现代轻量模组平台", icon: "🔮" },
        { name: "苦力怕论坛", url: "https://www.klpbbs.com", desc: "中文 MC 玩家社区", icon: "💬" },
        { name: "XyeBBS", url: "https://www.xyebbs.com", desc: "MC 资源社区", icon: "🧩", tag: "30W+" },
        { name: "NameMC", url: "https://namemc.com", desc: "皮肤/披风/改名查询", icon: "👤" },
        { name: "LittleSkin", url: "https://littleskin.cn", desc: "免费皮肤站", icon: "🎨" },
        { name: "HMCL 启动器", url: "https://hmcl.huangyuhui.net", desc: "第三方启动器", icon: "🚀" },
        { name: "PCL2 爱发电", url: "https://afdian.com/p/520b5b9c296b11f19d5c52540025c377", desc: "PCL2 作者赞助支持页", icon: "❤️", tag: "热" },
        { name: "PCL2 GitHub", url: "https://github.com/Hex-Dragon/PCL2", desc: "PCL2 官方开源仓库", icon: "🐙" },
        { name: "QQ 交流群", url: "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=935977221", desc: "群号 935977221,点击加群", icon: "🐧", tag: "加群", noblank: true },
        { name: "网易我的世界", url: "https://mc.163.com", desc: "中国版官网", icon: "🧱" },
      ],
    },
    {
      category: "泰拉瑞亚专区",
      icon: "🌞",
      desc: "挖掘、建造、战斗的沙盒冒险",
      color: ["#f97316", "#ef4444"],
      items: [
        { name: "Terraria 官网", url: "https://terraria.org", desc: "官方游戏官网", icon: "🌞", tag: "官方" },
        { name: "Steam 商店页", url: "https://store.steampowered.com/app/105600/Terraria/", desc: "Steam 购买与下载", icon: "🎮", tag: "推荐" },
        { name: "泰拉瑞亚中文 Wiki", url: "https://terraria.wiki.gg/zh", desc: "装备/Boss/合成全百科", icon: "📖" },
        { name: "tModLoader", url: "https://store.steampowered.com/app/1281930/tModLoader/", desc: "官方模组加载器", icon: "🔧" },
        { name: "Terraria 官方论坛", url: "https://forums.terraria.org", desc: "官方玩家社区", icon: "💬" },
        { name: "泰拉瑞亚贴吧", url: "https://tieba.baidu.com/f?kw=terraria", desc: "中文玩家聚集地", icon: "📱" },
      ],
    },
    {
      category: "游戏平台",
      icon: "🎮",
      desc: "你的游戏,一站直达",
      color: ["#ef4444", "#f97316"],
      items: [
        { name: "Steam", url: "https://store.steampowered.com", desc: "全球最大 PC 游戏平台", icon: "🎮", tag: "推荐" },
        { name: "Epic Games", url: "https://www.epicgames.com", desc: "每周免费领游戏", icon: "🎯", tag: "免费" },
        { name: "TapTap", url: "https://www.taptap.cn", desc: "手游社区与下载", icon: "📱" },
        { name: "WeGame", url: "https://www.wegame.com.cn", desc: "腾讯游戏平台", icon: "🐧" },
        { name: "育碧 Ubisoft", url: "https://www.ubisoft.com", desc: "育碧游戏平台", icon: "🎖️" },
      ],
    },
    {
      category: "游戏下载",
      icon: "⬇️",
      desc: "大作新游,一键获取",
      color: ["#3b82f6", "#06b6d4"],
      items: [
        { name: "Steam 下载", url: "https://store.steampowered.com/about/", desc: "Steam 客户端下载", icon: "🎮" },
        { name: "Epic 下载", url: "https://www.epicgames.com/store/zh-CN/download", desc: "Epic 客户端下载", icon: "🎯" },
        { name: "3DM", url: "https://www.3dmgame.com", desc: "单机游戏下载", icon: "⬇️" },
        { name: "游侠网", url: "https://www.ali213.net", desc: "单机游戏下载", icon: "🗡️" },
        { name: "游民星空", url: "https://www.gamersky.com", desc: "游戏资讯与下载", icon: "🌌" },
      ],
    },
    {
      category: "网页游戏",
      icon: "🕹️",
      desc: "无需下载,打开即玩",
      color: ["#f97316", "#fbbf24"],
      items: [
        { name: "4399 小游戏", url: "https://www.4399.com", desc: "在线小游戏平台", icon: "🕹️" },
        { name: "7k7k 小游戏", url: "https://www.7k7k.com", desc: "在线小游戏", icon: "🎲" },
        { name: "小霸王其乐无穷", url: "https://www.yikm.net", desc: "怀旧红白机游戏", icon: "🕹️" },
      ],
    },
    {
      category: "游戏资讯",
      icon: "📰",
      desc: "圈内热点,尽在掌握",
      color: ["#64748b", "#94a3b8"],
      items: [
        { name: "IGN 中国", url: "https://www.ign.com.cn", desc: "游戏评测与资讯", icon: "📰" },
        { name: "游民星空", url: "https://www.gamersky.com", desc: "游戏综合资讯", icon: "🌌" },
        { name: "NGA", url: "https://nga.cn", desc: "游戏玩家社区", icon: "💬" },
        { name: "机核网", url: "https://www.gcores.com", desc: "游戏文化电台", icon: "🎙️" },
      ],
    },
  ],

  /* —— 音乐导航(按分类) —— */
  music: [
    {
      category: "华语音乐平台",
      icon: "🎵",
      desc: "想听的歌,这里都有",
      color: ["#ef4444", "#f97316"],
      items: [
        { name: "网易云音乐", url: "https://music.163.com", desc: "情怀与歌单", icon: "🎵", tag: "推荐" },
        { name: "QQ 音乐", url: "https://y.qq.com", desc: "腾讯音乐平台", icon: "🐧" },
        { name: "酷狗音乐", url: "https://www.kugou.com", desc: "海量曲库", icon: "🐶" },
        { name: "酷我音乐", url: "https://www.kuwo.cn", desc: "老牌音乐平台", icon: "🎧" },
        { name: "咪咕音乐", url: "https://music.migu.cn", desc: "正版无损音乐", icon: "🎼" },
        { name: "汽水音乐", url: "https://music.douyin.com", desc: "抖音旗下音乐", icon: "🥤" },
      ],
    },
    {
      category: "国际音乐平台",
      icon: "🌍",
      desc: "全球音乐,一网打尽",
      color: ["#3b82f6", "#06b6d4"],
      items: [
        { name: "Spotify", url: "https://open.spotify.com", desc: "全球最大流媒体音乐", icon: "🟢", tag: "热门" },
        { name: "Apple Music", url: "https://music.apple.com", desc: "苹果音乐服务", icon: "🍎" },
        { name: "YouTube Music", url: "https://music.youtube.com", desc: "谷歌音乐服务", icon: "▶️" },
        { name: "SoundCloud", url: "https://soundcloud.com", desc: "独立音乐人社区", icon: "☁️" },
      ],
    },
    {
      category: "电台与有声",
      icon: "📻",
      desc: "听电台、听书、听世界",
      color: ["#8b5cf6", "#d946ef"],
      items: [
        { name: "喜马拉雅", url: "https://www.ximalaya.com", desc: "有声书与电台", icon: "📻", tag: "推荐" },
        { name: "荔枝FM", url: "https://www.lizhi.fm", desc: "轻电台社区", icon: "🎙️" },
        { name: "蜻蜓FM", url: "https://www.qingting.fm", desc: "网络电台聚合", icon: "🦟" },
      ],
    },
    {
      category: "歌词与识别",
      icon: "🔍",
      desc: "找歌词、识歌曲",
      color: ["#10b981", "#34d399"],
      items: [
        { name: "Musixmatch", url: "https://www.musixmatch.com", desc: "全球歌词库", icon: "📝" },
        { name: "Shazam", url: "https://www.shazam.com", desc: "听歌识曲神器", icon: "📱", tag: "实用" },
      ],
    },
  ],

  /* —— 联系与社交 —— */
  contacts: [
    { name: "邮箱", url: "mailto:13584534484@163.com", desc: "13584534484@163.com", icon: "📧" },
    { name: "QQ", url: "https://wpa.qq.com/msgrd?v=3&uin=3037347653&site=qq&menu=yes", desc: "3037347653", icon: "🐧" },
  ],

  /* —— 首页热门推荐 —— */
  hot: [
    { name: "GitHub", url: "https://github.com", desc: "代码托管平台", icon: "🐙" },
    { name: "ChatGPT", url: "https://chat.openai.com", desc: "AI 对话助手", icon: "🤖" },
    { name: "Steam", url: "https://store.steampowered.com", desc: "PC 游戏平台", icon: "🎮" },
    { name: "Figma", url: "https://www.figma.com", desc: "UI 设计工具", icon: "🎨" },
    { name: "LeetCode", url: "https://leetcode.cn", desc: "算法刷题", icon: "💻" },
    { name: "Notion", url: "https://www.notion.so", desc: "笔记管理", icon: "🗂️" },
    { name: "Epic Games", url: "https://www.epicgames.com", desc: "每周免费游戏", icon: "🎯" },
    { name: "语雀", url: "https://www.yuque.com", desc: "知识库文档", icon: "📓" },
  ],
};

/* ==========================================================================
   以下为站点逻辑代码,一般无需修改
   ========================================================================== */

/* —— 合并所有可搜索的链接 —— */
function getAllLinks() {
  const list = [];
  SITE_DATA.tools.forEach((c) =>
    c.items.forEach((it) => list.push({ ...it, type: "tool", category: c.category }))
  );
  SITE_DATA.games.forEach((c) =>
    c.items.forEach((it) => list.push({ ...it, type: "game", category: c.category }))
  );
  SITE_DATA.music.forEach((c) =>
    c.items.forEach((it) => list.push({ ...it, type: "music", category: c.category }))
  );
  return list;
}

/* —— 生成单张链接卡片 HTML —— */
function cardHTML(item) {
  const icon = item.icon || (item.name || "?").charAt(0);
  const tag = item.tag ? `<span class="card-tag">${item.tag}</span>` : "";
  const desc = item.desc ? `<div class="card-desc">${item.desc}</div>` : "";
  // 协议链接(如 mqqapi://)在当前页打开,其余链接新标签打开
  const blank = item.noblank ? "" : ` target="_blank" rel="noopener"`;
  return `
    <a class="card" href="${item.url}"${blank}>
      ${tag}
      <div class="card-icon">${icon}</div>
      <div class="card-body">
        <div class="card-title">${item.name}</div>
        ${desc}
      </div>
    </a>`;
}

/* —— 渲染工具/游戏分类(带特色横幅) —— */
function renderCategories(containerId, data, hideOnEmpty = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = "";
  data.forEach((cat) => {
    if (hideOnEmpty && cat.items.length === 0) return;
    const [c1, c2] = cat.color || ["#4f6ef7", "#7c5cff"];
    // 支持分类背景图(bg 字段),没有则用专属渐变色
    const bgStyle = cat.bg
      ? `background-image:url('${cat.bg}');background-size:cover;background-position:center;background-color:rgba(0,0,0,0.35);background-blend-mode:multiply;`
      : `background:linear-gradient(135deg, ${c1}, ${c2});`;
    html += `
      <div class="category" data-category="${cat.category}">
        <div class="cat-banner" style="${bgStyle}" data-emoji="${cat.icon || "🔖"}">
          <div class="cat-banner-icon">${cat.icon || "🔖"}</div>
          <div class="cat-banner-info">
            <h2>${cat.category}</h2>
            <p>${cat.desc || "常用站点,一键直达"}</p>
          </div>
          <span class="cat-banner-count">${cat.items.length} 个</span>
        </div>
        <div class="grid">${cat.items.map(cardHTML).join("")}</div>
      </div>`;
  });
  container.innerHTML = html;
}

/* —— 渲染普通卡片网格(首页热门) —— */
function renderGrid(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map(cardHTML).join("");
}

/* —— 渲染联系社交卡片 —— */
function renderContacts() {
  const container = document.getElementById("contacts-container");
  if (!container) return;
  container.innerHTML = SITE_DATA.contacts
    .map(
      (it) => `
        <a class="social-card" href="${it.url}" target="_blank" rel="noopener">
          <div class="s-icon">${it.icon || "🔗"}</div>
          <div class="s-body">
            <div class="s-name">${it.name}</div>
            <div class="s-value">${it.desc || it.url}</div>
          </div>
        </a>`
    )
    .join("");
}

/* —— 搜索过滤(在工具/游戏页内) —— */
function setupPageSearch() {
  const input = document.getElementById("search-input");
  if (!input) return;

  const scope = document.getElementById("search-scope"); // 可选:数据作用域标识

  input.addEventListener("input", () => {
    const kw = input.value.trim().toLowerCase();
    let target = SITE_DATA.tools;
    if (scope) {
      if (scope.dataset.scope === "games") target = SITE_DATA.games;
      else if (scope.dataset.scope === "music") target = SITE_DATA.music;
    }

    let total = 0;
    target.forEach((cat) => {
      const catEl = document.querySelector(
        `.category[data-category="${cat.category}"]`
      );
      if (!catEl) return;
      let shown = 0;
      const cards = catEl.querySelectorAll(".card");
      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        const match = !kw || text.includes(kw);
        card.style.display = match ? "" : "none";
        if (match) shown++;
      });
      catEl.style.display = shown === 0 ? "none" : "";
      total += shown;
    });

    const empty = document.getElementById("empty-tip");
    if (empty) empty.style.display = total === 0 ? "block" : "none";
  });
}

/* —— 首页搜索:实时下拉联想 —— */
function setupHomeSearch() {
  const input = document.getElementById("home-search");
  const box = document.getElementById("search-results");
  if (!input || !box) return;

  const all = getAllLinks();

  input.addEventListener("input", () => {
    const kw = input.value.trim().toLowerCase();
    if (!kw) {
      box.style.display = "none";
      return;
    }
    const matched = all.filter((it) =>
      (it.name + it.desc + it.category).toLowerCase().includes(kw)
    ).slice(0, 8);

    if (matched.length === 0) {
      box.innerHTML = `<div class="search-empty">没有找到与「${input.value.trim()}」相关的内容</div>`;
    } else {
      box.innerHTML = matched
        .map(
          (it) => `
          <a class="search-item" href="${it.url}" target="_blank" rel="noopener">
            <span class="si-icon">${it.icon || "🔗"}</span>
            <span class="si-body">
              <span class="si-name">${it.name}</span>
              <span class="si-desc">${it.type === "tool" ? "工具" : it.type === "music" ? "音乐" : "游戏"} · ${it.category}</span>
            </span>
          </a>`
        )
        .join("");
    }
    box.style.display = "block";
  });

  // 点击外部关闭下拉
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) box.style.display = "none";
  });
}

/* —— 主题切换 —— */
function setupTheme() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const saved = localStorage.getItem("nav-theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    btn.textContent = "☀️";
  } else {
    btn.textContent = "🌙";
  }

  btn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("nav-theme", "light");
      btn.textContent = "🌙";
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("nav-theme", "dark");
      btn.textContent = "☀️";
    }
  });
}

/* —— 回到顶部 —— */
function setupBackTop() {
  const btn = document.getElementById("back-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("show", window.scrollY > 400);
  });
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* —— 导航高亮 —— */
function setupActiveNav() {
  const current = (location.pathname.split("/").pop() || "index.html").split("?")[0];
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href === current || (current === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });
}

/* —— 页脚年份 —— */
function setupYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* —— 初始化 —— */
document.addEventListener("DOMContentLoaded", () => {
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
