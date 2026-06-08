import { useState } from "react";
import { useActiveLayer, useProject } from "./store";
import { FramesStrip } from "./components/FramesStrip";
import { AssetSidebar } from "./components/AssetSidebar";
import { AssetEditor } from "./components/AssetEditor";
import { exportProjectZip, downloadBlob } from "./utils/export";
import { AuthButton } from "./components/AuthButton";
import { usePasteImages } from "./utils/usePasteImages";

export function App() {
  const layers = useProject((s) => s.layers);
  const activeLayer = useActiveLayer();
  const [exporting, setExporting] = useState(false);

  usePasteImages();

  const canExport = layers.some((l) => l.background);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportProjectZip(layers);
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      downloadBlob(blob, `ss-${ts}.zip`);
    } catch (e) {
      console.error(e);
      alert("Ошибка экспорта: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          SS Editor <span className="muted">— редактор скриншот-ситуаций</span>
        </h1>
        <div className="header-actions">
          <AuthButton />
          <button
            className="btn"
            onClick={handleExport}
            disabled={!canExport || exporting}
          >
            {exporting && <span className="spinner" />}
            {exporting ? "Сборка архива…" : "Экспорт ZIP"}
          </button>
        </div>
      </header>

      <FramesStrip />

      <div className="workspace">
        {activeLayer ? (
          <>
            <aside className="sidebar">
              <AssetSidebar key={activeLayer.id} layer={activeLayer} />
            </aside>
            <main className="main">
              <div className="main-inner">
                <AssetEditor
                  key={`${activeLayer.id}-${activeLayer.activeAsset}`}
                  layer={activeLayer}
                />
              </div>
            </main>
          </>
        ) : (
          <main className="main">
            <div className="main-inner">
              <div className="empty-hint">Создай кадр, чтобы начать</div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
