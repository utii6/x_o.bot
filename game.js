const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

// 1. إعدادات Supabase (ضع مفاتيح مشروتك هنا)
const SUPABASE_URL = "https://vlwmoapmjprhgvlimlfi.supabase.co";
const SUPABASE_KEY = "sb_publishable_1mIuWWGl__SfHvxg8Wy-vQ_AGg4esSS";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// المؤثرات الصوتية
const clickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');

// 2. تحليل الرابط والغرفة
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get('tgWebAppStartParam') || urlParams.get('room');
let mySymbol = 'X';
let isMyTurn = false;
let gameState = Array(9).fill("");
let gameActive = true;

const winPatterns = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

const statusDiv = document.getElementById('status');
const shareBtn = document.getElementById('shareBtn');

if (!roomId) {
    roomId = "room_" + Math.random().toString(36).substring(2, 9);
    mySymbol = 'X';
    isMyTurn = true;
    statusDiv.innerText = "أنت اللاعب (X) - شارك الرابط مع صاحبك!";
    shareBtn.style.display = 'inline-block';
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
    
    if (checkWin(symbol)) {
        statusDiv.innerText = `اللاعب (${symbol}) فاز باللعبة! 🎉`;
        gameActive = false;
        return;
    }
    
    if (!gameState.includes("")) {
        statusDiv.innerText = "تعادل انت وصاحبـك ! 🤝";
        gameActive = false;
        return;
    }

    isMyTurn = (symbol !== mySymbol);
    statusDiv.innerText = isMyTurn ? "دورك الآن!" : "بانتظار حركة صاحبـك...";
}).on('broadcast', { event: 'reaction' }, payload => {
    showFloatingEmoji(payload.payload.emoji);
}).subscribe();

// 4. تنفيذ الحركة
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

    if (checkWin(mySymbol)) {
        statusDiv.innerText = "مبروك! لقد فزت باللعبة! 🤩🎉";
        winSound.play();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        gameActive = false;
        return;
    }

    if (!gameState.includes("")) {
        statusDiv.innerText = "تعادل انت وصاحبـك ! 🤝";
        gameActive = false;
        return;
    }

    isMyTurn = false;
    statusDiv.innerText = "بانتظار حركة صاحبـك...";
}

function updateBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
        cell.innerText = gameState[i];
    });
}

function checkWin(symbol) {
    return winPatterns.some(pattern => {
        return pattern.every(index => gameState[index] === symbol);
    });
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
