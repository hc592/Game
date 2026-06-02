(function(){
  'use strict';
  // Legacy compatibility entrypoint. The Boss visual cleanup patch now
  // lives in js/systems/bossSystem.js as GameBossSystem.installBossVisualCleanup.
  if(window.GameBossSystem&&typeof window.GameBossSystem.installBossVisualCleanup==='function'){
    window.GameBossSystem.installBossVisualCleanup();
  }
})();
