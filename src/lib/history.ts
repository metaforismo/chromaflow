import type { GradientPreset } from "./types";

export interface HistoryState {
  past: GradientPreset[];
  present: GradientPreset;
  future: GradientPreset[];
}

export type HistoryAction =
  | { type: "set"; preset: GradientPreset }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; preset: GradientPreset };

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous
      ? {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
        }
      : state;
  }
  if (action.type === "redo") {
    const next = state.future[0];
    return next
      ? {
          past: [...state.past, state.present].slice(-50),
          present: next,
          future: state.future.slice(1),
        }
      : state;
  }
  if (action.type === "reset") return { past: [], present: action.preset, future: [] };
  if (JSON.stringify(action.preset) === JSON.stringify(state.present)) return state;
  return { past: [...state.past, state.present].slice(-50), present: action.preset, future: [] };
}
