'use strict';
// ═══════════════════════════════════════════════════════════════
//  POLICE.JS — Цагдаа, торгуулийн систем, зөрчил илрүүлэх
// ═══════════════════════════════════════════════════════════════

// ── Violation definitions ─────────────────────────────────────
var VIOL = {
  RED_LIGHT:      { fine:50000,  want:1, label:'🚦 Улаан гэрэл зөрчлөө',          color:'#ef4444' },
  SPEEDING_MILD:  { fine:30000,  want:0, label:'⚡ Хурдны хязгаар зөрчлөө',       color:'#f59e0b' },
  SPEEDING_HEAVY: { fine:80000,  want:1, label:'🏎️ Хурд ноцтой хэтэрлэлт!',      color:'#ef4444' },
  HIT_PED:        { fine:200000, want:2, label:'🚶 Явган хүн мөргөлдлөө!',        color:'#ef4444' },
  HIT_CAR:        { fine:100000, want:1, label:'💥 Машин мөргөлдлөө!',            color:'#f59e0b' },
  WRONG_WAY:      { fine:40000,  want:1, label:'⬅️ Эсрэг урсгалд орлоо!',        color:'#ef4444' },
};

var _vCooldown = {};
var _arrestPending = false;

// ── Check violations (called periodically) ────────────────────
function checkViolations() {
  var p = G.player;
  if (p.crashed) return;

  // 1. Traffic lights
  G.lights.forEach(function(l) {
    var d = Math.hypot(p.x-l.x, p.y-l.y);
    if (d>12 && d<105 && p.kmh>5) {
      var ahead = Math.cos(p.angle)*(l.x-p.x) + Math.sin(p.angle)*(l.y-p.y);
      if (ahead>0 && ahead<85 && l.stateForAngle(p.angle)==='red') {
        addViolation('RED_LIGHT');
      }
    }
  });

  // 2. Speeding
  if (p.kmh > G.speedLimit + 38) addViolation('SPEEDING_HEAVY');
  else if (p.kmh > G.speedLimit + 15) addViolation('SPEEDING_MILD');

  // 3. Pedestrian collision
  G.peds.forEach(function(ped) {
    if (ped.state!=='crossing' || ped.penalized) return;
    if (Math.hypot(p.x-ped.x, p.y-ped.y)<22) {
      ped.penalized=true; ped.state='scared'; ped.waitTimer=250;
      p.takeDamage(15, Math.atan2(ped.y-p.y, ped.x-p.x));
      G._flash=0.7;
      addViolation('HIT_PED');
      addParticles(p.x, p.y, 8, '#ef4444');
      setTimeout(function(){ ped.penalized=false; }, 8000);
    }
  });

  // 4. AI car collision
  G.aiCars.forEach(function(ai) {
    if (!ai.active) return;
    if (Math.hypot(p.x-ai.x, p.y-ai.y)<25) {
      var impA = Math.atan2(p.y-ai.y, p.x-ai.x);
      p.takeDamage(20, impA);
      ai.active=false; ai.speed=0;
      setTimeout(function(){ ai.active=true; }, 3500);
      addViolation('HIT_CAR');
      addParticles(p.x, p.y, 14, '#fbbf24');
      addParticles(ai.x, ai.y, 8, '#ef4444');
      G._flash=0.4;
      // All nearby AI stop briefly
      G.aiCars.forEach(function(a){
        if (Math.hypot(a.x-ai.x, a.y-ai.y)<180) a.waiting=true;
      });
    }
  });

  // 5. Wrong-way
  var r = getRoadAt(p.x, p.y);
  if (r) {
    G.speedLimit = r.spd;
    G._currentRoad = r.name;
    if (r.horiz && p.kmh>10) {
      var a = ((p.angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
      var goingEast = a<Math.PI*0.5 || a>Math.PI*1.5;
      var inEastLane= p.y>r.yCen;
      if (goingEast !== inEastLane) addViolation('WRONG_WAY');
    }
  } else {
    G._currentRoad = '';
  }
}

// ── Add a violation ───────────────────────────────────────────
function addViolation(type) {
  var now = G.frame;
  if (_vCooldown[type] && now - _vCooldown[type] < 260) return;
  _vCooldown[type] = now;

  var v = VIOL[type];
  G.money   = Math.max(0, G.money - v.fine);
  G.score   = Math.max(0, G.score - Math.ceil(v.fine/5000));
  G.wantedLevel = Math.min(3, G.wantedLevel + v.want);
  G._pendingFine += v.fine;
  G._wantedDecay = 0;

  G.violationLog.unshift({ label:v.label, fine:v.fine, color:v.color });
  if (G.violationLog.length>5) G.violationLog.length=5;

  G._flash = 0.45;
  pushAlert(v.label, '-₮'+v.fine.toLocaleString(), v.color);

  // Dispatch police
  if (G.wantedLevel>=1 && G.police.length < G.wantedLevel) spawnPolice();
}

// ── Police Car ────────────────────────────────────────────────
var PoliceCar = (function() {
  function PoliceCar(x, y) {
    this.x=x; this.y=y;
    this.angle=Math.random()*Math.PI*2;
    this.speed=0;
    this.maxSp=8.2;
    this.w=22; this.h=38;
    this.state='patrol'; // patrol | respond | chase | block
    this._lp=0; // light phase
    this._pt=0; // patrol timer
    this._pTgt={x:x+(Math.random()-0.5)*500, y:y+(Math.random()-0.5)*500};
    this.sirenOn=false;
    this._dispatchTimer=0; // broadcast animation timer
    this._dispatchAnim=false;
  }

  PoliceCar.prototype.update = function(player) {
    this._lp=(this._lp+1)%40;

    if (G.wantedLevel===0) {
      this.state='patrol'; this.sirenOn=false;
      this._patrol();
      return;
    }

    this.sirenOn=true;
    if (this._dispatchTimer>0 && !this._dispatchAnim) {
      this._dispatchAnim=true;
      this.state='respond';
    }
    this._dispatchTimer=Math.max(0,this._dispatchTimer-1);

    var dx=player.x-this.x, dy=player.y-this.y;
    var dist=Math.sqrt(dx*dx+dy*dy);

    if (dist<38 && !_arrestPending) {
      this.state='block'; this.speed=0;
      _doArrest();
      return;
    }

    this.state='chase';
    var ta=Math.atan2(dy,dx);

    // Intercept: aim slightly ahead of player's direction
    if (dist>200 && G.wantedLevel>=2) {
      var intercept=60;
      var ix=player.x+Math.cos(player.angle)*intercept;
      var iy=player.y+Math.sin(player.angle)*intercept;
      ta=Math.atan2(iy-this.y, ix-this.x);
    }

    var da=ta-this.angle;
    while(da>Math.PI) da-=2*Math.PI;
    while(da<-Math.PI) da+=2*Math.PI;
    this.angle+=da*0.1;

    var chaseSpd = G.wantedLevel>=2 ? this.maxSp : this.maxSp*0.72;
    if (this.speed<chaseSpd) this.speed+=0.2;

    this.x+=Math.cos(this.angle)*this.speed;
    this.y+=Math.sin(this.angle)*this.speed;
    this.x=Math.max(20,Math.min(WORLD.W-20,this.x));
    this.y=Math.max(20,Math.min(WORLD.H-20,this.y));
  };

  PoliceCar.prototype._patrol = function() {
    var dx=this._pTgt.x-this.x, dy=this._pTgt.y-this.y;
    var d=Math.sqrt(dx*dx+dy*dy);
    if (d<35 || ++this._pt>400) {
      this._pTgt={x:150+Math.random()*(WORLD.W-300), y:150+Math.random()*(WORLD.H-300)};
      this._pt=0;
    }
    var ta=Math.atan2(dy,dx);
    var da=ta-this.angle;
    while(da>Math.PI) da-=2*Math.PI;
    while(da<-Math.PI) da+=2*Math.PI;
    this.angle+=da*0.06;
    if (this.speed<2.2) this.speed+=0.07;
    this.x+=Math.cos(this.angle)*this.speed;
    this.y+=Math.sin(this.angle)*this.speed;
    this.x=Math.max(20,Math.min(WORLD.W-20,this.x));
    this.y=Math.max(20,Math.min(WORLD.H-20,this.y));
  };

  return PoliceCar;
}());

function spawnPolice() {
  var a=Math.random()*Math.PI*2;
  var d=480+Math.random()*320;
  var px=Math.max(60,Math.min(WORLD.W-60, G.player.x+Math.cos(a)*d));
  var py=Math.max(60,Math.min(WORLD.H-60, G.player.y+Math.sin(a)*d));
  var pc=new PoliceCar(px, py);
  pc._dispatchTimer=90; // show "radio call" for 90 frames
  G.police.push(pc);
  pushAlert('🚔 Цагдаа дуудагдлаа!', G.wantedLevel>=2?'Хоёр машин идэвхжив':'Нэг машин ирж байна', '#3b82f6');
}

function _doArrest() {
  if (_arrestPending) return;
  _arrestPending=true;
  G.player.speed=0; G.player.crashed=true; G.player.crashTimer=220;
  var fine=G._pendingFine;
  setTimeout(function(){
    showPoliceDialog(fine);
    G.wantedLevel=0; G.police=[]; G._pendingFine=0;
    for (var k in _vCooldown) delete _vCooldown[k];
    _arrestPending=false;
  }, 700);
}

// Called from ui.js pay button
function payFineAction() {
  closePoliceDialog();
  G.player.crashed=false; G.player.crashTimer=0;
  G._pendingFine=0;
  pushAlert('✅ Торгууль төлөгдлөө', 'Аюулгүй явна уу!', '#22c55e');
}

// Wanted level decay (call each frame)
function updateWantedDecay() {
  if (G.wantedLevel<=0) return;
  if (++G._wantedDecay > 900) {
    G.wantedLevel=Math.max(0, G.wantedLevel-1);
    G._wantedDecay=0;
    if (G.wantedLevel===0) { G.police=[]; G._pendingFine=0; }
  }
}
