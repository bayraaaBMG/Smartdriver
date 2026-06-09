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

  car.braking = dn && car.speed > 0.3;
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

  // ── Background / terrain ──
  const bgX = S.ubMode ? -300 : -80;
  const bgY = S.ubMode ? -300 : -80;
  const bgW = S.ubMode ? simCW*3+600 : simCW+200;
  const bgH = S.ubMode ? simCH*2+600 : simCH+200;

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
  } else if (S.ubMode) {
    c.fillStyle='#0d1117'; c.fillRect(bgX,bgY,bgW,bgH);
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

  // ── UB Buildings ──
  if (S.ubBuildings) {
    S.ubBuildings.forEach(b=>{
      // building shadow
      c.fillStyle='rgba(0,0,0,0.3)';
      c.fillRect(b.x+4,b.y+4,b.w,b.h);
      // building body
      const bGrad=c.createLinearGradient(b.x,b.y,b.x+b.w,b.y);
      bGrad.addColorStop(0,b.c);bGrad.addColorStop(1,lightenHex(b.c,15));
      c.fillStyle=bGrad; c.fillRect(b.x,b.y,b.w,b.h);
      // outline
      c.strokeStyle='rgba(255,255,255,0.08)';c.lineWidth=1;c.strokeRect(b.x,b.y,b.w,b.h);
      // windows
      const wCols=Math.floor(b.w/14), wRows=Math.floor(b.h/14);
      for(let r=0;r<wRows;r++) for(let cl=0;cl<wCols;cl++){
        const lit=Math.sin(b.x*0.07+cl*4.1+r*2.7)>0.1;
        c.fillStyle=lit?'rgba(255,235,150,0.55)':'rgba(255,255,255,0.02)';
        c.fillRect(b.x+4+cl*14,b.y+6+r*14,8,8);
      }
      // label
      c.font='bold 9px monospace';c.fillStyle='rgba(255,255,255,0.3)';
      c.textAlign='center';c.fillText(b.label,b.x+b.w/2,b.y+b.h+12);
    });
  }

  // ── Roads ──
  S.roads?.forEach(r=>{
    const horiz = r.w > r.h;
    // sidewalks
    if (!S.iceMode) {
      c.fillStyle=S.ubMode?'#1e2030':'#2a2820';
      if(horiz){c.fillRect(r.x,r.y-9,r.w,9);c.fillRect(r.x,r.y+r.h,r.w,9);}
      else{c.fillRect(r.x-9,r.y,9,r.h);c.fillRect(r.x+r.w,r.y,9,r.h);}
    }
    // road surface
    const roadCol = S.iceMode ? '#8090a8' : S.ubMode ? '#1e2330' : '#282828';
    c.fillStyle=roadCol;
    c.fillRect(r.x,r.y,r.w,r.h);
    // road edge lines (white)
    c.strokeStyle=S.iceMode?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.35)';
    c.lineWidth=2;c.setLineDash([]);
    c.strokeRect(r.x+1,r.y+1,r.w-2,r.h-2);
    // center dashes
    c.setLineDash([horiz?22:16,13]);
    c.strokeStyle=S.ubMode?'rgba(255,200,50,0.4)':S.iceMode?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.3)';
    c.lineWidth=2.5;c.beginPath();
    if(horiz){c.moveTo(r.x,r.y+r.h/2);c.lineTo(r.x+r.w,r.y+r.h/2);}
    else{c.moveTo(r.x+r.w/2,r.y);c.lineTo(r.x+r.w/2,r.y+r.h);}
    c.stroke();c.setLineDash([]);
    // road name (UB)
    if(S.ubMode&&r.name&&horiz&&r.w>200){
      c.font='bold 10px monospace';c.fillStyle='rgba(255,149,0,0.3)';
      c.textAlign='left';c.fillText(r.name,r.x+14,r.y+r.h/2+4);
    }
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

  // ── UB Landmarks ──
  S.ubLandmarks?.forEach(lm=>{
    c.font='22px serif';c.textAlign='center';c.fillText(lm.icon,lm.x,lm.y);
    c.font='bold 9px monospace';c.fillStyle='rgba(255,106,0,0.5)';
    c.fillText(lm.label,lm.x,lm.y+18);
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
  const sx = S.ubMode ? car.x+offX : car.x;
  const sy = S.ubMode ? car.y+offY : car.y;
  drawSimCar({...car, x:sx, y:sy});

  // ── UB overlay ──
  if(S.ubMode){
    const hGrad=c.createLinearGradient(0,0,0,32);
    hGrad.addColorStop(0,'rgba(6,6,12,0.92)');hGrad.addColorStop(1,'rgba(6,6,12,0)');
    c.fillStyle=hGrad;c.fillRect(0,0,simCW,36);
    c.font='bold 11px monospace';c.fillStyle='rgba(255,106,0,0.85)';
    c.textAlign='center';
    c.fillText('🌆  УЛААНБААТАР — Энхтайваны өргөн чөлөө  |  Чөлөөт жолоодлого',simCW/2,18);
    // Compass
    c.save();c.translate(simCW-46,simCH-46);
    c.beginPath();c.arc(0,0,24,0,Math.PI*2);
    c.fillStyle='rgba(6,6,12,0.85)';c.fill();
    c.strokeStyle='rgba(255,106,0,0.25)';c.lineWidth=1.5;c.stroke();
    [['Х',-Math.PI/2,'#ff6a00'],['З',0,'rgba(240,238,234,0.4)'],['Ө',Math.PI/2,'rgba(240,238,234,0.4)'],['Д',Math.PI,'rgba(240,238,234,0.4)']].forEach(([d,a,col])=>{
      c.font='bold 9px monospace';c.fillStyle=col;c.textAlign='center';
      c.fillText(d,Math.cos(a)*16,Math.sin(a)*16+3);
    });
    c.restore();
  }

  // ── Minimap ──
  const mmEl=document.getElementById('sim-minimap');
  if(mmEl){
    let cv=mmEl.querySelector('canvas');
    if(!cv){cv=document.createElement('canvas');cv.width=100;cv.height=78;mmEl.appendChild(cv);}
    const mc=cv.getContext('2d');
    const MW=100,MH=78;
    mc.fillStyle='#08080e';mc.fillRect(0,0,MW,MH);
    const mW=S.ubMode?simCW*2.5:simCW, mH=S.ubMode?simCH*1.8:simCH;
    // roads on minimap
    S.roads?.forEach(r=>{
      mc.fillStyle='#303050';
      mc.fillRect(r.x/mW*MW,r.y/mH*MH,Math.max(r.w/mW*MW,2),Math.max(r.h/mH*MH,2));
    });
    // car dot with direction arrow
    const mx=car.x/mW*MW, my=car.y/mH*MH;
    mc.beginPath();mc.arc(mx,my,4,0,Math.PI*2);
    mc.fillStyle='#ff6a00';mc.shadowColor='#ff6a00';mc.shadowBlur=8;mc.fill();mc.shadowBlur=0;
    mc.beginPath();
    mc.moveTo(mx+Math.cos(car.angle)*6,my+Math.sin(car.angle)*6);
    mc.lineTo(mx+Math.cos(car.angle+2.4)*3,my+Math.sin(car.angle+2.4)*3);
    mc.lineTo(mx+Math.cos(car.angle-2.4)*3,my+Math.sin(car.angle-2.4)*3);
    mc.closePath();mc.fillStyle='#ff9500';mc.fill();
    // border
    mc.strokeStyle='rgba(255,106,0,0.3)';mc.lineWidth=1;mc.strokeRect(0,0,MW,MH);
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
