/**
 * stress-index.ts
 *
 * Computes a Chokepoint Stress Score for each chokepoint using the static
 * mock datasets. The score is a simple weighted additive model with four
 * transparent components so operators can inspect the rationale.
 *
 * Score components (0–100 total):
 *
 *  1. Vessel density     (0–30)  vessels within VESSEL_RADIUS_NM
 *  2. Speed congestion   (0–25)  lower mean transit speed → higher pressure
 *  3. Conflict events    (0–40)  severity-weighted events within EVENT_RADIUS_NM
 *  4. Dark vessels       (0–10)  AIS-dark contacts within VESSEL_RADIUS_NM
 *
 * Thresholds:
 *   0–19    → low
 *   20–39   → elevated
 *   40–64   → high
 *   65–100  → critical
 */

import { haversineNm } from "@/lib/geo";
import { getVessels, getChokepoints, getConflictEvents } from "@/lib/adapters/mock-adapter";
import type { Chokepoint } from "@/lib/adapters/types";
import type { ConflictEvent } from "@/lib/adapters/types";

// ——————————————————————————————————————————
// Constants
// ——————————————————————————————————————————

/** Radius for vessel proximity queries (nm). Covers the transit approach zone. */
const VESSEL_RADIUS_NM = 150;

/** Radius for conflict event proximity queries (nm). Wider — a strike 200nm
 *  away still affects route risk and operator calculus. */
const EVENT_RADIUS_NM = 300;

/** Transit speed above which the chokepoint is considered flowing freely (kts). */
const BASELINE_SPEED_KTS = 14;

const EVENT_SEVERITY_WEIGHT: Record<ConflictEvent["severity"], number> = {
  critical: 15,
  high:      8,
  medium:    4,
  low:       1,
};

// ——————————————————————————————————————————
// Types
// ——————————————————————————————————————————

export type StressLevel = "low" | "elevated" | "high" | "critical";

export interface ChokepointStressScore {
  chokepointId:       string;
  score:              number;   // 0–100
  level:              StressLevel;
  rationale:          string[];
  nearbyVesselCount:  number;
  nearbyConflictCount: number;
  nearbyDarkCount:    number;
  meanSpeedKnots:     number | null;
}

// ——————————————————————————————————————————
// Stress level from numeric score
// ——————————————————————————————————————————

export function scoreToLevel(score: number): StressLevel {
  if (score >= 65) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "elevated";
  return "low";
}

export const STRESS_LEVEL_HEX: Record<StressLevel, string> = {
  low:      "#22c55e",
  elevated: "#f59e0b",
  high:     "#f97316",
  critical: "#ef4444",
};

// ——————————————————————————————————————————
// Core computation
// ——————————————————————————————————————————

export function computeChokepointStress(
  cp:      Chokepoint,
  vessels: ReturnType<typeof getVessels>,
  events:  ConflictEvent[],
): ChokepointStressScore {
  const rationale: string[] = [];

  // ——————————————————
  // Component 1 — Vessel density (0–30)
  // ——————————————————
  const nearbyVessels = vessels.filter(
    (v) => haversineNm(cp.lat, cp.lon, v.lat, v.lon) <= VESSEL_RADIUS_NM,
  );
  const nearbyVesselCount = nearbyVessels.length;
  const vesselScore = Math.min(nearbyVesselCount / 15, 1) * 30;

  if (nearbyVesselCount > 0) {
    rationale.push(`${nearbyVesselCount} vessels within ${VESSEL_RADIUS_NM} nm`);
  }

  // ——————————————————
  // Component 2 — Speed congestion (0–25)
  // ——————————————————
  const underwayVessels = nearbyVessels.filter((v) => v.status === "underway");
  let meanSpeedKnots: number | null = null;
  let speedScore = 0;

  if (underwayVessels.length > 0) {
    meanSpeedKnots =
      underwayVessels.reduce((sum, v) => sum + v.speed, 0) / underwayVessels.length;
    // Speed below baseline → congestion pressure
    speedScore = Math.max(0, (1 - meanSpeedKnots / BASELINE_SPEED_KTS)) * 25;

    if (meanSpeedKnots < 8) {
      rationale.push(
        `Low mean transit speed: ${meanSpeedKnots.toFixed(1)} kts — congestion indicator`,
      );
    } else if (meanSpeedKnots < 11) {
      rationale.push(
        `Reduced mean transit speed: ${meanSpeedKnots.toFixed(1)} kts`,
      );
    }
  }

  // ——————————————————
  // Component 3 — Conflict events (0–40)
  // ——————————————————
  const nearbyEvents = events.filter(
    (e) => haversineNm(cp.lat, cp.lon, e.lat, e.lon) <= EVENT_RADIUS_NM,
  );
  const nearbyConflictCount = nearbyEvents.length;
  const rawConflictScore = nearbyEvents.reduce(
    (sum, e) => sum + EVENT_SEVERITY_WEIGHT[e.severity],
    0,
  );
  const conflictScore = Math.min(rawConflictScore, 40);

  if (nearbyConflictCount > 0) {
    const criticals = nearbyEvents.filter((e) => e.severity === "critical").length;
    const highs     = nearbyEvents.filter((e) => e.severity === "high").length;
    if (criticals > 0) {
      rationale.push(
        `${criticals} CRITICAL event${criticals > 1 ? "s" : ""} within ${EVENT_RADIUS_NM} nm`,
      );
    }
    if (highs > 0) {
      rationale.push(
        `${highs} HIGH-severity event${highs > 1 ? "s" : ""} within ${EVENT_RADIUS_NM} nm`,
      );
    }
    if (criticals === 0 && highs === 0) {
      rationale.push(
        `${nearbyConflictCount} incident${nearbyConflictCount > 1 ? "s" : ""} within ${EVENT_RADIUS_NM} nm`,
      );
    }
  }

  // ——————————————————
  // Component 4 — Dark vessels (0–10)
  // ——————————————————
  const nearbyDarkCount = nearbyVessels.filter((v) => v.status === "dark").length;
  const darkScore = Math.min(nearbyDarkCount * 4, 10);

  if (nearbyDarkCount > 0) {
    rationale.push(
      `${nearbyDarkCount} AIS-dark vessel${nearbyDarkCount > 1 ? "s" : ""} in vicinity`,
    );
  }

  // ——————————————————
  // Total
  // ——————————————————
  const rawScore = vesselScore + speedScore + conflictScore + darkScore;
  const score = Math.round(Math.min(rawScore, 100));
  const level = scoreToLevel(score);

  if (rationale.length === 0) {
    rationale.push("No significant threat indicators detected");
  }

  return {
    chokepointId: cp.id,
    score,
    level,
    rationale,
    nearbyVesselCount,
    nearbyConflictCount,
    nearbyDarkCount,
    meanSpeedKnots: meanSpeedKnots !== null ? Math.round(meanSpeedKnots * 10) / 10 : null,
  };
}

// ——————————————————————————————————————————
// Pre-computed index — import STRESS_INDEX for O(1) lookups
// ——————————————————————————————————————————

function buildIndex(): Map<string, ChokepointStressScore> {
  const vessels    = getVessels();
  const chokepoints = getChokepoints();
  const events     = getConflictEvents();

  const index = new Map<string, ChokepointStressScore>();
  for (const cp of chokepoints) {
    index.set(cp.id, computeChokepointStress(cp, vessels, events));
  }
  return index;
}

export const STRESS_INDEX: Map<string, ChokepointStressScore> = buildIndex();
