/**
 * main.js
 * Wires the shared color map, both game modes, the results screen and the
 * wallpaper export flow together.
 */

(function () {
  "use strict";

  const dom = {
    modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
    guesserOnly: Array.from(document.querySelectorAll("[data-guesser-only]")),
    pointerOnly: Array.from(document.querySelectorAll("[data-pointer-only]")),
    liveSwatch: document.getElementById("liveSwatch"),
    rgbBoxes: {
      r: document.querySelector('[data-channel="r"]'),
      g: document.querySelector('[data-channel="g"]'),
      b: document.querySelector('[data-channel="b"]'),
    },
    hexBox: document.querySelector('[data-channel="hex"]'),
    formatToggleBtns: Array.from(document.querySelectorAll("[data-format]")),
    formatFields: {
      rgb: document.querySelector('[data-format-fields="rgb"]'),
      hex: document.querySelector('[data-format-fields="hex"]'),
    },
    pointerTargetCode: document.getElementById("pointerTargetCode"),
    howCloseBtn: document.getElementById("howCloseBtn"),
    confirmBtn: document.getElementById("confirmBtn"),
    newRoundBtn: document.getElementById("newRoundBtn"),
    feedback: document.getElementById("feedback"),
    mapRoot: document.querySelector("[data-color-map]"),

    resultsOverlay: document.getElementById("resultsOverlay"),
    resultsTitle: document.getElementById("resultsTitle"),
    resultGuessSwatch: document.getElementById("resultGuessSwatch"),
    resultGuessCode: document.getElementById("resultGuessCode"),
    resultTargetSwatch: document.getElementById("resultTargetSwatch"),
    resultTargetCode: document.getElementById("resultTargetCode"),
    resultsScore: document.getElementById("resultsScore"),
    wallpaperBtn: document.getElementById("wallpaperBtn"),
    playAgainBtn: document.getElementById("playAgainBtn"),

    wallpaperOverlay: document.getElementById("wallpaperOverlay"),
    wallpaperCancelBtn: document.getElementById("wallpaperCancelBtn"),
    wallpaperDownloadBtn: document.getElementById("wallpaperDownloadBtn"),
    wallpaperShowHex: document.getElementById("wallpaperShowHex"),

    scoreCounter: document.getElementById("scoreCounter"),
    streakCounter: document.getElementById("streakCounter"),
  };

  const gameState = {
    mode: "guesser",
    score: 0,
    streak: 0,
    difficulty: "full", // 'full' | 'pastels' | 'bold'
    lastResult: null,
  };

  let onMapChangeHandler = null;
  let activeController = null;
  const sounds = Sounds;

  const colorMap = ColorMap.create(dom.mapRoot, {
    initialHSV: { h: 0, s: 0, v: 60 },
    onChange: (hsv) => {
      if (onMapChangeHandler) onMapChangeHandler(hsv);
    },
    onGrab: () => {
      sounds.playGrab();
      dom.mapRoot.classList.add("is-dragging");
      if (activeController.onGrab) activeController.onGrab();
    },
    onRelease: () => {
      sounds.playRelease();
      dom.mapRoot.classList.remove("is-dragging");
    },
  });

  const sharedCtx = {
    dom,
    colorMap,
    sounds,
    setOnMapChange: (fn) => {
      onMapChangeHandler = fn;
    },
    getDifficulty: () => gameState.difficulty,
    onWin: handleRoundEnd,
  };

  const guesserController = GuesserMode.create(sharedCtx);
  const pointerController = PointerMode.create(sharedCtx);
  activeController = guesserController;

  function handleRoundEnd(result) {
    gameState.lastResult = result;
    gameState.score += result.finalScore;
    if (result.finalScore >= 70) gameState.streak += 1;
    else gameState.streak = 0;
    dom.scoreCounter.textContent = String(gameState.score);
    dom.streakCounter.textContent = String(gameState.streak);
    showResults(result);
  }

  function showResults(result) {
    const { guess, target, score, finalScore, mode } = result;
    dom.resultsTitle.textContent =
      finalScore >= 90 ? "Nailed it" : finalScore >= 65 ? "Nice guess" : "So close";
    dom.resultGuessSwatch.style.background = `rgb(${guess.r}, ${guess.g}, ${guess.b})`;
    dom.resultGuessCode.textContent = `#${ColorEngine.rgbToHex(guess)}`;
    dom.resultTargetSwatch.style.background = `rgb(${target.r}, ${target.g}, ${target.b})`;
    dom.resultTargetCode.textContent = `#${ColorEngine.rgbToHex(target)}`;
    dom.resultsScore.textContent = `${Math.round(score)}% match · ${finalScore} pts${
      mode === "guesser" && result.hintsUsed ? ` (${result.hintsUsed} hint${result.hintsUsed > 1 ? "s" : ""} used)` : ""
    }`;
    dom.resultsOverlay.hidden = false;
    dom.resultsOverlay.classList.add("page-enter");
  }

  function hideResults() {
    dom.resultsOverlay.hidden = true;
  }

  function switchMode(mode) {
    if (mode === gameState.mode) return;
    activeController.deactivate();
    gameState.mode = mode;
    activeController = mode === "guesser" ? guesserController : pointerController;
    dom.modeButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
      btn.setAttribute("aria-selected", String(btn.dataset.mode === mode));
    });
    activeController.activate();
  }

  function switchFormat(format) {
    dom.formatToggleBtns.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.format === format));
    dom.formatFields.rgb.hidden = format !== "rgb";
    dom.formatFields.hex.hidden = format !== "hex";
  }

  // ---- event wiring ----

  dom.modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sounds.unlock();
      switchMode(btn.dataset.mode);
    });
  });

  dom.formatToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchFormat(btn.dataset.format));
  });

  dom.newRoundBtn.addEventListener("click", () => {
    sounds.unlock();
    hideResults();
    activeController.newRound();
  });

  dom.playAgainBtn.addEventListener("click", () => {
    hideResults();
    activeController.newRound();
  });

  dom.wallpaperBtn.addEventListener("click", () => {
    dom.wallpaperOverlay.hidden = false;
  });

  dom.wallpaperCancelBtn.addEventListener("click", () => {
    dom.wallpaperOverlay.hidden = true;
  });

  dom.wallpaperDownloadBtn.addEventListener("click", () => {
    if (!gameState.lastResult) return;
    const orientation =
      document.querySelector('input[name="wallpaperOrientation"]:checked')?.value || "landscape";
    const showHex = dom.wallpaperShowHex.checked;
    // Save the target color — the "true" answer — as the wallpaper.
    Wallpaper.exportWallpaper(gameState.lastResult.target, orientation, { showHex });
    dom.wallpaperOverlay.hidden = true;
  });

  // Unlock audio on first interaction anywhere (mobile autoplay policies).
  window.addEventListener(
    "pointerdown",
    () => {
      sounds.unlock();
    },
    { once: true }
  );

  // ---- boot ----
  switchFormat("rgb");
  activeController.activate();
})();
