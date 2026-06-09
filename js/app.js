// ═══════════════════════════════════════════════════
// 🧭 NAVIGATION
// ═══════════════════════════════════════════════════
function hideAll() {
  ['menu-screen','card-select-screen','quiz-screen','result-screen','hot20-screen',
   'sim-scenario-screen','sim-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showMenu() {
  clearInterval(quizState.timer);
  hideAll();
  document.getElementById('menu-screen').style.display = 'flex';
  const prog = JSON.parse(localStorage.getItem('sdu_quiz_history')||'[]');
  document.getElementById('menu-done').textContent = prog.length;
}

function confirmExit() {
  if (quizState.answers.some(a => a !== null)) {
    if (!confirm('Тестийг дуусаагүй байна. Гарах уу?')) return;
  }
  clearInterval(quizState.timer);
  showMenu();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ═══════════════════════════════════════════════════
// 🖼️ IMAGE ZOOM
// ═══════════════════════════════════════════════════
function zoomImg(src) {
  if (!src || src.includes('undefined')) return;
  document.getElementById('zoom-img').src = src;
  document.getElementById('img-zoom').classList.add('open');
}

function closeZoom() {
  document.getElementById('img-zoom').classList.remove('open');
}

// ═══════════════════════════════════════════════════
// ✨ FOCUS FLASH
// ═══════════════════════════════════════════════════
function focusFlash() {
  const el = document.getElementById('focus-flash');
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 80);
}

// ═══════════════════════════════════════════════════
// ⌨️ KEYBOARD
// ═══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const quizVisible = document.getElementById('quiz-screen')?.style.display === 'block';
  const simVisible  = document.getElementById('sim-screen')?.style.display === 'flex';

  simKeys[e.key] = true;

  if (simVisible && [' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
  if (simVisible && e.key === ' ' && simState?.running) {
    toggleSimPause();
    return;
  }

  if (quizVisible && !simVisible) {
    const keyMap = {'a':0,'b':1,'c':2,'d':3,'а':0,'б':1,'в':2,'г':3,'1':0,'2':1,'3':2,'4':3};
    const k = e.key.toLowerCase();
    if (keyMap[k] !== undefined && quizState.answers[quizState.current] === null) {
      e.preventDefault(); answerQ(keyMap[k]); return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && quizState.answers[quizState.current] !== null) {
      e.preventDefault(); nextQ(); return;
    }
  }
  if (e.key === 'Escape') { closeZoom(); }
}, { passive: false });

document.addEventListener('keyup', e => { simKeys[e.key] = false; });

// ═══════════════════════════════════════════════════
// 📐 RESIZE
// ═══════════════════════════════════════════════════
window.addEventListener('resize', () => {
  if (simState?.running) initSimCanvas();
});

// ═══════════════════════════════════════════════════
// 🚀 INIT
// ═══════════════════════════════════════════════════
window.addEventListener('load', () => {
  const prog = JSON.parse(localStorage.getItem('sdu_quiz_history')||'[]');
  document.getElementById('menu-done').textContent = prog.length;

  const nums = document.querySelectorAll('.stat-n');
  nums.forEach(el => {
    const target = parseInt(el.textContent);
    if (isNaN(target) || target === 0) return;
    let cur = 0;
    const step = Math.ceil(target/30);
    const t = setInterval(() => {
      cur = Math.min(cur+step, target);
      el.textContent = cur;
      if (cur >= target) clearInterval(t);
    }, 25);
  });
});
