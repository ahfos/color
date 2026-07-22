/**
 * manual.js
 * The "?" on the landing page — a short, crisp explainer that RGB/Hex are
 * arithmetic, not a guessing game, plus a "Download as PNG" export of the
 * same content with the app's branded bottom bar (rule + "AN AHFOS
 * INITIATIVE" + logo), matching the Pairings exports.
 *
 * Self-contained, like wallpaper.js/share.js/bentoExport.js: its own tiny
 * canvas toolkit rather than sharing one, so features stay independent.
 */

(function () {
  "use strict";

  const openBtn = document.getElementById("helpTriggerBtn");
  const overlay = document.getElementById("manualOverlay");
  const backdrop = document.getElementById("manualBackdrop");
  const closeBtn = document.getElementById("manualCloseBtn");
  const downloadBtn = document.getElementById("manualDownloadBtn");
  if (!openBtn || !overlay) return; // markup not present — nothing to wire up

  const sounds = typeof Sounds !== "undefined" ? Sounds : { unlock() {} };

  function open() {
    sounds.unlock();
    overlay.hidden = false;
  }

  function close() {
    overlay.hidden = true;
  }

  openBtn.addEventListener("click", open);
  if (backdrop) backdrop.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) close();
  });

  // ---------- PNG export ----------

  const ManualExport = (() => {
    const SCALE = 2;
    const MAX_CANVAS_DIM = 4000;
    const W = 1000;
    const PAD = 64;
    const CONTENT_W = W - PAD * 2;

    const FONT = '"Helvetica Neue", Arial, sans-serif';
    const MONO = '"SF Mono", "Menlo", "Consolas", monospace';
    const FG = "#000000";
    const MUTED = "#888888";
    const BORDER = "#e5e5e5";
    const PANEL = "#f2f2f2";
    const ACCENT = "#c41e24";
    const R = { fg: "#c41e24", bg: "rgba(196, 30, 36, 0.1)" };
    const G = { fg: "#1f8a4c", bg: "rgba(31, 138, 76, 0.1)" };
    const B = { fg: "#2064c4", bg: "rgba(32, 100, 196, 0.1)" };

    const INTRO = "It's not a guess. It's arithmetic wearing a costume.";
    const RGB_TEXT =
      "Every color is three numbers: how much Red, Green and Blue light to mix. Each one runs 0 to 255 — 256 steps, because a computer counts in 8-bit bytes, and 2⁸ = 256.";
    const HEX_TEXT =
      'Hex writes those same three numbers in base 16 instead of base 10 — two digits per channel, 00 to FF, because 16 × 16 = 256. FF isn’t a limit. It’s just "255," spelled in a different counting system.';
    const NOTE_TEXT =
      "First digit = how many 16s. Second digit = what's left over. A–F just cover 10–15, so one digit can hold a value past 9. #3399FF and rgb(51, 153, 255) are the same color — two number systems, same three ingredients.";

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
      });
    }

    // Warmed on module load — see bentoExport.js for why an export
    // shouldn't await a fresh fetch right before triggering the download.
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

    function plainText(ctx, text, x, y, { size, weight = 500, color = FG, align = "left", font = FONT } = {}) {
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, x, y);
    }

    function wrapLines(ctx, text, font, maxWidth) {
      ctx.font = font;
      const words = text.split(" ");
      const lines = [];
      let line = "";
      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);
      return lines;
    }

    function drawParagraph(ctx, lines, x, y, lineH, opts) {
      lines.forEach((line, i) => plainText(ctx, line, x, y + i * lineH, opts));
      return y + lines.length * lineH;
    }

    const BREAKDOWN_H = 230;

    function drawBreakdown(ctx, x, y, width) {
      roundRect(ctx, x, y, width, BREAKDOWN_H, 14);
      ctx.fillStyle = PANEL;
      ctx.fill();

      const chunks = [
        { text: "33", ...R },
        { text: "99", ...G },
        { text: "FF", ...B },
      ];
      const chipW = 110;
      const chipH = 56;
      const gap = 18;
      const rowW = chunks.length * chipW + (chunks.length - 1) * gap;
      let cx = x + (width - rowW) / 2;
      const chipY = y + 24;
      chunks.forEach((c) => {
        roundRect(ctx, cx, chipY, chipW, chipH, 10);
        ctx.fillStyle = c.bg;
        ctx.fill();
        plainText(ctx, c.text, cx + chipW / 2, chipY + chipH / 2 + 12, {
          size: 30,
          weight: 700,
          color: c.fg,
          align: "center",
          font: MONO,
        });
        cx += chipW + gap;
      });

      const rows = [
        { formula: "3 × 16 + 3", result: "= 51", ...R },
        { formula: "9 × 16 + 9", result: "= 153", ...G },
        { formula: "15 × 16 + 15", result: "= 255", ...B },
      ];
      let ry = chipY + chipH + 34;
      rows.forEach((row) => {
        ctx.strokeStyle = row.fg;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const barX = x + width / 2 - 118;
        ctx.moveTo(barX, ry - 14);
        ctx.lineTo(barX, ry + 6);
        ctx.stroke();

        plainText(ctx, row.formula, barX + 14, ry, { size: 15, weight: 500, color: MUTED, font: MONO });
        plainText(ctx, row.result, barX + 150, ry, { size: 15, weight: 700, color: FG, font: MONO });
        ry += 34;
      });

      return BREAKDOWN_H;
    }

    function drawFooter(ctx, H, logoImg) {
      const footerY = H - 66;
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, footerY);
      ctx.lineTo(W - PAD, footerY);
      ctx.stroke();

      capsText(ctx, "An AHFOS Initiative", PAD, footerY + 36, { size: 13, weight: 500, color: MUTED, spacing: 0.24 });

      if (logoImg) {
        const logoH = 26;
        const logoW = logoH * (logoImg.width / logoImg.height);
        ctx.drawImage(logoImg, W - PAD - logoW, footerY + 16, logoW, logoH);
      }
    }

    function canvasToBlob(canvas) {
      return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    }

    /** Prefers the Web Share API (real "Save Image" sheet on iOS) — see bentoExport.js. */
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
          /* fall through to a direct download */
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

    async function exportPNG() {
      const scratch = document.createElement("canvas");
      const mctx = scratch.getContext("2d");

      const bodyFont = `500 16px ${FONT}`;
      const introFont = `500 17px ${FONT}`;
      const introLines = wrapLines(mctx, INTRO, introFont, CONTENT_W);
      const rgbLines = wrapLines(mctx, RGB_TEXT, bodyFont, CONTENT_W);
      const hexLines = wrapLines(mctx, HEX_TEXT, bodyFont, CONTENT_W);
      const noteLines = wrapLines(mctx, NOTE_TEXT, bodyFont, CONTENT_W);

      const BODY_LINE_H = 26;
      const INTRO_LINE_H = 27;
      const SECTION_GAP = 46;

      let H = PAD;
      H += 14 + 14; // eyebrow
      H += 34 + 18; // title
      H += introLines.length * INTRO_LINE_H + SECTION_GAP;
      H += 16 + 20 + rgbLines.length * BODY_LINE_H + SECTION_GAP; // section 01
      H += 16 + 20 + hexLines.length * BODY_LINE_H + SECTION_GAP; // section 02
      H += 16 + 20 + BREAKDOWN_H + 24 + noteLines.length * BODY_LINE_H + SECTION_GAP; // section 03
      H += 100; // footer

      const scale = Math.min(SCALE, MAX_CANVAS_DIM / W, MAX_CANVAS_DIM / H);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      let cy = PAD;
      capsText(ctx, "The Manual", PAD, cy + 12, { size: 14, weight: 500, color: MUTED, spacing: 0.24 });
      cy += 28;
      plainText(ctx, "RGB & Hex, Decoded", PAD, cy + 26, { size: 34, weight: 700, color: FG });
      cy += 52;
      cy = drawParagraph(ctx, introLines, PAD, cy, INTRO_LINE_H, { size: 17, weight: 500, color: MUTED });
      cy += SECTION_GAP;

      capsText(ctx, "01 — RGB", PAD, cy, { size: 16, weight: 700, color: ACCENT, spacing: 0.08 });
      cy += 24;
      cy = drawParagraph(ctx, rgbLines, PAD, cy, BODY_LINE_H, { size: 16, weight: 500, color: FG });
      cy += SECTION_GAP;

      capsText(ctx, "02 — Hex", PAD, cy, { size: 16, weight: 700, color: ACCENT, spacing: 0.08 });
      cy += 24;
      cy = drawParagraph(ctx, hexLines, PAD, cy, BODY_LINE_H, { size: 16, weight: 500, color: FG });
      cy += SECTION_GAP;

      capsText(ctx, "03 — Decode One", PAD, cy, { size: 16, weight: 700, color: ACCENT, spacing: 0.08 });
      cy += 24;
      cy += drawBreakdown(ctx, PAD, cy, CONTENT_W);
      cy += 24;
      cy = drawParagraph(ctx, noteLines, PAD, cy, BODY_LINE_H, { size: 16, weight: 500, color: FG });

      const logoImg = await getLogo();
      drawFooter(ctx, H, logoImg);

      await download(canvas, "color-rgb-hex-manual.png");
    }

    return { exportPNG };
  })();

  if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      sounds.unlock();
      downloadBtn.disabled = true;
      const original = downloadBtn.textContent;
      downloadBtn.textContent = "Preparing…";
      try {
        await ManualExport.exportPNG();
      } catch {
        downloadBtn.textContent = "Couldn't export — try again";
        setTimeout(() => {
          downloadBtn.textContent = original;
        }, 1800);
        downloadBtn.disabled = false;
        return;
      }
      downloadBtn.textContent = original;
      downloadBtn.disabled = false;
    });
  }
})();
