// ═══════════════════════════════════════════════════
// 📊 STREAK + WEAK TOPICS
// ═══════════════════════════════════════════════════
function getStreak() {
  const h = JSON.parse(localStorage.getItem('sdu_quiz_history')||'[]');
  if (!h.length) return {streak:0, best:0};
  const dates = [...new Set(h.map(q => new Date(q.date).toDateString()))];
  return {streak: dates.length, best: dates.length};
}

function getWeakTopics() {
  const h = JSON.parse(localStorage.getItem('sdu_quiz_history')||'[]');
  const cardScores = {};
  h.forEach(q => {
    if (!q.cardNum) return;
    if (!cardScores[q.cardNum]) cardScores[q.cardNum] = {correct:0, total:0};
    cardScores[q.cardNum].correct += (q.correct||0);
    cardScores[q.cardNum].total += (q.total||20);
  });
  return Object.entries(cardScores)
    .map(([c,s]) => ({card:parseInt(c), pct:Math.round(s.correct/s.total*100)}))
    .filter(x=>x.pct<70).sort((a,b)=>a.pct-b.pct).slice(0,5);
}

// ═══════════════════════════════════════════════════
// 🎮 QUIZ ENGINE
// ═══════════════════════════════════════════════════
let quizState = {
  questions: [], current: 0, answers: [],
  mode: 'practice', timer: null, elapsed: 0,
  remaining: 0, startTime: 0, imgErrors: {}
};

function getCardImgUrl(card, side) {
  return `${IMG_BASE}${card}${side}.jpg`;
}

function buildQuestionsFromCard(cardNum) {
  return getCardQuestions(cardNum);
}

function buildRandomQuestions(count = 20) {
  const all = [];
  for (let c = 1; c <= 40; c++) {
    getCardQuestions(c).forEach(q => all.push(q));
  }
  shuffle(all);
  return all.slice(0, count);
}

function startQuizWithQuestions(questions, mode = 'practice') {
  quizState.questions = questions;
  quizState.current = 0;
  quizState.answers = new Array(questions.length).fill(null);
  quizState.mode = mode;
  quizState.elapsed = 0;
  quizState.startTime = Date.now();
  clearInterval(quizState.timer);

  hideAll();
  document.getElementById('quiz-screen').style.display = 'block';
  const timerEl = document.getElementById('q-timer');
  if (mode === 'exam') {
    quizState.remaining = questions.length * 60;
    timerEl.style.display = 'block';
    quizState.timer = setInterval(() => {
      quizState.remaining--;
      quizState.elapsed++;
      updateTimer();
      if (quizState.remaining <= 0) finishQuiz();
    }, 1000);
  } else {
    timerEl.style.display = 'none';
    quizState.timer = setInterval(() => { quizState.elapsed++; }, 1000);
  }
  renderDots();
  renderQuestion();
}

function startRandomQuiz() { startQuizWithQuestions(buildRandomQuestions(20), 'practice'); }
function startExamMode()   { startQuizWithQuestions(buildRandomQuestions(20), 'exam'); }

function startHot20Quiz() {
  startQuizWithQuestions(HOT_20.map(h => ({
    cardNum: h.card, qNum: h.qn,
    imgA: getCardImgUrl(h.card,'a'), imgB: getCardImgUrl(h.card,'b'),
    ans: h.ans, text: h.text, opts: h.opts, why: h.why,
    isImageBased: true
  })), 'practice');
}

function startCardQuiz(cardNum) {
  startQuizWithQuestions(buildQuestionsFromCard(cardNum), 'practice');
}

function updateTimer() {
  const r = quizState.remaining;
  const m = String(Math.floor(r/60)).padStart(2,'0');
  const s = String(r%60).padStart(2,'0');
  const el = document.getElementById('q-timer');
  el.textContent = `${m}:${s}`;
  el.classList.toggle('warn', r < 60);
}

function renderDots() {
  const track = document.getElementById('dot-track');
  track.innerHTML = quizState.questions.map((q,i) => {
    const ans = quizState.answers[i];
    let cls = 'dot';
    if (i === quizState.current) cls += ' cur';
    else if (ans !== null) cls += ans === q.ans ? ' ans-correct' : ' ans-wrong';
    return `<div class="${cls}" onclick="jumpTo(${i})"></div>`;
  }).join('');
}

function jumpTo(i) {
  if (quizState.answers[i] !== null) { quizState.current = i; renderQuestion(); }
}

function renderQuestion() {
  const q = quizState.questions[quizState.current];
  const total = quizState.questions.length;
  document.getElementById('q-prog-fill').style.width = ((quizState.current)/total*100)+'%';
  document.getElementById('q-counter').textContent = `${quizState.current+1}/${total}`;

  const isHot = q.opts !== undefined;
  const opts = isHot ? q.opts : ['А хариулт','Б хариулт','В хариулт','Г хариулт'];
  const labels = ['А','Б','В','Г'];

  // Show only the relevant image page: А (questions 1-10) or Б (questions 11-20)
  const isPageA = q.qNum <= 10;
  const imgSrc = isPageA ? q.imgA : q.imgB;
  const imgId = `qi-${quizState.current}`;
  const pageLabel = isPageA ? 'А ХЭСЭГ' : 'Б ХЭСЭГ';

  let imgHtml = '';
  if (q.isImageBased) {
    imgHtml = `
      <div class="q-images one-img">
        <div style="position:relative;background:#07070e;min-height:100px;display:flex;align-items:center;justify-content:center;border-radius:3px 3px 0 0">
          <img id="${imgId}" class="q-img" src="" onclick="zoomImg(this.src)"
               alt="Карт ${q.cardNum} — ${pageLabel}"
               style="max-height:54vh;opacity:0;transition:opacity .35s;cursor:zoom-in">
          <div class="img-loading" id="load-${imgId}">⏳ Зураг ачааллаж байна...</div>
        </div>
        <div class="q-img-hint">🔍 Зургийг дарж томруулах</div>
      </div>`;
  }

  const alreadyAnswered = quizState.answers[quizState.current] !== null;

  let optsHtml = '';
  opts.forEach((opt, i) => {
    let cls = 'q-opt';
    const disabled = alreadyAnswered ? 'disabled' : '';
    if (alreadyAnswered) {
      if (i === q.ans) cls += ' correct';
      else if (i === quizState.answers[quizState.current] && i !== q.ans) cls += ' wrong';
    }
    optsHtml += `<button class="${cls}" onclick="answerQ(${i})" ${disabled}>
      <span class="opt-key">${labels[i]}</span>${opt}
    </button>`;
  });

  let explHtml = '';
  if (alreadyAnswered) {
    const ok = quizState.answers[quizState.current] === q.ans;
    const why = isHot ? (q.why || '') : (ok
      ? `✓ Зөв! "${labels[q.ans]}" хариулт зөв байна.`
      : `Зөв хариулт: "${labels[q.ans]}". Картын ${pageLabel}-ийн ${q.qNum}-р асуултыг дахин анхааралтай харна уу.`);
    explHtml = `<div class="q-explain show" style="${ok
      ? '--explain-c:var(--green);--explain-bg:rgba(34,197,94,0.06)'
      : '--explain-c:var(--red);--explain-bg:rgba(239,68,68,0.06)'}">
      <span class="q-explain-icon">${ok ? '✓' : '✗'}</span><span>${why}</span>
    </div>`;
  }

  const qText = isHot
    ? q.text
    : `Карт ${q.cardNum} — <strong>${pageLabel}</strong> зургаас <strong>${q.qNum}-р асуулт</strong>-ын зөв хариулт сонгоно уу.`;

  document.getElementById('q-wrap').innerHTML = `
    <div class="q-card-label">КАРТ #${q.cardNum} &nbsp;·&nbsp; АСУУЛТ ${q.qNum} / 20 &nbsp;·&nbsp; ${pageLabel}</div>
    ${imgHtml}
    <div class="q-text">${qText}</div>
    <div class="q-options">${optsHtml}</div>
    ${explHtml}
    <div class="q-nav">
      <div class="q-nav-info">${q.cardNum}-р карт · ${q.qNum}-р асуулт</div>
      <button class="btn-next" onclick="nextQ()" style="display:${alreadyAnswered?'block':'none'}">
        ${quizState.current < total-1 ? 'Дараагийн →' : 'Дүн харах →'}
      </button>
    </div>
  `;
  renderDots();
  focusFlash();

  if (q.isImageBased) {
    requestAnimationFrame(() => {
      const el = document.getElementById(imgId);
      const load = document.getElementById('load-'+imgId);
      if (el) {
        el.onload = () => { if(load) load.style.display='none'; el.style.opacity='1'; };
        el.onerror = null;
        loadImgWithFallback(el, imgSrc);
      }
    });
  }
}

function answerQ(optIdx) {
  if (quizState.answers[quizState.current] !== null) return;
  quizState.answers[quizState.current] = optIdx;
  renderQuestion();
  if (quizState.mode === 'exam') setTimeout(nextQ, 600);
}

function nextQ() {
  if (quizState.current < quizState.questions.length - 1) {
    quizState.current++;
    renderQuestion();
    window.scrollTo({top:0,behavior:'smooth'});
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  clearInterval(quizState.timer);
  const questions = quizState.questions;
  const answers = quizState.answers;
  let correct = 0, wrong = 0;
  const wrongItems = [];

  questions.forEach((q, i) => {
    const a = answers[i];
    if (a === null || a !== q.ans) {
      wrong++;
      wrongItems.push({ cardNum: q.cardNum, qNum: q.qNum, text: q.text || `Карт ${q.cardNum} · Q${q.qNum}` });
    } else { correct++; }
  });

  const total = questions.length;
  const pct = Math.round(correct / total * 100);
  const elapsed = quizState.elapsed;
  const min = String(Math.floor(elapsed/60)).padStart(2,'0');
  const sec = String(elapsed%60).padStart(2,'0');

  const prog = JSON.parse(localStorage.getItem('sdu_quiz_history')||'[]');
  prog.push({ date: Date.now(), correct, total, pct, mode: quizState.mode,
    cardNum: quizState.questions[0]?.cardNum || null });
  if (prog.length > 50) prog.shift();
  localStorage.setItem('sdu_quiz_history', JSON.stringify(prog));

  hideAll();
  const rs = document.getElementById('result-screen');
  rs.style.display = 'flex';
  rs.style.flexDirection = 'column';
  rs.style.alignItems = 'center';
  rs.style.justifyContent = 'center';

  const ringColor = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--accent)' : 'var(--red)';
  document.getElementById('result-ring').style.cssText = `--ring-c:${ringColor}`;
  document.getElementById('result-big').textContent = correct;
  document.getElementById('result-of').textContent = `/${total}`;
  document.getElementById('rg-ok').textContent = correct;
  document.getElementById('rg-fail').textContent = wrong;
  document.getElementById('rg-time').textContent = `${min}:${sec}`;

  let title, sub;
  if (pct >= 90)      { title = '🏆 Маш сайн!';    sub = 'Шалгалтад бэлэн байна!'; }
  else if (pct >= 80) { title = '👍 Сайн дүн!';     sub = 'Бага зэрэг дадлага хийвэл төгс болно.'; }
  else if (pct >= 60) { title = '📚 Үргэлжлүүл';   sub = 'Хичээлийг дахин үзэж дасгалаа давтаарай.'; }
  else                { title = '💪 Дахин хичээл';  sub = 'Онолыг дахин нэгэнт үзэхийг зөвлөж байна.'; }

  document.getElementById('result-title').textContent = title;
  document.getElementById('result-sub').textContent = sub;

  if (wrongItems.length > 0) {
    const wl = document.getElementById('wrong-list');
    wl.innerHTML = `<div class="wrong-list-title">// Буруу хариулсан асуултууд (${wrongItems.length})</div>` +
      wrongItems.slice(0,8).map(w => `<div class="wrong-item"><strong>Карт ${w.cardNum} · Q${w.qNum}</strong> — ${w.text||'Дахин үзнэ үү'}</div>`).join('') +
      `<button class="btn-retry" onclick="retryWrong()" style="margin-top:0.8rem;font-size:0.78rem;padding:8px 20px;background:var(--red)">
        ↩ Буруу асуултуудыг дахин өг (${wrongItems.length})
      </button>`;
    window._wrongQuestions = quizState.questions.filter((_,i) => quizState.answers[i] !== quizState.questions[i].ans);
  } else {
    document.getElementById('wrong-list').innerHTML = '<div style="color:var(--green);font-size:0.85rem;margin-bottom:0.5rem">🎉 Бүх асуултад зөв хариулсан!</div>';
    window._wrongQuestions = [];
  }

  const st = getStreak();
  const weak = getWeakTopics();
  const extraEl = document.createElement('div');
  extraEl.style.cssText = 'max-width:420px;margin:0 auto 1.5rem;text-align:left';
  if (st.streak > 0) {
    extraEl.innerHTML += `<div style="background:rgba(245,200,66,0.08);border:1px solid rgba(245,200,66,0.2);padding:0.6rem 1rem;border-radius:3px;margin-bottom:0.6rem;font-size:0.82rem">
      🔥 <strong style="color:var(--accent)">${st.streak} өдрийн</strong> streak! Үргэлжлүүл.
    </div>`;
  }
  if (weak.length) {
    extraEl.innerHTML += `<div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);padding:0.6rem 1rem;border-radius:3px;font-size:0.8rem">
      📊 Сул тал: ${weak.map(w=>`Карт ${w.card} (${w.pct}%)`).join(', ')}
    </div>`;
  }
  document.getElementById('result-screen').insertBefore(extraEl, document.getElementById('result-actions'));
}

function retryQuiz() {
  startQuizWithQuestions(quizState.questions, quizState.mode);
}

function retryWrong() {
  const wrong = window._wrongQuestions || [];
  if (!wrong.length) return;
  startQuizWithQuestions(wrong, 'practice');
}

// ═══════════════════════════════════════════════════
// 🔥 HOT 20 ДЭЛГЭЦ
// ═══════════════════════════════════════════════════
function showHot20() {
  hideAll();
  document.getElementById('hot20-screen').style.display = 'block';
  const list = document.getElementById('hot20-list');
  list.innerHTML = HOT_20.map((h, i) => `
    <div class="hot20-card" onclick="startHot20QuizFrom(${i})">
      <div class="hot20-n">#${i+1}</div>
      <div class="hot20-q">${h.text}</div>
      <div class="hot20-freq">
        <div>${h.freq}%</div>
        <div class="freq-bar" style="width:${h.freq-60}px;max-width:60px"></div>
      </div>
    </div>
  `).join('');
}

function startHot20QuizFrom(startIdx) {
  startQuizWithQuestions(HOT_20.map(h => ({
    cardNum: h.card, qNum: h.qn,
    imgA: getCardImgUrl(h.card,'a'), imgB: getCardImgUrl(h.card,'b'),
    ans: h.ans, text: h.text, opts: h.opts, why: h.why, isImageBased: true
  })), 'practice');
}

// ═══════════════════════════════════════════════════
// 📋 КАРТ СОНГОХ ДЭЛГЭЦ
// ═══════════════════════════════════════════════════
function showCardSelect() {
  hideAll();
  document.getElementById('card-select-screen').style.display = 'block';
  const grid = document.getElementById('card-grid');
  const history = JSON.parse(localStorage.getItem('sdu_quiz_history')||'[]');
  const doneCards = new Set(history.map(h => h.cardNum).filter(Boolean));
  grid.innerHTML = '';
  for (let c = 1; c <= 40; c++) {
    const div = document.createElement('div');
    div.className = 'card-pill' + (doneCards.has(c) ? ' done' : '');
    div.innerHTML = `<div style="font-size:1.1rem;margin-bottom:2px">${doneCards.has(c)?'✓':c}</div><div style="font-size:0.65rem;opacity:0.6">Карт ${c}</div>`;
    div.onclick = () => startCardQuiz(c);
    grid.appendChild(div);
  }
}
