import { authHeaders } from "./api";

export const API_SECOND_URL =
  (import.meta.env["VITE_API_SECOND_URL"] as string | undefined) ?? "http://localhost:4000";

export type TerminalStatus = "pending" | "registered" | "paid" | "cancelled";

export interface Terminal {
  id: number;
  serialNumber: string;
  inn: string | null;
  email: string | null;
  contactPhone: string | null;
  objectType: string | null;
  subjectName: string | null;
  objectAddress: string | null;
  objectName: string | null;
  activityType: string | null;
  taxRegime: string | null;
  rawText: string | null;
  status: TerminalStatus;
  registeredAt: string | null;
  paidAt: string | null;
  durationMs: number | null;
  durationHuman: string | null;
  registeredById: number | null;
  paidById: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalStatsSlice {
  total: number;
  paid: number;
  registered: number;
  pending: number;
  cancelled: number;
  avgDuration: string | null;
  minDuration: string | null;
  maxDuration: string | null;
  avgDurationMs: number | null;
}

export interface TerminalStatsRanges {
  all: TerminalStatsSlice;
  week: TerminalStatsSlice;
  month: TerminalStatsSlice;
}

export interface PaginatedTerminals {
  data: Terminal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function acquiringFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeaders() };

  let res: Response;
  try {
    res = await fetch(`${API_SECOND_URL}${path}`, {
      method: init?.method ?? "GET",
      headers,
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new Error(
      `Не удалось связаться с сервером эквайринга (${API_SECOND_URL}). Проверьте, что backend запущен.`,
    );
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const body = payload as { message?: string } | null;
    throw new Error(body?.message ?? `Ошибка запроса эквайринга (${res.status})`);
  }

  return payload as T;
}

export const acquiringApi = {
  stats: () => acquiringFetch<TerminalStatsRanges | TerminalStatsSlice>("/api/stats"),

  registrations: (query: URLSearchParams) =>
    acquiringFetch<PaginatedTerminals>(`/api/registrations?${query.toString()}`),

  registration: (id: number) => acquiringFetch<Terminal>(`/api/registrations/${id}`),

  byInn: (inn: string) =>
    acquiringFetch<{ inn: string; count: number; data: Terminal[] }>(`/api/registrations/by-inn/${encodeURIComponent(inn)}`),

  bySerial: (serial: string) =>
    acquiringFetch<{ serialNumber: string; count: number; data: Terminal[] }>(`/api/registrations/by-serial/${encodeURIComponent(serial)}`),

  createPending: (body: { serialNumber: string; notes?: string }) =>
    acquiringFetch<Terminal>("/api/registrations/pending", { method: "POST", body }),
};

export const TERMINAL_STATUS_LABELS: Record<TerminalStatus, string> = {
  pending: "Ждёт регистрации",
  registered: "Зарегистрирован (ожидает оплату)",
  paid: "Оплачен",
  cancelled: "Отменён",
};

export const TERMINAL_STATUS_COLORS: Record<TerminalStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  registered: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
};
