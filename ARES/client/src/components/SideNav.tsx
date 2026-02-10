import type { Organization, User } from "../lib/types";
import logo from "../assets/ares-icon.svg";

type NavKey = "chat" | "dashboards" | "knowledge" | "billing" | "insights" | "team";

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

type SideNavProps = {
  active: NavKey;
  onSelect: (key: NavKey) => void;
  org: Organization | null;
  user: User | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onAccount: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const navItems: Array<{ key: NavKey; label: string }> = [
  { key: "chat", label: "Chat" },
  { key: "dashboards", label: "Dashboards" },
  { key: "knowledge", label: "Knowledge" },
  { key: "billing", label: "License" },
  { key: "insights", label: "Insights" },
  { key: "team", label: "Team" }
];

export default function SideNav({
  active,
  onSelect,
  org,
  user,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onAccount,
  mobileOpen = false,
  onMobileClose
}: SideNavProps) {
  const initials =
    user?.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ?? "A";
  const licenseLabel = `${org?.accountType ?? "INDIVIDUAL"} / ${org?.license.tier ?? user?.licenseType ?? "FREE"}`;
  return (
    <aside className={`side-nav ${mobileOpen ? "open" : ""}`}>
      <div className="side-nav-mobile-top">
        <button className="side-nav-close" onClick={onMobileClose}>
          Close
        </button>
      </div>
      <div className="side-header">
        <div className="side-logo">
          <img src={logo} alt="ARES" />
        </div>
        <div>
          <div className="side-title">ARES</div>
          <div className="side-subtitle">Welcome {user?.name ?? "User"}</div>
        </div>
      </div>

      <button
        className="new-chat-button"
        onClick={() => {
          onNewConversation();
          onMobileClose?.();
        }}
      >
        New chat
      </button>

      <div className="history-section">
        <div className="section-label">Chat history</div>
        <div className="history-list">
          {conversations.length === 0 && <div className="history-empty">No conversations yet.</div>}
          {conversations.map((item) => (
            <button
              key={item.id}
              className={`history-item ${activeConversationId === item.id ? "active" : ""}`}
              onClick={() => {
                onSelectConversation(item.id);
                onMobileClose?.();
              }}
            >
              <span className="history-title">{item.title}</span>
              <span className="history-date">{new Date(item.updatedAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="nav-section">
        <div className="section-label">Workspace</div>
        <div className="side-links">
          {navItems.map((item) => {
            if (item.key === "insights" && org?.accountType !== "BUSINESS") return null;
            if (item.key === "team" && (org?.accountType !== "BUSINESS" || user?.role !== "admin")) return null;
            return (
              <button
                key={item.key}
                className={active === item.key ? "active" : ""}
                onClick={() => {
                  onSelect(item.key);
                  onMobileClose?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="account-card"
        onClick={() => {
          onAccount();
          onMobileClose?.();
        }}
      >
        <div className="account-avatar">{initials}</div>
        <div className="account-meta">
          <div className="account-name">{user?.name ?? "Account"}</div>
          <div className="account-email">{user?.email ?? "Manage profile"}</div>
        </div>
        <div className="account-badge">{licenseLabel}</div>
      </button>
    </aside>
  );
}
