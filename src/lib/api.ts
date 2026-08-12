export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3000/api";

export type Role = "manager" | "employee";
export type TaskStatus =
  | "NEW"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "CLOSED"
  | "OVERDUE"
  | "CANCELLED";
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
  id: number;
  tg_id: number;
  full_name: string | null;
  username: string | null;
  role: Role;
  assigned_at: string;
  assigned_by: number;
}

export interface Task {
  id: number;
  author_id: number;
  raw_text: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  priority: Priority;
  status: TaskStatus;
  category: string | null;
  deadline: string | null;
  ai_suggested_deadline: string | null;
  ai_model?: string | null;
  created_at: string;
  updated_at: string;
  assignees?: Assignee[];
  assignee_count?: number;
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
  employees: (tenantId: number) => apiFetch<User[]>(`/users/employees?tenantId=${tenantId}`),
  users: (tenantId?: number) =>
    apiFetch<User[]>(`/users${tenantId ? `?tenantId=${tenantId}` : ""}`),
  tasks: (tenantId: number, query = "") => {
    const sep = query.startsWith("?") ? "&" : "?";
    return apiFetch<Task[]>(
      `/tasks?tenantId=${tenantId}${query ? sep + query.replace(/^\?/, "") : ""}`,
    );
  },
  tasksByAuthor: (id: number, tenantId: number, query = "") => {
    const sep = query.startsWith("?") ? "&" : "?";
    return apiFetch<Task[]>(
      `/tasks/author/${id}?tenantId=${tenantId}${query ? sep + query.replace(/^\?/, "") : ""}`,
    );
  },
  tasksAssigned: (id: number, tenantId: number, query = "") => {
    const sep = query.startsWith("?") ? "&" : "?";
    return apiFetch<Task[]>(
      `/tasks/assigned/${id}?tenantId=${tenantId}${query ? sep + query.replace(/^\?/, "") : ""}`,
    );
  },
  task: (id: number, tenantId?: number) =>
    apiFetch<Task>(`/tasks/${id}${tenantId ? `?tenantId=${tenantId}` : ""}`),
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
  /** Создать задачу из AI-превью (шаг 2 TaskFlow) */
  createTaskFromAi: (organizationId: number, aiActionId: number) =>
    apiFetch<Task>("/tasks", {
      method: "POST",
      body: { organizationId, aiActionId },
    }),
  assign: (id: number, userIds: number[], assignedBy: number, tenantId: number) =>
    apiFetch<Task>(`/tasks/${id}/assign?tenantId=${tenantId}`, {
      method: "PATCH",
      body: { userIds, assignedBy },
    }),
  setStatus: (id: number, status: TaskStatus, tenantId: number) =>
    apiFetch<Task>(`/tasks/${id}/status?tenantId=${tenantId}`, {
      method: "PATCH",
      body: { status },
    }),
  updateTask: (id: number, tenantId: number, patch: Record<string, unknown>) =>
    apiFetch<Task>(`/tasks/${id}?tenantId=${tenantId}`, { method: "PATCH", body: patch }),
  deleteTask: (id: number, tenantId: number) =>
    apiFetch<unknown>(`/tasks/${id}?tenantId=${tenantId}`, { method: "DELETE" }),
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
  NEW: "Новая",
  ASSIGNED: "Назначена",
  ACCEPTED: "Принята",
  IN_PROGRESS: "В работе",
  WAITING: "Ожидание",
  COMPLETED: "Выполнена",
  CLOSED: "Закрыта",
  OVERDUE: "Просрочена",
  CANCELLED: "Отменена",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

export function nextStatuses(status: TaskStatus, role: Role): TaskStatus[] {
  if (role === "employee") {
    if (status === "ASSIGNED") return ["ACCEPTED"];
    if (status === "ACCEPTED") return ["IN_PROGRESS"];
    if (status === "IN_PROGRESS") return ["WAITING", "COMPLETED"];
    if (status === "WAITING") return ["IN_PROGRESS"];
    return [];
  }
  // manager
  if (status === "NEW") return ["ASSIGNED", "CANCELLED"];
  if (status === "ASSIGNED") return ["ACCEPTED", "CANCELLED"];
  if (status === "ACCEPTED") return ["IN_PROGRESS", "CANCELLED"];
  if (status === "IN_PROGRESS") return ["WAITING", "COMPLETED", "CANCELLED"];
  if (status === "WAITING") return ["IN_PROGRESS", "CANCELLED"];
  if (status === "COMPLETED") return ["CLOSED"];
  if (status === "OVERDUE") return ["IN_PROGRESS", "CANCELLED"];
  return [];
}

/** Назначение — не статус: определяем по количеству исполнителей. */
export function assigneeCount(task: Task): number {
  return task.assignees?.length ?? task.assignee_count ?? 0;
}

export function isAssigned(task: Task): boolean {
  return assigneeCount(task) >= 1;
}

export function userLabel(u: { full_name?: string | null; username?: string | null; id: number }) {
  return u.full_name || (u.username ? `@${u.username}` : `#${u.id}`);
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
