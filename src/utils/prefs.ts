import { DEFAULT_OVERLAY, TextOverlaySettings } from "../types";
import { scheduleCloudPush } from "../auth/cloudSync";

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

/** Write prefs to localStorage synchronously (no debounce). Used when applying
 *  a remote pull, where the UI needs the value immediately. Does not trigger a
 *  cloud push (the pull is the source). */
export function applyPrefs(p: Partial<Prefs>) {
  try {
    const merged: Prefs = {
      overlay: { ...DEFAULT_OVERLAY, ...(p.overlay ?? {}) },
      targetWidth: p.targetWidth ?? DEFAULT_PREFS.targetWidth,
      targetHeight: p.targetHeight ?? DEFAULT_PREFS.targetHeight,
    };
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {}
}

let pending: Prefs | null = null;
let timer: number | null = null;

export function savePrefs(p: Prefs) {
  pending = p;
  scheduleCloudPush();
  if (timer != null) return;
  timer = window.setTimeout(() => {
    try {
      if (pending) localStorage.setItem(KEY, JSON.stringify(pending));
    } catch {}
    pending = null;
    timer = null;
  }, 200);
}
