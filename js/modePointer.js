/**
 * modePointer.js
 * Mode 2 — "Color → Code". The player is given a code as text (no swatch)
 * and places a marker on the map where they believe that color lives.
 */

const PointerMode = (() => {
  function create(ctx) {
    const { dom, colorMap, sounds, onWin } = ctx;

    let target = null; // { r, g, b }
    let confirmed = false;
    let active = false;

    function randomDisplayFormat(rgb) {
      const asHex = Math.random() < 0.5;
      return asHex ? `#${ColorEngine.rgbToHex(rgb)}` : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    function onMapChange() {
      // Pointer mode has no live swatch by design — the map itself is the
      // only visual feedback, so the player must reason from the code to a
      // position rather than converging on a shown preview.
    }

    function onConfirm() {
      if (!active || confirmed) return;
      confirmed = true;
      const guessRgb = ColorEngine.hsvToRgb(colorMap.getHSV());
      const score = ColorEngine.perceptualScore(guessRgb, target);

      colorMap.showGhostHSV(ColorEngine.rgbToHsv(target));
      colorMap.setInteractive(false);

      const label = ColorEngine.scoreLabel(score);
      dom.feedback.textContent = `${label} — ${Math.round(score)}% match`;
      dom.feedback.classList.remove("pop");
      // eslint-disable-next-line no-unused-expressions
      dom.feedback.offsetWidth;
      dom.feedback.classList.add("pop");

      if (score >= 90) sounds.playCorrect();
      else if (score >= 60) sounds.playClose();
      else sounds.playWrong();

      active = false;
      onWin({
        mode: "pointer",
        guess: guessRgb,
        target,
        score,
        finalScore: Math.round(score),
        hintsUsed: 0,
      });
    }

    function newRound(difficulty) {
      target = ColorEngine.randomRGBConstrained(difficulty);
      confirmed = false;
      active = true;
      colorMap.hideGhost();
      colorMap.setInteractive(true);
      dom.pointerTargetCode.textContent = randomDisplayFormat(target);
      dom.feedback.textContent = "Tap or drag on the map to place your guess, then confirm.";
      dom.feedback.classList.remove("pop");
      colorMap.setHSV({ h: 0, s: 0, v: 60 }, { animate: false });
    }

    function activate() {
      dom.guesserOnly.forEach((el) => (el.hidden = true));
      dom.pointerOnly.forEach((el) => (el.hidden = false));
      colorMap.setInteractive(true);
      dom.confirmBtn.addEventListener("click", onConfirm);
      ctx.setOnMapChange(onMapChange);
      newRound(ctx.getDifficulty());
    }

    function deactivate() {
      active = false;
      dom.confirmBtn.removeEventListener("click", onConfirm);
      colorMap.hideGhost();
    }

    function onGrab() {
      /* no-op: pointer mode doesn't sync a text input */
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
