export type VesselType =
  | "cargo"
  | "tanker"
  | "military"
  | "fishing"
  | "passenger"
  | "unknown";

export type VesselStatus = "underway" | "anchored" | "moored" | "dark";

export type PortType = "commercial" | "military" | "oil-terminal" | "mixed";

export type StrategicTier = 1 | 2 | 3;

export interface Vessel {
  id: string;
  mmsi: string;
  name: string;
  type: VesselType;
  flag: string;
  lat: number;
  lon: number;
  heading: number;
  speed: number;
  status: VesselStatus;
  lastSeen: string;
  destination?: string;
  length?: number;
}

export interface Port {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  type: PortType;
  strategicTier: StrategicTier;
  throughput?: number;
  notes?: string;
}

export interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  widthNm: number;
  annualTraffic?: number;
  oilFlowBpd?: number;
  geopoliticalContext: string;
}

export type ConflictEventType =
  | "strike"
  | "seizure"
  | "mining"
  | "interdiction"
  | "protest"
  | "unknown";

export type ConflictSeverity = "low" | "medium" | "high" | "critical";

export interface ConflictEvent {
  id: string;
  title: string;
  lat: number;
  lon: number;
  date: string;
  type: ConflictEventType;
  severity: ConflictSeverity;
  source: string;
  description: string;
  affectedRoutes?: string[];
}

export interface AisGapEvent {
  id: string;
  vesselId: string;
  vesselName: string;
  flag: string;
  vesselType: VesselType;
  gapStart: string;
  gapEnd: string | null;
  gapDurationHours: number | null;
  lastKnownLat: number;
  lastKnownLon: number;
  reappearanceLat?: number;
  reappearanceLon?: number;
  displacementNm?: number;
  suspicionScore: number;
  context?: string;
}

export interface AisGapHotspot {
  id: string;
  label: string;
  centerLat: number;
  centerLon: number;
  radiusNm: number;
  eventCount: number;
  avgSuspicionScore: number;
  nearChokepoint?: string;
  description?: string;
}

export type SelectedEntityType = "vessel" | "port" | "chokepoint" | "conflict" | "aisGap";

export interface SelectedEntity {
  type: SelectedEntityType;
  id: string;
}
