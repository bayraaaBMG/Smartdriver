'use strict';
// ═══════════════════════════════════════════════════════════════
//  RENDERER.JS — Oblique aerial city renderer
// ═══════════════════════════════════════════════════════════════

// Oblique y-compression factor (0.58 ≈ 55° aerial camera angle)
var OBL = 0.58;

function render() {
  var c = gctx;
  c.clearRect(0,0,GCW,GCH);
  c.save();
  c.scale(cam.zoom, cam.zoom * OBL);
  c.translate(-cam.x, -cam.y);

  rGround(c);
  rSpecialAreas(c);
  rBuildings(c);
  rRoads(c);
  rMarkings(c);
  rBoxJunctions(c);
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
  // Urban ground — warm mid-tone like UB city blocks
  c.fillStyle='#5a5450'; c.fillRect(0,0,WORLD.W,WORLD.H);
  // Subtle block variation
  c.fillStyle='rgba(0,0,0,0.05)';
  for (var x=0;x<WORLD.W;x+=80)
    for (var y=0;y<WORLD.H;y+=80)
      if (((x/80|0)+(y/80|0))%2===0) c.fillRect(x,y,80,80);
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
    // Prominent shadow (south-east direction for oblique feel)
    c.fillStyle='rgba(0,0,0,0.26)';
    c.fillRect(b.x+6,b.y+10,b.w,b.h);

    // Pseudo-3D SOUTH face — tall, visible due to oblique camera
    var wallH = Math.min(b.h * 0.38, 28);
    if (b.landmark) wallH = Math.min(b.h * 0.45, 40);
    c.fillStyle = _darken(b.col, 38);
    c.fillRect(b.x, b.y+b.h, b.w, wallH);

    // Pseudo-3D EAST face
    var wallW = Math.min(b.w * 0.14, 10);
    c.fillStyle = _darken(b.col, 52);
    c.fillRect(b.x+b.w, b.y+wallW*0.5, wallW, b.h+wallH-wallW*0.5);

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
      // Regular building outline
      c.strokeStyle='rgba(0,0,0,0.18)'; c.lineWidth=1; c.setLineDash([]);
      c.strokeRect(b.x,b.y,b.w,b.h);
      c.strokeStyle='rgba(255,255,255,0.07)'; c.lineWidth=1;
      c.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);

      // Window grid — deterministic lit/dark per position
      if (b.w>=24 && b.h>=18) {
        var ws=4, wg=5, mg=4;
        for (var wxi=b.x+mg; wxi<b.x+b.w-mg-ws; wxi+=ws+wg) {
          for (var wyi=b.y+mg; wyi<b.y+b.h-mg-3; wyi+=ws+wg) {
            var h=((Math.round(wxi)*31)^(Math.round(wyi)*37))&0xff;
            c.fillStyle = h>165 ? 'rgba(255,240,130,0.17)' : 'rgba(100,155,255,0.08)';
            c.fillRect(wxi, wyi, ws, 3);
          }
        }
      }
    }
  });
}

// ── Roads ─────────────────────────────────────────────────────
var SW=14; // sidewalk width
function rRoads(c) {
  // Wide sidewalks — warm UB concrete (tan/beige)
  c.fillStyle='#c0a87c';
  wRoads.forEach(function(r) {
    if (r.horiz) {
      c.fillRect(r.x0,r.y0-SW,r.len,SW);
      c.fillRect(r.x0,r.y0+r.h,r.len,SW);
    } else {
      c.fillRect(r.x0-SW,r.y0,SW,r.len);
      c.fillRect(r.x0+r.w,r.y0,SW,r.len);
    }
  });
  // Kerb shadow line
  c.fillStyle='rgba(0,0,0,0.20)';
  wRoads.forEach(function(r) {
    if (r.horiz) {
      c.fillRect(r.x0,r.y0-2,r.len,2);
      c.fillRect(r.x0,r.y0+r.h,r.len,2);
    } else {
      c.fillRect(r.x0-2,r.y0,2,r.len);
      c.fillRect(r.x0+r.w,r.y0,2,r.len);
    }
  });

  // Intersection corner boxes
  c.fillStyle='#686870';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw,n.y-n.hw,n.vw*2,n.hw*2);
  });

  // Road surfaces — realistic light-gray asphalt (like reference)
  c.fillStyle='#6e6e74';
  wRoads.forEach(function(r) {
    if (r.horiz) c.fillRect(r.x0,r.y0,r.len,r.h);
    else         c.fillRect(r.x0,r.y0,r.w,r.len);
  });

  // Green medians on wide roads (lpd≥3 = Энхтайваны өргөн чөлөө)
  // Much wider, lush, with texture — matching reference photo
  wRoads.forEach(function(r) {
    if (r.lpd < 3) return;
    var mw = 42; // wide green median like reference
    if (r.horiz) {
      // Dark base green
      c.fillStyle='#2a5018';
      c.fillRect(r.x0, r.yCen-mw/2, r.len, mw);
      // Mid-tone green patches
      c.fillStyle='#3c6a22';
      for (var mx=r.x0; mx<r.x0+r.len; mx+=48) {
        c.fillRect(mx+4, r.yCen-mw/2+4, 40, mw-8);
      }
      // Light green center strip
      c.fillStyle='rgba(90,160,50,0.45)';
      c.fillRect(r.x0, r.yCen-6, r.len, 12);
      // Occasional flower/shrub dots
      c.fillStyle='rgba(200,180,50,0.55)';
      for (var fx=r.x0+60; fx<r.x0+r.len; fx+=120) {
        c.beginPath(); c.arc(fx, r.yCen, 7, 0, Math.PI*2); c.fill();
      }
    } else {
      c.fillStyle='#2a5018';
      c.fillRect(r.xCen-mw/2, r.y0, mw, r.len);
      c.fillStyle='#3c6a22';
      for (var my=r.y0; my<r.y0+r.len; my+=48) {
        c.fillRect(r.xCen-mw/2+4, my+4, mw-8, 40);
      }
      c.fillStyle='rgba(90,160,50,0.45)';
      c.fillRect(r.xCen-6, r.y0, 12, r.len);
    }
  });

  // Re-draw intersection area (covers median at crossing)
  c.fillStyle='#686870';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw,n.y-n.hw,n.vw*2,n.hw*2);
  });
  // Slightly lighter road surface inside intersection
  c.fillStyle='#6e6e74';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw,n.y-n.hw,n.vw*2,n.hw*2);
  });
}

// ── Lane markings ─────────────────────────────────────────────
function rMarkings(c) {
  wRoads.forEach(function(r) {
    var D  = r.horiz ? r.h : r.w;
    var lw = D / (r.lpd * 2);

    // Edge lines (white, crisp)
    c.strokeStyle='rgba(255,252,245,0.90)'; c.lineWidth=2.5; c.setLineDash([]);
    if (r.horiz) {
      _hLine(c,r.x0,r.y0+1.5,r.len); _hLine(c,r.x0,r.y0+r.h-1.5,r.len);
    } else {
      _vLine(c,r.x0+1.5,r.y0,r.len); _vLine(c,r.x0+r.w-1.5,r.y0,r.len);
    }

    // Double-yellow center (skip for wide roads that have green median)
    if (r.lpd < 3) {
      c.strokeStyle='rgba(255,205,30,0.92)'; c.lineWidth=2;
      if (r.horiz) {
        _hLine(c,r.x0,r.yCen-3,r.len); _hLine(c,r.x0,r.yCen+3,r.len);
      } else {
        _vLine(c,r.xCen-3,r.y0,r.len); _vLine(c,r.xCen+3,r.y0,r.len);
      }
    }

    // Dashed lane dividers (white on lighter asphalt)
    c.strokeStyle='rgba(255,252,245,0.55)'; c.lineWidth=1.5;
    for (var i=1; i<r.lpd*2; i++) {
      if (i===r.lpd) continue;
      if (r.horiz) {
        var y=r.y0+lw*i; c.setLineDash([18,12]); _hLine(c,r.x0,y,r.len);
      } else {
        var x=r.x0+lw*i; c.setLineDash([14,10]); _vLine(c,x,r.y0,r.len);
      }
    }
    c.setLineDash([]);
  });

  // Stop lines at each intersection approach (drawn once, outside the road loop)
  c.strokeStyle='rgba(240,235,210,0.72)'; c.lineWidth=3; c.setLineDash([]);
  wInters.forEach(function(n) {
    var so=5; // offset just outside intersection edge
    c.beginPath(); c.moveTo(n.x-n.vw, n.y-n.hw-so); c.lineTo(n.x+n.vw, n.y-n.hw-so); c.stroke();
    c.beginPath(); c.moveTo(n.x-n.vw, n.y+n.hw+so); c.lineTo(n.x+n.vw, n.y+n.hw+so); c.stroke();
    c.beginPath(); c.moveTo(n.x-n.vw-so, n.y-n.hw); c.lineTo(n.x-n.vw-so, n.y+n.hw); c.stroke();
    c.beginPath(); c.moveTo(n.x+n.vw+so, n.y-n.hw); c.lineTo(n.x+n.vw+so, n.y+n.hw); c.stroke();
  });

  // Lane direction arrows
  c.fillStyle='rgba(255,255,255,0.20)';
  wRoads.forEach(function(r) {
    var D  = r.horiz ? r.h : r.w;
    var lw = D / (r.lpd * 2);
    for (var li=0; li<r.lpd*2; li++) {
      if (li===r.lpd) continue;
      var isPos = li >= r.lpd; // positive direction (east / south)
      var laneCenter = (li+0.5)*lw;
      var angle = r.horiz
        ? (isPos ? 0 : Math.PI)
        : (isPos ? Math.PI/2 : -Math.PI/2);
      for (var ap=280; ap<r.len; ap+=480) {
        if (r.horiz) {
          var ax=r.x0+ap, ay=r.y0+laneCenter;
          if (!_isInterArea(ax,ay)) _drawRoadArrow(c,ax,ay,angle);
        } else {
          var ax2=r.x0+laneCenter, ay2=r.y0+ap;
          if (!_isInterArea(ax2,ay2)) _drawRoadArrow(c,ax2,ay2,angle);
        }
      }
    }
  });

  wRoads.forEach(function(r) {
    var D  = r.horiz ? r.h : r.w;
    var lw = D / (r.lpd * 2);
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

// ── Box Junction (UB style: simple yellow border outline) ────
function rBoxJunctions(c) {
  c.strokeStyle='rgba(255,198,0,0.30)';
  c.lineWidth=2; c.setLineDash([]);
  wInters.forEach(function(n) {
    c.strokeRect(n.x-n.vw+2, n.y-n.hw+2, n.vw*2-4, n.hw*2-4);
  });
}

// ── Lane direction arrow ───────────────────────────────────────
function _drawRoadArrow(c, x, y, angle) {
  c.save(); c.translate(x,y); c.rotate(angle);
  c.beginPath();
  c.moveTo(10,0); c.lineTo(2,-5); c.lineTo(2,-2);
  c.lineTo(-8,-2); c.lineTo(-8,2); c.lineTo(2,2);
  c.lineTo(2,5); c.closePath(); c.fill();
  c.restore();
}

// ── Crosswalks (UB style: white zebra stripes) ───────────────
function rCrosswalks(c) {
  var stripe=10, gap=7, count=5;
  wInters.forEach(function(n) {
    for (var i=0;i<count;i++) {
      var off = 4+i*(stripe+gap);
      c.fillStyle='rgba(248,244,238,0.90)';
      // N approach (above)
      c.fillRect(n.x-n.vw, n.y-n.hw-off-stripe, n.vw*2, stripe);
      // S approach (below)
      c.fillRect(n.x-n.vw, n.y+n.hw+off, n.vw*2, stripe);
      // W approach (left)
      c.fillRect(n.x-n.vw-off-stripe, n.y-n.hw, stripe, n.hw*2);
      // E approach (right)
      c.fillRect(n.x+n.vw+off, n.y-n.hw, stripe, n.hw*2);
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
    var r = t.r * 1.25; // trees appear larger in oblique view
    // South shadow (cast direction matches oblique camera)
    c.fillStyle='rgba(0,0,0,0.32)';
    c.beginPath(); c.ellipse(t.x+4, t.y+r*0.75, r*0.72, r*0.42, 0.2, 0, Math.PI*2); c.fill();
    // Canopy outer ring
    c.fillStyle=t.b;
    c.beginPath(); c.arc(t.x,t.y,r,0,Math.PI*2); c.fill();
    // Canopy center (brighter)
    var g=c.createRadialGradient(t.x-r*0.25,t.y-r*0.25,0,t.x,t.y,r);
    g.addColorStop(0,t.a); g.addColorStop(0.55,t.b); g.addColorStop(1,'#122008');
    c.fillStyle=g;
    c.beginPath(); c.arc(t.x,t.y,r*0.88,0,Math.PI*2); c.fill();
    // Top highlight
    c.fillStyle='rgba(160,220,90,0.18)';
    c.beginPath(); c.arc(t.x-r*0.22,t.y-r*0.22,r*0.38,0,Math.PI*2); c.fill();
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
    if (p.state==='scared') c.globalAlpha=0.55;

    // Ground shadow
    c.fillStyle='rgba(0,0,0,0.30)';
    c.beginPath(); c.ellipse(1,4,4.5,2.5,0,0,Math.PI*2); c.fill();

    // Legs
    var sw = p.state==='crossing' ? Math.sin(p._walkPhase)*3.5 : 0;
    c.strokeStyle='rgba(45,35,35,0.92)'; c.lineWidth=2.5;
    c.beginPath(); c.moveTo(-2,3); c.lineTo(-3+sw,9); c.stroke();
    c.beginPath(); c.moveTo(2,3);  c.lineTo(3-sw,9);  c.stroke();

    // Body / shirt
    c.fillStyle=p.shirt;
    if (typeof c.roundRect==='function') {
      c.beginPath(); c.roundRect(-4,-7,8,10,2); c.fill();
    } else { c.fillRect(-4,-7,8,10); }

    // Arms
    c.strokeStyle=p.skin; c.lineWidth=2;
    c.beginPath(); c.moveTo(-4,-3); c.lineTo(-6+sw,-1+sw*0.5); c.stroke();
    c.beginPath(); c.moveTo(4,-3);  c.lineTo(6-sw,-1-sw*0.5); c.stroke();

    // Head
    c.fillStyle=p.skin;
    c.beginPath(); c.arc(0,-12,4.5,0,Math.PI*2); c.fill();
    // Hair (top arc)
    c.fillStyle='rgba(30,20,10,0.55)';
    c.beginPath(); c.arc(0,-13,3.8,Math.PI,0); c.fill();
    // Eye dots
    c.fillStyle='rgba(0,0,0,0.6)';
    c.fillRect(-2,-12,1.5,1.5);
    c.fillRect(1,-12,1.5,1.5);

    c.globalAlpha=1; c.restore();
  });
}

// ── Car drawing helper (handles multiple vehicle types) ───────
function _drawCar(c, car, bodyColor, darkColor, isPlayer) {
  c.save(); c.translate(car.x,car.y); c.rotate(car.angle);
  var bw=car.w, bh=car.h;
  var vtype = car.vtype || 'sedan';
  var cr = isPlayer ? 4 : (vtype==='bus'||vtype==='van' ? 2 : 3);

  // Drop shadow (depth feel)
  c.fillStyle='rgba(0,0,0,0.30)';
  c.fillRect(-bw/2+4,-bh/2+6,bw+1,bh+1);

  // ── Wheels ──────────────────────────────────────────────
  var wxo = bw/2+1.5;
  var wra = (vtype==='bus'||vtype==='suv') ? 4.2 : 3.5;
  var wrb = (vtype==='bus') ? 6.5 : (vtype==='suv'||vtype==='van') ? 5.5 : 4.8;
  var wyf = -bh/2 + (vtype==='bus' ? 12 : vtype==='van' ? 10 : 7);
  var wyr =  bh/2 - (vtype==='bus' ? 12 : vtype==='van' ? 10 : 7);

  c.fillStyle='#111';
  var _wheel = function(ox,oy){ c.beginPath();c.ellipse(ox,oy,wra,wrb,0,0,Math.PI*2);c.fill(); };
  _wheel(-wxo,wyf); _wheel(wxo,wyf); _wheel(-wxo,wyr); _wheel(wxo,wyr);
  // Bus: middle axle
  if (vtype==='bus') { _wheel(-wxo,0); _wheel(wxo,0); }

  c.fillStyle='rgba(185,185,185,0.45)'; // rim highlight
  var _rim = function(ox,oy){ c.beginPath();c.ellipse(ox,oy,wra*0.46,wrb*0.46,0,0,Math.PI*2);c.fill(); };
  _rim(-wxo,wyf); _rim(wxo,wyf); _rim(-wxo,wyr); _rim(wxo,wyr);
  if (vtype==='bus') { _rim(-wxo,0); _rim(wxo,0); }

  // ── Side mirrors ────────────────────────────────────────
  if (vtype!=='bus') {
    c.fillStyle=darkColor;
    c.fillRect(-bw/2-3, -bh*0.17, 3, 4);
    c.fillRect( bw/2,   -bh*0.17, 3, 4);
  }

  // ── Body ────────────────────────────────────────────────
  var bg=c.createLinearGradient(-bw/2,0,bw/2,0);
  bg.addColorStop(0,darkColor);
  bg.addColorStop(0.22,bodyColor);
  bg.addColorStop(0.78,bodyColor);
  bg.addColorStop(1,darkColor);
  c.fillStyle=bg;
  if (typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(-bw/2+1,-bh/2,bw-2,bh,cr);c.fill();
  } else {c.fillRect(-bw/2+1,-bh/2,bw-2,bh);}

  // ── Bus: windows along sides ─────────────────────────
  if (vtype==='bus') {
    c.fillStyle='rgba(140,200,255,0.22)';
    for (var wy=-bh/2+14; wy<bh/2-16; wy+=12) {
      c.fillRect(-bw/2+2, wy, 4, 8);
      c.fillRect( bw/2-6, wy, 4, 8);
    }
    // Bus front plate
    c.fillStyle='rgba(255,255,255,0.08)';
    c.fillRect(-bw/2+2, -bh/2+2, bw-4, 4);
  }

  // ── Roof panel ──────────────────────────────────────────
  var roofFrac = (vtype==='suv') ? 0.46 : (vtype==='van'||vtype==='bus') ? 0.5 : 0.40;
  var rg=c.createLinearGradient(-bw/2,0,bw/2,0);
  rg.addColorStop(0,'rgba(0,0,0,0.25)');
  rg.addColorStop(0.5,isPlayer?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.04)');
  rg.addColorStop(1,'rgba(0,0,0,0.25)');
  c.fillStyle=rg;
  if (vtype!=='bus') c.fillRect(-bw/2+2, -bh*roofFrac/2, bw-4, bh*roofFrac);

  // ── Windshield (front glass) ─────────────────────────────
  var wsFrac = (vtype==='bus') ? 0.14 : (vtype==='van') ? 0.18 : 0.22;
  c.fillStyle=isPlayer?'rgba(140,215,255,0.44)':'rgba(120,190,240,0.26)';
  if (typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(-bw/2+3,-bh/2+4,bw-6,bh*wsFrac,2);c.fill();
  } else {c.fillRect(-bw/2+3,-bh/2+4,bw-6,bh*wsFrac);}
  // Glass shine
  c.fillStyle='rgba(255,255,255,0.13)';
  c.fillRect(-bw/2+4,-bh/2+5,(bw-8)/2,3);

  // ── Rear glass ──────────────────────────────────────────
  if (vtype!=='van' && vtype!=='bus') {
    c.fillStyle=isPlayer?'rgba(100,170,220,0.30)':'rgba(90,155,200,0.16)';
    c.fillRect(-bw/2+3,bh/2-bh*0.22,bw-6,bh*0.16);
  }

  // ── Taxi sign ────────────────────────────────────────────
  if (vtype==='taxi') {
    c.fillStyle='rgba(0,0,0,0.7)';
    c.fillRect(-6,-bh/2-5,12,5);
    c.fillStyle='#fbbf24';
    c.font='bold 4px monospace'; c.textAlign='center';
    c.fillText('ТАКСИ',0,-bh/2-1.5);
  }

  // ── Player highlight ────────────────────────────────────
  if (isPlayer) {
    c.strokeStyle='rgba(255,106,0,0.55)';
    c.lineWidth=1.5; c.setLineDash([3,3]);
    c.beginPath();
    if (typeof c.roundRect==='function') c.roundRect(-bw/2-3,-bh/2-3,bw+6,bh+6,cr+2);
    else c.rect(-bw/2-3,-bh/2-3,bw+6,bh+6);
    c.stroke(); c.setLineDash([]);
  }

  // ── Damage dents (player only) ───────────────────────────
  if (isPlayer && car.damaged) {
    c.fillStyle='rgba(0,0,0,0.30)';
    car.dents.forEach(function(d){
      c.beginPath(); c.arc(d.lx,d.ly,3.5,0,Math.PI*2); c.fill();
      c.strokeStyle='rgba(0,0,0,0.45)'; c.lineWidth=1;
      c.beginPath(); c.moveTo(d.lx-3,d.ly); c.lineTo(d.lx+3,d.ly+2); c.stroke();
    });
  }

  // ── Outline ──────────────────────────────────────────────
  c.strokeStyle='rgba(0,0,0,0.42)'; c.lineWidth=1; c.setLineDash([]);
  if (typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(-bw/2+1,-bh/2,bw-2,bh,cr);c.stroke();
  } else {c.strokeRect(-bw/2+1,-bh/2,bw-2,bh);}

  c.restore();
}

// ── AI Cars ───────────────────────────────────────────────────
function rAICars(c) {
  G.aiCars.forEach(function(ai) {
    if (!ai.active) return;
    _drawCar(c, ai, ai.color, _darken(ai.color,35), false);
    var fOff = ai.h/2+2, rOff = ai.h/2+2;
    // Headlights
    c.save(); c.translate(ai.x+Math.cos(ai.angle)*fOff, ai.y+Math.sin(ai.angle)*fOff);
    c.fillStyle='rgba(255,255,200,0.82)';
    var hlr = ai.vtype==='bus' ? 3 : 2.2;
    c.beginPath();c.arc(-5,0,hlr,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(5,0,hlr,0,Math.PI*2);c.fill();
    c.restore();
    // Brake lights
    if (ai.waiting) {
      c.save(); c.translate(ai.x-Math.cos(ai.angle)*rOff, ai.y-Math.sin(ai.angle)*rOff);
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
