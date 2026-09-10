import type { SolverConfig } from "../types";

export interface SolverResult {
  price: number;
  netProceeds: number;
  marginRatio: number;
  iterations: number;
  converged: boolean;
}

/**
 * Бисекция цены: подбирает price так, чтобы netProceedsFn(price)/cost попал в [minX, maxX].
 * Предполагает, что netProceedsFn монотонно возрастает по price (как в реальной формуле:
 * чистая выручка растёт вместе с ценой, даже с учётом процентных комиссии/налога).
 * Аналог findOptimalRC из существующего расчёта в Google Apps Script.
 */
export function solvePrice(netProceedsFn: (price: number) => number, cost: number, config: SolverConfig): SolverResult {
  let lo = cost * config.searchMultiplierMin;
  let hi = cost * config.searchMultiplierMax;

  let bestPrice = hi;
  let bestNet = netProceedsFn(hi);
  let bestRatio = cost !== 0 ? bestNet / cost : 0;
  let converged = false;
  let iterations = 0;

  for (; iterations < config.maxIterations; iterations++) {
    const mid = (lo + hi) / 2;
    const net = netProceedsFn(mid);
    const ratio = cost !== 0 ? net / cost : 0;

    bestPrice = mid;
    bestNet = net;
    bestRatio = ratio;

    if (ratio >= config.minX && ratio <= config.maxX) {
      converged = true;
      break;
    }

    if (ratio < config.minX) {
      lo = mid;
    } else {
      hi = mid;
    }

    if (hi - lo < 0.005) break;
  }

  return { price: bestPrice, netProceeds: bestNet, marginRatio: bestRatio, iterations, converged };
}
