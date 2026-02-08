export type LicenseTier = "FREE" | "INDIVIDUAL" | "BUSINESS";
export type LicenseStatus = "active" | "trial" | "past_due";
export type AccountType = "INDIVIDUAL" | "BUSINESS";
export type LlmProvider = "OPENAI" | "GEMINI";
export type DataSourceKey = "localSql" | "firebase" | "postgres" | "mysql";
export type AuthProvider = "password" | "google";
export type OrgRole = "admin" | "user";
export type PodRole = "admin" | "editor" | "viewer";

export type TokenBucket = {
  limit: number;
  used: number;
  resetAt: string;
};

export type License = {
  tier: LicenseTier;
  status: LicenseStatus;
  tokenBucket: TokenBucket;
  seats: number;
  pricePerSeat: number;
  startedAt: string;
  upgradedAt?: string;
  nextBillingAt?: string;
};

export type PodAccess = {
  podId: string;
  role: PodRole;
};

export type UserProfile = {
  llmProvider: LlmProvider;
  apiKey: string;
  activeDataSource: DataSourceKey;
  updatedAt: string;
};

export type TableDictionaryItem = {
  tableName: string;
  description: string;
};

export type ColumnDictionaryItem = {
  tableName: string;
  columnName: string;
  dataType: string;
  description: string;
  filterable: boolean;
};

export type Parameters = {
  dateHandlingRules: string;
  bestQueryPractices: string;
  businessContext: string;
  sampleQueries: string[];
};

export type MetricDefinition = {
  name: string;
  definition: string;
  sampleQuery: string;
  defaultFilters: string;
};

export type KnowledgeBase = {
  tableDictionary: TableDictionaryItem[];
  columnDictionary: ColumnDictionaryItem[];
  parameters: Parameters;
  metrics: MetricDefinition[];
};

export type KnowledgeQuality = {
  score: number;
  notes: string;
  updatedAt: string;
  evaluatedBy: "system" | "admin";
};

export type LocalSqlSource = {
  connectionString: string;
  updatedAt: string;
};

export type PostgresSource = {
  connectionString: string;
  updatedAt: string;
};

export type MysqlSource = {
  connectionString: string;
  updatedAt: string;
};

export type FirebaseSource = {
  projectId: string;
  serviceAccountJson: string;
  updatedAt: string;
};

export type DataSources = {
  localSql: LocalSqlSource;
  postgres: PostgresSource;
  mysql: MysqlSource;
  firebase: FirebaseSource;
};

export type DashboardFilter = {
  column: string;
  op: "=" | ">" | "<" | ">=" | "<=" | "!=" | "contains" | "in" | "between";
  value: string;
  valueTo?: string;
  values?: string[];
};

export type DashboardJoin = {
  table: string;
  onLeft: string;
  onRight: string;
  type?: "inner" | "left" | "right";
};

export type MetricQuery = {
  table: string;
  metricColumn: string;
  metricColumn2?: string;
  aggregation: "count" | "sum" | "avg" | "min" | "max";
  aggregation2?: "count" | "sum" | "avg" | "min" | "max";
  groupBy?: string;
  timeGrain?: "day" | "week" | "month" | "quarter" | "year";
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  joins: DashboardJoin[];
  filters: DashboardFilter[];
  limit?: number;
};

export type DashboardWidget = {
  id: string;
  title: string;
  description?: string;
  chartType: "line" | "bar" | "pie";
  query: MetricQuery;
  showInChat: boolean;
};

export type Dashboard = {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeBankEntry = {
  id: string;
  title: string;
  date: string;
  highlights: string;
  lowlights: string;
  docText?: string;
  createdAt: string;
  createdBy: string;
};

export type InsightComment = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

export type InsightPost = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  likes: string[];
  comments: InsightComment[];
};

export type Pod = {
  id: string;
  name: string;
  createdAt: string;
  knowledge: KnowledgeBase;
  dataSources: DataSources;
  dashboards: Dashboard[];
  knowledgeBank: KnowledgeBankEntry[];
  insights: InsightPost[];
  knowledgeQuality?: KnowledgeQuality;
  chatEnabled?: boolean;
  chatOverride?: boolean;
};

export type AnalyticsEvent = {
  id: string;
  event: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type FeedbackItem = {
  id: string;
  conversationId: string;
  messageId: string;
  rating: "up" | "down";
  comment?: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  podId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type UserFlags = {
  whitelisted?: boolean;
};

export type UserRecord = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  licenseType: LicenseTier;
  passwordHash: string;
  authProvider: AuthProvider;
  role: OrgRole;
  podAccess: PodAccess[];
  profile: UserProfile;
  conversations: Conversation[];
  analytics: AnalyticsEvent[];
  feedback: FeedbackItem[];
  flags: UserFlags;
  createdAt: string;
  lastLoginAt?: string;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

export type Organization = {
  id: string;
  name: string;
  accountType: AccountType;
  license: License;
  pods: Pod[];
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type PasswordReset = {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type Database = {
  users: UserRecord[];
  orgs: Organization[];
  sessions: Session[];
  passwordResets: PasswordReset[];
};
