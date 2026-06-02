(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function utils(){return window.GameUtils||{}}
  function player(){return runtime().player}
  function enemies(){return runtime().enemies||[]}
  function projectiles(){return runtime().projectiles||[]}
  function camera(){return runtime().camera||{x:0,y:0}}
  function enemyDefs(){return runtime().enemyDefs||window.enemyDefs||[]}
  function stage(){return runtime().stage||1}
  function stageTime(){return runtime().stageTime||0}
  function difficulty(){return runtime().difficulty||'normal'}
  function diffData(){return (runtime().DIFFICULTY||window.DIFFICULTY||{})[difficulty()]||{}}
  function world(){return runtime().WORLD||3200}
  function viewportW(){return runtime().W||innerWidth}
  function viewportH(){return runtime().H||innerHeight}
  function rand(min,max){
    const fn=utils().rand;
    return typeof fn==='function'?fn(min,max):min+Math.random()*(max-min);
  }
  function clamp(value,min,max){
    const fn=utils().clamp;
    return typeof fn==='function'?fn(value,min,max):Math.max(min,Math.min(max,value));
  }
  function angleTo(a,b){
    const fn=utils().angleTo;
    return typeof fn==='function'?fn(a,b):Math.atan2(b.y-a.y,b.x-a.x);
  }
  function call(name,root){
    const fn=typeof window[name]==='function'?window[name]:(root&&root[name]);
    if(fn)return fn.apply(window,Array.prototype.slice.call(arguments,2));
    return undefined;
  }
  function playSfx(name){
    if(typeof window.playSfx==='function')return window.playSfx(name);
    if(window.GameAudio&&typeof window.GameAudio.playSfx==='function')return window.GameAudio.playSfx(name);
    return false;
  }
  const ENEMY_LIMITS = { enemies:130 };

  function spawnWave(n){
    for(let i=0;i<n;i++)setTimeout(()=>{if(runtime().started&&!runtime().gameOver)call('spawnEnemy',window.GameEnemySystem,true)},i*80);
  }

  function spawnEnemy(strong){
    let maxIndex=Math.min(8,Math.floor((stage()-1)*2+stageTime()/28)+2);
    let defs=enemyDefs();
    let def=defs[Math.floor(rand(0,maxIndex+1))];
    if(strong&&Math.random()<.28)def=defs[clamp(maxIndex,2,8)];
    call('spawnDef',window.GameEnemySystem,def,1+stage()*.16);
  }

  function spawnDef(def,scale,boss=false){
    if(!boss&&enemies().length>=ENEMY_LIMITS.enemies)return;
    let side=Math.floor(rand(0,4)),m=470,x,y,cam=camera(),W=viewportW(),H=viewportH();
    if(side===0){x=cam.x+rand(-W*.4,W*1.4);y=cam.y-m}
    else if(side===1){x=cam.x+W+m;y=cam.y+rand(-H*.4,H*1.4)}
    else if(side===2){x=cam.x+rand(-W*.4,W*1.4);y=cam.y+H+m}
    else{x=cam.x-m;y=cam.y+rand(-H*.4,H*1.4)}
    let elite=!boss&&stage()>1&&Math.random()<Math.min(.05+stage()*.015,.18),mod=null;
    if(elite)mod=['swift','shield','split','volatile'][Math.floor(rand(0,4))];
    let hpMul=elite?(mod==='shield'?1.9:1.35):1,spMul=elite&&mod==='swift'?1.45:1;
    let diff=diffData();
    let stageHp=1+(stage()-1)*.13,stageDmg=1+(stage()-1)*.075,stageSpeed=1+(stage()-1)*.018;
    let bossSize=runtime().BOSS_SIZE_MULTIPLIER||1;
    let finalHp=def.hp*scale*(boss?1.4:1)*hpMul*(diff.hp||1)*stageHp;
    enemies().push({x:clamp(x,80,world()-80),y:clamp(y,80,world()-80),def,hp:finalHp,maxHp:finalHp,speed:def.speed*(1+stage()*.035)*spMul*(diff.speed||1)*stageSpeed,r:def.r*(boss?1.15*bossSize:1)*(elite?1.08:1),dmg:def.dmg*(elite?1.15:1)*(diff.dmg||1)*stageDmg,slow:0,hit:0,touchCd:0,skillCd:def.cd?rand(def.cd[0],def.cd[1]):999,elite,mod,shield:elite&&mod==='shield'?45+stage()*10:0,phase:1,phaseLock:{p2:false,p3:false}});
  }

  function attackFireball(e,a){
    projectiles().push({type:'enemyFireball',x:e.x,y:e.y,vx:Math.cos(a)*280,vy:Math.sin(a)*280,r:13,dmg:16+stage()*1.3,life:4.2,color:'#ff7a42'});
  }

  function attackIcefan(e,a){
    for(const s of[-.25,0,.25]){
      let aa=a+s;
      projectiles().push({type:'enemyIce',x:e.x,y:e.y,vx:Math.cos(aa)*330,vy:Math.sin(aa)*330,r:10,dmg:13+stage(),life:3.4,color:'#b7f7ff'});
    }
  }

  function attackOrb(e,a){
    projectiles().push({type:'enemyOrb',x:e.x,y:e.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,r:12,dmg:15+stage()*1.1,life:5.2,color:'#ff8cff'});
  }

  function attackShockwave(e){
    projectiles().push({type:'enemyShockwave',x:e.x,y:e.y,r:24,maxR:145,dmg:18+stage()*1.4,life:.85,max:.85,color:'#8cff6a',hit:false});
  }

  function attackBoss(e,a){
    call('runBossAttack',window.GameBossSystem,e,a);
  }

  const EnemyAttackHandlers = {
    fireball: attackFireball,
    icefan: attackIcefan,
    orb: attackOrb,
    shockwave: attackShockwave,
    boss: attackBoss
  };

  function spawnEnemySkill(e){
    const p=player();
    if(!p)return;
    const a=angleTo(e,p);
    call('burst',window.GameEffectSystem,e.x,e.y,e.def.color,8);
    playSfx(e.def.boss?'boss':'laser');
    const handler=EnemyAttackHandlers[e.def.attack];
    if(handler)handler(e,a);
  }

  function updateEnemies(dt){
    const p=player();
    if(!p)return;
    const list=enemies();
    for(let i=list.length-1;i>=0;i--){
      let e=list[i];
      if(e.dead){list.splice(i,1);continue}
      if(e.def.boss)call('updateBossPhase',window.GameBossSystem,e);
      e.hit=Math.max(0,e.hit-dt);
      e.slow=Math.max(0,e.slow-dt);
      e.touchCd=Math.max(0,(e.touchCd||0)-dt);
      let dToPlayer=Math.hypot(e.x-p.x,e.y-p.y),a=angleTo(e,p),moveScale=1;
      if(e.def.attack){
        e.skillCd-=dt;
        if(dToPlayer<(e.def.range||240)){
          if(e.skillCd<=0){
            call('spawnEnemySkill',window.GameEnemySystem,e);
            let phaseMul=e.def.boss?(e.phase>=3?.52:e.phase>=2?.72:1):1;
            e.skillCd=rand(e.def.cd[0],e.def.cd[1])*phaseMul;
          }
          if(['fireball','icefan','orb','boss'].includes(e.def.attack))moveScale=dToPlayer<(e.def.range*.75)?.35:.7;
        }
      }
      let sp=e.speed*(e.slow>0?.45:1)*moveScale;
      e.x+=Math.cos(a)*sp*dt;
      e.y+=Math.sin(a)*sp*dt;
      for(const o of list)if(o!==e){
        let dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy),min=e.r+o.r;
        if(d>0&&d<min){e.x+=dx/d*(min-d)*.012;e.y+=dy/d*(min-d)*.012}
      }
      if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r&&e.touchCd<=0){
        call('damagePlayer',window.GameCombat,e.dmg);
        e.touchCd=.75;
        let push=angleTo(e,p);
        p.x+=Math.cos(push)*22;
        p.y+=Math.sin(push)*22;
      }
    }
  }

  window.GameEnemySystem = {
    spawnEnemy,
    spawnDef,
    spawnWave,
    spawnEnemySkill,
    updateEnemies,
    EnemyAttackHandlers
  };
})();
