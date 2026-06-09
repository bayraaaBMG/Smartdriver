'use strict';
// ═══════════════════════════════════════════════════════════════
//  RENDERER.JS — Бүх зурах функцууд (satellite-style top-down)
// ═══════════════════════════════════════════════════════════════

function render() {
  var c = gctx;
  c.clearRect(0,0,GCW,GCH);
  c.save();
  c.scale(cam.zoom, cam.zoom);
  c.translate(-cam.x, -cam.y);

  rGround(c);
  rSpecialAreas(c);
  rBuildings(c);
  rRoads(c);
  rMarkings(c);
  rCrosswalks(c);
  rBusStops(c);
  rTrees(c);
  rTrafficLights(c);
  rTireMarks(c);
  rPeds(c);
  rAICars(c);
  rPolice(c);
  rPlayer(c);
  rParticles(c);

  c.restore();

  // Screen-space effects
  if (G._flash>0.01) {
    c.fillStyle='rgba(239,68,68,'+G._flash+')';
    c.fillRect(0,0,GCW,GCH);
    G._flash*=0.85;
  }
}

// ── Ground ────────────────────────────────────────────────────
function rGround(c) {
  c.fillStyle='#5c5246'; c.fillRect(0,0,WORLD.W,WORLD.H);
  c.fillStyle='rgba(0,0,0,0.055)';
  for (var x=0;x<WORLD.W;x+=88)
    for (var y=0;y<WORLD.H;y+=88)
      if (((x/88|0)+(y/88|0))%2===0) c.fillRect(x,y,88,88);
}

// ── Special areas (Sukhbaatar Square, parks) ──────────────────
function rSpecialAreas(c) {
  var sq=SUKHBAATAR_SQ;

  // Square base — granite/stone
  c.fillStyle='#7a7468';
  c.fillRect(sq.x, sq.y, sq.w, sq.h);

  // Stone texture tiles
  c.fillStyle='rgba(0,0,0,0.05)';
  for (var tx=sq.x; tx<sq.x+sq.w; tx+=22)
    for (var ty=sq.y; ty<sq.y+sq.h; ty+=22)
      if (((tx+ty)/22|0)%2===0) c.fillRect(tx,ty,22,22);

  // Border / kerb
  c.strokeStyle='rgba(255,255,255,0.18)'; c.lineWidth=3; c.setLineDash([]);
  c.strokeRect(sq.x+4,sq.y+4,sq.w-8,sq.h-8);

  // Flagpoles / Chinggis Khan statue
  var fx=sq.flagX, fy=sq.flagY;
  c.fillStyle='#8a7a62';
  c.beginPath(); c.arc(fx,fy,20,0,Math.PI*2); c.fill();
  c.fillStyle='rgba(0,0,0,0.2)';
  c.beginPath(); c.arc(fx+3,fy+4,20,0,Math.PI*2); c.fill();
  c.fillStyle='#9a8a72';
  c.beginPath(); c.arc(fx,fy,20,0,Math.PI*2); c.fill();
  c.fillStyle='#c8aa80';
  c.beginPath(); c.arc(fx,fy,8,0,Math.PI*2); c.fill();
  c.fillStyle='rgba(255,255,255,0.3)';
  c.beginPath(); c.arc(fx-3,fy-3,4,0,Math.PI*2); c.fill();

  // Square name label — clearly visible
  c.font='bold 13px "JetBrains Mono",monospace';
  c.fillStyle='rgba(255,255,255,0.55)'; c.textAlign='center';
  c.fillText('★ '+sq.name+' ★', sq.x+sq.w/2, sq.y+sq.h/2-6);
  c.font='9px "JetBrains Mono",monospace';
  c.fillStyle='rgba(255,255,255,0.28)';
  c.fillText('Улаанбаатар хотын зүрх', sq.x+sq.w/2, sq.y+sq.h/2+10);

  // Park landmark (green area)
  LANDMARKS.forEach(function(lm) {
    if (lm[7]!=='park') return;
    c.fillStyle='#2a4418';
    c.fillRect(lm[0], lm[1], lm[2], lm[3]);
    c.fillStyle='rgba(60,100,30,0.5)';
    for (var px=lm[0]+10; px<lm[0]+lm[2]-10; px+=20)
      for (var py=lm[1]+10; py<lm[1]+lm[3]-10; py+=20)
        c.fillRect(px,py,10,10);
    c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1.5;
    c.strokeRect(lm[0],lm[1],lm[2],lm[3]);
  });
}

// ── Buildings ─────────────────────────────────────────────────
function rBuildings(c) {
  wBuildings.forEach(function(b) {
    // Shadow
    c.fillStyle='rgba(0,0,0,0.22)';
    c.fillRect(b.x+4,b.y+5,b.w,b.h);

    // Body
    c.fillStyle = b.col;
    if (typeof c.roundRect==='function') {
      c.beginPath(); c.roundRect(b.x,b.y,b.w,b.h,b.landmark?4:2); c.fill();
    } else { c.fillRect(b.x,b.y,b.w,b.h); }

    // Landmark: special rendering
    if (b.landmark) {
      // Roof color accent
      if (b.rCol) {
        c.fillStyle=b.rCol;
        c.fillRect(b.x+3,b.y+3,b.w-6,Math.min(20,b.h*0.3));
      }
      // Bold outline
      c.strokeStyle='rgba(0,0,0,0.35)'; c.lineWidth=1.5; c.setLineDash([]);
      c.strokeRect(b.x,b.y,b.w,b.h);
      c.strokeStyle='rgba(255,255,255,0.14)'; c.lineWidth=1;
      c.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);
      // Name label
      if (b.w>50 && b.h>30) {
        c.font='bold '+(b.type==='tower'?'8':'7')+'px monospace';
        c.fillStyle='rgba(255,255,255,0.55)'; c.textAlign='center';
        var lx=b.x+b.w/2, ly=b.y+b.h/2+3;
        if (b.type==='tower') { ly=b.y+b.h/2; }
        c.fillText(b.name||'', lx, ly);
      }

      // Blue Sky Tower: windows
      if (b.type==='tower') {
        c.fillStyle='rgba(120,200,255,0.3)';
        for (var wy=b.y+8; wy<b.y+b.h-5; wy+=14) {
          c.fillRect(b.x+4, wy, b.w-8, 8);
        }
        c.strokeStyle='rgba(100,180,255,0.5)'; c.lineWidth=1.5;
        c.strokeRect(b.x,b.y,b.w,b.h);
      }
    } else {
      // Regular building details
      c.strokeStyle='rgba(0,0,0,0.15)'; c.lineWidth=1; c.setLineDash([]);
      c.strokeRect(b.x,b.y,b.w,b.h);
      c.strokeStyle='rgba(255,255,255,0.06)'; c.lineWidth=1;
      c.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);
      if (b.w>38 && b.h>28) {
        c.fillStyle='rgba(0,0,0,0.08)';
        c.fillRect(b.x+b.w/2-6,b.y+b.h/2-4,12,8);
      }
    }
  });
}

// ── Roads ─────────────────────────────────────────────────────
var SW=14; // sidewalk width
function rRoads(c) {
  // Sidewalks
  c.fillStyle='#8a7d68';
  wRoads.forEach(function(r) {
    if (r.horiz) {
      c.fillRect(r.x0,r.y0-SW,r.len,SW);
      c.fillRect(r.x0,r.y0+r.h,r.len,SW);
    } else {
      c.fillRect(r.x0-SW,r.y0,SW,r.len);
      c.fillRect(r.x0+r.w,r.y0,SW,r.len);
    }
  });

  // Intersection boxes (asphalt)
  c.fillStyle='#2c2924';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw,n.y-n.hw,n.vw*2,n.hw*2);
  });

  // Road surfaces
  c.fillStyle='#2c2924';
  wRoads.forEach(function(r) {
    if (r.horiz) c.fillRect(r.x0,r.y0,r.len,r.h);
    else         c.fillRect(r.x0,r.y0,r.w,r.len);
  });
}

// ── Lane markings ─────────────────────────────────────────────
function rMarkings(c) {
  wRoads.forEach(function(r) {
    var D  = r.horiz ? r.h : r.w;
    var lw = D / (r.lpd * 2);

    // Edge lines
    c.strokeStyle='rgba(240,235,210,0.82)'; c.lineWidth=2.5; c.setLineDash([]);
    if (r.horiz) {
      _hLine(c,r.x0,r.y0+1.5,r.len); _hLine(c,r.x0,r.y0+r.h-1.5,r.len);
    } else {
      _vLine(c,r.x0+1.5,r.y0,r.len); _vLine(c,r.x0+r.w-1.5,r.y0,r.len);
    }

    // Double-yellow center
    c.strokeStyle='rgba(255,198,28,0.88)'; c.lineWidth=2;
    if (r.horiz) {
      _hLine(c,r.x0,r.yCen-3,r.len); _hLine(c,r.x0,r.yCen+3,r.len);
    } else {
      _vLine(c,r.xCen-3,r.y0,r.len); _vLine(c,r.xCen+3,r.y0,r.len);
    }

    // Dashed lane dividers
    c.strokeStyle='rgba(235,228,205,0.5)'; c.lineWidth=1.5;
    for (var i=1; i<r.lpd*2; i++) {
      if (i===r.lpd) continue;
      if (r.horiz) {
        var y=r.y0+lw*i; c.setLineDash([18,12]); _hLine(c,r.x0,y,r.len);
      } else {
        var x=r.x0+lw*i; c.setLineDash([14,10]); _vLine(c,x,r.y0,r.len);
      }
    }
    c.setLineDash([]);

    // Road name — repeated every 600px so always visible
    if (r.len>400) {
      c.font='bold 8px "JetBrains Mono",monospace';
      c.fillStyle='rgba(255,255,255,0.28)'; c.textAlign='center';
      for (var rpos=300; rpos<r.len; rpos+=620) {
        if (r.horiz) {
          c.fillText(r.name, r.x0+rpos, r.yCen+4);
        } else {
          c.save(); c.translate(r.xCen+4, r.y0+rpos);
          c.rotate(Math.PI/2); c.fillText(r.name, 0, 0); c.restore();
        }
      }
    }
  });
}

function _hLine(c,x,y,len){ c.beginPath();c.moveTo(x,y);c.lineTo(x+len,y);c.stroke(); }
function _vLine(c,x,y,len){ c.beginPath();c.moveTo(x,y);c.lineTo(x,y+len);c.stroke(); }

// ── Crosswalks ────────────────────────────────────────────────
function rCrosswalks(c) {
  c.fillStyle='rgba(235,228,210,0.68)';
  var stripe=6, gap=5, count=5;
  wInters.forEach(function(n) {
    for (var i=0;i<count;i++) {
      // N/S crosswalks: span vertical road width (vw), placed above/below horizontal road (hw)
      c.fillRect(n.x-n.vw, n.y-n.hw-3-i*(stripe+gap), n.vw*2, stripe);
      c.fillRect(n.x-n.vw, n.y+n.hw+3+i*(stripe+gap), n.vw*2, stripe);
      // E/W crosswalks: span horizontal road height (hw), placed left/right of vertical road (vw)
      c.fillRect(n.x-n.vw-3-i*(stripe+gap), n.y-n.hw, stripe, n.hw*2);
      c.fillRect(n.x+n.vw+3+i*(stripe+gap), n.y-n.hw, stripe, n.hw*2);
    }
  });
}

// ── Bus stops ─────────────────────────────────────────────────
function rBusStops(c) {
  BUS_STOPS.forEach(function(bs) {
    var x=bs.x, y=bs.y;
    // Shelter roof (top-down view = a rectangle)
    c.fillStyle='rgba(60,80,120,0.5)';
    c.fillRect(x-12, y-4, 24, 8);
    c.strokeStyle='rgba(100,140,200,0.6)'; c.lineWidth=1; c.setLineDash([]);
    c.strokeRect(x-12, y-4, 24, 8);
    // Sign
    c.fillStyle='#2563eb';
    c.beginPath(); c.arc(x, y+(bs.side==='n'?-8:8), 3.5, 0, Math.PI*2); c.fill();
  });
}

// ── Trees ─────────────────────────────────────────────────────
function rTrees(c) {
  wTrees.forEach(function(t) {
    // Shadow
    c.fillStyle='rgba(0,0,0,0.26)';
    c.beginPath(); c.ellipse(t.x+3,t.y+4,t.r*0.85,t.r*0.65,0.4,0,Math.PI*2); c.fill();
    // Canopy
    var g=c.createRadialGradient(t.x-t.r*0.3,t.y-t.r*0.3,0,t.x,t.y,t.r);
    g.addColorStop(0,t.a); g.addColorStop(0.65,t.b); g.addColorStop(1,'#0e2a08');
    c.fillStyle=g;
    c.beginPath(); c.arc(t.x,t.y,t.r,0,Math.PI*2); c.fill();
    // Highlight
    c.fillStyle='rgba(255,255,255,0.1)';
    c.beginPath(); c.arc(t.x-t.r*0.28,t.y-t.r*0.28,t.r*0.3,0,Math.PI*2); c.fill();
  });
}

// ── Traffic Lights ────────────────────────────────────────────
var LC={red:'#ef4444',yellow:'#fbbf24',green:'#22c55e'};
function rTrafficLights(c) {
  G.lights.forEach(function(l) {
    var hw=l.hw, vw=l.vw;
    var poles=[
      {x:l.x-vw-10, y:l.y-hw-10, stFn:function(){return l.ewState;}},
      {x:l.x+vw+10, y:l.y-hw-10, stFn:function(){return l.ewState;}},
      {x:l.x-vw-10, y:l.y+hw+10, stFn:function(){return l.nsState;}},
      {x:l.x+vw+10, y:l.y+hw+10, stFn:function(){return l.nsState;}},
    ];
    poles.forEach(function(p) {
      var st=p.stFn();
      // Pole
      c.fillStyle='#252525'; c.fillRect(p.x-2,p.y-36,4,36);
      // Box
      c.fillStyle='#1a1a1a';
      if (typeof c.roundRect==='function'){
        c.beginPath();c.roundRect(p.x-7,p.y-50,14,40,3);c.fill();
      } else { c.fillRect(p.x-7,p.y-50,14,40); }
      // 3 lights
      ['red','yellow','green'].forEach(function(col,i){
        var on=st===col;
        if(on){c.shadowColor=LC[col];c.shadowBlur=16;}
        c.fillStyle=on?LC[col]:'rgba(255,255,255,0.04)';
        c.beginPath();c.arc(p.x,p.y-42+i*14,4.5,0,Math.PI*2);c.fill();
        c.shadowBlur=0;
      });
    });
  });
}

// ── Tire marks ────────────────────────────────────────────────
function rTireMarks(c) {
  G.player.tireMarks.forEach(function(m) {
    c.fillStyle='rgba(10,8,6,'+(m.life/m.max*0.5)+')';
    c.fillRect(m.x-2,m.y-2,4,4);
  });
}

// ── Pedestrians ───────────────────────────────────────────────
function rPeds(c) {
  G.peds.forEach(function(p) {
    if (p.state==='done') return;
    c.save(); c.translate(p.x,p.y);
    if (p.state==='scared') c.globalAlpha=0.5;
    // Body
    c.fillStyle=p.shirt; c.fillRect(-4,-8,8,10);
    // Head
    c.fillStyle=p.skin; c.beginPath(); c.arc(0,-11,4,0,Math.PI*2); c.fill();
    // Walking legs
    if (p.state==='crossing') {
      var leg=Math.sin(p._walkPhase)*3;
      c.strokeStyle=p.skin; c.lineWidth=2;
      c.beginPath();c.moveTo(-2,2);c.lineTo(-2+leg,8);c.stroke();
      c.beginPath();c.moveTo(2,2);c.lineTo(2-leg,8);c.stroke();
    }
    c.globalAlpha=1; c.restore();
  });
}

// ── Car drawing helper ────────────────────────────────────────
function _drawCar(c, car, bodyColor, darkColor, isPlayer) {
  c.save(); c.translate(car.x,car.y); c.rotate(car.angle);
  var bw=car.w, bh=car.h;
  var r = isPlayer ? 4 : 3;

  // Drop shadow
  c.fillStyle='rgba(0,0,0,0.32)';
  c.fillRect(-bw/2+5,-bh/2+7,bw,bh);

  // Wheels — 4 dark rectangles at corners (drawn before body)
  var ww=5, wh=7;
  c.fillStyle='#1a1a1a';
  c.fillRect(-bw/2-1,      -bh/2+3,      ww, wh); // front-left
  c.fillRect( bw/2-ww+1,   -bh/2+3,      ww, wh); // front-right
  c.fillRect(-bw/2-1,       bh/2-wh-3,   ww, wh); // rear-left
  c.fillRect( bw/2-ww+1,    bh/2-wh-3,   ww, wh); // rear-right
  // Wheel highlight (shine)
  c.fillStyle='rgba(255,255,255,0.09)';
  c.fillRect(-bw/2-1, -bh/2+3, 2, wh);
  c.fillRect( bw/2-1, -bh/2+3, 2, wh);

  // Body gradient
  var bg=c.createLinearGradient(-bw/2,0,bw/2,0);
  bg.addColorStop(0,darkColor);
  bg.addColorStop(0.25,bodyColor);
  bg.addColorStop(0.75,bodyColor);
  bg.addColorStop(1,darkColor);
  c.fillStyle=bg;
  if (typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(-bw/2+1,-bh/2,bw-2,bh,r);c.fill();
  } else {c.fillRect(-bw/2+1,-bh/2,bw-2,bh);}

  // Roof panel (slightly darker center band)
  var rg=c.createLinearGradient(-bw/2,0,bw/2,0);
  rg.addColorStop(0,'rgba(0,0,0,0.22)');
  rg.addColorStop(0.5,isPlayer?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.05)');
  rg.addColorStop(1,'rgba(0,0,0,0.22)');
  c.fillStyle=rg;
  c.fillRect(-bw/2+3, -bh*0.2, bw-6, bh*0.4);

  // Windshield (front glass)
  c.fillStyle=isPlayer?'rgba(140,215,255,0.42)':'rgba(120,190,240,0.28)';
  if (typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(-bw/2+3,-bh/2+5,bw-6,bh*0.22,2);c.fill();
  } else { c.fillRect(-bw/2+3,-bh/2+5,bw-6,bh*0.22); }
  // Glass highlight
  c.fillStyle='rgba(255,255,255,0.14)';
  c.fillRect(-bw/2+4,-bh/2+6,bw/2-4,3);

  // Rear glass
  c.fillStyle=isPlayer?'rgba(100,170,220,0.30)':'rgba(90,155,200,0.18)';
  c.fillRect(-bw/2+3,bh/2-bh*0.22,bw-6,bh*0.18);

  // Damage dents (player only)
  if (isPlayer && car.damaged) {
    c.fillStyle='rgba(0,0,0,0.30)';
    car.dents.forEach(function(d){
      c.beginPath(); c.arc(d.lx,d.ly,3.5,0,Math.PI*2); c.fill();
      // Dent scratch line
      c.strokeStyle='rgba(0,0,0,0.45)'; c.lineWidth=1;
      c.beginPath(); c.moveTo(d.lx-3,d.ly); c.lineTo(d.lx+3,d.ly+2); c.stroke();
    });
  }

  // Outline
  c.strokeStyle='rgba(0,0,0,0.45)'; c.lineWidth=1; c.setLineDash([]);
  if (typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(-bw/2+1,-bh/2,bw-2,bh,r);c.stroke();
  } else {c.strokeRect(-bw/2+1,-bh/2,bw-2,bh);}

  c.restore();
}

// ── AI Cars ───────────────────────────────────────────────────
function rAICars(c) {
  G.aiCars.forEach(function(ai) {
    if (!ai.active) return;
    _drawCar(c, ai, ai.color, _darken(ai.color,35), false);
    // Headlights
    c.save(); c.translate(ai.x+Math.cos(ai.angle)*17, ai.y+Math.sin(ai.angle)*17);
    c.fillStyle='rgba(255,255,200,0.82)';
    c.beginPath();c.arc(-5,0,2.2,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(5,0,2.2,0,Math.PI*2);c.fill();
    c.restore();
    // Brake lights
    if (ai.waiting) {
      c.save(); c.translate(ai.x-Math.cos(ai.angle)*17, ai.y-Math.sin(ai.angle)*17);
      c.shadowColor='#ef4444'; c.shadowBlur=10;
      c.fillStyle='rgba(239,68,68,0.9)';
      c.beginPath();c.arc(-5,0,2.5,0,Math.PI*2);c.fill();
      c.beginPath();c.arc(5,0,2.5,0,Math.PI*2);c.fill();
      c.shadowBlur=0; c.restore();
    }
  });
}

// ── Police Car ────────────────────────────────────────────────
function rPolice(c) {
  G.police.forEach(function(pc) {
    _drawCar(c, pc, '#1d4ed8', '#1a3a9e', false);

    // White stripe
    c.save(); c.translate(pc.x,pc.y); c.rotate(pc.angle);
    c.fillStyle='rgba(255,255,255,0.5)'; c.fillRect(-10,-4,20,8);
    // "ЦАГДАА" label
    c.fillStyle='#fff'; c.font='bold 5px monospace'; c.textAlign='center';
    c.fillText('ЦАГДАА',0,2);
    c.restore();

    // Siren lights (flashing)
    if (pc.sirenOn) {
      var redOn=pc._lp<20;
      c.save(); c.translate(pc.x+Math.cos(pc.angle)*16,pc.y+Math.sin(pc.angle)*16);
      c.rotate(pc.angle);
      c.shadowColor=redOn?'#ef4444':'#3b82f6'; c.shadowBlur=20;
      c.fillStyle=redOn?'#ef4444':'#3b82f6';
      c.beginPath();c.arc(-4,0,4.5,0,Math.PI*2);c.fill();
      c.shadowColor=redOn?'#3b82f6':'#ef4444'; c.fillStyle=redOn?'#3b82f6':'#ef4444';
      c.beginPath();c.arc(4,0,4.5,0,Math.PI*2);c.fill();
      c.shadowBlur=0; c.restore();
    }

    // Dispatch radio animation
    if (pc._dispatchAnim && pc._dispatchTimer>0) {
      c.save(); c.translate(pc.x,pc.y);
      c.font='13px serif'; c.textAlign='center';
      c.globalAlpha=pc._dispatchTimer/90;
      c.fillText('📻',0,-pc.h/2-14);
      c.globalAlpha=1; c.restore();
    }
  });
}

// ── Player Car ────────────────────────────────────────────────
function rPlayer(c) {
  var p=G.player;
  if (p.crashed && G.frame%8<4) return;

  _drawCar(c, p, '#ff6a00', '#cc4400', true);

  // Headlights glow
  if (p.speed>0.3) {
    c.save();
    c.translate(p.x+Math.cos(p.angle)*20, p.y+Math.sin(p.angle)*20);
    c.shadowColor='#ffffaa'; c.shadowBlur=20;
    c.fillStyle='rgba(255,255,200,0.95)';
    c.beginPath();c.arc(-5,0,3,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(5,0,3,0,Math.PI*2);c.fill();
    c.shadowBlur=0; c.restore();
  }

  // Brake lights
  if (p.braking || p.crashed) {
    c.save();
    c.translate(p.x-Math.cos(p.angle)*20, p.y-Math.sin(p.angle)*20);
    c.shadowColor='#ef4444'; c.shadowBlur=18;
    c.fillStyle='rgba(239,68,68,0.95)';
    c.beginPath();c.arc(-5,0,3.5,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(5,0,3.5,0,Math.PI*2);c.fill();
    c.shadowBlur=0; c.restore();
  }

  // Horn indicator
  if (p.horn) {
    c.save(); c.translate(p.x,p.y);
    c.font='12px serif'; c.textAlign='center';
    c.globalAlpha=0.8+Math.sin(G.frame*0.4)*0.2;
    c.fillText('📯',0,-p.h/2-12);
    c.globalAlpha=1; c.restore();
  }

  // Health bar above car
  if (p.health<100) {
    c.save(); c.translate(p.x,p.y-p.h/2-12);
    c.fillStyle='rgba(0,0,0,0.5)'; c.fillRect(-15,-3,30,6);
    var hCol = p.health>60?'#22c55e':p.health>30?'#f59e0b':'#ef4444';
    c.fillStyle=hCol; c.fillRect(-15,-3,30*p.health/100,6);
    c.restore();
  }
}

// ── Particles ─────────────────────────────────────────────────
function rParticles(c) {
  G.particles.forEach(function(p) {
    c.globalAlpha=p.life/p.max;
    c.fillStyle=p.color;
    c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.fill();
  });
  c.globalAlpha=1;
}

// ── Utility ───────────────────────────────────────────────────
function _darken(hex, amt) {
  var n=parseInt(hex.replace('#',''),16);
  var r=Math.max(0,((n>>16)&0xff)-amt);
  var g=Math.max(0,((n>>8)&0xff)-amt);
  var b=Math.max(0,(n&0xff)-amt);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
