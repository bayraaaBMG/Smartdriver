'use strict';
// ═══════════════════════════════════════════════════════════════
//  RENDERER.JS — Satellite aerial renderer (Leaflet + Esri)
//  Background: real UB satellite imagery via Leaflet
//  Overlay:    game elements (cars, lights, peds) on canvas
// ═══════════════════════════════════════════════════════════════

// Keep OBL for engine.js camera bounds calculation
var OBL = 0.58;

// ── Leaflet map instance ──────────────────────────────────────
var _lMap = null;

// ── UB coordinate calibration ─────────────────────────────────
// Sukhbaatar Square center → world(1475, 1380) ≡ 47.9077°N, 106.9083°E
var _UB_LAT0 = 47.9077 + 1380 * 0.0000090;   // lat at world y=0  → 47.92012
var _UB_LNG0 = 106.9083 - 1475 * 0.0000135;  // lng at world x=0  → 106.88839
var _LAT_PX  = 0.0000090;   // degrees latitude per world-pixel (y+ = south = lat-)
var _LNG_PX  = 0.0000135;   // degrees longitude per world-pixel (x+ = east  = lng+)

function _wToLL(wx, wy) {
  return [_UB_LAT0 - wy * _LAT_PX, _UB_LNG0 + wx * _LNG_PX];
}

// ── Per-frame coordinate cache ────────────────────────────────
// Linear approximation of Leaflet projection (fast per-object lookup)
var _moPt = null;   // screen pixel at world(0,0)
var _pxWx = 1.35;   // screen pixels per world pixel (x)
var _pxWy = 1.35;   // screen pixels per world pixel (y)

function _wToS(wx, wy) {
  if (!_moPt) {
    // Fallback before map is ready
    return [(wx - cam.x)*cam.zoom, (wy - cam.y)*cam.zoom];
  }
  return [_moPt.x + wx * _pxWx, _moPt.y + wy * _pxWy];
}

// ── Leaflet zoom from cam.zoom ────────────────────────────────
function _lZoom() {
  // Ground resolution at 47.9°N: 156543 * cos(47.9°) / 2^Z m/px
  // We want 1/cam.zoom m/px → Z = log2(156543 * cos(47.9°) * cam.zoom)
  return Math.log2(156543.04 * 0.6691 * cam.zoom);
}

// ── Initialize Leaflet (called once from startGame) ───────────
function initLeafletMap() {
  if (_lMap) { _lMap.invalidateSize(); return; }
  _lMap = L.map('map-bg', {
    zoomControl:       false,
    attributionControl: false,
    zoomAnimation:     false,
    zoomSnap:          0,
    zoomDelta:         0.1,
    dragging:          false,
    touchZoom:         false,
    scrollWheelZoom:   false,
    doubleClickZoom:   false,
    boxZoom:           false,
    keyboard:          false,
  });

  // Esri World Imagery — free, no API key, high-res for UB
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom: 20, tileSize: 256}
  ).addTo(_lMap);
}

// ── Per-frame map view update ─────────────────────────────────
function _updateMapView() {
  if (!_lMap || !G.player) return;
  _lMap.setView(_wToLL(G.player.x, G.player.y), _lZoom(), {animate: false});
}

// ── Per-frame linear coordinate computation ───────────────────
function _updateCoordCache() {
  if (!_lMap) return;
  var p0 = _lMap.latLngToContainerPoint([_UB_LAT0, _UB_LNG0]);
  var px = _lMap.latLngToContainerPoint([_UB_LAT0,          _UB_LNG0 + 0.001]);
  var py = _lMap.latLngToContainerPoint([_UB_LAT0 - 0.001,  _UB_LNG0]);
  _moPt  = {x: p0.x, y: p0.y};
  _pxWx  = (px.x - p0.x) / (0.001 / _LNG_PX);
  _pxWy  = (p0.y - py.y) / (0.001 / _LAT_PX);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════
function render() {
  var c = gctx;
  c.clearRect(0, 0, GCW, GCH); // transparent = satellite shows through

  _updateMapView();    // pan/zoom Leaflet to follow player
  _updateCoordCache(); // compute _moPt, _pxWx, _pxWy

  // Semi-transparent road overlay (helps orient AI car paths on satellite)
  rRoadOverlay(c);

  // Game elements drawn over satellite imagery
  rCrosswalks(c);
  rTrafficLights(c);
  rTireMarks(c);
  rPeds(c);
  rAICars(c);
  rPolice(c);
  rPlayer(c);
  rParticles(c);

  // Screen-space flash
  if (G._flash > 0.01) {
    c.fillStyle = 'rgba(239,68,68,' + G._flash + ')';
    c.fillRect(0, 0, GCW, GCH);
    G._flash *= 0.85;
  }
}

// ── Subtle road overlay (semi-transparent, shows game road positions) ─
function rRoadOverlay(c) {
  c.globalAlpha = 0.18;
  wRoads.forEach(function(r) {
    var p0 = _wToS(r.x0, r.y0);
    var p1 = _wToS(r.x0 + (r.horiz ? r.len : r.w), r.y0 + (r.horiz ? r.h : r.len));
    c.fillStyle = '#606068';
    c.fillRect(p0[0], p0[1], p1[0]-p0[0], p1[1]-p0[1]);
  });
  wInters.forEach(function(n) {
    var p0 = _wToS(n.x-n.vw, n.y-n.hw);
    var p1 = _wToS(n.x+n.vw, n.y+n.hw);
    c.fillStyle = '#686870';
    c.fillRect(p0[0], p0[1], p1[0]-p0[0], p1[1]-p0[1]);
  });

  // Lane center lines
  c.strokeStyle = 'rgba(255,230,20,0.50)'; c.lineWidth = 1.5; c.setLineDash([]);
  wRoads.forEach(function(r) {
    if (r.lpd < 3) {
      var a = _wToS(r.horiz ? r.x0 : r.xCen, r.horiz ? r.yCen : r.y0);
      var b = _wToS(r.horiz ? r.x0+r.len : r.xCen, r.horiz ? r.yCen : r.y0+r.len);
      c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke();
    }
  });

  // White dashed lane dividers
  c.strokeStyle = 'rgba(255,255,240,0.42)'; c.lineWidth = 1.2; c.setLineDash([12*_pxWx, 8*_pxWx]);
  wRoads.forEach(function(r) {
    var D = r.horiz ? r.h : r.w;
    var lw = D / (r.lpd * 2);
    for (var i = 1; i < r.lpd*2; i++) {
      if (i === r.lpd) continue;
      var offset = lw * i;
      var a, b;
      if (r.horiz) {
        a = _wToS(r.x0, r.y0 + offset);
        b = _wToS(r.x0 + r.len, r.y0 + offset);
      } else {
        a = _wToS(r.x0 + offset, r.y0);
        b = _wToS(r.x0 + offset, r.y0 + r.len);
      }
      c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke();
    }
  });
  c.setLineDash([]);
  c.globalAlpha = 1;
}

// ── Crosswalks ────────────────────────────────────────────────
function rCrosswalks(c) {
  c.globalAlpha = 0.55;
  c.fillStyle = 'rgba(245,240,220,0.95)';
  var stripe = 9, gap = 7, count = 5;
  wInters.forEach(function(n) {
    for (var i = 0; i < count; i++) {
      var off = 3 + i*(stripe+gap);
      // N approach
      var p0 = _wToS(n.x-n.vw+2, n.y-n.hw-off-stripe);
      var p1 = _wToS(n.x+n.vw-2, n.y-n.hw-off);
      c.fillRect(p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);
      // S approach
      p0 = _wToS(n.x-n.vw+2, n.y+n.hw+off);
      p1 = _wToS(n.x+n.vw-2, n.y+n.hw+off+stripe);
      c.fillRect(p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);
      // W approach
      p0 = _wToS(n.x-n.vw-off-stripe, n.y-n.hw+2);
      p1 = _wToS(n.x-n.vw-off, n.y+n.hw-2);
      c.fillRect(p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);
      // E approach
      p0 = _wToS(n.x+n.vw+off, n.y-n.hw+2);
      p1 = _wToS(n.x+n.vw+off+stripe, n.y+n.hw-2);
      c.fillRect(p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]);
    }
  });
  c.globalAlpha = 1;
}

// ── Traffic Lights ────────────────────────────────────────────
var LC = {red:'#ef4444', yellow:'#fbbf24', green:'#22c55e'};
function rTrafficLights(c) {
  G.lights.forEach(function(l) {
    [
      {wx: l.x-l.vw-11, wy: l.y-l.hw-11, st: function(){return l.ewState;}},
      {wx: l.x+l.vw+11, wy: l.y-l.hw-11, st: function(){return l.ewState;}},
      {wx: l.x-l.vw-11, wy: l.y+l.hw+11, st: function(){return l.nsState;}},
      {wx: l.x+l.vw+11, wy: l.y+l.hw+11, st: function(){return l.nsState;}},
    ].forEach(function(p) {
      var state = p.st();
      var sp = _wToS(p.wx, p.wy);
      var s = _pxWx;
      c.save();
      c.translate(sp[0], sp[1]);

      // Pole
      c.fillStyle = '#1a1a1a'; c.fillRect(-2*s, -36*s, 4*s, 36*s);
      // Box
      c.fillStyle = '#101010'; c.fillRect(-7*s, -52*s, 14*s, 42*s);
      // 3 lights
      ['red','yellow','green'].forEach(function(col, i) {
        var on = (state === col);
        if (on) { c.shadowColor = LC[col]; c.shadowBlur = 14*s; }
        c.fillStyle = on ? LC[col] : 'rgba(255,255,255,0.05)';
        c.beginPath(); c.arc(0, (-44+i*14)*s, 4.5*s, 0, Math.PI*2); c.fill();
        c.shadowBlur = 0;
      });
      c.restore();
    });
  });
}

// ── Tire marks ────────────────────────────────────────────────
function rTireMarks(c) {
  G.player.tireMarks.forEach(function(m) {
    var sp = _wToS(m.x, m.y);
    c.fillStyle = 'rgba(8,6,4,' + (m.life/m.max*0.55) + ')';
    c.fillRect(sp[0]-2*_pxWx, sp[1]-2*_pxWy, 4*_pxWx, 4*_pxWy);
  });
}

// ── Pedestrians ───────────────────────────────────────────────
var _skinTones = ['#f5cba7','#e8b89a','#d4956a','#c07840','#a0522d'];
var _shirtCols = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
function rPeds(c) {
  G.peds.forEach(function(p) {
    if (p.state === 'done') return;
    var sp = _wToS(p.x, p.y);
    var s = _pxWx;
    c.save();
    c.translate(sp[0], sp[1]);
    if (p.state === 'scared') c.globalAlpha = 0.55;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(s, 5*s, 4.5*s, 2.2*s, 0, 0, Math.PI*2); c.fill();

    // Legs
    var sw = p.state==='crossing' ? Math.sin(p._walkPhase)*3.5*s : 0;
    c.strokeStyle='rgba(40,30,30,0.90)'; c.lineWidth=2.5*s;
    c.beginPath(); c.moveTo(-2*s,3*s); c.lineTo(-3*s+sw,9*s); c.stroke();
    c.beginPath(); c.moveTo(2*s,3*s);  c.lineTo(3*s-sw,9*s); c.stroke();

    // Body
    c.fillStyle = p.shirt;
    c.fillRect(-4*s,-7*s,8*s,10*s);

    // Head
    c.fillStyle = p.skin;
    c.beginPath(); c.arc(0,-12*s,4.5*s,0,Math.PI*2); c.fill();
    c.fillStyle='rgba(28,18,8,0.6)';
    c.beginPath(); c.arc(0,-13*s,3.8*s,Math.PI,0); c.fill();

    c.globalAlpha = 1;
    c.restore();
  });
}

// ── Car drawing (all vehicle types) ──────────────────────────
function _drawCar(c, car, bodyColor, darkColor, isPlayer) {
  var sp = _wToS(car.x, car.y);
  var s = _pxWx; // scale factor
  c.save();
  c.translate(sp[0], sp[1]);
  c.scale(s, s); // uniform scale — world units below
  c.rotate(car.angle);

  var bw = car.w, bh = car.h;
  var vtype = car.vtype || 'sedan';
  var cr = isPlayer ? 4 : (vtype==='bus'||vtype==='van' ? 2 : 3);

  // Drop shadow (elliptical)
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath(); c.ellipse(bw*0.08, bh*0.10, bw*0.54, bh*0.46, 0, 0, Math.PI*2); c.fill();

  // Wheels
  var wxo = bw/2+1.5;
  var wra = (vtype==='bus'||vtype==='suv')?4.5:3.8;
  var wrb = vtype==='bus'?6.8:(vtype==='suv'||vtype==='van')?5.8:5.0;
  var wyf = -bh/2+(vtype==='bus'?13:vtype==='van'?11:8);
  var wyr =  bh/2-(vtype==='bus'?13:vtype==='van'?11:8);
  c.fillStyle = '#0d0d0d';
  function _w(ox,oy){c.beginPath();c.ellipse(ox,oy,wra,wrb,0,0,Math.PI*2);c.fill();}
  _w(-wxo,wyf);_w(wxo,wyf);_w(-wxo,wyr);_w(wxo,wyr);
  if(vtype==='bus'){_w(-wxo,0);_w(wxo,0);}
  c.fillStyle='rgba(200,200,200,0.42)';
  function _r(ox,oy){c.beginPath();c.ellipse(ox,oy,wra*.48,wrb*.48,0,0,Math.PI*2);c.fill();}
  _r(-wxo,wyf);_r(wxo,wyf);_r(-wxo,wyr);_r(wxo,wyr);
  if(vtype==='bus'){_r(-wxo,0);_r(wxo,0);}

  // Body gradient
  var bg = c.createLinearGradient(-bw/2,0,bw/2,0);
  bg.addColorStop(0,   _darken(bodyColor,38));
  bg.addColorStop(0.18, _lighten(bodyColor,10));
  bg.addColorStop(0.5,  bodyColor);
  bg.addColorStop(0.82, _lighten(bodyColor,6));
  bg.addColorStop(1,   _darken(bodyColor,35));
  c.fillStyle = bg;
  _rrect(c,-bw/2+1,-bh/2,bw-2,bh,cr,true,false);

  // Roof
  var rf = vtype==='suv'?0.48:vtype==='van'||vtype==='bus'?0.52:0.42;
  var rg = c.createLinearGradient(-bw/2,0,bw/2,0);
  rg.addColorStop(0,'rgba(0,0,0,0.30)');
  rg.addColorStop(0.5,isPlayer?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.06)');
  rg.addColorStop(1,'rgba(0,0,0,0.30)');
  c.fillStyle = rg;
  if(vtype!=='bus') c.fillRect(-bw/2+2,-bh*rf/2,bw-4,bh*rf);

  // Bus side windows
  if(vtype==='bus'){
    c.fillStyle='rgba(120,195,255,0.22)';
    for(var bwy=-bh/2+14;bwy<bh/2-16;bwy+=12){
      c.fillRect(-bw/2+2,bwy,4,8);c.fillRect(bw/2-6,bwy,4,8);
    }
  }

  // Windshield
  var wf = vtype==='bus'?0.13:vtype==='van'?0.17:0.22;
  c.fillStyle = isPlayer?'rgba(140,220,255,0.52)':'rgba(120,195,255,0.30)';
  _rrect(c,-bw/2+3,-bh/2+4,bw-6,bh*wf,2,true,false);
  c.fillStyle='rgba(255,255,255,0.18)';
  c.fillRect(-bw/2+4,-bh/2+5,(bw-10)*0.5,2);

  // Rear glass
  if(vtype!=='van'&&vtype!=='bus'){
    c.fillStyle=isPlayer?'rgba(90,165,220,0.30)':'rgba(80,150,210,0.18)';
    c.fillRect(-bw/2+3,bh/2-bh*0.22,bw-6,bh*0.16);
  }

  // Taxi sign
  if(vtype==='taxi'){
    c.fillStyle='rgba(0,0,0,0.75)';c.fillRect(-6,-bh/2-5.5,12,5);
    c.fillStyle='#fbbf24';c.font='bold 4px monospace';c.textAlign='center';
    c.fillText('ТАКСИ',0,-bh/2-1.5);
  }

  // Player glow indicator
  if(isPlayer){
    c.shadowColor='#ff8800';c.shadowBlur=12;
    c.strokeStyle='rgba(255,140,0,0.60)';c.lineWidth=1.8;c.setLineDash([3,3]);
    _rrect(c,-bw/2-3,-bh/2-3,bw+6,bh+6,cr+2,false,true);
    c.setLineDash([]);c.shadowBlur=0;
  }

  // Damage dents
  if(isPlayer && car.damaged){
    c.fillStyle='rgba(0,0,0,0.35)';
    car.dents.forEach(function(d){
      c.beginPath();c.arc(d.lx,d.ly,3.5,0,Math.PI*2);c.fill();
    });
  }

  // Outline
  c.strokeStyle='rgba(0,0,0,0.40)';c.lineWidth=0.9;c.setLineDash([]);
  _rrect(c,-bw/2+1,-bh/2,bw-2,bh,cr,false,true);

  c.restore();
}

// ── AI Cars ───────────────────────────────────────────────────
function rAICars(c) {
  G.aiCars.forEach(function(ai) {
    if (!ai.active) return;
    _drawCar(c, ai, ai.color, _darken(ai.color,38), false);

    // Headlights
    var fOff = ai.h/2+2;
    var hsp = _wToS(ai.x+Math.cos(ai.angle)*fOff, ai.y+Math.sin(ai.angle)*fOff);
    var hlr = (ai.vtype==='bus'?3.2:2.4) * _pxWx;
    c.fillStyle = 'rgba(255,255,200,0.80)';
    c.beginPath(); c.arc(hsp[0]-5*_pxWx*Math.sin(ai.angle+Math.PI/2)*0, hsp[1], hlr, 0, Math.PI*2); c.fill();
    // Simple: just 2 dots forward of car position
    var hx1 = ai.x + Math.cos(ai.angle)*fOff - Math.sin(ai.angle)*5;
    var hy1 = ai.y + Math.sin(ai.angle)*fOff + Math.cos(ai.angle)*5;
    var hx2 = ai.x + Math.cos(ai.angle)*fOff + Math.sin(ai.angle)*5;
    var hy2 = ai.y + Math.sin(ai.angle)*fOff - Math.cos(ai.angle)*5;
    var sp1 = _wToS(hx1,hy1), sp2 = _wToS(hx2,hy2);
    c.beginPath(); c.arc(sp1[0],sp1[1],hlr,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(sp2[0],sp2[1],hlr,0,Math.PI*2); c.fill();

    // Brake lights
    if (ai.waiting) {
      var rOff = ai.h/2+2;
      var rx1 = ai.x - Math.cos(ai.angle)*rOff - Math.sin(ai.angle)*5;
      var ry1 = ai.y - Math.sin(ai.angle)*rOff + Math.cos(ai.angle)*5;
      var rx2 = ai.x - Math.cos(ai.angle)*rOff + Math.sin(ai.angle)*5;
      var ry2 = ai.y - Math.sin(ai.angle)*rOff - Math.cos(ai.angle)*5;
      var rsp1 = _wToS(rx1,ry1), rsp2 = _wToS(rx2,ry2);
      c.shadowColor='#ef4444'; c.shadowBlur=8;
      c.fillStyle='rgba(239,68,68,0.90)';
      c.beginPath(); c.arc(rsp1[0],rsp1[1],2.5*_pxWx,0,Math.PI*2); c.fill();
      c.beginPath(); c.arc(rsp2[0],rsp2[1],2.5*_pxWx,0,Math.PI*2); c.fill();
      c.shadowBlur=0;
    }
  });
}

// ── Police Car ────────────────────────────────────────────────
function rPolice(c) {
  G.police.forEach(function(pc) {
    _drawCar(c, pc, '#1d4ed8', '#163ba8', false);

    var sp0 = _wToS(pc.x, pc.y);
    c.save();
    c.translate(sp0[0], sp0[1]);
    c.scale(_pxWx, _pxWy);
    c.rotate(pc.angle);
    c.fillStyle='rgba(255,255,255,0.52)'; c.fillRect(-10,-4,20,8);
    c.fillStyle='#fff'; c.font='bold 5px monospace'; c.textAlign='center';
    c.fillText('ЦАГДАА',0,2);
    c.restore();

    if (pc.sirenOn) {
      var redOn = pc._lp < 20;
      var slx = pc.x + Math.cos(pc.angle)*16;
      var sly = pc.y + Math.sin(pc.angle)*16;
      var ssp = _wToS(slx, sly);
      c.save();
      c.translate(ssp[0], ssp[1]);
      c.rotate(pc.angle);
      c.shadowColor=redOn?'#ef4444':'#3b82f6'; c.shadowBlur=20;
      c.fillStyle=redOn?'#ef4444':'#3b82f6';
      c.beginPath();c.arc(-4*_pxWx,0,4.5*_pxWx,0,Math.PI*2);c.fill();
      c.shadowColor=redOn?'#3b82f6':'#ef4444';
      c.fillStyle=redOn?'#3b82f6':'#ef4444';
      c.beginPath();c.arc(4*_pxWx,0,4.5*_pxWx,0,Math.PI*2);c.fill();
      c.shadowBlur=0; c.restore();
    }

    if (pc._dispatchAnim && pc._dispatchTimer > 0) {
      var dsp = _wToS(pc.x, pc.y);
      c.save(); c.translate(dsp[0], dsp[1]);
      c.font = (13*_pxWx)+'px serif'; c.textAlign='center';
      c.globalAlpha = pc._dispatchTimer/90;
      c.fillText('📻', 0, -pc.h*_pxWy/2-14*_pxWy);
      c.globalAlpha=1; c.restore();
    }
  });
}

// ── Player Car ────────────────────────────────────────────────
function rPlayer(c) {
  var p = G.player;
  if (p.crashed && G.frame%8 < 4) return;

  _drawCar(c, p, '#ff6a00', '#c84c00', true);

  // Headlights glow
  if (p.speed > 0.3) {
    var fOff = 20;
    var hx1 = p.x + Math.cos(p.angle)*fOff - Math.sin(p.angle)*5;
    var hy1 = p.y + Math.sin(p.angle)*fOff + Math.cos(p.angle)*5;
    var hx2 = p.x + Math.cos(p.angle)*fOff + Math.sin(p.angle)*5;
    var hy2 = p.y + Math.sin(p.angle)*fOff - Math.cos(p.angle)*5;
    var sp1=_wToS(hx1,hy1), sp2=_wToS(hx2,hy2);
    c.shadowColor='#ffffaa'; c.shadowBlur=20;
    c.fillStyle='rgba(255,255,200,0.95)';
    c.beginPath();c.arc(sp1[0],sp1[1],3*_pxWx,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(sp2[0],sp2[1],3*_pxWx,0,Math.PI*2);c.fill();
    c.shadowBlur=0;
  }

  // Brake lights
  if (p.braking || p.crashed) {
    var rOff = 20;
    var rx1 = p.x - Math.cos(p.angle)*rOff - Math.sin(p.angle)*5;
    var ry1 = p.y - Math.sin(p.angle)*rOff + Math.cos(p.angle)*5;
    var rx2 = p.x - Math.cos(p.angle)*rOff + Math.sin(p.angle)*5;
    var ry2 = p.y - Math.sin(p.angle)*rOff - Math.cos(p.angle)*5;
    var brsp1=_wToS(rx1,ry1), brsp2=_wToS(rx2,ry2);
    c.shadowColor='#ef4444'; c.shadowBlur=20;
    c.fillStyle='rgba(239,68,68,0.95)';
    c.beginPath();c.arc(brsp1[0],brsp1[1],3.5*_pxWx,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(brsp2[0],brsp2[1],3.5*_pxWx,0,Math.PI*2);c.fill();
    c.shadowBlur=0;
  }

  // Horn
  if (p.horn) {
    var hsp = _wToS(p.x, p.y);
    c.save(); c.translate(hsp[0], hsp[1]);
    c.font = (12*_pxWx)+'px serif'; c.textAlign='center';
    c.globalAlpha = 0.8+Math.sin(G.frame*0.4)*0.2;
    c.fillText('📯', 0, -p.h*_pxWy/2-12*_pxWy);
    c.globalAlpha=1; c.restore();
  }

  // Health bar above car
  if (p.health < 100) {
    var hbSp = _wToS(p.x, p.y - p.h/2 - 12);
    var barW = 30*_pxWx;
    c.save(); c.translate(hbSp[0]-barW/2, hbSp[1]-3*_pxWy);
    c.fillStyle='rgba(0,0,0,0.55)'; c.fillRect(0,0,barW,6*_pxWy);
    var hCol = p.health>60?'#22c55e':p.health>30?'#f59e0b':'#ef4444';
    c.fillStyle=hCol; c.fillRect(0,0,barW*p.health/100,6*_pxWy);
    c.restore();
  }
}

// ── Particles ─────────────────────────────────────────────────
function rParticles(c) {
  G.particles.forEach(function(p) {
    var sp = _wToS(p.x, p.y);
    c.globalAlpha = p.life/p.max;
    c.fillStyle = p.color;
    c.beginPath(); c.arc(sp[0], sp[1], p.r*_pxWx, 0, Math.PI*2); c.fill();
  });
  c.globalAlpha = 1;
}

// ── Utilities ─────────────────────────────────────────────────
function _darken(hex, amt) {
  var n=parseInt(hex.replace('#',''),16);
  var r=Math.max(0,((n>>16)&0xff)-amt);
  var g=Math.max(0,((n>>8)&0xff)-amt);
  var b=Math.max(0,(n&0xff)-amt);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
function _lighten(hex, amt) {
  var n=parseInt(hex.replace('#',''),16);
  var r=Math.min(255,((n>>16)&0xff)+amt);
  var g=Math.min(255,((n>>8)&0xff)+amt);
  var b=Math.min(255,(n&0xff)+amt);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
function _rrect(c,x,y,w,h,r,fill,stroke){
  if(typeof c.roundRect==='function'){
    c.beginPath();c.roundRect(x,y,w,h,r);
    if(fill)c.fill();if(stroke)c.stroke();
  } else {
    if(fill)c.fillRect(x,y,w,h);if(stroke)c.strokeRect(x,y,w,h);
  }
}
