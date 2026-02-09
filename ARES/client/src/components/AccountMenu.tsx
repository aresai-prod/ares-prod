import type { Organization, User } from "../lib/types";

type AccountMenuProps = {
  open: boolean;
  user: User;
  org: Organization | null;
  theme: "light" | "dark";
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenBilling: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export default function AccountMenu({
  open,
  user,
  org,
  theme,
  onClose,
  onOpenProfile,
  onOpenBilling,
  onToggleTheme,
  onLogout
}: AccountMenuProps) {
  if (!open) return null;
  const initials =
    user.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ?? "A";
  const licenseLabel = `${org?.accountType ?? "INDIVIDUAL"} / ${org?.license.tier ?? user.licenseType ?? "FREE"}`;

  return (
    <div className="account-menu-backdrop" onClick={onClose}>
      <div className="account-menu" onClick={(event) => event.stopPropagation()}>
        <div className="account-menu-header">
          <div className="account-avatar">{initials}</div>
          <div className="account-menu-head-meta">
            <div className="account-meta">
              <div className="account-name">{user.name}</div>
              <div className="account-email">{user.email}</div>
            </div>
            <div className="account-pill">{licenseLabel}</div>
          </div>
        </div>
        <div className="account-menu-items">
          <button className="menu-item" onClick={onOpenBilling}>
            Upgrade plan
          </button>
          <button className="menu-item" onClick={onOpenProfile}>
            Settings
          </button>
          <button className="menu-item" onClick={onToggleTheme}>
            Theme: {theme === "light" ? "Light" : "Dark"}
          </button>
          <button className="menu-item danger" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
