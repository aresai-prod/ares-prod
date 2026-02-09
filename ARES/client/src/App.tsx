import { useEffect, useMemo, useState } from "react";
import type {
  ChatResponse,
  Conversation,
  DataSources,
  KnowledgeBase,
  KnowledgeBankEntry,
  KnowledgeQuality,
  Organization,
  Pod,
  User
} from "./lib/types";
import {
  cancelSubscription,
  createPod,
  evaluateKnowledgeQuality,
  fetchDashboardTrends,
  fetchDataSources,
  fetchGoogleStatus,
  fetchKnowledge,
  fetchKnowledgeQuality,
  fetchKnowledgeBank,
  fetchOrg,
  fetchPods,
  fetchProfile,
  getAuthToken,
  getGoogleAuthUrl,
  login,
  logout,
  downgradeSubscription,
  requestPasswordReset,
  resetPassword,
  sendChat,
  sendFeedback,
  setAuthToken,
  signup,
  testFirebase,
  testLocalSql,
  testMysql,
  testPostgres,
  trackEvent,
  updateDataSources,
  updateKnowledge,
  updateProfile,
  addKnowledgeBankEntry
} from "./lib/api";
import ChatPanel from "./components/ChatPanel";
import AccountMenu from "./components/AccountMenu";
import ResultsPanel from "./components/ResultsPanel";
import KnowledgePanel from "./components/KnowledgePanel";
import ProfileModal from "./components/ProfileModal";
import AuthScreen from "./components/AuthScreen";
import AuthCallback from "./components/AuthCallback";
import SideNav from "./components/SideNav";
import DashboardPanel from "./components/DashboardPanel";
import BillingPanel from "./components/BillingPanel";
import InsightsPanel from "./components/InsightsPanel";
import TeamPanel from "./components/TeamPanel";
import TaskPreloader from "./components/TaskPreloader";

const emptyKnowledge: KnowledgeBase = {
  tableDictionary: [],
  columnDictionary: [],
  parameters: {
    dateHandlingRules: "",
    bestQueryPractices: "",
    businessContext: "",
    sampleQueries: []
  },
  metrics: []
};

const emptySources: DataSources = {
  localSql: { connectionString: "", updatedAt: "" },
  postgres: { connectionString: "", updatedAt: "" },
  mysql: { connectionString: "", updatedAt: "" },
  firebase: { projectId: "", serviceAccountJson: "", updatedAt: "" }
};

function buildWelcomeMessages(name?: string) {
  return [
    {
      id: "welcome",
      role: "assistant" as const,
      content: `Hey ${name ? name : "there"}, Whats on your mind.!`,
      createdAt: new Date().toISOString()
    }
  ];
}

type NavKey = "chat" | "dashboards" | "knowledge" | "billing" | "insights" | "team";

type TrendWidget = { widgetId: string; title: string; chartType: "line" | "bar" | "pie"; data: any };

function resolvePanel(tab: string | null): NavKey | null {
  if (!tab) return null;
  if (tab === "chat") return "chat";
  if (tab === "dashboards") return "dashboards";
  if (tab === "knowledge") return "knowledge";
  if (tab === "billing") return "billing";
  if (tab === "insights") return "insights";
  if (tab === "team") return "team";
  return null;
}

function readQueryPanel(): NavKey | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return resolvePanel(params.get("tab"));
}

export default function App() {
  const [profile, setProfile] = useState<User | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [activePodId, setActivePodId] = useState<string | undefined>(undefined);
  const [knowledge, setKnowledge] = useState<KnowledgeBase>(emptyKnowledge);
  const [dataSources, setDataSources] = useState<DataSources>(emptySources);
  const [knowledgeBank, setKnowledgeBank] = useState<KnowledgeBankEntry[]>([]);
  const [messages, setMessages] = useState(buildWelcomeMessages());
  const [latestResponse, setLatestResponse] = useState<ChatResponse | null>(null);
  const [trends, setTrends] = useState<TrendWidget[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [knowledgeQuality, setKnowledgeQuality] = useState<KnowledgeQuality | null>(null);
  const [loading, setLoading] = useState(false);
  const [tasking, setTasking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<"enabled" | "disabled" | "unreachable" | "unknown">("unknown");
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [booting, setBooting] = useState(() => Boolean(getAuthToken()));
  const [activePanel, setActivePanel] = useState<NavKey>(() => readQueryPanel() ?? "chat");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = window.localStorage.getItem("ares_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // ignore storage errors
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  function toggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  const apiNotice =
    profile && !profile.profile.apiKey
      ? "Add your OpenAI or Gemini API key in Profile to enable live LLM responses."
      : null;
  const showTaskLoader = loading || tasking;

  async function loadPodResources(podId: string) {
    const [knowledgeData, sourcesData, bankData, qualityData] = await Promise.all([
      fetchKnowledge(podId),
      fetchDataSources(podId),
      fetchKnowledgeBank(podId),
      fetchKnowledgeQuality(podId).catch(() => null)
    ]);
    setKnowledge(knowledgeData);
    setDataSources({
      localSql: { ...emptySources.localSql, ...sourcesData.localSql },
      postgres: { ...emptySources.postgres, ...sourcesData.postgres },
      mysql: { ...emptySources.mysql, ...sourcesData.mysql },
      firebase: { ...emptySources.firebase, ...sourcesData.firebase }
    });
    setKnowledgeBank(bankData);
    if (qualityData) {
      setKnowledgeQuality(qualityData.quality);
    } else {
      setKnowledgeQuality(null);
    }
  }

  function hydrateConversations(user: User) {
    const list = user.conversations ?? [];
    const sorted = [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    setConversations(sorted);
    if (sorted.length > 0) {
      setActiveConversationId(sorted[0].id);
      setMessages(sorted[0].messages.length ? sorted[0].messages : buildWelcomeMessages(user.name));
    } else {
      setActiveConversationId(null);
      setMessages(buildWelcomeMessages(user.name));
    }
  }

  async function loadWorkspace(user: User) {
    const [podData, orgData] = await Promise.all([fetchPods(), fetchOrg()]);
    setProfile(user);
    setOrg(orgData);
    setPods(podData.pods);
    const podId = podData.pods[0]?.id;
    setActivePodId(podId);
    if (podId) {
      await loadPodResources(podId);
    }
    hydrateConversations(user);
    const requestedPanel = readQueryPanel();
    if (requestedPanel) {
      setActivePanel(requestedPanel);
    } else if (user.licenseType === "FREE") {
      setActivePanel("billing");
    }
    void trackEvent("app_loaded", { licenseType: user.licenseType }).catch(() => {});
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("ares_theme", theme);
      } catch {
        // ignore storage errors
      }
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let rafId = 0;
    let fadeTimer = 0;
    const onMove = (event: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        document.documentElement.style.setProperty("--mx", `${x}%`);
        document.documentElement.style.setProperty("--my", `${y}%`);
        document.documentElement.style.setProperty("--splash-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--splash-y", `${event.clientY}px`);
        document.documentElement.style.setProperty("--splash-opacity", "0.18");
      });
      if (fadeTimer) window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(() => {
        document.documentElement.style.setProperty("--splash-opacity", "0");
      }, 180);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/auth/callback") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setAuthToken(token);
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        // ignore history errors
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const watchdog = setTimeout(() => {
      if (active) setBooting(false);
    }, 3500);
    async function boot() {
      try {
        const timeout = <T,>(promise: Promise<T>, ms: number) =>
          Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
          ]);
        try {
          const status = await timeout(fetchGoogleStatus(), 7000);
          if (active) setGoogleStatus(status.enabled ? "enabled" : "disabled");
        } catch {
          try {
            const retryStatus = await timeout(fetchGoogleStatus(), 7000);
            if (active) setGoogleStatus(retryStatus.enabled ? "enabled" : "disabled");
          } catch {
            if (active) setGoogleStatus("unreachable");
          }
        }
        const token = getAuthToken();
        if (!token) {
          setBooting(false);
          return;
        }
        const profileData = await timeout(fetchProfile(), 3000);
        if (!active) return;
        await loadWorkspace(profileData);
      } catch (err) {
        setAuthToken(null);
      } finally {
        if (active) setBooting(false);
      }
    }

    boot();
    return () => {
      active = false;
      clearTimeout(watchdog);
    };
  }, []);

  const activePod = useMemo(() => pods.find((pod) => pod.id === activePodId), [pods, activePodId]);
  const conversationSummaries = useMemo(
    () =>
      conversations.map((conversation) => {
        const firstUser = conversation.messages.find((msg) => msg.role === "user");
        return {
          id: conversation.id,
          title: firstUser?.content.slice(0, 42) ?? "Untitled conversation",
          updatedAt: conversation.updatedAt
        };
      }),
    [conversations]
  );
  const showResults = Boolean(latestResponse || loading);

  async function handleLogin(email: string, password: string) {
    setAuthError(null);
    try {
      const response = await login(email, password);
      setAuthToken(response.token);
      await loadWorkspace(response.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  async function handleSignup(email: string, password: string, name?: string) {
    setAuthError(null);
    try {
      const response = await signup(email, password, name);
      setAuthToken(response.token);
      await loadWorkspace(response.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Signup failed.");
    }
  }

  async function handleRequestReset(email: string): Promise<string | null> {
    setAuthError(null);
    try {
      const response = await requestPasswordReset(email);
      return response.resetToken ?? null;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to send reset token.");
      return null;
    }
  }

  async function handleResetPassword(token: string, password: string): Promise<boolean> {
    setAuthError(null);
    try {
      await resetPassword(token, password);
      return true;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to reset password.");
      return false;
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignore
    }
    setAuthToken(null);
    setProfile(null);
    setOrg(null);
    setPods([]);
    setKnowledge(emptyKnowledge);
    setDataSources(emptySources);
    setKnowledgeBank([]);
    setMessages(buildWelcomeMessages());
    setLatestResponse(null);
    setTrends([]);
    setConversations([]);
    setActiveConversationId(null);
  }

  async function handlePodChange(podId: string) {
    setTasking(true);
    try {
      setActivePodId(podId);
      await loadPodResources(podId);
    } finally {
      setTasking(false);
    }
  }

  async function handleSend(message: string) {
    if (!message.trim() || !activePodId) return;
    setError(null);
    setLoading(true);

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: message,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      void trackEvent("chat_submitted", { podId: activePodId }).catch(() => {});
      const response = await sendChat(message, activeConversationId ?? undefined, activePodId);
      const assistantMessage = {
        id: response.messageId,
        role: "assistant" as const,
        content: response.analysis,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLatestResponse(response);
      setActiveConversationId(response.conversationId);
      setConversations((prev) => {
        const now = new Date().toISOString();
        const existing = prev.find((entry) => entry.id === response.conversationId);
        const nextMessages = existing
          ? [...existing.messages, userMessage, assistantMessage]
          : [userMessage, assistantMessage];
        const updated: Conversation = {
          id: response.conversationId,
          podId: activePodId,
          messages: nextMessages,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        };
        return [updated, ...prev.filter((entry) => entry.id !== response.conversationId)];
      });
      if (activePodId) {
        const trendData = await fetchDashboardTrends(activePodId);
        setTrends(trendData.widgets as TrendWidget[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run query.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(rating: "up" | "down", comment?: string) {
    if (!latestResponse) return;
    try {
      await sendFeedback({
        conversationId: latestResponse.conversationId,
        messageId: latestResponse.messageId,
        rating,
        comment
      });
      void trackEvent("feedback_submitted", { rating }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback.");
    }
  }

  async function handleKnowledgeSave(next: KnowledgeBase) {
    if (!activePodId) return;
    setTasking(true);
    try {
      const updated = await updateKnowledge(activePodId, next);
      setKnowledge(updated);
      if (org?.accountType === "BUSINESS") {
        const quality = await fetchKnowledgeQuality(activePodId).catch(() => null);
        if (quality) {
          setKnowledgeQuality(quality.quality);
        }
      }
      void trackEvent("knowledge_saved", {}).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save knowledge.");
    } finally {
      setTasking(false);
    }
  }

  async function handleEvaluateQuality() {
    if (!activePodId) return;
    setTasking(true);
    try {
      const quality = await evaluateKnowledgeQuality(activePodId);
      setKnowledgeQuality(quality.quality);
      void trackEvent("knowledge_quality_scored", { score: quality.quality?.score ?? null }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate knowledge quality.");
    } finally {
      setTasking(false);
    }
  }

  async function handleSourcesSave(next: DataSources) {
    if (!activePodId) return;
    setTasking(true);
    try {
      const updated = await updateDataSources(activePodId, next);
      setDataSources({
        localSql: { ...emptySources.localSql, ...updated.localSql },
        postgres: { ...emptySources.postgres, ...updated.postgres },
        mysql: { ...emptySources.mysql, ...updated.mysql },
        firebase: { ...emptySources.firebase, ...updated.firebase }
      });
      void trackEvent("data_sources_saved", {}).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save data sources.");
    } finally {
      setTasking(false);
    }
  }

  async function handleAddKnowledgeBank(entry: { title: string; date: string; highlights: string; lowlights: string; docText?: string }, podId?: string) {
    const targetPodId = podId ?? activePodId;
    if (!targetPodId) return;
    setTasking(true);
    try {
      const updated = await addKnowledgeBankEntry(targetPodId, entry);
      setKnowledgeBank(updated);
      void trackEvent("knowledge_bank_saved", {}).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save knowledge bank entry.");
    } finally {
      setTasking(false);
    }
  }

  async function handleTestLocal(connectionString: string) {
    setTasking(true);
    try {
      const result = await testLocalSql(connectionString);
      void trackEvent("local_sql_tested", { ok: result.ok }).catch(() => {});
      return result.ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test local SQL connection.");
      return false;
    } finally {
      setTasking(false);
    }
  }

  async function handleTestPostgres(connectionString: string) {
    setTasking(true);
    try {
      const result = await testPostgres(connectionString);
      void trackEvent("postgres_tested", { ok: result.ok }).catch(() => {});
      return result.ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test PostgreSQL connection.");
      return false;
    } finally {
      setTasking(false);
    }
  }

  async function handleTestMysql(connectionString: string) {
    setTasking(true);
    try {
      const result = await testMysql(connectionString);
      void trackEvent("mysql_tested", { ok: result.ok }).catch(() => {});
      return result.ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test MySQL connection.");
      return false;
    } finally {
      setTasking(false);
    }
  }

  async function handleTestFirebase(projectId: string, serviceAccountJson: string) {
    setTasking(true);
    try {
      const result = await testFirebase(projectId, serviceAccountJson);
      void trackEvent("firebase_tested", { ok: result.ok }).catch(() => {});
      return result.ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test Firebase connection.");
      return false;
    } finally {
      setTasking(false);
    }
  }

  async function handleCreatePod(name: string) {
    setTasking(true);
    try {
      const result = await createPod(name);
      setPods(result.pods);
      setActivePodId(result.pods[result.pods.length - 1]?.id);
      void trackEvent("pod_created", { name }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pod.");
    } finally {
      setTasking(false);
    }
  }

  async function handleProfileSave(update: Partial<User>) {
    setTasking(true);
    try {
      const saved = await updateProfile({
        name: update.name,
        email: update.email,
        llmProvider: update.profile?.llmProvider,
        apiKey: update.profile?.apiKey,
        activeDataSource: update.profile?.activeDataSource
      });
      setProfile(saved);
      hydrateConversations(saved);
      void trackEvent("profile_saved", { licenseType: saved.licenseType }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setTasking(false);
    }
  }

  function handleOrgUpdate(nextOrg: Organization) {
    setOrg(nextOrg);
    setPods(nextOrg.pods);
    if (!nextOrg.pods.find((pod) => pod.id === activePodId)) {
      setActivePodId(nextOrg.pods[0]?.id);
    }
    setProfile((prev) => (prev ? { ...prev, licenseType: nextOrg.license.tier } : prev));
  }

  if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") {
    return (
      <AuthCallback
        onAuthed={(user) => {
          setAuthError(null);
          loadWorkspace(user);
        }}
        onError={(message) => setAuthError(message)}
      />
    );
  }

  if (booting) {
    return <TaskPreloader label="A.R.E.S. Loading..." />;
  }

  if (!profile) {
    return (
      <AuthScreen
        onLogin={handleLogin}
        onSignup={handleSignup}
        onGoogle={() => {
          window.location.href = getGoogleAuthUrl();
        }}
        googleStatus={googleStatus}
        onRequestReset={handleRequestReset}
        onResetPassword={handleResetPassword}
        error={authError}
      />
    );
  }

  return (
    <div className={`app-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      {showTaskLoader && <TaskPreloader label="A.R.E.S. Loading..." />}
      <SideNav
        active={activePanel}
        onSelect={(key) => {
          setActivePanel(key);
          setMobileNavOpen(false);
        }}
        org={org}
        user={profile}
        conversations={conversationSummaries}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          const convo = conversations.find((entry) => entry.id === id);
          setActiveConversationId(id);
          setMessages(convo?.messages?.length ? convo.messages : buildWelcomeMessages(profile?.name));
          setLatestResponse(null);
          setError(null);
          setActivePanel("chat");
        }}
        onNewConversation={() => {
          setActiveConversationId(null);
          setMessages(buildWelcomeMessages(profile?.name));
          setLatestResponse(null);
          setError(null);
          setActivePanel("chat");
          setMobileNavOpen(false);
        }}
        onAccount={() => setAccountMenuOpen(true)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && (
        <button
          className="mobile-nav-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="main-area">
        <div className="mobile-topbar">
          <button
            className="mobile-hamburger"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-topbar-title">ARES</div>
        </div>
        <div className="content-area">
          {activePanel === "chat" && (
            <div className={`main-grid ${showResults ? "with-results" : "single"}`}>
              <ChatPanel
                messages={messages}
                loading={loading}
                onSend={handleSend}
                error={error}
                notice={apiNotice}
                disabled={false}
                disabledReason={null}
              />
              {showResults && (
                <ResultsPanel
                  response={latestResponse}
                  loading={loading}
                  error={error}
                  onFeedback={handleFeedback}
                  activePod={activePod?.name}
                  trends={trends}
                />
              )}
            </div>
          )}

          {activePanel !== "chat" && (
            <div className="panel-shell">
              {activePanel === "knowledge" && (
                <KnowledgePanel
                  pods={pods}
                  activePodId={activePodId}
                  podName={activePod?.name}
                  knowledge={knowledge}
                  dataSources={dataSources}
                  knowledgeBank={knowledgeBank}
                  onSaveKnowledge={handleKnowledgeSave}
                  onSaveSources={handleSourcesSave}
                  onAddKnowledgeBank={handleAddKnowledgeBank}
                  onTestLocal={handleTestLocal}
                  onTestPostgres={handleTestPostgres}
                  onTestMysql={handleTestMysql}
                  onTestFirebase={handleTestFirebase}
                  quality={knowledgeQuality}
                  isBusiness={org?.accountType === "BUSINESS"}
                  isAdmin={
                    profile.role === "admin" ||
                    profile.podAccess?.some((access) => access.podId === activePodId && access.role === "admin")
                  }
                  onEvaluateQuality={handleEvaluateQuality}
                />
              )}
              {activePanel === "dashboards" && (
                <DashboardPanel podId={activePodId} activeDataSource={profile?.profile.activeDataSource} />
              )}
              {activePanel === "billing" && (
                <BillingPanel
                  org={org}
                  user={profile}
                  onDowngrade={downgradeSubscription}
                  onCancel={cancelSubscription}
                  onOrgUpdated={handleOrgUpdate}
                />
              )}
              {activePanel === "insights" && org?.accountType === "BUSINESS" && (
                <InsightsPanel podId={activePodId} user={profile} />
              )}
              {activePanel === "team" && org?.accountType === "BUSINESS" && <TeamPanel pods={pods} />}
            </div>
          )}
        </div>
      </main>

      {profile && (
        <ProfileModal
          open={profileOpen}
          profile={profile}
          accountType={org?.accountType ?? "INDIVIDUAL"}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          onClose={() => setProfileOpen(false)}
          onSave={handleProfileSave}
          onLogout={handleLogout}
        />
      )}

      {profile && (
        <AccountMenu
          open={accountMenuOpen}
          user={profile}
          org={org}
          theme={theme}
          onClose={() => setAccountMenuOpen(false)}
          onOpenProfile={() => {
            setAccountMenuOpen(false);
            setProfileOpen(true);
          }}
          onOpenBilling={() => {
            setAccountMenuOpen(false);
            setActivePanel("billing");
          }}
          onToggleTheme={toggleTheme}
          onLogout={() => {
            setAccountMenuOpen(false);
            void handleLogout();
          }}
        />
      )}
    </div>
  );
}
