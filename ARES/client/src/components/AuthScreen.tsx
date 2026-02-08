import { useState } from "react";
import logo from "../assets/ares-icon.svg";

type AuthScreenProps = {
  onLogin: (email: string, password: string) => void;
  onSignup: (email: string, password: string, name?: string) => void;
  onGoogle: () => void;
  googleStatus?: "enabled" | "disabled" | "unreachable" | "unknown";
  onRequestReset: (email: string) => Promise<string | null>;
  onResetPassword: (token: string, password: string) => Promise<boolean>;
  error?: string | null;
};

export default function AuthScreen({
  onLogin,
  onSignup,
  onGoogle,
  googleStatus = "unknown",
  onRequestReset,
  onResetPassword,
  error
}: AuthScreenProps) {
  const websiteUrl =
    (import.meta.env.VITE_WEBSITE_URL as string | undefined) ?? "https://aresai.web.app";
  const [mode, setMode] = useState<"login" | "signup" | "reset">(() => {
    if (typeof window !== "undefined") {
      const queryMode = new URLSearchParams(window.location.search).get("mode");
      if (queryMode === "signup") return "signup";
    }
    return "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-block">
          <div className="brand-mark">
            <img src={logo} alt="ARES" />
          </div>
          <div>
            <div className="brand-title">ARES</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Sign up</button>
        </div>

        {mode === "signup" && (
          <div className="auth-field">
            <label>Name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </div>
        )}

        {mode !== "reset" && (
          <>
            <div className="auth-field">
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
          </>
        )}

        {mode === "reset" && (
          <>
            <div className="auth-field">
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            </div>
            <div className="auth-field">
              <label>Reset token</label>
              <input
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                placeholder="Paste token from reset email"
              />
            </div>
            <div className="auth-field">
              <label>New password</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            {resetNotice && <div className="info-banner">{resetNotice}</div>}
          </>
        )}

        {error && <div className="error-banner">{error}</div>}

        {mode === "login" ? (
          <button className="primary-button" onClick={() => onLogin(email, password)}>
            Log in
          </button>
        ) : mode === "signup" ? (
          <button className="primary-button" onClick={() => onSignup(email, password, name)}>
            Create account
          </button>
        ) : (
          <div className="auth-actions">
            <button
              className="ghost-button"
              onClick={async () => {
                setResetNotice(null);
                const token = await onRequestReset(email);
                if (token) {
                  setResetToken(token);
                  setResetNotice("Reset token generated. Paste it below to set a new password.");
                } else {
                  setResetNotice("If this email exists, a reset token was issued.");
                }
              }}
            >
              Send reset token
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                const ok = await onResetPassword(resetToken, resetPassword);
                if (ok) {
                  setResetNotice("Password reset successful. Switch to Log in.");
                }
              }}
            >
              Reset password
            </button>
          </div>
        )}

        {mode !== "reset" && <div className="auth-divider">OR</div>}
        {mode !== "reset" && (
        <button className="google-button" onClick={onGoogle} disabled={googleStatus !== "enabled"}>
          Continue with Google
        </button>
        )}
        {googleStatus === "disabled" && (
          <div className="text-xs text-muted">
            Google login is not configured. Add Google OAuth keys in the server `.env` and restart the server.
          </div>
        )}
        {googleStatus === "unreachable" && (
          <div className="text-xs text-muted">
            Backend is unreachable. Check API availability and CORS settings.
          </div>
        )}
        {mode !== "reset" && (
          <button className="link-button" onClick={() => setMode("reset")}>
            Forgot password?
          </button>
        )}
        {mode === "reset" && (
          <button className="link-button" onClick={() => setMode("login")}>
            Back to login
          </button>
        )}
        <a className="link-button" href={websiteUrl}>
          Back to website
        </a>
      </div>
    </div>
  );
}
