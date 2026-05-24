import { DEFAULT_OVERLAY, TextOverlaySettings } from "../types";

const KEY = "ss-editor-prefs-v1";

export type Prefs = {
  overlay: TextOverlaySettings;
  targetWidth: number;
  targetHeight: number;
};

const DEFAULT_PREFS: Prefs = {
  overlay: { ...DEFAULT_OVERLAY },
  targetWidth: 1280,
  targetHeight: 720,
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      overlay: { ...DEFAULT_OVERLAY, ...(parsed.overlay ?? {}) },
      targetWidth: parsed.targetWidth ?? DEFAULT_PREFS.targetWidth,
      targetHeight: parsed.targetHeight ?? DEFAULT_PREFS.targetHeight,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let pending: Prefs | null = null;
let timer: number | null = null;

export function savePrefs(p: Prefs) {
  pending = p;
  if (timer != null) return;
  timer = window.setTimeout(() => {
    try {
      if (pending) localStorage.setItem(KEY, JSON.stringify(pending));
    } catch {}
    pending = null;
    timer = null;
  }, 200);
}
