# COLOR

A color-code spotting game and palette tool — companion to [TypedUp](https://github.com/ahfos/typedup). Get faster and more accurate at reading RGB/Hex values, and vice versa, or use Color Pairings to work out a color scheme.

Play at **[ahfos.github.io/color](https://ahfos.github.io/color)**.

## Play

- **Code → Color** — A target color is hidden. Type an RGB or Hex value (or drag the map) to converge on it. "How close?" reveals a proximity score at the cost of a hint.
- **Color → Code** — You're given a code as text. Place a marker on the HSV map where you believe that color lives, then confirm to see how close you were.

Both modes share the same HSV color map (a 2D saturation/value square + hue slider), the same color engine (RGB↔Hex↔HSV conversion, weighted-Euclidean + CIEDE2000 distance scoring), and the same results/wallpaper-export flow.

## Work

- **Color Pairings** — enter any hex or RGB value and see it plotted on a continuous hue/saturation color wheel (similar in spirit to a physical artist's color wheel, but continuous instead of 12 fixed wedges) alongside its **complementary**, **analogous**, **triadic**, **split-complementary**, **tetradic**, and **monochromatic** matches. The wheel is draggable for live exploration. Every match is shown in a dynamic bento grid below with hex, RGB, CMYK, and HSL, a nearest common-name label, and WCAG contrast readouts for black/white text on that color — all in caps sans type. The whole palette exports as a PNG, copies as text, or copies as a shareable link (`?c=<hex>&h=<harmony>`, which reopens the same palette when visited). Recently used colors are kept in a small history strip.

## Stack

Plain HTML/CSS/JS, no build step or dependencies. Shares design tokens (colors, type, spacing, transitions) with TypedUp so the two feel like one family.

```
color/
├── index.html
├── css/
│   ├── theme.css        (design tokens, shared visual language with TypedUp)
│   └── color.css        (game + Pairings layout)
├── js/
│   ├── colorEngine.js    (random gen, RGB/Hex/HSV/CMYK/HSL conversion, distance + contrast scoring, harmony math)
│   ├── colorMap.js       (SV square + hue slider, pointer handling, lerp animation)
│   ├── colorNames.js     (curated nearest-name lookup)
│   ├── sounds.js         (WebAudio feedback + feature-detected haptics)
│   ├── modeGuesser.js    (Code → Color)
│   ├── modePointer.js    (Color → Code)
│   ├── pairingsWheel.js  (hue/saturation wheel renderer, draggable)
│   ├── bentoExport.js    (renders the Pairings bento grid to a PNG)
│   ├── pairings.js       (Color Pairings wiring: input, harmony picker, bento grid, export, share link, recents)
│   ├── wallpaper.js      (4K solid-color wallpaper export)
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
