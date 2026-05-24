import { Layer } from "../types";
import { cropAndScaleBackground, loadImage, renderLayer } from "./image";

export function scaleCanvas(
  src: HTMLCanvasElement | HTMLImageElement,
  maxW: number,
  maxH = maxW
): HTMLCanvasElement {
  const sw = (src as HTMLCanvasElement).width || (src as HTMLImageElement).naturalWidth;
  const sh = (src as HTMLCanvasElement).height || (src as HTMLImageElement).naturalHeight;
  const k = Math.min(maxW / sw, maxH / sh, 1);
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

export async function renderFrameThumb(
  layer: Layer,
  maxW = 240
): Promise<string | null> {
  if (!layer.background) return null;
  const full = await renderLayer(layer);
  if (!full) return null;
  const thumb = scaleCanvas(full, maxW);
  return thumb.toDataURL("image/jpeg", 0.82);
}

export async function renderBgThumb(
  layer: Layer,
  maxW = 200
): Promise<string | null> {
  if (!layer.background) return null;
  const img = await loadImage(layer.background.src);
  const cropped = cropAndScaleBackground(
    img,
    layer.background.crop,
    layer.targetWidth,
    layer.targetHeight
  );
  const thumb = scaleCanvas(cropped, maxW);
  return thumb.toDataURL("image/jpeg", 0.82);
}
