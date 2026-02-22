// Key state tracker — bypasses SDL's broken keyboard listener in ASYNCIFY mode.
// SDL.receiveEvent is not called for keyboard events when ASYNCIFY suspends the
// main loop. We track key state directly in JS and read it from C via EM_ASM_INT.
var MERITOUS_KEYS = {up:0, dn:0, lt:0, rt:0, sp:0, enter:0, esc:0, tab:0, h:0, p:0};
if (typeof document !== 'undefined') {
  function mk_keydown(e) {
    var c = e.code;
    if (c==='ArrowUp'   ||c==='KeyW') MERITOUS_KEYS.up=1;
    if (c==='ArrowDown' ||c==='KeyS') MERITOUS_KEYS.dn=1;
    if (c==='ArrowLeft' ||c==='KeyA') MERITOUS_KEYS.lt=1;
    if (c==='ArrowRight'||c==='KeyD') MERITOUS_KEYS.rt=1;
    if (c==='Space')   MERITOUS_KEYS.sp=1;
    if (c==='Enter') { MERITOUS_KEYS.enter=1; }
    if (c==='Escape')  MERITOUS_KEYS.esc=1;
    if (c==='Tab')   { MERITOUS_KEYS.tab=1; e.preventDefault(); }
    if (c==='KeyH')    MERITOUS_KEYS.h=1;
    if (c==='KeyP')    MERITOUS_KEYS.p=1;
  }
  function mk_keyup(e) {
    var c = e.code;
    if (c==='ArrowUp'   ||c==='KeyW') MERITOUS_KEYS.up=0;
    if (c==='ArrowDown' ||c==='KeyS') MERITOUS_KEYS.dn=0;
    if (c==='ArrowLeft' ||c==='KeyA') MERITOUS_KEYS.lt=0;
    if (c==='ArrowRight'||c==='KeyD') MERITOUS_KEYS.rt=0;
    if (c==='Space')   MERITOUS_KEYS.sp=0;
    if (c==='Enter')   MERITOUS_KEYS.enter=0;
    if (c==='Escape')  MERITOUS_KEYS.esc=0;
    if (c==='Tab')     MERITOUS_KEYS.tab=0;
    if (c==='KeyH')    MERITOUS_KEYS.h=0;
    if (c==='KeyP')    MERITOUS_KEYS.p=0;
  }
  document.addEventListener('keydown', mk_keydown, true);
  document.addEventListener('keyup',   mk_keyup,   true);

  document.addEventListener('DOMContentLoaded', function() {
    var canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
      canvas.addEventListener('click', function() { canvas.focus(); });
    }

    // Touch overlay — wire buttons to MERITOUS_KEYS via pointer events
    // Uses pointer capture so each button tracks its own touch independently (multi-touch).
    var TOUCH_KEY_MAP = {
      'up':'up', 'dn':'dn', 'lt':'lt', 'rt':'rt',
      'sp':'sp', 'enter':'enter', 'tab':'tab', 'esc':'esc'
    };
    document.querySelectorAll('[data-key]').forEach(function(btn) {
      var key = btn.dataset.key;
      if (!TOUCH_KEY_MAP[key]) return;
      btn.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        MERITOUS_KEYS[key] = 1;
      });
      btn.addEventListener('pointerup',     function(e) { MERITOUS_KEYS[key] = 0; });
      btn.addEventListener('pointercancel', function(e) { MERITOUS_KEYS[key] = 0; });
    });

    // Auto-show touch overlay on touch-capable devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      var overlay = document.getElementById('touch-overlay');
      if (overlay) overlay.style.display = 'flex';
      var toggleBtn = document.getElementById('gamepad-toggle');
      if (toggleBtn) toggleBtn.textContent = '🎮 HIDE PAD';
    }
  });
}

// ColorKey map for em_indexed_blit (SDL_SetColorKey is a no-op in Emscripten)
var MERITOUS_COLORKEYS = {};  // surf_ptr -> colorKey value (0..255) or undefined

// IDBFS persistent save — mount before main() starts so the save file survives page reloads.
Module.preRun = Module.preRun || [];
Module.preRun.push(function() {
  ENV.HOME = '/home/web_user';
  try { FS.mkdir('/home'); } catch(e) {}
  try { FS.mkdir('/home/web_user'); } catch(e) {}
  FS.mount(IDBFS, {}, '/home/web_user');
  addRunDependency('idbfs-sync');
  FS.syncfs(true, function(err) {
    if (err) console.warn('IDBFS initial load:', err);
    removeRunDependency('idbfs-sync');
  });
});
