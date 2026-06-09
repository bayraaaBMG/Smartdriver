// ═══════════════════════════════════════════════════
// 🚗 SIMULATOR ENGINE
// ═══════════════════════════════════════════════════
const SIM_SCENARIOS = [
  {id:'sc1',icon:'🏙️',name:'Гэрэл дохиотой уулзвар',desc:'Улаанбаатарын гэрэл дохиотой уулзвар. Улаанд зогсож, ногоонд явна.',diff:'diff-easy',diffLabel:'Амархан',task:'Улаан гэрлийг дагаж уулзвараар нэвтэр',col:'#22c55e'},
  {id:'sc2',icon:'🚶',name:'Явган хүний гарц',desc:'Тэмдэглэгдсэн гарцад явган хүнд зам тавих дадлага.',diff:'diff-easy',diffLabel:'Амархан',task:'Явган хүний гарцад заавал зогс — замыг тав',col:'#3b82f6'},
  {id:'sc3',icon:'🔴',name:'STOP тэмдгийн уулзвар',desc:'Гэрэл дохиогүй STOP тэмдэгтэй аюултай уулзвар.',diff:'diff-med',diffLabel:'Дунд',task:'STOP тэмдгийн дэргэд БҮРЭН зогс',col:'#ef4444'},
  {id:'sc4',icon:'❄️',name:'Өвлийн мөстэй зам',desc:'Мөстэй замд гальмуурдах зай 5-10 дахин нэмэгдэнэ.',diff:'diff-med',diffLabel:'Дунд',task:'40 км/ц-ийн дотор байж аюулгүй нэвтэр',col:'#60a5fa'},
  {id:'sc5',icon:'🚑',name:'Яаралтай тусламж',desc:'Дуут дохиотой машин ирэхэд замаас зайл.',diff:'diff-hard',diffLabel:'Хэцүү',task:'Яаралтай тусламжид зам тав — баруун тийш зогс',col:'#f87171'},
  {id:'sc6',icon:'🔄',name:'Дугуй эргэлт',desc:'Дугуй эргэлтэнд зөв орж, зөв гарах дадлага.',diff:'diff-hard',diffLabel:'Хэцүү',task:'Дугуй эргэлтэнд орж дараагийн гарцаар гар',col:'#a78bfa'},
  {id:'ub',icon:'🌆',name:'УБ Хотын Чөлөөт Жолоодлого',desc:'Энхтайваны өргөн чөлөө, Сүхбаатарын талбай, Их дэлгүүрийн уулзвар.',diff:'diff-easy',diffLabel:'Чөлөөт',task:'Улаанбаатарын хотын замаар чөлөөтэй жолоод',col:'#ff6a00'},
];

const simKeys = {};
let simCtx, simCW, simCH;

function lightenHex(hex, amt) {
  const n = parseInt(hex.replace('#',''),16);
  const r = Math.min(255,((n>>16)&0xff)+amt);
  const g = Math.min(255,((n>>8)&0xff)+amt);
  const b = Math.min(255,(n&0xff)+amt);
  return '#'+(r<<16|g<<8|b).toString(16).padStart(6,'0');
}
let simState = null;
let simAnimId = null;
let curScenario = null;
let simPaused = false;

// ── Traffic AI ──
function spawnTraffic(S) {
  if (!S.traffic) S.traffic=[];
  if (S.traffic.length>=5) return;
  const hRoads=(S.roads||[]).filter(r=>r.w>r.h);
  if(!hRoads.length) return;
  const road=hRoads[Math.floor(Math.random()*hRoads.length)];
  const dir=Math.random()>0.5?1:-1;
  const cols=['#3b82f6','#22c55e','#a855f7','#f97316','#64748b','#0891b2'];
  S.traffic.push({
    x:dir>0?road.x-80:road.x+road.w+80,
    y:road.y+road.h*(Math.random()>0.5?0.25:0.75),
    angle:dir>0?0:Math.PI, speed:(1.2+Math.random()*1.8)*dir,
    color:cols[Math.floor(Math.random()*cols.length)],
    life:350+Math.floor(Math.random()*250), penalized:false
  });
}

function updateTraffic(S) {
  if(!S.traffic) return;
  if(Math.random()<0.01) spawnTraffic(S);
  S.traffic=S.traffic.filter(t=>t.life>0);
  S.traffic.forEach(t=>{
    t.x+=Math.cos(t.angle)*t.speed;
    t.y+=Math.sin(t.angle)*t.speed;
    t.life--;
    if(!S.car) return;
    const d=Math.hypot(S.car.x-t.x,S.car.y-t.y);
    if(d<26&&!t.penalized&&Math.abs(S.car.speed)>0.3){
      t.penalized=true;
      simDeduct(20,'💥 Машинтай мөргөлдлөө! −20 оноо');
      setTimeout(()=>{if(t)t.penalized=false;},3000);
    }
  });
}

function drawTraffic(S,c,offX,offY){
  S.traffic?.forEach(t=>{
    const sx=S.ubMode?t.x+offX:t.x;
    const sy=S.ubMode?t.y+offY:t.y;
    c.save();c.translate(sx,sy);c.rotate(t.angle+Math.PI/2);
    // shadow
    c.fillStyle='rgba(0,0,0,0.28)';
    c.beginPath();c.ellipse(2,2,10,16,0,0,Math.PI*2);c.fill();
    // body
    const tg=c.createLinearGradient(-9,-15,9,-15);
    tg.addColorStop(0,darkenHex(t.color,30));tg.addColorStop(0.5,t.color);tg.addColorStop(1,darkenHex(t.color,30));
    c.fillStyle=tg;c.beginPath();c.roundRect(-9,-15,18,30,4);c.fill();
    // roof
    c.fillStyle=darkenHex(t.color,50);
    c.beginPath();c.roundRect(-6,-9,12,14,3);c.fill();
    // windshield
    c.fillStyle='rgba(160,220,255,0.65)';
    c.beginPath();c.roundRect(-5,-13,10,8,2);c.fill();
    // headlights
    c.fillStyle='rgba(255,240,160,0.7)';
    c.fillRect(-8,-15,4,3);c.fillRect(4,-15,4,3);
    // taillights
    c.fillStyle='rgba(255,60,60,0.8)';
    c.fillRect(-8,12,4,3);c.fillRect(4,12,4,3);
    // outline
    c.strokeStyle='rgba(0,0,0,0.3)';c.lineWidth=1;
    c.beginPath();c.roundRect(-9,-15,18,30,4);c.stroke();
    c.restore();
  });
}

function darkenHex(hex, amt) {
  const n=parseInt((hex.replace('#','').length===3?hex.replace('#','').split('').map(x=>x+x).join(''):hex.replace('#','')),16);
  const r=Math.max(0,((n>>16)&0xff)-amt);
  const g=Math.max(0,((n>>8)&0xff)-amt);
  const b=Math.max(0,(n&0xff)-amt);
  return '#'+(r<<16|g<<8|b).toString(16).padStart(6,'0');
}

// ══════════════════════════════════════════════════════════════
//  UB SATELLITE-STYLE RENDERER  (Google Maps top-down look)
// ══════════════════════════════════════════════════════════════
function drawUBSatellite(c, S) {
  const ub=S.ub, WW=S.worldW, WH=S.worldH;

  // ── 1. Ground ────────────────────────────────────────────
  c.fillStyle='#5c5246'; c.fillRect(0,0,WW,WH);
  // texture: faint variation patches
  c.fillStyle='rgba(0,0,0,0.055)';
  for(let i=0;i<18;i++){
    c.fillRect((i*347)%WW, (i*211)%WH, 180+((i*127)%130), 30+((i*89)%35));
  }
  c.fillStyle='rgba(255,255,255,0.012)';
  for(let i=0;i<12;i++){
    c.fillRect((i*421+100)%WW, (i*183+50)%WH, 100+((i*97)%90), 20+((i*71)%25));
  }

  // ── 2. Building blocks ───────────────────────────────────
  S.ubBlocks?.forEach(b=>{
    c.fillStyle='rgba(0,0,0,0.22)'; c.fillRect(b.x+4,b.y+4,b.w,b.h);
    c.fillStyle=b.col; c.fillRect(b.x,b.y,b.w,b.h);
    // parapet edge lines
    c.strokeStyle='rgba(0,0,0,0.18)'; c.lineWidth=1; c.strokeRect(b.x,b.y,b.w,b.h);
    c.strokeStyle='rgba(255,255,255,0.07)'; c.lineWidth=1.5; c.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);
    // HVAC box (center)
    if(b.w>40&&b.h>28){
      c.fillStyle='rgba(0,0,0,0.12)';
      c.fillRect(b.x+b.w/2-8,b.y+b.h/2-6,16,12);
    }
    if(b.label){
      c.font='bold 8px monospace'; c.fillStyle='rgba(255,255,255,0.28)'; c.textAlign='center';
      c.fillText(b.label, b.x+b.w/2, b.y+b.h/2+3);
    }
  });

  // ── 3. Parking lots ──────────────────────────────────────
  S.ubParkings?.forEach(p=>{
    c.fillStyle='#3a3530'; c.fillRect(p.x,p.y,p.w,p.h);
    c.strokeStyle='rgba(220,215,200,0.35)'; c.lineWidth=1;
    const stalls=Math.floor(p.w/16);
    for(let i=0;i<=stalls;i++){
      c.beginPath(); c.moveTo(p.x+i*16,p.y); c.lineTo(p.x+i*16,p.y+p.h); c.stroke();
    }
  });

  // ── 4. Sidewalks ─────────────────────────────────────────
  c.fillStyle='#8a7d68';
  c.fillRect(0,ub.nSidewY,WW,ub.sideH);
  c.fillRect(0,ub.sSidewY,WW,ub.sideH);
  // Cross street sidewalk zones
  ub.crosses.forEach(([cx,cw])=>{
    c.fillStyle='#8a7d68';
    c.fillRect(cx-4,0,cw+8,WH);
  });

  // ── 5. Roads ─────────────────────────────────────────────
  const roadCol='#282420';
  // Cross streets drawn first (under main road)
  ub.crosses.forEach(([cx,cw])=>{
    c.fillStyle=roadCol; c.fillRect(cx,0,cw,WH);
  });
  // Main road
  c.fillStyle=roadCol;
  c.fillRect(0,ub.nRoadY,WW,ub.nRoadH);
  c.fillRect(0,ub.sRoadY,WW,ub.sRoadH);
  // Median
  c.fillStyle='#2d4a20'; c.fillRect(0,ub.medY,WW,ub.medH);
  // subtle median texture
  c.fillStyle='rgba(0,0,0,0.12)';
  for(let x=0;x<WW;x+=80) c.fillRect(x,ub.medY,40,ub.medH);

  // ── 6. Lane markings ─────────────────────────────────────
  const nL=ub.nRoadH/3, sL=ub.sRoadH/3;
  // North road lane dividers (dashed white)
  c.setLineDash([22,13]); c.strokeStyle='rgba(230,225,205,0.6)'; c.lineWidth=1.5;
  for(let i=1;i<3;i++){
    const ly=ub.nRoadY+nL*i;
    c.beginPath(); c.moveTo(0,ly); c.lineTo(WW,ly); c.stroke();
  }
  // South road lane dividers
  for(let i=1;i<3;i++){
    const ly=ub.sRoadY+sL*i;
    c.beginPath(); c.moveTo(0,ly); c.lineTo(WW,ly); c.stroke();
  }
  c.setLineDash([]);
  // Road edge lines (solid white)
  c.strokeStyle='rgba(235,230,210,0.75)'; c.lineWidth=2;
  [[ub.nRoadY+1,ub.nRoadY+ub.nRoadH-1],[ub.sRoadY+1,ub.sRoadY+ub.sRoadH-1]].forEach(([y1,y2])=>{
    c.beginPath(); c.moveTo(0,y1); c.lineTo(WW,y1); c.stroke();
    c.beginPath(); c.moveTo(0,y2); c.lineTo(WW,y2); c.stroke();
  });
  // Cross street center dashes
  ub.crosses.forEach(([cx,cw])=>{
    c.setLineDash([8,6]); c.strokeStyle='rgba(230,225,205,0.45)'; c.lineWidth=1.5;
    c.beginPath(); c.moveTo(cx+cw/2,0); c.lineTo(cx+cw/2,WH); c.stroke();
    c.setLineDash([]);
  });

  // ── 7. Crosswalk stripes ─────────────────────────────────
  ub.crosses.forEach(([cx,cw])=>{
    // At north road
    for(let i=0;i<4;i++){
      c.fillStyle='rgba(238,232,215,0.72)';
      c.fillRect(cx-3,ub.nRoadY+i*16+4,cw+6,9);
    }
    // At south road
    for(let i=0;i<4;i++){
      c.fillStyle='rgba(238,232,215,0.72)';
      c.fillRect(cx-3,ub.sRoadY+i*16+4,cw+6,9);
    }
  });

  // ── 8. Trees ─────────────────────────────────────────────
  S.ubTrees?.forEach(t=>{
    // shadow
    c.fillStyle='rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(t.x+3,t.y+4,t.r*0.82,t.r*0.78,0,0,Math.PI*2); c.fill();
    // canopy radial gradient
    const tg=c.createRadialGradient(t.x-t.r*0.3,t.y-t.r*0.28,t.r*0.08,t.x,t.y,t.r);
    tg.addColorStop(0,t.bright);
    tg.addColorStop(0.55,t.base);
    tg.addColorStop(1,t.dark);
    c.fillStyle=tg; c.beginPath(); c.arc(t.x,t.y,t.r,0,Math.PI*2); c.fill();
    // specular highlight
    c.fillStyle='rgba(255,255,255,0.07)';
    c.beginPath(); c.ellipse(t.x-t.r*0.22,t.y-t.r*0.22,t.r*0.38,t.r*0.32,-0.4,0,Math.PI*2); c.fill();
  });

  // ── 9. Traffic lights (small, roadside) ─────────────────
  const lc={red:'#ef4444',yellow:'#fbbf24',green:'#22c55e'};
  S.lights?.forEach(l=>{
    c.fillStyle='#444'; c.fillRect(l.x-1,l.y+2,3,20);
    c.fillStyle='#181818'; c.beginPath(); c.roundRect(l.x-8,l.y-30,16,34,3); c.fill();
    ['red','yellow','green'].forEach((col,i)=>{
      c.beginPath(); c.arc(l.x,l.y-22+i*11,4.5,0,Math.PI*2);
      const on=l.state===col;
      c.fillStyle=on?lc[col]:'rgba(255,255,255,0.06)';
      if(on){c.shadowColor=lc[col]; c.shadowBlur=12;}
      c.fill(); c.shadowBlur=0;
    });
  });

  // ── 10. Signs ────────────────────────────────────────────
  S.signs?.forEach(sg=>{
    c.fillStyle='#555'; c.fillRect(sg.x-1.5,sg.y+1,3,16);
    c.fillStyle='rgba(18,18,22,0.92)'; c.beginPath(); c.roundRect(sg.x-14,sg.y-28,28,28,3); c.fill();
    c.font='16px serif'; c.textAlign='center'; c.fillText(sg.icon,sg.x,-10+sg.y);
    if(S.car){
      const d=Math.hypot(S.car.x-sg.x,S.car.y-sg.y);
      if(d<110){
        c.strokeStyle=`rgba(255,149,0,${0.9*(1-d/110)})`; c.lineWidth=2.5;
        c.beginPath(); c.arc(sg.x,sg.y-14,20,0,Math.PI*2); c.stroke();
      }
    }
  });

  // ── 11. Pedestrians ──────────────────────────────────────
  S.peds?.forEach(p=>{
    for(let i=-3;i<3;i++){
      c.fillStyle=i%2===0?'rgba(248,244,234,0.82)':'rgba(0,0,0,0.08)';
      c.fillRect(p.x-22,p.y-20+i*8,44,6);
    }
    c.font='18px serif'; c.textAlign='center';
    c.fillText(p.waiting?'🧍':'🚶',p.x,p.y+7);
  });

  // ── 12. Ambulance ────────────────────────────────────────
  if(S.ambulance?.active){
    const a=S.ambulance;
    c.save(); c.translate(a.x,a.y+8);
    if(Math.floor(Date.now()/150)%2){
      c.beginPath(); c.arc(0,-18,9,0,Math.PI*2);
      c.fillStyle='rgba(0,100,255,0.55)'; c.shadowColor='#0066ff'; c.shadowBlur=18; c.fill(); c.shadowBlur=0;
    }
    c.font='24px serif'; c.textAlign='center'; c.fillText('🚑',0,0);
    c.restore();
  }

  // ── 13. Street name labels ───────────────────────────────
  c.font='bold 8px monospace'; c.fillStyle='rgba(255,255,255,0.18)'; c.textAlign='left';
  c.fillText('ЭНХТАЙВАНЫ ӨРГӨН ЧӨЛӨӨ  ▶', 22, ub.nRoadY+ub.nRoadH/2+3);
  c.fillStyle='rgba(255,255,255,0.12)'; c.textAlign='right';
  c.fillText('◀  PEACE AVENUE', WW-22, ub.sRoadY+ub.sRoadH/2+3);
  ub.crosses.forEach(([cx,cw,name])=>{
    c.font='bold 7px monospace'; c.fillStyle='rgba(255,149,0,0.4)'; c.textAlign='center';
    c.fillText(name, cx+cw/2, ub.medY+ub.medH/2+3);
  });

  // ── 14. Particles ────────────────────────────────────────
  S.particles?.forEach(p=>{
    c.beginPath(); c.arc(p.x,p.y,p.r*(p.life/p.max),0,Math.PI*2);
    c.fillStyle=`rgba(150,140,130,${0.28*p.life/p.max})`; c.fill();
  });

  // ── 15. Damage flash ─────────────────────────────────────
  if(S._flash>0){
    c.fillStyle=`rgba(239,68,68,${S._flash/20*0.22})`;
    c.fillRect(-200,-200,WW+400,WH+400); S._flash--;
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''),16);
  return `${(n>>16)&0xff},${(n>>8)&0xff},${n&0xff}`;
}

// ── Scenario select ──
function showSimulator() {
  hideAll();
  const sc = document.getElementById('sim-scenario-screen');
  sc.style.display = 'flex';
  sc.style.flexDirection = 'column';
  const grid = document.getElementById('sc-grid');
  const prog = JSON.parse(localStorage.getItem('sdu_sim')||'{}');
  grid.innerHTML = SIM_SCENARIOS.map((s,i) => {
    const locked = i > 1 && !prog[SIM_SCENARIOS[i-1].id];
    const cleared = !!prog[s.id];
    const rgb = hexToRgb(s.col);
    return `<div class="sc-card ${locked?'locked':''} ${cleared?'cleared':''}" style="--sc-c:${s.col};--sc-rgb:${rgb}" onclick="${locked?'':` startScenario('${s.id}')`}">
      ${cleared?'<div class="sc-badge-cleared">✓</div>':''}
      <div class="sc-icon">${s.icon}</div>
      <div class="sc-name">${s.name}${locked?' 🔒':''}</div>
      <div class="sc-desc">${s.desc}</div>
      <span class="sc-diff ${s.diff}">${s.diffLabel}</span>
    </div>`;
  }).join('');
}

function startScenario(id) {
  curScenario = SIM_SCENARIOS.find(s => s.id === id);
  hideAll();
  const sc = document.getElementById('sim-screen');
  sc.style.display = 'flex';
  sc.style.flexDirection = 'column';
  document.getElementById('sim-sc-title').textContent = curScenario.name.toUpperCase();
  document.getElementById('sim-task-txt').textContent = curScenario.task;
  document.getElementById('sim-result-overlay').classList.remove('show');
  initSimCanvas();
  buildMap(id);
  runSimLoop();
}

function initSimCanvas() {
  const canvas = document.getElementById('sim-canvas');
  const wrap = canvas.parentElement;
  simCW = Math.min(wrap.clientWidth || 800, 860);
  simCH = Math.round(simCW * 0.5);
  canvas.width = simCW; canvas.height = simCH;
  canvas.style.height = simCH + 'px';
  simCtx = canvas.getContext('2d');
}

function buildMap(id) {
  if (simAnimId) cancelAnimationFrame(simAnimId);
  const cx = simCW/2, cy = simCH/2;
  simState = {
    running: true, id,
    car: {x: cx, y: cy+simCH*0.25, angle: -Math.PI/2, speed: 0, maxSpeed: 5.8, accel: 0.2, brake: 0.28, friction: 0.07},
    score: 100, errors: 0,
    elapsed: 0, timerRef: setInterval(()=>{ if(simState?.running && !simPaused) simState.elapsed++; }, 1000),
    roads:[], lights:[], signs:[], peds:[], particles:[],
    completed: false, iceMode: id==='sc4', popTimer: 0,
    ambulance: null, roundabout: null,
  };
  const S = simState;

  if (id==='sc1') {
    S.roads = [{x:cx-500,y:cy-24,w:1000,h:48},{x:cx-24,y:cy-300,w:48,h:600}];
    S.lights = [
      {x:cx+36,y:cy-52,state:'red',t:0,cycle:200,phase:0,penalized:false},
      {x:cx-52,y:cy+36,state:'green',t:100,cycle:200,phase:100,penalized:false},
    ];
  } else if (id==='sc2') {
    S.roads = [{x:cx-500,y:cy-24,w:1000,h:48},{x:cx-24,y:cy-300,w:48,h:600}];
    S.peds = [{x:cx+70,y:cy-28,vy:0.6,waiting:true,crossed:false,timer:150,penalized:false}];
    S.signs = [{x:cx-20,y:cy-70,icon:'🚸',name:'Явган хүний гарц',rule:'Явган хүнд заавал зам тавина',triggered:false}];
  } else if (id==='sc3') {
    S.roads = [{x:cx-500,y:cy-24,w:1000,h:48},{x:cx-24,y:cy-300,w:48,h:600}];
    S.signs = [{x:cx-22,y:cy+52,icon:'🔴',name:'STOP',rule:'Заавал БҮРЭН зогс — хурдаа бааруулах хангалтгүй!',triggered:false,isStop:true}];
  } else if (id==='sc4') {
    S.roads = [{x:cx-700,y:cy-30,w:1400,h:60}];
    S.signs = [{x:cx+180,y:cy-48,icon:'❄️',name:'Мөстэй зам',rule:'Хурдаа бааруул — гальмуурдах зай 5–10 дахин нэмэгдэнэ',triggered:false}];
  } else if (id==='sc5') {
    S.roads = [{x:cx-500,y:cy-24,w:1000,h:48},{x:cx-24,y:cy-300,w:48,h:600}];
    S.ambulance = {x:simCW+80,y:cy-12,vx:-3.2,active:true,penalized:false};
    S.signs = [{x:cx-140,y:cy-52,icon:'🚑',name:'Яаралтай тусламж',rule:'Замаас зайл — баруун тийш зогсо!',triggered:false}];
  } else if (id==='sc6') {
    S.roads = [{x:cx-500,y:cy-22,w:1000,h:44},{x:cx-22,y:cy-300,w:44,h:600}];
    S.roundabout = {x:cx,y:cy,r:68};
    S.signs = [{x:cx+90,y:cy-80,icon:'🔄',name:'Дугуй эргэлт',rule:'Дотор талын машинд замыг заавал тавина',triggered:false}];
  } else if (id==='ub') {
    // ─── UB World: 2800×520, Peace Avenue satellite view ───
    const WW=2800, WH=520;
    S.worldW=WW; S.worldH=WH;

    const ub = {
      nRoadY:177, nRoadH:72,   // north lanes (eastbound)
      medY:249,   medH:42,     // median green strip
      sRoadY:291, sRoadH:72,   // south lanes (westbound)
      nSidewY:158, sideH:19,   // sidewalks (N/S same height)
      sSidewY:363,
      // [x, width, name]
      crosses:[
        [300, 50,'Бага тойруу'],
        [660, 50,'Чингисийн гудамж'],
        [1060,52,'Сүхбаатарын талбай'],
        [1500,52,'Их тойруу'],
        [1920,50,'Нарны зам'],
        [2360,50,'Сэлбийн гүүр'],
      ],
    };
    S.ub = ub;

    // roads for penalty checks + minimap
    S.roads = [
      {x:0,y:ub.nRoadY,w:WW,h:ub.nRoadH,name:'Энхтайваны өргөн чөлөө'},
      {x:0,y:ub.sRoadY,w:WW,h:ub.sRoadH,name:'Энхтайваны өргөн чөлөө'},
      ...ub.crosses.map(([cx,cw,n])=>({x:cx,y:0,w:cw,h:WH,name:n})),
    ];

    S.lights = ub.crosses.flatMap(([cx,,],i)=>[
      {x:cx-4,y:ub.nRoadY-38,state:'red', t:0,cycle:200,phase:i*42, penalized:false},
      {x:cx-4,y:ub.sRoadY-38,state:'green',t:0,cycle:200,phase:i*42+100,penalized:false},
    ]);

    S.signs = [
      {x:580, y:ub.nRoadY-44,icon:'⚠️',name:'Уулзвар ойрхон',rule:'Хурдаа бааруул',triggered:false},
      {x:980, y:ub.nRoadY-44,icon:'🚸',name:'Явган хүний гарц',rule:'Явган хүнд заавал замыг тав',triggered:false},
      {x:1420,y:ub.nRoadY-44,icon:'🔴',name:'STOP — Их тойруу',rule:'Бүрэн зогс',triggered:false,isStop:true},
      {x:1850,y:ub.nRoadY-44,icon:'🏎️',name:'Хурдны хязгаар 60',rule:'Хот дотор 60 км/ц-аас хэтрэхгүй',triggered:false},
    ];

    S.peds = [
      {x:1060+26,y:ub.nRoadY+12,vy:0.55,waiting:true,crossed:false,timer:220,penalized:false},
      {x:1060+26,y:ub.nRoadY+36,vy:0.45,waiting:true,crossed:false,timer:380,penalized:false},
    ];

    // ── Tree rows ──
    S.ubTrees = [];
    const tPalette=[
      {bright:'#3d6a28',base:'#1e4e14',dark:'#123010'},
      {bright:'#426c26',base:'#1c5012',dark:'#10300a'},
      {bright:'#386022',base:'#1c4810',dark:'#122e0a'},
      {bright:'#3a6426',base:'#204e14',dark:'#14320e'},
    ];
    const tp=(x,salt=0)=>tPalette[Math.floor(Math.abs(Math.sin(x*0.08+salt))*tPalette.length)];

    // Median (dense)
    for(let x=18;x<WW;x+=33){
      if(ub.crosses.some(([cx,cw])=>x>cx-20&&x<cx+cw+20)) continue;
      S.ubTrees.push({x,y:ub.medY+ub.medH/2,r:13+Math.sin(x*0.17)*2,...tp(x)});
    }
    // North road outer edge
    for(let x=22;x<WW;x+=37){
      if(ub.crosses.some(([cx,cw])=>x>cx-18&&x<cx+cw+18)) continue;
      S.ubTrees.push({x,y:ub.nSidewY-11,r:11+Math.cos(x*0.13)*2.5,...tp(x,50)});
    }
    // South road outer edge
    for(let x=22;x<WW;x+=37){
      if(ub.crosses.some(([cx,cw])=>x>cx-18&&x<cx+cw+18)) continue;
      S.ubTrees.push({x,y:ub.sSidewY+ub.sideH+12,r:11+Math.sin(x*0.11)*2.5,...tp(x,100)});
    }
    // Yard clusters (north + south)
    for(let x=70;x<WW;x+=110){
      if(ub.crosses.some(([cx,cw])=>x>cx-35&&x<cx+cw+35)) continue;
      for(let j=0;j<3;j++){
        const tx=x+j*26+Math.sin(x*0.3+j)*12;
        S.ubTrees.push({x:tx,y:75+Math.cos(tx*0.2)*18,r:8+Math.sin(tx)*1.5,...tp(tx,j*70)});
        S.ubTrees.push({x:tx,y:ub.sSidewY+ub.sideH+42+Math.sin(tx*0.2)*14,r:8+Math.cos(tx)*1.5,...tp(tx,j*90+200)});
      }
    }

    // ── City block buildings (top-down) ──
    S.ubBlocks = [];
    const bPalette=['#8a7a68','#7a8a80','#9a8e78','#7a7082','#8a7268','#6a7a88','#8e8278','#787c6a','#6a6870','#8a8068'];
    const bp=(x,salt=0)=>bPalette[Math.floor(Math.abs(Math.sin(x*0.12+salt))*bPalette.length)];
    const maxNY=ub.nSidewY-20, minSY=ub.sSidewY+ub.sideH+22;

    const addRow=(startY, rowH, rowOffset=0, salt=0)=>{
      let bx=rowOffset;
      while(bx<WW){
        const skip=ub.crosses.some(([cx,cw])=>bx+8>cx-4&&bx<cx+cw+12);
        if(skip){bx+=ub.crosses.find(([cx,cw])=>bx+8>cx-4&&bx<cx+cw+12)?.[1]+15||60;continue;}
        const bw=65+Math.floor(Math.abs(Math.sin(bx*0.11+salt))*55);
        const bh=Math.min(rowH,maxNY-startY-4);
        if(bx+bw>WW||bh<10) break;
        S.ubBlocks.push({x:bx,y:startY,w:bw,h:bh,col:bp(bx,salt),label:''});
        bx+=bw+6+Math.floor(Math.abs(Math.sin(bx*0.22+salt))*14);
      }
    };
    addRow(4, 52, 0, 0);      // north row 1 (close to top)
    addRow(62, 58, 30, 1.5);  // north row 2

    // south buildings
    let sbx=0;
    while(sbx<WW){
      const skip=ub.crosses.some(([cx,cw])=>sbx+8>cx-4&&sbx<cx+cw+12);
      if(skip){sbx+=ub.crosses.find(([cx,cw])=>sbx+8>cx-4&&sbx<cx+cw+12)?.[1]+15||60;continue;}
      const bw=70+Math.floor(Math.abs(Math.sin(sbx*0.1+2))*60);
      const bh=Math.min(58+Math.floor(Math.abs(Math.cos(sbx*0.08+1))*28), WH-minSY-4);
      if(sbx+bw>WW) break;
      S.ubBlocks.push({x:sbx,y:minSY,w:bw,h:bh,col:bp(sbx,2),label:''});
      sbx+=bw+7+Math.floor(Math.abs(Math.cos(sbx*0.19+1))*12);
    }

    // Named landmarks override
    S.ubBlocks.push({x:990, y:5,  w:130,h:55,col:'#6a5e52',label:'Их дэлгүүр'});
    S.ubBlocks.push({x:1400,y:8,  w:110,h:50,col:'#527080',label:'Shangri-La'});
    S.ubBlocks.push({x:2100,y:6,  w:95, h:52,col:'#505870',label:'Blue Sky'});
    S.ubBlocks.push({x:650, y:minSY,w:120,h:55,col:'#5a506a',label:'МУИС'});
    S.ubBlocks.push({x:1060,y:minSY,w:100,h:50,col:'#526048',label:'МҮТҮО'});

    // Parking lots
    S.ubParkings=[
      {x:320, y:maxNY+2,  w:300,h:16},
      {x:1120,y:4,        w:240,h:14},
      {x:1550,y:maxNY+2,  w:320,h:16},
    ];

    // Car: right lane of eastbound, at world start
    S.car={x:80,y:ub.nRoadY+ub.nRoadH*5/6,angle:0,speed:0,maxSpeed:5.2,accel:0.18,brake:0.25,friction:0.065};
    S.ubMode=true;
    simLog('🌆 Улаанбаатар — Энхтайваны өргөн чөлөө. WASD/сумны товчоор жолоодно уу.');
  }
  simUpdateHUD();
}

function runSimLoop() {
  if (simAnimId) cancelAnimationFrame(simAnimId);
  function loop() {
    if (!simState?.running) return;
    simAnimId = requestAnimationFrame(loop);
    if (simPaused) { drawPause(); return; }
    simUpdate(); simDraw();
  }
  loop();
}

function simUpdate() {
  const S = simState, car = S.car;
  const ice = S.iceMode;
  const up = simKeys['ArrowUp']||simKeys['w']||simKeys['W'];
  const dn = simKeys['ArrowDown']||simKeys['s']||simKeys['S'];
  const lt = simKeys['ArrowLeft']||simKeys['a']||simKeys['A'];
  const rt = simKeys['ArrowRight']||simKeys['d']||simKeys['D'];

  const ac = ice ? car.accel*0.45 : car.accel;
  const br = ice ? car.brake*0.3  : car.brake;
  const fr = ice ? car.friction*0.25 : car.friction;

  car.braking = dn && car.speed > 0.3;
  if (up && car.speed < car.maxSpeed) car.speed += ac;
  else if (dn && car.speed > -car.maxSpeed*0.35) car.speed -= br;
  else { car.speed *= (1-fr); if (Math.abs(car.speed)<0.02) car.speed=0; }

  const steer = 0.05 * Math.min(1, Math.abs(car.speed)/1.5);
  if (lt) car.angle -= steer;
  if (rt) car.angle += steer;

  car.x += Math.cos(car.angle)*car.speed;
  car.y += Math.sin(car.angle)*car.speed;
  if (S.ubMode) {
    car.x = Math.max(16, Math.min(S.worldW-16, car.x));
    car.y = Math.max(16, Math.min(S.worldH-16, car.y));
  } else {
    car.x = Math.max(16, Math.min(simCW-16, car.x));
    car.y = Math.max(16, Math.min(simCH-16, car.y));
  }

  const kmh = Math.round(Math.abs(car.speed)*18);
  document.getElementById('hud-speed').textContent = kmh;
  const pct = Math.min(100, kmh/1.5);
  const fill = document.getElementById('hud-speed-fill');
  fill.style.width = pct+'%';
  fill.style.background = kmh>70?'#ef4444':kmh>50?'#ff6a00':'#22c55e';
  document.getElementById('hud-gear').textContent = kmh<5?'N':kmh<20?'1':kmh<40?'2':kmh<60?'3':kmh<80?'4':'5';

  if (ice && kmh>40 && !S._iceWarn) {
    S._iceWarn=true; simDeduct(15,'❄️ Мөстэй замд 40 км/ц хэтэрлээ! −15 оноо');
  } else if (!ice && kmh>65 && !S._speedWarn) {
    S._speedWarn=true; simDeduct(10,'⚡ Хурдны хязгаар зөрчлөө! −10');
    setTimeout(()=>S._speedWarn=false,4000);
  }

  S.lights?.forEach(l => {
    l.t = (l.t+1) % l.cycle;
    const p = (l.t+l.phase) % l.cycle;
    l.state = p < l.cycle*0.42 ? 'red' : p < l.cycle*0.52 ? 'yellow' : 'green';
    const d = Math.hypot(car.x-l.x, car.y-l.y);
    if (d<28 && l.state==='red' && Math.abs(car.speed)>0.5 && !l.penalized) {
      l.penalized=true; simDeduct(20,'🚦 Улаан гэрэл зөрчлөө! −20 оноо');
      setTimeout(()=>{ if(l) l.penalized=false; },5000);
    }
    if (d>60) l.penalized=false;
  });

  S.signs?.forEach(sg => {
    const d = Math.hypot(car.x-sg.x, car.y-sg.y);
    if (d<80 && !sg.triggered) {
      sg.triggered=true;
      showSimPopup(sg.icon, sg.name, sg.rule);
      simLog('📍 '+sg.name+': '+sg.rule);
      if (sg.isStop && Math.abs(car.speed)>0.4) simDeduct(25,'🛑 STOP зөрчлөө! БҮРЭН зогсоогүй! −25');
    }
    if (d>160) sg.triggered=false;
  });

  if (S.popTimer>0) { S.popTimer--; if(!S.popTimer) document.getElementById('sim-sign-popup').style.display='none'; }

  S.peds?.forEach(p => {
    if (p.timer>0) { p.timer--; return; }
    if (!p.crossed) {
      p.y += p.vy; p.waiting=false;
      if (p.y > simCH/2+60) p.crossed=true;
      const d = Math.hypot(car.x-p.x, car.y-p.y);
      if (d<32 && Math.abs(car.speed)>0.4 && !p.penalized) {
        p.penalized=true; simDeduct(30,'🚶 Явган хүн мөргөлдлөө! −30 оноо');
      }
    }
  });

  if (S.ambulance?.active) {
    S.ambulance.x += S.ambulance.vx;
    const d = Math.hypot(car.x-S.ambulance.x, car.y-S.ambulance.y);
    if (d<50 && Math.abs(car.speed)>0.5 && !S.ambulance.penalized) {
      S.ambulance.penalized=true; simDeduct(25,'🚑 Яаралтай машинд зам тавиагүй! −25');
    }
    if (S.ambulance.x < -80) S.ambulance.active=false;
  }

  if (Math.abs(car.speed)>1.5) {
    for(let i=0;i<2;i++) S.particles.push({
      x:car.x-Math.cos(car.angle)*13+(Math.random()-.5)*5,
      y:car.y-Math.sin(car.angle)*13+(Math.random()-.5)*5,
      vx:-Math.cos(car.angle)*(0.3+Math.random()*0.5),
      vy:-Math.sin(car.angle)*(0.3+Math.random()*0.5)+(Math.random()-.5)*0.4,
      life:16, max:16, r:1.5+Math.random()*1.5
    });
  }
  S.particles = S.particles.filter(p=>p.life>0);
  S.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;});

  updateTraffic(simState);
  checkComplete();
}

function checkComplete() {
  if (simState.completed) return;
  const S = simState, car = S.car;
  const cx=simCW/2, cy=simCH/2;
  let done = false;
  if (S.id==='sc1') done = car.x>cx+120 && Math.abs(car.y-cy)<30;
  else if (S.id==='sc2') done = S.peds[0]?.crossed && car.x>cx+100;
  else if (S.id==='sc3') done = S.signs[0]?.triggered && Math.abs(car.speed)<0.1 && Math.abs(car.x-cx)<60;
  else if (S.id==='sc4') done = car.x>cx+260;
  else if (S.id==='sc5') done = !S.ambulance?.active && car.x>cx+100;
  else if (S.id==='sc6') done = car.x>cx+120 && car.y<cy-40;
  if (done) { simState.completed=true; simState.running=false; clearInterval(simState.timerRef); showSimResult(); }
}

function simDraw() {
  const S = simState, car = S.car, c = simCtx;
  const cx=simCW/2, cy=simCH/2;
  c.clearRect(0,0,simCW,simCH);

  let offX=0, offY=0;
  if (S.ubMode) {
    offX = -(car.x - simCW*0.38);
    offY = -(car.y - simCH*0.5);
    offX = Math.max(-(S.worldW - simCW*0.62), Math.min(simCW*0.38, offX));
    offY = Math.max(-(S.worldH - simCH*0.5), Math.min(simCH*0.1, offY));
  }
  c.save();
  c.translate(offX, offY);

  // ── UB mode: full satellite rendering ──
  if (S.ubMode) {
    drawUBSatellite(c, S);
    drawTraffic(S, c, offX, offY);
    c.restore();
    const sx=car.x+offX, sy=car.y+offY;
    drawSimCar({...car,x:sx,y:sy});
    // UB header bar
    const hg=c.createLinearGradient(0,0,0,34);
    hg.addColorStop(0,'rgba(6,6,12,0.9)');hg.addColorStop(1,'rgba(6,6,12,0)');
    c.fillStyle=hg;c.fillRect(0,0,simCW,38);
    c.font='bold 11px monospace';c.fillStyle='rgba(255,106,0,0.85)';c.textAlign='center';
    c.fillText('🌆  УЛААНБААТАР — Энхтайваны өргөн чөлөө  |  Чөлөөт жолоодлого',simCW/2,18);
    // Compass
    c.save();c.translate(simCW-46,simCH-46);
    c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.fillStyle='rgba(6,6,12,0.88)';c.fill();
    c.strokeStyle='rgba(255,106,0,0.3)';c.lineWidth=1.5;c.stroke();
    [['Х',-Math.PI/2,'#ff6a00'],['З',0,'rgba(240,238,234,0.4)'],['Ө',Math.PI/2,'rgba(240,238,234,0.4)'],['Д',Math.PI,'rgba(240,238,234,0.4)']].forEach(([d,a,col])=>{
      c.font='bold 9px monospace';c.fillStyle=col;c.textAlign='center';
      c.fillText(d,Math.cos(a)*16,Math.sin(a)*16+3);
    });
    c.restore();
    // Minimap
    const mmEl=document.getElementById('sim-minimap');
    if(mmEl){
      let cv=mmEl.querySelector('canvas');
      if(!cv){cv=document.createElement('canvas');cv.width=100;cv.height=78;mmEl.appendChild(cv);}
      const mc=cv.getContext('2d');
      mc.fillStyle='#0d1008';mc.fillRect(0,0,100,78);
      const mW=S.worldW,mH=S.worldH;
      // roads
      S.roads?.forEach(r=>{mc.fillStyle='#383228';mc.fillRect(r.x/mW*100,r.y/mH*78,Math.max(r.w/mW*100,2),Math.max(r.h/mH*78,2));});
      // median green
      const ub=S.ub;
      mc.fillStyle='#2d4820';mc.fillRect(0,ub.medY/mH*78,100,Math.max(ub.medH/mH*78,2));
      // car dot
      const mx=car.x/mW*100,my=car.y/mH*78;
      mc.beginPath();mc.arc(mx,my,4,0,Math.PI*2);
      mc.fillStyle='#ff6a00';mc.shadowColor='#ff6a00';mc.shadowBlur=8;mc.fill();mc.shadowBlur=0;
      mc.beginPath();
      mc.moveTo(mx+Math.cos(car.angle)*6,my+Math.sin(car.angle)*6);
      mc.lineTo(mx+Math.cos(car.angle+2.4)*3,my+Math.sin(car.angle+2.4)*3);
      mc.lineTo(mx+Math.cos(car.angle-2.4)*3,my+Math.sin(car.angle-2.4)*3);
      mc.closePath();mc.fillStyle='#ff9500';mc.fill();
      mc.strokeStyle='rgba(255,106,0,0.3)';mc.lineWidth=1;mc.strokeRect(0,0,100,78);
    }
    return; // skip rest of simDraw
  }

  // ── Non-UB generic rendering ──
  const bgX = -80;
  const bgY = -80;
  const bgW = simCW+200;
  const bgH = simCH+200;

  if (S.iceMode) {
    const iceGrad = c.createLinearGradient(0,0,0,bgH);
    iceGrad.addColorStop(0,'#c8dff0');iceGrad.addColorStop(1,'#a8c8e0');
    c.fillStyle=iceGrad; c.fillRect(bgX,bgY,bgW,bgH);
    // snow texture dots
    c.fillStyle='rgba(255,255,255,0.4)';
    for(let i=0;i<60;i++){
      const tx=(Math.sin(i*137.5)*0.5+0.5)*bgW+bgX;
      const ty=(Math.cos(i*97.3)*0.5+0.5)*bgH+bgY;
      c.beginPath();c.arc(tx,ty,1.5+Math.sin(i)*1,0,Math.PI*2);c.fill();
    }
  } else {
    // Green grass
    const grassGrad = c.createLinearGradient(0,0,0,bgH);
    grassGrad.addColorStop(0,'#1a3020');grassGrad.addColorStop(1,'#152618');
    c.fillStyle=grassGrad; c.fillRect(bgX,bgY,bgW,bgH);
    // grass texture lines
    c.strokeStyle='rgba(255,255,255,0.025)';c.lineWidth=1;
    for(let i=0;i<20;i++){
      const ty=bgY+i*(bgH/20);
      c.beginPath();c.moveTo(bgX,ty);c.lineTo(bgX+bgW,ty);c.stroke();
    }
  }

  // ── Roads ──
  S.roads?.forEach(r=>{
    const horiz = r.w > r.h;
    // sidewalks
    if (!S.iceMode) {
      c.fillStyle='#2a2820';
      if(horiz){c.fillRect(r.x,r.y-9,r.w,9);c.fillRect(r.x,r.y+r.h,r.w,9);}
      else{c.fillRect(r.x-9,r.y,9,r.h);c.fillRect(r.x+r.w,r.y,9,r.h);}
    }
    c.fillStyle=S.iceMode?'#8090a8':'#282828';
    c.fillRect(r.x,r.y,r.w,r.h);
    c.strokeStyle=S.iceMode?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.35)';
    c.lineWidth=2;c.setLineDash([]);
    c.strokeRect(r.x+1,r.y+1,r.w-2,r.h-2);
    c.setLineDash([horiz?22:16,13]);
    c.strokeStyle=S.iceMode?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.3)';
    c.lineWidth=2.5;c.beginPath();
    if(horiz){c.moveTo(r.x,r.y+r.h/2);c.lineTo(r.x+r.w,r.y+r.h/2);}
    else{c.moveTo(r.x+r.w/2,r.y);c.lineTo(r.x+r.w/2,r.y+r.h);}
    c.stroke();c.setLineDash([]);
  });

  // ── Ice patches ──
  if(S.iceMode){
    c.fillStyle='rgba(200,230,255,0.35)';
    [[cx-100,cy-15,130,28],[cx+60,cy-18,95,38],[cx-210,cy-8,75,18],[cx+180,cy+10,60,22]].forEach(([x,y,w,h])=>{
      c.beginPath();c.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);c.fill();
    });
    // shimmer
    c.strokeStyle='rgba(255,255,255,0.2)';c.lineWidth=1;
    [[cx-80,cy-10,80,18],[cx+70,cy-14,60,24]].forEach(([x,y,w,h])=>{
      c.beginPath();c.ellipse(x,y,w/2,h/2,0.3,0,Math.PI*2);c.stroke();
    });
  }

  // ── Roundabout ──
  if(S.roundabout){
    const rb=S.roundabout;
    // outer road
    c.beginPath();c.arc(rb.x,rb.y,rb.r+20,0,Math.PI*2);c.fillStyle='#282828';c.fill();
    // center island
    const islandGrad=c.createRadialGradient(rb.x,rb.y,0,rb.x,rb.y,rb.r);
    islandGrad.addColorStop(0,'#1a2e1a');islandGrad.addColorStop(1,'#152518');
    c.beginPath();c.arc(rb.x,rb.y,rb.r,0,Math.PI*2);c.fillStyle=islandGrad;c.fill();
    // ring marking
    c.setLineDash([8,6]);c.strokeStyle='rgba(255,255,255,0.3)';c.lineWidth=2;
    c.beginPath();c.arc(rb.x,rb.y,rb.r+10,0,Math.PI*2);c.stroke();c.setLineDash([]);
    // center tree emoji
    c.font='18px serif';c.textAlign='center';c.fillText('🌳',rb.x,rb.y+6);
  }

  // ── Pedestrian crossings ──
  S.peds?.forEach(p=>{
    // zebra stripes
    for(let i=-3;i<3;i++){
      const alpha = i%2===0 ? 0.85 : 0.08;
      c.fillStyle=`rgba(255,255,255,${alpha})`;
      c.fillRect(p.x-24,p.y-24+i*8,48,7);
    }
    // pedestrian figure
    c.font='20px serif';c.textAlign='center';
    c.fillText(p.waiting?'🧍':'🚶',p.x,p.y+8);
  });

  // ── Traffic lights ──
  S.lights?.forEach(l=>{
    const lc={red:'#ef4444',yellow:'#fbbf24',green:'#22c55e'};
    // pole
    c.strokeStyle='#444';c.lineWidth=3;
    c.beginPath();c.moveTo(l.x,l.y+4);c.lineTo(l.x,l.y+26);c.stroke();
    // housing
    c.fillStyle='#1a1a1a';
    c.beginPath();c.roundRect(l.x-10,l.y-38,20,42,4);c.fill();
    c.strokeStyle='rgba(255,255,255,0.1)';c.lineWidth=1;
    c.beginPath();c.roundRect(l.x-10,l.y-38,20,42,4);c.stroke();
    // lights
    ['red','yellow','green'].forEach((col,i)=>{
      const active=l.state===col;
      c.beginPath();c.arc(l.x,l.y-28+i*13,5.5,0,Math.PI*2);
      if(active){
        c.shadowColor=lc[col];c.shadowBlur=18;
        c.fillStyle=lc[col];
      } else {
        c.fillStyle='rgba(255,255,255,0.06)';
      }
      c.fill();c.shadowBlur=0;
      // active ring
      if(active){
        c.beginPath();c.arc(l.x,l.y-28+i*13,8,0,Math.PI*2);
        c.strokeStyle=lc[col]+'44';c.lineWidth=2;c.stroke();
      }
    });
  });

  // ── Road signs ──
  S.signs?.forEach(sg=>{
    // sign post
    c.fillStyle='#555';c.fillRect(sg.x-2,sg.y+2,4,18);
    // sign board background
    c.fillStyle='rgba(30,30,40,0.9)';
    c.beginPath();c.roundRect(sg.x-16,sg.y-34,32,30,4);c.fill();
    c.strokeStyle='rgba(255,255,255,0.15)';c.lineWidth=1;
    c.beginPath();c.roundRect(sg.x-16,sg.y-34,32,30,4);c.stroke();
    // icon
    c.font='18px serif';c.textAlign='center';c.fillText(sg.icon,sg.x,sg.y-12);
    // proximity glow
    const d=Math.hypot(car.x-sg.x,car.y-sg.y);
    if(d<100){
      const alpha=0.8*(1-d/100);
      c.beginPath();c.arc(sg.x,sg.y-20,20,0,Math.PI*2);
      c.strokeStyle=`rgba(255,149,0,${alpha})`;c.lineWidth=2.5;c.stroke();
    }
  });


  // ── Ambulance ──
  if(S.ambulance?.active){
    const a=S.ambulance;
    c.save();c.translate(a.x,a.y+8);
    // flashing light
    if(Math.floor(Date.now()/150)%2){
      c.beginPath();c.arc(0,-20,10,0,Math.PI*2);
      c.fillStyle='rgba(0,100,255,0.5)';c.shadowColor='#0066ff';c.shadowBlur=20;c.fill();c.shadowBlur=0;
    }
    c.font='26px serif';c.textAlign='center';c.fillText('🚑',0,0);
    c.restore();
  }

  // ── Destination ──
  const destPts={sc1:{x:cx+200,y:cy},sc2:{x:cx+200,y:cy},sc4:{x:cx+300,y:cy},sc5:{x:cx+200,y:cy},sc6:{x:cx+160,y:cy-80}};
  const dest=destPts[S.id];
  if(dest){
    const t=Date.now();
    const pulse=0.5+0.5*Math.sin(t/280);
    // outer glow ring
    c.beginPath();c.arc(dest.x,dest.y,26+pulse*8,0,Math.PI*2);
    c.strokeStyle=`rgba(34,197,94,${0.2+pulse*0.2})`;c.lineWidth=3;c.stroke();
    // inner ring
    c.beginPath();c.arc(dest.x,dest.y,16,0,Math.PI*2);
    c.fillStyle='rgba(34,197,94,0.15)';c.fill();
    c.strokeStyle='rgba(34,197,94,0.8)';c.lineWidth=2;c.stroke();
    // flag icon
    c.font='18px serif';c.textAlign='center';c.fillText('🏁',dest.x,dest.y+6);
  }

  // ── Exhaust particles ──
  S.particles?.forEach(p=>{
    c.beginPath();c.arc(p.x,p.y,p.r*(p.life/p.max),0,Math.PI*2);
    const a=0.25*p.life/p.max;
    c.fillStyle=S.iceMode?`rgba(200,230,255,${a})`:`rgba(160,160,160,${a})`;
    c.fill();
  });

  // ── Damage flash ──
  if(S._flash>0){
    c.fillStyle=`rgba(239,68,68,${S._flash/20*0.25})`;
    c.fillRect(bgX,bgY,bgW+400,bgH+400);
    S._flash--;
  }

  // ── Traffic vehicles ──
  drawTraffic(S, c, offX, offY);

  c.restore(); // end camera transform

  // ── Player car (screen space) ──
  drawSimCar({...car, x:car.x, y:car.y});

  // ── Minimap (non-UB) ──
  const mmEl=document.getElementById('sim-minimap');
  if(mmEl){
    let cv=mmEl.querySelector('canvas');
    if(!cv){cv=document.createElement('canvas');cv.width=100;cv.height=78;mmEl.appendChild(cv);}
    const mc=cv.getContext('2d');
    mc.fillStyle='#08080e';mc.fillRect(0,0,100,78);
    S.roads?.forEach(r=>{
      mc.fillStyle='#303050';
      mc.fillRect(r.x/simCW*100,r.y/simCH*78,Math.max(r.w/simCW*100,2),Math.max(r.h/simCH*78,2));
    });
    const mx=car.x/simCW*100, my=car.y/simCH*78;
    mc.beginPath();mc.arc(mx,my,4,0,Math.PI*2);
    mc.fillStyle='#ff6a00';mc.shadowColor='#ff6a00';mc.shadowBlur=8;mc.fill();mc.shadowBlur=0;
    mc.beginPath();
    mc.moveTo(mx+Math.cos(car.angle)*6,my+Math.sin(car.angle)*6);
    mc.lineTo(mx+Math.cos(car.angle+2.4)*3,my+Math.sin(car.angle+2.4)*3);
    mc.lineTo(mx+Math.cos(car.angle-2.4)*3,my+Math.sin(car.angle-2.4)*3);
    mc.closePath();mc.fillStyle='#ff9500';mc.fill();
    mc.strokeStyle='rgba(255,106,0,0.3)';mc.lineWidth=1;mc.strokeRect(0,0,100,78);
  }
}

function drawSimCar(car) {
  const c = simCtx;
  c.save();
  c.translate(car.x, car.y);
  c.rotate(car.angle + Math.PI/2);

  // shadow
  c.fillStyle='rgba(0,0,0,0.35)';
  c.beginPath();c.ellipse(3,3,12,18,0,0,Math.PI*2);c.fill();

  // body — orange gradient car (player = orange brand)
  const bodyGrad=c.createLinearGradient(-10,-17,10,-17);
  bodyGrad.addColorStop(0,'#cc4400');
  bodyGrad.addColorStop(0.4,'#ff6a00');
  bodyGrad.addColorStop(1,'#cc4400');
  c.fillStyle=bodyGrad;
  c.beginPath();c.roundRect(-10,-17,20,34,5);c.fill();

  // body shine
  c.fillStyle='rgba(255,255,255,0.12)';
  c.beginPath();c.roundRect(-8,-15,9,14,3);c.fill();

  // roof
  const roofGrad=c.createLinearGradient(-7,-10,7,-10);
  roofGrad.addColorStop(0,'#992200');roofGrad.addColorStop(0.5,'#cc3300');roofGrad.addColorStop(1,'#992200');
  c.fillStyle=roofGrad;
  c.beginPath();c.roundRect(-7,-10,14,16,3);c.fill();

  // windshield
  c.fillStyle='rgba(160,220,255,0.75)';
  c.beginPath();c.roundRect(-6,-14,12,9,2);c.fill();
  // windshield reflection
  c.fillStyle='rgba(255,255,255,0.35)';
  c.beginPath();c.moveTo(-5,-13);c.lineTo(-2,-13);c.lineTo(-3,-6);c.lineTo(-5,-6);c.closePath();c.fill();

  // rear window
  c.fillStyle='rgba(120,180,220,0.6)';
  c.beginPath();c.roundRect(-6,4,12,6,2);c.fill();

  // door line
  c.strokeStyle='rgba(0,0,0,0.3)';c.lineWidth=0.8;
  c.beginPath();c.moveTo(0,-10);c.lineTo(0,14);c.stroke();

  // headlights
  const speed = simState?.car?.speed||0;
  const headOn = speed > 0.5;
  c.fillStyle=headOn?'#ffe566':'rgba(255,229,102,0.5)';
  if(headOn){c.shadowColor='rgba(255,240,150,0.9)';c.shadowBlur=14;}
  c.beginPath();c.roundRect(-10,-17,5,5,1);c.fill();
  c.beginPath();c.roundRect(5,-17,5,5,1);c.fill();
  c.shadowBlur=0;

  // headlight beams (when moving)
  if(headOn){
    const beamGrad=c.createLinearGradient(0,-17,0,-40);
    beamGrad.addColorStop(0,'rgba(255,240,150,0.25)');
    beamGrad.addColorStop(1,'rgba(255,240,150,0)');
    c.fillStyle=beamGrad;
    c.beginPath();c.moveTo(-10,-17);c.lineTo(-15,-42);c.lineTo(15,-42);c.lineTo(10,-17);c.closePath();c.fill();
  }

  // taillights
  const braking = simState?.car?.braking||false;
  c.fillStyle=braking?'#ff1111':'#aa0000';
  if(braking){c.shadowColor='#ff2222';c.shadowBlur=12;}
  c.beginPath();c.roundRect(-10,12,5,5,1);c.fill();
  c.beginPath();c.roundRect(5,12,5,5,1);c.fill();
  c.shadowBlur=0;

  // outline
  c.strokeStyle='rgba(0,0,0,0.4)';c.lineWidth=1.2;
  c.beginPath();c.roundRect(-10,-17,20,34,5);c.stroke();

  c.restore();
}

function drawPause() {
  simDraw();
  simCtx.fillStyle='rgba(10,10,16,0.65)';simCtx.fillRect(0,0,simCW,simCH);
  simCtx.fillStyle='#f0eeea';simCtx.font='bold 26px "JetBrains Mono",monospace';
  simCtx.textAlign='center';simCtx.fillText('⏸ ЗОГССОН',simCW/2,simCH/2-8);
  simCtx.font='13px "JetBrains Mono",monospace';simCtx.fillStyle='rgba(240,238,234,0.4)';
  simCtx.fillText('Space дарж үргэлжлүүлнэ',simCW/2,simCH/2+20);
}

function simDeduct(pts, msg) {
  simState.score = Math.max(0, simState.score-pts);
  simState.errors++;
  simState._flash=22;
  document.getElementById('sim-score-disp').textContent=simState.score;
  const el=document.getElementById('hud-alert');
  el.textContent=msg;el.style.display='block';
  el.style.animation='none';void el.offsetWidth;el.style.animation='shake .3s ease';
  clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',2800);
  simLog('⚠️ '+msg);
}

function showSimPopup(icon,name,rule) {
  document.getElementById('popup-icon').textContent=icon;
  document.getElementById('popup-name').textContent=name;
  document.getElementById('popup-rule').textContent=rule;
  const el=document.getElementById('sim-sign-popup');
  el.style.display='block';el.style.animation='none';void el.offsetWidth;el.style.animation='popIn .25s ease';
  simState.popTimer=180;
}

function simUpdateHUD() {
  if(simState) document.getElementById('sim-score-disp').textContent=simState.score;
}

function showSimResult() {
  const S=simState;
  const overlay=document.getElementById('sim-result-overlay');
  overlay.classList.add('show');
  const pct=S.score;
  let emoji,title,sub;
  if(pct>=90){emoji='🏆';title='Маш сайн!';sub='Дасгалыг бараг алдаагүй дуусгалаа!';}
  else if(pct>=70){emoji='👍';title='Сайн дүн!';sub='Бага зэрэг дадлага хийвэл төгс болно.';}
  else{emoji='📚';title='Дахин дадлага хий';sub='Дүрмийг дахин үзэж дасгалаа давтаарай.';}
  document.getElementById('sro-emoji').textContent=emoji;
  document.getElementById('sro-title').textContent=title;
  document.getElementById('sro-sub').textContent=sub;
  document.getElementById('sro-score').textContent=pct;
  document.getElementById('sro-score').style.color=pct>=80?'#22c55e':pct>=60?'#ff6a00':'#ef4444';
  document.getElementById('sro-errors').textContent=S.errors;
  const m=String(Math.floor(S.elapsed/60)).padStart(2,'0'),s=String(S.elapsed%60).padStart(2,'0');
  document.getElementById('sro-time').textContent=m+':'+s;
  const prog=JSON.parse(localStorage.getItem('sdu_sim')||'{}');
  if(pct>=70) prog[S.id]=true;
  localStorage.setItem('sdu_sim',JSON.stringify(prog));
  simLog('🏁 Дуусгалаа! Оноо: '+pct);
}

function toggleSimPause() {
  if (!simState?.running && !simPaused) return;
  simPaused = !simPaused;
  document.getElementById('sim-pause-btn').textContent = simPaused?'▶ Үргэлжлүүлэх':'⏸ Зогсоох';
  if (!simPaused) runSimLoop();
}

function simRestart() {
  if(simAnimId) cancelAnimationFrame(simAnimId);
  if(simState?.timerRef) clearInterval(simState.timerRef);
  simPaused=false;
  document.getElementById('sim-pause-btn').textContent='⏸ Зогсоох';
  document.getElementById('sim-result-overlay').classList.remove('show');
  document.getElementById('hud-alert').style.display='none';
  document.getElementById('sim-sign-popup').style.display='none';
  if(curScenario) startScenario(curScenario.id);
}

function exitSim() {
  if(simAnimId) cancelAnimationFrame(simAnimId);
  if(simState?.timerRef) clearInterval(simState.timerRef);
  simState=null; simPaused=false;
  showSimulator();
}

function simLog(msg) {
  const el=document.getElementById('sim-log');
  if(el) el.textContent=msg;
}

// ── roundRect polyfill (Safari < 15.4) ──
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
    if(r>w/2)r=w/2; if(r>h/2)r=h/2;
    this.beginPath();
    this.moveTo(x+r,y);
    this.lineTo(x+w-r,y); this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r); this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h); this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r); this.quadraticCurveTo(x,y,x+r,y);
    this.closePath();
    return this;
  };
}
