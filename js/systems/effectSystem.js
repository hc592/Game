(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function utils(){return window.GameUtils||{}}
  function rand(min,max){
    const fn=utils().rand;
    return typeof fn==='function'?fn(min,max):min+Math.random()*(max-min);
  }
  function particles(){return runtime().particles||[]}
  function texts(){return runtime().texts||[]}
  function settings(){return runtime().settings||{}}
  const EFFECT_LIMITS = { particles:720 };

  function trimArray(arr,max){
    if(Array.isArray(arr)&&arr.length>max)arr.splice(0,arr.length-max);
  }

  function updateParticles(dt){
    const ps=particles();
    for(let i=ps.length-1;i>=0;i--){
      let p=ps[i];
      p.life-=dt;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.vx*=.96;
      p.vy*=.96;
      if(p.life<=0)ps.splice(i,1);
    }
    const ts=texts();
    for(let i=ts.length-1;i>=0;i--){
      let f=ts[i];
      f.life-=dt;
      f.y-=28*dt;
      if(f.life<=0)ts.splice(i,1);
    }
  }

  function burst(x,y,color,n){
    if(!settings().particles)return;
    n=Math.min(n,32);
    const ps=particles();
    if(ps.length>EFFECT_LIMITS.particles)return;
    for(let i=0;i<n;i++){
      let a=rand(0,Math.PI*2),s=rand(40,240);
      ps.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.75),max:.75,r:rand(1.5,4.5),color});
    }
    trimArray(ps,EFFECT_LIMITS.particles);
  }

  function trail(x,y,color,n){
    if(!settings().particles)return;
    n=Math.min(n,5);
    const ps=particles();
    if(ps.length>EFFECT_LIMITS.particles)return;
    for(let i=0;i<n;i++)ps.push({x:x+rand(-16,16),y:y+rand(-16,16),vx:rand(-30,30),vy:rand(-30,30),life:.32,max:.32,r:rand(3,8),color});
    trimArray(ps,EFFECT_LIMITS.particles);
  }

  function addDamageText(entry){
    texts().push(entry);
  }

  window.GameEffectSystem = {
    burst,
    trail,
    updateParticles,
    addDamageText
  };
})();
