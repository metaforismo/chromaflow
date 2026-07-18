"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsDownUp,
  Check,
  Copy,
  DownloadSimple,
  GithubLogo,
  ImageSquare,
  LockSimple,
  LockSimpleOpen,
  Plus,
  ShareNetwork,
  Shuffle,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { colorFormats, parseColor, type ColorFormat } from "@/lib/color";
import {
  cssExport,
  gradientCss,
  isPreset,
  minimumContrast,
  svgExport,
  tailwindExport,
} from "@/lib/gradient";
import { historyReducer } from "@/lib/history";
import { extractPaletteFromPixels } from "@/lib/palette";
import {
  DEFAULT_PRESET,
  MAX_FILE_BYTES,
  MAX_STOPS,
  STORAGE_KEY,
  type ColorStop,
  type ExtractionMode,
  type ExtractionResult,
  type GradientKind,
  type GradientPreset,
} from "@/lib/types";

type Notice = { tone: "success" | "error" | "neutral"; message: string } | null;
type PreviewMode = "canvas" | "card" | "text";

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

const download = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function loadSharedPreset(): GradientPreset | null {
  try {
    const encoded = new URLSearchParams(window.location.search).get("preset");
    if (!encoded) return null;
    const value = JSON.parse(decodeURIComponent(atob(encoded)));
    return isPreset(value) ? value : null;
  } catch {
    return null;
  }
}

function runWorker(pixels: Uint8ClampedArray, mode: ExtractionMode): Promise<ExtractionResult> {
  if (typeof Worker === "undefined") return Promise.resolve(extractPaletteFromPixels(pixels, mode));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/palette.worker.ts", import.meta.url));
    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve(extractPaletteFromPixels(pixels, mode));
    }, 7000);
    worker.onmessage = (
      event: MessageEvent<{ ok: boolean; result?: ExtractionResult; error?: string }>,
    ) => {
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "Palette extraction failed."));
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve(extractPaletteFromPixels(pixels, mode));
    };
    worker.postMessage({ pixels, mode });
  });
}

export function GradientStudio() {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: DEFAULT_PRESET,
    future: [],
  });
  const preset = history.present;
  const [mode, setMode] = useState<ExtractionMode>("adaptive");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("canvas");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [status, setStatus] = useState<"empty" | "extracting" | "ready" | "error">("empty");
  const [notice, setNotice] = useState<Notice>(null);
  const [foreground, setForeground] = useState("#F8F5EF");
  const [exportSize, setExportSize] = useState({ width: 1600, height: 900 });
  const [showExport, setShowExport] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [recent, setRecent] = useState<GradientPreset[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [colorFormat, setColorFormat] = useState<ColorFormat>("hex");
  const pixelsRef = useRef<Uint8ClampedArray | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dragStopRef = useRef<number | null>(null);
  const css = useMemo(() => gradientCss(preset), [preset]);
  const contrast = useMemo(() => minimumContrast(preset, foreground), [preset, foreground]);

  const setPreset = useCallback(
    (next: GradientPreset) => dispatch({ type: "set", preset: next }),
    [],
  );
  const flash = useCallback(
    (message: string, tone: "success" | "error" | "neutral" = "success") => {
      setNotice({ message, tone });
      window.setTimeout(() => setNotice(null), 2800);
    },
    [],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHydrated(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const shared = loadSharedPreset();
    if (shared) {
      queueMicrotask(() => {
        dispatch({ type: "reset", preset: shared });
        setStatus("ready");
        setMode("manual");
        flash("Shared gradient loaded.");
      });
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { current?: unknown; recent?: unknown };
      queueMicrotask(() => {
        if (isPreset(parsed.current)) dispatch({ type: "reset", preset: parsed.current });
        if (Array.isArray(parsed.recent)) setRecent(parsed.recent.filter(isPreset).slice(0, 20));
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [flash]);

  useEffect(() => {
    const nextRecent = [
      preset,
      ...recent.filter((item) => JSON.stringify(item) !== JSON.stringify(preset)),
    ].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: preset, recent: nextRecent }));
    const id = window.setTimeout(() => setRecent(nextRecent), 500);
    return () => window.clearTimeout(id);
    // recent is intentionally excluded to avoid persistence loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) =>
        item.type.startsWith("image/"),
      );
      if (file) void processFile(file);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const handleKeys = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleShare();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  const extract = async (pixels: Uint8ClampedArray, targetMode: ExtractionMode) => {
    if (targetMode === "manual") return;
    setStatus("extracting");
    setNotice(null);
    try {
      const result = await runWorker(pixels, targetMode);
      if (!result.stops.length) throw new Error("The image contains no visible pixels.");
      setPreset({ ...preset, stops: result.stops });
      setStatus("ready");
      flash(
        `${result.stops.length} colors extracted locally from ${result.sampledPixels.toLocaleString()} samples.`,
      );
    } catch (error) {
      setStatus("error");
      flash(error instanceof Error ? error.message : "Palette extraction failed.", "error");
    }
  };

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) return flash("Choose a supported image file.", "error");
    if (file.size > MAX_FILE_BYTES) return flash("Images must be 20 MB or smaller.", "error");
    setStatus("extracting");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      pixelsRef.current = pixels;
      const nextUrl = URL.createObjectURL(file);
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setImageName(file.name);
      await extract(pixels, mode === "manual" ? "adaptive" : mode);
    } catch {
      setStatus("error");
      flash("This image could not be decoded. Try PNG, JPEG, WebP, or AVIF.", "error");
    }
  }

  const handleMode = async (next: ExtractionMode) => {
    setMode(next);
    if (next !== "manual" && pixelsRef.current) await extract(pixelsRef.current, next);
  };

  const updateStop = (index: number, patch: Partial<ColorStop>) => {
    setPreset({
      ...preset,
      stops: preset.stops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, ...patch } : stop,
      ),
    });
  };

  const addStop = () => {
    if (preset.stops.length >= MAX_STOPS)
      return flash("A gradient can contain up to 12 stops.", "error");
    const sorted = [...preset.stops].sort((a, b) => a.position - b.position);
    let position = 50;
    let gap = -1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const currentGap = sorted[index + 1].position - sorted[index].position;
      if (currentGap > gap) {
        gap = currentGap;
        position = Math.round((sorted[index].position + sorted[index + 1].position) / 2);
      }
    }
    setMode("manual");
    setPreset({
      ...preset,
      stops: [
        ...preset.stops,
        {
          id: `manual-${crypto.randomUUID()}`,
          color: "#D8A07C",
          position,
          weight: 0,
          locked: false,
        },
      ],
    });
  };

  const removeStop = (index: number) => {
    if (preset.stops.length <= 2)
      return flash("Keep at least two stops for an editable gradient.", "error");
    setMode("manual");
    setPreset({ ...preset, stops: preset.stops.filter((_, stopIndex) => stopIndex !== index) });
  };

  const reverse = () =>
    setPreset({
      ...preset,
      stops: preset.stops.map((stop) => ({ ...stop, position: 100 - stop.position })),
    });
  const shuffle = () => {
    const unlocked = preset.stops.filter((stop) => !stop.locked).map((stop) => stop.color);
    const rotated = unlocked.length > 1 ? [...unlocked.slice(1), unlocked[0]] : unlocked;
    let cursor = 0;
    setPreset({
      ...preset,
      stops: preset.stops.map((stop) =>
        stop.locked ? stop : { ...stop, color: rotated[cursor++] },
      ),
    });
  };

  const dropStop = (target: number) => {
    const source = dragStopRef.current;
    if (source === null || source === target) return;
    const stops = [...preset.stops];
    const [moved] = stops.splice(source, 1);
    stops.splice(target, 0, moved);
    setPreset({
      ...preset,
      stops: stops.map((stop, index) => ({
        ...stop,
        position: Math.round((index / (stops.length - 1)) * 100),
      })),
    });
    dragStopRef.current = null;
  };

  async function handleShare() {
    const encoded = btoa(encodeURIComponent(JSON.stringify(preset)));
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("preset", encoded);
    await copyText(url.toString());
    flash("Share link copied. It contains no image data.");
  }

  const handleCopy = async (value: string, label: string) => {
    try {
      await copyText(value);
      flash(`${label} copied.`);
    } catch {
      flash("Clipboard permission was denied.", "error");
    }
  };

  const handleJsonImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      if (!isPreset(value)) throw new Error();
      dispatch({ type: "reset", preset: value });
      setMode("manual");
      setStatus("ready");
      flash("Preset imported.");
    } catch {
      flash("That JSON is not a valid ChromaFlow v1 preset.", "error");
    }
    event.target.value = "";
  };

  const exportPng = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(320, Math.min(4096, exportSize.width));
    canvas.height = Math.max(320, Math.min(4096, exportSize.height));
    const context = canvas.getContext("2d");
    if (!context) return flash("PNG export is unavailable.", "error");
    const radians = ((preset.angle - 90) * Math.PI) / 180;
    const half =
      Math.abs(canvas.width * Math.cos(radians)) + Math.abs(canvas.height * Math.sin(radians));
    let gradient: CanvasGradient;
    if (preset.kind === "radial") {
      const x = (preset.center.x / 100) * canvas.width;
      const y = (preset.center.y / 100) * canvas.height;
      gradient = context.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        Math.hypot(canvas.width, canvas.height),
      );
    } else if (preset.kind === "conic" && "createConicGradient" in context) {
      gradient = context.createConicGradient(
        (preset.angle * Math.PI) / 180,
        (preset.center.x / 100) * canvas.width,
        (preset.center.y / 100) * canvas.height,
      );
    } else {
      gradient = context.createLinearGradient(
        canvas.width / 2 - (Math.cos(radians) * half) / 2,
        canvas.height / 2 - (Math.sin(radians) * half) / 2,
        canvas.width / 2 + (Math.cos(radians) * half) / 2,
        canvas.height / 2 + (Math.sin(radians) * half) / 2,
      );
    }
    [...preset.stops]
      .sort((a, b) => a.position - b.position)
      .forEach((stop) => gradient.addColorStop(stop.position / 100, stop.color));
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) =>
        blob ? download("chromaflow-gradient.png", blob) : flash("PNG export failed.", "error"),
      "image/png",
    );
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  return (
    <main
      data-hydrated={hydrated}
      className="min-h-[100dvh] overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8"
    >
      <header className="mx-auto flex max-w-[1480px] items-center justify-between py-3">
        <a href="#studio" className="flex items-center gap-3" aria-label="ChromaFlow home">
          <span className="grid size-8 grid-cols-2 overflow-hidden rounded-[9px] border hairline">
            <span className="bg-[#D06B45]" />
            <span className="bg-[#E5B46A]" />
            <span className="bg-[#768C76]" />
            <span className="bg-[#25333A]" />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.03em]">ChromaFlow</span>
        </a>
        <nav
          className="flex items-center gap-1 text-xs font-medium"
          aria-label="Primary navigation"
        >
          <button
            onClick={() => setShowPrivacy(true)}
            className="rounded-full px-3 py-2 opacity-75 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
          >
            Privacy
          </button>
          <a
            href="https://github.com/metaforismo/chromaflow"
            className="flex items-center gap-2 rounded-full px-3 py-2 opacity-75 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
          >
            <GithubLogo size={17} weight="regular" /> GitHub
          </a>
        </nav>
      </header>

      <section
        id="studio"
        className="mx-auto mt-3 grid max-w-[1480px] gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(360px,.75fr)]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div
            className="enter panel overflow-hidden rounded-[28px] p-3 sm:rounded-[36px] sm:p-4"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-4 px-2 pt-2 sm:px-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-75">
                  Live canvas / local only
                </p>
                <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-[-.055em] sm:text-5xl">
                  Turn an image into a color atmosphere.
                </h1>
              </div>
              <div
                className="flex rounded-full border hairline p-1"
                role="tablist"
                aria-label="Preview format"
              >
                {(["canvas", "card", "text"] as const).map((item) => (
                  <button
                    key={item}
                    role="tab"
                    aria-selected={previewMode === item}
                    onClick={() => setPreviewMode(item)}
                    className={`rounded-full px-3 py-1.5 text-[11px] capitalize transition ${previewMode === item ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900" : "opacity-75 hover:opacity-100"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="checker relative min-h-[430px] overflow-hidden rounded-[22px] sm:min-h-[590px] sm:rounded-[28px]">
              <div
                className="absolute inset-0 transition-[background] duration-500"
                style={{ background: css }}
              />
              {previewMode === "canvas" && (
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-6 text-white mix-blend-difference sm:p-9">
                  <p className="max-w-sm text-2xl font-medium tracking-[-.04em] sm:text-4xl">
                    Color, with the noise taken out.
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-75">
                    {preset.kind} / {preset.angle}°
                  </p>
                </div>
              )}
              {previewMode === "card" && (
                <div className="absolute inset-0 grid place-items-center p-6">
                  <article className="w-full max-w-md rounded-[24px] border border-white/25 bg-white/16 p-7 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_28px_70px_-30px_rgba(0,0,0,.45)] backdrop-blur-xl">
                    <p className="font-mono text-[10px] uppercase tracking-[.22em] opacity-75">
                      Field note / 07
                    </p>
                    <h2 className="mt-16 text-3xl font-semibold tracking-[-.05em]">
                      A palette should feel found, not forced.
                    </h2>
                    <div className="mt-7 h-px bg-white/30" />
                    <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-78">
                      Built from the visual weight of your image, then left open for your own
                      decisions.
                    </p>
                  </article>
                </div>
              )}
              {previewMode === "text" && (
                <div
                  className="absolute inset-0 grid place-items-center p-6 text-center"
                  style={{ color: foreground }}
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[.25em] opacity-75">
                      Minimum sampled contrast {contrast.toFixed(2)}:1
                    </p>
                    <p className="mt-4 text-5xl font-semibold tracking-[-.07em] sm:text-7xl">
                      Stay with the color.
                    </p>
                    <label className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-full border border-current/25 px-4 py-2 text-xs">
                      <span>Text</span>
                      <input
                        aria-label="Preview text color"
                        type="color"
                        value={foreground}
                        onChange={(event) => setForeground(event.target.value.toUpperCase())}
                        className="size-5 cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                  </div>
                </div>
              )}
              {status === "extracting" && (
                <div className="absolute inset-0 grid place-items-center bg-stone-950/42 backdrop-blur-md">
                  <div className="w-56">
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/20 skeleton" />
                    <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[.22em] text-white/75">
                      Reading visual weight
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="enter grid gap-4 md:grid-cols-[.78fr_1.22fr]"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <section className="panel rounded-[28px] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-75">
                Source image
              </p>
              {imageUrl ? (
                <div className="mt-5">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Uploaded source preview"
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="truncate text-xs opacity-75">{imageName}</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold underline underline-offset-4"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`mt-5 grid min-h-52 w-full place-items-center rounded-2xl border border-dashed p-6 text-center transition ${dragging ? "border-[#B85635] bg-[#B85635]/10" : "hairline hover:bg-black/[.025] dark:hover:bg-white/[.025]"}`}
                >
                  <span>
                    <ImageSquare size={28} weight="light" className="mx-auto opacity-75" />
                    <span className="mt-4 block text-sm font-semibold">
                      Drop, paste, or choose an image
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed opacity-75">
                      PNG, JPEG, WebP or AVIF · up to 20 MB
                      <br />
                      Nothing is uploaded.
                    </span>
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                aria-label="Choose source image"
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  event.target.files?.[0] && void processFile(event.target.files[0])
                }
              />
            </section>
            <section className="panel rounded-[28px] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-75">
                    Palette memory
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-.04em]">Recent gradients</h2>
                </div>
                <span className="font-mono text-[10px] opacity-75">{recent.length}/20</span>
              </div>
              <div className="mt-5 grid max-h-56 gap-2 overflow-auto pr-1">
                {recent.slice(0, 6).map((item, index) => (
                  <button
                    key={`${index}-${item.stops[0]?.color}`}
                    onClick={() => {
                      dispatch({ type: "reset", preset: item });
                      setMode("manual");
                    }}
                    className="group flex items-center gap-4 rounded-xl border hairline p-2 text-left transition hover:bg-black/[.025] dark:hover:bg-white/[.025]"
                  >
                    <span
                      className="h-11 w-24 shrink-0 rounded-lg"
                      style={{ background: gradientCss(item) }}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold capitalize">{item.kind}</span>
                      <span className="mt-1 block truncate font-mono text-[9px] opacity-75">
                        {item.stops.map((stop) => stop.color).join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside
          className="enter lg:sticky lg:top-4 lg:self-start"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <div className="panel rounded-[28px] p-5 sm:p-6 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-75">
                  Gradient controls
                </p>
                <p className="mt-2 text-sm font-semibold">Shape the atmosphere</p>
              </div>
              <div className="flex gap-1">
                <IconButton
                  label="Undo"
                  disabled={!history.past.length}
                  onClick={() => dispatch({ type: "undo" })}
                >
                  <ArrowCounterClockwise size={17} />
                </IconButton>
                <IconButton
                  label="Redo"
                  disabled={!history.future.length}
                  onClick={() => dispatch({ type: "redo" })}
                >
                  <ArrowClockwise size={17} />
                </IconButton>
              </div>
            </div>

            <fieldset className="mt-6">
              <legend className="text-[11px] font-semibold">Palette mode</legend>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border hairline p-1">
                {(
                  [
                    ["adaptive", "Full palette"],
                    ["dominant-2", "2 dominant"],
                    ["dominant-3", "3 dominant"],
                    ["manual", "Manual"],
                  ] as [ExtractionMode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => void handleMode(value)}
                    className={`rounded-xl px-2 py-2.5 text-[11px] font-medium transition ${mode === value ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900" : "opacity-75 hover:opacity-100"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 grid grid-cols-[1fr_92px] gap-3">
              <label className="grid gap-2 text-[11px] font-semibold">
                Gradient type
                <select
                  value={preset.kind}
                  onChange={(event) =>
                    setPreset({ ...preset, kind: event.target.value as GradientKind })
                  }
                  className="rounded-xl border hairline bg-transparent px-3 py-2.5 text-xs"
                >
                  <option value="linear">Linear</option>
                  <option value="radial">Radial</option>
                  <option value="conic">Conic</option>
                </select>
              </label>
              <label className="grid gap-2 text-[11px] font-semibold">
                Angle
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={preset.angle}
                  onChange={(event) =>
                    setPreset({
                      ...preset,
                      angle: Math.max(0, Math.min(360, Number(event.target.value))),
                    })
                  }
                  className="rounded-xl border hairline bg-transparent px-3 py-2.5 font-mono text-xs"
                />
              </label>
            </div>
            {preset.kind !== "linear" && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Range
                  label={`Center X · ${preset.center.x}%`}
                  value={preset.center.x}
                  onChange={(x) => setPreset({ ...preset, center: { ...preset.center, x } })}
                />
                <Range
                  label={`Center Y · ${preset.center.y}%`}
                  value={preset.center.y}
                  onChange={(y) => setPreset({ ...preset, center: { ...preset.center, y } })}
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold">Color stops</p>
              <div className="flex items-center gap-1">
                <label className="sr-only" htmlFor="color-format">
                  Editable color format
                </label>
                <select
                  id="color-format"
                  value={colorFormat}
                  onChange={(event) => setColorFormat(event.target.value as ColorFormat)}
                  className="mr-1 rounded-full border hairline bg-transparent px-2 py-2 font-mono text-[9px] uppercase"
                >
                  <option value="hex">HEX</option>
                  <option value="rgb">RGB</option>
                  <option value="hsl">HSL</option>
                  <option value="oklch">OKLCH</option>
                </select>
                <IconButton label="Reverse stops" onClick={reverse}>
                  <ArrowsDownUp size={17} />
                </IconButton>
                <IconButton label="Rotate unlocked colors" onClick={shuffle}>
                  <Shuffle size={17} />
                </IconButton>
                <IconButton
                  label="Add stop"
                  onClick={addStop}
                  disabled={preset.stops.length >= MAX_STOPS}
                >
                  <Plus size={17} />
                </IconButton>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {preset.stops.map((stop, index) => (
                <StopRow
                  key={`${stop.id}-${stop.color}-${colorFormat}`}
                  stop={stop}
                  index={index}
                  format={colorFormat}
                  onChange={(patch) => updateStop(index, patch)}
                  onRemove={() => removeStop(index)}
                  onDragStart={() => {
                    dragStopRef.current = index;
                  }}
                  onDrop={() => dropStop(index)}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 rounded-xl border hairline px-3 py-3 text-xs font-semibold transition hover:bg-black/[.035] dark:hover:bg-white/[.035]"
              >
                <ShareNetwork size={17} /> Share
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-3 py-3 text-xs font-semibold text-stone-50 transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
              >
                <DownloadSimple size={17} /> Export
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t hairline pt-4">
              <p className="text-[10px] leading-relaxed opacity-75">
                Changes are saved on this device.
              </p>
              <button
                onClick={() => {
                  dispatch({ type: "reset", preset: DEFAULT_PRESET });
                  setMode("manual");
                }}
                className="text-[10px] font-semibold underline underline-offset-4"
              >
                Reset
              </button>
            </div>
          </div>
        </aside>
      </section>

      <footer className="mx-auto mt-16 flex max-w-[1480px] flex-col justify-between gap-6 border-t hairline py-8 text-xs opacity-75 sm:flex-row">
        <p>ChromaFlow reads pixels, not people.</p>
        <p className="font-mono text-[10px] uppercase tracking-[.17em]">
          No uploads · No analytics · Open source
        </p>
      </footer>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-lg backdrop-blur-xl ${notice.tone === "error" ? "border-red-400/30 bg-red-950/90 text-red-50" : "border-white/15 bg-stone-900/92 text-stone-50"}`}
        >
          {notice.tone === "success" && <Check size={15} />} {notice.message}
        </div>
      )}
      {showPrivacy && (
        <Modal title="Private by construction" onClose={() => setShowPrivacy(false)}>
          <div className="space-y-4 text-sm leading-relaxed opacity-70">
            <p>
              Your source image is decoded, sampled, and clustered entirely inside this browser tab.
              ChromaFlow has no image upload endpoint, user account, analytics, or database.
            </p>
            <p>
              Only gradient settings are stored in localStorage. Share links contain colors and
              positions, never source pixels or file names. Replacing an image revokes its temporary
              browser URL.
            </p>
            <p>You can clear all local data at any time with your browser’s site-data controls.</p>
          </div>
        </Modal>
      )}
      {showExport && (
        <Modal title="Take the gradient with you" onClose={() => setShowExport(false)}>
          <div className="grid gap-3">
            <ExportButton
              label="Copy CSS"
              detail="Variables + background declaration"
              onClick={() => handleCopy(cssExport(preset), "CSS")}
              icon={<Copy size={18} />}
            />
            <ExportButton
              label="Copy Tailwind snippet"
              detail="Arbitrary background utility"
              onClick={() => handleCopy(tailwindExport(preset), "Tailwind snippet")}
              icon={<Copy size={18} />}
            />
            <ExportButton
              label="Download SVG"
              detail="Scalable artwork"
              onClick={() =>
                download(
                  "chromaflow-gradient.svg",
                  new Blob([svgExport(preset, exportSize.width, exportSize.height)], {
                    type: "image/svg+xml",
                  }),
                )
              }
              icon={<DownloadSimple size={18} />}
            />
            <ExportButton
              label="Download JSON"
              detail="Versioned ChromaFlow preset"
              onClick={() =>
                download(
                  "chromaflow-preset.json",
                  new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" }),
                )
              }
              icon={<DownloadSimple size={18} />}
            />
            <ExportButton
              label="Import JSON"
              detail="Restore a v1 preset"
              onClick={() => importInputRef.current?.click()}
              icon={<UploadSimple size={18} />}
            />
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={handleJsonImport}
            />
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-[11px] font-semibold">
                Width
                <input
                  type="number"
                  min={320}
                  max={4096}
                  value={exportSize.width}
                  onChange={(event) =>
                    setExportSize({ ...exportSize, width: Number(event.target.value) })
                  }
                  className="rounded-xl border hairline bg-transparent px-3 py-2.5 font-mono text-xs"
                />
              </label>
              <label className="grid gap-2 text-[11px] font-semibold">
                Height
                <input
                  type="number"
                  min={320}
                  max={4096}
                  value={exportSize.height}
                  onChange={(event) =>
                    setExportSize({ ...exportSize, height: Number(event.target.value) })
                  }
                  className="rounded-xl border hairline bg-transparent px-3 py-2.5 font-mono text-xs"
                />
              </label>
            </div>
            <button
              onClick={exportPng}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
            >
              <DownloadSimple size={18} /> Download PNG
            </button>
            <div className="mt-3 border-t hairline pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] opacity-75">
                Palette formats
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {preset.stops.map((stop) => (
                  <button
                    key={stop.id}
                    onClick={() =>
                      handleCopy(
                        Object.values(colorFormats(stop.color)).join("\n"),
                        `${stop.color} formats`,
                      )
                    }
                    className="flex items-center gap-2 rounded-full border hairline px-3 py-2 font-mono text-[10px]"
                  >
                    <span className="size-3 rounded-full" style={{ background: stop.color }} />
                    {stop.color}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full border hairline transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-white/[.04]"
    >
      {children}
    </button>
  );
}

function Range({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-[10px] font-medium opacity-75">
      {label}
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function StopRow({
  stop,
  index,
  format,
  onChange,
  onRemove,
  onDragStart,
  onDrop,
}: {
  stop: ColorStop;
  index: number;
  format: ColorFormat;
  onChange: (patch: Partial<ColorStop>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [colorValue, setColorValue] = useState(colorFormats(stop.color)[format]);
  const commit = () => {
    const valid = parseColor(colorValue);
    if (valid) onChange({ color: valid });
    else setColorValue(colorFormats(stop.color)[format]);
  };
  const handleKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="group grid grid-cols-[24px_36px_minmax(0,1fr)_72px_24px] items-center gap-2 rounded-xl border hairline p-2 transition hover:bg-black/[.02] dark:hover:bg-white/[.02]"
    >
      <span className="cursor-grab text-center font-mono text-[9px] opacity-75 active:cursor-grabbing">
        {String(index + 1).padStart(2, "0")}
      </span>
      <label
        className="relative size-9 cursor-pointer overflow-hidden rounded-lg border hairline"
        style={{ background: stop.color }}
      >
        <span className="sr-only">Color picker for stop {index + 1}</span>
        <input
          type="color"
          value={stop.color}
          onChange={(event) => onChange({ color: event.target.value.toUpperCase() })}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <label className="min-w-0">
        <span className="sr-only">
          {format.toUpperCase()} color for stop {index + 1}
        </span>
        <input
          value={colorValue}
          onChange={(event) => setColorValue(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          className="w-full bg-transparent font-mono text-[11px] uppercase outline-none"
        />
        <input
          aria-label={`Position for stop ${index + 1}`}
          type="range"
          min={0}
          max={100}
          value={stop.position}
          onChange={(event) => onChange({ position: Number(event.target.value) })}
          className="mt-1 block h-1 w-full"
        />
      </label>
      <label className="flex items-center gap-1 rounded-lg border hairline px-2 py-1.5">
        <input
          aria-label={`Numeric position for stop ${index + 1}`}
          type="number"
          min={0}
          max={100}
          value={stop.position}
          onChange={(event) =>
            onChange({ position: Math.max(0, Math.min(100, Number(event.target.value))) })
          }
          className="w-10 bg-transparent text-right font-mono text-[10px] outline-none"
        />
        <span className="text-[9px] opacity-75">%</span>
      </label>
      <button
        aria-label={stop.locked ? `Unlock stop ${index + 1}` : `Lock stop ${index + 1}`}
        title={stop.locked ? "Unlock" : "Lock"}
        onClick={() => onChange({ locked: !stop.locked })}
        className="grid size-7 place-items-center opacity-75 transition hover:opacity-100"
      >
        {stop.locked ? <LockSimple size={15} /> : <LockSimpleOpen size={15} />}
      </button>
      <button
        onClick={onRemove}
        className="col-start-5 row-start-1 hidden size-7 place-items-center text-red-600 group-hover:grid"
        aria-label={`Remove stop ${index + 1}`}
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 grid place-items-end bg-stone-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="panel max-h-[88dvh] w-full overflow-auto rounded-t-[28px] p-6 sm:max-w-lg sm:rounded-[28px] sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-5">
          <h2 id="modal-title" className="text-2xl font-semibold tracking-[-.045em]">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}

function ExportButton({
  label,
  detail,
  onClick,
  icon,
}: {
  label: string;
  detail: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border hairline p-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.03]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-black/[.045] dark:bg-white/[.06]">
        {icon}
      </span>
      <span>
        <span className="block text-xs font-semibold">{label}</span>
        <span className="mt-1 block text-[10px] opacity-75">{detail}</span>
      </span>
    </button>
  );
}
