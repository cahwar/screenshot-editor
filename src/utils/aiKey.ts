import { ProviderId } from "./ai";

const keyStorageKey = (provider: ProviderId) => `ss-editor-aikey-${provider}`;
const ACTIVE_KEY = "ss-editor-ai-provider";

export function getApiKey(provider: ProviderId): string {
  try {
    return localStorage.getItem(keyStorageKey(provider)) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(provider: ProviderId, k: string) {
  try {
    localStorage.setItem(keyStorageKey(provider), k.trim());
  } catch {}
}

export function clearApiKey(provider: ProviderId) {
  try {
    localStorage.removeItem(keyStorageKey(provider));
  } catch {}
}

export function hasApiKey(provider: ProviderId): boolean {
  return getApiKey(provider).length > 0;
}

const modelStorageKey = (provider: ProviderId) =>
  `ss-editor-aimodel-${provider}`;

export function getModelOverride(provider: ProviderId): string {
  try {
    return localStorage.getItem(modelStorageKey(provider)) ?? "";
  } catch {
    return "";
  }
}

export function setModelOverride(provider: ProviderId, model: string) {
  try {
    const v = model.trim();
    if (v) localStorage.setItem(modelStorageKey(provider), v);
    else localStorage.removeItem(modelStorageKey(provider));
  } catch {}
}

export function getActiveProvider(): ProviderId {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    if (v === "gemini" || v === "openai") return v;
  } catch {}
  return "gemini";
}

export function setActiveProvider(provider: ProviderId) {
  try {
    localStorage.setItem(ACTIVE_KEY, provider);
  } catch {}
}
