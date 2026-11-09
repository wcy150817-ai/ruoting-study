// ============================================================================
// 若婷初中四年全科智能学习辅助系统 · 前端核心引擎 (学年视角 × 学科深度 × 微观自测)
// ============================================================================

// 云端纯静态部署自适应适配层 (Cloudflare Pages / Vercel / GitHub Pages 零后端无缝运行)
(function installStaticCloudAdapter() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const origFetch = window.fetch.bind(window);
  const host = (window.location && window.location.hostname) || '';
  let isStaticMode = Boolean(host && host !== 'localhost' && host !== '127.0.0.1');

  const KP_UPDATES_KEY = 'ruoting_static_kp_updates_v1';
  const CUSTOM_Q_KEY = 'ruoting_static_custom_questions_v1';
  const MARKS_KEY = 'ruoting_master_compendium_marks_v1';

  const readJsonStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };
  const writeJsonStorage = (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  };
  const makeJsonResponse = (obj, status = 200) => {
    const text = JSON.stringify(obj);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(obj),
      text: () => Promise.resolve(text)
    });
  };

  let cachedStaticData = null;
  const loadAndMergeStaticData = async () => {
    if (!cachedStaticData) {
      const r = await origFetch('/data.json');
      cachedStaticData = await r.json();
    }
    const data = JSON.parse(JSON.stringify(cachedStaticData));
    const kpUpdates = readJsonStorage(KP_UPDATES_KEY, {});
    const customQs = readJsonStorage(CUSTOM_Q_KEY, null);
    if (Array.isArray(customQs)) {
      data.customQuestions = customQs;
    }
    if (Array.isArray(data.knowledgePoints)) {
      data.knowledgePoints.forEach(kp => {
        const up = kpUpdates[kp.id];
        if (up) {
          if (up.status) kp.status = up.status;
          if (up.nextReview) kp.nextReview = up.nextReview;
          if (up.lastTested) kp.lastTested = up.lastTested;
          if (Array.isArray(up.records) && up.records.length > 0) {
            kp.records = [...up.records, ...(kp.records || [])].slice(0, 30);
          }
        }
      });
    }
    return data;
  };

  const handleStaticApi = async (urlStr, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const bodyObj = options.body ? (() => { try { return JSON.parse(options.body); } catch (e) { return {}; } })() : {};

    if (urlStr.startsWith('/api/data')) {
      const merged = await loadAndMergeStaticData();
      return makeJsonResponse(merged);
    }
    if (urlStr.startsWith('/api/update-point') && method === 'POST') {
      const kpUpdates = readJsonStorage(KP_UPDATES_KEY, {});
      const id = bodyObj.id;
      if (id) {
        const prev = kpUpdates[id] || { records: [] };
        if (bodyObj.status) prev.status = bodyObj.status;
        if (bodyObj.nextReview) prev.nextReview = bodyObj.nextReview;
        if (bodyObj.lastTested) prev.lastTested = bodyObj.lastTested;
        if (bodyObj.newRecord) {
          prev.records = [bodyObj.newRecord, ...(prev.records || [])].slice(0, 20);
        }
        kpUpdates[id] = prev;
        writeJsonStorage(KP_UPDATES_KEY, kpUpdates);
      }
      return makeJsonResponse({ ok: true, id });
    }
    if (urlStr.startsWith('/api/master-marks')) {
      const marks = readJsonStorage(MARKS_KEY, {});
      if (method === 'POST') {
        if (bodyObj.marks && typeof bodyObj.marks === 'object') {
          Object.assign(marks, bodyObj.marks);
        } else if (bodyObj.id) {
          marks[bodyObj.id] = Object.assign({}, marks[bodyObj.id] || {}, bodyObj, {
            updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
          });
        }
        writeJsonStorage(MARKS_KEY, marks);
      }
      return makeJsonResponse({ ok: true, marks });
    }
    if (urlStr.startsWith('/api/custom-questions')) {
      let list = readJsonStorage(CUSTOM_Q_KEY, []);
      if (method === 'GET') {
        return makeJsonResponse({ ok: true, items: list });
      }
      if (method === 'POST') {
        const incoming = Array.isArray(bodyObj.items) ? bodyObj.items : [bodyObj];
        const added = [];
        incoming.forEach((item, idx) => {
          if (!item || !item.prompt) return;
          const id = item.id || `CQ_${Date.now()}_${idx}`;
          const newQ = Object.assign({
            id,
            subject: '数学',
            semester: '初一上',
            chapter: '综合单元',
            corePoint: '核心考点专练',
            type: 'CHOICE',
            options: ['选项 A', '选项 B', '选项 C', '选项 D'],
            correctIdx: 0,
            tfCorrect: true,
            createdAt: new Date().toISOString().slice(0, 10)
          }, item, { id });
          const eIdx = list.findIndex(x => x.id === id);
          if (eIdx >= 0) list[eIdx] = newQ;
          else list.unshift(newQ);
          added.push(newQ);
        });
        writeJsonStorage(CUSTOM_Q_KEY, list);
        return makeJsonResponse({ ok: true, count: list.length, added });
      }
      if (method === 'DELETE') {
        const m = urlStr.match(/[?&]id=([^&]+)/);
        const delId = m ? decodeURIComponent(m[1]) : '';
        list = list.filter(x => x.id !== delId);
        writeJsonStorage(CUSTOM_Q_KEY, list);
        return makeJsonResponse({ ok: true, count: list.length });
      }
    }
    if (urlStr.startsWith('/api/save-paper') && method === 'POST') {
      const safeName = String(bodyObj.fileName || '单元检测卷.md').replace(/[\\/:*?"<>|]/g, '_').replace(/\.md$/i, '') + '.md';
      try {
        const blob = new Blob([String(bodyObj.markdown || '')], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {}
      return makeJsonResponse({ ok: true, relPath: `本地浏览器已下载/${safeName}` });
    }
    if (urlStr.startsWith('/api/tts-prewarm') || urlStr.startsWith('/api/tts')) {
      return makeJsonResponse({ ok: true });
    }
    return makeJsonResponse({ ok: true });
  };

  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
    if (urlStr.startsWith('/api/')) {
      if (isStaticMode) {
        return handleStaticApi(urlStr, init);
      }
      try {
        const res = await origFetch(input, init);
        if (res.status === 404 || res.status === 405 || res.status === 502) {
          isStaticMode = true;
          return handleStaticApi(urlStr, init);
        }
        return res;
      } catch (err) {
        isStaticMode = true;
        return handleStaticApi(urlStr, init);
      }
    }
    return origFetch(input, init);
  };

  // 在云端纯静态模式下，让 new Audio('/api/tts?...') 立即同步触发 onerror 回退到浏览器原生语音 (兼容 iPad/iPhone Safari 手势上下文)
  if (typeof window.Audio === 'function') {
    const OrigAudio = window.Audio;
    window.Audio = function (src) {
      if (isStaticMode && typeof src === 'string' && src.startsWith('/api/tts')) {
        const fakeAudio = {
          preload: 'auto',
          pause: () => {},
          onended: null,
          onerror: null,
          play: function () {
            if (typeof this.onerror === 'function') {
              try { this.onerror(new Event('error')); } catch (e) {}
            }
            return Promise.resolve();
          }
        };
        return fakeAudio;
      }
      return new OrigAudio(src);
    };
    window.Audio.prototype = OrigAudio.prototype;
  }
})();

const SAVED_DEFAULT_SEMESTER = (() => {
  try {
    const saved = localStorage.getItem('RUOTING_SELECTED_SEMESTER_V1');
    if (saved && saved !== 'ALL') return saved;
  } catch (e) {}
  return '初一上';
})();

function persistSelectedSemester(semCode) {
  if (!semCode || semCode === 'ALL') return;
  try {
    localStorage.setItem('RUOTING_SELECTED_SEMESTER_V1', semCode);
  } catch (e) {}
}

let STATE = {
  data: null,
  activeTab: 'macro',
  drillLevel: 'SUBJECT', // 默认直接进入当前记住学期的「选科目」，无需每次重选学期；需要时可点切换学期进入 'SEMESTER'
  stageFocus: SAVED_DEFAULT_SEMESTER, // 自动记忆上次选择的学期（默认 '初一上'）
  displayDimension: 'year',
  homeSelectedSubject: '数学',
  homeSelectedChapter: 'ALL',
  subjectVisualMode: 'MAP', // 'MAP'(🗺️糖果闯关大地图) | 'SKILL_TREE'(🌳RPG知识技能树) | 'SPECIAL'(🎯学科专项学练&听写) | 'CARDS'(📦单元卡片)
  activeSpecialTopicId: null,
  specialStep: 1, // 1: 看大招口诀卡 ➔ 2: 刷6~8题专项或互动听写 ➔ 3: 段位勋章结算
  schoolProgressFilter: 'TAUGHT_AND_CURRENT', // 'TAUGHT_AND_CURRENT'(仅测已学+本周同步) | 'ALL'(全册含未讲预习)
  schoolCurrentWeek: 8, // 地区统一校历当前周次（10月下旬为第8~9周·期中前同步阶段）
  chapterSubMode: 'LIST', // 'LIST'(闯关列表) | 'FLASHCARDS'(速记闪卡) | 'CHEATSHEET'(考前速背单)
  chapterCardIdx: 0,
  chapterCardFlipped: false,
  examDrillLevel: 'HOME', // 'HOME'(第1级：4大入口) | 'REMEDIATION' | 'HABITS' | 'PAPER' | 'PHOTO_FOLDERS' | 'PHOTO_LIST'
  examPhotoFolderIdx: 0,
  chartsDrillSem: null, // null(第1级：8学期总览) | 具体学期代码(第2级：该学期各科进度)
  chartsVisualMode: 'RING', // 'RING'(环形进度卡) | 'SKILL_TREE'(全科RPG技能树总览)
  soundEnabled: true,
  bgmEnabled: true,
  bgmPlaying: false,
  scratchpad: {
    open: false,
    color: '#0f172a',
    size: 3
  },
  cartoonTheme: true,
  huyisiOutfit: 'welcome',
  huyisiQuoteIndex: 0,
  dailyStats: {
    goal: 5,
    completedToday: 0,
    streakDays: 3
  },
  mesoFilter: {
    subject: '数学',
    semester: SAVED_DEFAULT_SEMESTER,
    chapter: 'ALL',
    difficulty: 'ALL',
    status: 'ALL',
    viewMode: 'year_grouped',
    crossYearDepth: true,
    search: ''
  },
  examFilter: 'ALL', // 'ALL' | 'WRONG' | 'HIGHLIGHT'
  activeSyllabusId: '📋数学_初一上_详尽考点与细节大纲',
  activeSyllabusSubject: '数学',
  lightbox: {
    rotate: 0,
    scale: 1
  },
  quiz: {
    isOpen: false,
    studyStyle: 'quest', // 'quest'(⚡逐题弹出闯关) | 'dictation'(🎧互动听写/默写) | 'flashcard'(🃏Quizlet 3D翻转闪卡) | 'match'(🧩Quizlet口诀消消乐) | 'blocks'(🧱Scratch思路积木拆解)
    semester: SAVED_DEFAULT_SEMESTER, // 严格跟随上一级所选学年学期
    subject: '数学', // 'ACTIVE_ALL'(本年级全部在读科) | 具体学科名 | 'ALL'
    scope: 'STAGE', // 'STAGE'(当前学年/学段) | 'ALL_YEARS'(四年全库)
    mode: 'SMART', // 'SMART'(智能查漏优先) | 'WEAK_ONLY'(仅未吃透) | 'ORDER'(按顺序) | 'L1' | 'L2' | 'L3'
    batchSize: 7, // 每次随机 6~8 题（默认 7 题）
    randomSeed: 1, // 随机换新题种子
    sourceContext: null, // 记录题目池来源以便一键「🔄 随机换新题」
    queue: [],
    currentIndex: 0,
    rapidFormat: 'MIXED', // 'MIXED'(选择+判断交替) | 'CHOICE'(四选一选择题) | 'TF'(对错判断题) | 'OPEN'(经典母题解答)
    selectedChoiceIdx: null,
    choiceSubmitted: false,
    choiceIsCorrect: null,
    qVariant: 'main', // 'main'(考察母题) | 'variant'(同源变式题)
    hintsShown: { h1: false, h2: false, h3: false },
    answerRevealed: false,
    flashcardFlipped: false,
    unlockedBlockStep: 1,
    dictation: {
      items: [],
      currentIndex: 0,
      userInput: '',
      submitted: false,
      isCorrect: false,
      showSyllableHint: true,
      results: [],
      finished: false
    },
    matchGame: {
      tiles: [],
      selectedTileId: null,
      wrongTileIds: [],
      matchedPairIds: [],
      totalPairs: 0,
      elapsedSec: 0,
      bestSec: null
    },
    questionElapsedSec: 0,
    totalElapsedSec: 0,
    results: [],
    finished: false,
    timerHandle: null
  }
};

// 六维错因与做题习惯基因库（基于25张实测照片深度提炼 + 跨科通用模型）
const HABIT_GENES = [
  {
    id: 'G2_SIGN_OP',
    name: '🔢 运算律与正负符号定则',
    score: 55,
    level: '🔴 头号重灾区',
    color: '#ef4444',
    triggers: 16,
    rule: '“异号相加先定号再大减小；除号变乘整数必翻身(÷9→×1/9)；负号在门前打包带进门”',
    desc: '多步混合运算算到后半程易出现：①把异号相加算成绝对值相加(-12.6+5.7=18.3)；②除以整数变乘号忘取倒数(18÷(-6)写成-18×6)；③括号前是-24去括号后两项漏变号。',
    evidence: [
      { source: '学情调研 16(1)', detail: '-12.6 + 5.7 算成 18.3（异号相加当成绝对值相加且丢负号，扣5分）', kp: '第二章：有理数加减法法则与增减变化应用题模型', photo: '微信图片_20261017191559_1333_188.jpg' },
      { source: '学情调研 18(1)', detail: '-1 + (-2) + 8 算到最后一步 -3 + 8 写成 -5（异号加法符号定反，扣3分）', kp: '第二章：有理数混合运算与运算律巧算陷阱', photo: '微信图片_20261017191559_1333_188.jpg' },
      { source: '随堂小测 1314 第5/11题', detail: '把 18÷(-6) 写成 -18×6=-108；把 -24×(2/3+3/4-1/12) 展开成 -16+18-2（后两项漏乘负号）', kp: '第二章：有理数乘除法与分配律正逆巧算陷阱', photo: '微信图片_20261017190953_1314_188.jpg' },
      { source: '综合卷 1331 第14(4)题', detail: '计算 (-27又9/11)÷9 时，直接写成 (-27又9/11)×9 = -2754/11（除变乘未取倒数 1/9）', kp: '第二章：有理数乘除法与分配律正逆巧算陷阱', photo: '微信图片_20261017191557_1331_188.jpg' },
      { source: '乘法运算律 1329 第4(3)题', detail: '7×(-1+3/14) 一错算成 -17/14，红笔二次订正又把负号弄丢算成 +11/2', kp: '第二章：有理数加减法法则与增减变化应用题模型', photo: '微信图片_20261017191555_1329_188.jpg' }
    ]
  },
  {
    id: 'G1_CONCEPT',
    name: '🧠 概念本质与公式适用边界',
    score: 62,
    level: '🔴 重点预警',
    color: '#dc2626',
    triggers: 8,
    rule: '“乘法有分配，除法无分配；底数连乘是乘方，绝非底数乘指数；负整数绝不是负分数”',
    desc: '对核心概念的边界存在误区：①生造“除法左分配律”a÷(b+c)=a÷b+a÷c；②误认“乘除结合律”a÷b×c=a÷(b×c)；③把乘方 a^n 当成 a×n；④两个负数比大小按正数直觉全填 <。',
    evidence: [
      { source: '综合卷 1331 第9题', detail: '计算 24÷(1/2-1/3-1/4) 时把写对的通分涂掉，拆成 24÷(1/2)+24÷(-1/3)+24÷(-1/4)=-120（正解 -288）', kp: '第二章：有理数乘除法与分配律正逆巧算陷阱', photo: '微信图片_20261017191557_1331_188.jpg' },
      { source: '混合运算 1327 底部诊断题', detail: '题目问 15÷(-3/4)×(-4) = 15÷[(-3/4)×(-4)] = 5 是否正确，直接答“正确”（正解 80）', kp: '第二章：有理数混合运算与运算律巧算陷阱', photo: '微信图片_20261017191553_1327_188.jpg' },
      { source: '混合运算 1327 第5(3)题 & 调研第3题', detail: '把 (-4)^3 算成 -12；误以为 (-1)^2024 与 -1^2024 相等', kp: '第二章：有理数乘方的符号陷阱', photo: '微信图片_20261017191553_1327_188.jpg' },
      { source: '学情调研 第14/19题 & 1329第5题', detail: '把负整数 -2 塞进负分数集合；找比 -3.5 大的整数漏掉 -3；4道负数比大小全填 < 错3道', kp: '第二章：有理数分类与数轴相反数绝对值比大小', photo: '微信图片_20261017191555_1329_188.jpg' }
    ]
  },
  {
    id: 'G3_VISION',
    name: '👁️ 审题精度与视觉防漏',
    score: 72,
    level: '🟡 中度预警',
    color: '#d97706',
    triggers: 6,
    rule: '“多数据先在底下标序号①②③④防漏换行；圈画关键字绝不压数字与逗号”',
    desc: '审题时有圈画关键词的好习惯，但存在：①漏看刚好换行印在下一行开头的数据；②自己画铅笔圈把原题数字和逗号看成小数；③把“绝对值”看成“倒数”或漏写连接号 <。',
    evidence: [
      { source: '《中秋作业》1320 第19题', detail: '7段行程最后一个 -7 刚好印在下一行开头，审题漏看 -7 导致(1)(2)(3)三问全错', kp: '第二章：有理数加减法法则与增减变化应用题模型', photo: '微信图片_20261017191547_1320_188.jpg' },
      { source: '《中秋作业》1322 第15题', detail: '自己在原题“-3,”上画铅笔圈做标记，结果把铅笔圈和逗号看成“-3.1”，还在非负数集写了“+3.1”', kp: '第二章：有理数分类与数轴相反数绝对值比大小', photo: '微信图片_20261017191549_1322_188.jpg' },
      { source: '学情调研 第8题 & 第20(2)题', detail: '第8题问“-2026的绝对值”秒选成 C(1/2026)；第20(2)题排好序却把 < 号全写成逗号', kp: '第二章：有理数分类与数轴相反数绝对值比大小', photo: '微信图片_20261017191559_1333_188.jpg' }
    ]
  },
  {
    id: 'G4_STEP',
    name: '✍️ 跨行书写与步骤检验',
    score: 75,
    level: '🟡 中度预警',
    color: '#d97706',
    triggers: 6,
    rule: '“脱式每写一行上下照镜子防丢项/丢指数；填表算完末格必与总和双向核对”',
    desc: '脱式步骤非常工整，但在跨行抄写时容易把上一行末尾的乘数或指数掉在半路，或填表题一格算错引发后面集体串行。',
    evidence: [
      { source: '学情调研 18(2) & 活页纸 1313 第④题', detail: '调研18(2)倒数第二行写着 (-16/3)×9，下一行直接漏掉 ×9；活页纸第④题跨行把 (-1/2)^3 的指数 3 漏掉', kp: '第二章：有理数混合运算与运算律巧算陷阱', photo: '微信图片_20261017190939_1313_188.jpg' },
      { source: '学历案 1326 流花河水位表', detail: '周三算错一位(34.06算成34.09)，导致周四至周日连续串行，且未与上一问算出的周日 34m 核对', kp: '第二章：有理数加减法法则与增减变化应用题模型', photo: '微信图片_20261017191552_1326_188.jpg' }
    ]
  },
  {
    id: 'G5_CONFIDENCE',
    name: '💓 考场自信定力与二刷纠错力',
    score: 78,
    level: '🟢 优势与短板并存',
    color: '#2563eb',
    triggers: 3,
    rule: '“保留极优秀的二刷有据自查习惯；但若无确凿算式依据，绝不凭感觉把第一遍对的涂改成错的！”',
    desc: '极其难得地具备主动“二刷自查”品质（《中秋作业》自己救回8道题），但同时有3次因为不自信，把第一遍算对的答案涂掉改成了错的！',
    evidence: [
      { source: '乘法运算律 1329 第2(1)题', detail: '|a|=3, |b|=5 求 a-b 最大值，第一遍写对了 8，后怀疑自己涂掉改成了 2', kp: '第二章：数轴与绝对值动点最值模型', photo: '微信图片_20261017191555_1329_188.jpg' },
      { source: '综合卷 1331 第9题 & 第14题', detail: '第14题把算对的 +1.4 涂掉改成 +(-1.4)；第9题把写对的通分涂掉改成除法分配律', kp: '第二章：有理数混合运算与运算律巧算陷阱', photo: '微信图片_20261017191557_1331_188.jpg' },
      { source: '🌟《中秋作业》1320~1322 二刷闪光点', detail: '主动二刷检查，自己发现第18题漏加9月30日基数1.2万人，耐心重写7天算式救回8道题！', kp: '第二章：有理数加减法法则与增减变化应用题模型', photo: '微信图片_20261017191547_1320_188.jpg' }
    ]
  },
  {
    id: 'G6_MODEL',
    name: '⚡ 巧算意识与压轴规律建模',
    score: 85,
    level: '🟢 潜力突出项',
    color: '#16a34a',
    triggers: 4,
    rule: '“带分拆成整加分，相同因数提出来；两站之间段内平，三站设在正中央(奇点偶段法)”',
    desc: '周期规律（圆在数轴滚动2024）、数轴折叠中点（-2029）、限流分段计费建模能力极强！仅需补充带分数拆项巧算、逆用分配律提公因式及绝对值“奇点偶段法”三大工具。',
    evidence: [
      { source: '🌟学情调研 第10题、第21题 & 1323第10题', detail: '圆滚动周期题、数轴对折题、国庆每日8万人限流门票收入大题全部满分攻克！', kp: '第二章：数轴与绝对值动点最值模型', photo: '微信图片_20261017191558_1332_188.jpg' },
      { source: '学情调研 第22(3)题（奇点偶段法待补）', detail: '求 |x+2|+|x+6|+|x-1| 最小值，盲代 x=0 得 9（掌握“奇点取中 x=-2 得 7”即可秒杀）', kp: '第二章：数轴与绝对值动点最值模型', photo: '微信图片_20261017191558_1332_188.jpg' }
    ]
  }
];

// 《2026初一数学学情调研》(82/120分) 22道题全卷逐题还原数据
const EXAM_22_QUESTIONS = [
  { q: '1', type: '选择题(3分)', stem: '在 -5, 1/2, -1, 0 这四个数中，最小的数是（ ）', student: 'A (-5)', correct: 'A (-5)', score: 3, max: 3, status: 'right', gene: '', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '负数小于0和正数，|-5|>|-1|，故 -5 最小。' },
  { q: '2', type: '选择题(3分)', stem: '如图，数轴上表示数 1 的点是（ ）[M:-2, N:-1, P:1, Q:3]', student: 'C (P)', correct: 'C (P)', score: 3, max: 3, status: 'right', gene: '', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '数轴读点基础题，准确无误。' },
  { q: '3', type: '选择题(3分)', stem: '下列几组数中，相等的是（ ） A.2³和3² B.(-2)²和-2² C.(-1)²⁰²⁴和-1²⁰²⁴ D.+(-5)和-|-5|', student: 'C ❌', correct: 'D', score: 0, max: 3, status: 'wrong', gene: 'G1_CONCEPT', kp: '第二章：有理数乘方的符号陷阱', analysis: '【乘方底数符号陷阱】(-1)²⁰²⁴ = 1，而 -1²⁰²⁴ = -1，互为相反数；D选项均为 -5。' },
  { q: '4', type: '选择题(3分)', stem: '精密零件直径要求标注为“40±0.05mm”，下列不合格的是（ ） A.40 B.39.95 C.40.15 D.40.02', student: 'B ❌', correct: 'C', score: 0, max: 3, status: 'wrong', gene: 'G1_CONCEPT', kp: '第二章：有理数加减法法则与增减变化应用题模型', analysis: '合格范围是 [39.95, 40.05]，B是合格下限临界值，C(40.15 > 40.05)超出上限不合格。' },
  { q: '5', type: '选择题(3分)', stem: '有理数 a, b 在数轴上位置如图 (b < -1 < 0 < a < 1)，正确的是（ ）', student: 'A (a+b<0)', correct: 'A (a+b<0)', score: 3, max: 3, status: 'right', gene: '', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '异号两数相加取绝对值较大数的符号，|b|>|a| 且 b<0，故 a+b<0。' },
  { q: '6', type: '选择题(3分)', stem: '规定向东走200米记作+200m，四位同学记录 A.+300m B.-400m C.+500m D.-600m，谁离学校最远？', student: 'B ❌', correct: 'D', score: 0, max: 3, status: 'wrong', gene: 'G1_CONCEPT', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '“离学校多远”看的是距离（即绝对值），|-600m| = 600m 最大。' },
  { q: '7', type: '选择题(3分)', stem: '下列式子可读作“负1，负3，正6，负8的和”的是（ ）', student: 'B (-1-3+6-8)', correct: 'B', score: 3, max: 3, status: 'right', gene: '', kp: '第二章：有理数加减法法则与增减变化应用题模型', analysis: '代数和省略加号与括号的读法完全掌握。' },
  { q: '8', type: '选择题(3分)', stem: '-2026 的绝对值是（ ） A.2026 B.-2026 C.1/2026 D.-1/2026', student: 'C ❌', correct: 'A', score: 0, max: 3, status: 'wrong', gene: 'G3_VISION', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '【审题跳字】把“绝对值”看成了“倒数的绝对值”，白白丢掉送分题。' },
  { q: '9', type: '选择题(3分)', stem: '数轴上 a < 0 < b 且 |a| < |b|，把 a, -a, b, -b 按从小到大排列正确的是（ ）', student: 'D ❌', correct: 'C (-b<a<-a<b)', score: 0, max: 3, status: 'wrong', gene: 'G1_CONCEPT', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '未在数轴上标出相反数 -a, -b 的对称点就凭直觉选D(-b<b<-a<a)，连正数 b > 负数 a 都排反了。' },
  { q: '10', type: '选择题(3分·压轴)', stem: '圆周长4个单位四等分标0,1,2,3，数字0与数轴-1重合，向右滚动，数轴2024与圆周哪个数字重合？', student: 'B (1) 🌟', correct: 'B (1)', score: 3, max: 3, status: 'highlight', gene: 'G6_MODEL', kp: '第二章：数轴与绝对值动点最值模型', analysis: '🌟【压轴闪光点】从 -1 到 2024 共走 2025 个单位，2025 ÷ 4 = 506 余 1，精准选出 1！' },
  { q: '11', type: '填空题(4分)', stem: '向东走10米记作+10米，向西走10米可记作 ____ 米', student: '-10', correct: '-10', score: 4, max: 4, status: 'right', gene: '', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '正负数相反意义掌握扎实。' },
  { q: '12', type: '填空题(4分)', stem: '比 2 小 5 的数是 ____', student: '-3', correct: '-3', score: 4, max: 4, status: 'right', gene: '', kp: '第二章：有理数加减法法则与增减变化应用题模型', analysis: '2 - 5 = -3 正确。' },
  { q: '13', type: '填空题(4分)', stem: '在 -6, -3, -2, 1, 6 五个数中任取两数相乘，最大乘积等于 ____', student: '18', correct: '18', score: 4, max: 4, status: 'right', gene: '', kp: '第二章：有理数乘除法与分配律正逆巧算陷阱', analysis: '同号得正，(-6)×(-3) = 18 考虑到了两负数相乘，非常棒！' },
  { q: '14', type: '填空题(4分)', stem: '比 -3又1/2 大而比 2又1/3 小的所有整数的和为 ____', student: '-2 ❌ (原卷草稿写: -2,-1,0,1)', correct: '-3', score: 0, max: 4, status: 'wrong', gene: 'G1_CONCEPT', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '【原卷草稿破案】在试卷第14题上方手写列举了“-2, -1, 0, 1”，找比 -3.5 大的整数时漏掉了 -3！' },
  { q: '15', type: '填空题(4分)', stem: '已知 |a+2026| + |b-2027| = 0，则 a - b = ____', student: '1 ❌ (考后红笔订正为 -4053)', correct: '-4053', score: 0, max: 4, status: 'wrong', gene: 'G2_SIGN_OP', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '由 0+0=0 模型得 a = -2026, b = 2027，故 a-b = -2026-2027 = -4053。考场上把 a 当成 +2026 且减法符号算反。' },
  { q: '16(1)', type: '解答题(5分)', stem: '计算：-4.2 + 5.7 - 8.4 + 10', student: '=-12.6+5.7+10 = 18.3+10 = 28.3 ❌', correct: '3.1', score: 0, max: 5, status: 'wrong', gene: 'G2_SIGN_OP', kp: '第二章：有理数加减法法则与增减变化应用题模型', analysis: '前两步算得 -12.6 完全正确，但第三步算 -12.6 + 5.7 时把异号相加算成了 12.6+5.7=18.3 且丢了负号！' },
  { q: '16(2)', type: '解答题(5分)', stem: '计算：(-45) + (+88) + 65 + (-17)', student: '=[(65-45)]+[(88-17)] = 20+71 = 91', correct: '91', score: 5, max: 5, status: 'right', gene: '', kp: '第二章：有理数加减法法则与增减变化应用题模型', analysis: '分组结合计算完全正确。' },
  { q: '17(1)(2)', type: '解答题(10分)', stem: '(1) (2/3 - 11/12 + 4/15)×(-60) ； (2) (-1/12) ÷ (1/3 - 5/6)', student: '(1) -1 ； (2) 1/6', correct: '(1) -1 ； (2) 1/6', score: 10, max: 10, status: 'right', gene: '', kp: '第二章：有理数乘除法与分配律正逆巧算陷阱', analysis: '乘法分配律与分数通分除法两道题全部满分拿下！' },
  { q: '18(1)', type: '解答题(5分)', stem: '计算：-1⁴ + (-1/3)÷(1/6) - (-2)³', student: '=-1+(-2)+8 = -5 ❌', correct: '5', score: 2, max: 5, status: 'wrong', gene: 'G2_SIGN_OP', kp: '第二章：有理数混合运算与运算律巧算陷阱', analysis: '最难的 -1⁴=-1 和 -(-2)³=+8 全对，最后一步 -3+8 竟然写成 -5！' },
  { q: '18(2)', type: '解答题(5分)', stem: '计算：-1⁴ + [(-4又2/3)÷(-2)² + |0.5-1|] ÷ (-1/3²)', student: '=-1+(-16/3)×9 = -1+(-16/3) = -19/3 ❌', correct: '5', score: 1, max: 5, status: 'wrong', gene: 'G4_STEP', kp: '第二章：有理数混合运算与运算律巧算陷阱', analysis: '连犯3错：① ÷(-1/9) 漏了负号写成 ×9；② -7/6+0.5 算成 -16/3；③ 倒数第二行写着 ×9，最后一行直接把 ×9 漏掉不乘了！' },
  { q: '19', type: '解答题(10分)', stem: '把 -2, -1/2, 5.2, 0, 2/3, 1又1/8, -5/3, 2022, -0.3 填入4个集合（整数、正数、负分数、非负有理数）', student: '前3个全对；负分数集写 {-2, -1/2, -0.3} ❌', correct: '负分数集 {-1/2, -5/3, -0.3}', score: 8, max: 10, status: 'wrong', gene: 'G1_CONCEPT', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '把负整数 -2 误塞进负分数集合，同时漏抄了真正的负分数 -5/3。' },
  { q: '20', type: '解答题(10分)', stem: '(1)写出数轴A,B,C,D各数；(2)画数轴表示8个数并用“<”连接', student: '数轴与顺序全对，但把“<”写成了逗号“,” ⚠️', correct: '-5 < -4 < -3 < -3/2 < 0 < 3/2 < 3 < 5', score: 9, max: 10, status: 'wrong', gene: 'G3_VISION', kp: '第二章：有理数分类与数轴相反数绝对值比大小', analysis: '数轴三要素和标点非常标准，唯独漏看题干“用 < 号连接”，写了逗号扣1分。' },
  { q: '21', type: '解答题(10分·应用)', stem: '国庆8天海滨度假区游客人数变化表，每日限流8万人，每位40元，求(1)10月2日人数(2)最多比最少多几万(3)8天总收入', student: '(1)7.2万 (2)7.1万 (3)16120000元 🌟', correct: '7.2万；7.1万；1612万元', score: 10, max: 10, status: 'highlight', gene: 'G6_MODEL', kp: '第二章：有理数加减法法则与增减变化应用题模型', analysis: '🌟【满分亮点】逐行递推算出每天人数，且敏锐注意到“每日限流8万人”把8.4万和8.7万截断为8万！' },
  { q: '22', type: '解答题(10分·压轴)', stem: '数轴与绝对值几何意义：(1)|x+5|=6；(2)|x+3|+|x-1|最小整数解与差的最大值；(3)|x+2|+|x+6|+|x-1|最小值；(4)菜鸟驿站选址最低运费', student: '(1)1[漏-11] (2)4[漏填整数] (3)x=0,9[错] (4)在B或C点,12000元 🌟', correct: '(1)1或-11 (2)-3,-2,-1,0,1; 4 (3)x=-2,最小7 (4)B,C之间,12元/12000元', score: 5, max: 10, status: 'wrong', gene: 'G6_MODEL', kp: '第二章：数轴与绝对值动点最值模型', analysis: '第(4)问通过枚举找到B或C点12000元非常棒！但第(1)问漏解-11，第(3)问不会“奇点取中法(x=-2得7)”。' }
];

// 25张照片的8大档案分组元数据
const PHOTO_ARCHIVES = [
  {
    groupTitle: '档案 1：《2026初一数学学情调研》答题卡(82/120分) + 4页原卷',
    badge: '🏆 阶段大考 · 82/120分',
    badgeClass: 'status-red',
    summary: '全卷22题，选择得15/30分、填空得12/20分、解答得55/70分。压轴第10题与第21题满分，失分集中于异号加减、乘方符号、数轴找整数与奇点取中法。',
    photos: [
      { file: '微信图片_20261017191559_1333_188.jpg', title: '答题卡 第1-2页 (总分82分)', note: '含选填作答及16~20题解答过程，可见16(1)算成18.3、18(1)算成-5、18(2)漏乘×9' },
      { file: '微信图片_20261017191558_1332_188.jpg', title: '答题卡 第3-4页 (21-22题)', note: '第21题国庆限流应用题满分；第22题枚举算出B/C点12000元' },
      { file: '微信图片_20261017191603_1337_188.jpg', title: '调研原卷 第1页 (选择1-9题)', note: '同 1316.jpg，署名：四班 王若婷' },
      { file: '微信图片_20261017191602_1336_188.jpg', title: '调研原卷 第2页 (10-18题)', note: '同 1317.jpg，第14题上方有手写草稿“-2,-1,0,1”（漏掉-3的铁证）' },
      { file: '微信图片_20261017191601_1335_188.jpg', title: '调研原卷 第3页 (19-21题)', note: '同 1318.jpg，有理数分类、数轴与国庆限流应用题题干' },
      { file: '微信图片_20261017191600_1334_188.jpg', title: '调研原卷 第4页 (22题压轴)', note: '同 1319.jpg，数轴绝对值几何意义与菜鸟驿站选址压轴题题干' }
    ]
  },
  {
    groupTitle: '档案 2：随堂小测窄纸条（正面6道计算 + 背面有理数分类）',
    badge: '🚨 错题重灾区 · 正面6错5',
    badgeClass: 'status-red',
    summary: '正面6道有理数四则运算仅第9题做对，其余5道全错！集中爆发了“同号相除忘变正”、“18÷(-6)写成-18×6”、“-24×(...)去括号后两项漏变号”三大典型病灶。',
    photos: [
      { file: '微信图片_20261017190953_1314_188.jpg', title: '随堂小测正面 (1,3,5,7,9,11题)', note: '第1题填-24(应为-2)；第3题填-7(应为-1)；第5题18÷(-6)写成-18×6=-108；第11题分配律漏变号' },
      { file: '微信图片_20261017190959_1315_188.jpg', title: '随堂小测背面 (分类与探究)', note: '同 1338.jpg，非负整数0,21正确，但把带分数 -1又2/3 在分数行抄成 -2/3' }
    ]
  },
  {
    groupTitle: '档案 3：《中秋作业》4页综合卷（含极其优秀的二刷自查痕迹）',
    badge: '🌟 二刷救回8题 · 留7处错因',
    badgeClass: 'status-yellow',
    summary: '孩子做完第一遍后主动用深色笔进行了二次检查，自己救回了8道初做错题！但暴露了第9题草稿把乘方当乘法、第15题画圈把“-3,”看成“-3.1”、第19题漏看换行“-7”等细节问题。',
    photos: [
      { file: '微信图片_20261017191548_1321_188.jpg', title: '《中秋作业》第1-2页', note: '二刷自查改对了第4,6,7,8,11,14,16(1)题；第16(2)题算 -1-4=3 导致最小值求错' },
      { file: '微信图片_20261017191549_1322_188.jpg', title: '《中秋作业》第3页', note: '第15题自己在“-3,”上画圈导致看成“-3.1”；第18(2)题 |a+b|=a+b 漏掉 a=5,b=-3 的解' },
      { file: '微信图片_20261017191547_1320_188.jpg', title: '《中秋作业》第4页', note: '第17(4)(6)乘除顺序与倒数错；第18(3)补写2.7后漏加；第19题漏看换行“-7”致三问全错' }
    ]
  },
  {
    groupTitle: '档案 4：有理数的混合运算 1（作业 + 学历案 + 第5-6页综合卷）',
    badge: '⚠️ 概念雷区 · 除法分配律',
    badgeClass: 'status-red',
    summary: '在综合卷第9题把原本写对的通分涂掉，生造了“除法左分配律”；在作业底部改错题误以为乘除混合可以先算后面的乘法；在 (-4)^3 中算成了 -12。',
    photos: [
      { file: '微信图片_20261017191557_1331_188.jpg', title: '混合运算综合卷 (第5-6页)', note: '第9题生造除法分配律算得-120(应为-288)；第14题把+1.4涂改成-1.4；第14(4)把÷9写成×9' },
      { file: '微信图片_20261017191553_1327_188.jpg', title: '作业：有理数的混合运算 1', note: '第3,4题把(-1)^2算成-1；第5(3)把(-4)^3算成-12；底部诊断题误判“除法结合律”正确' },
      { file: '微信图片_20261017191554_1328_188.jpg', title: '学历案：有理数的混合运算 1', note: '10题对8题！仅训练(6)负负得正算反、检测右题 4/9-2 算成 5/9' },
      { file: '微信图片_20261017190939_1313_188.jpg', title: '活页纸手写 4道混合运算', note: '①②③全对；第④题跨行抄写把 (-1/2)^3 的指数 3 漏掉算成 -1/2' }
    ]
  },
  {
    groupTitle: '档案 5：有理数的乘法运算律（作业 + 学历案）',
    badge: '📋 课堂笔记规范 · 负数比大小错',
    badgeClass: 'status-yellow',
    summary: '学历案上红笔课堂笔记极规范，基础分配律全对；但作业中把算对的最大值 8 涂改成 2，7×(-1+3/14) 连错两次，滚动复习4道负数比大小错3道。',
    photos: [
      { file: '微信图片_20261017191555_1329_188.jpg', title: '作业：有理数的乘法运算律', note: '第2(1)题把8涂改成2；第4(3)题一错二错；第5题4道负数比大小全填 < 错3道' },
      { file: '微信图片_20261017191556_1330_188.jpg', title: '学历案：有理数的乘法运算律', note: '红笔笔记很棒；典例(4) 28+27算成57且27/15未约分；当堂检测漏抄 ×1/16' }
    ]
  },
  {
    groupTitle: '档案 6：有理数加减法的应用 & 练习卷第2页（9.15作业 + 学历案 + 散页）',
    badge: '📈 早期基础档案',
    badgeClass: 'status-yellow',
    baseDir: '02_数学/1017 日常做题图片',
    summary: '练习卷第2页选填7题全对（含数轴折叠-2029）；血压题主动标五角星自我订正；流花河水位题填表因周三算错一位引发周四至周日串行。',
    photos: [
      { file: '微信图片_20261017191550_1323_188.jpg', title: '练习卷第2页 (选填9-15+计算16)', note: '9~15题7题全对；16(1)减负数变号错且未写完，16(3)把3又1/3抄成1又1/3' },
      { file: '微信图片_20261017191551_1325_188.jpg', title: '作业：有理数的加减法的应用', note: '第2题把 |(-7)+(+4)| 拆成 7+4=11；第7题血压表画星号提醒自己但比大小 < 写成 >' },
      { file: '微信图片_20261017191552_1326_188.jpg', title: '学历案：有理数加减运算的应用', note: '流花河水位题已红笔订正；填表题周三34.06算成34.09导致后面串格' }
    ]
  },
  {
    groupTitle: '档案 7（10.21 生物）：《初一生物学情调研》答题卡与试卷 + 显微镜实验报告单与复习默写',
    badge: '🧬 生物 6 张 · 非选择38分',
    badgeClass: 'status-yellow',
    baseDir: '07_生物/1021 日常做题图片',
    summary: '已归入 07_生物/1021 日常做题图片/。涵盖期中复习背诵默写单、显微镜实验报告单（已红笔补记★往哪偏往哪移）及初一生物学情调研答题卡与试卷。',
    photos: [
      { file: '微信图片_20261021191828_1365_188.jpg', title: '生物期中复习知识点默写 (第1~2页)', note: '生物的共同特征与观察周边环境中的生物，手写默写扎实质感好' },
      { file: '微信图片_20261021191830_1366_188.jpg', title: '显微镜实验报告单 (六4班 王若婷)', note: '把物像移到中央误写成“往相反方向移动”，需牢记“像偏哪往哪移”' },
      { file: '微信图片_20261021191833_1367_188.jpg', title: '光学显微镜复习默写单 (第5~6页)', note: '左上角主动红星补记“★往哪偏往哪移”，部件功能记忆清晰' },
      { file: '微信图片_20261021191835_1368_188.jpg', title: '初一生物学情调研 答题卡 (非选择38分)', note: '28(4)变异曾误写为遗传后订正；28(6)结构漏写；29(4)归纳推理错' },
      { file: '微信图片_20261021191837_1369_188.jpg', title: '初一生物学情调研 试卷第3~4页', note: '显微镜“马”字倒像、黑藻胞质环流方向、鼠妇对照实验题干' },
      { file: '微信图片_20261021191838_1370_188.jpg', title: '初一生物学情调研 试卷第1~2页', note: '第1~18题选择题，第2、7、14、15、18题有订正标记' }
    ]
  },
  {
    groupTitle: '档案 8（10.21 英语）：《预备单元与Unit 1》单词听写(4分)、二默(54分)与周测卷',
    badge: '🔤 英语 10 张 · 急需听写突破',
    badgeClass: 'status-red',
    baseDir: '03_英语/1021 日常做题图片',
    summary: '已归入 03_英语/1021 日常做题图片/。阅读对话基础尚可，但手写听写(4分)与二默(54分)暴露自然拼读音形对应薄弱（schoolbag, pencil, white, blue, colour, where, grade, favorite 等拼写字母颠倒）。',
    photos: [
      { file: '微信图片_20261021191839_1371_188.jpg', title: 'Bridging Unit 2 复习 & 基础知识', note: '句型转换、完形填空与 My room 书面表达' },
      { file: '微信图片_20261021191842_1372_188.jpg', title: 'Bridging Unit 2 Over to you 练习卷', note: 'Where错拼为Whrer；出现 I keep am tidy、are is under 语法混搭' },
      { file: '微信图片_20261021191845_1373_188.jpg', title: 'Bridging Unit 2 单词默写单 (一默)', note: 'tidy→tiey, schoolbag→schloobag, pencil→penit, blue→bule, white→wite' },
      { file: '微信图片_20261021191847_1374_188.jpg', title: 'Bridging Unit 2 单词默写单 (二默·54分)', note: '订正对了 keep/blue/some，但 schoolbag/pencil/white/colour/chair 仍错' },
      { file: '微信图片_20261021191850_1375_188.jpg', title: '9.19 英语周末作业 (Homework)', note: '音标拼读写词与阅读理解表达' },
      { file: '微信图片_20261021191853_1376_188.jpg', title: 'Bridging Unit 2 Section A 预习过关单', note: '文具与颜色词汇及询问物品颜色对话' },
      { file: '微信图片_20261021191854_1377_188.jpg', title: '9.23 初一英语周测卷 (满分100分)', note: '字母左邻右舍、/θ/与/ð/辨音、补全对话与完形填空' },
      { file: '微信图片_20261021191857_1378_188.jpg', title: 'Bridging Unit 1 基础知识 & 复习卷', note: '26字母音素归类与介绍自己及朋友 Wang Yaming 作文' },
      { file: '微信图片_20261021191900_1379_188.jpg', title: '初一英语周测 · Unit 2 综合测试', note: '名词复数规则变化与句型转换' },
      { file: '微信图片_20261021192205_1385_188.jpg', title: 'Unit 1 核心词汇手写听写纸 (4分)', note: 'grade→grate, year→yare, favorite→fevoret，已全部导入互动听写词库' }
    ]
  },
  {
    groupTitle: '档案 9（10.21 道法）：《初一道法学情调研》答题卡与试卷 + 第一二课小测(34/50分)与导学案',
    badge: '⚖️ 道法 5 张 · 强化主观题术语',
    badgeClass: 'status-yellow',
    baseDir: '04_道法/1021 日常做题图片',
    summary: '已归入 04_道法/1021 日常做题图片/。导学案课堂检测全对，但小测(34/50分)主观题“如何践行诚信”因未分点写教材术语得0分。',
    photos: [
      { file: '微信图片_20261021191903_1380_188.jpg', title: '初一道法学情调研 答题卡 (非选择38分)', note: '涵盖初中生活规划、诚信与宽容宣讲、正确认识自我三大主观题' },
      { file: '微信图片_20261021191906_1381_188.jpg', title: '初一道法学情调研 试卷第1~2页', note: '选择题1~20题，第10、17、20题有错题订正标记' },
      { file: '微信图片_20261021191908_1382_188.jpg', title: '道法第一二课小测试 答题卡 (34/50分)', note: '选择18/22分，非选择16/28分；第(4)问践行诚信得0分' },
      { file: '微信图片_20261021191911_1383_188.jpg', title: '9.14 道法 3.1《宽容待人》导学案', note: '课堂选择题1~4全对(B,B,B,B)，简答题分析宽容是有原则的' },
      { file: '微信图片_20261021191914_1384_188.jpg', title: '第一二课小测试 50分 试卷原卷', note: '适应初中生活、一诺千金诚信、评析演出服穿一次退货行为' }
    ]
  }
];

// 6道针对若婷真实错题定制的靶向除根重测题（在线遮挡自测）
const REMEDIATION_PROBLEMS = [
  {
    id: 'R1',
    title: '靶向第 1 题：破除“除法左分配律”伪概念（源自 1331 第 9 题原题）',
    targetGene: '🧠 概念本质 (G1) · 🔢 运算律 (G2)',
    kp: '第二章：有理数乘除法与分配律正逆巧算陷阱',
    question: '计算（写出规范通分步骤，严禁拆开除）：$$24 \\div \\left(\\frac{1}{2} - \\frac{1}{3} - \\frac{1}{4}\\right)$$',
    wrongRemind: '⚠️ 若婷原错解：把写对的通分涂掉，拆成 $24\\div\\frac{1}{2} + 24\\div(-\\frac{1}{3}) + 24\\div(-\\frac{1}{4}) = -120$。',
    answer: '**标准答案：$-288$**\\n- 第一步（先通分算括号内）：原式 $= 24 \\div \\left(\\frac{6}{12} - \\frac{4}{12} - \\frac{3}{12}\\right) = 24 \\div \\left(-\\frac{1}{12}\\right)$\\n- 第二步（除变乘取倒数）：$= 24 \\times (-12) = \\mathbf{-288}$。\\n- **铁律口诀**：“乘法有分配，除法无分配！除号在括号前，必须先算括号里面！”'
  },
  {
    id: 'R2',
    title: '靶向第 2 题：负因数在括号前的乘法分配律（源自 1314 第 11 题原题）',
    targetGene: '🔢 正负符号与分配律 (G2)',
    kp: '第二章：有理数乘除法与分配律正逆巧算陷阱',
    question: '计算：$$-\\frac{3}{7} \\div \\left(-\\frac{6}{7}\\right) - 24 \\times \\left(\\frac{2}{3} + \\frac{3}{4} - \\frac{1}{12}\\right)$$',
    wrongRemind: '⚠️ 若婷原错解：把后面展开写成 $-24\\times\\frac{2}{3} + 24\\times\\frac{3}{4} - 24\\times\\frac{1}{12} = -16+18-2 = 0$（后两项漏乘负号！）。',
    answer: '**标准答案：$-31\\frac{1}{2}$（或 $-\\frac{63}{2}$）**\\n- 第一步：先把 $-24\\times(\\dots)$ 改写为 $+(-24)\\times[\\dots]$，连同负号打包带进每一项！\\n- 第二步：原式 $= +\\left(\\frac{3}{7}\\times\\frac{7}{6}\\right) + (-24)\\times\\frac{2}{3} + (-24)\\times\\frac{3}{4} + (-24)\\times\\left(-\\frac{1}{12}\\right)$\\n- 第三步：$= \\frac{1}{2} - 16 - 18 + 2 = \\frac{1}{2} - 32 = \\mathbf{-31\\frac{1}{2}}$。'
  },
  {
    id: 'R3',
    title: '靶向第 3 题：带分数拆项除法与整数取倒数（源自 1331 第 14(4) 题原题）',
    targetGene: '🔢 除变乘取倒数 (G2) · ⚡ 巧算意识 (G6)',
    kp: '第二章：有理数乘除法与分配律正逆巧算陷阱',
    question: '用简便方法计算：$$\\left(-27\\frac{9}{11}\\right) \\div 9$$',
    wrongRemind: '⚠️ 若婷原错解：直接把 $\\div 9$ 写成了 $\\times 9$，且化假分数硬算得出 $-\\frac{2754}{11}$。',
    answer: '**标准答案：$-3\\frac{1}{11}$**\\n- 第一步（除变乘，整数 $9$ 翻身变 $\\frac{1}{9}$）：原式 $= \\left(-27 - \\frac{9}{11}\\right) \\times \\frac{1}{9}$\\n- 第二步（分配律拆项口算）：$= -27 \\times \\frac{1}{9} - \\frac{9}{11} \\times \\frac{1}{9} = -3 - \\frac{1}{11} = \\mathbf{-3\\frac{1}{11}}$。'
  },
  {
    id: 'R4',
    title: '靶向第 4 题：异号加减防短路与乘方符号（源自学情调研 3、16(1)、18(1)）',
    targetGene: '🔢 异号加减定则 (G2) · 🧠 乘方符号 (G1)',
    kp: '第二章：有理数加减法法则与增减变化应用题模型',
    question: '计算：$$-1^{2024} + (-1)^{2024} - 4.2 + 5.7 - 8.4 + 10$$',
    wrongRemind: '⚠️ 若婷原错解：误以为 $(-1)^{2024}$ 与 $-1^{2024}$ 相等；算 $-12.6 + 5.7$ 时把异号相加算成了 $12.6+5.7=18.3$。',
    answer: '**标准答案：$3.1$**\\n- 第一步（乘方符号）：$-1^{2024} = -1$，$(-1)^{2024} = +1$，两者相加得 $0$！\\n- 第二步（同号结合）：$[(-4.2) + (-8.4)] + (5.7 + 10) = -12.6 + 15.7$\\n- 第三步（异号相加先定正号，再拿大减小）：$= +(15.7 - 12.6) = \\mathbf{3.1}$。'
  },
  {
    id: 'R5',
    title: '靶向第 5 题：两个负数比大小与数轴区间找整数（源自调研 14 & 1329 第 5 题）',
    targetGene: '🧠 负数比大小 (G1) · 👁️ 数轴直觉 (G3)',
    kp: '第二章：有理数分类与数轴相反数绝对值比大小',
    question: '（1）比较大小（写出通分绝对值）：$-\\frac{8}{9}$ \\_\\_\\_\\_ $-\\frac{9}{10}$ ； $-|-\\frac{3}{4}|$ \\_\\_\\_\\_ $-\\frac{4}{5}$\\n（2）比 $-3\\frac{1}{2}$ 大而比 $2\\frac{1}{3}$ 小的所有整数是\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_，它们的和为\\_\\_\\_\\_。',
    wrongRemind: '⚠️ 若婷原错解：（1）全填了 `<`；（2）在卷子上写 `-2, -1, 0, 1`，漏掉了 `-3`！',
    answer: '**标准答案：（1）`>` ， `>` ；（2）`-3, -2, -1, 0, 1, 2` ，和为 `-3`**\\n- 解析：（1）$|-\\frac{8}{9}|=\\frac{80}{90} < |-\\frac{9}{10}|=\\frac{81}{90}$，绝对值大的反而小，故填 `>`；$-0.75 > -0.8$，故填 `>`。\\n- （2）画数轴可知 $-3$ 在 $-3.5$ 的右边，比 $-3.5$ 大，切勿漏掉 $-3$！'
  },
  {
    id: 'R6',
    title: '靶向第 6 题：数轴绝对值几何意义“奇点偶段法”（源自学情调研 22(1)(2)(3) 原题）',
    targetGene: '⚡ 压轴模型奇点偶段法 (G6)',
    kp: '第二章：数轴与绝对值动点最值模型',
    question: '（1）若 $|x + 5| = 6$，则 $x =$ \\_\\_\\_\\_\\_\\_\\_\\_；\\n（2）当 $|x + 3| + |x - 1|$ 取最小值时，$x$ 可取的整数有\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_，最小值为\\_\\_\\_\\_；\\n（3）当 $x =$ \\_\\_\\_\\_ 时，$|x + 2| + |x + 6| + |x - 1|$ 的值最小，最小值为\\_\\_\\_\\_。',
    wrongRemind: '⚠️ 若婷原错解：（1）只写了 $1$ 漏掉 $-11$；（2）漏填整数解；（3）盲代 $x=0$ 算出 $9$。',
    answer: '**标准答案：（1）$1$ 或 $-11$ ；（2）$-3, -2, -1, 0, 1$ ，最小值为 $4$ ；（3）$x = -2$ ，最小值为 $7$**\\n- **秒杀口诀**：“两站之间段内平（零点 $-3$ 到 $1$ 之间任意整数均可），三站设在正中央（三个零点 $-6, -2, 1$ 从小到大排，取正中间 $x = -2$ 代入得 $0 + 4 + 3 = 7$）！”'
  }
];

// ============================================================================
// 工具函数：Markdown & KaTeX 渲染、日期计算、轻提示
// ============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatSimpleMarkdown(mdText) {
  if (!mdText) return '<p class="text-muted">暂无内容</p>';
  let html = escapeHtml(mdText);

  // Convert WikiLinks [[target|label]] or [[target]] to clickable spans or media links
  html = html.replace(/\[\[([^\]|#\\]+)(?:\\?\|([^\]]+))?(#[^\]]*)?\]\]/g, (m, target, label) => {
    const rawTarget = target.trim();
    const cleanTarget = rawTarget.split('/').pop();
    const display = (label || cleanTarget).trim();
    if (/\.(pdf|doc|docx|jpg|png|mp4)$/i.test(rawTarget)) {
      const mediaUrl = '/vault-media/' + rawTarget.split('/').map(encodeURIComponent).join('/');
      return `<a href="${mediaUrl}" target="_blank" class="graph-nav-link" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">📄 <span>${display}</span></a>`;
    }
    return `<span class="graph-nav-link" onclick="openKnowledgePointByTitle('${cleanTarget.replace(/'/g, "\\'")}')">🔗 ${display}</span>`;
  });

  // Bold & code
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Line breaks & lists
  const lines = html.split(/\r?\n/);
  let out = [];
  let inList = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h4 style="margin:10px 0 6px;color:#0f172a;">${line.slice(4)}</h4>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${line.slice(2)}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${line}</li>`);
    } else if (line.startsWith('&gt;')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<blockquote style="border-left:3px solid #3b82f6;padding:6px 12px;background:#f8fafc;margin:6px 0;font-size:13px;">${line.replace(/^&gt;\s*/, '')}</blockquote>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function renderMathInContainer(el) {
  if (typeof scheduleCurrentScreenTtsPrewarm === 'function') {
    scheduleCurrentScreenTtsPrewarm();
  }
  if (!el || typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  } catch (e) {
    console.warn('KaTeX render warning:', e);
  }
}

function uiIcon(name, size = 18, extraClass = '') {
  const s = size;
  const cls = `ui-svg-icon ${extraClass}`.trim();
  const paths = {
    'layers': '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path>',
    'chart': '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
    'bolt': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"></polygon>',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="currentColor" fill-opacity="0.2"></path>',
    'target': '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>',
    'check': '<polyline points="20 6 9 17 4 12"></polyline>',
    'check-circle': '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.16"></circle><path d="m8.5 12.5 2.5 2.5 5-5"></path>',
    'cross': '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    'cross-circle': '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.16"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path>',
    'clock': '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline>',
    'crown': '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" fill="currentColor" fill-opacity="0.2"></path>',
    'star-fill': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"></polygon>',
    'star-empty': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    'sparkle': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" fill="currentColor" fill-opacity="0.2"></path>',
    'bulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path>',
    'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    'volume-on': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>',
    'volume-off': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>',
    'music-on': '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    'music-off': '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle><line x1="2" y1="2" x2="22" y2="22"></line>',
    'pen': '<path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>',
    'eraser': '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path>',
    'trash': '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    'refresh': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"></polyline>',
    'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
    'cards': '<rect x="5" y="4" width="14" height="16" rx="3"></rect><path d="M9 9h6"></path><path d="M9 13h4"></path>',
    'grid': '<rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect>',
    'steps': '<rect x="3" y="3" width="18" height="5" rx="1.5"></rect><rect x="3" y="10" width="14" height="5" rx="1.5"></rect><rect x="3" y="17" width="10" height="5" rx="1.5"></rect>',
    'list': '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
    'settings': '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="3"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    'play': '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"></polygon>',
    'medal': '<circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>',
    'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle>'
  };
  const body = paths[name] || paths['sparkle'];
  return `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function subjIconSvg(subjName, size = 24) {
  const s = size;
  const map = {
    '数学': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18L12 4 3 20Z" fill="#eef2ff"></path><path d="M12 10v5"></path><circle cx="12" cy="17.5" r="0.8" fill="#4f46e5"></circle></svg>`,
    '语文': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#e64980" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" fill="#fff0f6"></path><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" fill="#fff0f6"></path></svg>`,
    '英语': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#0ca678" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#e6fcf5"></path><path d="m9 13 3-6 3 6"></path><path d="M10 11h4"></path></svg>`,
    '生物': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#2b8a3e" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" fill="#ebfbee"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>`,
    '历史': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#e67700" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" fill="#fff9db"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" fill="#fff9db"></path></svg>`,
    '地理': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#1971c2" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="#e7f5ff"></circle><line x1="3" y1="12" x2="21" y2="12"></line><path d="M12 3a14.5 14.5 0 0 1 4 9 14.5 14.5 0 0 1-4 9 14.5 14.5 0 0 1-4-9 14.5 14.5 0 0 1 4-9z"></path></svg>`,
    '道法': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#f03e3e" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#fff5f5"></path><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>`,
    '物理': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#7048e8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#f3f0ff"></polygon></svg>`,
    '化学': `<svg class="ui-svg-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#d9480f" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.72 18.55A2 2 0 0 0 6.45 21.5h11.1a2 2 0 0 0 1.73-2.95L14 9.31V2" fill="#fff4e6"></path><path d="M8.5 2h7"></path><path d="M7 15h10"></path></svg>`
  };
  return map[subjName] || map['数学'];
}

function getStatusBadge(status) {
  if (status && status.includes('未掌握')) {
    return `<span class="badge status-red">${uiIcon('target', 14)} <span>未掌握</span></span>`;
  }
  if (status && status.includes('复习中')) {
    return `<span class="badge status-yellow">${uiIcon('clock', 14)} <span>复习中</span></span>`;
  }
  if (status && status.includes('已吃透')) {
    return `<span class="badge status-green">${uiIcon('check', 14)} <span>已吃透</span></span>`;
  }
  return `<span class="badge status-gray"><span>待考察</span></span>`;
}

function getDiffBadge(diff) {
  if (!diff) return '';
  if (diff.includes('⭐⭐⭐')) return `<span class="badge diff-3">L3 压轴</span>`;
  if (diff.includes('⭐⭐')) return `<span class="badge diff-2">L2 进阶</span>`;
  return `<span class="badge diff-1">L1 基础</span>`;
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  const cleanMsg = String(msg || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  t.textContent = cleanMsg || msg;
  t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ============================================================================
// 山东淄博鲁教版（五四学制）各年级真实开课科目校准与学段映射核心函数
// ============================================================================

const DEFAULT_ZIBO_54_CURRICULUM = {
  Y1: {
    gradeTitle: '初一（六年级）',
    active: ['语文', '数学', '英语', '道法', '历史', '生物'],
    notStarted: ['地理', '物理', '化学'],
    graduated: [],
    summary: '在读 6 科（语、数、英、道、历、生） · 地理初二开课，物理与化学初三开课'
  },
  Y2: {
    gradeTitle: '初二（七年级）',
    active: ['语文', '数学', '英语', '道法', '历史', '地理', '生物'],
    notStarted: ['物理', '化学'],
    graduated: [],
    summary: '在读 7 科（新增地理！语、数、英、道、历、地、生） · 物理与化学初三开课'
  },
  Y3: {
    gradeTitle: '初三（八年级）',
    active: ['语文', '数学', '英语', '物理', '化学', '道法', '历史', '地理', '生物'],
    notStarted: [],
    graduated: [],
    summary: '在读 9 科全齐（新增物理、化学） · 地理、生物、历史初三下结业会考'
  },
  Y4: {
    gradeTitle: '初四（九年级）',
    active: ['语文', '数学', '英语', '物理', '化学', '道法'],
    notStarted: [],
    graduated: ['地理', '生物', '历史'],
    summary: '在读中考决战科 · 全力冲刺初四中考满贯'
  }
};

function getZiboCurriculumMap() {
  try {
    const saved = localStorage.getItem('ZIBO_54_CUSTOM_CURRICULUM_V4');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.Y1 && parsed.Y2 && parsed.Y3 && parsed.Y4) return parsed;
    }
  } catch (e) {
    console.warn('Curriculum localStorage read warning:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_ZIBO_54_CURRICULUM));
}

function getGradeKeyFromStage(stageCode) {
  if (!stageCode || stageCode === 'ALL') return 'ALL';
  if (stageCode === 'Y1_S1' || stageCode === 'Y1' || stageCode === 'STAGE_Y1' || stageCode === '初一上' || stageCode === '初一下') return 'Y1';
  if (stageCode === 'Y2' || stageCode === 'STAGE_Y2' || stageCode === '初二上' || stageCode === '初二下' || stageCode === '初二') return 'Y2';
  if (stageCode === 'Y3' || stageCode === 'STAGE_Y3' || stageCode === '初三上' || stageCode === '初三下' || stageCode === '初三' || stageCode === '初三全一册') return 'Y3';
  if (stageCode === 'Y4' || stageCode === 'STAGE_Y4' || stageCode === '初四上' || stageCode === '初四下' || stageCode === '初四') return 'Y4';
  return 'ALL';
}

function getSubjectGradeStatus(subjName, stageCode = STATE.stageFocus) {
  const gKey = getGradeKeyFromStage(stageCode);
  if (gKey === 'ALL') return { status: 'active', tag: '四年全周期', note: '初中四年全周期核心学科' };
  const map = getZiboCurriculumMap();
  const cfg = map[gKey] || DEFAULT_ZIBO_54_CURRICULUM.Y1;

  if (cfg.active.includes(subjName)) {
    let specialNote = '本年级正在修读';
    if (gKey === 'Y3' && (subjName === '物理' || subjName === '化学')) specialNote = '初三上学期新开课主科';
    if (gKey === 'Y2' && subjName === '地理') specialNote = '初二上学期新开课（初二、初三修读）';
    if (gKey === 'Y3' && ['地理', '生物', '历史'].includes(subjName)) specialNote = '初三下学期结业会考';
    if (gKey === 'Y4') specialNote = '初四中考总复习决战科目';
    return { status: 'active', tag: '本年级在读', note: specialNote };
  }
  if (cfg.graduated && cfg.graduated.includes(subjName)) {
    return {
      status: 'graduated',
      tag: '已结业',
      note: '已学完并参加结业会考'
    };
  }
  if (subjName === '地理') {
    return {
      status: 'not_started',
      tag: '初二开课',
      note: '地理课在初二、初三开设（初一不开课）'
    };
  }
  return {
    status: 'not_started',
    tag: '初三开课',
    note: '物理/化学在初三上学期开课'
  };
}

function getActiveSubjectNamesForStage(stageCode = STATE.stageFocus) {
  if (!STATE.data) return [];
  const allNames = STATE.data.subjects.map(s => s.name);
  if (stageCode === 'ALL') return allNames;
  return allNames.filter(name => getSubjectGradeStatus(name, stageCode).status === 'active');
}

// 淄博五四学制 8 个精准学期 + 全部学期（简约无Emoji纯文字标签）
const STAGE_OPTIONS = [
  { code: '初一上', pillLabel: '初一上', shortLabel: '初一上 (六上·在读)', desc: '若婷当前在读 · 6科', yearCode: 'Y1', isCurrent: true },
  { code: '初一下', pillLabel: '初一下', shortLabel: '初一下 (六下·6科)', desc: '初一下学期 · 6科', yearCode: 'Y1' },
  { code: '初二上', pillLabel: '初二上', shortLabel: '初二上 (七上·7科)', desc: '初二上学期 · 新开地理', yearCode: 'Y2' },
  { code: '初二下', pillLabel: '初二下', shortLabel: '初二下 (七下·7科)', desc: '初二下学期 · 7科', yearCode: 'Y2' },
  { code: '初三上', pillLabel: '初三上', shortLabel: '初三上 (八上·9科)', desc: '初三上学期 · 新增理化', yearCode: 'Y3' },
  { code: '初三下', pillLabel: '初三下', shortLabel: '初三下 (八下·会考)', desc: '初三下学期 · 地生历会考', yearCode: 'Y3' },
  { code: '初四上', pillLabel: '初四上', shortLabel: '初四上 (九上·中考)', desc: '初四上学期 · 中考一轮', yearCode: 'Y4' },
  { code: '初四下', pillLabel: '初四下', shortLabel: '初四下 (九下·冲刺)', desc: '初四下学期 · 中考冲刺', yearCode: 'Y4' },
  { code: 'ALL', pillLabel: '全部学期', shortLabel: '四年全库 (8学期)', desc: '鲁教版五四学制初中四年全景', yearCode: 'ALL' }
];

function getAcademicYearCode(sem) {
  if (sem === '初一上' || sem === '初一下') return 'Y1';
  if (sem === '初二上' || sem === '初二下' || sem === '初二') return 'Y2';
  if (sem === '初三上' || sem === '初三下' || sem === '初三' || sem === '初三全一册') return 'Y3';
  return 'Y4';
}

function matchesStageFocus(semester, stageCode) {
  if (!stageCode || stageCode === 'ALL') return true;
  if (stageCode === 'Y1_S1') return semester === '初一上';
  if (['Y1', 'Y2', 'Y3', 'Y4'].includes(stageCode)) {
    return getAcademicYearCode(semester) === stageCode;
  }
  if (stageCode.startsWith('STAGE_')) {
    return getAcademicYearCode(semester) === stageCode.replace('STAGE_', '');
  }
  return semester === stageCode;
}

function getFirstValidSemesterForSubject(subjName) {
  if (!STATE.data) return '初一上';
  const sems = ['初一上', '初一下', '初二上', '初二下', '初三上', '初三下', '初四上', '初四下'];
  for (const sem of sems) {
    if (STATE.data.knowledgePoints.some(k => k.subject === subjName && k.semester === sem)) {
      return sem;
    }
  }
  return '初一上';
}

function getDepthTier(diffStr) {
  if (diffStr && diffStr.includes('⭐⭐⭐')) return 3;
  if (diffStr && diffStr.includes('⭐⭐')) return 2;
  return 1;
}

const SUBJECT_THEMES = {
  '数学': {
    accent: '#1d4ed8',
    softBg: '#dbeafe',
    border: '#60a5fa',
    lip: '#2563eb',
    cardBg: 'linear-gradient(155deg, #e0f2fe 0%, #dbeafe 46%, #ffffff 100%)',
    tagBg: '#bfdbfe',
    label: '🍬 蓝莓苏打 · 数理逻辑'
  },
  '语文': {
    accent: '#d61f69',
    softBg: '#fce7f3',
    border: '#ff6ba9',
    lip: '#e11d74',
    cardBg: 'linear-gradient(155deg, #ffe4f1 0%, #fce7f3 46%, #ffffff 100%)',
    tagBg: '#fbcfe8',
    label: '🍓 草莓奶霜 · 诗文素养'
  },
  '英语': {
    accent: '#047857',
    softBg: '#d1fae5',
    border: '#34d399',
    lip: '#059669',
    cardBg: 'linear-gradient(155deg, #d1fae5 0%, #ecfdf5 46%, #ffffff 100%)',
    tagBg: '#a7f3d0',
    label: '🍏 薄荷青苹 · 语言表达'
  },
  '道法': {
    accent: '#e11d48',
    softBg: '#ffe4e6',
    border: '#fb7185',
    lip: '#be123c',
    cardBg: 'linear-gradient(155deg, #ffe4e6 0%, #fff1f2 46%, #ffffff 100%)',
    tagBg: '#fecdd3',
    label: '🍒 樱桃棒糖 · 思辨成长'
  },
  '历史': {
    accent: '#b45309',
    softBg: '#fef3c7',
    border: '#fbbf24',
    lip: '#d97706',
    cardBg: 'linear-gradient(155deg, #fef3c7 0%, #fffbeb 46%, #ffffff 100%)',
    tagBg: '#fde68a',
    label: '🍋 柠檬蜜糖 · 人文时空'
  },
  '生物': {
    accent: '#15803d',
    softBg: '#dcfce7',
    border: '#4ade80',
    lip: '#16a34a',
    cardBg: 'linear-gradient(155deg, #dcfce7 0%, #f0fdf4 46%, #ffffff 100%)',
    tagBg: '#bbf7d0',
    label: '🥝 奇异果冻 · 自然生命'
  },
  '地理': {
    accent: '#0369a1',
    softBg: '#e0f2fe',
    border: '#38bdf8',
    lip: '#0284c7',
    cardBg: 'linear-gradient(155deg, #e0f2fe 0%, #f0f9ff 46%, #ffffff 100%)',
    tagBg: '#bae6fd',
    label: '🧊 海盐波波 · 星球探索'
  },
  '物理': {
    accent: '#6d28d9',
    softBg: '#ede9fe',
    border: '#a78bfa',
    lip: '#7c3aed',
    cardBg: 'linear-gradient(155deg, #ede9fe 0%, #f5f3ff 46%, #ffffff 100%)',
    tagBg: '#ddd6fe',
    label: '🍇 葡萄跳跳 · 科学探究'
  },
  '化学': {
    accent: '#c2410c',
    softBg: '#ffedd5',
    border: '#fb923c',
    lip: '#ea580c',
    cardBg: 'linear-gradient(155deg, #ffedd5 0%, #fff7ed 46%, #ffffff 100%)',
    tagBg: '#fed7aa',
    label: '🍊 蜜橘软糖 · 微观物质'
  }
};

const SEMESTER_CARTOON_THEMES = {
  '初一上': { bg: 'linear-gradient(155deg, #ffe4f1 0%, #fff0f7 52%, #ffffff 100%)', border: '#ff6ba9', lip: '#e11d74', badgeCol: '#be185d', badgeBg: '#fbcfe8' },
  '初一下': { bg: 'linear-gradient(155deg, #ffedd5 0%, #fff7ed 52%, #ffffff 100%)', border: '#fb923c', lip: '#ea580c', badgeCol: '#c2410c', badgeBg: '#fed7aa' },
  '初二上': { bg: 'linear-gradient(155deg, #fef3c7 0%, #fffbeb 52%, #ffffff 100%)', border: '#fbbf24', lip: '#d97706', badgeCol: '#b45309', badgeBg: '#fde68a' },
  '初二下': { bg: 'linear-gradient(155deg, #d1fae5 0%, #ecfdf5 52%, #ffffff 100%)', border: '#34d399', lip: '#059669', badgeCol: '#047857', badgeBg: '#a7f3d0' },
  '初三上': { bg: 'linear-gradient(155deg, #e0f2fe 0%, #f0f9ff 52%, #ffffff 100%)', border: '#38bdf8', lip: '#0284c7', badgeCol: '#0369a1', badgeBg: '#bae6fd' },
  '初三下': { bg: 'linear-gradient(155deg, #ede9fe 0%, #f5f3ff 52%, #ffffff 100%)', border: '#a78bfa', lip: '#7c3aed', badgeCol: '#6d28d9', badgeBg: '#ddd6fe' },
  '初四上': { bg: 'linear-gradient(155deg, #fae8ff 0%, #fdf4ff 52%, #ffffff 100%)', border: '#e879f9', lip: '#c026d3', badgeCol: '#a21caf', badgeBg: '#f5d0fe' },
  '初四下': { bg: 'linear-gradient(155deg, #ffe4e6 0%, #fef3c7 52%, #ffffff 100%)', border: '#fb7185', lip: '#e11d48', badgeCol: '#be123c', badgeBg: '#fecdd3' }
};

function getSubjectTheme(subjName) {
  return SUBJECT_THEMES[subjName] || SUBJECT_THEMES['数学'];
}

function getSemesterCartoonTheme(semCode) {
  return SEMESTER_CARTOON_THEMES[semCode] || SEMESTER_CARTOON_THEMES['初一上'];
}

// ============================================================================
// 🎯 快速选择/判断闯关题库与智能生成引擎 (Curated + Smart Choice & True/False Generator)
// ============================================================================

const CURATED_RAPID_BANK = [
  {
    match: '乘除法与分配律',
    choiceQ: '计算 $24 \\div \\left(\\frac{1}{2} - \\frac{1}{3} - \\frac{1}{4}\\right)$ 的正确结果是（ ）',
    options: [
      '$-288$',
      '$-120$',
      '$288$',
      '$-2$'
    ],
    correctIdx: 0,
    tfQ: '判断正误：计算 $24 \\div (\\frac{1}{2} - \\frac{1}{3} - \\frac{1}{4})$ 时，可以拆成 $24\\div\\frac{1}{2} - 24\\div\\frac{1}{3} - 24\\div\\frac{1}{4} = -120$。',
    tfAnswer: false,
    explanation: '乘法有分配律，除法没有左分配律！除号在括号前时，必须先通分计算括号内：$\\frac{6}{12} - \\frac{4}{12} - \\frac{3}{12} = -\\frac{1}{12}$，再算 $24 \\div (-\\frac{1}{12}) = 24 \\times (-12) = -288$。'
  },
  {
    match: '加减法法则',
    choiceQ: '计算有理数加减混合运算 $-4.2 + 5.7 - 8.4 + 10$ 的结果是（ ）',
    options: [
      '$-3.1$',
      '$3.1$',
      '$28.3$',
      '$15.7$'
    ],
    correctIdx: 1,
    tfQ: '判断正误：计算异号两数相加 $-12.6 + 5.7$ 时，取绝对值较大数的符号“-”，并用大绝对值减去小绝对值，结果为 $-6.9$。',
    tfAnswer: true,
    explanation: '正负分组结合：$(-4.2 - 8.4) + (5.7 + 10) = -12.6 + 15.7 = +(15.7 - 12.6) = 3.1$。'
  },
  {
    match: '乘方的符号陷阱',
    choiceQ: '计算 $-1^{2024} + (-1)^{2024}$ 与 $(-4)^3$ 的值分别是（ ）',
    options: [
      '$2$ 和 $-12$',
      '$-2$ 和 $-64$',
      '$0$ 和 $-64$',
      '$0$ 和 $64$'
    ],
    correctIdx: 2,
    tfQ: '判断正误：$(-1)^{2024}$ 与 $-1^{2024}$ 的底数相同，计算结果都等于 $1$。',
    tfAnswer: false,
    explanation: '$(-1)^{2024}$ 的底数是 $-1$，结果为 $1$；$-1^{2024}$ 表示 $1^{2024}$ 的相反数，结果为 $-1$，两者之和为 $0$。$(-4)^3 = (-4)\\times(-4)\\times(-4) = -64$。'
  },
  {
    match: '混合运算与运算律',
    choiceQ: '计算 $-1^4 + (-\\frac{1}{3}) \\div \\frac{1}{6} - (-2)^3$ 的正确结果是（ ）',
    options: [
      '$-5$',
      '$7$',
      '$-11$',
      '$5$'
    ],
    correctIdx: 3,
    tfQ: '判断正误：计算 $15 \\div (-\\frac{3}{4}) \\times (-4)$ 时，应按从左到右顺序将除法化为乘法：$15 \\times (-\\frac{4}{3}) \\times (-4) = 80$。',
    tfAnswer: true,
    explanation: '先算乘方：$-1^4 = -1$，$(-2)^3 = -8$；再算除法：$(-\\frac{1}{3}) \\times 6 = -2$；最后算加减：$-1 + (-2) - (-8) = -3 + 8 = 5$。'
  },
  {
    match: '相反数绝对值比大小',
    choiceQ: '比 $-3\\frac{1}{2}$ 大而比 $2\\frac{1}{3}$ 小的所有整数的和为（ ）',
    options: [
      '$-3$',
      '$-2$',
      '$0$',
      '$-5$'
    ],
    correctIdx: 0,
    tfQ: '判断正误：两个负数比较大小，绝对值大的反而小，因此 $-\\frac{8}{9} > -\\frac{9}{10}$。',
    tfAnswer: true,
    explanation: '大于 $-3.5$ 且小于 $2.\\dot{3}$ 的整数有：$-3, -2, -1, 0, 1, 2$（注意不要漏掉 $-3$），它们的和为 $(-3)+(-2)+(-1)+0+1+2 = -3$。'
  },
  {
    match: '动点最值模型',
    choiceQ: '当式子 $|x + 2| + |x + 6| + |x - 1|$ 取得最小值时，$x$ 的取值与最小值分别为（ ）',
    options: [
      '$x = 0$，最小值为 $9$',
      '$x = -2$，最小值为 $7$',
      '$x = -6$，最小值为 $11$',
      '$x = 1$，最小值为 $10$'
    ],
    correctIdx: 1,
    tfQ: '判断正误：若 $|x + 5| = 6$，则 $x$ 的值为 $1$ 或 $-11$。',
    tfAnswer: true,
    explanation: '由绝对值几何意义（奇点取中法），三个零点为 $-6, -2, 1$，当 $x$ 取中间零点 $-2$ 时距离之和最小，最小值为 $|-2+2|+|-2+6|+|-2-1| = 0 + 4 + 3 = 7$。'
  },
  {
    match: '展开与折叠',
    choiceQ: '一个正方体的表面展开图中，若“1”与“3”在同行且中间隔着“2”，则折成正方体后与“1”相对的面是（ ）',
    options: [
      '$2$',
      '$4$',
      '$3$',
      '$6$'
    ],
    correctIdx: 2,
    tfQ: '判断正误：在平面图形中，只要包含“田”字格结构，就一定不能折叠成无重叠的正方体。',
    tfAnswer: true,
    explanation: '正方体表面展开图找相对面遵循“同行同列隔一格是对面，或Z字两端是对面”；含“田”字格或“凹”字格的图形折叠时必有面重合。'
  },
  {
    match: '截一个几何体',
    choiceQ: '用一个平面去截一个正方体，所得截面的形状不可能是（ ）',
    options: [
      '等边三角形',
      '梯形',
      '正六边形',
      '七边形'
    ],
    correctIdx: 3,
    tfQ: '判断正误：用一个平面去截圆柱，截面的形状可能是圆、椭圆或长方形。',
    tfAnswer: true,
    explanation: '正方体只有 $6$ 个面，平面最多与 $6$ 个面相交，因此截面边数最多为六边形，绝不可能是七边形。'
  }
];

function hashStringDeterministic(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function countKpQuestions(kp) {
  if (!kp || kp.isUnverified || (kp.status || '').includes('🔒待精校')) return 0;
  if (Array.isArray(kp.quizItems) && kp.quizItems.length > 0) {
    return kp.quizItems.length;
  }
  return 0;
}

function countTotalQuestionsForKps(kps) {
  if (!Array.isArray(kps)) return 0;
  return kps.reduce((sum, k) => sum + countKpQuestions(k), 0);
}

function expandKpsToQuestionQueue(kps, maxTotal = 999) {
  const expanded = [];
  if (!Array.isArray(kps)) return expanded;
  for (const kp of kps) {
    if (!kp || kp.isUnverified || (kp.status || '').includes('🔒待精校')) continue;
    const items = (Array.isArray(kp.quizItems) && kp.quizItems.length > 0)
      ? kp.quizItems
      : (kp.sections && Array.isArray(kp.sections.quizItems) ? kp.sections.quizItems : []);
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        expanded.push({
          ...kp,
          _subQuizItem: items[i],
          _subQIndex: i + 1,
          _subQTotal: items.length
        });
        if (expanded.length >= maxTotal) return expanded;
      }
    }
  }
  return expanded;
}

// ============================================================================
// 升级 2：每次从题库池随机抽取 6～8 题，并支持一键「🔄 随机换新题」
// ============================================================================
function sampleRandomQuestionsFromKps(kps, minCount = 6, maxCount = 8) {
  const fullPool = expandKpsToQuestionQueue(kps, 9999);
  if (fullPool.length === 0) return [];
  const seed = (STATE.quiz && STATE.quiz.randomSeed) ? STATE.quiz.randomSeed : 1;
  // 决定本组题量：在 6～8 题之间（若设置了大于8的 batchSize 则尊重用户显式选择）
  const customBatch = STATE.quiz && STATE.quiz.batchSize;
  const targetCount = (customBatch && customBatch >= 6 && customBatch <= 8)
    ? customBatch
    : (6 + ((seed + fullPool.length) % (maxCount - minCount + 1)));

  // 洗牌（融合随机种子与 Math.random，确保每次点「换新题」都不重样）
  const shuffled = fullPool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 优先兼顾未掌握/复习中考点的题目，同时保持随机性
  const chosen = shuffled.slice(0, Math.min(targetCount, shuffled.length));
  return chosen.map((item, idx) => ({
    ...item,
    _batchIdx: idx + 1,
    _batchTotal: chosen.length
  }));
}

function refreshRandomQuizBatch() {
  if (!STATE.data) return;
  stopSpeakText(true);
  playCommercialSound('flip');
  STATE.quiz.randomSeed = (STATE.quiz.randomSeed || 1) + 1;

  // 若处于互动听写模式，随机重抽 6～8 个听写词条
  if (STATE.quiz.studyStyle === 'dictation') {
    initDictationQueueForSubject(STATE.quiz.subject, true);
    renderQuizModal();
    showToast(`🎲 已随机换了一批新的听写词条（共 ${STATE.quiz.dictation.items.length} 个）！`);
    return;
  }

  const ctx = STATE.quiz.sourceContext;
  if (ctx && ctx.type === 'SINGLE_KP') {
    const kp = STATE.data.knowledgePoints.find(k => k.id === ctx.kpId);
    if (kp) {
      STATE.quiz.queue = sampleRandomQuestionsFromKps([kp], 6, 8);
    }
  } else if (ctx && ctx.type === 'CHAPTER') {
    const pool = STATE.data.knowledgePoints
      .filter(k => k.subject === ctx.subject && (ctx.semester === 'ALL' || k.semester === ctx.semester) && k.chapter === ctx.chapter)
      .sort((a, b) => a.order - b.order);
    STATE.quiz.queue = sampleRandomQuestionsFromKps(pool, 6, 8);
  } else if (ctx && ctx.type === 'SPECIAL') {
    STATE.quiz.queue = sampleRandomQuestionsFromKps(ctx.pool || [], 6, 8);
  } else {
    buildQuizQueue();
    showToast(`🎲 已随机换了一批新题（共 ${STATE.quiz.queue.length} 题）！`);
    renderQuizModal();
    return;
  }

  STATE.quiz.currentIndex = 0;
  STATE.quiz.qVariant = 'main';
  STATE.quiz.hintsShown = { h1: false, h2: false, h3: false };
  STATE.quiz.answerRevealed = false;
  STATE.quiz.flashcardFlipped = false;
  STATE.quiz.unlockedBlockStep = 1;
  STATE.quiz.selectedChoiceIdx = null;
  STATE.quiz.choiceSubmitted = false;
  STATE.quiz.choiceIsCorrect = null;
  STATE.quiz.questionElapsedSec = 0;
  STATE.quiz.totalElapsedSec = 0;
  STATE.quiz.results = [];
  STATE.quiz.finished = false;
  initMatchGameFromQueue();
  renderQuizModal();
  showToast(`🎲 已从题库池随机换了一批新题（共 ${STATE.quiz.queue.length} 题）！`);
}

// ============================================================================
// 升级 5：地区统一教学进度同步引擎（20周标准校历 × 1017/1021 实测进度校准）
// ============================================================================
function getSchoolTeachingProgress(kp, subjSemKps) {
  if (!kp) {
    return { code: 'TAUGHT', label: '📘 全册开放精练', shortLabel: '📘可闯关', color: '#2563eb', bg: '#eff6ff', weekText: '全册开放' };
  }
  // 仅在「初一上」（当前在读学期）启用第 8 周校历期中进度拆分；其余 7 个学期展示全册真实掌握状态
  if (kp.semester !== '初一上') {
    const st = String(kp.status || '');
    if (st.includes('已吃透')) {
      return {
        code: 'TAUGHT',
        label: '🟢 已吃透通关',
        shortLabel: '🟢已吃透',
        color: '#15803d',
        bg: '#dcfce7',
        weekText: `${kp.semester}全册开放`
      };
    }
    if (st.includes('复习中') || st.includes('未掌握')) {
      return {
        code: 'CURRENT',
        label: '🎯 重点巩固中',
        shortLabel: '🎯巩固中',
        color: '#b45309',
        bg: '#fef3c7',
        weekText: `${kp.semester}重点突破`
      };
    }
    return {
      code: 'TAUGHT',
      label: '📘 全册同步开放',
      shortLabel: '📘可闯关',
      color: '#2563eb',
      bg: '#eff6ff',
      weekText: `${kp.semester}全册开放`
    };
  }

  // 当前在读学期（初一上）：按照校历当前教学周（默认第 8 周 / 共 18 周，约 45% 进度）+ 实测卷精确校准
  const week = Number(STATE.schoolCurrentWeek || 8);
  const list = Array.isArray(subjSemKps) && subjSemKps.length > 0
    ? subjSemKps
    : (STATE.data ? STATE.data.knowledgePoints.filter(k => k.subject === kp.subject && k.semester === kp.semester).sort((a, b) => a.order - b.order) : [kp]);
  const total = Math.max(1, list.length);
  const idx = Math.max(0, list.findIndex(k => k.id === kp.id));
  const posRatio = (idx + 1) / total;
  const taughtRatio = Math.min(1, week / 18);
  const currentBandRatio = Math.min(1, (week + 2.5) / 18);
  const estWeek = Math.max(1, Math.min(18, Math.ceil(posRatio * 18)));

  // 针对初一上（当前学期）结合 10.17 数学 / 10.21 生物、英语、道法学情调研卷进度精准对齐
  if (kp.semester === '初一上' && week >= 7 && week <= 10) {
    if (kp.subject === '数学') {
      if (kp.chapter.includes('第一章') || kp.chapter.includes('第二章')) {
        return { code: 'TAUGHT', label: '✅ 学校已学 (期中考纲)', shortLabel: '✅已学', color: '#15803d', bg: '#dcfce7', weekText: `第${estWeek}周已讲` };
      }
      if (kp.chapter.includes('第三章') && idx <= 11) {
        return { code: 'CURRENT', label: '🚩 本周同步 (期中冲刺)', shortLabel: '🚩本周同步', color: '#b45309', bg: '#fef3c7', weekText: `第${week}周在学` };
      }
    } else if (kp.subject === '生物') {
      if (idx <= 5) {
        return { code: 'TAUGHT', label: '✅ 学校已学 (10.21已调研)', shortLabel: '✅已学', color: '#15803d', bg: '#dcfce7', weekText: `第${estWeek}周已讲` };
      }
      if (idx <= 7) {
        return { code: 'CURRENT', label: '🚩 本周同步 (细胞结构)', shortLabel: '🚩本周同步', color: '#b45309', bg: '#fef3c7', weekText: `第${week}周在学` };
      }
    } else if (kp.subject === '英语') {
      if (kp.corePoint.includes('音标') || kp.corePoint.includes('Bridging Unit') || kp.corePoint.includes('Unit 1 ') || kp.corePoint.includes('Unit 2 ')) {
        return { code: 'TAUGHT', label: '✅ 学校已学 (10.21已听写/周测)', shortLabel: '✅已学', color: '#15803d', bg: '#dcfce7', weekText: `第${estWeek}周已讲` };
      }
      if (kp.corePoint.includes('Unit 3 ')) {
        return { code: 'CURRENT', label: '🚩 本周同步 (期中冲刺)', shortLabel: '🚩本周同步', color: '#b45309', bg: '#fef3c7', weekText: `第${week}周在学` };
      }
    } else if (kp.subject === '道法') {
      if (idx <= 2) {
        return { code: 'TAUGHT', label: '✅ 学校已学 (10.21已调研)', shortLabel: '✅已学', color: '#15803d', bg: '#dcfce7', weekText: `第${estWeek}周已讲` };
      }
      if (idx === 3) {
        return { code: 'CURRENT', label: '🚩 本周同步 (期中范围)', shortLabel: '🚩本周同步', color: '#b45309', bg: '#fef3c7', weekText: `第${week}周在学` };
      }
    }
  }

  if (posRatio <= taughtRatio || !kp.status.includes('待考察')) {
    return {
      code: 'TAUGHT',
      label: '✅ 学校已学',
      shortLabel: '✅已学',
      color: '#15803d',
      bg: '#dcfce7',
      weekText: `第${estWeek}周已讲`
    };
  }
  if (posRatio <= currentBandRatio) {
    return {
      code: 'CURRENT',
      label: '🚩 本周同步',
      shortLabel: '🚩本周同步',
      color: '#b45309',
      bg: '#fef3c7',
      weekText: `第${week}周在学`
    };
  }
  return {
    code: 'UPCOMING',
    label: '⏳ 期中后待讲',
    shortLabel: '⏳待讲',
    color: '#64748b',
    bg: '#f1f5f9',
    weekText: `预计第${estWeek}周讲`
  };
}

function setSchoolCurrentWeek(weekVal) {
  playCommercialSound('click');
  STATE.schoolCurrentWeek = Number(weekVal) || 8;
  if (STATE.activeTab === 'macro') renderMacroView();
  if (STATE.activeTab === 'charts') renderChartsView();
  if (STATE.quiz.isOpen) {
    buildQuizQueue();
    renderQuizModal();
  }
}

function setSchoolProgressFilter(filterVal) {
  playCommercialSound('click');
  STATE.schoolProgressFilter = filterVal;
  if (STATE.activeTab === 'macro') renderMacroView();
  if (STATE.quiz.isOpen) {
    buildQuizQueue();
    renderQuizModal();
  }
}

// ============================================================================
// 升级 3：全科互动听写/默写词库 (DICTATION_BANKS) —— 100% 融合 1021 照片错词与各科核心术语
// ============================================================================
const DICTATION_BANKS = {
  '英语': [
    { word: 'schoolbag', phonetic: '/ˈskuːlbæɡ/', cn: 'n. 书包', syllables: 'school · bag', wrongNote: '10.21一默错写成 schloobag，二默错写成 shoolbag（漏了c）', tip: '复合词拆半法：学校 school + 包 bag = 书包！', voice: 'en-US-JennyNeural' },
    { word: 'pencil', phonetic: '/ˈpensl/', cn: 'n. 铅笔', syllables: 'pen · cil', wrongNote: '10.21一默错写成 penit，二默错写成 pienco', tip: '先写钢笔 pen，后面加 cil（c在i前发/s/）！', voice: 'en-US-JennyNeural' },
    { word: 'colour', phonetic: '/ˈkʌlə(r)/', cn: 'n. 颜色 (或美式 color)', syllables: 'col · our', wrongNote: '10.21一默二默均错写成 coler，句型转换漏写', tip: 'col + our（我们 our），英式拼写带 u！', voice: 'en-US-JennyNeural', acceptAlt: ['color'] },
    { word: 'white', phonetic: '/waɪt/', cn: 'adj./n. 白色(的)', syllables: 'wh · ite', wrongNote: '10.21一默二默均漏掉 h 错写成 wite', tip: 'wh 发 /w/，后面是风筝 kite 去 k 换 wh！', voice: 'en-US-JennyNeural' },
    { word: 'blue', phonetic: '/bluː/', cn: 'adj./n. 蓝色(的)', syllables: 'bl · ue', wrongNote: '10.21一默把 l 和 u 颠倒错写成 bule', tip: 'bl 辅音连缀打头，后面跟元音组合 ue！', voice: 'en-US-JennyNeural' },
    { word: 'where', phonetic: '/weə(r)/', cn: 'adv. 在哪里', syllables: 'wh · ere', wrongNote: '10.21练习卷与默写单错写成 whrer', tip: '疑问词 wh + 这里 here 去 h = where！绝不把 r 写到 e 前面！', voice: 'en-US-JennyNeural' },
    { word: 'chair', phonetic: '/tʃeə(r)/', cn: 'n. 椅子', syllables: 'ch · air', wrongNote: '10.21二默错写成 chlir', tip: 'ch 发 /tʃ/ + 空气 air = 椅子 chair！', voice: 'en-US-JennyNeural' },
    { word: 'tidy', phonetic: '/ˈtaɪdi/', cn: 'adj. 整洁的；井井有条的', syllables: 'ti · dy', wrongNote: '10.21一默错写成 tiey，造句错写 I keep am tidy', tip: 'ti (/taɪ/) + dy (/di/)，我是整洁的直接说 I am tidy！', voice: 'en-US-JennyNeural' },
    { word: 'green', phonetic: '/ɡriːn/', cn: 'adj./n. 绿色(的)', syllables: 'gr · een', wrongNote: '10.21二默错写成 grea', tip: 'gr + 双写 ee (/iː/) + n！', voice: 'en-US-JennyNeural' },
    { word: 'welcome', phonetic: '/ˈwelkəm/', cn: 'interj./v. 欢迎 (You are welcome 不用谢)', syllables: 'wel · come', wrongNote: '10.21二默错写成 Wlcom', tip: 'wel(l) 很好地 + come 来 = 欢迎 welcome！', voice: 'en-US-JennyNeural' },
    { word: 'grade', phonetic: '/ɡreɪd/', cn: 'n. 年级；等级', syllables: 'gr · ade', wrongNote: '10.21手写听写纸(1385)错写成 grate', tip: 'gr + ade（a_e 相对开音节，结尾是 d 不是 t）！', voice: 'en-US-JennyNeural' },
    { word: 'favorite', phonetic: '/ˈfeɪvərɪt/', cn: 'adj./n. 最喜爱的 (或英式 favourite)', syllables: 'fa · vor · ite', wrongNote: '10.21手写听写纸(1385)错写成 fevoret', tip: '三音节拍手记：fa + vor + ite！', voice: 'en-US-JennyNeural', acceptAlt: ['favourite'] },
    { word: 'year', phonetic: '/jɪə(r)/', cn: 'n. 年；岁', syllables: 'y · ear', wrongNote: '10.21手写听写纸(1385)错写成 yare', tip: '字母 y + 耳朵 ear = 年 year！', voice: 'en-US-JennyNeural' },
    { word: 'country', phonetic: '/ˈkʌntri/', cn: 'n. 国家', syllables: 'coun · try', wrongNote: '10.21手写听写纸(1385)未默出只写了中文“国家”', tip: 'coun + 尝试 try = 国家 country！', voice: 'en-US-JennyNeural' },
    { word: 'mistake', phonetic: '/mɪˈsteɪk/', cn: 'n. 错误；失误 (make a mistake)', syllables: 'mis · take', wrongNote: '10.21手写听写纸(1385)只写了中文“错误”', tip: '前缀 mis(错) + 拿 take = 犯错 mistake！', voice: 'en-US-JennyNeural' },
    { word: 'greet', phonetic: '/ɡriːt/', cn: 'v. 招呼；问候', syllables: 'gr · eet', wrongNote: '10.21手写听写纸(1385)未默出', tip: '把绿色 green 结尾的 n 换成 t 就是问候 greet！', voice: 'en-US-JennyNeural' },
    { word: 'hobby', phonetic: '/ˈhɒbi/', cn: 'n. 业余爱好', syllables: 'hob · by', wrongNote: '10.21手写听写纸(1385)重点词', tip: 'hob + by（双写 b 加 y）！', voice: 'en-US-JennyNeural' },
    { word: 'each other', phonetic: '/iːtʃ ˈʌðə(r)/', cn: 'pron. 互相；彼此', syllables: 'each · oth · er', wrongNote: '10.21手写听写纸(1385)短语必考', tip: 'each（每个）+ other（另一个）= 互相！', voice: 'en-US-JennyNeural' }
  ],
  '生物': [
    { word: '变异', phonetic: '核心术语', cn: '“一母生九子，九子各不同”体现的生物特征是____', syllables: '变 · 异', wrongNote: '10.21生物学情调研答题卡28(4)误写为“遗传”后涂改订正', tip: '亲子代相似叫“遗传”，亲子代或子代间有差异叫“变异”！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '结构', phonetic: '核心术语', cn: '除病毒外，细胞是生物体____和功能的基本单位', syllables: '结 · 构', wrongNote: '10.21生物学情调研答题卡28(6)漏写“结构”', tip: '死记黄金搭档：细胞是生物体【结构】和【功能】的基本单位！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '归纳', phonetic: '科学思维', cn: '从众多胃炎患者体内都发现幽门螺杆菌，推出该菌引发胃炎，属于____推理', syllables: '归 · 纳', wrongNote: '10.21生物学情调研29(4)失分点', tip: '由一系列具体事实推出一般结论 = 归纳；由一般原理推出个别结论 = 演绎！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '单一变量', phonetic: '实验原则', cn: '对照实验中，除研究的因素不同外，其他条件都必须相同且适宜，这叫____原则', syllables: '单 · 一 · 变 · 量', wrongNote: '10.21生物学情调研30(2)③鼠妇实验表述不严密', tip: '对照实验灵魂四字：单一变量（控制变量）！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['控制单一变量', '控制变量'] },
    { word: '右上', phonetic: '显微镜口诀', cn: '显微镜视野中物像偏在“右上方”，要把物像移到视野中央，玻片应向____方移动', syllables: '右 · 上', wrongNote: '10.21实验报告单(1366)误写成“往相反方向移动”', tip: '★必背口诀：像偏哪，玻片就往哪移（同向移动法）！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['右上方'] },
    { word: '细准焦螺旋', phonetic: '显微镜构造', cn: '显微镜下已经找到物像但有些模糊，应调节________使物像更清晰', syllables: '细 · 准 · 焦 · 螺 · 旋', wrongNote: '期中高频必考填空', tip: '大幅升降找物像用“粗准焦螺旋”，微调变清晰必用“细准焦螺旋”！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '转换器', phonetic: '显微镜构造', cn: '显微镜中由低倍物镜换成高倍物镜时，必须转动______，严禁直接扳物镜', syllables: '转 · 换 · 器', wrongNote: '期中实验操作必考', tip: '三个物镜安装在圆盘形的“转换器”上！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '凹面镜', phonetic: '显微镜对光', cn: '当外界光线较弱（暗）时，使用显微镜对光应选用大光圈和反光镜的______', syllables: '凹 · 面 · 镜', wrongNote: '光线强弱调节易混', tip: '光暗需要聚光：大光圈 + 凹面镜！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '道法': [
    { word: '诚信意识', phonetic: '主观题采分词', cn: '践行诚信的第一条要求：树立________，真诚待人，讲信用', syllables: '诚 · 信 · 意 · 识', wrongNote: '10.21第一二课小测(34/50分)践行诚信大题得0分', tip: '道法主观题必写采分术语：树立诚信意识 + 珍惜个人诚信记录！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '原则', phonetic: '辨析核心词', cn: '宽容他人无心之失，但对故意破坏公物绝不纵容，说明宽容是有____的', syllables: '原 · 则', wrongNote: '10.21导学案(1383)第5题核心结论', tip: '宽容不是无底线妥协，宽容必须讲究原则与底线！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '重要但不紧急', phonetic: '时间管理四象限', cn: '做好初中规划，我们应把50%~60%的时间花在“____________”的事情上（如制订长期学习计划）', syllables: '重 · 要 · 但 · 不 · 紧 · 急', wrongNote: '10.21道法调研卷第21/23题时间管理高频易混', tip: '有规划的人优先做“重要但不紧急”的事，没规划的人总在救火“重要且紧急”的事！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['重要不紧急'] },
    { word: '扬长避短', phonetic: '做更好的自己', cn: '做更好的自己，要善于利用自己的优点和长处，最大限度地展现才华，这叫________', syllables: '扬 · 长 · 避 · 短', wrongNote: '第二课《正确认识自我》必背四字成语', tip: '做更好的自己四步曲：接纳与欣赏自己 + 扬长避短 + 主动改正缺点 + 激发潜能！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '努力', phonetic: '第三课核心词', cn: '梦想与现实之间的桥梁是____', syllables: '努 · 力', wrongNote: '第三课《梦想始于当下》金句填空', tip: '少年有梦，不应止于心动，更要付诸行动；努力是梦想与现实之间的桥梁！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '自尊', phonetic: '品格修养', cn: '真正有____的人，既能看到自己的优点，也能坦然面对自己的不足，绝不爱慕虚荣', syllables: '自 · 尊', wrongNote: '10.21道法调研卷第10题自尊与虚荣辨析', tip: '追求表面荣耀是“虚荣”，接纳自我并尊重他人是“自尊”！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '数学': [
    { word: '-288', phonetic: '除号无分配律', cn: '计算 24 ÷ (1/2 - 1/3 - 1/4) 的正确结果是____', syllables: '-288', wrongNote: '10.17综合卷(1331)第9题把写对的通分涂掉，拆开算成 -120', tip: '先通分算括号内 1/2-1/3-1/4 = -1/12，再算 24 × (-12) = -288！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '3.1', phonetic: '异号加减口诀', cn: '计算 -12.6 + 5.7 + 10 的正确结果是____', syllables: '3.1', wrongNote: '10.17数学调研卷16(1)把 -12.6+5.7 算成 +18.3 得 28.3（扣5分）', tip: '-12.6 + 5.7 异号相加取负号、大减小得 -6.9，再加 10 得 3.1！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '-4053', phonetic: '非负性0+0=0', cn: '若 |a + 2026| + |b - 2027| = 0，则 a - b 的值是____', syllables: '-4053', wrongNote: '10.17数学调研卷第15题考场上写成 1（扣4分）', tip: 'a = -2026，b = 2027，所以 a - b = -2026 - 2027 = -4053！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '7', phonetic: '奇点偶段法', cn: '代数式 |x + 2| + |x + 6| + |x - 1| 的最小值是____', syllables: '7', wrongNote: '10.17数学调研卷压轴22(3)盲代 x=0 算成 9', tip: '三站设在正中央！零点 -6, -2, 1 正中间是 x = -2，代入得 0 + 4 + 3 = 7！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '-3', phonetic: '数轴找整数', cn: '比 -3.5 大而比 2.3 小的所有整数之和是____', syllables: '-3', wrongNote: '10.17数学调研卷第14题草稿写 -2,-1,0,1 漏掉了 -3', tip: '整数有 -3, -2, -1, 0, 1, 2，正负抵消后剩 -3！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '倒数', phonetic: '有理数除法法则', cn: '除以一个不等于 0 的数，等于乘这个数的____', syllables: '倒 · 数', wrongNote: '10.17小测(1314)把 18÷(-6) 写成 -18×6，把 ÷9 写成 ×9', tip: '除号变乘号，除数必须翻身取倒数（÷9 变成 ×1/9）！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '语文': [
    { word: '情景交融', phonetic: '写景散文核心手法', cn: '老舍《草原》前半写草原风光，后半写蒙汉联欢，达到“________”的艺术境界', syllables: '情 · 景 · 交 · 融', wrongNote: '赏析题易漏写四字术语', tip: '一切景语皆情语：写景是为了抒情，叫情景交融（借景抒情）！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['借景抒情'] },
    { word: '托物言志', phonetic: '《丁香结》核心手法', cn: '宗璞借丁香结的不顺心象征人生的愁怨与旷达，这种写作手法叫________', syllables: '托 · 物 · 言 · 志', wrongNote: '易与单纯写景混淆', tip: '把人生志向、哲理寄托在具体事物（丁香、竹石、梅花）上 = 托物言志！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '点面结合', phonetic: '群像场面描写手法', cn: '《狼牙山五壮士》既写五位战士整体痛击敌人，又重点刻画马宝玉等个人动作，这叫________', syllables: '点 · 面 · 结 · 合', wrongNote: '第二单元革命场面赏析必考四字词', tip: '整体全景是“面”，个体特写是“点”：既有整体气势又有突出典型！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '欲扬先抑', phonetic: '叙事波澜手法', cn: '先写对某人某物的不满或平淡印象，后文笔锋一转大力赞美，这种手法叫________', syllables: '欲 · 扬 · 先 · 抑', wrongNote: '易把“抑”字写错', tip: '想要褒扬（扬），先压低（抑），形成强烈反差与波澜！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['先抑后扬'] },
    { word: '乌蒙磅礴走泥丸', phonetic: '《七律·长征》名句', cn: '毛泽东《七律·长征》中与“五岭逶迤腾细浪”对仗的夸张名句是：______________ ', syllables: '乌·蒙·磅·礴·走·泥·丸', wrongNote: '注意“磅礴”二字都是石字旁', tip: '把乌蒙大山比作脚下滚动的小泥丸，彰显红军藐视困难的革命乐观主义！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '野旷天低树', phonetic: '《宿建德江》名句', cn: '孟浩然《宿建德江》中与“江清月近人”对仗的写景名句是：__________', syllables: '野 · 旷 · 天 · 低 · 树', wrongNote: '注意“旷”是日字旁，“低”不要多点', tip: '原野空旷显得天空比远树还要低，江水清澈更觉明月亲近人！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '明月别枝惊鹊', phonetic: '《西江月》名句', cn: '辛弃疾《西江月·夜行黄沙道中》与“清风半夜鸣蝉”对仗的上句是：____________', syllables: '明·月·别·枝·惊·鹊', wrongNote: '注意“鹊”字写法', tip: '以动衬静名句：明月升上树枝惊飞喜鹊，清风吹拂半夜传来蝉鸣！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '鞠躬尽瘁', phonetic: '《菊花》/名臣精神', cn: '形容为革命事业或国家大事竭尽全力、不辞辛劳的四字成语（后接“死而后已”）是________', syllables: '鞠 · 躬 · 尽 · 瘁', wrongNote: '“瘁”是病字旁加卒，切忌写成“粹”', tip: '病字旁“瘁”表示劳累过度：鞠躬尽瘁，死而后已！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '历史': [
    { word: '元谋人', phonetic: '中国境内早期人类', cn: '距今约170万年，我国境内目前已知最早的古人类是云南______', syllables: '元 · 谋 · 人', wrongNote: '易与距今70万~20万年的北京人混淆', tip: '我国境内最早古人类 = 云南元谋人（170万年，会制造工具和使用火）！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '河姆渡人', phonetic: '长江流域原始农耕', cn: '生活在长江流域、住干栏式建筑、人工栽培水稻的原始农耕居民是________', syllables: '河 · 姆 · 渡 · 人', wrongNote: '易与黄河流域种粟、住半地穴式的半坡人混淆', tip: '南稻北粟：浙江河姆渡（长江·水稻·干栏式），陕西半坡（黄河·粟·半地穴）！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '分封制', phonetic: '西周政治制度', cn: '西周为稳定周初政治形势、巩固疆土，根据血缘关系远近和功劳大小实行的制度是______', syllables: '分 · 封 · 制', wrongNote: '易与秦朝的郡县制混淆', tip: '西周授民授疆土叫“分封制”（诸侯世袭），秦朝中央垂直管理地方叫“郡县制”！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '商鞅变法', phonetic: '战国社会变革', cn: '公元前356年秦孝公任用商鞅推行改革，废井田、奖励耕战、推行县制，史称________', syllables: '商 · 鞅 · 变 · 法', wrongNote: '注意“鞅”是革字旁加央', tip: '商鞅变法使秦国国力大增，为以后秦统一全国奠定了坚实基础！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '郡县制', phonetic: '秦朝地方行政制度', cn: '秦始皇统一全国后，在地方上废除分封制，全面推行由中央直接任免长官的______', syllables: '郡 · 县 · 制', wrongNote: '开创了我国历代王朝地方行政的基本模式', tip: '郡县长官一概由皇帝任免调动，不得世袭，加强了中央集权！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '推恩令', phonetic: '汉武帝大一统措施', cn: '汉武帝采纳主父偃的建议，下诏允许诸侯王将封地分封给子弟以削弱诸侯王势力，这一措施叫______', syllables: '推 · 恩 · 令', wrongNote: '政治大一统必考术语', tip: '主父偃献策“推恩令”：不费一兵一卒把大国拆成小侯国！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '丝绸之路', phonetic: '汉代中外交流通道', cn: '张骞通西域后开辟的从长安出发、经河西走廊和西域通往中亚、西亚及欧洲的陆上通道叫________', syllables: '丝 · 绸 · 之 · 路', wrongNote: '起点是西汉都城长安（今西安）', tip: '长安 ➔ 河西走廊 ➔ 西域 ➔ 中亚、西亚 ➔ 欧洲（大秦），东西方经济文化大动脉！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '地理': [
    { word: '自西向东', phonetic: '地球自转与公转方向', cn: '地球自转和公转的方向都是________（北极上空看逆时针，南极上空看顺时针）', syllables: '自 · 西 · 向 · 东', wrongNote: '北逆南顺必考基础', tip: '地球自转公转方向永远是“自西向东”，记住“北逆南顺”！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '鞍部', phonetic: '等高线地形部位', cn: '等高线地形图上，两个山峰之间相对低平的部位叫做____', syllables: '鞍 · 部', wrongNote: '五大地形部位识别必考', tip: '两山峰之间形似马鞍的平缓处 = 鞍部；等高线重叠处 = 陡崖！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '山脊', phonetic: '等高线弯曲判读', cn: '等高线弯曲部分向海拔低处凸出的部位叫做____（分水岭）', syllables: '山 · 脊', wrongNote: '易与向高处凸出的山谷混淆', tip: '★黄金口诀：凸低为脊（分水岭），凸高为谷（易发育河流）！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '苏伊士运河', phonetic: '亚非大洲分界线', cn: '亚洲与非洲的分界线是________，它沟通了地中海与红海', syllables: '苏·伊·士·运·河', wrongNote: '易与南北美洲分界线巴拿马运河混淆', tip: '亚非分界 = 苏伊士运河；南北美分界 = 巴拿马运河！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '秦岭—淮河', phonetic: '中国地理最重要分界线', cn: '我国1月0℃等温线、800毫米年等降水量线、北方地区与南方地区的分界线是________一线', syllables: '秦·岭·—·淮·河', wrongNote: '注意“秦岭”与“淮河”字形', tip: '秦岭—淮河一线：1月0℃、800mm降水、湿润与半湿润、亚热带与暖温带分界！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['秦岭-淮河', '秦岭淮河'] },
    { word: '季风气候显著', phonetic: '中国气候核心特征', cn: '我国位于亚欧大陆东部、太平洋西岸，海陆热力性质差异大，气候具有气候复杂多样和____________两大特征', syllables: '季·风·气·候·显·著', wrongNote: '雨热同期有利于农作物生长', tip: '我国气候两大特征：气候复杂多样 + 季风气候显著（雨热同期）！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '物理': [
    { word: '控制变量法', phonetic: '物理实验第一思想方法', cn: '研究滑动摩擦力大小与压力、接触面粗糙程度的关系时，每次只改变一个因素，这种方法叫__________', syllables: '控·制·变·量·法', wrongNote: '物理探究题第一高频采分术语', tip: '多因素影响同一物理量时，保持其他因素不变只改一个 = 控制变量法！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '光沿直线传播', phonetic: '光现象核心规律', cn: '小孔成像、影子的形成、日食和月食现象，都是由____________形成的', syllables: '光·沿·直·线·传·播', wrongNote: '易与光的反射（倒影）或光的折射（海市蜃楼）混淆', tip: '影子、日食月食、小孔成像（成倒立实像）= 光在同种均匀介质中沿直线传播！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['光的直线传播'] },
    { word: '虚像', phonetic: '平面镜成像特点', cn: '平面镜所成的像是正立、等大的____（不能呈现在光屏上）', syllables: '虚 · 像', wrongNote: '实验题必考：移去蜡烛B放光屏，光屏上不能承接到像', tip: '平面镜成像八字诀：等大、等距、垂直、虚像！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '质量', phonetic: '力学基本物理量', cn: '物体所含物质的多少叫做____，它是物体本身的一种属性，不随位置、形状、物态而改变', syllables: '质 · 量', wrongNote: '宇航员到太空质量不变，重力变小', tip: '质量（m，单位kg）是属性恒定不变；重力 G = mg 随位置改变！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '惯性', phonetic: '牛顿第一定律核心概念', cn: '一切物体都有保持原来运动状态不变的性质，这种性质叫做____，其大小只与质量有关', syllables: '惯 · 性', wrongNote: '严禁说“受到惯性作用”或“惯性力”', tip: '惯性是固有属性不是力（只能说“具有惯性”），大小只由质量决定，与速度无关！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '焦耳定律', phonetic: '电热核心定律', cn: '电流通过导体产生的热量跟电流的二次方成正比，跟导体的电阻成正比，跟通电时间成正比（Q=I²Rt），这叫________', syllables: '焦 · 耳 · 定 · 律', wrongNote: '电学计算压轴必考定律', tip: '焦耳定律公式 Q = I²Rt，普遍适用于所有电热计算！', voice: 'zh-CN-XiaoyiNeural' }
  ],
  '化学': [
    { word: '化学变化', phonetic: '物质变化本质区分', cn: '有新物质生成的变化叫做________（如铁生锈、粮食酿酒、蜡烛燃烧）', syllables: '化 · 学 · 变 · 化', wrongNote: '判断依据是“是否有新物质生成”而非发光放热现象', tip: '无新物质生成（三态变化、灯泡发光）= 物理变化；有新物质生成 = 化学变化！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '质量守恒定律', phonetic: '化学反应基本定律', cn: '参加化学反应的各物质的质量总和，等于反应后生成的各物质的质量总和，这叫____________', syllables: '质·量·守·恒·定·律', wrongNote: '只适用于化学变化，且必须是“参加反应”的物质质量', tip: '微观本质：化学反应前后原子的种类、数目、质量均不变！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '催化作用', phonetic: '催化剂核心概念', cn: '在化学反应里能改变其他物质的化学反应速率，而本身的质量和化学性质在反应前后都没有发生变化的物质叫催化剂，所起的作用叫________', syllables: '催 · 化 · 作 · 用', wrongNote: '“改变”包括加快或减慢；反应前后“化学性质”不变而非物理性质', tip: '催化剂一变二不变：改变反应速率，本身质量和化学性质不变（不能增加生成物产量）！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '复分解反应', phonetic: '四大基本反应类型', cn: '由两种化合物互相交换成分，生成另外两种化合物的反应（发生条件：有沉淀、气体或水生成）叫做__________', syllables: '复·分·解·反·应', wrongNote: '酸碱中和反应属于复分解反应，反应前后化合价一定不变', tip: '双交换、价不变，生成物中必有沉淀（↓）、气体（↑）或水（H₂O）！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '过滤', phonetic: '混合物分离基本操作', cn: '将不溶于液体的固体与液体分离的操作叫做____（操作要领：一贴、二低、三靠）', syllables: '过 · 滤', wrongNote: '玻璃棒在过滤中的作用是“引流”', tip: '过滤操作六字诀：一贴、二低（滤纸边缘低于漏斗口、液面低于滤纸边缘）、三靠！', voice: 'zh-CN-XiaoyiNeural' },
    { word: '熟石灰', phonetic: '常见碱俗称与用途', cn: '氢氧化钙 Ca(OH)₂ 的俗称是______（或消石灰），常用于改良酸性土壤和配制波尔多液', syllables: '熟 · 石 · 灰', wrongNote: '易与生石灰（氧化钙 CaO）和烧碱（氢氧化钠 NaOH）混淆', tip: '生石灰是 CaO，加水放热变熟石灰 Ca(OH)₂（改良酸性土壤），烧碱火碱苛性钠是 NaOH！', voice: 'zh-CN-XiaoyiNeural', acceptAlt: ['消石灰'] }
  ]
};

function extractCleanDictationFromPillars(pillars, subjName, curSem, forbidWordsSet) {
  const out = [];
  const seen = new Set();
  const tryPushTerm = (rawCandidate, it) => {
    if (!rawCandidate) return;
    const parts = String(rawCandidate)
      .replace(/\$[^$]*\$/g, ' ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}]/g, ' ')
      .split(/[、，。；：？！\/|➔→—\-\s（）()《》“”"\[\]<>+=*^_~`]+/);
    for (let p of parts) {
      p = p.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d\.]+/, '').trim();
      if (p.length < 2 || p.length > 16) continue;
      if (/[$\\{}()（）《》“”\[\]<>+=*^_~`🔒0-9]/.test(p)) continue;
      if (/^(第[一二三四五六七八九十百]+[节课章单元模块步条]|模块[一二三四五六]|模板|误区|陷阱|口诀|注意|公式|定义|性质|判别|步骤|原理|实验|方法|完全|一切|所有|必须|严禁|核心|必背|先修|王牌|黄金|铁律)$/.test(p)) continue;
      if (seen.has(p) || (forbidWordsSet && forbidWordsSet.has(p))) continue;
      seen.add(p);
      const cleanCtx = String((it && it.text) || '')
        .replace(/\{\{([\s\S]*?)\}\}/g, '$1')
        .replace(/\*\*/g, '')
        .replace(/\$[^$]*\$/g, '')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .replace(/\\n|\n+/g, ' ')
        .split(p).join('________')
        .slice(0, 88);
      out.push({
        word: p,
        term: p,
        semester: curSem,
        phonetic: `${curSem}·${(it && it.tag) || subjName}核心术语`,
        cn: `【${curSem}·${(it && it.tag) || subjName}】${cleanCtx}`,
        syllables: p.split('').join(' · '),
        wrongNote: `${curSem}《${subjName}》必背红字核心采分点，注意字形与规范表述`,
        tip: `${(it && it.title) || curSem} —— 核心必背词：${p}`,
        voice: subjName === '英语' && /^[a-zA-Z\s-]+$/.test(p) ? 'en-US-JennyNeural' : 'zh-CN-XiaoyiNeural'
      });
      if (out.length >= 20) return;
    }
  };

  for (const pillar of (pillars || [])) {
    for (const g of (pillar.groups || [])) {
      for (const it of (g.items || [])) {
        const rawText = String(it.text || '');
        let m;
        const reRed = /\{\{([\s\S]*?)\}\}/g;
        while ((m = reRed.exec(rawText)) !== null) {
          tryPushTerm(m[1].replace(/\*\*/g, ''), it);
          if (out.length >= 20) return out;
        }
        const reBold = /\*\*([\s\S]*?)\*\*/g;
        while ((m = reBold.exec(rawText)) !== null) {
          tryPushTerm(m[1].replace(/\{\{|\}\}/g, ''), it);
          if (out.length >= 20) return out;
        }
        tryPushTerm(it.tag, it);
        tryPushTerm(it.title, it);
        if (out.length >= 20) return out;
      }
    }
  }
  return out;
}

function getDictationItemsForSubject(subjName, semCode) {
  const curSem = semCode || (STATE.quiz && STATE.quiz.semester) || (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus) || '初一上';
  const baseCurated = (Array.isArray(DICTATION_BANKS[subjName]) ? DICTATION_BANKS[subjName] : []).map(it =>
    Object.assign({}, it, { term: it.word, semester: '初一上' })
  );

  // window.MASTER_COMPENDIUM_DATA 是数组（Array），按 subject 查找对应学科及学期 pillars
  const subjComp = (typeof window !== 'undefined' && Array.isArray(window.MASTER_COMPENDIUM_DATA))
    ? window.MASTER_COMPENDIUM_DATA.find(s => s.subject === subjName)
    : null;

  const semMapObj = subjComp ? (subjComp.semesters || subjComp.semesterMap || null) : null;
  const targetPillars = subjComp
    ? (curSem === '初一上'
        ? (subjComp.pillars || [])
        : (semMapObj && semMapObj[curSem] ? (semMapObj[curSem].pillars || []) : []))
    : [];

  if (curSem === '初一上') {
    const curatedSet = new Set(baseCurated.map(x => x.word));
    const semDynamic = extractCleanDictationFromPillars(targetPillars, subjName, '初一上', curatedSet);
    const mergedY1a = [...baseCurated, ...semDynamic].slice(0, 20);
    return mergedY1a.length > 0 ? mergedY1a : baseCurated;
  }

  // 非初一上学期：严格提取本学期（curSem）专属词条，并排除与初一上雷同的词条
  const y1aDynamic = subjComp ? extractCleanDictationFromPillars(subjComp.pillars || [], subjName, '初一上', null) : [];
  const y1aForbidSet = new Set([
    ...baseCurated.map(x => x.word),
    ...y1aDynamic.slice(0, 20).map(x => x.word)
  ]);

  const semItems = extractCleanDictationFromPillars(targetPillars, subjName, curSem, y1aForbidSet);

  // 若还需要从 STATE.data.knowledgePoints 补充本学期干净术语（保底 >= 15 条）
  if (semItems.length < 16 && STATE.data && Array.isArray(STATE.data.knowledgePoints)) {
    const seen = new Set([...y1aForbidSet, ...semItems.map(x => x.word)]);
    const semKps = STATE.data.knowledgePoints.filter(k => k.subject === subjName && k.semester === curSem);
    for (const kp of semKps) {
      const rawTitle = String(kp.corePoint || '').replace(/^(?:第[一二三四五六七八九十\d]+[节课章单元]|\d+\*?)\s*/, '').replace(/[（(][^）)]*[）)]/g, '').trim();
      const parts = `${rawTitle} ${kp.mnemonic || ''}`
        .replace(/\$[^$]*\$/g, ' ')
        .replace(/\\[a-zA-Z]+/g, ' ')
        .replace(/[{}]/g, ' ')
        .split(/[、，。；：？！\/|➔→—\-\s（）()《》“”"\[\]<>+=*^_~`]+/);
      for (let p of parts) {
        p = p.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d\.]+/, '').trim();
        if (p.length >= 2 && p.length <= 16 && !/[$\\{}()（）《》“”\[\]<>+=*^_~`🔒0-9]/.test(p) && !seen.has(p)) {
          seen.add(p);
          semItems.push({
            word: p,
            term: p,
            semester: curSem,
            phonetic: `${curSem}·${kp.chapter || subjName}`,
            cn: `【${curSem}·《${rawTitle}》】核心术语默写`,
            syllables: p.split('').join(' · '),
            wrongNote: `${curSem}《${rawTitle}》核心采分术语`,
            tip: `结合《${rawTitle}》记忆核心词：${p}`,
            voice: subjName === '英语' && /^[a-zA-Z\s-]+$/.test(p) ? 'en-US-JennyNeural' : 'zh-CN-XiaoyiNeural'
          });
          if (semItems.length >= 20) break;
        }
      }
      if (semItems.length >= 20) break;
    }
  }

  return semItems.slice(0, 20);
}

// ============================================================================
// 升级 3：学科专项学练闭环生成引擎（Step 1 看大招 ➔ Step 2 刷6~8题/听写 ➔ Step 3 授勋）
// ============================================================================
function getSpecialCampsForSubject(subjName, semCode, subjSemKps) {
  const kps = Array.isArray(subjSemKps) && subjSemKps.length > 0
    ? subjSemKps
    : (STATE.data ? STATE.data.knowledgePoints.filter(k => k.subject === subjName && k.semester === semCode) : []);
  const weakKps = kps.filter(k => k.status.includes('未掌握') || k.status.includes('复习中'));
  const taughtKps = kps.filter(k => {
    const p = getSchoolTeachingProgress(k, kps);
    return p.code === 'TAUGHT' || p.code === 'CURRENT';
  });
  const l3Kps = kps.filter(k => getDepthTier(k.difficulty) === 3);

  const camps = [
    {
      id: `CAMP_DICT_${subjName}`,
      type: 'DICTATION',
      badge: subjName === '英语' ? '🎧 10.21 错词靶向听写' : '🎧 核心术语/公式听写默写',
      badgeColor: '#db2777',
      badgeBg: '#fdf2f8',
      title: subjName === '英语'
        ? '🎧 英语高频易错词·自然拼读拆音节听写营'
        : `🎧 ${subjName}必考核心术语与秒杀口诀默写营`,
      subtitle: subjName === '英语'
        ? '专治 10.21 听写单(4分/54分)暴露的 schoolbag/pencil/white/blue/where/grade/favorite 字母颠倒'
        : `针对 ${subjName} 主观填空与关键采分点，先听语音提示再动手默写关键词`,
      step1Title: subjName === '英语' ? '自然拼读“拆音节防颠倒”三大黄金法则' : `${subjName}核心术语精准默写口诀`,
      step1Rules: subjName === '英语'
        ? [
            '①【复合词拆半记】：schoolbag = school(学校) + bag(包)；pencil = pen(钢笔) + cil；welcome = wel(l) + come！',
            '②【wh/bl 辅音连缀绝不颠倒】：wh-ite（风筝kite换wh）、wh-ere（wh+ere）、bl-ue（bl后接ue，绝不写成bule）！',
            '③【长词拍手分音节】：fa-vor-ite（三音节拍手）、col-our（英式带u）、gr-ade（a_e开音节结尾是d）！'
          ]
        : getDictationItemsForSubject(subjName).slice(0, 4).map((d, i) => `${i + 1}. 【${d.word}】：${d.tip}`),
      pool: weakKps.length > 0 ? weakKps : kps.slice(0, 6),
      dictationCount: getDictationItemsForSubject(subjName).length,
      medalName: `${subjName}听写满贯星耀勋章`
    },
    {
      id: `CAMP_WEAK_${subjName}`,
      type: 'QUEST',
      badge: '🔥 期中前错题除根专项',
      badgeColor: '#e11d48',
      badgeBg: '#ffe4e6',
      title: `🎯 ${subjName}（${semCode}）实测薄弱点靶向特训营`,
      subtitle: weakKps.length > 0
        ? `聚焦当前 ${weakKps.length} 节待突破/复习中课节，每次随机抽 6～8 道新题靶向除根`
        : `聚焦本学期高频易错陷阱题，每次随机抽 6～8 题强化防坑护盾`,
      step1Title: `${subjName}期中防坑三大秒杀大招`,
      step1Rules: (weakKps.length > 0 ? weakKps : kps).slice(0, 4).map((k, idx) =>
        `大招 ${idx + 1}【${k.corePoint}】：${k.mnemonic || k.understanding || '紧扣定义边界，分步验算'}${k.errorReason ? '（⚠️防坑：' + k.errorReason + '）' : ''}`
      ),
      pool: weakKps.length > 0 ? weakKps : kps.slice(0, 6),
      medalName: `${subjName}破障除根黄金勋章`
    },
    {
      id: `CAMP_SYNC_${subjName}`,
      type: 'QUEST',
      badge: `🏫 第1~${STATE.schoolCurrentWeek || 8}周学校同步专项`,
      badgeColor: '#15803d',
      badgeBg: '#dcfce7',
      title: `🏫 ${subjName}·学校已学进度期中通关营`,
      subtitle: `严格对齐地区统一校历（第 1～${STATE.schoolCurrentWeek || 8} 教学周已授完 ${taughtKps.length} 课），不超纲、稳拿基础与中档分`,
      step1Title: '期中已学章节核心母题通关口诀',
      step1Rules: (taughtKps.length > 0 ? taughtKps : kps).slice(0, 4).map((k, idx) =>
        `要点 ${idx + 1}【${k.corePoint}】：${k.mnemonic || k.understanding || '掌握核心公式与标准步骤'}`
      ),
      pool: taughtKps.length > 0 ? taughtKps : kps,
      medalName: `${subjName}期中同步先锋勋章`
    },
    {
      id: `CAMP_BOSS_${subjName}`,
      type: 'QUEST',
      badge: '👑 三星压轴满分专项',
      badgeColor: '#6d28d9',
      badgeBg: '#f3e8ff',
      title: `⚡ ${subjName}·三星压轴模型与中考思维营`,
      subtitle: `精选本册 ${l3Kps.length || 4} 个压轴大题模型（如奇点偶段法、对照实验探究、材料多维评析），冲击 110+ 满分段`,
      step1Title: `${subjName}压轴大题满分拆解模型`,
      step1Rules: (l3Kps.length > 0 ? l3Kps : kps.slice(-3)).slice(0, 3).map((k, idx) =>
        `压轴模型 ${idx + 1}【${k.corePoint}】：${k.mnemonic || k.understanding || '分步建模，严密分类讨论'}`
      ),
      pool: l3Kps.length > 0 ? l3Kps : kps.slice(-4),
      medalName: `${subjName}压轴破阵王者勋章`
    }
  ];

  return camps;
}

// 为任意知识点生成「四选一选择题」与「对错判断题」（优先使用每课内置的多题题库 kp.quizItems）
function buildRapidQuizItem(kp, qIdx = 0, formatMode = 'MIXED') {
  const seed = hashStringDeterministic(kp.id + '_' + qIdx + '_' + (kp._subQIndex || 0));
  const bank = (Array.isArray(kp.quizItems) && kp.quizItems.length > 0)
    ? kp.quizItems
    : (kp.sections && Array.isArray(kp.sections.quizItems) ? kp.sections.quizItems : []);

  // 0. 优先使用本课专属的多题闯关题库 (kp.quizItems)
  if (bank.length > 0) {
    let chosen = kp._subQuizItem || bank[qIdx % bank.length];
    if (formatMode === 'CHOICE') {
      const choiceList = bank.filter(x => x.type === 'CHOICE');
      if (choiceList.length > 0) {
        chosen = (kp._subQuizItem && kp._subQuizItem.type === 'CHOICE')
          ? kp._subQuizItem
          : choiceList[qIdx % choiceList.length];
      }
    } else if (formatMode === 'TF') {
      const tfList = bank.filter(x => x.type === 'TF');
      if (tfList.length > 0) {
        chosen = (kp._subQuizItem && kp._subQuizItem.type === 'TF')
          ? kp._subQuizItem
          : tfList[qIdx % tfList.length];
      }
    }

    if (chosen) {
      if (chosen.type === 'TF') {
        return {
          type: 'TF',
          prompt: chosen.prompt,
          tfCorrect: Boolean(chosen.tfCorrect),
          explanation: chosen.explanation || kp.mnemonic || kp.understanding || ''
        };
      }
      if (Array.isArray(chosen.options) && chosen.options.length >= 2) {
        const directIdx = Math.max(0, Math.min(chosen.options.length - 1, Number(chosen.correctIdx) || 0));
        return {
          type: 'CHOICE',
          prompt: chosen.prompt,
          options: chosen.options.slice(),
          correctIdx: directIdx,
          explanation: chosen.explanation || kp.mnemonic || kp.understanding || ''
        };
      }
    }
  }

  if (kp.isUnverified || (kp.status || '').includes('🔒待精校') || String(kp.questionMain || '').includes('🔒待精校')) {
    return null;
  }

  // 决定本题题型：'CHOICE'(四选一) 或 'TF'(判断题)
  let actualType = 'CHOICE';
  if (formatMode === 'CHOICE') actualType = 'CHOICE';
  else if (formatMode === 'TF') actualType = 'TF';
  else {
    actualType = (qIdx % 2 === 0) ? 'CHOICE' : 'TF';
  }

  // 1. 先检查是否命中高精准手写题库
  const curated = CURATED_RAPID_BANK.find(item => kp.corePoint.includes(item.match) || kp.id.includes(item.match));

  if (curated) {
    if (actualType === 'TF') {
      return {
        type: 'TF',
        prompt: curated.tfQ,
        tfCorrect: curated.tfAnswer,
        explanation: curated.explanation
      };
    }
    return {
      type: 'CHOICE',
      prompt: curated.choiceQ,
      options: curated.options.slice(),
      correctIdx: Number(curated.correctIdx) || 0,
      explanation: curated.explanation
    };
  }

  return null;
}

let _audioCtx = null;
let _lastSoundTimestamp = 0;
let _bgmIntervalHandle = null;
let _bgmStepIndex = 0;
let _bgmMasterGain = null;
STATE.comboStreak = 0;
STATE.lastClickCoords = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

function ensureAudioContext() {
  const AudioContextCls = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCls) return null;
  if (!_audioCtx) _audioCtx = new AudioContextCls();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

// ============================================================================
// 🎵 原创糖果王国四部曲交响八音盒合成器 (100% Web Audio 多声部实时合成 · 零版权风险)
// 包含 4 首不同调式、节拍与配器的完整曲目，支持自动轮播与一键切歌：
//   1. 🍬《苏打糖果镇大游行》(F大调 · 64步欢快八音盒进行曲 + 拨弦低音 + 木琴和弦 + 轻巧木鱼节拍)
//   2. 🎡《彩虹摩天轮圆舞曲》(C大调 · 48步 3/4拍梦幻游乐园旋转木马华尔兹 + 竖琴分解琶音 + 长笛副旋)
//   3. 🍧《蜜桃汽水跳跳糖》(G大调 · 64步俏皮切分轻爵士 + 行走低音 Walking Bass + 糖晶钟琴)
//   4. 🌟《星光棉花糖云端》(Bb大调 · 64步治愈竖琴与星光水晶琴轻音乐)
// ============================================================================
const N = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, A5: 880.00, Bb5: 932.33, B5: 987.77,
  C6: 1046.50, D6: 1174.66, Eb6: 1244.51, E6: 1318.51, F6: 1396.91, G6: 1567.98
};

const CANDY_BGM_TRACKS = [
  {
    name: '🍬 苏打糖果镇大游行',
    stepMs: 205,
    leadStyle: 'celesta',
    steps: [
      // A段：主歌（16步）
      { m: N.F5, b: N.F3, c: N.A4, h: N.C6, p: 'wood' },
      { m: N.A5, b: null, c: N.C5, h: null, p: 'shaker' },
      { m: N.C6, b: N.C4, c: N.F5, h: null, p: null },
      { m: N.A5, b: null, c: N.C5, h: N.F6, p: 'shaker' },
      { m: N.G5, b: N.G3, c: N.Bb4, h: null, p: 'wood' },
      { m: N.Bb5,b: null, c: N.D5, h: null, p: 'shaker' },
      { m: N.A5, b: N.C4, c: N.E5, h: N.C6, p: null },
      { m: N.F5, b: null, c: N.C5, h: null, p: 'shaker' },
      { m: N.D5, b: N.Bb3,c: N.F4, h: N.Bb5,p: 'wood' },
      { m: N.F5, b: null, c: N.Bb4,h: null, p: 'shaker' },
      { m: N.Bb5,b: N.F3, c: N.D5, h: null, p: null },
      { m: N.A5, b: null, c: N.C5, h: N.F6, p: 'shaker' },
      { m: N.G5, b: N.G3, c: N.B4, h: null, p: 'wood' },
      { m: N.E5, b: N.C4, c: N.Bb4,h: null, p: 'shaker' },
      { m: N.G5, b: N.C4, c: N.E5, h: N.C6, p: null },
      { m: null, b: N.G3, c: N.C5, h: N.E6, p: 'bell' },
      // B段：明亮副歌（16步）
      { m: N.C6, b: N.F3, c: N.A4, h: N.F6, p: 'wood' },
      { m: N.Bb5,b: null, c: N.C5, h: null, p: 'shaker' },
      { m: N.A5, b: N.A3, c: N.F5, h: null, p: null },
      { m: N.C6, b: null, c: N.E5, h: N.E6, p: 'shaker' },
      { m: N.D6, b: N.Bb3,c: N.F5, h: null, p: 'wood' },
      { m: N.C6, b: null, c: N.D5, h: null, p: 'shaker' },
      { m: N.Bb5,b: N.G3, c: N.D5, h: N.D6, p: null },
      { m: N.G5, b: null, c: N.Bb4,h: null, p: 'shaker' },
      { m: N.A5, b: N.C4, c: N.F5, h: N.C6, p: 'wood' },
      { m: N.C6, b: null, c: N.A4, h: null, p: 'shaker' },
      { m: N.G5, b: N.C4, c: N.E5, h: null, p: null },
      { m: N.E5, b: null, c: N.C5, h: N.Bb5,p: 'shaker' },
      { m: N.F5, b: N.F3, c: N.A4, h: N.A5, p: 'wood' },
      { m: N.A5, b: N.C4, c: N.C5, h: null, p: 'shaker' },
      { m: N.F5, b: N.F3, c: N.A4, h: N.F6, p: 'bell' },
      { m: null, b: N.C3, c: N.F4, h: null, p: null },
      // C段：俏皮果冻桥段（16步）
      { m: N.E5, b: N.C4, c: N.G4, h: N.C6, p: 'wood' },
      { m: N.G5, b: null, c: N.Bb4,h: null, p: 'shaker' },
      { m: N.C6, b: N.G3, c: N.E5, h: null, p: null },
      { m: N.Bb5,b: null, c: N.C5, h: N.E6, p: 'shaker' },
      { m: N.A5, b: N.F3, c: N.C5, h: null, p: 'wood' },
      { m: N.F5, b: null, c: N.A4, h: null, p: 'shaker' },
      { m: N.C6, b: N.C4, c: N.F5, h: N.F6, p: null },
      { m: N.A5, b: null, c: N.C5, h: null, p: 'shaker' },
      { m: N.B5, b: N.G3, c: N.D5, h: N.G6, p: 'wood' },
      { m: N.D6, b: null, c: N.F5, h: null, p: 'shaker' },
      { m: N.G5, b: N.D3, c: N.B4, h: null, p: null },
      { m: N.A5, b: null, c: N.D5, h: N.D6, p: 'shaker' },
      { m: N.C6, b: N.C4, c: N.E5, h: N.E6, p: 'wood' },
      { m: N.Bb5,b: N.G3, c: N.E5, h: null, p: 'shaker' },
      { m: N.A5, b: N.C4, c: N.F5, h: null, p: null },
      { m: N.G5, b: N.E3, c: N.C5, h: N.C6, p: 'bell' },
      // D段：辉煌庆典尾奏（16步）
      { m: N.F5, b: N.F3, c: N.A4, h: N.C6, p: 'wood' },
      { m: N.A5, b: null, c: N.C5, h: null, p: 'shaker' },
      { m: N.C6, b: N.A3, c: N.F5, h: N.F6, p: null },
      { m: N.D6, b: null, c: N.F5, h: null, p: 'shaker' },
      { m: N.C6, b: N.Bb3,c: N.F5, h: N.D6, p: 'wood' },
      { m: N.Bb5,b: null, c: N.D5, h: null, p: 'shaker' },
      { m: N.A5, b: N.F3, c: N.C5, h: N.C6, p: null },
      { m: N.F5, b: null, c: N.A4, h: null, p: 'shaker' },
      { m: N.G5, b: N.G3, c: N.Bb4,h: N.Bb5,p: 'wood' },
      { m: N.A5, b: null, c: N.D5, h: null, p: 'shaker' },
      { m: N.Bb5,b: N.C4, c: N.E5, h: N.C6, p: null },
      { m: N.C6, b: null, c: N.G5, h: null, p: 'shaker' },
      { m: N.F5, b: N.F3, c: N.A4, h: N.F6, p: 'wood' },
      { m: N.C6, b: N.C4, c: N.A4, h: null, p: null },
      { m: N.F6, b: N.F3, c: N.C5, h: N.A5, p: 'bell' },
      { m: null, b: null, c: N.F4, h: null, p: null }
    ]
  },
  {
    name: '🎡 彩虹摩天轮圆舞曲',
    stepMs: 225,
    leadStyle: 'waltz',
    steps: [
      // 3/4 拍旋转木马八音盒华尔兹 (48步 = 16小节三拍子)
      { m: N.G5, b: N.C3, c: null, h: N.E6, p: 'wood' },
      { m: null, b: null, c: N.E4, h: N.G4, p: 'shaker' },
      { m: N.E5, b: null, c: N.G4, h: N.C5, p: 'shaker' },
      { m: N.A5, b: N.F3, c: null, h: N.C6, p: 'wood' },
      { m: null, b: null, c: N.F4, h: N.A4, p: 'shaker' },
      { m: N.F5, b: null, c: N.A4, h: N.C5, p: 'shaker' },
      { m: N.G5, b: N.C3, c: null, h: N.E6, p: 'wood' },
      { m: N.E5, b: null, c: N.E4, h: N.G4, p: 'shaker' },
      { m: N.C5, b: null, c: N.G4, h: N.C5, p: 'shaker' },
      { m: N.D5, b: N.G3, c: null, h: N.B5, p: 'wood' },
      { m: N.B4, b: null, c: N.D4, h: N.G4, p: 'shaker' },
      { m: N.G4, b: null, c: N.G4, h: N.B4, p: 'bell' },

      { m: N.E5, b: N.C3, c: null, h: N.C6, p: 'wood' },
      { m: N.G5, b: null, c: N.E4, h: N.G4, p: 'shaker' },
      { m: N.C6, b: null, c: N.G4, h: N.E5, p: 'shaker' },
      { m: N.B5, b: N.E3, c: null, h: N.E6, p: 'wood' },
      { m: N.G5, b: null, c: N.E4, h: N.B4, p: 'shaker' },
      { m: N.E5, b: null, c: N.G4, h: N.E5, p: 'shaker' },
      { m: N.A5, b: N.D3, c: null, h: N.D6, p: 'wood' },
      { m: N.Fs5,b: null, c: N.D4, h: N.A4, p: 'shaker' },
      { m: N.D5, b: null, c: N.A4, h: N.C5, p: 'shaker' },
      { m: N.G5, b: N.G3, c: null, h: N.B5, p: 'wood' },
      { m: null, b: null, c: N.D4, h: N.G4, p: 'shaker' },
      { m: N.F5, b: null, c: N.G4, h: N.B4, p: 'bell' },

      { m: N.E5, b: N.A3, c: null, h: N.C6, p: 'wood' },
      { m: N.A5, b: null, c: N.E4, h: N.A4, p: 'shaker' },
      { m: N.C6, b: null, c: N.A4, h: N.E5, p: 'shaker' },
      { m: N.B5, b: N.E3, c: null, h: N.G5, p: 'wood' },
      { m: N.G5, b: null, c: N.E4, h: N.B4, p: 'shaker' },
      { m: N.E5, b: null, c: N.G4, h: N.E5, p: 'shaker' },
      { m: N.F5, b: N.F3, c: null, h: N.A5, p: 'wood' },
      { m: N.A5, b: null, c: N.F4, h: N.C5, p: 'shaker' },
      { m: N.D6, b: null, c: N.A4, h: N.F5, p: 'shaker' },
      { m: N.C6, b: N.G3, c: null, h: N.E6, p: 'wood' },
      { m: N.B5, b: null, c: N.D4, h: N.G4, p: 'shaker' },
      { m: N.G5, b: null, c: N.G4, h: N.D5, p: 'shaker' },

      { m: N.C6, b: N.C3, c: null, h: N.E6, p: 'wood' },
      { m: N.G5, b: null, c: N.E4, h: N.G4, p: 'shaker' },
      { m: N.E5, b: null, c: N.G4, h: N.C5, p: 'shaker' },
      { m: N.F5, b: N.F3, c: null, h: N.D6, p: 'wood' },
      { m: N.D5, b: null, c: N.F4, h: N.A4, p: 'shaker' },
      { m: N.B4, b: N.G3, c: N.G4, h: N.D5, p: 'shaker' },
      { m: N.C5, b: N.C3, c: null, h: N.C6, p: 'wood' },
      { m: N.E5, b: null, c: N.E4, h: N.G4, p: 'shaker' },
      { m: N.G5, b: null, c: N.G4, h: N.C5, p: 'shaker' },
      { m: N.C6, b: N.C3, c: N.E4, h: N.E6, p: 'bell' },
      { m: null, b: null, c: N.G4, h: null, p: null },
      { m: null, b: null, c: N.C5, h: null, p: null }
    ]
  },
  {
    name: '🍧 蜜桃汽水跳跳糖',
    stepMs: 195,
    leadStyle: 'marimba',
    steps: [
      // G大调轻快弹跳节奏（48步）
      { m: N.D5, b: N.G3, c: N.B4, h: N.G5, p: 'wood' },
      { m: N.E5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.G5, b: N.B3, c: N.D5, h: N.B5, p: null },
      { m: N.A5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.B5, b: N.D4, c: N.G5, h: N.D6, p: 'wood' },
      { m: N.A5, b: null, c: N.Fs5,h: null, p: 'shaker' },
      { m: N.G5, b: N.B3, c: N.D5, h: null, p: null },
      { m: N.E5, b: null, c: null, h: N.B5, p: 'shaker' },
      { m: N.C5, b: N.C3, c: N.E4, h: N.G5, p: 'wood' },
      { m: N.E5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.G5, b: N.E3, c: N.C5, h: N.C6, p: null },
      { m: N.E5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.Fs5,b: N.D3, c: N.A4, h: N.D6, p: 'wood' },
      { m: N.A5, b: null, c: N.C5, h: null, p: 'shaker' },
      { m: N.D5, b: N.A3, c: N.Fs5,h: N.A5, p: 'bell' },
      { m: null, b: N.D3, c: null, h: null, p: null },

      { m: N.B5, b: N.G3, c: N.D5, h: N.G6, p: 'wood' },
      { m: N.A5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.G5, b: N.D3, c: N.B4, h: N.D6, p: null },
      { m: N.D5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.E5, b: N.E3, c: N.G4, h: N.B5, p: 'wood' },
      { m: N.G5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.B5, b: N.B3, c: N.E5, h: N.E6, p: null },
      { m: N.G5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.A5, b: N.C3, c: N.E5, h: N.C6, p: 'wood' },
      { m: N.B5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.C6, b: N.E3, c: N.G5, h: N.E6, p: null },
      { m: N.A5, b: null, c: null, h: null, p: 'shaker' },
      { m: N.B5, b: N.D3, c: N.G5, h: N.D6, p: 'wood' },
      { m: N.A5, b: N.A3, c: N.Fs5,h: null, p: 'shaker' },
      { m: N.G5, b: N.G3, c: N.B4, h: N.G6, p: 'bell' },
      { m: null, b: N.D3, c: N.D5, h: null, p: null }
    ]
  },
  {
    name: '🌟 星光棉花糖云端',
    stepMs: 235,
    leadStyle: 'harp',
    steps: [
      // Bb大调温柔梦幻竖琴与水晶琴（32步）
      { m: N.F5, b: N.Bb3,c: N.D5, h: N.Bb5,p: 'wood' },
      { m: N.D5, b: null, c: N.F4, h: null, p: null },
      { m: N.Bb5,b: N.F3, c: N.D5, h: N.D6, p: 'shaker' },
      { m: N.A5, b: null, c: N.F4, h: null, p: null },
      { m: N.G5, b: N.G3, c: N.Bb4,h: N.Bb5,p: 'wood' },
      { m: N.D5, b: null, c: N.G4, h: null, p: null },
      { m: N.F5, b: N.D3, c: N.A4, h: N.A5, p: 'shaker' },
      { m: N.D5, b: null, c: N.F4, h: null, p: null },
      { m: N.Eb5,b: N.Eb3,c: N.G4, h: N.Bb5,p: 'wood' },
      { m: N.G5, b: null, c: N.Bb4,h: null, p: null },
      { m: N.F5, b: N.Bb3,c: N.D5, h: N.D6, p: 'shaker' },
      { m: N.D5, b: null, c: N.Bb4,h: null, p: null },
      { m: N.C5, b: N.C3, c: N.Eb4,h: N.G5, p: 'wood' },
      { m: N.Eb5,b: null, c: N.G4, h: null, p: null },
      { m: N.F5, b: N.F3, c: N.A4, h: N.C6, p: 'bell' },
      { m: null, b: N.F3, c: N.C5, h: null, p: null },

      { m: N.Bb5,b: N.Bb3,c: N.D5, h: N.F6, p: 'wood' },
      { m: N.A5, b: null, c: N.F4, h: null, p: null },
      { m: N.G5, b: N.G3, c: N.Bb4,h: N.D6, p: 'shaker' },
      { m: N.F5, b: null, c: N.D4, h: null, p: null },
      { m: N.Eb5,b: N.Eb3,c: N.G4, h: N.Bb5,p: 'wood' },
      { m: N.G5, b: null, c: N.Bb4,h: null, p: null },
      { m: N.F5, b: N.F3, c: N.A4, h: N.C6, p: 'shaker' },
      { m: N.A5, b: null, c: N.C5, h: null, p: null },
      { m: N.Bb5,b: N.G3, c: N.D5, h: N.D6, p: 'wood' },
      { m: N.C6, b: null, c: N.G4, h: null, p: null },
      { m: N.D6, b: N.Eb3,c: N.G5, h: N.F6, p: 'shaker' },
      { m: N.C6, b: null, c: N.Eb5,h: null, p: null },
      { m: N.Bb5,b: N.F3, c: N.D5, h: N.D6, p: 'wood' },
      { m: N.A5, b: N.F3, c: N.C5, h: null, p: null },
      { m: N.Bb5,b: N.Bb3,c: N.D5, h: N.Bb5,p: 'bell' },
      { m: null, b: null, c: N.F4, h: null, p: null }
    ]
  }
];

let _bgmTrackIndex = 0;

function startCandyBgm() {
  if (!STATE.bgmEnabled) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (_bgmIntervalHandle) return;

  STATE.bgmPlaying = true;
  updateBgmButtonUi();

  // 柔和歌剧院级低通滤波主总线，让合成器音色圆润温暖不刺耳
  const masterFilter = ctx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.setValueAtTime(3400, ctx.currentTime);
  masterFilter.Q.setValueAtTime(0.7, ctx.currentTime);
  masterFilter.connect(ctx.destination);

  const playBgmNote = (freq, duration, vol, wave = 'sine', detune = 0, attack = 0.014) => {
    if (!STATE.bgmEnabled || !ctx || ctx.state !== 'running' || !freq) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (detune) osc.detune.setValueAtTime(detune, t);
    gain.gain.setValueAtTime(0.0004, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0004, t + duration);
    osc.connect(gain);
    gain.connect(masterFilter);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  };

  const playCandyPerc = (kind, duckFactor) => {
    if (!STATE.bgmEnabled || !ctx || ctx.state !== 'running' || !kind) return;
    const t = ctx.currentTime;
    if (kind === 'wood') {
      // 轻巧糖果木鱼节拍 (Pitched Woodblock Tap)
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(310, t + 0.038);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.014 * duckFactor, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 0.042);
      osc.connect(g);
      g.connect(masterFilter);
      osc.start(t);
      osc.stop(t + 0.048);
    } else if (kind === 'shaker') {
      // 轻柔星尘高音微点
      playBgmNote(2637, 0.035, 0.0035 * duckFactor, 'triangle', 12, 0.004);
    } else if (kind === 'bell') {
      // 小节收尾水晶风铃泛音
      playBgmNote(1567.98, 0.28, 0.011 * duckFactor, 'sine', 0, 0.01);
      playBgmNote(2093.00, 0.34, 0.008 * duckFactor, 'sine', 5, 0.025);
    }
  };

  const runTick = () => {
    if (!STATE.bgmEnabled) {
      stopCandyBgm();
      return;
    }
    const track = CANDY_BGM_TRACKS[_bgmTrackIndex % CANDY_BGM_TRACKS.length];
    if (ctx && ctx.state === 'running') {
      const duckFactor = (STATE.ttsPlaying || (window.speechSynthesis && window.speechSynthesis.speaking)) ? 0.14 : 1.0;
      const step = track.steps[_bgmStepIndex % track.steps.length];
      _bgmStepIndex++;

      // 播完一整首后自动无缝轮播下一首曲目，彻底告别单曲循环单调感！
      if (_bgmStepIndex >= track.steps.length) {
        _bgmStepIndex = 0;
        _bgmTrackIndex = (_bgmTrackIndex + 1) % CANDY_BGM_TRACKS.length;
        updateBgmButtonUi();
      }

      if (step.m) {
        if (track.leadStyle === 'waltz') {
          playBgmNote(step.m, 0.30, 0.025 * duckFactor, 'sine', 0, 0.018);
          playBgmNote(step.m * 2, 0.18, 0.007 * duckFactor, 'sine', 6, 0.012);
          playBgmNote(step.m * 0.5, 0.24, 0.009 * duckFactor, 'triangle', -4, 0.02);
        } else if (track.leadStyle === 'marimba') {
          playBgmNote(step.m, 0.17, 0.028 * duckFactor, 'triangle', 0, 0.008);
          playBgmNote(step.m * 2, 0.09, 0.009 * duckFactor, 'sine', 3, 0.006);
        } else if (track.leadStyle === 'harp') {
          playBgmNote(step.m, 0.36, 0.024 * duckFactor, 'sine', 0, 0.016);
          playBgmNote(step.m * 1.5, 0.22, 0.006 * duckFactor, 'triangle', 4, 0.02);
        } else {
          playBgmNote(step.m, 0.23, 0.025 * duckFactor, 'sine', 0, 0.012);
          playBgmNote(step.m * 2, 0.13, 0.0075 * duckFactor, 'triangle', 5, 0.01);
        }
      }
      if (step.b) {
        // 温暖双层拨弦低音 (Warm Pizzicato + Sub Sine)
        playBgmNote(step.b, 0.19, 0.030 * duckFactor, 'triangle', 0, 0.01);
        playBgmNote(step.b * 0.5, 0.16, 0.014 * duckFactor, 'sine', 0, 0.012);
      }
      if (step.c) {
        // 竖琴/木琴中音和声内声部
        playBgmNote(step.c, 0.18, 0.015 * duckFactor, 'sine', -3, 0.015);
      }
      if (step.h) {
        // 星光高音竖琴泛音点缀
        playBgmNote(step.h, 0.22, 0.009 * duckFactor, 'sine', 4, 0.012);
      }
      if (step.p) {
        playCandyPerc(step.p, duckFactor);
      }
    }
    const nextTrack = CANDY_BGM_TRACKS[_bgmTrackIndex % CANDY_BGM_TRACKS.length];
    _bgmIntervalHandle = setTimeout(runTick, nextTrack.stepMs || 210);
  };

  _bgmIntervalHandle = setTimeout(runTick, 80);
}

function stopCandyBgm() {
  if (_bgmIntervalHandle) {
    clearTimeout(_bgmIntervalHandle);
    _bgmIntervalHandle = null;
  }
  STATE.bgmPlaying = false;
  updateBgmButtonUi();
}

function updateBgmButtonUi() {
  const btn = document.getElementById('bgmToggleBtn');
  const nextBtn = document.getElementById('bgmNextTrackBtn');
  const track = CANDY_BGM_TRACKS[_bgmTrackIndex % CANDY_BGM_TRACKS.length];
  if (btn) {
    btn.innerHTML = uiIcon(STATE.bgmEnabled ? 'music-on' : 'music-off', 18);
    btn.classList.toggle('is-bgm-active', Boolean(STATE.bgmEnabled && STATE.bgmPlaying));
    btn.classList.toggle('is-bgm-muted', !STATE.bgmEnabled);
    btn.title = STATE.bgmEnabled
      ? `正在播放：${track.name}（点击暂停背景音乐）`
      : '背景音乐已暂停（点击开启）';
  }
  if (nextBtn) {
    nextBtn.style.opacity = STATE.bgmEnabled ? '1' : '0.5';
    nextBtn.title = `当前曲目：${track.name}（点击切换下一首，共${CANDY_BGM_TRACKS.length}首轮播）`;
  }
}

function switchNextCandyBgmTrack() {
  _bgmTrackIndex = (_bgmTrackIndex + 1) % CANDY_BGM_TRACKS.length;
  _bgmStepIndex = 0;
  const track = CANDY_BGM_TRACKS[_bgmTrackIndex];
  if (!STATE.bgmEnabled) {
    STATE.bgmEnabled = true;
    startCandyBgm();
  }
  playCommercialSound('tab');
  updateBgmButtonUi();
  showToast(`🎵 已切换背景曲目：《${track.name}》（${_bgmTrackIndex + 1}/${CANDY_BGM_TRACKS.length}）`);
}

function toggleCandyBgm() {
  STATE.bgmEnabled = !STATE.bgmEnabled;
  const track = CANDY_BGM_TRACKS[_bgmTrackIndex % CANDY_BGM_TRACKS.length];
  if (STATE.bgmEnabled) {
    startCandyBgm();
    playCommercialSound('open');
    showToast(`🎵 已开启背景音乐：《${track.name}》（4首曲目自动轮播）`);
  } else {
    stopCandyBgm();
    showToast('🎵 已暂停背景音乐');
  }
  updateBgmButtonUi();
}

// ============================================================================
// 🍬 糖果消除风合成特效音 (Jelly Pop / Sugar Crunch / Cascading Crystal Chimes)
// ============================================================================
function playCommercialSound(type = 'click') {
  if (!STATE.soundEnabled) return;
  const nowPerf = performance.now();
  if (type === 'click' && nowPerf - _lastSoundTimestamp < 55) return;
  _lastSoundTimestamp = nowPerf;

  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const playTone = (freq, startOffset, duration, vol = 0.08, wave = 'sine', endFreq = null) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + startOffset + duration * 0.85);
      }
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.linearRampToValueAtTime(vol, now + startOffset + Math.min(0.012, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0008, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.01);
    };

    if (type === 'click' || type === 'tap') {
      // Q弹果冻气泡啵啵音 (Jelly Pop Bloop: 快速上滑音 + 糖晶清脆泛音)
      playTone(390, 0, 0.068, 0.068, 'sine', 960);
      playTone(1320, 0.015, 0.042, 0.028, 'triangle', 1980);
    } else if (type === 'tab' || type === 'nav') {
      // 双颗软糖弹跳音 (Gummy Double Bounce)
      playTone(523.25, 0, 0.075, 0.065, 'sine', 659.25);
      playTone(783.99, 0.05, 0.095, 0.07, 'triangle', 1046.5);
    } else if (type === 'open') {
      // 糖果礼盒开启：闪亮四音阶竖琴上行滑音
      playTone(523.25, 0, 0.08, 0.055, 'triangle');
      playTone(659.25, 0.04, 0.09, 0.06, 'triangle');
      playTone(783.99, 0.08, 0.10, 0.065, 'sine');
      playTone(1046.5, 0.12, 0.18, 0.075, 'sine');
    } else if (type === 'close') {
      // 果冻收起柔和落音
      playTone(783.99, 0, 0.06, 0.05, 'sine', 523.25);
      playTone(523.25, 0.045, 0.08, 0.045, 'sine', 349.23);
    } else if (type === 'flip') {
      // 糖霜闪卡翻转清脆铃音
      playTone(440, 0, 0.06, 0.055, 'sine', 880);
      playTone(1174.66, 0.045, 0.12, 0.065, 'triangle', 1567.98);
    } else if (type === 'combo') {
      // 糖果连消逐级升调水晶音效 (随连击数逐级升高半音 + 顶部高音糖晶闪烁)
      const semi = Math.min(Math.max((STATE.comboStreak || 1) - 1, 0), 10);
      const mult = Math.pow(2, semi / 12);
      // 先来一声清脆果冻爆破音
      playTone(420 * mult, 0, 0.065, 0.085, 'sine', 1120 * mult);
      // 紧接着亮丽的糖果消除大三和弦琶音
      playTone(587.33 * mult, 0.03, 0.11, 0.09, 'triangle');
      playTone(739.99 * mult, 0.085, 0.11, 0.095, 'triangle');
      playTone(880.00 * mult, 0.14, 0.14, 0.10, 'sine');
      playTone(1174.66 * mult, 0.195, 0.30, 0.115, 'sine');
      // 顶部星尘闪烁泛音
      playTone(1760.00 * mult, 0.23, 0.18, 0.048, 'sine', 2349.32 * mult);
    } else if (type === 'wrong') {
      // 俏皮软糖摇晃音 (Cute Jelly Wobble，温和俏皮不刺耳)
      playTone(380, 0, 0.11, 0.075, 'triangle', 260);
      playTone(290, 0.10, 0.18, 0.075, 'sine', 210);
    } else if (type === 'mastered') {
      // 单题秒杀/点亮：果冻爆破 + 明亮彩虹水晶五音琶音
      playTone(440, 0, 0.06, 0.075, 'sine', 980);
      playTone(523.25, 0.03, 0.11, 0.085, 'triangle');
      playTone(659.25, 0.085, 0.11, 0.085, 'triangle');
      playTone(783.99, 0.14, 0.13, 0.09, 'triangle');
      playTone(1046.5, 0.195, 0.32, 0.11, 'sine');
      playTone(1567.98, 0.24, 0.26, 0.055, 'sine');
    } else if (type === 'victory') {
      // 满贯通关：Sugar Kingdom 皇家糖果礼炮号角
      const notes = [
        [523.25, 0.00, 0.10],
        [659.25, 0.08, 0.10],
        [783.99, 0.16, 0.10],
        [1046.50, 0.24, 0.16],
        [880.00, 0.38, 0.10],
        [1046.50, 0.47, 0.12],
        [1318.51, 0.57, 0.42]
      ];
      notes.forEach(([f, st, dur]) => {
        playTone(f, st, dur, 0.10, 'triangle');
        playTone(f * 1.5, st + 0.02, dur * 0.8, 0.04, 'sine');
      });
    }
  } catch (e) {
    // ignore audio errors
  }
}

// ============================================================================
// 🍭 原创 3D 糖霜连击大字横幅 (Candy Callout Banner: Sweet! / Juicy! / Yummy! / Sugar Burst!)
// ============================================================================
const CANDY_COMBO_CALLOUTS = [
  { min: 1, en: 'SWEET!', cn: '甜美秒杀!', grad: 'linear-gradient(135deg, #ff2e93 0%, #ff8a00 100%)', icon: '🍬' },
  { min: 2, en: 'TASTY!', cn: '香甜二连击!', grad: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', icon: '🍭' },
  { min: 3, en: 'JUICY!', cn: '爆汁三连击!', grad: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', icon: '🧁' },
  { min: 4, en: 'DAZZLING!', cn: '彩虹四连消!', grad: 'linear-gradient(135deg, #8e2de2 0%, #ff0080 100%)', icon: '🌈' },
  { min: 5, en: 'FABULOUS!', cn: '皇家五连冠!', grad: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', icon: '👑' },
  { min: 6, en: 'SUGAR BURST!', cn: '超神满贯星爆!', grad: 'linear-gradient(135deg, #ff0844 0%, #ffb199 50%, #7f00ff 100%)', icon: '🎆' }
];

function spawnCandyCalloutBanner(streak = 1, customText = null) {
  const tier = CANDY_COMBO_CALLOUTS.slice().reverse().find(c => streak >= c.min) || CANDY_COMBO_CALLOUTS[0];
  const old = document.querySelector('.candy-callout-banner');
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.className = 'candy-callout-banner';
  banner.style.setProperty('--callout-grad', tier.grad);
  banner.innerHTML = `
    <div class="candy-callout-inner">
      <span class="candy-callout-icon">${tier.icon}</span>
      <div class="candy-callout-texts">
        <div class="candy-callout-en">${customText || tier.en}</div>
        <div class="candy-callout-cn">${streak >= 2 && !customText ? `${tier.cn} (${streak}x Combo)` : tier.cn}</div>
      </div>
      <span class="candy-callout-icon">${tier.icon}</span>
    </div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 1350);
}

// 指尖点击波纹 + 彩色水果硬糖/星星软糖粒子散射特效
function spawnClickRippleAndParticles(x, y) {
  if (!x && !y) return;
  const ring = document.createElement('div');
  ring.className = 'fx-click-ring';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 540);

  const candyColors = ['#ff2e93', '#ff9f1c', '#2ec4b6', '#8338ec', '#3a86ff', '#ffbe0b'];
  const shapes = ['circle', 'pill', 'diamond'];
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('span');
    const shape = shapes[i % shapes.length];
    dot.className = `fx-click-spark shape-${shape}`;
    const angle = (Math.PI * 2 * i) / 8 + (Math.random() * 0.45 - 0.22);
    const dist = 26 + Math.random() * 28;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.background = candyColors[i % candyColors.length];
    dot.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist)}px`);
    dot.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist)}px`);
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 540);
  }
}

// 飘字激励动效（如 "+10 🍬"、"🔥 3连击 Juicy!"、"👑 已吃透!"）
function spawnFloatingFeedback(x, y, text, isPositive = true) {
  const cx = x || STATE.lastClickCoords.x || window.innerWidth / 2;
  const cy = y || STATE.lastClickCoords.y || window.innerHeight / 2;
  const el = document.createElement('div');
  el.className = `fx-float-badge ${isPositive ? 'is-plus' : 'is-hint'}`;
  el.textContent = text;
  el.style.left = `${Math.max(60, Math.min(window.innerWidth - 120, cx))}px`;
  el.style.top = `${Math.max(50, cy - 16)}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1180);
}

// 全局智能点击监听：首次交互自动唤醒糖果背景音乐 + 赋予果冻波纹与啵啵音效
document.addEventListener('pointerdown', (e) => {
  if (e.clientX && e.clientY) {
    STATE.lastClickCoords = { x: e.clientX, y: e.clientY };
  }
  if (STATE.bgmEnabled && !STATE.bgmPlaying) {
    startCandyBgm();
  }
  const interactive = e.target && e.target.closest
    ? e.target.closest('button, .drill-big-card, .zen-step-row, .nav-tab, .filter-pill, .syl-nav-item, .photo-card, .match-card-tile, .drawer-quiz-opt, summary, .brand, .huyisi-float-avatar-wrap')
    : null;
  if (interactive) {
    spawnClickRippleAndParticles(e.clientX, e.clientY);
    setTimeout(() => playCommercialSound('click'), 8);
  }
}, { passive: true });

function toggleSoundEffects() {
  STATE.soundEnabled = !STATE.soundEnabled;
  const btn = document.getElementById('soundToggleBtn');
  if (btn) btn.innerHTML = uiIcon(STATE.soundEnabled ? 'volume-on' : 'volume-off', 18);
  if (STATE.soundEnabled) playCommercialSound('mastered');
  showToast(STATE.soundEnabled ? '🔊 已开启糖果消除特效音' : '🔇 已关闭互动特效音');
}

// 安全编码任意多行/含引号/含公式文本，供 onclick="speakText('...')" 调用
function safeSpeakAttr(text) {
  return '__URI__:' + encodeURIComponent(String(text || '')).replace(/'/g, '%27');
}

// 将语文行内注音、数学 LaTeX 公式、Markdown 符号清洗为自然流畅的口语化中文
function cleanTextForSpeech(rawText) {
  let s = String(rawText || '');
  if (s.startsWith('__URI__:')) {
    try { s = decodeURIComponent(s.slice(8)); } catch (e) {}
  }
  return s
    // 去除汉字后紧跟的括号拼音注音，如 襟(jīn)飘带舞 -> 襟飘带舞，避免把成语拆成英文字母拼读
    .replace(/([\u4e00-\u9fa5])\s*[（(][a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s,，；;\/]+[)）]/g, '$1')
    // 去除英语词性标注如 (n.) (v.) (adj.)
    .replace(/\((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art)\.\)/gi, ' ')
    // 常见数学 LaTeX 转自然中文读法
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$2分之$1')
    .replace(/\\sqrt\{([^}]+)\}/g, '根号$1')
    .replace(/\^\\circ/g, '度')
    .replace(/°/g, '度')
    .replace(/\^2(?![0-9])/g, '的平方')
    .replace(/\^3(?![0-9])/g, '的立方')
    .replace(/\^\{([^}]+)\}/g, '的$1次方')
    .replace(/\\times/g, '乘')
    .replace(/\\div/g, '除以')
    .replace(/\\pm/g, '正负')
    .replace(/\\(?:le|leq)|≤/g, '小于等于')
    .replace(/\\(?:ge|geq)|≥/g, '大于等于')
    .replace(/\\(?:ne|neq)|≠/g, '不等于')
    .replace(/\\approx|≈/g, '约等于')
    .replace(/\\triangle|△/g, '三角形')
    .replace(/\\angle|∠/g, '角')
    .replace(/\\perp|⊥/g, '垂直于')
    .replace(/\\parallel|∥/g, '平行于')
    .replace(/\\cong|≌/g, '全等于')
    .replace(/\\sim|∽/g, '相似于')
    .replace(/\\pi/g, '派')
    .replace(/\\alpha/g, '阿尔法')
    .replace(/\\beta/g, '贝塔')
    .replace(/\\theta/g, '西塔')
    .replace(/\\rho/g, '柔')
    .replace(/\\Omega/g, '欧姆')
    .replace(/\\(?:to|rightarrow)|→|->/g, '，推出，')
    .replace(/\|([^|$]{1,18})\|/g, '$1的绝对值')
    .replace(/\$+/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    // 去除 Markdown 标记与装饰符号
    .replace(/[*#`_~>]/g, '')
    .replace(/[🎯💡⚠️✅❌🔴🟡🟢⚪•]/g, '')
    .replace(/\n+/g, '。')
    .replace(/。{2,}/g, '。')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

let _activeTtsAudio = null;
let _activeTtsKey = '';
let _activeTtsSessionId = 0;

function stopSpeakText(silent = false) {
  _activeTtsSessionId++;
  STATE.ttsPlaying = false;
  _activeTtsKey = '';
  if (_activeTtsAudio) {
    try {
      _activeTtsAudio.pause();
      _activeTtsAudio.src = '';
    } catch (e) {}
    _activeTtsAudio = null;
  }
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
  if (!silent) {
    showToast('⏹️ 已停止语音朗读');
  }
}

// 首句微切分算法：第 0 段控制在 12~42 字以内以实现极速首包出声，后续分段 180 字内并行预取
function splitTextIntoTtsChunks(cleanText) {
  const s = String(cleanText || '').trim();
  if (!s) return [];
  if (s.length <= 46) return [s];

  // 寻找前 10~45 字内的第一个标点作为极速首句切分点
  let firstCut = -1;
  const sub = s.slice(0, 48);
  const punctRe = /[。！？；：，,!?]/g;
  let m;
  while ((m = punctRe.exec(sub)) !== null) {
    if (m.index >= 8) {
      firstCut = m.index + 1;
      break;
    }
  }
  if (firstCut === -1) {
    firstCut = Math.min(36, s.length);
  }

  const firstChunk = s.slice(0, firstCut).trim();
  const rest = s.slice(firstCut).trim();
  const chunks = [firstChunk];

  if (rest) {
    const rawSentences = rest.split(/(?<=[。！？；!?])/);
    let buf = '';
    for (const seg of rawSentences) {
      if ((buf + seg).length > 180 && buf.length > 0) {
        chunks.push(buf.trim());
        buf = seg;
      } else {
        buf += seg;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }
  return chunks.filter(Boolean);
}

const _prefetchedChunks = new Set();

function prefetchTtsChunk(chunkText) {
  const t = String(chunkText || '').trim();
  if (!t || _prefetchedChunks.has(t)) return;
  _prefetchedChunks.add(t);
  fetch(`/api/tts?voice=zh-CN-XiaoyiNeural&text=${encodeURIComponent(t)}`).catch(() => {});
}

// 后台批量预热当前界面可见朗读按钮的首句，用户点击时直接命中本地磁盘缓存（0.01秒瞬时出声）
let _prewarmTimer = null;
function scheduleCurrentScreenTtsPrewarm() {
  if (_prewarmTimer) clearTimeout(_prewarmTimer);
  _prewarmTimer = setTimeout(() => {
    try {
      const btns = document.querySelectorAll('button[onclick*="speakText("]');
      const firstChunks = [];
      btns.forEach((btn) => {
        if (firstChunks.length >= 8) return;
        const oc = btn.getAttribute('onclick') || '';
        const match = oc.match(/speakText\('([^']+)'/);
        if (match && match[1]) {
          const cleaned = cleanTextForSpeech(match[1]);
          const chunks = splitTextIntoTtsChunks(cleaned);
          if (chunks[0] && !_prefetchedChunks.has(chunks[0])) {
            _prefetchedChunks.add(chunks[0]);
            firstChunks.push(chunks[0]);
          }
          if (chunks[1] && firstChunks.length < 8 && !_prefetchedChunks.has(chunks[1])) {
            _prefetchedChunks.add(chunks[1]);
            firstChunks.push(chunks[1]);
          }
        }
      });
      if (firstChunks.length > 0) {
        fetch('/api/tts-prewarm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice: 'zh-CN-XiaoyiNeural', rate: '+4%', texts: firstChunks })
        }).catch(() => {});
      }
    } catch (e) {}
  }, 120);
}

// 鼠标悬停到任何「🔊 朗读」按钮上时，提前 300ms 预加载该按钮的首句与次句
document.addEventListener('pointerover', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button[onclick*="speakText("]') : null;
  if (!btn) return;
  const oc = btn.getAttribute('onclick') || '';
  const match = oc.match(/speakText\('([^']+)'/);
  if (match && match[1]) {
    const cleaned = cleanTextForSpeech(match[1]);
    const chunks = splitTextIntoTtsChunks(cleaned);
    if (chunks[0]) prefetchTtsChunk(chunks[0]);
    if (chunks[1]) prefetchTtsChunk(chunks[1]);
  }
}, { passive: true });

function speakText(text, label = '当前内容') {
  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    showToast('当前卡片暂无可朗读文本');
    return;
  }

  // 再次点击同一段内容时支持一键停止朗读
  if (STATE.ttsPlaying && _activeTtsKey === cleanText) {
    stopSpeakText(false);
    return;
  }

  stopSpeakText(true);
  const sessionId = ++_activeTtsSessionId;
  _activeTtsKey = cleanText;
  STATE.ttsPlaying = true;

  const chunks = splitTextIntoTtsChunks(cleanText);
  if (chunks.length === 0) chunks.push(cleanText.slice(0, 180));

  // 在播放第 0 段的同时，立即在后台并行预缓存第 1、2 段，确保句间 0 停顿无缝衔接
  if (chunks[1]) prefetchTtsChunk(chunks[1]);
  if (chunks[2]) prefetchTtsChunk(chunks[2]);

  showToast(`🎙️ AI 甜美助教正在朗读${label}（再点可停止）`);

  const playChunkAt = (idx) => {
    if (sessionId !== _activeTtsSessionId) return;
    if (idx >= chunks.length) {
      STATE.ttsPlaying = false;
      _activeTtsKey = '';
      _activeTtsAudio = null;
      return;
    }
    // 提前预取后面两段
    if (chunks[idx + 1]) prefetchTtsChunk(chunks[idx + 1]);
    if (chunks[idx + 2]) prefetchTtsChunk(chunks[idx + 2]);

    const chunkText = chunks[idx];
    const ttsUrl = `/api/tts?voice=zh-CN-XiaoyiNeural&text=${encodeURIComponent(chunkText)}`;
    const audio = new Audio(ttsUrl);
    audio.preload = 'auto';
    _activeTtsAudio = audio;
    audio.onended = () => {
      if (sessionId !== _activeTtsSessionId) return;
      playChunkAt(idx + 1);
    };
    audio.onerror = () => {
      if (sessionId !== _activeTtsSessionId) return;
      fallbackBrowserSpeech(cleanText, sessionId);
    };
    audio.play().catch(() => {
      if (sessionId !== _activeTtsSessionId) return;
      fallbackBrowserSpeech(cleanText, sessionId);
    });
  };

  playChunkAt(0);
}

function fallbackBrowserSpeech(cleanText, sessionId) {
  if (!('speechSynthesis' in window)) {
    STATE.ttsPlaying = false;
    _activeTtsKey = '';
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'zh-CN';
    const voices = window.speechSynthesis.getVoices() || [];
    const preferred = voices.find(v => /Xiaoxiao|Xiaoyi|Yunxi|Tingting|Ting-Ting|Meijia|Sin-ji/i.test(v.name))
      || voices.find(v => /zh[-_]?CN/i.test(v.lang) && !/Eddy|Flo|Grandpa|Grandma|Reed|Rocko|Sandy|Shelley/i.test(v.name))
      || voices.find(v => /zh/i.test(v.lang));
    if (preferred) utter.voice = preferred;
    utter.rate = 1.0;
    utter.pitch = 1.02;
    utter.onend = () => {
      if (sessionId === _activeTtsSessionId) {
        STATE.ttsPlaying = false;
        _activeTtsKey = '';
      }
    };
    window.speechSynthesis.speak(utter);
  } catch (e) {
    STATE.ttsPlaying = false;
    _activeTtsKey = '';
  }
}

// 渲染商业级 SVG 环形进度圈 (Brilliant / Apple Rings 风格)
function renderMiniRingSvg(pct, color = '#4f46e5', size = 54) {
  const safePct = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const stroke = 5.5;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (safePct / 100) * c;
  return `
    <div class="comm-ring-wrap" style="width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${stroke}" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          transform="rotate(-90 ${size / 2} ${size / 2})" />
      </svg>
      <span class="comm-ring-text" style="color:${color};">${safePct}%</span>
    </div>
  `;
}

// 渲染矢量三星评级（独立 SVG 图标，不依赖特殊字符或 Emoji）
function renderStarRatingHtml(pct) {
  const s = pct >= 80 ? 3 : pct >= 35 ? 2 : pct > 0 ? 1 : 0;
  return `
    <span class="comm-stars" title="掌握度星级：${s}/3">
      <span class="${s >= 1 ? 'star-lit' : 'star-dim'}">${uiIcon('star-fill', 15)}</span>
      <span class="${s >= 2 ? 'star-lit' : 'star-dim'}">${uiIcon('star-fill', 15)}</span>
      <span class="${s >= 3 ? 'star-lit' : 'star-dim'}">${uiIcon('star-fill', 15)}</span>
    </span>
  `;
}

// 获取今日艾宾浩斯待复查或未掌握考点列表
function getEbbinghausDuePoints() {
  if (!STATE.data) return [];
  const today = new Date().toISOString().slice(0, 10);
  const curSem = STATE.stageFocus === 'ALL' ? '初一上' : STATE.stageFocus;
  const activeNames = getActiveSubjectNamesForStage(curSem);
  return STATE.data.knowledgePoints.filter(k => {
    const isDueDate = k.nextReview && k.nextReview <= today && !k.status.includes('已吃透');
    const isWeak = k.status.includes('未掌握');
    return (isDueDate || isWeak) && activeNames.includes(k.subject);
  });
}

function openEbbinghausReviewModal() {
  if (!STATE.data) return;
  playCommercialSound('click');
  const dueList = getEbbinghausDuePoints();
  const pool = dueList.length > 0
    ? dueList
    : STATE.data.knowledgePoints.filter(k => !k.status.includes('已吃透'));

  STATE.quiz.isOpen = true;
  STATE.quiz.studyStyle = 'quest';
  STATE.quiz.subject = 'ACTIVE_ALL';
  STATE.quiz.queue = pool.slice(0, 6);
  STATE.quiz.currentIndex = 0;
  STATE.quiz.qVariant = 'main';
  STATE.quiz.hintsShown = { h1: false, h2: false, h3: false };
  STATE.quiz.answerRevealed = false;
  STATE.quiz.flashcardFlipped = false;
  STATE.quiz.unlockedBlockStep = 1;
  STATE.quiz.selectedChoiceIdx = null;
  STATE.quiz.choiceSubmitted = false;
  STATE.quiz.choiceIsCorrect = null;
  STATE.quiz.questionElapsedSec = 0;
  STATE.quiz.totalElapsedSec = 0;
  STATE.quiz.results = [];
  STATE.quiz.finished = false;
  initMatchGameFromQueue();

  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
}

function renderHudStatusCapsules() {
  const wrap = document.getElementById('hudStatusCapsules');
  if (!wrap || !STATE.data) return;
  loadDailyStats();
  const done = STATE.dailyStats.completedToday;
  const goal = STATE.dailyStats.goal;
  const streak = STATE.dailyStats.streakDays;
  const dueCount = getEbbinghausDuePoints().length;
  const goalReached = done >= goal;

  wrap.innerHTML = `
    <span class="hud-pill hud-streak" title="连续学习打卡 ${streak} 天">
      ${uiIcon('flame', 15)} <strong>${streak}</strong><span class="hud-label-text">天</span>
    </span>
    <span class="hud-pill ${goalReached ? 'hud-goal-done' : 'hud-goal'}" onclick="openHuyisiQuizModal()" title="今日小目标 ${done}/${goal}（点击练习）">
      ${uiIcon(goalReached ? 'check' : 'bolt', 15)} <strong>${done}/${goal}</strong>
    </span>
    ${dueCount > 0 ? `
      <button class="hud-pill hud-due" onclick="openEbbinghausReviewModal()" title="待复习 ${dueCount} 题">
        ${uiIcon('clock', 15)} <strong>${dueCount}</strong><span class="hud-label-text">复习</span>
      </button>
    ` : ''}
  `;
}

function renderStageControlBar() {
  renderHudStatusCapsules();
  const bar = document.getElementById('globalStageBar');
  if (!bar || !STATE.data) return;

  const optionsHtml = STAGE_OPTIONS.map(opt => {
    const sel = STATE.stageFocus === opt.code ? 'selected' : '';
    return `<option value="${opt.code}" ${sel}>${opt.shortLabel}</option>`;
  }).join('');

  bar.innerHTML = `
    <select class="topbar-grade-select" onchange="setStageFocus(this.value)" title="切换当前学期">
      ${optionsHtml}
    </select>
    <button class="hud-icon-btn" onclick="openCurriculumModal()" title="调整各年级开设科目" aria-label="设置课表">
      ${uiIcon('settings', 17)}
    </button>
  `;
}

function setStageFocus(stageCode) {
  // 兼容旧代码传入 Y1 / Y2 / Y3 / Y4
  if (stageCode === 'Y1_S1' || stageCode === 'Y1') stageCode = '初一上';
  else if (stageCode === 'Y2') stageCode = '初二上';
  else if (stageCode === 'Y3') stageCode = '初三上';
  else if (stageCode === 'Y4') stageCode = '初四上';

  persistSelectedSemester(stageCode);
  STATE.stageFocus = stageCode;
  STATE.mesoFilter.semester = stageCode;
  STATE.homeSelectedChapter = 'ALL';
  STATE.mesoFilter.chapter = 'ALL';
  STATE.drillLevel = stageCode === 'ALL' ? 'SEMESTER' : 'SUBJECT';

  // 若当前选中的科目在新学期没有考点，自动切到该学期有考点的第一个在读科目
  if (STATE.data && stageCode !== 'ALL') {
    const hasHomeSubj = STATE.data.knowledgePoints.some(k => k.subject === STATE.homeSelectedSubject && matchesStageFocus(k.semester, stageCode));
    if (!hasHomeSubj) {
      const activeNames = getActiveSubjectNamesForStage(stageCode);
      const fallback = activeNames.find(n => STATE.data.knowledgePoints.some(k => k.subject === n && matchesStageFocus(k.semester, stageCode)));
      if (fallback) STATE.homeSelectedSubject = fallback;
    }
    if (STATE.mesoFilter.subject !== 'ALL') {
      const hasMesoSubj = STATE.data.knowledgePoints.some(k => k.subject === STATE.mesoFilter.subject && matchesStageFocus(k.semester, stageCode));
      if (!hasMesoSubj && STATE.homeSelectedSubject) {
        STATE.mesoFilter.subject = STATE.homeSelectedSubject;
      }
    }
  }

  renderStageControlBar();
  if (STATE.activeTab === 'macro') renderMacroView();
  if (STATE.activeTab === 'meso') renderMesoView();
  if (STATE.activeTab === 'charts') renderChartsView();
  if (STATE.activeTab === 'syllabus') renderSyllabusView();
  if (STATE.activeTab === 'mastermap' && typeof renderMasterMapView === 'function') renderMasterMapView();
  if (STATE.activeTab === 'qbank' && typeof renderCustomQBankView === 'function') renderCustomQBankView();
}

function setDisplayDimension(dim) {
  STATE.displayDimension = dim;
  STATE.mesoFilter.viewMode = dim === 'depth' ? 'depth_grouped' : 'year_grouped';
  renderStageControlBar();
  if (STATE.activeTab === 'macro') renderMacroView();
  if (STATE.activeTab === 'meso') renderMesoView();
  if (STATE.activeTab === 'charts') renderChartsView();
}

// ⚙️ 淄博五四学制各年级所学科目校准弹窗
function openCurriculumModal() {
  const modal = document.getElementById('curriculumModalBackdrop');
  if (!modal || !STATE.data) return;
  renderCurriculumModalContent();
  modal.classList.add('open');
}

function closeCurriculumModal(e) {
  if (e && e.target && e.target.id !== 'curriculumModalBackdrop') return;
  const modal = document.getElementById('curriculumModalBackdrop');
  if (modal) modal.classList.remove('open');
}

function toggleGradeSubjCustom(gradeKey, subjName) {
  const map = getZiboCurriculumMap();
  const cfg = map[gradeKey];
  if (!cfg) return;

  if (cfg.active.includes(subjName)) {
    // 从在读切换为未开课或已结业
    cfg.active = cfg.active.filter(s => s !== subjName);
    if (gradeKey === 'Y4' && ['地理', '生物', '历史'].includes(subjName)) {
      if (!cfg.graduated.includes(subjName)) cfg.graduated.push(subjName);
    } else {
      if (!cfg.notStarted.includes(subjName)) cfg.notStarted.push(subjName);
    }
  } else {
    cfg.active.push(subjName);
    cfg.notStarted = (cfg.notStarted || []).filter(s => s !== subjName);
    cfg.graduated = (cfg.graduated || []).filter(s => s !== subjName);
  }
  cfg.summary = `本年级自定义在读 ${cfg.active.length} 科（${cfg.active.join('、')}）`;
  localStorage.setItem('ZIBO_54_CUSTOM_CURRICULUM_V4', JSON.stringify(map));
  renderCurriculumModalContent();
  renderStageControlBar();
  if (STATE.activeTab === 'macro') renderMacroView();
  if (STATE.activeTab === 'charts') renderChartsView();
  showToast(`✅ 已更新【${cfg.gradeTitle}】在读科目设置！`);
}

function resetCurriculumToDefault() {
  localStorage.removeItem('ZIBO_54_CUSTOM_CURRICULUM_V4');
  renderCurriculumModalContent();
  renderStageControlBar();
  if (STATE.activeTab === 'macro') renderMacroView();
  if (STATE.activeTab === 'charts') renderChartsView();
  showToast('🔄 已恢复为山东淄博五四学制默认各年级课表！');
}

function renderCurriculumModalContent() {
  const box = document.getElementById('curriculumModalContent');
  if (!box || !STATE.data) return;
  const map = getZiboCurriculumMap();
  const allSubjs = STATE.data.subjects;

  const rowsHtml = ['Y1', 'Y2', 'Y3', 'Y4'].map(gKey => {
    const cfg = map[gKey];
    const btns = allSubjs.map(s => {
      const isAct = cfg.active.includes(s.name);
      const isGrad = (cfg.graduated || []).includes(s.name);
      const bg = isAct ? 'linear-gradient(135deg,#ec4899,#8b5cf6)' : isGrad ? '#f1f5f9' : '#fff';
      const col = isAct ? '#fff' : isGrad ? '#475569' : '#94a3b8';
      const border = isAct ? '#ec4899' : '#cbd5e1';
      const tag = isAct ? '✅在读' : isGrad ? '🎓已结业' : (s.name === '地理' ? '⏳初二开课' : '⏳初三开课');
      return `<button onclick="toggleGradeSubjCustom('${gKey}','${s.name}')"
        style="padding:6px 11px;border-radius:999px;border:1.5px solid ${border};background:${bg};color:${col};font-size:12px;font-weight:700;cursor:pointer;">
        ${s.icon} ${s.name} <span style="font-size:10.5px;opacity:0.9;">(${tag})</span>
      </button>`;
    }).join('');

    return `
      <div style="padding:14px 16px;border-radius:14px;background:#faf5ff;border:1px solid #e9d5ff;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <strong style="font-size:15px;color:#4c1d95;">🏫 ${cfg.gradeTitle} · 在读 ${cfg.active.length} 科</strong>
          <span style="font-size:12px;color:#64748b;">${cfg.summary}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${btns}</div>
      </div>
    `;
  }).join('');

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:12px;">
      <div>
        <h3 style="font-size:18px;font-weight:800;color:#1e1b4b;margin-bottom:4px;">⚙️ 山东淄博五四学制（初中四年）各年级在读科目校准</h3>
        <p style="font-size:12.5px;color:#475569;">
          已校准：<strong>初一 6 科（语数英道历生，不开地理/理化）、初二 7 科（新开地理！语数英道历地生）、初三 9 科全齐（新开物理+化学，初三下地/生/历三科结业会考）、初四 6 科中考决战（语数英理化道）</strong>。点击任意胶囊可自由微调：
        </p>
      </div>
      <button class="quiz-close-btn" style="background:#f1f5f9;color:#0f172a;border-color:#cbd5e1;" onclick="closeCurriculumModal()">✖ 关闭</button>
    </div>
    ${rowsHtml}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
      <button class="filter-pill" onclick="resetCurriculumToDefault()">🔄 恢复默认设置</button>
      <button class="btn-lucky-quest" onclick="closeCurriculumModal()">✅ 保存并应用当前课表</button>
    </div>
  `;
}

// ============================================================================
// 🦊 魔法少女狐伊丝 (Magical Girl Huyisi) · 奇喵魔法学府互动与可视化图表引擎
// ============================================================================

const HUYISI_OUTFITS = {
  welcome: {
    img: '/assets/huyisi_welcome.jpg',
    label: '🌟 星杖学府装',
    title: '奇喵魔法学府·星辉导师 狐伊丝'
  },
  victory: {
    img: '/assets/huyisi_victory.jpg',
    label: '⚔️ 光剑战袍装',
    title: '高分满贯·光剑魔女 狐伊丝'
  },
  detective: {
    img: '/assets/huyisi_detective.jpg',
    label: '🔍 猫小九侦探装',
    title: '错题破案·名侦探 狐伊丝 & 猫小九'
  }
};

const HUYISI_QUOTES = [
  '🦊 狐伊丝：“若婷学姐欢迎回来！在奇喵魔法学府里，每一道考点都是一颗等待点亮的星钻✨！今天我们先收服初一上的哪一颗？”',
  '🐾 猫小九：“喵呜～做有理数混合运算时，看到括号前面站着『-24』，一定要把负号打包带进括号每一项，别中了黑魔法陷阱哦！”',
  '⚔️ 狐伊丝：“哇！若婷学姐在调研卷里把『圆在数轴滚动2024』和『国庆8万人限流』两道三星大魔王题全都满分斩杀了！白棋墨看了都要鼓掌！”',
  '🔮 狐伊丝：“遇到绝对值求和最小值别慌，念出本小姐的光剑咒语——『两站之间段内平，三站设在正中央（奇点取中法）』，一秒破阵！”',
  '🌸 狐伊丝：“还记得除法没有分配律吗？除号在括号前面时，必须乖乖先通分算括号里面，倒过来乘才能召唤分配律哦！”',
  '🌟 猫小九：“若婷学姐在《中秋作业》里主动二刷救回 8 道题的习惯太帅啦！只要没算出确凿反例，千万要相信自己第一遍算对的答案！”',
  '🎲 狐伊丝：“不知道先看哪一题？点右上角的『🎲 抽今日闯关题』，让我的魔法星杖为你挑一张幸运卷轴吧！”'
];

function cycleHuyisiQuote() {
  STATE.huyisiQuoteIndex = (STATE.huyisiQuoteIndex + 1) % HUYISI_QUOTES.length;
  const q = HUYISI_QUOTES[STATE.huyisiQuoteIndex];
  const heroBox = document.getElementById('huyisiHeroSpeech');
  const floatBox = document.getElementById('huyisiFloatText');
  if (heroBox) heroBox.innerHTML = `${q} <span style="font-size:11px;color:#ec4899;font-weight:700;margin-left:6px;">[点击换一句 💬]</span>`;
  if (floatBox) floatBox.textContent = q;
}

function setHuyisiOutfit(outfitKey) {
  if (!HUYISI_OUTFITS[outfitKey]) return;
  STATE.huyisiOutfit = outfitKey;
  const imgUrl = HUYISI_OUTFITS[outfitKey].img;
  const floatImg = document.getElementById('huyisiFloatImg');
  const brandImg = document.querySelector('.brand-mascot-avatar');
  if (floatImg) floatImg.src = imgUrl;
  if (brandImg) brandImg.src = imgUrl;
  if (STATE.activeTab === 'macro') renderMacroView();
}

function toggleFloatingMenu() {
  cycleHuyisiQuote();
  const keys = Object.keys(HUYISI_OUTFITS);
  const nextIdx = (keys.indexOf(STATE.huyisiOutfit) + 1) % keys.length;
  setHuyisiOutfit(keys[nextIdx]);
  showToast('🦊 狐伊丝换上了【' + HUYISI_OUTFITS[keys[nextIdx]].label + '】并给你送上一句悄悄话✨');
}

function toggleCartoonTheme() {
  STATE.cartoonTheme = !STATE.cartoonTheme;
  document.body.classList.toggle('theme-huyisi', STATE.cartoonTheme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = STATE.cartoonTheme ? '🦊 魔法皮肤' : '🎓 经典皮肤';
  showToast(STATE.cartoonTheme ? '🦊 已切换为「魔法少女狐伊丝·奇喵学府」卡通主题！' : '🎓 已切换为「经典学霸」清爽教研主题！');
}

function burstMagicConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;
  const icons = ['🍬', '🍭', '🧁', '🍓', '🍋', '🍇', '🌈', '⭐', '💎', '✨', '🍩', '👑'];
  for (let i = 0; i < 38; i++) {
    const span = document.createElement('span');
    span.className = 'confetti-piece';
    span.textContent = icons[i % icons.length];
    span.style.left = Math.round(10 + Math.random() * 80) + 'vw';
    span.style.top = Math.round(10 + Math.random() * 44) + 'vh';
    span.style.setProperty('--tx', `${Math.round((Math.random() - 0.5) * 260)}px`);
    span.style.setProperty('--ty', `${Math.round(-130 - Math.random() * 170)}px`);
    span.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 620)}deg`);
    span.style.animationDelay = (Math.random() * 0.28).toFixed(2) + 's';
    container.appendChild(span);
    setTimeout(() => span.remove(), 2200);
  }
}

function triggerRandomLuckyQuest() {
  if (!STATE.data) return;
  const stageKps = STATE.data.knowledgePoints.filter(k => matchesStageFocus(k.semester, STATE.stageFocus));
  const pool = stageKps.filter(k => k.status.includes('未掌握') || k.status.includes('复习中'));
  const targetPool = pool.length > 0 ? pool : (stageKps.length > 0 ? stageKps : STATE.data.knowledgePoints);
  const picked = targetPool[Math.floor(Math.random() * targetPool.length)];
  if (picked) {
    burstMagicConfetti();
    showToast(`🎲 狐伊丝为你抽中今日幸运闯关卷轴：【${picked.subject} · ${picked.corePoint}】！`);
    openMicroDrawer(picked.id);
  }
}

// 🕸️ 图表 1：动态 SVG 多维学科魔法共鸣雷达图
function renderSubjectRadarSvg(stageKps, subjects, allKps) {
  // 取当前学段有考点的科目（初一上为7科，全周期为9科）
  const activeSubjects = subjects.filter(s => stageKps.some(k => k.subject === s.name));
  const list = activeSubjects.length >= 3 ? activeSubjects : subjects;
  const N = list.length;
  const cx = 145, cy = 132, R = 86;

  // 计算每科“魔法能量分”(基础底分 52 + 已吃透权重 + 复习中权重 + 深度探索度)
  const scores = list.map(subj => {
    const sKps = stageKps.filter(k => k.subject === subj.name);
    const set = sKps.length > 0 ? sKps : allKps.filter(k => k.subject === subj.name);
    const tot = set.length || 1;
    const g = set.filter(k => k.status.includes('已吃透')).length;
    const y = set.filter(k => k.status.includes('复习中')).length;
    const r = set.filter(k => k.status.includes('未掌握')).length;
    // 若已实测（如数学），真实反映；未实测科目给预习准备基准值 65%
    let ratio = 0.65;
    if (g + y + r > 0) {
      ratio = Math.min(0.98, Math.max(0.45, (g * 1.0 + y * 0.72 + (tot - g - y - r) * 0.6 + r * 0.35) / tot));
    }
    return { subj, pct: Math.round(ratio * 100), ratio, count: set.length, weak: r };
  });

  const rings = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = rings.map(r => {
    const pts = scores.map((_, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
      return `${(cx + R * r * Math.cos(angle)).toFixed(1)},${(cy + R * r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#e9d5ff" stroke-width="1" stroke-dasharray="${r === 1 ? 'none' : '3,3'}" />`;
  }).join('');

  const axesLines = scores.map((item, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
    const x2 = (cx + R * Math.cos(angle)).toFixed(1);
    const y2 = (cy + R * Math.sin(angle)).toFixed(1);
    const lx = (cx + (R + 28) * Math.cos(angle)).toFixed(1);
    const ly = (cy + (R + 22) * Math.sin(angle)).toFixed(1);
    return `
      <line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#ddd6fe" stroke-width="1" />
      <g style="cursor:pointer;" onclick="jumpToSubjectMeso('${item.subj.name}', false)">
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="#3b0764">
          ${item.subj.icon}${item.subj.name}(${item.pct}%)
        </text>
      </g>
    `;
  }).join('');

  const dataPts = scores.map((item, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
    return `${(cx + R * item.ratio * Math.cos(angle)).toFixed(1)},${(cy + R * item.ratio * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

  const dataDots = scores.map((item, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
    const px = (cx + R * item.ratio * Math.cos(angle)).toFixed(1);
    const py = (cy + R * item.ratio * Math.sin(angle)).toFixed(1);
    return `<circle cx="${px}" cy="${py}" r="4.5" fill="${item.weak > 0 ? '#f43f5e' : '#ec4899'}" stroke="#fff" stroke-width="1.5" style="cursor:pointer;" onclick="jumpToSubjectMeso('${item.subj.name}', false)">
      <title>${item.subj.name}：共鸣度 ${item.pct}% (${item.count}个考点)</title>
    </circle>`;
  }).join('');

  return `
    <svg viewBox="0 0 290 264" width="100%" height="248" style="overflow:visible;">
      <defs>
        <linearGradient id="huyisiRadarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.42" />
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.42" />
        </linearGradient>
      </defs>
      ${gridPolygons}
      ${axesLines}
      <polygon points="${dataPts}" fill="url(#huyisiRadarGrad)" stroke="#ec4899" stroke-width="2.5" />
      ${dataDots}
    </svg>
  `;
}

// 🍩 图表 2：动态 SVG 魔法星辉环形仪表盘 (Multi-Segment Donut Chart)
function renderMasteryDonutSvg(countMastered, countReview, countWeak, countPending, total) {
  const safeTotal = total || 1;
  const r = 64;
  const circum = 2 * Math.PI * r;
  const segments = [
    { label: '🟢 光剑已封印 (已吃透)', count: countMastered, color: '#16a34a', filter: '已吃透' },
    { label: '🟡 咒语吟唱中 (复习中)', count: countReview, color: '#f59e0b', filter: '复习中' },
    { label: '🔴 迷雾小魔王 (未掌握)', count: countWeak, color: '#ef4444', filter: '未掌握' },
    { label: '🔮 待探索星域 (待考察)', count: countPending, color: '#a855f7', filter: '待考察' }
  ];

  let offset = 0;
  const circlesHtml = segments.map(seg => {
    const frac = seg.count / safeTotal;
    const len = frac * circum;
    const dash = `${len.toFixed(1)} ${(circum - len).toFixed(1)}`;
    const curOffset = offset;
    offset += len;
    if (seg.count === 0) return '';
    return `<circle cx="85" cy="85" r="${r}" fill="none" stroke="${seg.color}" stroke-width="18"
      stroke-dasharray="${dash}" stroke-dashoffset="${(-curOffset).toFixed(1)}"
      transform="rotate(-90 85 85)" style="cursor:pointer;transition:all 0.3s;"
      onclick="filterMesoByStatus('${seg.filter}')">
      <title>${seg.label}: ${seg.count} 个考点 (${Math.round(frac * 100)}%)</title>
    </circle>`;
  }).join('');

  const legendHtml = segments.map(seg => {
    const pct = Math.round((seg.count / safeTotal) * 100);
    return `
      <div class="donut-legend-item" onclick="filterMesoByStatus('${seg.filter}')">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${seg.color};display:inline-block;"></span>
          ${seg.label}
        </span>
        <strong>${seg.count} <span style="font-size:11px;color:#64748b;">(${pct}%)</span></strong>
      </div>
    `;
  }).join('');

  return `
    <div class="donut-layout">
      <svg viewBox="0 0 170 170" width="165" height="165">
        <circle cx="85" cy="85" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="18" />
        ${circlesHtml}
        <text x="85" y="79" text-anchor="middle" font-size="22" font-weight="800" fill="#1e1b4b">${total}</text>
        <text x="85" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#ec4899">✨本阶总星钻</text>
      </svg>
      <div class="donut-legend">${legendHtml}</div>
    </div>
  `;
}

// 🏔️ 图表 3：三级魔物阶梯能量塔 (L1星尘 / L2迷雾 / L3深渊魔王)
function renderDepthTierTowerHtml(diff1, diff2, diff3, total, kps) {
  const safeTotal = total || 1;
  const tiers = [
    { tier: 1, icon: '🌸', name: 'L1 星尘基石怪 (⭐基础必拿)', count: diff1, color: '#16a34a', bg: '#f0fdf4', desc: '零失误保底契约：概念、默写、基本公式' },
    { tier: 2, icon: '🔮', name: 'L2 迷雾陷阱怪 (⭐⭐中档易错)', count: diff2, color: '#2563eb', bg: '#eff6ff', desc: '期中期末主力区：符号括号、分配律变形' },
    { tier: 3, icon: '⚔️', name: 'L3 深渊大魔王 (⭐⭐⭐压轴突破)', count: diff3, color: '#9333ea', bg: '#faf5ff', desc: '冲刺满贯天花板：动点最值、全等、函数综合' }
  ];

  return `
    <div class="tier-tower-list">
      ${tiers.map(t => {
        const pct = Math.round((t.count / safeTotal) * 100);
        const tKps = kps.filter(k => getDepthTier(k.difficulty) === t.tier);
        const redCnt = tKps.filter(k => k.status.includes('未掌握')).length;
        return `
          <div class="tier-tower-row" style="background:${t.bg};border-left:4px solid ${t.color};" onclick="jumpToDepthTierMeso('${t.tier}')">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <strong style="font-size:13px;color:#0f172a;">${t.icon} ${t.name}</strong>
              <span style="font-size:12px;font-weight:800;color:${t.color};">
                ${t.count} 颗星钻 (${pct}%) ${redCnt > 0 ? `<span class="badge status-red" style="margin-left:4px;">🔥${redCnt}待讨伐</span>` : ''}
              </span>
            </div>
            <div class="gene-bar-track" style="height:9px;background:rgba(255,255,255,0.85);">
              <div class="gene-bar-fill" style="width:${pct}%;background:${t.color};"></div>
            </div>
            <div style="font-size:11.5px;color:#475569;margin-top:4px;">${t.desc}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 🌟 图表 4：点亮万千世界魔法星图 · 交互式宝石矩阵 (Interactive Star Gem Matrix)
function renderMagicConstellationMatrixHtml(kps, subjects, stageOpt, allKps) {
  const rowsHtml = subjects.map(subj => {
    const sKps = kps.filter(k => k.subject === subj.name).sort((a, b) => a.order - b.order);
    const gradeStatus = getSubjectGradeStatus(subj.name, STATE.stageFocus);
    const isInactive = gradeStatus.status !== 'active' && sKps.length === 0;
    const displayList = sKps.length > 0 ? sKps : allKps.filter(k => k.subject === subj.name).sort((a, b) => a.order - b.order);

    const gemsHtml = displayList.map(k => {
      const tier = getDepthTier(k.difficulty);
      const isGreen = k.status.includes('已吃透');
      const isYellow = k.status.includes('复习中');
      const isRed = k.status.includes('未掌握');
      const gemCls = isGreen ? 'gem-green' : isYellow ? 'gem-yellow' : isRed ? 'gem-red' : 'gem-gray';
      const icon = isGreen ? '🌟' : isYellow ? '⭐' : isRed ? '🔥' : (tier === 3 ? '👑' : tier === 2 ? '🔮' : '🌸');
      return `
        <div class="star-gem ${gemCls}" style="${isInactive ? 'opacity:0.55;' : ''}"
          onclick="openMicroDrawer('${k.id}')"
          title="【${k.subject}·${k.semester}】#${k.order} ${k.corePoint}\n难度：${k.difficulty}｜状态：${k.status}\n💡口诀：${k.mnemonic || '点击查看'}">
          <span>${icon}</span>
          <span class="gem-sub">#${k.order}</span>
        </div>
      `;
    }).join('');

    let rightBadge = `<span style="color:#be185d;font-weight:700;cursor:pointer;" onclick="openHuyisiQuizModal('${subj.name}', 'SMART')">⚡ 逐题快测 →</span>`;
    if (gradeStatus.status === 'not_started') {
      rightBadge = `<span class="badge status-gray">${gradeStatus.tag}</span>`;
    } else if (gradeStatus.status === 'graduated') {
      rightBadge = `<span class="badge status-green">${gradeStatus.tag}</span>`;
    }

    return `
      <div class="constellation-subj-row">
        <div style="font-weight:800;font-size:13.5px;color:#1e1b4b;cursor:pointer;display:flex;align-items:center;gap:6px;" onclick="jumpToSubjectMeso('${subj.name}', ${isInactive})">
          <span>${subj.icon} ${subj.name}</span>
          <span style="font-size:11px;color:#64748b;font-weight:600;">(${displayList.length})</span>
        </div>
        <div class="constellation-stars-wrap">
          ${gemsHtml}
        </div>
        <div style="font-size:11.5px;color:#64748b;white-space:nowrap;">
          ${rightBadge}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section-card" style="border:2px solid #f9a8d4;background:linear-gradient(180deg,#fffdfd 0%,#faf5ff 100%);">
      <div class="section-header">
        <div>
          <div class="section-title" style="color:#831843;">
            🌟 狐伊丝的「万千世界魔法星图」互动宝石矩阵 · 当前视角：【${stageOpt.shortLabel} (${kps.length}颗星钻)】
          </div>
          <div class="section-subtitle">
            每一颗宝石代表一个必考核心掌握点！<strong>🌟翡翠绿=已吃透</strong> · <strong>⭐琥珀黄=复习中</strong> · <strong>🔥火焰红=待攻克错题</strong> · <strong>🌸L1 / 🔮L2 / 👑L3=待检测</strong>。点击任意宝石直接打开题目卷轴！
          </div>
        </div>
        <button class="btn-lucky-quest" onclick="openHuyisiQuizModal('ACTIVE_ALL', 'SMART')">🦊 启动一题一题弹出快测</button>
      </div>
      <div class="constellation-grid">
        ${rowsHtml}
      </div>
    </div>
  `;
}

// ============================================================================
// 视图 1：🏠 11岁儿童「清爽游戏化 + 清晰学习路径」首页 (Khan Academy × Duolingo × Quizlet × Prodigy)
// ============================================================================

function loadDailyStats() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const saved = JSON.parse(localStorage.getItem('RUOTING_DAILY_PROGRESS_V1') || '{}');
    if (saved.date === today) {
      STATE.dailyStats.completedToday = saved.completedToday || 0;
      STATE.dailyStats.streakDays = saved.streakDays || 3;
    } else {
      STATE.dailyStats.completedToday = 0;
      STATE.dailyStats.streakDays = saved.streakDays || 3;
    }
  } catch (e) {
    console.warn(e);
  }
}

function recordDailyQuestionDone() {
  loadDailyStats();
  const today = new Date().toISOString().slice(0, 10);
  STATE.dailyStats.completedToday += 1;
  localStorage.setItem('RUOTING_DAILY_PROGRESS_V1', JSON.stringify({
    date: today,
    completedToday: STATE.dailyStats.completedToday,
    streakDays: STATE.dailyStats.streakDays
  }));
  renderHudStatusCapsules();
}

// ============================================================================
// 一级一级递进点击导航 (Strict Step-by-Step Progressive Drill-Down)
// Level 1: SEMESTER (选学期) -> Level 2: SUBJECT (选科目) -> Level 3: CHAPTER (选章节) -> Level 4: POINTS (学考点)
// ============================================================================

function resetToDrillStart() {
  playCommercialSound('click');
  STATE.drillLevel = 'SUBJECT';
  if (STATE.activeTab !== 'macro') {
    switchTab('macro');
  } else {
    renderMacroView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function resetDrillToHome() {
  resetToDrillStart();
}

function goToDrillLevel(level) {
  playCommercialSound('click');
  STATE.drillLevel = level;
  renderMacroView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillSelectSemester(semCode) {
  playCommercialSound('click');
  persistSelectedSemester(semCode);
  STATE.stageFocus = semCode;
  STATE.mesoFilter.semester = semCode;
  STATE.homeSelectedChapter = 'ALL';
  STATE.drillLevel = 'SUBJECT';
  renderStageControlBar();
  renderMacroView();
  showToast(`已锁定当前学期：${semCode}（下次打开自动进入）`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillSelectSubject(subjName) {
  playCommercialSound('click');
  STATE.homeSelectedSubject = subjName;
  STATE.mesoFilter.subject = subjName;
  // 若当前学期是 ALL 或该科目在当前学期未开课，自动对齐到该科目有课的学期
  if (STATE.data) {
    const curSem = STATE.stageFocus === 'ALL' ? '初一上' : STATE.stageFocus;
    const hasInSem = STATE.data.knowledgePoints.some(k => k.subject === subjName && k.semester === curSem);
    if (!hasInSem) {
      const validSem = getFirstValidSemesterForSubject(subjName);
      persistSelectedSemester(validSem);
      STATE.stageFocus = validSem;
      STATE.mesoFilter.semester = validSem;
      renderStageControlBar();
      showToast(`${subjName}在【${validSem}】开课，已为您切换到 ${validSem}`);
    } else if (STATE.stageFocus === 'ALL') {
      persistSelectedSemester(curSem);
      STATE.stageFocus = curSem;
      STATE.mesoFilter.semester = curSem;
      renderStageControlBar();
    }
  }
  STATE.homeSelectedChapter = 'ALL';
  STATE.drillLevel = 'CHAPTER';
  renderMacroView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillSelectChapter(chKey, initialSubMode = 'ARCHETYPE') {
  playCommercialSound('click');
  STATE.homeSelectedChapter = chKey;
  STATE.mesoFilter.chapter = chKey;
  STATE.chapterSubMode = initialSubMode || 'ARCHETYPE';
  STATE.chapterCardIdx = 0;
  STATE.chapterCardFlipped = false;
  STATE.drillLevel = 'POINTS';
  renderMacroView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setChapterSubMode(mode) {
  playCommercialSound('click');
  STATE.chapterSubMode = mode;
  STATE.chapterCardIdx = 0;
  STATE.chapterCardFlipped = false;
  renderMacroView();
}

function flipInlineChapterCard() {
  playCommercialSound('flip');
  STATE.chapterCardFlipped = !STATE.chapterCardFlipped;
  const el = document.getElementById('inlineChapterFlashcard');
  if (el) el.classList.toggle('is-flipped', STATE.chapterCardFlipped);
}

function stepInlineChapterCard(delta, total) {
  playCommercialSound('click');
  STATE.chapterCardIdx = (STATE.chapterCardIdx + delta + total) % total;
  STATE.chapterCardFlipped = false;
  renderMacroView();
}

async function quickMarkChapterPointStatus(kpId, newStatus) {
  if (!STATE.data) return;
  const kp = STATE.data.knowledgePoints.find(k => k.id === kpId);
  if (!kp) return;
  if (kp.isUnverified || (kp.status || '').includes('🔒待精校')) {
    showToast('🔒 本课属于高年级待精校预习章节，当前已锁定状态，暂不开放打卡修改');
    return;
  }
  kp.status = newStatus;
  recordDailyQuestionDone();
  if (newStatus.includes('已吃透')) {
    playCommercialSound('mastered');
    burstMagicConfetti();
  } else {
    playCommercialSound('click');
  }
  const days = newStatus.includes('未掌握') ? 1 : newStatus.includes('复习中') ? 3 : 15;
  fetch('/api/update-point', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: kp.id,
      status: newStatus,
      nextReview: addDaysISO(days),
      lastTested: new Date().toISOString().slice(0, 10),
      newRecord: `[章节速记卡打卡] 标记为 ${newStatus}`
    })
  }).catch(() => {});
  renderMacroView();
}

function selectHomeSubject(subjName) {
  drillSelectSubject(subjName);
}

function selectHomeChapter(chKey) {
  drillSelectChapter(chKey);
}

function selectMesoChapter(chKey) {
  STATE.mesoFilter.chapter = STATE.mesoFilter.chapter === chKey ? 'ALL' : chKey;
  renderMesoView();
}

function openChapterQuizModal(subjName, semester, chapterTitle, studyStyle = 'quest') {
  if (!STATE.data) return;
  playCommercialSound('click');
  const pool = STATE.data.knowledgePoints
    .filter(k => k.subject === subjName && (semester === 'ALL' || k.semester === semester) && k.chapter === chapterTitle && !k.isUnverified && !(k.status || '').includes('🔒待精校') && countKpQuestions(k) > 0)
    .sort((a, b) => a.order - b.order);
  if (pool.length === 0) {
    showToast('🔒 本单元属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关');
    return;
  }

  STATE.quiz.isOpen = true;
  STATE.quiz.studyStyle = studyStyle || 'quest';
  STATE.quiz.semester = semester === 'ALL' ? (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus) : semester;
  STATE.quiz.subject = subjName;
  STATE.quiz.sourceContext = { type: 'CHAPTER', subject: subjName, semester: STATE.quiz.semester, chapter: chapterTitle };
  // 每次从本单元题库池随机抽取 6～8 道题，支持一键换新题
  STATE.quiz.queue = (studyStyle === 'quest' || !studyStyle)
    ? sampleRandomQuestionsFromKps(pool, 6, 8)
    : pool.slice(0, 8);
  STATE.quiz.currentIndex = 0;
  STATE.quiz.qVariant = 'main';
  STATE.quiz.hintsShown = { h1: false, h2: false, h3: false };
  STATE.quiz.answerRevealed = false;
  STATE.quiz.flashcardFlipped = false;
  STATE.quiz.unlockedBlockStep = 1;
  STATE.quiz.selectedChoiceIdx = null;
  STATE.quiz.choiceSubmitted = false;
  STATE.quiz.choiceIsCorrect = null;
  STATE.quiz.questionElapsedSec = 0;
  STATE.quiz.totalElapsedSec = 0;
  STATE.quiz.results = [];
  STATE.quiz.finished = false;
  initMatchGameFromQueue();

  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
}

function setSubjectVisualMode(mode) {
  playCommercialSound('tab');
  STATE.subjectVisualMode = mode;
  renderMacroView();
}

function selectSpecialCamp(campId) {
  playCommercialSound('click');
  STATE.activeSpecialTopicId = campId;
  STATE.specialStep = 1;
  renderMacroView();
}

function setSpecialCampStep(stepNum) {
  playCommercialSound('click');
  STATE.specialStep = stepNum;
  renderMacroView();
}

function launchSpecialCampPractice(campId) {
  if (!STATE.data) return;
  const curSem = STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus;
  const curSubjName = STATE.homeSelectedSubject || '数学';
  const subjSemKps = STATE.data.knowledgePoints
    .filter(k => k.subject === curSubjName && k.semester === curSem)
    .sort((a, b) => a.order - b.order);
  const camps = getSpecialCampsForSubject(curSubjName, curSem, subjSemKps);
  const camp = camps.find(c => c.id === campId) || camps[0];
  if (!camp) return;

  STATE.activeSpecialTopicId = camp.id;
  STATE.specialStep = 2;

  if (camp.type === 'DICTATION') {
    openDictationModal(curSubjName);
    return;
  }

  playCommercialSound('open');
  STATE.quiz.isOpen = true;
  STATE.quiz.studyStyle = 'quest';
  STATE.quiz.semester = curSem;
  STATE.quiz.subject = curSubjName;
  STATE.quiz.sourceContext = { type: 'SPECIAL', campId: camp.id, pool: camp.pool };
  STATE.quiz.queue = sampleRandomQuestionsFromKps(camp.pool, 6, 8);
  STATE.quiz.currentIndex = 0;
  STATE.quiz.qVariant = 'main';
  STATE.quiz.hintsShown = { h1: false, h2: false, h3: false };
  STATE.quiz.answerRevealed = false;
  STATE.quiz.flashcardFlipped = false;
  STATE.quiz.unlockedBlockStep = 1;
  STATE.quiz.selectedChoiceIdx = null;
  STATE.quiz.choiceSubmitted = false;
  STATE.quiz.choiceIsCorrect = null;
  STATE.quiz.questionElapsedSec = 0;
  STATE.quiz.totalElapsedSec = 0;
  STATE.quiz.results = [];
  STATE.quiz.finished = false;
  initMatchGameFromQueue();

  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
}

function getSpecialCampStats(campId) {
  try {
    const raw = JSON.parse(localStorage.getItem('RUOTING_SPECIAL_CAMP_STATS_V1') || '{}');
    const rec = raw[campId] || { rounds: 0, bestAcc: 0, lastAcc: 0 };
    let tierLabel = '⚪ 未定级（完成首轮挑战点亮）';
    let tierIcon = '🛡️';
    let nextHint = '完成 1 轮闭环练习即可晋升【🥉青铜段位】';
    if (rec.rounds >= 3 && rec.bestAcc >= 90) {
      tierLabel = '👑 王者满贯段位';
      tierIcon = '👑';
      nextHint = '已登顶最高王者段位！可随时换新题保持手感';
    } else if (rec.rounds >= 2 && rec.bestAcc >= 80) {
      tierLabel = '🥇 黄金精锐段位';
      tierIcon = '🥇';
      nextHint = '再完成 1 轮且最高正确率达 90%+ 即可晋升【👑王者段位】';
    } else if (rec.rounds >= 1 && rec.bestAcc >= 60) {
      tierLabel = '🥈 白银进阶段位';
      tierIcon = '🥈';
      nextHint = '累计完成 2 轮且最高正确率达 80%+ 即可晋升【🥇黄金段位】';
    } else if (rec.rounds >= 1) {
      tierLabel = '🥉 青铜挑战段位';
      tierIcon = '🥉';
      nextHint = '单轮正确率达到 60%+ 即可晋升【🥈白银段位】';
    }
    return {
      rounds: rec.rounds || 0,
      bestAcc: rec.bestAcc || 0,
      lastAcc: rec.lastAcc || 0,
      tierLabel,
      tierIcon,
      nextHint
    };
  } catch (e) {
    return { rounds: 0, bestAcc: 0, lastAcc: 0, tierLabel: '⚪ 未定级', tierIcon: '🛡️', nextHint: '' };
  }
}

function recordSpecialCampCompletion(campId, accPct) {
  if (!campId) return;
  try {
    const raw = JSON.parse(localStorage.getItem('RUOTING_SPECIAL_CAMP_STATS_V1') || '{}');
    const prev = raw[campId] || { rounds: 0, bestAcc: 0, lastAcc: 0 };
    const cleanAcc = Math.max(0, Math.min(100, Math.round(Number(accPct) || 0)));
    raw[campId] = {
      rounds: (prev.rounds || 0) + 1,
      bestAcc: Math.max(prev.bestAcc || 0, cleanAcc),
      lastAcc: cleanAcc,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    localStorage.setItem('RUOTING_SPECIAL_CAMP_STATS_V1', JSON.stringify(raw));
  } catch (e) {}
}

function renderSchoolProgressBannerHtml(curSubjName, curSem, subjSemKps) {
  const total = Math.max(1, subjSemKps.length);
  if (curSem !== '初一上') {
    const masteredCnt = subjSemKps.filter(k => (k.status || '').includes('已吃透')).length;
    const reviewCnt = subjSemKps.filter(k => (k.status || '').includes('复习中') || (k.status || '').includes('未掌握')).length;
    const waitCnt = Math.max(0, total - masteredCnt - reviewCnt);
    const totalQs = countTotalQuestionsForKps(subjSemKps);
    const masteryPct = Math.round(((masteredCnt + reviewCnt * 0.5) / total) * 100);
    return `
      <div class="school-progress-sync-bar">
        <div class="school-progress-left">
          <div class="school-progress-meta-row">
            <span class="badge" style="background:#eff6ff;color:#2563eb;font-weight:900;">📚 全册同步精练</span>
            <strong class="school-progress-week-title">${curSem}·《${curSubjName}》全册题库已100%开放（共 ${total} 课 / ${totalQs} 道精校真题）</strong>
            <span class="school-progress-counts">
              🟢已吃透 <strong>${masteredCnt}</strong> · 🎯巩固中 <strong>${reviewCnt}</strong> · 📘可闯关 <strong>${waitCnt}</strong>
            </span>
          </div>
          <div class="school-progress-track">
            <div class="school-progress-fill" style="width:${ Math.max(8, masteryPct) }%;"></div>
          </div>
        </div>
        <div class="school-progress-right">
          <button class="duo-btn primary school-dictation-btn" onclick="openDictationModal('${curSubjName}')">
            🎧 <span>${curSubjName}听写</span>
          </button>
        </div>
      </div>
    `;
  }

  const week = Number(STATE.schoolCurrentWeek || 8);
  const taughtCount = subjSemKps.filter(k => getSchoolTeachingProgress(k, subjSemKps).code === 'TAUGHT').length;
  const currentCount = subjSemKps.filter(k => getSchoolTeachingProgress(k, subjSemKps).code === 'CURRENT').length;
  const upcomingCount = subjSemKps.filter(k => getSchoolTeachingProgress(k, subjSemKps).code === 'UPCOMING').length;
  const taughtPct = Math.round(((taughtCount + currentCount) / total) * 100);

  return `
    <div class="school-progress-sync-bar">
      <div class="school-progress-left">
        <div class="school-progress-meta-row">
          <span class="badge" style="background:#dcfce7;color:#15803d;font-weight:900;">🏫 教学进度同步</span>
          <strong class="school-progress-week-title">第 ${week} 教学周（${week <= 5 ? '月考夯实期' : week <= 10 ? '期中冲刺期' : week <= 15 ? '下半期推进' : '期末总复习'}）</strong>
          <span class="school-progress-counts">
            ✅已授 <strong>${taughtCount}</strong> · 🚩同步 <strong>${currentCount}</strong> · ⏳待讲 <strong>${upcomingCount}</strong>
          </span>
        </div>
        <div class="school-progress-track">
          <div class="school-progress-fill" style="width:${taughtPct}%;"></div>
        </div>
      </div>
      <div class="school-progress-right">
        <label class="school-week-select-wrap">
          <span class="hide-xs">校历周次:</span>
          <select class="sem-quick-select school-week-select" onchange="setSchoolCurrentWeek(this.value)">
            <option value="4" ${week === 4 ? 'selected' : ''}>第4周 (第一次月考)</option>
            <option value="8" ${week === 8 ? 'selected' : ''}>第8~9周 (期中前夕)</option>
            <option value="12" ${week === 12 ? 'selected' : ''}>第12周 (期中后推进)</option>
            <option value="16" ${week === 16 ? 'selected' : ''}>第16周 (期末总复习)</option>
            <option value="18" ${week === 18 ? 'selected' : ''}>第18周 (全册结课)</option>
          </select>
        </label>
        <button class="duo-btn primary school-dictation-btn" onclick="openDictationModal('${curSubjName}')">
          🎧 <span>${curSubjName}听写</span>
        </button>
      </div>
    </div>
  `;
}

// 视图 1：🗺️ 糖果蜿蜒闯关大地图 (Candy Saga Level Map + 单元 Boss 关)
function renderCandySagaMapHtml(curSubjName, curSem, chapters, subjSemKps, subjTheme) {
  let globalNodeIdx = 0;
  const islandsHtml = chapters.map((ch, cIdx) => {
    const done = ch.items.filter(k => k.status.includes('已吃透')).length;
    const review = ch.items.filter(k => k.status.includes('复习中')).length;
    const weak = ch.items.filter(k => k.status.includes('未掌握')).length;
    const pct = Math.round(((done + review * 0.4) / Math.max(1, ch.items.length)) * 100);
    const safeChTitle = ch.chapter.replace(/'/g, "\\'");
    const safeChKey = ch.key.replace(/'/g, "\\'");

    const nodesHtml = ch.items.map((k, kIdx) => {
      globalNodeIdx += 1;
      const isMastered = k.status.includes('已吃透');
      const isReview = k.status.includes('复习中');
      const isWeak = k.status.includes('未掌握');
      const prog = getSchoolTeachingProgress(k, subjSemKps);
      const isUpcoming = prog.code === 'UPCOMING' && k.status.includes('待考察');
      const offsetPattern = ['saga-pos-center', 'saga-pos-right', 'saga-pos-center', 'saga-pos-left'];
      const posCls = offsetPattern[kIdx % offsetPattern.length];
      const stateCls = isMastered
        ? 'node-mastered'
        : isWeak
        ? 'node-weak'
        : isReview
        ? 'node-review'
        : isUpcoming
        ? 'node-upcoming'
        : 'node-active';
      const starsCount = isMastered ? 3 : isReview ? 2 : isWeak ? 1 : 0;
      const starsStr = '⭐'.repeat(starsCount) + '☆'.repeat(3 - starsCount);
      const shortTitle = k.corePoint.replace(/^.*[:：·]\s*/, '');

      return `
        <div class="saga-node-row ${posCls}">
          <div class="saga-node-wrapper ${stateCls}">
            ${isWeak ? `<div class="saga-floating-tag weak-tag">🔥 错题待破</div>` : ''}
            ${prog.code === 'CURRENT' && !isWeak ? `<div class="saga-floating-tag sync-tag">🚩 本周同步</div>` : ''}
            <button class="saga-disc-btn ${stateCls}" onclick="openSingleKpQuizModal('${k.id}', 'quest')" title="点击连闯本课 6～8 道随机题">
              <span class="saga-disc-num">第${globalNodeIdx}关</span>
              <span class="saga-disc-icon">
                ${isMastered ? '👑' : isWeak ? '🎯' : isReview ? '⚡' : isUpcoming ? '🔒' : '🍭'}
              </span>
              <span class="saga-disc-stars">${starsStr}</span>
            </button>
            <div class="saga-node-card">
              <div class="saga-node-title" onclick="openSingleKpQuizModal('${k.id}', 'quest')">
                <span>${escapeHtml(shortTitle)}</span>
              </div>
              <div class="saga-node-meta">
                <span class="badge" style="background:${prog.bg};color:${prog.color};font-size:11.5px;padding:2px 7px;">${prog.shortLabel}</span>
                ${getDiffBadge(k.difficulty)}
                <span style="font-size:11.5px;color:#64748b;">题池${countKpQuestions(k)}题</span>
              </div>
              <div class="saga-node-actions">
                ${(k.isUnverified || (k.status || '').includes('🔒待精校') || countKpQuestions(k) === 0)
                  ? `<button class="zen-btn-ghost" style="padding:4px 10px;font-size:12px;opacity:0.65;cursor:not-allowed;" onclick="showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关')">🔒 <span>待精校</span></button>`
                  : `<button class="zen-btn-start" style="padding:4px 10px;font-size:12px;" onclick="openSingleKpQuizModal('${k.id}', 'quest')">⚡ <span>闯关(6~8题)</span></button>`}
                <button class="zen-btn-ghost" style="padding:4px 9px;font-size:12px;" onclick="openMicroDrawer('${k.id}')">
                  📖 <span>讲义</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="saga-island-container">
        <div class="saga-island-header" style="background:${subjTheme.cardBg || '#fff'};border-color:${subjTheme.border};">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span class="saga-island-badge" style="background:${subjTheme.accent};color:#fff;">🗺️ 第 ${cIdx + 1} 章节岛屿</span>
            <h3 style="font-size:19px;font-weight:900;color:#0f172a;margin:0;">${escapeHtml(ch.chapter)}</h3>
            ${renderStarRatingHtml(pct)}
            <span style="font-size:13.5px;color:#475569;font-weight:700;">已通 ${done}/${ch.items.length} 关</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="duo-btn indigo" onclick="drillSelectChapter('${safeChKey}', 'ARCHETYPE')">
              📐 <span>本单元解题模板 (长什么样·怎么下笔)</span>
            </button>
            <button class="zen-btn-ghost" onclick="drillSelectChapter('${safeChKey}', 'LIST')">
              📋 <span>每课列表</span>
            </button>
            <button class="zen-btn-ghost" style="border-color:#6366f1;color:#4f46e5;font-weight:800;" onclick="openUnitPaperGenerator('${curSubjName}', '${ch.semester}', '${safeChTitle}')">
              🖨️ <span>本单元出卷/打印</span>
            </button>
            <button class="duo-btn primary" onclick="openChapterQuizModal('${curSubjName}', '${ch.semester}', '${safeChTitle}', 'quest')">
              👹 <span>挑战本岛 Boss (随机8题)</span>
            </button>
          </div>
        </div>

        <div class="saga-trail-body">
          ${nodesHtml}
          <div class="saga-node-row saga-pos-center">
            <div class="saga-boss-card" onclick="openChapterQuizModal('${curSubjName}', '${ch.semester}', '${safeChTitle}', 'quest')">
              <div class="saga-boss-avatar">${done === ch.items.length ? '🏆' : '👹'}</div>
              <div>
                <div style="font-size:16px;font-weight:900;color:#831843;">
                  第 ${cIdx + 1} 单元 Boss 综合大闯关 · ${escapeHtml(ch.chapter)}
                </div>
                <div style="font-size:13px;color:#64748b;margin-top:3px;">
                  从本单元 ${countTotalQuestionsForKps(ch.items)} 道题库池中随机抽取 6～8 道综合题，击败 Boss 赢取满星王冠！
                </div>
              </div>
              <button class="duo-btn primary" style="flex-shrink:0;">⚡ 迎战 Boss</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="saga-world-wrap">${islandsHtml}</div>`;
}

// 视图 2：🌳 RPG 学科知识技能树 (RPG Knowledge Skill Tree)
function renderRpgSkillTreeHtml(curSubjName, curSem, chapters, subjSemKps, subjTheme) {
  const masteredTotal = subjSemKps.filter(k => k.status.includes('已吃透')).length;
  const reviewTotal = subjSemKps.filter(k => k.status.includes('复习中')).length;
  const weakTotal = subjSemKps.filter(k => k.status.includes('未掌握')).length;
  const skillPoints = masteredTotal * 3 + reviewTotal * 2 + weakTotal * 1;
  const maxSkillPoints = Math.max(1, subjSemKps.length * 3);
  const treeLevel = Math.max(1, Math.min(10, Math.ceil((skillPoints / maxSkillPoints) * 10)));
  const rankTitles = ['初心学徒', '见习冒险家', '青铜破阵手', '白银解题师', '黄金大学霸', '铂金智多星', '钻石领航员', '星耀大宗师', '传奇状元郎', '满贯至尊王'];
  const curRank = rankTitles[Math.min(rankTitles.length - 1, treeLevel - 1)];

  const branchesHtml = chapters.map((ch, cIdx) => {
    const done = ch.items.filter(k => k.status.includes('已吃透')).length;
    const review = ch.items.filter(k => k.status.includes('复习中')).length;
    const branchPct = Math.round(((done + review * 0.5) / Math.max(1, ch.items.length)) * 100);
    const safeChTitle = ch.chapter.replace(/'/g, "\\'");

    const skillNodesHtml = ch.items.map((k, kIdx) => {
      const isMastered = k.status.includes('已吃透');
      const isReview = k.status.includes('复习中');
      const isWeak = k.status.includes('未掌握');
      const prog = getSchoolTeachingProgress(k, subjSemKps);
      const tier = getDepthTier(k.difficulty);
      const nodeCls = isMastered ? 'skill-node-max' : isWeak ? 'skill-node-weak' : isReview ? 'skill-node-mid' : 'skill-node-locked';
      const lvLabel = isMastered ? 'Lv.MAX 👑已点亮' : isReview ? 'Lv.2 ⭐进阶中' : isWeak ? 'Lv.1 🔥急需加点' : 'Lv.0 🔓待点亮';
      const shortMnemonic = (k.mnemonic || k.understanding || '点击修炼本项学科核心技能').slice(0, 48);

      return `
        <div class="rpg-skill-node ${nodeCls}">
          <div class="rpg-skill-node-top">
            <span class="rpg-skill-lv-badge">${lvLabel}</span>
            <span class="badge" style="background:${prog.bg};color:${prog.color};font-size:11px;">${prog.shortLabel}</span>
          </div>
          <div class="rpg-skill-node-title" onclick="openSingleKpQuizModal('${k.id}', 'quest')">
            <span>#${kIdx + 1} ${escapeHtml(k.corePoint)}</span>
          </div>
          <div class="rpg-skill-node-desc">
            💡 ${escapeHtml(shortMnemonic)}${shortMnemonic.length >= 48 ? '…' : ''}
          </div>
          <div class="rpg-skill-node-bar">
            <div class="rpg-skill-node-fill" style="width:${isMastered ? 100 : isReview ? 65 : isWeak ? 35 : 8}%;"></div>
          </div>
          <div class="rpg-skill-node-foot">
            <span style="font-size:11.5px;color:#64748b;font-weight:700;">${'⭐'.repeat(tier)} 深度T${tier}</span>
            <div style="display:flex;gap:6px;">
              <button class="zen-btn-ghost" style="padding:3px 8px;font-size:11.5px;" onclick="openMicroDrawer('${k.id}')">秘籍</button>
              ${(k.isUnverified || (k.status || '').includes('🔒待精校') || countKpQuestions(k) === 0)
                ? `<button class="zen-btn-ghost" style="padding:3px 9px;font-size:11.5px;opacity:0.65;cursor:not-allowed;" onclick="showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关')">🔒 待精校</button>`
                : `<button class="zen-btn-start" style="padding:3px 9px;font-size:11.5px;" onclick="openSingleKpQuizModal('${k.id}', 'quest')">${isMastered ? '重温' : '⚡升级技能'}</button>`}
            </div>
          </div>
        </div>
      `;
    }).join('<div class="rpg-skill-connector">➔</div>');

    return `
      <div class="rpg-tree-branch">
        <div class="rpg-branch-head">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="rpg-branch-icon" style="background:${subjTheme.accent};">🌳 分支 ${cIdx + 1}</span>
            <strong style="font-size:18px;color:#0f172a;">${escapeHtml(ch.chapter)}</strong>
            <span class="badge status-gray">点亮率 ${branchPct}% (${done}/${ch.items.length})</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="zen-btn-ghost" style="border-color:#6366f1;color:#4f46e5;font-weight:800;" onclick="openUnitPaperGenerator('${curSubjName}', '${ch.semester}', '${safeChTitle}')">
              🖨️ <span>本单元出卷/打印</span>
            </button>
            <button class="zen-btn-ghost" onclick="openChapterQuizModal('${curSubjName}', '${ch.semester}', '${safeChTitle}', 'quest')">
              ⚡ <span>本分支综合试炼 (6~8题)</span>
            </button>
          </div>
        </div>
        <div class="rpg-branch-nodes-scroll">
          ${skillNodesHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="rpg-tree-container">
      <div class="rpg-tree-hero-card">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <div class="rpg-rank-emblem">🛡️ Lv.${treeLevel}</div>
          <div>
            <div style="font-size:19px;font-weight:900;color:#1e1b4b;">
              ${curSubjName}（${curSem}）学科知识技能树 · 【${curRank}】
            </div>
            <div style="font-size:13.5px;color:#475569;margin-top:4px;">
              累计点亮技能点 <strong>${skillPoints} / ${maxSkillPoints} SP</strong> · 👑满级技能 <strong>${masteredTotal}</strong> 个 · ⭐修炼中 <strong>${reviewTotal}</strong> 个 · 🔥待加点突破 <strong>${weakTotal}</strong> 个
            </div>
          </div>
        </div>
        <div style="min-width:200px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;color:#4f46e5;margin-bottom:4px;">
            <span>技能树总觉醒度</span>
            <span>${Math.round((skillPoints / maxSkillPoints) * 100)}%</span>
          </div>
          <div style="height:10px;background:#e0e7ff;border-radius:999px;overflow:hidden;">
            <div style="width:${Math.round((skillPoints / maxSkillPoints) * 100)}%;height:100%;background:linear-gradient(90deg,#6366f1,#ec4899);"></div>
          </div>
        </div>
      </div>
      ${branchesHtml}
    </div>
  `;
}

// 视图 3：🎯 学科专项学练闭环 (3-Step Closed Loop: 看大招 ➔ 刷6~8题/听写 ➔ 段位勋章)
function renderSubjectSpecialCampsHtml(curSubjName, curSem, subjSemKps, subjTheme) {
  const camps = getSpecialCampsForSubject(curSubjName, curSem, subjSemKps);
  const activeCamp = camps.find(c => c.id === STATE.activeSpecialTopicId) || camps[0];
  const step = STATE.specialStep || 1;
  const rulesSpeakAttr = safeSpeakAttr(`${activeCamp.title}。${activeCamp.step1Rules.join('。')}`);
  const campStats = getSpecialCampStats(activeCamp.id);

  const campCardsHtml = camps.map(c => {
    const isSelected = c.id === activeCamp.id;
    const st = getSpecialCampStats(c.id);
    return `
      <div class="special-camp-card ${isSelected ? 'is-selected' : ''}" onclick="selectSpecialCamp('${c.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <span class="badge" style="background:${c.badgeBg};color:${c.badgeColor};font-weight:900;">${c.badge}</span>
          <span style="font-size:12px;font-weight:800;color:${c.badgeColor};">${st.tierIcon} ${st.rounds > 0 ? `已练${st.rounds}轮 (${st.bestAcc}%)` : (isSelected ? '● 当前选中' : '点击挑战 ➔')}</span>
        </div>
        <div style="font-size:17px;font-weight:900;color:#0f172a;margin-bottom:6px;">${escapeHtml(c.title)}</div>
        <div style="font-size:13px;color:#475569;line-height:1.5;">${escapeHtml(c.subtitle)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="special-training-wrap">
      <div class="special-camp-grid">
        ${campCardsHtml}
      </div>

      <div class="special-closed-loop-box">
        <div class="special-loop-header">
          <div>
            <span class="badge" style="background:${activeCamp.badgeBg};color:${activeCamp.badgeColor};margin-bottom:6px;">🎯 三步闭环专项特训</span>
            <h2 style="font-size:21px;font-weight:900;color:#0f172a;margin:0;">${escapeHtml(activeCamp.title)}</h2>
          </div>
          <div class="special-step-pills">
            <button class="special-step-pill ${step === 1 ? 'active' : 'done'}" onclick="setSpecialCampStep(1)">① 看大招口诀卡</button>
            <span>➔</span>
            <button class="special-step-pill ${step === 2 ? 'active' : ''}" onclick="launchSpecialCampPractice('${activeCamp.id}')">
              ② ${activeCamp.type === 'DICTATION' ? '🎧 互动听写(6~8词)' : '⚡ 随机刷6~8题'}
            </button>
            <span>➔</span>
            <button class="special-step-pill ${step === 3 ? 'active' : ''}" onclick="setSpecialCampStep(3)">③ 点亮段位勋章 (${campStats.tierIcon})</button>
          </div>
        </div>

        ${step === 3 ? `
          <div class="special-medal-stage">
            <div style="font-size:52px;margin-bottom:8px;">${campStats.tierIcon}</div>
            <div style="font-size:22px;font-weight:900;color:#831843;">专项段位勋章：【${escapeHtml(activeCamp.medalName)} · ${campStats.tierLabel}】</div>
            <div style="display:inline-flex;gap:14px;flex-wrap:wrap;justify-content:center;background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:12px;padding:10px 18px;margin:12px auto;">
              <span style="font-size:14px;color:#831843;font-weight:800;">✅ 累计通关轮次：<strong>${campStats.rounds} 轮</strong></span>
              <span style="font-size:14px;color:#831843;font-weight:800;">🎯 历史最高正确率：<strong>${campStats.bestAcc}%</strong></span>
              <span style="font-size:14px;color:#831843;font-weight:800;">📊 最近一轮正确率：<strong>${campStats.lastAcc}%</strong></span>
            </div>
            <p style="font-size:14.5px;color:#475569;max-width:560px;margin:8px auto 18px;">
              ${escapeHtml(campStats.nextHint)}
            </p>
            <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
              <button class="duo-btn primary" onclick="launchSpecialCampPractice('${activeCamp.id}')">
                🔄 <span>随机换一批新题冲刺升段 (6~8题)</span>
              </button>
              <button class="zen-btn-ghost" onclick="setSpecialCampStep(1)">返回看大招口诀卡</button>
            </div>
          </div>
        ` : `
          <div class="special-step1-stage">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <strong style="font-size:16.5px;color:#1e1b4b;display:inline-flex;align-items:center;gap:6px;">
                ⚡ 第一步：先花 1 分钟掌握【${escapeHtml(activeCamp.step1Title)}】
              </strong>
              <button class="zen-btn-ghost" onclick="speakText('${rulesSpeakAttr}', '专项大招口诀')">
                ${uiIcon('volume-on', 15)} <span>语音朗读大招</span>
              </button>
            </div>
            <div class="special-rules-list">
              ${activeCamp.step1Rules.map(rule => `
                <div class="special-rule-item">
                  <span>✨</span>
                  <div>${escapeHtml(rule)}</div>
                </div>
              `).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:16px;border-top:1.5px dashed #fbcfe8;flex-wrap:wrap;gap:12px;">
              <div style="font-size:13.5px;color:#64748b;font-weight:700;">
                💡 已熟读上方大招？点击右侧按钮立即进入第二步实战（每次随机抽取 6～8 题，支持无限换新题）！
              </div>
              <button class="duo-btn primary" style="padding:12px 24px;font-size:16px;" onclick="launchSpecialCampPractice('${activeCamp.id}')">
                ${activeCamp.type === 'DICTATION'
                  ? `🎧 <span>进入第二步：开始互动听写 (随机6~8词)</span>`
                  : `⚡ <span>进入第二步：开始专项刷题 (随机6~8题)</span>`}
              </button>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderMacroView() {
  const container = document.getElementById('view-macro');
  if (!container || !STATE.data) return;
  loadDailyStats();
  renderHudStatusCapsules();

  const allKps = STATE.data.knowledgePoints;
  const level = STATE.drillLevel || 'SUBJECT';
  const curSem = STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus;
  const curSubjName = STATE.homeSelectedSubject || '数学';
  const curSubjObj = STATE.data.subjects.find(s => s.name === curSubjName) || STATE.data.subjects[0];
  const subjTheme = getSubjectTheme(curSubjName);

  // 构建当前学期+科目的章节数组
  let subjSemKps = allKps
    .filter(k => k.subject === curSubjName && k.semester === curSem)
    .sort((a, b) => a.order - b.order);
  if (subjSemKps.length === 0) {
    subjSemKps = allKps.filter(k => k.subject === curSubjName).sort((a, b) => a.order - b.order);
  }

  const chapters = [];
  subjSemKps.forEach(k => {
    const chKey = `${k.semester}__${k.chapter}`;
    let ch = chapters.find(x => x.key === chKey);
    if (!ch) {
      ch = { key: chKey, semester: k.semester, chapter: k.chapter, items: [] };
      chapters.push(ch);
    }
    ch.items.push(k);
  });

  // =========================================================================
  // 低频切换层：当用户主动点击「切换学期」时展示「8 个精准学期卡片」
  // =========================================================================
  if (level === 'SEMESTER') {
    const eightSemesters = STAGE_OPTIONS.filter(o => o.code !== 'ALL');
    const semCardsHtml = eightSemesters.map(opt => {
      const cth = getSemesterCartoonTheme(opt.code);
      const isSelected = curSem === opt.code;
      const activeSubjs = getActiveSubjectNamesForStage(opt.code);
      const semKps = allKps.filter(k => k.semester === opt.code && activeSubjs.includes(k.subject));
      const semTotalQs = countTotalQuestionsForKps(semKps);
      const mastered = semKps.filter(k => k.status.includes('已吃透')).length;
      const review = semKps.filter(k => k.status.includes('复习中')).length;
      const weak = semKps.filter(k => k.status.includes('未掌握')).length;
      const pct = semKps.length > 0 ? Math.round(((mastered + review * 0.4) / semKps.length) * 100) : 0;

      return `
        <button class="drill-big-card cartoon-card ${isSelected ? 'is-current-sem' : ''}"
          style="background:${cth.bg};border-color:${cth.border};box-shadow:0 7px 0 ${cth.lip}, 0 10px 20px rgba(0,0,0,0.04);"
          onclick="drillSelectSemester('${opt.code}')">
          <div class="drill-card-top">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="drill-card-badge" style="background:${cth.badgeBg};color:${cth.badgeCol};">
                ${isSelected ? `${uiIcon('check-circle', 14)} 当前锁定` : opt.shortLabel.replace(opt.pillLabel, '').replace(/[()]/g, '')}
              </span>
              ${renderStarRatingHtml(pct)}
            </div>
            <span class="drill-card-arrow" style="color:${cth.badgeCol};"><span>进入</span> ${uiIcon('arrow-right', 16)}</span>
          </div>

          <div class="drill-card-mid-row">
            <div>
              <div class="drill-card-title">${uiIcon('calendar', 21)} <span>${opt.pillLabel}</span></div>
              <div class="drill-card-sub" style="margin-top:5px;">
                <strong>${activeSubjs.length}科</strong>：${activeSubjs.join(' · ')}
              </div>
            </div>
            ${renderMiniRingSvg(pct, cth.badgeCol, 56)}
          </div>

          <div class="drill-card-footer">
            <span><strong>${semKps.length}</strong> 课 · <strong>${semTotalQs}</strong> 题 · 已通 <strong>${mastered}</strong></span>
            ${weak > 0
              ? `<span class="drill-weak-pill">${uiIcon('target', 14)} ${weak} 待突破</span>`
              : `<span class="drill-ok-pill">${uiIcon('sparkle', 14)} 可学习</span>`}
          </div>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="zen-home-wrap drill-stage-animate">
        <div class="drill-nav-header">
          <div class="drill-nav-left">
            <button class="drill-back-btn" onclick="goToDrillLevel('SUBJECT')">
              ${uiIcon('arrow-left', 16)} <span>返回科目</span>
            </button>
            <div>
              <div class="drill-step-indicator">${uiIcon('calendar', 14)} <span>切换后将自动记住，无需每次重选</span></div>
              <h1 class="drill-page-title">切换所在学期</h1>
            </div>
          </div>
        </div>

        <div class="drill-grid-2col">
          ${semCardsHtml}
        </div>
      </div>
    `;
    return;
  }

  // =========================================================================
  // 默认首页（第 1 级）：直接显示当前记住学期的「科目大卡片」（无需每次选学期）
  // =========================================================================
  if (level === 'SUBJECT') {
    const dueCount = getEbbinghausDuePoints().length;
    const activeSubjNames = getActiveSubjectNamesForStage(curSem);
    const activeSubjects = STATE.data.subjects.filter(s => activeSubjNames.includes(s.name));
    const otherSubjects = STATE.data.subjects.filter(s => !activeSubjNames.includes(s.name));
    const eightSemesters = STAGE_OPTIONS.filter(o => o.code !== 'ALL');

    const semSelectOptionsHtml = eightSemesters.map(opt => `
      <option value="${opt.code}" ${opt.code === curSem ? 'selected' : ''}>${opt.isCurrent ? opt.pillLabel + ' (在读)' : opt.pillLabel}</option>
    `).join('');

    const subjCardsHtml = activeSubjects.map(subj => {
      const th = getSubjectTheme(subj.name);
      const sKps = allKps.filter(k => k.subject === subj.name && k.semester === curSem);
      const chSet = new Set(sKps.map(k => k.chapter));
      const totalQs = countTotalQuestionsForKps(sKps);
      const mastered = sKps.filter(k => k.status.includes('已吃透')).length;
      const review = sKps.filter(k => k.status.includes('复习中')).length;
      const weak = sKps.filter(k => k.status.includes('未掌握')).length;
      const tot = sKps.length || 1;
      const pct = Math.round(((mastered + review * 0.4) / tot) * 100);

      return `
        <button class="drill-big-card cartoon-card"
          style="background:${th.cardBg || '#fff'};border-color:${th.border};box-shadow:0 7px 0 ${th.lip || th.border}, 0 10px 20px rgba(0,0,0,0.04);"
          onclick="drillSelectSubject('${subj.name}')">
          <div class="drill-card-top">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="drill-subj-icon-box" style="background:#fff;border-color:${th.border};">${subjIconSvg(subj.name, 24)}</span>
              <span class="drill-card-badge" style="background:${th.tagBg};color:${th.accent};">${th.label}</span>
            </div>
            <span class="drill-card-arrow" style="color:${th.accent};">${uiIcon('arrow-right', 18)}</span>
          </div>

          <div class="drill-card-mid-row">
            <div>
              <div class="drill-card-title">${subj.name}</div>
              <div class="drill-card-sub" style="margin-top:4px;">
                <strong>${chSet.size}</strong> 单元 · <strong>${sKps.length}</strong> 课 · <strong>${totalQs}</strong> 题
              </div>
            </div>
            ${renderMiniRingSvg(pct, th.accent, 56)}
          </div>

          <div class="drill-card-footer">
            <span style="display:flex;align-items:center;gap:8px;">
              ${renderStarRatingHtml(pct)}
              <span><strong>${mastered}/${sKps.length}</strong> 课</span>
            </span>
            ${weak > 0
              ? `<span class="drill-weak-pill">${uiIcon('target', 13)} ${weak} 待突破</span>`
              : `<span class="drill-ok-pill">${uiIcon('check', 13)} 良好</span>`}
          </div>
        </button>
      `;
    }).join('');

    const otherSubjHtml = otherSubjects.length > 0 ? `
      <div class="drill-future-bar">
        <span>未开课科目（点击可预习）：</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${otherSubjects.map(s => {
            const st = getSubjectGradeStatus(s.name, curSem);
            return `<button class="zen-btn-ghost" onclick="drillSelectSubject('${s.name}')">${subjIconSvg(s.name, 16)} <span>${s.name} (${st.tag})</span></button>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="zen-home-wrap drill-stage-animate">
        <div class="drill-nav-header is-subject-home">
          <div class="drill-home-top-bar">
            <div class="drill-nav-title-group">
              <h1 class="drill-page-title">${uiIcon('layers', 20)} <span>选择科目</span></h1>
              <span class="drill-step-pill current">${activeSubjects.length} 门在读</span>
            </div>
            <div class="drill-home-sem-group">
              <div class="sem-quick-capsule" title="当前学期已自动记住，下拉可切换">
                ${uiIcon('calendar', 14)}
                <select class="sem-quick-select" onchange="drillSelectSemester(this.value)" aria-label="切换当前学期">
                  ${semSelectOptionsHtml}
                </select>
              </div>
              <button class="zen-btn-ghost drill-sem-overview-btn" onclick="goToDrillLevel('SEMESTER')" title="查看全部8个学期卡片">
                ${uiIcon('grid', 14)} <span>8期<em class="hide-xs" style="font-style:normal;">总览</em></span>
              </button>
            </div>
          </div>

          <div class="drill-home-quick-grid cols-3" style="margin-bottom:10px;">
            <button class="drill-quick-action-btn is-rose" style="grid-column:1 / -1;background:linear-gradient(135deg,#ec4899,#6366f1);color:#fff;border:none;padding:12px 18px;font-size:15px;font-weight:900;box-shadow:0 6px 16px rgba(99,102,241,0.28);" onclick="launchDaily25MinRoutine()">
              <span>🎯</span>
              <span class="dqa-text-full">今日 25 分钟放学闭环（①到期错题复盘 ${dueCount}题 ➔ ②初一上同步闯关 ➔ ③错因打卡）· 一键启动</span>
              <span class="dqa-text-short">🎯 25分钟放学闭环 (${dueCount}待复盘)</span>
            </button>
            <button class="drill-quick-action-btn is-emerald" onclick="openSubjectPaperGenerator(STATE.homeSelectedSubject || '数学', '${curSem}')" title="按单元自由勾选组卷·支持A4打印与导出Word">
              <span>🖨️</span>
              <span class="dqa-text-full">按单元组卷·打印</span>
              <span class="dqa-text-short">单元组卷</span>
            </button>
            <button class="drill-quick-action-btn is-indigo" onclick="switchTab('phonics')" title="进入英语自然拼读与48国际音标全息点读舱">
              ${uiIcon('volume-on', 14)}
              <span class="dqa-text-full">🔤 英语自然拼读·48音标舱</span>
              <span class="dqa-text-short">48音标舱</span>
            </button>
            <button class="drill-quick-action-btn is-rose" onclick="openEbbinghausReviewModal()">
              ${uiIcon('clock', 14)}
              <span>到期错题复盘 (${dueCount})</span>
            </button>
          </div>
        </div>

        <div class="drill-grid-3col">
          ${subjCardsHtml}
        </div>

        ${otherSubjHtml}
      </div>
    `;
    return;
  }

  // =========================================================================
  // 第 3 级：只显示当前科目的「全部章节卡片」
  // =========================================================================
  if (level === 'CHAPTER') {
    const subjTotalQs = countTotalQuestionsForKps(subjSemKps);
    const chCardsHtml = chapters.map((ch, idx) => {
      const done = ch.items.filter(k => k.status.includes('已吃透')).length;
      const review = ch.items.filter(k => k.status.includes('复习中')).length;
      const weak = ch.items.filter(k => k.status.includes('未掌握')).length;
      const tot = ch.items.length || 1;
      const chQs = countTotalQuestionsForKps(ch.items);
      const pct = Math.round(((done + review * 0.4) / tot) * 100);
      const safeKey = ch.key.replace(/'/g, "\\'");
      const borderCol = weak > 0 ? '#ff6b8b' : subjTheme.border;
      const lipCol = weak > 0 ? '#e11d48' : (subjTheme.lip || subjTheme.border);

      return `
        <button class="drill-big-card cartoon-card"
          style="background:${subjTheme.cardBg || '#fff'};border-color:${borderCol};box-shadow:0 7px 0 ${lipCol}, 0 10px 20px rgba(0,0,0,0.04);"
          onclick="drillSelectChapter('${safeKey}')">
          <div class="drill-card-top">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="drill-card-badge" style="background:${subjTheme.tagBg};color:${subjTheme.accent};">第 ${idx + 1} 单元</span>
              ${renderStarRatingHtml(pct)}
            </div>
            <span class="drill-card-arrow" style="color:${subjTheme.accent};"><span>${ch.items.length}课 · ${chQs}题</span> ${uiIcon('arrow-right', 17)}</span>
          </div>

          <div class="drill-card-mid-row">
            <div class="drill-card-title" style="font-size:20px;">${escapeHtml(ch.chapter)}</div>
            ${renderMiniRingSvg(pct, weak > 0 ? '#e11d48' : subjTheme.accent, 54)}
          </div>

          <div class="drill-card-footer">
            <span>${uiIcon('crown', 14)} 已掌握 <strong>${done}/${ch.items.length}</strong> 课（共 ${chQs} 题）</span>
            ${weak > 0
              ? `<span class="drill-weak-pill">${uiIcon('target', 13)} ${weak} 待巩固</span>`
              : `<span class="drill-ok-pill">${uiIcon('check', 13)} 良好</span>`}
          </div>
        </button>
      `;
    }).join('');

    const vMode = STATE.subjectVisualMode || 'MAP';
    let mainSubjectStageHtml = '';
    if (vMode === 'MAP') {
      mainSubjectStageHtml = renderCandySagaMapHtml(curSubjName, curSem, chapters, subjSemKps, subjTheme);
    } else if (vMode === 'SKILL_TREE') {
      mainSubjectStageHtml = renderRpgSkillTreeHtml(curSubjName, curSem, chapters, subjSemKps, subjTheme);
    } else if (vMode === 'SPECIAL') {
      mainSubjectStageHtml = renderSubjectSpecialCampsHtml(curSubjName, curSem, subjSemKps, subjTheme);
    } else if (vMode === 'PAPER_GEN' && typeof renderSubjectPaperGeneratorHtml === 'function') {
      mainSubjectStageHtml = renderSubjectPaperGeneratorHtml(curSubjName, curSem);
    } else if (vMode === 'ARCHETYPE' && typeof renderUnitArchetypeMatrixHtml === 'function') {
      mainSubjectStageHtml = renderUnitArchetypeMatrixHtml(curSubjName, curSem, chapters, null);
    } else {
      mainSubjectStageHtml = `<div class="drill-grid-2col">${chCardsHtml}</div>`;
    }

    container.innerHTML = `
      <div class="zen-home-wrap drill-stage-animate">
        <div class="drill-nav-header">
          <div class="drill-nav-left">
            <button class="drill-back-btn" onclick="goToDrillLevel('SUBJECT')" title="返回选科目">
              ${uiIcon('arrow-left', 16)} <span>返回</span>
            </button>
            <div class="drill-stepper">
              <span class="drill-step-pill done" onclick="goToDrillLevel('SEMESTER')">${curSem}</span>
              <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
              <span class="drill-step-pill done" onclick="goToDrillLevel('SUBJECT')">${curSubjName}</span>
              <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
              <span class="drill-step-pill current">选单元 (${chapters.length})</span>
            </div>
          </div>
          <div class="drill-nav-right-stack">
            <div class="comm-segmented-bar cols-3">
              <button class="comm-seg-btn ${vMode === 'MAP' ? 'active' : ''}" onclick="setSubjectVisualMode('MAP')">
                🗺️ <span>闯关地图</span>
              </button>
              <button class="comm-seg-btn ${vMode === 'ARCHETYPE' ? 'active' : ''}" onclick="setSubjectVisualMode('ARCHETYPE')">
                📐 <span>单元解题模板</span>
              </button>
              <button class="comm-seg-btn ${vMode === 'SKILL_TREE' ? 'active' : ''}" onclick="setSubjectVisualMode('SKILL_TREE')">
                🌳 <span>技能树</span>
              </button>
              <button class="comm-seg-btn ${vMode === 'SPECIAL' ? 'active' : ''}" onclick="setSubjectVisualMode('SPECIAL')">
                🎯 <span>专项学练</span>
              </button>
              <button class="comm-seg-btn ${vMode === 'CARDS' ? 'active' : ''}" onclick="setSubjectVisualMode('CARDS')">
                📦 <span>单元卡片</span>
              </button>
              <button class="comm-seg-btn ${vMode === 'PAPER_GEN' ? 'active' : ''}" onclick="setSubjectVisualMode('PAPER_GEN')">
                🖨️ <span>单元出卷</span>
              </button>
              <button class="comm-seg-btn" onclick="if(window.MASTER_MAP_STATE){window.MASTER_MAP_STATE.subject='${curSubjName}';} switchTab('mastermap')" title="打开本学科王牌提分宝典·互动标记导图与A4红字双栏讲义">
                🏆 <span>提分宝典导图</span>
              </button>
            </div>
            <div class="drill-header-actions-grid cols-3">
              <button class="zen-btn-ghost" onclick="printCurrentActivePage()" title="A4打印或存为PDF">
                🖨️ <span>打印本页</span>
              </button>
              <button class="zen-btn-ghost" onclick="jumpToSyllabus('${curSubjName}', '${curSem}')" title="查看本册教材大纲">
                ${uiIcon('book', 15)} <span>教材大纲</span>
              </button>
              <button class="duo-btn primary" onclick="openHuyisiQuizModal('${curSubjName}', 'SMART', 'quest')">
                ${uiIcon('bolt', 15)} <span>随机快测</span>
              </button>
            </div>
          </div>
        </div>

        <h1 class="drill-page-title">
          ${subjIconSvg(curSubjName, 24)} <span>${curSubjName}（${curSem}）· ${chapters.length} 单元 · ${subjSemKps.length} 课 · ${subjTotalQs} 道精选题库</span>
        </h1>

        ${renderSchoolProgressBannerHtml(curSubjName, curSem, subjSemKps)}

        ${curSubjName === '英语' ? `
          <div class="phonics-hero-banner">
            <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:260px;">
              <img src="/assets/huyisi_welcome.jpg" alt="狐伊丝" style="width:58px;height:58px;border-radius:18px;object-fit:cover;object-position:top;border:2.5px solid #ec4899;flex-shrink:0;" />
              <div>
                <div style="font-size:18px;font-weight:900;color:#831843;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span>🎙️ 狐伊丝·英语自然拼读与 48 国际音标全息点读舱</span>
                  <span class="badge status-red">🔥 专治听写字母颠倒 & 辨音题</span>
                </div>
                <div style="font-size:13.5px;color:#475569;margin-top:4px;">
                  含 <strong>48 国际音标真人发音点读墙</strong> · <strong>26字母7大音素家族</strong> · <strong>Magic E 魔法开闭音节</strong> · <strong>若婷 10.21 听写错词拆音节积木工坊</strong>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="duo-btn primary" onclick="openDictationModal('英语')">
                🎧 <span>10.21 错词互动听写</span>
              </button>
              <button class="duo-btn indigo" onclick="switchTab('phonics')">
                ${uiIcon('volume-on', 16)} <span>48 音标 & 自然拼读舱</span>
              </button>
            </div>
          </div>
        ` : ''}

        ${mainSubjectStageHtml}
      </div>
    `;
    renderMathInContainer(container);
    return;
  }

  // =========================================================================
  // 第 4 级：章节工作台（支持「列表 / 闪卡 / 速背」三种模式切换）
  // =========================================================================
  const activeCh =
    chapters.find(c => c.key === STATE.homeSelectedChapter || c.chapter === STATE.homeSelectedChapter) ||
    chapters[0];

  if (!activeCh) {
    STATE.drillLevel = 'CHAPTER';
    renderMacroView();
    return;
  }

  const chDone = activeCh.items.filter(k => k.status.includes('已吃透')).length;
  const chTotalQs = countTotalQuestionsForKps(activeCh.items);
  const safeChTitle = activeCh.chapter.replace(/'/g, "\\'");
  const subMode = STATE.chapterSubMode || 'ARCHETYPE';

  let stageBodyHtml = '';

  if (subMode === 'FLASHCARDS') {
    const totalCards = activeCh.items.length;
    const curIdx = Math.min(STATE.chapterCardIdx || 0, totalCards - 1);
    const ck = activeCh.items[curIdx];
    const frontSpeakAttr = safeSpeakAttr(`考点：${ck.corePoint}。母题：${ck.questionMain || '请回想本课的核心公式、速记口诀与易错陷阱。'}`);
    const backSpeakAttr = safeSpeakAttr(`核心口诀：${ck.mnemonic || ''}。本质理解：${ck.understanding || ''}。${ck.errorReason ? '防坑提醒：' + ck.errorReason : ''}`);

    stageBodyHtml = `
      <div class="zen-unit-block" style="max-width:860px;margin:0 auto;width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <span class="badge status-gray" style="font-size:15px;padding:6px 14px;">
            ${uiIcon('cards', 15)} <span>速记卡 ${curIdx + 1} / ${totalCards}</span>
          </span>
          <div style="display:flex;gap:8px;align-items:center;">
            ${getStatusBadge(ck.status)}
          </div>
        </div>

        <div class="flashcard-stage-wrap" onclick="flipInlineChapterCard()" style="min-height:280px;">
          <div id="inlineChapterFlashcard" class="flashcard-3d-inner ${STATE.chapterCardFlipped ? 'is-flipped' : ''}">
            <div class="flashcard-face front">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
                  <div style="font-size:14px;font-weight:800;color:#4f46e5;">正面 · 课内考点与母题（点击卡片翻转）</div>
                  <button class="zen-btn-ghost" style="padding:4px 10px;font-size:13px;" onclick="event.stopPropagation();speakText('${frontSpeakAttr}', '闪卡正面母题')" title="朗读当前正面考点与母题">${uiIcon('volume-on', 15)} <span>读正面</span></button>
                </div>
                <div style="font-size:21px;font-weight:900;color:#0f172a;margin-bottom:14px;">
                  #${curIdx + 1} ${escapeHtml(ck.corePoint)}
                </div>
                <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;font-size:16.5px;color:#1e293b;">
                  <div class="md-rendered">${formatSimpleMarkdown(ck.questionMain || '请回想本课的核心公式、速记口诀与易错陷阱。')}</div>
                </div>
              </div>
              <div style="text-align:center;font-size:14.5px;font-weight:800;color:#4f46e5;margin-top:12px;">
                ${uiIcon('refresh', 15)} 点击翻转查看核心口诀与理解法
              </div>
            </div>

            <div class="flashcard-face back">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div style="font-size:14px;font-weight:800;color:#15803d;">背面 · 秒杀口诀与本质理解</div>
                  <button class="zen-btn-ghost" style="padding:4px 10px;font-size:13px;" onclick="event.stopPropagation();speakText('${backSpeakAttr}', '闪卡背面口诀与解析')" title="朗读当前背面口诀与理解">${uiIcon('volume-on', 15)} <span>读背面</span></button>
                </div>
                <div style="background:#fdf2f8;border:2px solid #f9a8d4;border-radius:14px;padding:15px;color:#831843;font-size:16.5px;font-weight:700;">
                  ${uiIcon('sparkle', 16)} <strong>核心口诀：</strong>${escapeHtml(ck.mnemonic || '抓准定义与符号边界，分步回头验算')}
                </div>
                <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:14px;padding:15px;color:#1e3a8a;font-size:15.5px;">
                  ${uiIcon('bulb', 16)} <strong>本质理解：</strong>${escapeHtml(ck.understanding || '结合图形或模型分步拆解')}
                </div>
                ${ck.errorReason ? `
                  <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:14px;padding:13px;color:#991b1b;font-size:15px;">
                    ${uiIcon('alert', 16)} <strong>防坑提醒：</strong>${escapeHtml(ck.errorReason)}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;gap:8px;">
            <button class="drill-back-btn" onclick="stepInlineChapterCard(-1, ${totalCards})">${uiIcon('arrow-left', 16)} <span>上一张</span></button>
            <button class="drill-back-btn" onclick="stepInlineChapterCard(1, ${totalCards})"><span>下一张</span> ${uiIcon('arrow-right', 16)}</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="judge-btn red" onclick="quickMarkChapterPointStatus('${ck.id}', '🔴未掌握')">${uiIcon('target', 15)} <span>待突破</span></button>
            <button class="judge-btn yellow" onclick="quickMarkChapterPointStatus('${ck.id}', '🟡复习中')">${uiIcon('clock', 15)} <span>巩固</span></button>
            <button class="judge-btn green" onclick="quickMarkChapterPointStatus('${ck.id}', '🟢已吃透')">${uiIcon('check', 15)} <span>已背熟</span></button>
          </div>
        </div>
      </div>
    `;
  } else if (subMode === 'CHEATSHEET') {
    const allMnemonicsAttr = safeSpeakAttr(
      activeCh.items
        .map((k, i) => `第${i + 1}课，${k.corePoint}。必背口诀：${k.mnemonic || ''}。${k.understanding ? '通俗理解：' + k.understanding : ''}`)
        .join('。 ')
    );

    const sheetRowsHtml = activeCh.items.map((k, idx) => {
      const cardSpeakAttr = safeSpeakAttr(
        `${k.corePoint}。必背口诀：${k.mnemonic || '紧扣定义与公式边界'}。${k.understanding ? '通俗理解：' + k.understanding : ''}。${(k.errorReason || k.habitWarning) ? '防坑铁律：' + (k.errorReason || k.habitWarning) : ''}`
      );
      return `
      <div class="cheatsheet-card">
        <div class="cheatsheet-card-head">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="cheatsheet-num">#${idx + 1}</span>
            <strong style="font-size:18px;color:#0f172a;">${escapeHtml(k.corePoint)}</strong>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="zen-btn-ghost" onclick="speakText('${cardSpeakAttr}', '速背卡内容')" title="朗读本张速背卡">${uiIcon('volume-on', 16)} <span>读本卡</span></button>
            <button class="zen-btn-ghost" onclick="openMicroDrawer('${k.id}')" title="查看详情">${uiIcon('book', 16)} <span>讲义</span></button>
          </div>
        </div>
        <div class="cheatsheet-mnemonic">
          ${uiIcon('sparkle', 15)} <strong>必背口诀：</strong>${escapeHtml(k.mnemonic || '紧扣定义与公式边界')}
        </div>
        ${k.understanding ? `
          <div class="cheatsheet-essence">
            ${uiIcon('bulb', 15)} <strong>通俗理解：</strong>${escapeHtml(k.understanding)}
          </div>
        ` : ''}
        ${(k.errorReason || k.habitWarning) ? `
          <div class="cheatsheet-trap">
            ${uiIcon('shield', 15)} <strong>防坑铁律：</strong>${escapeHtml(k.errorReason || k.habitWarning)}
          </div>
        ` : ''}
      </div>
    `;
    }).join('');

    stageBodyHtml = `
      <div class="zen-unit-block">
        <div class="zen-unit-header">
          <div>
            <strong class="zen-unit-title-text">${escapeHtml(activeCh.chapter)} · 考前速背单</strong>
            <div style="font-size:14.5px;color:#64748b;margin-top:4px;">汇集本单元每课核心口诀、本质理解与防坑铁律</div>
          </div>
          <button class="duo-btn primary" onclick="speakText('${allMnemonicsAttr}', '全单元速背单')">
            ${uiIcon('volume-on', 16)} <span>连播全部</span>
          </button>
        </div>
        <div class="zen-steps-list">
          ${sheetRowsHtml}
        </div>
      </div>
    `;
  } else if (subMode === 'ARCHETYPE' && typeof renderUnitArchetypeMatrixHtml === 'function') {
    stageBodyHtml = renderUnitArchetypeMatrixHtml(curSubjName, curSem, [activeCh], activeCh.chapter);
  } else {
    const pointRowsHtml = activeCh.items.map((k, idx) => {
      const isMastered = k.status.includes('已吃透');
      const isReview = k.status.includes('复习中');
      const isWeak = k.status.includes('未掌握');
      const rowCls = isMastered ? 'row-mastered' : isWeak ? 'row-weak' : isReview ? 'row-review' : '';
      const badgeIcon = isMastered ? uiIcon('crown', 20) : isWeak ? uiIcon('target', 20) : isReview ? uiIcon('clock', 20) : (idx + 1);
      const rowSpeakAttr = safeSpeakAttr(`${k.corePoint}。核心口诀：${k.mnemonic || k.understanding || ''}`);
      const qCount = countKpQuestions(k);

      return `
        <div class="zen-step-row ${rowCls}" onclick="openSingleKpQuizModal('${k.id}', 'quest')">
          <div class="zen-step-circle">${badgeIcon}</div>
          <div class="zen-step-main">
            <div class="zen-step-title">
              <span>${escapeHtml(k.corePoint)}</span>
              ${getDiffBadge(k.difficulty)}
              <span class="badge status-gray">${qCount}题</span>
              ${isWeak ? `<span class="zen-tag-weak">待突破</span>` : ''}
              ${isMastered ? `<span class="badge status-green">已吃透</span>` : ''}
            </div>
            <div class="zen-step-sub" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span>${uiIcon('sparkle', 14)} <strong>口诀：</strong>${escapeHtml(k.mnemonic || k.understanding || '点击开始练习或查看讲义')}</span>
              <button class="zen-btn-ghost" style="padding:2px 8px;font-size:12px;border-radius:999px;" onclick="event.stopPropagation();speakText('${rowSpeakAttr}', '本课口诀')" title="朗读本条口诀">${uiIcon('volume-on', 13)} <span>朗读</span></button>
            </div>
          </div>
          <div class="zen-step-actions" onclick="event.stopPropagation()">
            <button class="zen-btn-ghost" onclick="openMicroDrawer('${k.id}')" title="查看讲义">${uiIcon('book', 16)} <span class="hide-on-xs">讲义</span></button>
            ${(k.isUnverified || (k.status || '').includes('🔒待精校') || qCount === 0)
              ? `<button class="zen-btn-ghost" style="opacity:0.65;cursor:not-allowed;" onclick="showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关')">🔒 <span>待精校</span></button>`
              : `<button class="zen-btn-start" onclick="openSingleKpQuizModal('${k.id}', 'quest')">${uiIcon('bolt', 16)} <span>练${qCount}题</span></button>`}
          </div>
        </div>
      `;
    }).join('');

    stageBodyHtml = `
      <div class="zen-unit-block">
        <div class="zen-unit-header">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="zen-unit-badge" style="background:${subjTheme.tagBg};color:${subjTheme.accent};">${activeCh.semester} · ${curSubjName}</span>
            <strong class="zen-unit-title-text">${escapeHtml(activeCh.chapter)}</strong>
          </div>
          <span style="font-size:15px;font-weight:800;color:#475569;">
            共 <strong>${activeCh.items.length}</strong> 课 · <strong>${chTotalQs}</strong> 题 · 已通 <strong>${chDone}/${activeCh.items.length}</strong>
          </span>
        </div>
        <div class="zen-steps-list">
          ${pointRowsHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="zen-home-wrap drill-stage-animate">
      <div class="drill-nav-header">
        <div class="drill-nav-left">
          <button class="drill-back-btn" onclick="goToDrillLevel('CHAPTER')" title="返回单元总览">
            ${uiIcon('arrow-left', 16)} <span>返回</span>
          </button>
          <div class="drill-stepper">
            <span class="drill-step-pill done" onclick="goToDrillLevel('SEMESTER')">${curSem}</span>
            <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
            <span class="drill-step-pill done" onclick="goToDrillLevel('SUBJECT')">${curSubjName}</span>
            <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
            <span class="drill-step-pill done" onclick="goToDrillLevel('CHAPTER')">单元</span>
            <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
            <span class="drill-step-pill current">每课练习</span>
          </div>
        </div>

        <div class="drill-nav-right-stack">
          <div class="comm-segmented-bar cols-4">
            <button class="comm-seg-btn ${subMode === 'ARCHETYPE' ? 'active' : ''}" onclick="setChapterSubMode('ARCHETYPE')">
              📐 <span>解题模板</span>
            </button>
            <button class="comm-seg-btn ${subMode === 'LIST' ? 'active' : ''}" onclick="setChapterSubMode('LIST')">
              ${uiIcon('target', 14)} <span>每课列表</span>
            </button>
            <button class="comm-seg-btn ${subMode === 'FLASHCARDS' ? 'active' : ''}" onclick="setChapterSubMode('FLASHCARDS')">
              ${uiIcon('cards', 14)} <span>闪卡</span>
            </button>
            <button class="comm-seg-btn ${subMode === 'CHEATSHEET' ? 'active' : ''}" onclick="setChapterSubMode('CHEATSHEET')">
              ${uiIcon('list', 14)} <span>速背</span>
            </button>
          </div>

          <div class="drill-header-actions-grid cols-3">
            <button class="zen-btn-ghost" onclick="printCurrentActivePage()" title="A4打印当前页面或存为PDF">
              🖨️ <span>打印本页</span>
            </button>
            <button class="duo-btn indigo" onclick="openUnitPaperGenerator('${curSubjName}', '${activeCh.semester}', '${safeChTitle}')">
              📄 <span>单元出卷</span>
            </button>
            <button class="duo-btn primary" onclick="openChapterQuizModal('${curSubjName}', '${activeCh.semester}', '${safeChTitle}', 'quest')">
              ${uiIcon('play', 14)} <span>测本单元 (${chTotalQs}题)</span>
            </button>
          </div>
        </div>
      </div>

      ${stageBodyHtml}
    </div>
  `;
  renderMathInContainer(container);
}

// ============================================================================
// 视图 3：成长进度（第1级：3大统计 + 勋章墙 + 8学期环形进度卡 ➔ 第2级：单学期各科进度）
// ============================================================================

function drillSelectChartsSem(semCode) {
  playCommercialSound('click');
  STATE.chartsDrillSem = semCode;
  renderChartsView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderChartsView() {
  const container = document.getElementById('view-charts');
  if (!container || !STATE.data) return;

  const allKps = STATE.data.knowledgePoints;

  if (!STATE.chartsDrillSem) {
    const countMastered = allKps.filter(k => k.status.includes('已吃透')).length;
    const countReview = allKps.filter(k => k.status.includes('复习中')).length;
    const countWeak = allKps.filter(k => k.status.includes('未掌握')).length;
    const l3Mastered = allKps.filter(k => getDepthTier(k.difficulty) === 3 && k.status.includes('已吃透')).length;

    const badges = [
      { icon: uiIcon('sparkle', 26), name: '初一启航者', desc: '点亮初一上学期首颗考点', unlocked: countMastered >= 1 },
      { icon: uiIcon('flame', 26), name: '连胜小达人', desc: `连续打卡达到 ${STATE.dailyStats.streakDays} 天`, unlocked: STATE.dailyStats.streakDays >= 3 },
      { icon: uiIcon('bolt', 26), name: '压轴破阵王', desc: `已攻克 ${l3Mastered} 道三星压轴题`, unlocked: l3Mastered >= 2 },
      { icon: uiIcon('shield', 26), name: '二刷纠偏卫士', desc: '建立 6 大防坑口诀护盾', unlocked: true },
      { icon: uiIcon('crown', 26), name: '星耀满贯学霸', desc: '累计吃透 20 个以上考点', unlocked: countMastered >= 20 }
    ];

    const badgesHtml = badges.map(b => `
      <div class="comm-badge-card ${b.unlocked ? 'is-unlocked' : 'is-locked'}">
        <div class="comm-badge-icon" style="color:${b.unlocked ? '#e11d48' : '#94a3b8'};">${b.icon}</div>
        <div>
          <div class="comm-badge-title">${b.name}</div>
          <div class="comm-badge-desc">${b.desc}</div>
        </div>
      </div>
    `).join('');

    const semCardsHtml = STAGE_OPTIONS.filter(o => o.code !== 'ALL').map(opt => {
      const cth = getSemesterCartoonTheme(opt.code);
      const activeNames = getActiveSubjectNamesForStage(opt.code);
      const sKps = allKps.filter(k => k.semester === opt.code && activeNames.includes(k.subject));
      const g = sKps.filter(k => k.status.includes('已吃透')).length;
      const y = sKps.filter(k => k.status.includes('复习中')).length;
      const r = sKps.filter(k => k.status.includes('未掌握')).length;
      const tot = sKps.length || 1;
      const pct = Math.round(((g + y * 0.4) / tot) * 100);

      return `
        <button class="drill-big-card cartoon-card ${opt.isCurrent ? 'is-current-sem' : ''}"
          style="background:${cth.bg};border-color:${cth.border};box-shadow:0 7px 0 ${cth.lip}, 0 10px 20px rgba(0,0,0,0.04);"
          onclick="drillSelectChartsSem('${opt.code}')">
          <div class="drill-card-top">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="drill-card-badge" style="background:${cth.badgeBg};color:${cth.badgeCol};">
                ${opt.isCurrent ? '当前在读' : opt.shortLabel.replace(opt.pillLabel, '').replace(/[()]/g, '')}
              </span>
              ${renderStarRatingHtml(pct)}
            </div>
            <span class="drill-card-arrow" style="color:${cth.badgeCol};">${uiIcon('arrow-right', 18)}</span>
          </div>

          <div class="drill-card-mid-row">
            <div>
              <div class="drill-card-title">${uiIcon('calendar', 20)} <span>${opt.pillLabel}</span></div>
              <div class="drill-card-sub" style="margin-top:4px;">${activeNames.length} 门科目 · ${sKps.length} 个考点</div>
            </div>
            ${renderMiniRingSvg(pct, cth.badgeCol, 56)}
          </div>

          <div class="drill-card-footer">
            <span>${uiIcon('crown', 14)} 已掌握 <strong>${g}/${sKps.length}</strong></span>
            ${r > 0 ? `<span class="drill-weak-pill">${uiIcon('target', 13)} ${r} 待突破</span>` : `<span class="drill-ok-pill">${uiIcon('check', 13)} 稳步推进</span>`}
          </div>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="zen-home-wrap drill-stage-animate">
        <div class="zen-stats-3col">
          <div class="zen-stat-box" style="border-bottom-color:#22c55e;">
            <div class="zen-stat-num" style="color:#16a34a;">${uiIcon('crown', 26)} ${countMastered}</div>
            <div class="zen-stat-label">已完全掌握</div>
          </div>
          <div class="zen-stat-box" style="border-bottom-color:#f59e0b;">
            <div class="zen-stat-num" style="color:#d97706;">${uiIcon('clock', 26)} ${countReview}</div>
            <div class="zen-stat-label">巩固复习中</div>
          </div>
          <div class="zen-stat-box" style="border-bottom-color:#f43f5e;">
            <div class="zen-stat-num" style="color:#e11d48;">${uiIcon('target', 26)} ${countWeak}</div>
            <div class="zen-stat-label">待突破错题</div>
          </div>
        </div>

        <div class="zen-unit-block">
          <div class="zen-unit-header" style="margin-bottom:12px;padding-bottom:10px;">
            <strong class="zen-unit-title-text">${uiIcon('medal', 22)} 成长勋章墙</strong>
            <span style="font-size:14.5px;color:#64748b;font-weight:700;">已解锁 ${badges.filter(b => b.unlocked).length} / ${badges.length}</span>
          </div>
          <div class="comm-badges-grid">
            ${badgesHtml}
          </div>
        </div>

        <div class="drill-nav-header is-inline-row">
          <h1 class="drill-page-title">选择学期查看进度</h1>
          <button class="zen-btn-ghost" onclick="openCurriculumModal()">${uiIcon('settings', 16)} <span>设置科目</span></button>
        </div>

        <div class="drill-grid-2col">
          ${semCardsHtml}
        </div>
      </div>
    `;
    return;
  }

  const semCode = STATE.chartsDrillSem;
  const activeSubjNames = getActiveSubjectNamesForStage(semCode);
  const subjectBarsHtml = STATE.data.subjects
    .filter(s => activeSubjNames.includes(s.name))
    .map(subj => {
      const th = getSubjectTheme(subj.name);
      const sList = allKps.filter(k => k.subject === subj.name && k.semester === semCode);
      const tot = sList.length || 1;
      const g = sList.filter(k => k.status.includes('已吃透')).length;
      const y = sList.filter(k => k.status.includes('复习中')).length;
      const r = sList.filter(k => k.status.includes('未掌握')).length;
      const pct = Math.round(((g + y * 0.5) / tot) * 100);

      return `
        <div class="zen-step-row" onclick="STATE.stageFocus='${semCode}';drillSelectSubject('${subj.name}');switchTab('macro')">
          <div class="drill-subj-icon-box" style="background:${th.softBg};border-color:${th.border};">${subjIconSvg(subj.name, 22)}</div>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
              <strong style="font-size:19px;color:#0f172a;">${subj.name}（${semCode}）</strong>
              <span style="font-size:15px;color:#475569;font-weight:800;display:flex;align-items:center;gap:6px;">
                ${renderStarRatingHtml(pct)} <span>${g}/${sList.length} (${pct}%)</span>
              </span>
            </div>
            <div class="progress-bar-multi" style="height:12px;">
              <div class="progress-seg green" style="width:${(g / tot) * 100}%"></div>
              <div class="progress-seg yellow" style="width:${(y / tot) * 100}%"></div>
              <div class="progress-seg red" style="width:${(r / tot) * 100}%"></div>
            </div>
          </div>
          <button class="zen-btn-start" onclick="event.stopPropagation();STATE.stageFocus='${semCode}';drillSelectSubject('${subj.name}');switchTab('macro')">
            <span>章节</span> ${uiIcon('arrow-right', 15)}
          </button>
        </div>
      `;
    }).join('');

  container.innerHTML = `
    <div class="zen-home-wrap drill-stage-animate">
      <div class="drill-nav-header">
        <div class="drill-nav-left">
          <button class="drill-back-btn" onclick="drillSelectChartsSem(null)">${uiIcon('arrow-left', 17)} <span>返回</span></button>
          <div class="drill-stepper">
            <span class="drill-step-pill done" onclick="drillSelectChartsSem(null)">全部学期</span>
            <span class="drill-step-sep">${uiIcon('chevron-right', 14)}</span>
            <span class="drill-step-pill current">${semCode}</span>
          </div>
        </div>
      </div>

      <div class="zen-unit-block">
        <div class="zen-unit-header">
          <strong class="zen-unit-title-text">${semCode} · 各科掌握进度（${activeSubjNames.length}科）</strong>
          <span style="font-size:14px;color:#64748b;">点击科目进入章节</span>
        </div>
        <div class="zen-steps-list">
          ${subjectBarsHtml}
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 知识点卡片渲染与全局搜索视图 (Meso View for Search)
// ============================================================================

function renderSingleKpCardHtml(k) {
  const cardClass = k.status.includes('未掌握') ? 'is-weak' : k.status.includes('已吃透') ? 'is-mastered' : k.status.includes('复习中') ? 'is-review' : '';
  return `
    <div class="kp-card ${cardClass}" onclick="openMicroDrawer('${k.id}')" style="cursor:pointer;">
      <div>
        <div class="kp-meta-top">
          <span style="color:#475569;font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:6px;">
            ${subjIconSvg(k.subject, 16)} <span>${k.subject} · ${k.semester} · ${escapeHtml(k.chapter)}</span>
          </span>
          ${getStatusBadge(k.status)}
        </div>
        <div class="kp-title" style="margin:12px 0 10px;font-size:18px;line-height:1.45;">
          <span style="color:#4f46e5;font-weight:900;margin-right:6px;">#${k.order}</span>${escapeHtml(k.corePoint)}
        </div>
        <div style="font-size:15px;color:#1e293b;background:#f8fafc;padding:12px 14px;border-radius:12px;border:1.5px solid #e2e8f0;line-height:1.65;">
          ${uiIcon('sparkle', 14)} <strong>核心口诀</strong>：${escapeHtml(k.mnemonic || k.understanding || '点击查看详细讲义与例题')}
        </div>
      </div>

      <div class="kp-card-footer" onclick="event.stopPropagation()">
        ${getDiffBadge(k.difficulty)}
        <div style="display:flex;gap:8px;">
          <button class="zen-btn-ghost" onclick="openMicroDrawer('${k.id}')">${uiIcon('book', 15)} <span>讲义</span></button>
          ${(k.isUnverified || (k.status || '').includes('🔒待精校') || countKpQuestions(k) === 0)
            ? `<button class="zen-btn-ghost" style="opacity:0.65;cursor:not-allowed;" onclick="showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关')">🔒 <span>待精校</span></button>`
            : `<button class="zen-btn-start" onclick="openSingleKpQuizModal('${k.id}', 'quest')">${uiIcon('bolt', 15)} <span>练习</span></button>`}
        </div>
      </div>
    </div>
  `;
}

function openSingleKpQuizModal(kpId, studyStyle = 'quest') {
  if (!STATE.data) return;
  const kp = STATE.data.knowledgePoints.find(k => k.id === kpId || k.corePoint === kpId);
  if (!kp) return;
  if (kp.isUnverified || (kp.status || '').includes('🔒待精校') || countKpQuestions(kp) === 0) {
    showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关');
    return;
  }
  STATE.quiz.isOpen = true;
  STATE.quiz.studyStyle = studyStyle || 'quest';
  STATE.quiz.semester = kp.semester || (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus);
  STATE.quiz.subject = kp.subject;
  STATE.quiz.sourceContext = { type: 'SINGLE_KP', kpId: kp.id };

  if (studyStyle === 'quest' || !studyStyle) {
    // 从本课精选题池中每次抽取题目（支持一键「🔄 随机换新题」）
    const sampled = sampleRandomQuestionsFromKps([kp], 6, 8);
    if (sampled.length >= 4) {
      STATE.quiz.queue = sampled;
    } else {
      const sameChPool = STATE.data.knowledgePoints
        .filter(k => k.subject === kp.subject && k.semester === kp.semester && k.chapter === kp.chapter && k.id !== kp.id && !k.isUnverified && !(k.status || '').includes('🔒待精校'))
        .sort((a, b) => a.order - b.order);
      STATE.quiz.queue = sampleRandomQuestionsFromKps([kp, ...sameChPool], 6, 8);
    }
  } else {
    const sameSubjPool = STATE.data.knowledgePoints
      .filter(k => k.subject === kp.subject && k.semester === kp.semester && k.id !== kp.id && !k.isUnverified && !(k.status || '').includes('🔒待精校'))
      .sort((a, b) => a.order - b.order);
    STATE.quiz.queue = [kp, ...sameSubjPool].slice(0, Math.max(6, STATE.quiz.batchSize));
  }

  STATE.quiz.currentIndex = 0;
  STATE.quiz.qVariant = 'main';
  STATE.quiz.hintsShown = { h1: false, h2: false, h3: false };
  STATE.quiz.answerRevealed = false;
  STATE.quiz.flashcardFlipped = false;
  STATE.quiz.unlockedBlockStep = 1;
  STATE.quiz.selectedChoiceIdx = null;
  STATE.quiz.choiceSubmitted = false;
  STATE.quiz.choiceIsCorrect = null;
  STATE.quiz.questionElapsedSec = 0;
  STATE.quiz.totalElapsedSec = 0;
  STATE.quiz.results = [];
  STATE.quiz.finished = false;
  initMatchGameFromQueue();

  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
}

function renderMesoView() {
  const container = document.getElementById('view-meso');
  if (!container || !STATE.data) return;

  const f = STATE.mesoFilter;
  const q = (f.search || '').trim().toLowerCase();
  const filtered = STATE.data.knowledgePoints.filter(k => {
    if (!q) return true;
    const hay = `${k.subject} ${k.semester} ${k.chapter} ${k.corePoint} ${k.mnemonic} ${k.understanding}`.toLowerCase();
    return hay.includes(q);
  });

  container.innerHTML = `
    <div class="zen-home-wrap">
      <div class="drill-nav-header">
        <div class="drill-nav-left">
          <button class="drill-back-btn" onclick="document.getElementById('globalSearchInput').value='';switchTab('macro')">
            ${uiIcon('arrow-left', 16)} <span>返回选课</span>
          </button>
          <h1 class="drill-page-title">${uiIcon('target', 22)} <span>搜索「${escapeHtml(f.search)}」· ${filtered.length} 个考点</span></h1>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="zen-unit-block" style="text-align:center;padding:40px;">
          <p style="font-size:18px;color:#64748b;margin-bottom:14px;">未找到包含该关键词的考点</p>
          <button class="duo-btn primary" onclick="document.getElementById('globalSearchInput').value='';switchTab('macro')">返回选课闯关</button>
        </div>
      ` : `
        <div class="kp-cards-grid">
          ${filtered.map(k => renderSingleKpCardHtml(k)).join('')}
        </div>
      `}
    </div>
  `;

  renderMathInContainer(container);
}

// ============================================================================
// 微观知识点显微镜抽屉 (Micro Knowledge Workbench Drawer)
// ============================================================================

function openMicroDrawer(kpId) {
  if (!STATE.data) return;
  const EXAM_KP_ALIASES = {
    '第一章：正方体展开图找相对面': '从立体图形到平面图形',
    '第一章：正方体的截面极限判断': '从立体图形到平面图形',
    '第二章：有理数分类与数轴相反数绝对值比大小': '认识有理数',
    '第二章：有理数加减法法则与增减变化应用题模型': '有理数的加减运算',
    '第二章：有理数乘除法与分配律正逆巧算陷阱': '有理数的乘除运算',
    '第二章：有理数乘方的符号陷阱': '有理数的乘方',
    '第二章：有理数混合运算与运算律巧算陷阱': '有理数的混合运算',
    '第二章：数轴与绝对值动点最值模型': '有理数的混合运算'
  };
  const aliasTarget = EXAM_KP_ALIASES[kpId] || kpId;
  const kp = STATE.data.knowledgePoints.find(k =>
    k.id === kpId ||
    k.corePoint === kpId ||
    k.corePoint.includes(aliasTarget) ||
    k.id.includes(aliasTarget)
  );
  if (!kp) {
    showToast('未找到该知识点卡片: ' + kpId);
    return;
  }
  STATE.activeDrawerKp = kp;

  const drawer = document.getElementById('microDrawer');
  const backdrop = document.getElementById('microDrawerBackdrop');
  const content = document.getElementById('microDrawerContent');
  const qCount = countKpQuestions(kp);
  const bankItems = Array.isArray(kp.quizItems) ? kp.quizItems : [];

  const atomicHtml = kp.atomicPoints && kp.atomicPoints.length > 0
    ? `<div class="micro-box">
         <div class="micro-box-title">${uiIcon('steps', 16)} <span>微观原子考点拆解（逐条过关清单）</span></div>
         <ul style="padding-left:20px;font-size:13.5px;">
           ${kp.atomicPoints.map(a => `<li style="margin-bottom:4px;"><label style="cursor:pointer;"><input type="checkbox" style="margin-right:6px;"/> ${escapeHtml(a)}</label></li>`).join('')}
         </ul>
       </div>`
    : '';

  const bankPreviewHtml = bankItems.length > 0 ? `
    <div class="micro-box" style="border:2px solid #c7d2fe;background:#f8fafc;">
      <div class="micro-box-title">
        <span style="display:inline-flex;align-items:center;gap:6px;color:#3730a3;">${uiIcon('list', 16)} <span>本课配套闯关题库（共 ${bankItems.length} 道 · 点击选项可直接互动判题）</span></span>
        <button class="zen-btn-start" onclick="closeMicroDrawer();openSingleKpQuizModal('${kp.id}', 'quest')">
          ${uiIcon('bolt', 15)} <span>全屏刷本课 ${bankItems.length} 题</span>
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${bankItems.map((item, idx) => {
          const letters = ['A', 'B', 'C', 'D'];
          const optsHtml = item.type === 'CHOICE' && Array.isArray(item.options)
            ? `<div id="drawer-q-opts-${idx}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:10px;font-size:14px;color:#334155;">
                ${item.options.map((o, oi) => `
                  <button type="button" class="drawer-quiz-opt" data-opt-idx="${oi}" onclick="answerDrawerQuizItem(${idx}, ${oi}, ${Number(item.correctIdx || 0)}, false, event)">
                    <strong class="drawer-opt-badge">${letters[oi]}</strong>
                    <span class="md-rendered">${formatSimpleMarkdown(o)}</span>
                  </button>
                `).join('')}
              </div>`
            : `<div id="drawer-q-opts-${idx}" style="display:flex;gap:10px;margin-top:10px;">
                <button type="button" class="drawer-quiz-opt" data-opt-idx="1" onclick="answerDrawerQuizItem(${idx}, 1, ${item.tfCorrect ? 1 : 0}, true, event)">
                  <strong class="drawer-opt-badge" style="background:#dcfce7;color:#15803d;">✓</strong>
                  <span>说法正确（对）</span>
                </button>
                <button type="button" class="drawer-quiz-opt" data-opt-idx="0" onclick="answerDrawerQuizItem(${idx}, 0, ${item.tfCorrect ? 1 : 0}, true, event)">
                  <strong class="drawer-opt-badge" style="background:#fee2e2;color:#b91c1c;">✕</strong>
                  <span>说法有误（错）</span>
                </button>
              </div>`;
          const ansLabel = item.type === 'TF' ? (item.tfCorrect ? '正确' : '错误') : letters[item.correctIdx || 0];
          return `
            <div class="drawer-q-card" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:13px 15px;transition:all 0.2s ease;">
              <div style="font-size:15px;font-weight:800;color:#0f172a;">
                <span class="badge ${item.type === 'TF' ? 'diff-1' : 'diff-2'}" style="margin-right:6px;">第${idx + 1}题 · ${item.type === 'TF' ? '判断' : '选择'}</span>
                <span class="md-rendered">${formatSimpleMarkdown(item.prompt)}</span>
              </div>
              ${optsHtml}
              <details id="drawer-q-exp-${idx}" style="margin-top:9px;font-size:13.5px;color:#15803d;cursor:pointer;">
                <summary style="font-weight:800;color:#4f46e5;">查看答案与解析</summary>
                <div class="drawer-exp-body" style="margin-top:6px;padding:9px 12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;color:#166534;">
                  <strong>答案：【${ansLabel}】</strong> · ${formatSimpleMarkdown(item.explanation || '')}
                </div>
              </details>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="drawer-header" style="background:linear-gradient(90deg,#2e1065,#4c1d95,#831843);">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${kp.status.includes('已吃透') ? '/assets/huyisi_victory.jpg' : kp.status.includes('未掌握') ? '/assets/huyisi_detective.jpg' : '/assets/huyisi_welcome.jpg'}"
             alt="狐伊丝" style="width:56px;height:56px;border-radius:16px;object-fit:cover;border:2px solid #f9a8d4;box-shadow:0 4px 12px rgba(236,72,153,0.4);" />
        <div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
            <span class="brand-badge">${subjIconSvg(kp.subject, 14)} ${kp.subject} · ${kp.semester}</span>
            <span style="font-size:13px;color:#fbcfe8;">${escapeHtml(kp.chapter)}</span>
            ${getDiffBadge(kp.difficulty)}
            ${getStatusBadge(kp.status)}
          </div>
          <h2 style="font-size:18px;font-weight:800;display:flex;align-items:center;gap:6px;">${uiIcon('book', 18)} <span>${escapeHtml(kp.corePoint)}</span></h2>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${(kp.isUnverified || (kp.status || '').includes('🔒待精校') || qCount === 0)
          ? `<span style="background:rgba(255,255,255,0.16);color:#e2e8f0;padding:8px 14px;border-radius:10px;font-weight:800;font-size:13px;">🔒 待精校预习课</span>`
          : `<button onclick="closeMicroDrawer();openSingleKpQuizModal('${kp.id}', 'quest')" style="background:#ff4d79;color:#fff;border:none;padding:8px 14px;border-radius:10px;cursor:pointer;font-weight:800;display:inline-flex;align-items:center;gap:5px;">${uiIcon('bolt', 15)} <span>刷本课(${qCount}题)</span></button>`}
        <button onclick="closeMicroDrawer()" style="background:rgba(255,255,255,0.18);color:#fff;border:none;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:4px;">${uiIcon('cross', 15)} <span>关闭</span></button>
      </div>
    </div>

    <div class="drawer-graph-bar">
      <div>
        ${uiIcon('arrow-left', 14)} 前置：${kp.prevPoint && kp.prevPoint !== '本学科起点'
          ? `<span class="graph-nav-link" onclick="openKnowledgePointByTitle('${kp.prevPoint.replace(/'/g, "\\'")}')">${escapeHtml(kp.prevPoint)}</span>`
          : '<span>本学科起点</span>'}
      </div>
      <div>
        ${uiIcon('book', 14)} 大纲：<span class="graph-nav-link" onclick="jumpToSyllabus('${kp.subject}','${kp.semester}')">${kp.subject}_${kp.semester}_详尽大纲</span>
      </div>
      <div>
        ${uiIcon('arrow-right', 14)} 进阶：${kp.nextPoint && kp.nextPoint !== '中考满贯通关'
          ? `<span class="graph-nav-link" onclick="openKnowledgePointByTitle('${kp.nextPoint.replace(/'/g, "\\'")}')">${escapeHtml(kp.nextPoint)}</span>`
          : '<span>中考满贯通关</span>'}
      </div>
    </div>

    <div class="drawer-body">
      <div class="micro-box highlight-blue" style="background:linear-gradient(135deg,#fff5f7,#f5f3ff);border-color:#f9a8d4;">
        <div class="micro-box-title">
          <span style="color:#831843;display:inline-flex;align-items:center;gap:6px;">${uiIcon('sparkle', 16)} <span>记忆口诀与核心精髓</span></span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#7e22ce;font-weight:700;">${escapeHtml(kp.examWeight)}</span>
            <button class="zen-btn-ghost" style="padding:3px 10px;font-size:12.5px;" onclick="speakText('${safeSpeakAttr(`记忆口诀：${kp.mnemonic || ''}。${kp.understanding ? '本质理解：' + kp.understanding : ''}`)}', '记忆口诀与理解')">${uiIcon('volume-on', 14)} <span>读口诀</span></button>
          </div>
        </div>
        <div style="font-size:15px;font-weight:700;color:#4c1d95;margin-bottom:8px;">
          ${escapeHtml(kp.mnemonic || '详见下方大纲与解析')}
        </div>
        ${kp.understanding ? `<div style="font-size:13.5px;color:#334155;background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #fbcfe8;">${uiIcon('bulb', 15)} <strong>一秒理解本质</strong>：${escapeHtml(kp.understanding)}</div>` : ''}
      </div>

      ${atomicHtml}

      ${(kp.errorReason || kp.habitWarning) ? `
        <div class="micro-box highlight-red">
          <div class="micro-box-title">
            <span style="display:inline-flex;align-items:center;gap:6px;">${uiIcon('shield', 16)} <span>防坑警报与错因档案</span></span>
            <button class="zen-btn-ghost" style="padding:3px 10px;font-size:12.5px;" onclick="speakText('${safeSpeakAttr(`${kp.errorReason ? '防坑提醒：' + kp.errorReason : ''}。${kp.habitWarning ? '护盾指令：' + kp.habitWarning : ''}`)}', '防坑警报')">${uiIcon('volume-on', 14)} <span>读防坑</span></button>
          </div>
          ${kp.errorReason ? `<p style="color:#991b1b;font-weight:600;margin-bottom:6px;">${uiIcon('alert', 14)} 真实错因记录：${escapeHtml(kp.errorReason)}</p>` : ''}
          ${kp.habitWarning ? `<p style="color:#b45309;font-size:13px;">${uiIcon('shield', 14)} 护盾指令：${escapeHtml(kp.habitWarning)}</p>` : ''}
          ${kp.lastTested ? `<p style="font-size:12px;color:#64748b;margin-top:4px;">${uiIcon('calendar', 13)} 最近实测来源：${escapeHtml(kp.lastTested)}</p>` : ''}
        </div>
      ` : ''}

      ${bankPreviewHtml}

      ${(kp.sections.refCorpus || kp.sections.refSkills) ? `
        <div class="micro-box" style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #93c5fd;">
          <div class="micro-box-title">
            <span style="color:#1e40af;display:inline-flex;align-items:center;gap:6px;">${uiIcon('book', 16)} <span>权威资料库原文归纳 & 状元笔记直达</span></span>
            <button class="zen-btn-ghost" style="padding:3px 10px;font-size:12.5px;" onclick="speakText('${safeSpeakAttr(`${kp.sections.refCorpus || ''}。${kp.sections.refSkills || ''}`)}', '资料库归纳与状元笔记')">${uiIcon('volume-on', 14)} <span>读讲义</span></button>
          </div>
          ${kp.sections.refCorpus ? `<div class="md-rendered" style="margin-bottom:10px;">${formatSimpleMarkdown(kp.sections.refCorpus)}</div>` : ''}
          ${kp.sections.refSkills ? `<div class="md-rendered" style="padding-top:8px;border-top:1px dashed #bfdbfe;">${formatSimpleMarkdown(kp.sections.refSkills)}</div>` : ''}
        </div>
      ` : ''}

      <div class="micro-box">
        <div class="micro-box-title">
          <span style="display:inline-flex;align-items:center;gap:6px;">${uiIcon('target', 16)} <span>验证掌握情况的经典主观母题</span></span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge diff-3">先独立作答，再查看解析</span>
            <button class="zen-btn-ghost" style="padding:3px 10px;font-size:12.5px;" onclick="speakText('${safeSpeakAttr(kp.sections.question || kp.rawBody || '')}', '主观母题')">${uiIcon('volume-on', 14)} <span>读母题</span></button>
          </div>
        </div>
        <div class="md-rendered">${formatSimpleMarkdown(kp.sections.question || kp.rawBody)}</div>
      </div>

      <div id="answerMaskPrompt" class="answer-mask-box" style="background:linear-gradient(135deg,#fdf2f8,#f5f3ff);border-color:#f472b6;" onclick="toggleDrawerAnswer(true)">
        <div style="font-size:15px;font-weight:800;color:#831843;display:inline-flex;align-items:center;gap:6px;">${uiIcon('eye', 18)} <span>点击展开主观母题标准答案、易错诊断与变式题</span></div>
      </div>

      <div id="answerRevealedBox" style="display:none;flex-direction:column;gap:14px;">
        <div class="micro-box highlight-green">
          <div class="micro-box-title">
            <span style="display:inline-flex;align-items:center;gap:6px;">${uiIcon('check-circle', 16)} <span>标准答案与步骤秘籍</span></span>
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="zen-btn-ghost" style="padding:3px 10px;font-size:12.5px;" onclick="speakText('${safeSpeakAttr(kp.sections.answer || '')}', '标准答案与步骤')">${uiIcon('volume-on', 14)} <span>读答案</span></button>
              <button class="status-mini-btn" onclick="toggleDrawerAnswer(false)">收起解析</button>
            </div>
          </div>
          <div class="md-rendered">${formatSimpleMarkdown(kp.sections.answer || '请结合下方迭代通关记录中的解析核对。')}</div>
        </div>

        ${kp.sections.pitfall ? `
          <div class="micro-box highlight-amber">
            <div class="micro-box-title">${uiIcon('alert', 16)} <span>高频陷阱诊断</span></div>
            <div class="md-rendered">${formatSimpleMarkdown(kp.sections.pitfall)}</div>
          </div>
        ` : ''}

        ${kp.sections.variant ? `
          <div class="micro-box">
            <div class="micro-box-title">${uiIcon('refresh', 16)} <span>举一反三·变式题</span></div>
            <div class="md-rendered">${formatSimpleMarkdown(kp.sections.variant)}</div>
          </div>
        ` : ''}
      </div>

      ${kp.sections.history ? `
        <div class="micro-box">
          <div class="micro-box-title">${uiIcon('clock', 16)} <span>历次考察与实测通关记录</span></div>
          <div class="md-rendered">${formatSimpleMarkdown(kp.sections.history)}</div>
        </div>
      ` : ''}

      <div class="micro-box" style="background:#f8fafc;border:2px solid #cbd5e1;">
        <div class="micro-box-title">
          <span style="display:inline-flex;align-items:center;gap:6px;">${uiIcon('check-circle', 16)} <span>考察打卡与状态更新（保存后实时写入 Obsidian）</span></span>
        </div>
        <div class="form-row">
          <label>1. 本次考察评定状态：</label>
          <div class="pill-group">
            <button type="button" class="filter-pill ${kp.status.includes('未掌握') ? 'active' : ''}" onclick="selectDrawerStatus('🔴未掌握', 1)">${uiIcon('target', 13)} 待突破 (+1天)</button>
            <button type="button" class="filter-pill ${kp.status.includes('复习中') ? 'active' : ''}" onclick="selectDrawerStatus('🟡复习中', 3)">${uiIcon('clock', 13)} 巩固中 (+3天)</button>
            <button type="button" class="filter-pill ${kp.status.includes('已吃透') ? 'active' : ''}" onclick="selectDrawerStatus('🟢已吃透', 15)">${uiIcon('check-circle', 13)} 已掌握 (+15天)</button>
            <button type="button" class="filter-pill ${kp.status.includes('待考察') ? 'active' : ''}" onclick="selectDrawerStatus('⚪待考察', 0)">未学</button>
          </div>
          <input type="hidden" id="formStatus" value="${escapeHtml(kp.status)}" />
        </div>
        <div class="two-col-grid" style="gap:12px;">
          <div class="form-row">
            <label>2. 下次复查日期：</label>
            <input type="date" id="formNextReview" value="${escapeHtml(kp.nextReview || addDaysISO(1))}" />
          </div>
          <div class="form-row">
            <label>3. 最近实测来源：</label>
            <input type="text" id="formLastTested" value="${escapeHtml(kp.lastTested || '')}" placeholder="例如：2026-10-18 靶向变式重测全对" />
          </div>
        </div>
        <div class="form-row">
          <label>4. 错因诊断摘要：</label>
          <input type="text" id="formErrorReason" value="${escapeHtml(kp.errorReason || '')}" placeholder="记录具体错在哪一步..." />
        </div>
        <div class="form-row">
          <label>5. 追加本次考察记录：</label>
          <textarea id="formNewRecord" rows="3" placeholder="记录本次重测表现..."></textarea>
        </div>
        <button class="btn-primary-sm" style="padding:10px 20px;font-size:14px;display:inline-flex;align-items:center;gap:6px;" onclick="saveMicroDrawerChanges('${kp.id}')">
          ${uiIcon('check', 16)} <span>保存并同步至 Obsidian</span>
        </button>
      </div>
    </div>
  `;

  drawer.classList.add('open');
  backdrop.classList.add('open');
  playCommercialSound('open');
  renderMathInContainer(content);
}

function addMistakeRecord(kp, qItem, chosenVal, isTf) {
  if (!kp) return;
  if (!Array.isArray(STATE.mistakeRecords)) STATE.mistakeRecords = [];
  const rec = {
    id: `${kp.id}__${Date.now()}`,
    kpId: kp.id,
    subject: kp.subject,
    semester: kp.semester,
    chapter: kp.chapter,
    corePoint: kp.corePoint,
    prompt: (qItem && (qItem.prompt || qItem.q)) || kp.corePoint,
    chosenVal,
    isTf: !!isTf,
    createdAt: new Date().toISOString()
  };
  STATE.mistakeRecords.unshift(rec);
  try {
    localStorage.setItem('ruoting_mistake_records_v1', JSON.stringify(STATE.mistakeRecords.slice(0, 200)));
  } catch (e) {}

  kp.status = '🔴未掌握';
  if (STATE.data && Array.isArray(STATE.data.knowledgePoints)) {
    const masterKp = STATE.data.knowledgePoints.find(x => x.id === kp.id);
    if (masterKp) masterKp.status = '🔴未掌握';
  }
  const formStatus = document.getElementById('formStatus');
  if (formStatus) formStatus.value = '🔴未掌握';

  fetch('/api/update-point', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: kp.id,
      status: '🔴未掌握',
      nextReview: addDaysISO(1),
      lastTested: new Date().toISOString().slice(0, 10),
      newRecord: `[错题本自动收录] 闯关题作答有误（${rec.prompt.slice(0, 36)}），已标记为🔴未掌握`
    })
  }).then(() => reloadVaultData(false)).catch(() => {});
}

function answerDrawerQuizItem(qIdx, chosenVal, correctVal, isTf, ev) {
  const wrap = document.getElementById(`drawer-q-opts-${qIdx}`);
  if (!wrap) return;
  const isRight = Number(chosenVal) === Number(correctVal);
  const btns = wrap.querySelectorAll('.drawer-quiz-opt');
  btns.forEach(btn => {
    const idx = Number(btn.getAttribute('data-opt-idx'));
    btn.classList.remove('is-correct', 'is-wrong', 'is-dim');
    if (idx === Number(correctVal)) {
      btn.classList.add('is-correct');
    } else if (idx === Number(chosenVal) && !isRight) {
      btn.classList.add('is-wrong');
    } else {
      btn.classList.add('is-dim');
    }
  });

  const det = document.getElementById(`drawer-q-exp-${qIdx}`);
  if (det) det.open = true;

  const x = ev && ev.clientX ? ev.clientX : STATE.lastClickCoords.x;
  const y = ev && ev.clientY ? ev.clientY : STATE.lastClickCoords.y;

  if (isRight) {
    STATE.comboStreak = (STATE.comboStreak || 0) + 1;
    playCommercialSound(STATE.comboStreak >= 2 ? 'combo' : 'mastered');
    spawnCandyCalloutBanner(STATE.comboStreak);
    spawnFloatingFeedback(
      x,
      y,
      STATE.comboStreak >= 2 ? `🍬 ${STATE.comboStreak}连消! +15✨` : '🍬 Sweet! 答对啦 +10✨',
      true
    );
    if (STATE.comboStreak % 2 === 0) burstMagicConfetti();
  } else {
    STATE.comboStreak = 0;
    playCommercialSound('wrong');
    spawnFloatingFeedback(x, y, '💡 差一点，看解析哦~', false);
    const activeKp = STATE.activeDrawerKp;
    const qItem = activeKp && Array.isArray(activeKp.quizItems) ? activeKp.quizItems[qIdx] : null;
    addMistakeRecord(activeKp, qItem, chosenVal, isTf);
  }
}

function toggleDrawerAnswer(show) {
  playCommercialSound(show ? 'flip' : 'click');
  const mask = document.getElementById('answerMaskPrompt');
  const box = document.getElementById('answerRevealedBox');
  if (mask && box) {
    mask.style.display = show ? 'none' : 'block';
    box.style.display = show ? 'flex' : 'none';
  }
}

function selectDrawerStatus(status, addDays) {
  playCommercialSound('click');
  const statusInput = document.getElementById('formStatus');
  const dateInput = document.getElementById('formNextReview');
  if (statusInput) statusInput.value = status;
  if (dateInput && addDays > 0) dateInput.value = addDaysISO(addDays);
  const container = statusInput.parentElement;
  container.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(status.slice(1)));
  });
}

function closeMicroDrawer() {
  playCommercialSound('close');
  document.getElementById('microDrawer').classList.remove('open');
  document.getElementById('microDrawerBackdrop').classList.remove('open');
}

function openKnowledgePointByTitle(titleOrStem) {
  if (!STATE.data) return;
  const clean = titleOrStem.trim();
  const found = STATE.data.knowledgePoints.find(k =>
    k.id === clean || k.corePoint === clean || k.id.includes(clean) || clean.includes(k.id)
  );
  if (found) {
    openMicroDrawer(found.id);
  } else {
    showToast('正在知识库中查找：' + clean);
  }
}

// ============================================================================
// 视图 3：实测试卷与照片显微镜 (Exam Anatomy & 25-Photo Gallery)
// ============================================================================

function setExamSubTab(subTab) {
  STATE.examDrillLevel = subTab === 'PHOTOS' ? 'PHOTO_FOLDERS' : subTab;
  renderExamView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function drillSelectExamLevel(lvl, folderIdx = 0) {
  STATE.examDrillLevel = lvl;
  STATE.examPhotoFolderIdx = folderIdx;
  renderExamView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderExamView() {
  const container = document.getElementById('view-exam');
  if (!container || !STATE.data) return;
  const lvl = STATE.examDrillLevel || 'HOME';

  // 第 1 级：只显示 4 个错题与习惯分类大卡片
  if (lvl === 'HOME') {
    container.innerHTML = `
      <div class="zen-home-wrap">
        <div class="drill-nav-header">
          <div>
            <div class="drill-step-indicator">${uiIcon('shield', 15)} <span>第 1 步 · 选择分类</span></div>
            <h1 class="drill-page-title">错题与做题习惯</h1>
          </div>
        </div>

        <div class="drill-grid-2col">
          <button class="drill-big-card has-weak-border" onclick="drillSelectExamLevel('REMEDIATION')">
            <div class="drill-card-top">
              <span class="drill-card-icon" style="color:#f43f5e;">${uiIcon('target', 34)}</span>
              <span class="drill-card-arrow">重测 ${uiIcon('chevron-right', 15)}</span>
            </div>
            <div class="drill-card-title">6 道必克错题重测</div>
            <div class="drill-card-sub">针对近期高频失分点定制的 6 道遮挡自测题</div>
            <div class="drill-card-footer">
              <span class="drill-weak-pill">${uiIcon('flame', 13)} 重点突破</span>
              <span>逐题自测核对</span>
            </div>
          </button>

          <button class="drill-big-card" onclick="drillSelectExamLevel('HABITS')">
            <div class="drill-card-top">
              <span class="drill-card-icon" style="color:#8b5cf6;">${uiIcon('shield', 34)}</span>
              <span class="drill-card-arrow">口诀 ${uiIcon('chevron-right', 15)}</span>
            </div>
            <div class="drill-card-title">6 大做题习惯口诀</div>
            <div class="drill-card-sub">防漏看换行、防跨行脱式丢项、防涂改第一遍正确答案</div>
            <div class="drill-card-footer">
              <span>${uiIcon('shield', 13)} 提分护盾</span>
              <span>6 条黄金铁律</span>
            </div>
          </button>

          <button class="drill-big-card" onclick="drillSelectExamLevel('PAPER')">
            <div class="drill-card-top">
              <span class="drill-card-icon" style="color:#3b82f6;">${uiIcon('list', 34)}</span>
              <span class="drill-card-arrow">明细 ${uiIcon('chevron-right', 15)}</span>
            </div>
            <div class="drill-card-title">82 分数学调研卷明细</div>
            <div class="drill-card-sub">《2026初一数学学情调研》全卷 22 道题得失分与错因复盘</div>
            <div class="drill-card-footer">
              <span>支持只看错题</span>
              <span>22 道实测记录</span>
            </div>
          </button>

          <button class="drill-big-card" onclick="drillSelectExamLevel('PHOTO_FOLDERS')">
            <div class="drill-card-top">
              <span class="drill-card-icon" style="color:#10b981;">${uiIcon('image', 34)}</span>
              <span class="drill-card-arrow">相册 ${uiIcon('chevron-right', 15)}</span>
            </div>
            <div class="drill-card-title">46 张四科作业与试卷原图</div>
            <div class="drill-card-sub">数学(25张) · 英语(10张) · 生物(6张) · 道法(5张) 按学科分档归类</div>
            <div class="drill-card-footer">
              <span>${uiIcon('folder', 13)} ${PHOTO_ARCHIVES.length} 个相册分组</span>
              <span>点击放大查看笔迹</span>
            </div>
          </button>
        </div>
      </div>
    `;
    return;
  }

  // 第 2 级分支 A：6 道必克错题重测
  if (lvl === 'REMEDIATION') {
    const remCardsHtml = REMEDIATION_PROBLEMS.map((r, idx) => `
      <div class="kp-card is-weak">
        <div>
          <div class="kp-meta-top">
            <span class="badge status-red">${uiIcon('target', 13)} <span>错题重测 #${idx + 1}</span></span>
            <span style="font-size:14px;color:#64748b;font-weight:700;">${escapeHtml(r.targetGene.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''))}</span>
          </div>
          <div class="kp-title" style="margin:10px 0;font-size:20px;">${escapeHtml(r.title)}</div>
          <div class="micro-box" style="margin-bottom:10px;padding:14px 16px;background:#f8fafc;">
            <div class="md-rendered">${formatSimpleMarkdown(r.question)}</div>
          </div>
          <div style="font-size:15px;color:#b91c1c;margin-bottom:12px;">${formatSimpleMarkdown(r.wrongRemind)}</div>

          <div id="rem-mask-${r.id}" class="answer-mask-box" style="padding:14px;" onclick="toggleRemAnswer('${r.id}', true)">
            <strong style="font-size:16px;display:inline-flex;align-items:center;gap:6px;">${uiIcon('eye', 18)} <span>查看标准答案与步骤</span></strong>
          </div>
          <div id="rem-ans-${r.id}" class="micro-box highlight-green" style="display:none;margin-top:10px;">
            <div class="md-rendered">${formatSimpleMarkdown(r.answer)}</div>
            <button class="zen-btn-ghost" style="margin-top:10px;" onclick="toggleRemAnswer('${r.id}', false)">收起答案</button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="zen-home-wrap">
        <div class="drill-nav-header">
          <div class="drill-nav-left">
            <button class="drill-back-btn" onclick="drillSelectExamLevel('HOME')">${uiIcon('arrow-left', 16)} <span>返回</span></button>
            <h1 class="drill-page-title">${uiIcon('target', 22)} <span>6 道必克错题重测</span></h1>
          </div>
        </div>
        <div class="kp-cards-grid">${remCardsHtml}</div>
      </div>
    `;
    renderMathInContainer(container);
    return;
  }

  // 第 2 级分支 B：6 大做题习惯口诀
  if (lvl === 'HABITS') {
    container.innerHTML = `
      <div class="zen-home-wrap">
        <div class="drill-nav-header">
          <div class="drill-nav-left">
            <button class="drill-back-btn" onclick="drillSelectExamLevel('HOME')">${uiIcon('arrow-left', 16)} <span>返回</span></button>
            <h1 class="drill-page-title">${uiIcon('shield', 22)} <span>6 大做题习惯口诀</span></h1>
          </div>
        </div>
        <div class="drill-grid-2col">
          ${HABIT_GENES.map(g => `
            <div class="zen-unit-block" style="border-left:6px solid ${g.color};">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
                <strong style="font-size:19px;color:#0f172a;">${escapeHtml(g.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim())}</strong>
                <span class="badge" style="background:${g.color}18;color:${g.color};font-size:13px;">${escapeHtml(g.level.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim())}</span>
              </div>
              <div style="font-size:16px;font-weight:800;color:#4f46e5;background:#eef2ff;padding:12px 16px;border-radius:12px;margin-bottom:10px;line-height:1.55;">
                ${uiIcon('bulb', 16)} 护盾口诀：${escapeHtml(g.rule)}
              </div>
              <div style="font-size:15px;color:#334155;line-height:1.6;">${escapeHtml(g.desc)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return;
  }

  // 第 2 级分支 C：82分试卷明细
  if (lvl === 'PAPER') {
    const filteredExam = EXAM_22_QUESTIONS.filter(item => {
      if (STATE.examFilter === 'WRONG') return item.status === 'wrong';
      if (STATE.examFilter === 'HIGHLIGHT') return item.status === 'highlight';
      return true;
    });
    const examRowsHtml = filteredExam.map(item => `
      <tr>
        <td><strong>第 ${item.q} 题</strong></td>
        <td style="max-width:300px;">${escapeHtml(item.stem)}</td>
        <td style="font-weight:800;color:${item.status === 'wrong' ? '#dc2626' : '#15803d'};">${escapeHtml(item.student)}</td>
        <td><strong>${escapeHtml(item.correct)}</strong></td>
        <td style="font-size:15px;color:#334155;">${escapeHtml(item.analysis)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="zen-home-wrap">
        <div class="drill-nav-header">
          <div class="drill-nav-left">
            <button class="drill-back-btn" onclick="drillSelectExamLevel('HOME')">${uiIcon('arrow-left', 16)} <span>返回</span></button>
            <h1 class="drill-page-title">${uiIcon('list', 22)} <span>2026初一数学调研卷 (82/120)</span></h1>
          </div>
          <div class="drill-header-actions-grid cols-2">
            <button class="zen-btn-ghost ${STATE.examFilter === 'ALL' ? 'active' : ''}" onclick="setExamFilter('ALL')">全部 22 题</button>
            <button class="zen-btn-ghost ${STATE.examFilter === 'WRONG' ? 'active' : ''}" onclick="setExamFilter('WRONG')">只看错题</button>
          </div>
        </div>
        <div class="zen-unit-block">
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>题号</th><th>题目</th><th>作答</th><th>正确答案</th><th>原因分析</th></tr>
              </thead>
              <tbody>${examRowsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    renderMathInContainer(container);
    return;
  }

  // 第 2 级分支 D：25张原图的 6 个文件夹分类列表
  if (lvl === 'PHOTO_FOLDERS') {
    const folderCardsHtml = PHOTO_ARCHIVES.map((arch, idx) => `
      <button class="drill-big-card" onclick="drillSelectExamLevel('PHOTO_LIST', ${idx})">
        <div class="drill-card-top">
          <span class="badge ${arch.badgeClass}">${escapeHtml(arch.badge.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim())}</span>
          <span class="drill-card-arrow">${arch.photos.length} 张 ${uiIcon('chevron-right', 15)}</span>
        </div>
        <div class="drill-card-title" style="font-size:19px;display:flex;align-items:center;gap:8px;">${uiIcon('folder', 22)} <span>${escapeHtml(arch.groupTitle)}</span></div>
        <div class="drill-card-footer">
          <span>共 <strong>${arch.photos.length}</strong> 张实拍照片</span>
          <span>点击进入相册</span>
        </div>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="zen-home-wrap">
        <div class="drill-nav-header">
          <div class="drill-nav-left">
            <button class="drill-back-btn" onclick="drillSelectExamLevel('HOME')">${uiIcon('arrow-left', 16)} <span>返回</span></button>
            <div class="drill-stepper">
              <span class="drill-step-pill done" onclick="drillSelectExamLevel('HOME')">${uiIcon('shield', 14)} <span>错题习惯</span></span>
              <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
              <span class="drill-step-pill current">${uiIcon('folder', 14)} <span>原图相册</span></span>
            </div>
          </div>
        </div>
        <h1 class="drill-page-title">选择作业/试卷相册（共 ${PHOTO_ARCHIVES.length} 组）</h1>
        <div class="drill-grid-2col">
          ${folderCardsHtml}
        </div>
      </div>
    `;
    return;
  }

  // 第 3 级：单个相册文件夹内的照片列表
  const arch = PHOTO_ARCHIVES[STATE.examPhotoFolderIdx] || PHOTO_ARCHIVES[0];
  container.innerHTML = `
    <div class="zen-home-wrap">
      <div class="drill-nav-header">
        <div class="drill-nav-left">
          <button class="drill-back-btn" onclick="drillSelectExamLevel('PHOTO_FOLDERS')">${uiIcon('arrow-left', 16)} <span>返回相册</span></button>
          <div class="drill-stepper">
            <span class="drill-step-pill done" onclick="drillSelectExamLevel('HOME')">${uiIcon('shield', 14)} <span>错题</span></span>
            <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
            <span class="drill-step-pill done" onclick="drillSelectExamLevel('PHOTO_FOLDERS')">${uiIcon('folder', 14)} <span>相册</span></span>
            <span class="drill-step-sep">${uiIcon('chevron-right', 13)}</span>
            <span class="drill-step-pill current">${uiIcon('image', 14)} <span>原图 (${arch.photos.length})</span></span>
          </div>
        </div>
      </div>

      <div class="zen-unit-block">
        <div class="zen-unit-header">
          <strong class="zen-unit-title-text" style="display:inline-flex;align-items:center;gap:8px;">${uiIcon('folder', 20)} <span>${escapeHtml(arch.groupTitle)}</span></strong>
          <span class="badge ${arch.badgeClass}">${escapeHtml(arch.badge.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim())}</span>
        </div>
        <div class="photo-gallery-grid">
          ${arch.photos.map(p => {
            const folderDir = arch.baseDir || '02_数学/1017 日常做题图片';
            const url = '/vault-media/' + (folderDir + '/' + p.file).split('/').map(encodeURIComponent).join('/');
            return `
              <div class="photo-card" onclick="openPhotoModal('${url}', '${p.title.replace(/'/g, "\\'")}')">
                <div class="photo-thumb-wrap"><img src="${url}" loading="lazy" alt="${escapeHtml(p.title)}" /></div>
                <div class="photo-card-info">
                  <div class="photo-card-title" style="font-size:15px;">${escapeHtml(p.title)}</div>
                  ${p.note ? `<div style="font-size:12.5px;color:#64748b;margin-top:4px;line-height:1.45;">${escapeHtml(p.note)}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleRemAnswer(remId, show) {
  const m = document.getElementById('rem-mask-' + remId);
  const a = document.getElementById('rem-ans-' + remId);
  if (m && a) {
    m.style.display = show ? 'none' : 'block';
    a.style.display = show ? 'block' : 'none';
  }
}

function setExamFilter(val) {
  STATE.examFilter = val;
  renderExamView();
}

// ============================================================================
// 视图 4：错因与做题习惯基因库 (Habit & Error Gene Bank View)
// ============================================================================

function renderGenesView() {
  const container = document.getElementById('view-genes');
  if (!STATE.data) return;

  const cardsHtml = HABIT_GENES.map(g => `
    <div class="section-card" style="border-left:5px solid ${g.color};">
      <div class="section-header">
        <div>
          <div class="section-title">
            <span>${escapeHtml(g.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim())}</span>
            <span class="badge" style="background:${g.color}18;color:${g.color};border:1px solid ${g.color}40;">
              健康度 ${g.score}% · 触发 ${g.triggers} 次
            </span>
          </div>
          <div class="section-subtitle" style="margin-top:4px;font-size:13px;color:#334155;">${escapeHtml(g.desc)}</div>
        </div>
      </div>

      <div class="kp-mnemonic-box" style="margin-bottom:14px;font-size:14px;">
        ${uiIcon('shield', 15)} <strong>纠偏铁律口诀</strong>：${escapeHtml(g.rule)}
      </div>

      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>实测出处</th>
              <th>错题笔迹与病因还原</th>
              <th>关联知识点</th>
              <th>原图笔迹</th>
            </tr>
          </thead>
          <tbody>
            ${g.evidence.map(ev => {
              const photoUrl = '/vault-media/' + ('02_数学/1017 日常做题图片/' + ev.photo).split('/').map(encodeURIComponent).join('/');
              return `
                <tr>
                  <td><strong>${escapeHtml(ev.source)}</strong></td>
                  <td style="color:#991b1b;font-weight:500;">${escapeHtml(ev.detail)}</td>
                  <td>
                    <a href="javascript:void(0)" onclick="openMicroDrawer('${ev.kp}')" style="color:#2563eb;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                      ${uiIcon('book', 14)} <span>${escapeHtml(ev.kp)}</span>
                    </a>
                  </td>
                  <td>
                    <button class="status-mini-btn" onclick="openPhotoModal('${photoUrl}','${ev.source.replace(/'/g, "\\'")}')">${uiIcon('image', 13)} <span>原图</span></button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="section-card" style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;">
      <h2 style="font-size:20px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">${uiIcon('shield', 22)} <span>全科错因与做题习惯基因库</span></h2>
      <p style="color:#cbd5e1;font-size:13.5px;">
        通过下方 6 大习惯维度，既抓宏观习惯养成，又抓微观单题除根。
      </p>
    </div>
    ${cardsHtml}
  `;
}

// ============================================================================
// 视图 5：51册详尽人文化大纲沉浸阅读器 (Interactive Syllabus Explorer)
// ============================================================================

function renderSyllabusView() {
  const container = document.getElementById('view-syllabus');
  if (!STATE.data) return;

  const syllabi = STATE.data.syllabi;
  const activeSubj = STATE.activeSyllabusSubject || '数学';
  const subjSyllabi = syllabi.filter(s => s.subject === activeSubj);
  let activeSyl = syllabi.find(s => s.id === STATE.activeSyllabusId);
  if (!activeSyl || activeSyl.subject !== activeSubj) {
    activeSyl = subjSyllabi[0] || syllabi[0];
    if (activeSyl) STATE.activeSyllabusId = activeSyl.id;
  }

  const subjTabsHtml = STATE.data.subjects.map(s => {
    const cnt = syllabi.filter(x => x.subject === s.name).length;
    return `<button class="filter-pill ${activeSubj === s.name ? 'active' : ''}" onclick="selectSyllabusSubject('${s.name}')">${subjIconSvg(s.name, 14)} <span>${s.name} (${cnt})</span></button>`;
  }).join('');

  const sidebarItemsHtml = subjSyllabi.map(s => `
    <div class="syl-nav-item ${activeSyl && activeSyl.id === s.id ? 'active' : ''}" onclick="selectSyllabusDoc('${s.id}')">
      <span style="display:inline-flex;align-items:center;gap:6px;">${uiIcon('book', 15)} <span>${s.subject} · ${s.semester}</span></span>
      <span style="font-size:11px;color:#64748b;">${s.chapters.length}章</span>
    </div>
  `).join('');

  let chaptersHtml = '';
  if (activeSyl) {
    chaptersHtml = activeSyl.chapters.map(ch => `
      <div class="section-card">
        <div class="section-header" style="border-bottom:2px solid #e2e8f0;padding-bottom:10px;">
          <div class="section-title" style="color:#0f172a;display:flex;align-items:center;gap:8px;">${uiIcon('book', 18)} <span>${escapeHtml(ch.title)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${ch.subsections.map(sub => {
            const linkedKps = (sub.linkedStems || [])
              .map(stem => STATE.data.knowledgePoints.find(k => k.id === stem))
              .filter(Boolean);

            const linkedBtns = linkedKps.map(kp => `
              <div style="display:flex;align-items:center;justify-content:space-between;background:#eff6ff;border:1px solid #bfdbfe;padding:10px 14px;border-radius:8px;margin-top:10px;flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  ${getStatusBadge(kp.status)}
                  ${getDiffBadge(kp.difficulty)}
                  <strong>${escapeHtml(kp.corePoint)}</strong>
                </div>
                <button class="btn-primary-sm" style="display:inline-flex;align-items:center;gap:4px;" onclick="openMicroDrawer('${kp.id}')">${uiIcon('bolt', 14)} <span>进入自测</span></button>
              </div>
            `).join('');

            return `
              <div class="micro-box" style="background:#fcfdff;">
                <h3 style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:10px;">${escapeHtml(sub.title)}</h3>
                <div class="md-rendered">${formatSimpleMarkdown(sub.body)}</div>
                ${linkedBtns}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = `
    <div class="drill-nav-header" style="margin-bottom:16px;">
      <div class="drill-nav-left">
        <button class="drill-back-btn" onclick="switchTab('macro')">${uiIcon('arrow-left', 16)} <span>返回选课</span></button>
        <h1 class="drill-page-title">${subjIconSvg(activeSubj, 22)} <span>${activeSubj} · 教材大纲</span></h1>
      </div>
      <div class="pill-group">${subjTabsHtml}</div>
    </div>

    <div class="syllabus-layout">
      <div class="syllabus-sidebar">
        <div style="font-weight:800;margin-bottom:10px;padding:0 6px;color:#334155;font-size:15px;display:flex;align-items:center;gap:6px;">${uiIcon('layers', 16)} <span>${activeSubj} 分册 (${subjSyllabi.length})</span></div>
        ${sidebarItemsHtml}
      </div>
      <div>
        ${chaptersHtml}
      </div>
    </div>
  `;

  renderMathInContainer(container);
}

function selectSyllabusSubject(subjName) {
  STATE.activeSyllabusSubject = subjName;
  renderSyllabusView();
}

function selectSyllabusDoc(sylId) {
  STATE.activeSyllabusId = sylId;
  renderSyllabusView();
}

function jumpToSyllabus(subjName, semester) {
  closeMicroDrawer();
  STATE.activeSyllabusSubject = subjName;
  if (STATE.data) {
    const match =
      STATE.data.syllabi.find(s => s.subject === subjName && s.semester === semester) ||
      STATE.data.syllabi.find(s => s.subject === subjName && semester && s.semester === semester.slice(0, 2)) ||
      STATE.data.syllabi.find(s => s.subject === subjName);
    if (match) STATE.activeSyllabusId = match.id;
  }
  switchTab('syllabus');
}

// ============================================================================
// 交互控制：切换标签页、筛选、双向保存至 Obsidian、原图放大镜
// ============================================================================

function switchTab(tabName) {
  if (tabName === 'macro' && STATE.activeTab === 'macro') {
    STATE.drillLevel = 'SUBJECT';
  }
  if (tabName === 'exam') {
    STATE.examDrillLevel = 'HOME';
  }
  if (tabName === 'charts') {
    STATE.chartsDrillSem = null;
  }

  STATE.activeTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === 'view-' + tabName);
  });

  if (tabName === 'macro') renderMacroView();
  if (tabName === 'meso') renderMesoView();
  if (tabName === 'charts') renderChartsView();
  if (tabName === 'exam') renderExamView();
  if (tabName === 'genes') renderGenesView();
  if (tabName === 'syllabus') renderSyllabusView();
  if (tabName === 'phonics') renderPhonicsView();
  if (tabName === 'qbank' && typeof renderCustomQBankView === 'function') renderCustomQBankView();
  if (tabName === 'mastermap' && typeof renderMasterMapView === 'function') renderMasterMapView();

  // 为非组卷/题库的二级视图顶部自动注入通用导出与打印动作条
  if (['phonics', 'exam', 'charts', 'syllabus', 'meso'].includes(tabName) && typeof renderUniversalPageActionBar === 'function') {
    const sec = document.getElementById('view-' + tabName);
    if (sec && !sec.querySelector('.universal-page-bar')) {
      const info = getActiveTabTitleInfo();
      sec.insertAdjacentHTML('afterbegin', renderUniversalPageActionBar(info.id, info.title, info.subtitle));
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMesoFilter(key, val) {
  STATE.mesoFilter[key] = val;
  if (key === 'subject') {
    STATE.homeSelectedSubject = val;
    STATE.mesoFilter.chapter = 'ALL';
    STATE.homeSelectedChapter = 'ALL';
    // 若当前选中的学期没有该科目的课，自动切到该科目开课的第一个学期
    if (STATE.data && STATE.mesoFilter.semester !== 'ALL') {
      const hasInSem = STATE.data.knowledgePoints.some(k => k.subject === val && matchesStageFocus(k.semester, STATE.mesoFilter.semester));
      if (!hasInSem) {
        const validSem = getFirstValidSemesterForSubject(val);
        STATE.mesoFilter.semester = validSem;
        STATE.stageFocus = validSem;
        renderStageControlBar();
        showToast(`💡 ${val}在【${validSem}】开课，已自动为您切换到 ${validSem}`);
      }
    }
  }
  if (key === 'viewMode') {
    if (val === 'depth_grouped') STATE.displayDimension = 'depth';
    if (val === 'year_grouped') STATE.displayDimension = 'year';
    renderStageControlBar();
  }
  renderMesoView();
}

function setMesoSemester(semVal) {
  setStageFocus(semVal);
}

function toggleCrossYearDepth() {
  STATE.mesoFilter.crossYearDepth = !STATE.mesoFilter.crossYearDepth;
  renderMesoView();
}

function jumpToSubjectMeso(subjName, isFutureSubj = false) {
  STATE.mesoFilter.subject = subjName;
  STATE.mesoFilter.status = 'ALL';
  STATE.mesoFilter.difficulty = 'ALL';
  if (isFutureSubj) {
    STATE.mesoFilter.semester = 'ALL';
    STATE.mesoFilter.viewMode = 'depth_grouped';
    STATE.mesoFilter.crossYearDepth = true;
    STATE.displayDimension = 'depth';
  } else {
    STATE.mesoFilter.viewMode = STATE.displayDimension === 'depth' ? 'depth_grouped' : 'year_grouped';
  }
  renderStageControlBar();
  switchTab('meso');
}

function jumpToDepthTierMeso(tierNum) {
  STATE.mesoFilter.subject = 'ALL';
  STATE.mesoFilter.difficulty = String(tierNum);
  STATE.mesoFilter.viewMode = 'depth_grouped';
  STATE.mesoFilter.crossYearDepth = false;
  STATE.displayDimension = 'depth';
  renderStageControlBar();
  switchTab('meso');
}

function jumpToSemesterMeso(sem) {
  STATE.mesoFilter.subject = 'ALL';
  STATE.mesoFilter.semester = sem;
  STATE.mesoFilter.status = 'ALL';
  STATE.mesoFilter.viewMode = 'year_grouped';
  STATE.displayDimension = 'year';
  renderStageControlBar();
  switchTab('meso');
}

function filterMesoByStatus(statusKeyword) {
  STATE.mesoFilter.subject = 'ALL';
  STATE.mesoFilter.semester = 'ALL';
  STATE.mesoFilter.status = statusKeyword.replace(/^[🔴🟡🟢⚪]/, '');
  STATE.mesoFilter.viewMode = 'year_grouped';
  switchTab('meso');
}

function handleGlobalSearch(val) {
  STATE.mesoFilter.search = val;
  if (val.trim() && STATE.activeTab !== 'meso') {
    STATE.mesoFilter.subject = 'ALL';
    STATE.mesoFilter.semester = 'ALL';
    STATE.mesoFilter.status = 'ALL';
    switchTab('meso');
  } else if (STATE.activeTab === 'meso') {
    renderMesoView();
  }
}

async function quickUpdateStatus(kpId, newStatus) {
  if (STATE.data) {
    const targetKp = STATE.data.knowledgePoints.find(k => k.id === kpId);
    if (targetKp && (targetKp.isUnverified || (targetKp.status || '').includes('🔒待精校'))) {
      showToast('🔒 本课属于高年级待精校预习章节，当前已锁定状态，暂不开放打卡修改');
      return;
    }
  }
  const days = newStatus.includes('未掌握') ? 1 : newStatus.includes('复习中') ? 3 : 15;
  const nextReview = addDaysISO(days);
  try {
    const res = await fetch('/api/update-point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kpId, status: newStatus, nextReview })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (newStatus.includes('已吃透')) {
      burstMagicConfetti();
      setHuyisiOutfit('victory');
      showToast(`🎉 狐伊丝欢呼：恭喜若婷学姐成功封印「${kpId}」！星辉魔力 +120 ✨（已同步至 Obsidian）`);
    } else {
      showToast(`✅ 已将「${kpId}」更新为 ${newStatus}（下次复查：${nextReview}），已同步写回 Obsidian！`);
    }
    await reloadVaultData(false);
  } catch (err) {
    showToast('❌ 更新失败：' + err.message);
  }
}

async function saveMicroDrawerChanges(kpId) {
  if (STATE.data) {
    const targetKp = STATE.data.knowledgePoints.find(k => k.id === kpId);
    if (targetKp && (targetKp.isUnverified || (targetKp.status || '').includes('🔒待精校'))) {
      showToast('🔒 本课属于高年级待精校预习章节，当前已锁定状态，暂不开放打卡修改');
      return;
    }
  }
  const status = document.getElementById('formStatus').value;
  const nextReview = document.getElementById('formNextReview').value;
  const lastTested = document.getElementById('formLastTested').value;
  const errorReason = document.getElementById('formErrorReason').value;
  const newRecord = document.getElementById('formNewRecord').value;

  try {
    const res = await fetch('/api/update-point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kpId, status, nextReview, lastTested, errorReason, newRecord })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (status && status.includes('已吃透')) {
      burstMagicConfetti();
      setHuyisiOutfit('victory');
    }
    showToast('💾 魔法卷轴已成功写回 Obsidian 知识库：' + json.relPath);
    await reloadVaultData(false);
    openMicroDrawer(kpId);
  } catch (err) {
    showToast('❌ 保存失败：' + err.message);
  }
}

// ============================================================================
// 🦊 真·狐伊丝陪学 · 四合一互动学习舱 (Learn闯关 / 3D闪卡 / Match消消乐 / Scratch积木拆解)
// ============================================================================

function formatDurationSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startQuizStopwatch() {
  stopQuizStopwatch();
  STATE.quiz.timerHandle = setInterval(() => {
    if (!STATE.quiz.isOpen || STATE.quiz.finished) return;
    STATE.quiz.questionElapsedSec += 1;
    STATE.quiz.totalElapsedSec += 1;
    if (STATE.quiz.studyStyle === 'match' && STATE.quiz.matchGame.matchedPairIds.length < STATE.quiz.matchGame.totalPairs) {
      STATE.quiz.matchGame.elapsedSec += 1;
      const mTimerEl = document.getElementById('matchGameTimer');
      if (mTimerEl) mTimerEl.textContent = formatDurationSec(STATE.quiz.matchGame.elapsedSec);
    }
    const qTimerEl = document.getElementById('quizQuestionTimer');
    const tTimerEl = document.getElementById('quizTotalTimer');
    if (qTimerEl) qTimerEl.textContent = formatDurationSec(STATE.quiz.questionElapsedSec);
    if (tTimerEl) tTimerEl.textContent = formatDurationSec(STATE.quiz.totalElapsedSec);
  }, 1000);
}

function stopQuizStopwatch() {
  if (STATE.quiz.timerHandle) {
    clearInterval(STATE.quiz.timerHandle);
    STATE.quiz.timerHandle = null;
  }
}

function openHuyisiQuizModal(defaultSubject, defaultMode, defaultStyle) {
  if (!STATE.data) return;
  playCommercialSound('open');
  // 升级 4：严格同步上一级页面的学年学期
  const upperSem = STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus;
  STATE.quiz.semester = upperSem;
  const activeNames = getActiveSubjectNamesForStage(upperSem);

  if (defaultSubject) {
    STATE.quiz.subject = defaultSubject;
  } else if (STATE.quiz.subject !== 'ACTIVE_ALL' && !activeNames.includes(STATE.quiz.subject)) {
    STATE.quiz.subject = activeNames.includes(STATE.homeSelectedSubject) ? STATE.homeSelectedSubject : 'ACTIVE_ALL';
  }
  if (defaultMode) STATE.quiz.mode = defaultMode;
  if (defaultStyle) STATE.quiz.studyStyle = defaultStyle;
  STATE.quiz.sourceContext = { type: 'GLOBAL' };
  STATE.quiz.isOpen = true;

  if (STATE.quiz.studyStyle === 'dictation') {
    initDictationQueueForSubject(STATE.quiz.subject === 'ACTIVE_ALL' ? '英语' : STATE.quiz.subject, true);
  } else {
    buildQuizQueue();
  }
  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
}

function openDictationModal(subjName) {
  if (!STATE.data) return;
  playCommercialSound('open');
  const upperSem = STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus;
  STATE.quiz.semester = upperSem;
  STATE.quiz.subject = subjName || STATE.homeSelectedSubject || '英语';
  STATE.quiz.studyStyle = 'dictation';
  STATE.quiz.sourceContext = { type: 'DICTATION', subject: STATE.quiz.subject };
  STATE.quiz.isOpen = true;

  initDictationQueueForSubject(STATE.quiz.subject, true);
  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
  setTimeout(() => playCurrentDictationAudio(), 220);
}

function initDictationQueueForSubject(subjName, doShuffle = true) {
  const targetSubj = (!subjName || subjName === 'ACTIVE_ALL' || subjName === 'ALL') ? '英语' : subjName;
  const rawBank = getDictationItemsForSubject(targetSubj, STATE.quiz.semester).slice();
  if (doShuffle) {
    for (let i = rawBank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawBank[i], rawBank[j]] = [rawBank[j], rawBank[i]];
    }
  }
  // 每次随机抽取 6～8 个词条进行听写
  const batchCount = Math.min(rawBank.length, 6 + (Math.floor(Math.random() * 3)));
  STATE.quiz.dictation = {
    items: rawBank.slice(0, Math.max(6, batchCount)),
    currentIndex: 0,
    userInput: '',
    submitted: false,
    isCorrect: false,
    showSyllableHint: true,
    results: [],
    finished: false
  };
}

function playCurrentDictationAudio() {
  const d = STATE.quiz.dictation;
  if (!d || !d.items || !d.items[d.currentIndex]) return;
  const item = d.items[d.currentIndex];
  if (item.voice && item.voice.startsWith('en-')) {
    speakText(item.word, '英语单词发音');
  } else {
    speakText(`${item.cn}。请默写关键词`, '听写提示');
  }
}

function handleDictationInputChange(val) {
  if (!STATE.quiz.dictation || STATE.quiz.dictation.submitted) return;
  STATE.quiz.dictation.userInput = val;
}

function appendDictationLetter(ch) {
  if (!STATE.quiz.dictation || STATE.quiz.dictation.submitted) return;
  playCommercialSound('click');
  STATE.quiz.dictation.userInput = (STATE.quiz.dictation.userInput || '') + ch;
  const inp = document.getElementById('dictationInputField');
  if (inp) {
    inp.value = STATE.quiz.dictation.userInput;
    inp.focus();
  }
}

function clearDictationInput() {
  if (!STATE.quiz.dictation || STATE.quiz.dictation.submitted) return;
  playCommercialSound('click');
  STATE.quiz.dictation.userInput = '';
  const inp = document.getElementById('dictationInputField');
  if (inp) {
    inp.value = '';
    inp.focus();
  }
}

function toggleDictationSyllableHint() {
  playCommercialSound('click');
  STATE.quiz.dictation.showSyllableHint = !STATE.quiz.dictation.showSyllableHint;
  renderQuizModal();
}

function submitDictationAnswer() {
  const d = STATE.quiz.dictation;
  if (!d || d.submitted) return;
  const item = d.items[d.currentIndex];
  if (!item) return;
  const inp = document.getElementById('dictationInputField');
  const rawInput = (inp ? inp.value : d.userInput || '').trim();
  if (!rawInput) {
    showToast('请先输入或点击下方字母拼写答案哦~');
    return;
  }
  d.userInput = rawInput;
  const cleanUser = rawInput.toLowerCase().replace(/\s+/g, ' ');
  const cleanTarget = item.word.toLowerCase().replace(/\s+/g, ' ');
  const alts = Array.isArray(item.acceptAlt) ? item.acceptAlt.map(a => a.toLowerCase().trim()) : [];
  const isRight = cleanUser === cleanTarget || alts.includes(cleanUser);

  d.submitted = true;
  d.isCorrect = isRight;
  d.results.push({
    item,
    userAnswer: rawInput,
    isCorrect: isRight
  });
  recordDailyQuestionDone();

  if (isRight) {
    STATE.comboStreak = (STATE.comboStreak || 0) + 1;
    playCommercialSound(STATE.comboStreak >= 2 ? 'combo' : 'mastered');
    spawnCandyCalloutBanner(STATE.comboStreak, 'PERFECT SPELL!');
    burstMagicConfetti();
  } else {
    STATE.comboStreak = 0;
    playCommercialSound('wrong');
  }
  renderQuizModal();
}

function nextDictationItem() {
  const d = STATE.quiz.dictation;
  if (!d) return;
  playCommercialSound('click');
  if (d.currentIndex < d.items.length - 1) {
    d.currentIndex += 1;
    d.userInput = '';
    d.submitted = false;
    d.isCorrect = false;
    renderQuizModal();
    setTimeout(() => playCurrentDictationAudio(), 180);
  } else {
    d.finished = true;
    if (Array.isArray(d.results) && d.results.length > 0) {
      const rightCnt = d.results.filter(r => r.isCorrect).length;
      const pct = Math.round((rightCnt / d.results.length) * 100);
      const campId = `CAMP_DICT_${STATE.quiz.subject || '英语'}`;
      recordSpecialCampCompletion(campId, pct);
    }
    playCommercialSound('victory');
    renderQuizModal();
  }
}

function setQuizSemester(semCode) {
  playCommercialSound('click');
  STATE.quiz.semester = semCode;
  STATE.stageFocus = semCode;
  persistSelectedSemester(semCode);
  const activeNames = getActiveSubjectNamesForStage(semCode);
  if (STATE.quiz.subject !== 'ACTIVE_ALL' && !activeNames.includes(STATE.quiz.subject)) {
    STATE.quiz.subject = 'ACTIVE_ALL';
  }
  STATE.quiz.sourceContext = { type: 'GLOBAL' };
  if (STATE.quiz.studyStyle === 'dictation') {
    initDictationQueueForSubject(STATE.quiz.subject, true);
  }
  buildQuizQueue();
  renderQuizModal();
  if (STATE.activeTab === 'macro') renderMacroView();
}

function toggleQuizSchoolProgressFilter() {
  playCommercialSound('click');
  STATE.schoolProgressFilter = STATE.schoolProgressFilter === 'TAUGHT_AND_CURRENT' ? 'ALL' : 'TAUGHT_AND_CURRENT';
  buildQuizQueue();
  renderQuizModal();
}

function closeHuyisiQuizModal(e) {
  if (e && e.target && e.target.id !== 'quizModalBackdrop') return;
  stopSpeakText(true);
  playCommercialSound('close');
  STATE.quiz.isOpen = false;
  STATE.quiz._savedQuestQueue = null;
  STATE.quiz._savedMixedQueue = null;
  if (typeof window !== 'undefined' && window.ARCHETYPE_STATE) {
    window.ARCHETYPE_STATE.activeSopBanner = '';
  }
  stopQuizStopwatch();
  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.remove('open');
}

function buildDeduplicatedKpQueue(rawQueue, targetCount = 6) {
  const unique = [];
  const seen = new Set();
  for (const item of (rawQueue || [])) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }
  if (unique.length < targetCount && STATE.data && unique[0]) {
    const first = unique[0];
    const sameChap = STATE.data.knowledgePoints.filter(
      k => k.subject === first.subject && k.semester === first.semester && k.chapter === first.chapter && !seen.has(k.id) && !k.isUnverified
    );
    const sameSem = STATE.data.knowledgePoints.filter(
      k => k.subject === first.subject && k.semester === first.semester && !seen.has(k.id) && !k.isUnverified
    );
    for (const cand of [...sameChap, ...sameSem]) {
      if (!seen.has(cand.id)) {
        seen.add(cand.id);
        unique.push(cand);
        if (unique.length >= targetCount) break;
      }
    }
  }
  return unique;
}

function buildFormatFilteredSubQuestionQueue(baseQueue, fmt, targetCount = 6) {
  if (fmt !== 'CHOICE' && fmt !== 'TF') return baseQueue;
  const out = [];
  const seenKeys = new Set();
  const seenKps = [];
  const seenKpIds = new Set();

  for (const item of (baseQueue || [])) {
    if (item && item.id && !seenKpIds.has(item.id)) {
      seenKpIds.add(item.id);
      seenKps.push(item);
    }
  }
  if (STATE.data && seenKps[0]) {
    const first = seenKps[0];
    const peers = STATE.data.knowledgePoints.filter(
      k => k.subject === first.subject && k.semester === first.semester && !seenKpIds.has(k.id) && !k.isUnverified
    );
    // Prioritize same chapter first
    peers.sort((a, b) => (a.chapter === first.chapter ? 0 : 1) - (b.chapter === first.chapter ? 0 : 1));
    for (const p of peers) {
      seenKpIds.add(p.id);
      seenKps.push(p);
      if (seenKps.length >= 8) break;
    }
  }

  for (const kp of seenKps) {
    const bank = Array.isArray(kp.quizItems) ? kp.quizItems : [];
    bank.forEach((qItem, idx) => {
      if (qItem && qItem.type === fmt && out.length < targetCount) {
        const uKey = `${kp.id}__${qItem.prompt}`;
        if (!seenKeys.has(uKey)) {
          seenKeys.add(uKey);
          out.push(Object.assign({}, kp, {
            _subQuizItem: qItem,
            _subQIndex: idx + 1,
            _subQTotal: bank.length
          }));
        }
      }
    });
    if (out.length >= targetCount) break;
  }
  return out.length > 0 ? out : baseQueue;
}

function switchQuizStudyStyle(style) {
  playCommercialSound('tab');
  const q = STATE.quiz;
  if ((style === 'flashcard' || style === 'blocks') && q.studyStyle === 'quest') {
    q._savedQuestQueue = q.queue.slice();
    q.queue = buildDeduplicatedKpQueue(q.queue, 6);
    q.currentIndex = 0;
  } else if (style === 'quest' && q._savedQuestQueue && q._savedQuestQueue.length > 0) {
    q.queue = q._savedQuestQueue.slice();
    q._savedQuestQueue = null;
    q.currentIndex = 0;
  }
  q.studyStyle = style;
  q.flashcardFlipped = false;
  q.unlockedBlockStep = 1;
  if (style === 'dictation') {
    initDictationQueueForSubject(q.subject === 'ACTIVE_ALL' ? '英语' : q.subject, true);
    renderQuizModal();
    setTimeout(() => playCurrentDictationAudio(), 180);
    return;
  }
  if (style === 'match' && (!q.matchGame.tiles || q.matchGame.tiles.length === 0)) {
    initMatchGameFromQueue();
  }
  renderQuizModal();
}

function flipFlashcard() {
  playCommercialSound('flip');
  STATE.quiz.flashcardFlipped = !STATE.quiz.flashcardFlipped;
  const inner = document.getElementById('flashcard3dInner');
  if (inner) {
    inner.classList.toggle('is-flipped', STATE.quiz.flashcardFlipped);
  } else {
    renderQuizModal();
  }
}

function unlockNextScratchBlock(stepNum) {
  playCommercialSound('tab');
  if (stepNum > STATE.quiz.unlockedBlockStep) {
    STATE.quiz.unlockedBlockStep = stepNum;
  }
  if (stepNum >= 4) {
    STATE.quiz.answerRevealed = true;
  }
  renderQuizModal();
}

function initMatchGameFromQueue() {
  if (!STATE.data) return;
  const q = STATE.quiz;
  const uniqueQueue = [];
  if (Array.isArray(q.queue)) {
    for (const item of q.queue) {
      if (item && !uniqueQueue.some(u => u.id === item.id)) {
        uniqueQueue.push(item);
      }
    }
  }
  let sourceList = uniqueQueue.length >= 3 ? uniqueQueue.slice(0, 6) : uniqueQueue.slice();
  if (sourceList.length < 6) {
    const firstKp = sourceList[0] || STATE.data.knowledgePoints[0];
    const sameSemSubj = STATE.data.knowledgePoints.filter(
      k => firstKp && k.subject === firstKp.subject && k.semester === firstKp.semester && !sourceList.some(s => s.id === k.id)
    );
    const fallbackAll = STATE.data.knowledgePoints.filter(k => !sourceList.some(s => s.id === k.id));
    const extra = [...sameSemSubj, ...fallbackAll].slice(0, 6 - sourceList.length);
    sourceList = [...sourceList, ...extra];
  }

  const tiles = [];
  sourceList.forEach(kp => {
    const rawClue = kp.mnemonic || kp.understanding || kp.errorReason || '抓准定义与符号边界，分步验算';
    const shortClue = rawClue.length > 52 ? rawClue.slice(0, 50) + '…' : rawClue;
    tiles.push({
      tileId: `term_${kp.id}`,
      pairId: kp.id,
      kind: 'term',
      badge: `考点 #${kp.order}`,
      text: kp.corePoint
    });
    tiles.push({
      tileId: `def_${kp.id}`,
      pairId: kp.id,
      kind: 'def',
      badge: '秒杀口诀 / 精髓',
      text: shortClue
    });
  });

  // Fisher-Yates 洗牌
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  q.matchGame.tiles = tiles;
  q.matchGame.selectedTileId = null;
  q.matchGame.wrongTileIds = [];
  q.matchGame.matchedPairIds = [];
  q.matchGame.totalPairs = sourceList.length;
  q.matchGame.elapsedSec = 0;
}

function handleMatchTileClick(tileId) {
  const mg = STATE.quiz.matchGame;
  const clicked = mg.tiles.find(t => t.tileId === tileId);
  if (!clicked) return;
  if (mg.matchedPairIds.includes(clicked.pairId)) return;
  if (mg.wrongTileIds.length > 0) return;

  if (!mg.selectedTileId) {
    mg.selectedTileId = tileId;
    renderQuizModal();
    return;
  }

  if (mg.selectedTileId === tileId) {
    mg.selectedTileId = null;
    renderQuizModal();
    return;
  }

  const first = mg.tiles.find(t => t.tileId === mg.selectedTileId);
  if (!first) {
    mg.selectedTileId = tileId;
    renderQuizModal();
    return;
  }

  if (first.pairId === clicked.pairId && first.tileId !== clicked.tileId) {
    // 配对成功！
    mg.matchedPairIds.push(clicked.pairId);
    mg.selectedTileId = null;
    STATE.comboStreak = (STATE.comboStreak || 0) + 1;
    spawnFloatingFeedback(
      STATE.lastClickCoords.x,
      STATE.lastClickCoords.y,
      `✨ 配对成功! (${mg.matchedPairIds.length}/${mg.totalPairs})`,
      true
    );
    if (mg.matchedPairIds.length >= mg.totalPairs) {
      playCommercialSound('victory');
      spawnCandyCalloutBanner(6, 'SUGAR CLEAR!');
      burstMagicConfetti();
      recordDailyQuestionDone();
      if (!mg.bestSec || mg.elapsedSec < mg.bestSec) {
        mg.bestSec = mg.elapsedSec;
      }
      showToast(`太酷啦！${mg.totalPairs} 组考点口诀全部配对成功，用时 ${mg.elapsedSec} 秒！`);
      if (STATE.activeTab === 'macro') renderMacroView();
    } else {
      playCommercialSound('combo');
      spawnCandyCalloutBanner(STATE.comboStreak);
    }
    renderQuizModal();
  } else {
    // 配对不匹配，温和轻晃提示（零扣分）
    STATE.comboStreak = 0;
    playCommercialSound('wrong');
    spawnFloatingFeedback(STATE.lastClickCoords.x, STATE.lastClickCoords.y, '💡 再试一次~', false);
    mg.wrongTileIds = [first.tileId, clicked.tileId];
    mg.selectedTileId = null;
    renderQuizModal();
    setTimeout(() => {
      STATE.quiz.matchGame.wrongTileIds = [];
      renderQuizModal();
    }, 550);
  }
}

function launchDaily25MinRoutine() {
  if (!STATE.data) return;
  playCommercialSound('open');
  STATE.stageFocus = '初一上';
  STATE.quiz.semester = '初一上';
  STATE.quiz.subject = 'ACTIVE_ALL';
  STATE.quiz.mode = 'SMART';
  STATE.quiz.studyStyle = 'quest';
  STATE.quiz.sourceContext = { type: 'DAILY_25MIN_LOOP' };
  STATE.quiz.isOpen = true;
  buildQuizQueue();
  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  startQuizStopwatch();
  renderQuizModal();
  showToast('🎯 已启动【今日 25 分钟放学闭环】：优先清扫到期错题与初一上同步闯关！');
}

function buildQuizQueue() {
  if (!STATE.data) return;
  const q = STATE.quiz;
  const allKps = STATE.data.knowledgePoints.filter(k => !k.isUnverified && !(k.status || '').includes('🔒待精校') && countKpQuestions(k) > 0);
  let targetSem = q.semester || (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus);
  let activeNames = getActiveSubjectNamesForStage(targetSem);

  // 1. 严格按照所选学年学期 (targetSem) 与在读科目筛选已精校候选池（严禁跨科静默 fallback 到语文）
  let pool = allKps.filter(k => {
    if (q.scope === 'STAGE' && !matchesStageFocus(k.semester, targetSem)) return false;
    if (q.subject === 'ACTIVE_ALL') {
      return activeNames.includes(k.subject);
    }
    if (q.subject !== 'ALL') {
      return k.subject === q.subject;
    }
    return true;
  });

  if (pool.length === 0) {
    const reqLabel = `${targetSem}${q.subject && q.subject !== 'ACTIVE_ALL' && q.subject !== 'ALL' ? '·' + q.subject : ''}`;
    showToast(`🔒 【${reqLabel}】属于高年级待精校预习章节，暂不开放自动刷题，已自动切回【初一上】已精校在读题库！`);
    targetSem = '初一上';
    q.semester = '初一上';
    STATE.stageFocus = '初一上';
    activeNames = getActiveSubjectNamesForStage('初一上');
    if (q.subject !== 'ACTIVE_ALL' && q.subject !== 'ALL' && !activeNames.includes(q.subject)) {
      q.subject = 'ACTIVE_ALL';
    }
    pool = allKps.filter(k => k.semester === '初一上' && (q.subject === 'ACTIVE_ALL' || q.subject === 'ALL' ? activeNames.includes(k.subject) : k.subject === q.subject));
  }

  // 1.5 按学校统一教学进度过滤（默认仅测学校已授完+本周同步进度，避免抽到期末未讲课节）
  if (STATE.schoolProgressFilter === 'TAUGHT_AND_CURRENT') {
    const taughtPool = pool.filter(k => {
      const p = getSchoolTeachingProgress(k, pool.filter(x => x.subject === k.subject));
      return p.code === 'TAUGHT' || p.code === 'CURRENT';
    });
    if (taughtPool.length > 0) pool = taughtPool;
  }

  // 2. 按考察模式过滤或排序
  if (q.mode === 'WEAK_ONLY') {
    const weakPool = pool.filter(k => !k.status.includes('已吃透'));
    if (weakPool.length > 0) pool = weakPool;
  } else if (q.mode === 'L1') {
    const l1 = pool.filter(k => getDepthTier(k.difficulty) === 1);
    if (l1.length > 0) pool = l1;
  } else if (q.mode === 'L2') {
    const l2 = pool.filter(k => getDepthTier(k.difficulty) === 2);
    if (l2.length > 0) pool = l2;
  } else if (q.mode === 'L3') {
    const l3 = pool.filter(k => getDepthTier(k.difficulty) === 3);
    if (l3.length > 0) pool = l3;
  }

  // 排序权重：SMART 模式下优先 🔴未掌握(0) ➔ 🟡复习中(1) ➔ ⚪待考察(2) ➔ 🟢已吃透(3)
  if (q.mode === 'SMART' || q.mode === 'WEAK_ONLY') {
    const statusWeight = (st) => {
      if (st.includes('未掌握')) return 0;
      if (st.includes('复习中')) return 1;
      if (st.includes('待考察')) return 2;
      return 3;
    };
    pool = pool.slice().sort((a, b) => {
      const wa = statusWeight(a.status);
      const wb = statusWeight(b.status);
      if (wa !== wb) return wa - wb;
      return a.order - b.order;
    });
  } else {
    pool = pool.slice().sort((a, b) => a.order - b.order);
  }

  if (q.studyStyle === 'quest' || !q.studyStyle) {
    // 每次从重点候选课池（前8课）的题库中随机抽取 6～8 道题
    const topLessons = pool.slice(0, Math.min(8, pool.length));
    q.queue = sampleRandomQuestionsFromKps(topLessons, 6, 8);
  } else {
    q.queue = pool.slice(0, 7);
  }
  q.currentIndex = 0;
  q.qVariant = 'main';
  q.hintsShown = { h1: false, h2: false, h3: false };
  q.answerRevealed = false;
  q.flashcardFlipped = false;
  q.unlockedBlockStep = 1;
  q.selectedChoiceIdx = null;
  q.choiceSubmitted = false;
  q.choiceIsCorrect = null;
  q.questionElapsedSec = 0;
  q.totalElapsedSec = 0;
  q.results = [];
  q.finished = false;
  initMatchGameFromQueue();
}

function setQuizSetting(key, val) {
  STATE.quiz[key] = key === 'batchSize' ? Number(val) : val;
  STATE.quiz.sourceContext = { type: 'GLOBAL' };
  if (STATE.quiz.studyStyle === 'dictation' && key === 'subject') {
    initDictationQueueForSubject(val === 'ACTIVE_ALL' ? '英语' : val, true);
    renderQuizModal();
    return;
  }
  buildQuizQueue();
  renderQuizModal();
}

function setRapidFormat(fmt) {
  playCommercialSound('click');
  const q = STATE.quiz;
  if (!q._savedMixedQueue || q._savedMixedQueue.length === 0) {
    q._savedMixedQueue = q.queue.slice();
  }
  if (fmt === 'OPEN') {
    q.queue = buildDeduplicatedKpQueue(q._savedMixedQueue, 6);
    q.currentIndex = 0;
  } else if (fmt === 'CHOICE' || fmt === 'TF') {
    q.queue = buildFormatFilteredSubQuestionQueue(q._savedMixedQueue, fmt, 6);
    q.currentIndex = 0;
  } else if (fmt === 'MIXED' && q._savedMixedQueue) {
    q.queue = q._savedMixedQueue.slice();
    q.currentIndex = Math.min(q.currentIndex, Math.max(0, q.queue.length - 1));
  }
  q.rapidFormat = fmt;
  q.selectedChoiceIdx = null;
  q.choiceSubmitted = false;
  q.choiceIsCorrect = null;
  q.answerRevealed = false;
  renderQuizModal();
}

function submitRapidChoice(ansVal) {
  const q = STATE.quiz;
  if (q.choiceSubmitted) return;
  const kp = q.queue[q.currentIndex];
  if (!kp || kp.isUnverified || (kp.status || '').includes('🔒待精校')) return;

  const item = buildRapidQuizItem(kp, q.currentIndex, q.rapidFormat || 'MIXED');
  if (!item) return;
  const isRight = item.type === 'TF' ? (ansVal === item.tfCorrect) : (Number(ansVal) === item.correctIdx);

  q.selectedChoiceIdx = ansVal;
  q.choiceSubmitted = true;
  q.choiceIsCorrect = isRight;

  const singleQStatus = isRight ? '🟢已吃透' : '🔴未掌握';
  recordDailyQuestionDone();

  // 记录本轮每道小题结果并按同一知识点(kp.id)本轮综合正确率判定状态（防止单课6题第6题覆盖前5题）
  const qKey = `${kp.id}__${kp._subQIndex || q.currentIndex}__${q.currentIndex}`;
  const existingIdx = q.results.findIndex(r => r.qKey === qKey);
  const rec = {
    qKey,
    kp,
    isRight,
    prompt: item.prompt || '',
    qType: item.type || 'CHOICE',
    status: singleQStatus,
    elapsedSec: q.questionElapsedSec,
    usedHints: 0
  };
  if (existingIdx >= 0) q.results[existingIdx] = rec;
  else q.results.push(rec);

  // 计算同一 kp.id 在本轮已答小题中的综合正确率（>=80% 已吃透，50%~79% 复习中，<50% 未掌握）
  const sameKpRecs = q.results.filter(r => r.kp && r.kp.id === kp.id);
  const rightCountForKp = sameKpRecs.filter(r => r.isRight !== undefined ? r.isRight : r.status.includes('已吃透')).length;
  const accRatio = rightCountForKp / Math.max(1, sameKpRecs.length);
  const aggregatedKpStatus = sameKpRecs.length === 1
    ? singleQStatus
    : (accRatio >= 0.8 ? '🟢已吃透' : accRatio >= 0.5 ? '🟡复习中' : '🔴未掌握');

  kp.status = aggregatedKpStatus;
  if (STATE.data && Array.isArray(STATE.data.knowledgePoints)) {
    const masterKp = STATE.data.knowledgePoints.find(x => x.id === kp.id);
    if (masterKp) masterKp.status = aggregatedKpStatus;
  }

  const days = aggregatedKpStatus.includes('已吃透') ? 15 : aggregatedKpStatus.includes('复习中') ? 3 : 1;
  fetch('/api/update-point', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: kp.id,
      status: aggregatedKpStatus,
      nextReview: addDaysISO(days),
      lastTested: new Date().toISOString().slice(0, 10),
      newRecord: `[快速${item.type === 'TF' ? '判断' : '选择'}闯关] 本课已答${rightCountForKp}/${sameKpRecs.length}题 | 综合判定为 ${aggregatedKpStatus}`
    })
  }).then(() => reloadVaultData(false)).catch(() => {});

  if (isRight) {
    STATE.comboStreak = (STATE.comboStreak || 0) + 1;
    playCommercialSound(STATE.comboStreak >= 2 ? 'combo' : 'mastered');
    spawnCandyCalloutBanner(STATE.comboStreak);
    spawnFloatingFeedback(
      STATE.lastClickCoords.x,
      STATE.lastClickCoords.y,
      STATE.comboStreak >= 2 ? `🍭 ${STATE.comboStreak}连消 Combo! +15✨` : '🍬 Sweet! 答对啦 +10✨',
      true
    );
    burstMagicConfetti();
  } else {
    STATE.comboStreak = 0;
    playCommercialSound('wrong');
    spawnFloatingFeedback(STATE.lastClickCoords.x, STATE.lastClickCoords.y, '💡 看下方解析掌握它~', false);
  }

  renderQuizModal();
}

function advanceAfterRapidChoice() {
  stopSpeakText(true);
  playCommercialSound('click');
  const q = STATE.quiz;
  if (q.currentIndex < q.queue.length - 1) {
    q.currentIndex += 1;
    q.qVariant = 'main';
    q.hintsShown = { h1: false, h2: false, h3: false };
    q.answerRevealed = false;
    q.flashcardFlipped = false;
    q.unlockedBlockStep = 1;
    q.selectedChoiceIdx = null;
    q.choiceSubmitted = false;
    q.choiceIsCorrect = null;
    q.questionElapsedSec = 0;
    renderQuizModal();
  } else {
    q.finished = true;
    if (q.sourceContext && q.sourceContext.type === 'SPECIAL' && q.sourceContext.campId && q.results.length > 0) {
      const rightCnt = q.results.filter(r => r.isRight !== undefined ? r.isRight : r.status.includes('已吃透')).length;
      const pct = Math.round((rightCnt / q.results.length) * 100);
      recordSpecialCampCompletion(q.sourceContext.campId, pct);
      STATE.specialStep = 3;
      if (STATE.activeTab === 'macro') renderMacroView();
    }
    playCommercialSound('victory');
    renderQuizModal();
  }
}

function toggleQuizVariant(variantKey) {
  STATE.quiz.qVariant = variantKey;
  renderQuizModal();
}

function toggleQuizHint(hintKey) {
  playCommercialSound('click');
  STATE.quiz.hintsShown[hintKey] = !STATE.quiz.hintsShown[hintKey];
  renderQuizModal();
}

function revealQuizAnswer() {
  playCommercialSound('flip');
  STATE.quiz.answerRevealed = true;
  renderQuizModal();
}

function toggleQuizScratchpad() {
  playCommercialSound('click');
  STATE.scratchpad.open = !STATE.scratchpad.open;
  renderQuizModal();
}

function setScratchpadPen(color, size = 3) {
  STATE.scratchpad.color = color;
  STATE.scratchpad.size = size;
  document.querySelectorAll('.scratch-pen-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
  });
}

function clearScratchpadCanvas() {
  const canvas = document.getElementById('quizScratchpadCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function initQuizScratchpadCanvas() {
  const canvas = document.getElementById('quizScratchpadCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(300, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(220 * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    };
  };

  canvas.onpointerdown = (e) => {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    lastX = p.x;
    lastY = p.y;
  };

  canvas.onpointermove = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    if (STATE.scratchpad.color === 'ERASER') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = STATE.scratchpad.color || '#0f172a';
      ctx.lineWidth = STATE.scratchpad.size || 3;
    }
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
  };

  const stopDraw = () => {
    drawing = false;
  };
  canvas.onpointerup = stopDraw;
  canvas.onpointercancel = stopDraw;
  canvas.onpointerleave = stopDraw;
}

function skipQuizQuestion() {
  stopSpeakText(true);
  playCommercialSound('click');
  const q = STATE.quiz;
  if (q.currentIndex < q.queue.length - 1) {
    q.currentIndex += 1;
    q.qVariant = 'main';
    q.hintsShown = { h1: false, h2: false, h3: false };
    q.answerRevealed = false;
    q.flashcardFlipped = false;
    q.unlockedBlockStep = 1;
    q.selectedChoiceIdx = null;
    q.choiceSubmitted = false;
    q.choiceIsCorrect = null;
    q.questionElapsedSec = 0;
    renderQuizModal();
  } else {
    q.finished = true;
    playCommercialSound('victory');
    renderQuizModal();
  }
}

function prevQuizQuestion() {
  stopSpeakText(true);
  playCommercialSound('click');
  const q = STATE.quiz;
  if (q.currentIndex > 0) {
    q.currentIndex -= 1;
    q.qVariant = 'main';
    q.hintsShown = { h1: false, h2: false, h3: false };
    q.answerRevealed = false;
    q.flashcardFlipped = false;
    q.unlockedBlockStep = 1;
    q.selectedChoiceIdx = null;
    q.choiceSubmitted = false;
    q.choiceIsCorrect = null;
    q.questionElapsedSec = 0;
    renderQuizModal();
  }
}

async function judgeAndNextQuizQuestion(newStatus) {
  const q = STATE.quiz;
  const kp = q.queue[q.currentIndex];
  if (!kp || kp.isUnverified || (kp.status || '').includes('🔒待精校')) return;

  const elapsed = q.questionElapsedSec;
  const usedHints = (q.hintsShown.h1 ? 1 : 0) + (q.hintsShown.h2 ? 1 : 0) + (q.hintsShown.h3 ? 1 : 0);

  // 记录今日轻量化小目标进度（Duolingo 激励）
  recordDailyQuestionDone();

  // 记录本轮结果
  const existingIdx = q.results.findIndex(r => r.kp.id === kp.id);
  const rec = { kp, status: newStatus, elapsedSec: elapsed, usedHints };
  if (existingIdx >= 0) q.results[existingIdx] = rec;
  else q.results.push(rec);

  // 本地即时更新状态并异步写回 Obsidian
  kp.status = newStatus;
  const days = newStatus.includes('未掌握') ? 1 : newStatus.includes('复习中') ? 3 : 15;
  const nextReview = addDaysISO(days);
  const todayStr = new Date().toISOString().slice(0, 10);
  const modeLabel = q.studyStyle === 'flashcard' ? '3D闪卡' : q.studyStyle === 'blocks' ? '积木拆解' : '闯关快测';
  const autoNote = `[狐伊丝·${modeLabel}] 用时 ${elapsed}秒 | 锦囊×${usedHints} | 判定为 ${newStatus}`;

  fetch('/api/update-point', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: kp.id,
      status: newStatus,
      nextReview,
      lastTested: todayStr,
      newRecord: autoNote
    })
  }).then(() => {
    reloadVaultData(false);
  }).catch(err => console.warn('Quiz sync warning:', err));

  if (newStatus.includes('已吃透')) {
    playCommercialSound('mastered');
    burstMagicConfetti();
    showToast(`🟢 太棒啦！「${kp.corePoint}」已点亮为【👑已精通】，自动进入下一关 ✨`);
  } else if (newStatus.includes('复习中')) {
    playCommercialSound('click');
    showToast(`🟡 「${kp.corePoint}」已记为【⭐练习中（3天后巩固）】，继续下一关！`);
  } else {
    playCommercialSound('click');
    showToast(`🎯 「${kp.corePoint}」已加入【待突破清单】，做错不扣分，继续下一关！`);
  }

  if (q.currentIndex < q.queue.length - 1) {
    q.currentIndex += 1;
    q.qVariant = 'main';
    q.hintsShown = { h1: false, h2: false, h3: false };
    q.answerRevealed = false;
    q.flashcardFlipped = false;
    q.unlockedBlockStep = 1;
    q.selectedChoiceIdx = null;
    q.choiceSubmitted = false;
    q.choiceIsCorrect = null;
    q.questionElapsedSec = 0;
    renderQuizModal();
  } else {
    q.finished = true;
    playCommercialSound('victory');
    renderQuizModal();
  }
}

function retryWeakFromQuizSummary() {
  const q = STATE.quiz;
  const weakList = q.results.filter(r => !r.status.includes('已吃透')).map(r => r.kp);
  if (weakList.length === 0) {
    buildQuizQueue();
  } else {
    q.queue = weakList;
    q.currentIndex = 0;
    q.qVariant = 'main';
    q.hintsShown = { h1: false, h2: false, h3: false };
    q.answerRevealed = false;
    q.flashcardFlipped = false;
    q.unlockedBlockStep = 1;
    q.selectedChoiceIdx = null;
    q.choiceSubmitted = false;
    q.choiceIsCorrect = null;
    q.questionElapsedSec = 0;
    q.totalElapsedSec = 0;
    q.results = [];
    q.finished = false;
  }
  renderQuizModal();
}

function renderQuizModal() {
  const card = document.getElementById('quizModalCard') || document.getElementById('quizModalContent');
  if (!card || !STATE.data) return;

  const q = STATE.quiz;
  const curQuizSem = q.semester || (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus);
  const stageOpt = STAGE_OPTIONS.find(o => o.code === curQuizSem) || STAGE_OPTIONS[0];
  const activeNames = getActiveSubjectNamesForStage(curQuizSem);
  const eightSemesters = STAGE_OPTIONS.filter(o => o.code !== 'ALL');

  const semOptionsHtml = eightSemesters.map(opt =>
    `<option value="${opt.code}" ${opt.code === curQuizSem ? 'selected' : ''}>📅 ${opt.shortLabel}</option>`
  ).join('');

  const subjOptionsHtml = [
    `<option value="ACTIVE_ALL" ${q.subject === 'ACTIVE_ALL' ? 'selected' : ''}>${stageOpt.pillLabel}在读 (${activeNames.length}科)</option>`,
    ...STATE.data.subjects
      .filter(s => activeNames.includes(s.name) || q.subject === s.name)
      .map(s => `<option value="${s.name}" ${q.subject === s.name ? 'selected' : ''}>${s.name}</option>`)
  ].join('');

  // 顶部极简模式切换（主显 ⚡闯关 与 🎧听写，将闪卡/配对/分步收纳至次级折叠菜单）
  const modeTabsHtml = `
    <div class="quiz-mode-switcher-tabs" style="display:inline-flex;align-items:center;gap:4px;">
      <button class="quiz-mode-tab ${q.studyStyle === 'quest' ? 'active' : ''}" onclick="switchQuizStudyStyle('quest')">
        ${uiIcon('bolt', 15)} <span>闯关</span>
      </button>
      <button class="quiz-mode-tab ${q.studyStyle === 'dictation' ? 'active' : ''}" onclick="switchQuizStudyStyle('dictation')">
        🎧 <span>听写</span>
      </button>
      <details class="quiz-more-modes-dropdown" style="position:relative;display:inline-block;">
        <summary class="quiz-mode-tab ${['flashcard','match','blocks'].includes(q.studyStyle) ? 'active' : ''}" style="list-style:none;cursor:pointer;">
          <span>🎮 辅助模式 ▾</span>
        </summary>
        <div style="position:absolute;top:110%;left:0;z-index:99;background:#1e1b4b;border:1px solid rgba(255,255,255,0.25);border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;min-width:110px;box-shadow:0 8px 20px rgba(0,0,0,0.35);">
          <button class="quiz-mode-tab ${q.studyStyle === 'flashcard' ? 'active' : ''}" onclick="switchQuizStudyStyle('flashcard')">
            ${uiIcon('cards', 14)} <span>闪卡速记</span>
          </button>
          <button class="quiz-mode-tab ${q.studyStyle === 'match' ? 'active' : ''}" onclick="switchQuizStudyStyle('match')">
            ${uiIcon('grid', 14)} <span>配对消消乐</span>
          </button>
          <button class="quiz-mode-tab ${q.studyStyle === 'blocks' ? 'active' : ''}" onclick="switchQuizStudyStyle('blocks')">
            ${uiIcon('steps', 14)} <span>分步拆解</span>
          </button>
        </div>
      </details>
    </div>
  `;

  // 若已完成本轮所有弹出题（且非消消乐/听写模式），渲染极简通关成绩单
  if ((q.finished || q.queue.length === 0) && q.studyStyle !== 'match' && q.studyStyle !== 'dictation') {
    const cntGreen = q.results.filter(r => r.status.includes('已吃透')).length;
    const cntYellow = q.results.filter(r => r.status.includes('复习中')).length;
    const cntRed = q.results.filter(r => r.status.includes('未掌握')).length;

    const resultRowsHtml = q.results.map((r, idx) => {
      const subPrompt = String(r.prompt || (r.kp && r.kp._subQuizItem && r.kp._subQuizItem.prompt) || '').trim();
      const shortPrompt = subPrompt.length > 68 ? subPrompt.slice(0, 66) + '…' : subPrompt;
      return `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td><span class="badge diff-2">${r.kp.subject}</span></td>
        <td>
          <a href="javascript:void(0)" onclick="closeHuyisiQuizModal();openMicroDrawer('${r.kp.id}')" style="font-weight:700;color:#1e1b4b;text-decoration:none;">
            ${escapeHtml(r.kp.corePoint)}
          </a>
          ${shortPrompt ? `<div style="font-size:12.5px;color:#64748b;margin-top:2px;">小题：${escapeHtml(shortPrompt)}</div>` : ''}
        </td>
        <td>${getStatusBadge(r.status)}</td>
      </tr>
    `;
    }).join('');

    card.innerHTML = `
      <div class="quiz-top-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="/assets/huyisi_victory.jpg" style="width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #fff;" />
          <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:6px;">${uiIcon('crown', 18)} <span>本组 ${q.results.length} 题闯关完成！</span></div>
        </div>
        <button class="quiz-close-btn" onclick="closeHuyisiQuizModal()">${uiIcon('cross', 15)} <span>完成</span></button>
      </div>

      <div class="quiz-summary-body" style="padding:24px;overflow-y:auto;flex:1;max-width:760px;margin:0 auto;width:100%;">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
          <div class="zen-stat-box" style="border-bottom-color:#22c55e;">
            <div class="zen-stat-num" style="color:#15803d;display:flex;align-items:center;justify-content:center;gap:6px;">${uiIcon('crown', 22)} <span>${cntGreen}</span></div>
            <div class="zen-stat-label">已掌握</div>
          </div>
          <div class="zen-stat-box" style="border-bottom-color:#f59e0b;">
            <div class="zen-stat-num" style="color:#b45309;display:flex;align-items:center;justify-content:center;gap:6px;">${uiIcon('clock', 22)} <span>${cntYellow}</span></div>
            <div class="zen-stat-label">巩固中</div>
          </div>
          <div class="zen-stat-box" style="border-bottom-color:#f43f5e;">
            <div class="zen-stat-num" style="color:#dc2626;display:flex;align-items:center;justify-content:center;gap:6px;">${uiIcon('target', 22)} <span>${cntRed}</span></div>
            <div class="zen-stat-label">待突破</div>
          </div>
        </div>

        <div class="data-table-wrap" style="margin-bottom:20px;">
          <table class="data-table">
            <thead>
              <tr><th>题序</th><th>科目</th><th>考点名称</th><th>结果</th></tr>
            </thead>
            <tbody>${resultRowsHtml || '<tr><td colspan="4" style="text-align:center;padding:20px;">本轮暂未判题</td></tr>'}</tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
          ${(cntYellow + cntRed) > 0 ? `
            <button class="duo-btn primary" onclick="retryWeakFromQuizSummary()">
              ${uiIcon('refresh', 16)} <span>重练错题 (${cntYellow + cntRed})</span>
            </button>
          ` : ''}
          <button class="duo-btn indigo" onclick="refreshRandomQuizBatch()">
            🎲 <span>随机换一批新题 (6~8题)</span>
          </button>
          <button class="duo-btn outline" onclick="closeHuyisiQuizModal()">
            ${uiIcon('check', 16)} <span>返回</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  // 顶部极简一体式 Header（含学年学期联动选择 + 本期在读科目选择 + 进度过滤 + 换新题）
  const kp = q.queue[q.currentIndex] || STATE.data.knowledgePoints[0];
  const progressPct = q.studyStyle === 'dictation'
    ? Math.round((((q.dictation.currentIndex || 0) + 1) / Math.max(1, (q.dictation.items || []).length)) * 100)
    : Math.round(((q.currentIndex + 1) / (q.queue.length || 1)) * 100);

  const commonHeaderHtml = `
    <div class="quiz-top-header">
      <div class="quiz-header-left" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <select class="topbar-grade-select" style="background:rgba(255,255,255,0.22);color:#fff;border-color:rgba(255,255,255,0.38);" onchange="setQuizSemester(this.value)" title="跟随上一级学年学期">
          ${semOptionsHtml}
        </select>
        <select class="topbar-grade-select" style="background:rgba(255,255,255,0.22);color:#fff;border-color:rgba(255,255,255,0.38);" onchange="setQuizSetting('subject', this.value)" title="选择当前学年在读科目">
          ${subjOptionsHtml}
        </select>
        <button class="quiz-close-btn" style="background:${STATE.schoolProgressFilter === 'TAUGHT_AND_CURRENT' ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.18)'};padding:5px 10px;font-size:12px;" onclick="toggleQuizSchoolProgressFilter()" title="切换仅测学校已学进度或全册">
          <span>${STATE.schoolProgressFilter === 'TAUGHT_AND_CURRENT' ? '🏫 仅测学校已学' : '📚 全册含预习'}</span>
        </button>
        ${modeTabsHtml}
      </div>
      <div class="quiz-header-right" style="display:flex;align-items:center;gap:8px;">
        <button class="quiz-close-btn" style="background:rgba(255,255,255,0.24);padding:5px 11px;font-size:12.5px;" onclick="refreshRandomQuizBatch()" title="从题库池随机换一批新题 (6~8题)">
          🎲 <span>换新题</span>
        </button>
        ${(STATE.comboStreak || 0) >= 2 ? `
          <span class="combo-streak-pill">🔥 ${STATE.comboStreak} 连击</span>
        ` : ''}
        <span style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;">
          ${q.studyStyle === 'match'
            ? `${q.matchGame.matchedPairIds.length}/${q.matchGame.totalPairs}`
            : q.studyStyle === 'dictation'
            ? `${(q.dictation.currentIndex || 0) + 1} / ${(q.dictation.items || []).length}`
            : `${q.currentIndex + 1} / ${q.queue.length}`}
        </span>
        <div class="quiz-mini-progress" style="width:60px;height:8px;background:rgba(255,255,255,0.25);border-radius:999px;overflow:hidden;">
          <div style="width:${q.studyStyle === 'match' ? Math.round((q.matchGame.matchedPairIds.length / (q.matchGame.totalPairs || 1)) * 100) : progressPct}%;height:100%;background:#4ade80;transition:width 0.35s cubic-bezier(0.22,1,0.36,1);"></div>
        </div>
        <button class="quiz-close-btn" onclick="closeHuyisiQuizModal()" title="退出练习">${uiIcon('cross', 15)} <span class="hide-xs">退出</span></button>
      </div>
    </div>
  `;

  // ============================================================================
  // 新增模式：🎧 互动听写 / 关键词默写舱 (Dictation Mode)
  // ============================================================================
  if (q.studyStyle === 'dictation') {
    if (!q.dictation || !Array.isArray(q.dictation.items) || q.dictation.items.length === 0) {
      initDictationQueueForSubject(q.subject === 'ACTIVE_ALL' ? '英语' : q.subject, true);
    }
    const d = q.dictation;
    if (d.finished) {
      const rightCnt = d.results.filter(r => r.isCorrect).length;
      const pct = Math.round((rightCnt / Math.max(1, d.results.length)) * 100);
      card.innerHTML = `
        ${commonHeaderHtml}
        <div class="quiz-summary-body" style="padding:28px;overflow-y:auto;flex:1;max-width:740px;margin:0 auto;width:100%;text-align:center;">
          <div style="font-size:48px;margin-bottom:6px;">${pct >= 80 ? '🏆' : '🎧'}</div>
          <h2 style="font-size:22px;font-weight:900;color:#0f172a;margin-bottom:6px;">
            本轮互动听写完成 · 正确率 ${pct}% (${rightCnt}/${d.results.length})
          </h2>
          <p style="font-size:14px;color:#64748b;margin-bottom:18px;">
            ${pct >= 80 ? '太棒啦！成功点亮【听写满贯星耀勋章】✨' : '错词已标红，用“自然拼读拆音节法”再听写一轮就能全对啦！'}
          </p>
          <div class="data-table-wrap" style="margin-bottom:20px;text-align:left;">
            <table class="data-table">
              <thead>
                <tr><th>标准答案</th><th>你的拼写</th><th>释义 / 题干</th><th>结果</th></tr>
              </thead>
              <tbody>
                ${d.results.map(r => `
                  <tr>
                    <td><strong style="font-size:16px;color:#15803d;">${escapeHtml(r.item.word)}</strong></td>
                    <td style="font-weight:800;color:${r.isCorrect ? '#15803d' : '#dc2626'};">${escapeHtml(r.userAnswer)}</td>
                    <td style="font-size:13.5px;color:#475569;">${escapeHtml(r.item.cn)}</td>
                    <td>${r.isCorrect ? '<span class="badge status-green">✓ 正确</span>' : '<span class="badge status-red">✕ 待巩固</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
            <button class="duo-btn primary" onclick="refreshRandomQuizBatch()">
              🎲 <span>随机换一批新词再听写 (6~8词)</span>
            </button>
            <button class="duo-btn indigo" onclick="switchQuizStudyStyle('quest')">
              ⚡ <span>切换到选择题闯关</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    const curItem = d.items[d.currentIndex] || d.items[0];
    // 生成打乱的字母/字符积木按钮辅助点击拼写
    const chars = curItem.word.split('');
    const shuffledChars = chars.slice().sort((a, b) => (hashStringDeterministic(curItem.word + a) % 7) - (hashStringDeterministic(curItem.word + b) % 7));

    card.innerHTML = `
      ${commonHeaderHtml}
      <div class="zen-quiz-single-stage" style="max-width:760px;margin:0 auto;width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge" style="background:#fdf2f8;color:#db2777;font-weight:900;">🎧 互动听写 / 默写舱 (${d.currentIndex + 1}/${d.items.length})</span>
            <span class="badge status-gray">${escapeHtml(curItem.phonetic || '')}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="zen-btn-ghost ${d.showSyllableHint ? 'active' : ''}" onclick="toggleDictationSyllableHint()">
              🧩 <span>${d.showSyllableHint ? '隐藏音节提示' : '显示音节提示'}</span>
            </button>
            <button class="zen-btn-ghost" onclick="refreshRandomQuizBatch()">
              🎲 <span>换一批词</span>
            </button>
          </div>
        </div>

        <div class="dictation-stage-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px;">
            <div>
              <div style="font-size:13px;font-weight:800;color:#6366f1;margin-bottom:4px;">请听发音或阅读下方释义，写出对应的核心词：</div>
              <div style="font-size:21px;font-weight:900;color:#0f172a;">${escapeHtml(curItem.cn)}</div>
            </div>
            <button class="duo-btn primary" style="padding:12px 20px;font-size:15px;" onclick="playCurrentDictationAudio()">
              🔊 <span>播放标准读音</span>
            </button>
          </div>

          ${d.showSyllableHint ? `
            <div style="background:#f5f3ff;border:1.5px dashed #c4b5fd;border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <span style="font-size:14.5px;color:#4c1d95;font-weight:800;">
                💡 拆音节/字数提示：<code style="font-size:16px;background:#fff;padding:2px 8px;border-radius:6px;color:#db2777;">${escapeHtml(curItem.word.replace(/[a-zA-Z\u4e00-\u9fa5]/g, '_ '))}</code>（共 ${curItem.word.length} 个字符）
              </span>
              <span style="font-size:13px;color:#6d28d9;font-weight:700;">记忆法：${escapeHtml(curItem.tip)}</span>
            </div>
          ` : ''}

          ${curItem.wrongNote ? `
            <div style="background:#fff1f2;border:1.5px solid #fecdd3;border-radius:12px;padding:9px 14px;margin-bottom:14px;font-size:13.5px;color:#be123c;font-weight:700;">
              ⚠️ <strong>实测防错预警：</strong>${escapeHtml(curItem.wrongNote)}
            </div>
          ` : ''}

          <div class="dictation-input-row">
            <input
              id="dictationInputField"
              type="text"
              class="dictation-text-input ${d.submitted ? (d.isCorrect ? 'is-right' : 'is-wrong') : ''}"
              value="${escapeHtml(d.userInput)}"
              placeholder="在此输入拼写答案，或点击下方字母积木..."
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              oninput="handleDictationInputChange(this.value)"
              onkeydown="if(event.key==='Enter'){event.preventDefault();${d.submitted ? 'nextDictationItem()' : 'submitDictationAnswer()'};}"
              ${d.submitted ? 'readonly' : ''}
            />
            ${!d.submitted ? `
              <button class="zen-btn-ghost" onclick="clearDictationInput()">清空</button>
              <button class="duo-btn primary" style="padding:12px 24px;font-size:16px;" onclick="submitDictationAnswer()">
                ✓ <span>提交核对</span>
              </button>
            ` : `
              <button class="duo-btn primary" style="padding:12px 24px;font-size:16px;" onclick="nextDictationItem()">
                <span>${d.currentIndex < d.items.length - 1 ? '下一词 ➔' : '查看听写成绩单 🏆'}</span>
              </button>
            `}
          </div>

          ${!d.submitted ? `
            <div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:12.5px;color:#64748b;font-weight:800;">🔤 字母/字符积木（点击可拼入）：</span>
              ${shuffledChars.map(ch => `
                <button type="button" class="dictation-letter-chip" onclick="appendDictationLetter('${ch.replace(/'/g, "\\'")}')">${escapeHtml(ch)}</button>
              `).join('')}
            </div>
          ` : ''}

          ${d.submitted ? `
            <div class="cartoon-feedback-banner ${d.isCorrect ? 'is-right' : 'is-wrong'}" style="margin-top:16px;">
              <div style="font-size:18px;font-weight:900;margin-bottom:6px;">
                ${d.isCorrect
                  ? `🎉 拼写完全正确！【${escapeHtml(curItem.word)}】(${escapeHtml(curItem.syllables)})`
                  : `💡 差一点点哦！正确拼写是：【${escapeHtml(curItem.word)}】（音节拆分：${escapeHtml(curItem.syllables)}）`}
              </div>
              <div style="font-size:14.5px;">
                <strong>秒记口诀：</strong>${escapeHtml(curItem.tip)}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    setTimeout(() => {
      const inp = document.getElementById('dictationInputField');
      if (inp && !d.submitted) inp.focus();
    }, 50);
    return;
  }

  // ============================================================================
  // 模式 C：口诀配对消消乐 (Quizlet Match)
  // ============================================================================
  if (q.studyStyle === 'match') {
    const mg = q.matchGame;
    if (!mg.tiles || mg.tiles.length === 0) initMatchGameFromQueue();
    const allMatched = mg.matchedPairIds.length >= mg.totalPairs && mg.totalPairs > 0;

    const tilesHtml = mg.tiles.map(t => {
      const isMatched = mg.matchedPairIds.includes(t.pairId);
      const isSelected = mg.selectedTileId === t.tileId;
      const isWrong = mg.wrongTileIds.includes(t.tileId);
      const cls = isMatched ? 'tile-matched' : isWrong ? 'tile-wrong' : isSelected ? 'tile-selected' : '';
      const badgeBg = t.kind === 'term' ? '#eef2ff' : '#fdf2f8';
      const badgeCol = t.kind === 'term' ? '#4f46e5' : '#db2777';

      return `
        <div class="match-card-tile ${cls}" onclick="handleMatchTileClick('${t.tileId}')">
          <div style="margin-bottom:6px;">
            <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:${badgeBg};color:${badgeCol};display:inline-flex;align-items:center;gap:4px;">
              ${t.kind === 'term' ? uiIcon('target', 12) : uiIcon('sparkle', 12)} <span>${escapeHtml(t.badge)}</span>
            </span>
          </div>
          <div style="font-weight:${t.kind === 'term' ? '800' : '600'};color:${t.kind === 'term' ? '#0f172a' : '#334155'};">
            ${escapeHtml(t.text)}
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      ${commonHeaderHtml}
      <div style="padding:20px 24px;overflow-y:auto;flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:15px;font-weight:800;color:#334155;display:inline-flex;align-items:center;gap:6px;">
            ${uiIcon('grid', 17)} <span>点击「考点」与对应的「口诀」配对消除</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge diff-2">${uiIcon('clock', 13)} <strong id="matchGameTimer">${formatDurationSec(mg.elapsedSec)}</strong></span>
            <button class="zen-btn-ghost" onclick="initMatchGameFromQueue();renderQuizModal();">${uiIcon('refresh', 14)} <span>洗牌</span></button>
          </div>
        </div>

        ${allMatched ? `
          <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:20px;padding:28px;text-align:center;margin:16px 0;">
            <div style="color:#15803d;margin-bottom:8px;">${uiIcon('crown', 42)}</div>
            <div style="font-size:20px;font-weight:900;color:#15803d;">${mg.totalPairs} 组口诀全部配对成功！</div>
            <div style="font-size:14px;color:#166534;margin:8px 0 18px;">用时 <strong>${mg.elapsedSec} 秒</strong></div>
            <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
              <button class="duo-btn primary" onclick="initMatchGameFromQueue();renderQuizModal();">${uiIcon('refresh', 16)} <span>再玩一局</span></button>
              <button class="duo-btn indigo" onclick="switchQuizStudyStyle('quest')">${uiIcon('bolt', 16)} <span>切到闯关</span></button>
            </div>
          </div>
        ` : `
          <div class="match-game-grid">
            ${tilesHtml}
          </div>
        `}
      </div>
    `;
    return;
  }

  // 底部判定栏（用于闪卡、分步拆解、原题详解）
  const showJudgeBtns = q.answerRevealed || q.studyStyle === 'flashcard' || (q.studyStyle === 'blocks' && (q.unlockedBlockStep || 1) >= 4);

  const commonFooterJudgeHtml = `
    <div class="quiz-footer-judge">
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="zen-btn-ghost" onclick="prevQuizQuestion()" ${q.currentIndex === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>${uiIcon('arrow-left', 15)} <span>上一题</span></button>
        <button class="zen-btn-ghost" onclick="skipQuizQuestion()"><span>跳过</span> ${uiIcon('arrow-right', 15)}</button>
      </div>

      ${showJudgeBtns ? `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="judge-btn green" onclick="judgeAndNextQuizQuestion('🟢已吃透')">
            ${uiIcon('check-circle', 16)} <span>学会了 [1]</span>
          </button>
          <button class="judge-btn yellow" onclick="judgeAndNextQuizQuestion('🟡复习中')">
            ${uiIcon('clock', 16)} <span>巩固 [2]</span>
          </button>
          <button class="judge-btn red" onclick="judgeAndNextQuizQuestion('🔴未掌握')">
            ${uiIcon('target', 16)} <span>未懂 [3]</span>
          </button>
        </div>
      ` : `
        <button class="duo-btn primary" style="padding:10px 22px;" onclick="${q.studyStyle === 'blocks' ? `unlockNextScratchBlock(4)` : `revealQuizAnswer()`}">
          ${uiIcon('eye', 17)} <span>查看答案 [空格]</span>
        </button>
      `}
    </div>
  `;

  // ============================================================================
  // 模式 B：3D 翻转闪卡 (Flashcards)
  // ============================================================================
  if (q.studyStyle === 'flashcard') {
    const questionText = kp.questionMain || '请回想本考点的核心公式、速记口诀与常见易错点。';
    const frontSpeakAttr = safeSpeakAttr(`考点：${kp.corePoint}。母题：${questionText}`);
    const backSpeakAttr = safeSpeakAttr(`核心口诀：${kp.mnemonic || ''}。一秒理解：${kp.understanding || ''}。${kp.errorReason ? '易错提醒：' + kp.errorReason : ''}`);
    card.innerHTML = `
      ${commonHeaderHtml}
      <div style="padding:20px 24px;overflow-y:auto;flex:1;max-width:780px;margin:0 auto;width:100%;display:flex;flex-direction:column;justify-content:center;gap:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <span class="badge status-gray">${subjIconSvg(kp.subject, 14)} <span>${kp.subject} · ${kp.semester} · ${escapeHtml(kp.chapter)}</span></span>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:13px;font-weight:700;color:#6366f1;display:inline-flex;align-items:center;gap:4px;">${uiIcon('refresh', 14)} <span>点击卡片翻转正反面</span></span>
          </div>
        </div>

        <div class="flashcard-stage-wrap" onclick="flipFlashcard()">
          <div id="flashcard3dInner" class="flashcard-3d-inner ${q.flashcardFlipped ? 'is-flipped' : ''}">
            <div class="flashcard-face front">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
                  <div style="font-size:12px;font-weight:800;color:#6366f1;display:flex;align-items:center;gap:5px;">${uiIcon('cards', 14)} <span>闪卡正面 · 考点与母题</span></div>
                  <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="event.stopPropagation();speakText('${frontSpeakAttr}', '闪卡正面母题')">${uiIcon('volume-on', 14)} <span>读正面</span></button>
                </div>
                <div style="font-size:20px;font-weight:900;color:#0f172a;margin-bottom:14px;">
                  ${escapeHtml(kp.corePoint)}
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;font-size:15.5px;color:#1e293b;">
                  <div class="md-rendered">${formatSimpleMarkdown(questionText)}</div>
                </div>
              </div>
              <div style="text-align:center;font-size:13px;font-weight:800;color:#4f46e5;display:flex;align-items:center;justify-content:center;gap:6px;">
                ${uiIcon('refresh', 15)} <span>点击翻转看【核心口诀 + 理解法】</span>
              </div>
            </div>

            <div class="flashcard-face back">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div style="font-size:12px;font-weight:800;color:#15803d;display:flex;align-items:center;gap:5px;">${uiIcon('sparkle', 14)} <span>闪卡背面 · 核心记忆口诀</span></div>
                  <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="event.stopPropagation();speakText('${backSpeakAttr}', '闪卡背面口诀与解析')">${uiIcon('volume-on', 14)} <span>读背面</span></button>
                </div>
                <div style="background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:12px;padding:14px;color:#831843;font-size:15px;">
                  <strong>核心口诀：</strong> ${escapeHtml(kp.mnemonic || '抓准定义与符号边界，分步回头验算')}
                </div>
                <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:14px;color:#1e3a8a;font-size:14px;">
                  <strong>一秒理解：</strong> ${escapeHtml(kp.understanding || '结合图形或模型分步拆解')}
                </div>
                ${kp.errorReason ? `
                  <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:12px 14px;color:#991b1b;font-size:13.5px;">
                    <strong>易错提醒：</strong> ${escapeHtml(kp.errorReason)}
                  </div>
                ` : ''}
              </div>
              <div style="text-align:right;">
                <button class="zen-btn-ghost" onclick="event.stopPropagation();closeHuyisiQuizModal();openMicroDrawer('${kp.id}')">${uiIcon('book', 14)} <span>完整讲义</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${commonFooterJudgeHtml}
    `;
    renderMathInContainer(card);
    return;
  }

  // ============================================================================
  // 模式 D：分步拆解 (Step Builder)
  // ============================================================================
  if (q.studyStyle === 'blocks') {
    const questionText = q.qVariant === 'variant'
      ? (kp.questionVariant || kp.questionMain || '请按步骤拆解本考点。')
      : (kp.questionMain || '请按步骤拆解本考点。');
    const step = q.unlockedBlockStep || 1;
    const step1SpeakAttr = safeSpeakAttr(`第一步，读题圈画条件：${questionText}`);
    const step2SpeakAttr = safeSpeakAttr(`第二步，核心原理：${kp.understanding || '抓住定义本质，先画图或分步拆解。'}`);
    const step3SpeakAttr = safeSpeakAttr(`第三步，套用口诀与防坑：${kp.mnemonic || '按步骤规范作答。'}。${kp.errorReason ? '防坑提醒：' + kp.errorReason : ''}`);
    const step4SpeakAttr = safeSpeakAttr(`第四步，标准答案与步骤：${kp.answerText || '请对照口诀与理解法核对关键步骤。'}`);

    card.innerHTML = `
      ${commonHeaderHtml}
      <div style="padding:20px 24px;overflow-y:auto;flex:1;max-width:780px;margin:0 auto;width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:18px;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:8px;">
            ${uiIcon('steps', 20)} <span>分步拆解：${escapeHtml(kp.corePoint)}</span>
          </div>
          <span style="font-size:12.5px;color:#64748b;">点击步骤卡片逐步解锁思路</span>
        </div>

        <div class="scratch-blocks-stack">
          <div class="scratch-step-block step-unlocked" style="border-left-color:#3b82f6;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-size:12px;font-weight:900;color:#2563eb;">STEP 1 · 读题圈画条件</div>
              <button class="zen-btn-ghost" style="padding:2px 8px;font-size:12px;" onclick="event.stopPropagation();speakText('${step1SpeakAttr}', '第1步题干')">${uiIcon('volume-on', 13)} <span>读题</span></button>
            </div>
            <div class="md-rendered" style="font-size:15.5px;color:#0f172a;">${formatSimpleMarkdown(questionText)}</div>
          </div>

          <div class="scratch-step-block ${step >= 2 ? 'step-unlocked' : 'step-locked'}" style="border-left-color:#8b5cf6;" onclick="unlockNextScratchBlock(2)">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12.5px;font-weight:900;color:#6d28d9;">STEP 2 · 核心原理</span>
              <div style="display:flex;align-items:center;gap:6px;">
                ${step >= 2 ? `<button class="zen-btn-ghost" style="padding:2px 8px;font-size:12px;" onclick="event.stopPropagation();speakText('${step2SpeakAttr}', '第2步核心原理')">${uiIcon('volume-on', 13)} <span>读原理</span></button>` : ''}
                <span style="font-size:12px;font-weight:800;color:#6d28d9;display:inline-flex;align-items:center;gap:4px;">${step >= 2 ? `${uiIcon('check', 13)} 已展开` : `点击展开 ${uiIcon('chevron-right', 13)}`}</span>
              </div>
            </div>
            ${step >= 2 ? `<div style="margin-top:8px;font-size:14px;color:#1e293b;">${uiIcon('bulb', 14)} ${escapeHtml(kp.understanding || '抓住定义本质，先画图或分步拆解。')}</div>` : ''}
          </div>

          <div class="scratch-step-block ${step >= 3 ? 'step-unlocked' : 'step-locked'}" style="border-left-color:#f59e0b;" onclick="unlockNextScratchBlock(3)">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12.5px;font-weight:900;color:#d97706;">STEP 3 · 套用口诀与防坑</span>
              <div style="display:flex;align-items:center;gap:6px;">
                ${step >= 3 ? `<button class="zen-btn-ghost" style="padding:2px 8px;font-size:12px;" onclick="event.stopPropagation();speakText('${step3SpeakAttr}', '第3步口诀与防坑')">${uiIcon('volume-on', 13)} <span>读口诀</span></button>` : ''}
                <span style="font-size:12px;font-weight:800;color:#d97706;display:inline-flex;align-items:center;gap:4px;">${step >= 3 ? `${uiIcon('check', 13)} 已展开` : `点击展开 ${uiIcon('chevron-right', 13)}`}</span>
              </div>
            </div>
            ${step >= 3 ? `
              <div style="margin-top:8px;font-size:14px;color:#1e293b;">
                <div>${uiIcon('sparkle', 14)} <strong>口诀</strong>：${escapeHtml(kp.mnemonic || '按步骤规范作答。')}</div>
                ${kp.errorReason ? `<div style="color:#b91c1c;margin-top:4px;">${uiIcon('alert', 14)} <strong>防坑</strong>：${escapeHtml(kp.errorReason)}</div>` : ''}
              </div>
            ` : ''}
          </div>

          <div class="scratch-step-block ${step >= 4 ? 'step-unlocked' : 'step-locked'}" style="border-left-color:#22c55e;" onclick="unlockNextScratchBlock(4)">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12.5px;font-weight:900;color:#15803d;">STEP 4 · 标准答案与步骤</span>
              <div style="display:flex;align-items:center;gap:6px;">
                ${step >= 4 ? `<button class="zen-btn-ghost" style="padding:2px 8px;font-size:12px;" onclick="event.stopPropagation();speakText('${step4SpeakAttr}', '第4步标准答案')">${uiIcon('volume-on', 13)} <span>读答案</span></button>` : ''}
                <span style="font-size:12px;font-weight:800;color:#15803d;display:inline-flex;align-items:center;gap:4px;">${step >= 4 ? `${uiIcon('check', 13)} 已揭晓` : `点击核对 ${uiIcon('chevron-right', 13)}`}</span>
              </div>
            </div>
            ${step >= 4 ? `
              <div class="md-rendered" style="margin-top:10px;padding-top:10px;border-top:1px dashed #86efac;font-size:14.5px;color:#0f172a;">
                ${formatSimpleMarkdown(kp.answerText || '请对照口诀与理解法核对关键步骤。')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      ${commonFooterJudgeHtml}
    `;
    renderMathInContainer(card);
    return;
  }

  // ============================================================================
  // 模式 A（默认）：卡通快节奏「四选一选择题 / 对错判断题」闯关 + 随手草稿纸 + 详解切换
  // ============================================================================
  const rFmt = q.rapidFormat || 'MIXED';
  const formatSwitcherHtml = `
    <div class="comm-segmented-bar" style="background:#ffeef8;border-color:#fbcfe8;">
      <button class="comm-seg-btn ${rFmt === 'MIXED' ? 'active' : ''}" onclick="setRapidFormat('MIXED')">
        ${uiIcon('bolt', 14)} <span>混合</span>
      </button>
      <button class="comm-seg-btn ${rFmt === 'CHOICE' ? 'active' : ''}" onclick="setRapidFormat('CHOICE')">
        ${uiIcon('list', 14)} <span>选择</span>
      </button>
      <button class="comm-seg-btn ${rFmt === 'TF' ? 'active' : ''}" onclick="setRapidFormat('TF')">
        ${uiIcon('check-circle', 14)} <span>判断</span>
      </button>
      <button class="comm-seg-btn ${rFmt === 'OPEN' ? 'active' : ''}" onclick="setRapidFormat('OPEN')">
        ${uiIcon('book', 14)} <span>详解</span>
      </button>
    </div>
  `;

  // 若处于「混合 / 选择 / 判断」快节奏模式（默认）
  if (rFmt !== 'OPEN') {
    const item = buildRapidQuizItem(kp, q.currentIndex, rFmt);
    const letters = ['A', 'B', 'C', 'D'];
    const letterColors = ['#ff5c8a', '#3b82f6', '#f59e0b', '#8b5cf6'];
    const rapidQuestionSpeakAttr = safeSpeakAttr(
      item.type === 'CHOICE'
        ? `${item.prompt}。${item.options.map((opt, idx) => `选项${letters[idx]}：${opt}`).join('。')}`
        : `判断题：${item.prompt}`
    );
    const rapidExplanationText = item.explanation || kp.mnemonic || kp.understanding || '';
    const rapidExplanationSpeakAttr = safeSpeakAttr(
      `${q.choiceIsCorrect ? '回答正确！' : `正确答案是：${item.type === 'TF' ? (item.tfCorrect ? '说法正确' : '说法有误') : letters[item.correctIdx]}。`}核心解析：${rapidExplanationText}`
    );

    let optionsAreaHtml = '';
    if (item.type === 'CHOICE') {
      optionsAreaHtml = `
        <div class="cartoon-opt-grid">
          ${item.options.map((optText, idx) => {
            let stateCls = '';
            let badgeInner = letters[idx];
            if (q.choiceSubmitted) {
              if (idx === item.correctIdx) {
                stateCls = 'opt-correct';
                badgeInner = uiIcon('check', 20);
              } else if (Number(q.selectedChoiceIdx) === idx && !q.choiceIsCorrect) {
                stateCls = 'opt-wrong';
                badgeInner = uiIcon('cross', 20);
              } else {
                stateCls = 'opt-dim';
              }
            }
            return `
              <button class="cartoon-opt-btn ${stateCls}" onclick="submitRapidChoice(${idx})" ${q.choiceSubmitted ? 'disabled' : ''}>
                <span class="cartoon-opt-letter" style="background:${letterColors[idx]};">${badgeInner}</span>
                <span class="cartoon-opt-text md-rendered">${formatSimpleMarkdown(optText)}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // 对错判断题 (True / False) — 使用独立定制 SVG 图标替代 emoji
      const trueCls = q.choiceSubmitted
        ? (item.tfCorrect === true ? 'opt-correct' : (q.selectedChoiceIdx === true ? 'opt-wrong' : 'opt-dim'))
        : '';
      const falseCls = q.choiceSubmitted
        ? (item.tfCorrect === false ? 'opt-correct' : (q.selectedChoiceIdx === false ? 'opt-wrong' : 'opt-dim'))
        : '';

      optionsAreaHtml = `
        <div class="cartoon-tf-grid">
          <button class="cartoon-tf-btn tf-true ${trueCls}" onclick="submitRapidChoice(true)" ${q.choiceSubmitted ? 'disabled' : ''}>
            <span class="tf-big-icon" style="color:#16a34a;">${uiIcon('check-circle', 34)}</span>
            <div>
              <div class="tf-main-title">说法正确 [1 / A]</div>
              <div class="tf-sub-desc">符合定义、公式与口诀铁律</div>
            </div>
          </button>
          <button class="cartoon-tf-btn tf-false ${falseCls}" onclick="submitRapidChoice(false)" ${q.choiceSubmitted ? 'disabled' : ''}>
            <span class="tf-big-icon" style="color:#e11d48;">${uiIcon('cross-circle', 34)}</span>
            <div>
              <div class="tf-main-title">说法有误 [2 / B]</div>
              <div class="tf-sub-desc">存在符号漏看或边界陷阱</div>
            </div>
          </button>
        </div>
      `;
    }

    const feedbackBannerHtml = q.choiceSubmitted ? `
      <div class="cartoon-feedback-banner ${q.choiceIsCorrect ? 'is-right' : 'is-wrong'}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
          <div style="font-size:18px;font-weight:900;display:flex;align-items:center;gap:8px;">
            ${q.choiceIsCorrect
              ? `${uiIcon('check-circle', 22)} <span>回答正确！已自动标记为「已掌握」</span>`
              : `${uiIcon('bulb', 22)} <span>再看一眼！正确答案：【${item.type === 'TF' ? (item.tfCorrect ? '说法正确' : '说法有误') : letters[item.correctIdx]}】</span>`}
          </div>
          <div style="display:flex;gap:8px;">
            <button class="zen-btn-ghost" onclick="speakText('${rapidExplanationSpeakAttr}', '本题核心解析')">${uiIcon('volume-on', 14)} <span>读解析</span></button>
            <button class="zen-btn-ghost" onclick="closeHuyisiQuizModal();openMicroDrawer('${kp.id}')">${uiIcon('book', 14)} <span>讲义</span></button>
          </div>
        </div>
        <div class="md-rendered" style="font-size:16px;line-height:1.68;">
          <strong>核心解析：</strong>${formatSimpleMarkdown(rapidExplanationText)}
        </div>
      </div>
    ` : '';

    const rapidFooterHtml = `
      <div class="quiz-footer-judge">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="zen-btn-ghost" onclick="prevQuizQuestion()" ${q.currentIndex === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>${uiIcon('arrow-left', 15)} <span>上一题</span></button>
          <button class="zen-btn-ghost" onclick="skipQuizQuestion()"><span>跳题</span> ${uiIcon('arrow-right', 15)}</button>
          <button class="zen-btn-ghost" style="border-color:#c4b5fd;color:#4f46e5;" onclick="refreshRandomQuizBatch()">
            🎲 <span>随机换一批新题(6~8题)</span>
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
          ${q.choiceSubmitted ? `
            <button class="duo-btn primary" style="padding:11px 24px;font-size:17px;" onclick="advanceAfterRapidChoice()">
              ${q.currentIndex < q.queue.length - 1
                ? `<span>下一题</span> ${uiIcon('arrow-right', 17)}`
                : `${uiIcon('crown', 17)} <span>查看成绩单</span>`}
            </button>
          ` : `
            <span class="quiz-footer-hint" style="font-size:14px;font-weight:800;color:#db2777;display:inline-flex;align-items:center;gap:6px;">
              ${uiIcon('bolt', 15)} <span>点击选项直接作答 (${item.type === 'TF' ? '1 / 2' : 'A / B / C / D'})</span>
            </span>
          `}
        </div>
      </div>
    `;

    const activeSopHtml = (typeof window !== 'undefined' && window.ARCHETYPE_STATE && window.ARCHETYPE_STATE.activeSopBanner)
      ? window.ARCHETYPE_STATE.activeSopBanner
      : '';

    card.innerHTML = `
      ${commonHeaderHtml}

      <div class="zen-quiz-single-stage">
        ${activeSopHtml}
        <div class="quiz-stage-toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="badge status-gray">${subjIconSvg(kp.subject, 14)} <span>${kp.subject} · ${kp.semester}</span></span>
            <span class="badge" style="background:#ffe4ef;color:#db2777;font-weight:900;">
              ${item.type === 'TF' ? `${uiIcon('check-circle', 13)} <span>判断题</span>` : `${uiIcon('list', 13)} <span>四选一</span>`}
            </span>
            ${getStatusBadge(kp.status)}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${formatSwitcherHtml}
            <button class="zen-btn-ghost ${STATE.scratchpad.open ? 'active' : ''}" onclick="toggleQuizScratchpad()" title="开关草稿纸">
              ${uiIcon('pen', 15)} <span>草稿</span>
            </button>
          </div>
        </div>

        <div class="quiz-kp-heading" style="font-size:20px;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:8px;">
          ${uiIcon('target', 20)} <span>${escapeHtml(kp.corePoint)}</span>
        </div>

        <!-- 卡通题干卡片（朗读按钮紧贴题干右上角，直接朗读本题题干与选项） -->
        <div class="quiz-question-box cartoon-question-box">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div class="md-rendered" style="font-size:18px;font-weight:800;line-height:1.7;color:#1e1b4b;flex:1;">
              ${formatSimpleMarkdown(item.prompt)}
            </div>
            <button class="zen-btn-ghost" style="padding:5px 11px;font-size:13px;flex-shrink:0;" onclick="speakText('${rapidQuestionSpeakAttr}', '本题题干')" title="朗读本题题干与选项">${uiIcon('volume-on', 15)} <span>读题</span></button>
          </div>
        </div>

        ${STATE.scratchpad.open ? `
          <div class="comm-scratchpad-box">
            <div class="comm-scratchpad-toolbar">
              <span style="font-size:13.5px;font-weight:800;color:#334155;display:inline-flex;align-items:center;gap:5px;">${uiIcon('pen', 14)} <span>演算草稿</span></span>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <button class="scratch-pen-btn ${STATE.scratchpad.color === '#0f172a' ? 'active' : ''}" data-color="#0f172a" onclick="setScratchpadPen('#0f172a', 3)"><span class="pen-dot" style="background:#0f172a;"></span>黑</button>
                <button class="scratch-pen-btn ${STATE.scratchpad.color === '#e11d48' ? 'active' : ''}" data-color="#e11d48" onclick="setScratchpadPen('#e11d48', 3.5)"><span class="pen-dot" style="background:#e11d48;"></span>红</button>
                <button class="scratch-pen-btn ${STATE.scratchpad.color === '#2563eb' ? 'active' : ''}" data-color="#2563eb" onclick="setScratchpadPen('#2563eb', 3)"><span class="pen-dot" style="background:#2563eb;"></span>蓝</button>
                <button class="scratch-pen-btn ${STATE.scratchpad.color === 'ERASER' ? 'active' : ''}" data-color="ERASER" onclick="setScratchpadPen('ERASER', 18)">${uiIcon('eraser', 13)} 橡皮</button>
                <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="clearScratchpadCanvas()">${uiIcon('trash', 13)} 清空</button>
              </div>
            </div>
            <canvas id="quizScratchpadCanvas" class="comm-scratchpad-canvas"></canvas>
          </div>
        ` : ''}

        <!-- 选择题 A/B/C/D 或 判断题 互动按钮区 -->
        ${optionsAreaHtml}

        <!-- 即时判题卡通反馈横幅 -->
        ${feedbackBannerHtml}
      </div>

      ${rapidFooterHtml}
    `;

    renderMathInContainer(card);
    if (STATE.scratchpad.open) {
      setTimeout(initQuizScratchpadCanvas, 30);
    }
    return;
  }

  // 子模式：原题详解（需要看完整大题解答步骤时使用）
  const questionText = q.qVariant === 'variant'
    ? (kp.questionVariant || kp.questionMain || '请回想本考点的核心公式、常见陷阱与解题步骤。')
    : (kp.questionMain || '请回想本考点的核心公式、常见陷阱与解题步骤。');
  const openQuestionSpeakAttr = safeSpeakAttr(`${kp.corePoint}。题目：${questionText}`);
  const openH1SpeakAttr = safeSpeakAttr(`一秒看懂本质：${kp.understanding || '抓住定义本质，先画图或分步拆解。'}`);
  const openH2SpeakAttr = safeSpeakAttr(`核心记忆口诀：${kp.mnemonic || '按步骤规范作答，步步回头验算。'}`);
  const openH3SpeakAttr = safeSpeakAttr(`易错点提醒：${kp.errorReason || '注意审题圈画关键词与符号边界！'}`);
  const openAnsSpeakAttr = safeSpeakAttr(`标准答案与解题步骤：${kp.answerText || '请对照上方口诀与理解法核对关键步骤。'}`);

  const openActiveSopHtml = (typeof window !== 'undefined' && window.ARCHETYPE_STATE && window.ARCHETYPE_STATE.activeSopBanner)
    ? window.ARCHETYPE_STATE.activeSopBanner
    : '';

  card.innerHTML = `
    ${commonHeaderHtml}

    <div class="zen-quiz-single-stage">
      ${openActiveSopHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge status-gray">${subjIconSvg(kp.subject, 14)} <span>${kp.subject} · ${kp.semester}</span></span>
          ${getStatusBadge(kp.status)}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          ${formatSwitcherHtml}
          <button class="zen-btn-ghost ${STATE.scratchpad.open ? 'active' : ''}" onclick="toggleQuizScratchpad()">
            ${uiIcon('pen', 14)} <span>草稿</span>
          </button>
          <button class="zen-btn-ghost ${q.qVariant === 'main' ? 'active' : ''}" onclick="toggleQuizVariant('main')">母题</button>
          <button class="zen-btn-ghost ${q.qVariant === 'variant' ? 'active' : ''}" onclick="toggleQuizVariant('variant')">变式</button>
        </div>
      </div>

      <div style="font-size:20px;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:8px;">
        ${uiIcon('target', 20)} <span>${escapeHtml(kp.corePoint)}</span>
      </div>

      <div class="quiz-question-box">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div class="md-rendered" style="font-size:17px;line-height:1.75;color:#0f172a;flex:1;">
            ${formatSimpleMarkdown(questionText)}
          </div>
          <button class="zen-btn-ghost" style="padding:5px 11px;font-size:13px;flex-shrink:0;" onclick="speakText('${openQuestionSpeakAttr}', '本题题干')">${uiIcon('volume-on', 15)} <span>读题</span></button>
        </div>
      </div>

      ${STATE.scratchpad.open ? `
        <div class="comm-scratchpad-box">
          <div class="comm-scratchpad-toolbar">
            <span style="font-size:13.5px;font-weight:800;color:#334155;display:inline-flex;align-items:center;gap:5px;">${uiIcon('pen', 14)} <span>演算草稿</span></span>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button class="scratch-pen-btn ${STATE.scratchpad.color === '#0f172a' ? 'active' : ''}" data-color="#0f172a" onclick="setScratchpadPen('#0f172a', 3)"><span class="pen-dot" style="background:#0f172a;"></span>黑</button>
              <button class="scratch-pen-btn ${STATE.scratchpad.color === '#e11d48' ? 'active' : ''}" data-color="#e11d48" onclick="setScratchpadPen('#e11d48', 3.5)"><span class="pen-dot" style="background:#e11d48;"></span>红</button>
              <button class="scratch-pen-btn ${STATE.scratchpad.color === '#2563eb' ? 'active' : ''}" data-color="#2563eb" onclick="setScratchpadPen('#2563eb', 3)"><span class="pen-dot" style="background:#2563eb;"></span>蓝</button>
              <button class="scratch-pen-btn ${STATE.scratchpad.color === 'ERASER' ? 'active' : ''}" data-color="ERASER" onclick="setScratchpadPen('ERASER', 18)">${uiIcon('eraser', 13)} 橡皮</button>
              <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="clearScratchpadCanvas()">${uiIcon('trash', 13)} 清空</button>
            </div>
          </div>
          <canvas id="quizScratchpadCanvas" class="comm-scratchpad-canvas"></canvas>
        </div>
      ` : ''}

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:13.5px;color:#64748b;font-weight:800;display:inline-flex;align-items:center;gap:4px;">${uiIcon('bulb', 15)} <span>提示：</span></span>
        <button class="zen-btn-ghost ${q.hintsShown.h1 ? 'active' : ''}" onclick="toggleQuizHint('h1')">
          ${uiIcon('bulb', 14)} <span>理解法</span>
        </button>
        <button class="zen-btn-ghost ${q.hintsShown.h2 ? 'active' : ''}" onclick="toggleQuizHint('h2')">
          ${uiIcon('sparkle', 14)} <span>秒杀口诀</span>
        </button>
        ${kp.errorReason ? `
          <button class="zen-btn-ghost ${q.hintsShown.h3 ? 'active' : ''}" onclick="toggleQuizHint('h3')">
            ${uiIcon('alert', 14)} <span>防坑提醒</span>
          </button>
        ` : ''}
      </div>

      ${q.hintsShown.h1 ? `
        <div class="quiz-hint-box" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;"><strong>一秒看懂本质：</strong> ${escapeHtml(kp.understanding || '抓住定义本质，先画图或分步拆解。')}</div>
          <button class="zen-btn-ghost" style="padding:3px 9px;font-size:12px;flex-shrink:0;" onclick="speakText('${openH1SpeakAttr}', '本质理解法')">${uiIcon('volume-on', 13)} <span>朗读</span></button>
        </div>
      ` : ''}
      ${q.hintsShown.h2 ? `
        <div class="quiz-hint-box" style="background:#fdf2f8;border-color:#f9a8d4;color:#831843;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;"><strong>核心记忆口诀：</strong> ${escapeHtml(kp.mnemonic || '按步骤规范作答，步步回头验算。')}</div>
          <button class="zen-btn-ghost" style="padding:3px 9px;font-size:12px;flex-shrink:0;" onclick="speakText('${openH2SpeakAttr}', '核心记忆口诀')">${uiIcon('volume-on', 13)} <span>读口诀</span></button>
        </div>
      ` : ''}
      ${q.hintsShown.h3 ? `
        <div class="quiz-hint-box" style="background:#fef2f2;border-color:#fecaca;color:#991b1b;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;"><strong>易错点提醒：</strong> ${escapeHtml(kp.errorReason || '注意审题圈画关键词与符号边界！')}</div>
          <button class="zen-btn-ghost" style="padding:3px 9px;font-size:12px;flex-shrink:0;" onclick="speakText('${openH3SpeakAttr}', '易错点提醒')">${uiIcon('volume-on', 13)} <span>读防坑</span></button>
        </div>
      ` : ''}

      ${q.answerRevealed ? `
        <div class="quiz-answer-revealed">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
            <strong style="font-size:16px;color:#15803d;display:inline-flex;align-items:center;gap:6px;">${uiIcon('check-circle', 18)} <span>标准答案与解题步骤</span></strong>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="speakText('${openAnsSpeakAttr}', '标准答案与解题步骤')">${uiIcon('volume-on', 14)} <span>读答案</span></button>
              <button class="zen-btn-ghost" onclick="closeHuyisiQuizModal();openMicroDrawer('${kp.id}')">${uiIcon('book', 14)} <span>完整讲义</span></button>
            </div>
          </div>
          <div class="md-rendered" style="font-size:16px;color:#0f172a;line-height:1.75;">
            ${formatSimpleMarkdown(kp.answerText || '请对照上方口诀与理解法核对关键步骤。')}
          </div>
        </div>
      ` : ''}
    </div>

    ${commonFooterJudgeHtml}
  `;

  renderMathInContainer(card);
  if (STATE.scratchpad.open) {
    setTimeout(initQuizScratchpadCanvas, 30);
  }
}

// 键盘快捷键支持：选择题 A/B/C/D 或 1/2/3/4 秒选答案，空格键进入下一题
window.addEventListener('keydown', (e) => {
  if (!STATE.quiz.isOpen || STATE.quiz.finished) return;
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  const q = STATE.quiz;
  const isRapidChoiceMode = q.studyStyle === 'quest' && (q.rapidFormat || 'MIXED') !== 'OPEN';

  if (isRapidChoiceMode) {
    const kp = q.queue[q.currentIndex];
    if (!kp) return;
    const item = buildRapidQuizItem(kp, q.currentIndex, q.rapidFormat || 'MIXED');

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (q.choiceSubmitted) {
        advanceAfterRapidChoice();
      }
      return;
    }

    if (!q.choiceSubmitted) {
      const keyUpper = (e.key || '').toUpperCase();
      if (item.type === 'TF') {
        if (keyUpper === '1' || keyUpper === 'A' || keyUpper === 'T') {
          e.preventDefault();
          submitRapidChoice(true);
        } else if (keyUpper === '2' || keyUpper === 'B' || keyUpper === 'F') {
          e.preventDefault();
          submitRapidChoice(false);
        }
      } else {
        const idxMap = { '1': 0, 'A': 0, '2': 1, 'B': 1, '3': 2, 'C': 2, '4': 3, 'D': 3 };
        if (idxMap[keyUpper] !== undefined) {
          e.preventDefault();
          submitRapidChoice(idxMap[keyUpper]);
        }
      }
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      skipQuizQuestion();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevQuizQuestion();
    } else if (e.key === 'Escape') {
      closeHuyisiQuizModal();
    }
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (q.studyStyle === 'flashcard') {
      flipFlashcard();
    } else if (q.studyStyle === 'blocks') {
      unlockNextScratchBlock((q.unlockedBlockStep || 1) + 1);
    } else if (!q.answerRevealed) {
      revealQuizAnswer();
    }
  } else if (e.key === '1') {
    e.preventDefault();
    judgeAndNextQuizQuestion('🟢已吃透');
  } else if (e.key === '2') {
    e.preventDefault();
    judgeAndNextQuizQuestion('🟡复习中');
  } else if (e.key === '3') {
    e.preventDefault();
    judgeAndNextQuizQuestion('🔴未掌握');
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    skipQuizQuestion();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevQuizQuestion();
  } else if (e.key === 'Escape') {
    closeHuyisiQuizModal();
  }
});

// 原图放大镜 Lightbox
function openPhotoModal(url, title) {
  STATE.lightbox.rotate = 0;
  STATE.lightbox.scale = 1;
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('photoModalImg');
  const titleEl = document.getElementById('photoModalTitle');
  img.src = url;
  img.style.transform = 'rotate(0deg) scale(1)';
  titleEl.textContent = title;
  modal.classList.add('open');
}

function closePhotoModal(e) {
  if (e && e.target && e.target.tagName === 'IMG') return;
  document.getElementById('photoModal').classList.remove('open');
}

function rotateLightbox(deg) {
  STATE.lightbox.rotate += deg;
  applyLightboxTransform();
}

function zoomLightbox(delta) {
  STATE.lightbox.scale = Math.max(0.4, Math.min(3.5, STATE.lightbox.scale + delta));
  applyLightboxTransform();
}

function resetLightbox() {
  STATE.lightbox.rotate = 0;
  STATE.lightbox.scale = 1;
  applyLightboxTransform();
}

function applyLightboxTransform() {
  const img = document.getElementById('photoModalImg');
  if (img) {
    img.style.transform = `rotate(${STATE.lightbox.rotate}deg) scale(${STATE.lightbox.scale})`;
  }
}

// 初始化加载与实时同步
async function reloadVaultData(showNotice = true) {
  const syncEl = document.getElementById('syncStatus');
  if (syncEl) syncEl.textContent = '正在同步 Obsidian...';
  try {
    const res = await fetch('/api/data');
    STATE.data = await res.json();
    const navTot = document.getElementById('navTotalPoints');
    if (navTot) navTot.textContent = STATE.data.knowledgePoints.length;
    const navPho = document.getElementById('navPhotoCount');
    if (navPho) {
      const totalPhotos = STATE.data.studyPhotosBySubject
        ? Object.values(STATE.data.studyPhotosBySubject).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
        : STATE.data.mathPhotos.length;
      navPho.textContent = totalPhotos + '张';
    }
    if (syncEl) syncEl.textContent = `已同步 (${STATE.data.knowledgePoints.length}考点 / ${STATE.data.syllabi.length}大纲)`;

    renderStageControlBar();
    if (STATE.activeTab === 'macro') renderMacroView();
    if (STATE.activeTab === 'meso') renderMesoView();
    if (STATE.activeTab === 'charts') renderChartsView();
    if (STATE.activeTab === 'exam') renderExamView();
    if (STATE.activeTab === 'genes') renderGenesView();
    if (STATE.activeTab === 'syllabus') renderSyllabusView();
    if (STATE.activeTab === 'phonics') renderPhonicsView();

    if (showNotice) showToast('已与本地 Obsidian 知识库完成最新同步');
  } catch (err) {
    if (syncEl) syncEl.textContent = '同步异常';
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  reloadVaultData(false);
});
