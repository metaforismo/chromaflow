import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function twoColorPng(page: import("@playwright/test").Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 20;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d06b45";
    context.fillRect(0, 0, 14, 20);
    context.fillStyle = "#25333a";
    context.fillRect(14, 0, 6, 20);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!)));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  return Buffer.from(bytes);
}

test("extracts a local palette and edits modes", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") imageRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible();
  await page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({ name: "palette.png", mimeType: "image/png", buffer: await twoColorPng(page) });
  await expect(page.getByText(/colors extracted locally/i)).toBeVisible({ timeout: 12_000 });
  await page.getByRole("button", { name: "2 dominant" }).click();
  await expect(page.getByText(/2 colors extracted locally/i)).toBeVisible({ timeout: 12_000 });
  expect(imageRequests.filter((url) => !url.includes("webpack") && !url.includes("_next"))).toEqual(
    [],
  );
});

test("supports manual editing, share, and accessibility", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => undefined },
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible();
  await page.getByRole("button", { name: "Manual" }).click();
  await page.getByRole("button", { name: "Add stop" }).click();
  await expect(page.getByLabel("Color picker for stop 4")).toBeVisible();
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByText(/share link copied/i)).toBeVisible();
  const results = await new AxeBuilder({ page }).exclude("input[type=color]").analyze();
  expect(results.violations).toEqual([]);
});

test("has no horizontal overflow on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
