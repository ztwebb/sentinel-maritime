import { create } from "zustand";
import type { Vessel, Port, Chokepoint, ConflictEvent, AisGapEvent, SelectedEntityType } from "@/lib/adapters/types";

interface LayerState {
  vessels: boolean;
  ports: boolean;
  chokepoints: boolean;
  eez: boolean;
  conflicts: boolean;
  aisGaps: boolean;
}

type SelectedEntity =
  | { type: "vessel"; data: Vessel }
  | { type: "port"; data: Port }
  | { type: "chokepoint"; data: Chokepoint }
  | { type: "conflict"; data: ConflictEvent }
  | { type: "aisGap"; data: AisGapEvent }
  | null;

interface AppState {
  layers: LayerState;
  toggleLayer: (layer: keyof LayerState) => void;

  selectedEntity: SelectedEntity;
  selectEntity: (type: SelectedEntityType, data: Vessel | Port | Chokepoint | ConflictEvent | AisGapEvent) => void;
  clearSelection: () => void;

  selectedTheaterId: string | null;
  setTheater: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  layers: {
    vessels: true,
    ports: true,
    chokepoints: true,
    eez: false,
    conflicts: true,
    aisGaps: true,
  },

  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),

  selectedEntity: null,

  selectEntity: (type, data) =>
    set(() => ({
      selectedEntity: { type, data } as SelectedEntity,
    })),

  clearSelection: () => set({ selectedEntity: null }),

  selectedTheaterId: null,
  setTheater: (id) => set({ selectedTheaterId: id }),
}));
