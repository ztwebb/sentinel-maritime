import type { Vessel, Port, Chokepoint, ConflictEvent, AisGapEvent, AisGapHotspot } from "./types";
import vesselsData from "@/data/vessels.json";
import portsData from "@/data/ports.json";
import chokepointsData from "@/data/chokepoints.json";
import conflictEventsData from "@/data/conflict-events.json";
import aisGapEventsData from "@/data/ais-gap-events.json";
import aisGapHotspotsData from "@/data/ais-gap-hotspots.json";

export function getVessels(): Vessel[] {
  return vesselsData as Vessel[];
}

export function getPorts(): Port[] {
  return portsData as Port[];
}

export function getChokepoints(): Chokepoint[] {
  return chokepointsData as Chokepoint[];
}

export function getVesselById(id: string): Vessel | undefined {
  return (vesselsData as Vessel[]).find((v) => v.id === id);
}

export function getPortById(id: string): Port | undefined {
  return (portsData as Port[]).find((p) => p.id === id);
}

export function getChokepointById(id: string): Chokepoint | undefined {
  return (chokepointsData as Chokepoint[]).find((c) => c.id === id);
}

export function getConflictEvents(): ConflictEvent[] {
  return conflictEventsData as ConflictEvent[];
}

export function getConflictEventById(id: string): ConflictEvent | undefined {
  return (conflictEventsData as ConflictEvent[]).find((e) => e.id === id);
}

export function getAisGapEvents(): AisGapEvent[] {
  return aisGapEventsData as AisGapEvent[];
}

export function getAisGapHotspots(): AisGapHotspot[] {
  return aisGapHotspotsData as AisGapHotspot[];
}

export function getAisGapEventById(id: string): AisGapEvent | undefined {
  return (aisGapEventsData as AisGapEvent[]).find((e) => e.id === id);
}
