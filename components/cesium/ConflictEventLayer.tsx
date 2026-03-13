"use client";

/**
 * ConflictEventLayer.tsx
 *
 * Mounts conflict-event markers onto a Cesium CustomDataSource.
 * Each event renders as:
 *   - A solid core PointGraphics, severity-colored
 *   - A pulsing EllipseGraphics ring (expands + fades over 2.5s)
 *
 * Pulse animation uses the Cesium `time` (JulianDate) parameter that Cesium
 * passes into every CallbackProperty evaluation. Within a single render frame
 * Cesium calls semiMajorAxis and semiMinorAxis with the SAME time value, so
 * both always return an identical radius — avoiding the
 * "semiMajorAxis must be >= semiMinorAxis" DeveloperError that occurs when
 * both properties are driven by wall-clock Date.now() and evaluated at
 * slightly different instants around a cycle wrap.
 *
 * Phase offsets stagger the animation so all 30 rings do not pulse in lockstep.
 */

import type * as CesiumTypes from "cesium";
import { getConflictEvents } from "@/lib/adapters/mock-adapter";
import type { ConflictEvent } from "@/lib/adapters/types";

// ——————————————————————————————————————————
// Severity → color / size config
// ——————————————————————————————————————————

const SEVERITY_HEX: Record<ConflictEvent["severity"], string> = {
  low:      "#fbbf24",  // dim amber
  medium:   "#f59e0b",  // bright amber
  high:     "#f97316",  // orange
  critical: "#ef4444",  // red
};

const POINT_SIZE: Record<ConflictEvent["severity"], number> = {
  low:      5,
  medium:   6,
  high:     8,
  critical: 10,
};

// Pulse ring constants
const PULSE_BASE_M    = 50_000;   // inner radius at t=0 (meters)
const PULSE_RANGE_M   = 100_000;  // how far the ring expands
const PULSE_PERIOD_S  = 2.5;      // full cycle duration in seconds

// ——————————————————————————————————————————
// EntityRecord subset — must match CesiumViewer's EntityRecord
// ——————————————————————————————————————————

export interface ConflictEntityRecord {
  type: "conflict";
  data: ConflictEvent;
  baseHex: string;
  entity: CesiumTypes.Entity;
}

// ——————————————————————————————————————————
// Mount function
// ——————————————————————————————————————————

export function mountConflictLayer(
  source:    CesiumTypes.CustomDataSource,
  entityMap: Map<string, ConflictEntityRecord>,
  Cesium:    typeof import("cesium"),
): () => void {
  const events = getConflictEvents();

  // Capture the Cesium epoch at mount time. Both callbacks for a given entity
  // receive the same JulianDate per frame, so secondsDifference is deterministic
  // within a single evaluation — semiMajorAxis and semiMinorAxis always match.
  const mountJulian = Cesium.JulianDate.now();

  events.forEach((ev, i) => {
    const baseHex   = SEVERITY_HEX[ev.severity];
    const baseColor = Cesium.Color.fromCssColorString(baseHex);

    // Stagger phase so rings don't all expand simultaneously
    const phaseS = (i / events.length) * PULSE_PERIOD_S;

    // Helper: compute normalised pulse position [0, 1) for a given JulianDate.
    // Both semiMajorAxis and semiMinorAxis call this with the same `time` arg,
    // guaranteeing they return the same radius value every frame.
    const pulseT = (time: CesiumTypes.JulianDate | undefined): number => {
      if (!time) return 0;
      const elapsed = Cesium.JulianDate.secondsDifference(time, mountJulian);
      // Use Math.abs to keep positive even if called before mount (shouldn't happen)
      return ((Math.abs(elapsed) + phaseS) % PULSE_PERIOD_S) / PULSE_PERIOD_S;
    };

    const pulseRadius = new Cesium.CallbackProperty(
      (time: CesiumTypes.JulianDate | undefined) =>
        PULSE_BASE_M + pulseT(time) * PULSE_RANGE_M,
      false,
    );

    const pulseColor = new Cesium.CallbackProperty(
      (time: CesiumTypes.JulianDate | undefined) =>
        baseColor.withAlpha(0.75 * (1 - pulseT(time))),
      false,
    );

    const entity = source.entities.add({
      id:       `conflict:${ev.id}`,
      position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat),

      // Solid core dot — visible at all zoom levels
      point: new Cesium.PointGraphics({
        pixelSize:                POINT_SIZE[ev.severity],
        color:                    baseColor,
        outlineColor:             Cesium.Color.BLACK.withAlpha(0.5),
        outlineWidth:             1,
        heightReference:          Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }),

      // Pulsing ring — same CallbackProperty object for both axes so Cesium
      // receives the same evaluated value from a single frame's time argument
      ellipse: new Cesium.EllipseGraphics({
        semiMajorAxis:   pulseRadius,
        semiMinorAxis:   pulseRadius,
        fill:            false,
        outline:         true,
        outlineColor:    pulseColor,
        outlineWidth:    1.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      }),
    });

    entityMap.set(entity.id, { type: "conflict", data: ev, baseHex, entity });
  });

  // Cleanup: remove all entities this layer added
  return () => {
    for (const id of [...entityMap.keys()]) {
      if (id.startsWith("conflict:")) {
        source.entities.removeById(id);
        entityMap.delete(id);
      }
    }
  };
}
