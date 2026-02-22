# Meritous Web Port — Project Retrospective

**Project:** Port Meritous (C/SDL1 roguelike, 2007) to WebAssembly  
**Result:** Fully playable at https://meritous.web.app  
**Stack:** C → Emscripten → WASM → Firebase Hosting + GitHub Actions CI/CD

---

## What Was Done

### The Game
Meritous is a GPL-licensed dungeon crawler written in C by Lancer-X/ASCEAI around 2007–2008.
It uses SDL 1.2 for display, input, and audio; SDL_image for PNG loading; SDL_mixer for music
and sound effects. The display pipeline is unusual: the game runs in 8-bit indexed colour mode
(`SDL_HWPALETTE`), with animated palette effects driving the title screen and atmospheric
lighting. The source is ~10,000 lines across 11 C files.

### Approach Chosen: Emscripten with ASYNCIFY
Rather than rewriting the game in JavaScript or porting to a web-native framework, we compiled
the original C source directly to WebAssembly using Emscripten. This preserved all game logic
exactly and minimised the risk of introducing bugs.

The critical enabler was **ASYNCIFY**: Meritous uses a traditional blocking `while` loop with
`SDL_Delay()` calls nested several layers deep. Browsers cannot block the main thread, but
ASYNCIFY transforms the compiled WASM at the binary level to suspend and resume execution
transparently — no refactoring of the game loop required.

### Phases Completed

| Phase | What Happened |
|---|---|
| Source selection | Compared v1.2 (original) and v1.6 (Debian-maintained fork); chose v1.6 for `DATADIR` macro, generic music system, and bugfixes |
| Native build | Verified `make pkgdatadir=dat` produced a working binary; established a known-good baseline before touching anything |
| WASM compilation | Created `web/Makefile.emscripten`; fixed compile errors; got a binary that loaded |
| Rendering pipeline | Rebuilt the entire SDL surface → canvas pipeline in C + JS to handle 8-bit indexed colour |
| Input | Bypassed Emscripten's broken keyboard handling under ASYNCIFY with a custom JS key tracker |
| Weapon animation | Fixed PSI circuit rendering after discovering `SDL_FillRect` and `putImageData` were overwriting each other |
| Transparency | Worked around `SDL_SetColorKey` being a no-op in Emscripten with a JS colorkey map |
| Stack overflow | Tuned ASYNCIFY and WASM stack sizes to survive deep save-game call stacks |
| Shell | Built a custom retro arcade HTML template replacing Emscripten's default output |
| Deployment | Firebase Hosting with COOP/COEP headers; Workload Identity Federation for keyless CI/CD |

---

## What Was Learned — Particularly from Failures

### 1. Emscripten's SDL1-compat is a thin shim, not a full port
**Lesson:** Many SDL1 functions that appear to work are actually no-ops or silent approximations.
We discovered this for `SDL_SetColorKey` (ignored — transparency broke), `SDL_Delay` (doesn't
yield to browser — game froze), and `SDL_UpdateRect` (no-op — renders were lost). The rule:
*never assume an SDL call does what the documentation says inside Emscripten*. Verify every
call against `library_sdl.js` in the Emscripten source.

### 2. `SDL_Delay` does not yield to the browser under ASYNCIFY
**Lesson:** Emscripten's `SDL_Delay` implementation uses `safeSetTimeout`, which schedules a
callback but does not suspend the WASM execution context. Under ASYNCIFY, only `emscripten_sleep()`
actually suspends. We burned significant time on a completely frozen game before tracing this.
**Fix:** Replace all `SDL_Delay` calls with `emscripten_sleep()` inside `#ifdef __EMSCRIPTEN__` guards.

### 3. `SDL_GetTicks()` overflows and causes absurd sleep durations
**Lesson:** `SDL_GetTicks()` in Emscripten returns `(Date.now() - SDL.startTime) | 0`. If
`SDL.startTime` is unset, this overflows a 32-bit int, producing a tick delta of billions.
The game's frame-timing code then called `SDL_Delay(2,000,000,000ms)` — effectively an infinite
sleep. This was extremely difficult to diagnose because the game appeared to load and then
simply freeze with no error.

### 4. Keyboard events are silently dropped under ASYNCIFY
**Lesson:** Emscripten registers keyboard event listeners during `SDL_Init`, but while ASYNCIFY
has suspended the main loop, those listeners accumulate events in `SDL.events`. However,
`SDL_PollEvent` processes the queue synchronously — if the game is mid-`emscripten_sleep`, it
never gets back to `SDL_PollEvent`. The fix required bypassing SDL's event queue entirely:
a capture-phase `keydown`/`keyup` listener in `pre.js` that writes directly to a JS object
(`MERITOUS_KEYS`), read back into C via `EM_ASM_INT`. This pattern — maintaining a parallel
JS input state that C polls — is probably the right approach for any ASYNCIFY game port.

### 5. The 8-bit palette pipeline requires a fully custom rendering path
**Lesson:** Emscripten SDL1-compat internally uses a 32-bit canvas. When the game creates
an 8-bit surface with `SDL_HWPALETTE`, the library does create an indexed buffer, but the
bridge between that buffer and the canvas is fragile. `SDL_FillRect` on the screen surface
writes directly to the canvas 2D context; `VideoUpdate` (our `putImageData`) then **overwrites
the entire canvas** on each frame — silently erasing anything drawn via `SDL_FillRect`.
We had to implement `em_fill_rect()` (writes to `screen->pixels` in WASM memory) and
`em_indexed_blit()` (pure C pixel copy respecting colorkey) so that *all* pixel writes go
through the same WASM buffer, which `putImageData` then flushes atomically. The canonical
lesson: **pick one path to the canvas and use it exclusively**.

### 6. ASYNCIFY stack size needs careful tuning
**Lesson:** The game crashed with a stack overflow at save points. The root cause: ASYNCIFY
instruments every suspendable function to save and restore its entire stack frame. Deep call
stacks (main loop → save game → file I/O, with `precalc_sine[400]` on the stack) exceeded the
default ASYNCIFY stack budget. The fix was `ASYNCIFY_STACK_SIZE=524288` (512KB) and
`STACK_SIZE=524288` for the WASM linear stack. For any game with deeply nested loops or large
stack-allocated arrays, budget these generously from the start.

### 7. PNG images are decoded as RGBA even for greyscale originals
**Lesson:** All game art is 8-bit greyscale PNG. The browser always decodes PNG as RGBA.
When Emscripten's `IMG_Load` loads a greyscale PNG, the result is RGBA with R=G=B=grey value,
A=255. We exploited this: the R channel directly encodes the original palette index. Our
`em_img_load()` extracts the R channel into a 1-byte-per-pixel buffer, recovering the exact
palette indices. This is an accident of the original art format — a project with RGBA art
would need a different extraction strategy or a precomputed palette mapping.

### 8. Firebase Hosting requires Hosting to be explicitly activated on a GCP project
**Lesson:** Creating a GCP project does not automatically create a Firebase Hosting site.
Even enabling the `firebasehosting.googleapis.com` API via `gcloud` isn't sufficient — the
Firebase project association must be created through the Firebase Console UI. The CLI command
`firebase projects:addfirebase` failed with 403 despite the user being the project owner.
Always initialise Firebase through https://console.firebase.google.com before running CLI deploys.

### 9. Service account key creation may be blocked by org policy
**Lesson:** `gcloud iam service-accounts keys create` failed due to an org policy constraint
(`constraints/iam.disableServiceAccountKeyCreation`). This forced us to use **Workload
Identity Federation** for CI/CD authentication — which is actually the better approach anyway
(no long-lived credentials stored as GitHub secrets). For any new GCP project, plan for WIF
from the start rather than treating it as a fallback.

---

## What We Would Do Differently on a Larger Project

### Architecture

**Pre-audit Emscripten compatibility before committing to it.**  
For a 10,000-line game, we could afford to discover ASYNCIFY limitations mid-project. For a
100,000-line game, prototype the game loop and input model in isolation first — a tiny test
program that does `SDL_Delay` and `SDL_PollEvent` in a loop — before porting the full codebase.

**Consider SDL2 migration before porting.**  
The SDL1 Emscripten shim's no-op behaviour caused most of our major issues. SDL2 has a
proper Emscripten port maintained by the Emscripten team, with correct event handling and
a well-tested canvas pipeline. The SDL1→SDL2 migration for this game would have been ~200
line changes; the debugging time we spent on SDL1 shim bugs was far greater.

**Plan the rendering pipeline on day one.**  
The core decision — "all pixel writes must go through one path" — should be made before
writing a single line of Emscripten-specific code. Draw the data flow diagram:
WASM buffer → `putImageData` → canvas. Make it a hard rule that no code writes to the canvas
any other way.

### Development Process

**Add `EMSCRIPTEN_KEEPALIVE` and debug symbols from the start.**  
We lost time to obscure crashes that would have been clearer with `-g3` debug symbols and
source maps. Build a debug target into the Makefile from day one:
```makefile
debug: EXTRA_FLAGS = -g3 -s ASSERTIONS=2 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=2
debug: $(OUTDIR)/index.html
```

**Use `EM_ASM` console logging liberally during development.**  
The most productive debugging period was when we added `console.log` at every stage of the
rendering pipeline. For a larger project, wrap this in a compile-time debug flag and leave
the instrumentation in place.

**Test save/load and edge cases (boss fights, endings) before declaring victory.**  
The stack overflow on save points appeared only when a specific game mechanic was triggered.
For a larger game, write a checklist of every major state transition and test each one before
shipping.

### Infrastructure

**Output `index.html` from the Makefile from day one.**  
We initially output `meritous.html`, which required a redirect shim when deploying to Firebase.
Emscripten doesn't care what you call the output file — just use `index.html`.

**Set up CI/CD in Phase 2, not Phase 7.**  
The deployment pipeline (Workload Identity Federation, Firebase init, workflow YAML) took
non-trivial effort. For a larger project with multiple contributors, having CI from the start
means every experimental build is automatically deployed to a preview channel, not just the
developer's local machine.

**Cache the emsdk installation in CI.**  
The GitHub Actions workflow reinstalls the full Emscripten SDK (~1GB) on every run. For
frequent commits this is wasteful. Add an `actions/cache` step keyed on the emsdk version:
```yaml
- uses: actions/cache@v4
  with:
    path: ~/emsdk
    key: emsdk-${{ env.EMSDK_VERSION }}
```

**Add IDBFS save persistence.**  
Currently game progress is lost on page reload. The fix is straightforward — mount an IDBFS
at `/home` in `pre.js` and call `FS.syncfs()` after save writes — but it wasn't prioritised.
For any game with meaningful save state, this should be considered a launch requirement.

### For a Much Larger C/C++ Project

- **Modularise compilation.** Large projects benefit from compiling translation units to `.o`
  (Emscripten's LLVM bitcode) and linking once, rather than compiling all source files in a
  single `emcc` invocation. This makes incremental rebuilds fast.
- **Audit third-party libraries early.** Emscripten has ports for common libraries (SDL2,
  zlib, libpng, etc.) but not everything. Any dependency that uses threading, signals, or
  raw system calls will need attention.
- **Consider Cheerp or wasm-pack for mixed C++/JS projects.** Emscripten is the right tool
  for game ports, but for applications with rich JS interop, other toolchains may offer a
  cleaner interface.
- **Memory budget carefully.** `ALLOW_MEMORY_GROWTH=1` is convenient but comes with
  performance cost on some browsers. Profile actual peak memory use and set
  `INITIAL_MEMORY` to cover it without growth if possible.

---

## Key Files Reference

| File | Role |
|---|---|
| `web/Makefile.emscripten` | Build recipe — all Emscripten flags documented here |
| `web/shell.html` | Custom HTML template — game presentation layer |
| `web/pre.js` | JS injected before WASM — key tracker, colorkey map, canvas focus |
| `anotherversion/meritous-master/src/levelblit.c` | Main game file — all Emscripten rendering/input adaptations |
| `anotherversion/meritous-master/src/levelblit.h` | Emscripten compat macros shared across all source files |
| `firebase.json` | Hosting config — WASM MIME type, COOP/COEP headers |
| `.github/workflows/deploy.yml` | CI/CD — build + deploy on push to master/main |
