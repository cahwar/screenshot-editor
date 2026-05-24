import { useEffect, useState } from "react";
import { AssetKey, Layer } from "../types";
import { useProject } from "../store";
import { renderBgThumb, renderFrameThumb } from "../utils/thumb";
import { loadImage, readFileAsDataURL } from "../utils/image";

export function AssetSidebar({ layer }: { layer: Layer }) {
  const selectAsset = useProject((s) => s.selectAsset);
  const setBackground = useProject((s) => s.setBackground);
  const addTextScreens = useProject((s) => s.addTextScreens);
  const removeTextScreen = useProject((s) => s.removeTextScreen);
  const renameTextScreen = useProject((s) => s.renameTextScreen);

  const handleBgFile = async (file: File) => {
    const src = await readFileAsDataURL(file);
    const img = await loadImage(src);
    setBackground(layer.id, {
      src,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    selectAsset(layer.id, "bg");
  };

  const handleTextFiles = async (files: File[]) => {
    const loaded = await Promise.all(
      files.map(async (f) => {
        const src = await readFileAsDataURL(f);
        const img = await loadImage(src);
        return {
          name: f.name,
          src,
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
      })
    );
    addTextScreens(layer.id, loaded);
  };

  return (
    <div className="asset-sidebar">
      <BgAssetItem
        layer={layer}
        active={layer.activeAsset === "bg"}
        onSelect={() => selectAsset(layer.id, "bg")}
        onUpload={handleBgFile}
      />

      <div className="asset-divider">
        <span>Текст</span>
      </div>

      {layer.textScreens.map((screen) => (
        <TextAssetItem
          key={screen.id}
          screen={screen}
          active={layer.activeAsset === (`text:${screen.id}` as AssetKey)}
          onSelect={() =>
            selectAsset(layer.id, `text:${screen.id}` as AssetKey)
          }
          onDelete={() => {
            if (confirm(`Удалить "${screen.name}"?`))
              removeTextScreen(layer.id, screen.id);
          }}
          onRename={(name) => renameTextScreen(layer.id, screen.id, name)}
        />
      ))}

      <label className="asset-add-btn">
        + Добавить текст
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) handleTextFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </label>

      <div className="asset-divider" />

      <CompAssetItem
        layer={layer}
        active={layer.activeAsset === "comp"}
        onSelect={() => selectAsset(layer.id, "comp")}
      />
    </div>
  );
}

function BgAssetItem({
  layer,
  active,
  onSelect,
  onUpload,
}: {
  layer: Layer;
  active: boolean;
  onSelect: () => void;
  onUpload: (file: File) => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  const depKey = layer.background
    ? `${layer.background.src.length}-${JSON.stringify(layer.background.crop)}-${layer.targetWidth}x${layer.targetHeight}`
    : "none";

  useEffect(() => {
    let cancelled = false;
    if (!layer.background) {
      setThumb(null);
      return;
    }
    (async () => {
      const t = await renderBgThumb(layer, 180);
      if (!cancelled) setThumb(t);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  if (!layer.background) {
    return (
      <label
        className={`asset-item asset-item-upload ${active ? "active" : ""}`}
      >
        <div className="asset-thumb">
          <div className="asset-thumb-empty">+ загрузи</div>
        </div>
        <div className="asset-label">Фон</div>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) onUpload(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
    );
  }

  return (
    <div
      className={`asset-item ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="asset-thumb">
        {thumb && <img src={thumb} alt="" />}
      </div>
      <div className="asset-label">Фон</div>
    </div>
  );
}

function TextAssetItem({
  screen,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  screen: { id: string; name: string; src: string; regions: any[] };
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`asset-item ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="asset-thumb asset-thumb-text">
        <img src={screen.src} alt="" />
      </div>
      <div className="asset-label">
        {editing ? (
          <input
            autoFocus
            value={screen.name}
            onChange={(e) => onRename(e.target.value)}
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
            {screen.name}
          </span>
        )}
        {screen.regions.length > 0 && (
          <span className="asset-count">{screen.regions.length}</span>
        )}
      </div>
      <button
        className="asset-del"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Удалить"
      >
        ×
      </button>
    </div>
  );
}

function CompAssetItem({
  layer,
  active,
  onSelect,
}: {
  layer: Layer;
  active: boolean;
  onSelect: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

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
      const t = await renderFrameThumb(layer, 180);
      if (!cancelled) setThumb(t);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return (
    <div
      className={`asset-item ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="asset-thumb">
        {thumb ? (
          <img src={thumb} alt="" />
        ) : (
          <div className="asset-thumb-empty">—</div>
        )}
      </div>
      <div className="asset-label">Композиция</div>
    </div>
  );
}
