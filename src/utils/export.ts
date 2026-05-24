import JSZip from "jszip";
import { Layer } from "../types";
import { canvasToBlob, renderLayer } from "./image";

function sanitize(name: string): string {
  return name.replace(/[^\p{L}\p{N}_\- ]+/gu, "_").trim() || "layer";
}

export async function exportProjectZip(layers: Layer[]): Promise<Blob> {
  const zip = new JSZip();
  let index = 1;
  for (const layer of layers) {
    const canvas = await renderLayer(layer);
    if (!canvas) {
      index++;
      continue;
    }
    const blob = await canvasToBlob(canvas);
    const num = String(index).padStart(2, "0");
    zip.file(`${num}_${sanitize(layer.name)}.png`, blob);
    index++;
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
