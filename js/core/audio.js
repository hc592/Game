let audioCtx=null,masterGain=null,bgmGain=null,audioEnabled=true,lastSfx={},bgmTimer=null,bgmStarted=false,bgmStep=0;
const customBgm=document.getElementById('customBgm');

function audioClamp(value,min,max){return Math.max(min,Math.min(max,value))}
function getSfxVolume(){
  if(typeof settings!=='undefined'&&typeof settings.sfxVolume==='number')return audioClamp(settings.sfxVolume,0,1);
  return typeof settings!=='undefined'&&typeof settings.volume==='number'?audioClamp(settings.volume,0,1):1;
}
function getBgmVolume(){
  if(typeof settings!=='undefined'&&typeof settings.bgmVolume==='number')return audioClamp(settings.bgmVolume,0,1);
  return typeof settings!=='undefined'&&typeof settings.volume==='number'?audioClamp(settings.volume*.2,0,1):0.2;
}

function setCustomBgmVolume(){if(customBgm)customBgm.volume=getBgmVolume()}
function playCustomBgm(){if(!customBgm||!audioEnabled)return;setCustomBgmVolume();const p=customBgm.play();if(p&&typeof p.catch==='function')p.catch(()=>{})}
function pauseCustomBgm(){if(customBgm)customBgm.pause()}
function stopCustomBgm(){if(customBgm){customBgm.pause();customBgm.currentTime=0}}

function ensureAudio(){
  if(audioCtx)return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  masterGain=audioCtx.createGain();
  bgmGain=audioCtx.createGain();
  masterGain.gain.value=getSfxVolume();
  bgmGain.gain.value=.34;
  bgmGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);
}

function toggleAudio(){
  ensureAudio();
  audioEnabled=!audioEnabled;
  masterGain.gain.value=audioEnabled?getSfxVolume():0;
  if(audioEnabled)playCustomBgm();else pauseCustomBgm();
  message(audioEnabled?'\u97f3\u6548\u5df2\u5f00\u542f':'\u97f3\u6548\u5df2\u9759\u97f3');
  playSfx('ui');
}

function throttleSfx(n,g=.05){
  let now=performance.now()/1000;
  if(lastSfx[n]&&now-lastSfx[n]<g)return false;
  lastSfx[n]=now;
  return true;
}

function tone(f,d,type='sine',v=.15,delay=0,slide=0){
  if(!audioEnabled)return;
  ensureAudio();
  let t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;
  o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+d);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(v,t+.01);
  g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g);
  g.connect(masterGain);
  o.start(t);
  o.stop(t+d+.03);
}

function noise(d=.2,v=.12,delay=0,ff=900,type='lowpass'){
  if(!audioEnabled)return;
  ensureAudio();
  let t=audioCtx.currentTime+delay,b=audioCtx.createBuffer(1,audioCtx.sampleRate*d,audioCtx.sampleRate),data=b.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  let s=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
  s.buffer=b;
  f.type=type;
  f.frequency.setValueAtTime(ff,t);
  g.gain.setValueAtTime(v,t);
  g.gain.exponentialRampToValueAtTime(.001,t+d);
  s.connect(f);
  f.connect(g);
  g.connect(masterGain);
  s.start(t);
  s.stop(t+d+.02);
}

function bgmTone(f,d,type='sine',v=.02,delay=0){
  if(!audioEnabled)return;
  ensureAudio();
  let t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain(),lp=audioCtx.createBiquadFilter();
  o.type=type;
  o.frequency.setValueAtTime(f,t);
  lp.type='lowpass';
  lp.frequency.setValueAtTime(1200,t);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(v,t+.04);
  g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(lp);
  lp.connect(g);
  g.connect(bgmGain);
  o.start(t);
  o.stop(t+d+.05);
}

function startBGM(){ensureAudio();if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null}bgmStarted=true;playCustomBgm()}

function scheduleBGM(){
  if(!audioCtx||!audioEnabled)return;
  let boss=enemies&&enemies.some(e=>e.def&&e.def.boss&&!e.dead),intensity=(boss?1.45:1)+(stage?Math.min(stage*.05,.35):0);
  let scale=[55,65.41,73.42,82.41,98,110,130.81,146.83];
  for(let i=0;i<8;i++){
    let f=scale[(bgmStep+i)%scale.length]*(i%3===0?1:2);
    bgmTone(f,.28,'triangle',.012*intensity,i*.2);
  }
  bgmTone(boss?82.41:55,1.65,'sawtooth',.018*intensity,0);
  bgmTone((boss?164.81:110),1.2,'sine',.01*intensity,.4);
  bgmStep=(bgmStep+(boss?3:2))%scale.length;
}

function getPresetRoot(){return window.GameAudioPresets||{}}

function resolvePreset(category,name,seen){
  const root=getPresetRoot();
  const group=root&&root[category];
  const preset=group&&group[name];
  if(!preset)return null;
  if(!preset.alias)return {category,name,preset};
  const key=category+':'+name;
  if(seen&&seen[key])return null;
  const nextSeen=seen||{};
  nextSeen[key]=true;
  const aliasText=String(preset.alias);
  let nextCategory=preset.aliasCategory||(category==='weapon'?'sfx':category);
  let nextName=aliasText;
  if(aliasText.indexOf('.')>0){
    const parts=aliasText.split('.');
    nextCategory=parts[0]||nextCategory;
    nextName=parts[1]||nextName;
  }
  return resolvePreset(nextCategory,nextName,nextSeen);
}

function getThrottleKey(category,name,resolved,preset){
  if(preset&&preset.throttleKey)return preset.throttleKey;
  if(resolved.category==='weapon')return 'weapon_'+resolved.name;
  return resolved.name;
}

function numberOr(value,fallback){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

function playPreset(category,name){
  if(!audioEnabled)return false;
  ensureAudio();
  const resolved=resolvePreset(category,name);
  if(!resolved)return false;
  const preset=resolved.preset||{};
  const throttle=Number(preset.throttle);
  if(Number.isFinite(throttle)&&throttle>0&&!throttleSfx(getThrottleKey(category,name,resolved,preset),throttle))return false;
  const layers=Array.isArray(preset.layers)?preset.layers:[];
  for(const layer of layers){
    if(!layer||!layer.kind)continue;
    if(layer.kind==='tone'){
      tone(
        numberOr(layer.frequency,440),
        Math.max(.001,numberOr(layer.duration,.1)),
        layer.wave||'sine',
        numberOr(layer.gain,.12),
        numberOr(layer.delay,0),
        numberOr(layer.slide,0)
      );
    }else if(layer.kind==='noise'){
      noise(
        Math.max(.001,numberOr(layer.duration,.2)),
        numberOr(layer.gain,.12),
        numberOr(layer.delay,0),
        numberOr(layer.filterFreq,900),
        layer.filterType||'lowpass'
      );
    }
  }
  return true;
}

function playSfx(n){return playPreset('sfx',n)}
function playWeaponSfx(t){if(playPreset('weapon',t))return true;return playPreset('sfx','ui')}

window.GameAudio = {
  get audioCtx(){return audioCtx;},
  get masterGain(){return masterGain;},
  get bgmGain(){return bgmGain;},
  get audioEnabled(){return audioEnabled;},
  set audioEnabled(value){audioEnabled=!!value;},
  get customBgm(){return customBgm;},
  get ensureAudio(){return ensureAudio;},
  get toggleAudio(){return toggleAudio;},
  get throttleSfx(){return throttleSfx;},
  get tone(){return tone;},
  get noise(){return noise;},
  get bgmTone(){return bgmTone;},
  get startBGM(){return startBGM;},
  get scheduleBGM(){return scheduleBGM;},
  get playSfx(){return playSfx;},
  get playWeaponSfx(){return playWeaponSfx;},
  get playCustomBgm(){return playCustomBgm;},
  get pauseCustomBgm(){return pauseCustomBgm;},
  get stopCustomBgm(){return stopCustomBgm;},
  get setCustomBgmVolume(){return setCustomBgmVolume;}
};
