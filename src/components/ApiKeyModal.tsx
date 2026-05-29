import { useState } from "react";
import { AiProvider } from "../utils/ai";
import { getApiKey, setApiKey, clearApiKey } from "../utils/aiKey";

type Props = {
  provider: AiProvider;
  onClose: () => void;
  onSaved: (key: string) => void;
};

export function ApiKeyModal({ provider, onClose, onSaved }: Props) {
  const [value, setValue] = useState(getApiKey(provider.id));

  const save = () => {
    const k = value.trim();
    if (!k) return;
    setApiKey(provider.id, k);
    onSaved(k);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ключ {provider.label}</h3>
        <p className="hint">
          Нужен твой личный API-ключ — он хранится только в этом браузере и
          отправляется напрямую к провайдеру, минуя любые серверы.
        </p>
        <p className="hint">
          Получить ключ:{" "}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer">
            {provider.keyUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <input
          className="key-input"
          type="password"
          placeholder={provider.keyPlaceholder}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <div className="modal-actions">
          {getApiKey(provider.id) && (
            <button
              className="btn small danger"
              onClick={() => {
                clearApiKey(provider.id);
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
