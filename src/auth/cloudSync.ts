// Bridge between the browser's localStorage (the synchronous source of truth the
// rest of the app already reads) and the per-user `user_settings` row in
// Supabase. On sign-in we pull the cloud row into localStorage; on every local
// change we debounce-push localStorage back up. Without a session it's a no-op,
// so the app behaves exactly as before.
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { ProviderId } from "../utils/ai";
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getModelOverride,
  setModelOverride,
  getActiveProvider,
  setActiveProvider,
} from "../utils/aiKey";
import { loadPrefs, applyPrefs, Prefs } from "../utils/prefs";

const TABLE = "user_settings";
const PROVIDERS: ProviderId[] = ["gemini", "openai"];
export const SETTINGS_SYNCED_EVENT = "ss-settings-synced";

type SettingsRow = {
  prefs?: Partial<Prefs> | null;
  ai_keys?: Record<string, string> | null;
  ai_models?: Record<string, string> | null;
  active_provider?: string | null;
};

let currentUserId: string | null = null;
let applyingRemote = false;
let pushTimer: number | null = null;

/** Called by AuthProvider when the session changes. null = signed out. */
export function setSyncUser(userId: string | null) {
  currentUserId = userId;
}

function collectLocal() {
  const ai_keys: Record<string, string> = {};
  const ai_models: Record<string, string> = {};
  for (const p of PROVIDERS) {
    ai_keys[p] = getApiKey(p);
    ai_models[p] = getModelOverride(p);
  }
  return {
    prefs: loadPrefs(),
    ai_keys,
    ai_models,
    active_provider: getActiveProvider(),
  };
}

function applyRemote(row: SettingsRow) {
  applyingRemote = true;
  try {
    if (row.prefs && typeof row.prefs === "object") {
      applyPrefs(row.prefs as Prefs);
    }
    for (const p of PROVIDERS) {
      const key = row.ai_keys?.[p] ?? "";
      if (key) setApiKey(p, key);
      else clearApiKey(p);
      setModelOverride(p, row.ai_models?.[p] ?? "");
    }
    if (row.active_provider === "gemini" || row.active_provider === "openai") {
      setActiveProvider(row.active_provider);
    }
  } finally {
    applyingRemote = false;
  }
  // Let the UI (AI panel, store defaults) re-read from localStorage.
  window.dispatchEvent(new CustomEvent(SETTINGS_SYNCED_EVENT));
}

async function pushNow(userId: string) {
  if (!isSupabaseConfigured) return;
  const payload = {
    user_id: userId,
    ...collectLocal(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id" });
  if (error) console.error("cloudSync push failed:", error.message);
}

/** Pull the user's row on sign-in. Cloud wins if a row exists; otherwise seed
 *  the cloud from whatever is currently local (new account). */
export async function pullSettings(userId: string) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase
    .from(TABLE)
    .select("prefs, ai_keys, ai_models, active_provider")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("cloudSync pull failed:", error.message);
    return;
  }
  if (data) applyRemote(data as SettingsRow);
  else await pushNow(userId);
}

/** Debounced push of current local settings to the cloud. No-op when signed
 *  out, when Supabase is unconfigured, or while applying a remote pull. */
export function scheduleCloudPush() {
  if (applyingRemote || !currentUserId || !isSupabaseConfigured) return;
  if (pushTimer != null) return;
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    const uid = currentUserId;
    if (uid) void pushNow(uid);
  }, 500);
}
