import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChromaFlow — Image to gradient studio",
    short_name: "ChromaFlow",
    description: "Private, perceptual gradient creation in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1eb",
    theme_color: "#d06b45",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
