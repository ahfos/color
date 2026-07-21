/**
 * modeGuesser.js
 * "Guess" mode. The big swatch shows the fixed hidden target color for the
 * round — it never moves. The only live feedback is a ring around the code
 * inputs themselves, echoing the color the typed code currently produces,
 * so the player can compare it against the fixed swatch by eye.
 *
 * The round doesn't end by accident: typing never auto-completes it. The
 * player commits their answer with "Submit" — the same explicit,
 * scored-on-demand flow Point mode uses for "Confirm placement".
 */

const GuesserMode = (() => {
  const HINT_PENALTY = 6; // score points lost per "How close?" press
  const START_RGB = { r: 153, g: 153, b: 153 }; // neutral gray starting point

  function create(ctx) {
    const { dom, sounds, onWin } = ctx;

    let target = null; // { r, g, b }
    let hintsUsed = 0;
    let active = false;
    let confirmed = false;

    // The fixed target swatch — set once per round, never touched by input.
    function applyTargetSwatch(rgb) {
      dom.liveSwatch.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    // The live ring around the code inputs, echoing whatever the typed
    // code currently produces, so it can be compared against the fixed swatch.
    function applyLiveOutline(rgb) {
      const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      if (dom.codeInput) dom.codeInput.style.setProperty("--live-outline", rgbStr);
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

    function setInputsDisabled(disabled) {
      dom.rgbBoxes.r.disabled = disabled;
      dom.rgbBoxes.g.disabled = disabled;
      dom.rgbBoxes.b.disabled = disabled;
      dom.hexBox.disabled = disabled;
      dom.howCloseBtn.disabled = disabled;
      dom.submitBtn.disabled = disabled;
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
      applyLiveOutline(rgb);
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
      applyLiveOutline(rgb);
    }

    function onHowClose() {
      if (!active || confirmed) return;
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
    }

    // Scored the same way Point mode scores "Confirm placement": lock in
    // whatever's currently typed, compute the match, and end the round —
    // no silent auto-completion, just an explicit submit.
    function onSubmit() {
      if (!active || confirmed) return;
      confirmed = true;
      active = false;
      setInputsDisabled(true);

      const rgb = readRGBFromInputs();
      const score = ColorEngine.perceptualScore(rgb, target);
      const finalScore = Math.max(0, Math.round(score - hintsUsed * HINT_PENALTY));

      if (score >= 90) sounds.playCorrect();
      else if (score >= 60) sounds.playClose();
      else sounds.playWrong();

      const label = ColorEngine.scoreLabel(score);
      dom.feedback.textContent = `${label} — ${Math.round(score)}% match`;
      dom.feedback.classList.remove("pop");
      // eslint-disable-next-line no-unused-expressions
      dom.feedback.offsetWidth;
      dom.feedback.classList.add("pop");

      onWin({
        mode: "guesser",
        guess: rgb,
        target,
        score,
        finalScore,
        hintsUsed,
      });
    }

    function newRound(difficulty) {
      target = ColorEngine.randomRGBConstrained(difficulty);
      hintsUsed = 0;
      active = true;
      confirmed = false;
      setInputsDisabled(false);
      dom.feedback.textContent = "Type a code, then submit your guess.";
      dom.feedback.classList.remove("pop");
      applyTargetSwatch(target);
      applyLiveOutline(START_RGB);
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
      dom.submitBtn.addEventListener("click", onSubmit);
      newRound(ctx.getDifficulty());
    }

    function deactivate() {
      active = false;
      setInputsDisabled(false);
      dom.rgbBoxes.r.removeEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.g.removeEventListener("input", onRgbBoxInput);
      dom.rgbBoxes.b.removeEventListener("input", onRgbBoxInput);
      dom.hexBox.removeEventListener("input", onHexBoxInput);
      dom.howCloseBtn.removeEventListener("click", onHowClose);
      dom.submitBtn.removeEventListener("click", onSubmit);
    }

    return {
      activate,
      deactivate,
      newRound: () => newRound(ctx.getDifficulty()),
    };
  }

  return { create };
})();
