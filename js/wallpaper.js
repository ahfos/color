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

  function readableTextColor({ r, g, b }) {
    // Relative luminance (sRGB) to decide black or white label text.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.55 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
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
      const hex = `#${ColorEngine.rgbToHex(rgb)}`;
      const fontSize = Math.round(size.w * 0.018);
      ctx.font = `500 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = readableTextColor(rgb);
      ctx.textBaseline = "bottom";
      const pad = Math.round(size.w * 0.03);
      ctx.fillText(hex, pad, size.h - pad);
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
