/**
 * modeGuesser.js
 * "Guess" mode. Target is hidden; the player types RGB or Hex values and
 * watches a big live swatch update as they go, converging on the target by
 * feel. No color map here on purpose — this mode is purely about reading
 * codes, so the only feedback is the swatch the typed code itself produces.
 */

const GuesserMode = (() => {
  const WIN_THRESHOLD = 97; // perceptual score (0-100) to auto-win
  const HINT_PENALTY = 6; // score points lost per "How close?" press
  const START_RGB = { r: 153, g: 153, b: 153 }; // neutral gray starting point

  function create(ctx) {
    const { dom, sounds, onWin } = ctx;

    let target = null; // { r, g, b }
    let hintsUsed = 0;
    let active = false;

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

    function onRgbBoxInput(e) {
      // Clamp the box the user just typed in to 0-255 immediately, so what's
      // displayed never silently disagrees with what's actually applied.
      if (e && e.target) {
        const clamped = ColorEngine.clamp(parseInt(e.target.value, 10) || 0, 0, 255);
        if (String(clamped) !== e.target.value) e.target.value = clamped;
      }
      const rgb = readRGBFromInputs();
      dom.hexBox.value = ColorEngine.rgbToHex(rgb);
      setSwatch(rgb);
      checkWin(rgb);
    }

    function onHexBoxInput(e) {
      // Strip anything that isn't a hex digit as the user types, instead of
      // silently ignoring keystrokes until the whole string happens to be
      // valid — cap at 6 chars to match the "RRGGBB" box.
      if (e && e.target) {
        const cleaned = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
        if (cleaned !== e.target.value) e.target.value = cleaned;
      }
      const raw = dom.hexBox.value;
      if (!ColorEngine.isValidHex(raw)) return;
      const rgb = ColorEngine.hexToRgb(raw);
      dom.rgbBoxes.r.value = rgb.r;
      dom.rgbBoxes.g.value = rgb.g;
      dom.rgbBoxes.b.value = rgb.b;
      setSwatch(rgb);
      checkWin(rgb);
    }

    function checkWin(rgb) {
      if (!active) return;
      const score = ColorEngine.perceptualScore(rgb, target);
      if (score >= WIN_THRESHOLD) {
        finishRound(rgb, score, hintsUsed);
      }
    }

    function onHowClose() {
      if (!active) return;
      const rgb = readRGBFromInputs();
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
      active = true;
      dom.feedback.textContent = "Type a code to find the hidden color.";
      dom.feedback.classList.remove("pop");
      setSwatch(START_RGB);
      syncInputsFromRGB(START_RGB);
    }

    function activate() {
      dom.guesserOnly.forEach((el) => (el.hidden = false));
      dom.pointerOnly.forEach((el) => (el.hidden = true));
      // Defense in depth: the map is already hidden via data-pointer-only,
      // but make sure it can't be dragged or left mid-interaction either.
      ctx.colorMap.setInteractive(false);
      ctx.colorMap.cancelInteraction();
      ctx.setOnMapChange(null);
      dom.rgbBoxes.r.addEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.g.addEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.b.addEventListener("input", onRgbBoxInput);
      dom.hexBox.addEventListener("input", onHexBoxInput);
      dom.howCloseBtn.addEventListener("click", onHowClose);
      newRound(ctx.getDifficulty());
    }

    function deactivate() {
      active = false;
      dom.rgbBoxes.r.removeEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.g.removeEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.b.removeEventListener("input", onRgbBoxInput);
      dom.hexBox.removeEventListener("input", onHexBoxInput);
      dom.howCloseBtn.removeEventListener("click", onHowClose);
    }

    return {
      activate,
      deactivate,
      newRound: () => newRound(ctx.getDifficulty()),
    };
  }

  return { create };
})();
