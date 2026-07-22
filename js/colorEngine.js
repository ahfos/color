/**
 * colorEngine.js
 * Shared color logic: random generation, RGB <-> Hex <-> HSV conversion,
 * and distance/scoring math. No DOM access — pure functions only, so this
 * module can be unit-tested and reused by both game modes.
 */

const ColorEngine = (() => {
  // ---------- generation ----------

  /** Uniform random integer in [min, max] inclusive. */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** A fully random RGB color. */
  function randomRGB() {
    return { r: randInt(0, 255), g: randInt(0, 255), b: randInt(0, 255) };
  }

  /** A random color constrained to a palette family (for difficulty modes). */
  function randomRGBConstrained(kind) {
    if (kind === "pastels") {
      const h = randInt(0, 359);
      const s = randInt(20, 45);
      const v = randInt(85, 100);
      return hsvToRgb({ h, s, v });
    }
    if (kind === "bold") {
      const h = randInt(0, 359);
      const s = randInt(70, 100);
      const v = randInt(70, 100);
      return hsvToRgb({ h, s, v });
    }
    return randomRGB();
  }

  /** Seeded PRNG (mulberry32) so daily challenges are reproducible. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Deterministic color from a seed string (e.g. today's date). */
  function seededRGB(seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (Math.imul(h, 31) + seedStr.charCodeAt(i)) | 0;
    }
    const rng = mulberry32(h);
    return {
      r: Math.floor(rng() * 256),
      g: Math.floor(rng() * 256),
      b: Math.floor(rng() * 256),
    };
  }

  // ---------- conversion ----------

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function rgbToHex({ r, g, b }) {
    const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
    return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  /** Parses a hex string (with or without #, 3 or 6 digits). Returns null if invalid. */
  function hexToRgb(hex) {
    if (typeof hex !== "string") return null;
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function isValidHex(hex) {
    return hexToRgb(hex) !== null;
  }

  function rgbToHsv({ r, g, b }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;

    let h = 0;
    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;

    return { h, s: s * 100, v: v * 100 };
  }

  function hsvToRgb({ h, s, v }) {
    const hh = ((h % 360) + 360) % 360;
    const sn = clamp(s, 0, 100) / 100;
    const vn = clamp(v, 0, 100) / 100;

    const c = vn * sn;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = vn - c;

    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (hh < 60) [rp, gp, bp] = [c, x, 0];
    else if (hh < 120) [rp, gp, bp] = [x, c, 0];
    else if (hh < 180) [rp, gp, bp] = [0, c, x];
    else if (hh < 240) [rp, gp, bp] = [0, x, c];
    else if (hh < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];

    return {
      r: Math.round((rp + m) * 255),
      g: Math.round((gp + m) * 255),
      b: Math.round((bp + m) * 255),
    };
  }

  function hexToHsv(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsv(rgb) : null;
  }

  function hsvToHex(hsv) {
    return rgbToHex(hsvToRgb(hsv));
  }

  // ---------- additional format conversions (Pairings) ----------

  function rgbToCmyk({ r, g, b }) {
    if (r === 0 && g === 0 && b === 0) return { c: 0, m: 0, y: 0, k: 100 };
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const k = 1 - Math.max(rn, gn, bn);
    const c = (1 - rn - k) / (1 - k);
    const m = (1 - gn - k) / (1 - k);
    const y = (1 - bn - k) / (1 - k);
    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100),
    };
  }

  function rgbToHsl({ r, g, b }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;

    let h = 0;
    let s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  /** sRGB -> linear-light for a single channel (0-255 in, 0-1 out). */
  function srgbChannelToLinear(c) {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  }

  /** WCAG relative luminance, 0 (black) .. 1 (white). */
  function relativeLuminance({ r, g, b }) {
    return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
  }

  /** WCAG contrast ratio between two colors, 1 (no contrast) .. 21 (black/white). */
  function contrastRatio(rgbA, rgbB) {
    const l1 = relativeLuminance(rgbA);
    const l2 = relativeLuminance(rgbB);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /** WCAG tier for a contrast ratio against normal-size text. */
  function contrastTier(ratio) {
    if (ratio >= 7) return "AAA";
    if (ratio >= 4.5) return "AA";
    if (ratio >= 3) return "AA Large";
    return "Fail";
  }

  // ---------- color harmony (Pairings) ----------

  /** Rotates a color's hue by `deg`, keeping saturation and value fixed. */
  function shiftHue(rgb, deg) {
    const hsv = rgbToHsv(rgb);
    return hsvToRgb({ h: hsv.h + deg, s: hsv.s, v: hsv.v });
  }

  /**
   * Rotating hue by 180deg is a no-op on an achromatic color (white,
   * black, any pure gray) -- saturation is 0, so there's no hue to
   * rotate. That silently returned the same color as its own
   * "complementary," which contradicts the one thing everyone already
   * knows about complements: white's is black. For s~=0, fall back to
   * inverting value instead.
   */
  function harmonyComplementary(rgb) {
    const hsv = rgbToHsv(rgb);
    const complement = hsv.s < 1 ? hsvToRgb({ h: hsv.h, s: 0, v: 100 - hsv.v }) : shiftHue(rgb, 180);
    return [
      { label: "Base", rgb },
      { label: "Complementary", rgb: complement },
    ];
  }

  function harmonyAnalogous(rgb) {
    return [
      { label: "Base", rgb },
      { label: "Analogous −30°", rgb: shiftHue(rgb, -30) },
      { label: "Analogous +30°", rgb: shiftHue(rgb, 30) },
    ];
  }

  function harmonyTriadic(rgb) {
    return [
      { label: "Base", rgb },
      { label: "Triadic +120°", rgb: shiftHue(rgb, 120) },
      { label: "Triadic +240°", rgb: shiftHue(rgb, 240) },
    ];
  }

  function harmonySplitComplementary(rgb) {
    return [
      { label: "Base", rgb },
      { label: "Split +150°", rgb: shiftHue(rgb, 150) },
      { label: "Split +210°", rgb: shiftHue(rgb, 210) },
    ];
  }

  function harmonyTetradic(rgb) {
    return [
      { label: "Base", rgb },
      { label: "Tetradic +90°", rgb: shiftHue(rgb, 90) },
      { label: "Tetradic +180°", rgb: shiftHue(rgb, 180) },
      { label: "Tetradic +270°", rgb: shiftHue(rgb, 270) },
    ];
  }

  /**
   * Same hue & saturation, stepped value (lightness). Note this collapses
   * to a single point on a hue/saturation wheel — callers should present
   * these as a shade ladder rather than distinct wheel positions.
   */
  function harmonyMonochromatic(rgb) {
    const hsv = rgbToHsv(rgb);
    const deltas = [-36, -18, 18, 36];
    const variants = deltas.map((d) => {
      const v = clamp(hsv.v + d, 6, 100);
      const label = d < 0 ? `Shade ${d}%` : `Tint +${d}%`;
      return { label, rgb: hsvToRgb({ h: hsv.h, s: hsv.s, v }) };
    });
    return [{ label: "Base", rgb }, ...variants];
  }

  const HARMONY_TYPES = [
    { id: "complementary", label: "Complementary" },
    { id: "analogous", label: "Analogous" },
    { id: "triadic", label: "Triadic" },
    { id: "splitComplementary", label: "Split-Comp" },
    { id: "tetradic", label: "Tetradic" },
    { id: "monochromatic", label: "Monochromatic" },
  ];

  /** Dispatches to the right harmony generator. Always returns Base first. */
  function getHarmony(rgb, type) {
    switch (type) {
      case "analogous":
        return harmonyAnalogous(rgb);
      case "triadic":
        return harmonyTriadic(rgb);
      case "splitComplementary":
        return harmonySplitComplementary(rgb);
      case "tetradic":
        return harmonyTetradic(rgb);
      case "monochromatic":
        return harmonyMonochromatic(rgb);
      case "complementary":
      default:
        return harmonyComplementary(rgb);
    }
  }

  // ---------- distance / scoring ----------

  /**
   * Weighted Euclidean distance in RGB space (redmean-ish weighting), which
   * correlates with perceived difference far better than plain Euclidean
   * while staying cheap. Range: 0 (identical) .. ~764 (black vs white).
   */
  function weightedEuclideanDistance(a, b) {
    const rMean = (a.r + b.r) / 2;
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    const weightR = 2 + rMean / 256;
    const weightG = 4.0;
    const weightB = 2 + (255 - rMean) / 256;
    return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
  }

  const MAX_DISTANCE = weightedEuclideanDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });

  /** Converts sRGB (0-255) to linear-light, then to CIE XYZ, then CIE Lab. */
  function rgbToLab({ r, g, b }) {
    const toLinear = (c) => {
      const cs = c / 255;
      return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
    };
    const rl = toLinear(r);
    const gl = toLinear(g);
    const bl = toLinear(b);

    const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
    const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;

    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      bLab: 200 * (fy - fz),
    };
  }

  /** CIEDE2000 perceptual distance. Range roughly 0..100 for typical colors. */
  function deltaE2000(rgbA, rgbB) {
    const lab1 = rgbToLab(rgbA);
    const lab2 = rgbToLab(rgbB);
    const { l: L1, a: a1, bLab: b1 } = lab1;
    const { l: L2, a: a2, bLab: b2 } = lab2;

    const avgLp = (L1 + L2) / 2;
    const c1 = Math.sqrt(a1 * a1 + b1 * b1);
    const c2 = Math.sqrt(a2 * a2 + b2 * b2);
    const avgC = (c1 + c2) / 2;
    const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

    const a1p = a1 * (1 + g);
    const a2p = a2 * (1 + g);
    const c1p = Math.sqrt(a1p * a1p + b1 * b1);
    const c2p = Math.sqrt(a2p * a2p + b2 * b2);
    const avgCp = (c1p + c2p) / 2;

    const hp = (x, y) => {
      if (x === 0 && y === 0) return 0;
      const ang = (Math.atan2(y, x) * 180) / Math.PI;
      return ang >= 0 ? ang : ang + 360;
    };
    const h1p = hp(a1p, b1);
    const h2p = hp(a2p, b2);

    let deltahp;
    if (c1p * c2p === 0) deltahp = 0;
    else if (Math.abs(h1p - h2p) <= 180) deltahp = h2p - h1p;
    else if (h2p <= h1p) deltahp = h2p - h1p + 360;
    else deltahp = h2p - h1p - 360;

    const deltaLp = L2 - L1;
    const deltaCp = c2p - c1p;
    const deltaHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(((deltahp / 2) * Math.PI) / 180);

    let avgHp;
    if (c1p * c2p === 0) avgHp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) avgHp = (h1p + h2p + 360) / 2;
    else avgHp = (h1p + h2p - 360) / 2;

    const t =
      1 -
      0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
      0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
      0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
      0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

    const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
    const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
    const sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
    const sc = 1 + 0.045 * avgCp;
    const sh = 1 + 0.015 * avgCp * t;
    const rt = -Math.sin((2 * deltaTheta * Math.PI) / 180) * rc;

    const kl = 1;
    const kc = 1;
    const kh = 1;

    const term1 = deltaLp / (kl * sl);
    const term2 = deltaCp / (kc * sc);
    const term3 = deltaHp / (kh * sh);

    return Math.sqrt(term1 * term1 + term2 * term2 + term3 * term3 + rt * term2 * term3);
  }

  /**
   * Normalized proximity score, 0..100 (100 = exact match), using the
   * cheap weighted-Euclidean metric. Good for the high-frequency "how am
   * I doing" feedback loop (map dragging, live typing).
   */
  function proximityScore(a, b) {
    const d = weightedEuclideanDistance(a, b);
    return clamp(100 * (1 - d / MAX_DISTANCE), 0, 100);
  }

  /**
   * Normalized perceptual score, 0..100, using CIEDE2000. More expensive;
   * use for final "reveal" moments (How close? button, results screen)
   * rather than every animation frame.
   */
  function perceptualScore(a, b) {
    const de = deltaE2000(a, b);
    // Empirically dE2000 rarely exceeds ~100 for two random sRGB colors;
    // clamp generously so the score still spans the full range.
    return clamp(100 * (1 - de / 100), 0, 100);
  }

  /** Human-readable proximity tier for a 0-100 score. */
  function scoreLabel(score) {
    if (score >= 99) return "Exact match";
    if (score >= 90) return "Nearly identical";
    if (score >= 75) return "Very close";
    if (score >= 55) return "Getting warm";
    if (score >= 35) return "Cold";
    return "Way off";
  }

  return {
    randInt,
    randomRGB,
    randomRGBConstrained,
    seededRGB,
    mulberry32,
    clamp,
    rgbToHex,
    hexToRgb,
    isValidHex,
    rgbToHsv,
    hsvToRgb,
    hexToHsv,
    hsvToHex,
    weightedEuclideanDistance,
    deltaE2000,
    proximityScore,
    perceptualScore,
    scoreLabel,
    MAX_DISTANCE,
    rgbToCmyk,
    rgbToHsl,
    relativeLuminance,
    contrastRatio,
    contrastTier,
    shiftHue,
    getHarmony,
    HARMONY_TYPES,
  };
})();
