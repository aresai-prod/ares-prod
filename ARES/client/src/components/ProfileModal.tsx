import { useEffect, useState } from "react";
import type { User } from "../lib/types";

type ProfileModalProps = {
  open: boolean;
  profile: User;
  accountType: "INDIVIDUAL" | "BUSINESS";
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onClose: () => void;
  onSave: (next: Partial<User>) => void;
  onLogout: () => void;
};

export default function ProfileModal({
  open,
  profile,
  accountType,
  theme,
  onToggleTheme,
  onClose,
  onSave,
  onLogout
}: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [provider, setProvider] = useState(profile.profile.llmProvider);
  const [apiKey, setApiKey] = useState(profile.profile.apiKey);
  const [activeSource, setActiveSource] = useState(profile.profile.activeDataSource);

  useEffect(() => {
    if (!open) return;
    setName(profile.name);
    setEmail(profile.email);
    setProvider(profile.profile.llmProvider);
    setApiKey(profile.profile.apiKey);
    setActiveSource(profile.profile.activeDataSource);
  }, [open, profile]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Account & Profile</h3>
          <button className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="account-summary">
          <div>
            <div className="account-name">{profile.name}</div>
            <div className="account-email">{profile.email}</div>
          </div>
          <div className="account-pill">
            {accountType} / {profile.licenseType}
          </div>
        </div>
        <div className="modal-body">
          <label>Name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} />

          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />

          <label>LLM Provider</label>
          <select value={provider} onChange={(event) => setProvider(event.target.value as User["profile"]["llmProvider"])}>
            <option value="OPENAI">OpenAI</option>
            <option value="GEMINI">Gemini</option>
          </select>

          <label>Active Data Source</label>
          <select
            value={activeSource}
            onChange={(event) => setActiveSource(event.target.value as User["profile"]["activeDataSource"])}
          >
            <option value="localSql">Local SQL</option>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="firebase">Firebase</option>
          </select>

          <label>API Key</label>
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste OpenAI or Gemini key"
          />

          <label>Theme</label>
          <button className="theme-toggle" onClick={onToggleTheme}>
            {theme === "light" ? "Switch to Dark" : "Switch to Light"}
          </button>
        </div>
        <div className="modal-footer">
          <button className="ghost-button" onClick={onLogout}>
            Log out
          </button>
          <button
            className="primary-button"
            onClick={() => {
              onSave({
                name,
                email,
                profile: {
                  ...profile.profile,
                  llmProvider: provider,
                  apiKey,
                  activeDataSource: activeSource
                }
              });
              onClose();
            }}
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
