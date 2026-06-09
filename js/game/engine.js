'use strict';
// ═══════════════════════════════════════════════════════════════
//  ENGINE.JS — Тоглоомын гол loop, camera, input, collision
//  LOADED LAST — all other modules already defined
// ═══════════════════════════════════════════════════════════════

// ── Global game state (accessible to all modules) ─────────────
var G = {
  mode: 'menu',
  player: null,
  aiCars: [], peds: [], police: [], lights: [],
  particles: [], alerts: [], violationLog: [],
  wantedLevel: 0,
  money: 500000,
  score: 100,
  speedLimit: 60,
  time: 8 * 60,      // game minutes
  frame: 0,
  paused: false,
  running: false,
  _flash: 0,
  _pendingFine: 0,
  _wantedDecay: 0,
  _currentRoad: '',
};

// ── Input ─────────────────────────────────────────────────────
var gKeys = {};
window.gKeys = gKeys; // expose for mobile inline handlers

document.addEventListener('keydown', function(e) {
  gKeys[e.key] = true;
  if (e.key==='Escape' && G.running) togglePause();
  if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && G.running)
    e.preventDefault();
});
document.addEventListener('keyup', function(e) { delete gKeys[e.key]; });

// ── Canvas ────────────────────────────────────────────────────
var gc, gctx, GCW, GCH, mmCanvas, mmCtx;

function initCanvas() {
  gc = document.getElementById('game-canvas');
  GCW = window.innerWidth; GCH = window.innerHeight;
  gc.width = GCW; gc.height = GCH;
  gctx = gc.getContext('2d');

  mmCanvas = document.getElementById('mm-canvas');
  if (mmCanvas) mmCtx = mmCanvas.getContext('2d');

  window.addEventListener('resize', function() {
    GCW=window.innerWidth; GCH=window.innerHeight;
    gc.width=GCW; gc.height=GCH;
  });
}

// ── Camera ────────────────────────────────────────────────────
var cam = {
  x:0, y:0, tx:0, ty:0,
  zoom:1.35, tz:1.35,
  update: function(px, py, angle) {
    var la = 35;
    var lx = px + Math.cos(angle)*la;
    var ly = py + Math.sin(angle)*la;

    this.tx = lx - GCW/(2*this.zoom);
    // OBL: y is compressed so we need to see more world in y direction
    this.ty = ly - GCH/(2*this.zoom*OBL);
    this.tx = Math.max(0, Math.min(WORLD.W - GCW/this.zoom, this.tx));
    this.ty = Math.max(0, Math.min(WORLD.H - GCH/(this.zoom*OBL), this.ty));

    this.x  += (this.tx - this.x) * 0.12;
    this.y  += (this.ty - this.y) * 0.12;
    this.zoom += (this.tz - this.zoom) * 0.07;
  },
  toScreen: function(wx, wy) {
    return [(wx-this.x)*this.zoom, (wy-this.y)*this.zoom*OBL];
  },
};

// ── Particle system ───────────────────────────────────────────
function addParticles(x, y, count, color) {
  for (var i=0; i<count; i++) {
    var a=Math.random()*Math.PI*2;
    var s=1+Math.random()*4;
    G.particles.push({
      x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
      r:3+Math.random()*4, life:30+Math.random()*30, max:60, color:color,
    });
  }
}

// ── Update ────────────────────────────────────────────────────
function gameUpdate() {
  if (G.paused || !G.running) return;
  G.frame++;

  // Player
  G.player.update();

  // Traffic lights
  G.lights.forEach(function(l){ l.update(); });

  // AI cars
  G.aiCars.forEach(function(ai){ ai.update(G.lights, G.player, G.aiCars); });

  // Pedestrians
  G.peds.forEach(function(p){ p.update(G.player); });

  // Police
  G.police.forEach(function(pc){ pc.update(G.player); });

  // Particles
  G.particles = G.particles.filter(function(p){
    p.x+=p.vx; p.y+=p.vy; p.vx*=0.92; p.vy*=0.92;
    return --p.life>0;
  });

  // Violations (every 8 frames)
  if (G.frame%8===0) checkViolations();

  // Wanted decay
  updateWantedDecay();

  // Game time (1 real sec ≈ 1 game min)
  G.time += 1/60 * 0.9;
  if (G.time>=24*60) G.time=0;

  // Camera
  cam.update(G.player.x, G.player.y, G.player.angle);

  // HUD
  updateHUD();
}

// ── Main loop ─────────────────────────────────────────────────
var _raf;
function _loop() {
  gameUpdate();
  render();
  drawAlerts(gctx);
  drawMinimap();
  drawCompass();
  _raf = requestAnimationFrame(_loop);
}

// ── Init on DOM ready ─────────────────────────────────────────
window.addEventListener('load', function() {
  initCanvas();

  // Zoom in/out with mouse wheel
  window.addEventListener('wheel', function(e) {
    if (!G.running) return;
    e.preventDefault();
    var delta = e.deltaY > 0 ? -0.08 : 0.08;
    cam.tz = Math.max(0.8, Math.min(2.5, cam.tz + delta));
  }, { passive: false });
});
