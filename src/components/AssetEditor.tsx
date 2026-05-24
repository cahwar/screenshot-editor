import { Layer } from "../types";
import { BackgroundEditor } from "./BackgroundEditor";
import { CompositionPanel } from "./CompositionPanel";
import { TextEditor } from "./TextEditor";

export function AssetEditor({ layer }: { layer: Layer }) {
  const key = layer.activeAsset;

  if (key === "bg") return <BackgroundEditor layer={layer} />;
  if (key === "comp") return <CompositionPanel layer={layer} />;

  if (key.startsWith("text:")) {
    const id = key.slice(5);
    const screen = layer.textScreens.find((s) => s.id === id);
    if (!screen) {
      return (
        <div className="editor">
          <p className="hint">Текстовый скрин не найден.</p>
        </div>
      );
    }
    return <TextEditor layer={layer} screen={screen} />;
  }

  return null;
}
