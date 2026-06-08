import { useRef, useState } from "react";
import { Layer, Rect, TextScreen } from "../types";
import { useProject } from "../store";

const MIN_REGION = 6;

const uid = () => Math.random().toString(36).slice(2, 10);

type SelectMode = "single" | "composite";

type Interaction =
  | { kind: "draw"; start: { x: number; y: number } }
  | {
      kind: "move";
      regionId: string;
      rectIndex: number;
      startMouse: { x: number; y: number };
      startRect: Rect;
    }
  | {
      kind: "resize";
      regionId: string;
      rectIndex: number;
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
  const appendRect = useProject((s) => s.appendRect);
  const removeRegion = useProject((s) => s.removeRegion);
  const removeRegionRect = useProject((s) => s.removeRegionRect);
  const updateRegionRect = useProject((s) => s.updateRegionRect);
  const reorderRegions = useProject((s) => s.reorderRegions);

  const stageRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [mode, setMode] = useState<SelectMode>("single");
  // In composite mode, the chunk new rectangles get layered onto.
  const [targetId, setTargetId] = useState<string | null>(null);

  const ordered = [...screen.regions].sort((a, b) => a.order - b.order);
  const targetExists = ordered.some((r) => r.id === targetId);

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
    const box = target.closest(".region-box") as HTMLElement | null;
    if (box) {
      // Move an existing rectangle
      const regionId = box.dataset.id!;
      const rectIndex = parseInt(box.dataset.idx!, 10);
      const region = screen.regions.find((r) => r.id === regionId);
      if (!region || !region.rects[rectIndex]) return;
      if (mode === "composite") setTargetId(regionId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      interactionRef.current = {
        kind: "move",
        regionId,
        rectIndex,
        startMouse: { x: e.clientX, y: e.clientY },
        startRect: { ...region.rects[rectIndex] },
      };
      return;
    }
    // Draw new
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toImageCoords(e.clientX, e.clientY);
    interactionRef.current = { kind: "draw", start: { x, y } };
    setDraft({ x, y, w: 0, h: 0 });
  };

  const onHandlePointerDown = (
    e: React.PointerEvent,
    regionId: string,
    rectIndex: number,
    rect: Rect
  ) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    interactionRef.current = {
      kind: "resize",
      regionId,
      rectIndex,
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...rect },
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
      updateRegionRect(layer.id, screen.id, it.regionId, it.rectIndex, next);
    } else if (it.kind === "resize") {
      const { dx, dy } = toImageDelta(
        e.clientX - it.startMouse.x,
        e.clientY - it.startMouse.y
      );
      let newW = Math.max(MIN_REGION, it.startRect.w + dx);
      let newH = Math.max(MIN_REGION, it.startRect.h + dy);
      newW = Math.min(newW, screen.width - it.startRect.x);
      newH = Math.min(newH, screen.height - it.startRect.y);
      updateRegionRect(layer.id, screen.id, it.regionId, it.rectIndex, {
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
        if (mode === "composite" && targetExists && targetId) {
          appendRect(layer.id, screen.id, targetId, draft);
        } else if (mode === "composite") {
          const id = uid();
          addRegion(layer.id, screen.id, draft, id);
          setTargetId(id);
        } else {
          addRegion(layer.id, screen.id, draft);
        }
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

  const deleteRegion = (regionId: string) => {
    removeRegion(layer.id, screen.id, regionId);
    if (targetId === regionId) setTargetId(null);
  };

  const toPct = (r: Rect) => ({
    left: `${(r.x / screen.width) * 100}%`,
    top: `${(r.y / screen.height) * 100}%`,
    width: `${(r.w / screen.width) * 100}%`,
    height: `${(r.h / screen.height) * 100}%`,
  });

  return (
    <div className="stage-wrap">
      <div className="select-mode-bar">
        <div className="seg-control">
          <button
            className={`seg-btn ${mode === "single" ? "active" : ""}`}
            onClick={() => setMode("single")}
            title="Каждое выделение — отдельный чанк текста"
          >
            Одиночный
          </button>
          <button
            className={`seg-btn ${mode === "composite" ? "active" : ""}`}
            onClick={() => setMode("composite")}
            title="Несколько выделений объединяются в один чанк"
          >
            Составной
          </button>
        </div>
        {mode === "composite" && (
          <button
            className="btn small secondary"
            onClick={() => setTargetId(null)}
            disabled={!targetExists}
            title="Начать новый составной чанк — следующее выделение создаст новый"
          >
            Новый чанк
          </button>
        )}
      </div>

      <p className="hint" style={{ margin: "0 0 8px" }}>
        {mode === "single"
          ? "Одиночный режим: каждый прямоугольник — отдельный чанк."
          : targetExists
          ? "Составной режим: новые прямоугольники добавляются в выделенный чанк. «Новый чанк» — начать другой."
          : "Составной режим: выдели несколько прямоугольников — они сольются в один чанк."}
      </p>

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

        {ordered.map((region, i) =>
          region.rects.map((rect, idx) => {
            const isTarget = mode === "composite" && region.id === targetId;
            const multi = region.rects.length > 1;
            return (
              <div
                key={`${region.id}:${idx}`}
                className={`region-box${isTarget ? " target" : ""}${
                  multi ? " composite" : ""
                }`}
                data-id={region.id}
                data-idx={idx}
                style={{ ...toPct(rect), cursor: "move" }}
              >
                {idx === 0 && (
                  <>
                    <div className="region-controls">
                      <span className="order-badge">{i + 1}</span>
                      <button
                        className="ord-btn"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveOrder(region.id, -1);
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
                          moveOrder(region.id, 1);
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
                        deleteRegion(region.id);
                      }}
                      title="Удалить чанк целиком"
                    >
                      ×
                    </button>
                  </>
                )}
                {idx > 0 && (
                  <button
                    className="delete part"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRegionRect(layer.id, screen.id, region.id, idx);
                    }}
                    title="Удалить эту часть чанка"
                  >
                    ×
                  </button>
                )}
                <div
                  className="region-handle br"
                  onPointerDown={(e) =>
                    onHandlePointerDown(e, region.id, idx, rect)
                  }
                  title="Изменить размер"
                />
              </div>
            );
          })
        )}

        {draft && (draft.w > 0 || draft.h > 0) && (
          <div className="draw-rect" style={toPct(draft)} />
        )}
      </div>
    </div>
  );
}
