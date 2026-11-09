// ============================================================================
// 🖨️ 全科按单元自动组卷 · A4 标准试卷生成、导出与打印中心 (Unit Paper Generator)
// 支持九大学科（语/数/英/道/史/地/生/物/化）任意勾选单元自动抽题组卷：
// - 四大题型自由配比：单项选择题 / 判断辨析题 / 核心母题解答题 / 同源变式拔高题
// - 三种卷面模式：学生空白卷 + 卷末独立答案解析页（打印最推荐）/ 纯空白卷 / 教师批改详解卷
// - 四大导出与打印：A4 标准打印(或存PDF) / 导出 Word(.doc) / 归档至 Obsidian(.md) / 在线闯关本卷
// ============================================================================

function ensurePaperGenState() {
  if (!STATE.paperGen) {
    const initSem = STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus;
    const initSubj = STATE.homeSelectedSubject || '数学';
    STATE.paperGen = {
      subject: initSubj,
      semester: initSem,
      selectedUnitsKey: '', // `${subject}__${semester}` 用于检测学科或学期切换
      selectedChapters: [], // 当前勾选的单元标题数组
      preset: 'STANDARD', // 'QUICK'(12题) | 'STANDARD'(17题) | 'EXAM'(24题) | 'CUSTOM'
      choiceCount: 8,
      tfCount: 4,
      mainSubjCount: 3,
      variantSubjCount: 2,
      strategy: 'SMART', // 'SMART'(薄弱与高频优先) | 'UNIFORM'(各单元均匀抽题) | 'ADVANCED'(中档与压轴优先)
      answerMode: 'END_PAGE', // 'END_PAGE'(卷末独立答案页) | 'HIDDEN'(纯学生空白卷) | 'INLINE'(题下直接显答案)
      workSpaceHeight: 112, // 解答题手写作答留白高度(px)：76 | 112 | 160
      seed: 1,
      paperVersion: 1,
      customTitle: '',
      currentPaper: null
    };
  }
  return STATE.paperGen;
}

// 获取指定科目与学期的全部章节列表
function getSubjectChaptersForPaper(subjName, semCode) {
  if (!STATE.data || !Array.isArray(STATE.data.knowledgePoints)) return [];
  const kps = STATE.data.knowledgePoints
    .filter(k => k.subject === subjName && (semCode === 'ALL' ? true : k.semester === semCode) && !k.isUnverified && !(k.status || '').includes('🔒待精校'))
    .sort((a, b) => a.order - b.order);

  const map = new Map();
  kps.forEach(k => {
    const chTitle = k.chapter || '综合单元';
    if (!map.has(chTitle)) {
      map.set(chTitle, {
        chapter: chTitle,
        semester: k.semester,
        items: []
      });
    }
    map.get(chTitle).items.push(k);
  });
  return Array.from(map.values());
}

// 同步学科与学期，若未选单元则默认勾选「学校已授完+当前同步单元」（若无则全选）
function syncPaperGenSubjectAndUnits(subjName, semCode, forceSingleChapter = null) {
  const pg = ensurePaperGenState();
  if (subjName) pg.subject = subjName;
  if (semCode && semCode !== 'ALL') pg.semester = semCode;

  // 若该科目在当前学期未开课（如地理在初二上、化学在初三全一册），自动对齐到该科目有课的首个学期
  if (STATE.data) {
    const hasInSem = STATE.data.knowledgePoints.some(
      k => k.subject === pg.subject && k.semester === pg.semester
    );
    if (!hasInSem && typeof getFirstValidSemesterForSubject === 'function') {
      pg.semester = getFirstValidSemesterForSubject(pg.subject);
    }
  }

  const chapters = getSubjectChaptersForPaper(pg.subject, pg.semester);
  const unitKey = `${pg.subject}__${pg.semester}`;

  if (forceSingleChapter) {
    pg.selectedUnitsKey = unitKey;
    pg.selectedChapters = [forceSingleChapter];
  } else if (pg.selectedUnitsKey !== unitKey || !Array.isArray(pg.selectedChapters) || pg.selectedChapters.length === 0) {
    pg.selectedUnitsKey = unitKey;
    // 默认优先勾选「学校已学 + 本周同步」的单元，方便日常随堂检测
    const allSubjSemKps = STATE.data
      ? STATE.data.knowledgePoints.filter(k => k.subject === pg.subject && k.semester === pg.semester)
      : [];
    const taughtChapters = chapters.filter(ch =>
      ch.items.some(k => {
        if (typeof getSchoolTeachingProgress === 'function') {
          const p = getSchoolTeachingProgress(k, allSubjSemKps);
          return p.code === 'TAUGHT' || p.code === 'CURRENT';
        }
        return true;
      })
    );
    pg.selectedChapters = (taughtChapters.length > 0 ? taughtChapters : chapters).map(c => c.chapter);
  }
}

// ============================================================================
// 🚀 快捷入口：从任意页面或单元一键进入「按单元组卷·打印」
// ============================================================================

function openSubjectPaperGenerator(subjName, semCode) {
  if (!STATE.data) return;
  if (typeof playCommercialSound === 'function') playCommercialSound('open');
  const targetSubj = subjName || STATE.homeSelectedSubject || '数学';
  const targetSem = semCode || (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus);

  STATE.homeSelectedSubject = targetSubj;
  STATE.stageFocus = targetSem;
  STATE.mesoFilter.subject = targetSubj;
  STATE.mesoFilter.semester = targetSem;
  STATE.drillLevel = 'CHAPTER';
  STATE.subjectVisualMode = 'PAPER_GEN';

  syncPaperGenSubjectAndUnits(targetSubj, targetSem, null);
  buildGeneratedPaper();

  if (STATE.activeTab !== 'macro') {
    switchTab('macro');
  } else {
    renderStageControlBar();
    renderMacroView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function openUnitPaperGenerator(subjName, semCode, chapterTitle) {
  if (!STATE.data) return;
  if (typeof playCommercialSound === 'function') playCommercialSound('open');
  const targetSubj = subjName || STATE.homeSelectedSubject || '数学';
  const targetSem = semCode || (STATE.stageFocus === 'ALL' ? SAVED_DEFAULT_SEMESTER : STATE.stageFocus);

  STATE.homeSelectedSubject = targetSubj;
  STATE.stageFocus = targetSem;
  STATE.drillLevel = 'CHAPTER';
  STATE.subjectVisualMode = 'PAPER_GEN';

  syncPaperGenSubjectAndUnits(targetSubj, targetSem, chapterTitle);
  buildGeneratedPaper();

  if (STATE.activeTab !== 'macro') {
    switchTab('macro');
  } else {
    renderStageControlBar();
    renderMacroView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (typeof showToast === 'function') {
    showToast(`🖨️ 已为您勾选【${chapterTitle}】并自动生成单元检测卷！`);
  }
}

// ============================================================================
// 🎛️ 组卷交互动作（勾选单元、切换学科、预设模式、随机换题）
// ============================================================================

function switchPaperGenSubject(subjName) {
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  const pg = ensurePaperGenState();
  pg.customTitle = '';
  STATE.homeSelectedSubject = subjName;
  syncPaperGenSubjectAndUnits(subjName, pg.semester, null);
  STATE.stageFocus = pg.semester;
  buildGeneratedPaper();
  renderStageControlBar();
  renderMacroView();
}

function switchPaperGenSemester(semCode) {
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  const pg = ensurePaperGenState();
  pg.customTitle = '';
  pg.semester = semCode;
  STATE.stageFocus = semCode;
  persistSelectedSemester(semCode);
  syncPaperGenSubjectAndUnits(pg.subject, semCode, null);
  buildGeneratedPaper();
  renderStageControlBar();
  renderMacroView();
}

function togglePaperUnitSelection(chapterTitle) {
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  const pg = ensurePaperGenState();
  const idx = pg.selectedChapters.indexOf(chapterTitle);
  if (idx >= 0) {
    if (pg.selectedChapters.length <= 1) {
      if (typeof showToast === 'function') showToast('💡 至少需要保留勾选 1 个单元才能出题哦~');
      return;
    }
    pg.selectedChapters.splice(idx, 1);
  } else {
    pg.selectedChapters.push(chapterTitle);
  }
  pg.customTitle = '';
  buildGeneratedPaper();
  renderMacroView();
}

function batchSelectPaperUnits(mode) {
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  const pg = ensurePaperGenState();
  const chapters = getSubjectChaptersForPaper(pg.subject, pg.semester);
  if (chapters.length === 0) return;

  if (mode === 'ALL') {
    pg.selectedChapters = chapters.map(c => c.chapter);
  } else if (mode === 'TAUGHT') {
    const allSubjSemKps = STATE.data.knowledgePoints.filter(
      k => k.subject === pg.subject && k.semester === pg.semester
    );
    const taught = chapters.filter(ch =>
      ch.items.some(k => {
        const p = getSchoolTeachingProgress(k, allSubjSemKps);
        return p.code === 'TAUGHT' || p.code === 'CURRENT';
      })
    );
    pg.selectedChapters = (taught.length > 0 ? taught : chapters).map(c => c.chapter);
  } else if (mode === 'WEAK') {
    const weak = chapters.filter(ch =>
      ch.items.some(k => k.status.includes('未掌握') || k.status.includes('复习中'))
    );
    if (weak.length === 0) {
      if (typeof showToast === 'function') showToast('🎉 当前各单元暂无标记为未掌握的错题，已为您保持原选择');
      return;
    }
    pg.selectedChapters = weak.map(c => c.chapter);
  }
  pg.customTitle = '';
  buildGeneratedPaper();
  renderMacroView();
}

function applyPaperPreset(presetKey) {
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  const pg = ensurePaperGenState();
  pg.preset = presetKey;
  if (presetKey === 'QUICK') {
    pg.choiceCount = 6;
    pg.tfCount = 4;
    pg.mainSubjCount = 2;
    pg.variantSubjCount = 0;
  } else if (presetKey === 'STANDARD') {
    pg.choiceCount = 8;
    pg.tfCount = 4;
    pg.mainSubjCount = 3;
    pg.variantSubjCount = 2;
  } else if (presetKey === 'EXAM') {
    pg.choiceCount = 12;
    pg.tfCount = 6;
    pg.mainSubjCount = 4;
    pg.variantSubjCount = 2;
  }
  buildGeneratedPaper();
  renderMacroView();
}

function updatePaperGenOption(key, val) {
  if (typeof playCommercialSound === 'function') playCommercialSound('click');
  const pg = ensurePaperGenState();
  if (['choiceCount', 'tfCount', 'mainSubjCount', 'variantSubjCount', 'workSpaceHeight'].includes(key)) {
    pg[key] = Number(val);
    if (key !== 'workSpaceHeight') pg.preset = 'CUSTOM';
  } else {
    pg[key] = val;
  }
  buildGeneratedPaper();
  renderMacroView();
}

function regeneratePaperWithNewSeed() {
  if (typeof playCommercialSound === 'function') playCommercialSound('flip');
  const pg = ensurePaperGenState();
  pg.seed += 1;
  pg.paperVersion += 1;
  buildGeneratedPaper();
  renderMacroView();
  if (typeof showToast === 'function') {
    showToast(`🎲 已重新随机抽题，生成【第 ${pg.paperVersion} 套】新试卷！`);
  }
}
// ============================================================================
// 🧠 核心组卷算法：从所选单元题库抽取 4 大题型并自动配平 100 分制
// ============================================================================

function seededShuffleArray(arr, seedVal) {
  const copy = arr.slice();
  let s = (Number(seedVal) || 1) * 9301 + 49297;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 233280 + 12345) % 2147483647;
    const rand = (s / 2147483647 + Math.random()) / 2;
    const j = Math.floor(rand * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildGeneratedPaper() {
  const pg = ensurePaperGenState();
  syncPaperGenSubjectAndUnits(pg.subject, pg.semester, null);

  const allChapters = getSubjectChaptersForPaper(pg.subject, pg.semester);
  const chosenSet = new Set(pg.selectedChapters);
  const selectedChapterObjs = allChapters.filter(c => chosenSet.has(c.chapter));
  const fallbackChapters = selectedChapterObjs.length > 0 ? selectedChapterObjs : allChapters;

  // 汇总勾选单元下的全部课节知识点
  let rawKps = [];
  if (pg.strategy === 'UNIFORM') {
    // 各单元轮询均匀抽题（保证每个勾选单元都有代表题）
    const maxLen = Math.max(0, ...fallbackChapters.map(c => c.items.length));
    for (let idx = 0; idx < maxLen; idx++) {
      fallbackChapters.forEach(ch => {
        if (ch.items[idx]) rawKps.push(ch.items[idx]);
      });
    }
  } else {
    fallbackChapters.forEach(ch => {
      rawKps = rawKps.concat(ch.items);
    });
  }

  // 根据抽题策略排序
  let orderedKps = seededShuffleArray(rawKps, pg.seed);
  if (pg.strategy === 'SMART') {
    const statusWeight = (st) => {
      if ((st || '').includes('未掌握')) return 0;
      if ((st || '').includes('复习中')) return 1;
      if ((st || '').includes('待考察')) return 2;
      return 3;
    };
    orderedKps.sort((a, b) => statusWeight(a.status) - statusWeight(b.status));
  } else if (pg.strategy === 'ADVANCED') {
    orderedKps.sort((a, b) => getDepthTier(b.difficulty) - getDepthTier(a.difficulty));
  }

  // 1. 构建候选「单项选择题池」与「判断辨析题池」
  const choicePool = [];
  const tfPool = [];
  const seenPrompts = new Set();

  orderedKps.forEach((kp) => {
    if (kp.isUnverified || (kp.status || '').includes('🔒待精校')) return;
    const bank = (Array.isArray(kp.quizItems) && kp.quizItems.length > 0)
      ? kp.quizItems
      : (kp.sections && Array.isArray(kp.sections.quizItems) ? kp.sections.quizItems : []);

    bank.forEach((item) => {
      const cleanPrompt = String(item.prompt || '').trim();
      if (!cleanPrompt || cleanPrompt.includes('🔒待精校') || seenPrompts.has(cleanPrompt)) return;
      seenPrompts.add(cleanPrompt);

      if (item.type === 'CHOICE' && Array.isArray(item.options) && item.options.length >= 2) {
        const directIdx = Math.max(0, Math.min(item.options.length - 1, Number(item.correctIdx) || 0));
        choicePool.push({
          kp,
          chapter: kp.chapter,
          corePoint: kp.corePoint,
          difficulty: kp.difficulty,
          prompt: cleanPrompt,
          options: item.options.slice(),
          correctIdx: directIdx,
          correctLetter: ['A', 'B', 'C', 'D'][directIdx] || 'A',
          explanation: item.explanation || kp.mnemonic || kp.understanding || '',
          mnemonic: kp.mnemonic || '',
          errorReason: kp.errorReason || kp.habitWarning || ''
        });
      } else if (item.type === 'TF') {
        tfPool.push({
          kp,
          chapter: kp.chapter,
          corePoint: kp.corePoint,
          difficulty: kp.difficulty,
          prompt: cleanPrompt,
          tfCorrect: Boolean(item.tfCorrect),
          explanation: item.explanation || kp.mnemonic || kp.understanding || '',
          mnemonic: kp.mnemonic || '',
          errorReason: kp.errorReason || kp.habitWarning || ''
        });
      }
    });
  });

  // 2. 构建候选「三、核心母题解答题池」与「四、同源变式拔高题池」
  const mainPool = [];
  const variantPool = [];
  orderedKps.forEach(kp => {
    if (Array.isArray(kp.customSubjectiveItems)) {
      kp.customSubjectiveItems.forEach(cs => {
        if (cs && cs.prompt) {
          mainPool.push({
            kp,
            chapter: kp.chapter,
            corePoint: cs.corePoint || kp.corePoint,
            difficulty: kp.difficulty,
            prompt: cs.prompt,
            answerText: cs.answerText || cs.explanation || kp.answerText || '',
            mnemonic: cs.solutionSteps || kp.mnemonic || '',
            understanding: cs.explanation || kp.understanding || '',
            errorReason: kp.errorReason || kp.habitWarning || ''
          });
        }
      });
    }
    const qMain = String(kp.questionMain || '').trim();
    if (qMain && !qMain.includes('🔒待精校') && !kp.isUnverified) {
      mainPool.push({
        kp,
        chapter: kp.chapter,
        corePoint: kp.corePoint,
        difficulty: kp.difficulty,
        prompt: qMain,
        answerText: kp.answerText || kp.understanding || kp.mnemonic || '请参照课本大纲与核心口诀分步作答。',
        mnemonic: kp.mnemonic || '',
        understanding: kp.understanding || '',
        errorReason: kp.errorReason || kp.habitWarning || ''
      });
    }
    const qVar = String(kp.questionVariant || '').trim();
    if (qVar && !qVar.includes('🔒待精校') && !kp.isUnverified) {
      variantPool.push({
        kp,
        chapter: kp.chapter,
        corePoint: kp.corePoint,
        difficulty: kp.difficulty,
        prompt: qVar,
        answerText: kp.answerText || kp.understanding || kp.mnemonic || '结合同源母题方法与口诀举一反三作答。',
        mnemonic: kp.mnemonic || '',
        understanding: kp.understanding || '',
        errorReason: kp.errorReason || kp.habitWarning || ''
      });
    }
  });

  // 抽取指定数量（并对池子做二次随机采样保证每课均匀度）
  const shuffledChoice = seededShuffleArray(choicePool, pg.seed + 7);
  const shuffledTf = seededShuffleArray(tfPool, pg.seed + 13);
  const shuffledMain = seededShuffleArray(mainPool, pg.seed + 29);
  const shuffledVar = seededShuffleArray(variantPool, pg.seed + 41);

  const choices = shuffledChoice.slice(0, pg.choiceCount);
  const tfs = shuffledTf.slice(0, pg.tfCount);
  const mains = shuffledMain.slice(0, pg.mainSubjCount);
  const variants = shuffledVar.slice(0, pg.variantSubjCount);

  // 3. 自动配平 100 分制分值（让整张卷子总分恰好等于 100 分）
  const totalQCount = choices.length + tfs.length + mains.length + variants.length;
  let choiceUnitScore = choices.length > 0 ? 4 : 0;
  let tfUnitScore = tfs.length > 0 ? 3 : 0;
  let mainUnitScore = mains.length > 0 ? 12 : 0;
  let varUnitScore = variants.length > 0 ? 14 : 0;

  // 如果只有客观题或自定义题数，动态调整各部分单题分值与最后一题尾差，确保满分 100 分
  const rawTotal = choices.length * choiceUnitScore + tfs.length * tfUnitScore + mains.length * mainUnitScore + variants.length * varUnitScore;
  if (totalQCount > 0 && rawTotal !== 100) {
    const scale = 100 / rawTotal;
    if (choices.length > 0) choiceUnitScore = Math.max(2, Math.round(choiceUnitScore * scale));
    if (tfs.length > 0) tfUnitScore = Math.max(2, Math.round(tfUnitScore * scale));
    if (mains.length > 0) mainUnitScore = Math.max(5, Math.round(mainUnitScore * scale));
    if (variants.length > 0) varUnitScore = Math.max(6, Math.round(varUnitScore * scale));
  }

  let runningSum = 0;
  choices.forEach(item => { item.score = choiceUnitScore; runningSum += item.score; });
  tfs.forEach(item => { item.score = tfUnitScore; runningSum += item.score; });
  mains.forEach(item => { item.score = mainUnitScore; runningSum += item.score; });
  variants.forEach(item => { item.score = varUnitScore; runningSum += item.score; });

  // 把距离 100 分的尾差补在最后一道大题（或最后一道题）上，使卷面总分严格为 100 分
  if (totalQCount > 0 && runningSum !== 100) {
    const diff = 100 - runningSum;
    const lastList = variants.length > 0 ? variants : mains.length > 0 ? mains : tfs.length > 0 ? tfs : choices;
    if (lastList.length > 0) {
      const lastItem = lastList[lastList.length - 1];
      if (lastItem.score + diff >= 2) {
        lastItem.score += diff;
        runningSum = 100;
      }
    }
  }

  // 生成试卷标题与涵盖单元说明
  const unitNamesShort = fallbackChapters.length === allChapters.length
    ? `全册综合（共 ${allChapters.length} 单元）`
    : fallbackChapters.length === 1
      ? fallbackChapters[0].chapter
      : `${fallbackChapters[0].chapter} 等 ${fallbackChapters.length} 个单元`;

  const defaultTitle = `鲁教版五四制 · ${pg.semester}《${pg.subject}》单元自主检测卷（第 ${pg.paperVersion} 套）`;
  const recommendedMinutes = Math.max(15, choices.length * 2 + tfs.length * 1 + mains.length * 6 + variants.length * 8);

  pg.currentPaper = {
    title: pg.customTitle || defaultTitle,
    subtitle: `考察范围：${unitNamesShort} ｜ 题量：共 ${totalQCount} 题 ｜ 建议用时：${recommendedMinutes} 分钟 ｜ 满分：${runningSum} 分`,
    subject: pg.subject,
    semester: pg.semester,
    version: pg.paperVersion,
    unitNamesShort,
    selectedUnitCount: fallbackChapters.length,
    totalUnitCount: allChapters.length,
    totalKpsPool: rawKps.length,
    totalQuestions: totalQCount,
    totalScore: runningSum,
    recommendedMinutes,
    dateStr: new Date().toISOString().slice(0, 10),
    choices,
    tfs,
    mains,
    variants
  };

  return pg.currentPaper;
}
// ============================================================================
// 🖼️ 渲染按单元组卷控制台 + A4 仿真试卷预览纸张
// ============================================================================

function renderSubjectPaperGeneratorHtml(curSubjName, curSem) {
  const pg = ensurePaperGenState();
  if (curSubjName && pg.subject !== curSubjName) {
    syncPaperGenSubjectAndUnits(curSubjName, curSem || pg.semester, null);
  }
  if (!pg.currentPaper || pg.currentPaper.subject !== pg.subject || pg.currentPaper.semester !== pg.semester) {
    buildGeneratedPaper();
  }

  const paper = pg.currentPaper;
  const chapters = getSubjectChaptersForPaper(pg.subject, pg.semester);
  const allSubjSemKps = STATE.data
    ? STATE.data.knowledgePoints.filter(k => k.subject === pg.subject && k.semester === pg.semester)
    : [];

  // 1. 按当前年级课表严格区分「✅在读科目」与「🚫未开课/🎓已结业科目」
  const allSubjList = (STATE.data && Array.isArray(STATE.data.subjects))
    ? STATE.data.subjects
    : [{ name: '语文' }, { name: '数学' }, { name: '英语' }, { name: '道法' }, { name: '历史' }, { name: '生物' }, { name: '地理' }, { name: '物理' }, { name: '化学' }];

  const subjPillsHtml = allSubjList.map(s => {
    const isAct = s.name === pg.subject;
    const gStatus = typeof getSubjectGradeStatus === 'function'
      ? getSubjectGradeStatus(s.name, pg.semester)
      : { status: 'active', tag: '在读' };
    const isTaughtNow = gStatus.status === 'active';
    const extraBadge = !isTaughtNow
      ? `<span style="font-size:10px;padding:0 5px;border-radius:999px;background:${isAct ? 'rgba(255,255,255,0.22)' : '#e2e8f0'};color:${isAct ? '#fff' : '#64748b'};margin-left:3px;">${gStatus.status === 'graduated' ? '🎓已结业' : '🚫' + gStatus.tag}</span>`
      : '';
    return `
      <button class="paper-subj-pill ${isAct ? 'active' : ''}" style="${!isTaughtNow && !isAct ? 'opacity:0.65;border-style:dashed;' : ''}" onclick="switchPaperGenSubject('${s.name}')">
        ${typeof subjIconSvg === 'function' ? subjIconSvg(s.name, 16) : '📘'}
        <span>${s.name}</span>
        ${extraBadge}
      </button>
    `;
  }).join('');

  // 学期切换下拉（仅展示该科目真实开课的学期，杜绝在未开课/已结业学期空抽题）
  const eightSems = ['初一上', '初一下', '初二上', '初二下', '初三上', '初三下', '初四上', '初四下'];
  const validSemsForSubj = (STATE.data && Array.isArray(STATE.data.knowledgePoints))
    ? eightSems.filter(sc => STATE.data.knowledgePoints.some(k => k.subject === pg.subject && k.semester === sc))
    : eightSems;
  const semListToRender = validSemsForSubj.length > 0 ? validSemsForSubj : eightSems;
  const semOptsHtml = semListToRender.map(sc => `<option value="${sc}" ${sc === pg.semester ? 'selected' : ''}>${sc}（${pg.subject}开课学期）</option>`).join('');

  // 2. 单元多选复选框卡片
  const unitCardsHtml = chapters.map((ch, idx) => {
    const isChecked = pg.selectedChapters.includes(ch.chapter);
    const safeCh = ch.chapter.replace(/'/g, "\\'");
    const qTotal = typeof countTotalQuestionsForKps === 'function'
      ? countTotalQuestionsForKps(ch.items)
      : ch.items.length * 10;
    const weakCount = ch.items.filter(k => (k.status || '').includes('未掌握')).length;
    const prog = (typeof getSchoolTeachingProgress === 'function' && ch.items[0])
      ? getSchoolTeachingProgress(ch.items[0], allSubjSemKps)
      : { shortLabel: '同步', bg: '#f0fdf4', color: '#15803d' };

    return `
      <div class="paper-unit-check-card ${isChecked ? 'is-checked' : ''}" onclick="togglePaperUnitSelection('${safeCh}')">
        <div class="paper-unit-checkbox">${isChecked ? '✓' : ''}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="font-size:11.5px;font-weight:900;color:#6d28d9;">第 ${idx + 1} 单元</span>
            <span style="font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px;background:${prog.bg || '#f1f5f9'};color:${prog.color || '#475569'};">
              ${prog.shortLabel || '同步'}
            </span>
          </div>
          <div style="font-size:14.5px;font-weight:900;color:#0f172a;line-height:1.35;margin-bottom:4px;">
            ${escapeHtml(ch.chapter)}
          </div>
          <div style="font-size:12px;color:#64748b;font-weight:700;display:flex;justify-content:space-between;">
            <span>📚 ${ch.items.length} 课 · 题库 ${qTotal} 题</span>
            ${weakCount > 0 ? `<span style="color:#e11d48;font-weight:800;">🔥 ${weakCount}薄弱</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 3. 构造 A4 试卷四大题型 HTML
  let globalQNum = 0;
  const chScoreSum = paper.choices.reduce((s, x) => s + (x.score || 0), 0);
  const tfScoreSum = paper.tfs.reduce((s, x) => s + (x.score || 0), 0);
  const mainScoreSum = paper.mains.reduce((s, x) => s + (x.score || 0), 0);
  const varScoreSum = paper.variants.reduce((s, x) => s + (x.score || 0), 0);

  const sectionNames = ['一', '二', '三', '四'];
  let secIdx = 0;

  // (一) 单项选择题
  let choiceSecHtml = '';
  if (paper.choices.length > 0) {
    const sNum = sectionNames[secIdx++] || '一';
    const itemsHtml = paper.choices.map((item, idx) => {
      globalQNum += 1;
      const letters = ['A', 'B', 'C', 'D'];
      const maxOptLen = Math.max(...item.options.map(o => String(o || '').length));
      const gridCls = maxOptLen <= 10 ? 'cols-4' : maxOptLen >= 34 ? 'cols-1' : '';
      const optsHtml = item.options.map((optText, oIdx) => `
        <div style="display:flex;align-items:baseline;gap:4px;">
          <strong>${letters[oIdx]}.</strong>
          <span class="md-rendered" style="display:inline;">${formatSimpleMarkdown(optText)}</span>
        </div>
      `).join('');

      const inlineAnsHtml = pg.answerMode === 'INLINE' ? `
        <div class="a4-inline-answer-box">
          <div><strong>【答案】${item.correctLetter}</strong> &nbsp;｜&nbsp; <span style="color:#64748b;">来源：${escapeHtml(item.chapter)} · ${escapeHtml(item.corePoint)}</span></div>
          ${item.explanation ? `<div style="margin-top:3px;"><strong>【解析/口诀】</strong>${escapeHtml(item.explanation)}</div>` : ''}
        </div>
      ` : '';

      return `
        <div class="a4-question-item">
          <div class="a4-question-stem">
            <span class="a4-q-num">${globalQNum}.</span>
            <div style="flex:1;">
              <span style="font-size:12.5px;color:#475569;font-weight:700;">（${item.score}分）</span>
              <span class="md-rendered" style="display:inline;">${formatSimpleMarkdown(item.prompt)}</span>
              <span style="float:right;font-weight:800;margin-left:12px;">（ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ）</span>
            </div>
          </div>
          <div class="a4-options-grid ${gridCls}">
            ${optsHtml}
          </div>
          ${inlineAnsHtml}
        </div>
      `;
    }).join('');

    choiceSecHtml = `
      <div class="a4-section-heading">
        ${sNum}、单项选择题（本大题共 ${paper.choices.length} 小题，共 ${chScoreSum} 分。每小题给出的四个选项中，只有一项最符合题意）
      </div>
      ${itemsHtml}
    `;
  }

  // (二) 判断辨析题
  let tfSecHtml = '';
  if (paper.tfs.length > 0) {
    const sNum = sectionNames[secIdx++] || '二';
    const itemsHtml = paper.tfs.map((item) => {
      globalQNum += 1;
      const inlineAnsHtml = pg.answerMode === 'INLINE' ? `
        <div class="a4-inline-answer-box">
          <div><strong>【答案】${item.tfCorrect ? '✓ 正确' : '× 错误'}</strong> &nbsp;｜&nbsp; <span style="color:#64748b;">考点：${escapeHtml(item.corePoint)}</span></div>
          ${item.explanation ? `<div style="margin-top:3px;"><strong>【解析】</strong>${escapeHtml(item.explanation)}</div>` : ''}
        </div>
      ` : '';

      return `
        <div class="a4-question-item">
          <div class="a4-question-stem">
            <span class="a4-q-num">${globalQNum}.</span>
            <div style="flex:1;">
              <span style="font-size:12.5px;color:#475569;font-weight:700;">（${item.score}分）</span>
              <span class="md-rendered" style="display:inline;">${formatSimpleMarkdown(item.prompt)}</span>
              <span style="float:right;font-weight:800;margin-left:12px;">（ &nbsp;&nbsp;&nbsp;&nbsp; ）<small style="color:#64748b;font-weight:600;">[填 ✓ 或 ×]</small></span>
            </div>
          </div>
          ${inlineAnsHtml}
        </div>
      `;
    }).join('');

    tfSecHtml = `
      <div class="a4-section-heading">
        ${sNum}、核心概念判断辨析题（本大题共 ${paper.tfs.length} 小题，共 ${tfScoreSum} 分。正确的打“✓”，错误的打“×”）
      </div>
      ${itemsHtml}
    `;
  }

  // (三) 核心母题与规范解答题
  let mainSecHtml = '';
  if (paper.mains.length > 0) {
    const sNum = sectionNames[secIdx++] || '三';
    const itemsHtml = paper.mains.map((item) => {
      globalQNum += 1;
      const inlineAnsHtml = pg.answerMode === 'INLINE' ? `
        <div class="a4-inline-answer-box">
          ${item.mnemonic ? `<div style="color:#be185d;margin-bottom:4px;"><strong>💡 秒杀口诀：</strong>${escapeHtml(item.mnemonic)}</div>` : ''}
          <div class="md-rendered"><strong>【标准答案与步骤】</strong>${formatSimpleMarkdown(item.answerText)}</div>
          ${item.errorReason ? `<div style="color:#b91c1c;margin-top:4px;"><strong>⚠️ 易错防坑：</strong>${escapeHtml(item.errorReason)}</div>` : ''}
        </div>
      ` : `
        <div class="a4-work-space" style="min-height:${pg.workSpaceHeight}px;">
          <div class="a4-work-space-label">解（请写出规范步骤与关键过程）：</div>
        </div>
      `;

      return `
        <div class="a4-question-item">
          <div class="a4-question-stem">
            <span class="a4-q-num">${globalQNum}.</span>
            <div style="flex:1;">
              <span style="font-size:12.5px;color:#475569;font-weight:800;">（${item.score}分 · 【${escapeHtml(item.chapter)} — ${escapeHtml(item.corePoint)}】）</span>
              <div class="md-rendered" style="margin-top:4px;">${formatSimpleMarkdown(item.prompt)}</div>
            </div>
          </div>
          ${inlineAnsHtml}
        </div>
      `;
    }).join('');

    mainSecHtml = `
      <div class="a4-section-heading">
        ${sNum}、核心母题与综合解答题（本大题共 ${paper.mains.length} 小题，共 ${mainScoreSum} 分。请写出必要的文字说明、证明过程或演算步骤）
      </div>
      ${itemsHtml}
    `;
  }

  // (四) 同源变式与拔高压轴题
  let varSecHtml = '';
  if (paper.variants.length > 0) {
    const sNum = sectionNames[secIdx++] || '四';
    const itemsHtml = paper.variants.map((item) => {
      globalQNum += 1;
      const inlineAnsHtml = pg.answerMode === 'INLINE' ? `
        <div class="a4-inline-answer-box">
          ${item.mnemonic ? `<div style="color:#be185d;margin-bottom:4px;"><strong>💡 核心口诀：</strong>${escapeHtml(item.mnemonic)}</div>` : ''}
          <div class="md-rendered"><strong>【解析与参考思路】</strong>${formatSimpleMarkdown(item.answerText)}</div>
        </div>
      ` : `
        <div class="a4-work-space" style="min-height:${pg.workSpaceHeight + 24}px;">
          <div class="a4-work-space-label">解（同源变式拔高 · 请分步作答）：</div>
        </div>
      `;

      return `
        <div class="a4-question-item">
          <div class="a4-question-stem">
            <span class="a4-q-num">${globalQNum}.</span>
            <div style="flex:1;">
              <span style="font-size:12.5px;color:#6d28d9;font-weight:800;">（${item.score}分 · 🌟同源变式拔高 · 【${escapeHtml(item.corePoint)}】）</span>
              <div class="md-rendered" style="margin-top:4px;">${formatSimpleMarkdown(item.prompt)}</div>
            </div>
          </div>
          ${inlineAnsHtml}
        </div>
      `;
    }).join('');

    varSecHtml = `
      <div class="a4-section-heading">
        ${sNum}、同源变式与拔高压轴题（本大题共 ${paper.variants.length} 小题，共 ${varScoreSum} 分）
      </div>
      ${itemsHtml}
    `;
  }

  // 4. 卷末独立「参考答案、秒杀口诀与评分标准页」（当 answerMode === 'END_PAGE' 时生成，打印时自动分页）
  let endAnswerPageHtml = '';
  if (pg.answerMode === 'END_PAGE') {
    let ansQIdx = 0;
    const quickChoiceCells = paper.choices.map(item => {
      ansQIdx += 1;
      return `<span style="display:inline-block;min-width:76px;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;font-weight:800;">${ansQIdx}. <strong style="color:#e11d48;">${item.correctLetter}</strong></span>`;
    }).join('');

    const quickTfCells = paper.tfs.map(item => {
      ansQIdx += 1;
      return `<span style="display:inline-block;min-width:76px;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;font-weight:800;">${ansQIdx}. <strong style="color:${item.tfCorrect ? '#15803d' : '#e11d48'};">${item.tfCorrect ? '✓ 对' : '× 错'}</strong></span>`;
    }).join('');

    let detailQIdx = 0;
    const allDetailsHtml = [
      ...paper.choices.map(it => ({ ...it, _kind: 'CHOICE' })),
      ...paper.tfs.map(it => ({ ...it, _kind: 'TF' })),
      ...paper.mains.map(it => ({ ...it, _kind: 'MAIN' })),
      ...paper.variants.map(it => ({ ...it, _kind: 'VARIANT' }))
    ].map(item => {
      detailQIdx += 1;
      const isRealExamWeak = (item.kp && (item.kp.status || '').includes('未掌握'));
      const realExamTag = isRealExamWeak
        ? `<span style="background:#ffe4e6;color:#e11d48;font-size:11.5px;font-weight:900;padding:1px 7px;border-radius:999px;margin-left:6px;">🎯 靶向若婷实测薄弱点</span>`
        : '';
      const rawSkills = (item.kp && item.kp.sections && item.kp.sections.refSkills) ? item.kp.sections.refSkills : '';
      const firstSkillLine = rawSkills
        .split(/\r?\n/)
        .map(l => l.trim())
        .find(l => l.includes('解题方法'));

      if (item._kind === 'CHOICE' || item._kind === 'TF') {
        const ansLabel = item._kind === 'CHOICE' ? item.correctLetter : (item.tfCorrect ? '✓ 正确' : '× 错误');
        return `
          <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed #e2e8f0;font-size:13.5px;">
            <div>
              <strong>第 ${detailQIdx} 题（${item.score}分）：【答案：${ansLabel}】</strong>
              <span style="color:#64748b;margin-left:8px;">（对应单元：${escapeHtml(item.chapter)} — ${escapeHtml(item.corePoint)}）</span>
              ${realExamTag}
            </div>
            ${item.explanation ? `<div style="margin-top:3px;color:#334155;"><strong>解析与口诀：</strong><span class="md-rendered" style="display:inline;">${formatSimpleMarkdown(item.explanation)}</span></div>` : ''}
            ${firstSkillLine ? `<div style="margin-top:2px;font-size:12.5px;color:#4f46e5;"><span class="md-rendered" style="display:inline;">${formatSimpleMarkdown(firstSkillLine.replace(/^[-*]\s*/, ''))}</span></div>` : ''}
          </div>
        `;
      }
      return `
        <div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px dashed #cbd5e1;font-size:14px;">
          <div style="font-weight:900;color:#0f172a;margin-bottom:4px;">
            第 ${detailQIdx} 题（${item.score}分 · ${item._kind === 'VARIANT' ? '变式拔高' : '核心母题'}）：【${escapeHtml(item.chapter)} — ${escapeHtml(item.corePoint)}】
            ${realExamTag}
          </div>
          ${item.mnemonic ? `<div style="color:#be185d;font-size:13px;margin-bottom:4px;"><strong>💡 秒杀口诀：</strong>${escapeHtml(item.mnemonic)}</div>` : ''}
          <div class="md-rendered" style="background:#f8fafc;padding:8px 12px;border-radius:8px;">
            ${formatSimpleMarkdown(item.answerText)}
          </div>
          ${firstSkillLine ? `<div style="color:#4f46e5;font-size:12.5px;margin-top:4px;"><span class="md-rendered" style="display:inline;">${formatSimpleMarkdown(firstSkillLine.replace(/^[-*]\s*/, ''))}</span></div>` : ''}
          ${item.errorReason ? `<div style="color:#b91c1c;font-size:12.5px;margin-top:4px;"><strong>⚠️ 评分防坑提醒：</strong>${escapeHtml(item.errorReason)}</div>` : ''}
        </div>
      `;
    }).join('');

    endAnswerPageHtml = `
      <div class="a4-answer-key-page">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:20px;font-weight:900;color:#0f172a;">🔑 《${escapeHtml(paper.title)}》参考答案与解析</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:4px;">（打印时本页将自动另起一页，便于家长批改或考后自查订正）</div>
        </div>

        ${(paper.choices.length > 0 || paper.tfs.length > 0) ? `
          <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:12px;padding:12px 16px;margin-bottom:18px;">
            <div style="font-size:13.5px;font-weight:900;color:#0f172a;margin-bottom:8px;">⚡ 客观题 10 秒速查批改表：</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${quickChoiceCells}
              ${quickTfCells}
            </div>
          </div>
        ` : ''}

        <div style="font-size:15px;font-weight:900;color:#0f172a;margin-bottom:10px;">📖 逐题详解、秒杀口诀与评分要点：</div>
        ${allDetailsHtml}
      </div>
    `;
  }

  return `
    <!-- 顶部组卷工作台（打印时自动隐藏） -->
    <div class="paper-studio-console no-print">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:20px;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>🖨️ 全科「按单元自由选题组卷 · 导出与 A4 打印中心」</span>
            <span class="badge status-green">已选 ${paper.selectedUnitCount}/${paper.totalUnitCount} 个单元 · 共 ${paper.totalQuestions} 题 (${paper.totalScore}分)</span>
          </div>
          <div style="font-size:13.5px;color:#475569;margin-top:4px;">
            勾选要考察的一个或多个单元 ➔ 选择题型配比 ➔ 一键 <strong>A4 打印 / 导出 PDF / 导出 Word(.doc) / 存入 Obsidian</strong>！
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:800;color:#475569;">学期：</span>
          <select class="paper-config-select" onchange="switchPaperGenSemester(this.value)">
            ${semOptsHtml}
          </select>
        </div>
      </div>

      <!-- 第 1 步：九大学科切换胶囊 -->
      <div style="font-size:12.5px;font-weight:900;color:#475569;margin-bottom:6px;">STEP 1 · 选择科目（九科全支持）：</div>
      <div class="paper-subj-pills">
        ${subjPillsHtml}
      </div>

      <!-- 第 2 步：勾选要出题的单元 -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px;">
        <div style="font-size:12.5px;font-weight:900;color:#475569;">
          STEP 2 · 勾选本次要考察的单元（支持单选某单元，或多选几个单元联合组卷）：
        </div>
        <div class="drill-header-actions-grid cols-3">
          <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="batchSelectPaperUnits('TAUGHT')">🏫 已学/同步</button>
          <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;" onclick="batchSelectPaperUnits('ALL')">✅ 全选 (${chapters.length}单元)</button>
          <button class="zen-btn-ghost" style="padding:4px 10px;font-size:12.5px;border-color:#fda4af;color:#e11d48;" onclick="batchSelectPaperUnits('WEAK')">🔥 含薄弱点</button>
        </div>
      </div>

      <div class="paper-unit-grid">
        ${unitCardsHtml}
      </div>

      <!-- 第 3 步：题型配比与卷面设置 -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <div style="font-size:12.5px;font-weight:900;color:#475569;">STEP 3 · 试卷规格与题型配比（自动折算 100 分制）：</div>
        <div class="comm-segmented-bar cols-3">
          <button class="comm-seg-btn ${pg.preset === 'QUICK' ? 'active' : ''}" onclick="applyPaperPreset('QUICK')">⚡ 随堂卷 (12题)</button>
          <button class="comm-seg-btn ${pg.preset === 'STANDARD' ? 'active' : ''}" onclick="applyPaperPreset('STANDARD')">🏆 标准卷 (17题)</button>
          <button class="comm-seg-btn ${pg.preset === 'EXAM' ? 'active' : ''}" onclick="applyPaperPreset('EXAM')">👑 综合卷 (24题)</button>
        </div>
      </div>

      <div class="paper-config-row">
        <div class="paper-config-item">
          <label>一、单项选择题数</label>
          <select class="paper-config-select" onchange="updatePaperGenOption('choiceCount', this.value)">
            ${[0, 4, 6, 8, 10, 12, 15].map(n => `<option value="${n}" ${pg.choiceCount === n ? 'selected' : ''}>${n} 道选择题</option>`).join('')}
          </select>
        </div>
        <div class="paper-config-item">
          <label>二、判断辨析题数</label>
          <select class="paper-config-select" onchange="updatePaperGenOption('tfCount', this.value)">
            ${[0, 2, 4, 5, 6, 8, 10].map(n => `<option value="${n}" ${pg.tfCount === n ? 'selected' : ''}>${n} 道判断题</option>`).join('')}
          </select>
        </div>
        <div class="paper-config-item">
          <label>三、核心母题解答题数</label>
          <select class="paper-config-select" onchange="updatePaperGenOption('mainSubjCount', this.value)">
            ${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${pg.mainSubjCount === n ? 'selected' : ''}>${n} 道解答母题</option>`).join('')}
          </select>
        </div>
        <div class="paper-config-item">
          <label>四、同源变式拔高题数</label>
          <select class="paper-config-select" onchange="updatePaperGenOption('variantSubjCount', this.value)">
            ${[0, 1, 2, 3, 4].map(n => `<option value="${n}" ${pg.variantSubjCount === n ? 'selected' : ''}>${n} 道变式压轴题</option>`).join('')}
          </select>
        </div>
        <div class="paper-config-item">
          <label>抽题策略</label>
          <select class="paper-config-select" onchange="updatePaperGenOption('strategy', this.value)">
            <option value="SMART" ${pg.strategy === 'SMART' ? 'selected' : ''}>🎯 薄弱与未掌握优先</option>
            <option value="UNIFORM" ${pg.strategy === 'UNIFORM' ? 'selected' : ''}>🎲 各单元均匀轮询覆盖</option>
            <option value="ADVANCED" ${pg.strategy === 'ADVANCED' ? 'selected' : ''}>👑 中档与压轴进阶优先</option>
          </select>
        </div>
        <div class="paper-config-item">
          <label>答案与解析排版</label>
          <select class="paper-config-select" onchange="updatePaperGenOption('answerMode', this.value)">
            <option value="END_PAGE" ${pg.answerMode === 'END_PAGE' ? 'selected' : ''}>📄 卷末附独立答案页 (推荐打印)</option>
            <option value="HIDDEN" ${pg.answerMode === 'HIDDEN' ? 'selected' : ''}>📝 纯学生空白卷 (隐藏答案)</option>
            <option value="INLINE" ${pg.answerMode === 'INLINE' ? 'selected' : ''}>🔑 教师详解卷 (题下紧跟答案)</option>
          </select>
        </div>
      </div>

      <!-- 第 4 步：一键组卷、导出与打印操作栏 -->
      <div class="paper-bottom-action-bar">
        <div class="drill-header-actions-grid cols-2">
          <button class="duo-btn primary" onclick="regeneratePaperWithNewSeed()">
            🎲 <span>换题重组 (第${pg.paperVersion}套)</span>
          </button>
          <button class="duo-btn indigo" onclick="startOnlineQuizFromPaper()">
            ⚡ <span>在线闯关本卷</span>
          </button>
        </div>

        <div class="drill-header-actions-grid cols-2">
          <button class="duo-btn primary" style="background:linear-gradient(135deg,#059669,#10b981);border-color:#065f46;" onclick="printCurrentPaper()">
            🖨️ <span>A4打印 / 存PDF</span>
          </button>
          <button class="zen-btn-ghost" style="border-color:#3b82f6;color:#1d4ed8;font-weight:900;" onclick="exportPaperAsWord()">
            📘 <span>导出 Word</span>
          </button>
          <button class="zen-btn-ghost" style="border-color:#8b5cf6;color:#6d28d9;font-weight:900;" onclick="savePaperToObsidian()">
            💾 <span>存 Obsidian</span>
          </button>
          <button class="zen-btn-ghost" onclick="exportPaperAsMarkdown()">
            ⬇️ <span>下载 .md</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 下方：A4 仿真标准试卷预览舞台（所见即所得，点击打印直接输出此区域） -->
    <div id="a4PaperSheetDom" class="a4-paper-sheet">
      <div class="a4-paper-header">
        <div class="a4-paper-seal-line">
          ………………………… 密 ………………………… 封 ………………………… 线 …………………………
        </div>
        <div class="a4-paper-main-title">${escapeHtml(paper.title)}</div>
        <div class="a4-paper-sub-title">${escapeHtml(paper.subtitle)}</div>
        <div class="a4-student-info-bar">
          <span>姓名：<u>&nbsp;&nbsp;王若婷&nbsp;&nbsp;</u></span>
          <span>班级：<u>&nbsp;&nbsp;六年级四班&nbsp;&nbsp;</u></span>
          <span>日期：<u>&nbsp;&nbsp;${paper.dateStr}&nbsp;&nbsp;</u></span>
          <span>用时：<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> 分钟</span>
          <span>总分：<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> / ${paper.totalScore} 分</span>
        </div>

        <table class="a4-score-table">
          <thead>
            <tr>
              <th>题号</th>
              ${paper.choices.length > 0 ? `<th>一、选择题 (${chScoreSum}分)</th>` : ''}
              ${paper.tfs.length > 0 ? `<th>二、判断题 (${tfScoreSum}分)</th>` : ''}
              ${paper.mains.length > 0 ? `<th>三、解答题 (${mainScoreSum}分)</th>` : ''}
              ${paper.variants.length > 0 ? `<th>四、变式拔高 (${varScoreSum}分)</th>` : ''}
              <th>总分 (${paper.totalScore}分)</th>
              <th>复盘签名</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>得分</strong></td>
              ${paper.choices.length > 0 ? '<td>&nbsp;</td>' : ''}
              ${paper.tfs.length > 0 ? '<td>&nbsp;</td>' : ''}
              ${paper.mains.length > 0 ? '<td>&nbsp;</td>' : ''}
              ${paper.variants.length > 0 ? '<td>&nbsp;</td>' : ''}
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${choiceSecHtml}
      ${tfSecHtml}
      ${mainSecHtml}
      ${varSecHtml}

      ${endAnswerPageHtml}
    </div>
  `;
}
// ============================================================================
// 🖨️ 导出与打印套件：A4 标准打印 / 存为 PDF / 导出 Word(.doc) / 归档 Obsidian(.md)
// ============================================================================

function printCurrentPaper() {
  const sheetEl = document.getElementById('a4PaperSheetDom');
  if (!sheetEl) {
    window.print();
    return;
  }

  const pg = ensurePaperGenState();
  const paper = pg.currentPaper || buildGeneratedPaper();
  const printWin = window.open('', '_blank', 'width=980,height=860');

  // 若浏览器拦截弹窗，直接回退到本页 @media print 原生打印
  if (!printWin) {
    window.print();
    return;
  }

  const htmlDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(paper.title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/styles.css" />
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 15mm;
    }
    body {
      background: #ffffff !important;
      color: #000000 !important;
      margin: 0;
      padding: 0;
    }
    .a4-paper-sheet {
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
  </style>
</head>
<body>
  <div class="a4-paper-sheet">
    ${sheetEl.innerHTML}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 280);
    };
  </script>
</body>
</html>`;

  printWin.document.open();
  printWin.document.write(htmlDoc);
  printWin.document.close();
}

function exportPaperAsWord() {
  const sheetEl = document.getElementById('a4PaperSheetDom');
  const pg = ensurePaperGenState();
  const paper = pg.currentPaper || buildGeneratedPaper();
  if (!sheetEl || !paper) return;

  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(paper.title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: "SimSun", "Songti SC", "Microsoft YaHei", serif;
      font-size: 11.5pt;
      line-height: 1.65;
      color: #000000;
    }
    .a4-paper-header { text-align: center; border-bottom: 2px double #000; padding-bottom: 10pt; margin-bottom: 14pt; }
    .a4-paper-seal-line { font-size: 9pt; color: #555; margin-bottom: 6pt; }
    .a4-paper-main-title { font-size: 18pt; font-weight: bold; margin: 4pt 0; }
    .a4-paper-sub-title { font-size: 10.5pt; color: #333; margin-bottom: 8pt; }
    .a4-student-info-bar span { margin: 0 8pt; font-weight: bold; }
    .a4-score-table { width: 100%; border-collapse: collapse; margin-top: 8pt; }
    .a4-score-table th, .a4-score-table td { border: 1px solid #000; padding: 4pt 6pt; text-align: center; font-size: 10pt; }
    .a4-section-heading { font-size: 12.5pt; font-weight: bold; background: #f1f5f9; padding: 5pt 8pt; margin: 14pt 0 8pt; border-left: 4px solid #000; }
    .a4-question-item { margin-bottom: 12pt; }
    .a4-question-stem { font-weight: bold; margin-bottom: 4pt; }
    .a4-options-grid { margin-left: 16pt; }
    .a4-work-space { border: 1px dashed #888; height: 85pt; margin: 6pt 0 10pt 14pt; padding: 6pt; }
    .a4-answer-key-page { page-break-before: always; margin-top: 24pt; border-top: 2px dashed #444; padding-top: 14pt; }
  </style>
</head>
<body>
  ${sheetEl.innerHTML}
</body>
</html>`;

  const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
  const fileName = `${paper.semester}_${paper.subject}_单元检测卷_第${paper.version}套_${paper.dateStr}.doc`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === 'function') {
    showToast(`📘 已导出 Word 试卷：${fileName}`);
  }
}

function buildPaperMarkdownText(paper) {
  const lines = [];
  lines.push('---');
  lines.push(`试卷标题: "${paper.title}"`);
  lines.push(`科目: "${paper.subject}"`);
  lines.push(`学期: "${paper.semester}"`);
  lines.push(`考察范围: "${paper.unitNamesShort}"`);
  lines.push(`生成日期: "${paper.dateStr}"`);
  lines.push(`总题量: ${paper.totalQuestions}`);
  lines.push(`满分: ${paper.totalScore}`);
  lines.push('tags:');
  lines.push('  - 自动组卷');
  lines.push(`  - ${paper.subject}`);
  lines.push(`  - ${paper.semester}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${paper.title}`);
  lines.push('');
  lines.push(`> **${paper.subtitle}**`);
  lines.push(`> **姓名**：王若婷 ｜ **班级**：六年级四班 ｜ **日期**：${paper.dateStr} ｜ **得分**：________ / ${paper.totalScore} 分`);
  lines.push('');

  let qNum = 0;
  const letters = ['A', 'B', 'C', 'D'];

  if (paper.choices.length > 0) {
    const sum = paper.choices.reduce((s, x) => s + x.score, 0);
    lines.push(`## 一、单项选择题（共 ${paper.choices.length} 小题，共 ${sum} 分）`);
    lines.push('');
    paper.choices.forEach(item => {
      qNum += 1;
      lines.push(`**${qNum}. （${item.score}分）** ${item.prompt} （    ）`);
      item.options.forEach((opt, idx) => {
        lines.push(`- ${letters[idx]}. ${opt}`);
      });
      lines.push('');
    });
  }

  if (paper.tfs.length > 0) {
    const sum = paper.tfs.reduce((s, x) => s + x.score, 0);
    lines.push(`## 二、核心概念判断辨析题（共 ${paper.tfs.length} 小题，共 ${sum} 分）`);
    lines.push('');
    paper.tfs.forEach(item => {
      qNum += 1;
      lines.push(`**${qNum}. （${item.score}分）** ${item.prompt} （    ）[填 ✓ 或 ×]`);
      lines.push('');
    });
  }

  if (paper.mains.length > 0) {
    const sum = paper.mains.reduce((s, x) => s + x.score, 0);
    lines.push(`## 三、核心母题与综合解答题（共 ${paper.mains.length} 小题，共 ${sum} 分）`);
    lines.push('');
    paper.mains.forEach(item => {
      qNum += 1;
      lines.push(`### ${qNum}. （${item.score}分 · 【${item.chapter} — ${item.corePoint}】）`);
      lines.push(item.prompt);
      lines.push('');
      lines.push('> **作答区**：');
      lines.push('>');
      lines.push('>');
      lines.push('');
    });
  }

  if (paper.variants.length > 0) {
    const sum = paper.variants.reduce((s, x) => s + x.score, 0);
    lines.push(`## 四、同源变式与拔高压轴题（共 ${paper.variants.length} 小题，共 ${sum} 分）`);
    lines.push('');
    paper.variants.forEach(item => {
      qNum += 1;
      lines.push(`### ${qNum}. （${item.score}分 · 🌟同源变式拔高 · 【${item.corePoint}】）`);
      lines.push(item.prompt);
      lines.push('');
      lines.push('> **作答区**：');
      lines.push('>');
      lines.push('>');
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');
  lines.push(`## 🔑 参考答案、秒杀口诀与评分解析`);
  lines.push('');

  let ansNum = 0;
  const allItems = [
    ...paper.choices.map(it => ({ ...it, _kind: 'CHOICE' })),
    ...paper.tfs.map(it => ({ ...it, _kind: 'TF' })),
    ...paper.mains.map(it => ({ ...it, _kind: 'MAIN' })),
    ...paper.variants.map(it => ({ ...it, _kind: 'VARIANT' }))
  ];

  allItems.forEach(item => {
    ansNum += 1;
    if (item._kind === 'CHOICE' || item._kind === 'TF') {
      const ans = item._kind === 'CHOICE' ? item.correctLetter : (item.tfCorrect ? '✓ 正确' : '× 错误');
      lines.push(`- **第 ${ansNum} 题（${item.score}分）**：**【${ans}】**（考点：${item.chapter} · ${item.corePoint}）`);
      if (item.explanation) lines.push(`  - **解析/口诀**：${item.explanation}`);
    } else {
      lines.push(`### 第 ${ansNum} 题（${item.score}分 · ${item.corePoint}）`);
      if (item.mnemonic) lines.push(`- **💡 秒杀口诀**：${item.mnemonic}`);
      lines.push(`- **标准答案与步骤**：\n${item.answerText}`);
      if (item.errorReason) lines.push(`- **⚠️ 防坑提醒**：${item.errorReason}`);
      lines.push('');
    }
  });

  return lines.join('\n');
}

function exportPaperAsMarkdown() {
  const pg = ensurePaperGenState();
  const paper = pg.currentPaper || buildGeneratedPaper();
  const mdText = buildPaperMarkdownText(paper);
  const fileName = `${paper.dateStr}_${paper.semester}_${paper.subject}_单元检测卷_第${paper.version}套.md`;

  const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === 'function') {
    showToast(`⬇️ 已下载 Markdown 试卷：${fileName}`);
  }
}

async function savePaperToObsidian() {
  const pg = ensurePaperGenState();
  const paper = pg.currentPaper || buildGeneratedPaper();
  const mdText = buildPaperMarkdownText(paper);
  const fileName = `${paper.dateStr}_${paper.semester}_${paper.subject}_单元检测卷_第${paper.version}套.md`;

  try {
    const res = await fetch('/api/save-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, markdown: mdText })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (typeof burstMagicConfetti === 'function') burstMagicConfetti();
    if (typeof showToast === 'function') {
      showToast(`💾 已归档至 Obsidian 知识库：${json.relPath}`);
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('❌ 保存失败：' + err.message);
    }
  }
}

function startOnlineQuizFromPaper() {
  const pg = ensurePaperGenState();
  const paper = pg.currentPaper || buildGeneratedPaper();
  if (!paper) return;

  const queue = [];
  paper.choices.forEach((c, idx) => {
    if (c.kp) {
      queue.push({
        ...c.kp,
        _subQIndex: idx,
        _subQuizItem: {
          type: 'CHOICE',
          prompt: c.prompt,
          options: c.options,
          correctIdx: c.correctIdx,
          explanation: c.explanation
        }
      });
    }
  });
  paper.tfs.forEach((t, idx) => {
    if (t.kp) {
      queue.push({
        ...t.kp,
        _subQIndex: 100 + idx,
        _subQuizItem: {
          type: 'TF',
          prompt: t.prompt,
          tfCorrect: t.tfCorrect,
          explanation: t.explanation
        }
      });
    }
  });
  if (queue.length === 0) {
    paper.mains.forEach(m => { if (m.kp) queue.push(m.kp); });
  }
  if (queue.length === 0) return;

  if (typeof playCommercialSound === 'function') playCommercialSound('open');
  STATE.quiz.semester = paper.semester;
  STATE.quiz.subject = paper.subject;
  STATE.quiz.studyStyle = 'quest';
  STATE.quiz.rapidFormat = 'MIXED';
  STATE.quiz.sourceContext = { type: 'PAPER', pool: queue.map(x => x) };
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
}
