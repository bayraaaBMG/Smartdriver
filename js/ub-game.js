'use strict';
// ═══════════════════════════════════════════════════════════════
//  SmartDriver UB — Open World Driving Simulator
//  Улаанбаатар хотод суурилсан жолоодлогын тоглоом
// ═══════════════════════════════════════════════════════════════

// ── World constants ───────────────────────────────────────────
const GW = 6000, GH = 4000;
const LW = 26; // single lane width (px)

// ── Road network  [x|y start, center, end|length, width, lanes/dir, speedLimit, name]
// Horizontal: [xStart, yCen, xEnd, totalW, lpd, spd, name]
const H_ROADS = [
  [   0,  480, GW, 104, 2, 40, 'Хойд бага тойруу'],
  [   0, 1100, GW, 104, 2, 50, 'Чингисийн өргөн чөлөө'],
  [   0, 1950, GW, 156, 3, 60, 'Энхтайваны өргөн чөлөө'],
  [   0, 2850, GW, 104, 2, 40, 'Өмнөд холбогч зам'],
];
// Vertical: [xCen, yStart, yEnd, totalW, lpd, spd, name]
const V_ROADS = [
  [ 550,   0, GH,  80, 2, 40, 'Баруун тойруу'],
  [1300,   0, GH,  80, 2, 50, 'Бага тойруугийн гудамж'],
  [2100,   0, GH, 104, 2, 60, 'Чингисийн гудамж'],
  [2950,   0, GH, 104, 2, 60, 'Их тойруу'],
  [3800,   0, GH,  80, 2, 50, 'Нарны зам'],
  [4700,   0, GH,  80, 2, 40, 'Зүүн тойруу'],
];

// ── Car colors palette ────────────────────────────────────────
const CAR_COLORS = [
  '#c0392b','#2980b9','#27ae60','#8e44ad','#f39c12',
  '#16a085','#2c3e50','#e74c3c','#1abc9c','#d35400',
  '#95a5a6','#2ecc71','#3498db','#9b59b6','#e67e22',
];

// ── Global game state ─────────────────────────────────────────
let G = {
  mode: 'menu',
  player: null,
  aiCars: [],
  peds: [],
  police: [],
  lights: [],
  particles: [],
  violationLog: [],
  alerts: [],
  wantedLevel: 0,
  money: 500000,
  score: 100,
  time: 8 * 60,
  speedLimit: 60,
  frame: 0,
  paused: false,
  running: false,
  _flash: 0,
  _pendingFine: 0,
  _wantedDecayTimer: 0,
};

// World-space arrays (built once)
let wRoads = [];        // processed road rects
let wInters = [];       // intersections
let wBuildings = [];    // building footprints
let wTrees = [];        // {x,y,r,col}

// ── Canvas / context ──────────────────────────────────────────
let gc, gctx, GCW, GCH;
let mmCanvas, mmCtx;

function initGameCanvas() {
  gc = document.getElementById('game-canvas');
  GCW = window.innerWidth;
  GCH = window.innerHeight;
  gc.width  = GCW;
  gc.height = GCH;
  gctx = gc.getContext('2d');

  mmCanvas = document.getElementById('mm-canvas');
  if (mmCanvas) mmCtx = mmCanvas.getContext('2d');

  window.addEventListener('resize', () => {
    GCW = window.innerWidth; GCH = window.innerHeight;
    gc.width = GCW; gc.height = GCH;
  });
}

// ── Camera ────────────────────────────────────────────────────
const cam = {
  x: 0, y: 0, tx: 0, ty: 0,
  zoom: 1.3, tz: 1.3,
  update(px, py) {
    const z = this.zoom;
    this.tx = px - GCW / (2 * z);
    this.ty = py - GCH / (2 * z);
    this.tx = Math.max(0, Math.min(GW - GCW/z, this.tx));
    this.ty = Math.max(0, Math.min(GH - GCH/z, this.ty));
    this.x  += (this.tx - this.x) * 0.13;
    this.y  += (this.ty - this.y) * 0.13;
    this.zoom += (this.tz - this.zoom) * 0.07;
  },
  toScreen(wx, wy) {
    return [(wx - this.x) * this.zoom, (wy - this.y) * this.zoom];
  },
};

// ── Input ─────────────────────────────────────────────────────
const gKeys = {};
window.gKeys = gKeys; // expose for inline mobile buttons

document.addEventListener('keydown', e => {
  gKeys[e.key] = true;
  if (e.key === 'Escape' && G.running) togglePause();
  if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && G.running)
    e.preventDefault();
});
document.addEventListener('keyup', e => { delete gKeys[e.key]; });

// ── Traffic Light ─────────────────────────────────────────────
class TrafficLight {
  constructor(x, y, hw, vw, offset = 0) {
    this.x = x; this.y = y;
    this.hw = hw; // horizontal road half-width at this intersection
    this.vw = vw; // vertical road half-width at this intersection
    this.t = offset;
    this.nsGreen = 200;
    this.ewGreen = 200;
    this.yellow  = 35;
    this.cycle   = this.nsGreen + this.yellow + this.ewGreen + this.yellow;
    this._lastPenalizeFrame = { ns: -9999, ew: -9999 };
  }
  update() { this.t = (this.t + 1) % this.cycle; }
  get nsState() {
    const p = this.t;
    if (p < this.nsGreen) return 'green';
    if (p < this.nsGreen + this.yellow) return 'yellow';
    return 'red';
  }
  get ewState() {
    const p = this.t;
    if (p < this.nsGreen + this.yellow) return 'red';
    if (p < this.nsGreen + this.yellow + this.ewGreen) return 'green';
    if (p < this.cycle) return 'yellow';
    return 'red';
  }
  // Returns state for a car traveling at given angle
  stateForAngle(angle) {
    const a = ((angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    const isNS = (a > Math.PI*0.35 && a < Math.PI*0.65) ||
                 (a > Math.PI*1.35 && a < Math.PI*1.65);
    return isNS ? this.nsState : this.ewState;
  }
}

// ── Player Car ────────────────────────────────────────────────
class PlayerCar {
  constructor(x, y, angle = 0) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.maxSpeed = 10;
    this.accel = 0.24;
    this.brake = 0.38;
    this.friction = 0.054;
    this.steerMax = 0.063;
    this.w = 22; this.h = 38;
    this.kmh = 0;
    this.gear = 'N';
    this.braking = false;
    this.crashed = false;
    this.crashTimer = 0;
    this.horn = false;
    this.trail = [];
  }

  update() {
    if (this.crashTimer > 0) {
      this.crashTimer--;
      this.speed *= 0.88;
      if (this.crashTimer <= 0) this.crashed = false;
    }

    const up = gKeys['ArrowUp']    || gKeys['w'] || gKeys['W'];
    const dn = gKeys['ArrowDown']  || gKeys['s'] || gKeys['S'];
    const lt = gKeys['ArrowLeft']  || gKeys['a'] || gKeys['A'];
    const rt = gKeys['ArrowRight'] || gKeys['d'] || gKeys['D'];
    this.horn = !!(gKeys['h'] || gKeys['H']);

    if (!this.crashed) {
      if (up)      this.speed = Math.min(this.maxSpeed,  this.speed + this.accel);
      else if (dn) this.speed = Math.max(-this.maxSpeed * 0.35, this.speed - this.brake);
      else         this.speed *= (1 - this.friction);
    }
    if (Math.abs(this.speed) < 0.02) this.speed = 0;

    const steer = this.steerMax * Math.min(1, Math.abs(this.speed) / 2.5);
    if (!this.crashed) {
      if (lt) this.angle -= steer;
      if (rt) this.angle += steer;
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.x = Math.max(20, Math.min(GW-20, this.x));
    this.y = Math.max(20, Math.min(GH-20, this.y));

    this.kmh = Math.round(Math.abs(this.speed) * 18.5);
    this.braking = dn && this.speed > 0.4;
    const g = this.kmh;
    this.gear = g < 3 ? 'N' : g < 20 ? '1' : g < 40 ? '2' : g < 70 ? '3' : g < 100 ? '4' : '5';

    // Tire trail when braking
    if (this.braking && G.frame % 2 === 0) {
      this.trail.push({
        x: this.x - Math.cos(this.angle)*20,
        y: this.y - Math.sin(this.angle)*20,
        life: 40, max: 40
      });
    }
    this.trail = this.trail.filter(t => --t.life > 0);
  }
}

// ── AI Car ────────────────────────────────────────────────────
class AICar {
  constructor(road, dir, laneIdx, progress) {
    this.road = road;
    this.dir  = dir;   // 1 = forward, -1 = backward
    this.laneIdx = laneIdx;
    this.progress = progress; // 0..1 along road
    this.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    this.speed = 0;
    const ts = 1.5 + Math.random() * 1.8;
    this.targetSpeed = ts * dir;
    this.w = 19; this.h = 33;
    this.active = true;
    this.waiting = false;
    this._calcPos();
  }

  _calcPos() {
    const r = this.road;
    const lpd = r.lpd;
    const lw  = (r.horiz ? r.h : r.w) / (lpd * 2);
    if (r.horiz) {
      const laneY = r.yCen + this.dir * (this.laneIdx + 0.5) * lw;
      this.x = r.x0 + this.progress * r.len;
      this.y = laneY;
      this.angle = this.dir > 0 ? 0 : Math.PI;
    } else {
      const laneX = r.xCen + this.dir * (this.laneIdx + 0.5) * lw;
      this.x = laneX;
      this.y = r.y0 + this.progress * r.len;
      this.angle = this.dir > 0 ? Math.PI/2 : -Math.PI/2;
    }
  }

  update(lights, player) {
    if (!this.active) return;

    let stop = false;

    // Red light check
    for (const l of lights) {
      const d = Math.hypot(this.x - l.x, this.y - l.y);
      if (d < 110 && d > 15) {
        const ahead =
          Math.cos(this.angle) * (l.x - this.x) +
          Math.sin(this.angle) * (l.y - this.y);
        if (ahead > 0 && ahead < 90 && l.stateForAngle(this.angle) === 'red') {
          stop = true; break;
        }
      }
    }

    // Player in front avoidance
    if (!stop) {
      const dp = Math.hypot(this.x - player.x, this.y - player.y);
      if (dp < 55) {
        const ahead =
          Math.cos(this.angle) * (player.x - this.x) +
          Math.sin(this.angle) * (player.y - this.y);
        if (ahead > 0 && ahead < 60) stop = true;
      }
    }

    // Decelerate/accelerate
    if (stop) {
      this.speed *= 0.84;
      this.waiting = true;
    } else {
      const ts = Math.abs(this.targetSpeed);
      const s  = Math.abs(this.speed);
      if (s < ts) this.speed += 0.07 * Math.sign(this.targetSpeed);
      this.waiting = false;
    }
    if (Math.abs(this.speed) < 0.01) this.speed = 0;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Recycle car when off world
    if (this.road.horiz) {
      if (this.dir > 0 && this.x > GW + 150) { this.x = -100; this.progress = 0; }
      if (this.dir < 0 && this.x < -150)     { this.x = GW + 100; this.progress = 1; }
    } else {
      if (this.dir > 0 && this.y > GH + 150) { this.y = -100; this.progress = 0; }
      if (this.dir < 0 && this.y < -150)     { this.y = GH + 100; this.progress = 1; }
    }
  }
}

// ── Police Car ────────────────────────────────────────────────
class PoliceCar {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.maxSpeed = 7.5;
    this.state = 'patrol';
    this.w = 22; this.h = 38;
    this._lp = 0; // light phase
    this._pt = 0; // patrol timer
    this._patrolTarget = { x: x + (Math.random()-0.5)*600, y: y + (Math.random()-0.5)*600 };
  }

  update(player) {
    this._lp = (this._lp + 1) % 40;

    if (G.wantedLevel === 0) {
      this.state = 'patrol';
      this._patrol();
      return;
    }

    this.state = 'chase';
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const ta = Math.atan2(dy, dx);

    let da = ta - this.angle;
    while (da >  Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    this.angle += da * 0.09;

    const cs = G.wantedLevel >= 2 ? this.maxSpeed : this.maxSpeed * 0.75;
    if (this.speed < cs) this.speed += 0.18;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.x = Math.max(20, Math.min(GW-20, this.x));
    this.y = Math.max(20, Math.min(GH-20, this.y));

    if (dist < 35) {
      this.speed = 0;
      this.state = 'block';
      if (G.wantedLevel > 0) triggerArrest();
    }
  }

  _patrol() {
    const dx = this._patrolTarget.x - this.x;
    const dy = this._patrolTarget.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30 || ++this._pt > 300) {
      this._patrolTarget = {
        x: 200 + Math.random() * (GW - 400),
        y: 200 + Math.random() * (GH - 400),
      };
      this._pt = 0;
    }
    const ta = Math.atan2(dy, dx);
    let da = ta - this.angle;
    while (da >  Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    this.angle += da * 0.06;
    if (this.speed < 2.5) this.speed += 0.08;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.x = Math.max(20, Math.min(GW-20, this.x));
    this.y = Math.max(20, Math.min(GH-20, this.y));
  }
}

// ── Pedestrian ────────────────────────────────────────────────
class Pedestrian {
  constructor(crossX, startY, endY, nearLight) {
    this.crossX = crossX;
    this.x = crossX + (Math.random() - 0.5) * 18;
    this.y = startY;
    this.startY = startY;
    this.endY   = endY;
    this.nearLight = nearLight; // TrafficLight reference
    this.state = 'waiting';
    this.waitTimer = Math.floor(Math.random() * 400 + 60);
    this.speed = 0.45 + Math.random() * 0.3;
    this.penalized = false;
    this.scared = false;
    const skins = ['#f5cba7','#e8b89a','#d4956a','#c07840','#a0522d'];
    this.skin = skins[Math.floor(Math.random() * skins.length)];
    this.shirt = `hsl(${Math.floor(Math.random()*360)},50%,45%)`;
  }

  update(player) {
    // React to player
    const dp = Math.hypot(player.x - this.x, player.y - this.y);
    if (dp < 70 && this.state === 'crossing') {
      this.scared = true;
      this.state  = 'waiting';
      this.waitTimer = 120;
      return;
    }
    this.scared = false;

    const canCross = !this.nearLight ||
      this.nearLight.nsState === 'red'; // peds cross when NS road is red (EW cars stopped)

    if (this.state === 'waiting') {
      if (--this.waitTimer <= 0 && canCross) this.state = 'crossing';
    } else if (this.state === 'crossing') {
      const dy = this.endY - this.y;
      if (Math.abs(dy) < 1) {
        this.state = 'done';
        setTimeout(() => {
          [this.startY, this.endY] = [this.endY, this.startY];
          this.y = this.startY;
          this.state = 'waiting';
          this.waitTimer = Math.floor(200 + Math.random() * 500);
          this.penalized = false;
        }, 1500 + Math.random() * 2000);
        return;
      }
      this.y += Math.sign(dy) * this.speed;
    }
  }
}

// ── World generation ──────────────────────────────────────────
function buildWorld() {
  wRoads = []; wInters = []; wBuildings = []; wTrees = [];
  G.lights = []; G.aiCars = []; G.peds = []; G.police = [];

  // Build horizontal road rects
  H_ROADS.forEach(([xs, yc, xe, w, lpd, spd, name]) => {
    wRoads.push({ horiz:true, x0:xs, y0:yc-w/2, len:xe-xs, w, h:w, yCen:yc, lpd, spd, name });
  });
  // Build vertical road rects
  V_ROADS.forEach(([xc, ys, ye, w, lpd, spd, name]) => {
    wRoads.push({ horiz:false, x0:xc-w/2, y0:ys, len:ye-ys, w, h:ye-ys, xCen:xc, lpd, spd, name });
  });

  // Intersections & traffic lights
  let phaseOff = 0;
  H_ROADS.forEach(([hxs,,hxe,hw]) => {
    V_ROADS.forEach(([vxc,vys,vye,vw]) => {
      if (vxc > hxs && vxc < hxe) {
        const yCen = H_ROADS.find(r => r[0]===hxs)?.[1] ??
                     wRoads.find(r => r.horiz && r.x0===hxs)?.yCen ?? 0;
        wInters.push({ x: vxc, y: yCen, hw: hw/2, vw: vw/2 });
        G.lights.push(new TrafficLight(vxc, yCen, hw/2, vw/2, phaseOff));
        phaseOff = (phaseOff + 87) % 434;
      }
    });
  });
  // Fix yCen using the matched H_ROAD
  wInters.forEach((inter, i) => {
    const hr = wRoads.find(r => r.horiz && Math.abs(r.yCen - inter.y) < 10);
    if (hr) { inter.y = hr.yCen; G.lights[i].y = hr.yCen; }
  });

  _genBuildings();
  _genTrees();
  _spawnAI();
  _spawnPeds();

  // Player starts on Peace Avenue, eastbound, left side of map
  const peace = wRoads.find(r => r.horiz && r.name === 'Энхтайваны өргөн чөлөө');
  const py = peace ? peace.yCen + peace.h / 4 : GH / 2;
  G.player = new PlayerCar(350, py, 0);
  cam.x = 350 - GCW / (2 * cam.zoom);
  cam.y = py  - GCH / (2 * cam.zoom);
}

function _genBuildings() {
  // Collect boundary x/y lines
  const xs = [0,
    ...V_ROADS.map(([xc,,,w]) => xc - w/2),
    ...V_ROADS.map(([xc,,,w]) => xc + w/2),
    GW].sort((a,b) => a-b);
  const ys = [0,
    ...H_ROADS.map(([,yc,,w]) => yc - w/2),
    ...H_ROADS.map(([,yc,,w]) => yc + w/2),
    GH].sort((a,b) => a-b);

  const palettes = [
    '#7a6e62','#8a7e72','#6e6460','#7a7868','#8a8878',
    '#6e6c60','#68706a','#7a6468','#8a7c70','#6a6a60',
  ];
  const rng = (seed, max) => { // deterministic pseudo-random
    const s = Math.sin(seed * 9301 + 49297) * 233280;
    return Math.abs(s - Math.floor(s)) * max;
  };

  let bid = 0;
  for (let xi = 0; xi < xs.length-1; xi++) {
    for (let yi = 0; yi < ys.length-1; yi++) {
      const bx = xs[xi], bx2 = xs[xi+1];
      const by = ys[yi], by2 = ys[yi+1];
      const bw = bx2 - bx, bh = by2 - by;
      if (bw < 100 || bh < 80) continue; // skip road-width gaps

      const mg = 10;
      const blkX = bx+mg, blkY = by+mg, blkW = bw-mg*2, blkH = bh-mg*2;

      // Subdivide block into buildings
      const nx = Math.max(1, Math.floor(blkW / (60 + rng(bid, 50))));
      const ny = Math.max(1, Math.floor(blkH / (50 + rng(bid+1, 40))));
      const bwu = blkW / nx, bhu = blkH / ny;
      const gap = 5;

      for (let i=0; i<nx; i++) {
        for (let j=0; j<ny; j++) {
          const bld = {
            x: blkX + i*bwu + gap,
            y: blkY + j*bhu + gap,
            w: bwu - gap*2,
            h: bhu - gap*2,
            col: palettes[Math.floor(rng(bid*13+i*7+j, palettes.length))],
            roof: palettes[Math.floor(rng(bid*17+i*11+j, palettes.length))],
          };
          if (bld.w > 12 && bld.h > 12) wBuildings.push(bld);
          bid++;
        }
      }
    }
  }
}

function _isInterArea(x, y) {
  return wInters.some(n => Math.abs(x-n.x) < n.vw*1.1 && Math.abs(y-n.y) < n.hw*1.1);
}

function _genTrees() {
  const sin = Math.sin, cos = Math.cos;
  const cols = [
    {a:'#3d6a28',b:'#1e4a14'},
    {a:'#426c26',b:'#1c5012'},
    {a:'#38622a',b:'#1c4a10'},
  ];

  wRoads.forEach((r, ri) => {
    if (r.horiz) {
      for (let x = 30; x < r.len; x += 40 + sin(x*0.12)*4) {
        const bx = r.x0 + x;
        const r1 = 8 + sin(x*0.17 + ri) * 2;
        // North edge
        if (!_isInterArea(bx, r.y0 - 14)) {
          const c = cols[(ri + Math.floor(x/80)) % cols.length];
          wTrees.push({ x:bx, y:r.y0 - 14, r:r1, ...c });
        }
        // South edge
        if (!_isInterArea(bx, r.y0 + r.h + 14)) {
          const c = cols[(ri + Math.floor(x/80) + 1) % cols.length];
          wTrees.push({ x:bx, y:r.y0 + r.h + 14, r:r1+1, ...c });
        }
        // Median for 3-lane roads
        if (r.lpd >= 3 && !_isInterArea(bx, r.yCen)) {
          wTrees.push({ x:bx, y:r.yCen, r:r1+2, ...cols[1] });
        }
      }
    } else {
      for (let y = 30; y < r.len; y += 40 + cos(y*0.12)*4) {
        const by = r.y0 + y;
        const r1 = 8 + cos(y*0.15 + ri) * 2;
        if (!_isInterArea(r.x0 - 14, by)) {
          const c = cols[(ri + Math.floor(y/80)) % cols.length];
          wTrees.push({ x:r.x0 - 14, y:by, r:r1, ...c });
        }
        if (!_isInterArea(r.x0 + r.w + 14, by)) {
          const c = cols[(ri + Math.floor(y/80) + 1) % cols.length];
          wTrees.push({ x:r.x0 + r.w + 14, y:by, r:r1+1, ...c });
        }
      }
    }
  });
}

function _spawnAI() {
  wRoads.forEach(road => {
    const perDir = Math.max(2, Math.floor(road.len / 450));
    for (let d of [1, -1]) {
      for (let k = 0; k < perDir; k++) {
        const laneIdx = Math.floor(Math.random() * road.lpd);
        const progress = Math.random();
        G.aiCars.push(new AICar(road, d, laneIdx, progress));
      }
    }
  });
}

function _spawnPeds() {
  wInters.forEach(inter => {
    const l = G.lights.find(lg => Math.hypot(lg.x-inter.x, lg.y-inter.y) < 15);
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const startY = inter.y + side * (inter.hw + 18 + Math.random() * 10);
      const endY   = inter.y - side * (inter.hw + 18 + Math.random() * 10);
      const cx = inter.x + (Math.random() - 0.5) * inter.vw * 0.9;
      G.peds.push(new Pedestrian(cx, startY, endY, l));
    }
  });
}

// ── Violations ────────────────────────────────────────────────
const VIOL = {
  RED_LIGHT:      { fine: 50000, want: 1, label: '🚦 Улаан гэрэл зөрчлөө' },
  SPEEDING_MILD:  { fine: 30000, want: 0, label: '⚡ Хурдны хязгаар зөрчлөө' },
  SPEEDING_HEAVY: { fine: 80000, want: 1, label: '🏎️ Хурд ноцтой хэтэрлэлт!' },
  HIT_PED:        { fine:200000, want: 2, label: '🚶 Явган хүн мөргөлдлөө!' },
  HIT_CAR:        { fine:100000, want: 1, label: '💥 Машин мөргөлдлөө!' },
  WRONG_WAY:      { fine: 40000, want: 1, label: '⬅️ Эсрэг урсгалд орлоо!' },
};

const _vCooldown = {};

function addViolation(type) {
  const now = G.frame;
  if (_vCooldown[type] && now - _vCooldown[type] < 240) return;
  _vCooldown[type] = now;

  const v = VIOL[type];
  G.money = Math.max(0, G.money - v.fine);
  G.score = Math.max(0, G.score - Math.ceil(v.fine / 5000));
  G.wantedLevel = Math.min(3, G.wantedLevel + v.want);
  G._pendingFine += v.fine;
  G._wantedDecayTimer = 0;

  G.violationLog.unshift({ label: v.label, fine: v.fine });
  if (G.violationLog.length > 4) G.violationLog.pop();

  G._flash = 0.5;
  pushAlert(v.label, `-₮${v.fine.toLocaleString()}`, '#ef4444');

  if (G.wantedLevel >= 1 && G.police.length < G.wantedLevel) {
    spawnPolice();
  }
}

function spawnPolice() {
  const a = Math.random() * Math.PI * 2;
  const d = 500 + Math.random() * 300;
  const px = Math.max(50, Math.min(GW-50, G.player.x + Math.cos(a)*d));
  const py = Math.max(50, Math.min(GH-50, G.player.y + Math.sin(a)*d));
  G.police.push(new PoliceCar(px, py));
}

let _arrestTriggered = false;
function triggerArrest() {
  if (_arrestTriggered) return;
  _arrestTriggered = true;
  G.player.speed = 0;
  G.player.crashed = true;
  G.player.crashTimer = 200;
  const fine = G._pendingFine;
  setTimeout(() => {
    const dlg = document.getElementById('game-police-dialog');
    const fineEl = document.getElementById('gpd-fine');
    if (dlg && fineEl) {
      fineEl.textContent = `₮${fine.toLocaleString()}`;
      dlg.style.display = 'flex';
    }
    G.wantedLevel = 0;
    G.police = [];
    G._wantedDecayTimer = 0;
    _arrestTriggered = false;
  }, 600);
}

function checkViolations() {
  const p = G.player;
  if (p.crashed) return;

  // Traffic lights
  G.lights.forEach(l => {
    const d = Math.hypot(p.x - l.x, p.y - l.y);
    if (d > 15 && d < 100 && p.kmh > 5) {
      const ahead =
        Math.cos(p.angle) * (l.x - p.x) +
        Math.sin(p.angle) * (l.y - p.y);
      if (ahead > 0 && ahead < 80 && l.stateForAngle(p.angle) === 'red') {
        addViolation('RED_LIGHT');
      }
    }
  });

  // Speed
  if (p.kmh > G.speedLimit + 35) addViolation('SPEEDING_HEAVY');
  else if (p.kmh > G.speedLimit + 15) addViolation('SPEEDING_MILD');

  // Pedestrian collision
  G.peds.forEach(ped => {
    if (ped.state !== 'crossing' || ped.penalized) return;
    if (Math.hypot(p.x - ped.x, p.y - ped.y) < 22) {
      ped.penalized = true;
      ped.state = 'waiting';
      ped.waitTimer = 200;
      p.crashed = true;
      p.crashTimer = 100;
      G._flash = 0.7;
      addViolation('HIT_PED');
      addParticles(p.x, p.y, 10, '#ef4444');
      setTimeout(() => { ped.penalized = false; }, 8000);
    }
  });

  // AI car collision
  G.aiCars.forEach(ai => {
    if (!ai.active) return;
    if (Math.hypot(p.x - ai.x, p.y - ai.y) < 24) {
      p.crashed = true; p.crashTimer = 80;
      ai.active = false;
      setTimeout(() => { ai.active = true; }, 4000);
      addViolation('HIT_CAR');
      addParticles(p.x, p.y, 14, '#fbbf24');
    }
  });

  // Wrong-way detection
  const onHoriz = wRoads.find(r => r.horiz && p.y >= r.y0 && p.y <= r.y0+r.h);
  if (onHoriz) {
    G.speedLimit = onHoriz.spd;
    const a = ((p.angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    const goingEast = a < Math.PI/2 || a > Math.PI*1.5;
    const inEastLane = p.y > onHoriz.yCen; // south half = eastbound (right-hand traffic)
    if (p.kmh > 8 && goingEast !== inEastLane) addViolation('WRONG_WAY');
  } else {
    const onVert = wRoads.find(r => !r.horiz && p.x >= r.x0 && p.x <= r.x0+r.w);
    if (onVert) G.speedLimit = onVert.spd;
  }
}

// ── Particles ─────────────────────────────────────────────────
function addParticles(x, y, count, color) {
  for (let i=0; i<count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 4;
    G.particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      r: 3+Math.random()*4, life: 35+Math.random()*25, max: 60, color
    });
  }
}

// ── Alert queue ───────────────────────────────────────────────
function pushAlert(title, sub, color = '#ff6a00') {
  G.alerts.unshift({ title, sub, color, timer: 200 });
  if (G.alerts.length > 3) G.alerts.length = 3;
}

// ── UPDATE LOOP ───────────────────────────────────────────────
function gameUpdate() {
  if (G.paused || !G.running) return;
  G.frame++;

  G.player.update();
  G.lights.forEach(l => l.update());
  G.aiCars.forEach(ai => ai.update(G.lights, G.player));
  G.peds.forEach(p => p.update(G.player));
  G.police.forEach(pc => pc.update(G.player));

  // Particles
  G.particles = G.particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.93; p.vy *= 0.93;
    return --p.life > 0;
  });

  // Violations
  if (G.frame % 8 === 0) checkViolations();

  // Wanted level decay
  if (G.wantedLevel > 0) {
    G._wantedDecayTimer++;
    if (G._wantedDecayTimer > 900) { // 15 sec without new violation
      G.wantedLevel = Math.max(0, G.wantedLevel - 1);
      G._wantedDecayTimer = 0;
      if (G.wantedLevel === 0) { G.police = []; G._pendingFine = 0; }
    }
  }

  // Game time
  G.time += 1/60 * 0.8; // ~1 game min per real sec
  if (G.time >= 24*60) G.time = 0;

  // Cam
  cam.update(G.player.x, G.player.y);

  updateHUD();
}

// ── RENDERING ─────────────────────────────────────────────────
function render() {
  const c = gctx;
  c.clearRect(0, 0, GCW, GCH);

  c.save();
  c.scale(cam.zoom, cam.zoom);
  c.translate(-cam.x, -cam.y);

  _drawGround(c);
  _drawBuildings(c);
  _drawRoads(c);
  _drawMarkings(c);
  _drawCrosswalks(c);
  _drawTrees(c);
  _drawTrafficLights(c);
  _drawPeds(c);
  _drawAICars(c);
  _drawPolice(c);
  _drawPlayerTrail(c);
  _drawPlayer(c);
  _drawParticles(c);

  c.restore();

  // Screen-space effects
  if (G._flash > 0.01) {
    c.fillStyle = `rgba(239,68,68,${G._flash})`;
    c.fillRect(0, 0, GCW, GCH);
    G._flash *= 0.86;
  }

  _drawAlerts(c);
  _drawMinimap();
}

function _drawGround(c) {
  c.fillStyle = '#5c5246';
  c.fillRect(0, 0, GW, GH);
  // Subtle texture
  c.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x=0; x<GW; x+=90) {
    for (let y=0; y<GH; y+=90) {
      if (((x/90|0)+(y/90|0)) % 2 === 0) c.fillRect(x, y, 90, 90);
    }
  }
}

function _drawBuildings(c) {
  wBuildings.forEach(b => {
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(b.x+4, b.y+4, b.w, b.h);
    c.fillStyle = b.col;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 1;
    c.strokeRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = 'rgba(255,255,255,0.07)';
    c.lineWidth = 1.5;
    c.strokeRect(b.x+2, b.y+2, b.w-4, b.h-4);
    if (b.w > 40 && b.h > 30) {
      c.fillStyle = 'rgba(0,0,0,0.1)';
      c.fillRect(b.x+b.w/2-7, b.y+b.h/2-5, 14, 10);
    }
  });
}

function _drawRoads(c) {
  // Sidewalks
  const SW = 14;
  c.fillStyle = '#8a7d68';
  wRoads.forEach(r => {
    if (r.horiz) {
      c.fillRect(r.x0, r.y0-SW, r.len, SW);
      c.fillRect(r.x0, r.y0+r.h, r.len, SW);
    } else {
      c.fillRect(r.x0-SW, r.y0, SW, r.len);
      c.fillRect(r.x0+r.w, r.y0, SW, r.len);
    }
  });

  // Intersection fill (asphalt box)
  c.fillStyle = '#2c2924';
  wInters.forEach(n => {
    const hr = wRoads.find(r => r.horiz && Math.abs(r.yCen-n.y)<5);
    const vr = wRoads.find(r => !r.horiz && Math.abs(r.xCen-n.x)<5);
    if (hr && vr) {
      c.fillRect(n.x - n.vw, n.y - n.hw, n.vw*2, n.hw*2);
    }
  });

  // Roads
  c.fillStyle = '#2c2924';
  wRoads.forEach(r => {
    if (r.horiz) c.fillRect(r.x0, r.y0, r.len, r.h);
    else         c.fillRect(r.x0, r.y0, r.w, r.len);
  });
}

function _drawMarkings(c) {
  wRoads.forEach(r => {
    const D  = r.horiz ? r.h : r.w;
    const lw = D / (r.lpd * 2);

    // Edge lines
    c.strokeStyle = 'rgba(240,235,210,0.82)';
    c.lineWidth = 2.5; c.setLineDash([]);
    if (r.horiz) {
      _hLine(c, r.x0, r.y0+1.5, r.len);
      _hLine(c, r.x0, r.y0+r.h-1.5, r.len);
    } else {
      _vLine(c, r.x0+1.5, r.y0, r.len);
      _vLine(c, r.x0+r.w-1.5, r.y0, r.len);
    }

    // Center double-yellow
    c.strokeStyle = 'rgba(255,200,30,0.9)';
    c.lineWidth = 2; c.setLineDash([]);
    if (r.horiz) {
      _hLine(c, r.x0, r.yCen-3, r.len);
      _hLine(c, r.x0, r.yCen+3, r.len);
    } else {
      _vLine(c, r.xCen-3, r.y0, r.len);
      _vLine(c, r.xCen+3, r.y0, r.len);
    }

    // Lane dividers (dashed)
    c.strokeStyle = 'rgba(235,228,205,0.5)';
    c.lineWidth = 1.5;
    for (let i=1; i<r.lpd*2; i++) {
      if (i === r.lpd) continue;
      if (r.horiz) {
        const y = r.y0 + lw*i;
        c.setLineDash([20,13]);
        _hLine(c, r.x0, y, r.len);
      } else {
        const x = r.x0 + lw*i;
        c.setLineDash([16,11]);
        _vLine(c, x, r.y0, r.len);
      }
    }
    c.setLineDash([]);

    // Road name
    if (r.horiz && r.len > 500) {
      c.font = 'bold 9px monospace';
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.textAlign = 'left';
      c.fillText(r.name, r.x0+20, r.yCen+3);
    }
  });
}

function _hLine(c, x, y, len) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(x+len, y); c.stroke();
}
function _vLine(c, x, y, len) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y+len); c.stroke();
}

function _drawCrosswalks(c) {
  c.fillStyle = 'rgba(238,232,214,0.7)';
  wInters.forEach(n => {
    const stripe = 7, gap = 6, count = 5;
    // North side (above intersection)
    for (let i=0; i<count; i++) {
      c.fillRect(n.x - n.vw, n.y - n.hw - 3 - i*(stripe+gap), n.vw*2, stripe);
    }
    // South side
    for (let i=0; i<count; i++) {
      c.fillRect(n.x - n.vw, n.y + n.hw + 3 + i*(stripe+gap), n.vw*2, stripe);
    }
    // West side
    for (let i=0; i<count; i++) {
      c.fillRect(n.x - n.hw - 3 - i*(stripe+gap), n.y - n.vw, stripe, n.vw*2);
    }
    // East side
    for (let i=0; i<count; i++) {
      c.fillRect(n.x + n.hw + 3 + i*(stripe+gap), n.y - n.vw, stripe, n.vw*2);
    }
  });
}

function _drawTrees(c) {
  wTrees.forEach(t => {
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(t.x+4, t.y+5, t.r*0.9, t.r*0.7, 0.4, 0, Math.PI*2); c.fill();
    // Canopy
    const g = c.createRadialGradient(t.x-t.r*0.3, t.y-t.r*0.3, 0, t.x, t.y, t.r);
    g.addColorStop(0, t.a);
    g.addColorStop(0.6, t.b);
    g.addColorStop(1, '#0e2a08');
    c.fillStyle = g;
    c.beginPath(); c.arc(t.x, t.y, t.r, 0, Math.PI*2); c.fill();
    // Highlight
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.beginPath(); c.arc(t.x - t.r*0.3, t.y - t.r*0.3, t.r*0.35, 0, Math.PI*2); c.fill();
  });
}

const LC = { red:'#ef4444', yellow:'#fbbf24', green:'#22c55e' };
function _drawTrafficLights(c) {
  G.lights.forEach(l => {
    const hw = l.hw, vw = l.vw;
    // 4 poles at corners of intersection
    const poles = [
      { x: l.x - vw - 12, y: l.y - hw - 12, stateGet: () => l.ewState },
      { x: l.x + vw + 12, y: l.y - hw - 12, stateGet: () => l.ewState },
      { x: l.x - vw - 12, y: l.y + hw + 12, stateGet: () => l.nsState },
      { x: l.x + vw + 12, y: l.y + hw + 12, stateGet: () => l.nsState },
    ];
    poles.forEach(p => {
      const st = p.stateGet();
      // Pole
      c.fillStyle = '#2a2a2a';
      c.fillRect(p.x-2, p.y-38, 4, 38);
      // Box
      c.fillStyle = '#1a1a1a';
      if (typeof c.roundRect === 'function') {
        c.beginPath(); c.roundRect(p.x-7, p.y-52, 14, 38, 3); c.fill();
      } else {
        c.fillRect(p.x-7, p.y-52, 14, 38);
      }
      // Lights
      ['red','yellow','green'].forEach((col, i) => {
        const on = st === col;
        c.beginPath(); c.arc(p.x, p.y-44+i*13, 4.5, 0, Math.PI*2);
        if (on) { c.shadowColor = LC[col]; c.shadowBlur = 14; }
        c.fillStyle = on ? LC[col] : 'rgba(255,255,255,0.05)';
        c.fill(); c.shadowBlur = 0;
      });
    });
  });
}

function _drawPeds(c) {
  G.peds.forEach(p => {
    if (p.state === 'done') return;
    c.save();
    c.translate(p.x, p.y);
    if (p.scared) { c.globalAlpha = 0.6; }
    // Body
    c.fillStyle = p.shirt;
    c.fillRect(-4, -8, 8, 10);
    // Head
    c.fillStyle = p.skin;
    c.beginPath(); c.arc(0, -10, 4, 0, Math.PI*2); c.fill();
    // Walking animation
    if (p.state === 'crossing') {
      const leg = Math.sin(G.frame * 0.25) * 3;
      c.strokeStyle = p.skin; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-2, 2); c.lineTo(-2+leg, 8); c.stroke();
      c.beginPath(); c.moveTo(2, 2); c.lineTo(2-leg, 8); c.stroke();
    }
    c.restore();
  });
}

function _carShape(c, car, w, h, angle, bodyColor, dark) {
  c.save();
  c.translate(car.x, car.y);
  c.rotate(angle);

  const bh = h, bw = w;
  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(-bw/2+3, -bh/2+4, bw, bh);

  // Body gradient
  const bg = c.createLinearGradient(-bw/2, 0, bw/2, 0);
  bg.addColorStop(0, dark);
  bg.addColorStop(0.3, bodyColor);
  bg.addColorStop(0.7, bodyColor);
  bg.addColorStop(1, dark);
  c.fillStyle = bg;
  if (typeof c.roundRect === 'function') {
    c.beginPath(); c.roundRect(-bw/2,-bh/2,bw,bh,3); c.fill();
  } else {
    c.fillRect(-bw/2,-bh/2,bw,bh);
  }

  // Windshield
  c.fillStyle = 'rgba(120,190,255,0.35)';
  c.fillRect(-bw/2+2, -bh/2+4, bw-4, bh*0.28);
  // Rear window
  c.fillStyle = 'rgba(120,190,255,0.2)';
  c.fillRect(-bw/2+2, bh/2-bh*0.22, bw-4, bh*0.18);

  // Outline
  c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1; c.setLineDash([]);
  if (typeof c.roundRect === 'function') {
    c.beginPath(); c.roundRect(-bw/2,-bh/2,bw,bh,3); c.stroke();
  } else {
    c.strokeRect(-bw/2,-bh/2,bw,bh);
  }
  c.restore();
}

function _drawAICars(c) {
  G.aiCars.forEach(ai => {
    if (!ai.active) return;
    const dark = _darken(ai.color, 35);
    _carShape(c, ai, ai.w, ai.h, ai.angle, ai.color, dark);
    // Headlights (front = positive angle direction)
    c.save();
    c.translate(ai.x + Math.cos(ai.angle)*18, ai.y + Math.sin(ai.angle)*18);
    c.fillStyle = 'rgba(255,255,200,0.8)';
    c.beginPath(); c.arc(-5, 0, 2.5, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(5, 0, 2.5, 0, Math.PI*2); c.fill();
    c.restore();
  });
}

function _drawPolice(c) {
  G.police.forEach(pc => {
    const phase = pc._lp;
    // Car body
    _carShape(c, pc, pc.w, pc.h, pc.angle, '#2563eb', '#1a3a9e');

    // White stripe
    c.save();
    c.translate(pc.x, pc.y);
    c.rotate(pc.angle);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(-11, -5, 22, 10);
    c.restore();

    // Siren lights
    c.save();
    c.translate(pc.x, pc.y);
    c.rotate(pc.angle);
    const sirenCol = phase < 20 ? '#ef4444' : '#3b82f6';
    c.fillStyle = sirenCol;
    c.shadowColor = sirenCol; c.shadowBlur = 18;
    c.beginPath(); c.arc(-5, -pc.h/2+4, 4, 0, Math.PI*2); c.fill();
    c.fillStyle = phase < 20 ? '#3b82f6' : '#ef4444';
    c.shadowColor = c.fillStyle;
    c.beginPath(); c.arc(5, -pc.h/2+4, 4, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0;

    // "ЦАГДАА" label
    c.fillStyle = '#fff';
    c.font = 'bold 6px monospace';
    c.textAlign = 'center';
    c.fillText('ЦАГДАА', 0, 3);
    c.restore();
  });
}

function _drawPlayerTrail(c) {
  G.player.trail.forEach(t => {
    c.fillStyle = `rgba(0,0,0,${t.life/t.max*0.45})`;
    c.fillRect(t.x-2, t.y-2, 4, 4);
  });
}

function _drawPlayer(c) {
  const p = G.player;
  // Crash flash
  if (p.crashed && G.frame % 8 < 4) return;

  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.angle);

  const bh = p.h, bw = p.w;
  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.32)';
  c.fillRect(-bw/2+4, -bh/2+5, bw, bh);

  // Orange body gradient
  const bg = c.createLinearGradient(-bw/2, 0, bw/2, 0);
  bg.addColorStop(0, '#cc4400');
  bg.addColorStop(0.25, '#ff6a00');
  bg.addColorStop(0.5, '#ff8c2a');
  bg.addColorStop(0.75, '#ff6a00');
  bg.addColorStop(1, '#cc4400');
  c.fillStyle = bg;
  if (typeof c.roundRect === 'function') {
    c.beginPath(); c.roundRect(-bw/2,-bh/2,bw,bh,4); c.fill();
  } else {
    c.fillRect(-bw/2,-bh/2,bw,bh);
  }

  // Roof
  const rg = c.createLinearGradient(-bw/2+3, -bh*0.1, bw/2-3, -bh*0.1);
  rg.addColorStop(0, 'rgba(0,0,0,0.3)');
  rg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  rg.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = rg;
  c.fillRect(-bw/2+3, -bh*0.2, bw-6, bh*0.38);

  // Windshields
  c.fillStyle = 'rgba(140,210,255,0.4)';
  c.fillRect(-bw/2+2, -bh/2+4, bw-4, bh*0.25);
  c.fillStyle = 'rgba(140,210,255,0.25)';
  c.fillRect(-bw/2+2, bh/2-bh*0.22, bw-4, bh*0.18);

  // Headlights glow
  if (p.speed > 0.3) {
    c.shadowColor = '#ffffaa'; c.shadowBlur = 18;
    c.fillStyle = 'rgba(255,255,200,0.95)';
    c.beginPath(); c.arc(-bw/2+3, -bh/2+3, 3, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(bw/2-3, -bh/2+3, 3, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0;
  }
  // Brake lights
  if (p.braking) {
    c.shadowColor = '#ef4444'; c.shadowBlur = 16;
    c.fillStyle = 'rgba(239,68,68,0.95)';
    c.beginPath(); c.arc(-bw/2+3, bh/2-4, 3, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(bw/2-3, bh/2-4, 3, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0;
  }

  // Outline
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1; c.setLineDash([]);
  if (typeof c.roundRect === 'function') {
    c.beginPath(); c.roundRect(-bw/2,-bh/2,bw,bh,4); c.stroke();
  } else {
    c.strokeRect(-bw/2,-bh/2,bw,bh);
  }

  c.restore();

  // Horn indicator
  if (p.horn) {
    c.font = '14px serif'; c.textAlign = 'center';
    const [sx, sy] = cam.toScreen(p.x, p.y - 40);
    c.fillText('📯', sx/cam.zoom + cam.x - p.x, sy/cam.zoom + cam.y - p.y + p.y - 40);
    // actually draw in world space (already inside save/restore with transform)
    c.save();
    c.translate(p.x, p.y);
    c.rotate(0);
    c.font = '14px serif';
    c.textAlign = 'center';
    c.fillText('📯', 0, -p.h/2 - 10);
    c.restore();
  }
}

function _drawParticles(c) {
  G.particles.forEach(p => {
    c.globalAlpha = p.life / p.max;
    c.fillStyle = p.color;
    c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI*2); c.fill();
  });
  c.globalAlpha = 1;
}

function _drawAlerts(c) {
  G.alerts = G.alerts.filter(a => a.timer-- > 0);
  G.alerts.forEach((a, i) => {
    const alpha = Math.min(1, a.timer / 40);
    c.globalAlpha = alpha;
    const w = 300, h = 52;
    const x = GCW/2 - w/2;
    const y = GCH * 0.28 + i * 60;
    c.fillStyle = 'rgba(10,10,16,0.9)';
    if (typeof c.roundRect === 'function') {
      c.beginPath(); c.roundRect(x, y, w, h, 8); c.fill();
    } else { c.fillRect(x, y, w, h); }
    c.strokeStyle = a.color; c.lineWidth = 1.5; c.setLineDash([]);
    if (typeof c.roundRect === 'function') {
      c.beginPath(); c.roundRect(x, y, w, h, 8); c.stroke();
    } else { c.strokeRect(x, y, w, h); }
    c.fillStyle = a.color;
    c.font = 'bold 13px "JetBrains Mono",monospace';
    c.textAlign = 'center';
    c.fillText(a.title, GCW/2, y+20);
    c.fillStyle = 'rgba(240,238,234,0.6)';
    c.font = '11px "JetBrains Mono",monospace';
    c.fillText(a.sub, GCW/2, y+38);
    c.globalAlpha = 1;
  });
}

function _drawMinimap() {
  if (!mmCtx) return;
  const mc = mmCtx;
  const mw = 140, mh = 108;
  const sx = mw / GW, sy = mh / GH;

  mc.fillStyle = '#1a1810';
  mc.fillRect(0, 0, mw, mh);

  // Roads
  wRoads.forEach(r => {
    mc.fillStyle = '#3a3530';
    if (r.horiz) mc.fillRect(r.x0*sx, r.y0*sy, r.len*sx, r.h*sy);
    else         mc.fillRect(r.x0*sx, r.y0*sy, r.w*sx, r.len*sy);
  });

  // AI cars
  mc.fillStyle = '#6b6b7a';
  G.aiCars.forEach(ai => {
    if (!ai.active) return;
    mc.fillRect(ai.x*sx-1, ai.y*sy-1, 2, 2);
  });

  // Police
  mc.fillStyle = '#3b82f6';
  G.police.forEach(pc => {
    mc.beginPath(); mc.arc(pc.x*sx, pc.y*sy, 2.5, 0, Math.PI*2); mc.fill();
  });

  // Player
  mc.fillStyle = '#ff6a00';
  mc.beginPath(); mc.arc(G.player.x*sx, G.player.y*sy, 3.5, 0, Math.PI*2); mc.fill();

  // Viewport rect
  mc.strokeStyle = 'rgba(255,255,255,0.2)'; mc.lineWidth = 0.5; mc.setLineDash([]);
  mc.strokeRect(cam.x*sx, cam.y*sy, (GCW/cam.zoom)*sx, (GCH/cam.zoom)*sy);
}

// ── HUD update ────────────────────────────────────────────────
function updateHUD() {
  const p = G.player;

  const spdEl = document.getElementById('hud-spd');
  if (spdEl) spdEl.textContent = p.kmh;

  const gEl = document.getElementById('hud-gear');
  if (gEl) gEl.textContent = p.gear;

  const monEl = document.getElementById('hud-money');
  if (monEl) monEl.textContent = '₮'+G.money.toLocaleString();

  const limEl = document.getElementById('hud-spd-limit');
  if (limEl) {
    limEl.textContent = G.speedLimit;
    limEl.parentElement.style.color = p.kmh > G.speedLimit + 10 ? '#ef4444' : '#f0eeea';
    limEl.parentElement.parentElement.style.borderColor =
      p.kmh > G.speedLimit + 10 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)';
  }

  // Wanted stars
  for (let i=1; i<=3; i++) {
    const s = document.getElementById(`s${i}`);
    if (s) s.classList.toggle('lit', i <= G.wantedLevel);
  }

  // Time
  const h = Math.floor(G.time / 60) % 24;
  const m = Math.floor(G.time % 60);
  const tEl = document.getElementById('hud-time');
  if (tEl) tEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  // Violation log DOM
  const vl = document.getElementById('viol-log');
  if (vl) {
    vl.innerHTML = G.violationLog.slice(0,3).map(v =>
      `<div class="vl-item">${v.label} <span style="color:#ef4444">-₮${v.fine.toLocaleString()}</span></div>`
    ).join('');
  }
}

// ── Utility ───────────────────────────────────────────────────
function _darken(hex, amt) {
  const n = parseInt(hex.replace('#',''),16);
  const r = Math.max(0,((n>>16)&0xff)-amt);
  const g = Math.max(0,((n>>8)&0xff)-amt);
  const b = Math.max(0,(n&0xff)-amt);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

// ── GAME LOOP ─────────────────────────────────────────────────
let _raf;
function _loop(ts) {
  gameUpdate();
  render();
  _raf = requestAnimationFrame(_loop);
}

// ── Public API ────────────────────────────────────────────────
function startGame(mode) {
  if (!gc) initGameCanvas();

  G.mode = mode;
  G.frame = 0; G.wantedLevel = 0; G.money = 500000; G.score = 100;
  G.violationLog = []; G.alerts = []; G.particles = []; G.police = [];
  G._flash = 0; G._pendingFine = 0; G._wantedDecayTimer = 0;
  _arrestTriggered = false;
  for (const k in _vCooldown) delete _vCooldown[k];

  buildWorld();

  // Set speed limit for peace ave
  const peace = wRoads.find(r => r.name === 'Энхтайваны өргөн чөлөө');
  G.speedLimit = peace ? peace.spd : 60;

  // Show game UI
  document.getElementById('game-menu').style.display = 'none';
  document.getElementById('game-hud').style.display = 'block';
  document.getElementById('hud-speed-wrap').style.display = 'block';
  document.getElementById('game-minimap').style.display = 'block';
  document.getElementById('viol-log').style.display = 'block';

  const modeLabels = { free:'ЧӨЛӨӨТ', test:'ШАЛГАЛТ', mission:'ДААЛГАВАР' };
  const modeEl = document.getElementById('hud-mode-lbl');
  if (modeEl) modeEl.textContent = modeLabels[mode] || 'ГОРИМ';

  if (mode === 'mission') {
    document.getElementById('hud-task').style.display = 'block';
    document.getElementById('ht-text').textContent = _getMissionText();
  }

  // Mobile controls
  if ('ontouchstart' in window) {
    document.getElementById('mob-game-ctrl').style.display = 'block';
  }

  G.running = true; G.paused = false;
  cancelAnimationFrame(_raf);
  _raf = requestAnimationFrame(_loop);

  pushAlert('Тоглоом эхэллээ!', 'WASD / ← ↑ ↓ → — жолоодоорой', '#22c55e');
}

function _getMissionText() {
  const missions = [
    'Их тойруу руу хүрнэ үү',
    'Чингисийн гудамж руу явна уу',
    'Хойд бага тойруу руу очно уу',
    'Нарны зам руу явна уу',
  ];
  return missions[Math.floor(Math.random() * missions.length)];
}

function togglePause() {
  if (!G.running) return;
  G.paused = !G.paused;
  const el = document.getElementById('game-pause');
  if (el) el.style.display = G.paused ? 'flex' : 'none';
  if (!G.paused) { cancelAnimationFrame(_raf); _raf = requestAnimationFrame(_loop); }
}

function restartGame() {
  const el = document.getElementById('game-pause');
  if (el) el.style.display = 'none';
  startGame(G.mode);
}

function showGameMenu() {
  const el = document.getElementById('game-pause');
  if (el) el.style.display = 'none';
  G.running = false; G.paused = false;
  cancelAnimationFrame(_raf);
  document.getElementById('game-menu').style.display = 'flex';
  document.getElementById('game-hud').style.display = 'none';
  document.getElementById('hud-speed-wrap').style.display = 'none';
  document.getElementById('game-minimap').style.display = 'none';
  document.getElementById('viol-log').style.display = 'none';
  document.getElementById('hud-task').style.display = 'none';
  document.getElementById('mob-game-ctrl').style.display = 'none';
}

function payFine() {
  const dlg = document.getElementById('game-police-dialog');
  if (dlg) dlg.style.display = 'none';
  G._pendingFine = 0;
  G.player.crashed = false;
  G.player.crashTimer = 0;
  pushAlert('Торгууль төлөгдлөө', 'Аюулгүй явна уу!', '#22c55e');
}

function dismissPolice() {
  const dlg = document.getElementById('game-police-dialog');
  if (dlg) dlg.style.display = 'none';
  G.player.crashed = false;
  G.player.crashTimer = 0;
}
