// ============================================================================
// 🔤 英语自然拼读与 48 国际音标全息点读闯关舱 (Phonics & 48 IPA Studio)
// 专为鲁教版五四制初一上（六年级·王若婷）定制：
// 1. 48 国际音标全息点读墙（20元音 + 28辅音·清浊成对对比 + 音标显微镜口型秘籍）
// 2. 自然拼读 5 大黄金法则（Magic E 开闭音节、元音组合、R控制音、辅音连缀）
// 3. 若婷 10.21 听写错词「拆音节积木工坊」（14个真实错词音形拆解 + 一键听写）
// 4. 26 字母「7 大音素家族」归类与冠词 a/an 考题防坑（Bridging Unit 1 必考）
// 5. 辨音与自然拼读闪电闯关（中考/周测画线部分辨音专项）
// ============================================================================

const PHONICS_MASTERED_STORAGE_KEY = 'RUOTING_PHONICS_MASTERED_IPA_V1';

function loadMasteredIpaSet() {
  try {
    const raw = JSON.parse(localStorage.getItem(PHONICS_MASTERED_STORAGE_KEY) || '[]');
    if (Array.isArray(raw)) return new Set(raw);
  } catch (e) {}
  return new Set(['/iː/', '/æ/', '/eɪ/', '/p/', '/b/', '/m/']);
}

function saveMasteredIpaSet(setObj) {
  try {
    localStorage.setItem(PHONICS_MASTERED_STORAGE_KEY, JSON.stringify(Array.from(setObj)));
  } catch (e) {}
}

function ensurePhonicsState() {
  if (!STATE.phonics) {
    const masteredSet = loadMasteredIpaSet();
    STATE.phonics = {
      subTab: 'ipa', // 'ipa' | 'rules' | 'workshop' | 'letters' | 'challenge'
      voice: 'en-US-AnaNeural', // 'en-US-AnaNeural' | 'en-GB-SoniaNeural' | 'zh-CN-XiaoyiNeural'
      slowMode: false, // false = 原速 | true = 慢速拆音跟读 (-22%)
      selectedIpaSymbol: '/θ/', // 默认聚焦若婷 9.23 周测易错音标 /θ/
      ipaCategoryFilter: 'ALL', // 'ALL' | 'VOWEL_LONG' | 'VOWEL_SHORT' | 'DIPHTHONG' | 'CONSONANT_PAIR' | 'CONSONANT_OTHER'
      selectedWorkshopIdx: 0,
      masteredIpa: masteredSet,
      quiz: {
        currentIndex: 0,
        selectedIdx: null,
        submitted: false,
        isCorrect: false,
        score: 0,
        answeredCount: 0
      }
    };
  }
  return STATE.phonics;
}

// ============================================================================
// 🔊 英语外教高保真点读引擎（支持美音/英音/双语讲解 + 慢速跟读 + 自动预热）
// ============================================================================

let _phonicsAudio = null;

function speakPhonicsEnglish(text, label = '', forceVoice = null, forceRate = null) {
  const ph = ensurePhonicsState();
  const clean = String(text || '').trim();
  if (!clean) return;

  if (typeof stopSpeakText === 'function') {
    stopSpeakText(true);
  }
  if (_phonicsAudio) {
    try {
      _phonicsAudio.pause();
      _phonicsAudio = null;
    } catch (e) {}
  }

  // 如果包含较多汉字且未强制指定英文发音人，自动采用甜美双语助教晓伊
  const hasChinese = /[\u4e00-\u9fa5]/.test(clean);
  const voice = forceVoice || (hasChinese ? 'zh-CN-XiaoyiNeural' : ph.voice);
  const rate = forceRate || (ph.slowMode ? '-22%' : '+0%');

  const url = `/api/tts?voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}&text=${encodeURIComponent(clean)}`;
  const audio = new Audio(url);
  audio.preload = 'auto';
  _phonicsAudio = audio;

  const voiceBadge = voice.startsWith('en-GB')
    ? '🇬🇧 英音外教'
    : voice.startsWith('en-US')
      ? '🇺🇸 美音外教'
      : '🎙️ 双语助教';

  if (typeof showToast === 'function') {
    showToast(`${voiceBadge}${ph.slowMode ? ' (🐢慢速)' : ''}：${label || clean}`);
  }

  audio.onerror = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = hasChinese ? 'zh-CN' : (voice.startsWith('en-GB') ? 'en-GB' : 'en-US');
        u.rate = ph.slowMode ? 0.78 : 0.98;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  };
  audio.play().catch(() => {});
}

// 后台静默预热指定英文词句，点按时 0 延迟秒出声
function prewarmPhonicsWords(wordsArray) {
  try {
    const ph = ensurePhonicsState();
    const list = (wordsArray || []).filter(Boolean).slice(0, 10);
    if (!list.length) return;
    fetch('/api/tts-prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice: ph.voice,
        rate: ph.slowMode ? '-22%' : '+0%',
        texts: list
      })
    }).catch(() => {});
  } catch (e) {}
}

// ============================================================================
// 📊 48 国际音标全量权威数据库（20 元音 + 28 辅音）
// 每个音标包含：符号、分类、名称、发音锚点词、口型秘籍、常见字母组合、3个课本例词、若婷专属防坑提示
// ============================================================================

const IPA_48_DATA = [
  // -------------------- 1. 单元音 · 5 个长元音 (Long Vowels) --------------------
  {
    symbol: '/iː/',
    group: 'VOWEL_LONG',
    groupLabel: '长元音 (5个)',
    name: '长元音·穿针引线音',
    cueSpeech: 'ee. green. keep. see.',
    graphemes: 'ee, ea, e, ie',
    mouthTip: '嘴角向两边用力拉开像微笑，舌尖抵下齿背，声音长而饱满（注意末尾有两点长音符号 ː）。',
    ruotingTip: '若婷二默把 green 写成 grea！记住 gr + ee(/iː/) + n，双 e 笑眯眯发长音 /iː/！',
    words: [
      { word: 'green', highlight: 'gr[ee]n', ipa: '/ɡriːn/', cn: '绿色' },
      { word: 'keep', highlight: 'k[ee]p', ipa: '/kiːp/', cn: '保持' },
      { word: 'please', highlight: 'pl[ea]se', ipa: '/pliːz/', cn: '请' }
    ]
  },
  {
    symbol: '/ɑː/',
    group: 'VOWEL_LONG',
    groupLabel: '长元音 (5个)',
    name: '长元音·看牙医张大嘴音',
    cueSpeech: 'ah. car. class. start.',
    graphemes: 'ar, a, al',
    mouthTip: '口腔打开到最大，舌身平放后缩，就像医生检查嗓子时让你发出的长音“啊——”。',
    ruotingTip: '字母 R 单独读就是 /ɑː/！单词里看到 ar 组合（如 car, card, start）十有八九发 /ɑː/。',
    words: [
      { word: 'class', highlight: 'cl[a]ss', ipa: '/klɑːs/', cn: '班级' },
      { word: 'start', highlight: 'st[ar]t', ipa: '/stɑːt/', cn: '开始' },
      { word: 'car', highlight: 'c[ar]', ipa: '/kɑː(r)/', cn: '小汽车' }
    ]
  },
  {
    symbol: '/ɔː/',
    group: 'VOWEL_LONG',
    groupLabel: '长元音 (5个)',
    name: '长元音·圆唇长嗷音',
    cueSpeech: 'or. morning. four. door.',
    graphemes: 'or, al, au, oor, our',
    mouthTip: '双唇收得又小又圆并向前突出，舌身后缩，发出长而浑厚的“奥——”音。',
    ruotingTip: 'Good morning 的 or 就发 /ɔː/；注意 our 在重读时发 /ɔː/ (four)，但在词尾弱读如 colour 中发 /ə/！',
    words: [
      { word: 'morning', highlight: 'm[or]ning', ipa: '/ˈmɔːnɪŋ/', cn: '早晨' },
      { word: 'four', highlight: 'f[our]', ipa: '/fɔː(r)/', cn: '数字四' },
      { word: 'small', highlight: 'sm[a]ll', ipa: '/smɔːl/', cn: '小的' }
    ]
  },
  {
    symbol: '/uː/',
    group: 'VOWEL_LONG',
    groupLabel: '长元音 (5个)',
    name: '长元音·火车鸣笛长呜音',
    cueSpeech: 'oo. schoolbag. blue. ruler.',
    graphemes: 'oo, u, ue, ui',
    mouthTip: '双唇收圆并拢向前突出（像吹口哨），舌身后缩，声音拉长“呜——”。',
    ruotingTip: '🔥 若婷高频错词点！schoolbag 中间是双 oo 发 /uː/；blue 结尾是 ue 发 /uː/（千万别颠倒写成 bule！）。',
    words: [
      { word: 'schoolbag', highlight: 'sch[oo]lbag', ipa: '/ˈskuːlbæɡ/', cn: '书包' },
      { word: 'blue', highlight: 'bl[ue]', ipa: '/bluː/', cn: '蓝色' },
      { word: 'ruler', highlight: 'r[u]ler', ipa: '/ˈruːlə(r)/', cn: '尺子' }
    ]
  },
  {
    symbol: '/ɜː/',
    group: 'VOWEL_LONG',
    groupLabel: '长元音 (5个)',
    name: '长元音·小鸟卷舌长音',
    cueSpeech: 'er. her. bird. first.',
    graphemes: 'er, ir, ur, ear, or',
    mouthTip: '双唇微开平展（不圆唇），舌身平放略向上抬，美音带自然卷舌。',
    ruotingTip: '记住“三姐妹看兽医”口诀：er (her) + ir (bird/first/girl) + ur (turn) 在重读音节里统统发 /ɜː/！',
    words: [
      { word: 'first', highlight: 'f[ir]st', ipa: '/fɜːst/', cn: '第一' },
      { word: 'her', highlight: 'h[er]', ipa: '/hɜː(r)/', cn: '她的' },
      { word: 'bird', highlight: 'b[ir]d', ipa: '/bɜːd/', cn: '小鸟' }
    ]
  },

  // -------------------- 2. 单元音 · 7 个短元音 (Short Vowels) --------------------
  {
    symbol: '/ɪ/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·短促松弛一音',
    cueSpeech: 'ih. big. sit. tidy.',
    graphemes: 'i, y, e',
    mouthTip: '比 /iː/ 嘴巴略微张开一点（约一指宽），嘴角放松不拉紧，短促有力一收即止。',
    ruotingTip: '字母 i 在闭音节（big, pig, it, in, his）和词尾 y（tidy, hobby, family）里常发短音 /ɪ/！',
    words: [
      { word: 'big', highlight: 'b[i]g', ipa: '/bɪɡ/', cn: '大的' },
      { word: 'this', highlight: 'th[i]s', ipa: '/ðɪs/', cn: '这个' },
      { word: 'tidy', highlight: 'tid[y]', ipa: '/ˈtaɪdi/', cn: '整洁的' }
    ]
  },
  {
    symbol: '/e/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·一指微笑短音',
    cueSpeech: 'eh. pen. pencil. head.',
    graphemes: 'e, ea',
    mouthTip: '上下齿间可容纳一根食指，嘴角微向两边咧开，舌尖抵下齿，短促发音。',
    ruotingTip: '🔥 若婷易错点！① pencil 前半截就是 pen /pen/；② head 里是 ea 发短音 /e/，别写成 hat(/æ/) 或 hed！',
    words: [
      { word: 'pencil', highlight: 'p[e]ncil', ipa: '/ˈpensl/', cn: '铅笔' },
      { word: 'head', highlight: 'h[ea]d', ipa: '/hed/', cn: '头' },
      { word: 'red', highlight: 'r[e]d', ipa: '/red/', cn: '红色' }
    ]
  },
  {
    symbol: '/æ/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·梅花大嘴音',
    cueSpeech: 'aa. bag. cat. cap. black.',
    graphemes: 'a (闭音节)',
    mouthTip: '嘴巴张大（上下齿间可放两指半），嘴角同时向两边用力拉，舌尖用力抵住下齿背！',
    ruotingTip: '这是元音字母 a 在闭音节里的标志音！schoolbag 的 bag /bæɡ/、cap /kæp/、cat /kæt/ 全是梅花音 /æ/。',
    words: [
      { word: 'bag', highlight: 'b[a]g', ipa: '/bæɡ/', cn: '包' },
      { word: 'cap', highlight: 'c[a]p', ipa: '/kæp/', cn: '帽子' },
      { word: 'black', highlight: 'bl[a]ck', ipa: '/blæk/', cn: '黑色' }
    ]
  },
  {
    symbol: '/ʌ/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·尖角短阿音',
    cueSpeech: 'uh. cup. some. welcome.',
    graphemes: 'u, o',
    mouthTip: '嘴巴自然半开，舌身平放，短促有力地从嗓子发出轻快的“阿”音。',
    ruotingTip: '🔥 若婷在默写单里把 some 错写成 same(/eɪ/)！记住 some /sʌm/ 和 welcome 的 come /kʌm/ 都是 o 发短音 /ʌ/！',
    words: [
      { word: 'cup', highlight: 'c[u]p', ipa: '/kʌp/', cn: '杯子' },
      { word: 'some', highlight: 's[o]me', ipa: '/sʌm/', cn: '一些' },
      { word: 'welcome', highlight: 'welc[o]me', ipa: '/ˈwelkəm/', cn: '欢迎' }
    ]
  },
  {
    symbol: '/ɒ/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·圆唇短奥音',
    cueSpeech: 'oh. box. dog. bottle.',
    graphemes: 'o, a(w后)',
    mouthTip: '嘴巴张大并略微收圆，比长音 /ɔː/ 开口更大且非常短促。',
    ruotingTip: '闭音节里字母 o 的标准短音！box /bɒks/、bottle /ˈbɒtl/、dog /dɒɡ/、not /nɒt/。',
    words: [
      { word: 'box', highlight: 'b[o]x', ipa: '/bɒks/', cn: '盒子' },
      { word: 'bottle', highlight: 'b[o]ttle', ipa: '/ˈbɒtl/', cn: '瓶子' },
      { word: 'what', highlight: 'wh[a]t', ipa: '/wɒt/', cn: '什么' }
    ]
  },
  {
    symbol: '/ʊ/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·小圆桶短呜音',
    cueSpeech: 'uh. book. look. good. put.',
    graphemes: 'oo(k/d前), u, oul',
    mouthTip: '双唇微微收圆（不要像 /uː/ 那样用力嘟嘴），短促有力地发“乌”。',
    ruotingTip: '秒记口诀：“好(good)看(look)书(book)本木头(wood)脚(foot)，k 和 d 前 oo 变短音 /ʊ/！”',
    words: [
      { word: 'book', highlight: 'b[oo]k', ipa: '/bʊk/', cn: '书' },
      { word: 'look', highlight: 'l[oo]k', ipa: '/lʊk/', cn: '看' },
      { word: 'good', highlight: 'g[oo]d', ipa: '/ɡʊd/', cn: '好的' }
    ]
  },
  {
    symbol: '/ə/',
    group: 'VOWEL_SHORT',
    groupLabel: '短元音 (7个)',
    name: '短元音·最懒央元音 (Schwa)',
    cueSpeech: 'uh. colour. ruler. eraser.',
    graphemes: 'er, or, our, a, e, o (非重读)',
    mouthTip: '全身最放松的音！嘴巴微张，舌头平放正中央，轻轻叹出一声极短的“呃”。',
    ruotingTip: '🔥 专治拼写大坑！因为词尾的 er / or / our / a 弱读都发同一个懒音 /ə/，所以 colour(col+our)、eraser(eras+er)、favorite(fa-vor-ite) 千万不能只凭读音瞎写成 er！',
    words: [
      { word: 'colour', highlight: 'col[our]', ipa: '/ˈkʌlə(r)/', cn: '颜色' },
      { word: 'eraser', highlight: 'eras[er]', ipa: '/ɪˈreɪzə(r)/', cn: '橡皮' },
      { word: 'China', highlight: 'Chin[a]', ipa: '/ˈtʃaɪnə/', cn: '中国' }
    ]
  },

  // -------------------- 3. 双元音 · 8 个双元音 (Diphthongs) --------------------
  {
    symbol: '/eɪ/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '合口双元音·字母A本音',
    cueSpeech: 'ay. grade. name. eraser.',
    graphemes: 'a_e, ai, ay, ey',
    mouthTip: '从 /e/ 自然平滑地滑向 /ɪ/，口型由半开变小，前重后轻。',
    ruotingTip: '🔥 若婷把 grade 写成 grate！记住 a_e 魔法开音节发 /eɪ/（grade, name, cake, lake），且 A/H/J/K 四个字母都含 /eɪ/！',
    words: [
      { word: 'grade', highlight: 'gr[a]d[e]', ipa: '/ɡreɪd/', cn: '年级' },
      { word: 'name', highlight: 'n[a]m[e]', ipa: '/neɪm/', cn: '名字' },
      { word: 'eight', highlight: '[ei]ght', ipa: '/eɪt/', cn: '八' }
    ]
  },
  {
    symbol: '/aɪ/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '合口双元音·字母I本音',
    cueSpeech: 'eye. white. tidy. bicycle.',
    graphemes: 'i_e, y, igh, ie',
    mouthTip: '从大开口的 /a/ 滑向小开口的 /ɪ/，就像中文说“爱”但滑音更饱满。',
    ruotingTip: '🔥 若婷把 white 写成 wite、把 tidy 写成 tiey！white 是 wh + i_e(相对开音节发/aɪ/)；tidy 是 ti(/taɪ/) + dy(/di/)！',
    words: [
      { word: 'white', highlight: 'wh[i]t[e]', ipa: '/waɪt/', cn: '白色' },
      { word: 'tidy', highlight: 't[i]dy', ipa: '/ˈtaɪdi/', cn: '整洁的' },
      { word: 'fine', highlight: 'f[i]n[e]', ipa: '/faɪn/', cn: '健康的/好' }
    ]
  },
  {
    symbol: '/ɔɪ/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '合口双元音·男孩玩具音',
    cueSpeech: 'oy. boy. toy. point.',
    graphemes: 'oy, oi',
    mouthTip: '从圆唇的 /ɔ/ 平滑滑向扁唇的 /ɪ/，前重后轻。',
    ruotingTip: '词尾常写 oy（boy, toy），词中常写 oi（point, coin, join），看到 oy/oi 秒选 /ɔɪ/！',
    words: [
      { word: 'boy', highlight: 'b[oy]', ipa: '/bɔɪ/', cn: '男孩' },
      { word: 'toy', highlight: 't[oy]', ipa: '/tɔɪ/', cn: '玩具' },
      { word: 'point', highlight: 'p[oi]nt', ipa: '/pɔɪnt/', cn: '指/分数' }
    ]
  },
  {
    symbol: '/əʊ/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '合口双元音·字母O本音',
    cueSpeech: 'oh. yellow. nose. go.',
    graphemes: 'o, o_e, oa, ow',
    mouthTip: '由中元音 /ə/ 滑向圆唇的 /ʊ/，嘴唇最后收圆。',
    ruotingTip: '字母 O 的本音！那些开音节词（no, go, hello, those, nose）和词尾 ow（yellow, window）都发 /əʊ/。',
    words: [
      { word: 'yellow', highlight: 'yell[ow]', ipa: '/ˈjeləʊ/', cn: '黄色' },
      { word: 'those', highlight: 'th[o]s[e]', ipa: '/ðəʊz/', cn: '那些' },
      { word: 'hello', highlight: 'hell[o]', ipa: '/həˈləʊ/', cn: '你好' }
    ]
  },
  {
    symbol: '/aʊ/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '合口双元音·老虎咆哮音',
    cueSpeech: 'ow. brown. how. trousers.',
    graphemes: 'ou, ow',
    mouthTip: '从大嘴 /a/ 滑向小圆唇 /ʊ/，像不小心扎到手喊“嗷(ow)”的声音。',
    ruotingTip: '注意区分 ow 的两种读音：在 yellow 中发 /əʊ/，但在 brown /braʊn/、how /haʊ/、now /naʊ/、cow /kaʊ/ 中发 /aʊ/！',
    words: [
      { word: 'brown', highlight: 'br[ow]n', ipa: '/braʊn/', cn: '棕色' },
      { word: 'trousers', highlight: 'tr[ou]sers', ipa: '/ˈtraʊzəz/', cn: '裤子' },
      { word: 'how', highlight: 'h[ow]', ipa: '/haʊ/', cn: '怎样' }
    ]
  },
  {
    symbol: '/ɪə/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '集中双元音·耳朵倾听音',
    cueSpeech: 'ear. year. here. near.',
    graphemes: 'ear, eer, ere',
    mouthTip: '从 /ɪ/ 迅速滑向央元音 /ə/，美音词尾带轻微卷舌。',
    ruotingTip: '🔥 若婷听写把 year 写成 yare！记住 y + ear(耳朵 /ɪə/) = year(年)！',
    words: [
      { word: 'year', highlight: 'y[ear]', ipa: '/jɪə(r)/', cn: '年/岁' },
      { word: 'ear', highlight: '[ear]', ipa: '/ɪə(r)/', cn: '耳朵' },
      { word: 'here', highlight: 'h[ere]', ipa: '/hɪə(r)/', cn: '这里' }
    ]
  },
  {
    symbol: '/eə/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '集中双元音·空气椅子音',
    cueSpeech: 'air. chair. where. hair.',
    graphemes: 'air, ere, ear, are',
    mouthTip: '从半开的 /e/ 滑向央元音 /ə/。',
    ruotingTip: '🔥 若婷两个错词都在这！① chair = ch + air(空气 /eə/)，别写成 chlir；② where = wh + ere(/eə/)，绝不能把 r 写到 e 前面变成 whrer！',
    words: [
      { word: 'chair', highlight: 'ch[air]', ipa: '/tʃeə(r)/', cn: '椅子' },
      { word: 'where', highlight: 'wh[ere]', ipa: '/weə(r)/', cn: '在哪里' },
      { word: 'pair', highlight: 'p[air]', ipa: '/peə(r)/', cn: '一双/一对' }
    ]
  },
  {
    symbol: '/ʊə/',
    group: 'DIPHTHONG',
    groupLabel: '双元音 (8个)',
    name: '集中双元音·确定旅游音',
    cueSpeech: 'oor. sure. tour. poor.',
    graphemes: 'ure, our, oor',
    mouthTip: '从圆唇短音 /ʊ/ 滑向央元音 /ə/。',
    ruotingTip: '初中常考三个词：sure /ʃʊə/（当然）、tour /tʊə/（旅行）、poor /pʊə/（贫穷的/可怜的）。',
    words: [
      { word: 'sure', highlight: 's[ure]', ipa: '/ʃʊə(r)/', cn: '当然/确信' },
      { word: 'tour', highlight: 't[our]', ipa: '/tʊə(r)/', cn: '旅行' },
      { word: 'poor', highlight: 'p[oor]', ipa: '/pʊə(r)/', cn: '可怜的' }
    ]
  },
  // -------------------- 4. 辅音 · 10 组清浊成对辅音 (20个) --------------------
  {
    symbol: '/p/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_pb',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '双唇爆破·清辅音',
    cueSpeech: 'p. pencil. pen. cap.',
    graphemes: 'p, pp',
    mouthTip: '双唇紧闭憋住一口气，然后突然张开让气流冲出，手摸喉咙完全不震动（只有气流声）。',
    ruotingTip: 'pencil = pen(/pen/) + cil(/sl/)，开头就是清脆的爆破音 /p/！',
    words: [
      { word: 'pencil', highlight: '[p]encil', ipa: '/ˈpensl/', cn: '铅笔' },
      { word: 'cap', highlight: 'ca[p]', ipa: '/kæp/', cn: '帽子' },
      { word: 'apple', highlight: 'a[pp]le', ipa: '/ˈæpl/', cn: '苹果' }
    ]
  },
  {
    symbol: '/b/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_pb',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '双唇爆破·浊辅音',
    cueSpeech: 'b. blue. bag. book.',
    graphemes: 'b, bb',
    mouthTip: '口型与 /p/ 完全一样（双唇紧闭再冲开），但发声瞬间声带用力震动（手摸喉咙有明显麻麻感）。',
    ruotingTip: 'blue = bl(/bl/) + ue(/uː/)，bag = b + a + g。',
    words: [
      { word: 'blue', highlight: '[b]lue', ipa: '/bluː/', cn: '蓝色' },
      { word: 'bag', highlight: '[b]ag', ipa: '/bæɡ/', cn: '包' },
      { word: 'book', highlight: '[b]ook', ipa: '/bʊk/', cn: '书' }
    ]
  },
  {
    symbol: '/t/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_td',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '舌尖齿龈爆破·清辅音',
    cueSpeech: 't. tidy. white. table.',
    graphemes: 't, tt',
    mouthTip: '舌尖紧贴上齿龈憋气，突然弹开让气流喷出，声带不振动。',
    ruotingTip: '🔥 若婷把 grade 写成了 grate！一定要摸喉咙区分词尾清辅音 /t/(white, kite) 和浊辅音 /d/(grade, red, head)！',
    words: [
      { word: 'tidy', highlight: '[t]idy', ipa: '/ˈtaɪdi/', cn: '整洁的' },
      { word: 'white', highlight: 'whi[t]e', ipa: '/waɪt/', cn: '白色' },
      { word: 'ten', highlight: '[t]en', ipa: '/ten/', cn: '十' }
    ]
  },
  {
    symbol: '/d/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_td',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '舌尖齿龈爆破·浊辅音',
    cueSpeech: 'd. grade. head. tidy.',
    graphemes: 'd, dd',
    mouthTip: '舌尖位置与 /t/ 完全一致，弹开时声带振动。',
    ruotingTip: '🔥 若婷错词 grade (gr-ade)、head (h-ea-d)、tidy (ti-dy) 里全都有浊辅音 /d/！',
    words: [
      { word: 'grade', highlight: 'gra[d]e', ipa: '/ɡreɪd/', cn: '年级' },
      { word: 'head', highlight: 'hea[d]', ipa: '/hed/', cn: '头' },
      { word: 'desk', highlight: '[d]esk', ipa: '/desk/', cn: '书桌' }
    ]
  },
  {
    symbol: '/k/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_kg',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '舌后软腭爆破·清辅音',
    cueSpeech: 'k. keep. colour. schoolbag.',
    graphemes: 'k, c, ck, ch(school)',
    mouthTip: '舌根抬高顶住软腭憋气，突然放开冲出气流，声带不振动。',
    ruotingTip: '🔥 重点记住：schoolbag 的 sch 里，ch 发 /k/，连起来读 /sk/（且不可漏掉 c 写成 shoolbag）！',
    words: [
      { word: 'colour', highlight: '[c]olour', ipa: '/ˈkʌlə(r)/', cn: '颜色' },
      { word: 'keep', highlight: '[k]eep', ipa: '/kiːp/', cn: '保持' },
      { word: 'schoolbag', highlight: 's[ch]oolbag', ipa: '/ˈskuːlbæɡ/', cn: '书包' }
    ]
  },
  {
    symbol: '/ɡ/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_kg',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '舌后软腭爆破·浊辅音',
    cueSpeech: 'g. green. grade. bag.',
    graphemes: 'g, gg',
    mouthTip: '口型舌位与 /k/ 相同，爆破时声带用力振动。',
    ruotingTip: 'green (gr-ee-n) 和 grade (gr-a_e-d) 开头都是辅音连缀 gr- /ɡr/！',
    words: [
      { word: 'green', highlight: '[g]reen', ipa: '/ɡriːn/', cn: '绿色' },
      { word: 'grade', highlight: '[g]rade', ipa: '/ɡreɪd/', cn: '年级' },
      { word: 'good', highlight: '[g]ood', ipa: '/ɡʊd/', cn: '好的' }
    ]
  },
  {
    symbol: '/f/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_fv',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '唇齿摩擦·清辅音',
    cueSpeech: 'f. favorite. fine. four.',
    graphemes: 'f, ff, ph, gh',
    mouthTip: '上门牙轻轻咬住下嘴唇内侧，让气流从唇齿缝隙吹出，声带不振动。',
    ruotingTip: 'favorite 第一音节 fa- /ˈfeɪ/ 或 /ˈfæ/，第二个音节 -vor- 则是唇齿浊辅音 /v/！',
    words: [
      { word: 'favorite', highlight: '[f]avorite', ipa: '/ˈfeɪvərɪt/', cn: '最喜爱的' },
      { word: 'fine', highlight: '[f]ine', ipa: '/faɪn/', cn: '健康的' },
      { word: 'photo', highlight: '[ph]oto', ipa: '/ˈfəʊtəʊ/', cn: '照片' }
    ]
  },
  {
    symbol: '/v/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_fv',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '唇齿摩擦·浊辅音',
    cueSpeech: 'v. favorite. five. very.',
    graphemes: 'v, ve',
    mouthTip: '同样是上牙轻咬下唇，吹气同时声带振动（嘴唇会感到微微发麻，绝不能读成 /w/！）。',
    ruotingTip: '🔥 若婷把 favorite 写成 fevoret！按三音节拆开：fa + vor(/vər/) + ite，中间是 v-o-r！',
    words: [
      { word: 'favorite', highlight: 'fa[v]orite', ipa: '/ˈfeɪvərɪt/', cn: '最喜爱的' },
      { word: 'five', highlight: 'fi[v]e', ipa: '/faɪv/', cn: '五' },
      { word: 'very', highlight: '[v]ery', ipa: '/ˈveri/', cn: '非常' }
    ]
  },
  {
    symbol: '/θ/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_th',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '咬舌摩擦·清辅音 (周测必考)',
    cueSpeech: 'th. thank. three. thing.',
    graphemes: 'th (实词/数词居多)',
    mouthTip: '舌尖微微伸出上下门牙之间（轻轻咬住舌尖），吹气让气流从舌齿缝隙嘶嘶吹出，声带不振动！',
    ruotingTip: '🚨 9.23周测原题高频考点！th 发清音 /θ/ 常见于：three(3)、thank(感谢)、thing(事情)、think(想)、math(数学)、mouth(嘴)！',
    words: [
      { word: 'thank', highlight: '[th]ank', ipa: '/θæŋk/', cn: '感谢' },
      { word: 'three', highlight: '[th]ree', ipa: '/θriː/', cn: '三' },
      { word: 'thing', highlight: '[th]ing', ipa: '/θɪŋ/', cn: '东西/事情' }
    ]
  },
  {
    symbol: '/ð/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_th',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '咬舌摩擦·浊辅音 (周测必考)',
    cueSpeech: 'th. this. that. those. mother.',
    graphemes: 'th (代词/冠词/亲属词)',
    mouthTip: '同样舌尖微伸上下齿间轻咬，吹气同时声带用力振动（舌尖会感觉麻麻的）！',
    ruotingTip: '🚨 9.23周测辨音秒杀口诀：“代词冠词加亲属，th 统统发浊音 /ð/！”——this, that, these, those, the, they, them, mother, father, brother 全是 /ð/！',
    words: [
      { word: 'this', highlight: '[th]is', ipa: '/ðɪs/', cn: '这个' },
      { word: 'those', highlight: '[th]ose', ipa: '/ðəʊz/', cn: '那些' },
      { word: 'them', highlight: '[th]em', ipa: '/ðem/', cn: '他们(宾格)' }
    ]
  },
  {
    symbol: '/s/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_sz',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '齿龈摩擦·清辅音',
    cueSpeech: 's. pencil. some. schoolbag.',
    graphemes: 's, ss, c(在e/i/y前)',
    mouthTip: '上下齿自然靠近，舌尖接近齿龈，气流从窄缝中挤出“嘶——”声，声带不振。',
    ruotingTip: '🔥 若婷把 pencil 写成 penit/pienco！为什么 pencil 中间是字母 c 却发 /s/？因为自然拼读铁律：“字母 c 遇到 e / i / y 时发 /s/ 音（pencil, nice, bicycle, city）”！',
    words: [
      { word: 'pencil', highlight: 'pen[c]il', ipa: '/ˈpensl/', cn: '铅笔' },
      { word: 'some', highlight: '[s]ome', ipa: '/sʌm/', cn: '一些' },
      { word: 'bicycle', highlight: 'bi[c]ycle', ipa: '/ˈbaɪsɪkl/', cn: '自行车' }
    ]
  },
  {
    symbol: '/z/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_sz',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '齿龈摩擦·浊辅音',
    cueSpeech: 'z. zoo. zero. eraser. keys.',
    graphemes: 'z, s(元音间/浊音后词尾)',
    mouthTip: '口型舌位与 /s/ 相同，发音时声带强烈振动（像小蜜蜂嗡嗡飞）。',
    ruotingTip: '名词变复数加 -s：在清辅音后读 /s/ (books, caps)，在元音和浊辅音后读 /z/ (pens, bags, keys, chairs)！',
    words: [
      { word: 'eraser', highlight: 'era[s]er', ipa: '/ɪˈreɪzə(r)/', cn: '橡皮' },
      { word: 'keys', highlight: 'key[s]', ipa: '/kiːz/', cn: '钥匙(复数)' },
      { word: 'zoo', highlight: '[z]oo', ipa: '/zuː/', cn: '动物园' }
    ]
  },
  {
    symbol: '/ʃ/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_sh',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '卷舌摩擦·安静嘘音',
    cueSpeech: 'sh. she. ship. English.',
    graphemes: 'sh, s(sure), ti(tion)',
    mouthTip: '双唇略微向前翘起，舌身抬向硬腭，发出让别人安静的“嘘(sh)——”音，声带不振。',
    ruotingTip: '🔥 区分 sh(/ʃ/) 和 sch(/sk/)：she, shoes, English 是 sh；而 schoolbag 是 s + ch(/k/) = sch！',
    words: [
      { word: 'she', highlight: '[sh]e', ipa: '/ʃiː/', cn: '她' },
      { word: 'English', highlight: 'Engli[sh]', ipa: '/ˈɪŋɡlɪʃ/', cn: '英语' },
      { word: 'shoes', highlight: '[sh]oes', ipa: '/ʃuːz/', cn: '鞋子' }
    ]
  },
  {
    symbol: '/ʒ/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_sh',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '卷舌摩擦·浊辅音',
    cueSpeech: 'zh. usually. pleasure. television.',
    graphemes: 's(在u/i前), si(sion)',
    mouthTip: '口型与 /ʃ/ 完全相同（双唇微翘），同时声带振动（近似中文“日”但舌头不抵齿龈）。',
    ruotingTip: '记住三个高频代表词：usually /ˈjuːʒuəli/（通常）、pleasure /ˈpleʒə/（愉快）、television /ˈtelɪvɪʒn/（电视）。',
    words: [
      { word: 'usually', highlight: 'u[s]ually', ipa: '/ˈjuːʒuəli/', cn: '通常' },
      { word: 'pleasure', highlight: 'plea[s]ure', ipa: '/ˈpleʒə(r)/', cn: '愉快/荣幸' },
      { word: 'television', highlight: 'televi[s]ion', ipa: '/ˈtelɪvɪʒn/', cn: '电视' }
    ]
  },
  {
    symbol: '/tʃ/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_ch',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '破擦音·小火车喷气清音',
    cueSpeech: 'ch. chair. China. teacher.',
    graphemes: 'ch, tch',
    mouthTip: '舌尖先顶住上齿龈憋气，然后微微松开擦出“吃(ch)”的气流声，声带不振动。',
    ruotingTip: '🔥 若婷把 chair 写成 chlir！chair 就是 ch(/tʃ/) + air(/eə/ 空气)，另外 watch 变复数要加 -es 变成 watches！',
    words: [
      { word: 'chair', highlight: '[ch]air', ipa: '/tʃeə(r)/', cn: '椅子' },
      { word: 'China', highlight: '[Ch]ina', ipa: '/ˈtʃaɪnə/', cn: '中国' },
      { word: 'teacher', highlight: 'tea[ch]er', ipa: '/ˈtiːtʃə(r)/', cn: '老师' }
    ]
  },
  {
    symbol: '/dʒ/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_ch',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '破擦音·橘子汁浊音',
    cueSpeech: 'j. orange. jacket. page.',
    graphemes: 'j, g(在e/i/y前), dge',
    mouthTip: '口型与 /tʃ/ 相同，破擦瞬间声带振动（字母 J j /dʒeɪ/ 和 G g /dʒiː/ 都含此音）。',
    ruotingTip: '字母 g 遇到 e/i/y 时常发 /dʒ/，如 orange /ˈɒrɪndʒ/、page /peɪdʒ/、geography(地理)！',
    words: [
      { word: 'orange', highlight: 'oran[ge]', ipa: '/ˈɒrɪndʒ/', cn: '橙色/橙子' },
      { word: 'jacket', highlight: '[j]acket', ipa: '/ˈdʒækɪt/', cn: '夹克衫' },
      { word: 'page', highlight: 'pa[ge]', ipa: '/peɪdʒ/', cn: '页码' }
    ]
  },
  {
    symbol: '/tr/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_tr',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '破擦音·大树吹风清音',
    cueSpeech: 'tr. tree. trousers. country.',
    graphemes: 'tr',
    mouthTip: '双唇微微撅起，舌尖翘起顶住上齿龈后部再冲开，发出清脆的“戳(tr)”气音。',
    ruotingTip: '🔥 若婷 10.21 听写卷里 country(国家) 留了空白！拆音节记忆：coun(/kʌn/) + try(/tri/)，后面就是 tr + y！',
    words: [
      { word: 'country', highlight: 'coun[tr]y', ipa: '/ˈkʌntri/', cn: '国家' },
      { word: 'trousers', highlight: '[tr]ousers', ipa: '/ˈtraʊzəz/', cn: '裤子' },
      { word: 'tree', highlight: '[tr]ee', ipa: '/triː/', cn: '树' }
    ]
  },
  {
    symbol: '/dr/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_tr',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '破擦音·小水滴浊音',
    cueSpeech: 'dr. dress. draw. drive.',
    graphemes: 'dr',
    mouthTip: '口型与 /tr/ 一致，双唇微翘，发声时声带振动。',
    ruotingTip: '见 dr 组合必发 /dr/：dress（连衣裙）、draw（画画）、drink（喝）、driver（司机）。',
    words: [
      { word: 'dress', highlight: '[dr]ess', ipa: '/dres/', cn: '连衣裙' },
      { word: 'draw', highlight: '[dr]aw', ipa: '/drɔː/', cn: '画画' },
      { word: 'drink', highlight: '[dr]ink', ipa: '/drɪŋk/', cn: '喝' }
    ]
  },
  {
    symbol: '/ts/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_ts',
    voicing: '清辅音(声带不振)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '破擦音·名词复数清尾音',
    cueSpeech: 'ts. cats. hats. carrots.',
    graphemes: 'ts, tes',
    mouthTip: '舌尖先抵上齿龈做 /t/，紧接着滑向 /s/，短促清脆（像中文“次”的气声）。',
    ruotingTip: '以 t 结尾的名词变复数加 s 时，t + s 合起来一口气读作 /ts/（cats, hats, carrots, plants）！',
    words: [
      { word: 'cats', highlight: 'ca[ts]', ipa: '/kæts/', cn: '猫(复数)' },
      { word: 'carrots', highlight: 'carro[ts]', ipa: '/ˈkærəts/', cn: '胡萝卜(复数)' },
      { word: 'hats', highlight: 'ha[ts]', ipa: '/hæts/', cn: '帽子(复数)' }
    ]
  },
  {
    symbol: '/dz/',
    group: 'CONSONANT_PAIR',
    pairId: 'pair_ts',
    voicing: '浊辅音(声带振动)',
    groupLabel: '清浊成对辅音 (20个)',
    name: '破擦音·名词复数浊尾音',
    cueSpeech: 'ds. birds. friends. beds.',
    graphemes: 'ds, des',
    mouthTip: '口型与 /ts/ 相同，声带振动（像中文“资”的浊音）。',
    ruotingTip: '以 d 结尾的名词变复数加 s 时，d + s 合起来读作 /dz/（birds, friends, beds, cards）！',
    words: [
      { word: 'friends', highlight: 'frien[ds]', ipa: '/frendz/', cn: '朋友(复数)' },
      { word: 'birds', highlight: 'bir[ds]', ipa: '/bɜːdz/', cn: '鸟(复数)' },
      { word: 'beds', highlight: 'be[ds]', ipa: '/bedz/', cn: '床(复数)' }
    ]
  },

  // -------------------- 5. 辅音 · 8 个独立辅音 (3鼻音 + 3似拼音 + 2半元音) --------------------
  {
    symbol: '/m/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '双唇鼻音·美味闭唇音',
    cueSpeech: 'm. morning. some. welcome.',
    graphemes: 'm, mm, mb',
    mouthTip: '双唇紧闭，软腭下垂，让气流从鼻腔哼出“呣(m)——”声，声带振动。',
    ruotingTip: '在词首读“摸”(morning, map)，在词尾要双唇紧闭发鼻音“呣”(some, welcome, name, time)！',
    words: [
      { word: 'welcome', highlight: 'welco[m]e', ipa: '/ˈwelkəm/', cn: '欢迎' },
      { word: 'some', highlight: 'so[m]e', ipa: '/sʌm/', cn: '一些' },
      { word: 'name', highlight: 'na[m]e', ipa: '/neɪm/', cn: '名字' }
    ]
  },
  {
    symbol: '/n/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '齿龈鼻音·微张开口鼻音',
    cueSpeech: 'n. pencil. green. fine.',
    graphemes: 'n, nn, kn',
    mouthTip: '双唇微开（不要闭嘴！），舌尖紧贴上齿龈，气流从鼻腔哼出“嗯(n)”。',
    ruotingTip: 'pencil 的 pen、green 的词尾 n、fine 的词尾 ne 全是舌尖顶上齿龈的 /n/！',
    words: [
      { word: 'green', highlight: 'gree[n]', ipa: '/ɡriːn/', cn: '绿色' },
      { word: 'pencil', highlight: 'pe[n]cil', ipa: '/ˈpensl/', cn: '铅笔' },
      { word: 'fine', highlight: 'fi[n]e', ipa: '/faɪn/', cn: '好的' }
    ]
  },
  {
    symbol: '/ŋ/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '后鼻音·长鼻子大象音',
    cueSpeech: 'ng. greeting. morning. English.',
    graphemes: 'ng, n(在k/g前)',
    mouthTip: '嘴巴微开，舌根抬起贴住软腭，气流从鼻腔深处发出后鼻音“昂(ng)”。',
    ruotingTip: '🔥 若婷 10.21 听写卷里 greeting(问候) 不会拼！拆开记：greet(问候 /ɡriːt/) + ing(/ɪŋ/) = greeting！',
    words: [
      { word: 'greeting', highlight: 'greeti[ng]', ipa: '/ˈɡriːtɪŋ/', cn: '问候/招呼' },
      { word: 'morning', highlight: 'morni[ng]', ipa: '/ˈmɔːnɪŋ/', cn: '早晨' },
      { word: 'thank', highlight: 'tha[n]k', ipa: '/θæŋk/', cn: '感谢' }
    ]
  },
  {
    symbol: '/h/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '声门摩擦·呵气清音',
    cueSpeech: 'h. head. hello. who.',
    graphemes: 'h, wh(在o前)',
    mouthTip: '嘴巴自然张开，像冬天对着手心哈暖气一样轻轻呵出气流，声带不振动。',
    ruotingTip: '注意 wh 组合：大多数时候发 /w/ (where, what, white)，但遇到 o 时发 /h/ (who /huː/, whose /huːz/)！',
    words: [
      { word: 'head', highlight: '[h]ead', ipa: '/hed/', cn: '头' },
      { word: 'hello', highlight: '[h]ello', ipa: '/həˈləʊ/', cn: '你好' },
      { word: 'who', highlight: '[wh]o', ipa: '/huː/', cn: '谁' }
    ]
  },
  {
    symbol: '/l/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '舌侧音·清晰音与含糊音',
    cueSpeech: 'l. blue. schoolbag. pencil.',
    graphemes: 'l, ll',
    mouthTip: '元音前读“勒”(look, blue)；元音后或词尾舌尖抵住上齿龈，发出浑厚的“欧(l)”音（school, pencil, bottle）。',
    ruotingTip: '🔥 若婷错词重灾区！① schoolbag 别把 l 写到 oo 前面变成 schloobag；② blue 是 b-l-u-e，别把 l 写到 u 后面变成 bule；③ pencil 结尾是 c-i-l，别漏掉 l！',
    words: [
      { word: 'schoolbag', highlight: 'schoo[l]bag', ipa: '/ˈskuːlbæɡ/', cn: '书包' },
      { word: 'blue', highlight: 'b[l]ue', ipa: '/bluː/', cn: '蓝色' },
      { word: 'pencil', highlight: 'penci[l]', ipa: '/ˈpensl/', cn: '铅笔' }
    ]
  },
  {
    symbol: '/r/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '卷舌摩擦·小狗弱卷舌音',
    cueSpeech: 'r. ruler. red. grade.',
    graphemes: 'r, rr, wr',
    mouthTip: '舌尖向上卷起（不要碰到上颚），双唇微微拢圆向前突出，声带振动。',
    ruotingTip: '辅音连缀 gr- (green, grade)、br- (brown) 都要快速滑过 /r/！',
    words: [
      { word: 'ruler', highlight: '[r]uler', ipa: '/ˈruːlə(r)/', cn: '尺子' },
      { word: 'red', highlight: '[r]ed', ipa: '/red/', cn: '红色' },
      { word: 'write', highlight: '[wr]ite', ipa: '/raɪt/', cn: '写(w不发音)' }
    ]
  },
  {
    symbol: '/w/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '双唇半元音·圆唇滑音',
    cueSpeech: 'w. where. white. welcome.',
    graphemes: 'w, wh',
    mouthTip: '双唇收得又小又圆向前突出（像发 /uː/），然后迅速滑向后面的元音，声带振动。',
    ruotingTip: '🔥 若婷错词 where、white、welcome 全是 /w/ 开头！记住 wh 开头先写 w-h，后面再接元音（wh+ere, wh+ite）！',
    words: [
      { word: 'where', highlight: '[wh]ere', ipa: '/weə(r)/', cn: '在哪里' },
      { word: 'white', highlight: '[wh]ite', ipa: '/waɪt/', cn: '白色' },
      { word: 'welcome', highlight: '[w]elcome', ipa: '/ˈwelkəm/', cn: '欢迎' }
    ]
  },
  {
    symbol: '/j/',
    group: 'CONSONANT_OTHER',
    groupLabel: '鼻音/似拼音/半元音 (8个)',
    name: '舌面半元音·耶音 (注意不是j!)',
    cueSpeech: 'y. year. yellow. you.',
    graphemes: 'y, u(/juː/)',
    mouthTip: '舌前部向硬腭抬起（像发 /iː/），迅速滑向后面的元音，读作轻快的“耶(y)”。',
    ruotingTip: '🚨 音标最大视觉陷阱：音标 /j/ 对应的是字母 y（year /jɪə/, yellow /ˈjeləʊ/, yes /jes/），而不是字母 j（字母 j 发 /dʒ/）！另外字母 U u 读作 /juː/（辅音音素 /j/ 开头，所以前面用 a UFO / a useful book）！',
    words: [
      { word: 'year', highlight: '[y]ear', ipa: '/jɪə(r)/', cn: '年/岁' },
      { word: 'yellow', highlight: '[y]ellow', ipa: '/ˈjeləʊ/', cn: '黄色' },
      { word: 'unit', highlight: '[u]nit', ipa: '/ˈjuːnɪt/', cn: '单元(/juː/开头)' }
    ]
  }
];
// ============================================================================
// 🪄 自然拼读 5 大黄金法则数据库（专治死记硬背字母顺序）
// ============================================================================

const PHONICS_RULES_DATA = [
  {
    id: 'rule_magic_e',
    badge: '法则 1 · 必考核心',
    title: '🪄 Magic E 魔法不发音 e（闭音节 ➔ 相对开音节秒变身）',
    color: '#db2777',
    bg: '#fdf2f8',
    summary: '当单词末尾加上一个不发音的魔法字母 e（结构为：元音 + 辅音 + e），前面的元音字母立刻从“短促闭音节音”变回“字母原本的名字音”！',
    mnemonic: '口诀：“词尾小 e 不说话，隔山打牛施魔法；前面元音喊本名，a 读 /eɪ/ 来 i 读 /aɪ/！”',
    pairs: [
      { closed: 'cap /kæp/ (帽子)', open: 'name /neɪm/ · grade /ɡreɪd/ (a_e 读 /eɪ/)', speak: 'cap. name. grade.' },
      { closed: 'big /bɪɡ/ · sit /sɪt/', open: 'white /waɪt/ · fine /faɪn/ (i_e 读 /aɪ/)', speak: 'big. white. fine.' },
      { closed: 'not /nɒt/ · box /bɒks/', open: 'nose /nəʊz/ · those /ðəʊz/ (o_e 读 /əʊ/)', speak: 'box. nose. those.' },
      { closed: 'cup /kʌp/ · bus /bʌs/', open: 'cute /kjuːt/ · ruler /ˈruːlə/ (u_e 读 /juː/ 或 /uː/)', speak: 'cup. cute. ruler.' }
    ]
  },
  {
    id: 'rule_vowel_teams',
    badge: '法则 2 · 字母颠倒克星',
    title: '👯 高频元音字母组合（ee/ea · oo长短音 · air/ear）',
    color: '#7c3aed',
    bg: '#f5f3ff',
    summary: '两个或三个字母抱团发一个元音！把字母组合当成一个整体积木来记，就再也不会把 schoolbag、green、head、chair、where、year 写颠倒！',
    mnemonic: '口诀：“双 e 见面笑眯眯 /iː/，好(good)看(look)书(book)本 oo 变短 /ʊ/；ch 加空气(air)是椅子，y 加耳朵(ear)是一年！”',
    pairs: [
      { closed: 'ee / ea 读长音 /iː/', open: 'gr[ee]n (绿) · k[ee]p (保持) · pl[ea]se (请)', speak: 'green. keep. please.' },
      { closed: 'ea 特例读短音 /e/', open: 'h[ea]d /hed/ (头) · br[ea]d (面包) · sw[ea]ter (毛衣)', speak: 'head. bread. sweater.' },
      { closed: 'oo 长音 /uː/ vs 短音 /ʊ/', open: 'sch[oo]lbag /uː/ (书包) vs b[oo]k / l[oo]k / g[oo]d /ʊ/', speak: 'schoolbag. book. look. good.' },
      { closed: 'air / ere 读 /eə/ vs ear 读 /ɪə/', open: 'ch[air] (椅子) · wh[ere] (哪里) vs y[ear] (年) · [ear] (耳朵)', speak: 'chair. where. year.' }
    ]
  },
  {
    id: 'rule_consonant_blends',
    badge: '法则 3 · 辨音与首字母',
    title: '🛡️ 必考辅音组合与辅音连缀（th清浊 · wh三兄弟 · sch · bl/gr）',
    color: '#2563eb',
    bg: '#eff6ff',
    summary: '9.23 周测卷直接考了 th 的 /θ/ 与 /ð/ 辨音！同时 blue(bl+ue)、schoolbag(sch+ool+bag)、where(wh+ere) 全靠辅音团块定型。',
    mnemonic: '口诀：“实词数词 th 清(/θ/)，代词冠词亲属浊(/ð/)；wh 遇 o 读 /h/(who)，其余统统读作 /w/(where/white)！”',
    pairs: [
      { closed: 'th 咬舌清音 /θ/', open: '[th]ree (三) · [th]ank (感谢) · [th]ing (事情)', speak: 'three. thank. thing.' },
      { closed: 'th 咬舌浊音 /ð/', open: '[th]is (这) · [th]at (那) · [th]ose (那些) · mo[th]er (妈妈)', speak: 'this. that. those. mother.' },
      { closed: 'wh 组合 (/w/ 与 /h/)', open: '[wh]ere (哪里) · [wh]ite (白) · [wh]at (什么) vs [wh]o /huː/ (谁)', speak: 'where. white. what. who.' },
      { closed: 'sch /sk/ 与 bl / gr 连缀', open: '[sch]oolbag (书包) · [bl]ue (蓝) · [gr]ade (年级) · [gr]een (绿)', speak: 'schoolbag. blue. grade. green.' }
    ]
  },
  {
    id: 'rule_c_g_soft',
    badge: '法则 4 · 攻克 pencil',
    title: '🎭 字母 C 和 G 的“变脸术”（硬音 vs 软音）',
    color: '#d97706',
    bg: '#fffbeb',
    summary: '为什么 cap/colour 里的 c 读 /k/，而 pencil/bicycle 里的 c 却读 /s/？掌握这条规律，永远不会把 pencil 写成 penit！',
    mnemonic: '口诀：“c 和 g 有脾气，遇到 e / i / y 就变软：c 变 /s/ (pencil/nice)，g 变 /dʒ/ (orange/page)；其余时候硬邦邦 (/k/ 和 /ɡ/)！”',
    pairs: [
      { closed: '硬音 C 读 /k/ (a/o/u前)', open: '[c]ap (帽) · [c]olour (颜色) · [c]up (杯) · [c]ountry (国家)', speak: 'cap. colour. cup. country.' },
      { closed: '软音 C 读 /s/ (e/i/y前)', open: 'pen[c]il /ˈpensl/ (铅笔) · bi[c]ycle (自行车) · ni[c]e (好)', speak: 'pencil. bicycle. nice.' },
      { closed: '硬音 G 读 /ɡ/ vs 软音 /dʒ/', open: '[g]rade / [g]reen (/ɡ/) vs oran[ge] / pa[ge] (/dʒ/)', speak: 'grade. green. orange. page.' }
    ]
  },
  {
    id: 'rule_r_schwa',
    badge: '法则 5 · 攻克 colour/favorite',
    title: '🌀 R-控制音与非重读懒音 /ə/（专治词尾元音乱写）',
    color: '#059669',
    bg: '#ecfdf5',
    summary: '英语多音节词里，没重读的音节常偷懒读成央元音 /ə/ 或 /ɪ/。拼写这类词必须“重读记原形、拍手拆音节”！',
    mnemonic: '口诀：“长词切忌胡乱猜，拍手三段拆开来：col+our 英式带 u，fa+vor+ite 三步走，eras+er 橡皮擦！”',
    pairs: [
      { closed: '英式 -our vs 美式 -or', open: 'col[our] /ˈkʌlə/ (颜色·考卷必写 u) · fav[or]ite (最喜爱)', speak: 'colour. favorite.' },
      { closed: '词尾 -er 读懒音 /ə/', open: 'rul[er] (尺子) · eras[er] (橡皮) · teach[er] (老师) · und[er] (在…下)', speak: 'ruler. eraser. teacher. under.' },
      { closed: '重读 er / ir / ur 读 /ɜː/', open: 'h[er] (她的) · f[ir]st (第一) · b[ir]d (小鸟)', speak: 'her. first. bird.' }
    ]
  }
];

// ============================================================================
// 🧱 若婷 10.21 听写与默写 14 个真实错词「拆音节积木工坊」数据库
// ============================================================================

const RUOTING_WORKSHOP_WORDS = [
  {
    word: 'schoolbag',
    ipa: '/ˈskuːlbæɡ/',
    cn: 'n. 书包 (Bridging Unit 2)',
    wrong: 'shoolbag (二默漏c) / schloobag (一默l颠倒)',
    bricks: [
      { letters: 'sch', ipa: '/sk/', color: '#4f46e5', speak: 'sk' },
      { letters: 'oo', ipa: '/uː/', color: '#e11d48', speak: 'oo' },
      { letters: 'l', ipa: '/l/', color: '#0284c7', speak: 'l' },
      { letters: 'b', ipa: '/b/', color: '#059669', speak: 'b' },
      { letters: 'a', ipa: '/æ/', color: '#d97706', speak: 'a' },
      { letters: 'g', ipa: '/ɡ/', color: '#7c3aed', speak: 'g' }
    ],
    syllables: 'school · bag',
    secret: '合成词拆半法：学校 school (sch /sk/ + oo /uː/ + l /l/) + 包 bag (b-a-g) = schoolbag！绝不漏掉 c，且双 o 在 l 前面！',
    sentence: 'My schoolbag is heavy and tidy.'
  },
  {
    word: 'pencil',
    ipa: '/ˈpensl/',
    cn: 'n. 铅笔 (Bridging Unit 2)',
    wrong: 'penit (一默) / pienco (二默)',
    bricks: [
      { letters: 'p', ipa: '/p/', color: '#4f46e5', speak: 'p' },
      { letters: 'e', ipa: '/e/', color: '#e11d48', speak: 'eh' },
      { letters: 'n', ipa: '/n/', color: '#0284c7', speak: 'n' },
      { letters: 'c', ipa: '/s/', color: '#059669', speak: 's' },
      { letters: 'il', ipa: '/l/', color: '#d97706', speak: 'ul' }
    ],
    syllables: 'pen · cil',
    secret: '先写已经滚瓜烂熟的钢笔 pen (/pen/)，再加尾巴 cil（字母 c 在 i 前变软发 /s/ 音）！pen + cil = pencil！',
    sentence: 'Is this your pencil?'
  },
  {
    word: 'colour',
    ipa: '/ˈkʌlə(r)/',
    cn: 'n. 颜色 (英式拼写·鲁教版课本标准)',
    wrong: 'coler (一默&二默均把 our 写成 er)',
    bricks: [
      { letters: 'c', ipa: '/k/', color: '#4f46e5', speak: 'k' },
      { letters: 'o', ipa: '/ʌ/', color: '#e11d48', speak: 'uh' },
      { letters: 'l', ipa: '/l/', color: '#0284c7', speak: 'l' },
      { letters: 'our', ipa: '/ə(r)/', color: '#059669', speak: 'er' }
    ],
    syllables: 'col · our',
    secret: '虽然词尾读音是懒音 /ə/，但鲁教版课本采用英式拼写 col + our（把“我们 our”装进颜色里），千万不能写成 coler！',
    sentence: 'What colour is your new bicycle?'
  },
  {
    word: 'where',
    ipa: '/weə(r)/',
    cn: 'adv. 在哪里 (Over to you 卷首字母错题)',
    wrong: 'whrer (把 r 和 e 顺序颠倒)',
    bricks: [
      { letters: 'wh', ipa: '/w/', color: '#4f46e5', speak: 'w' },
      { letters: 'ere', ipa: '/eə(r)/', color: '#e11d48', speak: 'air' }
    ],
    syllables: 'wh · ere',
    secret: '以旧带新法：这里 here (h-e-r-e) 加上 w 就变成哪里 where (w-h-e-r-e)！或者记住疑问词头 wh- + ere！',
    sentence: 'Where are my keys? They are under the desk.'
  },
  {
    word: 'white',
    ipa: '/waɪt/',
    cn: 'adj./n. 白色(的) (一默&二默连错)',
    wrong: 'wite (漏掉 h)',
    bricks: [
      { letters: 'wh', ipa: '/w/', color: '#4f46e5', speak: 'w' },
      { letters: 'i', ipa: '/aɪ/', color: '#e11d48', speak: 'eye' },
      { letters: 't', ipa: '/t/', color: '#0284c7', speak: 't' },
      { letters: 'e', ipa: '不发音魔法e', color: '#9333ea', speak: 'white' }
    ],
    syllables: 'wh · i · t · e',
    secret: '跟 where / what 一样，开头必须是 wh- 组合！中间是 i_e 相对开音节发 /aɪ/，词尾不发音 e 施展魔法！',
    sentence: 'She has a white cap and a blue ruler.'
  },
  {
    word: 'blue',
    ipa: '/bluː/',
    cn: 'adj./n. 蓝色(的) (一默错题)',
    wrong: 'bule (把 l 和 u 顺序颠倒)',
    bricks: [
      { letters: 'bl', ipa: '/bl/', color: '#2563eb', speak: 'bl' },
      { letters: 'ue', ipa: '/uː/', color: '#e11d48', speak: 'oo' }
    ],
    syllables: 'bl · ue',
    secret: '开头跟 black(黑色) 一样是辅音连缀 bl- (/bl/)，后面接长元音组合 ue (/uː/)！先写 bl 再写 ue！',
    sentence: 'The sky is blue and the grass is green.'
  },
  {
    word: 'chair',
    ipa: '/tʃeə(r)/',
    cn: 'n. 椅子 (二默错题)',
    wrong: 'chlir (把 a 写成 l)',
    bricks: [
      { letters: 'ch', ipa: '/tʃ/', color: '#4f46e5', speak: 'ch' },
      { letters: 'air', ipa: '/eə(r)/', color: '#e11d48', speak: 'air' }
    ],
    syllables: 'ch · air',
    secret: '图像联想记忆：ch(/tʃ/) + air(空气 /eə/) = chair(椅子)！坐在空气垫上的椅子，后面就是空气 air！',
    sentence: 'His schoolbag is under the chair.'
  },
  {
    word: 'favorite',
    ipa: '/ˈfeɪvərɪt/',
    cn: 'adj./n. 最喜爱的 (10.21 听写纸错题)',
    wrong: 'fevoret (三个元音全凭感觉乱写)',
    bricks: [
      { letters: 'fa', ipa: '/ˈfeɪ/', color: '#e11d48', speak: 'fay' },
      { letters: 'vor', ipa: '/vər/', color: '#4f46e5', speak: 'ver' },
      { letters: 'ite', ipa: '/ɪt/', color: '#059669', speak: 'it' }
    ],
    syllables: 'fa · vor · ite (英式 favourite)',
    secret: '三拍子切蛋糕法：第1拍 fa- (f+a)，第2拍 -vor- (v+o+r)，第3拍 -ite (i+t+e)！拍三次手写三段，一个字母都不会错！',
    sentence: 'My favorite subject is English.'
  },
  {
    word: 'grade',
    ipa: '/ɡreɪd/',
    cn: 'n. 年级；成绩等级 (10.21 听写纸错题)',
    wrong: 'grate (把浊辅音 d 听成清辅音 t)',
    bricks: [
      { letters: 'gr', ipa: '/ɡr/', color: '#059669', speak: 'gr' },
      { letters: 'a', ipa: '/eɪ/', color: '#e11d48', speak: 'ay' },
      { letters: 'd', ipa: '/d/', color: '#2563eb', speak: 'd' },
      { letters: 'e', ipa: '不发音魔法e', color: '#9333ea', speak: 'grade' }
    ],
    syllables: 'gr · a · d · e',
    secret: '开头与 green 一样是 gr-，中间是 a_e 魔法开音节发 /eɪ/，注意手摸喉咙词尾是浊辅音 d (/d/) 而不是 t！',
    sentence: 'I am in Class Four, Grade Six.'
  },
  {
    word: 'year',
    ipa: '/jɪə(r)/',
    cn: 'n. 年；岁 (10.21 听写纸错题)',
    wrong: 'yare (把 ear 顺序打乱写成 are)',
    bricks: [
      { letters: 'y', ipa: '/j/', color: '#4f46e5', speak: 'y' },
      { letters: 'ear', ipa: '/ɪə(r)/', color: '#e11d48', speak: 'ear' }
    ],
    syllables: 'y · ear',
    secret: '秒记公式：y + ear(耳朵 e-a-r) = year(年)！一年 365 天都要用耳朵(ear)认真听讲！',
    sentence: 'She is eleven years old this year.'
  },
  {
    word: 'tidy',
    ipa: '/ˈtaɪdi/',
    cn: 'adj. 整洁的；井井有条的 (一默错题)',
    wrong: 'tiey (把 d 写成 e)',
    bricks: [
      { letters: 'ti', ipa: '/ˈtaɪ/', color: '#e11d48', speak: 'tie' },
      { letters: 'dy', ipa: '/di/', color: '#2563eb', speak: 'dee' }
    ],
    syllables: 'ti · dy',
    secret: '两个开音节小积木：第一块 ti (/taɪ/)，第二块 dy (/di/)！另外造句牢记：I am tidy 或 I keep my room tidy（绝不能写 I keep am tidy）！',
    sentence: 'Keep your desk clean and tidy!'
  },
  {
    word: 'welcome',
    ipa: '/ˈwelkəm/',
    cn: 'adj./v./n. 受欢迎的；欢迎 (二默错题)',
    wrong: 'Wlcom (漏掉开头 e 和结尾 e)',
    bricks: [
      { letters: 'wel', ipa: '/ˈwel/', color: '#4f46e5', speak: 'wel' },
      { letters: 'come', ipa: '/kəm/', color: '#e11d48', speak: 'come' }
    ],
    syllables: 'wel · come',
    secret: '合成词法：好 well(去掉一个 l 变成 wel) + 来 come = welcome(欢迎光临)！两头都有 e，一个不能少！',
    sentence: "You're welcome! Welcome to our school."
  },
  {
    word: 'head',
    ipa: '/hed/',
    cn: 'n. 头；头脑 (一默&二默连错)',
    wrong: 'hat (一默写成了帽子) / hed (二默漏了 a)',
    bricks: [
      { letters: 'h', ipa: '/h/', color: '#4f46e5', speak: 'h' },
      { letters: 'ea', ipa: '/e/', color: '#e11d48', speak: 'eh' },
      { letters: 'd', ipa: '/d/', color: '#059669', speak: 'd' }
    ],
    syllables: 'h · ea · d',
    secret: '面包 bread 和头 head 是一对好朋友：中间都是字母组合 ea 发短音 /e/，绝不能漏掉 a 写成 hed！',
    sentence: 'Put the cap on your head.'
  },
  {
    word: 'greeting',
    ipa: '/ˈɡriːtɪŋ/',
    cn: 'n. 问候；招呼 (10.21 听写纸空白词)',
    wrong: '听写纸未写出',
    bricks: [
      { letters: 'gr', ipa: '/ɡr/', color: '#059669', speak: 'gr' },
      { letters: 'ee', ipa: '/iː/', color: '#e11d48', speak: 'ee' },
      { letters: 't', ipa: '/t/', color: '#2563eb', speak: 't' },
      { letters: 'ing', ipa: '/ɪŋ/', color: '#9333ea', speak: 'ing' }
    ],
    syllables: 'greet · ing',
    secret: '词根后缀法：动词 greet (gr + ee + t 打招呼，和 green 前四个字母一模一样) + 名词尾巴 ing = greeting！',
    sentence: 'Start a conversation with a warm greeting.'
  }
];

// ============================================================================
// 🅰️ 26 个英文字母「7 大元音音素家族」归类表（Bridging Unit 1 & 周测必考）
// ============================================================================

const LETTER_7_FAMILIES = [
  {
    phoneme: '/eɪ/',
    title: '家族 1：/eɪ/ 飞天战队（共 4 个字母）',
    mnemonic: '口诀：“A H J K 飞上天，四个伙伴含 /eɪ/ 音！”（注意 H /eɪtʃ/ 是元音音素开头，前面用 an "h"！）',
    color: '#db2777',
    bg: '#fdf2f8',
    letters: [
      { ch: 'A a', ipa: '/eɪ/', anRule: 'an "a"' },
      { ch: 'H h', ipa: '/eɪtʃ/', anRule: '🔥 an "h"' },
      { ch: 'J j', ipa: '/dʒeɪ/', anRule: 'a "j"' },
      { ch: 'K k', ipa: '/keɪ/', anRule: 'a "k"' }
    ]
  },
  {
    phoneme: '/iː/',
    title: '家族 2：/iː/ 微笑大家庭（共 9 个字母·最大院落）',
    mnemonic: '口诀：“E 带 B C D G P T V Z(美)，九个字母笑眯眯 /iː/！”',
    color: '#2563eb',
    bg: '#eff6ff',
    letters: [
      { ch: 'E e', ipa: '/iː/', anRule: 'an "e"' },
      { ch: 'B b', ipa: '/biː/', anRule: 'a "b"' },
      { ch: 'C c', ipa: '/siː/', anRule: 'a "c"' },
      { ch: 'D d', ipa: '/diː/', anRule: 'a "d"' },
      { ch: 'G g', ipa: '/dʒiː/', anRule: 'a "g"' },
      { ch: 'P p', ipa: '/piː/', anRule: 'a "p"' },
      { ch: 'T t', ipa: '/tiː/', anRule: 'a "t"' },
      { ch: 'V v', ipa: '/viː/', anRule: 'a "v"' },
      { ch: 'Z z (美)', ipa: '/ziː/', anRule: 'a "z"' }
    ]
  },
  {
    phoneme: '/e/',
    title: '家族 3：/e/ 短促排排坐（共 7 个字母·全员冠词高危区！）',
    mnemonic: '🚨 必考铁律：“F L M N S X 六个辅音字母读音全都以元音 /e/ 开头！考题问 There is ___ f/l/m/n/s/x，统统填 an！”',
    color: '#e11d48',
    bg: '#fff1f2',
    letters: [
      { ch: 'F f', ipa: '/ef/', anRule: '🔥 an "f"' },
      { ch: 'L l', ipa: '/el/', anRule: '🔥 an "l"' },
      { ch: 'M m', ipa: '/em/', anRule: '🔥 an "m"' },
      { ch: 'N n', ipa: '/en/', anRule: '🔥 an "n"' },
      { ch: 'S s', ipa: '/es/', anRule: '🔥 an "s"' },
      { ch: 'X x', ipa: '/eks/', anRule: '🔥 an "x"' },
      { ch: 'Z z (英)', ipa: '/zed/', anRule: 'a "z"' }
    ]
  },
  {
    phoneme: '/aɪ/',
    title: '家族 4：/aɪ/ 大眼睛双子星（共 2 个字母）',
    mnemonic: '口诀：“I 和 Y 两姐妹，并肩同发 /aɪ/ 音！”',
    color: '#7c3aed',
    bg: '#f5f3ff',
    letters: [
      { ch: 'I i', ipa: '/aɪ/', anRule: 'an "i"' },
      { ch: 'Y y', ipa: '/waɪ/', anRule: 'a "y"' }
    ]
  },
  {
    phoneme: '/juː/',
    title: '家族 5：/juː/ 太空飞船三人组（共 3 个字母）',
    mnemonic: '🚨 必考陷阱：“U /juː/ 虽然是元音字母，但读音以半元音(辅音音素) /j/ 开头！所以 a "u" / a UFO / a useful book 用 a 不用 an！”',
    color: '#059669',
    bg: '#ecfdf5',
    letters: [
      { ch: 'U u', ipa: '/juː/', anRule: '⚠️ a "u"' },
      { ch: 'Q q', ipa: '/kjuː/', anRule: 'a "q"' },
      { ch: 'W w', ipa: '/ˈdʌbljuː/', anRule: 'a "w"' }
    ]
  },
  {
    phoneme: '/əʊ/ & /ɑː/',
    title: '家族 6 & 7：O (/əʊ/) 与 R (/ɑː/) 两个独立掌门',
    mnemonic: '口诀：“圆圆 O o 独守 /əʊ/，卷舌 R r 独占 /ɑː/（注意 an "o" 和 an "r" 都用 an）！”',
    color: '#d97706',
    bg: '#fffbeb',
    letters: [
      { ch: 'O o', ipa: '/əʊ/', anRule: 'an "o"' },
      { ch: 'R r', ipa: '/ɑː(r)/', anRule: '🔥 an "r"' }
    ]
  }
];

// ============================================================================
// ⚡ 辨音与自然拼读闪电闯关题库（12 道精选周测/期中真题级辨音与拼写题）
// ============================================================================

const PHONICS_CHALLENGE_POOL = [
  {
    q: '【9.23周测辨音原题】选出画线部分 th 发音与其他三项【不同】的一项：',
    speakWord: 'three. thank. this. thing.',
    options: ['A. [th]ree', 'B. [th]ank', 'C. [th]is', 'D. [th]ing'],
    correct: 2,
    exp: '秒杀口诀：“代词冠词加亲属，th 发浊音 /ð/！” C 项 this 是指示代词读 /ðɪs/，而 three /θriː/、thank /θæŋk/、thing /θɪŋ/ 全发清辅音 /θ/。'
  },
  {
    q: '【元音组合 ea 辨音】若婷曾把 head 写错，请找出画线 ea 发音与其他三项【不同】的一项：',
    speakWord: 'please. head. keep. teacher.',
    options: ['A. pl[ea]se', 'B. h[ea]d', 'C. t[ea]cher', 'D. cl[ea]n'],
    correct: 1,
    exp: 'head /hed/ 中的 ea 发短元音 /e/（同 bread/sweater）；其余 please /pliːz/、teacher /ˈtiːtʃə/、clean /kliːn/ 中的 ea 均发长元音 /iː/！'
  },
  {
    q: '【oo 长短音辨析】选出画线部分 oo 发长元音 /uː/ 的一项：',
    speakWord: 'book. look. good. schoolbag.',
    options: ['A. b[oo]k', 'B. l[oo]k', 'C. g[oo]d', 'D. sch[oo]lbag'],
    correct: 3,
    exp: '口诀：“好看书本(good/look/book) k 和 d 前 oo 读短音 /ʊ/”，而 schoolbag /ˈskuːlbæɡ/（以及 ruler, food, room）读长元音 /uː/！'
  },
  {
    q: '【Magic E 开闭音节】选出元音字母 i 发双元音 /aɪ/ 的一组单词：',
    speakWord: 'white and tidy. big and sit.',
    options: ['A. big · sit', 'B. wh[i]te · t[i]dy', 'C. this · his', 'D. in · pig'],
    correct: 1,
    exp: 'white /waɪt/ 是 i_e 相对开音节，tidy /ˈtaɪdi/ 第一音节是开音节，两者的 i 都发本音 /aɪ/；其余选项均为闭音节短音 /ɪ/。'
  },
  {
    q: '【26字母音素家族】下列哪一组字母全部含有相同的元音音素 /eɪ/？',
    speakWord: 'A, H, J, K.',
    options: ['A. A · H · J · K', 'B. B · C · D · F', 'C. F · L · M · A', 'D. I · Y · O · U'],
    correct: 0,
    exp: '背诵口诀：“A /eɪ/、H /eɪtʃ/、J /dʒeɪ/、K /keɪ/ 飞上天，四个伙伴同含 /eɪ/”！'
  },
  {
    q: '【冠词 a / an 高频陷阱】There is ___ "u" and ___ "s" in the word "bus".',
    speakWord: 'bus. u. s.',
    options: ['A. an ; a', 'B. a ; an', 'C. an ; an', 'D. a ; a'],
    correct: 1,
    exp: '满分铁律：字母 u 读作 /juː/（以半元音/辅音音素 /j/ 开头，用 a "u"）；字母 s 读作 /es/（以元音音素 /e/ 开头，用 an "s"）！故选 B。'
  },
  {
    q: '【自然拼读防颠倒】听音拆音节：/ˈskuːlbæɡ/（书包）的正确拼写是？',
    speakWord: 'schoolbag',
    options: ['A. shoolbag', 'B. schloobag', 'C. schoolbag', 'D. scoolbag'],
    correct: 2,
    exp: '拆音节：sch(/sk/) + oo(/uː/) + l(/l/) + bag(/bæɡ/) = schoolbag！千万别漏掉 c，也别把 l 放到 oo 前面。'
  },
  {
    q: '【自然拼读软音 c】为什么“铅笔”拼成 pencil 而不是 penit？其中字母 c 的发音是：',
    speakWord: 'pencil',
    options: ['A. 发 /k/，拼作 penkil', 'B. 遇到 i 变软发 /s/，拼作 pen + cil', 'C. 发 /t/，拼作 penit', 'D. 不发音'],
    correct: 1,
    exp: '自然拼读法则 4：字母 c 遇到 e / i / y 时发软音 /s/（如 pencil /ˈpensl/, bicycle, nice）！pen + cil = pencil。'
  },
  {
    q: '【集中双元音辨析】“椅子 /tʃeə/”与“在哪里 /weə/”的正确拼写组合是：',
    speakWord: 'chair. where.',
    options: ['A. chlir · whrer', 'B. chair · where', 'C. cheer · wear', 'D. char · were'],
    correct: 1,
    exp: '椅子 = ch + air(空气) = chair；在哪里 = wh + ere = where（绝不能把 r 写到 e 前面变成 whrer）！'
  },
  {
    q: '【清浊辅音与开音节】“六年级 Grade Six”中，“年级 /ɡreɪd/”的正确拼写是：',
    speakWord: 'grade',
    options: ['A. grate', 'B. gread', 'C. grade', 'D. grad'],
    correct: 2,
    exp: 'gr(/ɡr/) + a_e(相对开音节发 /eɪ/) + d(浊辅音 /d/) = grade！词尾是浊辅音 d 加上不发音的魔法 e。'
  },
  {
    q: '【三音节拍手记忆法】“最喜爱的 /ˈfeɪvərɪt/”按三个音节拆开，正确拼写是：',
    speakWord: 'favorite',
    options: ['A. fevoret', 'B. favrite', 'C. favorite (fa-vor-ite)', 'D. faverit'],
    correct: 2,
    exp: '三拍子拆解法：第1拍 fa-，第2拍 -vor-，第3拍 -ite，合起来就是 favorite（英式也可写作 favourite）！'
  },
  {
    q: '【元音字母 o 辨音】若婷曾把 some 写成 same，选出画线字母 o 发短元音 /ʌ/ 的一组：',
    speakWord: 'some. colour. welcome.',
    options: ['A. n[o]se · th[o]se', 'B. b[o]x · d[o]g', 'C. s[o]me · c[o]lour · welc[o]me', 'D. g[o] · hell[o]'],
    correct: 2,
    exp: 'some /sʌm/、colour /ˈkʌlə/、come /kʌm/ 中的字母 o 都发尖角短音 /ʌ/；A 和 D 发 /əʊ/，B 发 /ɒ/。'
  }
];
// ============================================================================
// 🎨 辅助渲染与交互控制函数
// ============================================================================

function formatPhonicsHighlight(str) {
  if (!str) return '';
  return escapeHtml(str).replace(/\[([^\]]+)\]/g, '<span class="ph-hi">$1</span>');
}

function setPhonicsSubTab(tabKey) {
  const ph = ensurePhonicsState();
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  ph.subTab = tabKey;
  renderPhonicsView();
}

function setPhonicsVoice(voiceId) {
  const ph = ensurePhonicsState();
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  ph.voice = voiceId;
  renderPhonicsView();
  speakPhonicsEnglish('Hello Ruoting! Let us practice English phonics together!', '已切换外教发音');
}

function togglePhonicsSlowMode() {
  const ph = ensurePhonicsState();
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  ph.slowMode = !ph.slowMode;
  renderPhonicsView();
  if (typeof showToast === 'function') {
    showToast(ph.slowMode ? '🐢 已开启 0.78x 慢速拆音跟读模式' : '⚡ 已恢复 1.0x 正常外教语速');
  }
}

function setPhonicsIpaFilter(filterKey) {
  const ph = ensurePhonicsState();
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  ph.ipaCategoryFilter = filterKey;
  renderPhonicsView();
}

function selectAndSpeakIpa(symbol) {
  const ph = ensurePhonicsState();
  ph.selectedIpaSymbol = symbol;
  const item = IPA_48_DATA.find(x => x.symbol === symbol) || IPA_48_DATA[0];
  renderPhonicsView();
  if (item) {
    speakPhonicsEnglish(item.cueSpeech, `${item.symbol} · ${item.name}`);
    prewarmPhonicsWords(item.words.map(w => w.word));
  }
}

function toggleMasteredIpa(symbol, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const ph = ensurePhonicsState();
  if (ph.masteredIpa.has(symbol)) {
    ph.masteredIpa.delete(symbol);
    if (typeof playCommercialSound === 'function') playCommercialSound('click');
  } else {
    ph.masteredIpa.add(symbol);
    if (typeof playCommercialSound === 'function') playCommercialSound('mastered');
    if (typeof burstMagicConfetti === 'function') burstMagicConfetti();
  }
  saveMasteredIpaSet(ph.masteredIpa);
  renderPhonicsView();
}

function selectWorkshopWord(idx) {
  const ph = ensurePhonicsState();
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  ph.selectedWorkshopIdx = idx;
  const w = RUOTING_WORKSHOP_WORDS[idx];
  renderPhonicsView();
  if (w) {
    speakPhonicsEnglish(`${w.word}. ${w.sentence}`, `${w.word} (${w.ipa})`);
  }
}

function blendAndSpeakWorkshopWord(idx) {
  const w = RUOTING_WORKSHOP_WORDS[idx];
  if (!w) return;
  const spellPieces = w.bricks.map(b => b.letters).join(', ');
  speakPhonicsEnglish(`${w.word}. ${spellPieces}. ${w.word}! ${w.sentence}`, `拆音节拼读：${w.syllables}`);
}

function answerPhonicsChallenge(optIdx) {
  const ph = ensurePhonicsState();
  const qState = ph.quiz;
  if (qState.submitted) return;
  const curQ = PHONICS_CHALLENGE_POOL[qState.currentIndex];
  if (!curQ) return;

  qState.selectedIdx = optIdx;
  qState.submitted = true;
  qState.isCorrect = (optIdx === curQ.correct);
  qState.answeredCount += 1;

  if (qState.isCorrect) {
    qState.score += 1;
    if (typeof playCommercialSound === 'function') playCommercialSound('mastered');
    if (typeof burstMagicConfetti === 'function') burstMagicConfetti();
    if (typeof recordDailyQuestionDone === 'function') recordDailyQuestionDone();
  } else {
    if (typeof playCommercialSound === 'function') playCommercialSound('wrong');
  }
  renderPhonicsView();
}

function nextPhonicsChallenge() {
  const ph = ensurePhonicsState();
  const qState = ph.quiz;
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  qState.currentIndex = (qState.currentIndex + 1) % PHONICS_CHALLENGE_POOL.length;
  qState.selectedIdx = null;
  qState.submitted = false;
  qState.isCorrect = false;
  renderPhonicsView();
}

function resetPhonicsChallenge() {
  const ph = ensurePhonicsState();
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  ph.quiz = {
    currentIndex: 0,
    selectedIdx: null,
    submitted: false,
    isCorrect: false,
    score: 0,
    answeredCount: 0
  };
  renderPhonicsView();
}

// ============================================================================
// 🏛️ 主视图入口：renderPhonicsView()
// ============================================================================

function renderPhonicsView() {
  const container = document.getElementById('view-phonics');
  if (!container) return;

  const ph = ensurePhonicsState();
  const masteredCount = ph.masteredIpa.size;
  const masteredPct = Math.round((masteredCount / 48) * 100);

  let subViewHtml = '';
  if (ph.subTab === 'ipa') {
    subViewHtml = renderPhonicsIpaTab(ph);
  } else if (ph.subTab === 'rules') {
    subViewHtml = renderPhonicsRulesTab(ph);
  } else if (ph.subTab === 'workshop') {
    subViewHtml = renderPhonicsWorkshopTab(ph);
  } else if (ph.subTab === 'letters') {
    subViewHtml = renderPhonicsLettersTab(ph);
  } else if (ph.subTab === 'challenge') {
    subViewHtml = renderPhonicsChallengeTab(ph);
  } else if (ph.subTab === 'homework') {
    subViewHtml = renderPhonicsHomeworkTab(ph);
  }

  container.innerHTML = `
    <div class="zen-home-wrap drill-stage-animate">
      <!-- 顶部返回与外教发音控制舱 -->
      <div class="drill-nav-header">
        <div class="drill-nav-left">
          <button class="drill-back-btn" onclick="switchTab('macro')" title="返回选课闯关">
            ${typeof uiIcon === 'function' ? uiIcon('arrow-left', 16) : '←'} <span>返回</span>
          </button>
          <h1 class="drill-page-title">
            🎙️ <span class="dqa-text-full">英语自然拼读 · 48国际音标全息点读舱</span><span class="dqa-text-short">48音标·自然拼读</span>
          </h1>
          <span class="drill-step-pill current">点亮 ${masteredCount}/48 (${masteredPct}%)</span>
        </div>

        <div class="drill-nav-right-stack">
          <div class="comm-segmented-bar cols-2">
            <button class="comm-seg-btn ${ph.voice === 'en-US-AnaNeural' ? 'active' : ''}" onclick="setPhonicsVoice('en-US-AnaNeural')" title="美式甜美童声外教 Ana">
              🇺🇸 <span>美音外教</span>
            </button>
            <button class="comm-seg-btn ${ph.voice === 'en-GB-SoniaNeural' ? 'active' : ''}" onclick="setPhonicsVoice('en-GB-SoniaNeural')" title="英式纯正外教 Sonia (贴合鲁教版听力)">
              🇬🇧 <span>英音外教</span>
            </button>
          </div>
          <div class="drill-header-actions-grid cols-2">
            <button class="zen-btn-ghost ${ph.slowMode ? 'active' : ''}" style="${ph.slowMode ? 'border-color:#ec4899;background:#fdf2f8;color:#be185d;' : ''}" onclick="togglePhonicsSlowMode()">
              <span>${ph.slowMode ? '🐢 慢速跟读(0.78x)' : '⚡ 慢速拆音'}</span>
            </button>
            <button class="duo-btn primary" onclick="openDictationModal('英语')">
              🎧 <span>错词互动听写</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 狐伊丝自然拼读领航横幅 -->
      <div class="phonics-hero-banner">
        <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:260px;">
          <img src="/assets/huyisi_welcome.jpg" alt="狐伊丝" style="width:60px;height:60px;border-radius:18px;object-fit:cover;object-position:top;border:2.5px solid #ec4899;flex-shrink:0;" />
          <div>
            <div style="font-size:18px;font-weight:900;color:#831843;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span>🦊 狐伊丝的自然拼读魔法课堂：告别死记硬背字母顺序！</span>
              <span class="badge status-green">已点亮 ${masteredCount} / 48 颗音标宝石</span>
            </div>
            <div style="font-size:13.5px;color:#475569;margin-top:4px;line-height:1.55;">
              若婷在 10.21 听写中把 <code>blue→bule</code>、<code>where→whrer</code>、<code>schoolbag→shoolbag</code>、<code>pencil→penit</code>，根源是还没建立<strong>“听音拆音节、见词能拼读”</strong>的反射弧。点击下方任意音标或单词积木，外教立刻带你慢速拆音跟读！
            </div>
          </div>
        </div>
        <div style="min-width:190px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#831843;margin-bottom:5px;">
            <span>🌟 48 音标掌握进度</span>
            <span>${masteredCount} / 48 (${masteredPct}%)</span>
          </div>
          <div class="school-progress-track" style="background:#fce7f3;border-color:#f9a8d4;height:11px;">
            <div class="school-progress-fill" style="width:${masteredPct}%;background:linear-gradient(90deg,#ec4899,#8b5cf6);"></div>
          </div>
        </div>
      </div>

      <!-- 6 大子板块切换栏 -->
      <div class="phonics-subtab-bar">
        <button class="phonics-subtab-btn ${ph.subTab === 'ipa' ? 'active' : ''}" onclick="setPhonicsSubTab('ipa')">
          🎙️ <span class="dqa-text-full">48 国际音标点读墙 (20元音+28辅音)</span><span class="dqa-text-short">48音标点读墙</span>
        </button>
        <button class="phonics-subtab-btn ${ph.subTab === 'homework' ? 'active' : ''}" onclick="setPhonicsSubTab('homework')">
          📝 <span class="dqa-text-full">写作业边做边读 · 题干拆词 & 6大做题SOP</span><span class="dqa-text-short">作业拆词&做题SOP</span>
        </button>
        <button class="phonics-subtab-btn ${ph.subTab === 'workshop' ? 'active' : ''}" onclick="setPhonicsSubTab('workshop')">
          🧱 <span class="dqa-text-full">若婷 10.21 错词「拆音节积木工坊」 (14词)</span><span class="dqa-text-short">10.21错词拆音工坊</span>
        </button>
        <button class="phonics-subtab-btn ${ph.subTab === 'rules' ? 'active' : ''}" onclick="setPhonicsSubTab('rules')">
          🪄 <span class="dqa-text-full">自然拼读 5 大黄金法则</span><span class="dqa-text-short">5大拼读黄金法则</span>
        </button>
        <button class="phonics-subtab-btn ${ph.subTab === 'letters' ? 'active' : ''}" onclick="setPhonicsSubTab('letters')">
          🅰️ <span class="dqa-text-full">26 字母「7大音素家族」& a/an 防坑</span><span class="dqa-text-short">26字母7大音素家族</span>
        </button>
        <button class="phonics-subtab-btn ${ph.subTab === 'challenge' ? 'active' : ''}" onclick="setPhonicsSubTab('challenge')">
          ⚡ <span class="dqa-text-full">周测辨音与拼读闪电闯关 (12题)</span><span class="dqa-text-short">周测辨音闪电闯关 (12题)</span>
        </button>
      </div>

      <!-- 当前子板块主体 -->
      ${subViewHtml}
    </div>
  `;
}
// ============================================================================
// 子板块 1：🎙️ 48 国际音标全息点读墙 + 音标显微镜聚焦台
// ============================================================================

function renderPhonicsIpaTab(ph) {
  const curItem = IPA_48_DATA.find(x => x.symbol === ph.selectedIpaSymbol) || IPA_48_DATA[0];
  const isCurMastered = ph.masteredIpa.has(curItem.symbol);

  const curWordsHtml = curItem.words.map(w => {
    const safeWord = w.word.replace(/'/g, "\\'");
    return `
      <div class="phonics-word-chip" onclick="speakPhonicsEnglish('${safeWord}', '${safeWord} ${w.ipa} (${w.cn})')">
        <span style="font-size:17px;">🔊</span>
        <div>
          <div style="font-size:16px;font-weight:900;">${formatPhonicsHighlight(w.highlight)}</div>
          <div style="font-size:12px;color:#64748b;font-weight:700;">${escapeHtml(w.ipa)} · ${escapeHtml(w.cn)}</div>
        </div>
      </div>
    `;
  }).join('');

  const renderTileGroup = (groupKey, groupTitle, groupSubtitle, badgeColor) => {
    if (ph.ipaCategoryFilter !== 'ALL' && ph.ipaCategoryFilter !== groupKey) return '';
    const items = IPA_48_DATA.filter(x => x.group === groupKey);

    // 清浊成对辅音采用特制的双层成对对比卡片
    if (groupKey === 'CONSONANT_PAIR') {
      const pairIds = [];
      items.forEach(it => {
        if (it.pairId && !pairIds.includes(it.pairId)) pairIds.push(it.pairId);
      });
      const pairsHtml = pairIds.map((pid, idx) => {
        const pairItems = items.filter(x => x.pairId === pid);
        const cellsHtml = pairItems.map(it => {
          const isSel = it.symbol === curItem.symbol;
          const isMas = ph.masteredIpa.has(it.symbol);
          const isVoiceless = (it.voicing || '').includes('清');
          const safeSym = it.symbol.replace(/'/g, "\\'");
          return `
            <div class="ipa-tile-btn ${isSel ? 'is-selected' : ''} ${isMas ? 'is-mastered' : ''}"
              onclick="selectAndSpeakIpa('${safeSym}')">
              <span style="font-size:10.5px;font-weight:900;padding:1px 6px;border-radius:999px;background:${isVoiceless ? '#e0f2fe' : '#fef3c7'};color:${isVoiceless ? '#0369a1' : '#b45309'};">
                ${isVoiceless ? '💨 清辅音' : '📳 浊辅音'}
              </span>
              <div class="ipa-tile-symbol">${escapeHtml(it.symbol)}</div>
              <div class="ipa-tile-word">${formatPhonicsHighlight(it.words[0].highlight)}</div>
              <div class="ipa-tile-grapheme">${escapeHtml(it.graphemes)}</div>
            </div>
          `;
        }).join('');
        return `
          <div class="ipa-pair-card">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:900;color:#475569;">
              <span>第 ${idx + 1} 对 · 口型相同</span>
              <span style="color:#7c3aed;">清 vs 浊</span>
            </div>
            <div class="ipa-pair-row">
              ${cellsHtml}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="section-card" style="margin-bottom:18px;border:2px solid #e2e8f0;">
          <div class="section-header" style="margin-bottom:12px;">
            <div>
              <div class="section-title" style="color:${badgeColor};">${groupTitle}</div>
              <div class="section-subtitle">${groupSubtitle}</div>
            </div>
          </div>
          <div class="ipa-voicing-pair-grid">
            ${pairsHtml}
          </div>
        </div>
      `;
    }

    const tilesHtml = items.map(it => {
      const isSel = it.symbol === curItem.symbol;
      const isMas = ph.masteredIpa.has(it.symbol);
      const safeSym = it.symbol.replace(/'/g, "\\'");
      return `
        <div class="ipa-tile-btn ${isSel ? 'is-selected' : ''} ${isMas ? 'is-mastered' : ''}"
          onclick="selectAndSpeakIpa('${safeSym}')">
          ${isMas ? '<span style="position:absolute;top:6px;right:8px;font-size:12px;" title="已掌握">🌟</span>' : ''}
          <div class="ipa-tile-symbol">${escapeHtml(it.symbol)}</div>
          <div class="ipa-tile-word">${formatPhonicsHighlight(it.words[0].highlight)} (${escapeHtml(it.words[0].cn)})</div>
          <div class="ipa-tile-grapheme">${escapeHtml(it.graphemes)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="section-card" style="margin-bottom:18px;border:2px solid #e2e8f0;">
        <div class="section-header" style="margin-bottom:12px;">
          <div>
            <div class="section-title" style="color:${badgeColor};">${groupTitle}</div>
            <div class="section-subtitle">${groupSubtitle}</div>
          </div>
        </div>
        <div class="ipa-soundboard-grid">
          ${tilesHtml}
        </div>
      </div>
    `;
  };

  const safeCue = curItem.cueSpeech.replace(/'/g, "\\'");
  const safeSym = curItem.symbol.replace(/'/g, "\\'");
  const safeTipSpeech = `${curItem.name}。发音秘籍：${curItem.mouthTip}。防坑提示：${curItem.ruotingTip}`.replace(/'/g, "\\'");

  return `
    <!-- 顶部：音标显微镜聚焦舞台 -->
    <div class="ipa-spotlight-stage">
      <div class="ipa-big-symbol-box" onclick="speakPhonicsEnglish('${safeCue}', '${safeSym} · ${curItem.name}')" title="点击听外教示范发音">
        <span class="badge" style="background:#f3e8ff;color:#7e22ce;font-weight:900;">${escapeHtml(curItem.groupLabel)}</span>
        <div class="ipa-giant-glyph">${escapeHtml(curItem.symbol)}</div>
        <div style="font-size:14px;font-weight:900;color:#831843;margin-bottom:8px;">${escapeHtml(curItem.name)}</div>
        <span class="duo-btn primary" style="padding:7px 14px;font-size:13px;">🔊 点击听外教连读</span>
      </div>

      <div style="display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:13px;font-weight:900;color:#6366f1;margin-bottom:4px;">
              🔤 常见对应字母/字母组合 (Graphemes)：<span style="background:#eef2ff;padding:2px 10px;border-radius:999px;color:#4338ca;">${escapeHtml(curItem.graphemes)}</span>
            </div>
            <div style="font-size:14.5px;color:#1e293b;line-height:1.6;">
              <strong>👄 口腔舌位秘籍：</strong>${escapeHtml(curItem.mouthTip)}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="zen-btn-ghost" onclick="speakPhonicsEnglish('${safeTipSpeech}', '口型秘籍与防坑讲解', 'zh-CN-XiaoyiNeural')">
              🎙️ <span>助教讲口型</span>
            </button>
            <button class="duo-btn ${isCurMastered ? 'indigo' : 'primary'}" onclick="toggleMasteredIpa('${safeSym}', event)">
              ${isCurMastered ? '🌟 已点亮掌握 (点击取消)' : '✓ 标记该音标已掌握'}
            </button>
          </div>
        </div>

        <div style="background:#fff1f2;border:1.5px solid #fecdd3;border-radius:14px;padding:10px 14px;font-size:13.5px;color:#9f1239;line-height:1.55;">
          <strong>🎯 若婷专属防坑与拼读口诀：</strong>${escapeHtml(curItem.ruotingTip)}
        </div>

        <div>
          <div style="font-size:12.5px;font-weight:800;color:#64748b;margin-bottom:6px;">👇 点击下方课本高频代表词跟读（红色下划线为发该音标的字母组合）：</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${curWordsHtml}
          </div>
        </div>
      </div>
    </div>

    <!-- 分类筛选胶囊栏 -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
      <div class="comm-segmented-bar">
        <button class="comm-seg-btn ${ph.ipaCategoryFilter === 'ALL' ? 'active' : ''}" onclick="setPhonicsIpaFilter('ALL')">全部 48 音标</button>
        <button class="comm-seg-btn ${ph.ipaCategoryFilter === 'VOWEL_LONG' ? 'active' : ''}" onclick="setPhonicsIpaFilter('VOWEL_LONG')">5 长元音</button>
        <button class="comm-seg-btn ${ph.ipaCategoryFilter === 'VOWEL_SHORT' ? 'active' : ''}" onclick="setPhonicsIpaFilter('VOWEL_SHORT')">7 短元音</button>
        <button class="comm-seg-btn ${ph.ipaCategoryFilter === 'DIPHTHONG' ? 'active' : ''}" onclick="setPhonicsIpaFilter('DIPHTHONG')">8 双元音</button>
        <button class="comm-seg-btn ${ph.ipaCategoryFilter === 'CONSONANT_PAIR' ? 'active' : ''}" onclick="setPhonicsIpaFilter('CONSONANT_PAIR')">20 清浊成对辅音</button>
        <button class="comm-seg-btn ${ph.ipaCategoryFilter === 'CONSONANT_OTHER' ? 'active' : ''}" onclick="setPhonicsIpaFilter('CONSONANT_OTHER')">8 鼻音/似拼音/半元音</button>
      </div>
      <span style="font-size:12.5px;color:#64748b;font-weight:700;">💡 点击任意音标按键即可切换上方显微镜并播放外教示范</span>
    </div>

    ${renderTileGroup('VOWEL_LONG', '🎵 一、单元音 · 5 个长元音 (Long Vowels)', '末尾带长音符号 ː，口腔保持稳定拉长音，切忌发成短促音。', '#be185d')}
    ${renderTileGroup('VOWEL_SHORT', '⚡ 二、单元音 · 7 个短元音 (Short Vowels)', '短促有力一收即止！注意闭音节 a(/æ/)、e(/e/)、i(/ɪ/)、o(/ɒ/)、u(/ʌ/) 与最懒央元音 /ə/。', '#7c3aed')}
    ${renderTileGroup('DIPHTHONG', '🌈 三、双元音 · 8 个双元音 (Diphthongs)', '由第一个元音平滑滑向第二个元音，“前重后轻、前长后短”，饱满动听。', '#2563eb')}
    ${renderTileGroup('CONSONANT_PAIR', '⚖️ 四、辅音 · 10 组清浊成对辅音 (共 20 个 · 摸喉咙辨清浊)', '每一对的口型与舌位 100% 相同！💨清辅音只吹气声带不振，📳浊辅音手摸喉咙明显发麻震动（重点攻克第5对 /θ/ 与 /ð/）。', '#059669')}
    ${renderTileGroup('CONSONANT_OTHER', '🔔 五、辅音 · 8 个独立辅音 (3鼻音 + 3似拼音 + 2半元音)', '含双唇/齿龈/后鼻音 /m/ /n/ /ŋ/，似拼音 /h/ /l/ /r/，以及半元音 /w/ /j/（记住 /j/ 对应字母 y！）。', '#d97706')}
  `;
}

// ============================================================================
// 子板块 2：🧱 若婷 10.21 听写错词「拆音节积木工坊」 (Word Blender Workshop)
// ============================================================================

function renderPhonicsWorkshopTab(ph) {
  const idx = ph.selectedWorkshopIdx || 0;
  const cur = RUOTING_WORKSHOP_WORDS[idx] || RUOTING_WORKSHOP_WORDS[0];

  const wordSelectorHtml = RUOTING_WORKSHOP_WORDS.map((item, i) => {
    const isSel = i === idx;
    return `
      <button class="phonics-word-chip"
        style="${isSel ? 'background:#fdf2f8;border-color:#db2777;color:#831843;box-shadow:0 4px 12px rgba(219,39,119,0.18);' : ''}"
        onclick="selectWorkshopWord(${i})">
        <span style="font-size:13px;font-weight:900;color:${isSel ? '#db2777' : '#64748b'};">#${i + 1}</span>
        <span>${escapeHtml(item.word)}</span>
        <span style="font-size:12px;color:#94a3b8;">${escapeHtml(item.ipa)}</span>
      </button>
    `;
  }).join('');

  const bricksHtml = cur.bricks.map((b, bIdx) => {
    const safeLetters = b.letters.replace(/'/g, "\\'");
    const safeWord = cur.word.replace(/'/g, "\\'");
    return `
      ${bIdx > 0 ? '<span class="phonics-plus-sign">+</span>' : ''}
      <div class="phonics-brick" style="border-color:${b.color};"
        onclick="speakPhonicsEnglish('${safeWord}', '音节积木 [${safeLetters}] ➔ ${safeWord} (${b.ipa})')">
        <div class="phonics-brick-letters" style="color:${b.color};">${escapeHtml(b.letters)}</div>
        <div class="phonics-brick-ipa" style="color:${b.color};">${escapeHtml(b.ipa)}</div>
      </div>
    `;
  }).join('');

  const safeSentence = cur.sentence.replace(/'/g, "\\'");
  const safeSecretSpeech = `单词 ${cur.word}，音标 ${cur.ipa}。若婷原卷曾错写为 ${cur.wrong}。自然拼读拆解秘籍：${cur.secret}`.replace(/'/g, "\\'");

  return `
    <div class="section-card" style="border:2.5px solid #f472b6;background:#ffffff;">
      <div class="section-header">
        <div>
          <div class="section-title" style="color:#831843;">
            🧱 若婷 10.21 听写与周测 14 个真实错词「自然拼读拆音节积木工坊」
          </div>
          <div class="section-subtitle">
            不靠死记硬背字母顺序！把每个易错词拆成 <strong>2~6 块发光积木</strong>，先点积木看音形对应，再点右侧「🎧 立即听写检验」形成肌肉记忆！
          </div>
        </div>
        <button class="duo-btn primary" onclick="openDictationModal('英语')">
          🎧 <span>启动这批错词互动听写</span>
        </button>
      </div>

      <!-- 14 个错词导航胶囊 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
        ${wordSelectorHtml}
      </div>

      <!-- 当前选中错词的拆音节积木工作台 -->
      <div style="background:linear-gradient(145deg,#fffdfd 0%,#faf5ff 100%);border:2px solid #e9d5ff;border-radius:22px;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
              <span style="font-size:36px;font-weight:900;color:#1e1b4b;">${escapeHtml(cur.word)}</span>
              <span style="font-size:20px;font-weight:800;color:#7c3aed;font-family:'Lucida Sans Unicode',sans-serif;">${escapeHtml(cur.ipa)}</span>
              <span class="badge status-green" style="font-size:13.5px;">${escapeHtml(cur.cn)}</span>
            </div>
            <div style="margin-top:6px;font-size:13.5px;color:#e11d48;font-weight:800;">
              ⚠️ 若婷 10.21 试卷原错拼：<code style="background:#ffe4e6;padding:2px 8px;border-radius:6px;">${escapeHtml(cur.wrong)}</code>
              &nbsp;｜&nbsp; ✂️ 音节切分：<strong style="color:#4f46e5;">${escapeHtml(cur.syllables)}</strong>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="duo-btn primary" onclick="blendAndSpeakWorkshopWord(${idx})">
              🔊 <span>慢速拆音合体拼读</span>
            </button>
            <button class="zen-btn-ghost" onclick="speakPhonicsEnglish('${safeSecretSpeech}', '拆音节记忆秘籍', 'zh-CN-XiaoyiNeural')">
              🎙️ <span>助教讲记忆口诀</span>
            </button>
          </div>
        </div>

        <!-- 积木拼接舞台 -->
        <div class="phonics-brick-row">
          ${bricksHtml}
          <span class="phonics-plus-sign">=</span>
          <div class="phonics-brick" style="border-color:#db2777;background:#fdf2f8;" onclick="blendAndSpeakWorkshopWord(${idx})">
            <div class="phonics-brick-letters" style="color:#be185d;">🔊 ${escapeHtml(cur.word)}</div>
            <div class="phonics-brick-ipa" style="color:#9d174d;">点击合体连读</div>
          </div>
        </div>

        <!-- 秒记口诀与课本例句 -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px;">
          <div style="background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:16px;padding:14px;color:#831843;font-size:14px;line-height:1.6;">
            <strong>💡 狐伊丝自然拼读秒记大招：</strong><br/>
            ${escapeHtml(cur.secret)}
          </div>
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:16px;padding:14px;color:#1e3a8a;font-size:14px;line-height:1.6;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div>
              <strong>📖 课本语境例句（点击右侧跟读）：</strong><br/>
              <span style="font-size:15.5px;font-weight:800;">${escapeHtml(cur.sentence)}</span>
            </div>
            <button class="duo-btn indigo" style="padding:8px 14px;flex-shrink:0;" onclick="speakPhonicsEnglish('${safeSentence}', '课本例句跟读')">
              🔊 读例句
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
// ============================================================================
// 子板块 3：🪄 自然拼读 5 大黄金法则 (Phonics Magic Rules)
// ============================================================================

function renderPhonicsRulesTab() {
  const cardsHtml = PHONICS_RULES_DATA.map(rule => {
    const safeMnemonic = `${rule.title}。${rule.mnemonic}`.replace(/'/g, "\\'");
    const pairsHtml = rule.pairs.map(p => {
      const safeSpeak = p.speak.replace(/'/g, "\\'");
      return `
        <div class="phonics-word-chip" style="display:flex;justify-content:space-between;width:100%;padding:11px 15px;"
          onclick="speakPhonicsEnglish('${safeSpeak}', '${p.open}')">
          <div>
            <div style="font-size:12.5px;color:#64748b;font-weight:800;">${escapeHtml(p.closed)}</div>
            <div style="font-size:15px;font-weight:900;color:#0f172a;margin-top:2px;">${formatPhonicsHighlight(p.open)}</div>
          </div>
          <span class="badge" style="background:${rule.bg};color:${rule.color};font-weight:900;">🔊 点读对比</span>
        </div>
      `;
    }).join('');

    return `
      <div class="section-card" style="border:2px solid ${rule.color};margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
          <div>
            <span class="badge" style="background:${rule.bg};color:${rule.color};font-weight:900;margin-bottom:6px;display:inline-block;">${escapeHtml(rule.badge)}</span>
            <div style="font-size:19px;font-weight:900;color:#0f172a;">${escapeHtml(rule.title)}</div>
          </div>
          <button class="zen-btn-ghost" onclick="speakPhonicsEnglish('${safeMnemonic}', '自然拼读黄金法则口诀', 'zh-CN-XiaoyiNeural')">
            🎙️ <span>助教读口诀</span>
          </button>
        </div>
        <div style="font-size:14px;color:#334155;margin-bottom:10px;line-height:1.6;">
          ${escapeHtml(rule.summary)}
        </div>
        <div style="background:${rule.bg};border-left:4px solid ${rule.color};padding:10px 14px;border-radius:10px;font-size:14px;font-weight:800;color:#1e1b4b;margin-bottom:12px;">
          💡 ${escapeHtml(rule.mnemonic)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">
          ${pairsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div>
      ${cardsHtml}
    </div>
  `;
}

// ============================================================================
// 子板块 4：🅰️ 26 字母「7 大音素家族」归类与冠词 a/an 防坑 (Bridging Unit 1 必考)
// ============================================================================

function renderPhonicsLettersTab() {
  const familyCardsHtml = LETTER_7_FAMILIES.map(fam => {
    const lettersHtml = fam.letters.map(l => {
      const onlyLetter = l.ch.split(' ')[0];
      const isAnTrap = l.anRule.includes('🔥') || l.anRule.includes('⚠️');
      return `
        <div class="ipa-tile-btn" style="min-width:110px;border-color:${isAnTrap ? '#f43f5e' : '#cbd5e1'};background:${isAnTrap ? '#fff1f2' : '#ffffff'};"
          onclick="speakPhonicsEnglish('${onlyLetter}', '字母 ${l.ch} 音标 ${l.ipa} (${l.anRule})')">
          <div style="font-size:24px;font-weight:900;color:#0f172a;">${escapeHtml(l.ch)}</div>
          <div style="font-size:14px;font-weight:800;color:${fam.color};font-family:'Lucida Sans Unicode',sans-serif;">${escapeHtml(l.ipa)}</div>
          <div style="font-size:11.5px;font-weight:900;padding:2px 8px;border-radius:999px;background:${isAnTrap ? '#ffe4e6' : '#f1f5f9'};color:${isAnTrap ? '#e11d48' : '#475569'};">
            ${escapeHtml(l.anRule)}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="section-card" style="border:2px solid ${fam.color};margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <div style="font-size:18px;font-weight:900;color:${fam.color};">
            <span style="font-family:'Lucida Sans Unicode',sans-serif;background:${fam.bg};padding:3px 10px;border-radius:10px;margin-right:6px;">${escapeHtml(fam.phoneme)}</span>
            ${escapeHtml(fam.title)}
          </div>
        </div>
        <div style="font-size:13.5px;font-weight:800;color:#334155;margin-bottom:12px;">
          ${escapeHtml(fam.mnemonic)}
        </div>
        <div class="ipa-soundboard-grid">
          ${lettersHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!-- 冠词 a/an 考题秒杀口诀横幅 -->
    <div class="section-card" style="border:2.5px solid #e11d48;background:linear-gradient(135deg,#fff1f2 0%,#fdf2f8 100%);margin-bottom:18px;">
      <div style="font-size:18px;font-weight:900;color:#9f1239;margin-bottom:6px;">
        🚨 初一上期中/周测必考雷区：26 个字母前面什么时候用 an，什么时候用 a？
      </div>
      <div style="font-size:14px;color:#881337;line-height:1.65;">
        1. <strong>看读音开头是不是元音音素，千万别只看是不是 5 个元音字母！</strong><br/>
        2. <strong>12 个前面必须用 <code>an</code> 的字母（口诀：“Mr. Li has one fox” 李先生有一只狐狸）</strong>：<br/>
        &nbsp;&nbsp;👉 元音字母 4 个：<code>A (/eɪ/), E (/iː/), I (/aɪ/), O (/əʊ/)</code>（注意 <strong>U /juː/ 除外，用 a "u"！</strong>）<br/>
        &nbsp;&nbsp;👉 辅音字母 8 个（读音全以元音开头）：<code>F (/ef/), H (/eɪtʃ/), L (/el/), M (/em/), N (/en/), R (/ɑː/), S (/es/), X (/eks/)</code>！
      </div>
    </div>
    ${familyCardsHtml}
  `;
}

// ============================================================================
// 子板块 5：⚡ 周测辨音与自然拼读闪电闯关 (12 题互动即时判分)
// ============================================================================

function renderPhonicsChallengeTab(ph) {
  const qState = ph.quiz;
  const curQ = PHONICS_CHALLENGE_POOL[qState.currentIndex] || PHONICS_CHALLENGE_POOL[0];
  const letterColors = ['#ff5c8a', '#3b82f6', '#f59e0b', '#8b5cf6'];
  const letters = ['A', 'B', 'C', 'D'];
  const safeSpeakWord = curQ.speakWord.replace(/'/g, "\\'");

  const optsHtml = curQ.options.map((opt, idx) => {
    let cls = '';
    if (qState.submitted) {
      if (idx === curQ.correct) cls = 'opt-correct';
      else if (idx === qState.selectedIdx && !qState.isCorrect) cls = 'opt-wrong';
      else cls = 'opt-dim';
    }
    return `
      <button class="cartoon-opt-btn ${cls}" onclick="answerPhonicsChallenge(${idx})" ${qState.submitted ? 'disabled' : ''}>
        <span class="cartoon-opt-letter" style="background:${letterColors[idx]};">${letters[idx]}</span>
        <span class="cartoon-opt-text">${formatPhonicsHighlight(opt)}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="section-card" style="border:2.5px solid #8b5cf6;background:#ffffff;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="badge" style="background:#f3e8ff;color:#6d28d9;font-size:14px;font-weight:900;">
            ⚡ 第 ${qState.currentIndex + 1} / ${PHONICS_CHALLENGE_POOL.length} 关
          </span>
          <span class="badge status-green" style="font-size:13.5px;">
            🏆 当前得分：${qState.score} / ${qState.answeredCount}
          </span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="duo-btn indigo" onclick="speakPhonicsEnglish('${safeSpeakWord}', '本题辨音单词示范')">
            🔊 <span>听外教读本题单词</span>
          </button>
          <button class="zen-btn-ghost" onclick="resetPhonicsChallenge()">🔄 重新开局</button>
        </div>
      </div>

      <div class="quiz-question-box cartoon-question-box" style="margin-bottom:16px;">
        <div style="font-size:19px;font-weight:900;color:#1e1b4b;line-height:1.6;">
          ${escapeHtml(curQ.q)}
        </div>
      </div>

      <div class="cartoon-opt-grid">
        ${optsHtml}
      </div>

      ${qState.submitted ? `
        <div class="cartoon-feedback-banner ${qState.isCorrect ? 'is-right' : 'is-wrong'}" style="margin-top:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px;">
            <div style="font-size:18px;font-weight:900;">
              ${qState.isCorrect ? '🎉 太棒啦！辨音秒杀完全正确！' : `💡 再记一次！正确答案是【${letters[curQ.correct]}】`}
            </div>
            <button class="duo-btn primary" onclick="nextPhonicsChallenge()">
              <span>下一题 (${((qState.currentIndex + 1) % PHONICS_CHALLENGE_POOL.length) + 1}/${PHONICS_CHALLENGE_POOL.length}) ➔</span>
            </button>
          </div>
          <div style="font-size:15px;line-height:1.65;">
            <strong>解析口诀：</strong>${escapeHtml(curQ.exp)}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// 子板块 6：📝 写作业边做边读 · 题干词即查即拆 & 英语日常作业 6 大题型固定破题 SOP
// ============================================================================

const HOMEWORK_WORD_FAMILIES = [
  {
    id: 'rubric',
    title: '📋 题干指令高频词 (看不懂题目要求必查)',
    words: [
      { word: 'conversation', ipa: '/ˌkɒnvəˈseɪʃn/', cn: '对话', chunks: ['con', 'ver', 'sa', 'tion'], tip: '-tion 永远发 /ʃn/ (申)，重音在倒数第二个音节 sa /seɪ/' },
      { word: 'complete', ipa: '/kəmˈpliːt/', cn: '完成；补全', chunks: ['com', 'plete'], tip: '后半段 plete 是 Magic-E 魔法 e 结界，e 发长音 /iː/' },
      { word: 'correct', ipa: '/kəˈrekt/', cn: '正确的；改正', chunks: ['cor', 'rect'], tip: '首音节非重读弱化为 /ə/，重音在 rect /rekt/' },
      { word: 'following', ipa: '/ˈfɒləʊɪŋ/', cn: '下列的；接着的', chunks: ['fol', 'low', 'ing'], tip: 'follow (跟随) + ing，题干 the following 意为“下列…”' },
      { word: 'underline', ipa: '/ˌʌndəˈlaɪn/', cn: '划线；下划线', chunks: ['un', 'der', 'line'], tip: 'under (在…下) + line (线，Magic-E i-e /aɪ/) = 画下划线' },
      { word: 'passage', ipa: '/ˈpæsɪdʒ/', cn: '短文；段落', chunks: ['pas', 'sage'], tip: '阅读理解题干必见词：read the passage (读短文)' },
      { word: 'different', ipa: '/ˈdɪfrənt/', cn: '不同的 (后接 from)', chunks: ['dif', 'fer', 'ent'], tip: '固定搭配 be different from (与…不同)' },
      { word: 'sentence', ipa: '/ˈsentəns/', cn: '句子', chunks: ['sen', 'tence'], tip: '末尾 ce 遇到 e 发清脆的 /s/' }
    ]
  },
  {
    id: 'confuse',
    title: '⚡ 做题最易混双胞胎词 (圈题眼必辨)',
    words: [
      { word: 'where', ipa: '/weə(r)/', cn: '在哪里 (问地点)', chunks: ['wh', 'ere'], tip: 'wh 发 /w/ (h不发音)，ere 发 /eə/！看到答语有 in/on/under 必选 Where' },
      { word: 'there', ipa: '/ðeə(r)/', cn: '在那里；存在 (There be)', chunks: ['th', 'ere'], tip: 'th 咬舌震声带 /ð/ + ere /eə/！把 where 的 wh 换成 th 就是 there' },
      { word: 'their', ipa: '/ðeə(r)/', cn: '他们的 (后必有名词)', chunks: ['th', 'eir'], tip: '和 there 发音完全一样 /ðeə/，但后面必须带名词 (their books)' },
      { word: 'these', ipa: '/ðiːz/', cn: '这些 (this 的复数)', chunks: ['th', 'ese'], tip: 'e-e 魔法长音 /iː/，复数指示代词，后面配 are + 复数名词' },
      { word: 'those', ipa: '/ðəʊz/', cn: '那些 (that 的复数)', chunks: ['th', 'ose'], tip: 'o-e 魔法长音 /əʊ/，复数指示代词，答语一律用 They are...' },
      { word: 'parent', ipa: '/ˈpeərənt/', cn: '父亲或母亲(单数!)', chunks: ['pa', 'rent'], tip: '⚠️ 绝密陷阱：不加 s 的 parent 是单数(谓语用 is)；加 s 的 parents 才是复数(谓语用 are)！' },
      { word: 'cousin', ipa: '/ˈkʌzn/', cn: '堂/表兄妹', chunks: ['cou', 'sin'], tip: 'ou 在此发短音 /ʌ/ (同 country, touch)' },
      { word: 'daughter', ipa: '/ˈdɔːtə(r)/', cn: '女儿', chunks: ['daugh', 'ter'], tip: 'au 发长音 /ɔː/，中间 gh 隐身不发音，ter 发 /tə/' }
    ]
  },
  {
    id: 'unit_core',
    title: '🎒 初一上日常作业高频核心词 (一词一拆)',
    words: [
      { word: 'dictionary', ipa: '/ˈdɪkʃənri/', cn: '词典(复数变 y 为 i 加 es)', chunks: ['dic', 'tio', 'na', 'ry'], tip: '辅音字母 + y 结尾，复数必写 dictionaries！' },
      { word: 'library', ipa: '/ˈlaɪbrəri/', cn: '图书馆(复数 libraries)', chunks: ['li', 'bra', 'ry'], tip: 'li 发开音节 /laɪ/，辅音 r + y 结尾，复数变 libraries' },
      { word: 'information', ipa: '/ˌɪnfəˈmeɪʃn/', cn: '信息(不可数名词!)', chunks: ['in', 'for', 'ma', 'tion'], tip: '⚠️ 永远不可数！绝对不能加 s，也不能加 a/an，只能用 some / a piece of' },
      { word: 'furniture', ipa: '/ˈfɜːnɪtʃə(r)/', cn: '家具(不可数名词!)', chunks: ['fur', 'ni', 'ture'], tip: 'ur 卷舌 /ɜː/ + ni + ture /tʃə/；不可数名词，谓语永远用单数 is' },
      { word: 'vegetable', ipa: '/ˈvedʒtəbl/', cn: '蔬菜(可数名词!)', chunks: ['ve', 'ge', 'ta', 'ble'], tip: '中间第二个 e 吞音不读，读作 /ˈvedʒ-tə-bl/，复数加 s' },
      { word: 'interesting', ipa: '/ˈɪntrəstɪŋ/', cn: '有趣的(修饰物，首音元音用 an)', chunks: ['in', 'te', 'res', 'ting'], tip: '首音是元音 /ɪ/，前面必须填 an interesting book！' },
      { word: 'useful', ipa: '/ˈjuːsfl/', cn: '有用的(首音是辅音 /j/ 用 a!)', chunks: ['use', 'ful'], tip: '🚨 周测头号陷阱：u 发 /juː/ (辅音 /j/ 开头)，必须写 a useful book！' },
      { word: 'umbrella', ipa: '/ʌmˈbrelə/', cn: '雨伞(首音是元音 /ʌ/ 用 an!)', chunks: ['um', 'brel', 'la'], tip: '🚨 与 useful 对比：u 在此发短元音 /ʌ/，必须写 an umbrella！' }
    ]
  }
];

const ENGLISH_HOMEWORK_SOPS = [
  {
    id: 'sop-verb-trap',
    badge: '专治若婷 10.21 错题',
    title: '🚫 模型一：连词成句/造句「一山不容二虎」铁律 (防 am keep / are is)',
    symptom: '若婷错因还原：把「我保持整洁」写成 I keep am tidy；把「在…下面」写成 are is under。看到中文有“是”或形容词，就习惯性塞一个 am/is/are。',
    steps: [
      '第 1 步【找真动词】：先看句中能不能找到「实义动作词」（如 keep 保持、have 有、like 喜欢、play 玩、help 帮助）。',
      '第 2 步【一山不容二虎】：只要已经有了实义动作词（如 keep），绝对禁止再放 am / is / are 原形！直接写：主语 + 动作词 (I keep tidy)。',
      '第 3 步【没动作才请 Be 动词】：只有当全句没有任何动作词，纯粹表示「某人/某物是怎么样的(形容词) 或 在哪儿(介词 in/on/under)」时，才请唯一一个 am/is/are 出山 (They are under the bed)！'
    ],
    example: '✅ 正确对比：I am tidy. (无动作，用 am)  🆚  I keep my room tidy. (有动作 keep，严禁加 am！)'
  },
  {
    id: 'sop-article',
    badge: '单选/完形必考',
    title: '🎧 模型二：冠词 a / an / the 秒杀三步曲 (只听首音，不看首字母)',
    symptom: '看到 u 开头就盲填 an，看到 f/h/m/s 独立字母题就发懵。',
    steps: [
      '第 1 步【看是否特指】：如果二次提到、或有 in the room 固定搭配、或双方都知道的那一个 ➔ 直接填 the。',
      '第 2 步【拼出首音素】：如果表“一个”，立刻在嘴里拼出紧挨着空格那个词的「第一个音标」！',
      '第 3 步【背死 3 组生死劫】：① u 发 /juː/ (useful, university, uniform, European) ➔ 填 a！② u 发 /ʌ/ (umbrella, uncle, unusual) ➔ 填 an！③ h 不发音 (hour, honest) 或 8 个元音开头字母 (f, h, l, m, n, r, s, x) ➔ 填 an！'
    ],
    example: '✅ 记忆锚点：a useful book (有/j/辅音) 🆚 an umbrella (阿/ʌ/元音) 🆚 an "s" / an hour'
  },
  {
    id: 'sop-word-form',
    badge: '适当形式填空',
    title: '🔧 模型三：用所给词适当形式填空「先判词性，再走三岔口」',
    symptom: '拿到括号里的词 (如 parent / he / watch / one) 不看前后文直接照抄或乱加 s。',
    steps: [
      '第 1 步【括号里是名词 (book/parent/box)】：找前面的「数量词/Be动词」(two, some, many, these, those, are) ➔ 变复数 (-s/-es/变y为i加es)；若后面紧跟另一个名词表“某人的” ➔ 加 \'s / s\'。',
      '第 2 步【括号里是代词 (I/he/they)】：看空格后面有没有名词！后面有名词 (___ schoolbag) ➔ 用形物代 (my/his/their)；后面没名词或放句末 (is ___ / help ___) ➔ 用名物代 (mine/his/theirs) 或宾格 (me/him/them)。',
      '第 3 步【括号里是动词 (have/like/be)】：一圈主语！若主语是「三单 (he/she/it/单数人名/my mother/this book)」，动词必变三单 (has / likes / is)；若在 let\'s / can / don\'t / doesn\'t 后面 ➔ 一律填动词原形！'
    ],
    example: '✅ 实战演练：These are my ___ (parent) ➔ 看到 These are 必变复数 parents！'
  },
  {
    id: 'sop-transform',
    badge: '按要求改写句子',
    title: '🔄 模型四：变否定句/一般疑问句「有大人找大人，没大人请保镖」',
    symptom: '遇到句型转换题漏改代词 (my 没变 your)、或者打了助动词 does 后面的动词忘了打回原形。',
    steps: [
      '第 1 步【找句中有没有“三大大人”】：先看原句有没有 ① Be动词 (am/is/are) 或 ② 情态动词 (can)。如果有，直接把大人提到句首(变疑问)或在大人身后加 not(变否定)！',
      '第 2 步【没大人，请助动词保镖 do/does】：如果原句只有实义动词 (like / have / watches)，主语三单请 does/doesn\'t，其余请 do/don\'t！',
      '第 3 步【照妖镜打回原形 + 两大必变】：🚨 一旦请出了 does / doesn\'t，后面的动词必须立刻脱掉 s/es 打回原形 (has ➔ have, likes ➔ like)！变疑问句时：I/we 必变 you，my/our 必变 your，some 必变 any！'
    ],
    example: '✅ 实战演练：She has a baseball. ➔ 否定：She doesn\'t have a baseball. (has 必打回原形 have！)'
  }
];

function autoSplitEnglishWordToChunks(rawWord) {
  const clean = String(rawWord || '').trim().toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return [];

  // 优先匹配内置词库（若婷14错词 + 作业词库）
  const knownWorkshop = RUOTING_14_WORDS.find(w => w.word.toLowerCase() === clean);
  if (knownWorkshop && knownWorkshop.bricks) {
    return knownWorkshop.bricks.map(b => ({ text: b.text, ipa: b.ipa, type: b.type, note: b.note }));
  }
  for (const fam of HOMEWORK_WORD_FAMILIES) {
    const found = fam.words.find(w => w.word.toLowerCase() === clean);
    if (found) {
      return found.chunks.map((c, idx) => ({
        text: c,
        ipa: idx === 0 ? found.ipa : '',
        type: /[aeiouy]/i.test(c) ? 'digraph' : 'consonant',
        note: found.tip
      }));
    }
  }

  // 智能自然拼读音节切分器 (针对任意课外/作业生词)
  const chunks = [];
  const regex = /(tion|sion|ture|igh|ough|augh|ear|eer|air|are|ch|sh|th|wh|ph|ck|ng|qu|ee|ea|oo|oa|ai|ay|oi|oy|ou|ow|au|aw|ar|er|ir|or|ur|[bcdfghjklmnpqrstvwxz]*[aeiouy]+[bcdfghjklmnpqrstvwxz]?|[bcdfghjklmnpqrstvwxz]+)/gi;
  const matches = clean.match(regex) || [clean];
  return matches.map(m => {
    let type = 'consonant';
    let note = '辅音拼读块';
    if (/^(tion|sion|ture)$/i.test(m)) {
      type = 'silent';
      note = '高频后缀固定发音块 (-tion /ʃn/, -ture /tʃə/)';
    } else if (/^(ch|sh|th|wh|ph|ck|ng|qu|ee|ea|oo|oa|ai|ay|oi|oy|ou|ow|au|aw|ar|er|ir|or|ur|igh|ear|air)$/i.test(m)) {
      type = 'digraph';
      note = '核心字母组合 (两个字母抱团发一个音)';
    } else if (/[aeiouy]/i.test(m)) {
      type = 'vowel';
      note = '核心元音音节块 (决定重读与开口度)';
    }
    return { text: m, ipa: '', type, note };
  });
}

function setHomeworkDecodeWord(word) {
  const ph = ensurePhonicsState();
  ph.homeworkQuery = String(word || '').trim();
  renderPhonicsView();
  if (ph.homeworkQuery) {
    speakPhonicsEnglish(ph.homeworkQuery, '作业题干词慢速拼读');
  }
}

function handleHomeworkInputSubmit(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('homework-word-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  setHomeworkDecodeWord(val);
}

function renderPhonicsHomeworkTab(ph) {
  if (!ph.homeworkQuery) ph.homeworkQuery = 'conversation';
  const query = ph.homeworkQuery.trim();
  const lowerQ = query.toLowerCase();

  // 查找是否有精准词条解析
  let matchedEntry = null;
  for (const fam of HOMEWORK_WORD_FAMILIES) {
    const f = fam.words.find(w => w.word.toLowerCase() === lowerQ);
    if (f) { matchedEntry = f; break; }
  }
  if (!matchedEntry) {
    const rw = RUOTING_14_WORDS.find(w => w.word.toLowerCase() === lowerQ);
    if (rw) {
      matchedEntry = {
        word: rw.word,
        ipa: rw.ipa,
        cn: rw.cn,
        chunks: rw.bricks.map(b => b.text),
        tip: rw.ruleTip
      };
    }
  }

  const chunks = autoSplitEnglishWordToChunks(query);
  const safeQuery = query.replace(/'/g, "\\'");

  const chunksHtml = chunks.map(c => `
    <div class="phonics-brick type-${c.type}" onclick="speakPhonicsEnglish('${safeQuery}', '点击音节跟读整词')" title="${escapeHtml(c.note || '')}">
      <span class="brick-letters">${escapeHtml(c.text)}</span>
      <span class="brick-ipa">${escapeHtml(c.type === 'consonant' ? '辅音块' : (c.type === 'silent' ? '后缀块' : '核心音节'))}</span>
    </div>
  `).join('<span style="font-size:20px;font-weight:900;color:#cbd5e1;align-self:center;">+</span>');

  const familiesHtml = HOMEWORK_WORD_FAMILIES.map(fam => `
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:16px;padding:14px;">
      <div style="font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px;">${escapeHtml(fam.title)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${fam.words.map(w => {
          const isAct = w.word.toLowerCase() === lowerQ;
          return `
            <button
              class="zen-btn-ghost"
              style="padding:6px 11px;border-radius:10px;font-size:13px;font-weight:800;${isAct ? 'background:#fdf2f8;border-color:#ec4899;color:#be185d;' : 'background:#ffffff;'}"
              onclick="setHomeworkDecodeWord('${w.word.replace(/'/g, "\\'")}')"
            >
              <span>${escapeHtml(w.word)}</span>
              <span style="font-size:11.5px;color:#64748b;margin-left:4px;">${escapeHtml(w.cn.split('(')[0])}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  const sopsHtml = ENGLISH_HOMEWORK_SOPS.map(sop => `
    <div class="phonics-rule-card" style="border-color:#c7d2fe;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="badge" style="background:#eef2ff;color:#4338ca;font-weight:900;">${escapeHtml(sop.badge)}</span>
        <span style="font-size:12px;font-weight:800;color:#6366f1;">做题前先花 5 秒对暗号</span>
      </div>
      <div style="font-size:16px;font-weight:900;color:#1e1b4b;line-height:1.45;">
        ${escapeHtml(sop.title)}
      </div>
      <div style="background:#fff1f2;border-left:4px solid #f43f5e;padding:8px 12px;border-radius:8px;font-size:12.5px;color:#881337;line-height:1.55;">
        <strong>🎯 痛点诊断：</strong>${escapeHtml(sop.symptom)}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
        ${sop.steps.map(st => `
          <div style="font-size:13px;color:#334155;line-height:1.55;background:#f8fafc;padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(st)}
          </div>
        `).join('')}
      </div>
      <div style="font-size:12.5px;font-weight:800;color:#065f46;background:#ecfdf5;padding:8px 10px;border-radius:8px;border:1px solid #a7f3d0;">
        ${escapeHtml(sop.example)}
      </div>
    </div>
  `).join('');

  return `
    <!-- 顶部：写作业遇到生词即查即拆点读器 -->
    <div class="ipa-spotlight-stage" style="border-color:#6366f1;background:linear-gradient(135deg,#ffffff 0%,#eef2ff 55%,#fdf2f8 100%);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="badge" style="background:#4f46e5;color:#fff;font-weight:900;">📝 写英语作业专用 · 边做题边拆读生词</span>
            <span style="font-size:13px;color:#475569;font-weight:700;">解决「日常作业全是做题，但题干/选项单词不会读」</span>
          </div>
          <h3 style="font-size:20px;font-weight:900;color:#1e1b4b;margin:6px 0 0;">
            遇到不会读的作业词？输入或点选下方高频词，立刻拆成音节积木 + 外教带读！
          </h3>
        </div>
        <form onsubmit="handleHomeworkInputSubmit(event)" style="display:flex;gap:8px;flex-wrap:wrap;min-width:280px;flex:1;max-width:460px;">
          <input
            id="homework-word-input"
            type="text"
            value="${escapeHtml(query)}"
            placeholder="输入作业里的生词或短语 (如 conversation / useful)..."
            style="flex:1;padding:10px 14px;border-radius:12px;border:2px solid #818cf8;font-size:15px;font-weight:800;color:#1e1b4b;outline:none;"
          />
          <button type="submit" class="duo-btn indigo" style="padding:10px 16px;">
            🔍 <span>拆音节 + 发音</span>
          </button>
        </form>
      </div>

      <!-- 当前拆解展示台 -->
      <div style="background:#ffffff;border:2px solid #c7d2fe;border-radius:18px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            <span style="font-size:32px;font-weight:900;color:#1e1b4b;font-family:monospace;">${escapeHtml(query)}</span>
            ${matchedEntry ? `
              <span style="font-size:20px;font-weight:800;color:#db2777;font-family:monospace;">${escapeHtml(matchedEntry.ipa)}</span>
              <span class="badge status-green" style="font-size:14px;">${escapeHtml(matchedEntry.cn)}</span>
            ` : `
              <span class="badge" style="background:#e0e7ff;color:#4338ca;">✨ 已按自然拼读规则自动切分音节积木</span>
            `}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="duo-btn primary" onclick="speakPhonicsEnglish('${safeQuery}', '外教标准发音')">
              🔊 <span>听外教读 (${ph.voice === 'en-US-AnaNeural' ? '美音' : '英音'})</span>
            </button>
            <button class="zen-btn-ghost" onclick="ph.slowMode=true;speakPhonicsEnglish('${safeQuery}', '0.78x 慢速拆音跟读')">
              🐢 <span>慢速跟读一遍</span>
            </button>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:900;color:#475569;">🧱 音节积木拆解：</span>
          ${chunksHtml}
        </div>

        <div style="font-size:13.5px;color:#334155;background:#f8fafc;padding:10px 14px;border-radius:12px;border-left:4px solid #6366f1;line-height:1.6;">
          <strong>🪄 拼读与做题锦囊：</strong>
          ${matchedEntry ? escapeHtml(matchedEntry.tip) : '先找红/蓝色的【元音核心块】定下有几个音节，再用前面的辅音去“拼”它（辅音+元音一拍即合），做完一题顺手点读 2 个题干词，做题和认读两不误！'}
        </div>
      </div>

      <!-- 3大类高频作业题干词一键点读 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px;">
        ${familiesHtml}
      </div>
    </div>

    <!-- 下半部分：英语日常作业 4 大高频题型「1-2-3 固定破题流水线」 -->
    <div class="section-card" style="border:2px solid #c7d2fe;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div>
          <h3 style="font-size:18px;font-weight:900;color:#1e1b4b;margin:0;">
            🧭 英语日常作业「不靠语感猜，全靠 1-2-3 固定流水线」四大母题公式
          </h3>
          <p style="font-size:13px;color:#64748b;margin:4px 0 0;">
            哪怕句子里有 1~2 个单词不认识，只要按下面固定的「圈题眼 ➔ 对暗号 ➔ 填形态」三步走，照样能稳稳做对！
          </p>
        </div>
        <button class="duo-btn indigo" onclick="switchTab('mastermap')">
          🗺️ <span>去「全科方法论图谱」看数学/全科固定解题SOP ➔</span>
        </button>
      </div>
      <div class="phonics-rule-grid">
        ${sopsHtml}
      </div>
    </div>
  `;
}
