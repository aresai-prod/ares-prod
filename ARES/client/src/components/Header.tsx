import type { Pod, User } from "../lib/types";

type HeaderProps = {
  profile: User | null;
  pods: Pod[];
  activePodId?: string;
  onPodChange: (podId: string) => void;
  onProfileOpen: () => void;
  onCreatePod: (name: string) => void;
  onLogout: () => void;
};

export default function Header({
  profile,
  pods,
  activePodId,
  onPodChange,
  onProfileOpen,
  onCreatePod,
  onLogout
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark">
          <span className="brand-glow">A</span>
        </div>
        <div>
          <div className="brand-title">ARES</div>
        </div>
      </div>

      <div className="pod-block">
        <label htmlFor="pod-select">Active Pod</label>
        <div className="pod-actions">
          <select
            id="pod-select"
            value={activePodId ?? ""}
            onChange={(event) => onPodChange(event.target.value)}
          >
            {!activePodId && <option value="">Select pod</option>}
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            onClick={() => {
              const name = window.prompt("Name your new pod:");
              if (name) onCreatePod(name);
            }}
          >
            + Add Pod
          </button>
        </div>
      </div>

      <div className="header-meta">
        <div className="license-pill">
          {profile?.licenseType ?? "INDIVIDUAL"} License
        </div>
        <button className="ghost-button" onClick={onLogout}>
          Log out
        </button>
        <button className="primary-button" onClick={onProfileOpen}>
          Profile
        </button>
      </div>
    </header>
  );
}
