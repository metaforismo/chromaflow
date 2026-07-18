import { labDistance, oklabToRgb, rgbToHex, rgbToOklab, type OKLab } from "./color";
import type { ExtractionMode, ExtractionResult } from "./types";

type Bucket = { lab: OKLab; count: number };
type Cluster = Bucket & { sourceIndex: number };

const targetCount = (mode: ExtractionMode, unique: number) => {
  if (mode === "dominant-2") return 2;
  if (mode === "dominant-3") return 3;
  return Math.max(4, Math.min(10, Math.round(4 + Math.log2(Math.max(1, unique)) / 2)));
};

export function extractPaletteFromPixels(
  rgba: Uint8ClampedArray,
  mode: ExtractionMode = "adaptive",
): ExtractionResult {
  const histogram = new Map<number, { r: number; g: number; b: number; count: number }>();
  let ignoredTransparentPixels = 0;
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index + 3] < 128) {
      ignoredTransparentPixels += 1;
      continue;
    }
    const r = rgba[index];
    const g = rgba[index + 1];
    const b = rgba[index + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = histogram.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
    } else {
      histogram.set(key, { r, g, b, count: 1 });
    }
  }

  const sampledPixels = rgba.length / 4 - ignoredTransparentPixels;
  if (!sampledPixels) return { stops: [], sampledPixels: 0, ignoredTransparentPixels };

  const buckets: Bucket[] = [...histogram.values()]
    .map((entry) => ({
      lab: rgbToOklab({
        r: entry.r / entry.count,
        g: entry.g / entry.count,
        b: entry.b / entry.count,
      }),
      count: entry.count,
    }))
    .sort((a, b) => b.count - a.count);

  const k = Math.min(targetCount(mode, buckets.length), buckets.length);
  const centroids: OKLab[] = [buckets[0].lab];
  while (centroids.length < k) {
    const candidate = buckets
      .map((bucket, sourceIndex) => ({
        sourceIndex,
        score:
          Math.min(...centroids.map((center) => labDistance(bucket.lab, center))) *
          Math.sqrt(bucket.count),
      }))
      .sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex)[0];
    centroids.push(buckets[candidate.sourceIndex].lab);
  }

  let clusters: Cluster[] = [];
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const accumulators = centroids.map(() => ({ l: 0, a: 0, b: 0, count: 0 }));
    buckets.forEach((bucket) => {
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      centroids.forEach((center, index) => {
        const next = labDistance(bucket.lab, center);
        if (next < distance) {
          distance = next;
          closest = index;
        }
      });
      const target = accumulators[closest];
      target.l += bucket.lab.l * bucket.count;
      target.a += bucket.lab.a * bucket.count;
      target.b += bucket.lab.b * bucket.count;
      target.count += bucket.count;
    });
    clusters = accumulators
      .map((entry, sourceIndex) => ({
        lab: entry.count
          ? { l: entry.l / entry.count, a: entry.a / entry.count, b: entry.b / entry.count }
          : centroids[sourceIndex],
        count: entry.count,
        sourceIndex,
      }))
      .filter((entry) => entry.count > 0);
    clusters.forEach((cluster, index) => {
      centroids[index] = cluster.lab;
    });
  }

  const merged: Cluster[] = [];
  clusters
    .sort((a, b) => b.count - a.count || a.sourceIndex - b.sourceIndex)
    .forEach((cluster) => {
      const match = merged.find((entry) => labDistance(entry.lab, cluster.lab) < 0.045);
      if (!match) merged.push({ ...cluster });
      else {
        const total = match.count + cluster.count;
        match.lab = {
          l: (match.lab.l * match.count + cluster.lab.l * cluster.count) / total,
          a: (match.lab.a * match.count + cluster.lab.a * cluster.count) / total,
          b: (match.lab.b * match.count + cluster.lab.b * cluster.count) / total,
        };
        match.count = total;
      }
    });

  const desired = mode === "dominant-2" ? 2 : mode === "dominant-3" ? 3 : 10;
  const chosen = merged.slice(0, desired);
  return {
    stops: chosen.map((cluster, index) => ({
      id: `extracted-${index}-${rgbToHex(oklabToRgb(cluster.lab)).slice(1).toLowerCase()}`,
      color: rgbToHex(oklabToRgb(cluster.lab)),
      position: chosen.length === 1 ? 0 : Math.round((index / (chosen.length - 1)) * 100),
      weight: cluster.count / sampledPixels,
      locked: false,
    })),
    sampledPixels,
    ignoredTransparentPixels,
  };
}
