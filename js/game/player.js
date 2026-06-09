'use strict';
// ═══════════════════════════════════════════════════════════════
//  PLAYER.JS — Тоглогчийн машины физик
// ═══════════════════════════════════════════════════════════════

var PlayerCar = (function() {
  function PlayerCar(x, y, angle) {
    angle = angle || 0;
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = 0;

    // Physics
    this.maxSpeed   = 10.2;   // ~190 km/h max
    this.maxReverse = 3.8;
    this.accel      = 0.21;
    this.brakeForce = 0.38;
    this.engBrake   = 0.045;  // engine friction
    this.steerHi    = 0.068;  // steering at low speed
    this.steerLo    = 0.018;  // minimum steering at high speed
    this.steerFade  = 0.032;  // reduction per speed unit

    // Car size
    this.w = 22; this.h = 38;

    // State
    this.kmh     = 0;
    this.gear    = 'N';
    this.braking = false;
    this.horn    = false;

    // Damage
    this.health    = 100;
    this.damaged   = false;   // persistent visual damage
    this.crashed   = false;   // brief stun state
    this.crashTimer= 0;
    this.dents     = [];      // [{lx,ly}] - local dent positions

    // Tire marks
    this.tireMarks = [];
  }

  PlayerCar.prototype.update = function() {
    var up = gKeys['ArrowUp']    || gKeys['w'] || gKeys['W'];
    var dn = gKeys['ArrowDown']  || gKeys['s'] || gKeys['S'];
    var lt = gKeys['ArrowLeft']  || gKeys['a'] || gKeys['A'];
    var rt = gKeys['ArrowRight'] || gKeys['d'] || gKeys['D'];
    this.horn = !!(gKeys['h'] || gKeys['H']);

    // Crash stun
    if (this.crashTimer > 0) {
      this.crashTimer--;
      this.speed *= 0.87;
      if (this.crashTimer <= 0) this.crashed = false;
    }

    if (!this.crashed) {
      if (up) {
        this.speed = this.speed < 0
          ? Math.min(0, this.speed + this.brakeForce)
          : Math.min(this.maxSpeed, this.speed + this.accel);
      } else if (dn) {
        this.speed = this.speed > 0
          ? Math.max(0, this.speed - this.brakeForce)
          : Math.max(-this.maxReverse, this.speed - this.accel * 0.55);
      } else {
        this.speed *= (1 - this.engBrake);
      }

      // Speed-dependent steering
      var absSp = Math.abs(this.speed);
      var steer = Math.max(this.steerLo, this.steerHi - absSp * this.steerFade);
      var si = (lt ? -1 : 0) + (rt ? 1 : 0);
      if (si !== 0 && absSp > 0.08) {
        this.angle += steer * si * Math.sign(this.speed);
      }
    }

    if (Math.abs(this.speed) < 0.02) this.speed = 0;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.x = Math.max(20, Math.min(WORLD.W-20, this.x));
    this.y = Math.max(20, Math.min(WORLD.H-20, this.y));

    // KMH + gear
    this.kmh = Math.round(Math.abs(this.speed) * 18.8);
    this.braking = dn && this.speed > 0.5;
    this._updateGear();

    // Tire marks
    if (this.braking && this.kmh > 12 && G.frame % 2 === 0) {
      var bx = this.x - Math.cos(this.angle)*17;
      var by = this.y - Math.sin(this.angle)*17;
      this.tireMarks.push({x:bx, y:by, life:55, max:55});
      if (this.tireMarks.length > 120) this.tireMarks.shift();
    }
    this.tireMarks = this.tireMarks.filter(function(m){ return --m.life>0; });
  };

  PlayerCar.prototype._updateGear = function() {
    var k = this.kmh;
    if (this.speed < 0)   { this.gear = 'R'; return; }
    if (k < 3)   this.gear = 'N';
    else if (k < 22) this.gear = '1';
    else if (k < 48) this.gear = '2';
    else if (k < 80) this.gear = '3';
    else if (k < 120) this.gear = '4';
    else this.gear = '5';
  };

  PlayerCar.prototype.takeDamage = function(amount, impactAngle) {
    this.health    = Math.max(0, this.health - amount);
    this.crashed   = true;
    this.crashTimer= Math.min(150, 70 + amount * 2);
    this.damaged   = this.health < 75;
    // Local-space dent position
    var da = (impactAngle || this.angle) - this.angle;
    this.dents.push({
      lx: Math.cos(da) * this.w * 0.45,
      ly: Math.sin(da) * this.h * 0.45,
    });
    if (this.dents.length > 6) this.dents.shift();
  };

  PlayerCar.prototype.reset = function(x, y, angle) {
    this.x = x; this.y = y; this.angle = angle||0;
    this.speed = 0; this.health = 100; this.damaged = false;
    this.crashed = false; this.crashTimer = 0;
    this.dents = []; this.tireMarks = [];
  };

  return PlayerCar;
}());
