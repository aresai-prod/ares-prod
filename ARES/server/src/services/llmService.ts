import type {
  Dashboard,
  DataSourceKey,
  FeedbackItem,
  KnowledgeBase,
  KnowledgeBankEntry,
  LlmProvider
} from "../models/types.js";
import { runOpenAi } from "../llm/openai.js";
import { runGemini } from "../llm/gemini.js";
import type { RagContext } from "../rag/ragService.js";
import { estimateTokens } from "./billingService.js";

export type SqlRequest = {
  message: string;
  provider: LlmProvider;
  apiKey: string;
  knowledge: KnowledgeBase;
  dataSource: DataSourceKey;
  rag: RagContext;
  feedback: FeedbackItem[];
  knowledgeBank: string;
  dashboards: Dashboard[];
};

export type SqlResponse = {
  sql: string;
  chartHint: "line" | "bar" | "pie";
  tokensUsed: number;
};

export type AnalysisRequest = {
  message: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  provider: LlmProvider;
  apiKey: string;
  knowledge: KnowledgeBase;
  dataSource: DataSourceKey;
  feedback: FeedbackItem[];
  knowledgeBank: string;
  dashboards: Dashboard[];
};

export type AnalysisResponse = {
  analysis: string;
  tokensUsed: number;
};

export type SupportMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SupportRequest = {
  message: string;
  history: SupportMessage[];
  provider: LlmProvider;
  apiKey: string;
  accountType: string;
  licenseTier: string;
};

export type SupportResponse = {
  reply: string;
  tokensUsed: number;
};

export type KnowledgeQualityResponse = {
  score: number;
  notes: string;
  tokensUsed: number;
};

const fallbackSql = `SELECT
  date_trunc('month', created_at) AS month,
  SUM(total) AS revenue
FROM orders
GROUP BY 1
ORDER BY 1
LIMIT 12;`;

function getApiKey(provider: LlmProvider, apiKey: string): string {
  if (apiKey) return apiKey;
  if (provider === "OPENAI") return process.env.OPENAI_API_KEY ?? "";
  return process.env.GEMINI_API_KEY ?? "";
}

function getModel(provider: LlmProvider): string {
  if (provider === "OPENAI") return process.env.OPENAI_MODEL ?? "gpt-5";
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

async function runProvider(provider: LlmProvider, prompt: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const key = getApiKey(provider, apiKey);
  if (!key) return { text: "", tokens: estimateTokens(prompt) };
  const model = getModel(provider);
  const text = provider === "OPENAI" ? await runOpenAi(prompt, key, model) : await runGemini(prompt, key, model);
  const tokens = estimateTokens(`${prompt}${text}`);
  return { text, tokens };
}

function pickAppProvider(): LlmProvider {
  if (process.env.OPENAI_API_KEY) return "OPENAI";
  if (process.env.GEMINI_API_KEY) return "GEMINI";
  throw new Error("No app LLM key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
}

function feedbackSnippet(feedback: FeedbackItem[]): string {
  if (!feedback.length) return "None.";
  return feedback
    .map((item) => `${item.rating.toUpperCase()}: ${item.comment ?? "(no comment)"}`)
    .join("\n");
}

function dashboardsSnippet(dashboards: Dashboard[]): string {
  if (!dashboards.length) return "None.";
  return dashboards
    .map((dashboard) =>
      `${dashboard.name}: ${dashboard.widgets.map((widget) => widget.title).join(", ")}`
    )
    .join("\n");
}

function extractJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON block found");
  }
  const jsonText = text.slice(start, end + 1);
  return JSON.parse(jsonText);
}

export async function generateSql(request: SqlRequest): Promise<SqlResponse> {
  const prompt = [
    "You are ARES, an AI SQL assistant.",
    `User question: ${request.message}`,
    `Active data source: ${request.dataSource}`,
    "Table dictionary:",
    JSON.stringify(request.knowledge.tableDictionary),
    "Column dictionary:",
    JSON.stringify(request.knowledge.columnDictionary),
    "Parameters:",
    JSON.stringify(request.knowledge.parameters),
    "Metrics:",
    JSON.stringify(request.knowledge.metrics),
    "Knowledge bank context:",
    request.knowledgeBank || "None.",
    "Dashboards:",
    dashboardsSnippet(request.dashboards),
    "RAG snippets:",
    request.rag.snippets.join(" | ") || "None.",
    "Recent user feedback:",
    feedbackSnippet(request.feedback),
    "\nInstructions:",
    "- Return ONLY a JSON object with keys: sql, chartHint.",
    "- chartHint must be one of: line, bar, pie.",
    "- Always include a LIMIT unless the user asked for full output.",
    request.dataSource === "firebase"
      ? "- Use simple SQL that maps to Firestore: SELECT <fields> FROM <collection> WHERE field = 'value' ORDER BY field LIMIT N."
      : request.dataSource === "postgres"
        ? "- Use PostgreSQL-compatible SQL (date_trunc, ILIKE, etc.)."
        : request.dataSource === "mysql"
          ? "- Use MySQL-compatible SQL (DATE_FORMAT, backticks if needed)."
          : "- Use PostgreSQL/MySQL compatible SQL."
  ].join("\n");

  const raw = await runProvider(request.provider, prompt, request.apiKey);
  if (!raw.text) {
    return { sql: fallbackSql, chartHint: "line", tokensUsed: raw.tokens };
  }

  try {
    const parsed = extractJson(raw.text) as { sql?: string; chartHint?: SqlResponse["chartHint"] };
    return {
      sql: parsed.sql ?? fallbackSql,
      chartHint: parsed.chartHint ?? "bar",
      tokensUsed: raw.tokens
    };
  } catch {
    return { sql: fallbackSql, chartHint: "bar", tokensUsed: raw.tokens };
  }
}

export async function generateAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const prompt = [
    "You are ARES, an AI data analyst.",
    `User question: ${request.message}`,
    `SQL: ${request.sql}`,
    `Columns: ${JSON.stringify(request.columns)}`,
    `Rows: ${JSON.stringify(request.rows)}`,
    "Parameters:",
    JSON.stringify(request.knowledge.parameters),
    "Knowledge bank context:",
    request.knowledgeBank || "None.",
    "Dashboards:",
    dashboardsSnippet(request.dashboards),
    "Recent user feedback:",
    feedbackSnippet(request.feedback),
    "\nInstructions:",
    "- Summarize key insights in 4-6 bullets.",
    "- Mention anomalies or trends.",
    "- Keep it concise and business-focused."
  ].join("\n");

  const raw = await runProvider(request.provider, prompt, request.apiKey);
  if (!raw.text) {
    return {
      analysis: "No API key configured. Add your OpenAI or Gemini key in Profile to enable live analysis.",
      tokensUsed: raw.tokens
    };
  }

  return { analysis: raw.text.trim(), tokensUsed: raw.tokens };
}

export async function generateSupportResponse(request: SupportRequest): Promise<SupportResponse> {
  const history = request.history
    .slice(-6)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");

  const prompt = [
    "You are ARES Concierge, a help & support assistant for the ARES Console.",
    "You MUST only answer about product usage, onboarding, troubleshooting, and where to find features.",
    "Do NOT generate SQL or analyze user data. If asked, redirect them to the Chat panel.",
    `Account type: ${request.accountType}`,
    `License tier: ${request.licenseTier}`,
    "Key modules: Auth (login/signup/Google), Profile/API keys, Data Sources, Knowledge Base, Metrics, Dashboards, Insights (business only), Team (business only), Billing/License, Admin tools.",
    "Answer in <= 120 words. Use short steps if needed.",
    history ? `Recent conversation:\n${history}` : "Recent conversation: None.",
    `User: ${request.message}`
  ].join("\n");

  const raw = await runProvider(request.provider, prompt, request.apiKey);
  if (!raw.text) {
    return {
      reply:
        "Concierge needs an OpenAI or Gemini API key. Add one in Profile to enable support answers.",
      tokensUsed: raw.tokens
    };
  }
  return { reply: raw.text.trim(), tokensUsed: raw.tokens };
}

export async function evaluateKnowledgeQuality(
  knowledge: KnowledgeBase,
  options?: { provider?: LlmProvider; apiKey?: string; knowledgeBank?: KnowledgeBankEntry[] }
): Promise<KnowledgeQualityResponse> {
  let provider: LlmProvider;
  if (options?.provider) {
    provider = options.provider;
  } else {
    try {
      provider = pickAppProvider();
    } catch {
      provider = "OPENAI";
    }
  }
  const prompt = [
    "You are a data documentation reviewer.",
    "Evaluate the quality of the knowledge base for analytics readiness.",
    "Return ONLY JSON with keys: score (0-100 integer), notes (1-2 sentences).",
    "Scoring guidance:",
    "- 90-100: comprehensive tables/columns/metrics with clear business context.",
    "- 80-89: mostly complete but missing minor details.",
    "- 60-79: incomplete or unclear; missing key definitions.",
    "- <60: insufficient for reliable analysis.",
    "If knowledge bank entries exist, incorporate them in the assessment.",
    "Knowledge base:",
    JSON.stringify(knowledge),
    options?.knowledgeBank?.length
      ? `Knowledge bank:\n${options.knowledgeBank.map((entry) => `- ${entry.title}: ${entry.highlights} | ${entry.lowlights}`).join("\n")}`
      : "Knowledge bank: None."
  ].join("\n");

  const fallback = computeHeuristicQuality(knowledge, options?.knowledgeBank);
  let raw: { text: string; tokens: number };
  try {
    raw = await runProvider(provider, prompt, options?.apiKey ?? "");
  } catch {
    return {
      score: fallback.score,
      notes: `${fallback.notes} (LLM evaluation unavailable; using heuristic).`,
      tokensUsed: estimateTokens(prompt)
    };
  }
  if (!raw.text) {
    return { score: fallback.score, notes: fallback.notes, tokensUsed: raw.tokens };
  }

  try {
    const parsed = extractJson(raw.text) as { score?: number; notes?: string };
    const score =
      typeof parsed.score === "number" && !Number.isNaN(parsed.score)
        ? Math.max(0, Math.min(100, Math.round(parsed.score)))
        : fallback.score;
    return {
      score,
      notes: parsed.notes ?? fallback.notes,
      tokensUsed: raw.tokens
    };
  } catch {
    return { score: fallback.score, notes: fallback.notes, tokensUsed: raw.tokens };
  }
}

function computeHeuristicQuality(
  knowledge: KnowledgeBase,
  knowledgeBank?: KnowledgeBankEntry[]
): { score: number; notes: string } {
  const tables = knowledge.tableDictionary ?? [];
  const columns = knowledge.columnDictionary ?? [];
  const metrics = knowledge.metrics ?? [];

  const tableComplete = tables.filter((t) => t.tableName?.trim() && t.description?.trim()).length;
  const columnComplete = columns.filter(
    (c) => c.tableName?.trim() && c.columnName?.trim() && c.dataType?.trim() && c.description?.trim()
  ).length;

  const tableScore = Math.min(30, (tableComplete / Math.max(1, tables.length)) * 30);
  const columnScore = Math.min(20, (columnComplete / Math.max(1, columns.length)) * 20);

  const params = knowledge.parameters;
  const paramsScore = [
    params.dateHandlingRules?.trim(),
    params.bestQueryPractices?.trim(),
    params.businessContext?.trim(),
    params.sampleQueries?.length ? "ok" : ""
  ].filter(Boolean).length * 5;

  const metricFields = metrics.length * 4;
  const metricFilled = metrics.reduce((count, metric) => {
    return (
      count +
      (metric.name?.trim() ? 1 : 0) +
      (metric.definition?.trim() ? 1 : 0) +
      (metric.sampleQuery?.trim() ? 1 : 0) +
      (metric.defaultFilters?.trim() ? 1 : 0)
    );
  }, 0);
  const metricScore = metricFields ? (metricFilled / metricFields) * 20 : 0;

  const bankScore = knowledgeBank && knowledgeBank.length > 0 ? 10 : 0;
  const total = Math.max(0, Math.min(100, Math.round(tableScore + columnScore + paramsScore + metricScore + bankScore)));

  const missing: string[] = [];
  if (tableComplete === 0) missing.push("tables");
  if (columnComplete === 0) missing.push("columns");
  if (!params.businessContext?.trim()) missing.push("business context");
  if (metrics.length === 0 || metricFilled === 0) missing.push("metrics");

  const notes =
    missing.length > 0
      ? `Add ${missing.join(", ")} to improve documentation quality.`
      : "Knowledge base is sufficiently detailed for analytics.";

  return { score: total, notes };
}
