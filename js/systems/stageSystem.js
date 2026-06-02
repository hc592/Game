(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function player(){return runtime().player}
  function enemies(){return runtime().enemies||[]}
  function difficulty(){return runtime().difficulty||'normal'}
  function diffData(){return (runtime().DIFFICULTY||window.DIFFICULTY||{})[difficulty()]||{}}
  function stage(){return runtime().stage||1}
  function stageTime(){return runtime().stageTime||0}
  function stageLen(){return runtime().STAGE_LEN||95}
  function waveFlags(){return runtime().waveFlags||{w1:false,w2:false}}
  function clamp(value,min,max){
    const fn=window.GameUtils&&window.GameUtils.clamp;
    return typeof fn==='function'?fn(value,min,max):Math.max(min,Math.min(max,value));
  }
  function call(name,root){
    const fn=typeof window[name]==='function'?window[name]:(root&&root[name]);
    if(fn)return fn.apply(window,Array.prototype.slice.call(arguments,2));
    return undefined;
  }
  function message(text){
    if(typeof window.message==='function')return window.message(text);
    if(window.GameUI&&typeof window.GameUI.message==='function')return window.GameUI.message(text);
    return undefined;
  }

  function updateStage(dt){
    const diff=diffData();
    const spawnScale=diff.spawn||1;
    let cap=Math.floor((25+stage()*5)*spawnScale);
    if(enemies().length<cap){
      runtime().spawnTick-=dt;
      if(runtime().spawnTick<=0){
        runtime().spawnTick=Math.max(.38,(1.55-stage()*.12-stageTime()/130)/spawnScale);
        call('spawnEnemy',window.GameEnemySystem,false);
      }
    }
    const flags=waveFlags();
    if(!flags.w1&&stageTime()>stageLen()*.31){
      flags.w1=true;
      call('spawnWave',window.GameEnemySystem,Math.floor((8+stage()*2)*spawnScale));
      message('大规模波次来袭！');
    }
    if(!flags.w2&&stageTime()>stageLen()*.63){
      flags.w2=true;
      call('spawnWave',window.GameEnemySystem,Math.floor((10+stage()*3)*spawnScale));
      message('第二波敌潮来袭！');
    }
    if(!runtime().bossSpawned&&stageTime()>stageLen()*.88){
      runtime().bossSpawned=true;
      const bossName=call('spawnBoss',window.GameBossSystem);
      message('Boss 出现：'+bossName);
    }
    if(stageTime()>stageLen()&&runtime().bossSpawned&&!enemies().some(e=>e.def.boss))call('nextStage',window.GameStageSystem);
  }

  function nextStage(){
    const p=player();
    runtime().stage=stage()+1;
    runtime().stageTime=0;
    runtime().waveFlags={w1:false,w2:false};
    runtime().bossSpawned=false;
    if(p)p.hp=clamp(p.hp+35,0,p.maxHp);
    call('showStage',window.GameUI);
    call('levelUp');
  }

  window.GameStageSystem = {
    updateStage,
    nextStage
  };
})();
