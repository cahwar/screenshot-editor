export type Rect = { x: number; y: number; w: number; h: number };

export type TextRegion = {
  id: string;
  /** One or more rectangles forming a single composition chunk.
   *  Single-select mode produces one rect; composite mode layers several. */
  rects: Rect[];
  order: number;
};

export type TextScreen = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  regions: TextRegion[];
};

export type BackgroundImage = {
  src: string;
  width: number;
  height: number;
  crop: Rect;
};

export type TextOverlaySettings = {
  posX: number;
  posY: number;
  scale: number;
  strokeColor: string;
  strokeWidth: number;
  lineGap: number;
  cutTextBg: boolean;
  blackThreshold: number;
  edgeSoftness: number;
  swTextEnabled: boolean;
  swTextStrength: number;
  swBgEnabled: boolean;
  swBgStrength: number;
};

export type AssetKey = "bg" | "comp" | `text:${string}`;

export type Layer = {
  id: string;
  name: string;
  background: BackgroundImage | null;
  bgHistory: BackgroundImage[];
  targetWidth: number;
  targetHeight: number;
  textScreens: TextScreen[];
  activeTextScreenId: string | null;
  activeAsset: AssetKey;
  overlay: TextOverlaySettings;
};

export type Project = {
  layers: Layer[];
  activeLayerId: string | null;
};

export const DEFAULT_OVERLAY: TextOverlaySettings = {
  posX: 0.04,
  posY: 0.78,
  scale: 1,
  strokeColor: "#000000",
  strokeWidth: 2,
  lineGap: 2,
  cutTextBg: true,
  blackThreshold: 60,
  edgeSoftness: 24,
  swTextEnabled: false,
  swTextStrength: 0.5,
  swBgEnabled: false,
  swBgStrength: 0.5,
};
