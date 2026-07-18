import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "ChromaFlow gradient studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg,#d06b45,#e5b46a 46%,#25333a)",
        color: "#f8f5ef",
        padding: 72,
        fontFamily: "sans-serif",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, opacity: 0.8, letterSpacing: 7 }}>PRIVATE BY DEFAULT</div>
        <div style={{ fontSize: 104, fontWeight: 650, letterSpacing: -7 }}>ChromaFlow</div>
      </div>
      <div style={{ fontSize: 28, width: 300, lineHeight: 1.3 }}>
        Image to gradient studio. In your browser.
      </div>
    </div>,
    size,
  );
}
