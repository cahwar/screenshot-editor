import { useState } from "react";
import { Layer } from "../types";
import { useProject } from "../store";
import { editImageWithGemini } from "../utils/ai";
import { getApiKey, hasApiKey } from "../utils/aiKey";
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

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const bg = layer.background;
  if (!bg) return null;

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    if (!hasApiKey()) {
      setShowKeyModal(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { dataUrl } = await editImageWithGemini(bg.src, text, getApiKey());
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
          {hasApiKey() ? "ключ ✓" : "указать ключ"}
        </button>
      </div>

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
          onClose={() => setShowKeyModal(false)}
          onSaved={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}
