/**
 * bentoExport.js
 * Renders the current Pairings palette (base + harmony colors, every code
 * format) to an off-screen canvas and downloads it as a PNG — the same
 * "draw it ourselves, no DOM screenshot library" approach as wallpaper.js,
 * so the export never depends on how the live bento grid happens to have
 * wrapped in the browser.
 *
 * Every card is drawn at the same fixed size, in both the flat single-
 * harmony export and every group of the "All" export — no big-featured/
 * small-secondary split.
 */

const BentoExport = (() => {
  const SCALE = 2; // supersample for a crisp download regardless of screen DPR
  // Mobile browsers (iOS Safari in particular) cap a canvas's pixel area
  // and per-dimension size well below desktop — a tall "All" export at a
  // flat 2x scale can exceed that ceiling and silently fail to encode.
  // Clamp the effective scale so neither dimension crosses this, instead
  // of always supersampling at a fixed factor.
  const MAX_CANVAS_DIM = 4000;
  const W = 1400;
  const PAD = 56;
  const GAP = 24;
  const CARD_W = 260;
  const SWATCH_H = 160;
  const TEXT_H = 190;
  const CARD_H = SWATCH_H + TEXT_H;
  const CONTENT_W = W - PAD * 2;
  const MAX_COLS = Math.max(1, Math.floor((CONTENT_W + GAP) / (CARD_W + GAP)));

  const FONT = '"Helvetica Neue", Arial, sans-serif';
  const FG = "#000000";
  const MUTED = "#888888";
  const BORDER = "#e5e5e5";
  const ACCENT = "#c41e24";

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  // Kick this off the moment the module loads rather than when the user
  // clicks Export. A fresh fetch+decode started *after* the click can run
  // long enough that iOS Safari treats the tap's transient user-activation
  // as expired by the time we get to canvas.toBlob()/the download — the
  // export then silently no-ops. Warming the cache means the await below
  // usually resolves on an already-settled promise instead.
  let logoPromise = null;
  function getLogo() {
    if (!logoPromise) logoPromise = loadImage("assets/logo.svg").catch(() => null);
    return logoPromise;
  }
  getLogo();

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function capsText(ctx, text, x, y, { size, weight = 600, color = FG, spacing = 0.04, align = "left" } = {}) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    const upper = String(text).toUpperCase();
    try {
      ctx.letterSpacing = `${Math.round(size * spacing)}px`;
    } catch {
      /* older browsers without Canvas letterSpacing */
    }
    ctx.fillText(upper, x, y);
    try {
      ctx.letterSpacing = "0px";
    } catch {
      /* noop */
    }
  }

  function bestTextColor(rgb) {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const cw = ColorEngine.contrastRatio(rgb, white);
    const cb = ColorEngine.contrastRatio(rgb, black);
    return cw >= cb ? "#ffffff" : "#000000";
  }

  /** One fixed-size card: square-ish swatch on top, code details below. */
  function drawCard(ctx, entry, x, y) {
    roundRect(ctx, x, y, CARD_W, CARD_H, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, CARD_W, CARD_H, 18);
    ctx.clip();

    ctx.fillStyle = `rgb(${entry.rgb.r}, ${entry.rgb.g}, ${entry.rgb.b})`;
    ctx.fillRect(x, y, CARD_W, SWATCH_H);

    const onSwatch = bestTextColor(entry.rgb);
    capsText(ctx, entry.label, x + 20, y + SWATCH_H - 18, { size: 17, weight: 700, color: onSwatch, spacing: 0.06 });

    ctx.restore();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1, 18);
    ctx.stroke();

    let ty = y + SWATCH_H + 30;
    const tx = x + 20;
    capsText(ctx, entry.name || "", tx, ty, { size: 18, weight: 700, color: FG, spacing: 0.02 });
    ty += 25;
    capsText(ctx, `#${entry.hex}`, tx, ty, { size: 13, weight: 600, color: ACCENT, spacing: 0.04 });
    ty += 20;
    capsText(ctx, `RGB ${entry.rgb.r} ${entry.rgb.g} ${entry.rgb.b}`, tx, ty, { size: 12, weight: 500, color: MUTED, spacing: 0.03 });
    ty += 18;
    capsText(ctx, `CMYK ${entry.cmyk.c} ${entry.cmyk.m} ${entry.cmyk.y} ${entry.cmyk.k}`, tx, ty, { size: 12, weight: 500, color: MUTED, spacing: 0.03 });
    ty += 18;
    capsText(ctx, `HSL ${Math.round(entry.hsl.h)} ${Math.round(entry.hsl.s)}% ${Math.round(entry.hsl.l)}%`, tx, ty, { size: 12, weight: 500, color: MUTED, spacing: 0.03 });
    ty += 22;
    capsText(ctx, `Text: white ${entry.contrastWhite.tier} · black ${entry.contrastBlack.tier}`, tx, ty, { size: 10.5, weight: 500, color: MUTED, spacing: 0.01 });
  }

  /** Lays out `entries` as a fixed-size, centered-per-row grid. Returns height consumed. */
  function layoutGrid(ctx, entries, x0, y0, contentW) {
    let cy = y0;
    for (let i = 0; i < entries.length; i += MAX_COLS) {
      const row = entries.slice(i, i + MAX_COLS);
      const rowW = row.length * CARD_W + (row.length - 1) * GAP;
      let cx = x0 + (contentW - rowW) / 2;
      row.forEach((entry) => {
        drawCard(ctx, entry, cx, cy);
        cx += CARD_W + GAP;
      });
      cy += CARD_H + GAP;
    }
    return cy - y0 - (entries.length ? GAP : 0);
  }

  function measureGridHeight(count) {
    if (count <= 0) return 0;
    const rows = Math.ceil(count / MAX_COLS);
    return rows * (CARD_H + GAP) - GAP;
  }

  function drawHeader(ctx, base, harmonyLabel) {
    capsText(ctx, "Color Pairings", PAD, PAD + 26, { size: 28, weight: 700, color: FG, spacing: 0.03 });
    capsText(ctx, harmonyLabel, PAD, PAD + 56, { size: 14, weight: 600, color: ACCENT, spacing: 0.14 });
    capsText(ctx, `#${base.hex}`, W - PAD, PAD + 26, { size: 28, weight: 700, color: FG, spacing: 0.02, align: "right" });
    capsText(ctx, base.name || "", W - PAD, PAD + 56, { size: 14, weight: 600, color: MUTED, spacing: 0.1, align: "right" });
  }

  /**
   * Bottom brand strip: a rule across the full width, "AN AHFOS INITIATIVE"
   * bottom-left in the same treatment as the landing page's credit line,
   * and the COLOR logo bottom-right.
   */
  function drawFooter(ctx, H, logoImg) {
    const footerY = H - 66;
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, footerY);
    ctx.lineTo(W - PAD, footerY);
    ctx.stroke();

    capsText(ctx, "An AHFOS Initiative", PAD, footerY + 36, {
      size: 13,
      weight: 500,
      color: MUTED,
      spacing: 0.24,
    });

    if (logoImg) {
      const logoH = 26;
      const logoW = logoH * (logoImg.width / logoImg.height);
      ctx.drawImage(logoImg, W - PAD - logoW, footerY + 16, logoW, logoH);
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  /**
   * iOS Safari doesn't reliably honor the `download` attribute on an <a> —
   * tapping it just opens the image instead of saving a file. Prefer the
   * Web Share API's file support where available (Safari/iOS, most
   * Android browsers): it hands the user a real "Save Image" sheet. Falls
   * back to the classic <a download> click for desktop browsers.
   */
  async function download(canvas, filename) {
    const blob = await canvasToBlob(canvas);
    if (!blob) return;

    if (navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      } catch {
        // Share sheet dismissed/unsupported mid-flight — fall through to a
        // direct download instead of leaving the user with nothing.
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const HEADER_H = 130;
  const FOOTER_H = 100;
  const SECTION_GAP = 36;
  const HEADING_H = 38;

  /** Single harmony (or any flat list) — every entry uniform, base included. */
  async function exportPNG(colors, meta) {
    const base = colors[0];
    const gridH = measureGridHeight(colors.length);
    const H = HEADER_H + gridH + SECTION_GAP + FOOTER_H;
    const scale = Math.min(SCALE, MAX_CANVAS_DIM / W, MAX_CANVAS_DIM / H);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    drawHeader(ctx, base, meta.harmonyLabel || "");
    layoutGrid(ctx, colors, PAD, HEADER_H, CONTENT_W);

    const logoImg = await getLogo();
    drawFooter(ctx, H, logoImg);

    const hex = base.hex.toLowerCase();
    const harmony = (meta.harmonyId || "palette").toLowerCase();
    await download(canvas, `color-pairings-${hex}-${harmony}.png`);
  }

  /** "All" export: Base, then every harmony group under its own heading. */
  async function exportAllPNG(base, groups) {
    let H = HEADER_H;
    H += measureGridHeight(1) + HEADING_H + SECTION_GAP; // Base section
    groups.forEach((g) => {
      H += HEADING_H + measureGridHeight(g.colors.length) + SECTION_GAP;
    });
    H += FOOTER_H;
    const scale = Math.min(SCALE, MAX_CANVAS_DIM / W, MAX_CANVAS_DIM / H);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    drawHeader(ctx, base, "All Pairings");

    let cy = HEADER_H;
    capsText(ctx, "Base", PAD, cy + 24, { size: 15, weight: 700, color: ACCENT, spacing: 0.12 });
    cy += HEADING_H;
    cy += layoutGrid(ctx, [base], PAD, cy, CONTENT_W) + SECTION_GAP;

    groups.forEach((g) => {
      capsText(ctx, g.label, PAD, cy + 24, { size: 15, weight: 700, color: ACCENT, spacing: 0.12 });
      cy += HEADING_H;
      cy += layoutGrid(ctx, g.colors, PAD, cy, CONTENT_W) + SECTION_GAP;
    });

    const logoImg = await getLogo();
    drawFooter(ctx, H, logoImg);

    await download(canvas, `color-pairings-${base.hex.toLowerCase()}-all.png`);
  }

  return { exportPNG, exportAllPNG };
})();
