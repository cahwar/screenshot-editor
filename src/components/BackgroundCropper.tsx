import { useRef } from "react";
import { Layer, Rect } from "../types";
import { useProject } from "../store";

type DragState =
  | { kind: "move"; startMouse: { x: number; y: number }; startCrop: Rect; scale: number }
  | {
      kind: "resize";
      startMouse: { x: number; y: number };
      startCrop: Rect;
      scale: number;
    };

export function BackgroundCropper({ layer }: { layer: Layer }) {
  const setBackgroundCrop = useProject((s) => s.setBackgroundCrop);
  const bg = layer.background!;
  const aspect = layer.targetWidth / layer.targetHeight;

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const getScale = () => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return rect.width / bg.width;
  };

  const onBoxPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      startMouse: { x: e.clientX, y: e.clientY },
      startCrop: { ...bg.crop },
      scale: getScale(),
    };
  };

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      startMouse: { x: e.clientX, y: e.clientY },
      startCrop: { ...bg.crop },
      scale: getScale(),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startMouse.x) / drag.scale;
    const dy = (e.clientY - drag.startMouse.y) / drag.scale;
    if (drag.kind === "move") {
      let x = drag.startCrop.x + dx;
      let y = drag.startCrop.y + dy;
      x = Math.max(0, Math.min(bg.width - drag.startCrop.w, x));
      y = Math.max(0, Math.min(bg.height - drag.startCrop.h, y));
      setBackgroundCrop(layer.id, { ...drag.startCrop, x, y });
    } else {
      let newW = drag.startCrop.w + dx;
      let newH = drag.startCrop.h + dy;
      const fromW = newW / aspect;
      const fromH = newH * aspect;
      if (Math.abs(newH - fromW) < Math.abs(newW - fromH)) {
        newH = fromW;
      } else {
        newW = fromH;
      }
      const maxW = bg.width - drag.startCrop.x;
      const maxH = bg.height - drag.startCrop.y;
      if (newW > maxW) {
        newW = maxW;
        newH = newW / aspect;
      }
      if (newH > maxH) {
        newH = maxH;
        newW = newH * aspect;
      }
      const minW = 40;
      if (newW < minW) {
        newW = minW;
        newH = newW / aspect;
      }
      setBackgroundCrop(layer.id, {
        x: drag.startCrop.x,
        y: drag.startCrop.y,
        w: newW,
        h: newH,
      });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const boxStyle = {
    left: `${(bg.crop.x / bg.width) * 100}%`,
    top: `${(bg.crop.y / bg.height) * 100}%`,
    width: `${(bg.crop.w / bg.width) * 100}%`,
    height: `${(bg.crop.h / bg.height) * 100}%`,
  };

  return (
    <div className="stage-wrap">
      <div
        ref={stageRef}
        className="crop-stage"
        style={{ maxWidth: bg.width }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={bg.src} alt="" draggable={false} />
        <div
          className="crop-box"
          style={boxStyle}
          onPointerDown={onBoxPointerDown}
        >
          <div
            className="crop-handle br"
            onPointerDown={onHandlePointerDown}
          />
        </div>
      </div>
    </div>
  );
}
