(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function utils(){return window.GameUtils||{}}
  function player(){return runtime().player}
  function enemies(){return runtime().enemies||[]}
  function projectiles(){return runtime().projectiles||[]}
  function angleTo(a,b){
    const fn=utils().angleTo;
    return typeof fn==='function'?fn(a,b):Math.atan2(b.y-a.y,b.x-a.x);
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
  function playSfx(name){
    if(typeof window.playSfx==='function')return window.playSfx(name);
    if(window.GameAudio&&typeof window.GameAudio.playSfx==='function')return window.GameAudio.playSfx(name);
    return false;
  }
  function hitEnemy(e,dmg,color,dot){
    return call('hitEnemy',()=>window.GameCombat,e,dmg,color,dot);
  }
  function damagePlayer(d){
    return call('damagePlayer',()=>window.GameCombat,d);
  }
  function explode(x,y,r,dmg,color){
    return call('explode',()=>window.GameCombat,x,y,r,dmg,color);
  }
  function distToSegment(px,py,x1,y1,x2,y2){
    const fn=globalFn('distToSegment',()=>window.GameCombat);
    return fn?fn(px,py,x1,y1,x2,y2):Math.hypot(px-x1,py-y1);
  }
  function burst(x,y,color,n){
    return call('burst',()=>window.GameEffectSystem,x,y,color,n);
  }
  function trail(x,y,color,n){
    return call('trail',()=>window.GameEffectSystem,x,y,color,n);
  }

  function moveDirectProjectile(p,dt,p0){
    if(p.type==='homing'&&p.target&&p.target.hp>0){
      let a=angleTo(p,p.target);
      p.vx+=(Math.cos(a)*520*p0.projSpeedMul-p.vx)*dt*5;
      p.vy+=(Math.sin(a)*520*p0.projSpeedMul-p.vy)*dt*5;
    }
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    call('collideProjectile',()=>window.GameProjectileSystem,p);
    return false;
  }

  function updateBoomerang(p,dt,p0){
    if(p.age>.68){
      let a=angleTo(p,p0);
      p.vx+=(Math.cos(a)*520-p.vx)*dt*3;
      p.vy+=(Math.sin(a)*520-p.vy)*dt*3;
    }
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    call('collideProjectile',()=>window.GameProjectileSystem,p);
    return false;
  }

  function updateMissile(p,dt,unused,ps,i){
    if(p.target&&p.target.hp>0){
      let a=angleTo(p,p.target);
      p.vx+=(Math.cos(a)*420-p.vx)*dt*4;
      p.vy+=(Math.sin(a)*420-p.vy)*dt*4;
    }
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    for(const e of enemies()){
      if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){
        explode(p.x,p.y,p.splash,p.dmg,p.color);
        ps.splice(i,1);
        return true;
      }
    }
    return false;
  }

  function updateMine(p,dt,unused,ps,i){
    for(const e of enemies()){
      if(Math.hypot(e.x-p.x,e.y-p.y)<p.trigger+e.r){
        explode(p.x,p.y,p.splash,p.dmg,p.color);
        ps.splice(i,1);
        return true;
      }
    }
    return false;
  }

  function updateAoeProjectile(p,dt){
    call('aoeHit',()=>window.GameProjectileSystem,p,dt);
    return false;
  }

  function updateBeam(p,dt){
    p.tick-=dt;
    if(p.tick<=0){
      p.tick=.06;
      let x2=p.x+Math.cos(p.a)*p.len,y2=p.y+Math.sin(p.a)*p.len;
      for(const e of enemies())if(distToSegment(e.x,e.y,p.x,p.y,x2,y2)<e.r+p.width)hitEnemy(e,p.dmg,p.color,true);
    }
    return false;
  }

  function updateMeteor(p,dt,unused,ps,i){
    if(p.life<=0){
      explode(p.x,p.y,p.impact,p.dmg,p.color);
      ps.splice(i,1);
      return true;
    }
    return false;
  }

  function updateZone(p,dt){
    p.tick-=dt;
    if(p.tick<=0){
      p.tick=.3;
      for(const e of enemies())if(Math.hypot(e.x-p.x,e.y-p.y)<p.r+e.r)hitEnemy(e,p.dmg,p.color,true);
    }
    return false;
  }

  function updateBlackhole(p,dt){
    p.tick-=dt;
    for(const e of enemies()){
      let d=Math.hypot(e.x-p.x,e.y-p.y);
      if(d<p.r*2.4){
        let a=angleTo(e,p);
        e.x+=Math.cos(a)*p.pull*dt*(1-d/(p.r*2.4));
        e.y+=Math.sin(a)*p.pull*dt*(1-d/(p.r*2.4));
      }
      if(d<p.r+e.r&&p.tick<=0)hitEnemy(e,p.dmg,p.color,true);
    }
    if(p.tick<=0)p.tick=.25;
    return false;
  }

  function updateEnemyFireball(p,dt,p0,ps,i){
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    trail(p.x,p.y,p.color,2);
    if(Math.hypot(p.x-p0.x,p.y-p0.y)<p.r+p0.r){
      damagePlayer(p.dmg);
      explode(p.x,p.y,56,p.dmg*.35,p.color);
      ps.splice(i,1);
      return true;
    }
    return false;
  }

  function updateEnemyIce(p,dt,p0,ps,i){
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    if(Math.hypot(p.x-p0.x,p.y-p0.y)<p.r+p0.r){
      damagePlayer(p.dmg);
      p0.slowMove=.8;
      burst(p.x,p.y,p.color,10);
      ps.splice(i,1);
      return true;
    }
    return false;
  }

  function updateEnemyOrb(p,dt,p0,ps,i){
    let aa=angleTo(p,p0);
    p.vx+=(Math.cos(aa)*260-p.vx)*dt*2.2;
    p.vy+=(Math.sin(aa)*260-p.vy)*dt*2.2;
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    if(Math.hypot(p.x-p0.x,p.y-p0.y)<p.r+p0.r){
      damagePlayer(p.dmg);
      burst(p.x,p.y,p.color,14);
      ps.splice(i,1);
      return true;
    }
    return false;
  }

  function updateEnemyShockwave(p,dt,p0){
    p.r+=(p.maxR-p.r)*dt*5.5;
    let d=Math.hypot(p0.x-p.x,p0.y-p.y);
    if(!p.hit&&p.life<p.max*.78&&d<p.r+p0.r&&d>p.r-26-p0.r){damagePlayer(p.dmg);p.hit=true}
    return false;
  }

  function updateEnemyBeamWarn(p,dt,unused,ps){
    if(!p.fired&&p.life<p.max*.28){
      p.fired=true;
      ps.push({type:'enemyBeam',x:p.x,y:p.y,a:p.a,len:p.len,width:p.width,dmg:p.dmg,life:.18,max:.18,color:p.color,hit:false});
      playSfx('rail');
    }
    return false;
  }

  function updateEnemyBeam(p,dt,p0){
    if(!p.hit){
      let x2=p.x+Math.cos(p.a)*p.len,y2=p.y+Math.sin(p.a)*p.len;
      if(distToSegment(p0.x,p0.y,p.x,p.y,x2,y2)<p.width+p0.r){damagePlayer(p.dmg);p.hit=true}
    }
    return false;
  }

  function updateEnemyBossNova(p,dt,p0){
    p.r+=(p.maxR-p.r)*dt*4.8;
    let d=Math.hypot(p0.x-p.x,p0.y-p.y);
    if(!p.hit&&p.life<p.max*.7&&d<p.r+p0.r&&d>p.r-30-p0.r){damagePlayer(p.dmg);p.hit=true}
    return false;
  }

  const ProjectileHandlers = {
    bolt: moveDirectProjectile,
    homing: moveDirectProjectile,
    swordWave: moveDirectProjectile,
    boomerang: updateBoomerang,
    missile: updateMissile,
    mine: updateMine,
    slash: updateAoeProjectile,
    flame: updateAoeProjectile,
    ring: updateAoeProjectile,
    beam: updateBeam,
    meteor: updateMeteor,
    zone: updateZone,
    blackhole: updateBlackhole,
    enemyFireball: updateEnemyFireball,
    enemyIce: updateEnemyIce,
    enemyOrb: updateEnemyOrb,
    enemyShockwave: updateEnemyShockwave,
    enemyBeamWarn: updateEnemyBeamWarn,
    enemyBeam: updateEnemyBeam,
    enemyBossNova: updateEnemyBossNova
  };

  function updateProjectiles(dt){
    const ps=projectiles(),p0=player();
    if(!p0)return;
    for(let i=ps.length-1;i>=0;i--){
      let p=ps[i];
      p.life-=dt;
      p.age=(p.age||0)+dt;
      const handler=ProjectileHandlers[p.type];
      if(handler&&handler(p,dt,p0,ps,i))continue;
      if(p.life<=0)ps.splice(i,1);
    }
  }

  function collideProjectile(p){
    for(const e of enemies()){
      if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){
        hitEnemy(e,p.dmg,p.color);
        p.pierce--;
        if(p.pierce<=0){p.life=0;break}
      }
    }
  }

  function aoeHit(p,dt){
    const p0=player();
    if(!p0)return;
    for(const e of enemies()){
      let ok=false;
      if(p.type==='ring'){
        p.r+=(p.maxR-p.r)*dt*8;
        let d=Math.hypot(e.x-p.x,e.y-p.y);
        ok=d<p.r+e.r&&d>p.r-32-e.r;
        if(ok)e.slow=Math.max(e.slow,p.slow);
      }else{
        let d=Math.hypot(e.x-p0.x,e.y-p0.y),aa=Math.atan2(e.y-p0.y,e.x-p0.x),diff=Math.abs(Math.atan2(Math.sin(aa-p.a),Math.cos(aa-p.a)));
        ok=d<p.r+e.r&&diff<(p.type==='flame'?p.arc:.72);
      }
      if(ok)hitEnemy(e,p.dmg*(p.type==='flame'?dt*9:1),p.color,true);
    }
  }

  window.GameProjectileSystem = {
    updateProjectiles,
    collideProjectile,
    aoeHit,
    ProjectileHandlers
  };
})();
