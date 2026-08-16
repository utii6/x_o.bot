// Telegram WebApp آمن
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.expand();
  tg.ready();
}

// 1. الاتصال بقاعدة بيانات Supabase
const SUPABASE_URL = "https://vlwmoapmjprhgvlimlfi.supabase.co";
const SUPABASE_KEY = "sb_publishable_1mIuWWGl__SfHvxg8Wy-vQ_AGg4esSS";
const supabase = (window.supabase && window.supabase.createClient) 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

// 2. تشغيل الصوت المحلي
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

// 3. إعدادات اللعبة والواجهة
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

// 4. الدالة الرئيسية للعب المربوطة بـ HTML مباشرة
function makeMove(i, player = HUMAN) {
  ensureMusicPlays();

  if (!isGameActive || board[i] !== '') return;

  board[i] = player;
  
  const cells = document.querySelectorAll('.cell');
  if (cells[i]) {
    cells[i].textContent = player;
  }

  const r = checkResult(board);
  if (r) {
    setTimeout(() => endGame(r), 50);
    return;
  }

  if (isAiMode && player === HUMAN) {
    isGameActive = false;
    if (statusDiv) statusDiv.textContent = "واحد جاي يفكر... 🤖";
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

// 5. إنهاء اللعبة ورفع النتائج إلى Supabase
async function endGame(result) {
  const msg = result === 'win' ? '😂🎉 فزت!' : result === 'loss' ? '😢 خسرت😂' : '🤝 تعادل';
  
  // رفع النتيجة إلى جدول game_results في Supabase
  if (supabase) {
    const userData = tg?.initDataUnsafe?.user;
    try {
      await supabase.from('game_results').insert([
        {
          user_id: userData?.id ? String(userData.id) : 'guest',
          username: userData?.username || userData?.first_name || 'زائر',
          result: result,
          mode: isAiMode ? 'vs_ai' : 'pvp'
        }
      ]);
    } catch (err) {
      console.error("خطأ في رفع النتيجة إلى :", err);
    }
  }

  if (tg && tg.sendData) tg.sendData(result);
  alert(msg);
  
  resetGame();
}

function resetGame() {
  board = Array(9).fill('');
  const cells = document.querySelectorAll('.cell');
  cells.forEach(c => c.textContent = '');
  isGameActive = true;
  if (statusDiv) statusDiv.textContent = isAiMode ? "دورك الآن! (X)" : "لعبة XO";
}

// 6. خوارزمية الذكاء الاصطناعي
function aiMove() {
  const empty = emptyIndices(board);
  if (!empty.length) return;

  for (const i of empty) { if (wouldWin(i, AI)) { executeAiMove(i); return; } }
  for (const i of empty) { if (wouldWin(i, HUMAN)) { executeAiMove(i); return; } }

  if (board[4] === AI) {
    const isOpposite = (board[0] === HUMAN && board[8] === HUMAN) || (board[2] === HUMAN && board[6] === HUMAN);
    if (isOpposite && empty.length === 6) {
      const sides = [1, 3, 5, 7].filter(i => board[i] === '');
      if (sides.length) {
        executeAiMove(sides[Math.floor(Math.random() * sides.length)]);
        return;
      }
    }
  }

  if (board[4] === '') { executeAiMove(4); return; }
  for (const i of [0, 2, 6, 8]) { if (board[i] === '') { executeAiMove(i); return; } }
  for (const i of [1, 3, 5, 7]) { if (board[i] === '') { executeAiMove(i); return; } }
}

function executeAiMove(i) {
  isGameActive = true;
  makeMove(i, AI);
  if (!checkResult(board) && statusDiv) {
    statusDiv.textContent = "دورك الآن! (X)";
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

// 7. الأزرار والتفاعلات
function startAiMode() {
  isAiMode = true;
  resetGame();
  if (statusDiv) statusDiv.textContent = "بدأ اللعب ضد الجهاز! دورك (X)";
  if (shareBtn) shareBtn.style.display = 'none';
}

function shareGame() {
  const shareUrl = `https://t.me/share/url?url=https://t.me/VVJJbot/game&text=🎮 تحداني في لعبة XO!`;
  if (tg) tg.openTelegramLink(shareUrl);
  else window.open(shareUrl, '_blank');
}

function sendEmoji(emoji) {
  const el = document.createElement('div');
  el.innerText = emoji;
  el.className = 'floating-emoji';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
