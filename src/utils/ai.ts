// Multi-provider image editing. Each provider takes an image + free-form
// instruction and returns an edited image (data URL). BYOK, browser-direct.

export type ProviderId = "gemini" | "openai";

export type AiProvider = {
  id: ProviderId;
  label: string;
  /** Short note shown under the selector. */
  blurb: string;
  /** Where the user gets a key. */
  keyUrl: string;
  /** Placeholder for the key input. */
  keyPlaceholder: string;
  /** Default model id (user can override in the UI). */
  defaultModel: string;
  /** Edit an image by instruction. Returns a data URL. Throws on failure. */
  editImage: (
    imageDataUrl: string,
    prompt: string,
    apiKey: string,
    model: string
  ) => Promise<string>;
};

// ───────── helpers ─────────

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const mimeType = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  return { mimeType, data };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const { mimeType, data } = splitDataUrl(dataUrl);
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

// ───────── Gemini 2.5 Flash Image ("Nano Banana") ─────────

async function editImageWithGemini(
  imageDataUrl: string,
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const { mimeType, data } = splitDataUrl(imageDataUrl);
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data } }],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
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
    if (res.status === 400 && /API key/i.test(msg)) msg = "Неверный API-ключ. " + msg;
    throw new Error(msg);
  }

  const json = await res.json();
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      const mt = inline.mimeType ?? inline.mime_type ?? "image/png";
      return `data:${mt};base64,${inline.data}`;
    }
  }
  const text = parts.map((p) => p.text).filter(Boolean).join(" ").trim();
  const block = json?.promptFeedback?.blockReason;
  if (block) throw new Error(`Запрос отклонён модерацией (${block}).`);
  throw new Error(
    text || "Модель не вернула изображение. Попробуй переформулировать запрос."
  );
}

// ───────── OpenAI image models (gpt-image-*) ─────────

async function editImageWithOpenAI(
  imageDataUrl: string,
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const blob = dataUrlToBlob(imageDataUrl);
  const form = new FormData();
  form.append("model", model);
  form.append(
    "image",
    new File([blob], "image.png", { type: blob.type || "image/png" })
  );
  form.append("prompt", prompt);
  form.append("size", "auto");

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (e) {
    throw new Error(
      "Не удалось связаться с OpenAI API (сеть/CORS). " + (e as Error).message
    );
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {}
    if (res.status === 401) msg = "Неверный API-ключ OpenAI. " + msg;
    throw new Error(msg);
  }

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64)
    throw new Error("Модель не вернула изображение. Попробуй переформулировать запрос.");
  return `data:image/png;base64,${b64}`;
}

// ───────── registry ─────────

export const PROVIDERS: Record<ProviderId, AiProvider> = {
  gemini: {
    id: "gemini",
    label: "Gemini Flash Image",
    blurb: "Google · сильна в сохранении персонажа, дешёвая и быстрая",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    defaultModel: "gemini-2.5-flash-image",
    editImage: editImageWithGemini,
  },
  openai: {
    id: "openai",
    label: "ChatGPT (gpt-image)",
    blurb: "OpenAI · качественные правки, размер кадра подбирается автоматически",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    defaultModel: "gpt-image-2",
    editImage: editImageWithOpenAI,
  },
};

export const PROVIDER_LIST: AiProvider[] = [PROVIDERS.gemini, PROVIDERS.openai];

export function getProvider(id: ProviderId): AiProvider {
  return PROVIDERS[id] ?? PROVIDERS.gemini;
}
