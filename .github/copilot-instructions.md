# Copilot Instructions — Meritous Web Port

## Project Overview
**Meritous** is a GPL-licensed C roguelike dungeon crawler originally by Lancer-X/ASCEAI (2007-2008).
The goal of this project is to compile it to **WebAssembly** via **Emscripten** and deploy it as a
playable web game on **Google Cloud Platform**.

The original source lives in `meritous_v12_src/`. All web build artefacts live in `web/`.

---

## Source Version

**Use `anotherversion/meritous-master/` (v1.6) as the build base**, not `meritous_v12_src/` (v1.2).

| | v1.2 (`meritous_v12_src/`) | v1.6 (`anotherversion/meritous-master/`) |
|---|---|---|
| Asset paths | Hardcoded `"dat/i/..."` | `DATADIR "/i/..."` macro — compile-time configurable |
| Music system | Hardcoded `char *tracks[13]` array | `PlayBackgroundMusic(n)` looks for `track{n}.ogg/.mp3/.s3m/.xm/.mod` |
| Music files | Included (questionable license) | **Removed** (not GPL-compatible) |
| Save path | CWD `SaveFile.sav` | `~/.meritous.sav` via `$HOME` |
| i18n | None | GNU gettext, French translation |
| Bugfixes | Baseline | Debian patches, error handling |

### Music File Setup (v1.6)
v1.6 removed tracker music files due to licensing. Copy from v1.2 and **rename** using this index mapping:

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

For the **web/public deployment**, replace with OGG files (`track{N}.ogg`) — OGG is natively
supported in all major browsers and Emscripten SDL_mixer supports it via `-s SDL2_MIXER_FORMATS='["ogg"]'`.

---

## Architecture

### Build Source (`anotherversion/meritous-master/`)
| File | Purpose |
|---|---|
| `src/levelblit.c` | **Main entry point** — `main()`, title screen, game loop, rendering pipeline |
| `src/gamemap.c` | Map loading, automap, room transitions |
| `src/mapgen.c` | Procedural dungeon generation |
| `src/demon.c` | Enemy AI, projectile system |
| `src/boss.c` | Boss fight logic |
| `src/tiles.c` | Tile rendering |
| `src/save.c` | Save/load to binary file |
| `src/audio.c` | SDL_mixer wrapper — music + SFX |
| `src/ending.c` | Ending sequence |
| `src/help.c` | In-game help overlay |

### Key Dependencies
- **SDL 1.2** — display, input, event loop (`SDL_SetVideoMode`, `SDL_Surface`, `SDL_BlitSurface`)
- **SDL_image 1.2** — PNG loading (`IMG_Load`)
- **SDL_mixer 1.2** — WAV + MOD/S3M/XM music (`Mix_LoadMUS`, `Mix_PlayMusic`)
- **zlib** — used internally
- **Standard C**: `stdio`, `stdlib`, `math`, `time`, `string`

### Asset Layout (`dat/`)
```
dat/i/   PNG images (sprites, tilesets, UI)
dat/a/   WAV sound effects
dat/m/   MOD/S3M/XM music tracks
dat/d/   Binary data files, font, help text, location descriptors
```
The game expects to be run from the `meritous_v12_src/` directory so all
`dat/` paths resolve correctly.

---

## Web Port Strategy

### Primary: Emscripten + ASYNCIFY
The game uses a traditional **blocking `while` loop** with `SDL_Delay()` calls and
deeply nested loops. The cleanest approach is:

1. **Emscripten SDL1-compat** (`-s USE_SDL=1`) — maps SDL1 API onto SDL2/WebGL
2. **ASYNCIFY** (`-s ASYNCIFY`) — transforms blocking C loops to async JS without
   refactoring the game loop; required because the browser's event model cannot
   block the main thread
3. **`--preload-file dat`** — bundles the entire `dat/` directory into a virtual FS
   embedded in the `.data` file loaded alongside the WASM module
4. **IDBFS** for save persistence — mount a persistent FS at the save path using
   Emscripten's IndexedDB-backed filesystem

### Fallback: SDL2 Migration
If SDL1-compat causes runtime issues (palette handling, indexed colour), migrate
the source to SDL2 before compiling with Emscripten. See Phase 6 in plan.md.

### Emscripten Build Command (reference)
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

`-DDATADIR='"/dat"'` sets the asset base path to match where `--preload-file dat` mounts assets in the Emscripten virtual FS.

For save persistence, the game uses `$HOME/.meritous.sav`. In Emscripten, mount an IDBFS at `/home` and set the HOME env or patch the save path to target it. Add pre/post JS to call `FS.syncfs()` after saves.

---

## Development Phases

| Phase | Status | Description |
|---|---|---|
| 1 | 🔲 | **Native build** — install SDL1 dev libs, `make`, run binary |
| 2 | 🔲 | **Emscripten setup** — install emsdk, verify `emcc` |
| 3 | 🔲 | **First WASM build** — SDL1-compat + ASYNCIFY, fix compilation errors |
| 4 | 🔲 | **Local browser test** — serve with Python, verify gameplay |
| 5 | 🔲 | **HTML shell** — custom UI, fullscreen, mute, loading bar |
| 6 | 🔲 | **SDL2 migration** (only if Phase 3 fails) |
| 7 | 🔲 | **GCP deployment** — Firebase Hosting + GitHub Actions CI/CD |

---

## Coding Conventions

### When modifying original source
- Keep changes **surgical and minimal** — the original code is working GPL software
- Always mark Emscripten-specific code with `#ifdef __EMSCRIPTEN__` guards so
  native builds continue to work
- Never break the native `make` build

### Emscripten-specific patterns
```c
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#endif

// Save file persistence — call after writes:
#ifdef __EMSCRIPTEN__
EM_ASM(FS.syncfs(false, function(err) {}););
#endif
```

### SDL_Delay in main loop
- Leave `SDL_Delay` calls in place — ASYNCIFY transforms them to `setTimeout` equivalents
- Do NOT add `emscripten_set_main_loop` unless explicitly restructuring the loop

### File paths
- Source currently uses bare relative paths: `"dat/i/title.png"`
- With `--preload-file dat`, Emscripten's virtual FS mirrors this exactly — no path changes needed
- Save file path (from `save.c`) must be redirected to an IDBFS-mounted directory

---

## Testing

### Native test
```bash
# v1.2 (baseline verification)
cd meritous_v12_src && make && ./meritous

# v1.6 (primary build base)
cd anotherversion/meritous-master
# First, copy & rename music files from v1.2 into dat/m/ (see track index mapping above)
make CPPFLAGS="-DDATADIR='\"dat\"'"
./meritous
```

### Web test
```bash
cd web
python3 -m http.server 8080
# open http://localhost:8080/meritous.html
```

### Functional checklist
- [ ] Title screen renders with animated palette effect
- [ ] Menu navigation (arrow keys + Enter)
- [ ] New game starts, map generates
- [ ] Player moves, enemies spawn and attack
- [ ] PSI circuit charges and fires (Space)
- [ ] Audio: music plays, SFX trigger correctly
- [ ] Save (implicit on room change) and Load (Continue from menu) work
- [ ] Boss fights function
- [ ] Endings display correctly

---

## GCP Deployment

### Firebase Hosting (recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public dir: web/, SPA: no
# firebase.json must set MIME type for .wasm files
firebase deploy
```

`firebase.json` headers config:
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

### GitHub Actions CI/CD (`.github/workflows/deploy.yml`)
Trigger: push to `main` → install emsdk → build → Firebase deploy

---

## Known Gotchas
1. **8-bit palette mode**: `SDL_SetVideoMode(..., 8, ...)` creates an indexed-colour
   surface. Emscripten SDL1-compat handles this via a 32-bit back-buffer. If colours
   look wrong, check `SDL_SetPalette` flags — use `SDL_LOGPAL|SDL_PHYSPAL` together.
2. **Audio context unlock**: browsers require user interaction before playing audio.
   The Emscripten SDL_mixer port handles this automatically, but the game may be
   silent until the first keypress/click.
3. **ASYNCIFY size**: expect WASM binary ~2-3x larger than non-ASYNCIFY. Use `-O2`
   to partially offset this.
4. **WASM MIME type**: web server MUST serve `.wasm` as `application/wasm`. Python's
   `http.server` does this correctly in Python 3.7+.
5. **MOD/tracker music**: Emscripten SDL_mixer uses libmodplug by default. Add
   `-s USE_SDL_MIXER=1` — it includes mod support. If music is silent, check format flags.
   Prefer OGG replacements (`track{N}.ogg`) for best browser compatibility.
6. **`strcasecmp`**: used in `levelblit.c` — available in Emscripten libc, no change needed.
7. **Save file location**: v1.6 saves to `~/.meritous.sav`. In Emscripten, the virtual FS
   is in-memory and lost on page reload. Mount IDBFS at `/home` and call `FS.syncfs()` to persist.
8. **Music file licensing**: Tracker files (MOD/XM/S3M) are NOT GPL — removed from v1.6.
   v1.2 copy is usable for local dev. For public web deployment, use free/CC-licensed OGG
   replacements. `PlayBackgroundMusic()` auto-detects `.ogg` first — a seamless swap.
9. **i18n in Emscripten**: `libintl`/gettext may not be available. Either compile with
   `-DLOCALEDIR='""'` to disable locale loading, or link with `-liconv` if needed.
   The game is fully playable in English without translations.
