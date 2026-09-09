# Dodge

A mobile-friendly browser game where you move left and right to avoid falling obstacles.

## Play online (GitHub Pages)

- URL: https://iciochina8-afk.github.io/ai-dodge-game/
- The site deploys automatically from the `main` branch via GitHub Actions.

## How to play locally

1. Open `/home/runner/work/ai-dodge-game/ai-dodge-game/index.html` in any modern browser.
2. Tap **Start**.
3. Avoid the falling blocks for as long as possible while your score climbs.
4. You have 3 lives, so each hit costs a heart before the run ends.
5. Tap **Restart Game** after game over to jump back in.

## Controls

- **Mobile / touch:** drag anywhere inside the game area.
- **Desktop / keyboard:** `←` / `→` or `A` / `D`.
- **Desktop / mouse:** drag or move across the arena while playing.

## Scoring

- Score increases over time.
- Difficulty gradually increases as obstacles fall faster and spawn more often.
- Best score is saved automatically in your browser using `localStorage`.
- Damage triggers visible screen feedback, and the game ends when all 3 lives are gone.
