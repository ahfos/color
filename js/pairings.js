/**
 * pairings.js
 * "Color Pairings" — enter any hex/RGB, see it plotted on a hue/saturation
 * wheel alongside its complementary / analogous / triadic / split-comp /
 * tetradic / monochromatic matches, and read every format (hex, RGB, CMYK,
 * HSL) plus a nearest color name and WCAG text-contrast readout in a bento
 * grid below — exportable as a PNG.
 *
 * Self-contained: owns its own view toggle (home <-> pairingsView) and
 * doesn't touch GuesserMode/PointerMode/main.js state. All DOM lookups are
 * scoped under #pairingsView (plus the shared #homeView) so its data-*
 * attributes never collide with the game's [data-format]/[data-channel]
 * selectors.
 */

(function () {
  "use strict";

  const root = document.getElementById("pairingsView");
  if (!root) return; // markup not present — nothing to wire up

  const homeView = document.getElementById("homeView");
  const openBtn = document.getElementById("openPairingsBtn");
  const backBtn = document.getElementById("pairingsBackBtn");
  const logoBtn = document.getElementById("pairingsLogoBtn");

  const formatToggleBtns = Array.from(root.querySelectorAll("[data-pairings-format]"));
  const formatFields = {
    hex: root.querySelector('[data-pairings-format-fields="hex"]'),
    rgb: root.querySelector('[data-pairings-format-fields="rgb"]'),
  };
  const hexBox = root.querySelector('[data-pairings-channel="hex"]');
  const rgbBoxes = {
    r: root.querySelector('[data-pairings-channel="r"]'),
    g: root.querySelector('[data-pairings-channel="g"]'),
    b: root.querySelector('[data-pairings-channel="b"]'),
  };
  const codeInputEl = root.querySelector("[data-pairings-code-input]");
  const randomBtn = document.getElementById("pairingsRandomBtn");
  const harmonyTabs = Array.from(root.querySelectorAll("[data-harmony]"));
  const wheelRoot = root.querySelector("[data-pairings-wheel]");
  const wheelNote = root.querySelector("[data-pairings-wheel-note]");
  const bentoEl = document.getElementById("pairingsBento");
  const recentEl = document.getElementById("pairingsRecent");
  const copyAllBtn = document.getElementById("pairingsCopyAllBtn");
  const shareLinkBtn = document.getElementById("pairingsShareLinkBtn");
  const exportBtn = document.getElementById("pairingsExportBtn");
  const feedback = document.getElementById("pairingsFeedback");

  const sounds = typeof Sounds !== "undefined" ? Sounds : { unlock() {}, playGrab() {}, playRelease() {}, playCorrect() {} };

  const RECENT_KEY = "color-pairings-recent";
  const RECENT_MAX = 10;

  const state = {
    rgb: { r: 51, g: 153, b: 255 },
    harmony: "complementary",
    entered: false,
  };

  let feedbackTimer = 0;

  // ---------- persistence ----------

  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((h) => ColorEngine.isValidHex(h)) : [];
    } catch {
      return [];
    }
  }

  function saveRecent(list) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch {
      /* private browsing / storage disabled — recents just won't persist */
    }
  }

  function pushRecent(hex) {
    const list = loadRecent().filter((h) => h.toUpperCase() !== hex.toUpperCase());
    list.unshift(hex.toUpperCase());
    saveRecent(list);
    renderRecent();
  }

  function renderRecent() {
    if (!recentEl) return;
    const list = loadRecent();
    recentEl.innerHTML = "";
    recentEl.hidden = list.length === 0;
    list.forEach((hex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pairings-recent__swatch";
      btn.style.background = `#${hex}`;
      btn.setAttribute("aria-label", `Load #${hex}`);
      btn.title = `#${hex}`;
      btn.addEventListener("click", () => {
        sounds.unlock();
        setBase(ColorEngine.hexToRgb(hex), { pushToRecent: false });
      });
      recentEl.appendChild(btn);
    });
  }

  // ---------- url share state ----------

  function syncUrl() {
    try {
      const params = new URLSearchParams(location.search);
      params.set("c", ColorEngine.rgbToHex(state.rgb));
      params.set("h", state.harmony);
      const url = `${location.pathname}?${params.toString()}${location.hash || ""}`;
      history.replaceState(null, "", url);
    } catch {
      /* noop — non-browser or restricted context */
    }
  }

  function readUrlState() {
    try {
      const params = new URLSearchParams(location.search);
      const c = params.get("c");
      const h = params.get("h");
      const rgb = c && ColorEngine.isValidHex(c) ? ColorEngine.hexToRgb(c) : null;
      const harmony = h && ColorEngine.HARMONY_TYPES.some((t) => t.id === h) ? h : null;
      return { rgb, harmony, present: !!(rgb || harmony) };
    } catch {
      return { rgb: null, harmony: null, present: false };
    }
  }

  // ---------- input <-> state ----------

  function syncInputsFromRGB(rgb) {
    rgbBoxes.r.value = rgb.r;
    rgbBoxes.g.value = rgb.g;
    rgbBoxes.b.value = rgb.b;
    hexBox.value = ColorEngine.rgbToHex(rgb);
  }

  function applyLiveOutline(rgb) {
    if (codeInputEl) codeInputEl.style.setProperty("--live-outline", `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
  }

  function switchFormat(format) {
    formatToggleBtns.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.pairingsFormat === format));
    formatFields.rgb.hidden = format !== "rgb";
    formatFields.hex.hidden = format !== "hex";
  }

  function onHexInput(e) {
    const cleaned = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
    if (cleaned !== e.target.value) e.target.value = cleaned;
    if (!ColorEngine.isValidHex(cleaned)) return;
    setBase(ColorEngine.hexToRgb(cleaned), { syncInputs: false });
  }

  function onRgbInput(e) {
    const clamped = ColorEngine.clamp(parseInt(e.target.value, 10) || 0, 0, 255);
    if (String(clamped) !== e.target.value) e.target.value = clamped;
    const rgb = {
      r: ColorEngine.clamp(parseInt(rgbBoxes.r.value, 10) || 0, 0, 255),
      g: ColorEngine.clamp(parseInt(rgbBoxes.g.value, 10) || 0, 0, 255),
      b: ColorEngine.clamp(parseInt(rgbBoxes.b.value, 10) || 0, 0, 255),
    };
    setBase(rgb, { syncInputs: false });
  }

  // ---------- core render ----------

  function enrich(entry, baseHsv) {
    const { label, rgb } = entry;
    return {
      label,
      rgb,
      hex: ColorEngine.rgbToHex(rgb),
      cmyk: ColorEngine.rgbToCmyk(rgb),
      hsl: ColorEngine.rgbToHsl(rgb),
      name: ColorNames.nearest(rgb),
      contrastWhite: withTier(ColorEngine.contrastRatio(rgb, { r: 255, g: 255, b: 255 })),
      contrastBlack: withTier(ColorEngine.contrastRatio(rgb, { r: 0, g: 0, b: 0 })),
      // Monochromatic variants only differ in value — force them to the
      // same wheel position as Base instead of letting rounding scatter
      // them slightly, since a hue/sat wheel can't represent lightness.
      hue: baseHsv ? baseHsv.h : undefined,
      sat: baseHsv ? baseHsv.s : undefined,
    };
  }

  function withTier(ratio) {
    return { ratio, tier: ColorEngine.contrastTier(ratio) };
  }

  function currentColors() {
    const baseHsv = state.harmony === "monochromatic" ? ColorEngine.rgbToHsv(state.rgb) : null;
    return ColorEngine.getHarmony(state.rgb, state.harmony).map((entry) => enrich(entry, baseHsv));
  }

  function render() {
    const colors = currentColors();

    wheelController.setColors(
      colors.map((c, idx) => ({
        id: `c${idx}`,
        rgb: c.rgb,
        label: `${c.label} · #${c.hex}`,
        hue: c.hue,
        sat: c.sat,
      }))
    );

    if (wheelNote) wheelNote.hidden = state.harmony !== "monochromatic";

    renderBento(colors);
  }

  function copyRow(text, label) {
    const done = () => showFeedback(`Copied ${label}`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      done();
    }
    sounds.playGrab();
  }

  function renderBento(colors) {
    bentoEl.innerHTML = "";
    colors.forEach((c, idx) => {
      const card = document.createElement("article");
      card.className = "pairing-card" + (idx === 0 ? " pairing-card--base" : "");

      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "pairing-card__swatch";
      swatch.style.background = `rgb(${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b})`;
      swatch.setAttribute("aria-label", `Copy hex ${c.hex}`);
      const swatchLabel = document.createElement("span");
      swatchLabel.className = "pairing-card__swatch-label";
      swatchLabel.textContent = c.label;
      swatchLabel.style.color = bestTextColor(c.rgb);
      swatch.appendChild(swatchLabel);
      swatch.addEventListener("click", () => copyRow(`#${c.hex}`, `#${c.hex}`));
      card.appendChild(swatch);

      const body = document.createElement("div");
      body.className = "pairing-card__body";

      const name = document.createElement("h3");
      name.className = "pairing-card__name";
      name.textContent = c.name;
      body.appendChild(name);

      const rows = [
        [`#${c.hex}`, `#${c.hex}`],
        [`RGB ${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b}`, `${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b}`],
        [`CMYK ${c.cmyk.c}, ${c.cmyk.m}, ${c.cmyk.y}, ${c.cmyk.k}`, `${c.cmyk.c}, ${c.cmyk.m}, ${c.cmyk.y}, ${c.cmyk.k}`],
        [`HSL ${Math.round(c.hsl.h)}, ${Math.round(c.hsl.s)}%, ${Math.round(c.hsl.l)}%`, `${Math.round(c.hsl.h)}, ${Math.round(c.hsl.s)}%, ${Math.round(c.hsl.l)}%`],
      ];
      rows.forEach(([display, copyValue]) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "pairing-code-row";
        row.textContent = display;
        row.addEventListener("click", () => copyRow(copyValue, display));
        body.appendChild(row);
      });

      const contrast = document.createElement("div");
      contrast.className = "pairing-card__contrast";
      contrast.innerHTML =
        `<span class="pairing-badge pairing-badge--${badgeTone(c.contrastWhite.tier)}">White text ${c.contrastWhite.tier}</span>` +
        `<span class="pairing-badge pairing-badge--${badgeTone(c.contrastBlack.tier)}">Black text ${c.contrastBlack.tier}</span>`;
      body.appendChild(contrast);

      card.appendChild(body);
      bentoEl.appendChild(card);
    });
  }

  function badgeTone(tier) {
    if (tier === "AAA" || tier === "AA") return "pass";
    if (tier === "AA Large") return "warn";
    return "fail";
  }

  function bestTextColor(rgb) {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    return ColorEngine.contrastRatio(rgb, white) >= ColorEngine.contrastRatio(rgb, black) ? "#ffffff" : "#000000";
  }

  function showFeedback(text) {
    if (!feedback) return;
    feedback.textContent = text;
    feedback.classList.remove("pop");
    void feedback.offsetWidth; // restart animation
    feedback.classList.add("pop");
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = "";
    }, 2200);
  }

  // ---------- public state mutation ----------

  function setBase(rgb, { syncInputs = true, pushToRecent = true, animate = true } = {}) {
    state.rgb = rgb;
    if (syncInputs) syncInputsFromRGB(rgb);
    applyLiveOutline(rgb);
    render();
    syncUrl();
    if (pushToRecent) pushRecent(ColorEngine.rgbToHex(rgb));
  }

  function setHarmony(type) {
    if (type === state.harmony) return;
    state.harmony = type;
    harmonyTabs.forEach((btn) => {
      const active = btn.dataset.harmony === type;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    render();
    syncUrl();
  }

  // ---------- wheel ----------

  const wheelController = PairingsWheel.create(wheelRoot, {
    interactive: true,
    onGrab: () => sounds.playGrab(),
    onRelease: () => {
      sounds.playRelease();
      pushRecent(ColorEngine.rgbToHex(state.rgb));
    },
    onDrag: ({ h, s }) => {
      const rgb = ColorEngine.hsvToRgb({ h, s, v: 100 });
      setBase(rgb, { pushToRecent: false });
    },
  });

  // ---------- wiring ----------

  formatToggleBtns.forEach((btn) => btn.addEventListener("click", () => switchFormat(btn.dataset.pairingsFormat)));
  hexBox.addEventListener("input", onHexInput);
  rgbBoxes.r.addEventListener("input", onRgbInput);
  rgbBoxes.g.addEventListener("input", onRgbInput);
  rgbBoxes.b.addEventListener("input", onRgbInput);

  harmonyTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      sounds.unlock();
      setHarmony(btn.dataset.harmony);
    });
  });

  randomBtn.addEventListener("click", () => {
    sounds.unlock();
    setBase(ColorEngine.randomRGBConstrained("bold"), { syncInputs: true });
    showFeedback("New random color");
  });

  copyAllBtn.addEventListener("click", () => {
    const colors = currentColors();
    const text = colors
      .map((c) => `${c.label}: #${c.hex} | RGB ${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b} | CMYK ${c.cmyk.c}, ${c.cmyk.m}, ${c.cmyk.y}, ${c.cmyk.k} | HSL ${Math.round(c.hsl.h)}, ${Math.round(c.hsl.s)}%, ${Math.round(c.hsl.l)}%`)
      .join("\n");
    copyRow(text, "all colors");
  });

  shareLinkBtn.addEventListener("click", () => {
    syncUrl();
    copyRow(location.href, "link");
  });

  exportBtn.addEventListener("click", () => {
    sounds.unlock();
    const colors = currentColors();
    const harmonyMeta = ColorEngine.HARMONY_TYPES.find((t) => t.id === state.harmony);
    BentoExport.exportPNG(colors, { harmonyId: state.harmony, harmonyLabel: harmonyMeta ? harmonyMeta.label : state.harmony });
    sounds.playCorrect();
    showFeedback("Exported PNG");
  });

  function enter(initial) {
    sounds.unlock();
    if (!state.entered) {
      state.entered = true;
      root.classList.add("page-enter");
    }
    homeView.hidden = true;
    root.hidden = false;
    if (initial && initial.rgb) setBase(initial.rgb, { pushToRecent: false });
    if (initial && initial.harmony) setHarmony(initial.harmony);
    if (!initial) render();
    wheelController.refreshLayout();
  }

  function goHome() {
    root.hidden = true;
    homeView.hidden = false;
  }

  if (openBtn) openBtn.addEventListener("click", () => enter());
  if (backBtn) backBtn.addEventListener("click", goHome);
  if (logoBtn) logoBtn.addEventListener("click", goHome);

  // ---------- boot ----------

  switchFormat("hex");
  syncInputsFromRGB(state.rgb);
  applyLiveOutline(state.rgb);
  renderRecent();
  render();

  // If the page was opened from a shared Pairings link (?c=&h=), jump
  // straight into the view with that palette instead of the landing page.
  const urlState = readUrlState();
  if (urlState.present) {
    if (urlState.harmony) state.harmony = urlState.harmony;
    harmonyTabs.forEach((btn) => {
      const active = btn.dataset.harmony === state.harmony;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    enter({ rgb: urlState.rgb, harmony: null });
  }
})();
