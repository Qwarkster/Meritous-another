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

    // Wire action buttons with BOTH pointer (desktop) AND touch (mobile) events.
    // SDL's touch handlers can block pointer synthesis on mobile — direct touch
    // events on our own elements are the reliable path.
    function wireBtn(btn) {
      var active = [];
      function press() {
        active = getKeys(btn);
        for (var i = 0; i < active.length; i++) MERITOUS_KEYS[active[i]] = 1;
      }
      function up() {
        for (var i = 0; i < active.length; i++) MERITOUS_KEYS[active[i]] = 0;
        active = [];
      }
      btn.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch(ex) {}
        press();
      });
      btn.addEventListener('pointerup',         up);
      btn.addEventListener('pointercancel',      up);
      btn.addEventListener('lostpointercapture', up);
      // Touch fallback for mobile
      btn.addEventListener('touchstart', function(e) { e.preventDefault(); press(); }, {passive: false});
      btn.addEventListener('touchend',    function(e) { e.preventDefault(); up();   }, {passive: false});
      btn.addEventListener('touchcancel', up, {passive: true});
    }

    document.querySelectorAll('[data-key],[data-keylist]').forEach(wireBtn);

    // Virtual joystick — touch events are PRIMARY on mobile; pointer events
    // handle desktop (mouse). jTouchId guards against double-firing.
    var jZone = document.getElementById('joystick-zone');
    if (jZone) {
      var jKnob = document.getElementById('joystick-knob');
      var jActive = false;
      var jCx = 0, jCy = 0;
      var jTouchId = -1;
      var jMaxR = 42;
      var jDead = 10;

      function jUpdate(px, py) {
        var dx = px - jCx, dy = py - jCy;
        var dist = Math.sqrt(dx*dx + dy*dy);
        var kx = dist > jMaxR ? dx/dist*jMaxR : dx;
        var ky = dist > jMaxR ? dy/dist*jMaxR : dy;
        jKnob.style.transform = 'translate(calc(-50% + '+kx+'px), calc(-50% + '+ky+'px))';
        jKnob.style.boxShadow = dist > jDead ? '0 0 20px #48ff, inset 0 0 8px rgba(140,180,255,0.5)' : '';
        var up=0, dn=0, lt=0, rt=0;
        if (dist > jDead) {
          var a = Math.atan2(dy, dx);
          var p = Math.PI;
          if      (a > -p/8  && a <=  p/8)  { rt=1; }
          else if (a >  p/8  && a <= 3*p/8) { rt=1; dn=1; }
          else if (a > 3*p/8 && a <= 5*p/8) { dn=1; }
          else if (a > 5*p/8 && a <= 7*p/8) { lt=1; dn=1; }
          else if (a >  7*p/8 || a <= -7*p/8) { lt=1; }
          else if (a > -7*p/8 && a <= -5*p/8) { lt=1; up=1; }
          else if (a > -5*p/8 && a <= -3*p/8) { up=1; }
          else                                 { rt=1; up=1; }
        }
        MERITOUS_KEYS.up=up; MERITOUS_KEYS.dn=dn;
        MERITOUS_KEYS.lt=lt; MERITOUS_KEYS.rt=rt;
      }

      function jRelease() {
        jActive = false; jTouchId = -1;
        jKnob.style.transform = 'translate(-50%, -50%)';
        jKnob.style.boxShadow = '';
        MERITOUS_KEYS.up=0; MERITOUS_KEYS.dn=0;
        MERITOUS_KEYS.lt=0; MERITOUS_KEYS.rt=0;
      }

      function jOrigin() {
        var r = jZone.getBoundingClientRect();
        jCx = r.left + r.width/2;
        jCy = r.top  + r.height/2;
      }

      // Touch events (mobile primary)
      jZone.addEventListener('touchstart', function(e) {
        e.preventDefault();
        if (jTouchId !== -1) return;
        var t = e.changedTouches[0];
        jTouchId = t.identifier; jActive = true;
        jOrigin(); jUpdate(t.clientX, t.clientY);
      }, {passive: false});

      jZone.addEventListener('touchmove', function(e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === jTouchId) {
            jUpdate(e.changedTouches[i].clientX, e.changedTouches[i].clientY); return;
          }
        }
      }, {passive: false});

      jZone.addEventListener('touchend', function(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === jTouchId) { jRelease(); return; }
        }
      }, {passive: false});
      jZone.addEventListener('touchcancel', jRelease, {passive: true});

      // Pointer events (desktop fallback, skipped when touch is active)
      jZone.addEventListener('pointerdown', function(e) {
        if (jTouchId !== -1) return;
        e.preventDefault(); jZone.setPointerCapture(e.pointerId);
        jActive = true; jOrigin(); jUpdate(e.clientX, e.clientY);
      });
      jZone.addEventListener('pointermove', function(e) {
        if (!jActive || jTouchId !== -1) return; jUpdate(e.clientX, e.clientY);
      });
      jZone.addEventListener('pointerup',         function(e) { if (jTouchId===-1) jRelease(); });
      jZone.addEventListener('pointercancel',      function(e) { if (jTouchId===-1) jRelease(); });
      jZone.addEventListener('lostpointercapture', function(e) { if (jTouchId===-1) jRelease(); });
    }
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
