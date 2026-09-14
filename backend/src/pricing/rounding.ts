import type { RoundingConfig } from "./types";

function applyForceEnding(value: number, forceEnding: number): number {
  const digits = String(Math.trunc(Math.abs(forceEnding))).length;
  const magnitude = 10 ** digits;
  const base = Math.floor(value / magnitude) * magnitude;
  const candidates = [base - magnitude + forceEnding, base + forceEnding, base + magnitude + forceEnding];
  return candidates.reduce((best, c) => (Math.abs(c - value) < Math.abs(best - value) ? c : best));
}

export function applyRounding(value: number, config: RoundingConfig): number {
  const step = config.step > 0 ? config.step : 1;
  let rounded = value;

  switch (config.mode) {
    case "nearest":
      rounded = Math.round(value / step) * step;
      break;
    case "up":
      rounded = Math.ceil(value / step) * step;
      break;
    case "down":
      rounded = Math.floor(value / step) * step;
      break;
    case "none":
    default:
      rounded = value;
      break;
  }

  if (config.forceEnding !== undefined && config.forceEnding !== null && !Number.isNaN(config.forceEnding)) {
    rounded = applyForceEnding(rounded, config.forceEnding);
  }

  return rounded;
}

export const DEFAULT_ROUNDING: RoundingConfig = { mode: "nearest", step: 1 };
