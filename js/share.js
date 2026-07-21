/**
 * share.js
 * "Share to Instagram Story" — same mechanism as TypedUp's shareStory.ts:
 * render a 1080x1920 brand card on canvas, hand it to the Web Share API
 * (which surfaces Instagram, including "Add to Story", as a share target on
 * iOS/Android), and fall back to a direct PNG download + copied link on
 * desktop or browsers without file-sharing support.
 */

const Share = (() => {
  const CARD_W = 1080;
  const CARD_H = 1920;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  function drawLetterSpacedSegments(ctx, segments, centerX, y, spacing) {
    const chars = [];
    for (const seg of segments) {
      for (const char of seg.text) chars.push({ char, color: seg.color });
    }
    const widths = chars.map((c) => ctx.measureText(c.char).width);
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);

    const prevAlign = ctx.textAlign;
    ctx.textAlign = "left";
    let x = centerX - totalWidth / 2;
    chars.forEach((c, i) => {
      ctx.fillStyle = c.color;
      ctx.fillText(c.char, x, y);
      x += widths[i] + spacing;
    });
    ctx.textAlign = prevAlign;
  }

  /** Draws the shareable story card (logo + link + credit) onto the canvas. */
  async function drawStoryCard(canvas, logoSrc) {
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is unavailable");

    // Background — matches the site's white/black/red brand.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const logoImg = await loadImage(logoSrc);

    const logoCenterY = CARD_H * 0.4;
    const logoWidth = CARD_W * 0.72;
    const logoHeight = logoWidth * (logoImg.height / logoImg.width);
    ctx.drawImage(logoImg, (CARD_W - logoWidth) / 2, logoCenterY - logoHeight / 2, logoWidth, logoHeight);

    // A small rainbow strip — the one COLOR-specific flourish on an
    // otherwise TypedUp-identical layout, standing in for the hue slider.
    const stripY = logoCenterY + logoHeight / 2 + 70;
    const stripW = CARD_W * 0.72;
    const stripH = 14;
    const stripX = (CARD_W - stripW) / 2;
    const hueGrad = ctx.createLinearGradient(stripX, 0, stripX + stripW, 0);
    const stops = 12;
    for (let i = 0; i <= stops; i++) {
      const { r, g, b } = ColorEngine.hsvToRgb({ h: (360 * i) / stops, s: 100, v: 100 });
      hueGrad.addColorStop(i / stops, `rgb(${r},${g},${b})`);
    }
    ctx.fillStyle = hueGrad;
    const radius = stripH / 2;
    ctx.beginPath();
    ctx.moveTo(stripX + radius, stripY);
    ctx.arcTo(stripX + stripW, stripY, stripX + stripW, stripY + stripH, radius);
    ctx.arcTo(stripX + stripW, stripY + stripH, stripX, stripY + stripH, radius);
    ctx.arcTo(stripX, stripY + stripH, stripX, stripY, radius);
    ctx.arcTo(stripX, stripY, stripX + stripW, stripY, radius);
    ctx.closePath();
    ctx.fill();

    // Link line, styled like the footer credit but in brand colors.
    ctx.font = `600 42px "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = "alphabetic";
    drawLetterSpacedSegments(
      ctx,
      [
        { text: "ahfos.github.io/", color: "#000000" },
        { text: "color", color: "#c41e24" },
      ],
      CARD_W / 2,
      stripY + 130,
      2
    );

    // MADE BY AHFOS footer, small + grey like the home screen.
    ctx.font = `500 32px "Helvetica Neue", Arial, sans-serif`;
    drawLetterSpacedSegments(ctx, [{ text: "MADE BY AHFOS", color: "#888888" }], CARD_W / 2, CARD_H - 120, 9);
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export the story image"));
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Shares the rendered card. On iOS/Android this opens the native share
   * sheet where Instagram (including "Add to Story") shows up as a target
   * if installed. On desktop, or if the browser lacks file-sharing support,
   * it downloads the PNG and copies the game link instead, since browsers
   * can't hand a file straight to Instagram Stories there.
   */
  async function shareStoryImage(canvas, gameUrl) {
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], "color-story.png", { type: "image/png" });
    const canShareFiles =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: "COLOR", text: `Play COLOR: ${gameUrl}` });
        return { method: "share", message: "Shared — pick Instagram, then Story." };
      } catch (err) {
        if (err && err.name === "AbortError") {
          return { method: "share", message: "Share cancelled." };
        }
        // Fall through to the download fallback below.
      }
    }

    downloadBlob(blob, "color-story.png");

    try {
      await navigator.clipboard.writeText(gameUrl);
      return {
        method: "download",
        message: "Image saved and link copied — open Instagram, start a Story, add the photo, then paste the link.",
      };
    } catch {
      return {
        method: "download",
        message: `Image saved — open Instagram, start a Story, add the photo, and link to ${gameUrl}`,
      };
    }
  }

  /** The public URL of the game, e.g. https://ahfos.github.io/color/ */
  function gameShareUrl() {
    const dir = window.location.pathname.replace(/[^/]*$/, "");
    return `${window.location.origin}${dir}`;
  }

  return { drawStoryCard, shareStoryImage, gameShareUrl };
})();
