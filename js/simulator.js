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
    c.fillStyle=t.color;c.beginPath();c.roundRect(-9,-15,18,30,3);c.fill();
    c.fillStyle='rgba(100,170,255,0.5)';c.beginPath();c.roundRect(-7,-13,14,9,2);c.fill();
    c.fillStyle='rgba(255,240,180,0.7)';c.fillRect(-8,-15,5,3);c.fillRect(3,-15,5,3);
    c.restore();
  });
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
    return `<div class="sc-card ${locked?'locked':''} ${cleared?'cleared':''}" style="--sc-c:${s.col}" onclick="${locked?'':` startScenario('${s.id}')`}">
      <div class="sc-icon">${s.icon}</div>
      <div class="sc-name">${s.name} ${locked?'🔒':''}</div>
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
    const W=simCW, H=simCH;
    S.roads = [
      {x:0,y:H/2-36,w:W*3,h:72,name:'Энхтайваны өргөн чөлөө'},
      {x:W*0.15-20,y:0,w:40,h:H,name:'Бага тойруу'},
      {x:W*0.35-20,y:0,w:40,h:H,name:'Чингисийн өргөн чөлөө'},
      {x:W*0.6-20,y:0,w:40,h:H,name:'Их тойруу'},
      {x:W*0.82-20,y:0,w:40,h:H,name:'Сэлбийн гүүр'},
      {x:0,y:H*0.25-16,w:W*3,h:32,name:'Хойд зам'},
      {x:0,y:H*0.75-16,w:W*3,h:32,name:'Өмнөд зам'},
    ];
    S.lights = [
      {x:W*0.15,y:H/2-50,state:'green',t:0,cycle:220,phase:0,penalized:false},
      {x:W*0.35,y:H/2-50,state:'red',t:0,cycle:220,phase:80,penalized:false},
      {x:W*0.6,y:H/2-50,state:'green',t:0,cycle:220,phase:140,penalized:false},
      {x:W*0.82,y:H/2-50,state:'red',t:0,cycle:220,phase:30,penalized:false},
      {x:W*0.35,y:H*0.25-28,state:'green',t:0,cycle:180,phase:60,penalized:false},
      {x:W*0.6,y:H*0.25-28,state:'red',t:0,cycle:180,phase:110,penalized:false},
    ];
    S.signs = [
      {x:W*0.22,y:H/2-55,icon:'⚠️',name:'Анхааруулга — уулзвар',rule:'Уулзвар ойрхон, хурдаа бааруул',triggered:false},
      {x:W*0.5,y:H/2+50,icon:'🚸',name:'Явган хүний гарц — Сүхбаатарын талбай',rule:'Явган хүнд заавал замыг тав',triggered:false},
      {x:W*0.72,y:H*0.25-40,icon:'🔴',name:'STOP — Их дэлгүүрийн уулзвар',rule:'Бүрэн зогс, замыг шалга',triggered:false,isStop:true},
      {x:W*0.88,y:H/2-55,icon:'🏎️',name:'Хурдны хязгаар 60',rule:'Хот дотор 60 км/ц-аас хэтрэхгүй',triggered:false},
    ];
    S.peds = [
      {x:W*0.5+15,y:H/2-32,vy:0.5,waiting:true,crossed:false,timer:200,penalized:false},
      {x:W*0.5-15,y:H/2-32,vy:0.7,waiting:true,crossed:false,timer:320,penalized:false},
    ];
    S.ubBuildings = [
      {x:W*0.08,y:H*0.05,w:80,h:H*0.18,label:'Засгийн газар',c:'#1e293b'},
      {x:W*0.28,y:H*0.05,w:100,h:H*0.16,label:'Их сургууль',c:'#1e3a2f'},
      {x:W*0.44,y:H*0.03,w:120,h:H*0.2,label:'Их дэлгүүр',c:'#2d1b1b'},
      {x:W*0.66,y:H*0.04,w:90,h:H*0.17,label:'Shangri-La',c:'#1a1a2e'},
      {x:W*0.78,y:H*0.05,w:70,h:H*0.18,label:'Blue Sky',c:'#0f2027'},
      {x:W*0.08,y:H*0.58,w:85,h:H*0.3,label:'МҮТҮО',c:'#1e293b'},
      {x:W*0.25,y:H*0.6,w:110,h:H*0.25,label:'Байшин',c:'#1a2a1a'},
      {x:W*0.48,y:H*0.6,w:95,h:H*0.28,label:'Номин',c:'#2a1a1a'},
      {x:W*0.7,y:H*0.58,w:80,h:H*0.3,label:'Оффис',c:'#1a1a2e'},
    ];
    S.ubLandmarks = [
      {x:W*0.42,y:H/2,icon:'🏛️',label:'Сүхбаатарын талбай'},
      {x:W*0.62,y:H*0.24,icon:'🏥',label:'Нэгдсэн эмнэлэг'},
      {x:W*0.18,y:H*0.74,icon:'🎓',label:'МУИС'},
    ];
    S.car = {x:W*0.05,y:H/2,angle:0,speed:0,maxSpeed:5.2,accel:0.18,brake:0.25,friction:0.065};
    S.cam = {x:0, y:0};
    S.ubMode = true;
    simLog('🌆 Улаанбаатар хотын замд тавтай морил! WASD/сумны товчоор жолоодно уу.');
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

  if (up && car.speed < car.maxSpeed) car.speed += ac;
  else if (dn && car.speed > -car.maxSpeed*0.35) car.speed -= br;
  else { car.speed *= (1-fr); if (Math.abs(car.speed)<0.02) car.speed=0; }

  const steer = 0.05 * Math.min(1, Math.abs(car.speed)/1.5);
  if (lt) car.angle -= steer;
  if (rt) car.angle += steer;

  car.x += Math.cos(car.angle)*car.speed;
  car.y += Math.sin(car.angle)*car.speed;
  car.x = Math.max(16, Math.min(simCW-16, car.x));
  car.y = Math.max(16, Math.min(simCH-16, car.y));

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
    offX = -(car.x - simCW*0.35);
    offY = -(car.y - simCH*0.5);
    offX = Math.max(-simCW*1.5, Math.min(simCW*0.2, offX));
    offY = Math.max(-simCH*0.4, Math.min(simCH*0.4, offY));
  }
  c.save();
  c.translate(offX, offY);

  const bgW = S.ubMode ? simCW*3 : simCW+100;
  const bgH = S.ubMode ? simCH*2 : simCH+100;
  const sky = c.createLinearGradient(0,0,0,bgH);
  sky.addColorStop(0, S.iceMode?'#1a2a3a':S.ubMode?'#0b1220':'#1a2a1a');
  sky.addColorStop(1, S.iceMode?'#2a3a4a':S.ubMode?'#111a2a':'#2a3a2a');
  c.fillStyle=sky; c.fillRect(S.ubMode?-200:-50, S.ubMode?-200:-50, bgW+400, bgH+400);

  if (S.ubBuildings) {
    S.ubBuildings.forEach(b=>{
      c.fillStyle=b.c; c.fillRect(b.x,b.y,b.w,b.h);
      c.strokeStyle='rgba(255,255,255,0.06)';c.lineWidth=1;c.strokeRect(b.x,b.y,b.w,b.h);
      const cols=Math.floor(b.w/14), rows=Math.floor(b.h/14);
      for(let r=0;r<rows;r++) for(let cl=0;cl<cols;cl++){
        const lit=Math.sin(b.x*0.1+cl*3.7+r*2.3)>0.15;
        c.fillStyle=lit?'rgba(255,240,180,0.5)':'rgba(255,255,255,0.03)';
        c.fillRect(b.x+4+cl*14,b.y+6+r*14,8,8);
      }
      c.font='bold 9px monospace';c.fillStyle='rgba(255,255,255,0.25)';
      c.textAlign='center';c.fillText(b.label,b.x+b.w/2,b.y+b.h+11);
    });
  }

  S.roads?.forEach(r=>{
    c.fillStyle=S.iceMode?'#3a3a4a':S.ubMode?'#1c2230':'#2a2a2a';
    c.fillRect(r.x,r.y,r.w,r.h);
    c.setLineDash([r.w>r.h?20:15,12]);
    c.strokeStyle=S.ubMode?'rgba(255,210,60,0.3)':'rgba(255,255,255,0.25)';
    c.lineWidth=2; c.beginPath();
    if(r.w>r.h){c.moveTo(r.x,r.y+r.h/2);c.lineTo(r.x+r.w,r.y+r.h/2);}
    else{c.moveTo(r.x+r.w/2,r.y);c.lineTo(r.x+r.w/2,r.y+r.h);}
    c.stroke(); c.setLineDash([]);
    c.strokeStyle='rgba(255,255,255,0.4)';c.lineWidth=1.5;c.strokeRect(r.x,r.y,r.w,r.h);
    if(S.ubMode){
      c.fillStyle='rgba(255,255,255,0.035)';
      if(r.w>r.h){c.fillRect(r.x,r.y-7,r.w,7);c.fillRect(r.x,r.y+r.h,r.w,7);}
      else{c.fillRect(r.x-7,r.y,7,r.h);c.fillRect(r.x+r.w,r.y,7,r.h);}
    }
    if(S.ubMode&&r.name&&r.w>r.h&&r.w>200){
      c.font='bold 10px monospace';c.fillStyle='rgba(255,106,0,0.35)';
      c.textAlign='left';c.fillText(r.name,r.x+10,r.y+r.h/2+4);
    }
  });

  if(S.iceMode){
    c.fillStyle='rgba(180,210,240,0.15)';
    [[cx-100,cy-15,120,30],[cx+60,cy-20,90,40],[cx-200,cy-10,70,20]].forEach(([x,y,w,h])=>{
      c.beginPath();c.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);c.fill();
    });
  }

  if(S.roundabout){
    const rb=S.roundabout;
    c.beginPath();c.arc(rb.x,rb.y,rb.r+18,0,Math.PI*2);c.fillStyle='#2a2a2a';c.fill();
    c.beginPath();c.arc(rb.x,rb.y,rb.r,0,Math.PI*2);c.fillStyle='#2a3a2a';c.fill();
    c.setLineDash([7,5]);c.strokeStyle='rgba(255,255,255,0.22)';c.lineWidth=1.5;
    c.beginPath();c.arc(rb.x,rb.y,rb.r+9,0,Math.PI*2);c.stroke();c.setLineDash([]);
  }

  S.peds?.forEach(p=>{
    for(let i=-3;i<3;i++){
      c.fillStyle=i%2===0?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.2)';
      c.fillRect(p.x-22,p.y-22+i*8,44,8);
    }
    c.font='18px serif';c.textAlign='center';
    c.fillText(p.waiting?'🧍':'🚶',p.x,p.y+6);
  });

  S.lights?.forEach(l=>{
    const cols={red:'#ef4444',yellow:'#ff6a00',green:'#22c55e'};
    c.fillStyle='#111';c.beginPath();
    c.roundRect(l.x-9,l.y-32,18,34,3);c.fill();
    ['red','yellow','green'].forEach((col,i)=>{
      c.beginPath();c.arc(l.x,l.y-24+i*10,4.5,0,Math.PI*2);
      const active=l.state===col;
      c.fillStyle=active?cols[col]:'rgba(255,255,255,0.07)';
      if(active){c.shadowColor=cols[col];c.shadowBlur=12;}
      c.fill();c.shadowBlur=0;
    });
    c.fillStyle='#555';c.fillRect(l.x-2,l.y+2,4,20);
  });

  S.signs?.forEach(sg=>{
    c.font='20px serif';c.textAlign='center';c.fillText(sg.icon,sg.x,sg.y);
    c.fillStyle='#777';c.fillRect(sg.x-1.5,sg.y,3,14);
    const d=Math.hypot(car.x-sg.x,car.y-sg.y);
    if(d<90){
      c.beginPath();c.arc(sg.x,sg.y-8,16,0,Math.PI*2);
      c.strokeStyle=`rgba(255,106,0,${0.7*(1-d/90)})`;c.lineWidth=2;c.stroke();
    }
  });

  S.ubLandmarks?.forEach(lm=>{
    c.font='22px serif';c.textAlign='center';c.fillText(lm.icon,lm.x,lm.y);
    c.font='bold 9px monospace';c.fillStyle='rgba(255,106,0,0.45)';
    c.fillText(lm.label,lm.x,lm.y+16);
  });

  if(S.ambulance?.active){
    const a=S.ambulance;
    c.save();c.translate(a.x,a.y+10);
    c.font='24px serif';c.textAlign='center';c.fillText('🚑',0,0);
    if(Math.floor(Date.now()/180)%2){c.beginPath();c.arc(0,-16,8,0,Math.PI*2);c.fillStyle='rgba(0,120,255,0.7)';c.fill();}
    c.restore();
  }

  const destPts={sc1:{x:cx+200,y:cy},sc2:{x:cx+200,y:cy},sc4:{x:cx+300,y:cy},sc5:{x:cx+200,y:cy},sc6:{x:cx+160,y:cy-80}};
  const dest=destPts[S.id];
  if(dest){
    const pulse=0.5+0.5*Math.sin(Date.now()/280);
    c.beginPath();c.arc(dest.x,dest.y,14+pulse*5,0,Math.PI*2);
    c.strokeStyle=`rgba(34,197,94,${0.5+pulse*0.4})`;c.lineWidth=2.5;c.stroke();
    c.font='16px serif';c.textAlign='center';c.fillText('🏁',dest.x,dest.y+5);
  }

  S.particles?.forEach(p=>{
    c.beginPath();c.arc(p.x,p.y,p.r*(p.life/p.max),0,Math.PI*2);
    c.fillStyle=`rgba(180,180,180,${0.3*p.life/p.max})`;c.fill();
  });

  if(S._flash>0){
    c.fillStyle=`rgba(239,68,68,${S._flash/20*0.2})`;
    c.fillRect(-200,-200,simCW*3+400,simCH*3+400);
    S._flash--;
  }

  drawTraffic(S, c, offX, offY);
  c.restore();

  const sx = S.ubMode ? car.x+offX : car.x;
  const sy = S.ubMode ? car.y+offY : car.y;
  drawSimCar({...car,x:sx,y:sy});

  if(S.ubMode){
    c.fillStyle='rgba(10,10,16,0.7)';c.fillRect(0,0,simCW,28);
    c.font='bold 11px monospace';c.fillStyle='rgba(255,106,0,0.8)';
    c.textAlign='center';
    c.fillText('🌆  УЛААНБААТАР — Энхтайваны өргөн чөлөө  |  Чөлөөт жолоодлого', simCW/2, 18);
    c.save();c.translate(simCW-44,simCH-44);
    c.beginPath();c.arc(0,0,22,0,Math.PI*2);
    c.fillStyle='rgba(10,10,16,0.8)';c.fill();
    c.strokeStyle='rgba(255,255,255,0.12)';c.lineWidth=1;c.stroke();
    [['Х',-Math.PI/2],['З',0],['Ө',Math.PI/2],['Д',Math.PI]].forEach(([d,a])=>{
      c.font='bold 9px monospace';c.fillStyle='rgba(240,238,234,0.5)';c.textAlign='center';
      c.fillText(d,Math.cos(a)*14,Math.sin(a)*14+3);
    });
    c.restore();
  }

  const mmEl=document.getElementById('sim-minimap');
  if(mmEl){
    let cv=mmEl.querySelector('canvas');
    if(!cv){cv=document.createElement('canvas');cv.width=90;cv.height=70;mmEl.appendChild(cv);}
    const mc=cv.getContext('2d');
    mc.fillStyle='#08080f';mc.fillRect(0,0,90,70);
    const mW=S.ubMode?simCW*2.5:simCW, mH=S.ubMode?simCH*1.8:simCH;
    S.roads?.forEach(r=>{
      mc.fillStyle='#2a2a3a';
      mc.fillRect(r.x/mW*90,r.y/mH*70,Math.max(r.w/mW*90,2),Math.max(r.h/mH*70,2));
    });
    mc.beginPath();mc.arc(car.x/mW*90,car.y/mH*70,3.5,0,Math.PI*2);
    mc.fillStyle='#ff6a00';mc.fill();
    mc.beginPath();
    mc.moveTo(car.x/mW*90,car.y/mH*70);
    mc.lineTo(car.x/mW*90+Math.cos(car.angle)*8,car.y/mH*70+Math.sin(car.angle)*8);
    mc.strokeStyle='#ff6a00';mc.lineWidth=1.5;mc.stroke();
  }
}

function drawSimCar(car) {
  const c = simCtx;
  c.save();
  c.translate(car.x, car.y);
  c.rotate(car.angle + Math.PI/2);
  c.fillStyle='rgba(0,0,0,0.3)';c.beginPath();c.ellipse(2,2,11,17,0,0,Math.PI*2);c.fill();
  c.fillStyle='#c0392b';c.beginPath();c.roundRect(-10,-17,20,34,4);c.fill();
  c.fillStyle='rgba(255,255,255,0.06)';c.beginPath();c.roundRect(-9,-16,18,10,3);c.fill();
  c.fillStyle='rgba(100,170,255,0.65)';c.beginPath();c.roundRect(-7,-15,14,10,2);c.fill();
  c.fillStyle='#a93226';c.beginPath();c.roundRect(-8,-8,16,16,3);c.fill();
  c.fillStyle='#f9ca24';c.shadowColor='#f9ca24';c.shadowBlur=8;
  c.fillRect(-9,-17,5,4);c.fillRect(4,-17,5,4);c.shadowBlur=0;
  c.fillStyle='#ef4444';c.fillRect(-9,13,5,3);c.fillRect(4,13,5,3);
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
