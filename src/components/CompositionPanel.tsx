import { useEffect, useMemo, useRef, useState } from "react";
import { Layer } from "../types";
import { useProject } from "../store";
import {
  buildTextOverlay,
  cropAndScaleBackground,
  loadImage,
  shakalBg,
  shakalOverlay,
} from "../utils/image";

const EDGE = 0.015;

const PRESETS = [
  { label: "Низ — лево", posX: EDGE, posY: 1 - EDGE, anchorY: 1 },
  {
    label: "Низ — центр",
    posX: 0.5,
    posY: 1 - EDGE,
    anchorX: 0.5,
    anchorY: 1,
  },
  {
    label: "Низ — право",
    posX: 1 - EDGE,
    posY: 1 - EDGE,
    anchorX: 1,
    anchorY: 1,
  },
  { label: "Верх — лево", posX: EDGE, posY: EDGE },
  { label: "Верх — центр", posX: 0.5, posY: EDGE, anchorX: 0.5 },
  { label: "Верх — право", posX: 1 - EDGE, posY: EDGE, anchorX: 1 },
] as const;

export function CompositionPanel({ layer }: { layer: Layer }) {
  const patchOverlay = useProject((s) => s.patchOverlay);

  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [overlaySize, setOverlaySize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [rebuilding, setRebuilding] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const bg = layer.background;

  useEffect(() => {
    let cancelled = false;
    if (!bg) {
      setBgUrl(null);
      return;
    }
    (async () => {
      const img = await loadImage(bg.src);
      if (cancelled) return;
      let canvas = cropAndScaleBackground(
        img,
        bg.crop,
        layer.targetWidth,
        layer.targetHeight
      );
      if (layer.overlay.swBgEnabled) {
        canvas = await shakalBg(canvas, layer.overlay.swBgStrength);
        if (cancelled) return;
      }
      setBgUrl(canvas.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
  }, [
    bg?.src,
    bg?.crop.x,
    bg?.crop.y,
    bg?.crop.w,
    bg?.crop.h,
    layer.targetWidth,
    layer.targetHeight,
    layer.overlay.swBgEnabled,
    layer.overlay.swBgStrength,
  ]);

  const overlayDeps = useMemo(
    () =>
      JSON.stringify({
        screens: layer.textScreens.map((s) => ({
          id: s.id,
          src: s.src,
          regions: s.regions,
        })),
        stroke: layer.overlay.strokeColor,
        sw: layer.overlay.strokeWidth,
        gap: layer.overlay.lineGap,
        cut: layer.overlay.cutTextBg,
        bt: layer.overlay.blackThreshold,
        es: layer.overlay.edgeSoftness,
        swTE: layer.overlay.swTextEnabled,
        swTS: layer.overlay.swTextStrength,
      }),
    [
      layer.textScreens,
      layer.overlay.strokeColor,
      layer.overlay.strokeWidth,
      layer.overlay.lineGap,
      layer.overlay.cutTextBg,
      layer.overlay.blackThreshold,
      layer.overlay.edgeSoftness,
      layer.overlay.swTextEnabled,
      layer.overlay.swTextStrength,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    const hasRegions = layer.textScreens.some((s) => s.regions.length > 0);
    if (!hasRegions) {
      setOverlayUrl(null);
      setOverlaySize({ w: 0, h: 0 });
      return;
    }
    setRebuilding(true);
    (async () => {
      let c = await buildTextOverlay(layer);
      if (cancelled) return;
      if (layer.overlay.swTextEnabled) {
        c = shakalOverlay(c, layer.overlay.swTextStrength);
      }
      setOverlayUrl(c.toDataURL("image/png"));
      setOverlaySize({ w: c.width, h: c.height });
      setRebuilding(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [overlayDeps]);

  // Drag overlay
  const dragRef = useRef<{
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
  } | null>(null);

  const onOverlayPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { x: layer.overlay.posX, y: layer.overlay.posY },
    };
  };

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const dx = (e.clientX - dragRef.current.startMouse.x) / rect.width;
    const dy = (e.clientY - dragRef.current.startMouse.y) / rect.height;
    patchOverlay(layer.id, {
      posX: Math.max(0, Math.min(1, dragRef.current.startPos.x + dx)),
      posY: Math.max(0, Math.min(1, dragRef.current.startPos.y + dy)),
    });
  };

  const onOverlayPointerUp = () => {
    dragRef.current = null;
  };

  const overlayWPct =
    layer.targetWidth > 0
      ? ((overlaySize.w * layer.overlay.scale) / layer.targetWidth) * 100
      : 0;
  const overlayHPct =
    layer.targetHeight > 0
      ? ((overlaySize.h * layer.overlay.scale) / layer.targetHeight) * 100
      : 0;

  if (!bg) {
    return (
      <div className="editor">
        <div className="editor-header">
          <h2>Композиция</h2>
        </div>
        <p className="hint">
          Сначала загрузи фон (раздел «Фон»), чтобы увидеть композицию.
        </p>
      </div>
    );
  }

  return (
    <div className="editor">
      <div className="editor-header">
        <h2>Композиция</h2>
      </div>

      <div className="comp-grid">
        <div className="stage-wrap" style={{ padding: 0 }}>
          <div
            ref={stageRef}
            className="preview-stage"
            style={{
              aspectRatio: `${layer.targetWidth} / ${layer.targetHeight}`,
            }}
          >
            {bgUrl && <img src={bgUrl} alt="" draggable={false} />}
            {overlayUrl && overlaySize.w > 0 && (
              <div
                className="preview-overlay-box"
                style={{
                  left: `${layer.overlay.posX * 100}%`,
                  top: `${layer.overlay.posY * 100}%`,
                  width: `${overlayWPct}%`,
                  height: `${overlayHPct}%`,
                }}
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={onOverlayPointerUp}
                onPointerCancel={onOverlayPointerUp}
              >
                <img src={overlayUrl} alt="" draggable={false} />
              </div>
            )}
            {rebuilding && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.6)",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "white",
                }}
              >
                <span className="spinner" /> обновление…
              </div>
            )}
          </div>
        </div>

        <div className="comp-settings">
          <div className="field">
            <label>Авто-позиции</label>
            <div className="preset-btns">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="preset-btn"
                  onClick={() => {
                    const ax = (p as { anchorX?: number }).anchorX ?? 0;
                    const ay = (p as { anchorY?: number }).anchorY ?? 0;
                    const overlayWFrac =
                      layer.targetWidth > 0
                        ? (overlaySize.w * layer.overlay.scale) /
                          layer.targetWidth
                        : 0;
                    const overlayHFrac =
                      layer.targetHeight > 0
                        ? (overlaySize.h * layer.overlay.scale) /
                          layer.targetHeight
                        : 0;
                    patchOverlay(layer.id, {
                      posX: Math.max(
                        0,
                        Math.min(
                          Math.max(0, 1 - overlayWFrac),
                          p.posX - ax * overlayWFrac
                        )
                      ),
                      posY: Math.max(
                        0,
                        Math.min(
                          Math.max(0, 1 - overlayHFrac),
                          p.posY - ay * overlayHFrac
                        )
                      ),
                    });
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Масштаб текста: {layer.overlay.scale.toFixed(2)}×</label>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={layer.overlay.scale}
              onChange={(e) =>
                patchOverlay(layer.id, { scale: parseFloat(e.target.value) })
              }
            />
          </div>

          <div className="field">
            <label>Толщина обводки: {layer.overlay.strokeWidth}px</label>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={layer.overlay.strokeWidth}
              onChange={(e) =>
                patchOverlay(layer.id, {
                  strokeWidth: parseInt(e.target.value),
                })
              }
            />
          </div>

          <div className="field">
            <label>Цвет обводки</label>
            <input
              type="color"
              value={layer.overlay.strokeColor}
              onChange={(e) =>
                patchOverlay(layer.id, { strokeColor: e.target.value })
              }
            />
          </div>

          <div className="field">
            <label>Межстрочный отступ: {layer.overlay.lineGap}px</label>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={layer.overlay.lineGap}
              onChange={(e) =>
                patchOverlay(layer.id, { lineGap: parseInt(e.target.value) })
              }
            />
          </div>

          <label className="toggle-row">
            <span className="toggle-switch">
              <input
                type="checkbox"
                checked={layer.overlay.cutTextBg}
                onChange={(e) =>
                  patchOverlay(layer.id, {
                    cutTextBg: e.target.checked,
                  })
                }
              />
              <span className="toggle-slider" />
            </span>
            <span>Вырезать чёрный фон текста</span>
          </label>
          <p className="hint" style={{ margin: "2px 0 0" }}>
            {layer.overlay.cutTextBg
              ? "Чёрный фон под текстом ищется и удаляется."
              : "Текст вставляется как есть, вместе с фоном."}
          </p>

          {layer.overlay.cutTextBg && (
            <>
              <div className="field">
                <label>Порог чёрного: {layer.overlay.blackThreshold}</label>
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="1"
                  value={layer.overlay.blackThreshold}
                  onChange={(e) =>
                    patchOverlay(layer.id, {
                      blackThreshold: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="field">
                <label>Мягкость края: {layer.overlay.edgeSoftness}</label>
                <input
                  type="range"
                  min="1"
                  max="120"
                  step="1"
                  value={layer.overlay.edgeSoftness}
                  onChange={(e) =>
                    patchOverlay(layer.id, {
                      edgeSoftness: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </>
          )}

          <div className="sw-block">
            <div className="sw-block-title">SW Style — шакалит</div>

            <label className="toggle-row">
              <span className="toggle-switch">
                <input
                  type="checkbox"
                  checked={layer.overlay.swTextEnabled}
                  onChange={(e) =>
                    patchOverlay(layer.id, {
                      swTextEnabled: e.target.checked,
                    })
                  }
                />
                <span className="toggle-slider" />
              </span>
              <span>Текст</span>
            </label>
            {layer.overlay.swTextEnabled && (
              <div className="field sw-strength">
                <label>
                  Сила: {Math.round(layer.overlay.swTextStrength * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={layer.overlay.swTextStrength}
                  onChange={(e) =>
                    patchOverlay(layer.id, {
                      swTextStrength: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            )}

            <label className="toggle-row" style={{ marginTop: 10 }}>
              <span className="toggle-switch">
                <input
                  type="checkbox"
                  checked={layer.overlay.swBgEnabled}
                  onChange={(e) =>
                    patchOverlay(layer.id, {
                      swBgEnabled: e.target.checked,
                    })
                  }
                />
                <span className="toggle-slider" />
              </span>
              <span>Фон</span>
            </label>
            {layer.overlay.swBgEnabled && (
              <div className="field sw-strength">
                <label>
                  Сила: {Math.round(layer.overlay.swBgStrength * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={layer.overlay.swBgStrength}
                  onChange={(e) =>
                    patchOverlay(layer.id, {
                      swBgStrength: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
