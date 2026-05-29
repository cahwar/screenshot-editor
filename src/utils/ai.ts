// Gemini 2.5 Flash Image ("Nano Banana") — instruction-based image editing.
// Model IDs shift occasionally; if requests start 404-ing, update this.
const MODEL = "gemini-2.5-flash-image";

const endpoint = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;

function dataUrlToInline(dataUrl: string): { mimeType: string; data: string } {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const mimeType = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  return { mimeType, data };
}

export type GeminiEditResult = {
  dataUrl: string;
};

/**
 * Send an image + free-form instruction to Gemini and get back an edited image.
 * Throws Error with a human-readable message on failure (including model refusals).
 */
export async function editImageWithGemini(
  imageDataUrl: string,
  prompt: string,
  apiKey: string
): Promise<GeminiEditResult> {
  const { mimeType, data } = dataUrlToInline(imageDataUrl);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  let res: Response;
  try {
    res = await fetch(endpoint(MODEL, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(
      "Не удалось связаться с Gemini API (сеть/CORS). " + (e as Error).message
    );
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {}
    if (res.status === 400 && /API key/i.test(msg)) {
      msg = "Неверный API-ключ. " + msg;
    }
    throw new Error(msg);
  }

  const json = await res.json();
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];

  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      const mt = inline.mimeType ?? inline.mime_type ?? "image/png";
      return { dataUrl: `data:${mt};base64,${inline.data}` };
    }
  }

  const text = parts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .trim();
  const blockReason = json?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Запрос отклонён модерацией (${blockReason}).`);
  }
  throw new Error(
    text || "Модель не вернула изображение. Попробуй переформулировать запрос."
  );
}

export const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";
