(function(){
  const keys={};
  let mouse={x:innerWidth/2,y:innerHeight/2};

  function setKey(e,d){
    if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    keys[e.code]=d;
  }

  function clearKeys(){
    for(const k in keys)keys[k]=false;
  }

  addEventListener('keydown',e=>{
    setKey(e,true);
    let k=e.key.toLowerCase();
    const startedNow=typeof started!=='undefined'&&started;
    const gameOverNow=typeof gameOver!=='undefined'&&gameOver;
    if((k==='p'||e.key==='Escape')&&startedNow&&!gameOverNow&&document.getElementById('levelOverlay').style.display!=='flex'){
      if(typeof togglePause==='function')togglePause();
      else if(window.togglePause)window.togglePause();
    }
    if(k==='m'){
      if(typeof toggleAudio==='function')toggleAudio();
      else if(window.toggleAudio)window.toggleAudio();
    }
    if(k==='r'&&gameOverNow){
      if(typeof restartGame==='function')restartGame();
      else if(window.restartGame)window.restartGame();
    }
  });
  addEventListener('keyup',e=>setKey(e,false));
  addEventListener('blur',clearKeys);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearKeys()});
  addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY});

  window.GameInput = {
    keys,
    mouse,
    clearKeys
  };
})();
