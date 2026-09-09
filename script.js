(() => {
  const STORAGE_KEY = "dodge-best-score";
  const PLAYER_WIDTH = 52;
  const PLAYER_HEIGHT = 60;
  const PLAYER_BOTTOM = 24;
  const MAX_LIVES = 3;
  const INVULNERABILITY_SECONDS = 1.05;

  const gameEl = document.getElementById("game");
  const playerEl = document.getElementById("player");
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("best-score");
  const livesEl = document.getElementById("lives");
  const finalScoreEl = document.getElementById("final-score");
  const finalBestScoreEl = document.getElementById("final-best-score");
  const effectLayerEl = document.getElementById("effect-layer");
  const screenFxEl = document.getElementById("screen-fx");
  const startOverlayEl = document.getElementById("start-overlay");
  const gameOverOverlayEl = document.getElementById("game-over-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  let gameWidth = 0;
  let gameHeight = 0;
  let playerX = 0;
  let playerVelocity = 0;
  let keys = { left: false, right: false };
  let obstacles = [];
  let score = 0;
  let bestScore = loadBestScore();
  let lives = MAX_LIVES;
  let gameRunning = false;
  let animationFrameId = null;
  let lastFrameTime = 0;
  let spawnTimer = 0;
  let invulnerabilityTimer = 0;
  let fxTimeoutId = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadBestScore() {
    try {
      return Number(window.localStorage.getItem(STORAGE_KEY) || 0);
    } catch {
      return 0;
    }
  }

  function saveBestScore(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      return;
    }
  }

  function updateBestScoreDisplay() {
    bestScoreEl.textContent = String(bestScore);
  }

  function updateScoreDisplay() {
    const currentScore = Math.floor(score);
    scoreEl.textContent = String(currentScore);

    if (currentScore > bestScore) {
      bestScore = currentScore;
      saveBestScore(bestScore);
      updateBestScoreDisplay();
    }
  }

  function renderLives(lostLifeIndex = -1) {
    livesEl.innerHTML = "";

    for (let index = 0; index < MAX_LIVES; index += 1) {
      const heart = document.createElement("span");
      heart.className = "heart";
      if (index >= lives) {
        heart.classList.add("is-empty");
      }
      if (index === lostLifeIndex) {
        heart.classList.add("is-lost");
      }
      heart.setAttribute("aria-hidden", "true");
      livesEl.appendChild(heart);
    }

    livesEl.setAttribute("aria-label", `${lives} of ${MAX_LIVES} lives remaining`);
  }

  function syncGameSize() {
    const rect = gameEl.getBoundingClientRect();
    gameWidth = rect.width;
    gameHeight = rect.height;
    playerX = clamp(playerX, 0, Math.max(0, gameWidth - PLAYER_WIDTH));

    obstacles.forEach((obstacle) => {
      obstacle.x = clamp(obstacle.x, 0, Math.max(0, gameWidth - obstacle.width));
      obstacle.el.style.left = `${obstacle.x}px`;
    });

    drawPlayer();
  }

  function drawPlayer() {
    const tilt = clamp(playerVelocity * 0.03, -14, 14);
    playerEl.style.left = `${playerX}px`;
    playerEl.style.transform = `rotate(${tilt}deg)`;
  }

  function getCurrentDifficulty() {
    return 1 + Math.min(score / 140, 2.75);
  }

  function getSpawnInterval() {
    return Math.max(260, 920 - score * 4.6);
  }

  function clearObstacles() {
    obstacles.forEach((obstacle) => obstacle.el.remove());
    obstacles = [];
  }

  function clearEffects() {
    effectLayerEl.replaceChildren();
    gameEl.classList.remove("hit");
    playerEl.classList.remove("hit-bounce", "invulnerable");
    screenFxEl.classList.remove("active");
    if (fxTimeoutId) {
      clearTimeout(fxTimeoutId);
      fxTimeoutId = null;
    }
  }

  function resetGame() {
    clearObstacles();
    clearEffects();
    score = 0;
    lives = MAX_LIVES;
    spawnTimer = 0;
    invulnerabilityTimer = 0;
    playerVelocity = 0;
    keys = { left: false, right: false };
    scoreEl.textContent = "0";
    renderLives();
    syncGameSize();
    playerX = (gameWidth - PLAYER_WIDTH) / 2;
    drawPlayer();
  }

  function spawnObstacle() {
    const width = 24 + Math.random() * 54;
    const height = 18 + Math.random() * 30;
    const obstacle = document.createElement("div");
    const hue = 330 + Math.random() * 30;
    const speed = 150 + Math.random() * 85;
    const x = Math.random() * Math.max(1, gameWidth - width);

    obstacle.className = "obstacle";
    obstacle.style.width = `${width}px`;
    obstacle.style.height = `${height}px`;
    obstacle.style.left = `${x}px`;
    obstacle.style.top = `${-height}px`;
    obstacle.style.setProperty("--hue", `${hue}`);

    gameEl.appendChild(obstacle);
    obstacles.push({
      el: obstacle,
      x,
      y: -height,
      width,
      height,
      speed,
      rotation: Math.random() * 10 - 5,
      spin: (Math.random() * 24 - 12) * 0.2,
    });
  }

  function removeObstacleAt(index) {
    const [obstacle] = obstacles.splice(index, 1);
    if (obstacle) {
      obstacle.el.remove();
    }
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
      x: playerX + 7,
      y: gameHeight - PLAYER_HEIGHT - PLAYER_BOTTOM + 7,
      width: PLAYER_WIDTH - 14,
      height: PLAYER_HEIGHT - 14,
    };
  }

  function updateScore(deltaSec) {
    score += deltaSec * 18;
    updateScoreDisplay();
  }

  function movePlayer(deltaSec) {
    const moveSpeed = 360;
    const leftActive = keys.left;
    const rightActive = keys.right;

    if (leftActive === rightActive) {
      playerVelocity *= 0.78;
      if (Math.abs(playerVelocity) < 1) {
        playerVelocity = 0;
      }
      drawPlayer();
      return;
    }

    const direction = leftActive ? -1 : 1;
    playerVelocity = direction * moveSpeed;
    playerX = clamp(playerX + playerVelocity * deltaSec, 0, Math.max(0, gameWidth - PLAYER_WIDTH));
    drawPlayer();
  }

  function spawnImpactEffects(x, y) {
    const pieces = 12;

    for (let index = 0; index < pieces; index += 1) {
      const spark = document.createElement("span");
      spark.className = "spark";
      spark.style.setProperty("--x", `${x}px`);
      spark.style.setProperty("--y", `${y}px`);
      spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
      spark.style.setProperty("--dy", `${(Math.random() - 0.35) * 120}px`);
      spark.style.setProperty("--scale", `${0.6 + Math.random() * 1.1}`);
      spark.addEventListener("animationend", () => spark.remove(), { once: true });
      effectLayerEl.appendChild(spark);
    }

    const ring = document.createElement("span");
    ring.className = "ring";
    ring.style.setProperty("--x", `${x - 9}px`);
    ring.style.setProperty("--y", `${y - 9}px`);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
    effectLayerEl.appendChild(ring);
  }

  function triggerHitFeedback(x, y) {
    const percentX = `${(x / Math.max(1, gameWidth)) * 100}%`;
    const percentY = `${(y / Math.max(1, gameHeight)) * 100}%`;

    gameEl.classList.remove("hit");
    playerEl.classList.remove("hit-bounce");
    void gameEl.offsetWidth;
    gameEl.classList.add("hit");
    playerEl.classList.add("hit-bounce");

    screenFxEl.style.setProperty("--impact-x", percentX);
    screenFxEl.style.setProperty("--impact-y", percentY);
    screenFxEl.classList.add("active");

    if (fxTimeoutId) {
      clearTimeout(fxTimeoutId);
    }

    fxTimeoutId = window.setTimeout(() => {
      screenFxEl.classList.remove("active");
      playerEl.classList.remove("hit-bounce");
      fxTimeoutId = null;
    }, 220);

    spawnImpactEffects(x, y);
  }

  function applyHit(obstacleIndex) {
    const obstacle = obstacles[obstacleIndex];
    if (!obstacle) {
      return;
    }

    removeObstacleAt(obstacleIndex);
    const lifeBeforeHit = lives;
    lives = Math.max(0, lives - 1);
    renderLives(lifeBeforeHit - 1);

    const impactX = clamp(obstacle.x + obstacle.width / 2, 0, gameWidth);
    const impactY = clamp(obstacle.y + obstacle.height / 2, 0, gameHeight);
    triggerHitFeedback(impactX, impactY);

    if (lives <= 0) {
      endGame();
      return;
    }

    invulnerabilityTimer = INVULNERABILITY_SECONDS;
    playerEl.classList.add("invulnerable");
  }

  function updateObstacles(deltaSec) {
    const playerRect = getPlayerRect();
    const difficulty = getCurrentDifficulty();

    for (let index = obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = obstacles[index];
      obstacle.y += obstacle.speed * difficulty * deltaSec;
      obstacle.rotation += obstacle.spin * deltaSec * difficulty * 8;

      if (obstacle.y > gameHeight + obstacle.height) {
        removeObstacleAt(index);
        continue;
      }

      obstacle.el.style.top = `${obstacle.y}px`;
      obstacle.el.style.transform = `rotate(${obstacle.rotation}deg)`;

      if (invulnerabilityTimer <= 0 && intersects(playerRect, obstacle)) {
        applyHit(index);
        if (!gameRunning) {
          return;
        }
      }
    }
  }

  function updateTimers(deltaSec) {
    if (invulnerabilityTimer > 0) {
      invulnerabilityTimer = Math.max(0, invulnerabilityTimer - deltaSec);
      if (invulnerabilityTimer === 0) {
        playerEl.classList.remove("invulnerable");
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

    updateTimers(deltaSec);
    movePlayer(deltaSec);

    spawnTimer += deltaSec * 1000;
    const spawnInterval = getSpawnInterval();
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnObstacle();
    }

    updateObstacles(deltaSec);
    updateScore(deltaSec);

    if (gameRunning) {
      animationFrameId = window.requestAnimationFrame(gameLoop);
    }
  }

  function endGame() {
    gameRunning = false;
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    playerEl.classList.remove("invulnerable");
    finalScoreEl.textContent = String(Math.floor(score));
    finalBestScoreEl.textContent = String(bestScore);
    gameOverOverlayEl.classList.remove("hidden");
  }

  function startGame() {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    resetGame();
    gameRunning = true;
    lastFrameTime = 0;
    startOverlayEl.classList.add("hidden");
    gameOverOverlayEl.classList.add("hidden");
    animationFrameId = window.requestAnimationFrame(gameLoop);
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
    const nextX = clamp(pointerX - PLAYER_WIDTH / 2, 0, Math.max(0, gameWidth - PLAYER_WIDTH));
    playerVelocity = (nextX - playerX) * 12;
    playerX = nextX;
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
    if (event.pointerType === "mouse" && event.buttons === 0 && !gameRunning) {
      return;
    }

    if (event.pointerType !== "touch" && event.buttons === 0 && event.pointerType !== "mouse") {
      return;
    }

    if (event.pointerType === "mouse" && event.buttons === 0 && gameRunning) {
      handlePointer(event);
      return;
    }

    if (event.buttons !== 0 || event.pointerType === "touch") {
      handlePointer(event);
    }
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    gameEl.addEventListener(eventName, () => {
      playerVelocity *= 0.4;
    });
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  updateBestScoreDisplay();
  renderLives();
  syncGameSize();
})();
