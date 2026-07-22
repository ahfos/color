/**
 * bentoExport.js
 * Renders the current pairing (base + harmony colors, with all four code
 * formats) to an off-screen canvas and downloads it as a PNG — the same
 * "draw it ourselves, no DOM screenshot library" approach as wallpaper.js,
 * so the export never depends on how the live bento grid happens to have
 * laid out or wrapped in the browser.
 */

const BentoExport = (() => {
  const SCALE = 2; // supersample for a crisp download regardless of screen DPR
  const W = 1400;
  const PAD = 56;
  const FONT = '"Helvetica Neue", Arial, sans-serif';
  const FG = "#000000";
  const MUTED = "#888888";
  const BORDER = "#e5e5e5";
  const ACCENT = "#c41e24";

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

  /** One card: swatch block on top, code details on a plain card body below. */
  function drawCard(ctx, entry, x, y, w, h, { swatchRatio = 0.42 } = {}) {
    roundRect(ctx, x, y, w, h, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, w, h, 20);
    ctx.clip();

    const swatchH = Math.round(h * swatchRatio);
    ctx.fillStyle = `rgb(${entry.rgb.r}, ${entry.rgb.g}, ${entry.rgb.b})`;
    ctx.fillRect(x, y, w, swatchH);

    // Role label, sitting on the swatch itself (contrast-checked).
    const onSwatch = bestTextColor(entry.rgb);
    capsText(ctx, entry.label, x + 28, y + swatchH - 22, { size: 22, weight: 700, color: onSwatch, spacing: 0.08 });

    ctx.restore();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 20);
    ctx.stroke();

    let ty = y + swatchH + 40;
    const tx = x + 28;
    capsText(ctx, entry.name || "", tx, ty, { size: 24, weight: 700, color: FG, spacing: 0.02 });
    ty += 30;
    capsText(ctx, `#${entry.hex}`, tx, ty, { size: 17, weight: 500, color: ACCENT, spacing: 0.05 });
    ty += 26;
    capsText(ctx, `RGB ${entry.rgb.r} ${entry.rgb.g} ${entry.rgb.b}`, tx, ty, { size: 14, weight: 500, color: MUTED, spacing: 0.05 });
    ty += 20;
    capsText(ctx, `CMYK ${entry.cmyk.c} ${entry.cmyk.m} ${entry.cmyk.y} ${entry.cmyk.k}`, tx, ty, { size: 14, weight: 500, color: MUTED, spacing: 0.05 });
    ty += 20;
    capsText(ctx, `HSL ${Math.round(entry.hsl.h)} ${Math.round(entry.hsl.s)}% ${Math.round(entry.hsl.l)}%`, tx, ty, { size: 14, weight: 500, color: MUTED, spacing: 0.05 });
  }

  function layoutRows(count) {
    // First entry (base) is drawn separately/full-width; this lays out the rest.
    if (count <= 0) return [];
    const cols = count <= 3 ? count : 2;
    const rows = [];
    for (let i = 0; i < count; i += cols) rows.push(Math.min(cols, count - i));
    return rows;
  }

  function render(colors, meta) {
    const base = colors[0];
    const rest = colors.slice(1);
    const rowCounts = layoutRows(rest.length);

    const contentW = W - PAD * 2;
    const baseCardH = 300;
    const gap = 24;
    const secondaryCardH = 300;
    const rowsH = rowCounts.reduce((sum) => sum + secondaryCardH + gap, 0);

    const headerH = 150;
    const footerH = 70;
    const H = headerH + baseCardH + gap + rowsH + footerH + PAD;

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Header
    capsText(ctx, "Color Pairings", PAD, PAD + 26, { size: 30, weight: 700, color: FG, spacing: 0.03 });
    capsText(ctx, meta.harmonyLabel, PAD, PAD + 58, { size: 15, weight: 600, color: ACCENT, spacing: 0.14 });
    capsText(ctx, `#${base.hex}`, W - PAD, PAD + 26, { size: 30, weight: 700, color: FG, spacing: 0.02, align: "right" });
    capsText(ctx, base.name || "", W - PAD, PAD + 58, { size: 15, weight: 600, color: MUTED, spacing: 0.1, align: "right" });

    let cy = headerH;

    // Featured base card: full width, swatch on the left, details on the right.
    roundRect(ctx, PAD, cy, contentW, baseCardH, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    roundRect(ctx, PAD, cy, contentW, baseCardH, 20);
    ctx.clip();
    const swW = baseCardH;
    ctx.fillStyle = `rgb(${base.rgb.r}, ${base.rgb.g}, ${base.rgb.b})`;
    ctx.fillRect(PAD, cy, swW, baseCardH);
    const onBase = bestTextColor(base.rgb);
    capsText(ctx, "Base", PAD + 26, cy + baseCardH - 26, { size: 26, weight: 700, color: onBase, spacing: 0.08 });
    ctx.restore();
    ctx.strokeStyle = BORDER;
    roundRect(ctx, PAD + 0.5, cy + 0.5, contentW - 1, baseCardH - 1, 20);
    ctx.stroke();

    const detailX = PAD + swW + 40;
    let dy = cy + 56;
    capsText(ctx, base.name || "", detailX, dy, { size: 30, weight: 700, color: FG, spacing: 0.02 });
    dy += 40;
    capsText(ctx, `HEX #${base.hex}`, detailX, dy, { size: 18, weight: 600, color: ACCENT, spacing: 0.05 });
    dy += 32;
    capsText(ctx, `RGB ${base.rgb.r}, ${base.rgb.g}, ${base.rgb.b}`, detailX, dy, { size: 16, weight: 500, color: FG, spacing: 0.03 });
    dy += 26;
    capsText(ctx, `CMYK ${base.cmyk.c}, ${base.cmyk.m}, ${base.cmyk.y}, ${base.cmyk.k}`, detailX, dy, { size: 16, weight: 500, color: FG, spacing: 0.03 });
    dy += 26;
    capsText(ctx, `HSL ${Math.round(base.hsl.h)}, ${Math.round(base.hsl.s)}%, ${Math.round(base.hsl.l)}%`, detailX, dy, { size: 16, weight: 500, color: FG, spacing: 0.03 });
    dy += 32;
    capsText(
      ctx,
      `Contrast — white text ${base.contrastWhite.ratio.toFixed(2)} (${base.contrastWhite.tier}) · black text ${base.contrastBlack.ratio.toFixed(2)} (${base.contrastBlack.tier})`,
      detailX,
      dy,
      { size: 13, weight: 500, color: MUTED, spacing: 0.02 }
    );

    cy += baseCardH + gap;

    // Secondary cards
    let idx = 0;
    for (const cols of rowCounts) {
      const cardW = (contentW - gap * (cols - 1)) / cols;
      for (let c = 0; c < cols; c++) {
        const entry = rest[idx++];
        const x = PAD + c * (cardW + gap);
        drawCard(ctx, entry, x, cy, cardW, secondaryCardH);
      }
      cy += secondaryCardH + gap;
    }

    // Footer credit — matches the app's ".landing__credit" typographic treatment.
    capsText(ctx, "Made with COLOR by AHFOS · ahfos.github.io/color", PAD, H - PAD / 2 - 6, {
      size: 12,
      weight: 500,
      color: MUTED,
      spacing: 0.18,
    });

    return canvas;
  }

  function download(canvas, filename) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
  }

  function exportPNG(colors, meta) {
    const canvas = render(colors, meta);
    const hex = colors[0].hex.toLowerCase();
    const harmony = (meta.harmonyId || "palette").toLowerCase();
    download(canvas, `color-pairings-${hex}-${harmony}.png`);
  }

  return { render, exportPNG };
})();
