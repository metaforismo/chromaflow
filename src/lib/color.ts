type RGB = { r: number; g: number; b: number };
export type OKLab = { l: number; a: number; b: number };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toUpperCase()}` : null;
}

export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex) ?? "#000000";
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const channel = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

const toLinear = (value: number) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (value: number) => {
  const channel = clamp(value);
  return 255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);
};

export function rgbToOklab(rgb: RGB): OKLab {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb(lab: OKLab): RGB {
  const l = (lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3;
  const m = (lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3;
  const s = (lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function labDistance(left: OKLab, right: OKLab): number {
  return Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b);
}

export function colorFormats(hex: string) {
  const rgb = hexToRgb(hex);
  const lab = rgbToOklab(rgb);
  const chroma = Math.hypot(lab.a, lab.b);
  const hue = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rgb.r / 255) h = ((rgb.g - rgb.b) / 255 / delta) % 6;
    else if (max === rgb.g / 255) h = (rgb.b - rgb.r) / 255 / delta + 2;
    else h = (rgb.r - rgb.g) / 255 / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return {
    hex: normalizeHex(hex) ?? "#000000",
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${Math.round(h)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`,
    oklch: `oklch(${(lab.l * 100).toFixed(1)}% ${chroma.toFixed(3)} ${((hue + 360) % 360).toFixed(1)})`,
  };
}

export type ColorFormat = keyof ReturnType<typeof colorFormats>;

export function parseColor(value: string): string | null {
  const hex = normalizeHex(value);
  if (hex) return hex;

  const rgbMatch = value.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i,
  );
  if (rgbMatch) {
    const channels = rgbMatch.slice(1, 4).map(Number);
    return channels.every((channel) => channel >= 0 && channel <= 255)
      ? rgbToHex({ r: channels[0], g: channels[1], b: channels[2] })
      : null;
  }

  const hslMatch = value.match(
    /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*(?:deg)?\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%/i,
  );
  if (hslMatch) {
    const hue = ((Number(hslMatch[1]) % 360) + 360) % 360;
    const saturation = Number(hslMatch[2]) / 100;
    const lightness = Number(hslMatch[3]) / 100;
    if (saturation > 1 || lightness > 1) return null;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lightness - chroma / 2;
    const [r, g, b] =
      hue < 60
        ? [chroma, x, 0]
        : hue < 120
          ? [x, chroma, 0]
          : hue < 180
            ? [0, chroma, x]
            : hue < 240
              ? [0, x, chroma]
              : hue < 300
                ? [x, 0, chroma]
                : [chroma, 0, x];
    return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
  }

  const oklchMatch = value.match(/^oklch\(\s*(\d+(?:\.\d+)?)(%)?\s+([\d.]+)\s+(-?[\d.]+)/i);
  if (oklchMatch) {
    const lightness = Number(oklchMatch[1]) / (oklchMatch[2] ? 100 : 1);
    const chroma = Number(oklchMatch[3]);
    const hue = (Number(oklchMatch[4]) * Math.PI) / 180;
    if (lightness < 0 || lightness > 1 || chroma < 0) return null;
    return rgbToHex(
      oklabToRgb({ l: lightness, a: chroma * Math.cos(hue), b: chroma * Math.sin(hue) }),
    );
  }

  return null;
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

export function contrastRatio(left: string, right: string): number {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
