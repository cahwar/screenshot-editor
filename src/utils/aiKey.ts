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
