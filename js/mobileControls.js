(function(){
  'use strict';

  if(window.__gameMobileControlsInstalled)return;
  window.__gameMobileControlsInstalled=true;

  const MOBILE_CLASS='is-mobile-game';
  const ACTIVE_CLASS='mobile-gameplay-active';
  const MOVE_DEAD_ZONE=.18;
  const AIM_DEAD_ZONE=.12;
  const BOOST_THRESHOLD=.86;
  const DASH_PULSE_MS=105;
  const DASH_TAP_LOCK_MS=170;
  const virtualKeyCodes=[
    'KeyW','KeyA','KeyS','KeyD',
    'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
    'ShiftLeft','ShiftRight','Space'
  ];

  const state={
    enabled:false,
    gameplayActive:false,
    move:{x:0,y:0,power:0,active:false,pointerId:null},
    aim:{x:1,y:0,power:0,active:false,pointerId:null,lastX:1,lastY:0},
    dashPulseUntil:0
  };

  let controlsEl=null;
  let moveStick=null;
  let aimStick=null;
  let dashButton=null;
  let pauseButton=null;
  let lastDashTap=0;
  let mobileQuery=null;

  function clamp(v,min,max){
    return Math.max(min,Math.min(max,v));
  }

  function input(){
    return window.GameInput||null;
  }

  function runtime(){
    return window.GameRuntime||null;
  }

  function isVisible(id){
    const el=document.getElementById(id);
    if(!el)return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
  }

  function shouldEnableMobileMode(){
    if(/[?&]mobile=1(?:&|$)/.test(location.search))return true;
    if(/[?&]mobile=0(?:&|$)/.test(location.search))return false;
    const coarse=matchMedia('(pointer: coarse)').matches||matchMedia('(hover: none)').matches;
    const hasTouch=(navigator.maxTouchPoints||0)>0;
    const shortSide=Math.min(innerWidth,innerHeight);
    const longSide=Math.max(innerWidth,innerHeight);
    return (coarse||hasTouch)&&(shortSide<=930||longSide<=1180);
  }

  function setVirtualKey(code,value){
    const gameInput=input();
    if(gameInput&&gameInput.keys)gameInput.keys[code]=!!value;
  }

  function releaseVirtualKeys(){
    virtualKeyCodes.forEach(code=>setVirtualKey(code,false));
  }

  function releaseStick(kind){
    const stick=state[kind];
    stick.x=0;
    stick.y=0;
    stick.power=0;
    stick.active=false;
    stick.pointerId=null;
    const el=kind==='move'?moveStick:aimStick;
    if(el){
      el.classList.remove('is-active','is-boosting');
      const thumb=el.querySelector('.mobileStickThumb');
      if(thumb)thumb.style.transform='translate(-50%,-50%)';
    }
  }

  function setStickFromPointer(kind,event){
    const el=kind==='move'?moveStick:aimStick;
    if(!el)return;
    const rect=el.getBoundingClientRect();
    const radius=Math.max(1,rect.width*.42);
    let x=(event.clientX-(rect.left+rect.width/2))/radius;
    let y=(event.clientY-(rect.top+rect.height/2))/radius;
    const rawPower=Math.hypot(x,y);
    if(rawPower>1){
      x/=rawPower;
      y/=rawPower;
    }
    const power=clamp(rawPower,0,1);
    const dead=kind==='move'?MOVE_DEAD_ZONE:AIM_DEAD_ZONE;
    if(power<dead){
      x=0;
      y=0;
    }
    const stick=state[kind];
    stick.x=x;
    stick.y=y;
    stick.power=power;
    stick.active=true;
    if(kind==='aim'&&power>=AIM_DEAD_ZONE){
      stick.lastX=x;
      stick.lastY=y;
    }
    const thumb=el.querySelector('.mobileStickThumb');
    if(thumb){
      const travel=rect.width*.27;
      thumb.style.transform=`translate(calc(-50% + ${x*travel}px), calc(-50% + ${y*travel}px))`;
    }
    el.classList.toggle('is-active',power>=dead);
    el.classList.toggle('is-boosting',kind==='move'&&power>=BOOST_THRESHOLD);
  }

  function bindStick(el,kind){
    el.addEventListener('pointerdown',event=>{
      if(!state.enabled)return;
      event.preventDefault();
      event.stopPropagation();
      const stick=state[kind];
      stick.pointerId=event.pointerId;
      try{el.setPointerCapture(event.pointerId)}catch(e){}
      setStickFromPointer(kind,event);
    });
    el.addEventListener('pointermove',event=>{
      const stick=state[kind];
      if(stick.pointerId!==event.pointerId)return;
      event.preventDefault();
      event.stopPropagation();
      setStickFromPointer(kind,event);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>{
      el.addEventListener(type,event=>{
        const stick=state[kind];
        if(stick.pointerId!==event.pointerId&&type!=='lostpointercapture')return;
        event.preventDefault();
        event.stopPropagation();
        releaseStick(kind);
      });
    });
  }

  function triggerDash(event){
    if(!state.enabled||!state.gameplayActive)return;
    event.preventDefault();
    event.stopPropagation();
    const now=performance.now();
    if(now-lastDashTap<DASH_TAP_LOCK_MS)return;
    lastDashTap=now;
    state.dashPulseUntil=now+DASH_PULSE_MS;
    if(dashButton)dashButton.classList.add('is-pressed');
  }

  function triggerPause(event){
    if(!state.enabled)return;
    event.preventDefault();
    event.stopPropagation();
    const rt=runtime();
    if(!rt||!rt.started||rt.gameOver||isVisible('levelOverlay'))return;
    const fn=window.togglePause||(window.GameUI&&window.GameUI.togglePause);
    if(typeof fn==='function')fn();
  }

  function createStick(id,label){
    const stick=document.createElement('div');
    stick.id=id;
    stick.className='mobileStick mobilePlayOnly';
    stick.setAttribute('role','application');
    stick.setAttribute('aria-label',label+' joystick');

    const pad=document.createElement('div');
    pad.className='mobileStickPad';
    const thumb=document.createElement('div');
    thumb.className='mobileStickThumb';
    const text=document.createElement('div');
    text.className='mobileStickLabel';
    text.textContent=label;

    stick.appendChild(pad);
    stick.appendChild(thumb);
    stick.appendChild(text);
    return stick;
  }

  function ensureDom(){
    if(controlsEl)return;

    controlsEl=document.createElement('div');
    controlsEl.id='mobileControls';
    controlsEl.setAttribute('aria-hidden','true');

    pauseButton=document.createElement('button');
    pauseButton.id='mobilePauseButton';
    pauseButton.className='mobilePlayOnly';
    pauseButton.type='button';
    pauseButton.textContent='ESC';
    pauseButton.setAttribute('aria-label','Open pause menu');

    moveStick=createStick('mobileMoveStick','MOVE');
    aimStick=createStick('mobileAimStick','AIM');

    dashButton=document.createElement('button');
    dashButton.id='mobileDashButton';
    dashButton.className='mobilePlayOnly';
    dashButton.type='button';
    dashButton.textContent='DASH';
    dashButton.setAttribute('aria-label','Dash');

    controlsEl.appendChild(pauseButton);
    controlsEl.appendChild(moveStick);
    controlsEl.appendChild(aimStick);
    controlsEl.appendChild(dashButton);
    document.body.appendChild(controlsEl);

    bindStick(moveStick,'move');
    bindStick(aimStick,'aim');
    dashButton.addEventListener('pointerdown',triggerDash);
    dashButton.addEventListener('pointerup',event=>{
      event.preventDefault();
      event.stopPropagation();
      if(dashButton)dashButton.classList.remove('is-pressed');
    });
    dashButton.addEventListener('pointercancel',event=>{
      event.preventDefault();
      event.stopPropagation();
      if(dashButton)dashButton.classList.remove('is-pressed');
    });
    pauseButton.addEventListener('pointerdown',triggerPause);
  }

  function applyViewportMeta(){
    let meta=document.querySelector('meta[name="viewport"]');
    if(!meta){
      meta=document.createElement('meta');
      meta.name='viewport';
      document.head.appendChild(meta);
    }
    const content=meta.getAttribute('content')||'width=device-width, initial-scale=1.0';
    const tokens=content.split(',').map(v=>v.trim()).filter(Boolean);
    ['viewport-fit=cover','user-scalable=no'].forEach(token=>{
      if(!tokens.some(v=>v.toLowerCase()===token))tokens.push(token);
    });
    meta.setAttribute('content',tokens.join(', '));
  }

  function setMobileMode(next){
    next=!!next;
    if(next)ensureDom();
    if(state.enabled===next)return;
    state.enabled=next;
    document.documentElement.classList.toggle(MOBILE_CLASS,next);
    document.body.classList.toggle(MOBILE_CLASS,next);
    if(controlsEl)controlsEl.setAttribute('aria-hidden',next?'false':'true');
    if(!next){
      releaseStick('move');
      releaseStick('aim');
      releaseVirtualKeys();
      state.gameplayActive=false;
      document.body.classList.remove(ACTIVE_CLASS);
    }else{
      applyViewportMeta();
    }
  }

  function updateGameplayActive(){
    const rt=runtime();
    const active=!!(state.enabled&&rt&&rt.started&&!rt.paused&&!rt.gameOver&&!isVisible('levelOverlay')&&!isVisible('startOverlay')&&!isVisible('gameOver'));
    if(state.gameplayActive!==active){
      state.gameplayActive=active;
      document.body.classList.toggle(ACTIVE_CLASS,active);
      if(!active){
        releaseStick('move');
        releaseVirtualKeys();
        if(dashButton)dashButton.classList.remove('is-pressed');
      }
    }
  }

  function applyMoveInput(){
    const moving=state.gameplayActive&&state.move.active&&state.move.power>=MOVE_DEAD_ZONE;
    const x=moving?state.move.x:0;
    const y=moving?state.move.y:0;
    setVirtualKey('KeyD',x>.24);
    setVirtualKey('KeyA',x<-.24);
    setVirtualKey('KeyS',y>.24);
    setVirtualKey('KeyW',y<-.24);
    setVirtualKey('ArrowRight',false);
    setVirtualKey('ArrowLeft',false);
    setVirtualKey('ArrowDown',false);
    setVirtualKey('ArrowUp',false);
    const boosting=moving&&state.move.power>=BOOST_THRESHOLD;
    setVirtualKey('ShiftLeft',boosting);
    setVirtualKey('ShiftRight',false);
  }

  function applyAimInput(){
    if(!state.gameplayActive)return;
    const gameInput=input();
    const rt=runtime();
    if(!gameInput||!gameInput.mouse||!rt||!rt.player)return;
    const aim=state.aim;
    let x=aim.lastX;
    let y=aim.lastY;
    if(aim.active&&aim.power>=AIM_DEAD_ZONE){
      x=aim.x;
      y=aim.y;
      aim.lastX=x;
      aim.lastY=y;
    }
    const len=Math.hypot(x,y)||1;
    x/=len;
    y/=len;
    const player=rt.player;
    const camera=rt.camera||{x:0,y:0};
    const screenX=player.x-camera.x;
    const screenY=player.y-camera.y;
    const aimDistance=clamp(Math.max(innerWidth,innerHeight)*.55,260,540);
    gameInput.mouse.x=screenX+x*aimDistance;
    gameInput.mouse.y=screenY+y*aimDistance;
  }

  function applyDashInput(){
    const active=state.gameplayActive&&performance.now()<state.dashPulseUntil;
    setVirtualKey('Space',active);
    if(!active&&dashButton)dashButton.classList.remove('is-pressed');
  }

  function tick(){
    updateGameplayActive();
    if(state.enabled&&state.gameplayActive){
      applyMoveInput();
      applyAimInput();
      applyDashInput();
    }else if(state.enabled){
      releaseVirtualKeys();
    }
    requestAnimationFrame(tick);
  }

  function refreshMobileMode(){
    setMobileMode(shouldEnableMobileMode());
  }

  function preventMobileGestures(event){
    if(state.enabled)event.preventDefault();
  }

  function init(){
    mobileQuery=matchMedia('(pointer: coarse), (hover: none), (max-width: 820px)');
    refreshMobileMode();
    addEventListener('resize',refreshMobileMode,{passive:true});
    addEventListener('orientationchange',refreshMobileMode,{passive:true});
    if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',refreshMobileMode);
    else if(mobileQuery.addListener)mobileQuery.addListener(refreshMobileMode);
    document.addEventListener('touchmove',preventMobileGestures,{passive:false});
    document.addEventListener('gesturestart',preventMobileGestures,{passive:false});
    requestAnimationFrame(tick);
  }

  window.GameMobileControls={
    state,
    refresh:refreshMobileMode,
    setMobileMode,
    release:releaseVirtualKeys
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
