'use strict';
// ═══════════════════════════════════════════════════════════════
//  RENDERER.JS — Premium oblique-aerial city renderer
//  Virtual urban driving simulator — cinematic quality
// ═══════════════════════════════════════════════════════════════

var OBL = 0.58;

function render() {
  var c = gctx;
  c.clearRect(0,0,GCW,GCH);
  c.save();
  c.scale(cam.zoom, cam.zoom * OBL);
  c.translate(-cam.x, -cam.y);

  rGround(c);
  rParkingLots(c);
  rSpecialAreas(c);
  rBuildings(c);
  rRoads(c);
  rMarkings(c);
  rIntersectionDetail(c);
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

  if (G._flash > 0.01) {
    c.fillStyle = 'rgba(239,68,68,' + G._flash + ')';
    c.fillRect(0,0,GCW,GCH);
    G._flash *= 0.85;
  }
}

// ── Ground — city block variation ─────────────────────────────
var _blockTones = ['#46413c','#48433d','#454039','#4a443e','#474239','#4c4740'];
function rGround(c) {
  // Base fill
  c.fillStyle = '#45403b';
  c.fillRect(0, 0, WORLD.W, WORLD.H);

  // Per-block tone variation using road grid
  var xs = [0], ys = [0];
  wRoads.forEach(function(r) {
    if (r.horiz) { ys.push(r.y0); ys.push(r.y0+r.h); }
    else         { xs.push(r.x0); xs.push(r.x0+r.w); }
  });
  xs.push(WORLD.W); ys.push(WORLD.H);
  xs.sort(function(a,b){return a-b;}); ys.sort(function(a,b){return a-b;});

  for (var xi = 0; xi < xs.length-1; xi++) {
    for (var yi = 0; yi < ys.length-1; yi++) {
      var bi = (xi*3+yi*7) % _blockTones.length;
      c.fillStyle = _blockTones[bi];
      c.fillRect(xs[xi], ys[yi], xs[xi+1]-xs[xi], ys[yi+1]-ys[yi]);
      // Subtle pavement grid lines
      c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 1; c.setLineDash([]);
      var gx, gy;
      for (gx = xs[xi]; gx < xs[xi+1]; gx += 55) {
        c.beginPath(); c.moveTo(gx,ys[yi]); c.lineTo(gx,ys[yi+1]); c.stroke();
      }
      for (gy = ys[yi]; gy < ys[yi+1]; gy += 55) {
        c.beginPath(); c.moveTo(xs[xi],gy); c.lineTo(xs[xi+1],gy); c.stroke();
      }
    }
  }
}

// ── Parking lots ──────────────────────────────────────────────
function rParkingLots(c) {
  if (typeof wParkingLots === 'undefined') return;
  wParkingLots.forEach(function(p) {
    // Base surface — slightly lighter asphalt than road
    c.fillStyle = '#5e5a54';
    c.fillRect(p.x, p.y, p.w, p.h);
    // Faded edge lines
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.8; c.setLineDash([]);
    c.strokeRect(p.x, p.y, p.w, p.h);
    // Parking bay lines
    var slotW = p.w / p.cols;
    var slotH = p.h / p.rows;
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.2; c.setLineDash([]);
    // Vertical dividers
    for (var col = 1; col < p.cols; col++) {
      var lx = p.x + col * slotW;
      c.beginPath(); c.moveTo(lx, p.y+2); c.lineTo(lx, p.y+p.h-2); c.stroke();
    }
    // Horizontal rows
    for (var row = 1; row < p.rows; row++) {
      var ly = p.y + row * slotH;
      c.beginPath(); c.moveTo(p.x+2, ly); c.lineTo(p.x+p.w-2, ly); c.stroke();
    }
    // Parked cars (static, deterministic)
    for (var ci = 0; ci < p.cols; ci++) {
      for (var ri = 0; ri < p.rows; ri++) {
        var seed = (p.x/10|0)*17 + ci*7 + ri*13;
        if ((seed % 5) === 1) continue; // skip slot = empty space
        var pcx = p.x + (ci+0.5)*slotW;
        var pcy = p.y + (ri+0.5)*slotH;
        var pcw = slotW*0.72, pch = slotH*0.58;
        var pCols = ['#8a7a6a','#5a6a7a','#6a5a5a','#7a7060','#9a9090','#707868'];
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(pcx-pcw/2+2, pcy-pch/2+3, pcw, pch);
        c.fillStyle = pCols[seed % pCols.length];
        c.fillRect(pcx-pcw/2, pcy-pch/2, pcw, pch);
        c.fillStyle = 'rgba(160,210,255,0.18)';
        c.fillRect(pcx-pcw/2+2, pcy-pch/2+2, pcw-4, pch*0.28);
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8;
        c.strokeRect(pcx-pcw/2, pcy-pch/2, pcw, pch);
      }
    }
  });
}

// ── Special areas ─────────────────────────────────────────────
function rSpecialAreas(c) {
  var sq = SUKHBAATAR_SQ;

  // Granite/stone plaza
  var g = c.createLinearGradient(sq.x, sq.y, sq.x+sq.w, sq.y+sq.h);
  g.addColorStop(0, '#848070'); g.addColorStop(0.5, '#7a7668'); g.addColorStop(1, '#706c5e');
  c.fillStyle = g;
  c.fillRect(sq.x, sq.y, sq.w, sq.h);

  // Stone tile grid
  c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 0.7;
  for (var tx = sq.x; tx < sq.x+sq.w; tx += 18) {
    c.beginPath(); c.moveTo(tx,sq.y); c.lineTo(tx,sq.y+sq.h); c.stroke();
  }
  for (var ty = sq.y; ty < sq.y+sq.h; ty += 18) {
    c.beginPath(); c.moveTo(sq.x,ty); c.lineTo(sq.x+sq.w,ty); c.stroke();
  }
  // Edge kerb
  c.strokeStyle = 'rgba(255,255,255,0.20)'; c.lineWidth = 2.5; c.setLineDash([]);
  c.strokeRect(sq.x+3, sq.y+3, sq.w-6, sq.h-6);

  // Chinggis statue base
  var fx = sq.flagX, fy = sq.flagY;
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath(); c.ellipse(fx+5,fy+6,24,12,0,0,Math.PI*2); c.fill();
  c.fillStyle = '#a0907a';
  c.beginPath(); c.arc(fx,fy,22,0,Math.PI*2); c.fill();
  c.fillStyle = '#c8b090';
  c.beginPath(); c.arc(fx,fy,16,0,Math.PI*2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath(); c.arc(fx-5,fy-5,7,0,Math.PI*2); c.fill();

  // Label
  c.font = 'bold 12px "JetBrains Mono",monospace';
  c.fillStyle = 'rgba(255,255,255,0.50)'; c.textAlign = 'center';
  c.fillText('★ ' + sq.name + ' ★', sq.x+sq.w/2, sq.y+sq.h/2-5);
  c.font = '8px "JetBrains Mono",monospace';
  c.fillStyle = 'rgba(255,255,255,0.24)';
  c.fillText('Улаанбаатар хотын зүрх', sq.x+sq.w/2, sq.y+sq.h/2+10);

  // Park landmark
  LANDMARKS.forEach(function(lm) {
    if (lm[7] !== 'park') return;
    c.fillStyle = '#223818';
    c.fillRect(lm[0],lm[1],lm[2],lm[3]);
    c.fillStyle = 'rgba(48,82,24,0.6)';
    for (var px = lm[0]+8; px < lm[0]+lm[2]-8; px += 16)
      for (var py = lm[1]+8; py < lm[1]+lm[3]-8; py += 16)
        c.fillRect(px,py,8,8);
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1.5;
    c.strokeRect(lm[0],lm[1],lm[2],lm[3]);
  });
}

// ── Buildings — premium pseudo-3D ─────────────────────────────
function rBuildings(c) {
  wBuildings.forEach(function(b) {
    var isLmark = b.landmark;
    var wallH = Math.min(b.h * (isLmark ? 0.48 : 0.40), isLmark ? 38 : 22);
    var wallW = Math.min(b.w * 0.14, isLmark ? 12 : 7);

    // === 1. Soft drop shadow (SE direction) ===
    var sdx = isLmark ? 16 : 9, sdy = isLmark ? 20 : 14;
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(b.x+sdx, b.y+sdy, b.w+wallW, b.h+wallH*0.5);

    // === 2. South face (most visible in oblique view) ===
    c.fillStyle = _darken(b.col, 48);
    c.fillRect(b.x, b.y+b.h, b.w+wallW*0.6, wallH);

    // === 3. East face ===
    c.fillStyle = _darken(b.col, 62);
    c.fillRect(b.x+b.w, b.y + wallH*0.3, wallW, b.h + wallH*0.7);

    // === 4. Roof body with gradient ===
    if (b.w >= 28 && b.h >= 22) {
      var bg = c.createLinearGradient(b.x, b.y, b.x+b.w*0.65, b.y+b.h*0.6);
      bg.addColorStop(0, _lighten(b.col, 18));
      bg.addColorStop(0.45, _lighten(b.col, 6));
      bg.addColorStop(1, _darken(b.col, 8));
      c.fillStyle = bg;
    } else {
      c.fillStyle = b.col;
    }
    _rrect(c, b.x, b.y, b.w, b.h, isLmark ? 4 : 2, true, false);

    // === 5. Landmark special features ===
    if (isLmark) {
      if (b.rCol) {
        c.fillStyle = b.rCol;
        c.fillRect(b.x+2, b.y+2, b.w-4, Math.min(18, b.h*0.28));
      }
      c.strokeStyle = 'rgba(0,0,0,0.32)'; c.lineWidth = 1.5; c.setLineDash([]);
      _rrect(c, b.x, b.y, b.w, b.h, 4, false, true);
      c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1;
      _rrect(c, b.x+2, b.y+2, b.w-4, b.h-4, 3, false, true);

      if (b.w > 50 && b.h > 30) {
        c.font = 'bold ' + (b.type==='tower'?'8':'7') + 'px monospace';
        c.fillStyle = 'rgba(255,255,255,0.60)'; c.textAlign = 'center';
        c.fillText(b.name||'', b.x+b.w/2, b.y+b.h/2 + (b.type==='tower'?2:3));
      }
      if (b.type === 'tower') {
        for (var wy = b.y+6; wy < b.y+b.h-4; wy += 12) {
          c.fillStyle = 'rgba(120,210,255,0.28)';
          c.fillRect(b.x+3, wy, b.w-6, 7);
        }
        c.strokeStyle = 'rgba(100,190,255,0.55)'; c.lineWidth = 1.5;
        _rrect(c, b.x, b.y, b.w, b.h, 4, false, true);
      }
    } else {
      // === 6. Regular building: outline + windows ===
      c.strokeStyle = 'rgba(0,0,0,0.20)'; c.lineWidth = 0.8; c.setLineDash([]);
      _rrect(c, b.x, b.y, b.w, b.h, 2, false, true);

      if (b.w >= 26 && b.h >= 18) {
        var wsp = 4, wgp = 4, mgp = 4;
        for (var wxi = b.x+mgp; wxi < b.x+b.w-mgp-wsp; wxi += wsp+wgp) {
          for (var wyi = b.y+mgp; wyi < b.y+b.h-mgp-2; wyi += wsp+wgp) {
            var wh2 = ((Math.round(wxi)*31)^(Math.round(wyi)*37)) & 0xff;
            c.fillStyle = wh2>170 ? 'rgba(255,245,140,0.22)' : 'rgba(140,190,255,0.10)';
            c.fillRect(wxi, wyi, wsp, 3);
          }
        }
      }
    }
  });
}

// ── Roads ─────────────────────────────────────────────────────
var SW = 16; // sidewalk width (wider = more visible)
function rRoads(c) {
  // Wide sidewalk — warm UB concrete
  wRoads.forEach(function(r) {
    if (r.horiz) {
      _fillSW(c, r.x0, r.y0-SW, r.len, SW);
      _fillSW(c, r.x0, r.y0+r.h, r.len, SW);
    } else {
      _fillSW(c, r.x0-SW, r.y0, SW, r.len);
      _fillSW(c, r.x0+r.w, r.y0, SW, r.len);
    }
  });

  // Sidewalk-to-road shadow (kerb shadow)
  c.fillStyle = 'rgba(0,0,0,0.28)';
  wRoads.forEach(function(r) {
    if (r.horiz) {
      c.fillRect(r.x0, r.y0-3, r.len, 3);
      c.fillRect(r.x0, r.y0+r.h, r.len, 3);
    } else {
      c.fillRect(r.x0-3, r.y0, 3, r.len);
      c.fillRect(r.x0+r.w, r.y0, 3, r.len);
    }
  });

  // Intersection base (covers sidewalk corners)
  c.fillStyle = '#62626c';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw, n.y-n.hw, n.vw*2, n.hw*2);
  });

  // Road surfaces with gradient
  wRoads.forEach(function(r) {
    var g;
    if (r.horiz) g = c.createLinearGradient(0, r.y0, 0, r.y0+r.h);
    else         g = c.createLinearGradient(r.x0, 0, r.x0+r.w, 0);
    g.addColorStop(0,    '#575760');
    g.addColorStop(0.10, '#636370');
    g.addColorStop(0.50, '#727278');
    g.addColorStop(0.90, '#636370');
    g.addColorStop(1,    '#575760');
    c.fillStyle = g;
    if (r.horiz) c.fillRect(r.x0, r.y0, r.len, r.h);
    else         c.fillRect(r.x0, r.y0, r.w, r.len);

    // Tyre-worn center strip (slightly darker band from traffic)
    var trw = (r.horiz ? r.h : r.w) * 0.18;
    c.fillStyle = 'rgba(0,0,0,0.05)';
    if (r.horiz) {
      c.fillRect(r.x0, r.yCen - trw/2, r.len, trw);
    } else {
      c.fillRect(r.xCen - trw/2, r.y0, trw, r.len);
    }
  });

  // Green medians — lush, multi-layer (wide roads lpd≥3)
  wRoads.forEach(function(r) {
    if (r.lpd < 3) return;
    var mw = 44;
    if (r.horiz) {
      // Dark base
      c.fillStyle = '#264c16';
      c.fillRect(r.x0, r.yCen-mw/2, r.len, mw);
      // Mid green patches
      c.fillStyle = '#386220';
      for (var mx = r.x0; mx < r.x0+r.len; mx += 52)
        c.fillRect(mx+3, r.yCen-mw/2+3, 46, mw-6);
      // Bright stripe
      c.fillStyle = 'rgba(80,148,40,0.42)';
      c.fillRect(r.x0, r.yCen-7, r.len, 14);
      // Flower/shrub cluster dots
      for (var fdx = r.x0+55; fdx < r.x0+r.len; fdx += 108) {
        c.fillStyle = 'rgba(210,190,50,0.50)';
        c.beginPath(); c.arc(fdx, r.yCen, 7, 0, Math.PI*2); c.fill();
        c.fillStyle = 'rgba(180,210,60,0.35)';
        c.beginPath(); c.arc(fdx-14, r.yCen+4, 5, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(fdx+14, r.yCen-4, 5, 0, Math.PI*2); c.fill();
      }
      // Kerb edge lines on median
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(r.x0, r.yCen-mw/2-1, r.len, 2);
      c.fillRect(r.x0, r.yCen+mw/2-1, r.len, 2);
    } else {
      c.fillStyle = '#264c16';
      c.fillRect(r.xCen-mw/2, r.y0, mw, r.len);
      c.fillStyle = '#386220';
      for (var my = r.y0; my < r.y0+r.len; my += 52)
        c.fillRect(r.xCen-mw/2+3, my+3, mw-6, 46);
      c.fillStyle = 'rgba(80,148,40,0.42)';
      c.fillRect(r.xCen-7, r.y0, 14, r.len);
    }
  });

  // Re-fill intersection over median
  c.fillStyle = '#62626c';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw, n.y-n.hw, n.vw*2, n.hw*2);
  });
  c.fillStyle = '#6a6a72';
  wInters.forEach(function(n) {
    c.fillRect(n.x-n.vw+1, n.y-n.hw+1, n.vw*2-2, n.hw*2-2);
  });
}

function _fillSW(c, x, y, w, h) {
  // Main sidewalk tone
  c.fillStyle = '#c8b48c';
  c.fillRect(x, y, w, h);
  // Subtle tile pattern
  c.fillStyle = 'rgba(0,0,0,0.06)';
  var step = 14;
  if (w > h) {
    for (var sx = x; sx < x+w; sx += step)
      if (((sx/step|0) + 1) % 2 === 0) c.fillRect(sx, y, step, h);
  } else {
    for (var sy = y; sy < y+h; sy += step)
      if (((sy/step|0) + 1) % 2 === 0) c.fillRect(x, sy, w, step);
  }
}

// ── Lane markings ─────────────────────────────────────────────
function rMarkings(c) {
  wRoads.forEach(function(r) {
    var D = r.horiz ? r.h : r.w;
    var lw = D / (r.lpd * 2);

    // Edge lines — crisp white
    c.strokeStyle = 'rgba(240,236,220,0.88)'; c.lineWidth = 2.5; c.setLineDash([]);
    if (r.horiz) {
      _hLine(c, r.x0, r.y0+1.5, r.len);
      _hLine(c, r.x0, r.y0+r.h-1.5, r.len);
    } else {
      _vLine(c, r.x0+1.5, r.y0, r.len);
      _vLine(c, r.x0+r.w-1.5, r.y0, r.len);
    }

    // Double yellow center (narrow roads only)
    if (r.lpd < 3) {
      c.strokeStyle = 'rgba(255,200,20,0.88)'; c.lineWidth = 2;
      if (r.horiz) {
        _hLine(c, r.x0, r.yCen-3, r.len);
        _hLine(c, r.x0, r.yCen+3, r.len);
      } else {
        _vLine(c, r.xCen-3, r.y0, r.len);
        _vLine(c, r.xCen+3, r.y0, r.len);
      }
    }

    // Dashed lane dividers
    c.strokeStyle = 'rgba(240,236,220,0.48)'; c.lineWidth = 1.5;
    for (var i = 1; i < r.lpd*2; i++) {
      if (i === r.lpd) continue;
      if (r.horiz) {
        var ly = r.y0 + lw*i; c.setLineDash([18,14]); _hLine(c, r.x0, ly, r.len);
      } else {
        var lx = r.x0 + lw*i; c.setLineDash([14,10]); _vLine(c, lx, r.y0, r.len);
      }
    }
    c.setLineDash([]);

    // Lane direction arrows (white, every 480px)
    c.fillStyle = 'rgba(255,255,245,0.22)';
    for (var li = 0; li < r.lpd*2; li++) {
      if (li === r.lpd) continue;
      var isPos = li >= r.lpd;
      var laneCenter = (li+0.5)*lw;
      var ang = r.horiz ? (isPos ? 0 : Math.PI) : (isPos ? Math.PI/2 : -Math.PI/2);
      for (var ap = 280; ap < r.len; ap += 480) {
        if (r.horiz) {
          var ax = r.x0+ap, ay = r.y0+laneCenter;
          if (!_isInterArea(ax,ay)) _drawRoadArrow(c, ax, ay, ang);
        } else {
          var ax2 = r.x0+laneCenter, ay2 = r.y0+ap;
          if (!_isInterArea(ax2,ay2)) _drawRoadArrow(c, ax2, ay2, ang);
        }
      }
    }
  });

  // Stop lines at intersection approaches
  c.strokeStyle = 'rgba(235,230,208,0.72)'; c.lineWidth = 3.5; c.setLineDash([]);
  wInters.forEach(function(n) {
    var so = 4;
    c.beginPath(); c.moveTo(n.x-n.vw, n.y-n.hw-so); c.lineTo(n.x+n.vw, n.y-n.hw-so); c.stroke();
    c.beginPath(); c.moveTo(n.x-n.vw, n.y+n.hw+so); c.lineTo(n.x+n.vw, n.y+n.hw+so); c.stroke();
    c.beginPath(); c.moveTo(n.x-n.vw-so, n.y-n.hw); c.lineTo(n.x-n.vw-so, n.y+n.hw); c.stroke();
    c.beginPath(); c.moveTo(n.x+n.vw+so, n.y-n.hw); c.lineTo(n.x+n.vw+so, n.y+n.hw); c.stroke();
  });

  // Road names
  wRoads.forEach(function(r) {
    if (r.len <= 400) return;
    c.font = 'bold 8px "JetBrains Mono",monospace';
    c.fillStyle = 'rgba(255,255,255,0.26)'; c.textAlign = 'center';
    for (var rpos = 300; rpos < r.len; rpos += 620) {
      if (r.horiz) {
        c.fillText(r.name, r.x0+rpos, r.yCen+4);
      } else {
        c.save(); c.translate(r.xCen+4, r.y0+rpos);
        c.rotate(Math.PI/2); c.fillText(r.name, 0, 0); c.restore();
      }
    }
  });
}

// ── Intersection detail — rounded corners + islands + box jcn ─
function rIntersectionDetail(c) {
  wInters.forEach(function(n) {
    var vw = n.vw, hw = n.hw;
    var isWide = (hw > 40 || vw > 40);

    // Corner channelization islands (green) for major intersections
    if (isWide) {
      var island = Math.min(vw, hw, 18) * 0.65;
      c.fillStyle = '#2a5216';
      // NW
      c.beginPath(); c.moveTo(n.x-vw, n.y-hw); c.lineTo(n.x-vw+island, n.y-hw); c.lineTo(n.x-vw, n.y-hw+island); c.closePath(); c.fill();
      // NE
      c.beginPath(); c.moveTo(n.x+vw, n.y-hw); c.lineTo(n.x+vw-island, n.y-hw); c.lineTo(n.x+vw, n.y-hw+island); c.closePath(); c.fill();
      // SW
      c.beginPath(); c.moveTo(n.x-vw, n.y+hw); c.lineTo(n.x-vw+island, n.y+hw); c.lineTo(n.x-vw, n.y+hw-island); c.closePath(); c.fill();
      // SE
      c.beginPath(); c.moveTo(n.x+vw, n.y+hw); c.lineTo(n.x+vw-island, n.y+hw); c.lineTo(n.x+vw, n.y+hw-island); c.closePath(); c.fill();
    }

    // Box junction yellow outline (UB style)
    c.strokeStyle = 'rgba(255,200,0,0.28)'; c.lineWidth = 2; c.setLineDash([]);
    _rrect(c, n.x-vw+2, n.y-hw+2, vw*2-4, hw*2-4, isWide?6:3, false, true);
  });
}

// ── Crosswalks ────────────────────────────────────────────────
function rCrosswalks(c) {
  var stripe = 9, gap = 7, count = 5;
  wInters.forEach(function(n) {
    c.fillStyle = 'rgba(245,240,220,0.88)';
    for (var i = 0; i < count; i++) {
      var off = 3 + i*(stripe+gap);
      // N approach
      c.fillRect(n.x-n.vw+2, n.y-n.hw-off-stripe, n.vw*2-4, stripe);
      // S approach
      c.fillRect(n.x-n.vw+2, n.y+n.hw+off, n.vw*2-4, stripe);
      // W approach
      c.fillRect(n.x-n.vw-off-stripe, n.y-n.hw+2, stripe, n.hw*2-4);
      // E approach
      c.fillRect(n.x+n.vw+off, n.y-n.hw+2, stripe, n.hw*2-4);
    }
  });
}

// ── Bus stops ─────────────────────────────────────────────────
function rBusStops(c) {
  if (typeof BUS_STOPS === 'undefined') return;
  BUS_STOPS.forEach(function(bs) {
    var x = bs.x, y = bs.y;
    // Shelter — top-down: blue-gray rectangle
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(x-11, y-3, 24, 9);
    c.fillStyle = 'rgba(55,80,130,0.58)';
    c.fillRect(x-12, y-4, 24, 8);
    c.strokeStyle = 'rgba(100,150,220,0.55)'; c.lineWidth = 1; c.setLineDash([]);
    c.strokeRect(x-12, y-4, 24, 8);
    // Bus stop sign circle
    c.fillStyle = '#1d4ed8';
    c.beginPath(); c.arc(x, y+(bs.side==='n'?-9:9), 4, 0, Math.PI*2); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 5px monospace'; c.textAlign = 'center';
    c.fillText('B', x, y+(bs.side==='n'?-7:11));
  });
}

// ── Trees — premium multi-layer canopy ────────────────────────
function rTrees(c) {
  wTrees.forEach(function(t) {
    var r = t.r * 1.95; // enlarged for visual impact

    // === Large oblique shadow (SE direction) ===
    c.fillStyle = 'rgba(0,0,0,0.36)';
    c.beginPath();
    c.ellipse(t.x + r*0.55, t.y + r*0.90, r*0.88, r*0.44, 0.22, 0, Math.PI*2);
    c.fill();

    // === Layer 1: Dark outer ring (shadow underside of canopy) ===
    c.fillStyle = _darken(t.b, 10);
    c.beginPath(); c.arc(t.x, t.y, r, 0, Math.PI*2); c.fill();

    // === Layer 2: Main canopy ===
    c.fillStyle = t.b;
    c.beginPath(); c.arc(t.x - r*0.06, t.y - r*0.08, r*0.84, 0, Math.PI*2); c.fill();

    // === Layer 3: Bright mid-layer ===
    c.fillStyle = t.a;
    c.beginPath(); c.arc(t.x - r*0.14, t.y - r*0.18, r*0.62, 0, Math.PI*2); c.fill();

    // === Layer 4: Sun highlight lobe ===
    c.fillStyle = 'rgba(175,230,95,0.32)';
    c.beginPath(); c.arc(t.x - r*0.26, t.y - r*0.30, r*0.33, 0, Math.PI*2); c.fill();

    // === Layer 5: Specular highlight ===
    c.fillStyle = 'rgba(220,255,150,0.18)';
    c.beginPath(); c.arc(t.x - r*0.34, t.y - r*0.38, r*0.16, 0, Math.PI*2); c.fill();

    // === Trunk hint ===
    c.fillStyle = 'rgba(55,38,18,0.55)';
    c.beginPath(); c.arc(t.x + r*0.04, t.y + r*0.06, r*0.09, 0, Math.PI*2); c.fill();
  });
}

// ── Traffic Lights ────────────────────────────────────────────
var LC = {red:'#ef4444', yellow:'#fbbf24', green:'#22c55e'};
function rTrafficLights(c) {
  G.lights.forEach(function(l) {
    var hw = l.hw, vw = l.vw;
    var poles = [
      {x:l.x-vw-11, y:l.y-hw-11, stFn:function(){return l.ewState;}},
      {x:l.x+vw+11, y:l.y-hw-11, stFn:function(){return l.ewState;}},
      {x:l.x-vw-11, y:l.y+hw+11, stFn:function(){return l.nsState;}},
      {x:l.x+vw+11, y:l.y+hw+11, stFn:function(){return l.nsState;}},
    ];
    poles.forEach(function(p) {
      var st = p.stFn();
      // Pole shadow
      c.fillStyle = 'rgba(0,0,0,0.20)'; c.fillRect(p.x-1, p.y-36+2, 4, 36);
      // Pole
      c.fillStyle = '#282828'; c.fillRect(p.x-2, p.y-36, 4, 36);
      // Box body
      c.fillStyle = '#161616';
      _rrect(c, p.x-7, p.y-52, 14, 42, 3, true, false);
      // 3 lights
      ['red','yellow','green'].forEach(function(col, i) {
        var on = (st === col);
        if (on) { c.shadowColor = LC[col]; c.shadowBlur = 14; }
        c.fillStyle = on ? LC[col] : 'rgba(255,255,255,0.04)';
        c.beginPath(); c.arc(p.x, p.y-44+i*14, 4.5, 0, Math.PI*2); c.fill();
        c.shadowBlur = 0;
      });
    });
  });
}

// ── Tire marks ────────────────────────────────────────────────
function rTireMarks(c) {
  G.player.tireMarks.forEach(function(m) {
    c.fillStyle = 'rgba(8,6,4,' + (m.life/m.max*0.48) + ')';
    c.fillRect(m.x-2, m.y-2, 4, 4);
  });
}

// ── Pedestrians ───────────────────────────────────────────────
function rPeds(c) {
  G.peds.forEach(function(p) {
    if (p.state === 'done') return;
    c.save(); c.translate(p.x, p.y);
    if (p.state === 'scared') c.globalAlpha = 0.55;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.32)';
    c.beginPath(); c.ellipse(1,5,4.5,2.2,0,0,Math.PI*2); c.fill();

    // Legs
    var sw = p.state==='crossing' ? Math.sin(p._walkPhase)*3.5 : 0;
    c.strokeStyle = 'rgba(40,30,30,0.90)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-2,3); c.lineTo(-3+sw,9); c.stroke();
    c.beginPath(); c.moveTo(2,3);  c.lineTo(3-sw,9); c.stroke();

    // Body
    c.fillStyle = p.shirt;
    _rrect(c, -4,-7,8,10,2,true,false);

    // Arms
    c.strokeStyle = p.skin; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-4,-3); c.lineTo(-6+sw,-1+sw*0.5); c.stroke();
    c.beginPath(); c.moveTo(4,-3);  c.lineTo(6-sw,-1-sw*0.5); c.stroke();

    // Head
    c.fillStyle = p.skin;
    c.beginPath(); c.arc(0,-12,4.5,0,Math.PI*2); c.fill();
    c.fillStyle = 'rgba(28,18,8,0.58)';
    c.beginPath(); c.arc(0,-13,3.8,Math.PI,0); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.60)';
    c.fillRect(-2,-12,1.5,1.5); c.fillRect(1,-12,1.5,1.5);

    c.globalAlpha = 1; c.restore();
  });
}

// ── Car drawing — premium with detailed geometry ──────────────
function _drawCar(c, car, bodyColor, darkColor, isPlayer) {
  c.save();
  c.translate(car.x, car.y);
  c.rotate(car.angle);

  var bw = car.w, bh = car.h;
  var vtype = car.vtype || 'sedan';
  var cr = isPlayer ? 4 : (vtype==='bus'||vtype==='van' ? 2 : 3);

  // === Drop shadow (elliptical, more realistic) ===
  c.fillStyle = 'rgba(0,0,0,0.42)';
  c.beginPath();
  c.ellipse(bw*0.08, bh*0.10, bw*0.54, bh*0.46, 0, 0, Math.PI*2);
  c.fill();

  // === Wheels ===
  var wxo = bw/2 + 1.5;
  var wra = (vtype==='bus'||vtype==='suv') ? 4.5 : 3.8;
  var wrb = (vtype==='bus') ? 6.8 : (vtype==='suv'||vtype==='van') ? 5.8 : 5.0;
  var wyf = -bh/2 + (vtype==='bus'?13 : vtype==='van'?11 : 8);
  var wyr =  bh/2 - (vtype==='bus'?13 : vtype==='van'?11 : 8);

  c.fillStyle = '#0d0d0d';
  function _wheel(ox,oy){ c.beginPath();c.ellipse(ox,oy,wra,wrb,0,0,Math.PI*2);c.fill(); }
  _wheel(-wxo,wyf); _wheel(wxo,wyf); _wheel(-wxo,wyr); _wheel(wxo,wyr);
  if (vtype==='bus') { _wheel(-wxo,0); _wheel(wxo,0); }

  // Wheel rim highlight
  c.fillStyle = 'rgba(200,200,200,0.40)';
  function _rim(ox,oy){ c.beginPath();c.ellipse(ox,oy,wra*0.48,wrb*0.48,0,0,Math.PI*2);c.fill(); }
  _rim(-wxo,wyf); _rim(wxo,wyf); _rim(-wxo,wyr); _rim(wxo,wyr);
  if (vtype==='bus') { _rim(-wxo,0); _rim(wxo,0); }

  // Wheel arch shadows
  c.fillStyle = 'rgba(0,0,0,0.35)';
  function _arch(ox,oy){ c.fillRect(ox-wra*1.1, oy-wrb*0.9, wra*2.2, wrb*0.45); }
  _arch(-wxo,wyf); _arch(wxo,wyf); _arch(-wxo,wyr); _arch(wxo,wyr);

  // === Side mirrors ===
  if (vtype !== 'bus') {
    c.fillStyle = darkColor;
    c.fillRect(-bw/2-3.5, -bh*0.18, 3.5, 5);
    c.fillRect(bw/2, -bh*0.18, 3.5, 5);
  }

  // === Body with 3-stop gradient ===
  var bg = c.createLinearGradient(-bw/2, 0, bw/2, 0);
  bg.addColorStop(0,   _darken(bodyColor, 35));
  bg.addColorStop(0.18, _lighten(bodyColor, 8));
  bg.addColorStop(0.50, bodyColor);
  bg.addColorStop(0.82, _lighten(bodyColor, 5));
  bg.addColorStop(1,   _darken(bodyColor, 32));
  c.fillStyle = bg;
  _rrect(c, -bw/2+1, -bh/2, bw-2, bh, cr, true, false);

  // === Roof panel (tinted darker = glass+metal) ===
  var roofFrac = (vtype==='suv') ? 0.48 : (vtype==='van'||vtype==='bus') ? 0.52 : 0.42;
  var rg = c.createLinearGradient(-bw/2, 0, bw/2, 0);
  rg.addColorStop(0, 'rgba(0,0,0,0.28)');
  rg.addColorStop(0.5, isPlayer ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)');
  rg.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = rg;
  if (vtype !== 'bus') c.fillRect(-bw/2+2, -bh*roofFrac/2, bw-4, bh*roofFrac);

  // === Bus side windows ===
  if (vtype === 'bus') {
    c.fillStyle = 'rgba(120,195,255,0.22)';
    for (var wy2 = -bh/2+14; wy2 < bh/2-16; wy2 += 12) {
      c.fillRect(-bw/2+2, wy2, 4, 8);
      c.fillRect(bw/2-6, wy2, 4, 8);
    }
    c.fillStyle = 'rgba(255,255,255,0.09)';
    c.fillRect(-bw/2+2, -bh/2+2, bw-4, 4);
  }

  // === Windshield (front) — glass look ===
  var wsFrac = vtype==='bus' ? 0.13 : vtype==='van' ? 0.17 : 0.22;
  var wsG = c.createLinearGradient(-bw/2+3, 0, bw/2-3, 0);
  wsG.addColorStop(0, isPlayer?'rgba(130,210,255,0.35)':'rgba(110,185,240,0.22)');
  wsG.addColorStop(0.5, isPlayer?'rgba(165,230,255,0.52)':'rgba(140,205,255,0.32)');
  wsG.addColorStop(1, isPlayer?'rgba(130,210,255,0.35)':'rgba(110,185,240,0.22)');
  c.fillStyle = wsG;
  _rrect(c, -bw/2+3, -bh/2+4, bw-6, bh*wsFrac, 2, true, false);
  // Glass reflection streak
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(-bw/2+4, -bh/2+5, (bw-10)*0.5, 2);

  // === Rear glass ===
  if (vtype !== 'van' && vtype !== 'bus') {
    c.fillStyle = isPlayer ? 'rgba(90,165,220,0.30)' : 'rgba(80,150,210,0.18)';
    c.fillRect(-bw/2+3, bh/2-bh*0.22, bw-6, bh*0.16);
  }

  // === Taxi sign ===
  if (vtype === 'taxi') {
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(-6, -bh/2-5.5, 12, 5);
    c.fillStyle = '#fbbf24';
    c.font = 'bold 4px monospace'; c.textAlign = 'center';
    c.fillText('ТАКСИ', 0, -bh/2-1.5);
  }

  // === Player indicator (subtle glow outline) ===
  if (isPlayer) {
    c.shadowColor = '#ff8800'; c.shadowBlur = 12;
    c.strokeStyle = 'rgba(255,130,0,0.55)'; c.lineWidth = 1.8; c.setLineDash([3,3]);
    _rrect(c, -bw/2-3, -bh/2-3, bw+6, bh+6, cr+2, false, true);
    c.setLineDash([]); c.shadowBlur = 0;
  }

  // === Damage dents ===
  if (isPlayer && car.damaged) {
    c.fillStyle = 'rgba(0,0,0,0.32)';
    car.dents.forEach(function(d){
      c.beginPath(); c.arc(d.lx, d.ly, 3.5, 0, Math.PI*2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.50)'; c.lineWidth = 1; c.setLineDash([]);
      c.beginPath(); c.moveTo(d.lx-3,d.ly); c.lineTo(d.lx+3,d.ly+2); c.stroke();
    });
  }

  // === Body outline ===
  c.strokeStyle = 'rgba(0,0,0,0.38)'; c.lineWidth = 0.9; c.setLineDash([]);
  _rrect(c, -bw/2+1, -bh/2, bw-2, bh, cr, false, true);

  c.restore();
}

// ── AI Cars ───────────────────────────────────────────────────
function rAICars(c) {
  G.aiCars.forEach(function(ai) {
    if (!ai.active) return;
    _drawCar(c, ai, ai.color, _darken(ai.color, 38), false);

    var fOff = ai.h/2 + 2;
    c.save();
    c.translate(ai.x + Math.cos(ai.angle)*fOff, ai.y + Math.sin(ai.angle)*fOff);
    c.fillStyle = 'rgba(255,255,200,0.80)';
    var hlr = ai.vtype==='bus' ? 3.2 : 2.4;
    c.beginPath(); c.arc(-5.5,0,hlr,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(5.5,0,hlr,0,Math.PI*2); c.fill();
    c.restore();

    if (ai.waiting) {
      c.save();
      c.translate(ai.x - Math.cos(ai.angle)*(ai.h/2+2), ai.y - Math.sin(ai.angle)*(ai.h/2+2));
      c.shadowColor = '#ef4444'; c.shadowBlur = 10;
      c.fillStyle = 'rgba(239,68,68,0.90)';
      c.beginPath(); c.arc(-5,0,2.5,0,Math.PI*2); c.fill();
      c.beginPath(); c.arc(5,0,2.5,0,Math.PI*2); c.fill();
      c.shadowBlur = 0; c.restore();
    }
  });
}

// ── Police Car ────────────────────────────────────────────────
function rPolice(c) {
  G.police.forEach(function(pc) {
    _drawCar(c, pc, '#1d4ed8', '#163ba8', false);

    c.save(); c.translate(pc.x, pc.y); c.rotate(pc.angle);
    c.fillStyle = 'rgba(255,255,255,0.52)'; c.fillRect(-10,-4,20,8);
    c.fillStyle = '#fff'; c.font = 'bold 5px monospace'; c.textAlign = 'center';
    c.fillText('ЦАГДАА', 0, 2);
    c.restore();

    if (pc.sirenOn) {
      var redOn = pc._lp < 20;
      c.save();
      c.translate(pc.x + Math.cos(pc.angle)*16, pc.y + Math.sin(pc.angle)*16);
      c.rotate(pc.angle);
      c.shadowColor = redOn?'#ef4444':'#3b82f6'; c.shadowBlur = 22;
      c.fillStyle = redOn?'#ef4444':'#3b82f6';
      c.beginPath(); c.arc(-4,0,4.5,0,Math.PI*2); c.fill();
      c.shadowColor = redOn?'#3b82f6':'#ef4444';
      c.fillStyle = redOn?'#3b82f6':'#ef4444';
      c.beginPath(); c.arc(4,0,4.5,0,Math.PI*2); c.fill();
      c.shadowBlur = 0; c.restore();
    }

    if (pc._dispatchAnim && pc._dispatchTimer > 0) {
      c.save(); c.translate(pc.x, pc.y);
      c.font = '13px serif'; c.textAlign = 'center';
      c.globalAlpha = pc._dispatchTimer/90;
      c.fillText('📻', 0, -pc.h/2-14);
      c.globalAlpha = 1; c.restore();
    }
  });
}

// ── Player Car ────────────────────────────────────────────────
function rPlayer(c) {
  var p = G.player;
  if (p.crashed && G.frame%8 < 4) return;

  _drawCar(c, p, '#ff6a00', '#c84c00', true);

  if (p.speed > 0.3) {
    c.save();
    c.translate(p.x + Math.cos(p.angle)*20, p.y + Math.sin(p.angle)*20);
    c.shadowColor = '#ffffaa'; c.shadowBlur = 22;
    c.fillStyle = 'rgba(255,255,200,0.95)';
    c.beginPath(); c.arc(-5,0,3,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(5,0,3,0,Math.PI*2); c.fill();
    c.shadowBlur = 0; c.restore();
  }

  if (p.braking || p.crashed) {
    c.save();
    c.translate(p.x - Math.cos(p.angle)*20, p.y - Math.sin(p.angle)*20);
    c.shadowColor = '#ef4444'; c.shadowBlur = 20;
    c.fillStyle = 'rgba(239,68,68,0.95)';
    c.beginPath(); c.arc(-5,0,3.5,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(5,0,3.5,0,Math.PI*2); c.fill();
    c.shadowBlur = 0; c.restore();
  }

  if (p.horn) {
    c.save(); c.translate(p.x, p.y);
    c.font = '12px serif'; c.textAlign = 'center';
    c.globalAlpha = 0.8 + Math.sin(G.frame*0.4)*0.2;
    c.fillText('📯', 0, -p.h/2-12);
    c.globalAlpha = 1; c.restore();
  }

  if (p.health < 100) {
    c.save(); c.translate(p.x, p.y - p.h/2 - 12);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(-15,-3,30,6);
    var hCol = p.health>60?'#22c55e':p.health>30?'#f59e0b':'#ef4444';
    c.fillStyle = hCol; c.fillRect(-15,-3,30*p.health/100,6);
    c.restore();
  }
}

// ── Particles ─────────────────────────────────────────────────
function rParticles(c) {
  G.particles.forEach(function(p) {
    c.globalAlpha = p.life/p.max;
    c.fillStyle = p.color;
    c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill();
  });
  c.globalAlpha = 1;
}

// ── Utilities ─────────────────────────────────────────────────
function _darken(hex, amt) {
  var n = parseInt(hex.replace('#',''), 16);
  var r = Math.max(0, ((n>>16)&0xff) - amt);
  var g = Math.max(0, ((n>>8)&0xff)  - amt);
  var b = Math.max(0, (n&0xff)       - amt);
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

function _lighten(hex, amt) {
  var n = parseInt(hex.replace('#',''), 16);
  var r = Math.min(255, ((n>>16)&0xff) + amt);
  var g = Math.min(255, ((n>>8)&0xff)  + amt);
  var b = Math.min(255, (n&0xff)       + amt);
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

function _hLine(c,x,y,len){ c.beginPath();c.moveTo(x,y);c.lineTo(x+len,y);c.stroke(); }
function _vLine(c,x,y,len){ c.beginPath();c.moveTo(x,y);c.lineTo(x,y+len);c.stroke(); }

function _drawRoadArrow(c, x, y, angle) {
  c.save(); c.translate(x,y); c.rotate(angle);
  c.beginPath();
  c.moveTo(11,0); c.lineTo(3,-6); c.lineTo(3,-2.5);
  c.lineTo(-9,-2.5); c.lineTo(-9,2.5); c.lineTo(3,2.5);
  c.lineTo(3,6); c.closePath(); c.fill();
  c.restore();
}

// Rounded rect helper (fill or stroke)
function _rrect(c, x, y, w, h, r, fill, stroke) {
  if (typeof c.roundRect === 'function') {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill)   c.fill();
    if (stroke) c.stroke();
  } else {
    if (fill)   c.fillRect(x, y, w, h);
    if (stroke) c.strokeRect(x, y, w, h);
  }
}
