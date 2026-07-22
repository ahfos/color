/**
 * colorNames.js
 * A curated palette of well-known color names (not the full CSS-named-color
 * list, which is too dense to give a useful "nearest name" — many entries
 * sit a couple RGB units apart). This is a spread of ~60 names a person
 * would actually reach for, so the match reads as a real answer instead of
 * a coin flip between "Medium Sea Green" and "Sea Green".
 */

const ColorNames = (() => {
  const PALETTE = [
    ["Black", 0, 0, 0], ["White", 255, 255, 255],
    ["Charcoal", 54, 57, 63], ["Slate", 100, 110, 122], ["Silver", 192, 192, 192],
    ["Ash Gray", 178, 190, 181], ["Fog", 224, 224, 224],
    ["Crimson", 220, 20, 60], ["Red", 230, 30, 40], ["Brick", 178, 34, 34],
    ["Rose", 255, 0, 122], ["Ruby", 155, 17, 30], ["Maroon", 128, 0, 32],
    ["Coral", 255, 127, 80], ["Salmon", 250, 128, 114], ["Terracotta", 226, 114, 91],
    ["Orange", 255, 140, 0], ["Tangerine", 255, 130, 20], ["Amber", 255, 191, 0],
    ["Gold", 212, 175, 55], ["Mustard", 225, 173, 1], ["Sand", 236, 213, 165],
    ["Yellow", 255, 220, 0], ["Lemon", 255, 244, 79], ["Cream", 255, 250, 220],
    ["Chartreuse", 190, 220, 40], ["Lime", 130, 220, 40], ["Olive", 107, 142, 35],
    ["Moss", 96, 130, 87], ["Forest Green", 34, 100, 60], ["Emerald", 20, 160, 100],
    ["Green", 40, 170, 90], ["Mint", 130, 230, 180], ["Sage", 158, 189, 158],
    ["Jade", 0, 168, 120], ["Teal", 0, 128, 128], ["Turquoise", 64, 200, 190],
    ["Cyan", 40, 210, 220], ["Aqua", 130, 230, 230], ["Seafoam", 159, 226, 191],
    ["Sky Blue", 100, 180, 230], ["Cerulean", 42, 130, 190], ["Azure", 0, 127, 255],
    ["Cobalt", 30, 90, 180], ["Blue", 40, 90, 220], ["Royal Blue", 65, 70, 200],
    ["Navy", 20, 30, 90], ["Denim", 60, 90, 130], ["Powder Blue", 176, 210, 224],
    ["Indigo", 75, 0, 130], ["Periwinkle", 140, 150, 230], ["Violet", 140, 60, 200],
    ["Purple", 128, 30, 150], ["Plum", 142, 69, 133], ["Lavender", 190, 170, 230],
    ["Orchid", 190, 90, 190], ["Magenta", 210, 30, 160], ["Fuchsia", 230, 40, 180],
    ["Pink", 240, 130, 170], ["Hot Pink", 255, 60, 150], ["Blush", 235, 190, 190],
    ["Brown", 120, 80, 50], ["Chestnut", 149, 69, 53], ["Tan", 210, 180, 140],
    ["Beige", 222, 208, 178], ["Khaki", 195, 176, 130], ["Taupe", 130, 115, 105],
  ].map(([name, r, g, b]) => ({ name, rgb: { r, g, b } }));

  /** Nearest curated name for an RGB color, using the engine's weighted distance. */
  function nearest(rgb) {
    let best = null;
    let bestDist = Infinity;
    for (const entry of PALETTE) {
      const d = ColorEngine.weightedEuclideanDistance(rgb, entry.rgb);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
      }
    }
    return best ? best.name : "";
  }

  return { nearest, PALETTE };
})();
