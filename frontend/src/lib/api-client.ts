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
  GEOrder,
  GEHistoryEntry,
  PricePoint,
  ActiveGameEvent,
  HistoricalEvent,
  ActionLog,
  AnalyticsData,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function postApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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

export async function getLogs(characterName?: string): Promise<ActionLog[]> {
  const params = new URLSearchParams();
  if (characterName) params.set("character", characterName);
  const qs = params.toString();
  const data = await fetchApi<ActionLog[] | { logs?: ActionLog[] }>(`/api/logs${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : (data?.logs ?? []);
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
