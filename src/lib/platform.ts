import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";
import { useCurrentOrg, useMyOrgs } from "./org";

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

/** Элемент справочника GET /tenants/roles */
export interface RoleInfo {
  code: MemberRole | string;
  name?: string;
  title?: string;
  description?: string | null;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Tenant с ролями текущего пользователя (из /tenants/mine) */
export interface TenantWithRoles extends Tenant {
  roles: MemberRole[];
}

export interface BotTemplate {
  code: string;
  name: string;
  category: string;
  description: string;
  defaultSpec: Record<string, unknown>;
  riskClass: string;
  implemented: boolean;
}

/** Шаблон бота, доступный для подключения в организации (ещё не подключён). */
export interface AvailableBotTemplate {
  code: string;
  name: string;
  description: string;
  required_integrations: IntegrationProvider[];
  missing_integrations: IntegrationProvider[];
  can_create: boolean;
  connected: boolean;
  bot: Bot | null;
  executable: boolean;
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

export interface Member {
  id: number;
  tenant_id: number;
  user_id: number;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  full_name: string | null;
  avatar_url?: string | null;
  username: string | null;
  tg_id: number | null;
}

export type VersionStatus =
  "draft" | "in_review" | "approved" | "published" | "rolled_back" | "rejected";

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

/** Бот с вложенным массивом версий (из GET /tenants/bots/:botId) */
export interface BotDetail extends Bot {
  versions?: BotVersion[];
}

export type CrType =
  "personal_ui" | "shared_ui" | "bot_logic" | "integration" | "platform" | "bot_create";
export type CrStatus =
  "draft" | "submitted" | "in_review" | "approved" | "rejected" | "published" | "cancelled";
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
  /** ID организации (tenant), для которой записан лог. */
  tenant_id: number | null;
  /** ID организации, если backend возвращает organization_id вместо tenant_id. */
  organization_id?: number | null;
  actor_id: number | null;
  actor_name?: string | null;
  actor_username?: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  /** meta может прийти как объект или как строка JSON. */
  meta: Record<string, unknown> | string | null;
  created_at: string;
}

/* ============================= Integrations ============================= */

export type IntegrationProvider = "BITRIX24" | "ONE_C" | "JIRA" | "TELEGRAM";
export type IntegrationStatus = "ACTIVE" | "ERROR" | "DISABLED";

export interface Integration {
  id: number;
  organization_id: number;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCredentials {
  base_url?: string | null;
  has_access_token?: boolean;
  has_refresh_token?: boolean;
  has_username?: boolean;
  has_password?: boolean;
  expires_at?: string | null;
  extra?: Record<string, unknown>;
  access_token?: string | null;
  refresh_token?: string | null;
  username?: string | null;
  password?: string | null;
}

export interface IntegrationSetting {
  id: number;
  integration_id: number;
  key: string;
  value: string;
}

export interface IntegrationDetail extends Integration {
  credentials?: IntegrationCredentials;
  settings?: IntegrationSetting[];
}

export interface IntegrationLog {
  id: number;
  integration_id: number;
  operation: string;
  status: "SUCCESS" | "ERROR" | string;
  message: string | null;
  error: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  BITRIX24: "Битрикс24",
  ONE_C: "1С",
  JIRA: "Jira",
  TELEGRAM: "Telegram",
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  ACTIVE: "Активна",
  ERROR: "Ошибка",
  DISABLED: "Отключена",
};

export const integrationApi = {
  list: (orgId: number) => apiFetch<Integration[]>(`/organizations/${orgId}/integrations`),
  get: (orgId: number, integrationId: number) =>
    apiFetch<IntegrationDetail>(`/organizations/${orgId}/integrations/${integrationId}`),
  create: (
    orgId: number,
    body: {
      provider: IntegrationProvider;
      name: string;
      status?: IntegrationStatus;
      credentials?: Partial<IntegrationCredentials>;
      settings?: Record<string, string>;
    },
  ) =>
    apiFetch<IntegrationDetail>(`/organizations/${orgId}/integrations`, { method: "POST", body }),
  update: (
    orgId: number,
    integrationId: number,
    body: {
      name?: string;
      status?: IntegrationStatus;
      credentials?: Partial<IntegrationCredentials>;
      settings?: Record<string, string>;
    },
  ) =>
    apiFetch<IntegrationDetail>(`/organizations/${orgId}/integrations/${integrationId}`, {
      method: "PATCH",
      body,
    }),
  delete: (orgId: number, integrationId: number) =>
    apiFetch<{ success: boolean }>(`/organizations/${orgId}/integrations/${integrationId}`, {
      method: "DELETE",
    }),
  logs: (orgId: number, integrationId: number, limit = 50) =>
    apiFetch<IntegrationLog[]>(
      `/organizations/${orgId}/integrations/${integrationId}/logs?limit=${limit}`,
    ),
};

/* ======================================================================== */

/* ============================= AI Tasks ============================= */
export interface AiTaskPreview {
  ai_action_id: number;
  title: string;
  description: string;
  acceptance_criteria: string;
  priority: string;
  category: string;
  suggested_deadline: string | null;
  input_text: string;
  ai_model: string | null;
}

export const aiApi = {
  generateTask: (organizationId: number, rawText: string) =>
    apiFetch<AiTaskPreview>(`/organizations/${organizationId}/ai/generate-task`, {
      method: "POST",
      body: { rawText },
    }),
};
/* ==================================================================== */

export const platform = {
  /** Все орги (для суперадмина) */
  tenants: () => apiFetch<Tenant[]>("/organizations"),
  /** Только орги текущего пользователя + его роли */
  tenantsMine: () => apiFetch<TenantWithRoles[]>("/organizations/mine"),
  tenant: (id: number) => apiFetch<Tenant>(`/organizations/${id}`),
  createTenant: (body: { name: string; slug?: string }) =>
    apiFetch<Tenant>("/organizations", { method: "POST", body }),

  /** Шаблоны ботов (общий каталог) */
  botTemplates: () => apiFetch<BotTemplate[]>("/organizations/bot-templates"),

  /** Доступные к подключению боты (шаблоны, которых ещё нет в организации). */
  availableBots: (organizationId: number) =>
    apiFetch<AvailableBotTemplate[]>(`/organizations/${organizationId}/bots/available`),

  /** Уже подключённые (живые) боты организации. */
  bots: (organizationId: number) => apiFetch<Bot[]>(`/organizations/${organizationId}/bots`),
  /** Карточка бота с версиями */
  botDetail: (organizationId: number, botId: number) =>
    apiFetch<BotDetail>(`/organizations/${organizationId}/bots/${botId}`),
  createBot: (
    organizationId: number,
    body: { templateCode?: string; code?: string; name?: string; description?: string },
  ) => apiFetch<Bot>(`/organizations/${organizationId}/bots`, { method: "POST", body }),

  members: (organizationId: number) =>
    apiFetch<Member[]>(`/organizations/${organizationId}/members`),
  addMember: (organizationId: number, body: { userId: number; role: MemberRole }) =>
    apiFetch<Member>(`/organizations/${organizationId}/members`, { method: "POST", body }),
  removeMember: (organizationId: number, membershipId: number) =>
    apiFetch<unknown>(`/organizations/${organizationId}/members/${membershipId}`, {
      method: "DELETE",
    }),
  /** Обновление роли: PATCH, с фоллбэком «удалить + добавить заново». */
  updateMemberRole: async (
    organizationId: number,
    member: { id: number; user_id: number },
    role: MemberRole,
  ) => {
    try {
      return await apiFetch<Member>(`/organizations/${organizationId}/members/${member.id}`, {
        method: "PATCH",
        body: { role },
      });
    } catch {
      await apiFetch<unknown>(`/organizations/${organizationId}/members/${member.id}`, {
        method: "DELETE",
      });
      return apiFetch<Member>(`/organizations/${organizationId}/members`, {
        method: "POST",
        body: { userId: member.user_id, role },
      });
    }
  },

  /** Справочник ролей организации */
  roles: () => apiFetch<RoleInfo[]>("/organizations/roles"),

  versions: (organizationId: number, botId: number) =>
    apiFetch<BotVersion[]>(`/organizations/${organizationId}/bots/${botId}/versions`),
  /** Создать новую версию (статус draft, version назначает backend) */
  createVersion: (
    organizationId: number,
    botId: number,
    body: { changelog?: string; spec?: unknown; riskClass?: string },
  ) =>
    apiFetch<BotVersion>(`/organizations/${organizationId}/bots/${botId}/versions`, {
      method: "POST",
      body,
    }),
  publishVersion: (organizationId: number, botId: number, versionId: number) =>
    apiFetch<BotVersion>(
      `/organizations/${organizationId}/bots/${botId}/versions/${versionId}/publish`,
      {
        method: "POST",
        body: {},
      },
    ),

  /** Список заявок на изменения / создание. */
  changeRequests: (params: {
    organizationId?: number;
    botId?: number;
    status?: CrStatus;
    type?: CrType;
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return apiFetch<ChangeRequest[]>(`/change-requests${qs ? `?${qs}` : ""}`);
  },
  changeRequest: (id: number) => apiFetch<ChangeRequest>(`/change-requests/${id}`),
  createChangeRequest: (body: {
    organizationId: number;
    botId?: number | null;
    type: CrType;
    title: string;
    description?: string;
    payload?: unknown;
    riskClass?: RiskClass;
    submit?: boolean;
  }) => apiFetch<ChangeRequest>("/change-requests", { method: "POST", body }),
  setChangeRequestStatus: (id: number, status: CrStatus) =>
    apiFetch<ChangeRequest>(`/change-requests/${id}/status`, { method: "PATCH", body: { status } }),

  audit: (params: {
    organizationId?: number;
    actorId?: number;
    action?: string;
    entityType?: string;
    entityId?: string | number;
    from?: string;
    to?: string;
    q?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== "") q.set(k, String(v));
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
  bot_create: "Создание бота",
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

export { setStoredOrg as setStoredTenant } from "./org";

export function useTenants() {
  return useQuery({ queryKey: ["tenants"], queryFn: () => platform.tenants(), retry: false });
}

/** Организации текущего пользователя (новый контур /organizations/mine). */
export function useTenantsMine() {
  return useMyOrgs();
}

/**
 * Текущая организация + права.
 * Источник — GET /organizations/mine (роль и permissions пользователя).
 */
export function useCurrentTenant() {
  const { org, orgs, permissions, can, isPlatformAdmin, hasNoOrg, isLoading, isError, query } =
    useCurrentOrg();

  return {
    tenant: org,
    tenants: orgs,
    permissions,
    can,
    isPlatformAdmin,
    currentRoles: org?.role_name ? [org.role_name] : [],
    canManage: can("organization.update") || can("bot.create") || can("task.create"),
    canManageMembers: can("employee.create") || can("employee.update"),
    canCreateTenant: isPlatformAdmin,
    hasNoTenant: hasNoOrg && !isPlatformAdmin,
    isLoading,
    isError,
    query,
  };
}

/** Справочник ролей с фоллбэком на локальные подписи. */
export function useRoles() {
  return useQuery({
    queryKey: ["tenant-roles"],
    retry: false,
    staleTime: 10 * 60_000,
    queryFn: () =>
      platform.roles().catch(() =>
        (Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((code) => ({
          code,
          name: MEMBER_ROLE_LABELS[code],
        })),
      ),
  });
}

export function roleLabel(role: string, roles?: RoleInfo[]) {
  const found = roles?.find((r) => r.code === role);
  return found?.name ?? found?.title ?? MEMBER_ROLE_LABELS[role as MemberRole] ?? role;
}
