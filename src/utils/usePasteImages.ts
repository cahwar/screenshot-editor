import { useEffect } from "react";
import { useProject } from "../store";
import { loadImage, readFileAsDataURL } from "./image";

/** Pull image files out of a clipboard paste event. */
function extractImageFiles(e: ClipboardEvent): File[] {
  if (!e.clipboardData) return [];
  return Array.from(e.clipboardData.items)
    .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f);
}

/**
 * True when the paste is happening inside an editable field. We deliberately
 * skip those so the AI prompt textarea keeps handling its own reference paste
 * (see AiEditPanel) and we never hijack paste from inputs / rename fields.
 */
function isEditableTarget(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * Global Ctrl/⌘+V → set background or add text screens, routed by the active
 * asset tab. Non-destructive: only the explicit "Фон" tab overwrites the
 * background; everything else adds the pasted images as new text screens.
 */
export function usePasteImages() {
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      if (isEditableTarget()) return;
      const files = extractImageFiles(e);
      if (!files.length) return;
      e.preventDefault();

      const store = useProject.getState();
      const layer = store.layers.find((l) => l.id === store.activeLayerId);
      if (!layer) return;

      if (layer.activeAsset === "bg") {
        const src = await readFileAsDataURL(files[0]);
        const img = await loadImage(src);
        store.setBackground(layer.id, {
          src,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        store.selectAsset(layer.id, "bg");
      } else {
        const loaded = await Promise.all(
          files.map(async (f) => {
            const src = await readFileAsDataURL(f);
            const img = await loadImage(src);
            return {
              name: f.name || "Вставлено",
              src,
              width: img.naturalWidth,
              height: img.naturalHeight,
            };
          })
        );
        store.addTextScreens(layer.id, loaded);
      }
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);
}
