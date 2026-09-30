const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const turnsEl = document.getElementById("turns");

const BOARD = {
  left: 80,
  top: 80,
  right: canvas.width - 80,
  bottom: canvas.height - 80,
  pocketRadius: 28,
};

const pocketCenters = [
  { x: BOARD.left, y: BOARD.top },
  { x: BOARD.right, y: BOARD.top },
  { x: BOARD.left, y: BOARD.bottom },
  { x: BOARD.right, y: BOARD.bottom },
  { x: (BOARD.left + BOARD.right) / 2, y: BOARD.top },
  { x: (BOARD.left + BOARD.right) / 2, y: BOARD.bottom },
];

const striker = {
  x: canvas.width / 2,
  y: canvas.height - 120,
  r: 18,
  vx: 0,
  vy: 0,
  color: "#6ea8ff",
};

const coins = [];

const state = {
  score: 0,
  turns: 0,
  aiming: false,
  shotInProgress: false,
  pointer: { x: 0, y: 0 },
};

function createCoin(x, y, color) {
  return {
    x,
    y,
    r: 14,
    vx: 0,
    vy: 0,
    color,
    pocketed: false,
  };
}

function updateHud() {
  scoreEl.textContent = state.score;
  turnsEl.textContent = state.turns;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resetBoard() {
  coins.length = 0;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const spacing = 2 * 14 + 2;

  const coinColors = [
    "#f4f4f4", "#f4f4f4", "#f4f4f4", "#f4f4f4",
    "#111111", "#111111", "#111111", "#111111", "#111111",
    "#d13d32", "#d13d32", "#d13d32", "#d13d32"
  ];

  const queen = createCoin(centerX, centerY, "#f7d34a");
  coins.push(queen);

  let index = 0;

  for (let row = 0; row < 5; row++) {
    const count = row + 1;
    const startX = centerX - ((count - 1) * spacing) / 2;
    const startY = centerY - (row * spacing) / 2;

    for (let c = 0; c < count; c++) {
      const x = startX + c * spacing;
      const y = startY + row * spacing * 0.85;
      if (index < coinColors.length) {
        coins.push(createCoin(x, y, coinColors[index]));
        index++;
      }
    }
  }

  const extraOffsets = [
    [0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, 1]
  ];

  extraOffsets.forEach(([dx, dy], i) => {
    const x = centerX + dx * spacing * 0.9;
    const y = centerY + dy * spacing * 0.9;
    const color = i % 2 === 0 ? "#f4f4f4" : "#111111";
    coins.push(createCoin(x, y, color));
  });

  coins.push(createCoin(centerX + 1.7 * spacing, centerY - spacing, "#d13d32"));
  coins.push(createCoin(centerX - 1.7 * spacing, centerY + spacing, "#111111"));
  coins.push(createCoin(centerX + spacing, centerY + 1.4 * spacing, "#f4f4f4"));
  coins.push(createCoin(centerX - spacing, centerY - 1.4 * spacing, "#111111"));

  striker.x = canvas.width / 2;
  striker.y = canvas.height - 120;
  striker.vx = 0;
  striker.vy = 0;

  state.shotInProgress = false;
  state.aiming = false;
  state.turns += 1;
  updateHud();
}

function handleBoardCollision(obj) {
  const minX = BOARD.left + obj.r;
  const maxX = BOARD.right - obj.r;
  const minY = BOARD.top + obj.r;
  const maxY = BOARD.bottom - obj.r;

  if (obj.x < minX) {
    obj.x = minX;
    obj.vx *= -0.85;
  }
  if (obj.x > maxX) {
    obj.x = maxX;
    obj.vx *= -0.85;
  }
  if (obj.y < minY) {
    obj.y = minY;
    obj.vy *= -0.85;
  }
  if (obj.y > maxY) {
    obj.y = maxY;
    obj.vy *= -0.85;
  }
}

function pocketCoin(obj) {
  for (const pocket of pocketCenters) {
    if (distance(obj, pocket) < BOARD.pocketRadius) {
      obj.pocketed = true;
      return true;
    }
  }
  return false;
}

function awardPoints(coin) {
  if (coin.color === "#f7d34a") {
    state.score += 5;
  } else {
    state.score += 1;
  }
}

function handleCoinCollisions() {
  for (let i = 0; i < coins.length; i++) {
    const a = coins[i];
    if (a.pocketed) continue;

    for (let j = i + 1; j < coins.length; j++) {
      const b = coins[j];
      if (b.pocketed) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const minDist = a.r + b.r;

      if (dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;

        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
          const impulse = (-(1 + 0.9) * velAlongNormal) / 2;
          const ix = impulse * nx;
          const iy = impulse * ny;

          a.vx -= ix;
          a.vy -= iy;
          b.vx += ix;
          b.vy += iy;
        }
      }
    }

    // striker collision
    if (distance(a, striker) < a.r + striker.r) {
      const dx = a.x - striker.x;
      const dy = a.y - striker.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      const overlap = a.r + striker.r - dist;
      a.x += nx * overlap;
      a.y += ny * overlap;

      const rvx = a.vx - striker.vx;
      const rvy = a.vy - striker.vy;
      const velAlongNormal = rvx * nx + rvy * ny;

      if (velAlongNormal < 0) {
        const impulse = (-(1 + 0.9) * velAlongNormal) / 2;
        a.vx += impulse * nx;
        a.vy += impulse * ny;
        striker.vx -= impulse * nx;
        striker.vy -= impulse * ny;
      }
    }
  }
}

function shootFromStriker(angle, power) {
  const shotPower = clamp(power, 0, 18);
  striker.vx = Math.cos(angle) * shotPower;
  striker.vy = Math.sin(angle) * shotPower;
  state.shotInProgress = true;
  state.aiming = false;
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#3b5e3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#7d4d2c";
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.fillStyle = "#416b3d";
  ctx.fillRect(BOARD.left, BOARD.top, BOARD.right - BOARD.left, BOARD.bottom - BOARD.top);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD.left + 10, BOARD.top + 10, BOARD.right - BOARD.left - 20, BOARD.bottom - BOARD.top - 20);

  for (const pocket of pocketCenters) {
    ctx.beginPath();
    ctx.fillStyle = "#0d0d0d";
    ctx.arc(pocket.x, pocket.y, BOARD.pocketRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 80);
  ctx.lineTo(canvas.width / 2, canvas.height - 80);
  ctx.moveTo(80, canvas.height / 2);
  ctx.lineTo(canvas.width - 80, canvas.height / 2);
  ctx.stroke();

  if (state.aiming && !state.shotInProgress) {
    const dx = state.pointer.x - striker.x;
    const dy = state.pointer.y - striker.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.min(220, Math.hypot(dx, dy));

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(striker.x, striker.y);
    ctx.lineTo(striker.x + Math.cos(angle) * length, striker.y + Math.sin(angle) * length);
    ctx.stroke();
  }
}

function drawCoins() {
  for (const coin of coins) {
    if (coin.pocketed) continue;

    ctx.beginPath();
    ctx.fillStyle = coin.color;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.arc(coin.x - coin.r * 0.35, coin.y - coin.r * 0.35, coin.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStriker() {
  ctx.beginPath();
  ctx.fillStyle = striker.color;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  ctx.arc(striker.x, striker.y, striker.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.arc(striker.x - 5, striker.y - 5, 5, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  drawBoard();
  drawCoins();
  drawStriker();
}

function update() {
  if (state.shotInProgress) {
    striker.x += striker.vx;
    striker.y += striker.vy;

    handleBoardCollision(striker);

    striker.vx *= 0.992;
    striker.vy *= 0.992;

    if (Math.abs(striker.vx) < 0.02) striker.vx = 0;
    if (Math.abs(striker.vy) < 0.02) striker.vy = 0;

    if (striker.vx === 0 && striker.vy === 0) {
      state.shotInProgress = false;
    }
  }

  for (const coin of coins) {
    if (coin.pocketed) continue;

    coin.x += coin.vx;
    coin.y += coin.vy;

    coin.vx *= 0.992;
    coin.vy *= 0.992;

    if (Math.abs(coin.vx) < 0.02) coin.vx = 0;
    if (Math.abs(coin.vy) < 0.02) coin.vy = 0;

    handleBoardCollision(coin);

    if (pocketCoin(coin)) {
      awardPoints(coin);
    }
  }

  handleCoinCollisions();

  for (const coin of coins) {
    if (coin.pocketed) continue;
    if (pocketCoin(coin)) {
      awardPoints(coin);
    }
  }

  if (coins.every((coin) => coin.pocketed)) {
    alert("You won! Play again.");
    resetBoard();
  }

  updateHud();
  draw();
  requestAnimationFrame(update);
}

canvas.addEventListener("pointerdown", (event) => {
  if (state.shotInProgress) return;

  const rect = canvas.getBoundingClientRect();
  const mx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const my = (event.clientY - rect.top) * (canvas.height / rect.height);

  const dx = mx - striker.x;
  const dy = my - striker.y;

  if (Math.hypot(dx, dy) < 40) {
    state.aiming = true;
    state.pointer.x = mx;
    state.pointer.y = my;
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.aiming || state.shotInProgress) return;

  const rect = canvas.getBoundingClientRect();
  const mx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const my = (event.clientY - rect.top) * (canvas.height / rect.height);

  state.pointer.x = mx;
  state.pointer.y = my;
});

canvas.addEventListener("pointerup", (event) => {
  if (!state.aiming || state.shotInProgress) return;

  const rect = canvas.getBoundingClientRect();
  const mx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const my = (event.clientY - rect.top) * (canvas.height / rect.height);

  const dx = striker.x - mx;
  const dy = striker.y - my;

  const distanceFromStriker = Math.hypot(dx, dy);

  if (distanceFromStriker > 0) {
    const angle = Math.atan2(dy, dx);
    const power = clamp(distanceFromStriker / 11, 0, 18);
    shootFromStriker(angle, power);
  }

  state.aiming = false;
});

resetBoard();
requestAnimationFrame(update);
