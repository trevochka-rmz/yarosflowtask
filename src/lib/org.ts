import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

/* ---------------------------------- типы --------------------------------- */

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

/** Организация текущего пользователя + его роль и права. */
export interface MyOrganization extends Organization {
  membership_id: number;
  role_id: number;
  role_name: string;
  department_id: number | null;
  permissions: string[];
}

export type AvailabilityStatus =
  "AVAILABLE" | "BUSY" | "AWAY" | "VACATION" | "SICK_LEAVE" | "OFFLINE";

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Доступен",
  BUSY: "Занят",
  AWAY: "Отошёл",
  VACATION: "В отпуске",
  SICK_LEAVE: "На больничном",
  OFFLINE: "Не в сети",
};

/** Права на смену статуса: self может только AVAILABLE/BUSY/AWAY */
export const SELF_STATUSES: AvailabilityStatus[] = ["AVAILABLE", "BUSY", "AWAY"];
/** manager / employee.update может все статусы */
export const MANAGER_STATUSES: AvailabilityStatus[] = [
  "AVAILABLE",
  "BUSY",
  "AWAY",
  "VACATION",
  "SICK_LEAVE",
  "OFFLINE",
];

export interface OrgMember {
  id: number;
  user_id: number;
  organization_id: number;
  role_id: number;
  department_id: number | null;
  is_active: boolean;
  availability_status?: AvailabilityStatus | null;
  created_at: string;
  updated_at?: string;
  full_name: string | null;
  username: string | null;
  first_name?: string | null;
  last_name?: string | null;
  tg_id: number | string | null;
  role_name: string | null;
  role_is_system?: boolean;
  department_name: string | null;
}

export interface PermissionInfo {
  id: number;
  code: string;
  name: string;
}

export interface RoleTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface OrgRole {
  id: number;
  organization_id: number;
  template_id: number | null;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

export interface Department {
  id: number;
  organization_id: number;
  code: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DepartmentTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PlatformUser {
  id: number;
  tg_id: number | string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  is_active: boolean;
  is_platform_admin?: boolean;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
}

/* ----------------------------------- API ---------------------------------- */

export const orgApi = {
  mine: () => apiFetch<MyOrganization[]>("/organizations/mine"),
  all: () => apiFetch<Organization[]>("/organizations"),
  create: (body: { name: string; slug?: string; description?: string }) =>
    apiFetch<Organization>("/organizations", { method: "POST", body }),
  update: (id: number, body: { name?: string; description?: string }) =>
    apiFetch<Organization>(`/organizations/${id}`, { method: "PATCH", body }),
  deactivate: (id: number) => apiFetch<Organization>(`/organizations/${id}`, { method: "DELETE" }),

  members: (id: number) => apiFetch<OrgMember[]>(`/organizations/${id}/members`),
  addMember: (id: number, body: { userId: number; roleId: number; departmentId?: number }) =>
    apiFetch<OrgMember>(`/organizations/${id}/members`, { method: "POST", body }),
  updateMember: (
    id: number,
    memberId: number,
    body: { roleId?: number; departmentId?: number | null; is_active?: boolean },
  ) => apiFetch<OrgMember>(`/organizations/${id}/members/${memberId}`, { method: "PATCH", body }),
  removeMember: (id: number, memberId: number) =>
    apiFetch<unknown>(`/organizations/${id}/members/${memberId}`, { method: "DELETE" }),

  permissions: () => apiFetch<PermissionInfo[]>("/organizations/permissions"),
  roleTemplates: () => apiFetch<RoleTemplate[]>("/organizations/role-templates"),
  roles: (id: number) => apiFetch<OrgRole[]>(`/organizations/${id}/roles`),
  createRole: (id: number, body: { name: string; description?: string; permissions: string[] }) =>
    apiFetch<OrgRole>(`/organizations/${id}/roles`, { method: "POST", body }),
  updateRole: (
    id: number,
    roleId: number,
    body: { name?: string; description?: string; permissions?: string[] },
  ) => apiFetch<OrgRole>(`/organizations/${id}/roles/${roleId}`, { method: "PATCH", body }),
  deleteRole: (id: number, roleId: number) =>
    apiFetch<unknown>(`/organizations/${id}/roles/${roleId}`, { method: "DELETE" }),

  departmentTemplates: () => apiFetch<DepartmentTemplate[]>("/organizations/department-templates"),
  departments: (id: number) => apiFetch<Department[]>(`/organizations/${id}/departments`),
  createDepartment: (id: number, body: { name: string; code?: string; description?: string }) =>
    apiFetch<Department>(`/organizations/${id}/departments`, { method: "POST", body }),
  updateDepartment: (
    id: number,
    departmentId: number,
    body: { name?: string; description?: string; is_active?: boolean },
  ) =>
    apiFetch<Department>(`/organizations/${id}/departments/${departmentId}`, {
      method: "PATCH",
      body,
    }),
  deleteDepartment: (id: number, departmentId: number) =>
    apiFetch<unknown>(`/organizations/${id}/departments/${departmentId}`, { method: "DELETE" }),

  usersMe: () => apiFetch<PlatformUser>("/users/me"),
  users: () => apiFetch<PlatformUser[]>("/users"),
  usersWithoutOrganization: () => apiFetch<PlatformUser[]>("/users/without-organization"),

  /** Получить текущий статус сотрудника */
  getMemberStatus: (orgId: number, memberId: number) =>
    apiFetch<{ status: AvailabilityStatus; note?: string | null }>(
      `/organizations/${orgId}/members/${memberId}/status`,
    ),
  /** Обновить статус (self или employee.update) */
  setMemberStatus: (orgId: number, memberId: number, status: AvailabilityStatus, note?: string) =>
    apiFetch<{ status: AvailabilityStatus; note?: string | null }>(
      `/organizations/${orgId}/members/${memberId}/status`,
      { method: "PATCH", body: { status, ...(note ? { note } : {}) } },
    ),

  /** Директорский дашборд */
  dashboard: (orgId: number) => apiFetch<OrgDashboard>(`/organizations/${orgId}/dashboard`),

  /* ---- Bitrix24 ---- */
  bitrixConnect: (
    orgId: number,
    body:
      | { name: string; webhookUrl: string }
      | { name: string; baseUrl: string; accessToken: string; refreshToken?: string },
  ) =>
    apiFetch<BitrixConnectResponse>(`/organizations/${orgId}/integrations/bitrix/connect`, {
      method: "POST",
      body,
    }),
  bitrixTest: (orgId: number, integrationId: number) =>
    apiFetch<BitrixTestResult>(
      `/organizations/${orgId}/integrations/${integrationId}/bitrix/test`,
      { method: "POST", body: {} },
    ),
  bitrixDeals: (orgId: number, integrationId: number) =>
    apiFetch<BitrixDealsResult>(
      `/organizations/${orgId}/integrations/${integrationId}/bitrix/deals`,
    ),
  bitrixDealsOverdue: (orgId: number, integrationId: number) =>
    apiFetch<BitrixDealsResult>(
      `/organizations/${orgId}/integrations/${integrationId}/bitrix/deals/overdue`,
    ),
  bitrixCall: (
    orgId: number,
    integrationId: number,
    method: string,
    params?: Record<string, unknown>,
  ) =>
    apiFetch<unknown>(`/organizations/${orgId}/integrations/${integrationId}/bitrix/call`, {
      method: "POST",
      body: { method, params: params ?? {} },
    }),

  /* ---- Chat ---- */
  chats: (orgId: number) => apiFetch<OrgChat[]>(`/organizations/${orgId}/chats`),
  openOrgChat: (orgId: number) =>
    apiFetch<OrgChat>(`/organizations/${orgId}/chats/org`, { method: "POST", body: {} }),
  openBotChat: (orgId: number, botId: number) =>
    apiFetch<OrgChat>(`/organizations/${orgId}/bots/${botId}/chat`, { method: "POST", body: {} }),
  chatMessages: (orgId: number, chatId: number, limit = 50) =>
    apiFetch<ChatMessage[]>(`/organizations/${orgId}/chats/${chatId}/messages?limit=${limit}`),
  sendMessage: (orgId: number, chatId: number, body: string) =>
    apiFetch<SendMessageResponse>(`/organizations/${orgId}/chats/${chatId}/messages`, {
      method: "POST",
      body: { body },
    }),
  acceptProposal: (orgId: number, proposalId: number) =>
    apiFetch<AcceptProposalResponse>(`/organizations/${orgId}/proposals/${proposalId}/accept`, {
      method: "POST",
      body: {},
    }),
  rejectProposal: (orgId: number, proposalId: number) =>
    apiFetch<{ success: boolean }>(`/organizations/${orgId}/proposals/${proposalId}/reject`, {
      method: "POST",
      body: {},
    }),
  automations: (orgId: number) => apiFetch<Automation[]>(`/organizations/${orgId}/automations`),
  updateAutomation: (orgId: number, id: number, status: AutomationStatus) =>
    apiFetch<Automation>(`/organizations/${orgId}/automations/${id}`, {
      method: "PATCH",
      body: { status },
    }),
};

/* ----------------------------- Chat types ----------------------------- */

export interface OrgChat {
  id: number;
  organization_id: number;
  type: "org" | "bot";
  bot_id: number | null;
  title: string;
  bot_name: string | null;
  bot_code: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  chat_id: number;
  author_id: number | null;
  role: "user" | "assistant" | "system";
  body: string;
  meta: {
    proposal_id?: number;
    actions?: string[];
    automation_id?: number;
    task_id?: number;
    bot_code?: string;
    ai_action_id?: number;
  };
  author_name: string | null;
  created_at: string;
}

export interface TaskPreview {
  title: string;
  description?: string | null;
  acceptance_criteria?: string | null;
  priority: string;
  deadline?: string | null;
}

export interface ChatProposalParsed {
  action?: string;
  source?: string;
  schedule?: { kind: string; time: string | null; tz?: string };
  result?: string;
  recipient?: string;
  output_mode?: string;
  ai_action_id?: number;
  task_preview?: TaskPreview;
}

export interface ChatProposal {
  id: number;
  chat_id?: number;
  status: "pending" | "accepted" | "rejected";
  intent: string | null;
  suggested_bot_code: string | null;
  suggested_bot_id: number | null;
  suggested_integration_provider: string | null;
  parsed: ChatProposalParsed;
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage | null;
  proposal: ChatProposal | null;
}

export interface AcceptedTask {
  id: number;
  organization_id: number;
  title: string;
  description?: string | null;
  acceptance_criteria?: string | null;
  priority: string;
  status: string;
  deadline?: string | null;
  bot_id?: number | null;
  ai_action_id?: number | null;
  assignees: unknown[];
}

export interface AcceptProposalResponse {
  task: AcceptedTask | null;
  automation: Automation | null;
  execution?: { kind: string; summary: string } | null;
  message: ChatMessage;
  proposal_id: number;
}

export type AutomationStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface Automation {
  id: number;
  organization_id: number;
  bot_id: number | null;
  title: string;
  instruction: string | null;
  schedule: Record<string, unknown> | null;
  schedule_cron: string | null;
  status: AutomationStatus;
  bot_name: string | null;
  bot_code: string | null;
  result_task_id?: number | null;
  result_task_title?: string | null;
  result_task_status?: string | null;
  created_at: string;
}

/* ----------------------------- Dashboard types ----------------------------- */

export interface DashboardCounters {
  total: number;
  new: number;
  in_progress: number;
  waiting: number;
  overdue: number;
  unassigned: number;
  completed: number;
  by_status: Record<string, number>;
}

export interface DashboardTask {
  id: number;
  title: string;
  priority: string;
  status: string;
  deadline?: string | null;
  assignees?: { id: number; full_name?: string | null; username?: string | null }[];
  assignee_count?: number;
}

export interface DashboardActivity {
  task_id: number;
  task_title: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  actor_name: string | null;
}

export interface DashboardEmployee {
  user_id: number;
  full_name: string | null;
  username?: string | null;
  availability_status: AvailabilityStatus | null;
  role_name: string | null;
}

/* ----------------------------- Bitrix24 types ----------------------------- */

export interface BitrixIntegration {
  id: number;
  provider: string;
  name: string;
  status: "ACTIVE" | "ERROR" | "DISABLED";
  credentials: {
    auth_type: "webhook" | "oauth";
    base_url: string;
    has_access_token: boolean;
  };
}

export interface BitrixTestResult {
  ok: boolean;
  method: string;
  status: string;
  error?: string;
  result?: unknown;
}

export interface BitrixConnectResponse {
  integration: BitrixIntegration;
  test: BitrixTestResult;
}

export interface BitrixDeal {
  ID: string;
  TITLE: string;
  STAGE_ID: string;
  OPPORTUNITY: string;
  CLOSEDATE: string;
  [key: string]: unknown;
}

export interface BitrixDealsResult {
  ok: boolean;
  deals: BitrixDeal[];
  error?: string;
}

export interface OrgDashboard {
  counters: DashboardCounters;
  overdue_tasks: DashboardTask[];
  unassigned_tasks: DashboardTask[];
  waiting_tasks: DashboardTask[];
  recent_activity: DashboardActivity[];
  employees: DashboardEmployee[];
}

/* --------------------------- выбранная организация ------------------------- */

const ORG_KEY = "yaya.tenant";

function readStoredOrg(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ORG_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function setStoredOrg(id: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORG_KEY, String(id));
  window.dispatchEvent(new Event("yaya:tenant-changed"));
}

/* ---------------------------------- хуки ---------------------------------- */

/** Профиль из /users/me — содержит is_platform_admin. */
export function usePlatformUser() {
  return useQuery({
    queryKey: ["users-me"],
    queryFn: () => orgApi.usersMe(),
    retry: false,
    staleTime: 60_000,
  });
}

export function useIsPlatformAdmin() {
  const q = usePlatformUser();
  return { isPlatformAdmin: q.data?.is_platform_admin === true, isLoading: q.isPending };
}

export function useMyOrgs() {
  return useQuery({
    queryKey: ["orgs-mine"],
    queryFn: () => orgApi.mine(),
    retry: false,
  });
}

/** Текущая организация + права текущего пользователя в ней. */
export function useCurrentOrg() {
  const query = useMyOrgs();
  const admin = usePlatformUser();
  const [stored, setStored] = useState<number | null>(() => readStoredOrg());

  useEffect(() => {
    const sync = () => setStored(readStoredOrg());
    window.addEventListener("yaya:tenant-changed", sync);
    return () => window.removeEventListener("yaya:tenant-changed", sync);
  }, []);

  const orgs = query.data ?? [];
  const org = orgs.find((o) => o.id === stored) ?? orgs[0] ?? null;
  const permissions = org?.permissions ?? [];
  const isPlatformAdmin = admin.data?.is_platform_admin === true;

  /** Проверка права; platform admin видит всё. */
  const can = (perm: string) => isPlatformAdmin || permissions.includes(perm);

  return {
    org,
    orgs,
    permissions,
    can,
    isPlatformAdmin,
    hasNoOrg: !query.isPending && !query.isError && orgs.length === 0,
    isLoading: query.isPending,
    isError: query.isError,
    query,
  };
}

/* --------------------------------- утилиты -------------------------------- */

export const PERMISSION_GROUP_LABELS: Record<string, string> = {
  organization: "Организация",
  employee: "Сотрудники",
  role: "Роли",
  department: "Отделы",
  task: "Задачи",
  bot: "Боты",
  audit: "Журнал",
  integration: "Интеграции",
};

export function permissionGroup(code: string) {
  return code.split(".")[0] ?? "other";
}

export function groupPermissions(list: PermissionInfo[]) {
  const map = new Map<string, PermissionInfo[]>();
  list.forEach((p) => {
    const g = permissionGroup(p.code);
    map.set(g, [...(map.get(g) ?? []), p]);
  });
  return [...map.entries()].map(([group, items]) => ({
    group,
    label: PERMISSION_GROUP_LABELS[group] ?? group,
    items,
  }));
}

export function personLabel(u: {
  full_name?: string | null;
  username?: string | null;
  first_name?: string | null;
  id?: number;
  user_id?: number;
}) {
  return (
    u.full_name?.trim() ||
    (u.username ? `@${u.username}` : "") ||
    u.first_name ||
    `#${u.user_id ?? u.id ?? "?"}`
  );
}
