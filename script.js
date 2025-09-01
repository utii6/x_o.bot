const cells = document.querySelectorAll(".cell");
let board = ["","","","","","","","",""];
const human = "X";
const ai = "O";

// تهيئة Telegram WebApp
const tg = window.Telegram.WebApp;

// وضع نقر اللاعب
cells.forEach(cell => cell.addEventListener("click", () => {
    const idx = cell.dataset.index;
    if (!board[idx]) {
        makeMove(idx, human);
        if (!checkWinner(board)) {
            aiMove();
        }
    }
}));

function makeMove(idx, player){
    board[idx] = player;
    cells[idx].textContent = player;
    const result = checkWinner(board);
    if(result){
        setTimeout(()=>gameOver(result), 100);
    }
}

// AI بسيط
function aiMove(){
    let empty = board.map((v,i)=>v==""?i:null).filter(v=>v!==null);
    // منع الخسارة
    let move = empty[0]; // اختيار أول خانة فارغة بشكل بسيط
    makeMove(move, ai);
}

// التحقق من الفائز
function checkWinner(b){
    const combos = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for(let combo of combos){
        const [a,b,c] = combo;
        if(board[a] && board[a]===board[b] && board[a]===board[c]){
            return board[a]==human?"win":"loss";
        }
    }
    if(board.every(c=>c!=="")) return "draw";
    return null;
}

// عند انتهاء اللعبة
function gameOver(result){
    alert(result=="win"?"🎉😂 فزت!":result=="loss"?"😢 خسرت😂":"⚖️ تعادل");
    tg.sendData(result); // ترسل النتيجة للبوت
    board.fill("");
    cells.forEach(cell=>cell.textContent="");
}
