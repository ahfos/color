/**
 * colorMap.js
 * The HSV picker: a 2D saturation/value square + a 1D hue slider.
 * Shared by both game modes (display + click/drag input).
 *
 * Performance approach (see build brief "Smoothness & fluidity requirements"):
 *  1. Layer separation — gradients are canvas-rendered once; the SV square
 *     canvas only redraws when hue changes, never on every SV-drag frame.
 *     The hue strip canvas is rendered exactly once, ever.
 *  2. Decoupled input/render — pointer events only record a target position;
 *     a single rAF loop lerps the on-screen marker toward that target.
 *  3. Unified Pointer Events with setPointerCapture for uniform mouse/touch/
 *     trackpad handling, including drags that leave the element bounds.
 *  4. GPU-friendly transforms — markers move via translate3d + will-change,
 *     never top/left.
 *  5. No layout thrashing — bounding rects are cached once per drag, never
 *     read inside the move handler.
 *  6. DPR-scaled canvases, capped at 2x.
 *  7. Cheap render-loop math; callers throttle anything expensive (e.g.
 *     perceptual distance) via onChange themselves.
 *  8. Allocation-free-as-practical hot path — the lerp step reuses plain
 *     numbers on the instance, no per-frame object/array creation.
 */

const ColorMap = (() => {
  const LERP_FACTOR = 0.27;
  const SNAP_EPSILON = 0.0015; // fraction of track; below this we snap & stop the loop
  const DPR_CAP = 2;

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function drawSVSquare(canvas, ctx, cssW, cssH, hue) {
    const hueRgb = ColorEngine.hsvToRgb({ h: hue, s: 100, v: 100 });
    const hueColor = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;

    ctx.clearRect(0, 0, cssW, cssH);

    // Saturation axis: white (left) -> hue at full saturation (right).
    const satGrad = ctx.createLinearGradient(0, 0, cssW, 0);
    satGrad.addColorStop(0, "#ffffff");
    satGrad.addColorStop(1, hueColor);
    ctx.fillStyle = satGrad;
    ctx.fillRect(0, 0, cssW, cssH);

    // Value axis: transparent (top) -> black (bottom), multiplied over the above.
    const valGrad = ctx.createLinearGradient(0, 0, 0, cssH);
    valGrad.addColorStop(0, "rgba(0,0,0,0)");
    valGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = valGrad;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawHueStrip(ctx, cssW, cssH) {
    ctx.clearRect(0, 0, cssW, cssH);
    const grad = ctx.createLinearGradient(0, 0, cssW, 0);
    const stops = 12;
    for (let i = 0; i <= stops; i++) {
      const h = (360 * i) / stops;
      const { r, g, b } = ColorEngine.hsvToRgb({ h, s: 100, v: 100 });
      grad.addColorStop(i / stops, `rgb(${r},${g},${b})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, cssW, cssH };
  }

  function create(root, opts) {
    opts = opts || {};
    const svEl = root.querySelector("[data-map-sv]");
    const svCanvas = root.querySelector("[data-map-sv-canvas]");
    const svMarker = root.querySelector("[data-map-sv-marker]");
    const hueEl = root.querySelector("[data-map-hue]");
    const hueCanvas = root.querySelector("[data-map-hue-canvas]");
    const hueMarker = root.querySelector("[data-map-hue-marker]");
    const svGhost = root.querySelector("[data-map-sv-ghost]");
    const hueGhost = root.querySelector("[data-map-hue-ghost]");

    let svCtx = setupCanvas(svCanvas);
    let hueCtx = setupCanvas(hueCanvas);
    drawHueStrip(hueCtx.ctx, hueCtx.cssW, hueCtx.cssH);

    // Current model state (0..1 fractions), plus rendered (lerped) fractions.
    const state = {
      s: 1,
      v: 1,
      h: 0,
      // targets pointer input writes to
      targetS: 1,
      targetV: 1,
      targetHFrac: 0,
      // rendered/lerped positions
      renderS: 1,
      renderV: 1,
      renderHFrac: 0,
      lastDrawnHue: -1,
      svDragging: false,
      hueDragging: false,
      rafId: 0,
      svRect: null,
      hueRect: null,
      interactive: opts.interactive !== false,
    };

    function hueToFrac(h) {
      return ((h % 360) + 360) % 360 / 360;
    }
    function fracToHue(f) {
      return clamp01(f) * 360;
    }

    function currentHSV() {
      return { h: state.h, s: state.s * 100, v: state.v * 100 };
    }

    function applyMarkerTransform(el, xFrac, yFrac, w, h, dragging) {
      const x = xFrac * w;
      const y = yFrac === undefined ? h / 2 : yFrac * h;
      const scale = dragging ? 1.28 : 1;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
    }

    function redrawSVIfNeeded() {
      if (state.lastDrawnHue !== state.h) {
        drawSVSquare(svCanvas, svCtx.ctx, svCtx.cssW, svCtx.cssH, state.h);
        state.lastDrawnHue = state.h;
      }
    }

    function tick() {
      let moving = false;

      const ds = state.targetS - state.renderS;
      const dv = state.targetV - state.renderV;
      const dh = state.targetHFrac - state.renderHFrac;

      if (Math.abs(ds) > SNAP_EPSILON || state.svDragging) {
        state.renderS += ds * LERP_FACTOR;
        moving = moving || Math.abs(ds) > SNAP_EPSILON;
      } else {
        state.renderS = state.targetS;
      }
      if (Math.abs(dv) > SNAP_EPSILON || state.svDragging) {
        state.renderV += dv * LERP_FACTOR;
        moving = moving || Math.abs(dv) > SNAP_EPSILON;
      } else {
        state.renderV = state.targetV;
      }
      if (Math.abs(dh) > SNAP_EPSILON || state.hueDragging) {
        state.renderHFrac += dh * LERP_FACTOR;
        moving = moving || Math.abs(dh) > SNAP_EPSILON;
      } else {
        state.renderHFrac = state.targetHFrac;
      }

      state.h = fracToHue(state.renderHFrac);
      state.s = clamp01(state.renderS);
      state.v = clamp01(state.renderV);

      redrawSVIfNeeded();
      applyMarkerTransform(svMarker, state.renderS, 1 - state.renderV, svCtx.cssW, svCtx.cssH, state.svDragging);
      applyMarkerTransform(hueMarker, state.renderHFrac, undefined, hueCtx.cssW, hueCtx.cssH, state.hueDragging);

      if (opts.onChange) opts.onChange(currentHSV());

      if (moving || state.svDragging || state.hueDragging) {
        state.rafId = requestAnimationFrame(tick);
      } else {
        state.rafId = 0;
      }
    }

    function ensureLoop() {
      if (!state.rafId) state.rafId = requestAnimationFrame(tick);
    }

    // ---- pointer handling: record targets only, never touch layout here ----

    function svPointerDown(e) {
      if (!state.interactive) return;
      svEl.setPointerCapture(e.pointerId);
      state.svRect = svEl.getBoundingClientRect();
      state.svDragging = true;
      if (opts.onGrab) opts.onGrab();
      svPointerMove(e);
      ensureLoop();
    }
    function svPointerMove(e) {
      if (!state.svDragging || !state.svRect) return;
      const r = state.svRect;
      const x = clamp01((e.clientX - r.left) / r.width);
      const y = clamp01((e.clientY - r.top) / r.height);
      state.targetS = x;
      state.targetV = 1 - y;
      ensureLoop();
    }
    function svPointerUp(e) {
      if (!state.svDragging) return;
      state.svDragging = false;
      try {
        svEl.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (opts.onRelease) opts.onRelease();
      ensureLoop();
    }

    function huePointerDown(e) {
      if (!state.interactive) return;
      hueEl.setPointerCapture(e.pointerId);
      state.hueRect = hueEl.getBoundingClientRect();
      state.hueDragging = true;
      if (opts.onGrab) opts.onGrab();
      huePointerMove(e);
      ensureLoop();
    }
    function huePointerMove(e) {
      if (!state.hueDragging || !state.hueRect) return;
      const r = state.hueRect;
      const x = clamp01((e.clientX - r.left) / r.width);
      state.targetHFrac = x;
      ensureLoop();
    }
    function huePointerUp(e) {
      if (!state.hueDragging) return;
      state.hueDragging = false;
      try {
        hueEl.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (opts.onRelease) opts.onRelease();
      ensureLoop();
    }

    if (state.interactive) {
      svEl.addEventListener("pointerdown", svPointerDown);
      svEl.addEventListener("pointermove", svPointerMove);
      svEl.addEventListener("pointerup", svPointerUp);
      svEl.addEventListener("pointercancel", svPointerUp);

      hueEl.addEventListener("pointerdown", huePointerDown);
      hueEl.addEventListener("pointermove", huePointerMove);
      hueEl.addEventListener("pointerup", huePointerUp);
      hueEl.addEventListener("pointercancel", huePointerUp);
    } else {
      svEl.classList.add("color-map__pane--static");
      hueEl.classList.add("color-map__pane--static");
    }

    function onResize() {
      svCtx = setupCanvas(svCanvas);
      hueCtx = setupCanvas(hueCanvas);
      state.lastDrawnHue = -1; // force SV redraw at new resolution
      drawHueStrip(hueCtx.ctx, hueCtx.cssW, hueCtx.cssH);
      ensureLoop();
    }
    window.addEventListener("resize", onResize);

    // ---- public API ----

    /** Sets the marker position from an HSV object. animate=false snaps instantly (e.g. new round). */
    function setHSV(hsv, { animate = true } = {}) {
      const hFrac = hueToFrac(hsv.h);
      const s = clamp01(hsv.s / 100);
      const v = clamp01(hsv.v / 100);
      state.targetHFrac = hFrac;
      state.targetS = s;
      state.targetV = v;
      if (!animate) {
        state.renderHFrac = hFrac;
        state.renderS = s;
        state.renderV = v;
        state.h = hsv.h;
        state.s = s;
        state.v = v;
        redrawSVIfNeeded();
        applyMarkerTransform(svMarker, s, 1 - v, svCtx.cssW, svCtx.cssH, false);
        applyMarkerTransform(hueMarker, hFrac, undefined, hueCtx.cssW, hueCtx.cssH, false);
      }
      ensureLoop();
    }

    function getHSV() {
      return currentHSV();
    }

    /** Shows a static "ghost" marker (e.g. the actual target position on reveal). */
    function showGhostHSV(hsv) {
      if (!svGhost || !hueGhost) return;
      const hFrac = hueToFrac(hsv.h);
      const s = clamp01(hsv.s / 100);
      const v = clamp01(hsv.v / 100);
      applyMarkerTransform(svGhost, s, 1 - v, svCtx.cssW, svCtx.cssH, false);
      applyMarkerTransform(hueGhost, hFrac, undefined, hueCtx.cssW, hueCtx.cssH, false);
      svGhost.hidden = false;
      hueGhost.hidden = false;
    }

    function hideGhost() {
      if (svGhost) svGhost.hidden = true;
      if (hueGhost) hueGhost.hidden = true;
    }

    function setInteractive(flag) {
      state.interactive = flag;
      root.classList.toggle("color-map--locked", !flag);
    }

    /**
     * Forcibly ends any in-progress drag without moving the marker.
     * Pointer Events use setPointerCapture(), which keeps delivering
     * move/up events to the element that grabbed the pointer regardless of
     * what's visually on top of it afterwards (e.g. a results modal that
     * opens mid-drag because a round just auto-completed). Flipping these
     * flags makes the move handlers no-op immediately, so a modal opening
     * mid-drag can't keep silently steering the marker underneath it.
     */
    function cancelInteraction() {
      state.svDragging = false;
      state.hueDragging = false;
    }

    function destroy() {
      window.removeEventListener("resize", onResize);
      if (state.rafId) cancelAnimationFrame(state.rafId);
    }

    // Initial paint
    setHSV(opts.initialHSV || { h: 0, s: 100, v: 100 }, { animate: false });

    return { setHSV, getHSV, setInteractive, showGhostHSV, hideGhost, cancelInteraction, destroy };
  }

  return { create };
})();
