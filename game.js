const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

// 1. إعدادات Supabase
const SUPABASE_URL = "https://vlwmoapmjprhgvlimlfi.supabase.co";
const SUPABASE_KEY = "sb_publishable_1mIuWWGl__SfHvxg8Wy-vQ_AGg4esSS";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// المؤثرات الصوتية
const clickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
const loseSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3');
const timerSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');

// 2. تحليل الرابط والغرفة
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get('tgWebAppStartParam') || urlParams.get('room');
let mySymbol = 'X';
let isMyTurn = false;
let gameState = Array(9).fill("");
let gameActive = true;
let timer = null;
let timeLeft = 10;

const winPatterns = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

const statusDiv = document.getElementById('status');
const shareBtn = document.getElementById('shareBtn');

// إضافة زر إعادة اللعب ديناميكياً
const rematchBtn = document.createElement('button');
rematchBtn.id = 'rematchBtn';
rematchBtn.innerText = '🔄 جولة جديدة';
rematchBtn.style.cssText = 'padding:10px 20px; background:#28a745; color:#fff; border:none; border-radius:8px; font-size:1rem; cursor:pointer; margin-bottom:15px; display:none;';
rematchBtn.onclick = requestRematch;
shareBtn.parentNode.insertBefore(rematchBtn, shareBtn.nextSibling);

if (!roomId) {
    roomId = "room_" + Math.random().toString(36).substring(2, 9);
    mySymbol = 'X';
    isMyTurn = true;
    statusDiv.innerText = "أنت اللاعب (X) - شارك الرابط مع صاحبك!";
    shareBtn.style.display = 'inline-block';
    startTimer();
} else {
    mySymbol = 'O';
    isMyTurn = false;
    statusDiv.innerText = "أنت اللاعب (O) - ينتظر دور (X)";
}

// 3. الاتصال اللحظي بالخادم
const channel = supabaseClient.channel(`game_${roomId}`);

channel.on('broadcast', { event: 'move' }, payload => {
    const { index, symbol } = payload.payload;
    gameState[index] = symbol;
    updateBoard();
    
    const winningPattern = getWinningPattern(symbol);
    if (winningPattern) {
        highlightWinningCells(winningPattern);
        statusDiv.innerText = `للأسف! صاحبك (${symbol}) فاز باللعبة 💔`;
        loseSound.play();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        endGame();
        return;
    }
    
    if (!gameState.includes("")) {
        statusDiv.innerText = "تعادل انت وصاحبـك ! 🤝";
        endGame();
        return;
    }

    isMyTurn = (symbol !== mySymbol);
    resetTimer();
    statusDiv.innerText = isMyTurn ? `دورك الآن! (⏱️ ${timeLeft}ث)` : "بانتظار حركة صاحبـك...";
}).on('broadcast', { event: 'reaction' }, payload => {
    showFloatingEmoji(payload.payload.emoji);
}).on('broadcast', { event: 'rematch' }, () => {
    resetGameLocal();
}).subscribe();

// 4. تنفيذ الحركة والعداد
function startTimer() {
    clearInterval(timer);
    timeLeft = 10;
    if (!gameActive || !isMyTurn) return;

    timer = setInterval(() => {
        timeLeft--;
        if (isMyTurn) statusDiv.innerText = `دورك الآن! (⏱️ ${timeLeft}ث)`;
        
        if (timeLeft <= 3 && timeLeft > 0) timerSound.play();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            isMyTurn = false;
            statusDiv.innerText = "انتهى وقتك! انتقل الدور لصاحبك ⏳";
            channel.send({
                type: 'broadcast',
                event: 'reaction',
                payload: { emoji: '⏰' }
            });
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timer);
    if (isMyTurn && gameActive) startTimer();
}

function makeMove(index) {
    if (!gameActive || !isMyTurn || gameState[index] !== "") return;

    clickSound.play();
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    gameState[index] = mySymbol;
    updateBoard();
    
    channel.send({
        type: 'broadcast',
        event: 'move',
        payload: { index, symbol: mySymbol }
    });

    const winningPattern = getWinningPattern(mySymbol);
    if (winningPattern) {
        highlightWinningCells(winningPattern);
        statusDiv.innerText = "مبروك! لقد فزت باللعبة! 🤩🎉";
        winSound.play();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        endGame();
        return;
    }

    if (!gameState.includes("")) {
        statusDiv.innerText = "تعادل انت وصاحبـك ! 🤝";
        endGame();
        return;
    }

    isMyTurn = false;
    resetTimer();
    statusDiv.innerText = "بانتظار حركة صاحبـك...";
}

function updateBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
        cell.innerText = gameState[i];
    });
}

function getWinningPattern(symbol) {
    return winPatterns.find(pattern => pattern.every(index => gameState[index] === symbol));
}

function highlightWinningCells(pattern) {
    const cells = document.querySelectorAll('.cell');
    pattern.forEach(index => {
        cells[index].style.backgroundColor = '#28a745';
        cells[index].style.color = '#fff';
    });
}

function endGame() {
    gameActive = false;
    clearInterval(timer);
    rematchBtn.style.display = 'inline-block';
}

function requestRematch() {
    channel.send({ type: 'broadcast', event: 'rematch', payload: {} });
    resetGameLocal();
}

function resetGameLocal() {
    gameState = Array(9).fill("");
    gameActive = true;
    rematchBtn.style.display = 'none';
    
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.innerText = "";
        cell.style.backgroundColor = "";
        cell.style.color = "";
    });

    isMyTurn = (mySymbol === 'X');
    statusDiv.innerText = isMyTurn ? "بدأت جولة جديدة! دورك الآن." : "بدأت جولة جديدة! بانتظار صاحبك...";
    resetTimer();
}

// 5. التفاعلات ومشاركة الرابط
function sendEmoji(emoji) {
    channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji }
    });
    showFloatingEmoji(emoji);
}

function showFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.innerText = emoji;
    el.className = 'floating-emoji';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function shareGame() {
    const botUsername = "VVJJbot";
    const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}/game?startapp=${roomId}&text=🎮 تحداني الآن في لعبة XO!`;
    if (tg) {
        tg.openTelegramLink(shareUrl);
    } else {
        window.open(shareUrl, '_blank');
    }
}
