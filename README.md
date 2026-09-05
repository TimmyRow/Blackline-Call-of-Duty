# BLACKLINE — Operation Cold Harbour

A self-contained Three.js tactical FPS vertical slice. Play a night assault through a rainy industrial container port: clear six hostiles, hold E at the uplink terminal, and return to the insertion point to extract.

This is a playable prototype, not a Call of Duty equivalent or a finished AAA game. An independent visual reviewer compared actual captures with an official Black Ops 7 environment screenshot and ranked the commercial reference substantially higher. Two focused critique rounds improved lighting, weapon materials, road treatment, and environmental detail. The remaining fidelity gap is documented in `qa/REVIEW.md`.

## Run

```sh
npm install
npm run dev -- --port 5180
```

Open the printed local URL in a desktop browser with WebGL 2, keyboard, and mouse. Click **Deploy to Harbour** to capture the mouse. If pointer capture is unavailable, hold the left mouse button to look and fire. Use a normal browser tab for the best mouse-capture behavior.

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse / left click / right click | Look / fire / aim |
| Shift / Space / C or Ctrl | Sprint / jump / crouch |
| R / G | Reload / throw grenade |
| Hold E | Recover uplink |
| E at insertion point | Extract |
| Esc or P / M | Pause / mute |

Health regenerates after 4.5 seconds without damage. Cover blocks both enemy sight and bullets. Headshots defeat an enemy immediately; body hits require multiple rounds. Grenades bounce with Rapier physics and respect cover for blast damage. The pause menu includes sensitivity and quality settings.

## Implementation

- TypeScript + Vite + Three.js, with Rapier character controllers and dynamic grenades.
- Procedural local geometry and canvas PBR textures; no imported Call of Duty assets.
- Instanced environment details, merged actor geometry, tone mapping, bloom, directional shadows, rain and analytic wet lamp reflections.
- Browser-synthesized gunfire, impacts, reloads, footsteps, ambient rain and explosions.
- DOM menu/HUD and graceful WebGL failure state; simulation pauses on focus loss.
- Google Fonts provides the optional Barlow typefaces; system fonts are the fallback.
- `window.blackline.snapshot()` exposes read-only runtime diagnostics. Development builds additionally expose `window.blacklineQA` for deterministic testing; these mutation hooks are excluded from production.

## Verify

```sh
npm test
npm run build
node qa/gameplay-test.mjs
node qa/capture.mjs
node qa/performance.mjs
```

Browser scripts require Chromium and a running dev server. Set `CHROME_PATH` to its executable when the recorded local test-browser path is unavailable. The browser test exercises actual keyboard/mouse input, using development hooks only to arrange scenarios. It covers movement, sprint, boundary collision, reload conservation, jump/crouch, ADS, grenade consumption, headshots, pause/resume, death/restart and completion. Screenshots are saved under `qa/`.

Production output is `dist/`. Hosting metadata belongs to this isolated project; other games in the parent workspace are unaffected.

## Scope limits

One arena, six simple AI opponents and one rifle. No multiplayer, large campaign, authored skeletal character animation, destructible buildings, advanced squad tactics, photogrammetry, licensed production sound, or mobile touch controls. Wet lamp reflections are a lighting approximation, not full scene reflections. Performance depends on GPU, resolution, browser and other active rendering sessions. This build has not received exhaustive hardware, accessibility or long-session certification.
