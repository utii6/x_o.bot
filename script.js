// Telegram WebApp آمن
const tg = window.Telegram ? window.Telegram.WebApp : null;

// تشغيل الموسيقى
const music = document.getElementById('bgMusic');
function ensureMusicPlays() {
  if (!music) return;
  music.play().catch(() => {
    const resume = () => {
      music.play().catch(() => {});
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
  });
}
document.addEventListener('DOMContentLoaded', ensureMusicPlays);

const cells = document.querySelectorAll('.cell');
let board = Array(9).fill('');
let isGameActive = true; // متغير لمنع اللعب أثناء دور الذكاء الاصطناعي أو بعد انتهاء اللعبة

const HUMAN = 'X';
const AI = 'O';
const WINS = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

// تفعيل النقر
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const i = +cell.dataset.index;
    if (!isGameActive || board[i]) return; // منع الضغط في غير دور اللاعب
    
    move(i, HUMAN);
    
    const r = checkResult(board);
    if (!r) {
      isGameActive = false; // تعطيل اللعب حتى ينتهي الذكاء الاصطناعي
      setTimeout(aiMove, 300);
    }
  });
});

function move(i, player) {
  board[i] = player;
  cells[i].textContent = player;
  const r = checkResult(board);
  if (r) {
    // تأخير إظهار التنبيه حتى تحدّث الشاشة واجهة المستخدم أولاً
    setTimeout(() => endGame(r), 50);
  }
}

function checkResult(b) {
  for (const [a, c, d] of WINS) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return b[a] === HUMAN ? 'win' : 'loss';
    }
  }
  if (b.every(x => x !== '')) return 'draw';
  return null;
}

function endGame(result) {
  const msg = result === 'win' ? '😂🎉 فزت!' : result === 'loss' ? '😢 خسرت😂' : '🤝 تعادل';
  
  if (tg && tg.sendData) tg.sendData(result);
  alert(msg);
  
  // إعادة الضبط
  board = Array(9).fill('');
  cells.forEach(c => c.textContent = '');
  isGameActive = true;
}

// AI: خوارزمية ذكية تمنع الخسارة تماماً
function aiMove() {
  const empty = emptyIndices(board);
  if (!empty.length) return;

  // 1) محاولة الفوز
  for (const i of empty) {
    if (wouldWin(i, AI)) {
      move(i, AI);
      return;
    }
  }

  // 2) صد فوز اللاعب
  for (const i of empty) {
    if (wouldWin(i, HUMAN)) {
      move(i, AI);
      isGameActive = true;
      return;
    }
  }

  // 3) منع فخ الزوايا المتقابلة (Opposite Corner Fork Defense)
  if (board[4] === AI) {
    const isOppositeCorners = (board[0] === HUMAN && board[8] === HUMAN) || 
                              (board[2] === HUMAN && board[6] === HUMAN);
    if (isOppositeCorners && empty.length === 6) {
      // إجبار الذكاء الاصطناعي على اللعب في جانب بدلاً من زاوية لكسر الفخ
      const sides = [1, 3, 5, 7].filter(i => board[i] === '');
      if (sides.length) {
        move(sides[Math.floor(Math.random() * sides.length)], AI);
        isGameActive = true;
        return;
      }
    }
  }

  // 4) أخذ المركز
  if (board[4] === '') {
    move(4, AI);
    isGameActive = true;
    return;
  }

  // 5) أخذ الزوايا
  for (const i of [0, 2, 6, 8]) {
    if (board[i] === '') {
      move(i, AI);
      isGameActive = true;
      return;
    }
  }

  // 6) أخذ الجوانب
  for (const i of [1, 3, 5, 7]) {
    if (board[i] === '') {
      move(i, AI);
      isGameActive = true;
      return;
    }
  }
}

function emptyIndices(b) {
  const out = [];
  for (let i = 0; i < 9; i++) if (!b[i]) out.push(i);
  return out;
}

function wouldWin(i, player) {
  const tmp = board.slice();
  tmp[i] = player;
  return checkResult(tmp) === (player === HUMAN ? 'win' : 'loss');
}
