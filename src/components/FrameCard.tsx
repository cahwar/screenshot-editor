import { memo, useEffect, useState } from "react";
import { Layer } from "../types";
import { useProject } from "../store";
import { renderFrameThumb } from "../utils/thumb";

type Props = {
  layer: Layer;
  active: boolean;
};

function FrameCardBase({ layer, active }: Props) {
  const selectLayer = useProject((s) => s.selectLayer);
  const removeLayer = useProject((s) => s.removeLayer);
  const renameLayer = useProject((s) => s.renameLayer);
  const [thumb, setThumb] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const depKey = JSON.stringify({
    bg: layer.background
      ? { s: layer.background.src.length, c: layer.background.crop }
      : null,
    tw: layer.targetWidth,
    th: layer.targetHeight,
    sc: layer.textScreens.map((s) => ({
      r: s.regions.map((r) => ({ ...r.rect, o: r.order })),
    })),
    o: layer.overlay,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await renderFrameThumb(layer, 220);
      if (!cancelled) setThumb(t);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return (
    <div
      className={`frame-card ${active ? "active" : ""}`}
      onClick={() => selectLayer(layer.id)}
    >
      <div className="frame-thumb">
        {thumb ? (
          <img src={thumb} alt="" />
        ) : (
          <div className="frame-thumb-empty">пусто</div>
        )}
      </div>
      <div className="frame-card-label">
        {editing ? (
          <input
            autoFocus
            value={layer.name}
            onChange={(e) => renameLayer(layer.id, e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title="Двойной клик — переименовать"
          >
            {layer.name}
          </span>
        )}
      </div>
      <button
        className="frame-card-del"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Удалить кадр "${layer.name}"?`)) removeLayer(layer.id);
        }}
        title="Удалить кадр"
      >
        ×
      </button>
    </div>
  );
}

export const FrameCard = memo(FrameCardBase);
