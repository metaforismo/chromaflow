import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), "dist");
const serverDirectory = join(outputDirectory, "server");
const hostingDirectory = join(outputDirectory, ".openai");

mkdirSync(serverDirectory, { recursive: true });
mkdirSync(hostingDirectory, { recursive: true });

writeFileSync(
  join(serverDirectory, "index.js"),
  `export default {
  async fetch(request, environment) {
    if (!environment?.ASSETS?.fetch) {
      return new Response("ChromaFlow worker is ready.", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return environment.ASSETS.fetch(request);
  },
};
`,
);

copyFileSync(
  join(process.cwd(), ".openai", "hosting.json"),
  join(hostingDirectory, "hosting.json"),
);
