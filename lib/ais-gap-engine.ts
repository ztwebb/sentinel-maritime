/**
 * ais-gap-engine.ts
 *
 * Enriches raw AIS gap events with a computed suspicion score and
 * contextual metadata. Scores are pre-computed at module load and
 * exported as ENRICHED_AIS_GAPS for use by the Cesium layer and
 * intelligence panel.
 *
 * Suspicion score components (0–100 total):
 *   Duration score   (0–25): longer gaps → higher suspicion
 *   Displacement     (0–20): unexpected positional jump on reappearance
 *   Chokepoint prox  (0–25): gap occurred near a strategic chokepoint
 *   Conflict prox    (0–20): gap occurred near an active conflict event
 *   Vessel type      (0–10): tanker/military/unknown weigh higher
 *
 * Thresholds: <20=low, 20–44=moderate, 45–64=high, ≥65=critical
 */

import { haversineNm } from "@/lib/geo";
import { getAisGapEvents, getChokepoints, getConflictEvents } from "@/lib/adapters/mock-adapter";
import type { AisGapEvent } from "@/lib/adapters/types";

// ——————————————————————————————————————————
// Suspicion level type + thresholds
// ——————————————————————————————————————————

export type SuspicionLevel = "low" | "moderate" | "high" | "critical";

export function scoreToSuspicionLevel(score: number): SuspicionLevel {
  if (score >= 65) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "moderate";
  return "low";
}

export const SUSPICION_LEVEL_HEX: Record<SuspicionLevel, string> = {
  low:      "#6b7280",  // dim gray
  moderate: "#9ca3af",  // light gray
  high:     "#f59e0b",  // amber
  critical: "#ef4444",  // red
};

// ——————————————————————————————————————————
// Enriched type
// ——————————————————————————————————————————

export interface EnrichedAisGapEvent extends AisGapEvent {
  suspicionLevel: SuspicionLevel;
  suspicionBreakdown: {
    duration:    number;
    displacement: number;
    chokepoint:  number;
    conflict:    number;
    vesselType:  number;
  };
  rationale: string[];
  nearestChokepoint: string | null;
  nearestChokepointNm: number | null;
}

// ——————————————————————————————————————————
// Score component constants
// ——————————————————————————————————————————

// Duration: 0–25 points
// 0h→0, 6h→5, 12h→10, 24h→15, 48h→20, 96h+→25
const DURATION_BREAKPOINTS: [number, number][] = [
  [0,  0],
  [6,  5],
  [12, 10],
  [24, 15],
  [48, 20],
  [96, 25],
];

function durationScore(hours: number | null): number {
  if (hours === null) {
    // Active (still dark) — treat as ongoing/unknown, assign mid-high score
    return 18;
  }
  const bp = DURATION_BREAKPOINTS;
  for (let i = bp.length - 1; i >= 0; i--) {
    if (hours >= bp[i][0]) {
      const [h0, s0] = bp[i];
      const [h1, s1] = bp[Math.min(i + 1, bp.length - 1)];
      if (h0 === h1) return s0;
      const t = Math.min((hours - h0) / (h1 - h0), 1);
      return Math.round(s0 + t * (s1 - s0));
    }
  }
  return 0;
}

// Displacement: 0–20 points
// 0nm→0, 50→5, 150→10, 300→15, 500+→20
function displacementScore(nm: number | undefined): number {
  if (nm === undefined) return 0;
  if (nm >= 500) return 20;
  if (nm >= 300) return 15 + Math.round((nm - 300) / 200 * 5);
  if (nm >= 150) return 10 + Math.round((nm - 150) / 150 * 5);
  if (nm >= 50)  return 5  + Math.round((nm - 50)  / 100 * 5);
  return Math.round(nm / 50 * 5);
}

// Chokepoint proximity: 0–25 points
// ≤50nm→25, ≤100nm→20, ≤200nm→15, ≤350nm→8, >350nm→0
function chokepointScore(nearestNm: number): number {
  if (nearestNm <= 50)  return 25;
  if (nearestNm <= 100) return 20;
  if (nearestNm <= 200) return 15;
  if (nearestNm <= 350) return 8;
  return 0;
}

// Conflict proximity: 0–20 points
// ≤100nm→20, ≤250nm→15, ≤400nm→8, >400nm→0
const CONFLICT_EVENT_RADIUS_NM = 400;
function conflictScore(nearestConflictNm: number): number {
  if (nearestConflictNm <= 100) return 20;
  if (nearestConflictNm <= 250) return 15;
  if (nearestConflictNm <= 400) return 8;
  return 0;
}

// Vessel type: 0–10 points
const VESSEL_TYPE_SCORE: Record<string, number> = {
  military: 10,
  tanker:   8,
  unknown:  7,
  cargo:    4,
  fishing:  3,
  passenger: 2,
};

// ——————————————————————————————————————————
// Enrichment function
// ——————————————————————————————————————————

function enrichGapEvent(
  ev: AisGapEvent,
  chokepoints: ReturnType<typeof getChokepoints>,
  conflictEvents: ReturnType<typeof getConflictEvents>,
): EnrichedAisGapEvent {
  // Find nearest chokepoint (to last-known position)
  let nearestCpName: string | null = null;
  let nearestCpNm = Infinity;
  for (const cp of chokepoints) {
    const d = haversineNm(ev.lastKnownLat, ev.lastKnownLon, cp.lat, cp.lon);
    if (d < nearestCpNm) {
      nearestCpNm = d;
      nearestCpName = cp.name;
    }
  }

  // Find nearest conflict event
  let nearestConflictNm = Infinity;
  for (const ce of conflictEvents) {
    const d = haversineNm(ev.lastKnownLat, ev.lastKnownLon, ce.lat, ce.lon);
    if (d < nearestConflictNm) nearestConflictNm = d;
  }
  if (nearestConflictNm > CONFLICT_EVENT_RADIUS_NM) nearestConflictNm = Infinity;

  const breakdown = {
    duration:     durationScore(ev.gapDurationHours),
    displacement: displacementScore(ev.displacementNm),
    chokepoint:   chokepointScore(nearestCpNm),
    conflict:     conflictScore(nearestConflictNm),
    vesselType:   VESSEL_TYPE_SCORE[ev.vesselType] ?? 4,
  };

  const totalScore = Math.min(
    100,
    breakdown.duration + breakdown.displacement + breakdown.chokepoint +
    breakdown.conflict + breakdown.vesselType,
  );

  const level = scoreToSuspicionLevel(totalScore);

  // Build rationale bullets
  const rationale: string[] = [];
  const isActive = ev.gapEnd === null;

  if (isActive) {
    rationale.push("AIS transmission currently dark — gap is ongoing");
  } else if (ev.gapDurationHours !== null) {
    rationale.push(`Gap duration: ${ev.gapDurationHours.toFixed(1)}h`);
  }

  if (ev.displacementNm !== undefined) {
    rationale.push(`Reappeared ${ev.displacementNm.toFixed(0)}nm from last known position`);
  }

  if (nearestCpNm < 350 && nearestCpName) {
    rationale.push(`${nearestCpNm.toFixed(0)}nm from ${nearestCpName}`);
  }

  if (nearestConflictNm < CONFLICT_EVENT_RADIUS_NM) {
    rationale.push(`${nearestConflictNm.toFixed(0)}nm from nearest conflict event`);
  }

  if (ev.vesselType === "tanker") rationale.push("Tanker — high-value sanctions-evasion target");
  if (ev.vesselType === "military") rationale.push("Military-class vessel");
  if (ev.vesselType === "unknown") rationale.push("Vessel type unconfirmed");

  return {
    ...ev,
    suspicionScore: totalScore,
    suspicionLevel: level,
    suspicionBreakdown: breakdown,
    rationale,
    nearestChokepoint: nearestCpName,
    nearestChokepointNm: nearestCpNm === Infinity ? null : nearestCpNm,
  };
}

// ——————————————————————————————————————————
// Pre-computed export
// ——————————————————————————————————————————

export const ENRICHED_AIS_GAPS: EnrichedAisGapEvent[] = (() => {
  const events = getAisGapEvents();
  const chokepoints = getChokepoints();
  const conflictEvents = getConflictEvents();
  return events.map((ev) => enrichGapEvent(ev, chokepoints, conflictEvents));
})();
