import { apiFetch, type TaskStatus } from "./api";
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
  date: string;
  duration?: string;
  createdAt?: string;
  url?: string;
  summary?: { completed?: string; problems?: string; plans?: string };
};
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
  active_days: number;
  last_activity?: string | null;
};
type ApiEmployeeDetail = {
  employee: ApiEmployee;
  tasks: ReportTask[];
  commits: ReportCommit[];
  video_reports: Array<{
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
    return Promise.all(selected.map((employee) => this.getEmployee(orgId, employee.id, filters)));
  },
  async getEmployee(orgId: number, employeeId: number, filters: ReportFilters) {
    const params = new URLSearchParams({ from: filters.from, to: filters.to });
    const data = await apiFetch<ApiEmployeeDetail>(
      `/organizations/${orgId}/reports/employees/${employeeId}?${params}`,
    );
    return normalizeEmployeeReport(data);
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
  const videos = data.video_reports.map((video) => {
    const analysis = object(video.analysis);
    return {
      date: video.report_date,
      createdAt: video.created_at,
      url: video.video_url ?? undefined,
      summary: analysis
        ? {
            completed: typeof analysis.summary === "string" ? analysis.summary : undefined,
            problems: Array.isArray(analysis.blockers) ? analysis.blockers.join("; ") : undefined,
            plans: Array.isArray(analysis.follow_up_questions)
              ? analysis.follow_up_questions.join("; ")
              : undefined,
          }
        : undefined,
    };
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
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Bishkek" });
}
export function rangeFor(kind: string) {
  const now = new Date();
  const end = isoDate(now);
  const start = new Date(now);
  if (kind === "this-month") return { from: `${end.slice(0, 7)}-01`, to: end };
  if (kind === "last-month") {
    const firstThisMonth = new Date(`${end.slice(0, 7)}-01T12:00:00`);
    firstThisMonth.setDate(0);
    const previousEnd = isoDate(firstThisMonth);
    return { from: `${previousEnd.slice(0, 7)}-01`, to: previousEnd };
  }
  if (kind === "today") return { from: end, to: end };
  if (kind === "yesterday") {
    start.setDate(start.getDate() - 1);
    const date = isoDate(start);
    return { from: date, to: date };
  }
  const days = Number(kind);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  return { from: isoDate(start), to: end };
}
