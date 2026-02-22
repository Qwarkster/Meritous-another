# Meritous Web Port — Project Plan

## Overview

**Meritous** is a GPL-licensed C roguelike dungeon crawler originally written by Lancer-X/ASCEAI (2007–2008).
This project ports it to WebAssembly using Emscripten so it can run as a playable game in any modern browser,
with final deployment on Google Cloud Platform.

---

## Repository Structure

```
meritous-web/
├── .github/
│   ├── copilot-instructions.md   ← AI assistant context for all sessions
│   └── workflows/
│       └── deploy.yml            ← CI/CD: build → Firebase deploy (Phase 7)
├── anotherversion/
│   └── meritous-master/          ← PRIMARY BUILD SOURCE (v1.6)
│       ├── src/                  ← C source files
│       ├── dat/                  ← game assets (images, audio, data)
│       └── Makefile
├── meritous_v12_src/             ← original v1.2 source (reference + music files)
│   ├── src/
│   ├── dat/
│   └── Makefile
├── docs/
│   └── plan.md                   ← this file
├── web/                          ← Emscripten build outputs (gitignored)
│   ├── Makefile.emscripten       ← web build Makefile
│   └── shell.html                ← custom HTML shell (Phase 5)
└── README.md
```

---

## Source Version Decision

Two upstream versions are present. **v1.6 is the build base** for all porting work.

| | v1.2 (`meritous_v12_src/`) | v1.6 (`anotherversion/meritous-master/`) |
|---|---|---|
| Asset paths | Hardcoded `"dat/i/..."` strings | `DATADIR "/i/..."` compile-time macro |
| Music system | Hardcoded 13-track filename array | `PlayBackgroundMusic(n)` — looks for `track{n}.ogg/.mp3/.s3m/.xm/.mod` |
| Music files | Included (license-questionable) | Removed (not GPL-compatible) |
| Save path | `SaveFile.sav` in CWD | `~/.meritous.sav` via `$HOME` env var |
| i18n | None | GNU gettext, French translation (`po/fr.po`) |
| New source | — | `src/i18n.c` / `src/i18n.h`, `src/levelblit.h` |
| Bug fixes | Baseline | Debian patches, error handling, NULL checks |
| Version string | v1.1 | v1.6 |

### Why v1.6 is better for the web port

1. **`DATADIR` macro** — compile with `-DDATADIR='"/dat"'` to map assets cleanly into
   Emscripten's virtual filesystem (where `--preload-file dat` mounts the `dat/` directory).
2. **OGG-first music** — `PlayBackgroundMusic()` probes for `.ogg` before `.mp3`, `.s3m`,
   `.xm`, `.mod`. OGG has universal browser support; drop in `track{N}.ogg` files with no
   code changes required.
3. **`$HOME`-based save path** — easy to redirect to an Emscripten IDBFS mount by setting
   the `HOME` environment variable in the browser context.
4. **Actively maintained** — bug fixes make for a more stable porting starting point.

### Music file setup

v1.6 ships without music files due to licensing. Copy from `meritous_v12_src/dat/m/` and
rename using this index mapping (derived from the v1.2 `audio.c` tracks array):

| Index | Original filename | Rename to |
|---|---|---|
| 0 | `ICEFRONT.S3M` | `track0.s3m` |
| 1 | `cavern.xm` | `track1.xm` |
| 2 | `cave.xm` | `track2.xm` |
| 3 | `cave06.s3m` | `track3.s3m` |
| 4 | `Wood.s3m` | `track4.s3m` |
| 5 | `iller_knarkloader_final.xm` | `track5.xm` |
| 6 | `fear2.mod` | `track6.mod` |
| 7 | `Cv_boss.mod` | `track7.mod` |
| 8 | `Fr_boss.mod` | `track8.mod` |
| 9 | `CT_BOSS.MOD` | `track9.mod` |
| 10 | `rpg_bat1.xm` | `track10.xm` |
| 11 | `amblight.xm` | `track11.xm` |
| 12 | `FINALBAT.s3m` | `track12.s3m` |

> **Note for public deployment:** Replace tracker files with free/CC-licensed OGG equivalents
> (`track{N}.ogg`). The `PlayBackgroundMusic()` function picks OGG first automatically.

---

## Porting Strategy: Emscripten (C → WebAssembly)

### Approach
Compile the existing C source directly to WebAssembly using Emscripten. The goal is **minimal
code changes** — the game should remain buildable natively on Linux throughout the process.

Key Emscripten features used:
- **SDL1-compat** (`-s USE_SDL=1`) — maps SDL 1.2 API onto SDL2/WebGL canvas
- **ASYNCIFY** (`-s ASYNCIFY`) — transforms blocking `while`/`SDL_Delay` loops to async
  without restructuring the game's nested control flow (critical: the main loop is a blocking
  `while (executable_running)` that cannot run as-is in the browser's single-threaded JS model)
- **`--preload-file dat`** — packages the entire `dat/` asset directory into a `.data` file
  loaded alongside the WASM module
- **IDBFS** — Emscripten's IndexedDB-backed filesystem for save game persistence

### Fallback plan (Phase 6)
If SDL1-compat has issues with the 8-bit indexed colour palette, migrate the source to SDL2 API
(~88 SDL surface API call sites), then recompile with `-s USE_SDL=2`. This is tractable but
adds work, so try SDL1-compat first.

### Reference build command (v1.6 source)
```bash
cd anotherversion/meritous-master

emcc -O2 \
  -s USE_SDL=1 \
  -s USE_SDL_IMAGE=1 -s SDL2_IMAGE_FORMATS='["png"]' \
  -s USE_SDL_MIXER=1 -s SDL2_MIXER_FORMATS='["mod","wav","ogg"]' \
  -s ASYNCIFY \
  -s ASYNCIFY_IGNORE_INDIRECT=1 \
  --preload-file dat \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -DDATADIR='"/dat"' \
  -s FORCE_FILESYSTEM=1 \
  -o ../../web/meritous.html \
  src/audio.c src/boss.c src/demon.c src/ending.c \
  src/gamemap.c src/help.c src/levelblit.c src/i18n.c \
  src/mapgen.c src/save.c src/tiles.c
```

---

## Phases

### Phase 1 — Native Build Verification *(start here)*

Confirm the source compiles and runs correctly before attempting any porting.

**Steps:**
1. Install SDL 1.2 dev libraries:
   ```bash
   sudo apt install libsdl1.2-dev libsdl-image1.2-dev libsdl-mixer1.2-dev zlib1g-dev
   ```
2. Build and test v1.2 as a baseline:
   ```bash
   cd meritous_v12_src && make && ./meritous
   ```
3. Set up v1.6 music files — copy from `meritous_v12_src/dat/m/` into
   `anotherversion/meritous-master/dat/m/`, renaming per the index mapping above.
4. Build and test v1.6:
   ```bash
   cd anotherversion/meritous-master
   make CPPFLAGS="-DDATADIR='\"dat\"'"
   ./meritous
   ```
5. Verify both: title screen renders with palette animation, audio plays, gameplay works,
   save/load functions correctly.

**Deliverable:** Both native binaries confirmed working.

---

### Phase 2 — Emscripten Toolchain Setup

Install and verify the Emscripten SDK.

**Steps:**
```bash
git clone https://github.com/emscripten-core/emsdk.git ~/tools/emsdk
cd ~/tools/emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
emcc --version
```

**Deliverable:** `emcc` available in shell, version confirmed.

---

### Phase 3 — First WebAssembly Build

Compile v1.6 to WASM using SDL1-compat and ASYNCIFY.

**Steps:**
1. Create `web/Makefile.emscripten` using the reference command above.
2. Run the build; address any compilation errors (expected: mainly `libintl` for i18n).
3. Common fixes:
   - i18n: compile with `-DLOCALEDIR='""'` to skip locale loading if `libintl` is unavailable
   - SDL palette: ensure `SDL_SetPalette` calls use `SDL_LOGPAL|SDL_PHYSPAL` combined flag

**Deliverable:** `web/meritous.html`, `web/meritous.wasm`, `web/meritous.data` produced.

---

### Phase 4 — Local Browser Testing

Serve and verify the game runs in a browser.

**Steps:**
```bash
cd web && python3 -m http.server 8080
# Open http://localhost:8080/meritous.html
```

**Functional checklist:**
- [ ] Title screen renders with animated palette fade
- [ ] Menu navigation (arrow keys + Enter)
- [ ] New game starts, dungeon generates
- [ ] Player moves, enemies spawn and behave correctly
- [ ] PSI circuit charges (hold Space) and fires (release Space)
- [ ] Music plays, SFX trigger on events
- [ ] Save persists across page reload (IDBFS)
- [ ] Load game (Continue) works from title menu
- [ ] Boss fights function
- [ ] Endings display

**Deliverable:** Fully playable in Chromium and Firefox locally.

---

### Phase 5 — Custom HTML Shell

Replace the default Emscripten output with a polished web page.

**Features:**
- Centered canvas on dark background
- Loading progress bar with percentage
- Mute / fullscreen toggle buttons
- "Click to focus" overlay (browser keyboard focus requirement)
- Stretch goal: on-screen controls for mobile (D-pad + Space/Enter)

**Deliverable:** `web/shell.html` applied via `--shell-file web/shell.html` in the build.

---

### Phase 6 — SDL2 Migration *(conditional — only if Phase 3 fails)*

If SDL1-compat has unresolvable issues with 8-bit palette rendering, migrate to SDL2.

**Key changes:**
- `SDL_SetVideoMode(w, h, 8, flags)` → `SDL_CreateWindow` + `SDL_CreateRenderer`
- 8-bit indexed surface pipeline → 32-bit surfaces with software palette blit
- `SDL_SetPalette(surf, SDL_PHYSPAL, pal, 0, 256)` → manual RGBA palette application
- `SDL_WM_SetCaption` → `SDL_SetWindowTitle`
- `SDL_WM_SetIcon` → `SDL_SetWindowIcon`

After migration, retest the native build, then rerun Phase 3 with `-s USE_SDL=2`.

**Deliverable:** Source compiles and runs against SDL2 natively and in Emscripten.

---

### Phase 7 — GCP Deployment

Deploy the web build publicly via Google Cloud Platform.

**Recommended: Firebase Hosting**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting    # set public directory to: web/
firebase deploy
```

`firebase.json` must include correct MIME type for WASM:
```json
{
  "hosting": {
    "headers": [{
      "source": "**/*.wasm",
      "headers": [{"key": "Content-Type", "value": "application/wasm"}]
    }]
  }
}
```

**CI/CD:** `.github/workflows/deploy.yml` — triggered on push to `main`:
1. Restore Emscripten SDK (cached)
2. Build with `Makefile.emscripten`
3. Deploy to Firebase Hosting

**Deliverable:** Public URL, automated deploys on push to `main`.

---

## Key Gotchas

| Issue | Notes |
|---|---|
| 8-bit palette | Emscripten SDL1-compat uses a 32-bit back-buffer internally; `SDL_SetPalette` with combined `SDL_LOGPAL\|SDL_PHYSPAL` flag required |
| ASYNCIFY size | Adds ~20–40% to WASM binary size; use `-O2` to partially offset |
| Audio unlock | Browsers require user interaction before audio plays; Emscripten SDL_mixer handles this, but first frame may be silent |
| WASM MIME type | Server must serve `.wasm` as `application/wasm`; Python `http.server` 3.7+ handles this correctly |
| Music licensing | Tracker files (MOD/XM/S3M) are not GPL; use for local dev only; provide OGG for public deployment |
| Save persistence | v1.6 saves to `~/.meritous.sav`; in Emscripten, mount IDBFS at `/home` and call `FS.syncfs()` after writes |
| i18n / gettext | `libintl` not available in Emscripten; compile with `-DLOCALEDIR='""'` to disable locale loading |
| WASM + HTTPS | WASM modules require HTTPS (or localhost) — enforced by all modern browsers |
