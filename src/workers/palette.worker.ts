/// <reference lib="webworker" />

import { extractPaletteFromPixels } from "../lib/palette";
import type { ExtractionMode } from "../lib/types";

self.onmessage = (event: MessageEvent<{ pixels: Uint8ClampedArray; mode: ExtractionMode }>) => {
  try {
    self.postMessage({
      ok: true,
      result: extractPaletteFromPixels(event.data.pixels, event.data.mode),
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Palette extraction failed.",
    });
  }
};

export {};
