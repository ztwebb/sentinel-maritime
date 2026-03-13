"use client";

import { useEffect, useRef } from "react";
import type * as CesiumTypes from "cesium";
import { useAppStore } from "@/store/useAppStore";
import { getVessels, getPorts, getChokepoints } from "@/lib/adapters/mock-adapter";
import { THEATERS } from "@/lib/theaters";
import type { Vessel, Port, Chokepoint } from "@/lib/adapters/types";

// ——————————————————————————————————————————
// Color palette — mirrors the Three.js prototype exactly
// ——————————————————————————————————————————

const VESSEL_HEX: Record<string, string> = {
  cargo:     "#67e8f9",
  tanker:    "#fcd34d",
  military:  "#fca5a5",
  fishing:   "#86efac",
  passenger: "#d8b4fe",
  unknown:   "#cbd5e1",
  dark:      "#94a3b8",
};

const PORT_HEX: Record<string, string> = {
  military: "#ff9a70",
  tier1:    "#67e8f9",
  tier2:    "#22d3ee",
  tier3:    "#0e7490",
};

const CHOKEPOINT_HEX = "#fbbf24";
const SELECTED_HEX   = "#ffffff";

// ——————————————————————————————————————————
// Entity record — links a Cesium entity back to our app data
// ——————————————————————————————————————————

type EntityType = "vessel" | "port" | "chokepoint";

interface EntityRecord {
  type:    EntityType;
  data:    Vessel | Port | Chokepoint;
  baseHex: string;
  entity:  CesiumTypes.Entity;
}

// ——————————————————————————————————————————
// Component
// ——————————————————————————————————————————

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let viewer: CesiumTypes.Viewer | null = null;
    const cleanupFns: Array<() => void> = [];

    (async () => {
      // CESIUM_BASE_URL must be set before any Cesium code accesses workers/assets.
      (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
        "/cesium-static";

      const Cesium = await import("cesium");

      // Inject Cesium widget CSS once (needed for correct canvas sizing).
      if (!document.querySelector("link[data-sentinel-cesium]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/cesium-static/Widgets/widgets.css";
        link.dataset.sentinelCesium = "true";
        document.head.appendChild(link);
      }

      // Disable Cesium Ion completely — we use open imagery, no token required.
      Cesium.Ion.defaultAccessToken = undefined as unknown as string;

      // ——————————————————
      // Create Viewer
      // ——————————————————
      viewer = new Cesium.Viewer(container, {
        animation:           false,
        baseLayerPicker:     false,
        fullscreenButton:    false,
        geocoder:            false,
        homeButton:          false,
        infoBox:             false,
        sceneModePicker:     false,
        selectionIndicator:  false,
        timeline:            false,
        navigationHelpButton: false,
        // Provide our own base layer so Cesium never contacts Ion for imagery.
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            credit:       "Esri, HERE, Garmin, © OpenStreetMap contributors",
            tileWidth:    256,
            tileHeight:   256,
            minimumLevel: 0,
            maximumLevel: 16,
          })
        ),
        terrain: new Cesium.Terrain(new Cesium.EllipsoidTerrainProvider()),
        // Route credits to a detached element so they don't appear in the UI.
        creditContainer: Object.assign(document.createElement("div"), {
          style: "display:none",
        }),
      });

      // ——————————————————
      // Scene styling & performance
      // ——————————————————
      const scene = viewer.scene;
      if (scene.skyBox)          scene.skyBox.show          = false;
      if (scene.sun)             scene.sun.show             = false;
      if (scene.moon)            scene.moon.show            = false;

      // Atmosphere — the glow around the globe edge.
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.hueShift             = -0.05;
        scene.skyAtmosphere.saturationShift       = -0.4;
        scene.skyAtmosphere.brightnessShift        = -0.35;
      }

      scene.backgroundColor = Cesium.Color.fromCssColorString("#020408");
      scene.globe.baseColor  = Cesium.Color.fromCssColorString("#060a10");
      scene.globe.showGroundAtmosphere = true;
      scene.globe.enableLighting       = true;

      // Subtle glow on the globe surface.
      scene.globe.atmosphereLightIntensity   = 8.0;
      scene.globe.atmosphereRayleighScaleHeight = 10000;

      // Only re-render when the camera moves or data changes — huge perf win.
      viewer.scene.requestRenderMode = true;
      viewer.scene.maximumRenderTimeChange = Infinity;

      // Reduce tile loading pressure.
      viewer.scene.globe.maximumScreenSpaceError = 4;
      viewer.scene.fxaa = true;

      // ——————————————————
      // Initial camera — Indian Ocean / Middle East hemisphere
      // ——————————————————
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(65, 10, 11_000_000),
        orientation: {
          heading: 0,
          pitch:   Cesium.Math.toRadians(-90),
          roll:    0,
        },
      });

      // ——————————————————
      // Data sources — one per layer for easy show/hide
      // ——————————————————
      const vesselSource     = new Cesium.CustomDataSource("vessels");
      const portSource       = new Cesium.CustomDataSource("ports");
      const chokepointSource = new Cesium.CustomDataSource("chokepoints");

      // Map from entity.id → record for O(1) click lookup + highlight updates
      const entityMap = new Map<string, EntityRecord>();

      // ——————————————————
      // Vessels
      // ——————————————————
      for (const v of getVessels()) {
        const baseHex =
          v.status === "dark"
            ? VESSEL_HEX.dark
            : (VESSEL_HEX[v.type] ?? VESSEL_HEX.unknown);

        const entity = vesselSource.entities.add({
          id:       `vessel:${v.id}`,
          position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat),
          point: new Cesium.PointGraphics({
            pixelSize:       7,
            color:           Cesium.Color.fromCssColorString(baseHex),
            outlineColor:    Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth:    1,
          }),
        });
        entityMap.set(entity.id, { type: "vessel", data: v, baseHex, entity });
      }

      // ——————————————————
      // Ports
      // ——————————————————
      for (const p of getPorts()) {
        const baseHex =
          p.type === "military"
            ? PORT_HEX.military
            : (PORT_HEX[`tier${p.strategicTier}`] ?? PORT_HEX.tier3);
        const size = p.strategicTier === 1 ? 11 : p.strategicTier === 2 ? 8 : 6;

        const entity = portSource.entities.add({
          id:       `port:${p.id}`,
          position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
          point: new Cesium.PointGraphics({
            pixelSize:       size,
            color:           Cesium.Color.fromCssColorString(baseHex),
            outlineColor:    Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth:    1,
          }),
        });
        entityMap.set(entity.id, { type: "port", data: p, baseHex, entity });
      }

      // ——————————————————
      // Chokepoints — ring + central dot + label
      // ——————————————————
      for (const cp of getChokepoints()) {
        const baseHex = CHOKEPOINT_HEX;
        const color   = Cesium.Color.fromCssColorString(baseHex);

        const entity = chokepointSource.entities.add({
          id:       `chokepoint:${cp.id}`,
          position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat),
          ellipse: new Cesium.EllipseGraphics({
            semiMinorAxis:   80_000,
            semiMajorAxis:   80_000,
            height:          0,
            fill:            false,
            outline:         true,
            outlineColor:    color,
            outlineWidth:    2,
          }),
          point: new Cesium.PointGraphics({
            pixelSize:       5,
            color:           color,
          }),
          label: new Cesium.LabelGraphics({
            text:            cp.name.toUpperCase(),
            font:            "bold 11px 'JetBrains Mono', monospace",
            fillColor:       color,
            outlineColor:    Cesium.Color.BLACK,
            outlineWidth:    2,
            style:           Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset:     new Cesium.Cartesian2(0, -60),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              7_000_000
            ),
          }),
        });
        entityMap.set(entity.id, {
          type: "chokepoint",
          data: cp,
          baseHex,
          entity,
        });
      }

      // ——————————————————
      // Image overlay — 2709 Merida, Fort Worth TX
      // ——————————————————
      viewer.entities.add({
        id: "overlay:merida",
        position: Cesium.Cartesian3.fromDegrees(-97.3645, 32.7255),
        billboard: new Cesium.BillboardGraphics({
          image:                "/overlay.png",
          width:                64,
          height:               86,
          verticalOrigin:       Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance:       new Cesium.NearFarScalar(1_000, 1.5, 8_000_000, 0.15),
        }),
        label: new Cesium.LabelGraphics({
          text:            "2709 MERIDA",
          font:            "bold 11px 'JetBrains Mono', monospace",
          fillColor:       Cesium.Color.WHITE,
          outlineColor:    Cesium.Color.BLACK,
          outlineWidth:    2,
          style:           Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset:     new Cesium.Cartesian2(0, -95),
        }),
      });

      // Cluster ports — 1,161 individual entities kills perf without it.
      portSource.clustering.enabled            = true;
      portSource.clustering.pixelRange         = 30;
      portSource.clustering.minimumClusterSize = 3;
      portSource.clustering.clusterBillboards  = false;
      portSource.clustering.clusterLabels      = false;
      portSource.clustering.clusterPoints      = true;

      // Style cluster points as clean dots — no ugly numbers.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      portSource.clustering.clusterEvent.addEventListener((entities: any[], cluster: any) => {
        cluster.label.show      = false;
        cluster.billboard.show  = false;
        cluster.point.show      = true;
        cluster.point.color     = Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.7);
        cluster.point.pixelSize = Math.min(6 + entities.length * 0.5, 18);
        cluster.point.outlineColor = Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.3);
        cluster.point.outlineWidth = 3;
      });

      await viewer.dataSources.add(vesselSource);
      await viewer.dataSources.add(portSource);
      await viewer.dataSources.add(chokepointSource);

      // Apply initial layer visibility from store.
      const initLayers = useAppStore.getState().layers;
      vesselSource.show     = initLayers.vessels;
      portSource.show       = initLayers.ports;
      chokepointSource.show = initLayers.chokepoints;

      // ——————————————————
      // Click handler
      // ——————————————————
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
      handler.setInputAction(
        (event: CesiumTypes.ScreenSpaceEventHandler.PositionedEvent) => {
          const picked = viewer!.scene.pick(event.position);
          if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
            const record = entityMap.get(picked.id.id);
            if (record) {
              useAppStore.getState().selectEntity(record.type, record.data);
              return;
            }
          }
          useAppStore.getState().clearSelection();
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );
      cleanupFns.push(() => handler.destroy());

      // ——————————————————
      // Zustand subscriptions
      // In Zustand v5 the two-argument subscribe(selector, cb) form requires
      // the subscribeWithSelector middleware. We use the one-argument form
      // and compare inside the callback instead.
      // ——————————————————

      // Layer visibility
      let prevLayers = useAppStore.getState().layers;
      cleanupFns.push(
        useAppStore.subscribe((state) => {
          const lv = state.layers;
          if (lv === prevLayers) return;
          prevLayers = lv;
          vesselSource.show     = lv.vessels;
          portSource.show       = lv.ports;
          chokepointSource.show = lv.chokepoints;
          viewer!.scene.requestRender();
        })
      );

      // Theater fly-to
      let prevTheaterId = useAppStore.getState().selectedTheaterId;
      cleanupFns.push(
        useAppStore.subscribe((state) => {
          const theaterId = state.selectedTheaterId;
          if (theaterId === prevTheaterId || !theaterId || !viewer) return;
          prevTheaterId = theaterId;
          const theater = THEATERS.find((t) => t.id === theaterId);
          if (!theater) return;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              theater.lon,
              theater.lat,
              theater.heightMeters
            ),
            orientation: {
              heading: 0,
              pitch:   Cesium.Math.toRadians(-75),
              roll:    0,
            },
            duration:       1.8,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
          });
        })
      );

      // Selection highlighting — only touch the previously and newly selected entity.
      let prevSelectedId: string | null = null;
      cleanupFns.push(
        useAppStore.subscribe((state) => {
          const selected = state.selectedEntity;
          const newId = selected ? `${selected.type}:${selected.data.id}` : null;
          if (newId === prevSelectedId) return;

          // Reset only the previously highlighted entity.
          if (prevSelectedId) {
            const prev = entityMap.get(prevSelectedId);
            if (prev) applyColor(prev, Cesium.Color.fromCssColorString(prev.baseHex), Cesium);
          }

          // Highlight the new selection.
          if (newId) {
            const rec = entityMap.get(newId);
            if (rec) applyColor(rec, Cesium.Color.fromCssColorString(SELECTED_HEX), Cesium);
          }

          prevSelectedId = newId;
          viewer!.scene.requestRender();
        })
      );
    })();

    return () => {
      cleanupFns.forEach((fn) => fn());
      if (viewer) {
        viewer.destroy();
        viewer = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

// ——————————————————————————————————————————
// Helper — apply a color to any entity type
// ——————————————————————————————————————————

function applyColor(
  rec:    EntityRecord,
  color:  CesiumTypes.Color,
  Cesium: typeof import("cesium")
) {
  const { entity, type } = rec;

  if (type === "chokepoint") {
    if (entity.ellipse) {
      entity.ellipse.outlineColor = new Cesium.ConstantProperty(color);
    }
    if (entity.label) {
      entity.label.fillColor = new Cesium.ConstantProperty(color);
    }
    if (entity.point) {
      entity.point.color = new Cesium.ConstantProperty(color);
    }
  } else {
    if (entity.point) {
      entity.point.color = new Cesium.ConstantProperty(color);
    }
  }
}
