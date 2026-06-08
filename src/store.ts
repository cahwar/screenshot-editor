import { create } from "zustand";
import {
  AssetKey,
  Layer,
  Project,
  Rect,
  TextRegion,
  TextScreen,
} from "./types";
import { loadPrefs, savePrefs } from "./utils/prefs";

const uid = () => Math.random().toString(36).slice(2, 10);

const prefs = loadPrefs();

const makeLayer = (index: number): Layer => ({
  id: uid(),
  name: `Кадр ${index}`,
  background: null,
  bgHistory: [],
  targetWidth: prefs.targetWidth,
  targetHeight: prefs.targetHeight,
  textScreens: [],
  activeTextScreenId: null,
  activeAsset: "bg",
  overlay: { ...prefs.overlay },
});

const persistFromLayer = (l: Layer) => {
  prefs.overlay = l.overlay;
  prefs.targetWidth = l.targetWidth;
  prefs.targetHeight = l.targetHeight;
  savePrefs(prefs);
};

// After a cloud pull (sign-in), refresh the in-memory defaults so newly created
// frames inherit the synced prefs. Existing frames are left untouched.
if (typeof window !== "undefined") {
  window.addEventListener("ss-settings-synced", () => {
    const fresh = loadPrefs();
    prefs.overlay = fresh.overlay;
    prefs.targetWidth = fresh.targetWidth;
    prefs.targetHeight = fresh.targetHeight;
  });
}

type Store = Project & {
  addLayer: () => void;
  removeLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  selectLayer: (id: string) => void;

  setBackground: (
    layerId: string,
    bg: { src: string; width: number; height: number }
  ) => void;
  setBackgroundCrop: (layerId: string, crop: Rect) => void;
  setTargetSize: (layerId: string, w: number, h: number) => void;

  replaceBackgroundImage: (
    layerId: string,
    bg: { src: string; width: number; height: number }
  ) => void;
  undoBackground: (layerId: string) => void;

  addTextScreens: (
    layerId: string,
    screens: { name: string; src: string; width: number; height: number }[]
  ) => void;
  removeTextScreen: (layerId: string, screenId: string) => void;
  renameTextScreen: (layerId: string, screenId: string, name: string) => void;
  selectTextScreen: (layerId: string, screenId: string | null) => void;
  addRegion: (
    layerId: string,
    screenId: string,
    rect: Rect,
    id?: string
  ) => void;
  appendRect: (
    layerId: string,
    screenId: string,
    regionId: string,
    rect: Rect
  ) => void;
  removeRegion: (layerId: string, screenId: string, regionId: string) => void;
  updateRegionRect: (
    layerId: string,
    screenId: string,
    regionId: string,
    index: number,
    rect: Rect
  ) => void;
  removeRegionRect: (
    layerId: string,
    screenId: string,
    regionId: string,
    index: number
  ) => void;
  reorderRegions: (
    layerId: string,
    screenId: string,
    orderedIds: string[]
  ) => void;

  patchOverlay: (
    layerId: string,
    patch: Partial<Layer["overlay"]>
  ) => void;

  selectAsset: (layerId: string, key: AssetKey) => void;
};

const initial = makeLayer(1);

export const useProject = create<Store>((set) => ({
  layers: [initial],
  activeLayerId: initial.id,

  addLayer: () =>
    set((s) => {
      const next = makeLayer(s.layers.length + 1);
      return { layers: [...s.layers, next], activeLayerId: next.id };
    }),

  removeLayer: (id) =>
    set((s) => {
      const layers = s.layers.filter((l) => l.id !== id);
      if (layers.length === 0) {
        const fresh = makeLayer(1);
        return { layers: [fresh], activeLayerId: fresh.id };
      }
      const activeLayerId =
        s.activeLayerId === id ? layers[0].id : s.activeLayerId;
      return { layers, activeLayerId };
    }),

  renameLayer: (id, name) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    })),

  selectLayer: (id) => set({ activeLayerId: id }),

  setBackground: (layerId, bg) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        const aspect = l.targetWidth / l.targetHeight;
        const crop = fitCropToImage(bg.width, bg.height, aspect);
        return {
          ...l,
          background: { ...bg, crop },
          bgHistory: [],
        };
      }),
    })),

  replaceBackgroundImage: (layerId, bg) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        const aspect = l.targetWidth / l.targetHeight;
        const crop = fitCropToImage(bg.width, bg.height, aspect);
        const history = l.background
          ? [...l.bgHistory, l.background]
          : l.bgHistory;
        return {
          ...l,
          background: { ...bg, crop },
          bgHistory: history.slice(-10),
        };
      }),
    })),

  undoBackground: (layerId) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId || l.bgHistory.length === 0) return l;
        const prev = l.bgHistory[l.bgHistory.length - 1];
        return {
          ...l,
          background: prev,
          bgHistory: l.bgHistory.slice(0, -1),
        };
      }),
    })),

  setBackgroundCrop: (layerId, crop) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId && l.background
          ? { ...l, background: { ...l.background, crop } }
          : l
      ),
    })),

  setTargetSize: (layerId, w, h) =>
    set((s) => {
      const layers = s.layers.map((l) => {
        if (l.id !== layerId) return l;
        const next: Layer = { ...l, targetWidth: w, targetHeight: h };
        if (next.background) {
          next.background = {
            ...next.background,
            crop: fitCropToImage(
              next.background.width,
              next.background.height,
              w / h
            ),
          };
        }
        return next;
      });
      const changed = layers.find((l) => l.id === layerId);
      if (changed) persistFromLayer(changed);
      return { layers };
    }),

  addTextScreens: (layerId, screens) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        const newScreens: TextScreen[] = screens.map((sc, i) => ({
          id: uid(),
          name: `Текст ${l.textScreens.length + i + 1}`,
          src: sc.src,
          width: sc.width,
          height: sc.height,
          regions: [],
        }));
        const all = [...l.textScreens, ...newScreens];
        const firstNew = newScreens[0];
        return {
          ...l,
          textScreens: all,
          activeTextScreenId: firstNew?.id ?? l.activeTextScreenId,
          activeAsset: firstNew ? (`text:${firstNew.id}` as AssetKey) : l.activeAsset,
        };
      }),
    })),

  removeTextScreen: (layerId, screenId) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        const textScreens = l.textScreens.filter((sc) => sc.id !== screenId);
        const activeTextScreenId =
          l.activeTextScreenId === screenId
            ? textScreens[0]?.id ?? null
            : l.activeTextScreenId;
        const activeAsset: AssetKey =
          l.activeAsset === `text:${screenId}`
            ? textScreens[0]
              ? (`text:${textScreens[0].id}` as AssetKey)
              : "comp"
            : l.activeAsset;
        return { ...l, textScreens, activeTextScreenId, activeAsset };
      }),
    })),

  renameTextScreen: (layerId, screenId, name) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId
          ? {
              ...l,
              textScreens: l.textScreens.map((sc) =>
                sc.id === screenId ? { ...sc, name } : sc
              ),
            }
          : l
      ),
    })),

  selectTextScreen: (layerId, screenId) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, activeTextScreenId: screenId } : l
      ),
    })),

  addRegion: (layerId, screenId, rect, id) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          textScreens: l.textScreens.map((sc) => {
            if (sc.id !== screenId) return sc;
            const maxOrder = sc.regions.reduce(
              (m, r) => Math.max(m, r.order),
              -1
            );
            const region: TextRegion = {
              id: id ?? uid(),
              rects: [rect],
              order: maxOrder + 1,
            };
            return { ...sc, regions: [...sc.regions, region] };
          }),
        };
      }),
    })),

  appendRect: (layerId, screenId, regionId, rect) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          textScreens: l.textScreens.map((sc) => {
            if (sc.id !== screenId) return sc;
            return {
              ...sc,
              regions: sc.regions.map((r) =>
                r.id === regionId ? { ...r, rects: [...r.rects, rect] } : r
              ),
            };
          }),
        };
      }),
    })),

  removeRegion: (layerId, screenId, regionId) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          textScreens: l.textScreens.map((sc) => {
            if (sc.id !== screenId) return sc;
            return {
              ...sc,
              regions: sc.regions.filter((r) => r.id !== regionId),
            };
          }),
        };
      }),
    })),

  updateRegionRect: (layerId, screenId, regionId, index, rect) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          textScreens: l.textScreens.map((sc) => {
            if (sc.id !== screenId) return sc;
            return {
              ...sc,
              regions: sc.regions.map((r) =>
                r.id === regionId
                  ? {
                      ...r,
                      rects: r.rects.map((rc, i) => (i === index ? rect : rc)),
                    }
                  : r
              ),
            };
          }),
        };
      }),
    })),

  removeRegionRect: (layerId, screenId, regionId, index) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          textScreens: l.textScreens.map((sc) => {
            if (sc.id !== screenId) return sc;
            return {
              ...sc,
              regions: sc.regions.flatMap((r) => {
                if (r.id !== regionId) return [r];
                const rects = r.rects.filter((_, i) => i !== index);
                return rects.length ? [{ ...r, rects }] : [];
              }),
            };
          }),
        };
      }),
    })),

  reorderRegions: (layerId, screenId, orderedIds) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          textScreens: l.textScreens.map((sc) => {
            if (sc.id !== screenId) return sc;
            const idx = new Map(orderedIds.map((id, i) => [id, i]));
            return {
              ...sc,
              regions: sc.regions.map((r) => ({
                ...r,
                order: idx.get(r.id) ?? r.order,
              })),
            };
          }),
        };
      }),
    })),

  patchOverlay: (layerId, patch) =>
    set((s) => {
      const layers = s.layers.map((l) =>
        l.id === layerId ? { ...l, overlay: { ...l.overlay, ...patch } } : l
      );
      const changed = layers.find((l) => l.id === layerId);
      if (changed) persistFromLayer(changed);
      return { layers };
    }),

  selectAsset: (layerId, key) =>
    set((s) => ({
      layers: s.layers.map((l) => {
        if (l.id !== layerId) return l;
        const next: Layer = { ...l, activeAsset: key };
        if (key.startsWith("text:")) {
          next.activeTextScreenId = key.slice(5);
        }
        return next;
      }),
    })),
}));

function fitCropToImage(w: number, h: number, aspect: number): Rect {
  const imgAspect = w / h;
  if (imgAspect > aspect) {
    const cropH = h;
    const cropW = h * aspect;
    return { x: (w - cropW) / 2, y: 0, w: cropW, h: cropH };
  } else {
    const cropW = w;
    const cropH = w / aspect;
    return { x: 0, y: (h - cropH) / 2, w: cropW, h: cropH };
  }
}

export const useActiveLayer = () =>
  useProject((s) => s.layers.find((l) => l.id === s.activeLayerId) ?? null);
