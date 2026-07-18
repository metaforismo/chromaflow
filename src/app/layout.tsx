import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chromaflow.francescogiannicola1.chatgpt.site"),
  title: { default: "ChromaFlow — Image to gradient studio", template: "%s — ChromaFlow" },
  description:
    "Extract perceptual color palettes from images and turn them into editable, export-ready gradients. Your images never leave your browser.",
  applicationName: "ChromaFlow",
  keywords: ["gradient generator", "color palette", "image colors", "CSS gradient", "privacy"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "ChromaFlow — Image to gradient studio",
    description: "Drop an image. Extract its visual rhythm. Shape a production-ready gradient.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChromaFlow",
    description: "Private, perceptual gradient creation in your browser.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1eb" },
    { media: "(prefers-color-scheme: dark)", color: "#171816" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
