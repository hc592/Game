(function(){
  'use strict';

  function getRuntime(){
    return window.GameRuntime || {};
  }

  function getAudio(){
    return window.GameAudio || {};
  }

  function getInput(){
    return window.GameInput || {};
  }

  function getUtils(){
    return window.GameUtils || {};
  }

  function clampValue(value,min,max){
    const clamp=getUtils().clamp;
    return typeof clamp==='function'?clamp(value,min,max):Math.max(min,Math.min(max,value));
  }

  function callAudio(name){
    const audio=getAudio();
    if(typeof audio[name]==='function')return audio[name]();
    if(typeof window[name]==='function')return window[name]();
    return undefined;
  }

  function playUiSfx(){
    const audio=getAudio();
    if(typeof audio.playSfx==='function')audio.playSfx('ui');
    else if(typeof window.playSfx==='function')window.playSfx('ui');
  }

  function getDifficultyData(){
    const runtime=getRuntime();
    return runtime.DIFFICULTY || window.DIFFICULTY || {};
  }

  function getStartPageBusy(){
    const runtime=getRuntime();
    return typeof runtime.startPageBusy!=='undefined'?runtime.startPageBusy:window.startPageBusy;
  }

  function setStartPageBusy(value){
    const runtime=getRuntime();
    if(typeof runtime.startPageBusy!=='undefined')runtime.startPageBusy=!!value;
    else window.startPageBusy=!!value;
  }

  function fmt(t){
    let m=Math.floor(t/60),s=Math.floor(t%60);
    return`${m}:${String(s).padStart(2,'0')}`;
  }

  function startPageTransition(btn,action){
    if(getStartPageBusy())return;
    setStartPageBusy(true);
    callAudio('ensureAudio');
    playUiSfx();
    const overlay=document.getElementById('startOverlay');
    const panel=document.getElementById('startPanel');
    if(panel){
      panel.classList.remove('show');
      panel.classList.remove('afterTransition');
      panel.dataset.open='';
    }
    document.querySelectorAll('.startTextBtn').forEach(b=>b.classList.remove('startClicked'));
    if(btn)btn.classList.add('startClicked');
    if(overlay)overlay.classList.add('leaving');
    setTimeout(()=>runStartPageAction(action),900);
  }

  function runStartPageAction(action){
    if(action==='game'){
      if(typeof window.startGame==='function')window.startGame();
      return;
    }
    if(action==='exit'){exitGame();return}
    showStartPagePanel(action,true);
  }

  function showStartPagePanel(which,afterTransition=false){
    const panel=document.getElementById('startPanel');
    if(!panel)return;
    const map={help:document.getElementById('help'),settings:document.getElementById('settingsPanel'),exit:document.getElementById('exitTip')};
    const target=map[which];
    if(!target)return;
    const alreadyOpen=!afterTransition&&panel.classList.contains('show')&&panel.dataset.open===which;
    Object.values(map).forEach(el=>{if(el)el.style.display='none'});
    if(alreadyOpen){panel.classList.remove('show');panel.classList.remove('afterTransition');panel.dataset.open='';playUiSfx();return}
    target.style.display='block';
    panel.dataset.open=which;
    panel.classList.toggle('afterTransition',!!afterTransition);
    panel.classList.add('show');
    if(!afterTransition)playUiSfx();
  }

  function toggleHelp(){showStartPagePanel('help')}

  function toggleSettingsPanel(){showStartPagePanel('settings')}

  function exitGame(){
    try{window.close()}catch(e){}
    setTimeout(()=>{if(!window.closed)showStartPagePanel('exit',true)},80);
  }

  function setDifficulty(d){
    const runtime=getRuntime();
    runtime.difficulty=d;
    for(const k of ['easy','normal','hard','nightmare'])document.getElementById('diff'+k[0].toUpperCase()+k.slice(1)).classList.toggle('active',k===d);
    document.getElementById('difficultyDesc').textContent=getDifficultyData()[d].desc;
    playUiSfx();
  }

  function updateSetting(name,value){
    const settings=getRuntime().settings;
    if(name==='volume'){
      settings.volume=Number(value)/100;
      const masterGain=getAudio().masterGain;
      if(masterGain)masterGain.gain.value=getAudio().audioEnabled?settings.volume:0;
      callAudio('setCustomBgmVolume');
    }else if(name==='shake'){
      settings.shake=Number(value)/100;
    }
  }

  function toggleSetting(name,el){
    const settings=getRuntime().settings;
    settings[name]=!settings[name];
    el.classList.toggle('on',settings[name]);
    playUiSfx();
  }

  function togglePause(force){
    const runtime=getRuntime();
    if(runtime.gameOver)return;
    runtime.paused=force!==undefined?!!force:!runtime.paused;
    document.getElementById('pauseOverlay').style.display=runtime.paused?'flex':'none';
    if(runtime.paused)callAudio('pauseCustomBgm');
    else callAudio('playCustomBgm');
    const input=getInput();
    if(typeof input.clearKeys==='function')input.clearKeys();
    else if(typeof window.clearKeys==='function')window.clearKeys();
    playUiSfx();
  }

  function message(t){
    let el=document.getElementById('message');
    el.textContent=t;
    el.classList.add('show');
    clearTimeout(message.t);
    message.t=setTimeout(()=>el.classList.remove('show'),1600);
  }

  function showStage(){
    const stage=getRuntime().stage;
    let el=document.getElementById('bigStage');
    el.innerHTML=`第 ${stage} 关<small>${stage<5?'守住星门，等待 Boss 降临':'最终关：深渊裂隙'}</small>`;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),1800);
  }

  function buildPreviewHTML(id){
    return`<canvas class="previewCanvas" data-preview="${id}" width="320" height="132"></canvas>`;
  }

  function buildChoiceCard(c,onPick){
    let div=document.createElement('div');
    div.className='card';
    div.innerHTML=`${buildPreviewHTML(c.id)}<h3>${c.title}</h3><p>${c.desc}</p><span class="tag">${c.tag}</span>`;
    div.onclick=onPick;
    return div;
  }

  function updateUI(){
    const runtime=getRuntime();
    const player=runtime.player;
    const enemies=runtime.enemies;
    const stage=runtime.stage;
    const stageTime=runtime.stageTime;
    const stageLen=runtime.STAGE_LEN;
    const weaponDefs=runtime.weaponDefs || window.weaponDefs;
    const skillDefs=runtime.skillDefs || window.skillDefs;
    document.getElementById('hpFill').style.width=clampValue(player.hp/player.maxHp*100,0,100)+'%';
    document.getElementById('xpFill').style.width=clampValue(player.xp/player.nextXp*100,0,100)+'%';
    document.getElementById('dashFill').style.width=clampValue((1-player.dashCd/player.dashMax)*100,0,100)+'%';
    document.getElementById('boostFill').style.width=clampValue(player.boost/player.boostMax*100,0,100)+'%';
    document.getElementById('stats').innerHTML=`<div>等级：${player.level}</div><div>击杀：${runtime.kills}</div><div>关卡：${stage}</div><div>敌人：${enemies.length}</div><div>生命：${Math.ceil(player.hp)}/${player.maxHp}</div><div>Boss：${runtime.bossSpawned?'已出现':'未出现'}</div><div>暴击：${Math.round(player.crit*100)}%</div><div>被动：${Object.keys(player.skills).length}</div>`;
    let wh=Object.keys(player.weapons).map(id=>{let w=weaponDefs.find(x=>x.id===id);return`<div style="color:${w.color}">◆ ${w.name} Lv.${player.weapons[id].level}</div>`}).join('');
    let sh=Object.keys(player.skills).map(id=>{let s=skillDefs.find(x=>x.id===id);return`<div style="color:#cbd3ff">◇ ${s.name} Lv.${player.skills[id]}</div>`}).join('');
    document.getElementById('weapons').innerHTML=wh+sh;
    document.getElementById('stageName').textContent=`第 ${stage} 关`;
    document.getElementById('stageTime').textContent=`${fmt(stageTime)} / ${fmt(stageLen)}`;
    document.getElementById('timelineFill').style.width=clampValue(stageTime/stageLen*100,0,100)+'%';
    let pct=stageTime/stageLen;
    document.getElementById('stageHint').textContent=pct<.31?'小规模敌群正在靠近':pct<.63?'第一轮大规模波次':pct<.88?'第二轮大规模波次':'Boss 即将出现 / 已经出现';
    if(typeof window.updateBossHud==='function')window.updateBossHud();
    else updateBossHud();
  }

  function updateBossHud(){
    const runtime=getRuntime();
    let hud=document.getElementById('bossHud'),boss=runtime.enemies.find(e=>e.def.boss&&!e.dead);
    if(!boss){hud.style.display='none';return}
    hud.style.display='block';
    document.getElementById('bossName').textContent=boss.def.name;
    document.getElementById('bossPhaseText').textContent='Phase '+(boss.phase===3?'III':boss.phase===2?'II':'I');
    document.getElementById('bossHpFill').style.width=clampValue(boss.hp/boss.maxHp*100,0,100)+'%';
    document.querySelectorAll('#bossPhasePips .phasePip').forEach((p,i)=>p.classList.toggle('on',i<boss.phase));
  }

  window.GameUI = {
    message,
    showStage,
    updateUI,
    setDifficulty,
    updateSetting,
    toggleSetting,
    togglePause,
    showStartPagePanel,
    toggleHelp,
    toggleSettingsPanel,
    exitGame,
    startPageTransition,
    runStartPageAction,
    buildPreviewHTML,
    buildChoiceCard,
    updateBossHud
  };

  window.message=message;
  window.showStage=showStage;
  window.updateUI=updateUI;
  window.setDifficulty=setDifficulty;
  window.updateSetting=updateSetting;
  window.toggleSetting=toggleSetting;
  window.togglePause=togglePause;
  window.showStartPagePanel=showStartPagePanel;
  window.toggleHelp=toggleHelp;
  window.toggleSettingsPanel=toggleSettingsPanel;
  window.exitGame=exitGame;
  window.startPageTransition=startPageTransition;
  window.runStartPageAction=runStartPageAction;
  window.buildPreviewHTML=buildPreviewHTML;
  window.buildChoiceCard=buildChoiceCard;
  window.updateBossHud=updateBossHud;
})();
