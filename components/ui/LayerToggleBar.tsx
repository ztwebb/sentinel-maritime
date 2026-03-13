"use client";

import { useAppStore } from "@/store/useAppStore";
import { getVessels, getPorts, getChokepoints, getConflictEvents, getAisGapEvents } from "@/lib/adapters/mock-adapter";
import { THEATERS } from "@/lib/theaters";

type Layer = "vessels" | "ports" | "chokepoints" | "eez" | "conflicts" | "aisGaps";

const VESSELS = getVessels();
const PORTS = getPorts();
const CHOKEPOINTS = getChokepoints();
const CONFLICT_EVENTS = getConflictEvents();
const AIS_GAPS = getAisGapEvents();

const LAYER_CONFIG: {
  key: Layer;
  label: string;
  count: number;
  dot: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    key: "vessels",
    label: "VESSELS",
    count: VESSELS.length,
    dot: "bg-[#22d3ee]",
    activeClass: "bg-[#22d3ee]/10 border-[#22d3ee]/60 text-[#22d3ee]",
    inactiveClass: "border-[#1a2a40] text-[#334155] hover:border-[#22d3ee]/30 hover:text-[#22d3ee]/50",
  },
  {
    key: "ports",
    label: "PORTS",
    count: PORTS.length,
    dot: "bg-[#00e5ff]",
    activeClass: "bg-[#00e5ff]/10 border-[#00e5ff]/60 text-[#00e5ff]",
    inactiveClass: "border-[#1a2a40] text-[#334155] hover:border-[#00e5ff]/30 hover:text-[#00e5ff]/50",
  },
  {
    key: "chokepoints",
    label: "CHKPTS",
    count: CHOKEPOINTS.length,
    dot: "bg-[#f59e0b]",
    activeClass: "bg-[#f59e0b]/10 border-[#f59e0b]/60 text-[#f59e0b]",
    inactiveClass: "border-[#1a2a40] text-[#334155] hover:border-[#f59e0b]/30 hover:text-[#f59e0b]/50",
  },
  {
    key: "eez",
    label: "EEZ",
    count: 285,
    dot: "bg-[#4488aa]",
    activeClass: "bg-[#4488aa]/10 border-[#4488aa]/60 text-[#4488aa]",
    inactiveClass: "border-[#1a2a40] text-[#334155] hover:border-[#4488aa]/30 hover:text-[#4488aa]/50",
  },
  {
    key: "conflicts",
    label: "EVENTS",
    count: CONFLICT_EVENTS.length,
    dot: "bg-[#ef4444]",
    activeClass: "bg-[#ef4444]/10 border-[#ef4444]/60 text-[#ef4444]",
    inactiveClass: "border-[#1a2a40] text-[#334155] hover:border-[#ef4444]/30 hover:text-[#ef4444]/50",
  },
  {
    key: "aisGaps",
    label: "AIS DARK",
    count: AIS_GAPS.length,
    dot: "bg-[#f59e0b]",
    activeClass: "bg-[#f59e0b]/10 border-[#f59e0b]/60 text-[#f59e0b]",
    inactiveClass: "border-[#1a2a40] text-[#334155] hover:border-[#f59e0b]/30 hover:text-[#f59e0b]/50",
  },
];

export default function LayerToggleBar() {
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const selectedTheaterId = useAppStore((s) => s.selectedTheaterId);
  const setTheater = useAppStore((s) => s.setTheater);

  return (
    <div className="flex items-center h-10 px-4 gap-4 bg-[#080f1c]/90 border-b border-[#1a2a40] backdrop-blur-sm overflow-x-auto">
      {/* Wordmark */}
      <div className="flex items-center gap-2 pr-4 border-r border-[#1a2a40] flex-shrink-0">
        <span className="text-[11px] font-bold tracking-[0.2em] text-[#e2e8f0]">SENTINEL</span>
        <span className="text-[9px] tracking-[0.15em] text-[#334155]">MARITIME</span>
      </div>

      {/* Layer toggles */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {LAYER_CONFIG.map(({ key, label, count, dot, activeClass, inactiveClass }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 border text-[9px] font-semibold
              tracking-widest transition-colors duration-100 cursor-pointer select-none
              ${layers[key] ? activeClass : inactiveClass}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${layers[key] ? dot : "bg-[#334155]"}`} />
            {label}
            <span className="opacity-60 font-normal">{count}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#1a2a40] flex-shrink-0" />

      {/* Theater presets */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[8px] tracking-[0.15em] text-[#1e3a5a] mr-1 uppercase">Theater</span>
        {THEATERS.map((theater) => {
          const isActive = selectedTheaterId === theater.id;
          return (
            <button
              key={theater.id}
              onClick={() => setTheater(isActive ? null : theater.id)}
              className={`
                px-2 py-1 border text-[8px] font-bold tracking-[0.12em]
                transition-colors duration-100 cursor-pointer select-none
                ${isActive
                  ? "bg-[#f59e0b]/15 border-[#f59e0b]/70 text-[#fbbf24]"
                  : "border-[#1a2a40] text-[#2a3f55] hover:border-[#334155] hover:text-[#4a6070]"
                }
              `}
            >
              {theater.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Right status */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[9px] tracking-widest text-[#22c55e] font-semibold">LIVE</span>
        </div>
        <span className="text-[9px] text-[#1e3a5a] tracking-widest">
          {new Date().toISOString().slice(0, 10)} UTC
        </span>
      </div>
    </div>
  );
}
