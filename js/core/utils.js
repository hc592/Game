(function(){
  const rand=(a,b)=>Math.random()*(b-a)+a;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const norm=(x,y)=>{let d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
  const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const smooth01=(rate,dt)=>1-Math.exp(-rate*dt);
  const angleLerp=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

  function drawCoverImageToRect(c,img,x,y,w,h){
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
    if(!iw||!ih)return;
    const scale=Math.max(w/iw,h/ih),dw=iw*scale,dh=ih*scale;
    c.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }

  window.GameUtils = {
    rand,
    clamp,
    norm,
    angleTo,
    smooth01,
    angleLerp,
    drawCoverImageToRect
  };
})();
