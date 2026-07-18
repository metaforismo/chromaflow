import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GradientStudio } from "./gradient-studio";

describe("GradientStudio", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/");
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("renders the studio and switches preview states", () => {
    render(<GradientStudio />);
    expect(screen.getByRole("heading", { name: /turn an image/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "text" }));
    expect(screen.getByText(/minimum sampled contrast/i)).toBeInTheDocument();
  });

  it("edits the gradient kind and opens privacy", () => {
    render(<GradientStudio />);
    fireEvent.change(screen.getByLabelText("Gradient type"), { target: { value: "radial" } });
    expect(screen.getByText(/center x/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByRole("dialog", { name: /private by construction/i })).toBeInTheDocument();
  });

  it("rejects files above the size limit", () => {
    render(<GradientStudio />);
    const file = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    });
    const input = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/20 MB or smaller/i)).toBeInTheDocument();
  });

  it("adds a manual color stop", () => {
    render(<GradientStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    fireEvent.click(screen.getByRole("button", { name: "Add stop" }));
    expect(screen.getByLabelText("Color picker for stop 4")).toBeInTheDocument();
  });
});
