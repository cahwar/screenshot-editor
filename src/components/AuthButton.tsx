import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { AuthModal } from "./AuthModal";

export function AuthButton() {
  const { configured, ready, user, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // No Supabase env → behave exactly as the old localStorage-only app.
  if (!configured) return null;
  if (!ready) return null;

  if (user) {
    return (
      <div className="auth-chip" title={user.email ?? "Аккаунт"}>
        <span className="auth-email">{user.email ?? "аккаунт"}</span>
        <button className="btn small secondary" onClick={() => void signOut()}>
          Выйти
        </button>
      </div>
    );
  }

  return (
    <>
      <button className="btn small secondary" onClick={() => setShowModal(true)}>
        Войти
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
