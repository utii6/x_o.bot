const tg = window.Telegram.WebApp;
tg.expand();

const board = document.getElementById("board");
const status = document.getElementById("status");
let current = "X";
let gameOver = false;

// إنشاء 9 خلايا
const cells = [];
for (let i = 0; i < 9; i++) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  cell.addEventListener("click", () => makeMove(i));
  board.appendChild(cell);
  cells.push(cell);
}

function makeMove(i) {
  if (cells[i].innerText !== "" || gameOver) return;
  cells[i].innerText = current;
  cells[i].classList.add("taken");
  if (checkWin(current)) {
    status.innerText = `الفائز😂: ${current} 🎉`;
    gameOver = true;
    tg.sendData(`😂الفائز هو ${current}`);
  } else if (cells.every(c => c.innerText !== "")) {
    status.innerText = "تعادل 🤝";
    tg.sendData("اللعبة انتهت بتعادل💁");
    gameOver = true;
  } else {
    current = current === "X" ? "O" : "X";
    status.innerText = `الدور: ${current}`;
  }
}

function checkWin(player) {
  const wins = [
    [0,1,2], [3,4,5], [6,7,8], // صفوف
    [0,3,6], [1,4,7], [2,5,8], // أعمدة
    [0,4,8], [2,4,6]           // أقطار
  ];
  return wins.some(combo => 
    combo.every(index => cells[index].innerText === player)
  );
}
