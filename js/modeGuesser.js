/**
 * modeGuesser.js
 * Mode 1 — "Code → Color". Target is hidden; the player types/drags to
 * converge on it, watching a live swatch + map marker update as they go.
 */

const GuesserMode = (() => {
  const WIN_THRESHOLD = 97; // perceptual score (0-100) to auto-win
  const HINT_PENALTY = 6; // score points lost per "How close?" press
  const AUTO_CHECK_INTERVAL_MS = 350; // throttle for expensive dE2000 scoring

  function create(ctx) {
    const { dom, colorMap, sounds, onWin } = ctx;

    let target = null; // { r, g, b }
    let hintsUsed = 0;
    let lastAutoCheck = 0;
    let active = false;
    let inputSource = null; // 'input' | 'map' | null — breaks the sync feedback loop
    let guardTimer = null;

    function currentGuessRGB() {
      return ColorEngine.hsvToRgb(colorMap.getHSV());
    }

    function setSwatch(rgb) {
      dom.liveSwatch.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    function syncInputsFromRGB(rgb) {
      dom.rgbBoxes.r.value = rgb.r;
      dom.rgbBoxes.g.value = rgb.g;
      dom.rgbBoxes.b.value = rgb.b;
      dom.hexBox.value = ColorEngine.rgbToHex(rgb);
    }

    function readRGBFromInputs() {
      const r = ColorEngine.clamp(parseInt(dom.rgbBoxes.r.value, 10) || 0, 0, 255);
      const g = ColorEngine.clamp(parseInt(dom.rgbBoxes.g.value, 10) || 0, 0, 255);
      const b = ColorEngine.clamp(parseInt(dom.rgbBoxes.b.value, 10) || 0, 0, 255);
      return { r, g, b };
    }

    function onRgbBoxInput() {
      inputSource = "input";
      const rgb = readRGBFromInputs();
      dom.hexBox.value = ColorEngine.rgbToHex(rgb);
      setSwatch(rgb);
      colorMap.setHSV(ColorEngine.rgbToHsv(rgb));
      maybeAutoCheck(rgb);
    }

    function onHexBoxInput() {
      inputSource = "input";
      const raw = dom.hexBox.value;
      if (!ColorEngine.isValidHex(raw)) return;
      const rgb = ColorEngine.hexToRgb(raw);
      dom.rgbBoxes.r.value = rgb.r;
      dom.rgbBoxes.g.value = rgb.g;
      dom.rgbBoxes.b.value = rgb.b;
      setSwatch(rgb);
      colorMap.setHSV(ColorEngine.rgbToHsv(rgb));
      maybeAutoCheck(rgb);
    }

    function onMapChange(hsv) {
      if (inputSource === "input") return; // input just drove this frame, don't fight it
      const rgb = ColorEngine.hsvToRgb(hsv);
      setSwatch(rgb);
      syncInputsFromRGB(rgb);
      maybeAutoCheck(rgb);
    }

    function maybeAutoCheck(rgb) {
      const now = performance.now();
      if (now - lastAutoCheck < AUTO_CHECK_INTERVAL_MS) return;
      lastAutoCheck = now;
      const score = ColorEngine.perceptualScore(rgb, target);
      if (score >= WIN_THRESHOLD) {
        finishRound(rgb, score, hintsUsed);
      }
    }

    function onHowClose() {
      if (!active) return;
      const rgb = currentGuessRGB();
      const score = ColorEngine.perceptualScore(rgb, target);
      hintsUsed += 1;
      sounds.playClose();
      const label = ColorEngine.scoreLabel(score);
      dom.feedback.textContent = `${label} — ${Math.round(score)}% match`;
      dom.feedback.classList.remove("pop");
      // eslint-disable-next-line no-unused-expressions
      dom.feedback.offsetWidth; // restart animation
      dom.feedback.classList.add("pop");

      if (score >= WIN_THRESHOLD) {
        finishRound(rgb, score, hintsUsed);
      }
    }

    function finishRound(rgb, score, hints) {
      active = false;
      const finalScore = Math.max(0, Math.round(score - hints * HINT_PENALTY));
      sounds.playCorrect();
      onWin({
        mode: "guesser",
        guess: rgb,
        target,
        score,
        finalScore,
        hintsUsed: hints,
      });
    }

    function newRound(difficulty) {
      target = ColorEngine.randomRGBConstrained(difficulty);
      hintsUsed = 0;
      inputSource = null;
      active = true;
      dom.feedback.textContent = "Type a code or drag the map to converge on the hidden color.";
      dom.feedback.classList.remove("pop");
      const start = { h: 0, s: 0, v: 60 };
      colorMap.setHSV(start, { animate: false });
      const startRgb = ColorEngine.hsvToRgb(start);
      setSwatch(startRgb);
      syncInputsFromRGB(startRgb);
    }

    function activate() {
      dom.guesserOnly.forEach((el) => (el.hidden = false));
      dom.pointerOnly.forEach((el) => (el.hidden = true));
      colorMap.setInteractive(true);
      dom.rgbBoxes.r.addEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.g.addEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.b.addEventListener("input", onRgbBoxInput);
      dom.hexBox.addEventListener("input", onHexBoxInput);
      dom.howCloseBtn.addEventListener("click", onHowClose);
      ctx.setOnMapChange(onMapChange);
      newRound(ctx.getDifficulty());
    }

    function deactivate() {
      active = false;
      dom.rgbBoxes.r.removeEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.g.removeEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.b.removeEventListener("input", onRgbBoxInput);
      dom.hexBox.removeEventListener("input", onHexBoxInput);
      dom.howCloseBtn.removeEventListener("click", onHowClose);
      if (guardTimer) clearTimeout(guardTimer);
    }

    function onGrab() {
      inputSource = "map";
    }

    return {
      activate,
      deactivate,
      onGrab,
      newRound: () => newRound(ctx.getDifficulty()),
    };
  }

  return { create };
})();
