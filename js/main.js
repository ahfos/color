/**
 * main.js
 * Wires the landing page, the shared color map, both game modes, the
 * results screen, the wallpaper export flow, and the share-to-story
 * feature together.
 */

(function () {
  "use strict";

  const dom = {
    homeView: document.getElementById("homeView"),
    gameView: document.getElementById("gameView"),
    enterModeBtns: Array.from(document.querySelectorAll("[data-enter-mode]")),
    backToHomeBtn: document.getElementById("backToHomeBtn"),

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
    bestCounter: document.getElementById("bestCounter"),

    shareTriggerBtn: document.getElementById("shareTriggerBtn"),
    shareStoryOverlay: document.getElementById("shareStoryOverlay"),
    shareStoryBackdrop: document.getElementById("shareStoryBackdrop"),
    shareStoryCanvas: document.getElementById("shareStoryCanvas"),
    shareStoryLoading: document.getElementById("shareStoryLoading"),
    shareStoryShareBtn: document.getElementById("shareStoryShareBtn"),
    shareStoryStatus: document.getElementById("shareStoryStatus"),
    shareStoryCloseBtn: document.getElementById("shareStoryCloseBtn"),
  };

  const BEST_STREAK_PREFIX = "color-best-streak-";

  function loadBestStreak(mode) {
    try {
      return parseInt(localStorage.getItem(BEST_STREAK_PREFIX + mode), 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBestStreak(mode, value) {
    try {
      localStorage.setItem(BEST_STREAK_PREFIX + mode, String(value));
    } catch {
      /* private browsing / storage disabled — best streak just won't persist */
    }
  }

  const gameState = {
    started: false,
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
      if (activeController && activeController.onGrab) activeController.onGrab();
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

  function controllerFor(mode) {
    return mode === "guesser" ? guesserController : pointerController;
  }

  function handleRoundEnd(result) {
    // A round can auto-complete mid-drag (Guesser mode's win check fires
    // from inside the map's rAF loop). Pointer Events keep delivering move
    // events to whatever element called setPointerCapture() regardless of
    // what's now on top of it, so without this a drag in progress could
    // keep silently steering the marker underneath the results modal.
    colorMap.cancelInteraction();

    gameState.lastResult = result;
    gameState.score += result.finalScore;
    if (result.finalScore >= 70) gameState.streak += 1;
    else gameState.streak = 0;

    const best = Math.max(loadBestStreak(gameState.mode), gameState.streak);
    saveBestStreak(gameState.mode, best);

    dom.scoreCounter.textContent = String(gameState.score);
    dom.streakCounter.textContent = String(gameState.streak);
    dom.bestCounter.textContent = String(best);

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

  function updateModeButtons(mode) {
    dom.modeButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
      btn.setAttribute("aria-selected", String(btn.dataset.mode === mode));
    });
  }

  function switchMode(mode) {
    if (mode === gameState.mode) return;
    activeController.deactivate();
    colorMap.cancelInteraction();
    gameState.mode = mode;
    activeController = controllerFor(mode);
    updateModeButtons(mode);
    activeController.activate();
    dom.bestCounter.textContent = String(loadBestStreak(mode));
  }

  function switchFormat(format) {
    dom.formatToggleBtns.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.format === format));
    dom.formatFields.rgb.hidden = format !== "rgb";
    dom.formatFields.hex.hidden = format !== "hex";
  }

  // ---- home / game navigation ----

  function enterMode(mode) {
    sounds.unlock();
    if (!gameState.started) {
      gameState.started = true;
      gameState.mode = mode;
      activeController = controllerFor(mode);
      updateModeButtons(mode);
      activeController.activate();
      dom.gameView.classList.add("page-enter");
    } else if (mode !== gameState.mode) {
      switchMode(mode);
    }
    dom.bestCounter.textContent = String(loadBestStreak(gameState.mode));
    dom.homeView.hidden = true;
    dom.gameView.hidden = false;
  }

  function goHome() {
    dom.gameView.hidden = true;
    dom.homeView.hidden = false;
  }

  dom.enterModeBtns.forEach((btn) => {
    btn.addEventListener("click", () => enterMode(btn.dataset.enterMode));
  });

  dom.backToHomeBtn.addEventListener("click", goHome);

  // ---- share to Instagram Story ----

  let shareReady = false;
  let shareBusy = false;

  function openShareModal() {
    sounds.unlock();
    dom.shareStoryOverlay.hidden = false;
    shareReady = false;
    dom.shareStoryShareBtn.disabled = true;
    dom.shareStoryStatus.hidden = true;
    dom.shareStoryLoading.hidden = false;
    dom.shareStoryLoading.textContent = "Rendering…";

    Share.drawStoryCard(dom.shareStoryCanvas, "assets/logo.svg")
      .then(() => {
        shareReady = true;
        dom.shareStoryShareBtn.disabled = false;
        dom.shareStoryLoading.hidden = true;
      })
      .catch(() => {
        dom.shareStoryLoading.textContent = "Couldn't render the preview.";
      });
  }

  function closeShareModal() {
    dom.shareStoryOverlay.hidden = true;
  }

  async function handleShareClick() {
    if (!shareReady || shareBusy) return;
    shareBusy = true;
    dom.shareStoryShareBtn.textContent = "Preparing…";
    dom.shareStoryStatus.hidden = true;
    try {
      const result = await Share.shareStoryImage(dom.shareStoryCanvas, Share.gameShareUrl());
      dom.shareStoryStatus.textContent = result.message;
      dom.shareStoryStatus.hidden = false;
    } catch {
      dom.shareStoryStatus.textContent = "Couldn't share the image — try again.";
      dom.shareStoryStatus.hidden = false;
    } finally {
      shareBusy = false;
      dom.shareStoryShareBtn.textContent = "Share to Instagram Story";
    }
  }

  dom.shareTriggerBtn.addEventListener("click", openShareModal);
  dom.shareStoryBackdrop.addEventListener("click", closeShareModal);
  dom.shareStoryCloseBtn.addEventListener("click", closeShareModal);
  dom.shareStoryShareBtn.addEventListener("click", handleShareClick);

  // ---- other event wiring ----

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
})();
