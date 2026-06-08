import { Layer, Rect, TextScreen } from "../types";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = (e) => reject(e);
    r.readAsDataURL(file);
  });
}

export function cropAndScaleBackground(
  img: HTMLImageElement,
  crop: Rect,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    0,
    0,
    targetW,
    targetH
  );
  return c;
}

export function extractTextRegion(
  img: HTMLImageElement,
  rect: Rect,
  blackThreshold: number,
  edgeSoftness: number,
  cutBg = true
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);

  // Cutting disabled: keep the region exactly as captured (background included).
  if (!cutBg) return c;

  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const t = blackThreshold;
  const soft = Math.max(1, edgeSoftness);
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let a: number;
    if (lum <= t) a = 0;
    else if (lum >= t + soft) a = 255;
    else a = ((lum - t) / soft) * 255;
    d[i + 3] = Math.round((d[i + 3] / 255) * a);
  }
  ctx.putImageData(data, 0, 0);
  return autoCropTransparent(c, data);
}

/**
 * Trim a canvas to the tight bbox of pixels with alpha > threshold.
 * Optionally accepts pre-fetched ImageData to skip re-reading.
 */
export function autoCropTransparent(
  canvas: HTMLCanvasElement,
  imageData?: ImageData,
  alphaThreshold = 8
): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return canvas;
  const ctx = canvas.getContext("2d")!;
  const data = imageData ?? ctx.getImageData(0, 0, w, h);
  const d = data.data;

  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (d[(row + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  const newW = maxX - minX + 1;
  const newH = maxY - minY + 1;
  if (newW === w && newH === h) return canvas;

  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  out
    .getContext("2d")!
    .drawImage(canvas, minX, minY, newW, newH, 0, 0, newW, newH);
  return out;
}

export function stackRegions(
  regionCanvases: HTMLCanvasElement[],
  lineGap: number
): HTMLCanvasElement {
  if (regionCanvases.length === 0) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return empty;
  }
  const width = Math.max(...regionCanvases.map((c) => c.width));
  const totalH =
    regionCanvases.reduce((s, c) => s + c.height, 0) +
    Math.max(0, regionCanvases.length - 1) * lineGap;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = totalH;
  const ctx = out.getContext("2d")!;
  let y = 0;
  for (const c of regionCanvases) {
    ctx.drawImage(c, 0, y);
    y += c.height + lineGap;
  }
  return out;
}

export function applyStroke(
  text: HTMLCanvasElement,
  color: string,
  radius: number
): HTMLCanvasElement {
  if (radius <= 0) return text;
  const padding = Math.ceil(radius);
  const w = text.width + 2 * padding;
  const h = text.height + 2 * padding;

  const silhouette = document.createElement("canvas");
  silhouette.width = w;
  silhouette.height = h;
  const sctx = silhouette.getContext("2d")!;

  const r2 = radius * radius;
  for (let dx = -padding; dx <= padding; dx++) {
    for (let dy = -padding; dy <= padding; dy++) {
      if (dx * dx + dy * dy <= r2) {
        sctx.drawImage(text, padding + dx, padding + dy);
      }
    }
  }
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, w, h);
  sctx.globalCompositeOperation = "source-over";

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  octx.drawImage(silhouette, 0, 0);
  octx.drawImage(text, padding, padding);
  return out;
}

export async function buildTextOverlay(
  layer: Layer
): Promise<HTMLCanvasElement> {
  const pieces: HTMLCanvasElement[] = [];
  for (const screen of layer.textScreens) {
    if (screen.regions.length === 0) continue;
    const img = await loadImage(screen.src);
    const ordered = [...screen.regions].sort((a, b) => a.order - b.order);
    for (const r of ordered) {
      pieces.push(
        extractTextRegion(
          img,
          r.rect,
          layer.overlay.blackThreshold,
          layer.overlay.edgeSoftness,
          layer.overlay.cutTextBg
        )
      );
    }
  }
  const stacked = stackRegions(pieces, layer.overlay.lineGap);
  const stroked = applyStroke(
    stacked,
    layer.overlay.strokeColor,
    layer.overlay.strokeWidth
  );
  return stroked;
}

export async function renderLayer(
  layer: Layer
): Promise<HTMLCanvasElement | null> {
  if (!layer.background) return null;
  const bgImg = await loadImage(layer.background.src);
  const bgRaw = cropAndScaleBackground(
    bgImg,
    layer.background.crop,
    layer.targetWidth,
    layer.targetHeight
  );
  const bg = layer.overlay.swBgEnabled
    ? await shakalBg(bgRaw, layer.overlay.swBgStrength)
    : bgRaw;
  const overlayRaw = await buildTextOverlay(layer);
  const overlay = layer.overlay.swTextEnabled
    ? shakalOverlay(overlayRaw, layer.overlay.swTextStrength)
    : overlayRaw;
  if (overlay.width > 1 && overlay.height > 1) {
    const ctx = bg.getContext("2d")!;
    const targetW = overlay.width * layer.overlay.scale;
    const targetH = overlay.height * layer.overlay.scale;
    const x = layer.overlay.posX * layer.targetWidth;
    const y = layer.overlay.posY * layer.targetHeight;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(overlay, x, y, targetW, targetH);
  }
  return bg;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      type,
      quality
    );
  });
}

/**
 * Degrade an opaque canvas via aggressive JPEG roundtrip.
 * strength 0 = passthrough, 1 = strongest artifacts.
 */
export async function shakalBg(
  canvas: HTMLCanvasElement,
  strength: number
): Promise<HTMLCanvasElement> {
  if (strength <= 0) return canvas;
  const quality = Math.max(0.04, 1 - strength * 0.94);
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    out.getContext("2d")!.drawImage(img, 0, 0);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Degrade an RGBA canvas (preserving alpha) by downscaling and
 * upscaling with nearest-neighbour. Simulates low-res rescale.
 */
export function shakalOverlay(
  canvas: HTMLCanvasElement,
  strength: number
): HTMLCanvasElement {
  if (strength <= 0) return canvas;
  const factor = Math.max(0.08, 1 - strength * 0.88);
  const smallW = Math.max(1, Math.round(canvas.width * factor));
  const smallH = Math.max(1, Math.round(canvas.height * factor));
  if (smallW === canvas.width && smallH === canvas.height) return canvas;
  const small = document.createElement("canvas");
  small.width = smallW;
  small.height = smallH;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(canvas, 0, 0, smallW, smallH);

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(small, 0, 0, canvas.width, canvas.height);
  return out;
}

export function flatRegionsForScreen(
  screen: TextScreen
): { id: string; rect: Rect; order: number }[] {
  return [...screen.regions].sort((a, b) => a.order - b.order);
}
