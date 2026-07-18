import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative, sep } from "node:path";

const outputDirectory = join(process.cwd(), "dist");
const serverDirectory = join(outputDirectory, "server");
const hostingDirectory = join(outputDirectory, ".openai");

mkdirSync(serverDirectory, { recursive: true });
mkdirSync(hostingDirectory, { recursive: true });

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
};

function filesInside(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      if (path.startsWith(serverDirectory) || path.startsWith(hostingDirectory)) return [];
      return statSync(path).isDirectory() ? filesInside(path) : [path];
    })
    .sort();
}

const assets = Object.fromEntries(
  filesInside(outputDirectory).map((path) => {
    const assetPath = `/${relative(outputDirectory, path).split(sep).join("/")}`;
    const contentType =
      assetPath === "/opengraph-image"
        ? "image/png"
        : (mimeTypes[extname(path)] ?? "application/octet-stream");
    return [assetPath, [contentType, readFileSync(path).toString("base64")]];
  }),
);

writeFileSync(
  join(serverDirectory, "index.js"),
  `const assets = ${JSON.stringify(assets)};
const decoded = new Map();

function bodyFor(path, encoded) {
  if (!decoded.has(path)) {
    decoded.set(path, Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
  }
  return decoded.get(path);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (path === "/" || path === "") path = "/index.html";
    if (path.endsWith("/")) path += "index.html";

    const asset = assets[path];
    const status = asset ? 200 : 404;
    const [contentType, encoded] = asset ?? assets["/404.html"];
    const headers = new Headers({
      "content-type": contentType,
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "content-security-policy": "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self' blob:; connect-src 'self'",
      "cache-control": path.startsWith("/_next/static/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
    });
    return new Response(request.method === "HEAD" ? null : bodyFor(path, encoded), { status, headers });
  },
};
`,
);

copyFileSync(
  join(process.cwd(), ".openai", "hosting.json"),
  join(hostingDirectory, "hosting.json"),
);
