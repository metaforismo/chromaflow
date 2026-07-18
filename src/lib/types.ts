export type ExtractionMode = "adaptive" | "dominant-2" | "dominant-3" | "manual";
export type GradientKind = "linear" | "radial" | "conic";

export interface Point {
  x: number;
  y: number;
}

export interface ColorStop {
  id: string;
  color: string;
  position: number;
  weight: number;
  locked: boolean;
}

export interface GradientPreset {
  schemaVersion: 1;
  kind: GradientKind;
  angle: number;
  center: Point;
  stops: ColorStop[];
}

export interface ExtractionResult {
  stops: ColorStop[];
  sampledPixels: number;
  ignoredTransparentPixels: number;
}

export const STORAGE_KEY = "chromaflow:v1";
export const MAX_STOPS = 12;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DEFAULT_PRESET: GradientPreset = {
  schemaVersion: 1,
  kind: "linear",
  angle: 135,
  center: { x: 50, y: 50 },
  stops: [
    { id: "ember", color: "#D06B45", position: 0, weight: 0.58, locked: false },
    { id: "sand", color: "#E5B46A", position: 48, weight: 0.28, locked: false },
    { id: "ink", color: "#25333A", position: 100, weight: 0.14, locked: false },
  ],
};
