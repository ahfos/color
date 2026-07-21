/**
 * sounds.js
 * Shared audio + haptic feedback layer.
 *
 * Haptics reality check (see build brief):
 *  - Android Chrome/Samsung Internet: navigator.vibrate() works.
 *  - iOS Safari: no Vibration API, full stop. WebKit has never shipped it.
 *  - Trackpads: no public web API exists at all.
 * So real vibration is a progressive enhancement on Android only. Everywhere
 * else we lean on a tuned WebAudio "glass" tick (same synthesis approach as
 * TypedUp's sounds.ts) plus a snappy CSS scale/bounce on the marker, so the
 * game still feels tactile on iOS/desktop.
 */

const Sounds = (() => {
  let audioCtx = null;
  let audioEnabled = true;
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

  function getAudioContext() {
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === "suspended") void audioCtx.resume();
      return audioCtx;
    } catch {
      return null;
    }
  }

  /** Must be called from within a user-gesture handler at least once (mobile autoplay policies). */
  function unlock() {
    getAudioContext();
  }

  function playGlassNotes(notes) {
    if (!audioEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.85;

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 1200;
    highpass.Q.value = 0.7;

    master.connect(highpass);
    highpass.connect(ctx.destination);

    for (const note of notes) {
      const start = t0 + note.at;
      const end = start + note.duration;
      const partials = [
        { ratio: 1, gain: 1 },
        { ratio: 2.4, gain: 0.22 },
        { ratio: 4.1, gain: 0.08 },
      ];

      for (const partial of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.detune.value = note.detune || 0;

        const f0 = note.frequency * partial.ratio;
        osc.frequency.setValueAtTime(f0, start);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.06, start + 0.018);

        const peak = note.gain * partial.gain;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), start + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(end + 0.04);
      }
    }
  }

  function playGrab() {
    playGlassNotes([{ frequency: 2000, at: 0, duration: 0.04, gain: 0.03 }]);
    vibrate(8);
  }

  function playRelease() {
    playGlassNotes([{ frequency: 1600, at: 0, duration: 0.05, gain: 0.03 }]);
    vibrate(6);
  }

  function playHover() {
    playGlassNotes([{ frequency: 3200, at: 0, duration: 0.05, gain: 0.024 }]);
  }

  function playCorrect() {
    playGlassNotes([
      { frequency: 2400, at: 0, duration: 0.1, gain: 0.045 },
      { frequency: 3600, at: 0.07, duration: 0.14, gain: 0.055 },
      { frequency: 4800, at: 0.14, duration: 0.18, gain: 0.042 },
    ]);
    vibrate([15, 40, 15, 40, 30]);
  }

  function playClose() {
    playGlassNotes([
      { frequency: 2600, at: 0, duration: 0.08, gain: 0.038 },
      { frequency: 3400, at: 0.05, duration: 0.1, gain: 0.03 },
    ]);
    vibrate([10, 30, 10]);
  }

  function playWrong() {
    playGlassNotes([
      { frequency: 1800, at: 0, duration: 0.09, gain: 0.045, detune: -8 },
      { frequency: 1100, at: 0.06, duration: 0.12, gain: 0.04, detune: 6 },
    ]);
    vibrate(20);
  }

  /** Feature-detected vibration. Silently no-ops on iOS/desktop/trackpad. */
  function vibrate(pattern) {
    if (!canVibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }

  function setEnabled(enabled) {
    audioEnabled = enabled;
  }

  return {
    unlock,
    playGrab,
    playRelease,
    playHover,
    playCorrect,
    playClose,
    playWrong,
    vibrate,
    setEnabled,
    canVibrate,
  };
})();
