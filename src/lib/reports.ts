import { orgApi, type EmployeeDailyReport, type OrgMember } from "./org";
import type { TaskStatus } from "./api";

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
    const [members, dailyReports] = await Promise.all([
      orgApi.members(orgId),
      orgApi.employeeReports(orgId, { from: filters.from, to: filters.to }),
    ]);
    const active = members
      .filter((member) => member.is_active)
      .filter((member) => !filters.departmentId || member.department_id === filters.departmentId)
      .filter((member) => !filters.memberId || member.id === filters.memberId)
      .filter(
        (member) =>
          !filters.search ||
          `${member.full_name ?? ""} ${member.username ?? ""}`
            .toLowerCase()
            .includes(filters.search!.toLowerCase()),
      );
    return active.map((member) => {
      const rows = dailyReports.filter((row) => row.member_id === member.id);
      const taskMap = new Map<number, ReportTask>();
      const commitMap = new Map<string, ReportCommit>();
      const videos: ReportVideo[] = [];
      const activities: EmployeeActivity[] = [];
      rows.forEach((row) => {
        readTasks(row.task_items).forEach((task) => {
          taskMap.set(task.id, task);
          activities.push({
            id: `task-${row.report_date}-${task.id}`,
            kind: "tasks",
            date: task.updated_at ?? row.report_date,
            title: task.title,
            detail: String(task.status),
          });
        });
        readCommits(row.commit_report, row.report_date).forEach((commit, index) => {
          const key = commit.hash ?? `${row.report_date}-${index}-${commit.message}`;
          commitMap.set(key, commit);
          activities.push({
            id: `commit-${key}`,
            kind: "commits",
            date: commit.date ?? row.report_date,
            title: commit.message,
            detail: commit.hash,
            url: commit.url,
          });
        });
        if (!readCommits(row.commit_report, row.report_date).length && row.commit_report)
          activities.push({
            id: `commit-report-${row.report_date}`,
            kind: "commits",
            date: row.report_date,
            title: "Получен отчет по коммитам",
            detail: textCommitActivity(row.commit_report),
          });
        readVideos(row.video_report, row.report_date).forEach((video, index) => {
          videos.push(video);
          activities.push({
            id: `video-${row.report_date}-${index}`,
            kind: "video",
            date: video.createdAt ?? row.report_date,
            title: "Видеоотчет",
            url: video.url,
          });
        });
      });
      const activitiesSorted = activities.sort((a, b) => b.date.localeCompare(a.date));
      return {
        member,
        tasks: [...taskMap.values()],
        commits: [...commitMap.values()],
        videos,
        activities: activitiesSorted,
        activeDays: new Set(rows.map((row) => row.report_date)).size,
        lastActivity: activitiesSorted[0]?.date,
      };
    });
  },
  async getEmployee(orgId: number, employeeId: number, filters: ReportFilters) {
    const all = await this.getOverview(orgId, { ...filters, memberId: employeeId });
    return all[0] ?? null;
  },
};

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
