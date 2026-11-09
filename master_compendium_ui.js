// =========================================================================
// 若婷学习舱 · 九科王牌提分宝典 & 线上互动标记知识导图引擎 (master_compendium_ui.js)
// 功能：
// 1. 线上互动知识导图树（科目根 ➔ 四大支柱分支 ➔ 专题组 ➔ 可标记知识节点）
// 2. 1101视频同款「A4双栏红字划线讲义」在线浏览与红字挖空自测模式
// 3. 节点可操作标记：三态切换（⚪待背诵 / 🟡易错盯防 / ✅已吃透）+ ⭐星标 + 📝批注
// 4. 实时同步至 Obsidian `80_考试与复习/九科王牌提分宝典_可打印汇总/📊线上知识导图标记进度与重点批注看板.md`
// 5. 支持按「全部 / 仅未吃透与易错 / 仅星标 / 红字挖空默写卷」一键 A4 打印、导出 Word 与 Markdown
// =========================================================================

window.MASTER_MAP_STATE = {
  subject: '语文',        // 当前选中的科目，或 'ALL'
  viewMode: 'MINDMAP',    // 'MINDMAP' (🗺️互动知识导图树) | 'SHEET' (📄视频同款双栏红字讲义)
  pillarFilter: 'ALL',    // 'ALL' | 'BASE' | 'SOP' | 'TRAP' | 'VAULT'
  statusFilter: 'ALL',    // 'ALL' | 'UNMASTERED' | 'REVIEW' | 'DONE' | 'STARRED'
  clozeMode: false,       // 🙈 红字挖空自测模式
  searchQuery: '',
  collapsedGroups: {},    // groupKey -> boolean
  editingNoteId: null,    // 当前正在编辑批注的节点 ID
  marks: {},              // id -> { status: 'todo'|'review'|'done', starred: bool, note: string }
  loadedFromServer: false
};

// 初始化加载本地与服务端标记数据
(function initMasterMarks() {
  try {
    const raw = localStorage.getItem('RUOTING_MASTER_MARKS_V1');
    if (raw) {
      window.MASTER_MAP_STATE.marks = JSON.parse(raw) || {};
    }
  } catch (e) {}

  fetch('/api/master-marks')
    .then(r => r.json())
    .then(res => {
      if (res && res.ok && res.marks) {
        window.MASTER_MAP_STATE.marks = Object.assign({}, window.MASTER_MAP_STATE.marks, res.marks);
        window.MASTER_MAP_STATE.loadedFromServer = true;
        try {
          localStorage.setItem('RUOTING_MASTER_MARKS_V1', JSON.stringify(window.MASTER_MAP_STATE.marks));
        } catch (e) {}
        if (typeof STATE !== 'undefined' && STATE.activeTab === 'mastermap') {
          renderMasterMapView();
        }
      }
    })
    .catch(() => {});
})();

function getNodeMark(id) {
  const m = window.MASTER_MAP_STATE.marks[id];
  return {
    status: (m && m.status) || 'todo', // 'todo' | 'review' | 'done'
    starred: Boolean(m && m.starred),
    note: (m && m.note) || ''
  };
}

function saveNodeMark(id, patch, metaInfo) {
  const cur = getNodeMark(id);
  const next = {
    id,
    subject: (metaInfo && metaInfo.subject) || cur.subject || window.MASTER_MAP_STATE.subject || '',
    category: (metaInfo && metaInfo.category) || cur.category || '',
    title: (metaInfo && metaInfo.title) || cur.title || id,
    status: patch.status !== undefined ? patch.status : cur.status,
    starred: patch.starred !== undefined ? Boolean(patch.starred) : cur.starred,
    note: patch.note !== undefined ? String(patch.note) : cur.note,
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
  };
  window.MASTER_MAP_STATE.marks[id] = next;
  try {
    localStorage.setItem('RUOTING_MASTER_MARKS_V1', JSON.stringify(window.MASTER_MAP_STATE.marks));
  } catch (e) {}

  fetch('/api/master-marks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next)
  }).catch(() => {});
}

// 五四制 8 学期元数据映射表（严禁任何学期静默回退到初一上）
const MASTER_SEMESTER_LIST = [
  { code: '初一上', pill: '初一上(六上·在读)', fullLabel: '五四制初一上（六年级上册）', gradeName: '六年级上册' },
  { code: '初一下', pill: '初一下(六下)', fullLabel: '五四制初一下（六年级下册）', gradeName: '六年级下册' },
  { code: '初二上', pill: '初二上(七上)', fullLabel: '五四制初二上（七年级上册）', gradeName: '七年级上册' },
  { code: '初二下', pill: '初二下(七下)', fullLabel: '五四制初二下（七年级下册）', gradeName: '七年级下册' },
  { code: '初三上', pill: '初三上(八上)', fullLabel: '五四制初三上（八年级上册）', gradeName: '八年级上册' },
  { code: '初三下', pill: '初三下(八下)', fullLabel: '五四制初三下（八年级下册）', gradeName: '八年级下册' },
  { code: '初四上', pill: '初四上(九上)', fullLabel: '五四制初四上（九年级上册）', gradeName: '九年级上册' },
  { code: '初四下', pill: '初四下(九下)', fullLabel: '五四制初四下（九年级下册）', gradeName: '九年级下册' }
];

const MASTER_SEMESTER_MAP = {};
MASTER_SEMESTER_LIST.forEach(s => { MASTER_SEMESTER_MAP[s.code] = s; });

function switchMasterMapSemester(semCode) {
  if (typeof setStageFocus === 'function') {
    setStageFocus(semCode);
  } else if (typeof STATE !== 'undefined') {
    STATE.stageFocus = semCode;
  }
  renderMasterMapView();
}

// 结合 9科×8学期全量宝典数据库 + 本地 Obsidian 知识库动态构建当前所选学期四大支柱（严禁任何学期回退到初一上！）
function getEnrichedSubjectCompendium(subjectName, stageCode) {
  const baseList = window.MASTER_COMPENDIUM_DATA || [];
  const found = baseList.find(s => s.subject === subjectName) || baseList[0];
  if (!found) return null;

  const subjObj = JSON.parse(JSON.stringify(found));
  const rawStage = stageCode || ((typeof STATE !== 'undefined' && STATE.stageFocus) ? STATE.stageFocus : '初一上');
  const curStage = (rawStage && rawStage !== 'ALL') ? rawStage : '初一上';
  const semMeta = MASTER_SEMESTER_MAP[curStage] || MASTER_SEMESTER_MAP['初一上'];

  const allKps = (typeof STATE !== 'undefined' && STATE.data && Array.isArray(STATE.data.knowledgePoints))
    ? STATE.data.knowledgePoints
    : [];

  // 严格只取当前所选学期 (curStage) 的知识点，绝不回退到初一上！
  const stageKps = allKps.filter(k => k.subject === subjObj.subject && k.semester === curStage);
  const verifiedStageKps = stageKps.filter(k => !k.isUnverified && !(k.status || '').includes('🔒待精校'));

  const byChapter = {};
  stageKps.forEach(kp => {
    const ch = kp.chapter || `${semMeta.fullLabel}核心单元`;
    if (!byChapter[ch]) byChapter[ch] = [];
    byChapter[ch].push(kp);
  });
  const chapterNames = Object.keys(byChapter);

  // 1. 先加载当前学期对应的第①②③支柱（BASE / SOP / TRAP）
  if (curStage !== '初一上') {
    subjObj.topNoteGallery = [];
    const semData = (subjObj.semesterMap && subjObj.semesterMap[curStage])
      || (window.SEMESTER_COMPENDIUM_MAP && window.SEMESTER_COMPENDIUM_MAP[subjObj.subject] && window.SEMESTER_COMPENDIUM_MAP[subjObj.subject][curStage]);

    if (semData && Array.isArray(semData.pillars)) {
      subjObj.stageTag = semData.stageTag || `${semMeta.fullLabel} · 同步精编提分宝典`;
      subjObj.summary = semData.summary || `严格对齐山东五四学制 ${semMeta.fullLabel}《${subjObj.subject}》核心必背底子、题型固定答题SOP与反直觉易错排雷`;
      subjObj.pillars = JSON.parse(JSON.stringify(semData.pillars));
    }

    // 若本学期有已精校的主观题真题（如语文初一下、英语初三上），附加进第②支柱 SOP
    const verifiedWithMainQ = verifiedStageKps.filter(k => k.questionMain && k.answerText && !String(k.questionMain).includes('🔒待精校'));
    if (verifiedWithMainQ.length > 0 && subjObj.pillars[1] && Array.isArray(subjObj.pillars[1].groups)) {
      subjObj.pillars[1].groups.push({
        groupTitle: `${semMeta.fullLabel} · 课内高频主观题标准答题样板（精选 ${Math.min(6, verifiedWithMainQ.length)} 题）`,
        items: verifiedWithMainQ.slice(0, 6).map(kp => ({
          id: `sop_verified_${curStage}_${kp.id}`,
          kpId: kp.id,
          title: `${kp.corePoint || kp.title} · 典型主观题满分示范`,
          tag: `${curStage}真题示范`,
          text: `**【典型设问】** ${kp.questionMain}\n**【满分答题标准】** {{${kp.answerText}}}`
        }))
      });
    }
  } else {
    // curStage === '初一上' 时，对暂未开课的地理、物理、化学更新 stageTag 先修提示
    if (['地理', '物理', '化学'].includes(subjObj.subject)) {
      const openSem = subjObj.subject === '地理' ? '初二上（七年级上册）' : '初三上（八年级上册）';
      subjObj.stageTag = `${semMeta.fullLabel} · 学科先修与核心体系总览（${openSem}正式开课）`;
    }
  }

  // 提取当前学期第①支柱（BASE）与第②支柱（SOP）条目列表，供第四支柱逐课关联本单元核心公式与解题方法
  const baseItemsPool = [];
  const sopItemsPool = [];
  if (subjObj.pillars[0] && Array.isArray(subjObj.pillars[0].groups)) {
    subjObj.pillars[0].groups.forEach(g => (g.items || []).forEach(it => baseItemsPool.push(it)));
  }
  if (subjObj.pillars[1] && Array.isArray(subjObj.pillars[1].groups)) {
    subjObj.pillars[1].groups.forEach(g => (g.items || []).forEach(it => sopItemsPool.push(it)));
  }

  // 2. 构建第四支柱（④ 本地单元口诀与教材结构导图 —— 严格对应 curStage，且每课关联真实单元核心考点与解题指导）
  let vaultGroups = [];
  if (stageKps.length > 0) {
    vaultGroups = chapterNames.map((ch, cIdx) => {
      // 为当前章节匹配对应的 BASE 单元核心条目与 SOP 解题模板
      const matchedBase = baseItemsPool.find(it => it.title.includes(ch) || (it.tag && ch.includes(it.tag)))
        || baseItemsPool[cIdx % Math.max(1, baseItemsPool.length)];
      const matchedSop = sopItemsPool[cIdx % Math.max(1, sopItemsPool.length)];

      const items = byChapter[ch].map((kp, kIdx) => {
        const resolvedTitle = String(kp.title || kp.corePoint || kp.lessonTitle || '核心课时').trim();
        const isLocked = Boolean(kp.isUnverified || (kp.status || '').includes('🔒待精校'));
        const resolvedAnchor = String(kp.anchor || kp.understanding || '').trim();
        const rawPitfalls = Array.isArray(kp.pitfalls) && kp.pitfalls.length > 0
          ? kp.pitfalls.slice(0, 2).join('；')
          : String(kp.pitfalls || kp.habitWarning || kp.errorReason || '').trim();
        const hasRealMnemonic = kp.mnemonic && !String(kp.mnemonic).includes('待开课精校');

        if (!isLocked) {
          const mnemonicStr = kp.mnemonic ? `🎯 **秒杀口诀**：{{${String(kp.mnemonic).replace(/\n+/g, ' ')}}}` : '';
          const anchorStr = resolvedAnchor ? `💡 **核心精讲**：${resolvedAnchor.replace(/\n+/g, ' ').slice(0, 180)}` : '';
          const pitfallStr = rawPitfalls ? `⚠️ **易错防坑**：{{${rawPitfalls.replace(/\n+/g, ' ').slice(0, 160)}}}` : '';
          const parts = [mnemonicStr, anchorStr, pitfallStr].filter(Boolean);
          return {
            id: `vault_${kp.id}`,
            kpId: kp.id,
            title: resolvedTitle,
            tag: `${curStage} · ✅已精校`,
            text: parts.length > 0 ? parts.join('\n') : (matchedBase ? matchedBase.text : '')
          };
        } else if (hasRealMnemonic) {
          return {
            id: `vault_${kp.id}`,
            title: resolvedTitle,
            tag: `${curStage} · 单元精讲`,
            text: `🎯 **核心必背锚点**：{{${String(kp.mnemonic).replace(/\n+/g, ' ')}}}\n💡 **课文主旨导读**：${resolvedAnchor.replace(/\n+/g, ' ')}\n🔒 **同步题库状态**：本课属于【${semMeta.fullLabel} · ${ch}】真实教材课时（🔒 同步闯关题待开课解锁）。`
          };
        } else {
          const unitBaseItem = baseItemsPool[(cIdx + kIdx) % Math.max(1, baseItemsPool.length)] || matchedBase;
          const unitSopItem = sopItemsPool[(cIdx + kIdx) % Math.max(1, sopItemsPool.length)] || matchedSop;
          const baseSnippet = unitBaseItem ? unitBaseItem.text.split('\n')[0] : '';
          const sopSnippet = unitSopItem ? unitSopItem.title : '';
          return {
            id: `vault_${kp.id}`,
            title: resolvedTitle,
            tag: `${curStage} · ${ch}`,
            text: `📌 **本单元核心必背（${unitBaseItem ? unitBaseItem.title : ch}）**：${baseSnippet}\n🧭 **关联题型SOP**：请重点掌握第②支柱【${sopSnippet}】标准解题步骤（🔒 本课独立闯关真题待进入 ${curStage} 后解锁）。`
          };
        }
      });
      return {
        groupTitle: `📚 本地知识库 · ${subjObj.subject}（${semMeta.fullLabel} · ${ch} · 共${items.length}课）`,
        items
      };
    });
  } else {
    const openRange = subjObj.subject === '地理'
      ? '初二~初三（七~八年级）'
      : (subjObj.subject === '生物' ? '初一~初三（六~八年级）' : '初三~初四（八~九年级）');
    const previewBase = baseItemsPool[0] ? `\n📌 **本学期核心专题导览（${baseItemsPool[0].title}）**：${baseItemsPool[0].text.split('\n')[0]}` : '';
    vaultGroups = [
      {
        groupTitle: `📌 五四制课表与专题导图说明 · ${semMeta.fullLabel}《${subjObj.subject}》`,
        items: [
          {
            id: `vault_empty_${subjObj.subject}_${curStage}`,
            title: `【${semMeta.fullLabel}】《${subjObj.subject}》五四制学段安排与上方三大支柱使用指南`,
            tag: `${curStage}学段指南`,
            text: `在山东五四学制中，《${subjObj.subject}》同步课本安排在 **${openRange}**，上方第①②③支柱已为您完整配置【${semMeta.fullLabel}】专属的必背底子、答题SOP与易错排雷专题！${previewBase}`
          }
        ]
      }
    ];
  }

  subjObj.pillars.push({
    key: 'VAULT',
    title: `四、 本地 Obsidian 知识库 · ${subjObj.subject}（${semMeta.fullLabel}）真实教材单元与逐课导图`,
    badge: `${curStage}单元导图`,
    groups: vaultGroups
  });

  return subjObj;
}

// 将 {{...}} 转化为红字划线高亮（支持点击显隐的挖空自测模式）
function formatCompendiumRichText(rawText) {
  return String(rawText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{\{([\s\S]+?)\}\}/g, '<span class="mm-red-key" onclick="handleClozeSpanClick(event, this)" title="点击显隐核心结论">$1</span>')
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function handleClozeSpanClick(e, el) {
  if (!window.MASTER_MAP_STATE.clozeMode) return;
  e.stopPropagation();
  el.classList.toggle('is-revealed');
}

function matchesMasterFilter(item, pillarKey, subjName) {
  const st = window.MASTER_MAP_STATE;
  if (st.pillarFilter !== 'ALL' && st.pillarFilter !== pillarKey) return false;

  const mark = getNodeMark(item.id);
  if (st.statusFilter === 'UNMASTERED' && mark.status === 'done') return false;
  if (st.statusFilter === 'REVIEW' && mark.status !== 'review') return false;
  if (st.statusFilter === 'DONE' && mark.status !== 'done') return false;
  if (st.statusFilter === 'STARRED' && !mark.starred) return false;

  if (st.searchQuery && st.searchQuery.trim()) {
    const q = st.searchQuery.trim().toLowerCase();
    const hay = `${subjName} ${item.title} ${item.tag} ${item.text} ${mark.note || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function computeSubjectStats(subjObj) {
  let total = 0, done = 0, review = 0, starred = 0;
  if (!subjObj || !subjObj.pillars) return { total: 0, done: 0, review: 0, starred: 0, pct: 0 };
  subjObj.pillars.forEach(p => {
    p.groups.forEach(g => {
      g.items.forEach(it => {
        total++;
        const m = getNodeMark(it.id);
        if (m.status === 'done') done++;
        if (m.status === 'review') review++;
        if (m.starred) starred++;
      });
    });
  });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, review, starred, pct };
}

function cycleMasterNodeStatus(id, subjName, badgeName, titleText, e) {
  if (e) e.stopPropagation();
  const cur = getNodeMark(id);
  const order = ['todo', 'review', 'done'];
  const nextStatus = order[(order.indexOf(cur.status) + 1) % order.length];
  saveNodeMark(id, { status: nextStatus }, { subject: subjName, category: badgeName, title: titleText });

  const labelMap = {
    todo: '⚪ 已设为：待背诵',
    review: '🟡 已标记：易错需重点盯防（已同步至Obsidian看板）',
    done: '✅ 已打卡：已吃透通关！'
  };
  if (typeof showToast === 'function') showToast(labelMap[nextStatus]);
  renderMasterMapView();
}

function toggleMasterNodeStar(id, subjName, badgeName, titleText, e) {
  if (e) e.stopPropagation();
  const cur = getNodeMark(id);
  const nextStar = !cur.starred;
  saveNodeMark(id, { starred: nextStar }, { subject: subjName, category: badgeName, title: titleText });
  if (typeof showToast === 'function') {
    showToast(nextStar ? '⭐ 已加入「考前必看星标清单」并同步至 Obsidian' : '已取消星标');
  }
  renderMasterMapView();
}

function openMasterNodeNoteEditor(id, e) {
  if (e) e.stopPropagation();
  window.MASTER_MAP_STATE.editingNoteId = (window.MASTER_MAP_STATE.editingNoteId === id) ? null : id;
  renderMasterMapView();
}

function saveMasterNodeNoteFromInput(id, subjName, badgeName, titleText) {
  const input = document.getElementById(`mm-note-input-${id}`);
  const val = input ? input.value.trim() : '';
  saveNodeMark(id, { note: val }, { subject: subjName, category: badgeName, title: titleText });
  window.MASTER_MAP_STATE.editingNoteId = null;
  if (typeof showToast === 'function') showToast('📝 批注已保存并同步至 Obsidian 看板！');
  renderMasterMapView();
}

function toggleMasterGroupCollapse(groupKey) {
  window.MASTER_MAP_STATE.collapsedGroups[groupKey] = !window.MASTER_MAP_STATE.collapsedGroups[groupKey];
  renderMasterMapView();
}

function setMasterAllCollapse(collapsed) {
  const curStage = (typeof STATE !== 'undefined' && STATE.stageFocus && STATE.stageFocus !== 'ALL') ? STATE.stageFocus : '初一上';
  const subjObj = getEnrichedSubjectCompendium(window.MASTER_MAP_STATE.subject, curStage);
  if (!subjObj) return;
  subjObj.pillars.forEach(p => {
    p.groups.forEach((g, idx) => {
      window.MASTER_MAP_STATE.collapsedGroups[`${subjObj.subject}_${p.key}_${idx}`] = collapsed;
    });
  });
  renderMasterMapView();
}

// =========================================================================
// PART 2: 渲染主视图（互动知识导图树 + 视频同款双栏红字讲义 + A4打印/Word/MD导出）
// =========================================================================

function renderMasterMapView() {
  const container = document.getElementById('view-mastermap');
  if (!container) return;

  const st = window.MASTER_MAP_STATE;
  const allSubjs = window.MASTER_COMPENDIUM_DATA || [];
  if (allSubjs.length === 0) {
    container.innerHTML = `<div style="padding:32px;text-align:center;">正在加载九科王牌提分宝典数据...</div>`;
    return;
  }

  const curStage = (typeof STATE !== 'undefined' && STATE.stageFocus && STATE.stageFocus !== 'ALL') ? STATE.stageFocus : '初一上';
  const semMeta = MASTER_SEMESTER_MAP[curStage] || MASTER_SEMESTER_MAP['初一上'];
  const curSubjObj = getEnrichedSubjectCompendium(st.subject, curStage) || getEnrichedSubjectCompendium('语文', curStage);
  const stats = computeSubjectStats(curSubjObj);

  const gradeKey = typeof getGradeKeyFromStage === 'function' ? getGradeKeyFromStage(curStage) : 'Y1';
  const currMap = typeof getZiboCurriculumMap === 'function' ? getZiboCurriculumMap() : null;
  const gradeCfg = (currMap && currMap[gradeKey]) ? currMap[gradeKey] : {
    gradeTitle: '初一（六年级）',
    active: ['语文', '数学', '英语', '道法', '历史', '生物'],
    notStarted: ['地理', '物理', '化学'],
    graduated: [],
    summary: '在读 6 科（语、数、英、道、历、生） · 地理初二开课，物理与化学初三开课'
  };

  // 将科目严格划分为「✅ 当前年级在读科目」与「🚫 当前年级不开课 / 🎓 已结业科目」
  const activeSubjs = allSubjs.filter(s => gradeCfg.active.includes(s.subject));
  const inactiveSubjs = allSubjs.filter(s => !gradeCfg.active.includes(s.subject));

  const renderSubjBtn = (s, isTaught) => {
    const sEnriched = getEnrichedSubjectCompendium(s.subject, curStage);
    const sStat = computeSubjectStats(sEnriched);
    const isAct = s.subject === curSubjObj.subject;
    const statusInfo = typeof getSubjectGradeStatus === 'function'
      ? getSubjectGradeStatus(s.subject, curStage)
      : { status: isTaught ? 'active' : 'not_started', tag: isTaught ? '在读' : (s.subject === '地理' ? '初二开课' : '初三开课') };

    const inactiveStyle = !isTaught && !isAct
      ? 'opacity:0.68;border-style:dashed;background:#f8fafc;color:#64748b;'
      : '';
    const statusChip = !isTaught
      ? `<span style="font-size:10px;padding:1px 5px;border-radius:999px;background:${ isAct ? 'rgba(255,255,255,0.22)' : '#e2e8f0'};color:${isAct ? '#fff' : '#475569'};font-weight:800;">${statusInfo.status === 'graduated' ? '🎓已结业' : '🚫' + statusInfo.tag}</span>`
      : '';

    return `
      <button class="mm-subj-tab ${isAct ? 'active' : ''}"
        style="${isAct ? `background:${s.color};border-color:${s.color};color:#fff;` : inactiveStyle}"
        onclick="window.MASTER_MAP_STATE.subject='${s.subject}';renderMasterMapView()">
        <span class="mm-subj-icon">${s.icon}</span>
        <span class="mm-subj-name">${s.subject}</span>
        ${statusChip}
        <span class="mm-subj-pct" style="${isAct ? 'background:rgba(255,255,255,0.24);color:#fff;' : ''}">${sStat.done}/${sStat.total}</span>
      </button>
    `;
  };

  const curSubjStatus = typeof getSubjectGradeStatus === 'function'
    ? getSubjectGradeStatus(curSubjObj.subject, curStage)
    : { status: 'active', tag: '本年级在读', note: '' };

  // 页内醒目的「五四制 8 学期切换胶囊栏」（位于九科切换栏正上方，点击调用 setStageFocus(semCode) 实时双向同步）
  const semesterCapsuleBarHtml = `
    <div class="mm-semester-capsule-bar" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:9px 12px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;">
      <span style="font-size:12.5px;font-weight:900;color:#1e40af;margin-right:4px;">🗓️ 五四制 8 学期切换：</span>
      ${MASTER_SEMESTER_LIST.map(sem => {
        const isSemAct = sem.code === curStage;
        return `
          <button type="button"
            class="mm-sem-pill ${isSemAct ? 'active' : ''}"
            data-sem="${sem.code}"
            onclick="switchMasterMapSemester('${sem.code}')"
            style="padding:5px 11px;border-radius:999px;font-size:12px;font-weight:800;cursor:pointer;transition:all 0.15s;border:1.5px solid ${isSemAct ? curSubjObj.color : '#93c5fd'};background:${isSemAct ? curSubjObj.color : '#ffffff'};color:${isSemAct ? '#ffffff' : '#1e3a8a'};box-shadow:${isSemAct ? '0 2px 6px rgba(15,23,42,0.16)' : 'none'};">
            ${sem.pill}
          </button>
        `;
      }).join('')}
    </div>
  `;

  const subjTabsHtml = `
    <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
      ${semesterCapsuleBarHtml}
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:12.5px;color:#166534;">
        <strong>📌 山东五四学制 · 当前学段【${curStage} · ${gradeCfg.gradeTitle}】课程配置：</strong>
        <span>✅ <strong>本年级在读 ${activeSubjs.length} 科</strong>（${activeSubjs.map(x => x.subject).join('、')}）</span>
        ${(gradeCfg.notStarted && gradeCfg.notStarted.length > 0) ? `<span>｜ 🚫 <strong>本年级不开课 ${gradeCfg.notStarted.length} 科</strong>（${gradeCfg.notStarted.map(n => n === '地理' ? '地理[初二上开课]' : n + '[初三上开课]').join('、')}）</span>` : ''}
        ${(gradeCfg.graduated && gradeCfg.graduated.length > 0) ? `<span>｜ 🎓 <strong>已结业停开 ${gradeCfg.graduated.length} 科</strong>（${gradeCfg.graduated.join('、')}[初三下已会考结业]）</span>` : ''}
        <button class="mm-btn" style="margin-left:auto;padding:2px 8px;font-size:11.5px;" onclick="if(typeof openCurriculumModal==='function')openCurriculumModal()">⚙️ 查看/微调四年课表</button>
      </div>
      ${curSubjStatus.status !== 'active' ? `
        <div style="padding:8px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12.5px;font-weight:700;">
          ⚠️ 课表提示：【${curStage} · ${gradeCfg.gradeTitle}】<strong>不开设《${curSubjObj.subject}》课</strong>（${curSubjStatus.note}）。可点击上方「8 学期切换栏」切至《${curSubjObj.subject}》开课学期查看同步章节。
        </div>
      ` : ''}
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;">
        <span style="font-size:12px;font-weight:900;color:#15803d;padding:2px 6px;">✅ ${gradeCfg.gradeTitle}在读 (${activeSubjs.length}科)：</span>
        ${activeSubjs.map(s => renderSubjBtn(s, true)).join('')}
        ${inactiveSubjs.length > 0 ? `
          <span style="font-size:12px;font-weight:800;color:#64748b;padding:2px 6px;margin-left:6px;">🚫 本年级不开/已结业 (${inactiveSubjs.length}科)：</span>
          ${inactiveSubjs.map(s => renderSubjBtn(s, false)).join('')}
        ` : ''}
      </div>
    </div>
  `;

  // 计算过滤后的支柱与节点
  let visibleCount = 0;
  const filteredPillars = curSubjObj.pillars.map(p => {
    const groups = p.groups.map((g, gIdx) => {
      const items = g.items.filter(it => matchesMasterFilter(it, p.key, curSubjObj.subject));
      visibleCount += items.length;
      return { ...g, gIdx, items };
    }).filter(g => g.items.length > 0);
    return { ...p, groups };
  }).filter(p => p.groups.length > 0);

  // 渲染核心内容区：模式A（互动知识导图树） vs 模式B（1101视频同款双栏红字讲义）
  let bodyContentHtml = '';
  if (filteredPillars.length === 0) {
    bodyContentHtml = `
      <div class="mm-empty-card">
        <div style="font-size:32px;margin-bottom:8px;">🎯</div>
        <h3>当前筛选条件下暂无匹配节点</h3>
        <p>您可以点击上方「全部状态」或清空搜索框查看完整知识导图。</p>
        <button class="mm-btn primary" onclick="window.MASTER_MAP_STATE.pillarFilter='ALL';window.MASTER_MAP_STATE.statusFilter='ALL';window.MASTER_MAP_STATE.searchQuery='';renderMasterMapView()">重置全部筛选</button>
      </div>
    `;
  } else if (st.viewMode === 'MINDMAP') {
    bodyContentHtml = renderInteractiveMindmapTree(curSubjObj, filteredPillars, stats);
  } else {
    bodyContentHtml = renderVideoStyleTwoColSheet(curSubjObj, filteredPillars);
  }

  container.innerHTML = `
    <div class="mm-wrap ${st.clozeMode ? 'is-cloze-mode' : ''}">
      <!-- 顶部主横幅与九科导航 -->
      <div class="mm-hero-card" style="border-top: 4px solid ${curSubjObj.color}">
        <div class="mm-hero-top">
          <div class="mm-hero-title-area">
            <div class="mm-hero-eyebrow">
              <span class="mm-badge-pill" style="background:${curSubjObj.color}">${curSubjObj.icon} ${curSubjObj.subject} · 王牌提分宝典</span>
              <span class="mm-stage-chip">${curSubjObj.stageTag}</span>
              <span class="mm-sync-chip">🔄 标记与批注实时双向同步 Obsidian</span>
            </div>
            <h2 class="mm-hero-title">${curSubjObj.subject}（${semMeta.fullLabel}）：高频必背底子 ➔ 题型固定答题SOP ➔ 反直觉易错排雷导图</h2>
            <p class="mm-hero-desc">${curSubjObj.summary}</p>
          </div>

          <div class="mm-hero-stats-box">
            <div class="mm-stat-item done" onclick="window.MASTER_MAP_STATE.statusFilter='DONE';renderMasterMapView()" title="点击只看已吃透">
              <span class="mm-stat-num">${stats.done}</span>
              <span class="mm-stat-lbl">✅ 已吃透</span>
            </div>
            <div class="mm-stat-item review" onclick="window.MASTER_MAP_STATE.statusFilter='REVIEW';renderMasterMapView()" title="点击只看易错盯防">
              <span class="mm-stat-num">${stats.review}</span>
              <span class="mm-stat-lbl">🟡 易错盯防</span>
            </div>
            <div class="mm-stat-item star" onclick="window.MASTER_MAP_STATE.statusFilter='STARRED';renderMasterMapView()" title="点击只看考前星标">
              <span class="mm-stat-num">${stats.starred}</span>
              <span class="mm-stat-lbl">⭐ 考前星标</span>
            </div>
            <div class="mm-stat-item pct">
              <span class="mm-stat-num">${stats.pct}%</span>
              <span class="mm-stat-lbl">📈 通关率</span>
            </div>
          </div>
        </div>

        <!-- 九科快速切换栏 -->
        <div class="mm-subj-tabs-row">${subjTabsHtml}</div>

        ${Array.isArray(curSubjObj.topNoteGallery) && curSubjObj.topNoteGallery.length > 0 ? `
          <div style="margin:10px 0 6px;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
              <span style="font-size:13px;font-weight:900;color:#92400e;">📸 已有机融合《中考状元笔记》&《小学学霸笔记》对应六年级上册手写原页（共 ${curSubjObj.topNoteGallery.length} 页 · 点击任意原页高清放大检视）：</span>
              <span style="font-size:11.5px;color:#b45309;font-weight:700;">✨ 原页核心典例与口诀已同步提炼至下方第①支柱末尾</span>
            </div>
            <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;">
              ${curSubjObj.topNoteGallery.map(g => `
                <div onclick="if(typeof openPhotoModal==='function')openPhotoModal('${g.img}','${g.title.replace(/'/g, "\\'")}')"
                  style="min-width:190px;max-width:210px;background:#fff;border:1px solid #fcd34d;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 2px 5px rgba(0,0,0,0.04);transition:transform 0.15s;"
                  title="点击放大检视手写原页">
                  <img src="${g.img}" alt="${g.title}" style="width:46px;height:62px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;" />
                  <div style="font-size:11.5px;line-height:1.35;color:#1e293b;font-weight:700;">
                    <div style="font-size:10px;color:#d97706;font-weight:900;margin-bottom:2px;">📘 ${g.source}</div>
                    <div style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${g.title.replace(/^《[^》]+》/, '')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 工具与过滤操作栏 -->
        <div class="mm-toolbar">
          <div class="mm-toolbar-left">
            <!-- 视图模式切换 -->
            <div class="mm-seg-group">
              <button class="mm-seg-btn ${st.viewMode === 'MINDMAP' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.viewMode='MINDMAP';renderMasterMapView()">
                🗺️ 互动知识导图模式
              </button>
              <button class="mm-seg-btn ${st.viewMode === 'SHEET' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.viewMode='SHEET';renderMasterMapView()">
                📄 视频同款红字双栏讲义
              </button>
            </div>

            <!-- 四大支柱过滤 -->
            <div class="mm-seg-group">
              <button class="mm-seg-btn ${st.pillarFilter === 'ALL' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.pillarFilter='ALL';renderMasterMapView()">全部(${ stats.total })</button>
              <button class="mm-seg-btn ${st.pillarFilter === 'BASE' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.pillarFilter='BASE';renderMasterMapView()">①必背底子</button>
              <button class="mm-seg-btn ${st.pillarFilter === 'SOP' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.pillarFilter='SOP';renderMasterMapView()">②答题公式SOP</button>
              <button class="mm-seg-btn ${st.pillarFilter === 'TRAP' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.pillarFilter='TRAP';renderMasterMapView()">③红字易错排雷</button>
              <button class="mm-seg-btn ${st.pillarFilter === 'VAULT' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.pillarFilter='VAULT';renderMasterMapView()">④本地单元口诀</button>
            </div>

            <!-- 标记状态过滤 -->
            <div class="mm-seg-group">
              <button class="mm-seg-btn ${st.statusFilter === 'ALL' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.statusFilter='ALL';renderMasterMapView()">全部状态</button>
              <button class="mm-seg-btn ${st.statusFilter === 'UNMASTERED' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.statusFilter='UNMASTERED';renderMasterMapView()">⚪未吃透</button>
              <button class="mm-seg-btn ${st.statusFilter === 'REVIEW' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.statusFilter='REVIEW';renderMasterMapView()">🟡易错盯防</button>
              <button class="mm-seg-btn ${st.statusFilter === 'STARRED' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.statusFilter='STARRED';renderMasterMapView()">⭐星标必考</button>
              <button class="mm-seg-btn ${st.statusFilter === 'DONE' ? 'active' : ''}" onclick="window.MASTER_MAP_STATE.statusFilter='DONE';renderMasterMapView()">✅已吃透</button>
            </div>
          </div>

          <div class="mm-toolbar-right">
            <input type="text" class="mm-search-input" placeholder="🔍 搜本料公式/答题词/易错点..."
              value="${(st.searchQuery || '').replace(/"/g, '&quot;')}"
              oninput="window.MASTER_MAP_STATE.searchQuery=this.value;renderMasterMapView()" />

            <button class="mm-btn cloze-toggle ${st.clozeMode ? 'is-on' : ''}" onclick="window.MASTER_MAP_STATE.clozeMode=!window.MASTER_MAP_STATE.clozeMode;renderMasterMapView()" title="将所有红字划线核心词变成填空横线，点击横线可逐个核对答案">
              ${st.clozeMode ? '👁️ 显示红字答案' : '🙈 红字挖空自测'}
            </button>

            <button class="mm-btn print" onclick="printCurrentMasterCompendium(false)" title="按当前筛选结果（如仅打印易错/未背或全本）生成 A4 双栏红字讲义">
              🖨️ A4打印当前讲义(${visibleCount}项)
            </button>
            <button class="mm-btn print-cloze" onclick="printCurrentMasterCompendium(true)" title="将红字挖空成下划线打印出来，供若婷手写默写自测">
              📝 打印红字挖空默写卷
            </button>
            <button class="mm-btn word" onclick="exportMasterCompendiumWord()">
              📄 导出Word
            </button>
            <button class="mm-btn md" onclick="exportMasterCompendiumMd()">
              ⬇️ 导出MD
            </button>
          </div>
        </div>
      </div>

      <!-- 主体渲染区 -->
      <div id="mm-printable-stage" class="mm-stage-area">
        ${bodyContentHtml}
      </div>
    </div>
  `;

  if (typeof renderMathInElement === 'function') {
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {}
  }
}

// 模式 A：互动知识导图树（左根右支思维导图布局 + 节点直接打卡/星标/批注/朗读）
function renderInteractiveMindmapTree(subjObj, filteredPillars, stats) {
  const pillarsHtml = filteredPillars.map(p => {
    const groupsHtml = p.groups.map(g => {
      const gKey = `${subjObj.subject}_${p.key}_${g.gIdx}`;
      const isCollapsed = Boolean(window.MASTER_MAP_STATE.collapsedGroups[gKey]);

      // 计算该组完成度
      const gDone = g.items.filter(it => getNodeMark(it.id).status === 'done').length;

      const leafCardsHtml = isCollapsed ? '' : g.items.map(it => renderInteractiveLeafNode(it, subjObj, p.badge)).join('');

      return `
        <div class="mm-tree-group ${isCollapsed ? 'is-collapsed' : ''}">
          <div class="mm-tree-group-head" onclick="toggleMasterGroupCollapse('${gKey}')">
            <div class="mm-tree-group-title">
              <span class="mm-collapse-caret">${isCollapsed ? '▶' : '▼'}</span>
              <strong>${g.groupTitle}</strong>
            </div>
            <div class="mm-tree-group-meta">
              <span class="mm-group-progress">已吃透 ${gDone}/${g.items.length}</span>
            </div>
          </div>
          ${isCollapsed ? '' : `<div class="mm-tree-leaves-grid">${leafCardsHtml}</div>`}
        </div>
      `;
    }).join('');

    return `
      <div class="mm-tree-pillar-branch" data-pillar="${p.key}">
        <div class="mm-tree-pillar-node" style="border-left-color:${subjObj.color}">
          <div class="mm-pillar-node-left">
            <span class="mm-pillar-badge" style="background:${subjObj.color}">${p.badge}</span>
            <h3>${p.title}</h3>
          </div>
          <div class="mm-pillar-node-actions">
            <button class="mm-mini-link" onclick="setMasterAllCollapse(false)">全部展开</button>
            <button class="mm-mini-link" onclick="setMasterAllCollapse(true)">全部折叠</button>
          </div>
        </div>
        <div class="mm-tree-groups-container">
          ${groupsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="mm-mindmap-canvas">
      <!-- 思维导图总根节点横幅 -->
      <div class="mm-mindmap-root-bar" style="background:linear-gradient(135deg, ${subjObj.color}18, #ffffff);border-color:${subjObj.color}">
        <div class="mm-root-node-chip" style="background:${subjObj.color}">
          ${subjObj.icon} ${subjObj.subject} 提分知识导图总根
        </div>
        <div class="mm-root-progress-bar-wrap">
          <div class="mm-root-progress-track">
            <div class="mm-root-progress-fill" style="width:${stats.pct}%;background:${subjObj.color}"></div>
          </div>
          <span class="mm-root-progress-text">当前通关进度：<strong>${stats.done}/${stats.total}</strong> (${stats.pct}%) ｜ 点击任意卡片状态按钮即可循环切换【⚪待背诵 ➔ 🟡易错盯防 ➔ ✅已吃透】</span>
        </div>
      </div>

      <!-- 四大支柱导图分支 -->
      <div class="mm-mindmap-branches">
        ${pillarsHtml}
      </div>
    </div>
  `;
}

function renderInteractiveLeafNode(it, subjObj, badgeName) {
  const mark = getNodeMark(it.id);
  const statusConfig = {
    todo: { cls: 'is-todo', label: '⚪ 待背诵', nextHint: '点击切换为：🟡易错盯防' },
    review: { cls: 'is-review', label: '🟡 易错盯防', nextHint: '点击切换为：✅已吃透' },
    done: { cls: 'is-done', label: '✅ 已吃透', nextHint: '点击重置为：⚪待背诵' }
  }[mark.status] || { cls: 'is-todo', label: '⚪ 待背诵', nextHint: '' };

  const isEditingNote = window.MASTER_MAP_STATE.editingNoteId === it.id;
  const safeTitle = String(it.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const plainForTts = `${it.title}。${String(it.text || '').replace(/\{\{|\}\}|\*\*/g, '')}`.slice(0, 180).replace(/'/g, "\\'");

  return `
    <div class="mm-leaf-card ${statusConfig.cls} ${mark.starred ? 'is-starred' : ''}" data-node-id="${it.id}">
      <div class="mm-leaf-header">
        <div class="mm-leaf-title-wrap">
          <span class="mm-leaf-tag">${it.tag}</span>
          <h4 class="mm-leaf-title">${it.title}</h4>
        </div>
        <div class="mm-leaf-actions">
          <button class="mm-status-btn ${statusConfig.cls}"
            title="${statusConfig.nextHint}"
            onclick="cycleMasterNodeStatus('${it.id}', '${subjObj.subject}', '${badgeName}', '${safeTitle}', event)">
            ${statusConfig.label}
          </button>
          <button class="mm-icon-btn ${mark.starred ? 'active-star' : ''}"
            title="加入/取消考前重点星标"
            onclick="toggleMasterNodeStar('${it.id}', '${subjObj.subject}', '${badgeName}', '${safeTitle}', event)">
            ${mark.starred ? '⭐' : '☆'}
          </button>
          <button class="mm-icon-btn ${mark.note ? 'has-note' : ''}"
            title="添加/修改个人学习批注"
            onclick="openMasterNodeNoteEditor('${it.id}', event)">
            📝
          </button>
          <button class="mm-icon-btn"
            title="语音朗读此条考点与公式"
            onclick="if(typeof speakText==='function') speakText('${plainForTts}', 'zh-CN')">
            🔊
          </button>
          ${it.kpId ? `<button class="mm-icon-btn" title="打开此考点闯关练习抽屉" onclick="if(typeof openMicroDrawer==='function') openMicroDrawer('${it.kpId}')">🎯</button>` : ''}
        </div>
      </div>

      <div class="mm-leaf-body">
        ${formatCompendiumRichText(it.text)}
      </div>

      ${mark.note && !isEditingNote ? `
        <div class="mm-leaf-note-display" onclick="openMasterNodeNoteEditor('${it.id}', event)" title="点击修改批注">
          <strong>📝 若婷批注：</strong>${mark.note.replace(/</g, '&lt;')}
        </div>
      ` : ''}

      ${isEditingNote ? `
        <div class="mm-leaf-note-editor" onclick="event.stopPropagation()">
          <input type="text" id="mm-note-input-${it.id}" class="mm-note-input"
            placeholder="输入易错提醒、老师补充或做题心得（回车或点保存同步Obsidian）..."
            value="${(mark.note || '').replace(/"/g, '&quot;')}"
            onkeydown="if(event.key==='Enter') saveMasterNodeNoteFromInput('${it.id}', '${subjObj.subject}', '${badgeName}', '${safeTitle}')" />
          <button class="mm-btn primary sm" onclick="saveMasterNodeNoteFromInput('${it.id}', '${subjObj.subject}', '${badgeName}', '${safeTitle}')">保存批注</button>
          <button class="mm-btn sm" onclick="window.MASTER_MAP_STATE.editingNoteId=null;renderMasterMapView()">取消</button>
        </div>
      ` : ''}
    </div>
  `;
}

// 模式 B：1101 视频同款「A4 双栏白底红字划线讲义」视图
function renderVideoStyleTwoColSheet(subjObj, filteredPillars) {
  const pillarsHtml = filteredPillars.map(p => {
    const groupsHtml = p.groups.map(g => {
      const itemsHtml = g.items.map(it => {
        const mark = getNodeMark(it.id);
        const safeTitle = String(it.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
          <div class="mm-sheet-box ${mark.status === 'done' ? 'is-done' : (mark.status === 'review' ? 'is-review' : '')}">
            <div class="mm-sheet-box-head">
              <div class="mm-sheet-head-left" onclick="cycleMasterNodeStatus('${it.id}', '${subjObj.subject}', '${p.badge}', '${safeTitle}', event)" style="cursor:pointer;" title="点击切换掌握状态">
                <span class="mm-sheet-checkbox">${mark.status === 'done' ? '☑️' : (mark.status === 'review' ? '🟡' : '☐')}</span>
                <span class="mm-sheet-tag">${it.tag}</span>
                <strong class="mm-sheet-title">${it.title}</strong>
              </div>
              <div class="mm-sheet-head-right">
                <button class="mm-sheet-mini-btn" onclick="toggleMasterNodeStar('${it.id}', '${subjObj.subject}', '${p.badge}', '${safeTitle}', event)">${mark.starred ? '⭐' : '☆'}</button>
              </div>
            </div>
            <div class="mm-sheet-box-body">${formatCompendiumRichText(it.text)}</div>
            ${mark.note ? `<div class="mm-sheet-note">💡 批注：${mark.note.replace(/</g, '&lt;')}</div>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="mm-sheet-group">
          <div class="mm-sheet-group-bar">◆ ${g.groupTitle}</div>
          <div class="mm-sheet-two-col-grid">${itemsHtml}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="mm-sheet-pillar">
        <div class="mm-sheet-pillar-head" style="border-left-color:${subjObj.color}">
          <span class="mm-sheet-pillar-badge" style="background:${subjObj.color}">${p.badge}</span>
          <h3>${p.title}</h3>
        </div>
        ${groupsHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="mm-a4-sheet-paper">
      <div class="mm-a4-sheet-header" style="border-bottom-color:${subjObj.color}">
        <div>
          <span class="mm-a4-chip" style="background:${subjObj.color}">${subjObj.icon} ${subjObj.subject} · 1101视频同款双栏红字精华讲义</span>
          <h2>${subjObj.subject}高频必背底子 · 题型固定答题公式 · 易错排雷汇总</h2>
        </div>
        <div class="mm-a4-meta">
          <div>学段：${subjObj.stageTag}</div>
          <div>红字划线处均为考场采分词与易错陷阱</div>
        </div>
      </div>
      ${pillarsHtml}
    </div>
  `;
}

// 一键 A4 双栏红字打印（支持普通红字版 & 红字挖空默写卷版）
function printCurrentMasterCompendium(asClozeSheet) {
  const st = window.MASTER_MAP_STATE;
  const curStage = (typeof STATE !== 'undefined' && STATE.stageFocus && STATE.stageFocus !== 'ALL') ? STATE.stageFocus : '初一上';
  const curSubjObj = getEnrichedSubjectCompendium(st.subject, curStage) || getEnrichedSubjectCompendium('语文', curStage);
  const filteredPillars = curSubjObj.pillars.map(p => {
    const groups = p.groups.map((g, gIdx) => {
      const items = g.items.filter(it => matchesMasterFilter(it, p.key, curSubjObj.subject));
      return { ...g, gIdx, items };
    }).filter(g => g.items.length > 0);
    return { ...p, groups };
  }).filter(p => p.groups.length > 0);

  const sheetHtml = renderVideoStyleTwoColSheet(curSubjObj, filteredPillars);
  const modeTitle = asClozeSheet ? '【红字挖空默写自测卷】' : '【A4双栏红字划线背诵版】';
  const docTitle = `若婷学习舱 · ${curSubjObj.subject}（${curStage}）王牌提分宝典 ${modeTitle}`;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    if (typeof showToast === 'function') showToast('⚠️ 请允许浏览器弹出打印窗口');
    return;
  }

  printWin.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${docTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous"
  onload="renderMathInElement(document.body, { delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}] });"></script>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "PingFang SC", "Microsoft YaHei", serif; color: #0f172a; margin: 0; padding: 0; font-size: 9.2pt; line-height: 1.5; background: #fff; }
  .top-print-bar { position: sticky; top: 0; background: #0f172a; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .top-print-bar button { background: #10b981; color: #fff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; margin-left: 8px; }
  .mm-a4-sheet-paper { max-width: 190mm; margin: 0 auto; }
  .mm-a4-sheet-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid ${curSubjObj.color}; padding-bottom: 8px; margin-bottom: 10px; }
  .mm-a4-chip { display: inline-block; color: #fff; font-size: 8.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
  .mm-a4-sheet-header h2 { margin: 4px 0 0 0; font-size: 13.5pt; }
  .mm-a4-meta { text-align: right; font-size: 8pt; color: #475569; }
  .mm-sheet-pillar-head { display: flex; align-items: center; gap: 8px; background: #f8fafc; border-left: 4px solid ${curSubjObj.color}; padding: 4px 8px; margin: 8px 0 6px 0; }
  .mm-sheet-pillar-badge { color: #fff; font-size: 7.5pt; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
  .mm-sheet-pillar-head h3 { margin: 0; font-size: 10pt; }
  .mm-sheet-group-bar { font-weight: 800; font-size: 9pt; margin: 4px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
  .mm-sheet-two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 9px; }
  .mm-sheet-box { border: 1px solid #cbd5e1; border-radius: 5px; padding: 5px 7px; break-inside: avoid; page-break-inside: avoid; }
  .mm-sheet-box-head { display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 3px; margin-bottom: 3px; }
  .mm-sheet-tag { background: #eff6ff; color: #1d4ed8; font-size: 7pt; font-weight: 700; padding: 0 4px; border-radius: 3px; margin-right: 4px; }
  .mm-sheet-title { font-size: 8.8pt; }
  .mm-sheet-mini-btn { border: none; background: transparent; font-size: 9pt; }
  .mm-sheet-box-body { font-size: 8.4pt; line-height: 1.48; }
  .mm-sheet-note { margin-top: 4px; font-size: 8pt; color: #b45309; background: #fffbeb; padding: 2px 5px; border-radius: 3px; }
  .mm-red-key {
    color: ${asClozeSheet ? 'transparent' : '#dc2626'} !important;
    font-weight: 700;
    border-bottom: 1.5px solid #dc2626;
    background: ${asClozeSheet ? '#fef2f2' : 'transparent'};
    padding: 0 2px;
  }
  @media print { .top-print-bar { display: none !important; } .mm-a4-sheet-paper { max-width: 100%; } }
</style>
</head>
<body>
  <div class="top-print-bar">
    <span>🖨️ <strong>${docTitle}</strong>（已自动排版为 A4 双栏防截断格式）</span>
    <div>
      <button onclick="window.print()">立即打印 / 另存为 PDF</button>
      <button style="background:#475569" onclick="window.close()">关闭窗口</button>
    </div>
  </div>
  ${sheetHtml}
</body>
</html>`);
  printWin.document.close();
}

function exportMasterCompendiumWord() {
  const st = window.MASTER_MAP_STATE;
  const curStage = (typeof STATE !== 'undefined' && STATE.stageFocus && STATE.stageFocus !== 'ALL') ? STATE.stageFocus : '初一上';
  const curSubjObj = getEnrichedSubjectCompendium(st.subject, curStage) || getEnrichedSubjectCompendium('语文', curStage);
  if (typeof exportElementWord === 'function') {
    exportElementWord('mm-printable-stage', `${curSubjObj.subject}_${curStage}_王牌提分宝典_必背底子与答题公式SOP`, curSubjObj.summary);
  }
}

function exportMasterCompendiumMd() {
  const st = window.MASTER_MAP_STATE;
  const curStage = (typeof STATE !== 'undefined' && STATE.stageFocus && STATE.stageFocus !== 'ALL') ? STATE.stageFocus : '初一上';
  const curSubjObj = getEnrichedSubjectCompendium(st.subject, curStage) || getEnrichedSubjectCompendium('语文', curStage);
  let md = `# ${curSubjObj.icon} ${curSubjObj.subject}（${curStage}） · 王牌提分宝典（必背底子 + 答题公式SOP + 易错排雷）\n\n> ${curSubjObj.summary}\n\n---\n\n`;
  curSubjObj.pillars.forEach(p => {
    md += `## ${p.title}\n\n`;
    p.groups.forEach(g => {
      md += `### 📌 ${g.groupTitle}\n\n`;
      g.items.forEach(it => {
        const m = getNodeMark(it.id);
        const box = m.status === 'done' ? '[x]' : '[ ]';
        const star = m.starred ? ' ⭐' : '';
        md += `- ${box}${star} **【${it.tag}】${it.title}**\n`;
        md += `  > ${String(it.text || '').replace(/\{\{([\s\S]+?)\}\}/g, '**<u>$1</u>**').replace(/\n/g, '\n  > ')}\n`;
        if (m.note) md += `  > 📝 *批注：${m.note}*\n`;
        md += `\n`;
      });
    });
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${curSubjObj.subject}_王牌提分宝典.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast(`⬇️ 已导出 ${curSubjObj.subject} 提分宝典 Markdown 文件！`);
}
