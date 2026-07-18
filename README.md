# ChromaFlow

ChromaFlow is a privacy-first image-to-gradient studio. It extracts a perceptual palette from an image, turns that palette into an editable gradient, and exports production-ready CSS, Tailwind, SVG, PNG, and JSON.

Images never leave the browser. There is no image upload endpoint, analytics, account, or database.

## What it does

- Reads images through file selection, drag-and-drop, or clipboard paste.
- Extracts a full adaptive palette or the two/three dominant colors.
- Edits linear, radial, and conic gradients with up to 12 color stops.
- Provides undo/redo, local history, contrast sampling, share links, and multiple exports.
- Stores only gradient settings in localStorage under `chromaflow:v1`.

## Architecture

The UI is a Next.js App Router application with a single interactive client leaf. Source images are decoded with `createImageBitmap`, downsampled to at most 256 pixels on the longest edge, and transferred to a Web Worker. The extractor quantizes pixels, clusters them deterministically in OKLab, merges perceptual near-duplicates, and weights colors by sampled coverage. A main-thread fallback preserves functionality where workers are unavailable.

Preview and export code share normalized color-stop ordering. Shared URLs and JSON presets use the versioned `GradientPreset` schema and never contain image pixels or file names.

## Develop

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

The complete gate runs formatting, ESLint, TypeScript, unit coverage, production build, desktop/mobile browser flows, accessibility, and the local-image privacy assertion.

## Privacy model

- Image bytes and pixels remain inside the active browser tab.
- Temporary object URLs are revoked when an image is replaced or the studio unmounts.
- Share links serialize only gradient kind, geometry, colors, and stop positions.
- Recent presets stay in browser localStorage and can be cleared with browser site-data controls.

See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

[MIT](LICENSE) © 2026 Francesco Giannicola.
