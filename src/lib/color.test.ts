import { describe, expect, it } from "vitest";
import {
  colorFormats,
  contrastRatio,
  hexToRgb,
  normalizeHex,
  oklabToRgb,
  parseColor,
  rgbToHex,
  rgbToOklab,
} from "./color";

describe("color utilities", () => {
  it("normalizes short and long hex", () => {
    expect(normalizeHex("abc")).toBe("#AABBCC");
    expect(normalizeHex("#12ef90")).toBe("#12EF90");
    expect(normalizeHex("bad value")).toBeNull();
  });

  it("round-trips RGB through OKLab", () => {
    const rgb = hexToRgb("#D06B45");
    const roundTrip = oklabToRgb(rgbToOklab(rgb));
    expect(rgbToHex(roundTrip)).toBe("#D06B45");
  });

  it("formats colors and calculates contrast", () => {
    const formats = colorFormats("#768C76");
    expect(formats.rgb).toContain("rgb(");
    expect(formats.oklch).toContain("oklch(");
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 4);
  });

  it("parses editable RGB, HSL, and OKLCH formats", () => {
    expect(parseColor("rgb(208, 107, 69)")).toBe("#D06B45");
    expect(parseColor("hsl(16 60% 54%)")).toMatch(/^#[0-9A-F]{6}$/);
    expect(parseColor("oklch(64.5% 0.135 41.2)")).toMatch(/^#[0-9A-F]{6}$/);
    expect(parseColor("rgb(999, 0, 0)")).toBeNull();
  });
});
