"use client";

import { useAppStore } from "@/store/useAppStore";
import type { Vessel, Port, Chokepoint } from "@/lib/adapters/types";
import { getVessels, getPorts, getChokepoints } from "@/lib/adapters/mock-adapter";
import { THEATERS, type TheaterPreset } from "@/lib/theaters";

const ALL_VESSELS = getVessels();
const ALL_PORTS = getPorts();
const ALL_CHOKEPOINTS = getChokepoints();

// ——————————————————————————————————————————
// Sub-components
// ——————————————————————————————————————————

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8px] font-bold tracking-[0.2em] text-[#3b5068] uppercase mb-2">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-[6px]">
      <span className="text-[8px] font-semibold tracking-[0.12em] text-[#3b5068] uppercase whitespace-nowrap">
        {label}
      </span>
      <span className="text-[11px] text-[#c8d6e5] text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-[#1a2d44] to-transparent my-1" />;
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: "cyan" | "amber" | "red" | "green" | "orange" | "gray";
}) {
  const colorMap = {
    cyan:   "border-[#22d3ee]/40 text-[#22d3ee] bg-[#22d3ee]/8",
    amber:  "border-[#f59e0b]/40 text-[#f59e0b] bg-[#f59e0b]/8",
    red:    "border-[#f87171]/40 text-[#f87171] bg-[#f87171]/8",
    green:  "border-[#4ade80]/40 text-[#4ade80] bg-[#4ade80]/8",
    orange: "border-[#ff7a40]/40 text-[#ff7a40] bg-[#ff7a40]/8",
    gray:   "border-[#2a3f55] text-[#64748b] bg-[#1a2a40]/40",
  };
  return (
    <span
      className={`inline-block border rounded-sm px-1.5 py-[2px] text-[8px] font-bold tracking-[0.12em] ${colorMap[color]}`}
    >
      {label}
    </span>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center py-2 px-1">
      <div className="text-[20px] font-black tracking-tight leading-none" style={{ color }}>
        {value.toLocaleString()}
      </div>
      <div className="text-[7px] tracking-[0.2em] text-[#3b5068] mt-1 font-semibold">{label}</div>
    </div>
  );
}

// ——————————————————————————————————————————
// Empty / default state
// ——————————————————————————————————————————

function EmptyState() {
  const darkCount = ALL_VESSELS.filter((v) => v.status === "dark").length;
  const militaryCount = ALL_VESSELS.filter((v) => v.type === "military").length;
  const tier1Ports = ALL_PORTS.filter((p) => p.strategicTier === 1).length;

  return (
    <div className="px-4 py-5 flex flex-col gap-5">
      {/* Stats row */}
      <div>
        <SectionLabel>GLOBAL OVERVIEW</SectionLabel>
        <div className="grid grid-cols-3 divide-x divide-[#1a2d44] bg-[#0a1220] rounded border border-[#1a2d44]/60">
          <StatCard value={ALL_VESSELS.length} label="VESSELS" color="#22d3ee" />
          <StatCard value={ALL_PORTS.length} label="PORTS" color="#00e5ff" />
          <StatCard value={ALL_CHOKEPOINTS.length} label="CHKPTS" color="#f59e0b" />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <SectionLabel>ALERTS</SectionLabel>
        <div className="flex flex-col gap-[2px]">
          <div className="flex items-center gap-2.5 py-2 px-3 bg-[#0a1220] rounded-sm border-l-2 border-[#f87171]/60">
            <span className="text-[10px] text-[#8899aa]">
              <span className="text-[#f87171] font-bold">{darkCount}</span> AIS-dark
            </span>
          </div>
          <div className="flex items-center gap-2.5 py-2 px-3 bg-[#0a1220] rounded-sm border-l-2 border-[#f87171]/40">
            <span className="text-[10px] text-[#8899aa]">
              <span className="text-[#f87171] font-bold">{militaryCount}</span> military tracked
            </span>
          </div>
          <div className="flex items-center gap-2.5 py-2 px-3 bg-[#0a1220] rounded-sm border-l-2 border-[#22d3ee]/40">
            <span className="text-[10px] text-[#8899aa]">
              <span className="text-[#22d3ee] font-bold">{tier1Ports}</span> Tier 1 ports active
            </span>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-[#2a3f55] leading-relaxed text-center">
        Select any entity for intel detail
      </p>
    </div>
  );
}

// ——————————————————————————————————————————
// Vessel detail
// ——————————————————————————————————————————

function getVesselContext(v: Vessel): string {
  if (v.status === "dark") {
    return "AIS-dark — transmissions ceased at last known position. Dark status can indicate deliberate transponder manipulation to conceal movement near sensitive infrastructure or during illicit transfers.";
  }
  if (v.type === "military") {
    return "Military vessel in this region. Track relative to civilian traffic density and proximity to chokepoints or undersea infrastructure.";
  }
  if (v.type === "tanker") {
    return "Energy tanker in transit. Disruption near this region directly affects regional fuel supply chains. Monitor speed anomalies and deviations from declared destination.";
  }
  if (v.type === "fishing") {
    return "Fishing vessel. Monitor for transit in restricted zones, proximity to military exercises, or irregular patterns suggesting intelligence gathering.";
  }
  return "Commercial vessel in transit. Monitor for behavioral anomalies, proximity to conflict zones, and deviation from declared destination.";
}

function VesselDetail({ vessel }: { vessel: Vessel }) {
  const typeColor: Record<string, "cyan" | "amber" | "red" | "green" | "gray"> = {
    cargo: "cyan", tanker: "amber", military: "red",
    fishing: "green", passenger: "cyan", unknown: "gray",
  };
  const statusColor: Record<string, "cyan" | "amber" | "red" | "green" | "gray"> = {
    underway: "green", anchored: "amber", moored: "gray", dark: "red",
  };

  const lastSeenStr = new Date(vessel.lastSeen)
    .toISOString().replace("T", " ").slice(0, 16) + "Z";

  return (
    <div>
      <div className="mb-4">
        <div className="text-[14px] font-black text-[#e2e8f0] mb-2 tracking-tight leading-tight">
          {vessel.name}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge label={vessel.type.toUpperCase()} color={typeColor[vessel.type] ?? "gray"} />
          <Badge label={vessel.status.toUpperCase()} color={statusColor[vessel.status] ?? "gray"} />
          <Badge label={vessel.flag} color="gray" />
        </div>
      </div>

      <Divider />
      <Row label="MMSI" value={vessel.mmsi} />
      <Row
        label="POS"
        value={`${Math.abs(vessel.lat).toFixed(3)}\u00b0${vessel.lat >= 0 ? "N" : "S"} ${Math.abs(vessel.lon).toFixed(3)}\u00b0${vessel.lon >= 0 ? "E" : "W"}`}
      />
      <Row label="HDG" value={`${vessel.heading}\u00b0`} />
      <Row label="SPD" value={vessel.status === "dark" ? "\u2014" : `${vessel.speed.toFixed(1)} kn`} />
      {vessel.destination && <Row label="DEST" value={vessel.destination} />}
      {vessel.length && <Row label="LOA" value={`${vessel.length}m`} />}
      <Row label="LAST" value={lastSeenStr} />
      <Divider />

      <div className="mt-3">
        <SectionLabel>ASSESSMENT</SectionLabel>
        <p className="text-[10px] text-[#6b829a] leading-[1.6]">
          {getVesselContext(vessel)}
        </p>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————
// Port detail
// ——————————————————————————————————————————

function PortDetail({ port }: { port: Port }) {
  const tierColor: Record<number, "cyan" | "amber" | "gray"> = { 1: "cyan", 2: "amber", 3: "gray" };
  const typeColor: Record<string, "cyan" | "red" | "amber" | "orange" | "gray"> = {
    commercial: "cyan", military: "red", "oil-terminal": "amber", mixed: "gray",
  };

  return (
    <div>
      <div className="mb-4">
        <div className="text-[14px] font-black text-[#e2e8f0] mb-2 tracking-tight leading-tight">
          {port.name}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge label={`T${port.strategicTier}`} color={tierColor[port.strategicTier]} />
          <Badge label={port.type.replace("-", " ").toUpperCase()} color={typeColor[port.type] ?? "gray"} />
          <Badge label={port.country.toUpperCase()} color="gray" />
        </div>
      </div>

      <Divider />
      <Row
        label="POS"
        value={`${Math.abs(port.lat).toFixed(3)}\u00b0${port.lat >= 0 ? "N" : "S"} ${Math.abs(port.lon).toFixed(3)}\u00b0${port.lon >= 0 ? "E" : "W"}`}
      />
      {port.throughput ? (
        <Row label="TPT" value={`${(port.throughput / 1_000_000).toFixed(1)}M TEU/yr`} />
      ) : null}
      <Divider />

      {port.notes && (
        <div className="mt-3">
          <SectionLabel>STRATEGIC SIGNIFICANCE</SectionLabel>
          <p className="text-[10px] text-[#6b829a] leading-[1.6]">{port.notes}</p>
        </div>
      )}
    </div>
  );
}

// ——————————————————————————————————————————
// Chokepoint detail
// ——————————————————————————————————————————

function ChokepointDetail({ chokepoint }: { chokepoint: Chokepoint }) {
  return (
    <div>
      <div className="mb-4">
        <div className="text-[14px] font-black text-[#e2e8f0] mb-2 tracking-tight leading-tight">
          {chokepoint.name}
        </div>
        <Badge label="STRATEGIC CHOKEPOINT" color="amber" />
      </div>

      <Divider />
      <Row label="WIDTH" value={`${chokepoint.widthNm} nm`} />
      {chokepoint.annualTraffic && (
        <Row label="TRAFFIC" value={`~${chokepoint.annualTraffic.toLocaleString()} /yr`} />
      )}
      {chokepoint.oilFlowBpd ? (
        <Row label="OIL" value={`${(chokepoint.oilFlowBpd / 1_000_000).toFixed(1)}M bpd`} />
      ) : null}
      <Row
        label="POS"
        value={`${Math.abs(chokepoint.lat).toFixed(2)}\u00b0${chokepoint.lat >= 0 ? "N" : "S"} ${Math.abs(chokepoint.lon).toFixed(2)}\u00b0${chokepoint.lon >= 0 ? "E" : "W"}`}
      />
      <Divider />

      <div className="mt-3">
        <SectionLabel>GEOPOLITICAL CONTEXT</SectionLabel>
        <p className="text-[10px] text-[#6b829a] leading-[1.6]">
          {chokepoint.geopoliticalContext}
        </p>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————
// Theater panel
// ——————————————————————————————————————————

function TheaterPanel({ theater }: { theater: TheaterPreset }) {
  const setTheater = useAppStore((s) => s.setTheater);
  const darkCount = ALL_VESSELS.filter((v) => v.status === "dark").length;
  const militaryCount = ALL_VESSELS.filter((v) => v.type === "military").length;

  return (
    <div className="px-4 py-5 flex flex-col gap-5">
      {/* Theater name + dismiss */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[7px] tracking-[0.25em] text-[#f59e0b]/80 font-bold mb-1">THEATER</div>
          <div className="text-[14px] font-black text-[#e2e8f0] tracking-tight leading-tight">{theater.label}</div>
        </div>
        <button
          onClick={() => setTheater(null)}
          className="text-[8px] tracking-widest text-[#3b5068] hover:text-[#64748b] transition-colors flex-shrink-0 mt-1 cursor-pointer"
        >
          DISMISS
        </button>
      </div>

      {/* Regional assessment */}
      <div>
        <SectionLabel>ASSESSMENT</SectionLabel>
        <p className="text-[10px] text-[#6b829a] leading-[1.6]">{theater.summary}</p>
      </div>

      {/* Stats */}
      <div>
        <SectionLabel>TRACKED</SectionLabel>
        <div className="grid grid-cols-3 divide-x divide-[#1a2d44] bg-[#0a1220] rounded border border-[#1a2d44]/60">
          <StatCard value={ALL_VESSELS.length} label="VESSELS" color="#22d3ee" />
          <StatCard value={ALL_PORTS.length} label="PORTS" color="#00e5ff" />
          <StatCard value={ALL_CHOKEPOINTS.length} label="CHKPTS" color="#f59e0b" />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <SectionLabel>ALERTS</SectionLabel>
        <div className="flex flex-col gap-[2px]">
          <div className="flex items-center py-2 px-3 bg-[#0a1220] rounded-sm border-l-2 border-[#f87171]/60">
            <span className="text-[10px] text-[#8899aa]">
              <span className="text-[#f87171] font-bold">{darkCount}</span> AIS-dark
            </span>
          </div>
          <div className="flex items-center py-2 px-3 bg-[#0a1220] rounded-sm border-l-2 border-[#f87171]/40">
            <span className="text-[10px] text-[#8899aa]">
              <span className="text-[#f87171] font-bold">{militaryCount}</span> military tracked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————
// Main panel
// ——————————————————————————————————————————

export default function IntelligencePanel() {
  const selectedEntity = useAppStore((s) => s.selectedEntity);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const selectedTheaterId = useAppStore((s) => s.selectedTheaterId);

  const activeTheater = selectedTheaterId
    ? THEATERS.find((t) => t.id === selectedTheaterId) ?? null
    : null;

  const headerLabel = selectedEntity
    ? selectedEntity.type.toUpperCase()
    : activeTheater
    ? activeTheater.shortLabel
    : "INTELLIGENCE";

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[280px] bg-[#040a14]/95 border-l border-[#1a2d44]/50 backdrop-blur-md flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a2d44]/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-[#22d3ee] animate-pulse" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-[#4a6a88]">
            {headerLabel}
          </span>
        </div>
        {selectedEntity && (
          <button
            onClick={clearSelection}
            className="text-[8px] tracking-widest text-[#3b5068] hover:text-[#64748b] transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedEntity ? (
          <div className="px-4 py-4">
            {selectedEntity.type === "vessel" && (
              <VesselDetail vessel={selectedEntity.data as Vessel} />
            )}
            {selectedEntity.type === "port" && (
              <PortDetail port={selectedEntity.data as Port} />
            )}
            {selectedEntity.type === "chokepoint" && (
              <ChokepointDetail chokepoint={selectedEntity.data as Chokepoint} />
            )}
          </div>
        ) : activeTheater ? (
          <TheaterPanel theater={activeTheater} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#1a2d44]/30 flex items-center justify-between flex-shrink-0">
        <span className="text-[7px] tracking-[0.2em] text-[#1a2d44] font-semibold">
          UNCLASSIFIED
        </span>
        <span className="text-[7px] tracking-[0.2em] text-[#1a2d44] font-semibold">
          SMC-1
        </span>
      </div>
    </div>
  );
}
