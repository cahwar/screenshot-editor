import { useState } from "react";
import { Layer } from "../types";
import { useProject } from "../store";
import { getProvider, PROVIDER_LIST, ProviderId } from "../utils/ai";
import {
  getActiveProvider,
  getApiKey,
  getModelOverride,
  hasApiKey,
  setActiveProvider,
  setModelOverride,
} from "../utils/aiKey";
import { loadImage } from "../utils/image";
import { ApiKeyModal } from "./ApiKeyModal";

const SUGGESTIONS = [
  "Вложи дробовик в руки персонажа",
  "Смени позу: персонаж сидит на корточках",
  "Поменяй фон на ночную улицу",
  "Убери вотермарк в правом нижнем углу",
];

export function AiEditPanel({ layer }: { layer: Layer }) {
  const replaceBackgroundImage = useProject((s) => s.replaceBackgroundImage);
  const undoBackground = useProject((s) => s.undoBackground);

  const [providerId, setProviderId] = useState<ProviderId>(getActiveProvider());
  const [model, setModel] = useState(
    () =>
      getModelOverride(getActiveProvider()) ||
      getProvider(getActiveProvider()).defaultModel
  );
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const provider = getProvider(providerId);
  const bg = layer.background;
  if (!bg) return null;

  const pickProvider = (id: ProviderId) => {
    setProviderId(id);
    setActiveProvider(id);
    setModel(getModelOverride(id) || getProvider(id).defaultModel);
    setError(null);
  };

  const changeModel = (value: string) => {
    setModel(value);
    setModelOverride(providerId, value);
  };

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    if (!hasApiKey(providerId)) {
      setShowKeyModal(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await provider.editImage(
        bg.src,
        text,
        getApiKey(providerId),
        (model.trim() || provider.defaultModel)
      );
      const img = await loadImage(dataUrl);
      replaceBackgroundImage(layer.id, {
        src: dataUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <span className="ai-badge">AI</span>
        <strong>Правка через ИИ</strong>
        <button
          className="ai-key-btn"
          onClick={() => setShowKeyModal(true)}
          title="Управление API-ключом"
        >
          {hasApiKey(providerId) ? "ключ ✓" : "указать ключ"}
        </button>
      </div>

      <div className="ai-provider-row">
        <label className="ai-provider-label">Модель</label>
        <select
          className="ai-select"
          value={providerId}
          disabled={busy}
          onChange={(e) => pickProvider(e.target.value as ProviderId)}
        >
          {PROVIDER_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {hasApiKey(p.id) ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="ai-provider-row">
        <label className="ai-provider-label">Модель id</label>
        <input
          className="ai-model-input"
          type="text"
          value={model}
          disabled={busy}
          placeholder={provider.defaultModel}
          onChange={(e) => changeModel(e.target.value)}
          spellCheck={false}
        />
      </div>
      <p className="hint ai-blurb">{provider.blurb}</p>

      <textarea
        className="ai-prompt"
        placeholder="Опиши правку: смени позу, вложи объект в руки, поменяй фон…"
        value={prompt}
        rows={2}
        disabled={busy}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
        }}
      />

      <div className="ai-suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="ai-chip"
            disabled={busy}
            onClick={() => setPrompt(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="ai-actions">
        <button className="btn" onClick={run} disabled={busy || !prompt.trim()}>
          {busy && <span className="spinner" />}
          {busy ? "Генерация…" : "Применить ИИ"}
        </button>
        <button
          className="btn secondary"
          onClick={() => undoBackground(layer.id)}
          disabled={busy || layer.bgHistory.length === 0}
          title="Вернуть предыдущую версию фона"
        >
          ↩ Отменить правку
          {layer.bgHistory.length > 0 ? ` (${layer.bgHistory.length})` : ""}
        </button>
      </div>

      {error && <div className="ai-error">{error}</div>}

      <p className="hint">
        Модель перерисовывает весь кадр по инструкции, стараясь сохранить
        персонажа. ⌘/Ctrl+Enter — быстрый запуск.
      </p>

      {showKeyModal && (
        <ApiKeyModal
          provider={provider}
          onClose={() => setShowKeyModal(false)}
          onSaved={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}
