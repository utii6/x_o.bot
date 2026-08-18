// Telegram WebApp آمن
const tg = window.Telegram ? window.Telegram.WebApp : null;

// تشغيل الموسيقى: أوتوبلاي + تشغيل عند أول تفاعل لو انمنعت
const music = document.getElementById('bgMusic');
function ensureMusicPlays() {
  if (!music) return;
  music.play().catch(() => {
    const resume = () => {
      music.play().catch(()=>{});
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
const HUMAN = 'X';
const AI = 'O';
const WINS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// تفعيل النقر
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const i = +cell.dataset.index;
    if (board[i] || checkResult(board)) return; // ممنوع اللعب على خانة مأخوذة أو بعد انتهاء اللعبة
    move(i, HUMAN);
    if (!checkResult(board)) setTimeout(aiMove, 250);
  });
});

function move(i, player) {
  board[i] = player;
  cells[i].textContent = player;
  const r = checkResult(board);
  if (r) endGame(r);
}

function checkResult(b) {
  for (const [a,c,d] of WINS) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return b[a] === HUMAN ? 'win' : 'loss';
    }
  }
  if (b.every(x => x)) return 'draw';
  return null;
}

function endGame(result) {
  alert(result === 'win' ? '😂🎉 فزت!' : result === 'loss' ? '😢 خسرت😂' : '🤝 تعادل');
  if (tg && tg.sendData) tg.sendData(result);
  // إعادة الضبط
  board = Array(9).fill('');
  cells.forEach(c => c.textContent = '');
}

// AI: يحاول يفوز ثم يصد، ثم وسط → زوايا → جوانب
function aiMove() {
  const empty = emptyIndices(board);
  if (!empty.length) return;

  // 1) محاولة الفوز
  for (const i of empty) {
    if (wouldWin(i, AI)) return move(i, AI);
  }
  // 2) صد فوز اللاعب
  for (const i of empty) {
    if (wouldWin(i, HUMAN)) return move(i, AI);
  }
  // 3) مركز
  if (board[4] === '') return move(4, AI);
  // 4) زوايا
  for (const i of [0,2,6,8]) if (board[i] === '') return move(i, AI);
  // 5) جوانب
  for (const i of [1,3,5,7]) if (board[i] === '') return move(i, AI);
}

function emptyIndices(b) {
  const out = [];
  for (let i=0;i<9;i++) if (!b[i]) out.push(i);
  return out;
}

function wouldWin(i, player) {
  const tmp = board.slice();
  tmp[i] = player;
  return checkResult(tmp) === (player === HUMAN ? 'win' : 'loss');
}
