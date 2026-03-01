import type {
  Character,
  DashboardData,
  Item,
  Monster,
  Resource,
  MapTile,
  BankData,
  AutomationConfig,
  AutomationRun,
  AutomationLog,
  AutomationStatus,
  WorkflowConfig,
  WorkflowRun,
  WorkflowStatus,
  PipelineConfig,
  PipelineRun,
  PipelineStatus,
  GEOrder,
  GEHistoryEntry,
  PricePoint,
  ActiveGameEvent,
  HistoricalEvent,
  ActionLog,
  PaginatedLogs,
  AnalyticsData,
  PaginatedErrors,
  ErrorStats,
  AppError,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STORAGE_KEY = "artifacts-api-token";

/** Read the user's API token from localStorage (browser-only). */
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** Build headers including the per-user API token when available. */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getStoredToken();
  if (token) {
    headers["X-API-Token"] = token;
  }
  return headers;
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function postApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return undefined as T;
}

async function putApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return undefined as T;
}

async function deleteApi(path: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
    );
  }
}

// ---------- Auth API ----------

export interface AuthStatus {
  has_token: boolean;
  source: "env" | "user" | "none";
}

export interface SetTokenResponse {
  success: boolean;
  source: string;
  account?: string | null;
  error?: string | null;
}

export function getAuthStatus(): Promise<AuthStatus> {
  return fetchApi<AuthStatus>("/api/auth/status");
}

export async function setAuthToken(token: string): Promise<SetTokenResponse> {
  return postApi<SetTokenResponse>("/api/auth/token", { token });
}

export async function clearAuthToken(): Promise<AuthStatus> {
  const response = await fetch(`${API_URL}/api/auth/token`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<AuthStatus>;
}

// ---------- Characters API ----------

export function getCharacters(): Promise<Character[]> {
  return fetchApi<Character[]>("/api/characters");
}

export function getCharacter(name: string): Promise<Character> {
  return fetchApi<Character>(`/api/characters/${encodeURIComponent(name)}`);
}

export function getDashboard(): Promise<DashboardData> {
  return fetchApi<DashboardData>("/api/dashboard");
}

export function getItems(): Promise<Item[]> {
  return fetchApi<Item[]>("/api/game/items");
}

export function getMonsters(): Promise<Monster[]> {
  return fetchApi<Monster[]>("/api/game/monsters");
}

export function getResources(): Promise<Resource[]> {
  return fetchApi<Resource[]>("/api/game/resources");
}

export function getMaps(): Promise<MapTile[]> {
  return fetchApi<MapTile[]>("/api/game/maps");
}

export function getBank(): Promise<BankData> {
  return fetchApi<BankData>("/api/bank");
}

// ---------- Automation API ----------

export function getAutomations(): Promise<AutomationConfig[]> {
  return fetchApi<AutomationConfig[]>("/api/automations");
}

export function getAutomation(
  id: number
): Promise<{ config: AutomationConfig; runs: AutomationRun[] }> {
  return fetchApi<{ config: AutomationConfig; runs: AutomationRun[] }>(
    `/api/automations/${id}`
  );
}

export function createAutomation(data: {
  name: string;
  character_name: string;
  strategy_type: string;
  config: Record<string, unknown>;
}): Promise<AutomationConfig> {
  return postApi<AutomationConfig>("/api/automations", data);
}

export function updateAutomation(
  id: number,
  data: Partial<AutomationConfig>
): Promise<AutomationConfig> {
  return putApi<AutomationConfig>(`/api/automations/${id}`, data);
}

export function deleteAutomation(id: number): Promise<void> {
  return deleteApi(`/api/automations/${id}`);
}

export function startAutomation(id: number): Promise<void> {
  return postApi(`/api/automations/${id}/start`);
}

export function stopAutomation(id: number): Promise<void> {
  return postApi(`/api/automations/${id}/stop`);
}

export function pauseAutomation(id: number): Promise<void> {
  return postApi(`/api/automations/${id}/pause`);
}

export function resumeAutomation(id: number): Promise<void> {
  return postApi(`/api/automations/${id}/resume`);
}

export function getAutomationStatuses(): Promise<AutomationStatus[]> {
  return fetchApi<AutomationStatus[]>("/api/automations/status/all");
}

export function getAutomationStatus(id: number): Promise<AutomationStatus> {
  return fetchApi<AutomationStatus>(`/api/automations/${id}/status`);
}

export function getAutomationLogs(
  id: number,
  limit: number = 100
): Promise<AutomationLog[]> {
  return fetchApi<AutomationLog[]>(
    `/api/automations/${id}/logs?limit=${limit}`
  );
}

// ---------- Workflow API ----------

export function getWorkflows(): Promise<WorkflowConfig[]> {
  return fetchApi<WorkflowConfig[]>("/api/workflows");
}

export function getWorkflow(
  id: number
): Promise<{ config: WorkflowConfig; runs: WorkflowRun[] }> {
  return fetchApi<{ config: WorkflowConfig; runs: WorkflowRun[] }>(
    `/api/workflows/${id}`
  );
}

export function createWorkflow(data: {
  name: string;
  character_name: string;
  description?: string;
  steps: Record<string, unknown>[];
  loop?: boolean;
  max_loops?: number;
}): Promise<WorkflowConfig> {
  return postApi<WorkflowConfig>("/api/workflows", data);
}

export function updateWorkflow(
  id: number,
  data: Partial<WorkflowConfig>
): Promise<WorkflowConfig> {
  return putApi<WorkflowConfig>(`/api/workflows/${id}`, data);
}

export function deleteWorkflow(id: number): Promise<void> {
  return deleteApi(`/api/workflows/${id}`);
}

export function startWorkflow(id: number): Promise<WorkflowRun> {
  return postApi<WorkflowRun>(`/api/workflows/${id}/start`);
}

export function stopWorkflow(id: number): Promise<void> {
  return postApi(`/api/workflows/${id}/stop`);
}

export function pauseWorkflow(id: number): Promise<void> {
  return postApi(`/api/workflows/${id}/pause`);
}

export function resumeWorkflow(id: number): Promise<void> {
  return postApi(`/api/workflows/${id}/resume`);
}

export function getWorkflowStatuses(): Promise<WorkflowStatus[]> {
  return fetchApi<WorkflowStatus[]>("/api/workflows/status/all");
}

export function getWorkflowStatus(id: number): Promise<WorkflowStatus> {
  return fetchApi<WorkflowStatus>(`/api/workflows/${id}/status`);
}

export function getWorkflowLogs(
  id: number,
  limit: number = 100
): Promise<AutomationLog[]> {
  return fetchApi<AutomationLog[]>(
    `/api/workflows/${id}/logs?limit=${limit}`
  );
}

// ---------- Pipeline API ----------

export function getPipelines(): Promise<PipelineConfig[]> {
  return fetchApi<PipelineConfig[]>("/api/pipelines");
}

export function getPipeline(
  id: number
): Promise<{ config: PipelineConfig; runs: PipelineRun[] }> {
  return fetchApi<{ config: PipelineConfig; runs: PipelineRun[] }>(
    `/api/pipelines/${id}`
  );
}

export function createPipeline(data: {
  name: string;
  description?: string;
  stages: Record<string, unknown>[];
  loop?: boolean;
  max_loops?: number;
}): Promise<PipelineConfig> {
  return postApi<PipelineConfig>("/api/pipelines", data);
}

export function updatePipeline(
  id: number,
  data: Partial<PipelineConfig>
): Promise<PipelineConfig> {
  return putApi<PipelineConfig>(`/api/pipelines/${id}`, data);
}

export function deletePipeline(id: number): Promise<void> {
  return deleteApi(`/api/pipelines/${id}`);
}

export function startPipeline(id: number): Promise<PipelineRun> {
  return postApi<PipelineRun>(`/api/pipelines/${id}/start`);
}

export function stopPipeline(id: number): Promise<void> {
  return postApi(`/api/pipelines/${id}/stop`);
}

export function pausePipeline(id: number): Promise<void> {
  return postApi(`/api/pipelines/${id}/pause`);
}

export function resumePipeline(id: number): Promise<void> {
  return postApi(`/api/pipelines/${id}/resume`);
}

export function getPipelineStatuses(): Promise<PipelineStatus[]> {
  return fetchApi<PipelineStatus[]>("/api/pipelines/status/all");
}

export function getPipelineStatus(id: number): Promise<PipelineStatus> {
  return fetchApi<PipelineStatus>(`/api/pipelines/${id}/status`);
}

export function getPipelineLogs(
  id: number,
  limit: number = 100
): Promise<AutomationLog[]> {
  return fetchApi<AutomationLog[]>(
    `/api/pipelines/${id}/logs?limit=${limit}`
  );
}

// ---------- Grand Exchange API ----------

export async function getExchangeOrders(): Promise<GEOrder[]> {
  const res = await fetchApi<{ orders: GEOrder[] }>("/api/exchange/orders");
  return res.orders;
}

export async function getMyOrders(): Promise<GEOrder[]> {
  const res = await fetchApi<{ orders: GEOrder[] }>("/api/exchange/my-orders");
  return res.orders;
}

export async function getExchangeHistory(): Promise<GEHistoryEntry[]> {
  const res = await fetchApi<{ history: GEHistoryEntry[] }>("/api/exchange/history");
  return res.history;
}

export async function getSellHistory(itemCode: string): Promise<GEHistoryEntry[]> {
  const res = await fetchApi<{ history: GEHistoryEntry[] }>(
    `/api/exchange/sell-history/${encodeURIComponent(itemCode)}`
  );
  return res.history;
}

export async function getPriceHistory(itemCode: string): Promise<PricePoint[]> {
  const res = await fetchApi<{ entries: PricePoint[] }>(
    `/api/exchange/prices/${encodeURIComponent(itemCode)}`
  );
  return res.entries;
}

// ---------- Events API ----------

export async function getEvents(): Promise<ActiveGameEvent[]> {
  const res = await fetchApi<{ events: ActiveGameEvent[] }>("/api/events");
  return res.events;
}

export async function getEventHistory(): Promise<HistoricalEvent[]> {
  const res = await fetchApi<{ events: HistoricalEvent[] }>("/api/events/history");
  return res.events;
}

// ---------- Logs & Analytics API ----------

export async function getLogs(filters?: {
  character?: string;
  type?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedLogs> {
  const params = new URLSearchParams();
  if (filters?.character) params.set("character", filters.character);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.size) params.set("size", filters.size.toString());
  const qs = params.toString();
  const data = await fetchApi<PaginatedLogs>(`/api/logs${qs ? `?${qs}` : ""}`);
  return {
    logs: data.logs ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pages: data.pages ?? 1,
  };
}

export function getAnalytics(
  characterName?: string,
  hours?: number
): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (characterName) params.set("character", characterName);
  if (hours) params.set("hours", hours.toString());
  const qs = params.toString();
  return fetchApi<AnalyticsData>(`/api/logs/analytics${qs ? `?${qs}` : ""}`);
}

// ---------- Character Actions API ----------

export function executeAction(
  characterName: string,
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return postApi<Record<string, unknown>>(
    `/api/characters/${encodeURIComponent(characterName)}/action`,
    { action, params }
  );
}

// ---------- App Errors API ----------

export async function getAppErrors(filters?: {
  severity?: string;
  source?: string;
  resolved?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedErrors> {
  const params = new URLSearchParams();
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.resolved) params.set("resolved", filters.resolved);
  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.size) params.set("size", filters.size.toString());
  const qs = params.toString();
  return fetchApi<PaginatedErrors>(`/api/errors${qs ? `?${qs}` : ""}`);
}

export function getErrorStats(): Promise<ErrorStats> {
  return fetchApi<ErrorStats>("/api/errors/stats");
}

export function resolveError(id: number): Promise<AppError> {
  return postApi<AppError>(`/api/errors/${id}/resolve`);
}

export function reportError(report: {
  error_type: string;
  message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  return postApi("/api/errors/report", report);
}
