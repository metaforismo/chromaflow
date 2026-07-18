import { describe, expect, it } from "vitest";
import { historyReducer, type HistoryState } from "./history";
import { DEFAULT_PRESET } from "./types";

describe("historyReducer", () => {
  const initial: HistoryState = { past: [], present: DEFAULT_PRESET, future: [] };
  const changed = { ...DEFAULT_PRESET, angle: 42 };

  it("sets, undoes and redoes", () => {
    const set = historyReducer(initial, { type: "set", preset: changed });
    expect(set.present.angle).toBe(42);
    const undone = historyReducer(set, { type: "undo" });
    expect(undone.present.angle).toBe(135);
    expect(historyReducer(undone, { type: "redo" }).present.angle).toBe(42);
  });

  it("does not add identical states and resets history", () => {
    expect(historyReducer(initial, { type: "set", preset: DEFAULT_PRESET })).toBe(initial);
    expect(
      historyReducer({ ...initial, past: [changed] }, { type: "reset", preset: changed }).past,
    ).toEqual([]);
  });
});
