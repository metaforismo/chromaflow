import { describe, expect, it } from "vitest";
import {
  cssExport,
  gradientCss,
  isPreset,
  minimumContrast,
  normalizeStops,
  svgExport,
  tailwindExport,
} from "./gradient";
import { DEFAULT_PRESET } from "./types";

describe("gradient utilities", () => {
  it("normalizes and orders stops without mutating input", () => {
    const input = [
      { ...DEFAULT_PRESET.stops[0], position: 140 },
      { ...DEFAULT_PRESET.stops[1], position: -20 },
    ];
    const result = normalizeStops(input);
    expect(result.map((stop) => stop.position)).toEqual([0, 100]);
    expect(input[0].position).toBe(140);
  });

  it("renders each gradient kind", () => {
    expect(gradientCss(DEFAULT_PRESET)).toContain("linear-gradient(135deg");
    expect(gradientCss({ ...DEFAULT_PRESET, kind: "radial" })).toContain(
      "radial-gradient(circle at 50% 50%",
    );
    expect(gradientCss({ ...DEFAULT_PRESET, kind: "conic" })).toContain(
      "conic-gradient(from 135deg",
    );
  });

  it("exports CSS, Tailwind and SVG", () => {
    expect(cssExport(DEFAULT_PRESET)).toContain("--chroma-1");
    expect(tailwindExport(DEFAULT_PRESET)).toContain("bg-[linear-gradient");
    expect(svgExport(DEFAULT_PRESET, 1200, 630)).toContain('width="1200"');
  });

  it("validates schema v1 and rejects invalid data", () => {
    expect(isPreset(DEFAULT_PRESET)).toBe(true);
    expect(isPreset({ ...DEFAULT_PRESET, schemaVersion: 2 })).toBe(false);
    expect(isPreset({ ...DEFAULT_PRESET, stops: [] })).toBe(false);
  });

  it("computes finite sampled contrast", () => {
    expect(minimumContrast(DEFAULT_PRESET, "#FFFFFF")).toBeGreaterThan(1);
  });
});
