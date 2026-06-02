(function(){
  'use strict';

  const LAB_URL = './js/tools/sfxLab.html';
  const SHORTCUT_TEXT = 'Ctrl+Alt+F8';
  const CHANNEL = 'game-audio-sfx-lab';

  function openSfxLab(){
    const url = new URL(LAB_URL, window.location.href).href;
    const features = [
      'popup=yes',
      'width=1480',
      'height=920',
      'left=80',
      'top=40',
      'resizable=yes',
      'scrollbars=yes'
    ].join(',');
    window.__sfxLabWindow = window.open(url, 'GameAudioSfxLab', features);
    if(window.__sfxLabWindow)window.__sfxLabWindow.focus();
  }

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function send(target,message){
    if(target && typeof target.postMessage === 'function'){
      target.postMessage(Object.assign({channel: CHANNEL},message),'*');
    }
  }

  function applyPreset(category,name,preset){
    if(!window.GameAudioPresets)window.GameAudioPresets = {sfx:{}, weapon:{}};
    if(!window.GameAudioPresets[category])window.GameAudioPresets[category] = {};
    window.GameAudioPresets[category][name] = clone(preset);
  }

  function replacePresets(nextPresets){
    if(nextPresets && typeof nextPresets === 'object'){
      window.GameAudioPresets = clone(nextPresets);
    }
  }

  function previewPreset(data){
    if(!data || !data.editPath || !data.preset)return;
    const editCategory = data.editPath.category;
    const editName = data.editPath.name;
    if(!editCategory || !editName)return;
    if(!window.GameAudioPresets)window.GameAudioPresets = {sfx:{}, weapon:{}};
    if(!window.GameAudioPresets[editCategory])window.GameAudioPresets[editCategory] = {};

    const group = window.GameAudioPresets[editCategory];
    const hadPrevious = Object.prototype.hasOwnProperty.call(group,editName);
    const previous = hadPrevious ? clone(group[editName]) : undefined;
    const preview = clone(data.preset);
    preview.throttle = 0;
    group[editName] = preview;

    try{
      const audio = window.GameAudio;
      if(audio && data.selected && data.selected.category === 'weapon' && typeof audio.playWeaponSfx === 'function'){
        audio.playWeaponSfx(data.selected.name);
      }else if(audio && data.selected && typeof audio.playSfx === 'function'){
        audio.playSfx(data.selected.name);
      }
    }finally{
      if(data.commit){
        group[editName] = clone(data.preset);
      }else if(hadPrevious){
        group[editName] = previous;
      }else{
        delete group[editName];
      }
    }
  }

  window.addEventListener('message', function(event){
    const data = event.data || {};
    if(data.channel !== CHANNEL)return;
    if(data.type === 'request-state'){
      send(event.source,{
        type: 'state-response',
        presets: clone(window.GameAudioPresets || {sfx:{}, weapon:{}}),
        defaults: clone(window.GameAudioDefaultPresets || window.GameAudioPresets || {sfx:{}, weapon:{}}),
        hasGameAudio: !!window.GameAudio
      });
    }else if(data.type === 'apply-preset'){
      applyPreset(data.category,data.name,data.preset);
      send(event.source,{type:'apply-ack'});
    }else if(data.type === 'replace-presets'){
      replacePresets(data.presets);
      send(event.source,{type:'replace-ack'});
    }else if(data.type === 'preview'){
      previewPreset(data);
      send(event.source,{type:'preview-ack'});
    }
  });

  window.openSfxLab = openSfxLab;

  document.addEventListener('keydown', function(event){
    if(event.ctrlKey && event.altKey && (event.code === 'F8' || event.key === 'F8')){
      event.preventDefault();
      event.stopPropagation();
      openSfxLab();
    }
  }, true);

  console.info('Web Audio SFX Lab shortcut:', SHORTCUT_TEXT);
})();
