(function(){
  'use strict';

  function runtime(){return window.GameRuntime||{}}
  function projectiles(){return runtime().projectiles||[]}
  function bossDefs(){return runtime().bossDefs||window.bossDefs||[]}
  function stage(){return runtime().stage||1}
  function stageTime(){return runtime().stageTime||0}
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
  function message(text){
    if(typeof window.message==='function')return window.message(text);
    if(window.GameUI&&typeof window.GameUI.message==='function')return window.GameUI.message(text);
    return undefined;
  }

  function spawnBoss(){
    playSfx('boss');
    const defs=bossDefs();
    const def=defs[(stage()-1)%defs.length];
    const growth=runtime().BOSS_STAGE_HP_GROWTH||0;
    const bossHpScale=1+Math.max(0,stage()-1)*growth;
    call('spawnDef',window.GameEnemySystem,def,bossHpScale,true);
    return def.name;
  }

  function updateBossPhase(e){
    let ratio=e.hp/e.maxHp;
    if(ratio<.7&&!e.phaseLock.p2){
      e.phase=2;
      e.phaseLock.p2=true;
      e.speed*=1.08;
      e.dmg*=1.08;
      message(e.def.name+' 进入第二阶段');
      playSfx('boss');
      call('bossNova',window.GameBossSystem,e,180,18,'#ff4f6f');
    }
    if(ratio<.4&&!e.phaseLock.p3){
      e.phase=3;
      e.phaseLock.p3=true;
      e.speed*=1.14;
      e.dmg*=1.12;
      message(e.def.name+' 进入狂暴阶段');
      playSfx('boss');
      call('spawnWave',window.GameEnemySystem,6+stage());
      call('bossNova',window.GameBossSystem,e,250,28,'#ff2f4f');
    }
  }

  function bossBeam(e,a,len,width){
    projectiles().push({type:'enemyBeamWarn',x:e.x,y:e.y,a,len,width,dmg:25+stage()*1.8+(e.phase||1)*5,life:.72,max:.72,color:'#ff4f6f',fired:false});
  }

  function bossNova(e,maxR,dmg,col){
    projectiles().push({type:'enemyBossNova',x:e.x,y:e.y,r:28,maxR,dmg:dmg+stage()*1.8+(e.phase||1)*4,life:1.0,max:1.0,color:col,hit:false});
  }

  function bossOrbRing(e,count){
    for(let i=0;i<count;i++){
      let aa=i*Math.PI*2/count+stageTime()*.4;
      projectiles().push({type:'enemyOrb',x:e.x+Math.cos(aa)*20,y:e.y+Math.sin(aa)*20,vx:Math.cos(aa)*210,vy:Math.sin(aa)*210,r:10,dmg:14+stage()*1.2,life:4.4,color:'#ff8cff'});
    }
  }

  function attackLeviathan(e,a,phase,roll){
    if(roll<.45)call('bossBeam',window.GameBossSystem,e,a,680,28);
    else call('bossNova',window.GameBossSystem,e,245,34,'#ff8b42');
  }

  function attackSeraph(e,a,phase,roll){
    if(roll<.38){
      for(let k=-1;k<=1;k++)call('bossBeam',window.GameBossSystem,e,a+k*.24,520,17);
    }else{
      call('bossNova',window.GameBossSystem,e,220,29,'#c75cff');
    }
  }

  function attackHive(e,a,phase,roll){
    if(roll<.45){
      call('spawnWave',window.GameEnemySystem,phase>=3?6:3);
      call('bossNova',window.GameBossSystem,e,190,22,'#c75cff');
    }else{
      call('bossOrbRing',window.GameBossSystem,e,phase>=3?10:6);
    }
  }

  function attackDefault(e,a,phase,roll){
    if(roll<.55)call('bossBeam',window.GameBossSystem,e,a,590,22);
    else call('bossNova',window.GameBossSystem,e,205,27,'#c75cff');
  }

  const BossAttackHandlers = {
    bossLeviathan: attackLeviathan,
    bossSeraph: attackSeraph,
    bossHive: attackHive,
    default: attackDefault
  };

  function runBossAttack(e,a){
    let phase=e.phase||1,roll=Math.random();
    const handler=BossAttackHandlers[e.def&&e.def.shape]||BossAttackHandlers.default;
    handler(e,a,phase,roll);
    if(phase>=2&&Math.random()<.45)call('bossOrbRing',window.GameBossSystem,e,phase>=3?8:5);
    if(phase>=3&&Math.random()<.35)call('spawnWave',window.GameEnemySystem,4+stage());
  }

  function installBossVisualCleanup(){
    if(window.__bossOverheadBarsAndShadowsRemovedV122)return;
    window.__bossOverheadBarsAndShadowsRemovedV122=true;

    var Proto=window.CanvasRenderingContext2D&&window.CanvasRenderingContext2D.prototype;
    if(!Proto||Proto.__bossOverheadBarsAndShadowsRemovedV122)return;
    Proto.__bossOverheadBarsAndShadowsRemovedV122=true;

    var cfg=window.BOSS_VISUAL_CLEANUP_V122=window.BOSS_VISUAL_CLEANUP_V122||{
      enabled:true,
      minBossHpBarWidth:70,
      maxBossHpBarWidth:360,
      maxBossHpBarHeight:13,
      minShadowWidth:54,
      maxShadowHeight:22
    };

    var nativeFillRect=Proto.fillRect;
    var nativeStrokeRect=Proto.strokeRect;
    var nativeClearRect=Proto.clearRect;
    var nativeEllipse=Proto.ellipse;
    var nativeRoundRect=Proto.roundRect;
    var nativeFill=Proto.fill;
    var nativeStroke=Proto.stroke;

    function colorOf(style,globalAlpha){
      if(style&&typeof style==='object')return null;
      var s=String(style||'').trim().toLowerCase();
      var a=Number.isFinite(globalAlpha)?globalAlpha:1;
      var m;
      if((m=/^#([0-9a-f]{3,8})$/i.exec(s))){
        var h=m[1],r,g,b,aa=1;
        if(h.length===3||h.length===4){
          r=parseInt(h[0]+h[0],16);g=parseInt(h[1]+h[1],16);b=parseInt(h[2]+h[2],16);
          if(h.length===4)aa=parseInt(h[3]+h[3],16)/255;
        }else{
          r=parseInt(h.slice(0,2),16);g=parseInt(h.slice(2,4),16);b=parseInt(h.slice(4,6),16);
          if(h.length>=8)aa=parseInt(h.slice(6,8),16)/255;
        }
        return{r:r,g:g,b:b,a:a*aa};
      }
      if((m=/^rgba?\(([^)]+)\)$/.exec(s))){
        var p=m[1].split(',').map(function(v){return v.trim()});
        var rr=parseFloat(p[0]),gg=parseFloat(p[1]),bb=parseFloat(p[2]);
        var aaa=p.length>3?parseFloat(p[3]):1;
        return{r:rr,g:gg,b:bb,a:a*aaa};
      }
      if(s==='red')return{r:255,g:0,b:0,a:a};
      if(s==='black')return{r:0,g:0,b:0,a:a};
      return null;
    }

    function isRedHpStyle(ctx){
      var c=colorOf(ctx.fillStyle,ctx.globalAlpha);
      return!!(c&&c.r>=170&&c.g<=95&&c.b<=115&&c.a>=.45);
    }

    function isDarkBarOrShadowStyle(ctx,forStroke){
      var style=forStroke?ctx.strokeStyle:ctx.fillStyle;
      var c=colorOf(style,ctx.globalAlpha);
      return!!(c&&c.r<=65&&c.g<=65&&c.b<=75&&c.a<=.92);
    }

    function thinHorizontalRect(x,y,w,h){
      var aw=Math.abs(w),ah=Math.abs(h);
      return aw>=cfg.minBossHpBarWidth&&aw<=cfg.maxBossHpBarWidth&&ah>0&&ah<=cfg.maxBossHpBarHeight;
    }

    function shadowLikeRect(x,y,w,h){
      var aw=Math.abs(w),ah=Math.abs(h);
      return aw>=cfg.minShadowWidth&&ah>0&&ah<=cfg.maxShadowHeight&&aw/Math.max(ah,1)>=4;
    }

    function sameBar(a,x,y,w,h){
      if(!a)return false;
      var aw=Math.abs(w),ah=Math.abs(h),axw=Math.abs(a.w),ahh=Math.abs(a.h);
      return Math.abs(a.y-y)<=5&&Math.abs(ahh-ah)<=7&&Math.abs(a.x-x)<=8&&axw+10>=aw;
    }

    function clearBossBar(ctx,x,y,w,h){
      var b=ctx.__lastBossHpBackRectV122;
      var cx=x,cy=y,cw=w,ch=h;
      if(sameBar(b,x,y,w,h)){
        cx=Math.min(x,b.x);
        cy=Math.min(y,b.y);
        cw=Math.max(x+w,b.x+b.w)-cx;
        ch=Math.max(y+h,b.y+b.h)-cy;
      }
      nativeClearRect.call(ctx,cx-3,cy-3,cw+6,ch+6);
    }

    Proto.fillRect=function(x,y,w,h){
      if(cfg.enabled){
        if(thinHorizontalRect(x,y,w,h)){
          if(isDarkBarOrShadowStyle(this,false)){
            this.__lastBossHpBackRectV122={x:x,y:y,w:w,h:h};
            return;
          }
          if(isRedHpStyle(this)){
            clearBossBar(this,x,y,w,h);
            return;
          }
        }
        if(shadowLikeRect(x,y,w,h)&&isDarkBarOrShadowStyle(this,false))return;
      }
      return nativeFillRect.apply(this,arguments);
    };

    if(nativeStrokeRect){
      Proto.strokeRect=function(x,y,w,h){
        if(cfg.enabled&&thinHorizontalRect(x,y,w,h)&&isDarkBarOrShadowStyle(this,true))return;
        return nativeStrokeRect.apply(this,arguments);
      };
    }

    if(nativeEllipse){
      Proto.ellipse=function(x,y,radiusX,radiusY,rotation,startAngle,endAngle,counterclockwise){
        var aw=Math.abs(radiusX)*2,ah=Math.abs(radiusY)*2;
        this.__bossBottomShadowEllipseV122=(aw>=cfg.minShadowWidth&&ah<=cfg.maxShadowHeight&&aw/Math.max(ah,1)>=3.2)
          ?{x:x,y:y,w:aw,h:ah}
          :null;
        return nativeEllipse.apply(this,arguments);
      };
    }

    if(nativeRoundRect){
      Proto.roundRect=function(x,y,w,h,radii){
        this.__bossHpRoundRectV122=thinHorizontalRect(x,y,w,h)?{x:x,y:y,w:w,h:h}:null;
        return nativeRoundRect.apply(this,arguments);
      };
    }

    Proto.fill=function(){
      if(cfg.enabled){
        var rr=this.__bossHpRoundRectV122;
        if(rr){
          if(isDarkBarOrShadowStyle(this,false)){
            this.__lastBossHpBackRectV122=rr;
            this.__bossHpRoundRectV122=null;
            return;
          }
          if(isRedHpStyle(this)){
            clearBossBar(this,rr.x,rr.y,rr.w,rr.h);
            this.__bossHpRoundRectV122=null;
            return;
          }
        }
        var el=this.__bossBottomShadowEllipseV122;
        if(el&&isDarkBarOrShadowStyle(this,false)){
          this.__bossBottomShadowEllipseV122=null;
          return;
        }
      }
      return nativeFill.apply(this,arguments);
    };

    Proto.stroke=function(){
      if(cfg.enabled){
        var rr=this.__bossHpRoundRectV122;
        if(rr&&isDarkBarOrShadowStyle(this,true)){
          this.__bossHpRoundRectV122=null;
          return;
        }
        var el=this.__bossBottomShadowEllipseV122;
        if(el&&isDarkBarOrShadowStyle(this,true)){
          this.__bossBottomShadowEllipseV122=null;
          return;
        }
      }
      return nativeStroke.apply(this,arguments);
    };
  }

  installBossVisualCleanup();

  window.GameBossSystem = {
    spawnBoss,
    updateBossPhase,
    bossBeam,
    bossNova,
    bossOrbRing,
    runBossAttack,
    BossAttackHandlers,
    installBossVisualCleanup
  };
})();
