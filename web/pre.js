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

  // DOMContentLoaded may have already fired since index.js loads at end of body.
  // Use readyState check so setup runs immediately if DOM is ready.
  function mkDOMSetup() {
    var canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
      canvas.addEventListener('click', function() { canvas.focus(); });
    }

    // Touch input via document-level capture listeners.
    // Using capture phase ensures we get the event before any SDL handlers.
    // Using coordinate hit-test avoids issues with pointer capture / delegation.
    function touchKey(e, val) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        // Walk up to find data-key in case touch is on a child span
        while (el && !el.dataset.key && el !== document.body) el = el.parentElement;
        if (el && el.dataset && el.dataset.key && MERITOUS_KEYS.hasOwnProperty(el.dataset.key)) {
          MERITOUS_KEYS[el.dataset.key] = val;
          if (val) e.preventDefault();
        }
      }
    }
    document.addEventListener('touchstart',  function(e) { touchKey(e, 1); }, { capture: true, passive: false });
    document.addEventListener('touchend',    function(e) { touchKey(e, 0); }, { capture: true, passive: false });
    document.addEventListener('touchcancel', function(e) { touchKey(e, 0); }, { capture: true, passive: true  });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mkDOMSetup);
  } else {
    mkDOMSetup();
  }
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
