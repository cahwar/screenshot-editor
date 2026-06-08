import { Layer, TextScreen } from "../types";
import { useProject } from "../store";
import { TextRegionSelector } from "./TextRegionSelector";

export function TextEditor({
  layer,
  screen,
}: {
  layer: Layer;
  screen: TextScreen;
}) {
  const reorderRegions = useProject((s) => s.reorderRegions);

  const sortByY = () => {
    const topY = (r: (typeof screen.regions)[number]) =>
      Math.min(...r.rects.map((rc) => rc.y));
    const ordered = [...screen.regions]
      .sort((a, b) => topY(a) - topY(b))
      .map((r) => r.id);
    reorderRegions(layer.id, screen.id, ordered);
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <h2>{screen.name}</h2>
        <button
          className="btn small secondary"
          onClick={sortByY}
          disabled={screen.regions.length < 2}
          title="Переупорядочить по вертикали (сверху → вниз)"
        >
          Сортировать сверху вниз
        </button>
      </div>
      <p className="hint">
        Веди прямоугольником вокруг нужных строк. Номер на бейдже — порядок в
        финальном тексте.
      </p>
      <TextRegionSelector layer={layer} screen={screen} />
    </div>
  );
}
