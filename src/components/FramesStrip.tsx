import { useProject } from "../store";
import { FrameCard } from "./FrameCard";

export function FramesStrip() {
  const layers = useProject((s) => s.layers);
  const activeId = useProject((s) => s.activeLayerId);
  const addLayer = useProject((s) => s.addLayer);

  return (
    <div className="frames-strip">
      <div className="frames-strip-inner">
        {layers.map((l) => (
          <FrameCard key={l.id} layer={l} active={l.id === activeId} />
        ))}
        <button
          className="frame-card frame-card-add"
          onClick={addLayer}
          title="Добавить кадр"
        >
          <div className="plus">+</div>
          <div className="frame-card-label">Новый кадр</div>
        </button>
      </div>
    </div>
  );
}
