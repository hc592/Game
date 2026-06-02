/*
 * 星魂舰队 - 结算存档管理器
 * ------------------------------------------------------------
 * 作用：
 * 1. 当“战斗终结 / gameOver”结算面板出现时，自动保存本局结算数据。
 * 2. 在 Electron / NW.js / 启用 Node 能力的 exe 环境中，写入项目根目录 save 文件夹。
 * 3. 在普通浏览器中，网页没有权限直接写入本地根目录，所以会自动退化为 localStorage 备份，
 *    同时保留手动导出 JSON 的能力。
 *
 * 推荐后续在 js/game.js 的结算函数里主动调用：
 * window.SaveManager.saveSettlement({
 *   result: 'dead' 或 'clear',
 *   stageReached: 当前关卡,
 *   survivalSeconds: 存活秒数,
 *   kills: 击杀数,
 *   level: 玩家等级,
 *   damageDealt: 总伤害,
 *   damageTaken: 承受伤害,
 *   weapons: 武器/等级数组,
 *   passives: 被动/等级数组
 * });
 * 这样比只从 DOM 结算面板读取文字更准确。
 */
(function () {
  'use strict';

  const SAVE_DIR_NAME = 'save';
  const STORAGE_KEY = 'star_soul_fleet_settlement_saves';
  const MAX_BROWSER_SAVES = 100;

  let runStartedAt = new Date();
  let autoSavedForCurrentRun = false;
  let lastSavedSignature = '';

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function makeTimestamp(date) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join('') + '_' + [
      pad2(date.getHours()),
      pad2(date.getMinutes()),
      pad2(date.getSeconds())
    ].join('');
  }

  function textOf(selector) {
    const el = document.querySelector(selector);
    return el ? (el.innerText || el.textContent || '').trim() : '';
  }

  function attrText(selector, attr) {
    const el = document.querySelector(selector);
    return el ? (el.getAttribute(attr) || '') : '';
  }

  function parseStageNumber(stageName) {
    const match = String(stageName || '').match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function parseTimeToSeconds(timeText) {
    const parts = String(timeText || '').split(':').map(v => Number(v));
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  function safePlainCopy(value, depth, seen) {
    if (value == null) return value;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (depth <= 0) return '[MaxDepth]';
    if (!seen) seen = new WeakSet();
    if (typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (Array.isArray(value)) {
      return value.slice(0, 50).map(item => safePlainCopy(item, depth - 1, seen));
    }
    const out = {};
    Object.keys(value).slice(0, 80).forEach(key => {
      const copied = safePlainCopy(value[key], depth - 1, seen);
      if (copied !== undefined) out[key] = copied;
    });
    return out;
  }

  function pickObjectFields(obj, fields) {
    if (!obj || typeof obj !== 'object') return null;
    const out = {};
    fields.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        out[key] = safePlainCopy(obj[key], 2);
      }
    });
    return Object.keys(out).length ? out : null;
  }

  function collectKnownGlobalState() {
    const result = {};

    // 这些名字是常见游戏变量名；如果 game.js 里存在，就会自动读取。
    const primitiveKeys = [
      'difficulty', 'currentDifficulty', 'selectedDifficulty',
      'stage', 'stageIndex', 'stageNumber', 'currentStage',
      'kills', 'killCount', 'score', 'level', 'elapsed', 'elapsedTime', 'survivalTime',
      'damageDealt', 'totalDamage', 'damageTaken'
    ];

    primitiveKeys.forEach(key => {
      if (typeof window[key] === 'number' || typeof window[key] === 'string' || typeof window[key] === 'boolean') {
        result[key] = window[key];
      }
    });

    const playerFields = [
      'hp', 'maxHp', 'level', 'xp', 'nextXp', 'score', 'kills', 'killCount',
      'damageDealt', 'damageTaken', 'weapons', 'passives', 'weaponSlots', 'upgrades'
    ];
    const player = pickObjectFields(window.player, playerFields);
    if (player) result.player = player;

    const statsFields = [
      'kills', 'killCount', 'score', 'level', 'stage', 'stageIndex', 'stageNumber',
      'survivalTime', 'elapsed', 'damageDealt', 'totalDamage', 'damageTaken',
      'weapons', 'passives', 'upgrades', 'result'
    ];
    ['stats', 'runStats', 'gameStats', 'settlementStats'].forEach(name => {
      const picked = pickObjectFields(window[name], statsFields);
      if (picked) result[name] = picked;
    });

    return result;
  }

  function collectWeaponPanel() {
    const weaponBox = document.querySelector('#weapons');
    if (!weaponBox) return [];
    return Array.from(weaponBox.children).map((node, index) => ({
      index,
      text: (node.innerText || node.textContent || '').trim()
    })).filter(item => item.text);
  }

  function collectSettlement(reason, extraData) {
    const now = new Date();
    const stageName = textOf('#stageName');
    const stageTime = textOf('#stageTime');
    const finalStatsText = textOf('#finalStats');
    const statsPanelText = textOf('#stats');

    const settlement = {
      schemaVersion: 1,
      game: '星魂舰队 Rogue Survivor',
      runId: makeTimestamp(now),
      saveReason: reason || 'auto-game-over',
      savedAt: now.toISOString(),
      runStartedAt: runStartedAt.toISOString(),
      runDurationSecondsApprox: Math.max(0, Math.round((now.getTime() - runStartedAt.getTime()) / 1000)),

      // 从当前 UI 读取到的结算信息。即使 game.js 内部变量名不同，也能保底保存一份可读数据。
      uiSnapshot: {
        stageName,
        stageNumber: parseStageNumber(stageName),
        stageTimeText: stageTime,
        stageTimeSeconds: parseTimeToSeconds(stageTime),
        stageHint: textOf('#stageHint'),
        bossName: textOf('#bossName'),
        bossPhaseText: textOf('#bossPhaseText'),
        finalStatsText,
        statsPanelText,
        weaponPanel: collectWeaponPanel(),
        difficultyDesc: textOf('#difficultyDesc'),
        gameOverClass: attrText('#gameOver', 'class')
      },

      // 如果 game.js 暴露了常见全局变量，会额外保存结构化数据。
      detectedGlobalState: collectKnownGlobalState()
    };

    if (extraData && typeof extraData === 'object') {
      settlement.extraData = safePlainCopy(extraData, 4);
    }

    return settlement;
  }

  function makeSignature(settlement) {
    return [
      settlement.runStartedAt,
      settlement.uiSnapshot.finalStatsText,
      settlement.uiSnapshot.stageName,
      settlement.uiSnapshot.stageTimeText,
      JSON.stringify(settlement.detectedGlobalState || {})
    ].join('|');
  }

  function getRequireFunction() {
    // Electron/NW.js 开启 Node 能力后，renderer 里通常可以访问 require 或 window.require。
    if (typeof window.require === 'function') return window.require;
    if (typeof require === 'function') return require;
    return null;
  }

  function getNodeSaveBridge() {
    const req = getRequireFunction();
    if (!req) return null;

    try {
      const fs = req('fs');
      const path = req('path');
      const processRef = window.process || (typeof process !== 'undefined' ? process : null);
      let rootDir = null;

      // 开发环境：优先保存到当前项目根目录。
      if (processRef && typeof processRef.cwd === 'function') {
        const cwd = processRef.cwd();
        if (fs.existsSync(path.join(cwd, 'index.html')) || fs.existsSync(path.join(cwd, 'js'))) {
          rootDir = cwd;
        }
      }

      // 普通本地 HTML / NW.js：__dirname 通常就是 index.html 所在目录。
      if (!rootDir && typeof __dirname === 'string') {
        rootDir = __dirname;
      }

      // Electron 打包后：退回到 exe 所在目录，方便用户直接看到 save 文件夹。
      if (!rootDir && processRef && processRef.execPath) {
        rootDir = path.dirname(processRef.execPath);
      }

      if (!rootDir) return null;
      return {
        fs,
        path,
        rootDir,
        saveDir: path.join(rootDir, SAVE_DIR_NAME)
      };
    } catch (err) {
      console.warn('[SaveManager] Node 文件系统不可用，已退回浏览器存档。', err);
      return null;
    }
  }

  function saveToLocalStorage(settlement) {
    try {
      const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      old.push(settlement);
      const trimmed = old.slice(-MAX_BROWSER_SAVES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return { ok: true, mode: 'localStorage', count: trimmed.length };
    } catch (err) {
      console.warn('[SaveManager] localStorage 写入失败。', err);
      return { ok: false, mode: 'localStorage', error: String(err && err.message ? err.message : err) };
    }
  }

  function saveToFileSystem(settlement) {
    const bridge = getNodeSaveBridge();
    if (!bridge) {
      return { ok: false, mode: 'fileSystem', reason: '当前运行环境没有 Node/Electron 文件系统权限。' };
    }

    const { fs, path, saveDir } = bridge;
    fs.mkdirSync(saveDir, { recursive: true });

    const fileName = `run_${settlement.runId}.json`;
    const filePath = path.join(saveDir, fileName);
    const jsonText = JSON.stringify(settlement, null, 2);

    fs.writeFileSync(filePath, jsonText, 'utf8');
    fs.appendFileSync(path.join(saveDir, 'settlements.jsonl'), JSON.stringify(settlement) + '\n', 'utf8');

    return { ok: true, mode: 'fileSystem', fileName, filePath, saveDir };
  }

  function setSaveStatus(message) {
    const el = document.querySelector('#saveStatus');
    if (el) el.textContent = message || '';
  }

  function saveSettlement(payloadOrReason, extraData) {
    const settlement = payloadOrReason && typeof payloadOrReason === 'object' && !Array.isArray(payloadOrReason)
      ? Object.assign(collectSettlement('manual-structured-data'), safePlainCopy(payloadOrReason, 5))
      : collectSettlement(payloadOrReason || 'auto-game-over', extraData);

    const signature = makeSignature(settlement);
    if (signature === lastSavedSignature && autoSavedForCurrentRun) {
      return { ok: true, skipped: true, reason: 'duplicate-current-run' };
    }

    const fileResult = saveToFileSystem(settlement);
    const browserBackup = saveToLocalStorage(settlement);

    lastSavedSignature = signature;
    autoSavedForCurrentRun = true;

    if (fileResult.ok) {
      setSaveStatus(`本局结算已保存：save/${fileResult.fileName}`);
      console.info('[SaveManager] 结算已保存到文件：', fileResult.filePath, settlement);
    } else if (browserBackup.ok) {
      setSaveStatus('当前是普通浏览器环境，已临时保存到浏览器 localStorage；打包 exe 后可写入根目录 save 文件夹。');
      console.info('[SaveManager] 浏览器环境无法直接写入 save 文件夹，已保存到 localStorage。', settlement);
    } else {
      setSaveStatus('存档失败：当前环境没有文件权限，浏览器备份也失败。');
      console.warn('[SaveManager] 存档失败。', fileResult, browserBackup, settlement);
    }

    return { ok: fileResult.ok || browserBackup.ok, fileResult, browserBackup, settlement };
  }

  function isGameOverVisible() {
    const overlay = document.querySelector('#gameOver');
    if (!overlay) return false;
    const style = window.getComputedStyle(overlay);
    const finalStatsText = textOf('#finalStats');

    // 不同版本的 CSS 可能通过 display/class/opacity/pointer-events 控制 overlay。
    const visuallyOpen = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    const classLooksOpen = /show|active|open|visible/i.test(overlay.className || '');

    return Boolean(finalStatsText) && (visuallyOpen || classLooksOpen);
  }

  function scheduleAutoSave() {
    window.clearTimeout(scheduleAutoSave._timer);
    scheduleAutoSave._timer = window.setTimeout(() => {
      if (isGameOverVisible()) saveSettlement('auto-game-over');
    }, 160);
  }

  function startNewRun(reason) {
    runStartedAt = new Date();
    autoSavedForCurrentRun = false;
    lastSavedSignature = '';
    setSaveStatus('');
    console.info('[SaveManager] 新一局开始：', reason || 'unknown');
  }

  function wrapGameFunctions() {
    // 点击“开始游戏”时刷新 runStartedAt。保留原有函数行为。
    if (typeof window.startPageTransition === 'function' && !window.startPageTransition.__saveWrapped) {
      const originalStartPageTransition = window.startPageTransition;
      window.startPageTransition = function (btn, target) {
        if (target === 'game') startNewRun('start-button');
        return originalStartPageTransition.apply(this, arguments);
      };
      window.startPageTransition.__saveWrapped = true;
    }

    // 重新开始前，如果结算界面已经出现但还没来得及保存，先兜底保存一次。
    if (typeof window.restartGame === 'function' && !window.restartGame.__saveWrapped) {
      const originalRestartGame = window.restartGame;
      window.restartGame = function () {
        if (isGameOverVisible() && !autoSavedForCurrentRun) {
          saveSettlement('before-restart');
        }
        startNewRun('restart');
        return originalRestartGame.apply(this, arguments);
      };
      window.restartGame.__saveWrapped = true;
    }
  }

  function installObservers() {
    const overlay = document.querySelector('#gameOver');
    const finalStats = document.querySelector('#finalStats');
    if (overlay) {
      new MutationObserver(scheduleAutoSave).observe(overlay, {
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-hidden'],
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    if (finalStats) {
      new MutationObserver(scheduleAutoSave).observe(finalStats, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  function downloadLastSettlement() {
    const settlement = collectSettlement('manual-download');
    const blob = new Blob([JSON.stringify(settlement, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run_${settlement.runId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getBrowserSaves() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function openSaveFolder() {
    const bridge = getNodeSaveBridge();
    if (!bridge) {
      setSaveStatus('当前是普通浏览器环境，不能直接打开本地 save 文件夹。');
      return false;
    }

    try {
      bridge.fs.mkdirSync(bridge.saveDir, { recursive: true });
      const req = getRequireFunction();
      const electron = req ? req('electron') : null;
      if (electron && electron.shell && typeof electron.shell.openPath === 'function') {
        electron.shell.openPath(bridge.saveDir);
        return true;
      }
      setSaveStatus(`存档目录：${bridge.saveDir}`);
      console.info('[SaveManager] 存档目录：', bridge.saveDir);
      return true;
    } catch (err) {
      setSaveStatus('打开存档文件夹失败，但存档功能本身不受影响。');
      console.warn('[SaveManager] 打开存档文件夹失败：', err);
      return false;
    }
  }

  window.SaveManager = {
    collectSettlement,
    saveSettlement,
    startNewRun,
    downloadLastSettlement,
    getBrowserSaves,
    openSaveFolder
  };

  window.saveSettlementNow = function (reason, extraData) {
    return saveSettlement(reason || 'manual-call', extraData);
  };
  window.openSaveFolder = openSaveFolder;

  window.addEventListener('DOMContentLoaded', () => {
    wrapGameFunctions();
    installObservers();
    scheduleAutoSave();
  });

  // 如果 game.js 是同步加载并已经完成函数注册，立即包一遍；否则 DOMContentLoaded 时还会再包一次。
  wrapGameFunctions();

  // 页面关闭时做一次兜底。注意：普通浏览器 beforeunload 不适合弹下载框，所以这里只尝试同步保存。
  window.addEventListener('beforeunload', () => {
    if (isGameOverVisible() && !autoSavedForCurrentRun) {
      saveSettlement('before-unload');
    }
  });
})();
