(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function utils(){return window.GameUtils||{}}
  function player(){return runtime().player}
  function enemies(){return runtime().enemies||[]}
  function projectiles(){return runtime().projectiles||[]}
  function weaponDefs(){return runtime().weaponDefs||window.weaponDefs||[]}
  function rand(min,max){
    const fn=utils().rand;
    return typeof fn==='function'?fn(min,max):min+Math.random()*(max-min);
  }
  function angleTo(a,b){
    const fn=utils().angleTo;
    return typeof fn==='function'?fn(a,b):Math.atan2(b.y-a.y,b.x-a.x);
  }
  function clamp(value,min,max){
    const fn=utils().clamp;
    return typeof fn==='function'?fn(value,min,max):Math.max(min,Math.min(max,value));
  }
  function globalFn(name,root){
    if(typeof window[name]==='function')return window[name];
    const source=typeof root==='function'?root():root;
    return source&&typeof source[name]==='function'?source[name]:null;
  }
  function call(name,root){
    const fn=globalFn(name,root);
    if(fn)return fn.apply(window,Array.prototype.slice.call(arguments,2));
    return undefined;
  }
  function rollDamage(base){
    const fn=globalFn('rollDamage',()=>window.GameCombat);
    return fn?fn(base):base;
  }
  function hitEnemy(e,dmg,color,dot){
    return call('hitEnemy',()=>window.GameCombat,e,dmg,color,dot);
  }
  function distToSegment(px,py,x1,y1,x2,y2){
    const fn=globalFn('distToSegment',()=>window.GameCombat);
    return fn?fn(px,py,x1,y1,x2,y2):Math.hypot(px-x1,py-y1);
  }
  function setRuntimeValue(name,value){
    const rt=runtime();
    try{rt[name]=value}catch(e){}
  }

  function playWeaponSfx(type){
    if(typeof window.playWeaponSfx==='function')return window.playWeaponSfx(type);
    if(window.GameAudio&&typeof window.GameAudio.playWeaponSfx==='function')return window.GameAudio.playWeaponSfx(type);
    if(typeof window.playSfx==='function')return window.playSfx('ui');
    return false;
  }

  function nearestEnemy(max=99999){
    const p=player();
    let b=null,bd=max;
    if(!p)return b;
    for(const e of enemies()){
      let d=Math.hypot(e.x-p.x,e.y-p.y);
      if(d<bd){bd=d;b=e}
    }
    return b;
  }

  function updateWeapons(dt){
    const p=player();
    if(!p)return;
    p.orbit+=dt;
    if(p.regen>0)p.hp=clamp(p.hp+p.regen*dt,0,p.maxHp);
    for(const id in p.weapons){
      let w=weaponDefs().find(x=>x.id===id),lvl=p.weapons[id].level;
      if(!w)continue;
      p.timers[id]-=dt;
      if(w.type==='orbital'){
        call('orbitalDamage',()=>window.GameWeaponSystem,dt,w,lvl);
        continue;
      }
      if(p.timers[id]<=0){
        call('fireWeapon',()=>window.GameWeaponSystem,w,lvl);
        p.timers[id]=Math.max(.05,w.cd*p.cdMul*(1-.05*(lvl-1)));
      }
    }
  }

  function orbitalDamage(dt,w,lvl){
    const p=player();
    if(!p)return;
    let n=2+Math.floor(lvl/2),rad=78+lvl*8;
    for(let i=0;i<n;i++){
      let ox=p.x+Math.cos(p.orbit*2.6+i*Math.PI*2/n)*rad,oy=p.y+Math.sin(p.orbit*2.6+i*Math.PI*2/n)*rad;
      for(const e of enemies())if(Math.hypot(e.x-ox,e.y-oy)<e.r+13)hitEnemy(e,(14+lvl*5)*dt*5*p.damageMul,w.color,true);
    }
  }

  function fireMelee(w,lvl){
    const p=player(),a=p.angle;
    let waveCount=1+(lvl>=4?1:0);
    for(let i=0;i<waveCount;i++){
      let aa=a+(i-(waveCount-1)/2)*.12;
      projectiles().push({type:'swordWave',x:p.x+Math.cos(aa)*30,y:p.y+Math.sin(aa)*30,vx:Math.cos(aa)*760*p.projSpeedMul,vy:Math.sin(aa)*760*p.projSpeedMul,a:aa,r:(16+lvl*2)*p.areaMul,visualLen:112+lvl*12,visualWidth:(13+lvl*1.5)*p.areaMul,dmg:rollDamage((28+lvl*10)*p.damageMul),life:.54,max:.54,color:w.color,pierce:2+Math.floor(lvl/2),age:0});
    }
  }

  function fireBolt(w,lvl){
    const p=player(),a=p.angle,bonus=p.extraProj||0;
    let c=1+Math.floor(lvl/3)+bonus;
    for(let i=0;i<c;i++){
      let aa=a+(i-(c-1)/2)*.12;
      projectiles().push({type:'bolt',x:p.x,y:p.y,vx:Math.cos(aa)*780*p.projSpeedMul,vy:Math.sin(aa)*780*p.projSpeedMul,r:8,dmg:rollDamage((34+lvl*12)*p.damageMul),life:.95,color:w.color,pierce:1+Math.floor(lvl/2)});
    }
  }

  function fireBoomerang(w,lvl){
    const p=player(),a=p.angle;
    let c=1+Math.floor(lvl/3);
    for(let i=0;i<c;i++){
      let aa=a+(i-(c-1)/2)*.24;
      projectiles().push({type:'boomerang',x:p.x,y:p.y,vx:Math.cos(aa)*420*p.projSpeedMul,vy:Math.sin(aa)*420*p.projSpeedMul,r:16,dmg:rollDamage((20+lvl*8)*p.damageMul),life:1.45,age:0,color:w.color,pierce:12});
    }
  }

  function fireRing(w,lvl){
    const p=player();
    projectiles().push({type:'ring',x:p.x,y:p.y,r:20,maxR:(180+lvl*24)*p.areaMul,dmg:rollDamage((14+lvl*5)*p.damageMul),life:.68,max:.68,color:w.color,slow:.55});
  }

  function fireHoming(w,lvl){
    const p=player(),bonus=p.extraProj||0;
    let c=1+Math.floor(lvl/2)+bonus;
    for(let i=0;i<c;i++){
      let e=nearestEnemy(),aa=e?angleTo(p,e):rand(0,Math.PI*2);
      projectiles().push({type:'homing',x:p.x,y:p.y,vx:Math.cos(aa)*350*p.projSpeedMul,vy:Math.sin(aa)*350*p.projSpeedMul,r:7,dmg:rollDamage((18+lvl*7)*p.damageMul),life:1.5,color:w.color,pierce:1,target:e});
    }
  }

  function fireMeteor(w,lvl){
    const p=player(),a=p.angle;
    let t=nearestEnemy(900)||{x:p.x+Math.cos(a)*260,y:p.y+Math.sin(a)*260};
    projectiles().push({type:'meteor',x:t.x+rand(-90,90),y:t.y+rand(-90,90),r:12,dmg:rollDamage((48+lvl*16)*p.damageMul),life:.75,max:.75,color:w.color,impact:(80+lvl*8)*p.areaMul});
  }

  function fireZone(w,lvl){
    const p=player(),a=p.angle;
    let t=nearestEnemy(750)||{x:p.x+Math.cos(a)*180,y:p.y+Math.sin(a)*180};
    projectiles().push({type:'zone',x:t.x,y:t.y,r:(66+lvl*8)*p.areaMul,dmg:(7+lvl*2)*p.damageMul,life:4.2,color:w.color,tick:0});
  }

  function fireFlame(w,lvl){
    const p=player(),a=p.angle;
    projectiles().push({type:'flame',x:p.x,y:p.y,a,r:(120+lvl*10)*p.areaMul,arc:.76+lvl*.03,dmg:(9+lvl*3)*p.damageMul,life:.18,color:w.color});
  }

  function fireBlackhole(w,lvl){
    const p=player(),a=p.angle;
    let t=nearestEnemy(850)||{x:p.x+Math.cos(a)*250,y:p.y+Math.sin(a)*250};
    projectiles().push({type:'blackhole',x:t.x,y:t.y,r:(78+lvl*10)*p.areaMul,dmg:(9+lvl*3)*p.damageMul,life:3.3,color:w.color,tick:0,pull:170+lvl*22});
    setRuntimeValue('shake',5);
  }

  function fireMissile(w,lvl){
    const p=player(),a=p.angle,bonus=p.extraProj||0;
    let c=1+Math.floor(lvl/3)+bonus;
    for(let i=0;i<c;i++){
      let e=nearestEnemy(1000),aa=e?angleTo(p,e):a;
      projectiles().push({type:'missile',x:p.x,y:p.y,vx:Math.cos(aa)*260,vy:Math.sin(aa)*260,r:9,dmg:rollDamage((36+lvl*12)*p.damageMul),life:2.2,color:w.color,target:e,splash:(72+lvl*8)*p.areaMul});
    }
  }

  function fireRail(w,lvl){
    const p=player(),a=p.angle;
    let len=920,x2=p.x+Math.cos(a)*len,y2=p.y+Math.sin(a)*len,dmg=rollDamage((48+lvl*14)*p.damageMul);
    for(const e of enemies())if(distToSegment(e.x,e.y,p.x,p.y,x2,y2)<e.r+10)hitEnemy(e,dmg,w.color);
    projectiles().push({type:'rail',x1:p.x,y1:p.y,x2,y2,life:.18,max:.18,color:w.color});
  }

  function fireChain(w,lvl){
    const p=player();
    let first=nearestEnemy(520);
    if(!first)return;
    let points=[{x:p.x,y:p.y},{x:first.x,y:first.y}],hitList=[first];
    hitEnemy(first,rollDamage((24+lvl*8)*p.damageMul),w.color);
    let cur=first,j=2+Math.floor(lvl/2);
    for(let i=0;i<j;i++){
      let next=null,b=99999;
      for(const e of enemies()){
        if(hitList.includes(e))continue;
        let d=Math.hypot(e.x-cur.x,e.y-cur.y);
        if(d<170&&d<b){b=d;next=e}
      }
      if(!next)break;
      hitList.push(next);
      points.push({x:next.x,y:next.y});
      hitEnemy(next,rollDamage((18+lvl*6)*p.damageMul),w.color);
      cur=next;
    }
    projectiles().push({type:'chain',points,life:.18,max:.18,color:w.color});
  }

  function fireMine(w,lvl){
    const p=player(),a=p.angle;
    let t=nearestEnemy(700)||{x:p.x+Math.cos(a)*160,y:p.y+Math.sin(a)*160};
    projectiles().push({type:'mine',x:t.x+rand(-40,40),y:t.y+rand(-40,40),r:14,trigger:56,splash:(78+lvl*8)*p.areaMul,dmg:rollDamage((38+lvl*12)*p.damageMul),life:5.5,color:w.color});
  }

  function fireBeam(w,lvl){
    const p=player(),a=p.angle;
    projectiles().push({type:'beam',x:p.x,y:p.y,a,len:340+lvl*24,width:(18+lvl*2)*p.areaMul,dmg:(18+lvl*5)*p.damageMul,life:.24,max:.24,color:w.color,tick:0});
  }

  const WeaponHandlers = {
    melee: fireMelee,
    bolt: fireBolt,
    boomerang: fireBoomerang,
    ring: fireRing,
    homing: fireHoming,
    meteor: fireMeteor,
    zone: fireZone,
    flame: fireFlame,
    blackhole: fireBlackhole,
    missile: fireMissile,
    rail: fireRail,
    chain: fireChain,
    mine: fireMine,
    beam: fireBeam
  };

  function fireWeapon(w,lvl){
    if(!w||!player())return;
    playWeaponSfx(w.type);
    const handler=WeaponHandlers[w.type];
    if(handler)handler(w,lvl);
  }

  window.GameWeaponSystem = {
    updateWeapons,
    fireWeapon,
    orbitalDamage,
    nearestEnemy,
    playWeaponSfx,
    WeaponHandlers
  };
})();
