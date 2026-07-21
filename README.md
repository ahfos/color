# COLOR

A color-code spotting game — companion to [TypedUp](https://github.com/ahfos/typedup). Get faster and more accurate at reading RGB/Hex values, and vice versa.

Play at **[ahfos.github.io/color](https://ahfos.github.io/color)**.

## Modes

- **Code → Color** — A target color is hidden. Type an RGB or Hex value (or drag the map) to converge on it. "How close?" reveals a proximity score at the cost of a hint.
- **Color → Code** — You're given a code as text. Place a marker on the HSV map where you believe that color lives, then confirm to see how close you were.

Both modes share the same HSV color map (a 2D saturation/value square + hue slider), the same color engine (RGB↔Hex↔HSV conversion, weighted-Euclidean + CIEDE2000 distance scoring), and the same results/wallpaper-export flow.

## Stack

Plain HTML/CSS/JS, no build step or dependencies. Shares design tokens (colors, type, spacing, transitions) with TypedUp so the two feel like one family.

```
color/
├── index.html
├── css/
│   ├── theme.css       (design tokens, shared visual language with TypedUp)
│   └── color.css       (game-specific layout)
├── js/
│   ├── colorEngine.js  (random gen, RGB/Hex/HSV conversion, distance scoring)
│   ├── colorMap.js     (SV square + hue slider, pointer handling, lerp animation)
│   ├── sounds.js        (WebAudio feedback + feature-detected haptics)
│   ├── modeGuesser.js   (Code → Color)
│   ├── modePointer.js   (Color → Code)
│   ├── wallpaper.js     (4K solid-color wallpaper export)
│   └── main.js           (wiring, results screen, mode switching)
└── assets/
    └── logo.svg
```

## Local dev

No build step — just serve the folder statically, e.g.:

```
npx serve .
```

## Deploy

Push to `main`; a GitHub Actions workflow (`.github/workflows/deploy.yml`) publishes the static site to GitHub Pages at `https://ahfos.github.io/color/`.

## Notes on the color map

The picker is a real HSV picker (2D saturation/value square + 1D hue strip), not a flat gradient. Performance techniques used to keep it feeling tactile rather than laggy:

- Gradient backgrounds are canvas-rendered once; the SV square only redraws when hue changes, never on every SV-drag frame.
- Pointer/touch input only records a target position — actual marker movement happens in a `requestAnimationFrame` loop with lerp easing.
- Unified Pointer Events with `setPointerCapture` for consistent mouse/touch/trackpad handling.
- Markers move via `translate3d` + `will-change: transform`, never `top`/`left`.
- Bounding rects are cached once per drag, never read inside the move handler.
- Canvas resolution is DPR-scaled, capped at 2x.

## Haptics

- Android (Chrome, Samsung Internet): `navigator.vibrate()` fires on marker grab/release and key moments.
- iOS Safari: no Vibration API — WebKit has never implemented it. Falls back to a tuned WebAudio "glass tick" + a snappy marker scale, same synthesis approach as TypedUp's `sounds.ts`.
- Trackpads: no public web API exists; not addressed.
