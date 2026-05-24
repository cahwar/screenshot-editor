import { useEffect, useState } from "react";
import { Layer } from "../types";
import { useProject } from "../store";
import { BackgroundCropper } from "./BackgroundCropper";
import { FileDrop } from "./FileDrop";
import { loadImage, readFileAsDataURL } from "../utils/image";

const SIZE_PRESETS = [
  { label: "16:9 · 1280×720", w: 1280, h: 720 },
  { label: "16:9 · 1920×1080", w: 1920, h: 1080 },
  { label: "1:1 · 1080×1080", w: 1080, h: 1080 },
  { label: "4:3 · 1024×768", w: 1024, h: 768 },
];

const MIN_SIZE = 64;
const MAX_SIZE = 8192;

function clampSize(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(v)));
}

export function BackgroundEditor({ layer }: { layer: Layer }) {
  const setBackground = useProject((s) => s.setBackground);
  const setTargetSize = useProject((s) => s.setTargetSize);

  const [wStr, setWStr] = useState(String(layer.targetWidth));
  const [hStr, setHStr] = useState(String(layer.targetHeight));

  useEffect(() => {
    setWStr(String(layer.targetWidth));
  }, [layer.targetWidth]);
  useEffect(() => {
    setHStr(String(layer.targetHeight));
  }, [layer.targetHeight]);

  const commitW = () => {
    const v = clampSize(parseInt(wStr, 10), layer.targetWidth);
    setTargetSize(layer.id, v, layer.targetHeight);
    setWStr(String(v));
  };
  const commitH = () => {
    const v = clampSize(parseInt(hStr, 10), layer.targetHeight);
    setTargetSize(layer.id, layer.targetWidth, v);
    setHStr(String(v));
  };

  const handleBgFiles = async (files: File[]) => {
    const file = files[0];
    const src = await readFileAsDataURL(file);
    const img = await loadImage(src);
    setBackground(layer.id, {
      src,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <h2>Фон</h2>
        {layer.background && (
          <button
            className="btn small secondary"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = () => {
                if (input.files?.[0]) handleBgFiles([input.files[0]]);
              };
              input.click();
            }}
          >
            Заменить
          </button>
        )}
      </div>

      <div className="config-grid">
        <div className="field">
          <label>Ширина</label>
          <input
            type="number"
            value={wStr}
            min={MIN_SIZE}
            max={MAX_SIZE}
            onChange={(e) => setWStr(e.target.value)}
            onBlur={commitW}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div className="field">
          <label>Высота</label>
          <input
            type="number"
            value={hStr}
            min={MIN_SIZE}
            max={MAX_SIZE}
            onChange={(e) => setHStr(e.target.value)}
            onBlur={commitH}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div className="field field-grow">
          <label>Пресеты разрешения</label>
          <div className="preset-btns">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                className={`preset-btn ${
                  layer.targetWidth === p.w && layer.targetHeight === p.h
                    ? "selected"
                    : ""
                }`}
                onClick={() => setTargetSize(layer.id, p.w, p.h)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!layer.background ? (
        <FileDrop
          label="Перетащи или выбери фоновый скриншот персонажа"
          onFiles={handleBgFiles}
        />
      ) : (
        <BackgroundCropper layer={layer} />
      )}
    </div>
  );
}
