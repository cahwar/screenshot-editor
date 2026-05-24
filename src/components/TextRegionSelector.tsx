import { useRef, useState } from "react";
import { Layer, Rect, TextRegion, TextScreen } from "../types";
import { useProject } from "../store";

const MIN_REGION = 6;

type Interaction =
  | { kind: "draw"; start: { x: number; y: number } }
  | {
      kind: "move";
      regionId: string;
      startMouse: { x: number; y: number };
      startRect: Rect;
    }
  | {
      kind: "resize";
      regionId: string;
      startMouse: { x: number; y: number };
      startRect: Rect;
    };

export function TextRegionSelector({
  layer,
  screen,
}: {
  layer: Layer;
  screen: TextScreen;
}) {
  const addRegion = useProject((s) => s.addRegion);
  const removeRegion = useProject((s) => s.removeRegion);
  const updateRegion = useProject((s) => s.updateRegion);
  const reorderRegions = useProject((s) => s.reorderRegions);

  const stageRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);

  const ordered = [...screen.regions].sort((a, b) => a.order - b.order);

  const stageRect = () => stageRef.current!.getBoundingClientRect();

  const toImageCoords = (clientX: number, clientY: number) => {
    const r = stageRect();
    const kx = r.width === 0 ? 1 : screen.width / r.width;
    const ky = r.height === 0 ? 1 : screen.height / r.height;
    return {
      x: (clientX - r.left) * kx,
      y: (clientY - r.top) * ky,
    };
  };

  const toImageDelta = (dxPx: number, dyPx: number) => {
    const r = stageRect();
    const kx = r.width === 0 ? 1 : screen.width / r.width;
    const ky = r.height === 0 ? 1 : screen.height / r.height;
    return { dx: dxPx * kx, dy: dyPx * ky };
  };

  const clampRectInside = (rect: Rect): Rect => ({
    x: Math.max(0, Math.min(screen.width - rect.w, rect.x)),
    y: Math.max(0, Math.min(screen.height - rect.h, rect.y)),
    w: rect.w,
    h: rect.h,
  });

  const onStagePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".region-controls")) return;
    if (target.closest(".region-handle")) return;
    if (target.closest(".region-box")) {
      // Move
      const regionEl = target.closest(".region-box") as HTMLElement;
      const regionId = regionEl.dataset.id!;
      const region = screen.regions.find((r) => r.id === regionId);
      if (!region) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      interactionRef.current = {
        kind: "move",
        regionId,
        startMouse: { x: e.clientX, y: e.clientY },
        startRect: { ...region.rect },
      };
      return;
    }
    // Draw new
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toImageCoords(e.clientX, e.clientY);
    interactionRef.current = { kind: "draw", start: { x, y } };
    setDraft({ x, y, w: 0, h: 0 });
  };

  const onHandlePointerDown = (e: React.PointerEvent, region: TextRegion) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    interactionRef.current = {
      kind: "resize",
      regionId: region.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...region.rect },
    };
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const it = interactionRef.current;
    if (!it) return;
    if (it.kind === "draw") {
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      const sx = it.start.x;
      const sy = it.start.y;
      const rx = Math.max(0, Math.min(screen.width, x));
      const ry = Math.max(0, Math.min(screen.height, y));
      setDraft({
        x: Math.min(sx, rx),
        y: Math.min(sy, ry),
        w: Math.abs(rx - sx),
        h: Math.abs(ry - sy),
      });
    } else if (it.kind === "move") {
      const { dx, dy } = toImageDelta(
        e.clientX - it.startMouse.x,
        e.clientY - it.startMouse.y
      );
      const next = clampRectInside({
        x: it.startRect.x + dx,
        y: it.startRect.y + dy,
        w: it.startRect.w,
        h: it.startRect.h,
      });
      updateRegion(layer.id, screen.id, it.regionId, next);
    } else if (it.kind === "resize") {
      const { dx, dy } = toImageDelta(
        e.clientX - it.startMouse.x,
        e.clientY - it.startMouse.y
      );
      let newW = Math.max(MIN_REGION, it.startRect.w + dx);
      let newH = Math.max(MIN_REGION, it.startRect.h + dy);
      newW = Math.min(newW, screen.width - it.startRect.x);
      newH = Math.min(newH, screen.height - it.startRect.y);
      updateRegion(layer.id, screen.id, it.regionId, {
        x: it.startRect.x,
        y: it.startRect.y,
        w: newW,
        h: newH,
      });
    }
  };

  const onStagePointerUp = () => {
    const it = interactionRef.current;
    if (it?.kind === "draw" && draft) {
      if (draft.w >= MIN_REGION && draft.h >= MIN_REGION) {
        addRegion(layer.id, screen.id, draft);
      }
    }
    interactionRef.current = null;
    setDraft(null);
  };

  const moveOrder = (regionId: string, dir: -1 | 1) => {
    const ids = ordered.map((r) => r.id);
    const idx = ids.indexOf(regionId);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    reorderRegions(layer.id, screen.id, ids);
  };

  const toPct = (r: Rect) => ({
    left: `${(r.x / screen.width) * 100}%`,
    top: `${(r.y / screen.height) * 100}%`,
    width: `${(r.w / screen.width) * 100}%`,
    height: `${(r.h / screen.height) * 100}%`,
  });

  return (
    <div className="stage-wrap">
      <div
        ref={stageRef}
        className="region-stage"
        style={{ maxWidth: screen.width, cursor: "crosshair" }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
      >
        <img src={screen.src} alt="" draggable={false} />

        {ordered.map((r, i) => (
          <div
            key={r.id}
            className="region-box"
            data-id={r.id}
            style={{ ...toPct(r.rect), cursor: "move" }}
          >
            <div className="region-controls">
              <span className="order-badge">{i + 1}</span>
              <button
                className="ord-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  moveOrder(r.id, -1);
                }}
                disabled={i === 0}
                title="Сдвинуть вверх в порядке"
              >
                ▲
              </button>
              <button
                className="ord-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  moveOrder(r.id, 1);
                }}
                disabled={i === ordered.length - 1}
                title="Сдвинуть вниз в порядке"
              >
                ▼
              </button>
            </div>
            <button
              className="delete"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeRegion(layer.id, screen.id, r.id);
              }}
              title="Удалить выделение"
            >
              ×
            </button>
            <div
              className="region-handle br"
              onPointerDown={(e) => onHandlePointerDown(e, r)}
              title="Изменить размер"
            />
          </div>
        ))}

        {draft && (draft.w > 0 || draft.h > 0) && (
          <div className="draw-rect" style={toPct(draft)} />
        )}
      </div>
    </div>
  );
}
