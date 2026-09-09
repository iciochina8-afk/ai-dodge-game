(() => {
  const STORAGE_KEY = "dodge-best-score";
  const PLAYER_WIDTH = 48;
  const PLAYER_HEIGHT = 48;
  const PLAYER_BOTTOM = 20;

  const POWER_UP = {
    shield: { label: "Shield", durationMs: 5500 },
    slowmo: { label: "Slow Motion", durationMs: 4500 },
    life: { label: "Extra Life", durationMs: 0 },
  };

  const gameEl = document.getElementById("game");
  const playerEl = document.getElementById("player");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const coinsEl = document.getElementById("coins");
  const livesEl = document.getElementById("lives");
  const statusBannerEl = document.getElementById("status-banner");
  const bestScoreEl = document.getElementById("best-score");
  const finalScoreEl = document.getElementById("final-score");
  const finalCoinsEl = document.getElementById("final-coins");
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
  let coins = [];
  let powerUps = [];

  let score = 0;
  let coinCount = 0;
  let combo = 0;
  let multiplier = 1;
  let lives = 1;

  let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let gameRunning = false;
  let animationFrameId = null;
  let lastFrameTime = 0;

  let obstacleSpawnTimer = 0;
  let coinSpawnTimer = 0;
  let powerUpSpawnTimer = 0;

  const activePowerUps = {
    shieldUntil: 0,
    slowmoUntil: 0,
  };

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

  function removeAllEntities() {
    obstacles.forEach((entity) => entity.el.remove());
    coins.forEach((entity) => entity.el.remove());
    powerUps.forEach((entity) => entity.el.remove());
    obstacles = [];
    coins = [];
    powerUps = [];
  }

  function getDifficulty() {
    const progression = Math.min(1, score / 600);
    const obstacleSpeedBase = 170 + progression * 260;
    const obstacleSpawnInterval = 980 - progression * 620;
    const coinSpeedBase = 130 + progression * 80;
    return {
      obstacleSpeedBase,
      obstacleSpawnInterval,
      coinSpeedBase,
    };
  }

  function resetGame() {
    removeAllEntities();
    score = 0;
    coinCount = 0;
    combo = 0;
    multiplier = 1;
    lives = 1;

    scoreEl.textContent = "0";
    comboEl.textContent = "x1";
    coinsEl.textContent = "0";
    livesEl.textContent = "1";

    obstacleSpawnTimer = 0;
    coinSpawnTimer = 0;
    powerUpSpawnTimer = 0;
    activePowerUps.shieldUntil = 0;
    activePowerUps.slowmoUntil = 0;

    syncGameSize();
    playerX = (gameWidth - PLAYER_WIDTH) / 2;
    drawPlayer();
    updatePowerUpState();
  }

  function getPlayerRect() {
    return {
      x: playerX,
      y: gameHeight - PLAYER_HEIGHT - PLAYER_BOTTOM,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    };
  }

  function intersects(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function makeFallingEntity(className, width, height, speed) {
    const el = document.createElement("div");
    el.className = className;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    const x = Math.random() * (gameWidth - width);
    const y = -height;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    gameEl.appendChild(el);

    return { el, x, y, width, height, speed };
  }

  function spawnObstacle() {
    const difficulty = getDifficulty();
    const width = 24 + Math.random() * 44;
    const height = 14 + Math.random() * 26;
    const speed = difficulty.obstacleSpeedBase + Math.random() * 90;
    obstacles.push(makeFallingEntity("obstacle", width, height, speed));
  }

  function spawnCoin() {
    const difficulty = getDifficulty();
    const size = 18;
    const speed = difficulty.coinSpeedBase + Math.random() * 40;
    coins.push(makeFallingEntity("coin", size, size, speed));
  }

  function spawnPowerUp() {
    const typePool = ["shield", "slowmo", "life"];
    const type = typePool[Math.floor(Math.random() * typePool.length)];
    const size = 22;
    const difficulty = getDifficulty();
    const speed = difficulty.coinSpeedBase + 20;

    const entity = makeFallingEntity(`power-up ${type}`, size, size, speed);
    powerUps.push({ ...entity, type });
  }

  function gainDodgeScore() {
    combo += 1;
    multiplier = Math.min(6, 1 + Math.floor(combo / 4));
    comboEl.textContent = `x${multiplier}`;
    score += 8 * multiplier;
  }

  function resetCombo() {
    combo = 0;
    multiplier = 1;
    comboEl.textContent = "x1";
  }

  function collectCoin(index) {
    const coin = coins[index];
    coin.el.remove();
    coins.splice(index, 1);
    coinCount += 1;
    coinsEl.textContent = String(coinCount);
    score += 20 * multiplier;
  }

  function setStatusBanner(label) {
    statusBannerEl.textContent = label;
  }

  function updatePowerUpState() {
    const now = performance.now();
    const shieldActive = activePowerUps.shieldUntil > now;
    const slowmoActive = activePowerUps.slowmoUntil > now;

    gameEl.classList.toggle("shield-active", shieldActive);
    gameEl.classList.toggle("slowmo-active", slowmoActive);

    if (shieldActive && slowmoActive) {
      setStatusBanner("Power-ups: Shield + Slow Motion");
      statusBannerEl.classList.add("active");
      return;
    }

    if (shieldActive) {
      setStatusBanner("Power-up: Shield active");
      statusBannerEl.classList.add("active");
      return;
    }

    if (slowmoActive) {
      setStatusBanner("Power-up: Slow Motion active");
      statusBannerEl.classList.add("active");
      return;
    }

    setStatusBanner("Power-up: None");
    statusBannerEl.classList.remove("active");
  }

  function activatePowerUp(type) {
    const now = performance.now();
    if (type === "life") {
      lives = Math.min(5, lives + 1);
      livesEl.textContent = String(lives);
      setStatusBanner("Power-up: Extra Life gained");
      statusBannerEl.classList.add("active");
      window.setTimeout(() => {
        if (!gameRunning) {
          return;
        }
        updatePowerUpState();
      }, 700);
      return;
    }

    const config = POWER_UP[type];
    if (!config) {
      return;
    }

    if (type === "shield") {
      activePowerUps.shieldUntil = Math.max(activePowerUps.shieldUntil, now) + config.durationMs;
    }

    if (type === "slowmo") {
      activePowerUps.slowmoUntil = Math.max(activePowerUps.slowmoUntil, now) + config.durationMs;
    }

    updatePowerUpState();
  }

  function collectPowerUp(index) {
    const powerUp = powerUps[index];
    powerUp.el.remove();
    powerUps.splice(index, 1);
    activatePowerUp(powerUp.type);
    score += 12 * multiplier;
  }

  function consumeLifeOnHit() {
    const now = performance.now();
    const shieldActive = activePowerUps.shieldUntil > now;

    if (shieldActive) {
      activePowerUps.shieldUntil = 0;
      updatePowerUpState();
      gameEl.classList.remove("hit");
      void gameEl.offsetWidth;
      gameEl.classList.add("hit");
      resetCombo();
      return false;
    }

    lives -= 1;
    livesEl.textContent = String(Math.max(0, lives));
    resetCombo();

    playerEl.classList.remove("bump");
    void playerEl.offsetWidth;
    playerEl.classList.add("bump");

    if (lives > 0) {
      gameEl.classList.remove("hit");
      void gameEl.offsetWidth;
      gameEl.classList.add("hit");
      return false;
    }

    return true;
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

  function getWorldSpeedScale() {
    const now = performance.now();
    return activePowerUps.slowmoUntil > now ? 0.58 : 1;
  }

  function updateObstacles(deltaSec, worldScale) {
    const playerRect = getPlayerRect();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.y += obs.speed * deltaSec * worldScale;
      obs.el.style.top = `${obs.y}px`;

      if (intersects(playerRect, obs)) {
        obs.el.remove();
        obstacles.splice(i, 1);
        if (consumeLifeOnHit()) {
          endGame();
          return;
        }
        continue;
      }

      if (obs.y > gameHeight + obs.height) {
        obs.el.remove();
        obstacles.splice(i, 1);
        gainDodgeScore();
      }
    }
  }

  function updateCoins(deltaSec, worldScale) {
    const playerRect = getPlayerRect();

    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.y += coin.speed * deltaSec * worldScale;
      coin.el.style.top = `${coin.y}px`;

      if (intersects(playerRect, coin)) {
        collectCoin(i);
        continue;
      }

      if (coin.y > gameHeight + coin.height) {
        coin.el.remove();
        coins.splice(i, 1);
      }
    }
  }

  function updatePowerUps(deltaSec, worldScale) {
    const playerRect = getPlayerRect();

    for (let i = powerUps.length - 1; i >= 0; i--) {
      const powerUp = powerUps[i];
      powerUp.y += powerUp.speed * deltaSec * worldScale;
      powerUp.el.style.top = `${powerUp.y}px`;

      if (intersects(playerRect, powerUp)) {
        collectPowerUp(i);
        continue;
      }

      if (powerUp.y > gameHeight + powerUp.height) {
        powerUp.el.remove();
        powerUps.splice(i, 1);
      }
    }
  }

  function updateScore(deltaSec) {
    score += deltaSec * 12 * multiplier;
    scoreEl.textContent = String(Math.floor(score));
  }

  function spawnEntities(deltaSec) {
    const difficulty = getDifficulty();

    obstacleSpawnTimer += deltaSec * 1000;
    if (obstacleSpawnTimer >= difficulty.obstacleSpawnInterval) {
      obstacleSpawnTimer -= difficulty.obstacleSpawnInterval;
      spawnObstacle();
    }

    coinSpawnTimer += deltaSec * 1000;
    if (coinSpawnTimer >= 1500) {
      coinSpawnTimer -= 1500;
      spawnCoin();
    }

    powerUpSpawnTimer += deltaSec * 1000;
    if (powerUpSpawnTimer >= 5200) {
      powerUpSpawnTimer -= 5200;
      if (Math.random() < 0.72) {
        spawnPowerUp();
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
    spawnEntities(deltaSec);

    const worldScale = getWorldSpeedScale();
    updateObstacles(deltaSec, worldScale);
    updateCoins(deltaSec, worldScale);
    updatePowerUps(deltaSec, worldScale);

    updatePowerUpState();
    updateScore(deltaSec);

    if (gameRunning) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    gameEl.classList.remove("shield-active", "slowmo-active");

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
    finalCoinsEl.textContent = String(coinCount);
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
  updatePowerUpState();
})();
