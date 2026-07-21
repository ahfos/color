/**
 * wallpaper.js
 * Renders the guessed/target color as a solid-fill wallpaper PNG and
 * triggers a download. Flat color, so one size covers desktop reasonably;
 * a portrait variant is offered for phone lock/home screens.
 */

const Wallpaper = (() => {
  const SIZES = {
    landscape: { w: 3840, h: 2160, label: "4K Landscape" },
    portrait: { w: 2160, h: 3840, label: "4K Portrait" },
  };

  const PHI = 1.6180339887;

  function readableTextColor({ r, g, b }) {
    // Relative luminance (sRGB) to decide black or white label text.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.55 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
  }

  /**
   * Draws the hex code dead-center, bold sans caps, sized off the golden
   * ratio: the label spans roughly 1/phi^2 (~38.2%) of the frame width,
   * which reads as a confident "medium" mark on either a landscape or
   * portrait frame without either overwhelming it or getting lost.
   */
  function drawCenteredHexLabel(ctx, rgb, w, h) {
    const hex = `#${ColorEngine.rgbToHex(rgb)}`; // rgbToHex is already uppercase
    const weight = 700;
    const family = '"Helvetica Neue", Arial, sans-serif';

    const targetWidth = w / (PHI * PHI);
    const referenceSize = 100;
    ctx.font = `${weight} ${referenceSize}px ${family}`;
    const refWidth = ctx.measureText(hex).width;
    let fontSize = Math.round((targetWidth / refWidth) * referenceSize);
    // Keep it sane at extreme aspect ratios rather than trusting the ratio blindly.
    fontSize = ColorEngine.clamp(fontSize, w * 0.03, h * 0.16);

    ctx.font = `${weight} ${fontSize}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = readableTextColor(rgb);
    try {
      ctx.letterSpacing = `${Math.round(fontSize * 0.04)}px`;
    } catch {
      /* older browsers without Canvas letterSpacing — falls back to none */
    }
    ctx.fillText(hex, w / 2, h / 2);
  }

  function render(rgb, orientation, { showHex = false } = {}) {
    const size = SIZES[orientation] || SIZES.landscape;
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.fillRect(0, 0, size.w, size.h);

    if (showHex) {
      drawCenteredHexLabel(ctx, rgb, size.w, size.h);
    }

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

  /** Renders + downloads in one step. orientation: 'landscape' | 'portrait'. */
  function exportWallpaper(rgb, orientation, opts) {
    const canvas = render(rgb, orientation, opts);
    const hex = ColorEngine.rgbToHex(rgb);
    download(canvas, `color-${hex.toLowerCase()}-${orientation}.png`);
  }

  return { render, download, exportWallpaper, SIZES };
})();
