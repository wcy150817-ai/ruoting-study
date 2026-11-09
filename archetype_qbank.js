// =========================================================================
// 若婷五四制全科系统 · 三大核心增强模块 (archetype_qbank.js)
// 1. 全页面通用导出与 A4 打印引擎 (Universal Page Print & Word/MD Export)
// 2. 单元考点 ➔ 考题形式(题型) ➔ 固定解题方法与步骤 SOP 矩阵 + 题型靶向强化训练
// 3. 可添加题库管理中心 (单题录入 / 批量智能解析导入 / 题库检索 / 多模式打印导出 / 在线刷题)
// =========================================================================

window.ARCHETYPE_STATE = {
  filterUnit: 'ALL',
  searchQuery: '',
  activeSopBanner: ''
};

window.QBANK_STATE = {
  sourceFilter: 'CUSTOM_FIRST', // 'CUSTOM_ONLY' | 'CUSTOM_FIRST' | 'ALL'
  subject: 'ALL',
  semester: 'ALL',
  chapter: 'ALL',
  type: 'ALL', // 'ALL' | 'CHOICE' | 'TF' | 'SUBJECTIVE'
  keyword: '',
  printAnswerMode: 'end', // 'end' (卷末附答案与步骤) | 'inline' (题下紧跟步骤讲义版) | 'none' (纯空白卷)
  limitCount: 30,
  showAddDrawer: false,
  showBatchModal: false,
  prefill: null
};

// =========================================================================
// PART 1: 全页面通用导出与 A4 打印引擎 (支持系统所有页面一键打印/导出 Word/MD)
// =========================================================================

function getActiveTabTitleInfo() {
  const tabKey = (typeof STATE !== 'undefined' && STATE.activeTab) ? STATE.activeTab : 'macro';
  const curSubj = (typeof STATE !== 'undefined' && STATE.homeSelectedSubject) ? STATE.homeSelectedSubject : '数学';
  const curSem = (typeof STATE !== 'undefined' && STATE.stageFocus && STATE.stageFocus !== 'ALL') ? STATE.stageFocus : '初一上';
  const curChap = (typeof STATE !== 'undefined' && STATE.homeSelectedChapter && STATE.homeSelectedChapter !== 'ALL') ? STATE.homeSelectedChapter : '';

  const map = {
    macro: {
      id: 'view-macro',
      title: `若婷五四制 · ${curSubj}（${curSem}${curChap ? ' · ' + curChap : ''}）学习讲义与训练单`,
      subtitle: `科目：${curSubj} | 学期：${curSem} | 视图：${(typeof STATE !== 'undefined' && STATE.drillLevel === 'POINTS') ? (STATE.chapterSubMode || '单元考点') : (STATE.subjectVisualMode || '单元总览')}`
    },
    qbank: {
      id: 'view-qbank',
      title: `若婷专属全科题库训练卷（${window.QBANK_STATE.subject === 'ALL' ? '九科综合' : window.QBANK_STATE.subject}）`,
      subtitle: `题库范围：${window.QBANK_STATE.semester === 'ALL' ? '全部学期' : window.QBANK_STATE.semester} | 模式：${window.QBANK_STATE.printAnswerMode === 'inline' ? '讲义精析版' : '标准测试版'}`
    },
    phonics: {
      id: 'view-phonics',
      title: `鲁教版五四制 · 英语 48 国际音标与自然拼读拆词通关手册`,
      subtitle: `含 48 音标分类表 + 若婷真实易错词拼读积木拆解 + 5 大自然拼读黄金法则 + 26 字母音素家族`
    },
    exam: {
      id: 'view-exam',
      title: `若婷真实诊断错题本与满分审题习惯清零手册`,
      subtitle: `六维错因习惯基因库 + 考前防粗心铁律清单 + 历次诊断真题复盘`
    },
    charts: {
      id: 'view-charts',
      title: `若婷初中四年全科能力进度与掌握度成长档案`,
      subtitle: `导出日期：${new Date().toLocaleDateString('zh-CN')} | 五四制全科跟踪看板`
    },
    syllabus: {
      id: 'view-syllabus',
      title: `五四制初中全科教材单元详尽考点大纲（${(typeof STATE !== 'undefined' && STATE.activeSyllabusSubject) || curSubj}）`,
      subtitle: `56 册学期大纲与核心知识点全映射`
    },
    meso: {
      id: 'view-meso',
      title: `若婷全科知识点检索与筛选清单`,
      subtitle: `跨学期核心考点与秒杀口诀汇总`
    }
  };
  return map[tabKey] || map.macro;
}

function buildUniversalA4PrintDocument(bodyHtml, docTitle, docSubtitle) {
  const dateStr = new Date().toLocaleDateString('zh-CN');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${docTitle}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Serif SC", sans-serif;
    color: #0f172a;
    line-height: 1.58;
    font-size: 10pt;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .u-print-toolbar {
    position: sticky; top: 0; z-index: 999;
    background: #1e1b4b; color: #fff; padding: 10px 20px;
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; border-radius: 8px;
  }
  .u-print-toolbar button {
    background: #10b981; color: #fff; border: none; padding: 8px 18px;
    border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; margin-left: 8px;
  }
  .u-print-toolbar button.secondary { background: #475569; }
  .u-doc-header {
    border-bottom: 2.5px solid #0f172a;
    padding-bottom: 10px;
    margin-bottom: 14px;
    text-align: center;
  }
  .u-doc-header h1 { margin: 0 0 6px 0; font-size: 15.5pt; color: #0f172a; }
  .u-doc-header .u-doc-meta {
    font-size: 9.5pt; color: #475569;
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    margin-top: 6px;
  }
  /* 打印时自动隐藏所有交互按钮与筛选条 */
  .no-print, button, .comm-segmented-bar, .drill-nav-header, .zen-btn-sm, .zen-btn-ghost, .zen-btn-start,
  .duo-btn, .qbank-filter-bar, .qbank-add-drawer, .universal-page-bar, .ahb-unit-filter, .phonics-hero-banner {
    display: none !important;
  }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px 0; page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th, td { border: 1px solid #94a3b8; padding: 7px 9px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  th { background: #f1f5f9 !important; font-weight: 700; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .archetype-unit-block, .archetype-kp-card, .qbank-item-card, .zen-unit-block, .zen-step-row {
    border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;
    page-break-inside: avoid; background: #fff;
  }
  .sop-step-box {
    background: #f8fafc !important; border-left: 3px solid #4f46e5;
    padding: 5px 8px; margin: 4px 0; border-radius: 4px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @media print {
    .u-print-toolbar { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="u-print-toolbar">
    <div>🖨️ <strong>A4 打印预览模式</strong> · ${docTitle}</div>
    <div>
      <button onclick="window.print()">🖨️ 立即打印 / 存为 PDF</button>
      <button class="secondary" onclick="window.close()">✖ 关闭窗口</button>
    </div>
  </div>
  <div class="u-doc-header">
    <h1>${docTitle}</h1>
    <div class="u-doc-meta">
      <span>📌 ${docSubtitle}</span>
      <span>👧 使用人：若婷 | 📅 日期：${dateStr} | ✍️ 复盘签字：__________</span>
    </div>
  </div>
  <div class="u-doc-body">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function printElementContent(elId, customTitle, customSubtitle) {
  const el = document.getElementById(elId);
  if (!el) {
    if (typeof showToast === 'function') showToast('⚠️ 未找到当前页面可打印内容区域');
    return;
  }
  const info = getActiveTabTitleInfo();
  const title = customTitle || info.title;
  const subtitle = customSubtitle || info.subtitle;
  const html = buildUniversalA4PrintDocument(el.innerHTML, title, subtitle);
  const win = window.open('', '_blank');
  if (!win) {
    if (typeof showToast === 'function') showToast('⚠️ 浏览器拦截了打印窗口，请允许弹窗后重试');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function exportElementWord(elId, customTitle, customSubtitle) {
  const el = document.getElementById(elId);
  if (!el) return;
  const info = getActiveTabTitleInfo();
  const title = customTitle || info.title;
  const subtitle = customSubtitle || info.subtitle;

  const clone = el.cloneNode(true);
  clone.querySelectorAll('button, .no-print, .comm-segmented-bar, .drill-nav-header, .qbank-filter-bar, .qbank-add-drawer, .universal-page-bar, input, select, textarea, svg').forEach(n => n.remove());

  const docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset="utf-8"><title>${title}</title>
  <style>
    body { font-family: "SimSun", "Microsoft YaHei", sans-serif; font-size: 10.5pt; line-height: 1.6; color: #111; }
    h1 { font-size: 16pt; text-align: center; margin-bottom: 4pt; }
    h2 { font-size: 13pt; color: #1e293b; border-bottom: 1px solid #94a3b8; padding-bottom: 3pt; margin-top: 12pt; }
    h3, h4 { font-size: 11pt; color: #334155; margin-top: 8pt; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
    th, td { border: 1px solid #64748b; padding: 6pt 8pt; font-size: 9.5pt; vertical-align: top; }
    th { background-color: #f1f5f9; font-weight: bold; }
    .meta { text-align: center; color: #475569; font-size: 9.5pt; margin-bottom: 14pt; border-bottom: 2px solid #0f172a; padding-bottom: 8pt; }
  </style></head>
  <body>
    <h1>${title}</h1>
    <div class="meta">${subtitle} | 导出日期：${new Date().toLocaleDateString('zh-CN')}</div>
    ${clone.innerHTML}
  </body></html>`;

  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|\s]+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('📘 已导出当前页为 Word (.doc) 文档！');
}

function exportElementMarkdown(elId, customTitle, customSubtitle) {
  const el = document.getElementById(elId);
  if (!el) return;
  const info = getActiveTabTitleInfo();
  const title = customTitle || info.title;
  const subtitle = customSubtitle || info.subtitle;

  const clone = el.cloneNode(true);
  clone.querySelectorAll('button, .no-print, .comm-segmented-bar, .drill-nav-header, .qbank-filter-bar, .qbank-add-drawer, .universal-page-bar, style, script').forEach(n => n.remove());

  let md = `# ${title}\n\n> ${subtitle} | 导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
  const textLines = (clone.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
  md += textLines.join('\n\n') + '\n';

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|\s]+/g, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('⬇️ 已导出当前页为 Markdown (.md) 文档！');
}

function printCurrentActivePage() {
  const tabKey = (typeof STATE !== 'undefined' && STATE.activeTab) ? STATE.activeTab : 'macro';
  if (tabKey === 'macro' && typeof STATE !== 'undefined' && STATE.drillLevel === 'CHAPTER' && STATE.subjectVisualMode === 'PAPER_GEN') {
    if (typeof openPaperPrintWindow === 'function') {
      openPaperPrintWindow(false);
      return;
    }
  }
  if (tabKey === 'qbank') {
    printFilteredQBank(window.QBANK_STATE.printAnswerMode);
    return;
  }
  const info = getActiveTabTitleInfo();
  printElementContent(info.id, info.title, info.subtitle);
}

function exportCurrentActivePageWord() {
  const tabKey = (typeof STATE !== 'undefined' && STATE.activeTab) ? STATE.activeTab : 'macro';
  if (tabKey === 'macro' && typeof STATE !== 'undefined' && STATE.drillLevel === 'CHAPTER' && STATE.subjectVisualMode === 'PAPER_GEN') {
    if (typeof exportPaperAsWordDoc === 'function') {
      exportPaperAsWordDoc();
      return;
    }
  }
  if (tabKey === 'qbank') {
    exportFilteredQBankWord(window.QBANK_STATE.printAnswerMode);
    return;
  }
  const info = getActiveTabTitleInfo();
  exportElementWord(info.id, info.title, info.subtitle);
}

function renderUniversalPageActionBar(targetElId, title, subtitle) {
  const safeTitle = (title || '').replace(/'/g, "\\'");
  const safeSub = (subtitle || '').replace(/'/g, "\\'");
  return `
    <div class="universal-page-bar no-print">
      <div class="upb-left">
        <span class="upb-badge">🖨️ 本页支持导出与打印</span>
        <span class="upb-desc">${subtitle || '可将当前页面的考点、方法或清单直接 A4 打印或导出为 Word / Markdown'}</span>
      </div>
      <div class="upb-actions">
        <button class="zen-btn-sm primary" onclick="printElementContent('${targetElId}', '${safeTitle}', '${safeSub}')">🖨️ A4打印/存PDF</button>
        <button class="zen-btn-sm" onclick="exportElementWord('${targetElId}', '${safeTitle}', '${safeSub}')">📘 导出Word</button>
        <button class="zen-btn-sm" onclick="exportElementMarkdown('${targetElId}', '${safeTitle}', '${safeSub}')">⬇️ 导出MD</button>
      </div>
    </div>
  `;
}

// =========================================================================
// PART 2: 单元考点 ➔ 考题形式(题型) ➔ 固定解题方法与步骤 SOP 矩阵 & 靶向强化
// =========================================================================

const SUBJECT_ARCHETYPE_TEMPLATES = {
  '数学': {
    frameworkName: '初中数学「三步破题法」：审题译条件 ➔ 匹配母题模型 ➔ 符号与分类讨论验算',
    types: [
      {
        badge: '题型A · 概念辨析与特值排雷',
        signalPrefix: '当题干出现「下列说法正确的是/错误的是」「必有/一定」「有几个」时',
        steps: [
          '【第1步·锁限定词】圈出题干中的“非负数、正整数、不大于、倒数、相反数”等边界词。',
          '【第2步·特值代验】立即代入黄金三特值：0、1、-1（或分数 1/2），一秒排除伪命题。',
          '【第3步·核对防坑】检查是否漏掉“0 没有倒数”“0 是非负数”“绝对值等于本身的数含0”。'
        ]
      },
      {
        badge: '题型B · 标准公式/运算法则直接计算',
        signalPrefix: '当题干给出明确算式、方程、代数式求值或几何线段/角度计算时',
        steps: [
          '【第1步·定符号与顺序】先定符号再算绝对值；混合运算严格按“先乘方➔再乘除➔后加减，括号优先”。',
          '【第2步·套用标准步】按教材母题标准格式写出中间变形步（跳步极易丢符号或漏乘括号每一项）。',
          '【第3步·逆向回代验算】把算出的结果代回原式或用估算检验数量级与正负号是否合理。'
        ]
      },
      {
        badge: '题型C · 多解分类讨论与非负性综合变式',
        signalPrefix: '当题干出现「|a|=k 但未给正负」「两点距离未给左右顺序」「|A|+B²=0」时',
        steps: [
          '【第1步·识别隐藏多解】凡未画图或未指明方向的绝对值、数轴动点、线段共线问题，必有 2 种情况。',
          '【第2步·分情况列式】规范写出“情况①：当…时；情况②：当…时”，或利用“0+0=0 模型”令各项均为0。',
          '【第3步·检验舍去增根】对照题干隐藏限制（如 a+b>0 或分母≠0），排除不符合题意的解。'
        ]
      }
    ]
  },
  '英语': {
    frameworkName: '鲁教五四制英语「题眼定位法」：找时间/人称标志词 ➔ 套语法结构公式 ➔ 查单复数与大小写',
    types: [
      {
        badge: '题型A · 语音辨析与自然拼读拆词题',
        signalPrefix: '当题干考查「画线字母发音不同」「根据音标写单词」「音节划分」时',
        steps: [
          '【第1步·判开闭音节】看元音字母后是否有不发音 e（开音节读字母本音，闭音节读短元音）。',
          '【第2步·抓固定组合】识别 th/sh/ch/ea/oo/ar/or/er 等固定字母组合发音规律。',
          '【第3步·拼读核对】把音标拼读出声，对照自己易错词表检查双写辅音或静音字母。'
        ]
      },
      {
        badge: '题型B · 单项选择与词汇语法变形题',
        signalPrefix: '当题干出现代词格转换、be动词/助动词选择、名词单复数或介词搭配时',
        steps: [
          '【第1步·圈语法题眼】先找句中主语人称（三单?复数?）和时间状语/连词（and/but/in/on/at）。',
          '【第2步·定位置选词性】动词前用主格(I/he/they)，动词/介词后用宾格(me/him)，名词前用形物代(my/his)。',
          '【第3步·三单与复数复核】主语是 he/she/it/单数名词时，谓语必加 -s/es 或用 is/has/does！'
        ]
      },
      {
        badge: '题型C · 句型转换与语篇阅读理解题',
        signalPrefix: '当题干要求「变否定句/一般疑问句/画线提问」或「细节理解/词义猜测」时',
        steps: [
          '【第1步·一找二借】句型转换先找句中有无 be(am/is/are) 或情态动词；没有则借助动词 do/does（动词打回原形）。',
          '【第2步·关键词回文定位】阅读题先圈题干疑问词(Who/Where/Why/How many)，回原文找同义句。',
          '【第3步·首字母与标点检查】书面表达与连词成句必须检查句首大写、专有名词大写与句末标点。'
        ]
      }
    ]
  },
  '生物': {
    frameworkName: '初中生物「结构-功能-对照实验」三步法：认准识图部位 ➔ 找唯一变量 ➔ 用教材规范术语作答',
    types: [
      {
        badge: '题型A · 核心概念与生物特征/结构功能辨析',
        signalPrefix: '当题干考查「属于生物的是」「结构与功能对应关系」「植物vs动物细胞区别」时',
        steps: [
          '【第1步·排非生物干扰】钟乳石、生石花、珊瑚vs珊瑚虫、机器人、病毒（无细胞结构）优先甄别。',
          '【第2步·锁结构功能对应】细胞膜(控制进出)、线粒体(呼吸供能动力车间)、叶绿体(光合场所，植物非绿色部位无叶绿体！)。',
          '【第3步·抓特征字眼】看到“遗传物质”锁细胞核，看到“酸甜苦辣汁液”锁液泡。'
        ]
      },
      {
        badge: '题型B · 显微镜操作与临时装片制作识图题',
        signalPrefix: '当题干出现显微镜结构图、视野污点判断、物像移动或制作装片步骤排序时',
        steps: [
          '【第1步·套操作口诀】装片制作七字诀：“擦➔滴(植物清水/动物生理盐水)➔取➔展/涂➔盖(45°防气泡)➔染➔吸”。',
          '【第2步·套视野规律】显微镜成倒像：“偏哪往哪移”；放大倍数越大➔视野越暗、细胞越大、数目越少。',
          '【第3步·污点移动定位】移动装片不动、转动目镜也不动➔污点必在物镜上！'
        ]
      },
      {
        badge: '题型C · 科学探究与对照实验分析题',
        signalPrefix: '当题干给出两组或多组实验装置，问「实验变量」「对照组」「得出的结论」时',
        steps: [
          '【第1步·找唯一不同点】对比甲乙两组条件，唯一不同的那个因素就是“实验变量”（其余必须相同以控制单一变量）。',
          '【第2步·定对照组】自然状态、未做特殊处理的一组为“对照组”，人为改变变量的一组为“实验组”。',
          '【第3步·按模板写结论】结论必含变量与结果：“【变量】对【研究对象】有影响（成正/反比）”。'
        ]
      }
    ]
  },
  '道法': {
    frameworkName: '初中道法「四排法+材料三步法」：先排绝对化错误项 ➔ 审设问主体与角度 ➔ 材料原词映射教材金句',
    types: [
      {
        badge: '题型A · 组合型选择题（①②③④四选三/四选二）',
        signalPrefix: '当题干给出名言、漫画或情境，要求选出正确的组合项时',
        steps: [
          '【第1步·一票否决排错】凡含“决定性、唯一、消除一切挫折、杜绝、完全靠自己、主宰”的绝对化表述直接排除！',
          '【第2步·排异与排无关】说法本身正确但与题干漫画/材料主旨无关的选项排除。',
          '【第3步·核对主体角度】看清设问问的是“青少年怎么做”还是“国家/社会怎么做”，避免张冠李戴。'
        ]
      },
      {
        badge: '题型B · 原因/意义/认识类主观分析题',
        signalPrefix: '当设问出现「为什么」「有何重要意义」「谈谈你的认识/理解」时',
        steps: [
          '【第1步·拆设问定范围】圈出设问的核心考点词（如：中学序曲、学习伴成长、认识自己、友谊、敬畏生命）。',
          '【第2步·三层逻辑展开】按“是什么（地位/实质）➔ 为什么（重要性/危害）➔ 怎么做（简要表态）”分点标号 ①②③。',
          '【第3步·结合材料升华】每一点采用“教材核心金句 + 结合材料中某某的做法”双结合格式，绝不空抄。'
        ]
      },
      {
        badge: '题型C · 启示/做法/践行类主观简答题',
        signalPrefix: '当设问出现「给我们什么启示」「青少年应该怎样做」「请你提出合理化建议」时',
        steps: [
          '【第1步·提取材料行为】在材料中画出榜样人物的正向行为或反面人物的问题点，逐一对应转化。',
          '【第2步·思想+行动双维度】①思想意识上：树立…观念/正确对待…；②具体行动上：掌握…方法/在生活中做到…。',
          '【第3步·分点序号化】严格写成“①…；②…；③…”，字迹工整，每点首句亮出教材采分关键词。'
        ]
      }
    ]
  },
  '语文': {
    frameworkName: '初中语文「语境还原+答题公式」：字词抓形义辨析 ➔ 古诗文抓关键字译 ➔ 阅读按“手法+内容+情感”三步答',
    types: [
      {
        badge: '题型A · 字音字形与病句成语辨析题',
        signalPrefix: '当题干考查多音字、形近字、成语误用或病句修改时',
        steps: [
          '【第1步·以义定音定形】多音字看词义定读音，形近字看偏旁部首含义（如“诀别”与言语有关，“决绝”与水有关）。',
          '【第2步·成语查褒贬与对象】特别警惕望文生义、褒贬误用、谦敬错位（如“莅临、高见、拙见”）。',
          '【第3步·病句六大病因排查】先缩句看“主谓宾搭配”，再查“两面对一面、否定不当、成分残缺、语序不当”。'
        ]
      },
      {
        badge: '题型B · 古诗文默写与名句赏析题',
        signalPrefix: '当题干出现情境理解性默写、炼字赏析或作者思想感情概括时',
        steps: [
          '【第1步·圈情境提示词】从题干中画出写景特征、哲理启示或情感关键词，精准锁定对应上下句。',
          '【第2步·严查通假与难写字】默写后必须逐字检查易错笔画（如“萧瑟、沧海、竦峙、雁、洲”）。',
          '【第3步·诗句赏析三步走】①点明手法（比喻/拟人/动静结合/借景抒情）➔ ②描绘画面内容 ➔ ③点出诗人情感。'
        ]
      },
      {
        badge: '题型C · 现代文阅读理解（句子赏析与概括题）',
        signalPrefix: '当设问要求「赏析画线句子的表达效果」「概括文章主要事件或人物形象」时',
        steps: [
          '【第1步·判断赏析角度】看画线句要求从“修辞角度”还是“人物描写/富有表现力的动词形容词角度”赏析。',
          '【第2步·套黄金赏析公式】该句运用了【…修辞/描写】，生动形象地写出了【…事物/人物的…特点】，表达了作者【…之情】。',
          '【第3步·事件概括公式】按照“什么人 + 在什么情况下 + 做了什么事 + 结果如何”精炼概括。'
        ]
      }
    ]
  }
};

function getDefaultSubjectTemplate(subjName) {
  if (SUBJECT_ARCHETYPE_TEMPLATES[subjName]) return SUBJECT_ARCHETYPE_TEMPLATES[subjName];
  return {
    frameworkName: `${subjName}「三步靶向解题法」：审题抓题眼信号 ➔ 调取核心规律/母题模型 ➔ 规范表达与防坑核查`,
    types: [
      {
        badge: '题型A · 核心概念与规律辨析题（选择/判断常考）',
        signalPrefix: '当题干考查基本定义、时空/图表特征或“下列说法正确的是”时',
        steps: [
          '【第1步·抓题眼关键词】圈出题干中的时间、空间、实验条件或限定词（如“根本原因、直接原因、标志”）。',
          '【第2步·对照核心法则】调取本课必背口诀与核心考点，排除绝对化或张冠李戴的干扰项。',
          '【第3步·防坑核对】检查常见易错点，确保概念不混淆。'
        ]
      },
      {
        badge: '题型B · 图表/材料解读与标准应用题',
        signalPrefix: '当题干给出图像、数据表、实验装置或史料文本要求分析时',
        steps: [
          '【第1步·读图读表头】先看图名、坐标轴单位、图例或材料出处，提取显性信息。',
          '【第2步·套用学科公式/规律】将图中变化趋势或材料关键句与教材核心原理一一对应。',
          '【第3步·规范术语作答】使用教材标准专业术语写出结论，避免口语化表达。'
        ]
      },
      {
        badge: '题型C · 综合探究与变式拔高题',
        signalPrefix: '当题干结合新情境、多因素对比或要求综合阐述原因与对策时',
        steps: [
          '【第1步·拆解多问逻辑】把复杂长题干拆解为若干个已知条件，明确每一小问的指向。',
          '【第2步·多角度分点】从内因/外因、自然/人文、原理/应用等多个维度分条列点（①②③）。',
          '【第3步·逆向验证】检查答案是否完整回应了设问的所有小问。'
        ]
      }
    ]
  };
}

function cleanTextForDisplay(str, maxLen) {
  if (!str) return '';
  let s = String(str)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*>#]+\s*/gm, '')
    .trim();
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen) + '…';
  return s;
}

function formatQuizItemSampleAnswer(qi) {
  if (!qi) return '';
  let ans = '';
  if (qi.type === 'TF' || qi.type === 'judge') {
    ans = qi.tfCorrect ? '正确 (√)' : '错误 (×)';
  } else if (Array.isArray(qi.options) && typeof qi.correctIdx === 'number' && qi.options[qi.correctIdx]) {
    const letter = ['A', 'B', 'C', 'D'][qi.correctIdx] || 'A';
    ans = `${letter}（${cleanTextForDisplay(qi.options[qi.correctIdx], 40)}）`;
  } else {
    ans = qi.answer || '见解析';
  }
  const exp = cleanTextForDisplay(qi.explanation, 120);
  return `答案：${ans}${exp ? ' | 解析：' + exp : ''}`;
}

function buildArchetypesForKnowledgePoint(kp, curSubjName) {
  const tpl = getDefaultSubjectTemplate(curSubjName);
  const title = kp.corePoint || kp.title || '核心考点';
  const coreSummary = cleanTextForDisplay(kp.understanding || kp.corePoint, 160) || title;
  const atomicList = Array.isArray(kp.atomicPoints) && kp.atomicPoints.length > 0
    ? kp.atomicPoints.slice(0, 4).map(a => cleanTextForDisplay(a, 95))
    : [coreSummary];

  const mainQ = cleanTextForDisplay(kp.questionMain, 180);
  const varQ = cleanTextForDisplay(kp.questionVariant, 180);
  const ansText = cleanTextForDisplay(kp.answerText, 220);
  const habitWarn = cleanTextForDisplay(kp.habitWarning || kp.errorReason, 140) || '审题时切忌跳步，务必圈出限定词并复核符号/单位。';
  const mnemonic = cleanTextForDisplay(kp.mnemonic, 110) || '抓题眼 ➔ 套法则 ➔ 验边界';
  const quizItems = Array.isArray(kp.quizItems) ? kp.quizItems : [];

  const refSkillLines = (kp.sections && kp.sections.refSkills)
    ? kp.sections.refSkills.split('\n').map(l => cleanTextForDisplay(l, 110)).filter(l => l.length > 6).slice(0, 3)
    : [];

  const q0 = quizItems[0];
  const q1 = quizItems[1] || quizItems[0];
  const q2 = quizItems[quizItems.length - 1] || quizItems[0];

  const archetypes = [
    {
      index: 0,
      badge: tpl.types[0].badge,
      formTitle: `考题形式一：${title} · 概念辨析与防坑排雷`,
      signal: `${tpl.types[0].signalPrefix}；聚焦核心点：「${atomicList[0] || title}」`,
      sopSteps: tpl.types[0].steps,
      sampleQuestion: q0 ? (q0.prompt || q0.q) : (mainQ || `围绕「${title}」基本概念的正误判断与辨析`),
      sampleAnswer: q0 ? formatQuizItemSampleAnswer(q0) : ansText,
      trapRule: habitWarn
    },
    {
      index: 1,
      badge: tpl.types[1].badge,
      formTitle: `考题形式二：${title} · 标准母题模型直接应用`,
      signal: `${tpl.types[1].signalPrefix}；典型母题特征：「${mainQ ? mainQ.slice(0, 55) + '…' : title + '标准求解'}」`,
      sopSteps: refSkillLines.length >= 2 ? refSkillLines : tpl.types[1].steps,
      sampleQuestion: mainQ || (q1 ? (q1.prompt || q1.q) : `标准母题：应用「${title}」核心法则直接求解`),
      sampleAnswer: ansText || (q1 ? formatQuizItemSampleAnswer(q1) : '按固定三步标准格式规范作答'),
      trapRule: `必背口诀：${mnemonic}`
    },
    {
      index: 2,
      badge: tpl.types[2].badge,
      formTitle: `考题形式三：${title} · 变式陷阱与综合拔高`,
      signal: `${tpl.types[2].signalPrefix}；常设陷阱：「${habitWarn.slice(0, 55)}」`,
      sopSteps: tpl.types[2].steps,
      sampleQuestion: varQ || (q2 ? (q2.prompt || q2.q) : `变式拔高：结合多条件限制考查「${title}」的逆向或分类讨论`),
      sampleAnswer: ansText || (q2 ? formatQuizItemSampleAnswer(q2) : '先分类讨论或逆向转化，再代入检验'),
      trapRule: habitWarn
    }
  ];

  return {
    kpId: kp.id,
    title,
    chapter: kp.chapter,
    importance: kp.importance || 4,
    coreSummary,
    atomicList,
    mnemonic,
    habitWarn,
    quizCount: quizItems.length,
    archetypes
  };
}

function normalizeChaptersMap(chaptersInput) {
  const map = {};
  if (Array.isArray(chaptersInput)) {
    chaptersInput.forEach(ch => {
      const name = ch.chapter || ch.key || '综合单元';
      map[name] = Array.isArray(ch.items) ? ch.items : [];
    });
  } else if (chaptersInput && typeof chaptersInput === 'object') {
    Object.keys(chaptersInput).forEach(k => {
      map[k] = Array.isArray(chaptersInput[k]) ? chaptersInput[k] : (chaptersInput[k].items || []);
    });
  }
  return map;
}

function renderUnitArchetypeMatrixHtml(curSubjName, curSem, chaptersInput, lockSingleChapter) {
  const chapters = normalizeChaptersMap(chaptersInput);
  const tpl = getDefaultSubjectTemplate(curSubjName);
  const chapNames = lockSingleChapter
    ? [lockSingleChapter]
    : Object.keys(chapters);

  const selectedUnit = lockSingleChapter || window.ARCHETYPE_STATE.filterUnit || 'ALL';
  const visibleChapNames = (selectedUnit === 'ALL' || !chapters[selectedUnit])
    ? chapNames
    : [selectedUnit];

  let totalCorePoints = 0;
  let totalArchetypeForms = 0;
  let totalDrillQuestions = 0;

  chapNames.forEach(cn => {
    const arr = chapters[cn] || [];
    totalCorePoints += arr.length;
    totalArchetypeForms += arr.length * 3;
    arr.forEach(p => {
      if (!p.isUnverified && !(p.status || '').includes('🔒待精校') && Array.isArray(p.quizItems)) {
        totalDrillQuestions += p.quizItems.length;
      }
    });
  });

  const docTitle = `${curSubjName}（${curSem}${lockSingleChapter ? ' · ' + lockSingleChapter : ''}）单元核心考点·考题形式·固定解题步骤SOP总表`;
  const docSub = `${tpl.frameworkName} | 共 ${totalCorePoints} 个核心考点 · ${totalArchetypeForms} 种固定考题形式`;

  let html = `
    <div id="archetype-matrix-export-root" class="archetype-matrix-wrap">
      <div class="archetype-hero-banner">
        <div class="ahb-top">
          <div>
            <div class="ahb-eyebrow">🧭 核心考点收敛 ➔ 固定考题形式识别 ➔ 固定三步解题套路 SOP ➔ 靶向强化训练</div>
            <h2 class="ahb-title">${curSubjName}（${curSem}${lockSingleChapter ? ' · ' + lockSingleChapter : ''}）考点题型与固定解题方法总表</h2>
            <p class="ahb-sub">💡 <strong>核心理念</strong>：每个单元的核心考点只有几个，每个考点的考题形式只有固定 2~3 种，每种题型的解题步骤也是完全固定的！先认准<strong>「题眼识别信号」</strong>，再按<strong>「固定三步 SOP」</strong>作答，最后点<strong>「⚡ 专练此题型」</strong>强化闭环。</p>
          </div>
          <div class="ahb-actions no-print">
            <button class="zen-btn-sm primary" onclick="printElementContent('archetype-matrix-export-root', '${docTitle.replace(/'/g, "\\'")}', '${docSub.replace(/'/g, "\\'")}')">🖨️ A4 打印本页套路手册</button>
            <button class="zen-btn-sm" onclick="exportElementWord('archetype-matrix-export-root', '${docTitle.replace(/'/g, "\\'")}', '${docSub.replace(/'/g, "\\'")}')">📘 导出 Word (.doc)</button>
            <button class="zen-btn-sm" onclick="exportElementMarkdown('archetype-matrix-export-root', '${docTitle.replace(/'/g, "\\'")}', '${docSub.replace(/'/g, "\\'")}')">⬇️ 导出 Markdown (.md)</button>
          </div>
        </div>

        <div class="ahb-framework-strip">
          <div class="ahb-fw-tag">🛠️ 本科通用破题总纲</div>
          <div class="ahb-fw-text">${tpl.frameworkName}</div>
          <div class="ahb-fw-stats">
            <span>📌 核心考点：<strong>${totalCorePoints}</strong> 个</span>
            <span>🎯 固定题型：<strong>${totalArchetypeForms}</strong> 种</span>
            <span>⚡ 配套强化题：<strong>${totalDrillQuestions}</strong> 道</span>
          </div>
        </div>

        ${!lockSingleChapter ? `
        <div class="ahb-unit-filter no-print">
          <span class="ahb-filter-label">📂 筛选单元：</span>
          <button class="ahb-unit-chip ${selectedUnit === 'ALL' ? 'active' : ''}" onclick="window.ARCHETYPE_STATE.filterUnit='ALL'; renderMacroView();">全部单元 (${chapNames.length})</button>
          ${chapNames.map(cn => `
            <button class="ahb-unit-chip ${selectedUnit === cn ? 'active' : ''}" onclick="window.ARCHETYPE_STATE.filterUnit='${cn.replace(/'/g, "\\'")}'; renderMacroView();">${cn} (${(chapters[cn] || []).length}考点)</button>
          `).join('')}
        </div>
        ` : ''}
      </div>
  `;

  visibleChapNames.forEach((chapName, cIdx) => {
    const kps = chapters[chapName] || [];
    if (kps.length === 0) return;

    const unitDocTitle = `${curSubjName}（${curSem} · ${chapName}）单元考点与固定解题步骤手册`;
    const unitBoxId = `archetype-unit-box-${cIdx}`;
    const safeChap = chapName.replace(/'/g, "\\'");

    html += `
      <div id="${unitBoxId}" class="archetype-unit-block">
        <div class="aub-header">
          <div class="aub-title-wrap">
            <span class="aub-unit-badge">第 ${cIdx + 1} 单元模块</span>
            <h3 class="aub-unit-title">${chapName}</h3>
            <span class="aub-unit-meta">本单元浓缩为 <strong>${kps.length}</strong> 个核心考点 · <strong>${kps.length * 3}</strong> 种固定考题形式</span>
          </div>
          <div class="aub-unit-btns no-print">
            <button class="zen-btn-sm primary" onclick="launchUnitArchetypeDrill('${safeChap}')">⚡ 本单元题型综合强化</button>
            <button class="zen-btn-sm" onclick="printElementContent('${unitBoxId}', '${unitDocTitle.replace(/'/g, "\\'")}', '单元核心考点 ➔ 固定考题形式 ➔ 固定三步解题 SOP')">🖨️ 单独打印本单元</button>
            <button class="zen-btn-sm" onclick="openUnitPaperGenerator('${curSubjName}', '${curSem}', '${safeChap}')">📄 生成本单元标准试卷</button>
          </div>
        </div>

        <div class="aub-core-summary-bar">
          <strong>🎯 本单元必拿分核心考点清单：</strong>
          ${kps.map((p, idx) => `<span class="aub-kp-pill">${idx + 1}. ${p.corePoint || p.title}</span>`).join('')}
        </div>

        <div class="aub-kp-list">
    `;

    kps.forEach((kp, kIdx) => {
      const model = buildArchetypesForKnowledgePoint(kp, curSubjName);
      html += `
        <div class="archetype-kp-card">
          <div class="akp-header">
            <div class="akp-left">
              <span class="akp-num">核心考点 ${kIdx + 1}</span>
              <h4 class="akp-title">${model.title}</h4>
              <span class="akp-stars">${'★'.repeat(model.importance)}</span>
            </div>
            <div class="akp-right no-print">
              <button class="zen-btn-sm" onclick="openMicroDrawer('${kp.id}')">📖 查看精讲讲义</button>
              ${(kp.isUnverified || (kp.status || '').includes('🔒待精校') || model.quizCount === 0)
                ? `<button class="zen-btn-sm" style="opacity:0.65;cursor:not-allowed;" onclick="if(typeof showToast==='function')showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关')">🔒 待精校 (0题)</button>`
                : `<button class="zen-btn-sm primary" onclick="launchArchetypeTargetedDrill('${kp.id}', -1)">⚡ 强化本考点全部题型 (${model.quizCount}题)</button>`}
            </div>
          </div>

          <div class="akp-core-strip">
            <div class="akp-core-item"><strong>📌 考点本质与必背结论：</strong>${model.coreSummary}</div>
            <div class="akp-core-meta">
              <span class="akp-mnemonic-tag">💡 记忆口诀：${model.mnemonic}</span>
              <span class="akp-trap-tag">⚠️ 高频易错防坑：${model.habitWarn}</span>
            </div>
          </div>

          <table class="archetype-sop-table">
            <thead>
              <tr>
                <th style="width:18%;">固定考题形式 (题型)</th>
                <th style="width:22%;">🔍 题眼识别信号 (怎么认题)</th>
                <th style="width:34%;">🛠️ 固定解题方法与步骤 SOP (怎么破题)</th>
                <th style="width:26%;">📝 典型母题示例 & 靶向专练</th>
              </tr>
            </thead>
            <tbody>
              ${model.archetypes.map(arch => `
                <tr>
                  <td>
                    <div class="arch-badge-pill type-${arch.index}">${arch.badge}</div>
                    <div class="arch-form-name">${arch.formTitle}</div>
                  </td>
                  <td>
                    <div class="arch-signal-box">
                      <strong>识别特征：</strong>${arch.signal}
                    </div>
                  </td>
                  <td>
                    <div class="sop-step-list">
                      ${arch.sopSteps.map(step => `<div class="sop-step-box">${step}</div>`).join('')}
                    </div>
                    <div class="arch-trap-inline">🛡️ <strong>防坑铁律：</strong>${arch.trapRule}</div>
                  </td>
                  <td>
                    <div class="arch-sample-q"><strong>【例】</strong>${arch.sampleQuestion}</div>
                    <div class="arch-sample-a">${arch.sampleAnswer}</div>
                    <div class="arch-drill-btn-wrap no-print">
                      ${(kp.isUnverified || (kp.status || '').includes('🔒待精校') || model.quizCount === 0)
                        ? `<button class="zen-btn-sm" style="opacity:0.65;cursor:not-allowed;" onclick="if(typeof showToast==='function')showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关')">🔒 待精校</button>`
                        : `<button class="zen-btn-sm primary" onclick="launchArchetypeTargetedDrill('${kp.id}', ${arch.index})">⚡ 专练此题型</button>`}
                      <button class="zen-btn-sm" onclick="openAddQuestionForPoint('${kp.id}', ${arch.index})">➕ 补充同类题</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

function openQuizQueueWithSopBanner(queue, subjName, semCode, bannerTitle, bannerSop) {
  if (!queue || queue.length === 0) return;
  if (typeof playCommercialSound === 'function') playCommercialSound('open');

  window.ARCHETYPE_STATE.activeSopBanner = `
    <div class="quiz-sop-coach-banner">
      <div style="font-weight:800; color:#3730a3; margin-bottom:4px;">🧭 题型靶向训练 · 固定解题方法 SOP 实时指导：${bannerTitle}</div>
      <div style="font-size:13px; color:#1e293b; line-height:1.55;">${bannerSop}</div>
    </div>
  `;

  STATE.quiz.semester = semCode || STATE.stageFocus || '初一上';
  STATE.quiz.subject = subjName || STATE.homeSelectedSubject || '数学';
  STATE.quiz.studyStyle = 'quest';
  STATE.quiz.rapidFormat = 'MIXED';
  STATE.quiz.sourceContext = { type: 'ARCHETYPE', pool: queue.slice() };
  STATE.quiz.queue = queue;
  STATE.quiz.currentIndex = 0;
  STATE.quiz.selectedChoiceIdx = null;
  STATE.quiz.choiceSubmitted = false;
  STATE.quiz.choiceIsCorrect = null;
  STATE.quiz.answerRevealed = false;
  STATE.quiz.results = [];
  STATE.quiz.finished = false;
  STATE.quiz.isOpen = true;

  const modal = document.getElementById('quizModalBackdrop');
  if (modal) modal.classList.add('open');
  if (typeof startQuizStopwatch === 'function') startQuizStopwatch();
  if (typeof renderQuizModal === 'function') renderQuizModal();
  injectSopBannerIntoQuizModal();
}

function injectSopBannerIntoQuizModal() {
  if (!window.ARCHETYPE_STATE.activeSopBanner) return;
  const contentEl = document.getElementById('quizModalContent');
  if (!contentEl) return;
  if (!contentEl.querySelector('.quiz-sop-coach-banner')) {
    contentEl.insertAdjacentHTML('afterbegin', window.ARCHETYPE_STATE.activeSopBanner);
  }
}

function launchArchetypeTargetedDrill(kpId, archetypeIndex) {
  if (typeof STATE === 'undefined' || !STATE.data) return;
  const kp = STATE.data.knowledgePoints.find(p => p.id === kpId);
  if (!kp) return;
  if (kp.isUnverified || (kp.status || '').includes('🔒待精校')) {
    if (typeof showToast === 'function') {
      showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关');
    }
    return;
  }

  const model = buildArchetypesForKnowledgePoint(kp, kp.subject);
  const allQuiz = Array.isArray(kp.quizItems) ? kp.quizItems : [];
  if (allQuiz.length === 0) {
    if (typeof showToast === 'function') {
      showToast('🔒 本课属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关');
    }
    return;
  }

  let selectedItems = allQuiz;
  let activeArch = null;

  if (archetypeIndex >= 0 && model.archetypes[archetypeIndex]) {
    activeArch = model.archetypes[archetypeIndex];
    if (archetypeIndex === 0) {
      const tfs = allQuiz.filter(q => q.type === 'TF' || /正确|错误|说法|概念|属于/.test(q.prompt || q.q || ''));
      selectedItems = tfs.length >= 3 ? tfs.slice(0, 6) : allQuiz.slice(0, Math.min(5, allQuiz.length));
    } else if (archetypeIndex === 1) {
      const choices = allQuiz.filter(q => q.type === 'CHOICE');
      selectedItems = choices.length >= 4 ? choices.slice(0, 6) : allQuiz.slice(0, Math.min(6, allQuiz.length));
    } else {
      const hard = allQuiz.filter(q => q.isCustom || /若|已知|范围|分类|综合|不一定|相等/.test(q.prompt || q.q || ''));
      selectedItems = hard.length >= 3 ? hard.slice(0, 6) : allQuiz.slice(-Math.min(6, allQuiz.length));
    }
  }

  const queue = selectedItems.map((qi, idx) => ({
    ...kp,
    _subQIndex: idx,
    _subQuizItem: {
      type: qi.type === 'TF' ? 'TF' : 'CHOICE',
      prompt: qi.prompt || qi.q,
      options: qi.options || ['选项A', '选项B', '选项C', '选项D'],
      correctIdx: typeof qi.correctIdx === 'number' ? qi.correctIdx : 0,
      tfCorrect: qi.tfCorrect !== undefined ? qi.tfCorrect : true,
      explanation: `${activeArch ? '【固定步骤：' + activeArch.sopSteps.join(' ➔ ') + '】 ' : ''}${qi.explanation || ''}`
    }
  }));

  const bannerTitle = activeArch ? activeArch.formTitle : `${model.title} · 全部题型综合强化`;
  const bannerSop = activeArch
    ? `${activeArch.sopSteps.join(' ➔ ')} | 🛡️ ${activeArch.trapRule}`
    : `口诀：${model.mnemonic} | 防坑：${model.habitWarn}`;

  openQuizQueueWithSopBanner(queue, kp.subject, kp.semester, bannerTitle, bannerSop);
}

function launchUnitArchetypeDrill(chapName) {
  if (typeof STATE === 'undefined' || !STATE.data) return;
  const curSubj = STATE.homeSelectedSubject || '数学';
  const curSem = STATE.stageFocus === 'ALL' ? '初一上' : STATE.stageFocus;
  const kps = STATE.data.knowledgePoints.filter(p => p.subject === curSubj && p.semester === curSem && p.chapter === chapName && !p.isUnverified && !(p.status || '').includes('🔒待精校'));
  if (kps.length === 0) {
    if (typeof showToast === 'function') {
      showToast('🔒 本单元属于高年级待精校预习章节，当前仅开放讲义浏览，暂不开放刷题闯关');
    }
    return;
  }

  const queue = [];
  kps.forEach(kp => {
    const model = buildArchetypesForKnowledgePoint(kp, curSubj);
    (kp.quizItems || []).slice(0, 3).forEach((qi, idx) => {
      const arch = model.archetypes[idx % model.archetypes.length];
      queue.push({
        ...kp,
        _subQIndex: idx,
        _subQuizItem: {
          type: qi.type === 'TF' ? 'TF' : 'CHOICE',
          prompt: qi.prompt || qi.q,
          options: qi.options || ['选项A', '选项B', '选项C', '选项D'],
          correctIdx: typeof qi.correctIdx === 'number' ? qi.correctIdx : 0,
          tfCorrect: qi.tfCorrect !== undefined ? qi.tfCorrect : true,
          explanation: `【${arch.badge}】${arch.sopSteps.join(' ➔ ')} | ${qi.explanation || ''}`
        }
      });
    });
  });

  if (queue.length === 0) return;
  queue.sort(() => Math.random() - 0.5);
  openQuizQueueWithSopBanner(
    queue.slice(0, 10),
    curSubj,
    curSem,
    `${chapName} · 单元全题型综合强化`,
    getDefaultSubjectTemplate(curSubj).frameworkName
  );
}

// =========================================================================
// PART 3: 可添加题库管理、检索与多模式打印导出中心 (#view-qbank)
// =========================================================================

function formatAnswerFromRawItem(item) {
  if (item.type === 'TF') {
    return item.tfCorrect ? '正确 (√)' : '错误 (×)';
  }
  if (item.type === 'CHOICE' && Array.isArray(item.options)) {
    const idx = typeof item.correctIdx === 'number' ? item.correctIdx : 0;
    const letter = ['A', 'B', 'C', 'D'][idx] || 'A';
    const optText = item.options[idx] ? String(item.options[idx]).replace(/^[A-D][.、．\s]+/, '') : '';
    return `${letter}${optText ? '（' + optText + '）' : ''}`;
  }
  return item.answerText || item.answer || '见步骤解析';
}

function getAllUnifiedQuestions() {
  const customList = (typeof STATE !== 'undefined' && STATE.data && Array.isArray(STATE.data.customQuestions))
    ? STATE.data.customQuestions
    : [];

  const unified = [];
  const seenIds = new Set();

  customList.forEach(cq => {
    seenIds.add(cq.id);
    const normType = (cq.type || 'CHOICE').toUpperCase();
    unified.push({
      id: cq.id,
      isCustom: true,
      subject: cq.subject || '数学',
      semester: cq.semester || '初一上',
      chapter: cq.chapter || '第一单元',
      pointTitle: cq.corePoint || cq.pointTitle || '核心考点',
      archetype: cq.archetype || '核心题型演练',
      type: normType,
      q: cq.prompt || cq.q || '',
      options: Array.isArray(cq.options) ? cq.options : [],
      correctIdx: typeof cq.correctIdx === 'number' ? cq.correctIdx : 0,
      tfCorrect: cq.tfCorrect !== undefined ? Boolean(cq.tfCorrect) : true,
      answer: formatAnswerFromRawItem({ ...cq, type: normType }),
      solutionSteps: cq.solutionSteps || '',
      explanation: cq.explanation || '',
      createdAt: cq.createdAt || ''
    });
  });

  if (window.QBANK_STATE.sourceFilter !== 'CUSTOM_ONLY' && typeof STATE !== 'undefined' && STATE.data && Array.isArray(STATE.data.knowledgePoints)) {
    STATE.data.knowledgePoints.forEach(kp => {
      const tpl = getDefaultSubjectTemplate(kp.subject);
      (kp.quizItems || []).forEach((qi, idx) => {
        if (qi.isCustom && qi.customId && seenIds.has(qi.customId)) return;
        const archType = tpl.types[idx % tpl.types.length];
        const normType = (qi.type || 'CHOICE').toUpperCase();
        unified.push({
          id: `${kp.id}_q_${idx}`,
          pointId: kp.id,
          kpRef: kp,
          isCustom: Boolean(qi.isCustom),
          subject: kp.subject,
          semester: kp.semester,
          chapter: kp.chapter,
          pointTitle: kp.corePoint || kp.title,
          archetype: qi.archetype || archType.badge,
          type: normType,
          q: qi.prompt || qi.q || '',
          options: Array.isArray(qi.options) ? qi.options : [],
          correctIdx: typeof qi.correctIdx === 'number' ? qi.correctIdx : 0,
          tfCorrect: qi.tfCorrect !== undefined ? Boolean(qi.tfCorrect) : true,
          answer: formatAnswerFromRawItem({ ...qi, type: normType }),
          solutionSteps: qi.solutionSteps || archType.steps.join('\n'),
          explanation: qi.explanation || kp.mnemonic || ''
        });
      });
    });
  }

  return unified;
}

function getFilteredQuestionsForQBank() {
  const st = window.QBANK_STATE;
  const all = getAllUnifiedQuestions();
  const kw = (st.keyword || '').trim().toLowerCase();

  return all.filter(item => {
    if (st.sourceFilter === 'CUSTOM_ONLY' && !item.isCustom) return false;
    if (st.subject !== 'ALL' && item.subject !== st.subject) return false;
    if (st.semester !== 'ALL' && item.semester !== st.semester) return false;
    if (st.chapter !== 'ALL' && item.chapter !== st.chapter) return false;
    if (st.type !== 'ALL' && item.type !== st.type) return false;
    if (kw) {
      const hay = `${item.q} ${item.pointTitle} ${item.chapter} ${item.archetype} ${item.explanation} ${item.solutionSteps}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function openAddQuestionForPoint(kpId, archIdx) {
  if (typeof STATE === 'undefined' || !STATE.data) return;
  const kp = STATE.data.knowledgePoints.find(p => p.id === kpId);
  if (!kp) return;
  const model = buildArchetypesForKnowledgePoint(kp, kp.subject);
  const arch = (archIdx >= 0 && model.archetypes[archIdx]) ? model.archetypes[archIdx] : model.archetypes[0];

  window.QBANK_STATE.subject = kp.subject;
  window.QBANK_STATE.semester = kp.semester;
  window.QBANK_STATE.chapter = kp.chapter;
  window.QBANK_STATE.showAddDrawer = true;
  window.QBANK_STATE.prefill = {
    kpId: kp.id,
    subject: kp.subject,
    semester: kp.semester,
    chapter: kp.chapter,
    pointTitle: kp.corePoint || kp.title,
    archetype: arch.badge,
    solutionSteps: arch.sopSteps.join('\n')
  };

  if (typeof switchTab === 'function') switchTab('qbank');
}

function renderCustomQBankView() {
  const container = document.getElementById('view-qbank');
  if (!container || typeof STATE === 'undefined' || !STATE.data) return;

  const st = window.QBANK_STATE;
  const customCount = Array.isArray(STATE.data.customQuestions) ? STATE.data.customQuestions.length : 0;
  const totalUnifiedCount = getAllUnifiedQuestions().length;
  const allFiltered = getFilteredQuestionsForQBank();
  const displayList = allFiltered.slice(0, st.limitCount || 30);

  const allKps = STATE.data.knowledgePoints || [];
  const subjList = ['数学', '英语', '语文', '生物', '道法', '历史', '地理', '物理', '化学'];
  const semSet = new Set();
  const chapSet = new Set();
  allKps.forEach(p => {
    if (st.subject === 'ALL' || p.subject === st.subject) {
      semSet.add(p.semester);
      if (st.semester === 'ALL' || p.semester === st.semester) chapSet.add(p.chapter);
    }
  });
  (STATE.data.customQuestions || []).forEach(cq => {
    if (st.subject === 'ALL' || cq.subject === st.subject) {
      if (cq.semester) semSet.add(cq.semester);
      if (st.semester === 'ALL' || cq.semester === st.semester) {
        if (cq.chapter) chapSet.add(cq.chapter);
      }
    }
  });

  const pre = st.prefill || {
    subject: st.subject === 'ALL' ? (STATE.homeSelectedSubject || '数学') : st.subject,
    semester: st.semester === 'ALL' ? (STATE.stageFocus === 'ALL' ? '初一上' : STATE.stageFocus) : st.semester,
    chapter: st.chapter === 'ALL' ? '' : st.chapter,
    pointTitle: '',
    archetype: '题型B · 标准母题模型应用',
    solutionSteps: '1. 审题圈出关键词与限制条件；\n2. 代入对应公式或核心法则求解；\n3. 逆向验证符号与边界。'
  };

  const typeLabelMap = { CHOICE: '🟢 单项选择题', TF: '🟡 判断正误题', SUBJECTIVE: '🟣 主观填空/解答题' };

  container.innerHTML = `
    <div class="qbank-studio-wrap">
      <div class="qbank-hero-header">
        <div>
          <div class="ahb-eyebrow">📚 可添加扩充 · 全科统一检索 · 带固定解题步骤打印导出 · 自动融入单元组卷</div>
          <h2 class="ahb-title">若婷专属全科可添加题库 & 打印中心</h2>
          <p class="ahb-sub">支持随时录入<strong>学校周测好题、老师补充母题、考前押题或错题变式</strong>（自动同步写入 Obsidian 笔记并融入「🖨️ 组卷打印」）。当前已收录自定义扩充题 <strong>${customCount}</strong> 道，系统总题库 <strong>${totalUnifiedCount.toLocaleString()}</strong> 道。</p>
        </div>
        <div class="qbank-top-btns no-print">
          <button class="zen-btn-sm primary" onclick="window.QBANK_STATE.showAddDrawer = !window.QBANK_STATE.showAddDrawer; renderCustomQBankView();">
            ${st.showAddDrawer ? '🔼 收起录题面板' : '➕ 添加新题 (单题录入)'}
          </button>
          <button class="zen-btn-sm" style="background:#eef2ff;color:#4338ca;border-color:#c7d2fe;font-weight:700;" onclick="window.QBANK_STATE.showBatchModal = !window.QBANK_STATE.showBatchModal; renderCustomQBankView();">
            📋 批量粘贴智能导入
          </button>
          <button class="zen-btn-sm" onclick="practiceFilteredQBankOnline()">⚡ 在线刷当前筛选题 (${Math.min(allFiltered.length, 12)}题)</button>
          <button class="zen-btn-sm primary" onclick="printFilteredQBank(window.QBANK_STATE.printAnswerMode)">🖨️ A4 打印当前题库 (${displayList.length}题)</button>
          <button class="zen-btn-sm" onclick="exportFilteredQBankWord(window.QBANK_STATE.printAnswerMode)">📘 导出 Word (.doc)</button>
          <button class="zen-btn-sm" onclick="exportFilteredQBankMd()">⬇️ 导出 Markdown (.md)</button>
        </div>
      </div>

      ${st.showAddDrawer ? renderAddQuestionDrawerHtml(pre, subjList) : ''}
      ${st.showBatchModal ? renderBatchImportDrawerHtml(pre, subjList) : ''}

      <div class="qbank-filter-bar no-print">
        <div class="qfb-row">
          <div class="qfb-group">
            <label>题源范围</label>
            <select onchange="window.QBANK_STATE.sourceFilter=this.value; renderCustomQBankView();">
              <option value="CUSTOM_FIRST" ${st.sourceFilter === 'CUSTOM_FIRST' ? 'selected' : ''}>🌟 自定义题置顶 + 系统全库</option>
              <option value="CUSTOM_ONLY" ${st.sourceFilter === 'CUSTOM_ONLY' ? 'selected' : ''}>⭐ 仅看我添加的自定义题 (${customCount}道)</option>
              <option value="ALL" ${st.sourceFilter === 'ALL' ? 'selected' : ''}>📚 全部合并题库</option>
            </select>
          </div>
          <div class="qfb-group">
            <label>学科</label>
            <select onchange="window.QBANK_STATE.subject=this.value; window.QBANK_STATE.semester='ALL'; window.QBANK_STATE.chapter='ALL'; renderCustomQBankView();">
              <option value="ALL" ${st.subject === 'ALL' ? 'selected' : ''}>全部九科</option>
              ${subjList.map(s => `<option value="${s}" ${st.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="qfb-group">
            <label>学期</label>
            <select onchange="window.QBANK_STATE.semester=this.value; window.QBANK_STATE.chapter='ALL'; renderCustomQBankView();">
              <option value="ALL" ${st.semester === 'ALL' ? 'selected' : ''}>全部学期</option>
              ${Array.from(semSet).map(s => `<option value="${s}" ${st.semester === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="qfb-group">
            <label>单元/章节</label>
            <select onchange="window.QBANK_STATE.chapter=this.value; renderCustomQBankView();">
              <option value="ALL" ${st.chapter === 'ALL' ? 'selected' : ''}>全部单元</option>
              ${Array.from(chapSet).map(c => `<option value="${c}" ${st.chapter === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="qfb-group">
            <label>题型</label>
            <select onchange="window.QBANK_STATE.type=this.value; renderCustomQBankView();">
              <option value="ALL" ${st.type === 'ALL' ? 'selected' : ''}>全部题型</option>
              <option value="CHOICE" ${st.type === 'CHOICE' ? 'selected' : ''}>单项选择题</option>
              <option value="TF" ${st.type === 'TF' ? 'selected' : ''}>判断正误题</option>
              <option value="SUBJECTIVE" ${st.type === 'SUBJECTIVE' ? 'selected' : ''}>主观填空/解答题</option>
            </select>
          </div>
          <div class="qfb-group">
            <label>🖨️ 打印/导出排版模式</label>
            <select onchange="window.QBANK_STATE.printAnswerMode=this.value; renderCustomQBankView();">
              <option value="end" ${st.printAnswerMode === 'end' ? 'selected' : ''}>📄 练习测试卷（题干留白 + 卷末附答案与步骤）</option>
              <option value="inline" ${st.printAnswerMode === 'inline' ? 'selected' : ''}>📖 讲义背诵版（每题紧跟答案 + 固定解题步骤 SOP）</option>
              <option value="none" ${st.printAnswerMode === 'none' ? 'selected' : ''}>📝 纯空白考卷（不含答案）</option>
            </select>
          </div>
          <div class="qfb-group" style="flex:1; min-width:180px;">
            <label>🔍 关键词搜索（题干/考点/题型/步骤）</label>
            <input type="text" value="${(st.keyword || '').replace(/"/g, '&quot;')}" placeholder="输入如：绝对值、显微镜、代词、诚信..." oninput="window.QBANK_STATE.keyword=this.value; renderCustomQBankView();" />
          </div>
        </div>
        <div class="qfb-summary-line">
          <span>📊 当前筛选匹配：<strong>${allFiltered.length}</strong> 道题（本页展示前 <strong>${displayList.length}</strong> 道）</span>
          <div style="display:flex; gap:8px;">
            ${allFiltered.length > displayList.length ? `<button class="zen-btn-sm" onclick="window.QBANK_STATE.limitCount += 30; renderCustomQBankView();">➕ 加载更多题目 (+30道)</button>` : ''}
            <button class="zen-btn-sm" onclick="window.QBANK_STATE.subject='ALL'; window.QBANK_STATE.semester='ALL'; window.QBANK_STATE.chapter='ALL'; window.QBANK_STATE.type='ALL'; window.QBANK_STATE.keyword=''; renderCustomQBankView();">🔄 重置筛选</button>
          </div>
        </div>
      </div>

      <div id="qbank-printable-list" class="qbank-cards-grid">
        ${displayList.length === 0 ? `
          <div class="qbank-empty-box">
            <div style="font-size:36px; margin-bottom:8px;">📭</div>
            <h3>当前筛选条件下暂无题目</h3>
            <p>你可以点击上方「➕ 添加新题」录入新题，或点击「🔄 重置筛选」查看全部题库。</p>
          </div>
        ` : displayList.map((item, idx) => `
          <div class="qbank-item-card ${item.isCustom ? 'is-custom-card' : ''}">
            <div class="qic-header">
              <div class="qic-badges">
                <span class="qic-num">#${idx + 1}</span>
                ${item.isCustom ? `<span class="qic-custom-tag">🌟 自定义扩充题</span>` : `<span class="qic-sys-tag">📚 系统题库</span>`}
                <span class="qic-meta-tag">${item.subject} · ${item.semester} · ${item.chapter}</span>
                <span class="qic-point-tag">🎯 考点：${item.pointTitle}</span>
                <span class="qic-arch-tag">🧭 ${item.archetype}</span>
                <span class="qic-type-tag">${typeLabelMap[item.type] || '综合题'}</span>
              </div>
              <div class="qic-actions no-print">
                ${item.isCustom ? `<button class="zen-btn-sm" style="color:#dc2626;border-color:#fecaca;" onclick="deleteCustomQuestionById('${item.id}')">🗑️ 删除</button>` : ''}
              </div>
            </div>

            <div class="qic-stem">${item.q}</div>

            ${item.type === 'CHOICE' && item.options && item.options.length > 0 ? `
              <div class="qic-options">
                ${item.options.map((opt, oIdx) => {
                  const prefix = /^[A-D][.、．\s]/.test(opt) ? '' : `${['A', 'B', 'C', 'D'][oIdx] || 'A'}. `;
                  return `<div class="qic-opt-item">${prefix}${opt}</div>`;
                }).join('')}
              </div>
            ` : ''}

            ${item.type === 'TF' ? `
              <div class="qic-options">
                <div class="qic-opt-item">A. 正确 (√)</div>
                <div class="qic-opt-item">B. 错误 (×)</div>
              </div>
            ` : ''}

            <div class="qic-solution-box">
              <div class="qic-ans-line"><strong>✅ 标准答案：</strong><span class="qic-ans-val">${item.answer}</span></div>
              ${item.solutionSteps ? `<div class="qic-sop-line"><strong>🛠️ 固定解题方法与步骤 SOP：</strong><div class="qic-sop-pre">${item.solutionSteps.replace(/\n/g, '<br>')}</div></div>` : ''}
              ${item.explanation ? `<div class="qic-exp-line"><strong>💡 解析与防坑提醒：</strong>${item.explanation}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  if (typeof renderMathInContainer === 'function') renderMathInContainer(container);
}

function renderAddQuestionDrawerHtml(pre, subjList) {
  return `
    <div class="qbank-add-drawer no-print">
      <div class="qad-title-row">
        <h3>➕ 录入新题目到若婷专属题库（自动同步 Obsidian 笔记 & 单元组卷池）</h3>
        <button class="zen-btn-sm" onclick="window.QBANK_STATE.showAddDrawer=false; renderCustomQBankView();">✖ 关闭</button>
      </div>
      <div class="qad-form-grid">
        <div class="qad-field">
          <label>学科</label>
          <select id="nq-subject">
            ${subjList.map(s => `<option value="${s}" ${pre.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="qad-field">
          <label>学期（如 初一上/初二下）</label>
          <input id="nq-semester" type="text" value="${pre.semester || '初一上'}" />
        </div>
        <div class="qad-field">
          <label>所属单元/章节</label>
          <input id="nq-chapter" type="text" value="${pre.chapter || ''}" placeholder="如：第二章 有理数及其运算" />
        </div>
        <div class="qad-field">
          <label>核心考点名称</label>
          <input id="nq-point" type="text" value="${pre.pointTitle || ''}" placeholder="如：绝对值非负性 (0+0=0模型)" />
        </div>
        <div class="qad-field">
          <label>考题形式 (题型归类)</label>
          <input id="nq-archetype" type="text" value="${pre.archetype || '题型B · 标准母题模型应用'}" placeholder="如：题型C · 非负性综合变式题" />
        </div>
        <div class="qad-field">
          <label>题目类型</label>
          <select id="nq-type" onchange="document.getElementById('nq-options-wrap').style.display = (this.value === 'CHOICE' ? 'block' : 'none');">
            <option value="CHOICE">🟢 单项选择题</option>
            <option value="TF">🟡 判断正误题</option>
            <option value="SUBJECTIVE">🟣 主观填空 / 解答题</option>
          </select>
        </div>
      </div>

      <div class="qad-field-full">
        <label>📝 题干内容（必填）</label>
        <textarea id="nq-stem" rows="2" placeholder="输入题目完整题干，例如：若 |a - 3| + (b + 2)² = 0，则 (a + b)^2025 的值为（  ）"></textarea>
      </div>

      <div id="nq-options-wrap" class="qad-field-full">
        <label>🔢 选项设置（分别填写 A/B/C/D 四个选项内容）</label>
        <div class="qad-opt-grid">
          <input id="nq-opt-a" type="text" placeholder="选项 A 内容（如：1）" />
          <input id="nq-opt-b" type="text" placeholder="选项 B 内容（如：-1）" />
          <input id="nq-opt-c" type="text" placeholder="选项 C 内容（如：5）" />
          <input id="nq-opt-d" type="text" placeholder="选项 D 内容（如：-5）" />
        </div>
      </div>

      <div class="qad-form-grid" style="margin-top:10px;">
        <div class="qad-field">
          <label>✅ 标准答案（必填：选择填 A/B/C/D，判断填 正确/错误，主观题直接写答案）</label>
          <input id="nq-answer" type="text" placeholder="如：A 或 正确 或 x = 5" />
        </div>
        <div class="qad-field">
          <label>🛠️ 固定解题方法与步骤 SOP（推荐填写，打印讲义与刷题时自动提示！）</label>
          <textarea id="nq-steps" rows="2">${pre.solutionSteps || ''}</textarea>
        </div>
        <div class="qad-field">
          <label>💡 详细解析与防坑提醒</label>
          <textarea id="nq-exp" rows="2" placeholder="写出具体推导过程及若婷容易踩坑的注意点..."></textarea>
        </div>
      </div>

      <div class="qad-submit-row">
        <button class="zen-btn-sm primary" style="padding:10px 24px; font-size:14px;" onclick="submitNewCustomQuestion()">💾 立即保存到题库并同步笔记</button>
      </div>
    </div>
  `;
}

function renderBatchImportDrawerHtml(pre, subjList) {
  return `
    <div class="qbank-add-drawer no-print" style="border-color:#818cf8; background:#f5f3ff;">
      <div class="qad-title-row">
        <h3>📋 批量粘贴文本智能解析导入（支持一次粘贴多道选择/判断/主观题）</h3>
        <button class="zen-btn-sm" onclick="window.QBANK_STATE.showBatchModal=false; renderCustomQBankView();">✖ 关闭</button>
      </div>
      <div class="qad-form-grid">
        <div class="qad-field">
          <label>归属学科</label>
          <select id="bq-subject">
            ${subjList.map(s => `<option value="${s}" ${pre.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="qad-field">
          <label>归属学期</label>
          <input id="bq-semester" type="text" value="${pre.semester || '初一上'}" />
        </div>
        <div class="qad-field">
          <label>归属单元/章节</label>
          <input id="bq-chapter" type="text" value="${pre.chapter || '第一单元'}" />
        </div>
        <div class="qad-field">
          <label>归属核心考点</label>
          <input id="bq-point" type="text" value="${pre.pointTitle || '单元核心考点'}" />
        </div>
      </div>
      <div class="qad-field-full" style="margin-top:10px;">
        <label>📄 粘贴题目文本（不同题目之间空一行即可；支持含 A. B. C. D. 选项、「答案：X」「步骤：...」「解析：...」格式）</label>
        <textarea id="bq-raw-text" rows="7" placeholder="示例格式（题与题之间空一行）：
1. 已知 |x| = 4，|y| = 2，且 x < y，则 x + y 的值为（  ）
A. -2 或 -6
B. 2 或 6
C. -2
D. -6
答案：A
步骤：第1步：由绝对值定义得 x=±4, y=±2；第2步：结合限制条件 x<y 筛选得 x=-4, y=2 或 x=-4, y=-2；第3步：分别相加得 -2 或 -6。
解析：切忌漏掉 y=-2 的情况！"></textarea>
      </div>
      <div class="qad-submit-row">
        <button class="zen-btn-sm primary" style="padding:10px 24px; font-size:14px;" onclick="submitBatchParsedQuestions()">🚀 智能解析并批量入库</button>
      </div>
    </div>
  `;
}

async function submitNewCustomQuestion() {
  const subject = document.getElementById('nq-subject').value;
  const semester = document.getElementById('nq-semester').value.trim() || '初一上';
  const chapter = document.getElementById('nq-chapter').value.trim() || '第一单元';
  const corePoint = document.getElementById('nq-point').value.trim() || '核心考点';
  const archetype = document.getElementById('nq-archetype').value.trim() || '核心题型';
  const type = document.getElementById('nq-type').value;
  const prompt = document.getElementById('nq-stem').value.trim();
  const rawAns = document.getElementById('nq-answer').value.trim();
  const solutionSteps = document.getElementById('nq-steps').value.trim();
  const explanation = document.getElementById('nq-exp').value.trim();

  if (!prompt) {
    if (typeof showToast === 'function') showToast('⚠️ 请填写题干内容！');
    return;
  }

  let options = [];
  let correctIdx = 0;
  let tfCorrect = true;
  let answerText = rawAns;

  if (type === 'CHOICE') {
    const oa = document.getElementById('nq-opt-a').value.trim().replace(/^[A-D][.、．\s]+/i, '') || '选项A';
    const ob = document.getElementById('nq-opt-b').value.trim().replace(/^[A-D][.、．\s]+/i, '') || '选项B';
    const oc = document.getElementById('nq-opt-c').value.trim().replace(/^[A-D][.、．\s]+/i, '') || '选项C';
    const od = document.getElementById('nq-opt-d').value.trim().replace(/^[A-D][.、．\s]+/i, '') || '选项D';
    options = [oa, ob, oc, od];
    const m = rawAns.toUpperCase().match(/[A-D]/);
    correctIdx = m ? { A: 0, B: 1, C: 2, D: 3 }[m[0]] : 0;
  } else if (type === 'TF') {
    tfCorrect = !/^(错误|错|×|F|false|B|0)$/i.test(rawAns);
  }

  try {
    const res = await fetch('/api/custom-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          subject, semester, chapter, corePoint, archetype, type,
          prompt, options, correctIdx, tfCorrect, answerText, solutionSteps, explanation
        }]
      })
    });
    const data = await res.json();
    if (data.ok || data.success) {
      if (typeof showToast === 'function') showToast(`✅ 成功添加新题！当前共 ${data.count || ''} 道自定义好题`);
      window.QBANK_STATE.showAddDrawer = false;
      const freshRes = await fetch('/api/data?refresh=1');
      STATE.data = await freshRes.json();
      renderCustomQBankView();
    }
  } catch (err) {
    console.error(err);
    if (typeof showToast === 'function') showToast('❌ 保存失败，请检查服务连接');
  }
}

async function submitBatchParsedQuestions() {
  const subject = document.getElementById('bq-subject').value;
  const semester = document.getElementById('bq-semester').value.trim() || '初一上';
  const chapter = document.getElementById('bq-chapter').value.trim() || '第一单元';
  const corePoint = document.getElementById('bq-point').value.trim() || '核心考点';
  const raw = document.getElementById('bq-raw-text').value.trim();

  if (!raw) {
    if (typeof showToast === 'function') showToast('⚠️ 请先粘贴题目文本！');
    return;
  }

  const blocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  const items = [];

  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    let qLines = [];
    let options = [];
    let rawAns = '';
    let solutionSteps = '';
    let explanation = '';

    lines.forEach(line => {
      if (/^[A-D][.、．\s]/i.test(line)) {
        options.push(line.replace(/^[A-D][.、．\s]+/i, '').trim());
      } else if (/^(?:【?答案】?|Answer)[:：\s]*(.+)/i.test(line)) {
        rawAns = RegExp.$1.trim();
      } else if (/^(?:【?(?:解题)?步骤】?|SOP)[:：\s]*(.+)/i.test(line)) {
        solutionSteps = RegExp.$1.trim();
      } else if (/^(?:【?解析】?|Explanation)[:：\s]*(.+)/i.test(line)) {
        explanation = RegExp.$1.trim();
      } else {
        qLines.push(line.replace(/^\d+[.、．\s]+/, ''));
      }
    });

    const prompt = qLines.join(' ');
    if (!prompt) return;
    const type = options.length >= 2 ? 'CHOICE' : (/^(正确|错误|√|×|对|错)$/.test(rawAns) ? 'TF' : 'SUBJECTIVE');
    const m = rawAns.toUpperCase().match(/[A-D]/);
    const correctIdx = m ? { A: 0, B: 1, C: 2, D: 3 }[m[0]] : 0;
    const tfCorrect = !/^(错误|错|×|F|false)$/i.test(rawAns);

    items.push({
      subject, semester, chapter, corePoint,
      archetype: type === 'CHOICE' ? '题型B · 标准母题应用' : '题型C · 综合变式题',
      type, prompt, options, correctIdx, tfCorrect,
      answerText: rawAns || '见步骤解析',
      solutionSteps: solutionSteps || '①审题抓关键条件 ➔ ②套用本单元核心法则 ➔ ③检验符号与边界',
      explanation: explanation || '结合核心考点规范作答。'
    });
  });

  if (items.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ 未能识别出有效题目，请检查粘贴格式');
    return;
  }

  try {
    const res = await fetch('/api/custom-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (data.ok || data.success) {
      if (typeof showToast === 'function') showToast(`🎉 成功批量导入 ${items.length} 道好题！`);
      window.QBANK_STATE.showBatchModal = false;
      const freshRes = await fetch('/api/data?refresh=1');
      STATE.data = await freshRes.json();
      renderCustomQBankView();
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteCustomQuestionById(id) {
  try {
    const res = await fetch(`/api/custom-questions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok || data.success) {
      if (typeof showToast === 'function') showToast('🗑️ 已从自定义题库中移除该题');
      const freshRes = await fetch('/api/data?refresh=1');
      STATE.data = await freshRes.json();
      renderCustomQBankView();
    }
  } catch (e) {
    console.error(e);
  }
}

function practiceFilteredQBankOnline() {
  const all = getFilteredQuestionsForQBank().filter(q => q.type === 'CHOICE' || q.type === 'TF');
  if (all.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ 当前筛选条件下暂无可在线作答的选择/判断题');
    return;
  }
  const fallbackKp = (STATE.data && STATE.data.knowledgePoints && STATE.data.knowledgePoints[0]) || { id: 'KP_CUSTOM', subject: '数学', semester: '初一上', chapter: '综合', corePoint: '精选扩充题' };
  const queue = all.slice(0, 12).map((item, idx) => {
    const baseKp = item.kpRef || STATE.data.knowledgePoints.find(k => k.subject === item.subject && k.corePoint === item.pointTitle) || fallbackKp;
    return {
      ...baseKp,
      corePoint: item.pointTitle || baseKp.corePoint,
      _subQIndex: idx,
      _subQuizItem: {
        type: item.type === 'TF' ? 'TF' : 'CHOICE',
        prompt: item.q,
        options: item.options && item.options.length >= 2 ? item.options : ['选项A', '选项B', '选项C', '选项D'],
        correctIdx: typeof item.correctIdx === 'number' ? item.correctIdx : 0,
        tfCorrect: item.tfCorrect !== undefined ? item.tfCorrect : true,
        explanation: `${item.solutionSteps ? '【固定步骤 SOP】' + item.solutionSteps + ' | ' : ''}${item.explanation || ''}`
      }
    };
  });

  openQuizQueueWithSopBanner(
    queue,
    all[0].subject || '数学',
    all[0].semester || '初一上',
    `若婷专属题库在线闯关 (${queue.length}题)`,
    '先识别【考题形式与题眼信号】➔ 再套【固定解题步骤 SOP】➔ 最后逆向防坑核查！'
  );
}

function buildFormattedQBankPrintHtml(answerMode) {
  const st = window.QBANK_STATE;
  const list = getFilteredQuestionsForQBank().slice(0, st.limitCount || 30);
  const title = `若婷专属题库精选训练卷（${st.subject === 'ALL' ? '九科综合' : st.subject} · ${st.semester === 'ALL' ? '全学期' : st.semester}）`;
  const modeName = answerMode === 'inline' ? '讲义背诵版（每题紧跟答案与固定解题步骤 SOP）' : (answerMode === 'end' ? '标准测试版（卷末附答案与固定解题步骤）' : '纯空白测试卷');

  let bodyHtml = `<div style="margin-bottom:12px; font-size:10pt; color:#334155;">📌 本卷共收录 <strong>${list.length}</strong> 道精选题目 | 模式：<strong>${modeName}</strong></div>`;

  list.forEach((item, idx) => {
    bodyHtml += `
      <div class="qbank-item-card" style="margin-bottom:12px; padding:10px 14px; border:1px solid #cbd5e1; border-radius:6px; page-break-inside:avoid;">
        <div style="font-size:9pt; color:#475569; margin-bottom:4px;">
          <strong>第 ${idx + 1} 题</strong> [${item.subject} · ${item.semester} · ${item.pointTitle}] 【${item.archetype}】 ${item.isCustom ? '★自定义好题' : ''}
        </div>
        <div style="font-size:10.5pt; font-weight:600; color:#0f172a; margin-bottom:6px;">
          ${item.q} ${item.type !== 'SUBJECTIVE' ? '<span style="float:right;">（ &nbsp;&nbsp;&nbsp;&nbsp; ）</span>' : ''}
        </div>
        ${item.type === 'CHOICE' && item.options && item.options.length > 0 ? `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; font-size:10pt; margin-bottom:6px;">
            ${item.options.map((o, oIdx) => {
              const prefix = /^[A-D][.、．\s]/.test(o) ? '' : `${['A', 'B', 'C', 'D'][oIdx] || 'A'}. `;
              return `<div>${prefix}${o}</div>`;
            }).join('')}
          </div>
        ` : ''}
        ${item.type === 'TF' ? `<div style="font-size:9.5pt; color:#475569;">选项：A. 正确 (√) &nbsp;&nbsp;&nbsp;&nbsp; B. 错误 (×)</div>` : ''}
        ${item.type === 'SUBJECTIVE' && answerMode !== 'inline' ? `<div style="height:64px; border-bottom:1px dashed #cbd5e1; margin-top:8px; color:#94a3b8; font-size:9pt;">解/答：</div>` : ''}

        ${answerMode === 'inline' ? `
          <div class="sop-step-box" style="margin-top:8px; font-size:9.5pt;">
            <div><strong>✅ 标准答案：</strong>${item.answer}</div>
            ${item.solutionSteps ? `<div style="margin-top:3px;"><strong>🛠️ 固定解题步骤 SOP：</strong>${item.solutionSteps.replace(/\n/g, ' ； ')}</div>` : ''}
            ${item.explanation ? `<div style="margin-top:3px;"><strong>💡 解析与防坑：</strong>${item.explanation}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  });

  if (answerMode === 'end') {
    bodyHtml += `
      <div style="page-break-before:always; border-top:2px solid #0f172a; padding-top:12px; margin-top:20px;">
        <h2 style="font-size:13pt; margin:0 0 10px 0;">🔑 参考答案与固定解题方法步骤 SOP 详解</h2>
        ${list.map((item, idx) => `
          <div style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed #cbd5e1; font-size:9.5pt; page-break-inside:avoid;">
            <strong>第 ${idx + 1} 题 [${item.pointTitle}]：</strong> <strong>答案：${item.answer}</strong><br>
            ${item.solutionSteps ? `<span>🛠️ <strong>固定解题步骤：</strong>${item.solutionSteps.replace(/\n/g, ' ➔ ')}</span><br>` : ''}
            ${item.explanation ? `<span>💡 <strong>解析：</strong>${item.explanation}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  return { title, subtitle: modeName, bodyHtml };
}

function printFilteredQBank(answerMode) {
  const { title, subtitle, bodyHtml } = buildFormattedQBankPrintHtml(answerMode || window.QBANK_STATE.printAnswerMode);
  const fullDoc = buildUniversalA4PrintDocument(bodyHtml, title, subtitle);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(fullDoc);
  win.document.close();
}

function exportFilteredQBankWord(answerMode) {
  const { title, subtitle, bodyHtml } = buildFormattedQBankPrintHtml(answerMode || window.QBANK_STATE.printAnswerMode);
  const tempDiv = document.createElement('div');
  tempDiv.id = 'temp-qbank-word-export';
  tempDiv.style.display = 'none';
  tempDiv.innerHTML = bodyHtml;
  document.body.appendChild(tempDiv);
  exportElementWord('temp-qbank-word-export', title, subtitle);
  document.body.removeChild(tempDiv);
}

function exportFilteredQBankMd() {
  const st = window.QBANK_STATE;
  const list = getFilteredQuestionsForQBank().slice(0, st.limitCount || 30);
  const title = `若婷专属题库导出（${st.subject === 'ALL' ? '九科综合' : st.subject}）`;
  let md = `# ${title}\n\n> 导出时间：${new Date().toLocaleString('zh-CN')} | 题量：${list.length} 道\n\n---\n\n`;
  list.forEach((item, idx) => {
    md += `### ${idx + 1}. [${item.subject} · ${item.semester} · ${item.pointTitle}] （${item.archetype}）\n\n`;
    md += `**题目**：${item.q}\n\n`;
    if (item.options && item.options.length > 0) {
      item.options.forEach((o, oIdx) => {
        const prefix = /^[A-D][.、．\s]/.test(o) ? '' : `${['A', 'B', 'C', 'D'][oIdx] || 'A'}. `;
        md += `- ${prefix}${o}\n`;
      });
      md += `\n`;
    }
    md += `- **标准答案**：\`${item.answer}\`\n`;
    if (item.solutionSteps) md += `- **固定解题步骤 SOP**：${item.solutionSteps.replace(/\n/g, ' ➔ ')}\n`;
    if (item.explanation) md += `- **解析与防坑**：${item.explanation}\n`;
    md += `\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|\s]+/g, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('⬇️ 已导出题库为 Markdown (.md) 文件！');
}
