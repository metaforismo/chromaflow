import { contrastRatio, hexToRgb } from "./color";
import type { ColorStop, GradientPreset } from "./types";

export function normalizeStops(stops: ColorStop[]): ColorStop[] {
  return [...stops]
    .map((stop) => ({ ...stop, position: Math.max(0, Math.min(100, stop.position)) }))
    .sort((a, b) => a.position - b.position);
}

export function gradientCss(preset: GradientPreset): string {
  const stops = normalizeStops(preset.stops)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
  if (preset.kind === "radial") {
    return `radial-gradient(circle at ${preset.center.x}% ${preset.center.y}%, ${stops})`;
  }
  if (preset.kind === "conic") {
    return `conic-gradient(from ${preset.angle}deg at ${preset.center.x}% ${preset.center.y}%, ${stops})`;
  }
  return `linear-gradient(${preset.angle}deg, ${stops})`;
}

export function cssExport(preset: GradientPreset): string {
  const variables = normalizeStops(preset.stops)
    .map((stop, index) => `  --chroma-${index + 1}: ${stop.color};`)
    .join("\n");
  return `:root {\n${variables}\n}\n\n.chroma-gradient {\n  background: ${gradientCss(preset)};\n}`;
}

export function tailwindExport(preset: GradientPreset): string {
  return `<div className="bg-[${gradientCss(preset).replaceAll(" ", "_")}]" />`;
}

export function svgExport(preset: GradientPreset, width: number, height: number): string {
  const background = gradientCss(preset);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background:${background}"></div></foreignObject></svg>`;
}

function interpolatedColor(stops: ColorStop[], position: number): string {
  const normalized = normalizeStops(stops);
  const upperIndex = normalized.findIndex((stop) => stop.position >= position);
  if (upperIndex <= 0) return normalized[0]?.color ?? "#FFFFFF";
  if (upperIndex === -1) return normalized.at(-1)?.color ?? "#FFFFFF";
  const left = normalized[upperIndex - 1];
  const right = normalized[upperIndex];
  const ratio = (position - left.position) / Math.max(1, right.position - left.position);
  const a = hexToRgb(left.color);
  const b = hexToRgb(right.color);
  const channel = (start: number, end: number) => Math.round(start + (end - start) * ratio);
  return `#${[channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function minimumContrast(preset: GradientPreset, foreground: string): number {
  return Math.min(
    ...Array.from({ length: 21 }, (_, index) =>
      contrastRatio(interpolatedColor(preset.stops, index * 5), foreground),
    ),
  );
}

export function isPreset(value: unknown): value is GradientPreset {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GradientPreset>;
  return (
    item.schemaVersion === 1 &&
    ["linear", "radial", "conic"].includes(item.kind ?? "") &&
    typeof item.angle === "number" &&
    !!item.center &&
    typeof item.center.x === "number" &&
    typeof item.center.y === "number" &&
    Array.isArray(item.stops) &&
    item.stops.length >= 1 &&
    item.stops.length <= 12 &&
    item.stops.every(
      (stop) =>
        typeof stop.id === "string" &&
        /^#[0-9A-Fa-f]{6}$/.test(stop.color) &&
        typeof stop.position === "number" &&
        stop.position >= 0 &&
        stop.position <= 100,
    )
  );
}
