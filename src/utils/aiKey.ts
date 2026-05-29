const KEY = "ss-editor-gemini-key";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(k: string) {
  try {
    localStorage.setItem(KEY, k.trim());
  } catch {}
}

export function clearApiKey() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}
