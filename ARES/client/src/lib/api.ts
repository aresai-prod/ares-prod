import type {
  AuthResponse,
  ChatResponse,
  KnowledgeBase,
  Pod,
  User,
  LlmProvider,
  DataSources,
  DataSourceKey,
  Dashboard,
  DashboardWidget,
  KnowledgeBankEntry,
  InsightPost,
  Organization,
  PodAccess,
  OrgRole,
  License,
  KnowledgeQuality
} from "./types";

const rawApiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8787/api";
const normalizedBase = rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`;
export const API_BASE = normalizedBase;
const LOCAL_FALLBACK_BASE = "http://localhost:8787/api";

function getDirectApiBase(): string {
  if (API_BASE.startsWith("http")) return API_BASE;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return LOCAL_FALLBACK_BASE;
    }
  }
  return API_BASE;
}
function readCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((entry) => entry.startsWith("ares_token="));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const local = window.localStorage.getItem("ares_token");
    return local ?? readCookieToken();
  } catch {
    return readCookieToken();
  }
}

let authToken = readStoredToken();

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        window.localStorage.setItem("ares_token", token);
      } else {
        window.localStorage.removeItem("ares_token");
      }
    } catch {
      // ignore storage errors
    }
    try {
      const host = window.location.hostname;
      const isProd = host.endsWith("ares.ai");
      const domain = isProd ? "; Domain=.ares.ai" : "";
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      if (token) {
        document.cookie = `ares_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}${domain}`;
      } else {
        document.cookie = `ares_token=; Max-Age=0; Path=/; SameSite=Lax${secure}${domain}`;
      }
    } catch {
      // ignore cookie errors
    }
  }
}

export function getAuthToken() {
  return authToken;
}

export function getGoogleAuthUrl(): string {
  const redirect = typeof window !== "undefined" ? window.location.origin : "";
  const base = getDirectApiBase();
  return `${base}/auth/google/start?redirect=${encodeURIComponent(redirect)}`;
}

export function getGoogleCallbackUrl(code: string, state: string): string {
  const base = getDirectApiBase();
  return `${base}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
}

export async function exchangeGoogleToken(payload: {
  accessToken?: string | null;
  idToken?: string | null;
}): Promise<AuthResponse> {
  const base = getDirectApiBase();
  const res = await fetch(`${base}/auth/google/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: payload.accessToken ?? null,
      idToken: payload.idToken ?? null
    })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Google token exchange failed." }));
    throw new Error(error.error ?? "Google token exchange failed.");
  }
  return res.json() as Promise<AuthResponse>;
}

export async function fetchGoogleStatus(): Promise<{ enabled: boolean }> {
  const base = getDirectApiBase();
  const res = await fetch(`${base}/auth/google/status`);
  if (!res.ok) {
    throw new Error("Unable to check Google auth status.");
  }
  return res.json() as Promise<{ enabled: boolean }>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options?.headers ?? {})
  };
  const fetchOptions = { ...options, headers };

  let res: Response | null = null;
  try {
    res = await fetch(`${API_BASE}${path}`, fetchOptions);
  } catch (err) {
    const fallbackBase = getDirectApiBase();
    if (fallbackBase !== API_BASE) {
      try {
        res = await fetch(`${fallbackBase}${path}`, fetchOptions);
      } catch {
        throw new Error("Network error. Ensure the API server is running on http://localhost:8787.");
      }
    } else {
      throw new Error("Network error. Ensure the API server is running on http://localhost:8787.");
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function signup(email: string, password: string, name?: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name })
  });
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; resetToken?: string }> {
  return request("/auth/forgot", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
  return request("/auth/reset", {
    method: "POST",
    body: JSON.stringify({ token, password })
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return request("/auth/logout", { method: "POST" });
}

export async function fetchProfile(): Promise<User> {
  const response = await request<{ user: User }>("/auth/me");
  return response.user;
}

export async function updateProfile(payload: {
  llmProvider?: LlmProvider;
  apiKey?: string;
  name?: string;
  email?: string;
  activeDataSource?: DataSourceKey;
}): Promise<User> {
  return request<User>("/profile", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function fetchOrg(): Promise<Organization> {
  return request<Organization>("/org");
}

export async function fetchOrgUsers(): Promise<{ users: User[] }> {
  return request("/org/users");
}

export async function createOrgUser(payload: {
  email: string;
  name?: string;
  role?: OrgRole;
  podAccess?: PodAccess[];
}): Promise<{ user: User; tempPassword: string }> {
  return request("/org/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateOrgUser(userId: string, payload: { role?: OrgRole; podAccess?: PodAccess[] }): Promise<{ user: User }> {
  return request(`/org/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function fetchPods(): Promise<{ pods: Pod[]; licenseType: string }> {
  return request("/pods");
}

export async function createPod(name: string): Promise<{ pods: Pod[] }> {
  return request("/pods", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export async function fetchKnowledge(podId: string): Promise<KnowledgeBase> {
  return request<KnowledgeBase>(`/pods/${podId}/knowledge`);
}

export async function fetchKnowledgeQuality(
  podId: string
): Promise<{ quality: KnowledgeQuality | null; chatEnabled: boolean; chatOverride: boolean; threshold: number }> {
  return request(`/pods/${podId}/knowledge/quality`);
}

export async function evaluateKnowledgeQuality(
  podId: string
): Promise<{ quality: KnowledgeQuality | null; chatEnabled: boolean; chatOverride: boolean; threshold: number }> {
  return request(`/pods/${podId}/knowledge/quality`, { method: "POST" });
}

export async function setChatOverride(
  podId: string,
  enabled: boolean
): Promise<{ chatEnabled: boolean; chatOverride: boolean }> {
  return request(`/pods/${podId}/knowledge/chat-override`, {
    method: "POST",
    body: JSON.stringify({ enabled })
  });
}

export async function updateKnowledge(podId: string, payload: KnowledgeBase): Promise<KnowledgeBase> {
  return request<KnowledgeBase>(`/pods/${podId}/knowledge`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function fetchDataSources(podId: string): Promise<DataSources> {
  return request<DataSources>(`/pods/${podId}/data-sources`);
}

export async function updateDataSources(podId: string, payload: DataSources): Promise<DataSources> {
  return request<DataSources>(`/pods/${podId}/data-sources`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function testLocalSql(connectionString: string): Promise<{ ok: boolean }> {
  return request("/connectors/local-sql", {
    method: "POST",
    body: JSON.stringify({ connectionString })
  });
}

export async function testPostgres(connectionString: string): Promise<{ ok: boolean }> {
  return request("/connectors/postgres", {
    method: "POST",
    body: JSON.stringify({ connectionString })
  });
}

export async function testMysql(connectionString: string): Promise<{ ok: boolean }> {
  return request("/connectors/mysql", {
    method: "POST",
    body: JSON.stringify({ connectionString })
  });
}

export async function testFirebase(projectId: string, serviceAccountJson: string): Promise<{ ok: boolean }> {
  return request("/connectors/firebase", {
    method: "POST",
    body: JSON.stringify({ projectId, serviceAccountJson })
  });
}

export async function fetchDashboards(podId: string): Promise<Dashboard[]> {
  return request(`/pods/${podId}/dashboards`);
}

export async function createDashboard(podId: string, payload: { name: string; description?: string }): Promise<Dashboard[]> {
  return request(`/pods/${podId}/dashboards`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateDashboard(podId: string, dashboardId: string, payload: Partial<Dashboard>): Promise<Dashboard> {
  return request(`/pods/${podId}/dashboards/${dashboardId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteDashboard(podId: string, dashboardId: string): Promise<{ ok: boolean }> {
  return request(`/pods/${podId}/dashboards/${dashboardId}`, {
    method: "DELETE"
  });
}

export async function runWidget(podId: string, widget: DashboardWidget): Promise<{ columns: string[]; rows: any[] }> {
  return request(`/pods/${podId}/dashboards/run`, {
    method: "POST",
    body: JSON.stringify({ widget })
  });
}

export async function fetchDashboardTrends(podId: string): Promise<{ widgets: Array<{ widgetId: string; title: string; chartType: string; data: any }> }> {
  return request(`/pods/${podId}/dashboards/trends`);
}

export async function fetchKnowledgeBank(podId: string): Promise<KnowledgeBankEntry[]> {
  return request(`/pods/${podId}/knowledge-bank`);
}

export async function addKnowledgeBankEntry(podId: string, payload: {
  title: string;
  date: string;
  highlights: string;
  lowlights: string;
  docText?: string;
}): Promise<KnowledgeBankEntry[]> {
  return request(`/pods/${podId}/knowledge-bank`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchInsights(podId: string): Promise<InsightPost[]> {
  return request(`/pods/${podId}/insights`);
}

export async function createInsight(podId: string, content: string): Promise<InsightPost[]> {
  return request(`/pods/${podId}/insights`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export async function likeInsight(podId: string, insightId: string): Promise<InsightPost[]> {
  return request(`/pods/${podId}/insights/${insightId}/like`, {
    method: "POST"
  });
}

export async function commentInsight(podId: string, insightId: string, content: string): Promise<InsightPost[]> {
  return request(`/pods/${podId}/insights/${insightId}/comment`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export async function fetchLicense(): Promise<{ license: License; accountType: string; upgradeAvailable: boolean; devUpgradeAllowed?: boolean }> {
  return request("/billing/license");
}

export async function createRazorpayOrder(plan: "INDIVIDUAL" | "BUSINESS", seats?: number): Promise<any> {
  return request("/billing/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ plan, seats })
  });
}

export async function upgradeSubscription(plan: "INDIVIDUAL" | "BUSINESS", seats?: number): Promise<{ ok: boolean; license: License; org: Organization }> {
  return request("/billing/upgrade", {
    method: "POST",
    body: JSON.stringify({ plan, seats })
  });
}

export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan: "INDIVIDUAL" | "BUSINESS";
  seats?: number;
}): Promise<any> {
  return request("/billing/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function downgradeSubscription(): Promise<{ ok: boolean; license: License; org: Organization }> {
  return request("/billing/downgrade", { method: "POST" });
}

export async function cancelSubscription(): Promise<{ ok: boolean; license: License; org: Organization }> {
  return request("/billing/cancel", { method: "POST" });
}

export async function sendChat(message: string, conversationId?: string, podId?: string): Promise<ChatResponse> {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversationId, podId })
  });
}

export async function trackEvent(event: string, payload?: Record<string, unknown>): Promise<{ ok: boolean }> {
  return request("/analytics/track", {
    method: "POST",
    body: JSON.stringify({ event, payload })
  });
}

export async function sendFeedback(payload: {
  conversationId: string;
  messageId: string;
  rating: "up" | "down";
  comment?: string;
}): Promise<{ ok: boolean }> {
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function sendConciergeMessage(payload: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ reply: string }> {
  return request("/concierge", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
