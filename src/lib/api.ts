export const API_BASE_URL =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? "http://localhost:3000/api";

export type Role = "manager" | "employee";
export type TaskStatus =
  | "draft"
  | "in_progress"
  | "review"
  | "done"
  | "cancelled";
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

const DEV_USER_ID_KEY = "yaros.devUserId";

export function getDevUserId(): string {
  if (typeof window === "undefined") return "1";
  return window.localStorage.getItem(DEV_USER_ID_KEY) ?? "1";
}

export function setDevUserId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEV_USER_ID_KEY, id);
}

function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
  const initData = tg?.WebApp?.initData;
  return initData && initData.length > 0 ? initData : null;
}

export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const initData = getTelegramInitData();
  if (initData) headers["X-Telegram-Init-Data"] = initData;
  else headers["X-Dev-User-Id"] = getDevUserId();

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: init?.method ?? "GET",
      headers,
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new Error(`Не удалось связаться с сервером (${API_BASE_URL}). Проверьте, что backend запущен.`);
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

export const api = {
  me: () => apiFetch<{ user: User }>("/auth/me"),
  employees: () => apiFetch<User[]>("/users/employees"),
  users: () => apiFetch<User[]>("/users"),
  tasks: (query = "") => apiFetch<Task[]>(`/tasks${query}`),
  tasksByAuthor: (id: number, query = "") => apiFetch<Task[]>(`/tasks/author/${id}${query}`),
  tasksAssigned: (id: number, query = "") => apiFetch<Task[]>(`/tasks/assigned/${id}${query}`),
  task: (id: number) => apiFetch<Task>(`/tasks/${id}`),
  createTask: (authorId: number, rawText: string) =>
    apiFetch<Task>("/tasks", { method: "POST", body: { authorId, rawText } }),
  assign: (id: number, userIds: number[], assignedBy: number) =>
    apiFetch<Task>(`/tasks/${id}/assign`, { method: "PATCH", body: { userIds, assignedBy } }),
  setStatus: (id: number, status: TaskStatus, changedBy: number) =>
    apiFetch<Task>(`/tasks/${id}/status`, { method: "PATCH", body: { status, changedBy } }),
  updateTask: (id: number, patch: Record<string, unknown>) =>
    apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: patch }),
  comments: (taskId: number) => apiFetch<Comment[]>(`/comments/task/${taskId}`),
  addComment: (taskId: number, authorId: number, body: string) =>
    apiFetch<Comment>("/comments", { method: "POST", body: { taskId, authorId, body } }),
  history: (taskId: number) => apiFetch<HistoryEntry[]>(`/history/task/${taskId}`),
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Черновик",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнена",
  cancelled: "Отменена",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

export function nextStatuses(status: TaskStatus, role: Role): TaskStatus[] {
  if (role === "employee") {
    if (status === "draft") return ["in_progress"];
    if (status === "in_progress") return ["review"];
    return [];
  }
  if (status === "review") return ["done", "in_progress"];
  if (status === "draft") return ["in_progress", "cancelled"];
  if (status === "in_progress") return ["review", "cancelled"];
  if (status === "done") return ["in_progress"];
  return [];
}

/** Назначение — не статус: определяем по количеству исполнителей. */
export function assigneeCount(task: Task): number {
  return task.assignees?.length ?? 0;
}

export function isAssigned(task: Task): boolean {
  return assigneeCount(task) >= 1;
}

export function userLabel(u: { full_name?: string | null; username?: string | null; id: number }) {
  return u.full_name || (u.username ? `@${u.username}` : `#${u.id}`);
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
