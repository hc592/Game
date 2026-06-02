const worldBgImg=new Image();
let worldBgImgReady=false,worldBgCanvas=null;
worldBgImg.onload=()=>{worldBgImgReady=true;if(typeof rebuildWorldBackgroundCanvas==='function')rebuildWorldBackgroundCanvas()};
worldBgImg.onerror=()=>console.warn('未能加载背景图 3.png，请确认它位于 html 同级的 resource 文件夹内');
worldBgImg.src='./resource/3.png';
const playerShipImg=new Image();
let playerShipImgReady=false;
playerShipImg.onload=()=>{playerShipImgReady=true};
playerShipImg.onerror=()=>console.warn('未能加载玩家战机图片 1.png，请确认它位于 html 同级的 resource 文件夹内');
playerShipImg.src='./resource/1.png';
const thrustFlameImg=new Image();
let thrustFlameImgReady=false;
thrustFlameImg.onload=()=>{thrustFlameImgReady=true};
thrustFlameImg.onerror=()=>console.warn('未能加载尾焰图片 2.png，请确认它位于 html 同级的 resource 文件夹内');
thrustFlameImg.src='./resource/2.png';
const ENGINE_FLAME={x:0,y:60,w:26,h:71}; // 调尾焰位置/大小：x左右，y上下，w宽度，h长度
window.GameAssets = {
  worldBgImg,
  get worldBgImgReady(){return worldBgImgReady;},
  get worldBgCanvas(){return worldBgCanvas;},
  set worldBgCanvas(value){worldBgCanvas=value;},
  playerShipImg,
  get playerShipImgReady(){return playerShipImgReady;},
  thrustFlameImg,
  get thrustFlameImgReady(){return thrustFlameImgReady;},
  ENGINE_FLAME
};
