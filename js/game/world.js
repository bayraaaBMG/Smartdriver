'use strict';
// ═══════════════════════════════════════════════════════════════
//  WORLD.JS — Улаанбаатарын бодит газрын зурагны өгөгдөл
//  Central UB: Сүхбаатарын талбай орчим  ~4.2km × 2.8km
// ═══════════════════════════════════════════════════════════════

var WORLD = { W: 4200, H: 2800, LANE_W: 26 };

// ── Road definitions ──────────────────────────────────────────
// H_ROADS: [x0, yCen, xLen, totalW, lanesPerDir, speedLimit, name]
var H_ROADS = [
  [0,  550, 4200,  80, 2, 40, 'Бага тойруу'],
  [0, 1120, 4200,  80, 2, 50, 'Чингисийн өргөн чөлөө'],
  [0, 1680, 4200, 156, 3, 60, 'Энхтайваны өргөн чөлөө'],
  [0, 2350, 4200,  80, 2, 40, 'Их тойруу'],
];

// V_ROADS: [xCen, y0, yLen, totalW, lanesPerDir, speedLimit, name]
var V_ROADS = [
  [ 480,   0, 2800,  80, 2, 40, 'Баруун 4 зам'],
  [1100,   0, 2800,  80, 2, 50, 'Сеулийн гудамж'],
  [1860,   0, 2800, 100, 2, 60, 'Чингисийн гудамж'],
  [2680,   0, 2800,  80, 2, 50, 'Цэцэрлэгийн гудамж'],
  [3480,   0, 2800,  80, 2, 40, 'Нарны зам'],
];

// ── Сүхбаатарын талбай ────────────────────────────────────────
// Between Сеулийн гудамж(x=1140) and Чингисийн гудамж(x=1810),
// between Чингисийн avenue(y=1160) and Энхтайваны(y=1602)
var SUKHBAATAR_SQ = {
  x: 1140, y: 1180, w: 670, h: 400,
  name: 'Сүхбаатарын талбай',
  flagX: 1475, flagY: 1420, // Чингис хааны хөшөөний байрлал
};

// ── Тодогдох барилгууд / Landmarks ───────────────────────────
// [x, y, w, h, baseCol, roofCol, name, type]
var LANDMARKS = [
  // Засгийн газар / Монгол улсын их хурал (Parliament)
  [1190, 910, 620, 190, '#7e6e58', '#9e8e78', 'Засгийн Газар / УИХ', 'gov'],
  // Blue Sky Tower (жинхэнэ тэнгэр цэнхэр өндөр барилга)
  [3145, 1535, 80, 250, '#3a6a92', '#5a9ab8', 'Blue Sky Tower', 'tower'],
  // Их дэлгүүр (State Dept Store)
  [1960, 1768, 175, 90, '#7a8868', '#8a9878', 'Их Дэлгүүр', 'shop'],
  // Монголбанк (Central Bank)
  [1108, 1768, 145, 88, '#686870', '#787880', 'Монголбанк', 'bank'],
  // Улаанбаатар зочид буудал
  [2692, 1625, 135, 92, '#8a7468', '#9a8478', 'УБ Зочид Буудал', 'hotel'],
  // Шангри-Ла зочид буудал
  [3385, 490, 105, 125, '#6e6a68', '#8e8a88', 'Шангри-Ла', 'hotel'],
  // Спорт ордон
  [500, 1618, 185, 118, '#6a7868', '#7a8878', 'Спорт Ордон', 'pub'],
  // Монголын үндэсний музей
  [2100, 910, 130, 88, '#7e7464', '#8e8474', 'Үндэсний Музей', 'museum'],
  // МУИС (university)
  [492, 900, 195, 130, '#7a7062', '#8a8072', 'МУИС', 'edu'],
  // Номын их дэлгүүр
  [3355, 1622, 125, 92, '#7a6e62', '#8a7e72', 'НОМ дэлгүүр', 'shop'],
  // Цэцэрлэгт хүрээлэн (park building)
  [270, 690, 165, 250, '#2c4a1a', '#3a6028', 'Цэцэрлэгт Хүрээлэн', 'park'],
  // Cinema
  [600, 1200, 110, 80, '#685e60', '#786e70', 'Тэнгис Кино Театр', 'pub'],
];

// ── Зогсоол (Parking Lots) ────────────────────────────────────
// {x,y,w,h,cols,rows} — all are horizontal parking bays
var wParkingLots = [
  {x:580,  y:1805, w:185, h:78, cols:5, rows:3},  // Peace Ave south, west
  {x:2080, y:1805, w:165, h:78, cols:4, rows:3},  // Peace Ave south, mid
  {x:3100, y:1805, w:160, h:78, cols:4, rows:3},  // Peace Ave south, east
  {x:595,  y:1498, w:175, h:66, cols:5, rows:2},  // Peace Ave north
  {x:2810, y:1650, w:135, h:78, cols:3, rows:3},  // near UB Hotel
  {x:3395, y:638,  w:148, h:84, cols:4, rows:3},  // Shangri-La
  {x:620,  y:608,  w:155, h:80, cols:4, rows:3},  // Baga Toiruu north
  {x:2110, y:608,  w:140, h:75, cols:4, rows:3},  // Baga Toiruu mid
];

// ── Автобусны буудал ──────────────────────────────────────────
var BUS_STOPS = [];
(function() {
  // Peace Avenue south side (eastbound)
  [350,820,1310,2100,2900,3700].forEach(x => BUS_STOPS.push({x, y:1602, side:'n'}));
  // Peace Avenue north side (westbound)
  [350,820,1310,2100,2900,3700].forEach(x => BUS_STOPS.push({x, y:1758, side:'s'}));
  // Baga Toiruu
  [800, 2000, 3200].forEach(x => BUS_STOPS.push({x, y:510, side:'n'}));
})();

// ── World arrays (populated by buildWorld) ────────────────────
var wRoads = [], wInters = [], wBuildings = [], wTrees = [];

// ── Build ─────────────────────────────────────────────────────
function buildWorld() {
  wRoads = []; wInters = []; wBuildings = []; wTrees = [];
  G.lights = [];

  // Process road definitions into rect objects
  H_ROADS.forEach(([x0, yCen, len, w, lpd, spd, name]) => {
    wRoads.push({ horiz:true, x0, y0:yCen-w/2, len, w, h:w, yCen, lpd, spd, name });
  });
  V_ROADS.forEach(([xCen, y0, len, w, lpd, spd, name]) => {
    wRoads.push({ horiz:false, x0:xCen-w/2, y0, len, w, h:len, xCen, lpd, spd, name });
  });

  // Intersections + traffic lights
  var phaseOff = 0;
  H_ROADS.forEach(([hx0, hyCen, hxLen, hw]) => {
    V_ROADS.forEach(([vxCen, vy0, vyLen, vw]) => {
      if (vxCen > hx0 && vxCen < hx0+hxLen && hyCen > vy0 && hyCen < vy0+vyLen) {
        wInters.push({ x:vxCen, y:hyCen, hw:hw/2, vw:vw/2 });
        G.lights.push(new TrafficLight(vxCen, hyCen, hw/2, vw/2, phaseOff));
        phaseOff = (phaseOff + 91) % 440;
      }
    });
  });

  _genBuildings();
  _genTrees();
}

// ── Procedural buildings (fill city blocks) ───────────────────
function _genBuildings() {
  var xs = [0];
  V_ROADS.forEach(([xc,,,w]) => { xs.push(xc-w/2); xs.push(xc+w/2); });
  xs.push(WORLD.W);
  xs.sort((a,b)=>a-b);

  var ys = [0];
  H_ROADS.forEach(([,yc,,w]) => { ys.push(yc-w/2); ys.push(yc+w/2); });
  ys.push(WORLD.H);
  ys.sort((a,b)=>a-b);

  var cols = [
    // cream / light facades common in UB
    '#d8d0c0','#d0c8b8','#ccc4b4','#c8bfb0','#d4ccba',
    // beige / sand stone
    '#b8ae9e','#b0a896','#bab29e','#b4ac9a','#bcb4a4',
    // medium warm
    '#9a9080','#92887a','#9e9484','#948c7c','#a09688',
    // cool gray-blue (Soviet-era concrete)
    '#8a8c98','#848690','#90929e','#888a96','#8c8e9a',
    // darker tones
    '#7a7060','#6e6c62','#787068','#726a62','#7c746c',
  ];

  var bid = 0;
  for (var xi=0; xi<xs.length-1; xi++) {
    for (var yi=0; yi<ys.length-1; yi++) {
      var bx=xs[xi], bx2=xs[xi+1], by=ys[yi], by2=ys[yi+1];
      var bw=bx2-bx, bh=by2-by;
      if (bw<90 || bh<70) continue; // road gap

      // Check if this block is Sukhbaatar Square area
      if (_blockInSq(bx,by,bx2,by2)) { bid+=50; continue; }
      // Check if covered by a landmark
      if (_blockHasLandmark(bx,by,bx2,by2)) { bid+=20; continue; }

      var mg=10;
      var blkX=bx+mg, blkY=by+mg, blkW=bw-mg*2, blkH=bh-mg*2;
      var nx=Math.max(1, Math.floor(blkW/(55+_rng(bid,50))));
      var ny=Math.max(1, Math.floor(blkH/(45+_rng(bid+1,40))));
      var bwu=blkW/nx, bhu=blkH/ny;

      for (var i=0; i<nx; i++) {
        for (var j=0; j<ny; j++) {
          var gap=5;
          var b={
            x:blkX+i*bwu+gap, y:blkY+j*bhu+gap,
            w:bwu-gap*2, h:bhu-gap*2,
            col: cols[Math.floor(_rng(bid*13+i*7+j, cols.length))],
          };
          if (b.w>10 && b.h>10) wBuildings.push(b);
          bid++;
        }
      }
    }
  }

  // Add landmarks as "buildings" with special rendering flag
  LANDMARKS.forEach(([lx,ly,lw,lh,col,rCol,name,type]) => {
    if (type==='park') return; // park has special rendering
    wBuildings.push({ x:lx, y:ly, w:lw, h:lh, col, rCol, name, type, landmark:true });
  });
}

function _blockInSq(bx,by,bx2,by2) {
  var sq=SUKHBAATAR_SQ;
  return bx2>sq.x && bx<sq.x+sq.w && by2>sq.y && by<sq.y+sq.h;
}

function _blockHasLandmark(bx,by,bx2,by2) {
  return LANDMARKS.some(([lx,ly,lw,lh]) =>
    bx2>lx && bx<lx+lw && by2>ly && by<ly+lh
  );
}

function _rng(seed, max) {
  var s=Math.sin(seed*9301+49297)*233280;
  return Math.abs(s-Math.floor(s))*max;
}

// ── Trees ─────────────────────────────────────────────────────
function _genTrees() {
  wRoads.forEach(function(r, ri) {
    if (r.horiz) {
      for (var x=30; x<r.len; x+=38+Math.sin(x*0.13+ri)*5) {
        var bx=r.x0+x;
        if (!_isInterArea(bx, r.y0-15)) _addTree(bx, r.y0-15, ri, x);
        if (!_isInterArea(bx, r.y0+r.h+15)) _addTree(bx, r.y0+r.h+15, ri+1, x);
        if (r.lpd>=3 && !_isInterArea(bx, r.yCen)) _addTree(bx, r.yCen, ri+2, x, 13);
      }
    } else {
      for (var y=30; y<r.len; y+=38+Math.cos(y*0.11+ri)*5) {
        var by=r.y0+y;
        if (!_isInterArea(r.x0-15, by)) _addTree(r.x0-15, by, ri, y);
        if (!_isInterArea(r.x0+r.w+15, by)) _addTree(r.x0+r.w+15, by, ri+1, y);
      }
    }
  });

  // Trees in Sukhbaatar Square perimeter
  var sq=SUKHBAATAR_SQ;
  for (var tx=sq.x+30; tx<sq.x+sq.w-30; tx+=40) {
    wTrees.push({x:tx, y:sq.y+12, r:9, a:'#3d6a28', b:'#1e4a14'});
    wTrees.push({x:tx, y:sq.y+sq.h-12, r:9, a:'#3d6a28', b:'#1e4a14'});
  }
  for (var ty=sq.y+40; ty<sq.y+sq.h-40; ty+=40) {
    wTrees.push({x:sq.x+12, y:ty, r:9, a:'#3d6a28', b:'#1e4a14'});
    wTrees.push({x:sq.x+sq.w-12, y:ty, r:9, a:'#3d6a28', b:'#1e4a14'});
  }
}

var _tCols=[{a:'#3d6a28',b:'#1e4a14'},{a:'#426c26',b:'#1c5012'},{a:'#386022',b:'#1a4810'}];
function _addTree(x, y, ri, seed, r) {
  r = r || 8+Math.sin(seed*0.17+ri)*2;
  var col=_tCols[(ri+Math.floor(seed/80))%3];
  wTrees.push({x,y,r,a:col.a,b:col.b});
}

function _isInterArea(x, y) {
  return wInters.some(function(n){ return Math.abs(x-n.x)<n.vw*1.15 && Math.abs(y-n.y)<n.hw*1.15; });
}

// ── Road query helpers ────────────────────────────────────────
function getRoadAt(x, y) {
  return wRoads.find(function(r) {
    if (r.horiz) return y>=r.y0 && y<=r.y0+r.h && x>=r.x0 && x<=r.x0+r.len;
    return x>=r.x0 && x<=r.x0+r.w && y>=r.y0 && y<=r.y0+r.len;
  }) || null;
}

function getSpeedLimitAt(x, y) {
  var r=getRoadAt(x,y);
  return r ? r.spd : 60;
}

function getRoadNameAt(x, y) {
  var r=getRoadAt(x,y);
  return r ? r.name : '';
}
