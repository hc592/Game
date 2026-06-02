/*
 * 星魂舰队 - 战机永久升级 / 源晶经济系统
 * ------------------------------------------------------------
 * 作用：
 * 1. 主菜单新增“战机升级”入口，打开永久升级面板。
 * 2. 每局结算时，根据本局总伤害换算“源晶”。
 * 3. 新增“源晶精炼矩阵”：按等级提高每局结算源晶收益。
 * 4. 源晶余额、已购升级等级会永久保存。
 * 5. Electron / NW.js / exe 环境会优先保存到根目录 save/player_progress.json；普通浏览器退化为 localStorage。
 *
 * 重要说明：
 * - 当前 index.html 只引用了 ./js/game.js，但没有直接包含游戏内部变量。
 * - 本脚本会尽量读取常见变量名，例如 damageDealt / totalDamage / runStats.damageDealt。
 * - 更稳定的接入方式，是在 game.js 的结算函数中主动调用：
 *
 *   window.ShipUpgradeManager.rewardFromSettlement({
 *     damageDealt: totalDamage,
 *     stageReached: currentStage,
 *     kills: killCount,
 *     result: isClear ? 'clear' : 'dead'
 *   });
 *
 * - 游戏数值侧可以读取：
 *   window.getPermanentUpgradeBonuses()
 *   window.permanentUpgradeBonuses
 *   window.getPermanentCardRefreshCount()
 */
(function () {
  'use strict';

  const SAVE_DIR_NAME = 'save';
  const STORAGE_KEY = 'star_soul_fleet_ship_progress_v1';
  const REWARD_LOG_KEY = 'star_soul_fleet_source_crystal_reward_log_v1';

  // 结算公式：本局总伤害 / 100000 向下取整。
  // 你的游戏近期有“战斗数值 100x”的补丁，所以这里用 100000 避免源晶膨胀太快。
  // 想让升级更快：改小 DAMAGE_PER_CRYSTAL；想更慢：改大它。
  const DAMAGE_PER_CRYSTAL = 100000;
  const MIN_REWARD_IF_DAMAGE_GT_ZERO = 1;
  const MAX_CRYSTAL_REWARD_PER_RUN = 120;

  const DEPRECATED_UPGRADE_REFUNDS = {
    cooling: { baseCost: 7, costGrowth: 5, maxLevel: 8, name: '冷却回路' },
    collector: { baseCost: 5, costGrowth: 4, maxLevel: 8, name: '源晶收束器' }
  };

  const UPGRADE_DEFS = [
    {
      id: 'hull',
      name: '星舰装甲',
      icon: '⬢',
      maxLevel: 10,
      baseCost: 6,
      costGrowth: 4,
      short: '提升最大生命值',
      detail: '每级最大生命值 +8%。',
      bonusText: level => `最大生命值 +${level * 8}%`
    },
    {
      id: 'reactor',
      name: '聚变反应堆',
      icon: '✦',
      maxLevel: 10,
      baseCost: 8,
      costGrowth: 5,
      short: '提升全武器伤害',
      detail: '每级全局伤害 +4%。',
      bonusText: level => `全局伤害 +${level * 4}%`
    },
    {
      id: 'thruster',
      name: '矢量推进器',
      icon: '➤',
      maxLevel: 8,
      baseCost: 5,
      costGrowth: 4,
      short: '提升移动速度',
      detail: '每级移动速度 +3.5%。',
      bonusText: level => `移动速度 +${Math.round(level * 3.5)}%`
    },
    {
      id: 'cardRefresh',
      name: '战术重构模块',
      icon: '⟳',
      maxLevel: 5,
      baseCost: 28,
      costGrowth: 18,
      short: '永久提升卡牌刷新次数',
      detail: '每级额外卡牌刷新次数 +1。',
      bonusText: level => `额外卡牌刷新次数 +${level}`
    },
    {
      id: 'sourceRefine',
      name: '源晶精炼矩阵',
      icon: '✧',
      maxLevel: 5,
      baseCost: 36,
      costGrowth: 24,
      short: '提高每局结算源晶收益',
      detail: '每级结算源晶 +8%。',
      bonusText: level => `结算源晶 +${level * 8}%`
    },
    {
      id: 'shield',
      name: '偏折护盾',
      icon: '◈',
      maxLevel: 8,
      baseCost: 7,
      costGrowth: 5,
      short: '降低受到的伤害',
      detail: '每级受到伤害 -3%。',
      bonusText: level => `受到伤害 -${Math.min(24, level * 3)}%`
    }
  ];
  let progress = loadProgress();
  let runStartedAt = new Date();
  let observerInstalled = false;
  let autoRewardTimer = 0;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function makeTimestamp(date) {
    return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join('') + '_' +
      [pad2(date.getHours()), pad2(date.getMinutes()), pad2(date.getSeconds())].join('');
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function calcSpentForOldUpgrade(def, level) {
    level = clamp(Math.floor(Number(level) || 0), 0, def.maxLevel || 99);
    // 已购买 Lv.1..Lv.n 的总花费：base + (base+growth) + ...
    return level * def.baseCost + def.costGrowth * level * (level - 1) / 2;
  }

  function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 100000000) return (n / 100000000).toFixed(2).replace(/\.00$/, '') + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return Math.floor(n).toLocaleString('zh-CN');
  }

  function textOf(selector) {
    const el = document.querySelector(selector);
    return el ? (el.innerText || el.textContent || '').trim() : '';
  }

  function safeParseJSON(text, fallback) {
    try { return JSON.parse(text); } catch (_) { return fallback; }
  }

  function getRequireFunction() {
    if (typeof window.require === 'function') return window.require;
    if (typeof require === 'function') return require;
    return null;
  }

  function getNodeBridge() {
    const req = getRequireFunction();
    if (!req) return null;

    try {
      const fs = req('fs');
      const path = req('path');
      const processRef = window.process || (typeof process !== 'undefined' ? process : null);
      let rootDir = null;

      if (processRef && typeof processRef.cwd === 'function') {
        const cwd = processRef.cwd();
        if (fs.existsSync(path.join(cwd, 'index.html')) || fs.existsSync(path.join(cwd, 'js'))) rootDir = cwd;
      }
      if (!rootDir && typeof __dirname === 'string') rootDir = __dirname;
      if (!rootDir && processRef && processRef.execPath) rootDir = path.dirname(processRef.execPath);
      if (!rootDir) return null;

      const saveDir = path.join(rootDir, SAVE_DIR_NAME);
      return {
        fs,
        path,
        rootDir,
        saveDir,
        progressPath: path.join(saveDir, 'player_progress.json'),
        rewardLogPath: path.join(saveDir, 'source_crystal_log.jsonl')
      };
    } catch (err) {
      console.warn('[ShipUpgradeManager] Node 文件系统不可用，使用浏览器本地存储。', err);
      return null;
    }
  }

  function createDefaultProgress() {
    const upgrades = {};
    UPGRADE_DEFS.forEach(def => { upgrades[def.id] = 0; });
    return {
      schemaVersion: 1,
      sourceCrystals: 0,
      totalSourceCrystalsEarned: 0,
      totalSourceCrystalsSpent: 0,
      upgrades,
      rewardedRunKeys: [],
      rewardHistory: [],
      removedUpgradeRefundApplied: true,
      removedUpgradeRefundTotal: 0,
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeProgress(raw) {
    const base = createDefaultProgress();
    if (!raw || typeof raw !== 'object') return base;

    base.sourceCrystals = Math.max(0, Math.floor(Number(raw.sourceCrystals) || 0));
    base.totalSourceCrystalsEarned = Math.max(0, Math.floor(Number(raw.totalSourceCrystalsEarned) || 0));
    base.totalSourceCrystalsSpent = Math.max(0, Math.floor(Number(raw.totalSourceCrystalsSpent) || 0));

    if (raw.upgrades && typeof raw.upgrades === 'object') {
      UPGRADE_DEFS.forEach(def => {
        base.upgrades[def.id] = clamp(Math.floor(Number(raw.upgrades[def.id]) || 0), 0, def.maxLevel);
      });

      // v2 调整：删除“冷却回路”和“源晶收束器”。
      // 如果旧存档中已经购买过它们，第一次加载新版时自动把已花费源晶返还。
      const alreadyRefunded = raw.removedUpgradeRefundApplied === true;
      let refund = 0;
      if (!alreadyRefunded) {
        Object.keys(DEPRECATED_UPGRADE_REFUNDS).forEach(id => {
          const oldDef = DEPRECATED_UPGRADE_REFUNDS[id];
          const oldLevel = clamp(Math.floor(Number(raw.upgrades[id]) || 0), 0, oldDef.maxLevel);
          refund += calcSpentForOldUpgrade(oldDef, oldLevel);
        });
      }
      if (refund > 0) {
        base.sourceCrystals += refund;
        base.totalSourceCrystalsSpent = Math.max(0, base.totalSourceCrystalsSpent - refund);
        base.removedUpgradeRefundTotal = Math.floor(Number(raw.removedUpgradeRefundTotal) || 0) + refund;
        base.removedUpgradeRefundApplied = true;
        base.__needsMigrationSave = true;
      } else {
        base.removedUpgradeRefundApplied = true;
        base.removedUpgradeRefundTotal = Math.floor(Number(raw.removedUpgradeRefundTotal) || 0);
      }
    }
    base.rewardedRunKeys = Array.isArray(raw.rewardedRunKeys) ? raw.rewardedRunKeys.slice(-200) : [];
    base.rewardHistory = Array.isArray(raw.rewardHistory) ? raw.rewardHistory.slice(-50) : [];
    base.updatedAt = raw.updatedAt || new Date().toISOString();
    return base;
  }

  function loadProgress() {
    const bridge = getNodeBridge();
    if (bridge) {
      try {
        if (bridge.fs.existsSync(bridge.progressPath)) {
          return normalizeProgress(safeParseJSON(bridge.fs.readFileSync(bridge.progressPath, 'utf8'), null));
        }
      } catch (err) {
        console.warn('[ShipUpgradeManager] 读取 save/player_progress.json 失败，改用 localStorage。', err);
      }
    }

    try {
      return normalizeProgress(safeParseJSON(localStorage.getItem(STORAGE_KEY) || '', null));
    } catch (_) {
      return createDefaultProgress();
    }
  }

  function saveProgress() {
    progress.updatedAt = new Date().toISOString();
    const serializableProgress = Object.assign({}, progress);
    delete serializableProgress.__needsMigrationSave;
    const text = JSON.stringify(serializableProgress, null, 2);

    try {
      localStorage.setItem(STORAGE_KEY, text);
    } catch (err) {
      console.warn('[ShipUpgradeManager] localStorage 保存失败。', err);
    }

    const bridge = getNodeBridge();
    if (bridge) {
      try {
        bridge.fs.mkdirSync(bridge.saveDir, { recursive: true });
        bridge.fs.writeFileSync(bridge.progressPath, text, 'utf8');
      } catch (err) {
        console.warn('[ShipUpgradeManager] 写入 save/player_progress.json 失败。', err);
      }
    }

    updateGlobalBonuses();
    renderPanelIfOpen();
    updateCrystalRewardStatus();
  }

  function appendRewardLog(entry) {
    try {
      const old = safeParseJSON(localStorage.getItem(REWARD_LOG_KEY) || '[]', []);
      old.push(entry);
      localStorage.setItem(REWARD_LOG_KEY, JSON.stringify(old.slice(-100)));
    } catch (_) {}

    const bridge = getNodeBridge();
    if (bridge) {
      try {
        bridge.fs.mkdirSync(bridge.saveDir, { recursive: true });
        bridge.fs.appendFileSync(bridge.rewardLogPath, JSON.stringify(entry) + '\n', 'utf8');
      } catch (err) {
        console.warn('[ShipUpgradeManager] 写入源晶日志失败。', err);
      }
    }
  }

  function getUpgradeLevel(id) {
    return Math.max(0, Math.floor(Number(progress.upgrades[id]) || 0));
  }

  function getUpgradeDef(id) {
    return UPGRADE_DEFS.find(def => def.id === id) || null;
  }

  function getUpgradeCost(def) {
    const level = getUpgradeLevel(def.id);
    if (level >= def.maxLevel) return Infinity;
    return def.baseCost + level * def.costGrowth;
  }

  function getPermanentUpgradeBonuses() {
    const hull = getUpgradeLevel('hull');
    const reactor = getUpgradeLevel('reactor');
    const thruster = getUpgradeLevel('thruster');
    const cardRefresh = getUpgradeLevel('cardRefresh');
    const sourceRefine = getUpgradeLevel('sourceRefine');
    const shield = getUpgradeLevel('shield');

    return {
      maxHpMultiplier: 1 + hull * 0.08,
      damageMultiplier: 1 + reactor * 0.04,
      moveSpeedMultiplier: 1 + thruster * 0.035,
      damageTakenMultiplier: Math.max(0.76, 1 - shield * 0.03),
      cardRefreshBonus: cardRefresh,
      cardRefreshCharges: cardRefresh,
      sourceCrystalMultiplier: 1 + sourceRefine * 0.08,
      sourceCrystalBonusPercent: sourceRefine * 8,
      sourceRefineLevel: sourceRefine,

      // 兼容旧接入字段：对应升级已删除，因此保持中性值 1。
      cooldownMultiplier: 1,
      xpGainMultiplier: 1,
      pickupRangeMultiplier: 1,

      sourceCrystalBalance: progress.sourceCrystals,
      upgradeLevels: Object.assign({}, progress.upgrades)
    };
  }

  function updateGlobalBonuses() {
    const bonuses = getPermanentUpgradeBonuses();
    window.permanentUpgradeBonuses = bonuses;
    window.shipPermanentDamageMultiplier = bonuses.damageMultiplier;
    window.shipPermanentDamageTakenMultiplier = bonuses.damageTakenMultiplier;
    window.shipPermanentCardRefreshBonus = bonuses.cardRefreshBonus;
    window.permanentCardRefreshBonus = bonuses.cardRefreshBonus;
    window.shipPermanentSourceCrystalMultiplier = bonuses.sourceCrystalMultiplier;
    window.permanentSourceCrystalMultiplier = bonuses.sourceCrystalMultiplier;
    window.getPermanentUpgradeBonuses = getPermanentUpgradeBonuses;
    window.getPermanentCardRefreshCount = () => getPermanentUpgradeBonuses().cardRefreshBonus;
    window.applyPermanentCardRefreshBonus = baseCount => Math.max(0, Math.floor(Number(baseCount) || 0)) + getPermanentUpgradeBonuses().cardRefreshBonus;
    return bonuses;
  }

  function applyMultipliedNumber(obj, prop, multiplier, tagPrefix) {
    if (!obj || typeof obj[prop] !== 'number') return false;
    const baseKey = `__${tagPrefix}_${prop}_base`;
    if (typeof obj[baseKey] !== 'number') obj[baseKey] = obj[prop];
    obj[prop] = obj[baseKey] * multiplier;
    return true;
  }

  function applyAddedNumber(obj, prop, addValue, tagPrefix) {
    if (!obj || typeof obj[prop] !== 'number') return false;
    const baseKey = `__${tagPrefix}_${prop}_base`;
    if (typeof obj[baseKey] !== 'number') obj[baseKey] = obj[prop];
    obj[prop] = obj[baseKey] + addValue;
    return true;
  }

  function applyPermanentBonusesToPlayer() {
    const bonuses = updateGlobalBonuses();
    const player = window.player;
    if (!player || typeof player !== 'object') return bonuses;

    const maxHpChanged = applyMultipliedNumber(player, 'maxHp', bonuses.maxHpMultiplier, 'shipUpgrade');
    applyMultipliedNumber(player, 'maxHealth', bonuses.maxHpMultiplier, 'shipUpgrade');
    applyMultipliedNumber(player, 'speed', bonuses.moveSpeedMultiplier, 'shipUpgrade');
    applyMultipliedNumber(player, 'moveSpeed', bonuses.moveSpeedMultiplier, 'shipUpgrade');
    applyMultipliedNumber(player, 'baseSpeed', bonuses.moveSpeedMultiplier, 'shipUpgrade');
    applyMultipliedNumber(player, 'damageMultiplier', bonuses.damageMultiplier, 'shipUpgrade');
    applyMultipliedNumber(player, 'damageTakenMultiplier', bonuses.damageTakenMultiplier, 'shipUpgrade');
    applyAddedNumber(player, 'maxCardRefreshes', bonuses.cardRefreshBonus, 'shipUpgrade');
    applyAddedNumber(player, 'maxCardRerolls', bonuses.cardRefreshBonus, 'shipUpgrade');
    applyAddedNumber(player, 'cardRefreshMax', bonuses.cardRefreshBonus, 'shipUpgrade');
    applyAddedNumber(player, 'rerollMax', bonuses.cardRefreshBonus, 'shipUpgrade');

    // 如果新局刚开始时 hp 等于原始 maxHp，则同步抬高当前血量，避免只加上限不回血。
    if (maxHpChanged && typeof player.hp === 'number' && !player.__shipUpgradeInitialHpSynced) {
      const baseMax = player.__shipUpgrade_maxHp_base;
      if (typeof baseMax === 'number' && player.hp >= baseMax * 0.95) {
        player.hp = player.maxHp;
        player.__shipUpgradeInitialHpSynced = true;
      }
    }
    return bonuses;
  }

  function parseHumanNumber(raw) {
    if (raw == null) return 0;
    let text = String(raw).trim();
    if (!text) return 0;
    let multiplier = 1;
    if (/亿/.test(text)) multiplier = 100000000;
    else if (/万/.test(text)) multiplier = 10000;
    else if (/\bB\b|b$/i.test(text)) multiplier = 1000000000;
    else if (/\bM\b|m$/i.test(text)) multiplier = 1000000;
    else if (/\bK\b|k$/i.test(text)) multiplier = 1000;
    text = text.replace(/,/g, '').replace(/[亿万KkMmBb]/g, '').replace(/[^\d.\-]/g, '');
    const value = Number(text);
    return Number.isFinite(value) ? value * multiplier : 0;
  }

  function findNumberByKeys(obj, keys, depth, seen) {
    if (!obj || typeof obj !== 'object' || depth <= 0) return 0;
    seen = seen || new WeakSet();
    if (seen.has(obj)) return 0;
    seen.add(obj);

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = parseHumanNumber(value);
          if (parsed > 0) return parsed;
        }
      }
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const found = findNumberByKeys(value, keys, depth - 1, seen);
        if (found > 0) return found;
      }
    }
    return 0;
  }

  function parseDamageFromText(text) {
    text = String(text || '');
    if (!text) return 0;

    const patterns = [
      /(?:总伤害|造成伤害|输出伤害|伤害输出|本局伤害|伤害)\D{0,12}([\d,.]+\s*(?:亿|万|K|M|B)?)/i,
      /([\d,.]+\s*(?:亿|万|K|M|B)?)\D{0,8}(?:总伤害|造成伤害|输出伤害|伤害输出|伤害)/i,
      /(?:damage|dmg|damage dealt|total damage)\D{0,12}([\d,.]+\s*(?:K|M|B)?)/i
    ];
    for (const re of patterns) {
      const match = text.match(re);
      if (match) {
        const parsed = parseHumanNumber(match[1]);
        if (parsed > 0) return parsed;
      }
    }
    return 0;
  }

  function collectCurrentSettlement() {
    if (window.SaveManager && typeof window.SaveManager.collectSettlement === 'function') {
      return window.SaveManager.collectSettlement('source-crystal-auto');
    }
    return {
      schemaVersion: 1,
      runStartedAt: runStartedAt.toISOString(),
      savedAt: new Date().toISOString(),
      uiSnapshot: {
        stageName: textOf('#stageName'),
        stageTimeText: textOf('#stageTime'),
        finalStatsText: textOf('#finalStats'),
        statsPanelText: textOf('#stats')
      },
      detectedGlobalState: collectKnownGlobalsFallback()
    };
  }

  function collectKnownGlobalsFallback() {
    const out = {};
    ['damageDealt', 'totalDamage', 'runDamage', 'kills', 'killCount', 'currentStage', 'stage', 'level', 'score'].forEach(key => {
      if (typeof window[key] === 'number' || typeof window[key] === 'string') out[key] = window[key];
    });
    ['player', 'runStats', 'gameStats', 'stats', 'settlementStats'].forEach(key => {
      if (window[key] && typeof window[key] === 'object') {
        try { out[key] = JSON.parse(JSON.stringify(window[key])); } catch (_) {}
      }
    });
    return out;
  }

  function extractDamageDealt(settlement) {
    const keys = ['damageDealt', 'totalDamage', 'runDamage', 'damage', 'damageDone', 'totalDamageDealt'];
    const structured = findNumberByKeys(settlement, keys, 5);
    if (structured > 0) return structured;

    const ui = settlement && settlement.uiSnapshot ? settlement.uiSnapshot : {};
    const fromFinal = parseDamageFromText(ui.finalStatsText || '');
    if (fromFinal > 0) return fromFinal;
    const fromStats = parseDamageFromText(ui.statsPanelText || '');
    if (fromStats > 0) return fromStats;

    // 最后再从整个页面文本里找“伤害”，避免 finalStats 结构变化导致读取不到。
    const gameOverText = textOf('#gameOver');
    return parseDamageFromText(gameOverText);
  }

  function makeRunKey(settlement, damageDealt) {
    const ui = settlement && settlement.uiSnapshot ? settlement.uiSnapshot : {};
    return [
      settlement && settlement.runStartedAt ? settlement.runStartedAt : runStartedAt.toISOString(),
      ui.stageName || '',
      ui.stageTimeText || '',
      ui.finalStatsText || '',
      Math.floor(Number(damageDealt) || 0)
    ].join('|');
  }

  function calculateSourceCrystals(damageDealt) {
    damageDealt = Math.max(0, Number(damageDealt) || 0);
    if (damageDealt <= 0) return 0;

    const rawBase = Math.floor(damageDealt / DAMAGE_PER_CRYSTAL);
    const baseReward = clamp(Math.max(MIN_REWARD_IF_DAMAGE_GT_ZERO, rawBase), 0, MAX_CRYSTAL_REWARD_PER_RUN);
    const refineLevel = getUpgradeLevel('sourceRefine');
    const multiplier = 1 + refineLevel * 0.08;

    // 先按原公式得到基础源晶，再吃“源晶精炼矩阵”的倍率。
    // 满级 Lv.5 = +40%，所以基础上限 120 会被提升到 168。
    return Math.floor(baseReward * multiplier);
  }

  function getSourceCrystalRewardBreakdown(damageDealt) {
    damageDealt = Math.max(0, Number(damageDealt) || 0);
    if (damageDealt <= 0) {
      return { damageDealt: 0, baseReward: 0, refineLevel: getUpgradeLevel('sourceRefine'), multiplier: getPermanentUpgradeBonuses().sourceCrystalMultiplier, finalReward: 0, bonusReward: 0 };
    }
    const rawBase = Math.floor(damageDealt / DAMAGE_PER_CRYSTAL);
    const baseReward = clamp(Math.max(MIN_REWARD_IF_DAMAGE_GT_ZERO, rawBase), 0, MAX_CRYSTAL_REWARD_PER_RUN);
    const refineLevel = getUpgradeLevel('sourceRefine');
    const multiplier = 1 + refineLevel * 0.08;
    const finalReward = Math.floor(baseReward * multiplier);
    return {
      damageDealt: Math.floor(damageDealt),
      baseReward,
      refineLevel,
      multiplier,
      finalReward,
      bonusReward: Math.max(0, finalReward - baseReward)
    };
  }

  function rewardFromSettlement(settlement, options) {
    options = options || {};
    if (!settlement || typeof settlement !== 'object') settlement = collectCurrentSettlement();

    const damageDealt = extractDamageDealt(settlement);
    const rewardBreakdown = getSourceCrystalRewardBreakdown(damageDealt);
    const crystals = rewardBreakdown.finalReward;
    const runKey = options.force ? `manual-${Date.now()}` : makeRunKey(settlement, damageDealt);

    if (!options.force && progress.rewardedRunKeys.includes(runKey)) {
      const existing = findRewardEntryByRunKey(runKey);
      updateCrystalRewardStatus(formatCrystalRewardText(existing ? existing.crystals : 0));
      return { ok: true, skipped: true, reason: 'duplicate-run', damageDealt, crystals: 0 };
    }

    if (crystals <= 0) {
      progress.rewardedRunKeys.push(runKey);
      progress.rewardedRunKeys = progress.rewardedRunKeys.slice(-200);
      saveProgress();
      updateCrystalRewardStatus(formatCrystalRewardText(0));
      return { ok: false, reason: 'no-damage-data', damageDealt, crystals: 0 };
    }

    const entry = {
      id: makeTimestamp(new Date()),
      claimedAt: new Date().toISOString(),
      runKey,
      damageDealt: Math.floor(damageDealt),
      crystals,
      baseCrystals: rewardBreakdown.baseReward,
      sourceRefineLevel: rewardBreakdown.refineLevel,
      sourceRefineMultiplier: rewardBreakdown.multiplier,
      sourceRefineBonusCrystals: rewardBreakdown.bonusReward,
      formula: `floor(damageDealt / ${DAMAGE_PER_CRYSTAL})，最低 ${MIN_REWARD_IF_DAMAGE_GT_ZERO}，基础单局最高 ${MAX_CRYSTAL_REWARD_PER_RUN}；源晶精炼 Lv.${rewardBreakdown.refineLevel} ×${rewardBreakdown.multiplier.toFixed(2)}`,
      stageName: settlement.uiSnapshot && settlement.uiSnapshot.stageName ? settlement.uiSnapshot.stageName : '',
      stageTimeText: settlement.uiSnapshot && settlement.uiSnapshot.stageTimeText ? settlement.uiSnapshot.stageTimeText : '',
      finalStatsText: settlement.uiSnapshot && settlement.uiSnapshot.finalStatsText ? settlement.uiSnapshot.finalStatsText : ''
    };

    progress.sourceCrystals += crystals;
    progress.totalSourceCrystalsEarned += crystals;
    progress.rewardedRunKeys.push(runKey);
    progress.rewardedRunKeys = progress.rewardedRunKeys.slice(-200);
    progress.rewardHistory.push(entry);
    progress.rewardHistory = progress.rewardHistory.slice(-50);
    saveProgress();
    appendRewardLog(entry);
    updateCrystalRewardStatus(formatCrystalRewardText(crystals));
    return { ok: true, damageDealt, crystals, rewardBreakdown, entry };
  }

  function buyUpgrade(id) {
    const def = getUpgradeDef(id);
    if (!def) return false;
    const level = getUpgradeLevel(id);
    if (level >= def.maxLevel) {
      showUpgradeToast(`${def.name} 已达到最高等级。`);
      return false;
    }

    const cost = getUpgradeCost(def);
    if (progress.sourceCrystals < cost) {
      showUpgradeToast(`源晶不足：需要 ${cost}，当前只有 ${progress.sourceCrystals}。`);
      return false;
    }

    progress.sourceCrystals -= cost;
    progress.totalSourceCrystalsSpent += cost;
    progress.upgrades[id] = level + 1;
    saveProgress();
    applyPermanentBonusesToPlayer();
    showUpgradeToast(`${def.name} 升至 Lv.${level + 1}。`);
    return true;
  }

  function refundAllUpgrades() {
    const refunded = progress.totalSourceCrystalsSpent;
    if (refunded <= 0) {
      showUpgradeToast('当前没有可重置的升级。');
      return;
    }
    UPGRADE_DEFS.forEach(def => { progress.upgrades[def.id] = 0; });
    progress.sourceCrystals += refunded;
    progress.totalSourceCrystalsSpent = 0;
    saveProgress();
    showUpgradeToast(`已重置升级并返还 ${refunded} 源晶。`);
  }

  function createPanelIfNeeded() {
    if (document.querySelector('#shipUpgradeOverlay')) return;

    const style = document.createElement('style');
    style.id = 'shipUpgradeStyle';
    style.textContent = `
      #shipUpgradeOverlay{position:fixed;inset:0;z-index:9998;display:none;align-items:center;justify-content:center;background:rgba(2,6,18,.72);backdrop-filter:blur(10px);color:#eef6ff;font-family:inherit;}
      #shipUpgradeOverlay.open{display:flex;}
      .shipUpgradeModal{width:min(1080px,92vw);max-height:88vh;overflow:auto;border:1px solid rgba(120,210,255,.35);border-radius:22px;background:linear-gradient(180deg,rgba(14,24,48,.96),rgba(4,8,20,.96));box-shadow:0 24px 80px rgba(0,0,0,.55),inset 0 0 34px rgba(50,160,255,.08);padding:22px;}
      .shipUpgradeHeader{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;}
      .shipUpgradeBack{width:42px;height:42px;border-radius:14px;border:1px solid rgba(140,220,255,.35);background:rgba(255,255,255,.06);color:#e8f8ff;font-size:24px;cursor:pointer;}
      .shipUpgradeBack:hover{background:rgba(105,190,255,.16);}
      .shipUpgradeTitleWrap{flex:1;}
      .shipUpgradeTitle{font-size:28px;font-weight:800;letter-spacing:.08em;margin:0 0 6px;text-shadow:0 0 18px rgba(100,200,255,.42);}
      .shipUpgradeSub{font-size:14px;line-height:1.7;color:rgba(235,247,255,.78);margin:0;}
      .shipUpgradeBalance{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 18px;}
      .shipUpgradePill{border:1px solid rgba(124,211,255,.28);border-radius:999px;padding:8px 13px;background:rgba(255,255,255,.06);font-size:13px;color:rgba(238,248,255,.88);}
      .shipUpgradePill strong{color:#fff;font-size:16px;margin-left:4px;}
      .shipUpgradeGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
      .shipUpgradeCard{border:1px solid rgba(140,220,255,.24);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035));padding:16px;box-shadow:inset 0 0 18px rgba(255,255,255,.025);}
      .shipUpgradeCardTop{display:flex;gap:12px;align-items:center;margin-bottom:10px;}
      .shipUpgradeIcon{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(70,180,255,.13);border:1px solid rgba(110,210,255,.24);font-size:20px;}
      .shipUpgradeName{font-size:17px;font-weight:800;}
      .shipUpgradeLevel{font-size:12px;color:rgba(232,246,255,.68);margin-top:2px;}
      .shipUpgradeDesc{font-size:13px;line-height:1.65;color:rgba(232,246,255,.76);min-height:62px;}
      .shipUpgradeEffect{font-size:13px;color:#eaffff;background:rgba(90,210,255,.08);border:1px solid rgba(105,218,255,.18);border-radius:12px;padding:8px 10px;margin:10px 0;}
      .shipUpgradeBar{height:8px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;margin:10px 0 12px;}
      .shipUpgradeBarFill{height:100%;border-radius:999px;background:linear-gradient(90deg,#7ee7ff,#d8fbff);box-shadow:0 0 16px rgba(126,231,255,.55);}
      .shipUpgradeBuy{width:100%;border:0;border-radius:13px;padding:10px 12px;background:linear-gradient(180deg,#baf5ff,#62cfff);color:#07111d;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(41,191,255,.18);}
      .shipUpgradeBuy:hover{filter:brightness(1.08);}
      .shipUpgradeBuy:disabled{cursor:not-allowed;filter:grayscale(.6) brightness(.7);opacity:.62;}
      .shipUpgradeFooter{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap;}
      .shipUpgradeSmallBtn{border:1px solid rgba(180,225,255,.24);border-radius:12px;background:rgba(255,255,255,.06);color:rgba(240,250,255,.88);padding:9px 12px;cursor:pointer;}
      .shipUpgradeSmallBtn:hover{background:rgba(255,255,255,.1);}
      #shipUpgradeToast{min-height:20px;font-size:13px;color:rgba(235,250,255,.78);}
      #crystalRewardStatus{font-size:18px;margin:16px auto 8px;color:#ffe99a;font-weight:800;letter-spacing:.04em;text-shadow:0 0 14px rgba(255,210,90,.35);}
      @media(max-width:900px){.shipUpgradeGrid{grid-template-columns:repeat(2,minmax(0,1fr));}.shipUpgradeTitle{font-size:23px;}}
      @media(max-width:620px){.shipUpgradeGrid{grid-template-columns:1fr;}.shipUpgradeModal{padding:16px;}.shipUpgradeHeader{gap:10px;}.shipUpgradeTitle{font-size:21px;}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'shipUpgradeOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="shipUpgradeModal" role="dialog" aria-modal="true" aria-labelledby="shipUpgradeTitle">
        <div class="shipUpgradeHeader">
          <button class="shipUpgradeBack" type="button" aria-label="返回主菜单">←</button>
          <div class="shipUpgradeTitleWrap">
            <h2 id="shipUpgradeTitle" class="shipUpgradeTitle">战机升级</h2>
            <p class="shipUpgradeSub">每局结束后会根据本局总伤害结算源晶。源晶可以用于永久升级战机，升级效果会保存到本地，并在后续新局中生效。</p>
          </div>
        </div>
        <div class="shipUpgradeBalance" id="shipUpgradeBalance"></div>
        <div class="shipUpgradeGrid" id="shipUpgradeGrid"></div>
        <div class="shipUpgradeFooter">
          <div id="shipUpgradeToast"></div>
          <div>
            <button class="shipUpgradeSmallBtn" type="button" id="shipUpgradeManualClaim">尝试结算当前局源晶</button>
            <button class="shipUpgradeSmallBtn" type="button" id="shipUpgradeRefund">重置升级并返还源晶</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.shipUpgradeBack').addEventListener('click', closePanel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closePanel();
    });
    overlay.querySelector('#shipUpgradeManualClaim').addEventListener('click', () => {
      rewardFromSettlement(collectCurrentSettlement(), { force: false });
    });
    overlay.querySelector('#shipUpgradeRefund').addEventListener('click', () => {
      if (confirm('确定要重置所有战机升级吗？已花费的源晶会返还。')) refundAllUpgrades();
    });
  }

  function openPanel() {
    createPanelIfNeeded();
    progress = loadProgress();
    renderPanelIfOpen(true);
    const overlay = document.querySelector('#shipUpgradeOverlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    const overlay = document.querySelector('#shipUpgradeOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function renderPanelIfOpen(force) {
    const overlay = document.querySelector('#shipUpgradeOverlay');
    if (!overlay || (!force && !overlay.classList.contains('open'))) return;

    const balance = overlay.querySelector('#shipUpgradeBalance');
    if (balance) {
      const bonuses = getPermanentUpgradeBonuses();
      balance.innerHTML = `
        <div class="shipUpgradePill">当前源晶 <strong>${progress.sourceCrystals}</strong></div>
        <div class="shipUpgradePill">累计获得 <strong>${progress.totalSourceCrystalsEarned}</strong></div>
        <div class="shipUpgradePill">已消耗 <strong>${progress.totalSourceCrystalsSpent}</strong></div>
        <div class="shipUpgradePill">伤害倍率 <strong>${Math.round(bonuses.damageMultiplier * 100)}%</strong></div>
        <div class="shipUpgradePill">生命倍率 <strong>${Math.round(bonuses.maxHpMultiplier * 100)}%</strong></div>
        <div class="shipUpgradePill">额外刷新 <strong>+${bonuses.cardRefreshBonus}</strong></div>
        <div class="shipUpgradePill">源晶结算 <strong>${Math.round(bonuses.sourceCrystalMultiplier * 100)}%</strong></div>
      `;
    }

    const grid = overlay.querySelector('#shipUpgradeGrid');
    if (!grid) return;
    grid.innerHTML = UPGRADE_DEFS.map(def => {
      const level = getUpgradeLevel(def.id);
      const cost = getUpgradeCost(def);
      const isMax = level >= def.maxLevel;
      const canBuy = !isMax && progress.sourceCrystals >= cost;
      const pct = Math.round((level / def.maxLevel) * 100);
      const nextText = isMax ? '已满级' : `升级消耗 ${cost} 源晶`;
      return `
        <section class="shipUpgradeCard">
          <div class="shipUpgradeCardTop">
            <div class="shipUpgradeIcon">${def.icon}</div>
            <div>
              <div class="shipUpgradeName">${def.name}</div>
              <div class="shipUpgradeLevel">Lv.${level} / Lv.${def.maxLevel}</div>
            </div>
          </div>
          <div class="shipUpgradeDesc"><strong>${def.short}</strong><br>${def.detail}</div>
          <div class="shipUpgradeEffect">当前效果：${def.bonusText(level)}</div>
          <div class="shipUpgradeBar"><div class="shipUpgradeBarFill" style="width:${pct}%"></div></div>
          <button class="shipUpgradeBuy" type="button" data-buy-upgrade="${def.id}" ${canBuy ? '' : 'disabled'}>${nextText}</button>
        </section>
      `;
    }).join('');

    grid.querySelectorAll('[data-buy-upgrade]').forEach(btn => {
      btn.addEventListener('click', () => buyUpgrade(btn.getAttribute('data-buy-upgrade')));
    });
  }

  function showUpgradeToast(message) {
    const el = document.querySelector('#shipUpgradeToast');
    if (el) el.textContent = message || '';
  }

  function ensureRewardStatusNode() {
    const gameOverMenu = document.querySelector('#gameOver .menu');
    if (!gameOverMenu || document.querySelector('#crystalRewardStatus')) return;
    const finalStats = document.querySelector('#finalStats');
    const node = document.createElement('div');
    node.id = 'crystalRewardStatus';
    if (finalStats && finalStats.parentNode) {
      finalStats.insertAdjacentElement('afterend', node);
    } else {
      gameOverMenu.appendChild(node);
    }
  }

  function formatCrystalRewardText(crystals) {
    return `获得源晶：${Math.max(0, Math.floor(Number(crystals) || 0))}`;
  }

  function findRewardEntryByRunKey(runKey) {
    const history = Array.isArray(progress.rewardHistory) ? progress.rewardHistory : [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] && history[i].runKey === runKey) return history[i];
    }
    return null;
  }

  function updateCrystalRewardStatus(message) {
    ensureRewardStatusNode();
    const el = document.querySelector('#crystalRewardStatus');
    if (!el) return;
    if (message) {
      el.textContent = message;
      return;
    }
    const last = progress.rewardHistory && progress.rewardHistory.length ? progress.rewardHistory[progress.rewardHistory.length - 1] : null;
    el.textContent = formatCrystalRewardText(last ? last.crystals : 0);
  }

  function removeMenuHidingClasses(el) {
    if (!el || !el.classList) return;
    [
      'hide', 'hidden', 'is-hidden', 'closed', 'collapsed',
      'leaving', 'leave', 'leaved', 'exiting', 'exit', 'fadeOut', 'fade-out',
      'pageOut', 'page-out', 'slideOut', 'slide-out', 'toGame', 'to-game',
      'gameMode', 'game-mode', 'playing', 'inGame', 'in-game', 'inactive'
    ].forEach(cls => el.classList.remove(cls));
  }

  function forceElementVisible(el, fallbackDisplay) {
    if (!el) return;
    removeMenuHidingClasses(el);
    el.hidden = false;
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    el.style.transform = 'none';
    el.style.filter = 'none';
    el.style.clipPath = 'none';
    el.style.maxHeight = '';
    el.style.height = '';
    el.style.overflow = '';
    el.style.display = fallbackDisplay || '';
  }

  function forceElementHidden(el) {
    if (!el) return;
    el.classList.remove('show', 'active', 'open', 'visible');
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  }

  function resetStartMenuVisualState() {
    const startOverlay = document.querySelector('#startOverlay');
    const startRoot = document.querySelector('#startOverlay .startRoot');
    const startLogo = document.querySelector('#startLogo');
    const startMenu = document.querySelector('#startOverlay .startMenu');
    const startButtons = document.querySelectorAll('#startOverlay .startTextBtn');
    const startPanel = document.querySelector('#startPanel');
    const subPanels = document.querySelectorAll('#startPanel .startSubPanel');

    if (startOverlay) {
      removeMenuHidingClasses(startOverlay);
      startOverlay.classList.add('show', 'active', 'open', 'visible');
      startOverlay.hidden = false;
      startOverlay.removeAttribute('hidden');
      startOverlay.setAttribute('aria-hidden', 'false');
      startOverlay.style.display = 'flex';
      startOverlay.style.visibility = 'visible';
      startOverlay.style.opacity = '1';
      startOverlay.style.pointerEvents = 'auto';
      startOverlay.style.transform = 'none';
      startOverlay.style.filter = 'none';
      startOverlay.style.clipPath = 'none';
      startOverlay.scrollTop = 0;
    }

    // startPageTransition 进入游戏时可能会给 logo / 菜单 / 按钮写入透明、位移或 display:none。
    // 返回主菜单时必须把这些状态清掉，否则会只看到主菜单背景，看不到任何按钮。
    forceElementVisible(startRoot, '');
    forceElementVisible(startLogo, 'block');
    forceElementVisible(startMenu, 'flex');

    startButtons.forEach(btn => {
      forceElementVisible(btn, '');
      btn.disabled = false;
      btn.style.transitionDelay = '';
    });

    // 回到主菜单首页时不展开教程 / 设置 / 退出提示这些旧子面板。
    // 可靠版教程和设置用独立 overlay，不受这里影响。
    if (startPanel) {
      removeMenuHidingClasses(startPanel);
      startPanel.classList.remove('show', 'active', 'open', 'visible');
      startPanel.setAttribute('aria-hidden', 'true');
      startPanel.style.display = 'none';
      startPanel.style.opacity = '';
      startPanel.style.pointerEvents = '';
      startPanel.style.transform = '';
    }
    subPanels.forEach(panel => {
      panel.classList.remove('show', 'active', 'open', 'visible');
      panel.setAttribute('aria-hidden', 'true');
      panel.style.display = 'none';
    });
  }

  function returnToMainMenuFromGameOver() {
    const gameOver = document.querySelector('#gameOver');
    const pauseOverlay = document.querySelector('#pauseOverlay');
    const levelOverlay = document.querySelector('#levelOverlay');
    const tutorialOverlay = document.querySelector('#tutorialOverlayReliable');
    const settingsOverlay = document.querySelector('#mainSettingsOverlayReliable');
    const upgradeOverlay = document.querySelector('#shipUpgradeOverlay');

    // 隐藏战斗中可能残留的弹层，但不要把主菜单子元素也误隐藏。
    [gameOver, pauseOverlay, levelOverlay, tutorialOverlay, settingsOverlay, upgradeOverlay].forEach(forceElementHidden);

    resetStartMenuVisualState();

    // 如果原 game.js 使用自己的页面切换函数，回主菜单时只做“主菜单态”复原，不重新加载页面。
    try { if (typeof window.paused !== 'undefined') window.paused = true; } catch (_) {}
    try { if (typeof window.gameRunning !== 'undefined') window.gameRunning = false; } catch (_) {}
    try { if (typeof window.isGameRunning !== 'undefined') window.isGameRunning = false; } catch (_) {}
    try { if (typeof window.gameStarted !== 'undefined') window.gameStarted = false; } catch (_) {}
  }

  function isGameOverVisible() {
    const overlay = document.querySelector('#gameOver');
    if (!overlay) return false;
    const style = window.getComputedStyle(overlay);
    const finalStatsText = textOf('#finalStats');
    const visuallyOpen = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    const classLooksOpen = /show|active|open|visible/i.test(overlay.className || '');
    return Boolean(finalStatsText) && (visuallyOpen || classLooksOpen);
  }

  function scheduleAutoReward() {
    window.clearTimeout(autoRewardTimer);
    autoRewardTimer = window.setTimeout(() => {
      if (isGameOverVisible()) rewardFromSettlement(collectCurrentSettlement());
    }, 260);
  }

  function installGameOverObserver() {
    if (observerInstalled) return;
    observerInstalled = true;
    ensureRewardStatusNode();

    const overlay = document.querySelector('#gameOver');
    const finalStats = document.querySelector('#finalStats');
    if (overlay) {
      new MutationObserver(scheduleAutoReward).observe(overlay, {
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-hidden'],
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    if (finalStats) {
      new MutationObserver(scheduleAutoReward).observe(finalStats, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  function wrapStartAndRestart() {
    if (typeof window.startPageTransition === 'function' && !window.startPageTransition.__shipUpgradeWrapped) {
      const old = window.startPageTransition;
      window.startPageTransition = function (btn, target) {
        if (target === 'game') {
          runStartedAt = new Date();
          applyPermanentBonusesToPlayer();
        }
        return old.apply(this, arguments);
      };
      window.startPageTransition.__shipUpgradeWrapped = true;
    }

    if (typeof window.restartGame === 'function' && !window.restartGame.__shipUpgradeWrapped) {
      const oldRestart = window.restartGame;
      window.restartGame = function () {
        runStartedAt = new Date();
        const result = oldRestart.apply(this, arguments);
        window.setTimeout(applyPermanentBonusesToPlayer, 50);
        window.setTimeout(applyPermanentBonusesToPlayer, 300);
        return result;
      };
      window.restartGame.__shipUpgradeWrapped = true;
    }
  }

  function installApplyLoop() {
    // 不知道 game.js 具体创建 player 的时间，所以前几秒多尝试几次；之后低频兜底。
    let fastTicks = 0;
    const fastTimer = window.setInterval(() => {
      applyPermanentBonusesToPlayer();
      fastTicks += 1;
      if (fastTicks >= 60) window.clearInterval(fastTimer);
    }, 250);
    window.setInterval(applyPermanentBonusesToPlayer, 3000);
  }

  function exportApi() {
    window.openShipUpgradePanel = openPanel;
    window.closeShipUpgradePanel = closePanel;
    window.getPermanentUpgradeBonuses = getPermanentUpgradeBonuses;
    window.ShipUpgradeManager = {
      openPanel,
      closePanel,
      getProgress: () => JSON.parse(JSON.stringify(progress)),
      getPermanentUpgradeBonuses,
      getPermanentCardRefreshCount: () => getPermanentUpgradeBonuses().cardRefreshBonus,
      applyPermanentCardRefreshBonus: baseCount => Math.max(0, Math.floor(Number(baseCount) || 0)) + getPermanentUpgradeBonuses().cardRefreshBonus,
      applyPermanentBonusesToPlayer,
      rewardFromSettlement,
      calculateSourceCrystals,
      getSourceCrystalRewardBreakdown,
      buyUpgrade,
      refundAllUpgrades,
      returnToMainMenuFromGameOver,
      reloadProgress: () => { progress = loadProgress(); updateGlobalBonuses(); renderPanelIfOpen(); return progress; }
    };
    window.returnToMainMenuFromGameOver = returnToMainMenuFromGameOver;
    updateGlobalBonuses();
  }

  window.addEventListener('DOMContentLoaded', () => {
    exportApi();
    if (progress.__needsMigrationSave) saveProgress();
    createPanelIfNeeded();
    installGameOverObserver();
    wrapStartAndRestart();
    installApplyLoop();
    updateCrystalRewardStatus();
  });

  exportApi();
  wrapStartAndRestart();
})();
