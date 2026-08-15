// 1. تهيئة تليجرام WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

// 2. إعدادات Supabase
const SUPABASE_URL = "https://vlwmoapmjprhgvlimlfi.supabase.co";
const SUPABASE_KEY = "sb_publishable_1mIuWWGl__SfHvxg8Wy-vQ_AGg4esSS";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// المؤثرات الصوتية
const clickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
const loseSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3');

// 3. قراءة المعاملات وتحديد الغرفة (Online / AI)
const urlParams = new URLSearchParams(window.location.search);
let startParam = tg?.initDataUnsafe?.start_param || urlParams.get('tgWebAppStartParam') || urlParams.get('room');

let roomId = startParam || null;
let isAiMode = false;
let mySymbol = 'X';
let isMyTurn = false;
let gameState = Array(9).fill("");
let gameActive = true;
let channel = null;

const winPatterns = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

const statusDiv = document.getElementById('status');
const shareBtn = document.getElementById('shareBtn');
const aiBtn = document.getElementById('aiBtn');

// التهيئة عند التشغيل
if (!roomId) {
    // إنشاء غرفة جديدة
    roomId = "room_" + Math.random().toString(36).substring(2, 9);
    mySymbol = 'X';
    isMyTurn = true;
    if (statusDiv) statusDiv.innerText = "أنت اللاعب (X) - شارك الرابط مع صديقك أو العب ضد الجهاز!";
    initOnlineRoom();
} else {
    // الانضمام لغرفة سابقة
    mySymbol = 'O';
    isMyTurn = false;
    if (statusDiv) statusDiv.innerText = "تم الانضمام للغرفة! بانتظار حركة اللاعب (X)...";
    if (shareBtn) shareBtn.style.display = 'none';
    if (aiBtn) aiBtn.style.display = 'none';
    initOnlineRoom();
}

// 4. الربط عبر Supabase Realtime
function initOnlineRoom() {
    channel = supabaseClient.channel(`game_${roomId}`, {
        config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'move' }, payload => {
        if (isAiMode) return;
        const { index, symbol } = payload.payload;
        gameState[index] = symbol;
        updateBoard();
        
        const winningPattern = getWinningPattern(symbol);
        if (winningPattern) {
            highlightWinningCells(winningPattern);
            statusDiv.innerText = `للأسف! منافسك (${symbol}) فاز باللعبة 💔`;
            loseSound.play();
            gameActive = false;
            return;
        }
        
        if (!gameState.includes("")) {
            statusDiv.innerText = "تعادل بين الطرفين! 🤝";
            gameActive = false;
            return;
        }

        isMyTurn = true;
        statusDiv.innerText = "دورك الآن!";
    }).on('broadcast', { event: 'reaction' }, payload => {
        showFloatingEmoji(payload.payload.emoji);
    }).subscribe();
}

// 5. وضع اللعب ضد الجهاز (Offline AI)
function startAiMode() {
    isAiMode = true;
    gameState = Array(9).fill("");
    gameActive = true;
    mySymbol = 'X';
    isMyTurn = true;
    
    if (shareBtn) shareBtn.style.display = 'none';
    if (aiBtn) aiBtn.style.display = 'none';
    
    resetBoardUI();
    statusDiv.innerText = "بدأ اللعب ضد الجهاز! دورك الآن (X)";
}

function makeAiMove() {
    if (!gameActive) return;
    
    let emptyIndices = gameState.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (emptyIndices.length === 0) return;

    let randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    gameState[randomIndex] = 'O';
    clickSound.play();
    updateBoard();

    const winningPattern = getWinningPattern('O');
    if (winningPattern) {
        highlightWinningCells(winningPattern);
        statusDiv.innerText = "فاز الجهاز عليك! 🤖💔";
        loseSound.play();
        gameActive = false;
        return;
    }

    if (!gameState.includes("")) {
        statusDiv.innerText = "تعادل مع الجهاز! 🤝";
        gameActive = false;
        return;
    }

    isMyTurn = true;
    statusDiv.innerText = "دورك الآن!";
}

// 6. تنفيذ الحركة واللعب
function makeMove(index) {
    if (!gameActive || !isMyTurn || gameState[index] !== "") return;

    clickSound.play();
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    gameState[index] = mySymbol;
    updateBoard();
    
    if (!isAiMode && channel) {
        channel.send({
            type: 'broadcast',
            event: 'move',
            payload: { index, symbol: mySymbol }
        });
    }

    const winningPattern = getWinningPattern(mySymbol);
    if (winningPattern) {
        highlightWinningCells(winningPattern);
        statusDiv.innerText = "مبروك! لقد فزت باللعبة! 🤩🎉";
        winSound.play();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        gameActive = false;
        return;
    }

    if (!gameState.includes("")) {
        statusDiv.innerText = "تعادل ! 🤝";
        gameActive = false;
        return;
    }

    isMyTurn = false;

    if (isAiMode) {
        statusDiv.innerText = "الجهاز يفكر...";
        setTimeout(makeAiMove, 600);
    } else {
        statusDiv.innerText = "بانتظار حركة صديقك...";
    }
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

function resetBoardUI() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.innerText = "";
        cell.style.backgroundColor = "";
        cell.style.color = "";
    });
}

// 7. التفاعلات ومشاركة الرابط
function sendEmoji(emoji) {
    if (!isAiMode && channel) {
        channel.send({
            type: 'broadcast',
            event: 'reaction',
            payload: { emoji }
        });
    }
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
