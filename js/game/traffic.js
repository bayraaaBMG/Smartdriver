'use strict';
// ═══════════════════════════════════════════════════════════════
//  TRAFFIC.JS — Гэрлэн дохио, AI машин, явган хүн
// ═══════════════════════════════════════════════════════════════

// ── Traffic Light ─────────────────────────────────────────────
var TrafficLight = (function() {
  function TrafficLight(x, y, hw, vw, offset) {
    this.x = x; this.y = y;
    this.hw = hw; this.vw = vw; // half-widths of the roads at this intersection
    this.t  = offset || 0;
    this.nsGreen = 210;
    this.ewGreen = 180;
    this.yellow  = 32;
    this.cycle   = this.nsGreen + this.yellow + this.ewGreen + this.yellow;
  }

  TrafficLight.prototype.update = function() {
    this.t = (this.t + 1) % this.cycle;
  };

  Object.defineProperty(TrafficLight.prototype, 'nsState', {
    get: function() {
      var p = this.t;
      if (p < this.nsGreen) return 'green';
      if (p < this.nsGreen + this.yellow) return 'yellow';
      return 'red';
    }
  });

  Object.defineProperty(TrafficLight.prototype, 'ewState', {
    get: function() {
      var p = this.t;
      if (p < this.nsGreen + this.yellow) return 'red';
      if (p < this.nsGreen + this.yellow + this.ewGreen) return 'green';
      if (p < this.cycle) return 'yellow';
      return 'red';
    }
  });

  // State for car approaching at given angle
  TrafficLight.prototype.stateForAngle = function(angle) {
    var a = ((angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    var isNS = (a > Math.PI*0.3 && a < Math.PI*0.7) || (a > Math.PI*1.3 && a < Math.PI*1.7);
    return isNS ? this.nsState : this.ewState;
  };

  TrafficLight.prototype.canGo = function(angle) {
    return this.stateForAngle(angle) !== 'red';
  };

  return TrafficLight;
}());

// ── Car color palette ─────────────────────────────────────────
var CAR_COLORS = [
  '#c0392b','#2980b9','#27ae60','#8e44ad','#d35400',
  '#16a085','#2c3e50','#e74c3c','#1abc9c','#f39c12',
  '#95a5a6','#3498db','#9b59b6','#e67e22','#bdc3c7',
  '#ecf0f1','#7f8c8d','#c8c8c8','#a93226','#1a5276',
];

// ── Vehicle type system ───────────────────────────────────────
var VEHICLE_TYPES = [
  {type:'sedan', w:18, h:32, freq:6},
  {type:'suv',   w:22, h:37, freq:3},
  {type:'van',   w:21, h:42, freq:2},
  {type:'bus',   w:27, h:56, freq:1},
  {type:'mini',  w:15, h:26, freq:2},
  {type:'taxi',  w:18, h:33, freq:2},
];

function _pickVType() {
  var total=0;
  VEHICLE_TYPES.forEach(function(t){total+=t.freq;});
  var r=Math.random()*total;
  for (var i=0;i<VEHICLE_TYPES.length;i++){
    r-=VEHICLE_TYPES[i].freq;
    if (r<=0) return VEHICLE_TYPES[i];
  }
  return VEHICLE_TYPES[0];
}

// ── AI Car ────────────────────────────────────────────────────
var AICar = (function() {
  function AICar(road, dir, laneIdx, progress) {
    this.road     = road;
    this.dir      = dir;       // 1 forward, -1 backward
    this.laneIdx  = laneIdx;
    this.progress = progress;  // 0..1 along road
    this.speed    = 0;
    this.maxSp    = (1.5 + Math.random() * 1.8) * dir; // ~1.5-3.3 px/frame
    this.followGap = 38 + Math.random() * 22;
    this.active  = true;
    this.waiting = false;

    var vt = _pickVType();
    this.vtype = vt.type;
    this.w = vt.w;
    this.h = vt.h;

    if (this.vtype === 'bus') {
      this.color = Math.random()>0.5 ? '#1a5276' : '#154360';
      this.maxSp *= 0.75; // buses are slower
    } else if (this.vtype === 'taxi') {
      this.color = '#f1c40f';
    } else {
      this.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    }

    this._setPos();
  }

  AICar.prototype._setPos = function() {
    var r = this.road;
    var lw = (r.horiz ? r.h : r.w) / (r.lpd * 2);
    if (r.horiz) {
      this.y     = r.yCen + this.dir * (this.laneIdx + 0.5) * lw;
      this.x     = r.x0 + this.progress * r.len;
      this.angle = this.dir > 0 ? 0 : Math.PI;
    } else {
      this.x     = r.xCen + this.dir * (this.laneIdx + 0.5) * lw;
      this.y     = r.y0 + this.progress * r.len;
      this.angle = this.dir > 0 ? Math.PI/2 : -Math.PI/2;
    }
  };

  AICar.prototype.update = function(lights, player, allCars) {
    if (!this.active) return;

    var targetSp  = Math.abs(this.maxSp);
    var slowFactor= 1.0;

    // Red light check — distance to nearest red light ahead
    var ldist = this._nearLightDist(lights);
    if (ldist !== null) {
      if (ldist < this.followGap - 10) { slowFactor = 0; }
      else if (ldist < this.followGap + 50) {
        slowFactor = Math.min(1, (ldist - (this.followGap-10)) / 60);
      }
    }

    // Car ahead check (following distance)
    var cdist = this._carAheadDist(allCars, player);
    if (cdist !== null) {
      if (cdist < this.followGap - 8) { slowFactor = 0; }
      else if (cdist < this.followGap + 30) {
        slowFactor = Math.min(slowFactor, (cdist - (this.followGap-8)) / 38);
      }
    }

    var spTarget = targetSp * Math.max(0, slowFactor);
    var curSp = Math.abs(this.speed);

    if (curSp < spTarget) {
      this.speed += 0.09 * Math.sign(this.maxSp);
    } else if (curSp > spTarget + 0.05) {
      this.speed -= 0.12 * Math.sign(this.maxSp);
    }
    if (Math.abs(this.speed) < 0.01) this.speed = 0;
    this.waiting = slowFactor < 0.15;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Recycle off-world
    this._recycle();
  };

  AICar.prototype._nearLightDist = function(lights) {
    var minDist = null;
    for (var i=0; i<lights.length; i++) {
      var l = lights[i];
      var dx = l.x - this.x, dy = l.y - this.y;
      var d = Math.sqrt(dx*dx + dy*dy);
      if (d > 12 && d < 130) {
        var ahead = Math.cos(this.angle)*dx + Math.sin(this.angle)*dy;
        if (ahead > 0 && l.stateForAngle(this.angle) === 'red') {
          if (minDist === null || d < minDist) minDist = d;
        }
      }
    }
    return minDist;
  };

  AICar.prototype._carAheadDist = function(allCars, player) {
    var minDist = null;
    var check = function(cx, cy) {
      var dx=cx-this.x, dy=cy-this.y;
      var ahead = Math.cos(this.angle)*dx + Math.sin(this.angle)*dy;
      var side  = Math.abs(-Math.sin(this.angle)*dx + Math.cos(this.angle)*dy);
      if (ahead > 0 && ahead < 95 && side < 20) {
        if (minDist === null || ahead < minDist) minDist = ahead;
      }
    }.bind(this);

    for (var i=0; i<allCars.length; i++) {
      if (allCars[i]!==this && allCars[i].active) check(allCars[i].x, allCars[i].y);
    }
    check(player.x, player.y);
    return minDist;
  };

  AICar.prototype._recycle = function() {
    var r = this.road;
    if (r.horiz) {
      if (this.dir>0 && this.x>WORLD.W+120) { this.x=-90; this.speed=this.maxSp*0.9; }
      if (this.dir<0 && this.x<-120) { this.x=WORLD.W+90; this.speed=this.maxSp*0.9; }
    } else {
      if (this.dir>0 && this.y>WORLD.H+120) { this.y=-90; this.speed=this.maxSp*0.9; }
      if (this.dir<0 && this.y<-120) { this.y=WORLD.H+90; this.speed=this.maxSp*0.9; }
    }
  };

  return AICar;
}());

// ── Pedestrian ────────────────────────────────────────────────
var Pedestrian = (function() {
  var SKINS = ['#f5cba7','#e8b89a','#d4956a','#c07840','#a0522d'];
  var SHIRTS= ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22'];

  function Pedestrian(crossX, startY, endY, nearLight) {
    this.crossX    = crossX;
    this.x         = crossX; // exact crosswalk column — no random scatter
    this.y         = startY;
    this.startY    = startY;
    this.endY      = endY;
    this.nearLight = nearLight;
    this.state     = 'waiting'; // waiting | crossing | done | scared
    this.waitTimer = Math.floor(100 + Math.random()*500);
    this.speed     = 0.42 + Math.random()*0.28;
    this.penalized = false;
    this.skin = SKINS[Math.floor(Math.random()*SKINS.length)];
    this.shirt= SHIRTS[Math.floor(Math.random()*SHIRTS.length)];
    this._walkPhase = Math.random()*Math.PI*2;
  }

  Pedestrian.prototype.update = function(player) {
    var dp = Math.hypot(player.x-this.x, player.y-this.y);

    // Scared of nearby player
    if (dp < 65 && this.state==='crossing') {
      this.state='scared'; this.waitTimer=90; return;
    }
    if (this.state==='scared') {
      if (--this.waitTimer<=0) this.state='waiting';
      return;
    }

    // Crossing allowed when EW cars have red light (pedestrian crosses horizontal road)
    var canCross = !this.nearLight || this.nearLight.ewState === 'red';

    if (this.state==='waiting') {
      if (--this.waitTimer<=0 && canCross) this.state='crossing';
    } else if (this.state==='crossing') {
      var dy = this.endY - this.y;
      if (Math.abs(dy)<1) {
        this.state='done';
        this.y = this.endY;
        var self=this;
        setTimeout(function(){
          var tmp=self.startY; self.startY=self.endY; self.endY=tmp;
          self.y=self.startY;
          self.state='waiting';
          self.waitTimer=Math.floor(200+Math.random()*600);
          self.penalized=false;
        }, 1200+Math.random()*2000);
      } else {
        this.y += Math.sign(dy)*this.speed;
        this._walkPhase += 0.25;
      }
    }
  };

  return Pedestrian;
}());

// ── Spawn helpers ─────────────────────────────────────────────
function spawnAICars() {
  G.aiCars = [];
  wRoads.forEach(function(road) {
    var count = Math.max(2, Math.floor(road.len / 400));
    [-1, 1].forEach(function(dir) {
      for (var k=0; k<count; k++) {
        var lane = Math.floor(Math.random() * road.lpd);
        var prog = Math.random();
        G.aiCars.push(new AICar(road, dir, lane, prog));
      }
    });
  });
}

function spawnPeds() {
  G.peds = [];
  wInters.forEach(function(inter) {
    var light = G.lights.find(function(l){ return Math.hypot(l.x-inter.x, l.y-inter.y)<15; });
    var count = 1 + Math.floor(Math.random()*2);
    for (var i=0; i<count; i++) {
      var side = Math.random()>0.5 ? 1 : -1;
      // Start on sidewalk beyond the crosswalk stripe zone (stripes end ~58px from road edge)
      var startY = inter.y + side*(inter.hw + 68);
      var endY   = inter.y - side*(inter.hw + 68);
      // Two columns that avoid the yellow center line (which is at inter.x)
      var cols = [-0.55, 0.40];
      var cx = inter.x + cols[i % cols.length] * inter.vw;
      G.peds.push(new Pedestrian(cx, startY, endY, light));
    }
  });
}
