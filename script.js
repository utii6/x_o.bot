// Telegram WebApp آمن
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.expand();
  tg.ready();
}

// 1. تشغيل الصوت المحلي مباشرة
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

// 2. إعدادات اللعبة والواجهة
const cells = document.querySelectorAll('.cell');
const statusDiv = document.getElementById('status') || document.querySelector('.status') || document.querySelector('h2');
const shareBtn = document.getElementById('shareBtn');
const aiBtn = document.getElementById('aiBtn');

let board = Array(9).fill('');
let isGameActive = true;
let isAiMode = false;

const HUMAN = 'X';
const AI = 'O';
const WINS = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

// تفعيل زر اللعب ضد الذكاء الاصطناعي
if (aiBtn) {
  aiBtn.addEventListener('click', () => {
    isAiMode = true;
    resetGame();
    if (statusDiv) statusDiv.textContent = "بدأ اللعب ضد الجهاز! دورك (X)";
    if (shareBtn) shareBtn.style.display = 'none';
  });
}

// 3. أحداث اللعب
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    ensureMusicPlays();
    const i = +cell.dataset.index;
    if (!isGameActive || board[i]) return;
    
    makeMove(i, HUMAN);
  });
});

function makeMove(i, player) {
  board[i] = player;
  cells[i].textContent = player;

  const r = checkResult(board);
  if (r) {
    setTimeout(() => endGame(r), 50);
    return;
  }

  if (isAiMode && player === HUMAN) {
    isGameActive = false;
    if (statusDiv) statusDiv.textContent = "الجهاز يفكر... 🤖";
    setTimeout(aiMove, 300);
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
  
  resetGame();
}

function resetGame() {
  board = Array(9).fill('');
  cells.forEach(c => c.textContent = '');
  isGameActive = true;
}

// 4. خوارزمية الذكاء الاصطناعي الذكية
function aiMove() {
  const empty = emptyIndices(board);
  if (!empty.length) return;

  // فوز أو صد
  for (const i of empty) { if (wouldWin(i, AI)) { makeMove(i, AI); isGameActive = true; return; } }
  for (const i of empty) { if (wouldWin(i, HUMAN)) { makeMove(i, AI); isGameActive = true; return; } }

  // كسر فخ الزوايا المتقابلة
  if (board[4] === AI) {
    const isOpposite = (board[0] === HUMAN && board[8] === HUMAN) || (board[2] === HUMAN && board[6] === HUMAN);
    if (isOpposite && empty.length === 6) {
      const sides = [1, 3, 5, 7].filter(i => board[i] === '');
      if (sides.length) {
        makeMove(sides[Math.floor(Math.random() * sides.length)], AI);
        isGameActive = true;
        return;
      }
    }
  }

  // الترتيب العادي (مركز -> زوايا -> جوانب)
  if (board[4] === '') { makeMove(4, AI); isGameActive = true; return; }
  for (const i of [0, 2, 6, 8]) { if (board[i] === '') { makeMove(i, AI); isGameActive = true; return; } }
  for (const i of [1, 3, 5, 7]) { if (board[i] === '') { makeMove(i, AI); isGameActive = true; return; } }
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

// مشاركة الرابط
if (shareBtn) {
  shareBtn.addEventListener('click', () => {
    const shareUrl = `https://t.me/share/url?url=https://t.me/VVJJbot/game&text=🎮 تحداني في لعبة XO!`;
    if (tg) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  });
}
