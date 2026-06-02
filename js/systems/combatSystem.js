(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function utils(){return window.GameUtils||{}}
  function player(){return runtime().player}
  function enemies(){return runtime().enemies||[]}
  function texts(){return runtime().texts||[]}
  function settings(){return runtime().settings||{}}
  function clamp(value,min,max){
    const fn=utils().clamp;
    return typeof fn==='function'?fn(value,min,max):Math.max(min,Math.min(max,value));
  }
  function call(name){
    const fn=window[name];
    if(typeof fn==='function')return fn.apply(window,Array.prototype.slice.call(arguments,1));
    return undefined;
  }
  function playSfx(name){
    if(window.GameAudio&&typeof window.GameAudio.playSfx==='function')return window.GameAudio.playSfx(name);
    return call('playSfx',name);
  }
  function setRuntimeValue(name,value){
    const rt=runtime();
    try{rt[name]=value}catch(e){}
  }

  function damagePlayer(d){
    const p=player();
    if(!p||p.invuln>0)return;
    p.hp=clamp(p.hp-d,0,p.maxHp);
    p.invuln=.45;
    setRuntimeValue('shake',14);
    setRuntimeValue('screenFlash',.72);
    playSfx('playerHit');
    call('burst',p.x,p.y,'#ff5b73',20);
    if(settings().damageNumbers)texts().push({x:p.x-10,y:p.y-28,text:'-'+Math.ceil(d),life:.7,color:'#ff5b73'});
    if(p.hp<=0)call('endGame');
  }

  function gainXp(v){
    const p=player();
    if(!p)return;
    p.xp+=v;
    while(p.xp>=p.nextXp){
      p.xp-=p.nextXp;
      p.level++;
      p.nextXp=Math.floor(p.nextXp*1.23+15);
      playSfx('level');
      call('levelUp');
    }
  }

  function rollDamage(base){
    const p=player();
    return p&&Math.random()<p.crit?base*1.75:base;
  }

  function distToSegment(px,py,x1,y1,x2,y2){
    let A=px-x1,B=py-y1,C=x2-x1,D=y2-y1,dot=A*C+B*D,len=C*C+D*D,t=len?dot/len:-1;
    t=clamp(t,0,1);
    let xx=x1+C*t,yy=y1+D*t;
    return Math.hypot(px-xx,py-yy);
  }

  function explode(x,y,r,dmg,color){
    setRuntimeValue('shake',7);
    playSfx('explode');
    call('burst',x,y,color,30);
    for(const e of enemies()){
      let d=Math.hypot(e.x-x,e.y-y);
      if(d<r+e.r)call('hitEnemy',e,dmg*(1-d/(r+e.r)*.35),color);
    }
  }

  function hitEnemy(e,dmg,color,dot=false){
    if(e.dead)return;
    if(!dot)playSfx('enemyHit');
    if(e.shield>0){
      let block=Math.min(e.shield,dmg*.65);
      e.shield-=block;
      dmg-=block;
      texts().push({x:e.x-8,y:e.y-28,text:'\u76fe',life:.45,color:'#9eeeff'});
    }
    e.hp-=dmg;
    e.hit=.1;
    if(settings().damageNumbers&&!dot&&Math.random()<.24)texts().push({x:e.x,y:e.y-20,text:Math.floor(dmg),life:.6,color});
    if(e.hp<=0)call('killEnemy',e,color);
  }

  window.GameCombat = {
    damagePlayer,
    hitEnemy,
    rollDamage,
    gainXp,
    explode,
    distToSegment
  };
})();
