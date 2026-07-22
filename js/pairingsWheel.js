/**
 * pairingsWheel.js
 * A continuous hue/saturation color wheel (angle = hue, radius =
 * saturation) for the Color Pairings feature. Visually similar to the
 * physical enamel color-wheel this feature is modeled on, but continuous
 * and precise instead of 12 fixed wedges, and draggable to explore live.
 *
 * Follows the same performance approach as colorMap.js:
 *  - The wheel gradient is computed once per resize (per-pixel HSV->RGB
 *    into an ImageData buffer), never redrawn on drag.
 *  - Pointer handlers report raw hue/sat immediately (data stays snappy);
 *    only marker *position* is smoothed via a shared rAF + lerp loop, so
 *    motion still reads as fluid even though the underlying value can
 *    jump every event.
 *  - Markers move via translate3d + will-change, never top/left.
 *  - DPR-scaled canvas, capped at 2x.
 */

const PairingsWheel = (() => {
  const DPR_CAP = 2;
  const LERP_FACTOR = 0.24;
  const SNAP_EPSILON = 0.15; // px

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    return { ctx: canvas.getContext("2d"), cssW, cssH };
  }

  /** Renders the full hue/saturation disc into the canvas's pixel buffer. */
  function drawWheel(ctx, pxW, pxH) {
    if (pxW <= 0 || pxH <= 0) return;
    const img = ctx.createImageData(pxW, pxH);
    const data = img.data;
    const cx = pxW / 2;
    const cy = pxH / 2;
    const R = Math.min(cx, cy);
    let i = 0;
    for (let y = 0; y < pxH; y++) {
      for (let x = 0; x < pxW; x++, i += 4) {
        const dx = x - cx + 0.5;
        const dy = y - cy + 0.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        const rFrac = r / R;
        if (rFrac > 1.03) {
          data[i + 3] = 0;
          continue;
        }
        let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        const s = Math.min(rFrac, 1) * 100;
        const rgb = ColorEngine.hsvToRgb({ h: angle, s, v: 100 });
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Hue (0-360) + saturation (0-100) -> a point in CSS-pixel space. 0deg = top, clockwise. */
  function hueToPoint(h, s, cx, cy, R) {
    const rad = (h * Math.PI) / 180;
    const rFrac = clamp01(s / 100);
    return {
      x: cx + R * rFrac * Math.sin(rad),
      y: cy - R * rFrac * Math.cos(rad),
    };
  }

  function create(root, opts) {
    opts = opts || {};
    const canvas = root.querySelector("[data-pairings-wheel-canvas]");
    const markersLayer = root.querySelector("[data-pairings-wheel-markers]");

    let geo = setupCanvas(canvas);
    drawWheel(geo.ctx, canvas.width, canvas.height);

    const state = {
      dragging: false,
      rafId: 0,
    };

    // id -> { el, dot, isBase, target:{x,y}, render:{x,y} }
    const markers = new Map();
    let lastColors = [];

    function centerAndRadius() {
      return { cx: geo.cssW / 2, cy: geo.cssH / 2, R: Math.min(geo.cssW, geo.cssH) / 2 };
    }

    function ensureMarkerEl(id) {
      let entry = markers.get(id);
      if (entry) return entry;
      const el = document.createElement("div");
      el.className = "pairings-wheel__marker";
      const dot = document.createElement("span");
      dot.className = "pairings-wheel__marker-dot";
      el.appendChild(dot);
      markersLayer.appendChild(el);
      entry = { el, dot, isBase: false, target: { x: 0, y: 0 }, render: { x: 0, y: 0 }, placed: false };
      markers.set(id, entry);
      return entry;
    }

    function removeStale(keepIds) {
      for (const [id, entry] of markers) {
        if (!keepIds.has(id)) {
          entry.el.remove();
          markers.delete(id);
        }
      }
    }

    function applyTransform(entry) {
      const scale = entry.isBase && state.dragging ? 1.25 : 1;
      entry.el.style.transform = `translate3d(${entry.render.x}px, ${entry.render.y}px, 0) translate(-50%, -50%) scale(${scale})`;
    }

    function tick() {
      let moving = false;
      for (const entry of markers.values()) {
        const dx = entry.target.x - entry.render.x;
        const dy = entry.target.y - entry.render.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > SNAP_EPSILON) {
          entry.render.x += dx * LERP_FACTOR;
          entry.render.y += dy * LERP_FACTOR;
          moving = true;
        } else {
          entry.render.x = entry.target.x;
          entry.render.y = entry.target.y;
        }
        applyTransform(entry);
      }
      if (moving || state.dragging) {
        state.rafId = requestAnimationFrame(tick);
      } else {
        state.rafId = 0;
      }
    }

    function ensureLoop() {
      if (!state.rafId) state.rafId = requestAnimationFrame(tick);
    }

    function pointerToHueSat(clientX, clientY) {
      const r = state.rect;
      const { cx, cy, R } = centerAndRadius();
      const dx = clientX - r.left - cx;
      const dy = clientY - r.top - cy;
      const dist = clamp01(Math.sqrt(dx * dx + dy * dy) / R);
      let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      return { h: angle, s: dist * 100 };
    }

    function pointerDown(e) {
      if (!opts.interactive) return;
      root.setPointerCapture(e.pointerId);
      state.rect = root.getBoundingClientRect();
      state.dragging = true;
      if (opts.onGrab) opts.onGrab();
      pointerMove(e);
      ensureLoop();
    }
    function pointerMove(e) {
      if (!state.dragging) return;
      const hs = pointerToHueSat(e.clientX, e.clientY);
      if (opts.onDrag) opts.onDrag(hs);
      ensureLoop();
    }
    function pointerUp(e) {
      if (!state.dragging) return;
      state.dragging = false;
      try {
        root.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (opts.onRelease) opts.onRelease();
      ensureLoop();
    }

    if (opts.interactive) {
      root.addEventListener("pointerdown", pointerDown);
      root.addEventListener("pointermove", pointerMove);
      root.addEventListener("pointerup", pointerUp);
      root.addEventListener("pointercancel", pointerUp);
    }

    function onResize() {
      geo = setupCanvas(canvas);
      drawWheel(geo.ctx, canvas.width, canvas.height);
      setColors(lastColors, { animate: false });
    }
    window.addEventListener("resize", onResize);

    /**
     * colors: array of { id, rgb, hue?, sat?, label? }. Index 0 is treated
     * as the draggable base and gets the emphasized marker style. hue/sat
     * are optional overrides (monochromatic variants pass the shared
     * base hue/sat explicitly, since deriving it from their own rgb would
     * still be correct but this keeps the intent obvious at the call site).
     */
    function setColors(colors, { animate = true } = {}) {
      lastColors = colors;
      const { cx, cy, R } = centerAndRadius();
      const keep = new Set();
      colors.forEach((c, idx) => {
        const id = c.id || `m${idx}`;
        keep.add(id);
        const entry = ensureMarkerEl(id);
        entry.isBase = idx === 0;
        entry.el.classList.toggle("pairings-wheel__marker--base", entry.isBase);
        entry.el.title = c.label || "";
        entry.dot.style.background = `rgb(${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b})`;

        const hsv = ColorEngine.rgbToHsv(c.rgb);
        const h = c.hue !== undefined ? c.hue : hsv.h;
        const s = c.sat !== undefined ? c.sat : hsv.s;
        const pt = hueToPoint(h, s, cx, cy, R);
        entry.target.x = pt.x;
        entry.target.y = pt.y;
        if (!animate || !entry.placed) {
          entry.render.x = pt.x;
          entry.render.y = pt.y;
          applyTransform(entry);
          entry.placed = true;
        }
      });
      removeStale(keep);
      ensureLoop();
    }

    /** Re-measures and redraws — call once the wheel's view becomes visible. */
    function refreshLayout() {
      onResize();
    }

    function destroy() {
      window.removeEventListener("resize", onResize);
      if (state.rafId) cancelAnimationFrame(state.rafId);
    }

    return { setColors, refreshLayout, destroy };
  }

  return { create };
})();
