import { describe, expect, it } from "vitest";
import { extractPaletteFromPixels } from "./palette";

const pixels = (...colors: Array<[number, number, number, number?]>) =>
  new Uint8ClampedArray(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));

describe("extractPaletteFromPixels", () => {
  it("is deterministic and weights dominant colors", () => {
    const input = pixels([220, 40, 30], [220, 40, 30], [220, 40, 30], [20, 70, 210]);
    const first = extractPaletteFromPixels(input, "dominant-2");
    const second = extractPaletteFromPixels(input, "dominant-2");
    expect(first).toEqual(second);
    expect(first.stops).toHaveLength(2);
    expect(first.stops[0].weight).toBeGreaterThan(first.stops[1].weight);
  });

  it("ignores transparent pixels", () => {
    const result = extractPaletteFromPixels(pixels([255, 0, 0, 0], [30, 60, 90, 255]), "adaptive");
    expect(result.ignoredTransparentPixels).toBe(1);
    expect(result.sampledPixels).toBe(1);
    expect(result.stops).toHaveLength(1);
  });

  it("returns an empty result for a fully transparent image", () => {
    expect(extractPaletteFromPixels(pixels([10, 20, 30, 0]), "adaptive").stops).toEqual([]);
  });

  it("merges perceptually similar colors", () => {
    const result = extractPaletteFromPixels(
      pixels([100, 110, 120], [101, 111, 121], [102, 112, 122], [230, 190, 40]),
      "adaptive",
    );
    expect(result.stops.length).toBeLessThanOrEqual(2);
  });
});
