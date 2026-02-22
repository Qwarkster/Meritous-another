# Meritous Web Port — Project Plan

## Status: Live at https://meritous.web.app

Core port complete. Remaining work is post-launch enhancements.

---

## Completed Phases

| Phase | Notes |
|---|---|
| 1 — Native build | `make pkgdatadir=dat` verified working on v1.6 source |
| 2 — Emscripten setup | emsdk installed at `~/tools/emsdk` |
| 3 — WASM build | Full SDL1→WASM pipeline with custom 8-bit indexed colour rendering |
| 4 — Browser test | Fully playable: movement, enemies, PSI weapon, SFX, save points |
| 5 — Custom shell | Retro arcade HTML shell with scanlines, neon glow, fullscreen |
| 6 — SDL2 migration | Not needed — SDL1 path worked with custom rendering shims |
| 7 — GCP deployment | Firebase Hosting + GitHub Actions CI/CD via Workload Identity Federation |

See `docs/retrospective.md` for a full account of lessons learned.

---

## Upcoming Features

### Feature A — Persistent Save State (IDBFS)

**How save state currently works:**
The game saves to `~/.meritous.sav`. In Emscripten, `getenv("HOME")` returns `/home/web_user`,
so saves go to `/home/web_user/.meritous.sav` in the WASM virtual filesystem. That VFS is
**in-memory only** — destroyed when the tab closes. The game saves and loads correctly within
a session but progress is lost on page reload.

**The fix — IDBFS (browser IndexedDB):**
Emscripten's IDBFS mounts a persistent filesystem backed by the browser's IndexedDB.
No server or user accounts needed. Each browser/device gets its own save — appropriate for
a solo arcade game.

**Implementation:**
1. `web/pre.js`: add `Module.preRun` that mounts IDBFS at `/home`, then calls
   `FS.syncfs(true, cb)` to populate VFS from IndexedDB before main() starts
2. `levelblit.c`: after every `DoSaveGame()` call, flush via `EM_ASM(FS.syncfs(...))`
3. Brief "Saved ✓" toast in shell.html triggered by a JS function the C code calls

**Files:** `web/pre.js`, `anotherversion/meritous-master/src/levelblit.c`, `web/shell.html`

---

### Feature B — Mobile Touch Overlay

**The problem:**
The game needs: 4-directional movement, Space (charge/fire PSI), Enter, Escape, Tab (map).
Mobile players have none of these without an on-screen overlay.

**Design — virtual gamepad:**
- **Left zone:** D-pad cross (up/down/left/right)
- **Right zone:** Fire (Space), Confirm (Enter), Map (Tab), Menu (Escape)
- Auto-show on touch devices; toggle button for desktop
- Semi-transparent overlay positioned over the canvas
- Multi-touch required: holding Fire + moving must work simultaneously

**Implementation:**
1. `web/shell.html`: add overlay `<div>` structure + CSS (positioned absolute over canvas)
2. `web/pre.js`: `touchstart`/`touchend` listeners set/clear `MERITOUS_KEYS` entries —
   the same object the keyboard listeners use, so no C changes needed
3. Diagonal D-pad: compute touch offset from button centre to allow 8 directions
4. Detect touch device: `'ontouchstart' in window` — auto-show overlay

**Files:** `web/shell.html`, `web/pre.js` only — no C changes required

---

## Build & Deploy Reference

```bash
# Build
source ~/tools/emsdk/emsdk_env.sh
make -f web/Makefile.emscripten

# Deploy manually
firebase deploy --only hosting --project meritous

# CI auto-deploys on push to master/main
git push origin master
```

Output: `web/index.html`, `web/index.js`, `web/index.wasm`, `web/index.data`
