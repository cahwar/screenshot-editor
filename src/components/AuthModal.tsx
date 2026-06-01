import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

type Mode = "signin" | "signup";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    const e = email.trim();
    if (!e || !password) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res =
        mode === "signin"
          ? await signInEmail(e, password)
          : await signUpEmail(e, password);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.needsConfirmation) {
        setNotice("Аккаунт создан. Подтверди почту по ссылке из письма, затем войди.");
        setMode("signin");
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    const res = await signInGoogle();
    if (res.error) {
      setError(res.error);
      setBusy(false);
    }
    // On success the browser redirects to Google, so no further UI needed.
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "signin" ? "Вход в аккаунт" : "Регистрация"}</h3>
        <p className="hint">
          Аккаунт хранит твои настройки и API-ключи и синхронизирует их между
          устройствами.
        </p>

        <button
          className="btn secondary auth-google"
          onClick={google}
          disabled={busy}
        >
          Войти через Google
        </button>

        <div className="auth-divider">
          <span>или по почте</span>
        </div>

        <input
          className="key-input"
          type="email"
          placeholder="email@example.com"
          value={email}
          autoFocus
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="key-input"
          type="password"
          placeholder="пароль"
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />

        {error && <div className="ai-error">{error}</div>}
        {notice && <p className="hint auth-notice">{notice}</p>}

        <div className="modal-actions">
          <button
            className="btn small secondary"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            disabled={busy}
          >
            {mode === "signin" ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти"}
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn small secondary" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button
              className="btn small"
              onClick={submit}
              disabled={busy || !email.trim() || !password}
            >
              {busy && <span className="spinner" />}
              {mode === "signin" ? "Войти" : "Создать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
