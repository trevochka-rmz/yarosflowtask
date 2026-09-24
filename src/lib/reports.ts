import { API_BASE_URL, apiFetch, type TaskStatus } from "./api";
import { authHeaders, clearToken } from "./auth";
import type { EmployeeDailyReport, OrgMember } from "./org";

export type ReportType = "all" | "commits" | "tasks" | "video";
export type ReportFilters = {
  from: string;
  to: string;
  departmentId?: number;
  memberId?: number;
  search?: string;
};

export type ReportTask = {
  id: number;
  title: string;
  status: TaskStatus | string;
  source?: "internal" | "jira" | null;
  updated_at?: string;
  created_at?: string;
  jira_key?: string | null;
  jira_url?: string | null;
  priority?: string | null;
};
export type ReportCommit = {
  hash?: string;
  message: string;
  repository?: string;
  branch?: string;
  date?: string;
  url?: string;
  /** Полный текст дневного отчета 1С, когда сервис не отдает отдельные commit objects. */
  report_text?: string;
  employee_name?: string;
};
export type ReportVideo = {
  id?: number;
  date: string;
  duration?: string;
  createdAt?: string;
  url?: string;
  summary?: { completed?: string; problems?: string; plans?: string };
};
export type UploadedVideoReport = {
  id: number;
  report_date: string;
  video_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export const MAX_VIDEO_REPORT_SIZE = 200 * 1024 * 1024;
export type EmployeeActivity = {
  id: string;
  kind: Exclude<ReportType, "all">;
  date: string;
  title: string;
  detail?: string;
  url?: string;
};
export type EmployeeReport = {
  member: OrgMember;
  tasks: ReportTask[];
  commits: ReportCommit[];
  videos: ReportVideo[];
  activities: EmployeeActivity[];
  activeDays: number;
  lastActivity?: string;
  reportDelivery?: {
    sent_at: string;
    sent_by_user_id: number;
    video_report_id?: number | null;
  } | null;
  reportDeliveryPending?: boolean;
};

type ApiEmployee = Pick<
  OrgMember,
  | "id"
  | "user_id"
  | "department_id"
  | "full_name"
  | "avatar_url"
  | "department_name"
  | "role_name"
  | "gitlab_username"
  | "jira_username"
> & {
  commits: number;
  tasks: number;
  completed_tasks: number;
  video_reports: number;
  video_report_eligible?: boolean;
  active_days: number;
  last_activity?: string | null;
};
type ApiEmployeeDetail = {
  employee: ApiEmployee;
  tasks: ReportTask[];
  commits: ReportCommit[];
  video_reports: Array<{
    id: number;
    report_date: string;
    created_at?: string;
    video_url?: string | null;
    analysis?: unknown;
  }>;
  activities: Array<{
    type: "task" | "commit" | "video";
    date: string;
    title: string;
    task?: ReportTask;
    commit?: ReportCommit;
    video?: { video_url?: string | null };
  }>;
  report_delivery?: {
    sent_at: string;
    sent_by_user_id: number;
    video_report_id?: number | null;
  } | null;
};

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function readTasks(value: EmployeeDailyReport["task_items"]): ReportTask[] {
  return list(value)
    .map((item) => {
      const row = object(item) ?? {};
      return {
        id: Number(row.id),
        title: String(row.title ?? "Задача без названия"),
        status: String(row.status ?? "BACKLOG"),
        source: row.source === "jira" ? "jira" : "internal",
        updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
      };
    })
    .filter((task) => Number.isFinite(task.id));
}
/** 1С returns a free-form report today. Count only explicitly structured commits; text remains visible in activity. */
export function readCommits(value: unknown, reportDate: string): ReportCommit[] {
  const root = object(value);
  const candidates = Array.isArray(value)
    ? value
    : root
      ? (root.commits ?? root.items ?? root.Коммиты)
      : [];
  return list(candidates).map((item) => {
    const row = object(item);
    if (!row) return { message: String(item), date: reportDate };
    return {
      hash:
        typeof row.hash === "string" ? row.hash : typeof row.id === "string" ? row.id : undefined,
      message: String(row.message ?? row.title ?? row.text ?? "Коммит"),
      repository: typeof row.repository === "string" ? row.repository : undefined,
      branch: typeof row.branch === "string" ? row.branch : undefined,
      date: typeof row.date === "string" ? row.date : reportDate,
      url: typeof row.url === "string" ? row.url : undefined,
    };
  });
}
export function readVideos(value: unknown, reportDate: string): ReportVideo[] {
  if (!value) return [];
  const row = object(value);
  if (!row) return [{ date: reportDate }];
  const summary = object(row.analysis ?? row.summary);
  return [
    {
      date: reportDate,
      duration: typeof row.duration === "string" ? row.duration : undefined,
      createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
      url: typeof row.url === "string" ? row.url : undefined,
      summary: summary
        ? {
            completed: typeof summary.completed === "string" ? summary.completed : undefined,
            problems: typeof summary.problems === "string" ? summary.problems : undefined,
            plans: typeof summary.plans === "string" ? summary.plans : undefined,
          }
        : undefined,
    },
  ];
}
function dateKey(value: string) {
  return value.slice(0, 10);
}
function textCommitActivity(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().split("\n").find(Boolean)?.slice(0, 120)
    : undefined;
}

export const reportsService = {
  async getOverview(orgId: number, filters: ReportFilters): Promise<EmployeeReport[]> {
    const params = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.departmentId) params.set("departmentId", String(filters.departmentId));
    if (filters.memberId) params.set("memberId", String(filters.memberId));
    const employees = await apiFetch<ApiEmployee[]>(
      `/organizations/${orgId}/reports/employees?${params}`,
    );
    const selected = employees.filter(
      (employee) =>
        !filters.search ||
        `${employee.full_name ?? ""}`.toLowerCase().includes(filters.search.toLowerCase()),
    );
    // Список должен открываться без десятков запросов к внешнему 1С-сервису.
    // Полный текст 1С загружается только для открытой карточки сотрудника.
    return selected.map((employee) => ({
      member: memberFromApi(employee),
      tasks: Array.from({ length: employee.tasks }, (_, index) => ({
        id: -index - 1,
        title: "",
        status: "BACKLOG",
      })),
      commits: Array.from({ length: employee.commits }, () => ({ message: "" })),
      videos: Array.from({ length: employee.video_reports }, () => ({ date: filters.to })),
      activities: [],
      activeDays: employee.active_days,
      lastActivity: employee.last_activity ?? undefined,
    }));
  },
  async getEmployee(orgId: number, employeeId: number, filters: ReportFilters) {
    const params = new URLSearchParams({ from: filters.from, to: filters.to });
    const data = await apiFetch<ApiEmployeeDetail>(
      `/organizations/${orgId}/reports/employees/${employeeId}?${params}`,
    );
    return normalizeEmployeeReport(data);
  },
  async uploadVideo(
    orgId: number,
    employeeId: number,
    reportDate: string,
    video: File,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ) {
    if (video.size > MAX_VIDEO_REPORT_SIZE) {
      throw new Error("Размер видеоотчёта не должен превышать 200 МБ");
    }
    const body = new FormData();
    body.set("reportDate", reportDate);
    body.set("video", video);
    return new Promise<UploadedVideoReport>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Загрузка видео была отменена."));
        return;
      }
      const request = new XMLHttpRequest();
      const abortUpload = () => request.abort();
      const removeAbortListener = () => signal?.removeEventListener("abort", abortUpload);
      request.open(
        "POST",
        `${API_BASE_URL}/organizations/${orgId}/reports/employees/${employeeId}/video-reports`,
      );
      Object.entries(authHeaders()).forEach(([name, value]) =>
        request.setRequestHeader(name, value),
      );
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () => {
        removeAbortListener();
        reject(new Error("Не удалось загрузить видео. Проверьте соединение с сервером."));
      };
      request.onabort = () => {
        removeAbortListener();
        reject(new Error("Загрузка видео была отменена."));
      };
      request.onload = () => {
        removeAbortListener();
        const payload = (() => {
          try {
            return JSON.parse(request.responseText) as {
              success?: boolean;
              message?: string;
              data?: UploadedVideoReport;
            };
          } catch {
            return null;
          }
        })();
        if (
          !request.status ||
          request.status >= 400 ||
          payload?.success === false ||
          !payload?.data
        ) {
          if (request.status === 401) clearToken();
          if (request.status === 413) {
            reject(
              new Error(
                "Сервер временно не принимает видео такого размера. Попробуйте позже или обратитесь к администратору.",
              ),
            );
            return;
          }
          reject(new Error(payload?.message || "Не удалось загрузить видеоотчёт"));
          return;
        }
        resolve(payload.data);
      };
      signal?.addEventListener("abort", abortUpload, { once: true });
      request.send(body);
    });
  },
  async deleteVideo(orgId: number, employeeId: number, videoReportId: number) {
    return apiFetch<UploadedVideoReport>(
      `/organizations/${orgId}/reports/employees/${employeeId}/video-reports/${videoReportId}`,
      { method: "DELETE" },
    );
  },
  async sendVideo(orgId: number, employeeId: number, videoReportId: number) {
    return apiFetch<{ notification: { sent?: number; skipped?: string; pending?: boolean } }>(
      `/organizations/${orgId}/reports/employees/${employeeId}/video-reports/${videoReportId}/send`,
      { method: "POST" },
    );
  },
  async previewVideo(orgId: number, employeeId: number, videoReportId: number) {
    return apiFetch<{ caption: string; has_video: boolean }>(
      `/organizations/${orgId}/reports/employees/${employeeId}/video-reports/${videoReportId}/preview`,
      { method: "POST" },
    );
  },
  async previewEmployeeReport(orgId: number, employeeId: number, reportDate: string) {
    return apiFetch<{ caption: string; has_video: boolean }>(
      `/organizations/${orgId}/reports/employees/${employeeId}/report-notification/preview`,
      { method: "POST", body: { reportDate } },
    );
  },
  async sendEmployeeReport(orgId: number, employeeId: number, reportDate: string) {
    return apiFetch<{ notification: { sent?: number; skipped?: string; pending?: boolean } }>(
      `/organizations/${orgId}/reports/employees/${employeeId}/report-notification/send`,
      { method: "POST", body: { reportDate } },
    );
  },
  async employeeReportDeliveryStatus(orgId: number, employeeId: number, reportDate: string) {
    return apiFetch<{ pending: boolean }>(
      `/organizations/${orgId}/reports/employees/${employeeId}/report-notification/status?reportDate=${encodeURIComponent(reportDate)}`,
    );
  },
};

function memberFromApi(employee: ApiEmployee): OrgMember {
  return {
    ...employee,
    organization_id: 0,
    role_id: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
    username: null,
    first_name: null,
    last_name: null,
    tg_id: null,
  };
}
function normalizeEmployeeReport(data: ApiEmployeeDetail): EmployeeReport {
  // Запрос после отмены не добавляет ролик локально. Эта защита нужна на случай
  // старых дублей в БД или сетевой гонки: на один отчётный день показываем только
  // первую (API уже сортирует их от новых к старым) активную запись.
  const videoIds = new Set<number>();
  const videoDates = new Set<string>();
  const videos = data.video_reports.flatMap((video) => {
    const date = String(video.report_date).slice(0, 10);
    if (videoIds.has(video.id) || videoDates.has(date)) return [];
    videoIds.add(video.id);
    videoDates.add(date);
    const analysis = object(video.analysis);
    return [
      {
        id: video.id,
        date,
        createdAt: video.created_at,
        url: video.video_url ?? undefined,
        summary: analysis
          ? {
              completed:
                typeof analysis.employee_report === "string"
                  ? analysis.employee_report
                  : typeof analysis.summary === "string"
                    ? analysis.summary
                    : undefined,
              problems: Array.isArray(analysis.blockers) ? analysis.blockers.join("; ") : undefined,
              plans: Array.isArray(analysis.follow_up_questions)
                ? analysis.follow_up_questions.join("; ")
                : undefined,
            }
          : undefined,
      },
    ];
  });
  const activities = data.activities
    .map((activity, index): EmployeeActivity => ({
      id: `${activity.type}-${index}-${activity.date}`,
      kind: activity.type === "task" ? "tasks" : activity.type === "commit" ? "commits" : "video",
      date: activity.date,
      title: activity.title,
      detail: activity.commit?.hash ?? activity.task?.status,
      url: activity.commit?.url ?? activity.video?.video_url ?? undefined,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    member: memberFromApi(data.employee),
    tasks: data.tasks,
    commits: data.commits,
    videos,
    activities,
    activeDays: data.employee.active_days,
    lastActivity: data.employee.last_activity ?? activities[0]?.date,
    reportDelivery: data.report_delivery ?? null,
    reportDeliveryPending: Boolean(data.report_delivery_pending),
  };
}

export function hasCompletedTask(task: ReportTask) {
  return task.status === "DONE";
}
export function activityCount(report: EmployeeReport, type: ReportType) {
  return type === "commits"
    ? report.commits.length
    : type === "tasks"
      ? report.tasks.length
      : type === "video"
        ? report.videos.length
        : report.commits.length + report.tasks.length + report.videos.length;
}
export function activityLabel(type: ReportType) {
  return type === "commits"
    ? "коммитов"
    : type === "tasks"
      ? "задач"
      : type === "video"
        ? "видеоотчетов"
        : "событий";
}
export function isoDate(value: Date) {
  // `toLocaleDateString('en-CA')` в Safari может вернуть M/D/YYYY, тогда
  // быстрые фильтры отправляют backend невалидную дату. Собираем ISO сами.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bishkek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftIsoDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function rangeFor(kind: string) {
  const end = isoDate(new Date());
  if (kind === "this-month") return { from: `${end.slice(0, 7)}-01`, to: end };
  if (kind === "last-month") {
    const previousEnd = shiftIsoDate(`${end.slice(0, 7)}-01`, -1);
    return { from: `${previousEnd.slice(0, 7)}-01`, to: previousEnd };
  }
  if (kind === "today") return { from: end, to: end };
  if (kind === "yesterday") {
    const date = shiftIsoDate(end, -1);
    return { from: date, to: date };
  }
  // В общих отчётах текущий незавершённый день не учитываем: он доступен
  // отдельно через «Сегодня». Неделя начинается в понедельник, месяц — с 1-го.
  const yesterday = shiftIsoDate(end, -1);
  if (kind === "7") {
    const [year, month, day] = end.split("-").map(Number);
    const mondayOffset = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
    const monday = shiftIsoDate(end, -mondayOffset);
    // В понедельник в текущей неделе ещё нет завершённых дней; показываем
    // предыдущий день, чтобы не отправлять в API некорректный пустой диапазон.
    return monday <= yesterday
      ? { from: monday, to: yesterday }
      : { from: yesterday, to: yesterday };
  }
  if (kind === "30") {
    const monthStart = `${end.slice(0, 7)}-01`;
    // Аналогично: в первый день месяца доступен последний завершённый день.
    return monthStart <= yesterday
      ? { from: monthStart, to: yesterday }
      : { from: yesterday, to: yesterday };
  }
  const days = Number(kind);
  return { from: shiftIsoDate(end, -Math.max(0, days - 1)), to: end };
}
