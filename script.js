(() => {
  const STORAGE_KEY = "dodge-best-score";
  const PLAYER_WIDTH = 48;
  const PLAYER_HEIGHT = 48;
  const PLAYER_BOTTOM = 20;

  const POWER_UP = {
    shield: { label: "Shield", durationMs: 5500 },
    slowmo: { label: "Slow Motion", durationMs: 4500 },
    magnet: { label: "Coin Magnet", durationMs: 5200 },
    life: { label: "Extra Life", durationMs: 0 },
  };

  const gameEl = document.getElementById("game");
  const playerEl = document.getElementById("player");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const coinsEl = document.getElementById("coins");
  const livesEl = document.getElementById("lives");
  const statusBannerEl = document.getElementById("status-banner");
  const collectibleFeedbackEl = document.getElementById("collectible-feedback");
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
    magnetUntil: 0,
  };
  const statusFlash = { text: "", until: 0 };
  const collectibleNotifications = [];
  let collectibleNotificationActive = false;
  let coinNotificationCount = 0;
  let coinNotificationTimer = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function expandRect(rect, padding) {
    return {
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
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
    positionCollectibleFeedback();
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
    clearCollectibleNotifications();
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
    activePowerUps.magnetUntil = 0;
    statusFlash.text = "";
    statusFlash.until = 0;

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

  function pulseHudValue(el) {
    el.classList.remove("value-pop");
    void el.offsetWidth;
    el.classList.add("value-pop");
  }

  function positionCollectibleFeedback() {
    const bannerBottom = statusBannerEl.offsetTop + statusBannerEl.offsetHeight;
    collectibleFeedbackEl.style.top = `${Math.round(bannerBottom + 8)}px`;
  }

  function clearCollectibleNotifications() {
    collectibleNotifications.length = 0;
    collectibleNotificationActive = false;
    coinNotificationCount = 0;
    if (coinNotificationTimer) {
      clearTimeout(coinNotificationTimer);
      coinNotificationTimer = null;
    }
    collectibleFeedbackEl.replaceChildren();
  }

  function showNextCollectibleNotification() {
    if (collectibleNotificationActive || collectibleNotifications.length === 0) {
      return;
    }
    collectibleNotificationActive = true;
    const notification = collectibleNotifications.shift();
    const noticeEl = document.createElement("div");
    noticeEl.className = `collectible-feedback-item ${notification.variant}`;
    noticeEl.textContent = notification.text;
    collectibleFeedbackEl.replaceChildren(noticeEl);
    noticeEl.addEventListener(
      "animationend",
      () => {
        noticeEl.remove();
        collectibleNotificationActive = false;
        showNextCollectibleNotification();
      },
      { once: true },
    );
  }

  function queueCollectibleNotification(text, variant) {
    collectibleNotifications.push({ text, variant });
    showNextCollectibleNotification();
  }

  function queueCoinNotification() {
    coinNotificationCount += 1;
    if (coinNotificationTimer) {
      return;
    }
    coinNotificationTimer = setTimeout(() => {
      const collectedCoins = coinNotificationCount;
      coinNotificationCount = 0;
      coinNotificationTimer = null;
      const coinLabel = collectedCoins === 1 ? "+1 Coin" : `+${collectedCoins} Coins`;
      queueCollectibleNotification(coinLabel, "coin");
    }, 160);
  }

  function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.background = color;
      const angle = Math.random() * Math.PI * 2;
      const distance = 12 + Math.random() * 24;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 8;
      particle.style.setProperty("--dx", `${dx}px`);
      particle.style.setProperty("--dy", `${dy}px`);
      gameEl.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
    }
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
    const typePool = ["shield", "slowmo", "magnet", "life"];
    const type = typePool[Math.floor(Math.random() * typePool.length)];
    const size = 22;
    const difficulty = getDifficulty();
    const speed = difficulty.coinSpeedBase + 20;
    const iconByType = {
      shield: "🛡",
      slowmo: "⏳",
      magnet: "🧲",
      life: "❤",
    };

    const entity = makeFallingEntity(`power-up ${type}`, size, size, speed);
    entity.el.setAttribute("data-icon", iconByType[type] || "★");
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
    const centerX = coin.x + coin.width / 2;
    const centerY = coin.y + coin.height / 2;
    coin.el.remove();
    coins.splice(index, 1);
    coinCount += 1;
    coinsEl.textContent = String(coinCount);
    pulseHudValue(coinsEl);
    score += 20 * multiplier;
    queueCoinNotification();
    spawnParticles(centerX, centerY, "rgba(255, 214, 94, 0.95)");
  }

  function setStatusBanner(label) {
    statusBannerEl.textContent = label;
  }

  function updatePowerUpState() {
    const now = performance.now();
    const shieldActive = activePowerUps.shieldUntil > now;
    const slowmoActive = activePowerUps.slowmoUntil > now;
    const magnetActive = activePowerUps.magnetUntil > now;

    gameEl.classList.toggle("shield-active", shieldActive);
    gameEl.classList.toggle("slowmo-active", slowmoActive);
    gameEl.classList.toggle("magnet-active", magnetActive);

    const activeEntries = [];
    if (shieldActive) {
      activeEntries.push(`${POWER_UP.shield.label} ${((activePowerUps.shieldUntil - now) / 1000).toFixed(1)}s`);
    }
    if (slowmoActive) {
      activeEntries.push(`${POWER_UP.slowmo.label} ${((activePowerUps.slowmoUntil - now) / 1000).toFixed(1)}s`);
    }
    if (magnetActive) {
      activeEntries.push(`${POWER_UP.magnet.label} ${((activePowerUps.magnetUntil - now) / 1000).toFixed(1)}s`);
    }
    if (activeEntries.length > 0) {
      setStatusBanner(`Power-up: ${activeEntries.join(" • ")}`);
      statusBannerEl.classList.add("active");
      return;
    }
    if (statusFlash.until > now) {
      setStatusBanner(statusFlash.text);
      statusBannerEl.classList.add("active");
      return;
    }

    setStatusBanner("Power-up: None");
    statusBannerEl.classList.remove("active");
  }

  function activatePowerUp(type) {
    const now = performance.now();
    if (type === "life") {
      const nextLives = Math.min(5, lives + 1);
      const gainedLife = nextLives > lives;
      lives = nextLives;
      livesEl.textContent = String(lives);
      if (gainedLife) {
        statusFlash.text = "Power-up: Extra Life +1";
        statusFlash.until = now + 850;
        pulseHudValue(livesEl);
      }
      return gainedLife ? "Extra Life +1" : "";
    }

    const config = POWER_UP[type];
    if (!config) {
      return;
    }
    const untilKey = `${type}Until`;
    if (Object.prototype.hasOwnProperty.call(activePowerUps, untilKey)) {
      activePowerUps[untilKey] = Math.max(activePowerUps[untilKey], now) + config.durationMs;
    }

    updatePowerUpState();
    return `${config.label} Active`;
  }

  function collectPowerUp(index) {
    const powerUp = powerUps[index];
    const centerX = powerUp.x + powerUp.width / 2;
    const centerY = powerUp.y + powerUp.height / 2;
    powerUp.el.remove();
    powerUps.splice(index, 1);
    const notificationText = activatePowerUp(powerUp.type);
    score += 12 * multiplier;
    if (notificationText) {
      const variant = powerUp.type === "life" ? "life" : "power";
      queueCollectibleNotification(notificationText, variant);
    }
    spawnParticles(centerX, centerY, "rgba(156, 247, 255, 0.95)", 8);
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
    const magnetActive = activePowerUps.magnetUntil > performance.now();
    const playerCenterX = playerRect.x + playerRect.width / 2;
    const playerCenterY = playerRect.y + playerRect.height / 2;
    const magnetRadius = Math.min(gameWidth, gameHeight) * 0.34;

    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.y += coin.speed * deltaSec * worldScale;
      if (magnetActive) {
        const coinCenterX = coin.x + coin.width / 2;
        const coinCenterY = coin.y + coin.height / 2;
        const dx = playerCenterX - coinCenterX;
        const dy = playerCenterY - coinCenterY;
        const distance = Math.hypot(dx, dy);
        if (distance < magnetRadius) {
          const pull = (1 - distance / magnetRadius) * 620 * deltaSec;
          const norm = distance || 1;
          coin.x = clamp(coin.x + (dx / norm) * pull, 0, gameWidth - coin.width);
          coin.y += (dy / norm) * pull;
        }
      }
      coin.el.style.left = `${coin.x}px`;
      coin.el.style.top = `${coin.y}px`;

      if (intersects(expandRect(playerRect, 4), expandRect(coin, 2))) {
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
    const playerRect = expandRect(getPlayerRect(), 2);

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
    clearCollectibleNotifications();
    gameEl.classList.remove("shield-active", "slowmo-active", "magnet-active");

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
