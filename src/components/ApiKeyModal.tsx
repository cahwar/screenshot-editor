import { useState } from "react";
import { GEMINI_KEY_URL } from "../utils/ai";
import { getApiKey, setApiKey, clearApiKey } from "../utils/aiKey";

type Props = {
  onClose: () => void;
  onSaved: (key: string) => void;
};

export function ApiKeyModal({ onClose, onSaved }: Props) {
  const [value, setValue] = useState(getApiKey());

  const save = () => {
    const k = value.trim();
    if (!k) return;
    setApiKey(k);
    onSaved(k);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ключ Gemini API</h3>
        <p className="hint">
          Правки выполняет Gemini 2.5 Flash Image. Нужен твой личный API-ключ —
          он хранится только в этом браузере и отправляется напрямую в Google,
          минуя любые серверы.
        </p>
        <p className="hint">
          Получить ключ бесплатно:{" "}
          <a href={GEMINI_KEY_URL} target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>
        </p>
        <input
          className="key-input"
          type="password"
          placeholder="AIza…"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <div className="modal-actions">
          {getApiKey() && (
            <button
              className="btn small danger"
              onClick={() => {
                clearApiKey();
                setValue("");
                onSaved("");
              }}
            >
              Удалить ключ
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn small secondary" onClick={onClose}>
              Отмена
            </button>
            <button className="btn small" onClick={save} disabled={!value.trim()}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
