import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BotStatus = "draft" | "active" | "paused" | "archived";

export interface Bot {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  description: string | null;
  status: BotStatus;
  current_version_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export type MemberRole =
  | "manager"
  | "employee"
  | "bot_owner"
  | "bot_user"
  | "power_user"
  | "integration_admin"
  | "security_officer"
  | "platform_admin"
  | "director"
  | "auditor"
  | "group_participant";

export interface Member {
  id: number;
  tenant_id: number;
  user_id: number;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  full_name: string | null;
  username: string | null;
  tg_id: number | null;
}

export type VersionStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "rolled_back"
  | "rejected";

export interface BotVersion {
  id: number;
  bot_id: number;
  version: string;
  status: VersionStatus;
  spec: unknown;
  changelog: string | null;
  risk_class: string | null;
  published_at: string | null;
  created_at: string;
}

export type CrType = "personal_ui" | "shared_ui" | "bot_logic" | "integration" | "platform";
export type CrStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "published"
  | "cancelled";
export type RiskClass = "C1" | "C2" | "C3" | "C4";

export interface ChangeRequest {
  id: number;
  tenant_id: number;
  bot_id: number | null;
  type: CrType;
  title: string;
  description: string | null;
  payload: unknown;
  status: CrStatus;
  risk_class: RiskClass | null;
  author_id: number | null;
  reviewer_id: number | null;
  result_version_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  tenant_id: number | null;
  actor_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export const platform = {
  tenants: () => apiFetch<Tenant[]>("/tenants"),
  tenant: (id: number) => apiFetch<Tenant>(`/tenants/${id}`),
  createTenant: (body: { name: string; slug?: string }) =>
    apiFetch<Tenant>("/tenants", { method: "POST", body }),

  bots: (tenantId: number) => apiFetch<Bot[]>(`/tenants/${tenantId}/bots`),
  createBot: (tenantId: number, body: { code: string; name: string; description?: string }) =>
    apiFetch<Bot>(`/tenants/${tenantId}/bots`, { method: "POST", body }),

  members: (tenantId: number) => apiFetch<Member[]>(`/tenants/${tenantId}/members`),
  addMember: (tenantId: number, body: { userId: number; role: MemberRole }) =>
    apiFetch<Member>(`/tenants/${tenantId}/members`, { method: "POST", body }),
  removeMember: (tenantId: number, membershipId: number) =>
    apiFetch<unknown>(`/tenants/${tenantId}/members/${membershipId}`, { method: "DELETE" }),

  versions: (botId: number) => apiFetch<BotVersion[]>(`/tenants/bots/${botId}/versions`),
  publishVersion: (botId: number, versionId: number) =>
    apiFetch<BotVersion>(`/tenants/bots/${botId}/versions/${versionId}/publish`, {
      method: "POST",
      body: {},
    }),

  changeRequests: (params: {
    tenantId?: number;
    botId?: number;
    status?: CrStatus;
    type?: CrType;
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return apiFetch<ChangeRequest[]>(`/change-requests${qs ? `?${qs}` : ""}`);
  },
  changeRequest: (id: number) => apiFetch<ChangeRequest>(`/change-requests/${id}`),
  createChangeRequest: (body: {
    tenantId: number;
    botId?: number | null;
    type: CrType;
    title: string;
    description?: string;
    payload?: unknown;
    riskClass?: RiskClass;
  }) => apiFetch<ChangeRequest>("/change-requests", { method: "POST", body }),
  setChangeRequestStatus: (id: number, status: CrStatus) =>
    apiFetch<ChangeRequest>(`/change-requests/${id}/status`, { method: "PATCH", body: { status } }),

  audit: (params: { tenantId?: number; actorId?: number; action?: string; limit?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return apiFetch<AuditEntry[]>(`/audit${qs ? `?${qs}` : ""}`);
  },
};

export const BOT_STATUS_LABELS: Record<BotStatus, string> = {
  draft: "Черновик",
  active: "Активен",
  paused: "Пауза",
  archived: "В архиве",
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: "Черновик",
  in_review: "На ревью",
  approved: "Одобрена",
  published: "Опубликована",
  rolled_back: "Откат",
  rejected: "Отклонена",
};

export const CR_STATUS_LABELS: Record<CrStatus, string> = {
  draft: "Черновик",
  submitted: "Отправлена",
  in_review: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
  published: "Внедрена",
  cancelled: "Отменена",
};

export const CR_TYPE_LABELS: Record<CrType, string> = {
  personal_ui: "Личный интерфейс",
  shared_ui: "Общий интерфейс",
  bot_logic: "Логика бота",
  integration: "Интеграция",
  platform: "Платформа",
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  manager: "Руководитель",
  employee: "Сотрудник",
  bot_owner: "Владелец бота",
  bot_user: "Пользователь бота",
  power_user: "Продвинутый пользователь",
  integration_admin: "Админ интеграций",
  security_officer: "Офицер безопасности",
  platform_admin: "Админ платформы",
  director: "Директор",
  auditor: "Аудитор",
  group_participant: "Участник группы",
};

const TENANT_KEY = "yaya.tenant";

function readStoredTenant(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TENANT_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function setStoredTenant(id: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TENANT_KEY, String(id));
  window.dispatchEvent(new Event("yaya:tenant-changed"));
}

export function useTenants() {
  return useQuery({ queryKey: ["tenants"], queryFn: () => platform.tenants(), retry: false });
}

/** Текущая организация: сохранённая в localStorage или первая доступная. */
export function useCurrentTenant() {
  const query = useTenants();
  const [stored, setStored] = useState<number | null>(() => readStoredTenant());

  useEffect(() => {
    const sync = () => setStored(readStoredTenant());
    window.addEventListener("yaya:tenant-changed", sync);
    return () => window.removeEventListener("yaya:tenant-changed", sync);
  }, []);

  const tenants = query.data ?? [];
  const tenant = tenants.find((t) => t.id === stored) ?? tenants[0] ?? null;

  return { tenant, tenants, isLoading: query.isPending, isError: query.isError, query };
}
