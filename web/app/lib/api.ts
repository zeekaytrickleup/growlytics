// Thin client for the Growlytics API. Every call fails soft (returns null) so the UI can fall back
// to its local mock data and never break a demo when the API is down. See MASTER_PLAN §Phase 1.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Active workspace — sent as x-workspace-id on every request so the API scopes data to it.
let currentWorkspaceId = "demo-workspace";
export const setWorkspace = (id: string) => { currentWorkspaceId = id; };
export const getWorkspace = () => currentWorkspaceId;
const wsHeaders = (): Record<string, string> => ({ "x-workspace-id": currentWorkspaceId });

export type OverviewKpi = { key: string; label: string; value: string; delta: string; kind: string };
export type OverviewInsight = { type: string; tag: string; title: string; body: string; cta: string };
export type OverviewProduct = { name: string; rev: string; orders: number; cr: number; trend: string; stock: number };
export type Overview = {
  source: string;
  kpis: OverviewKpi[];
  insights: OverviewInsight[];
  revenueSeries: { d: string; rev: number; prev: number }[];
  trafficSources: { name: string; value: number }[];
  topProducts: OverviewProduct[];
};

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store", headers: wsHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type Me = {
  authMode: string;
  user: { name: string; email: string };
  currentWorkspaceId: string;
  workspaces: { id: string; name: string; role: string }[];
};
export const fetchMe = () => getJson<Me>("/me");

// Fetch the dashboard overview. Pass a preset period ("7d"/"30d"/"90d"),
// or a custom { from, to } date range (YYYY-MM-DD) which takes precedence.
export const fetchOverview = (opts?: string | { from: string; to: string }) => {
  let qs = "";
  if (typeof opts === "string") qs = `?period=${opts}`;
  else if (opts?.from && opts?.to) qs = `?from=${opts.from}&to=${opts.to}`;
  return getJson<Overview>(`/dashboard/overview${qs}`);
};

export const fetchProducts = () =>
  getJson<{ source: string; products: OverviewProduct[] }>("/dashboard/products").then((r) => r?.products ?? null);

export type CustomerSegment = { name: string; n: number; val: string; color: string; ai: string };
export const fetchCustomerSegments = () =>
  getJson<{ source: string; segments: CustomerSegment[] }>("/customers").then((r) => r?.segments ?? null);

export type AIAnswer = {
  analysis: string;
  reason: string;
  confidence: number;
  actions: string[];
  impact: string;
  source?: "llm" | "mock";
};

export type ReportSummary = {
  store: string;
  period: string;
  generatedAt: string;
  headlineKpis: { label: string; value: string; delta: string; kind: string }[];
  narrative: string;
  insights: { title: string; body: string; confidence: number }[];
  source: string;
};

export const fetchReportSummary = () => getJson<ReportSummary>("/reports/summary");
export const reportPdfUrl = () => `${API_URL}/reports/summary.pdf?workspaceId=${encodeURIComponent(currentWorkspaceId)}`;

export type Integration = {
  provider: string;
  name: string;
  desc: string;
  status: "CONNECTED" | "SYNCING" | "ERROR" | "AVAILABLE";
  lastSyncedAt: string | null;
  hasDataConnector: boolean;
  storeUrl?: string | null;
};

export type WooCreds = { storeUrl: string; consumerKey: string; consumerSecret: string };
export type ConnectCreds = WooCreds | { apiKey: string };

export type MarketingKpi = { key: string; label: string; value: string; delta: string; kind: string };
export type MarketingChannel = { name: string; spend: string; rev: string; roas: string; cpa: string; ctr: string; conv: number; kind: string; rec: string };
export type Marketing = { source: string; kpis: MarketingKpi[]; channels: MarketingChannel[] };
export const fetchMarketing = () => getJson<Marketing>("/dashboard/marketing");

export const fetchIntegrations = () =>
  getJson<{ integrations: Integration[] }>("/integrations").then((r) => r?.integrations ?? null);

async function postJson<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...wsHeaders() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Connect a provider. Pass credentials to save + sync it (WooCommerce store keys, or a Klaviyo API key).
export const connectIntegration = (provider: string, creds?: ConnectCreds) =>
  postJson<{ status: string; error?: string; products?: number; channels?: number }>(
    `/integrations/${provider.toLowerCase()}/connect`,
    creds,
  );
export const syncIntegration = (provider: string) =>
  postJson<{ status: string }>(`/integrations/${provider.toLowerCase()}/sync`);

// Create a new workspace (one per store). Returns the new workspace.
export const createWorkspace = (name: string) =>
  postJson<{ id: string; name: string; role: string }>("/workspaces", { name });

export async function askAssistant(question: string): Promise<AIAnswer | null> {
  try {
    const res = await fetch(`${API_URL}/assistant/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...wsHeaders() },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: AIAnswer };
    return data.answer ?? null;
  } catch {
    return null;
  }
}
