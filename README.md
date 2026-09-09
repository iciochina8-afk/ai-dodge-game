# Dodge

A mobile-friendly browser game where you move left and right to avoid falling obstacles.

## Play online (GitHub Pages)

- URL: https://iciochina8-afk.github.io/ai-dodge-game/
- The site deploys automatically from the `main` branch via GitHub Actions.

## How to play locally

1. Open `/home/runner/work/ai-dodge-game/ai-dodge-game/index.html` in any modern browser.
2. Tap **Start**.
3. Avoid the falling blocks for as long as possible.
4. Tap **Restart** after game over to play again.

## Controls

- **Mobile / touch:** drag anywhere inside the game area.
- **Desktop / keyboard:** `←` / `→` or `A` / `D`.

## Scoring

- Score increases over time and is boosted by your current combo multiplier.
- Consecutive successful dodges raise the combo, which increases the multiplier up to `x6`.
- Coins give bonus points and are tracked separately in the HUD and game-over screen.

## Gameplay features

- **Progressive difficulty:** as score rises, obstacles move faster and spawn more frequently.
- **Power-ups:**  
  - **Shield:** blocks one hit and is consumed on impact.  
  - **Slow Motion:** temporarily slows all falling objects.  
  - **Coin Magnet:** temporarily attracts nearby coins toward the player.  
  - **Extra Life:** adds one life immediately.
- **Visual feedback:** coin and power-up pickups trigger floating text, particles, HUD pops, and active power-up timers in the status banner.
- **Game over state:** shows final score, coins collected, and best score.
- **Persistence:** best score is saved automatically in your browser using `localStorage`.
