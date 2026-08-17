const tg = window.Telegram?.WebApp;

if (tg) {
    tg.expand();
    tg.ready();
}

/* =========================
   SUPABASE
========================= */

const SUPABASE_URL = "https://vlwmoapmjprhgvlimlfi.supabase.co";
const SUPABASE_KEY = "sb_publishable_1mIuWWGl__SfHvxg8Wy-vQ_AGg4esSS";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================
   SOUNDS
========================= */

const clickSound = new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
);

const winSound = new Audio(
    "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"
);

const loseSound = new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3"
);


/* =========================
   ELEMENTS
========================= */

const cells = document.querySelectorAll(".cell");
const statusDiv = document.getElementById("status");
const shareBtn = document.getElementById("shareBtn");
const aiBtn = document.getElementById("aiBtn");


/* =========================
   GAME DATA
========================= */

const WIN_PATTERNS = [
    [0,1,2],
    [3,4,5],
    [6,7,8],
    [0,3,6],
    [1,4,7],
    [2,5,8],
    [0,4,8],
    [2,4,6]
];

let board = Array(9).fill("");
let roomCode = null;
let room = null;

let myTelegramId = null;
let myPlayerId = null;
let mySymbol = null;

let isAiMode = false;
let gameActive = true;
let channel = null;
let polling = null;


/* =========================
   TELEGRAM USER
========================= */

function getTelegramUser() {

    const user = tg?.initDataUnsafe?.user;

    if (!user) {
        return {
            id: null,
            username: null,
            name: "لاعب"
        };
    }

    return {
        id: user.id,
        username: user.username || null,
        name: user.first_name || "لاعب"
    };
}


/* =========================
   START PARAMETER
========================= */

function getRoomCodeFromUrl() {

    const params = new URLSearchParams(window.location.search);

    return (
        tg?.initDataUnsafe?.start_param ||
        params.get("tgWebAppStartParam") ||
        params.get("room") ||
        null
    );
}


/* =========================
   INITIALIZATION
========================= */

async function init() {

    const user = getTelegramUser();

    myTelegramId = user.id;

    if (!myTelegramId) {
        statusDiv.textContent =
            "افتح اللعبة من داخل Telegram.";
        return;
    }

    try {

        const { data, error } = await supabaseClient.rpc(
            "get_player",
            {
                p_telegram_id: myTelegramId,
                p_username: user.username,
                p_name: user.name
            }
        );

        if (error) throw error;

        myPlayerId = data.id;

        roomCode = getRoomCodeFromUrl();

        if (roomCode) {
            await joinExistingRoom();
        } else {
            showMainMenu();
        }

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            "حدث خطأ أثناء الاتصال باللعبة.";
    }
}


/* =========================
   MAIN MENU
========================= */

function showMainMenu() {

    gameActive = false;

    shareBtn.style.display = "inline-block";
    aiBtn.style.display = "inline-block";

    statusDiv.textContent =
        "اختر طريقة اللعب 🎮";
}


/* =========================
   CREATE ROOM
========================= */

async function createRoom() {

    try {

        statusDiv.textContent =
            "جاري إنشاء المباراة...";

        const { data, error } = await supabaseClient.rpc(
            "create_room",
            {
                p_telegram_id: myTelegramId
            }
        );

        if (error) throw error;

        room = data;
        roomCode = data.code;

        mySymbol = "X";
        board = [...data.board];

        gameActive = false;

        shareBtn.style.display = "none";
        aiBtn.style.display = "none";

        statusDiv.textContent =
            "⏳ بانتظار صديقك...";

        subscribeToRoom();

        shareGame();

        startPolling();

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            "تعذر إنشاء الغرفة.";
    }
}


/* =========================
   JOIN ROOM
========================= */

async function joinExistingRoom() {

    try {

        statusDiv.textContent =
            "جاري الانضمام للمباراة...";

        const { data, error } = await supabaseClient.rpc(
            "join_room",
            {
                p_room_code: roomCode,
                p_telegram_id: myTelegramId
            }
        );

        if (error) throw error;

        room = data;

        mySymbol = "O";
        board = [...data.board];

        gameActive = true;

        shareBtn.style.display = "none";
        aiBtn.style.display = "none";

        updateBoard();

        updateTurn();

        subscribeToRoom();

        startPolling();

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            getFriendlyError(error);
    }
}


/* =========================
   ROOM REALTIME
========================= */

function subscribeToRoom() {

    if (!roomCode) return;

    if (channel) {
        supabaseClient.removeChannel(channel);
    }

    channel = supabaseClient.channel(
        `xo-room-${roomCode}`
    );

    channel
        .on(
            "broadcast",
            { event: "room_update" },
            async () => {
                await refreshRoom();
            }
        )
        .on(
            "broadcast",
            { event: "reaction" },
            payload => {

                if (payload?.payload?.emoji) {
                    showFloatingEmoji(
                        payload.payload.emoji
                    );
                }
            }
        )
        .subscribe();
}


/* =========================
   POLLING
========================= */

function startPolling() {

    stopPolling();

    polling = setInterval(
        refreshRoom,
        1200
    );
}

function stopPolling() {

    if (polling) {
        clearInterval(polling);
        polling = null;
    }
}


/* =========================
   REFRESH ROOM
========================= */

async function refreshRoom() {

    if (!roomCode || isAiMode) return;

    const { data, error } = await supabaseClient
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();

    if (error || !data) return;

    const oldStatus = room?.status;
    const oldBoard = room?.board?.join("");

    room = data;
    board = [...data.board];

    updateBoard();

    if (data.status === "waiting") {

        gameActive = false;

        statusDiv.textContent =
            "⏳ بانتظار صديقك...";
    }

    else if (data.status === "playing") {

        gameActive = true;

        if (
            oldStatus !== "playing" ||
            oldBoard !== data.board.join("")
        ) {
            updateTurn();
        } else {
            updateTurn();
        }
    }

    else if (data.status === "finished") {

        gameActive = false;

        showOnlineResult(data);
    }
}


/* =========================
   TURN
========================= */

function updateTurn() {

    if (!room || room.status !== "playing") return;

    if (room.turn === mySymbol) {

        statusDiv.textContent =
            "🔥 دورك الآن";

        gameActive = true;

    } else {

        statusDiv.textContent =
            "⏳ بانتظار حركة خصمك...";

        gameActive = false;
    }
}


/* =========================
   CELL CLICK
========================= */

cells.forEach(cell => {

    cell.addEventListener("click", () => {

        const index = Number(
            cell.dataset.index
        );

        if (isAiMode) {

            makeAiMovePlayer(index);

        } else {

            makeOnlineMove(index);
        }
    });

});


/* =========================
   ONLINE MOVE
========================= */

async function makeOnlineMove(index) {

    if (!gameActive) return;

    if (!roomCode) return;

    if (!room || room.status !== "playing") return;

    if (room.turn !== mySymbol) return;

    if (board[index] !== "") return;

    clickSound.play().catch(() => {});

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred("light");
    }

    try {

        const { data, error } =
            await supabaseClient.rpc(
                "make_move",
                {
                    p_room_code: roomCode,
                    p_telegram_id: myTelegramId,
                    p_position: index
                }
            );

        if (error) throw error;

        room = data;
        board = [...data.board];

        updateBoard();

        if (data.status === "finished") {

            gameActive = false;

            showOnlineResult(data);

        } else {

            updateTurn();
        }

        if (channel) {

            await channel.send({
                type: "broadcast",
                event: "room_update",
                payload: {
                    timestamp: Date.now()
                }
            });
        }

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            getFriendlyError(error);

        setTimeout(() => {

            if (room?.status === "playing") {
                updateTurn();
            }

        }, 1200);
    }
}


/* =========================
   AI MODE
========================= */

function startAiMode() {

    stopPolling();

    if (channel) {
        supabaseClient.removeChannel(channel);
        channel = null;
    }

    roomCode = null;
    room = null;

    isAiMode = true;
    mySymbol = "X";
    board = Array(9).fill("");
    gameActive = true;

    shareBtn.style.display = "none";
    aiBtn.style.display = "none";

    resetBoard();

    statusDiv.textContent =
        "🤖 ضد الجهاز — دورك الآن";
}


function makeAiMovePlayer(index) {

    if (!gameActive) return;

    if (board[index] !== "") return;

    board[index] = "X";

    updateBoard();

    const result = checkWinner(board);

    if (result) {

        finishAiGame(result);

        return;
    }

    gameActive = false;

    statusDiv.textContent =
        "🤖 الجهاز يفكر...";

    setTimeout(
        makeAiMove,
        500
    );
}


function makeAiMove() {

    if (isAiMode === false) return;

    if (!gameActive) return;

    const empty = [];

    board.forEach((value, index) => {

        if (value === "") {
            empty.push(index);
        }

    });

    if (!empty.length) return;

    let move = findBestAiMove();

    board[move] = "O";

    clickSound.play().catch(() => {});

    updateBoard();

    const result = checkWinner(board);

    if (result) {

        finishAiGame(result);

        return;
    }

    gameActive = true;

    statusDiv.textContent =
        "🔥 دورك الآن";
}


/* =========================
   AI LOGIC
========================= */

function findBestAiMove() {

    for (const index of emptyIndices()) {

        const test = [...board];

        test[index] = "O";

        if (checkWinner(test) === "O") {
            return index;
        }
    }

    for (const index of emptyIndices()) {

        const test = [...board];

        test[index] = "X";

        if (checkWinner(test) === "X") {
            return index;
        }
    }

    if (board[4] === "") {
        return 4;
    }

    const corners = [0, 2, 6, 8];

    const freeCorners =
        corners.filter(
            i => board[i] === ""
        );

    if (freeCorners.length) {

        return freeCorners[
            Math.floor(
                Math.random() *
                freeCorners.length
            )
        ];
    }

    const sides = [1, 3, 5, 7];

    const freeSides =
        sides.filter(
            i => board[i] === ""
        );

    if (freeSides.length) {

        return freeSides[
            Math.floor(
                Math.random() *
                freeSides.length
            )
        ];
    }

    return emptyIndices()[0];
}


function emptyIndices() {

    return board
        .map((value, index) =>
            value === "" ? index : null
        )
        .filter(index => index !== null);
}


/* =========================
   AI RESULT
========================= */

function finishAiGame(result) {

    gameActive = false;

    if (result === "X") {

        statusDiv.textContent =
            "🏆 فزت على الجهاز!";

        winSound.play().catch(() => {});

        celebrate();

    } else if (result === "O") {

        statusDiv.textContent =
            "🤖 الجهاز فاز عليك!";

        loseSound.play().catch(() => {});

    } else {

        statusDiv.textContent =
            "🤝 تعادل!";
    }

    setTimeout(() => {

        resetBoard();

        statusDiv.textContent =
            "اضغط 🤖 ضد الجهاز للعب مرة أخرى";

        aiBtn.style.display = "inline-block";

    }, 1800);
}


/* =========================
   ONLINE RESULT
========================= */

function showOnlineResult(data) {

    if (!data) return;

    if (data.winner === "draw") {

        statusDiv.textContent =
            "🤝 انتهت المباراة بالتعادل";

        return;
    }

    if (data.winner === mySymbol) {

        statusDiv.textContent =
            "🏆 فزت! 🔥";

        winSound.play().catch(() => {});

        celebrate();

    } else {

        statusDiv.textContent =
            "💀 خسرت هذه المرة";

        loseSound.play().catch(() => {});
    }
}


/* =========================
   WIN CHECK
========================= */

function checkWinner(state) {

    for (const pattern of WIN_PATTERNS) {

        const [a, b, c] = pattern;

        if (
            state[a] &&
            state[a] === state[b] &&
            state[a] === state[c]
        ) {

            highlightWinningCells(pattern);

            return state[a];
        }
    }

    if (!state.includes("")) {
        return "draw";
    }

    return null;
}


/* =========================
   BOARD
========================= */

function updateBoard() {

    cells.forEach((cell, index) => {

        cell.textContent =
            board[index] || "";

    });
}


function resetBoard() {

    board = Array(9).fill("");

    cells.forEach(cell => {

        cell.textContent = "";

        cell.style.backgroundColor = "";
        cell.style.color = "";

    });
}


function highlightWinningCells(pattern) {

    pattern.forEach(index => {

        cells[index].style.backgroundColor =
            "#28a745";

        cells[index].style.color =
            "#fff";
    });
}


/* =========================
   CONFETTI
========================= */

function celebrate() {

    if (typeof confetti !== "function") {
        return;
    }

    confetti({
        particleCount: 120,
        spread: 80,
        origin: {
            y: 0.6
        }
    });
}


/* =========================
   SHARE
========================= */

async function shareGame() {

    if (!roomCode) {

        await createRoom();

        return;
    }

    const botUsername = "VVJJbot";

    const gameUrl =
        `https://t.me/${botUsername}/game?startapp=${encodeURIComponent(roomCode)}`;

    const shareUrl =
        `https://t.me/share/url?url=${encodeURIComponent(gameUrl)}&text=${encodeURIComponent("🎮 تحداني الآن في لعبة XO!")}`;

    if (tg) {

        tg.openTelegramLink(shareUrl);

    } else {

        window.open(
            shareUrl,
            "_blank"
        );
    }
}


/* =========================
   REACTIONS
========================= */

async function sendEmoji(emoji) {

    if (!emoji) return;

    showFloatingEmoji(emoji);

    if (
        isAiMode ||
        !channel ||
        !roomCode
    ) {
        return;
    }

    await channel.send({
        type: "broadcast",
        event: "reaction",
        payload: {
            emoji
        }
    });
}


function showFloatingEmoji(emoji) {

    const element =
        document.createElement("div");

    element.textContent = emoji;

    element.className =
        "floating-emoji";

    document.body.appendChild(element);

    setTimeout(() => {

        element.remove();

    }, 1500);
}


/* =========================
   ERROR MESSAGES
========================= */

function getFriendlyError(error) {

    const message =
        error?.message || "";

    if (
        message.includes("ROOM_NOT_FOUND")
    ) {
        return "❌ الغرفة غير موجودة.";
    }

    if (
        message.includes("ROOM_NOT_AVAILABLE")
    ) {
        return "❌ هذه الغرفة لم تعد متاحة.";
    }

    if (
        message.includes("CANNOT_JOIN_OWN_ROOM")
    ) {
        return "😅 لا يمكنك الانضمام إلى غرفتك.";
    }

    if (
        message.includes("NOT_YOUR_TURN")
    ) {
        return "⏳ ليس دورك الآن.";
    }

    if (
        message.includes("CELL_TAKEN")
    ) {
        return "❌ هذه الخانة مستخدمة.";
    }

    if (
        message.includes("GAME_NOT_ACTIVE")
    ) {
        return "❌ المباراة غير نشطة.";
    }

    return "❌ حدث خطأ. حاول مرة أخرى.";
}


/* =========================
   BUTTONS
========================= */

shareBtn.addEventListener(
    "click",
    shareGame
);

aiBtn.addEventListener(
    "click",
    startAiMode
);


/* =========================
   START
========================= */

init();
