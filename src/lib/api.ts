export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3000/api";

export type Role = "manager" | "employee";
export type TaskStatus =
  "BACKLOG" | "SELECTED" | "WAITING" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED";
export type Priority = "low" | "medium" | "high" | "critical";

export interface User {
  id: number;
  tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignee {
  id: number | null;
  tg_id?: number | string | null;
  full_name: string | null;
  username: string | null;
  jira_username?: string | null;
  department_name?: string | null;
  assignment_source?: "local" | "jira" | "local+jira" | "jira_external";
  is_external?: boolean;
  role?: Role;
  assigned_at?: string | null;
  assigned_by?: number | null;
}

export interface DepartmentAssignee {
  id: number;
  name: string;
  code: string | null;
  assigned_at: string;
  assigned_by: number;
}

export interface Task {
  id: number;
  organization_id?: number;
  author_id: number;
  raw_text: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  priority: Priority;
  status: TaskStatus;
  category: string | null;
  deadline: string | null;
  result?: string | null;
  department_id?: number | null;
  bot_id?: number | null;
  ai_suggested_deadline: string | null;
  ai_model?: string | null;
  created_at: string;
  updated_at: string;
  assignees?: Assignee[];
  assignee_count?: number;
  department_assignees?: DepartmentAssignee[];
  is_jira?: boolean;
  jira_key?: string | null;
  jira_url?: string | null;
  jira_status?: string | null;
  jira_project_key?: string | null;
  jira_project_name?: string | null;
  jira_assignee?: string | null;
  jira_assignee_key?: string | null;
  jira_reporter?: string | null;
  jira_issuetype?: string | null;
  jira_created_at?: string | null;
  jira_updated_at?: string | null;
  /**
   * Источник задачи:
   * - internal — создана внутри платформы
   * - jira — подтянута из Jira (или связана с Jira по external_key)
   */
  source?: string | null;
  /** Ключ задачи во внешней системе, например DEV-15 для Jira. */
  external_key?: string | null;
  /** URL на карточку задачи во внешней системе (Jira и т.п.). */
  external_url?: string | null;
  /** Статус во внешней системе (например, In Progress в Jira). */
  external_status?: string | null;
  /** Отображаемое имя исполнителя во внешней системе (Jira). */
  external_assignee_name?: string | null;
  /** Внутренний ключ/ID исполнителя во внешней системе (служебное поле). */
  external_assignee_key?: string | null;
  /** Отображаемое имя автора (reporter) во внешней системе. */
  external_reporter_name?: string | null;
  /** Ключ проекта во внешней системе (например, YPS). */
  external_project_key?: string | null;
  /** Название проекта во внешней системе. */
  external_project_name?: string | null;
  /** Тип задачи во внешней системе (Задача / Ошибка и т.п.). */
  external_issuetype?: string | null;
  /** ID интеграции, через которую синхронизирована задача. */
  integration_id?: number | null;
  /** Время последней успешной синхронизации с внешней системой. */
  last_synced_at?: string | null;
  /** Сырая нагрузка из внешней системы (например, весь объект Jira issue). */
  external_payload?: Record<string, unknown> | null;
}

export type BoardColumnKey = TaskStatus;

export interface BoardTask {
  id: number;
  source?: string | null;
  title: string;
  status: TaskStatus;
  board_column: BoardColumnKey;
  status_label?: string | null;
  priority?: Priority | null;
  project_key?: string | null;
  project_name?: string | null;
  external_key?: string | null;
  external_url?: string | null;
  external_status?: string | null;
  assignees?: Array<{ id: number; full_name: string | null; username: string | null }>;
  assignee_label?: string | null;
  external_assignee_name?: string | null;
}

export interface TasksBoard {
  columnOrder: BoardColumnKey[];
  columnsMeta: Array<{ key: BoardColumnKey; label: string; statuses: TaskStatus[] }>;
  counts: Record<BoardColumnKey, number>;
  total: number;
  columns: Record<BoardColumnKey, BoardTask[]>;
}

export interface TaskProject {
  project_key: string;
  project_name: string;
  task_count: number;
}

export interface Comment {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
  author_name?: string | null;
  author_username?: string | null;
}

export interface HistoryEntry {
  id: number;
  task_id: number;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: number | null;
  changed_by_name?: string | null;
}

import { authHeaders, clearToken, setToken, type TelegramWidgetUser } from "./auth";

export { authHeaders };

export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; skipAuth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!init?.skipAuth) Object.assign(headers, authHeaders());

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: init?.method ?? "GET",
      headers,
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new Error(
      `Не удалось связаться с сервером (${API_BASE_URL}). Проверьте, что backend запущен.`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    clearToken();
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  const body = payload as { success?: boolean; message?: string; data?: T } | null;

  if (!res.ok || body?.success === false) {
    throw new Error(body?.message ?? `Ошибка запроса (${res.status})`);
  }
  return (body?.data ?? (payload as T)) as T;
}

/** Вход через виджет Telegram на обычном сайте. */
export async function telegramLogin(widgetUser: TelegramWidgetUser) {
  const data = await apiFetch<{ user: User; token: string }>("/auth/telegram-login", {
    method: "POST",
    body: widgetUser,
    skipAuth: true,
  });
  if (data?.token) setToken(data.token);
  return data;
}

export interface Attachment {
  id: number;
  task_id: number;
  comment_id: number | null;
  uploaded_by: number;
  tg_file_id: string | null;
  file_type: string;
  file_name: string;
  storage_path?: string;
  mime_type: string | null;
  file_size: number | null;
  url: string;
  created_at?: string;
}

export type ExportFormat = "md" | "docx" | "pdf" | "zip";

/** Базовый origin backend без /api — для ссылок на /uploads/... */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function fileUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  md: "Markdown (.md)",
  docx: "Word (.docx)",
  pdf: "PDF (кириллица)",
  zip: "ZIP (все файлы)",
};

const EXPORT_EXT: Record<ExportFormat, string> = {
  md: "md",
  docx: "docx",
  pdf: "pdf",
  zip: "zip",
};

export async function exportTask(id: number, format: ExportFormat) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/tasks/${id}/export/${format}`, { headers: authHeaders() });
  } catch {
    throw new Error(`Не удалось связаться с сервером (${API_BASE_URL}).`);
  }
  if (!res.ok) {
    let message = `Ошибка экспорта (${res.status})`;
    try {
      const body = (await res.clone().json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* not json */
    }
    throw new Error(message);
  }
  const blob = await res.blob();

  function pickDownloadName(disposition: string, fallback: string): string {
    const star = /filename\*=(?:UTF-8''|utf-8'')\s*([^;\s]+)/i.exec(disposition);
    if (star?.[1]) {
      try {
        return decodeURIComponent(star[1].replace(/^["']|["']$/g, "").trim());
      } catch {
        /* ignore */
      }
    }
    const quoted = /filename="([^"]+)"/i.exec(disposition);
    if (quoted?.[1]) return quoted[1];
    const plain = /(?:^|;)\s*filename=([^;]+)/i.exec(disposition);
    if (plain?.[1]) return plain[1].replace(/^["']|["']$/g, "").trim();
    return fallback;
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const name = pickDownloadName(disposition, `task-${id}.${EXPORT_EXT[format]}`);

  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

async function uploadFiles(taskId: number, uploadedBy: number, files: File[]) {
  const form = new FormData();
  form.append("taskId", String(taskId));
  form.append("uploadedBy", String(uploadedBy));
  files.forEach((f) => form.append("files", f));

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/attachments/task/upload`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
  } catch {
    throw new Error(`Не удалось связаться с сервером (${API_BASE_URL}).`);
  }
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: Attachment[];
  } | null;
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message ?? `Не удалось загрузить файлы (${res.status})`);
  }
  return payload?.data ?? [];
}

export const api = {
  me: () => apiFetch<{ user: User }>("/auth/me"),
  employees: (organizationId: number) =>
    apiFetch<User[]>(`/users/employees?organizationId=${organizationId}`),
  users: (organizationId?: number) =>
    apiFetch<User[]>(`/users${organizationId ? `?organizationId=${organizationId}` : ""}`),

  /** Список задач организации с фильтрами. */
  tasks: (organizationId: number, query = "") => {
    const sep = query.startsWith("?") ? "&" : "?";
    return apiFetch<Task[]>(
      `/tasks?organizationId=${organizationId}${query ? sep + query.replace(/^\?/, "") : ""}`,
    );
  },

  /** Канбан-доска задач. Статусы сервер сам группирует по четырём колонкам. */
  tasksBoard: (organizationId: number, query = "") => {
    const sep = query.startsWith("?") ? "&" : "?";
    return apiFetch<TasksBoard>(
      `/tasks/board?organizationId=${organizationId}${query ? sep + query.replace(/^\?/, "") : ""}`,
    );
  },

  /** Jira-проекты, которые встречаются в задачах организации. */
  taskProjects: (organizationId: number) =>
    apiFetch<TaskProject[]>(`/tasks/projects?organizationId=${organizationId}`),

  /** Задачи, созданные конкретным автором в организации. */
  tasksByAuthor: (authorId: number, organizationId: number, query = "") => {
    return apiFetch<Task[]>(
      `/tasks?organizationId=${organizationId}&authorId=${authorId}${
        query ? "&" + query.replace(/^\?/, "") : ""
      }`,
    );
  },

  /** Мои задачи (я исполнитель) в организации. */
  tasksMine: (organizationId: number, query = "") => {
    const sep = query.startsWith("?") ? "&" : "?";
    return apiFetch<Task[]>(
      `/tasks/mine?organizationId=${organizationId}${query ? sep + query.replace(/^\?/, "") : ""}`,
    );
  },

  /** @deprecated: используйте tasksMine */
  tasksAssigned: (id: number, organizationId: number, query = "") =>
    api.tasksMine(organizationId, query),

  task: (id: number, organizationId?: number) =>
    apiFetch<Task>(`/tasks/${id}${organizationId ? `?organizationId=${organizationId}` : ""}`),
  createTask: (authorId: number, rawText: string, tenantId: number, departmentId?: number) =>
    apiFetch<Task>("/tasks", {
      method: "POST",
      body: {
        authorId,
        rawText,
        organizationId: tenantId,
        ...(departmentId ? { departmentId } : {}),
      },
    }),
  createManualTask: (
    organizationId: number,
    body: {
      title: string;
      description?: string;
      acceptanceCriteria?: string;
      priority?: Priority;
      deadline?: string | null;
      pushToJira?: boolean;
      projectKey?: string;
      jiraAssignee?: string | null;
    },
  ) =>
    apiFetch<Task>("/tasks", {
      method: "POST",
      body: { organizationId, ...body },
    }),
  /** Создать задачу из AI-превью (шаг 2 TaskFlow) */
  createTaskFromAi: (organizationId: number, aiActionId: number) =>
    apiFetch<Task>("/tasks", {
      method: "POST",
      body: { organizationId, aiActionId },
    }),
  /** Назначение исполнителей и отделов. userIds — ID пользователей (user_id из members). */
  assign: (id: number, organizationId: number, userIds: number[], departmentIds: number[]) =>
    apiFetch<Task>(`/tasks/${id}/assign?organizationId=${organizationId}`, {
      method: "PATCH",
      body: { userIds, departmentIds },
    }),

  setStatus: (id: number, status: TaskStatus, organizationId: number) =>
    apiFetch<Task>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: { organizationId, status },
    }),

  updateTask: (id: number, organizationId: number, patch: Record<string, unknown>) =>
    apiFetch<Task>(`/tasks/${id}?organizationId=${organizationId}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteTask: (id: number, organizationId: number) =>
    apiFetch<unknown>(`/tasks/${id}?organizationId=${organizationId}`, { method: "DELETE" }),
  comments: (taskId: number) => apiFetch<Comment[]>(`/comments/task/${taskId}`),
  addComment: (taskId: number, authorId: number, body: string) =>
    apiFetch<Comment>("/comments", { method: "POST", body: { taskId, authorId, body } }),
  history: (taskId: number) => apiFetch<HistoryEntry[]>(`/history/task/${taskId}`),
  attachments: (taskId: number) => apiFetch<Attachment[]>(`/attachments/task/${taskId}`),
  uploadAttachments: uploadFiles,
  deleteAttachment: (id: number) => apiFetch<unknown>(`/attachments/${id}`, { method: "DELETE" }),
  exportTask,
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Новые задачи",
  SELECTED: "На утверждении",
  WAITING: "Ожидает исполнения",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Выполнено",
  CANCELLED: "Отменено",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

export function nextStatuses(status: TaskStatus, role: Role): TaskStatus[] {
  if (role === "employee") {
    if (status === "WAITING") return ["IN_PROGRESS"];
    if (status === "IN_PROGRESS") return ["REVIEW", "WAITING"];
    return [];
  }
  // manager
  if (status === "BACKLOG") return ["SELECTED", "CANCELLED"];
  if (status === "SELECTED") return ["WAITING", "CANCELLED"];
  if (status === "WAITING") return ["IN_PROGRESS", "CANCELLED"];
  if (status === "IN_PROGRESS") return ["REVIEW", "WAITING", "CANCELLED"];
  if (status === "REVIEW") return ["DONE", "IN_PROGRESS", "CANCELLED"];
  return [];
}

/** Назначение — не статус: определяем по количеству исполнителей. */
export function assigneeCount(task: Task): number {
  return task.assignees?.length ?? task.assignee_count ?? 0;
}

export function isAssigned(task: Task): boolean {
  return assigneeCount(task) >= 1;
}

export function userLabel(u: {
  full_name?: string | null;
  username?: string | null;
  id?: number | null;
}) {
  return u.full_name || (u.username ? `@${u.username}` : u.id != null ? `#${u.id}` : "Без имени");
}

/** Отображаемое имя: username, иначе имя/фамилия. */
export function userHandle(u: {
  username?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  id: number;
}) {
  if (u.username) return `@${u.username}`;
  return u.first_name || u.full_name || `#${u.id}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
