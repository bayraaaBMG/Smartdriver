'use strict';
// ═══════════════════════════════════════════════════════════════
//  UI.JS — HUD, Minimap, Alert, Dialog, Pause
// ═══════════════════════════════════════════════════════════════

// ── Alert system ──────────────────────────────────────────────
function pushAlert(title, sub, color) {
  color = color || '#ff6a00';
  G.alerts.unshift({title:title, sub:sub, color:color, timer:210});
  if (G.alerts.length>3) G.alerts.length=3;
}

function drawAlerts(c) {
  G.alerts = G.alerts.filter(function(a){ return a.timer-->0; });
  G.alerts.forEach(function(a,i) {
    var alpha=Math.min(1,a.timer/50);
    c.globalAlpha=alpha;
    var w=310, h=54, x=GCW/2-w/2, y=GCH*0.27+i*62;
    c.fillStyle='rgba(8,8,14,0.92)';
    if (typeof c.roundRect==='function'){
      c.beginPath();c.roundRect(x,y,w,h,9);c.fill();
    } else {c.fillRect(x,y,w,h);}
    c.strokeStyle=a.color; c.lineWidth=1.5; c.setLineDash([]);
    if (typeof c.roundRect==='function'){
      c.beginPath();c.roundRect(x,y,w,h,9);c.stroke();
    } else {c.strokeRect(x,y,w,h);}
    // Colored left bar
    c.fillStyle=a.color; c.fillRect(x,y,3,h);
    // Text
    c.fillStyle=a.color; c.font='bold 13px "JetBrains Mono",monospace'; c.textAlign='left';
    c.fillText(a.title, x+12, y+20);
    c.fillStyle='rgba(240,238,234,0.6)'; c.font='11px "JetBrains Mono",monospace';
    c.fillText(a.sub, x+12, y+38);
    c.globalAlpha=1;
  });
}

// ── Minimap ───────────────────────────────────────────────────
function drawMinimap() {
  if (!mmCtx) return;
  var mc=mmCtx, mw=mmCanvas.width, mh=mmCanvas.height;
  var sx=mw/WORLD.W, sy=mh/WORLD.H;

  mc.fillStyle='#1a1810'; mc.fillRect(0,0,mw,mh);

  // Roads
  mc.fillStyle='#3a3530';
  wRoads.forEach(function(r){
    if (r.horiz) mc.fillRect(r.x0*sx,r.y0*sy,r.len*sx,r.h*sy);
    else         mc.fillRect(r.x0*sx,r.y0*sy,r.w*sx,r.len*sy);
  });

  // Sukhbaatar Square
  mc.fillStyle='#5a5448';
  var sq=SUKHBAATAR_SQ;
  mc.fillRect(sq.x*sx,sq.y*sy,sq.w*sx,sq.h*sy);

  // Green areas
  mc.fillStyle='#2a3a18';
  wTrees.forEach(function(t){
    mc.fillRect(t.x*sx-0.5,t.y*sy-0.5,1,1);
  });

  // AI cars
  mc.fillStyle='rgba(180,178,170,0.7)';
  G.aiCars.forEach(function(ai){
    if (!ai.active) return;
    mc.fillRect(ai.x*sx-1,ai.y*sy-1,2,2);
  });

  // Police
  mc.fillStyle='#3b82f6';
  G.police.forEach(function(pc){
    mc.beginPath();mc.arc(pc.x*sx,pc.y*sy,2.5,0,Math.PI*2);mc.fill();
  });

  // Player
  mc.fillStyle='#ff6a00';
  var px=G.player.x*sx, py=G.player.y*sy;
  mc.beginPath();mc.arc(px,py,3.8,0,Math.PI*2);mc.fill();
  // Player direction indicator
  mc.strokeStyle='#ff6a00'; mc.lineWidth=1.5;
  mc.beginPath();mc.moveTo(px,py);
  mc.lineTo(px+Math.cos(G.player.angle)*7,py+Math.sin(G.player.angle)*7);
  mc.stroke();

  // Viewport rect
  mc.strokeStyle='rgba(255,255,255,0.22)'; mc.lineWidth=0.6; mc.setLineDash([]);
  mc.strokeRect(cam.x*sx,cam.y*sy,(GCW/cam.zoom)*sx,(GCH/cam.zoom)*sy);
}

// ── HUD update ────────────────────────────────────────────────
function updateHUD() {
  var p=G.player;

  // Speed
  var sEl=$('hud-spd'); if(sEl) sEl.textContent=p.kmh;
  var gEl=$('hud-gear'); if(gEl) gEl.textContent=p.gear;

  // Speedometer arc (analog style) - draw on canvas overlay
  drawSpeedometer(p.kmh, G.speedLimit);

  // Money
  var mEl=$('hud-money'); if(mEl) mEl.textContent='₮'+G.money.toLocaleString();

  // Speed limit sign color
  var limEl=$('hud-spd-limit');
  if(limEl) {
    limEl.textContent=G.speedLimit;
    var over=p.kmh>G.speedLimit+10;
    limEl.style.borderColor=over?'#ef4444':'#888';
    limEl.style.color=over?'#ef4444':'#f0eeea';
    limEl.style.background=over?'rgba(239,68,68,0.1)':'transparent';
  }

  // Wanted stars
  for(var i=1;i<=3;i++){
    var s=$('s'+i);
    if(s) s.classList.toggle('lit', i<=G.wantedLevel);
  }

  // Time
  var h=Math.floor(G.time/60)%24, m=Math.floor(G.time%60);
  var tEl=$('hud-time');
  if(tEl) tEl.textContent=_pad(h)+':'+_pad(m);

  // Current road name
  var rEl=$('hud-road');
  if(rEl) rEl.textContent=G._currentRoad||'—';

  // Violation log
  var vlEl=$('viol-log');
  if(vlEl) {
    vlEl.innerHTML=G.violationLog.slice(0,3).map(function(v){
      return '<div class="vl-item"><span style="color:'+v.color+'">'+v.label+'</span> <span style="color:#ef4444;font-size:.65rem">-₮'+v.fine.toLocaleString()+'</span></div>';
    }).join('');
  }

  // Player health bar
  var hpEl=$('hud-health');
  if(hpEl) {
    var hpFill=hpEl.querySelector('.hp-fill');
    if(hpFill) {
      hpFill.style.width=p.health+'%';
      hpFill.style.background=p.health>60?'#22c55e':p.health>30?'#f59e0b':'#ef4444';
    }
  }
}

// ── Speedometer arc ───────────────────────────────────────────
var _spdCanvas=null, _spdCtx=null;
function drawSpeedometer(kmh, limit) {
  if (!_spdCanvas) {
    _spdCanvas=document.getElementById('spd-canvas');
    if(_spdCanvas) _spdCtx=_spdCanvas.getContext('2d');
  }
  if (!_spdCtx) return;
  var c=_spdCtx, size=_spdCanvas.width;
  c.clearRect(0,0,size,size);
  var cx=size/2, cy=size/2, r=42;

  // Background ring
  c.beginPath(); c.arc(cx,cy,r,Math.PI*0.75,Math.PI*2.25);
  c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=8; c.setLineDash([]); c.stroke();

  // Speed arc
  var maxKmh=220;
  var pct=Math.min(1,kmh/maxKmh);
  var startA=Math.PI*0.75, endA=Math.PI*0.75+Math.PI*1.5*pct;
  var arcCol = kmh>limit+15 ? '#ef4444' : kmh>limit ? '#f59e0b' : '#ff6a00';
  c.beginPath(); c.arc(cx,cy,r,startA,endA);
  c.strokeStyle=arcCol; c.lineWidth=8; c.lineCap='round'; c.stroke();

  // Speed limit tick
  var limitAngle = Math.PI*0.75 + Math.PI*1.5*(limit/maxKmh);
  var tlx=cx+Math.cos(limitAngle)*(r-12), tly=cy+Math.sin(limitAngle)*(r-12);
  var tlx2=cx+Math.cos(limitAngle)*(r+6), tly2=cy+Math.sin(limitAngle)*(r+6);
  c.beginPath(); c.moveTo(tlx,tly); c.lineTo(tlx2,tly2);
  c.strokeStyle='#ef4444'; c.lineWidth=2; c.stroke();
}

// ── Dialog helpers ────────────────────────────────────────────
function showPoliceDialog(totalFine) {
  var dlg=$('game-police-dialog');
  var fineEl=$('gpd-fine');
  if(dlg && fineEl) {
    fineEl.textContent='₮'+totalFine.toLocaleString();
    dlg.style.display='flex';
  }
}
function closePoliceDialog() {
  var dlg=$('game-police-dialog');
  if(dlg) dlg.style.display='none';
}

// ── Public game management ────────────────────────────────────
function startGame(mode) {
  if (!gc) initCanvas();

  // Reset state
  G.mode=mode; G.frame=0; G.wantedLevel=0; G.money=500000; G.score=100;
  G.violationLog=[]; G.alerts=[]; G.particles=[]; G.police=[];
  G._flash=0; G._pendingFine=0; G._wantedDecay=0; G._currentRoad='';
  G.speedLimit=60;

  // Reset violation cooldowns
  for (var k in _vCooldown) delete _vCooldown[k];
  _arrestPending=false;

  // Build world
  buildWorld();
  spawnAICars();
  spawnPeds();

  // Place player on Peace Avenue, eastbound
  var peace=wRoads.find(function(r){return r.name==='Энхтайваны өргөн чөлөө';});
  var startY=peace ? peace.yCen+peace.h/4 : WORLD.H/2;
  G.player=new PlayerCar(280, startY, 0);
  G.speedLimit=peace?peace.spd:60;

  // Camera — OBL (oblique y factor) defined in renderer.js
  cam.x=280-GCW/(2*cam.zoom); cam.y=startY-GCH/(2*cam.zoom*OBL);
  cam.tx=cam.x; cam.ty=cam.y;

  // Mode label
  var labels={free:'ЧӨЛӨӨТ',test:'ШАЛГАЛТ',mission:'ДААЛГАВАР'};
  var ml=$('hud-mode-lbl'); if(ml) ml.textContent=labels[mode]||'ГОРИМ';

  // Show/hide UI elements
  $('game-menu').style.display='none';
  $('game-hud').style.display='block';
  $('hud-health').style.display='block';
  $('hud-speed-wrap').style.display='flex';
  $('hud-ctrl-btns').style.display='flex';
  $('game-minimap').style.display='block';
  $('viol-log').style.display='block';
  if('ontouchstart' in window) $('mob-game-ctrl').style.display='block';

  if(mode==='mission') {
    var tt=$('ht-text');
    if(tt) tt.textContent=_missionText();
    $('hud-task').style.display='block';
  }

  // Show satellite map background
  if (typeof initLeafletMap === 'function') initLeafletMap();
  $('map-bg').style.display='block';

  G.running=true; G.paused=false;
  cancelAnimationFrame(_raf);
  _raf=requestAnimationFrame(_loop);

  pushAlert('Тоглоом эхэллээ!','WASD — жолоодоорой · H — эвэр','#22c55e');
}

function togglePause() {
  if (!G.running) return;
  G.paused=!G.paused;
  $('game-pause').style.display=G.paused?'flex':'none';
  if (!G.paused) { cancelAnimationFrame(_raf); _raf=requestAnimationFrame(_loop); }
}

function restartGame() {
  $('game-pause').style.display='none';
  startGame(G.mode);
}

function showGameMenu() {
  $('game-pause').style.display='none';
  G.running=false; G.paused=false;
  cancelAnimationFrame(_raf);
  $('game-menu').style.display='flex';
  $('game-hud').style.display='none';
  $('hud-health').style.display='none';
  $('hud-speed-wrap').style.display='none';
  $('hud-ctrl-btns').style.display='none';
  $('game-minimap').style.display='none';
  $('viol-log').style.display='none';
  $('hud-task').style.display='none';
  $('mob-game-ctrl').style.display='none';
  $('map-bg').style.display='none';
}

function payFineAction() {
  closePoliceDialog();
  G.player.crashed=false; G.player.crashTimer=0;
  G._pendingFine=0;
  pushAlert('✅ Торгууль төлөгдлөө','Аюулгүй явна уу!','#22c55e');
}

// ── Compass ───────────────────────────────────────────────────
var _compCanvas=null, _compCtx=null;
function drawCompass() {
  if (!_compCanvas) {
    _compCanvas = document.getElementById('compass-canvas');
    if (_compCanvas) _compCtx = _compCanvas.getContext('2d');
  }
  if (!_compCtx || !G.player) return;
  var c=_compCtx, sz=_compCanvas.width, cx=sz/2, cy=sz/2, r=sz/2-3;
  c.clearRect(0,0,sz,sz);

  // Background circle
  c.fillStyle='rgba(6,6,14,0.92)';
  c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.fill();

  // Subtle tick marks (every 45°)
  c.strokeStyle='rgba(255,255,255,0.14)'; c.lineWidth=1;
  for (var i=0;i<8;i++) {
    var a=i*Math.PI/4;
    var inner=(i%2===0)?r-10:r-7;
    c.beginPath();
    c.moveTo(cx+Math.cos(a)*(r-2), cy+Math.sin(a)*(r-2));
    c.lineTo(cx+Math.cos(a)*inner,  cy+Math.sin(a)*inner);
    c.stroke();
  }

  // Rotate so north stays up while showing heading
  var heading = G.player.angle + Math.PI/2; // world angle → compass heading
  c.save(); c.translate(cx,cy); c.rotate(-heading);

  // N arrow (green)
  c.fillStyle='#22c55e';
  c.beginPath(); c.moveTo(0,-(r-7)); c.lineTo(-5,0); c.lineTo(5,0); c.closePath(); c.fill();

  // S arrow (white/dim)
  c.fillStyle='rgba(255,255,255,0.22)';
  c.beginPath(); c.moveTo(0,r-7); c.lineTo(-4,0); c.lineTo(4,0); c.closePath(); c.fill();

  // Center dot
  c.fillStyle='rgba(255,255,255,0.4)';
  c.beginPath(); c.arc(0,0,2.5,0,Math.PI*2); c.fill();
  c.restore();

  // "N" label (fixed, always at top)
  c.fillStyle='#22c55e';
  c.font='bold 9px "JetBrains Mono",monospace'; c.textAlign='center';
  c.fillText('N', cx, 13);

  // Ring border
  c.strokeStyle='rgba(255,255,255,0.10)'; c.lineWidth=1.5;
  c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke();
}

// ── Helpers ───────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
function _pad(n){ return String(n).padStart(2,'0'); }
function _missionText(){
  var m=['Их тойруу руу хүрнэ үү','Чингисийн гудамж руу явна уу',
         'Бага тойруу руу очно уу','Нарны зам руу явна уу',
         'Сүхбаатарын талбайд очно уу','Спорт Ордонд очно уу'];
  return m[Math.floor(Math.random()*m.length)];
}
