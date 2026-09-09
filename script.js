(() => {
  const STORAGE_KEY = "dodge-best-score";
  const PLAYER_WIDTH = 48;
  const PLAYER_HEIGHT = 48;

  const gameEl = document.getElementById("game");
  const playerEl = document.getElementById("player");
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("best-score");
  const finalScoreEl = document.getElementById("final-score");
  const finalBestScoreEl = document.getElementById("final-best-score");
  const startOverlayEl = document.getElementById("start-overlay");
  const gameOverOverlayEl = document.getElementById("game-over-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  let gameWidth = 0;
  let gameHeight = 0;
  let playerX = 0;
  let keys = { left: false, right: false };
  let obstacles = [];
  let score = 0;
  let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let gameRunning = false;
  let animationFrameId = null;
  let lastFrameTime = 0;
  let spawnTimer = 0;
  let baseObstacleSpeed = 160;
  let spawnInterval = 950;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function updateBestScoreDisplay() {
    bestScoreEl.textContent = String(bestScore);
  }

  function syncGameSize() {
    const rect = gameEl.getBoundingClientRect();
    gameWidth = rect.width;
    gameHeight = rect.height;
    playerX = clamp(playerX, 0, gameWidth - PLAYER_WIDTH);
    drawPlayer();
  }

  function drawPlayer() {
    playerEl.style.left = `${playerX}px`;
    playerEl.style.transform = "translateX(0)";
  }

  function resetGame() {
    obstacles.forEach((obs) => obs.el.remove());
    obstacles = [];
    score = 0;
    scoreEl.textContent = "0";
    spawnTimer = 0;
    baseObstacleSpeed = 160;
    spawnInterval = 950;
    syncGameSize();
    playerX = (gameWidth - PLAYER_WIDTH) / 2;
    drawPlayer();
  }

  function spawnObstacle() {
    const width = 26 + Math.random() * 42;
    const height = 14 + Math.random() * 24;
    const obstacle = document.createElement("div");
    obstacle.className = "obstacle";
    obstacle.style.width = `${width}px`;
    obstacle.style.height = `${height}px`;

    const x = Math.random() * (gameWidth - width);
    const speed = baseObstacleSpeed + Math.random() * 85;

    obstacle.style.left = `${x}px`;
    obstacle.style.top = `${-height}px`;

    gameEl.appendChild(obstacle);
    obstacles.push({
      el: obstacle,
      x,
      y: -height,
      width,
      height,
      speed,
    });
  }

  function intersects(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function getPlayerRect() {
    return {
      x: playerX,
      y: gameHeight - PLAYER_HEIGHT - 20,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    };
  }

  function updateDifficulty(deltaSec) {
    baseObstacleSpeed = Math.min(460, baseObstacleSpeed + 7 * deltaSec);
    spawnInterval = Math.max(330, spawnInterval - 9 * deltaSec);
  }

  function updateScore(deltaSec) {
    score += deltaSec * 10;
    scoreEl.textContent = String(Math.floor(score));
  }

  function movePlayer(deltaSec) {
    const moveSpeed = 320;
    const leftActive = keys.left;
    const rightActive = keys.right;
    if (leftActive === rightActive) {
      return;
    }
    const direction = leftActive ? -1 : 1;
    playerX = clamp(playerX + direction * moveSpeed * deltaSec, 0, gameWidth - PLAYER_WIDTH);
    drawPlayer();
  }

  function updateObstacles(deltaSec) {
    const playerRect = getPlayerRect();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.y += obs.speed * deltaSec;

      if (obs.y > gameHeight + obs.height) {
        obs.el.remove();
        obstacles.splice(i, 1);
        continue;
      }

      obs.el.style.top = `${obs.y}px`;

      if (intersects(playerRect, obs)) {
        endGame();
        return;
      }
    }
  }

  function gameLoop(timestamp) {
    if (!gameRunning) {
      return;
    }

    if (!lastFrameTime) {
      lastFrameTime = timestamp;
    }

    const deltaSec = Math.min(0.05, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    movePlayer(deltaSec);

    spawnTimer += deltaSec * 1000;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnObstacle();
    }

    updateDifficulty(deltaSec);
    updateObstacles(deltaSec);
    updateScore(deltaSec);

    if (gameRunning) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    gameEl.classList.remove("hit");
    void gameEl.offsetWidth;
    gameEl.classList.add("hit");

    const finalScore = Math.floor(score);
    if (finalScore > bestScore) {
      bestScore = finalScore;
      localStorage.setItem(STORAGE_KEY, String(bestScore));
      updateBestScoreDisplay();
    }

    finalScoreEl.textContent = String(finalScore);
    finalBestScoreEl.textContent = String(bestScore);
    gameOverOverlayEl.classList.remove("hidden");
  }

  function startGame() {
    resetGame();
    gameRunning = true;
    lastFrameTime = 0;
    startOverlayEl.classList.add("hidden");
    gameOverOverlayEl.classList.add("hidden");
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function onKeyChange(event, pressed) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "a"].includes(key)) {
      keys.left = pressed;
      event.preventDefault();
    }
    if (["arrowright", "d"].includes(key)) {
      keys.right = pressed;
      event.preventDefault();
    }
  }

  function handlePointer(event) {
    const rect = gameEl.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    playerX = clamp(pointerX - PLAYER_WIDTH / 2, 0, gameWidth - PLAYER_WIDTH);
    drawPlayer();
  }

  window.addEventListener("resize", syncGameSize);
  document.addEventListener("keydown", (event) => onKeyChange(event, true), { passive: false });
  document.addEventListener("keyup", (event) => onKeyChange(event, false), { passive: false });

  gameEl.addEventListener("pointerdown", (event) => {
    gameEl.setPointerCapture(event.pointerId);
    handlePointer(event);
  });

  gameEl.addEventListener("pointermove", (event) => {
    if (event.buttons === 0 && event.pointerType !== "touch") {
      return;
    }
    handlePointer(event);
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  updateBestScoreDisplay();
  syncGameSize();
})();
