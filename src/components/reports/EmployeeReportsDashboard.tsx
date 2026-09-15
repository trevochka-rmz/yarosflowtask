import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  ChevronRight,
  FileVideo,
  GitCommitHorizontal,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentOrg, orgApi } from "@/lib/org";
import {
  activityCount,
  hasCompletedTask,
  isoDate,
  reportsService,
  type EmployeeReport,
  type ReportFilters,
  type ReportType,
} from "@/lib/reports";
import { formatDate } from "@/lib/api";
import {
  EmployeeLink,
  EmployeeName,
  EmptyReport,
  MetricCard,
  ReportsHeader,
  ReportTypeTabs,
} from "./ReportPrimitives";

const COLORS = { commits: "#3b82f6", tasks: "#8b5cf6", video: "#f59e0b" };
function days(from: string, to: string) {
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor <= end) {
    out.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
function labelDay(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00`),
  );
}

export function EmployeeReportsDashboard() {
  const { org } = useCurrentOrg();
  const today = isoDate(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const [filters, setFilters] = useState<ReportFilters>({ from: isoDate(start), to: today });
  const [type, setType] = useState<ReportType>("all");
  const departments = useQuery({
    queryKey: ["org-departments", org?.id],
    queryFn: () => orgApi.departments(org!.id),
    enabled: !!org?.id,
  });
  const members = useQuery({
    queryKey: ["org-members", org?.id],
    queryFn: () => orgApi.members(org!.id),
    enabled: !!org?.id,
  });
  const overview = useQuery({
    queryKey: ["employee-reports-overview", org?.id, filters],
    queryFn: () => reportsService.getOverview(org!.id, filters),
    enabled: !!org?.id,
  });
  const download = () => {
    const rows = [
      ["Сотрудник", "Коммиты", "Задачи", "Видеоотчеты", "Последняя активность"],
      ...(overview.data ?? []).map((report) => [
        report.member.full_name || report.member.username || "",
        String(report.commits.length),
        String(report.tasks.length),
        String(report.videos.length),
        report.lastActivity ? formatDate(report.lastActivity) : "—",
      ]),
    ];
    const quote = (cell: string) => `"${cell.replaceAll('"', '""')}"`;
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(quote).join(";")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `employee-reports-${filters.from}-${filters.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (!org)
    return (
      <div className="text-sm text-muted-foreground">
        Выберите организацию, чтобы посмотреть отчеты.
      </div>
    );
  return (
    <div className="space-y-6">
      <ReportsHeader
        filters={filters}
        departments={departments.data ?? []}
        members={members.data ?? []}
        onChange={setFilters}
        onDownload={download}
      />
      <ReportTypeTabs type={type} onChange={setType} />
      {overview.isPending ? (
        <DashboardSkeleton />
      ) : overview.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          Не удалось загрузить отчеты: {overview.error.message}
        </div>
      ) : (
        <DashboardContent reports={overview.data ?? []} filters={filters} type={type} />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-31 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

function DashboardContent({
  reports,
  filters,
  type,
}: {
  reports: EmployeeReport[];
  filters: ReportFilters;
  type: ReportType;
}) {
  const summary = {
    employees: reports.length,
    commits: reports.reduce((sum, report) => sum + report.commits.length, 0),
    tasks: reports.reduce((sum, report) => sum + report.tasks.filter(hasCompletedTask).length, 0),
    video: reports.reduce((sum, report) => sum + report.videos.length, 0),
  };
  if (!reports.length) return <EmptyReport />;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {type === "all" ? (
          <>
            <MetricCard label="Сотрудники" value={summary.employees} icon={Users} />
            <MetricCard
              label="Коммиты"
              value={summary.commits}
              icon={GitCommitHorizontal}
              tone="violet"
            />
            <MetricCard
              label="Выполненные задачи"
              value={summary.tasks}
              icon={CheckCircle2}
              tone="primary"
            />
            <MetricCard label="Видеоотчеты" value={summary.video} icon={FileVideo} tone="amber" />
          </>
        ) : (
          <MetricCard
            label={type === "commits" ? "Коммиты" : type === "tasks" ? "Задачи" : "Видеоотчеты"}
            value={
              type === "commits"
                ? summary.commits
                : type === "tasks"
                  ? summary.tasks
                  : summary.video
            }
            icon={
              type === "commits" ? GitCommitHorizontal : type === "tasks" ? CheckCircle2 : FileVideo
            }
          />
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ActivityChart reports={reports} filters={filters} type={type} />
        <Distribution summary={summary} />
      </div>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <EmployeeTable reports={reports} type={type} />
        <aside className="space-y-5">
          <EmployeeRanking reports={reports} />
          <RecentActivity reports={reports} />
        </aside>
      </div>
    </>
  );
}

function ActivityChart({
  reports,
  filters,
  type,
}: {
  reports: EmployeeReport[];
  filters: ReportFilters;
  type: ReportType;
}) {
  const data = useMemo(
    () =>
      days(filters.from, filters.to).map((day) => ({
        date: day,
        label: labelDay(day),
        commits: reports.reduce(
          (n, report) =>
            n +
            report.activities.filter((a) => a.kind === "commits" && a.date.slice(0, 10) === day)
              .length,
          0,
        ),
        tasks: reports.reduce(
          (n, report) =>
            n +
            report.activities.filter((a) => a.kind === "tasks" && a.date.slice(0, 10) === day)
              .length,
          0,
        ),
        video: reports.reduce(
          (n, report) =>
            n +
            report.activities.filter((a) => a.kind === "video" && a.date.slice(0, 10) === day)
              .length,
          0,
        ),
      })),
    [filters, reports],
  );
  const enabled = type === "all" ? ["commits", "tasks", "video"] : [type];
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-5">
        <h2 className="font-semibold">Активность команды</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          События за выбранный период, без оценки производительности
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: -18, right: 8 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(_, values) => values[0]?.payload?.label ?? ""}
              contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border))" }}
            />
            {enabled.includes("commits") && (
              <Line
                name="Коммиты"
                type="monotone"
                dataKey="commits"
                stroke={COLORS.commits}
                strokeWidth={2.5}
                dot={false}
              />
            )}
            {enabled.includes("tasks") && (
              <Line
                name="Задачи"
                type="monotone"
                dataKey="tasks"
                stroke={COLORS.tasks}
                strokeWidth={2.5}
                dot={false}
              />
            )}
            {enabled.includes("video") && (
              <Line
                name="Видеоотчеты"
                type="monotone"
                dataKey="video"
                stroke={COLORS.video}
                strokeWidth={2.5}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Distribution({ summary }: { summary: { commits: number; tasks: number; video: number } }) {
  const data = [
    { name: "Коммиты", value: summary.commits, color: COLORS.commits },
    { name: "Задачи", value: summary.tasks, color: COLORS.tasks },
    { name: "Видеоотчеты", value: summary.video, color: COLORS.video },
  ].filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="font-semibold">Распределение активности</h2>
      <p className="mt-1 text-xs text-muted-foreground">Только состав событий</p>
      {total ? (
        <>
          <div className="relative mx-auto mt-3 h-38">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3}>
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="text-lg">{total}</b>
              <span className="text-[10px] text-muted-foreground">событий</span>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-medium">{Math.round((item.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyReport />
      )}
    </section>
  );
}

function EmployeeTable({ reports, type }: { reports: EmployeeReport[]; type: ReportType }) {
  const sorted = [...reports].sort((a, b) => activityCount(b, type) - activityCount(a, type));
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="font-semibold">Сотрудники</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Выберите сотрудника, чтобы открыть его отчет
          </p>
        </div>
        <Badge variant="secondary">{reports.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Коммиты</th>
              <th className="px-4 py-3 font-medium">Задачи</th>
              <th className="px-4 py-3 font-medium">Видеоотчеты</th>
              <th className="px-4 py-3 font-medium">Последняя активность</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((report) => (
              <tr
                key={report.member.id}
                className="group cursor-pointer transition-colors hover:bg-accent/40"
              >
                <td className="px-5 py-3">
                  <EmployeeLink id={report.member.id}>
                    <EmployeeName member={report.member} />
                  </EmployeeLink>
                </td>
                <td className="px-4 py-3">
                  <Metric value={report.commits.length} type="commits" />
                </td>
                <td className="px-4 py-3">
                  <Metric value={report.tasks.length} type="tasks" />
                </td>
                <td className="px-4 py-3">
                  <Metric value={report.videos.length} type="video" />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {report.lastActivity ? formatDate(report.lastActivity) : "—"}
                </td>
                <td className="px-4 py-3">
                  <EmployeeLink id={report.member.id}>
                    <Button size="icon" variant="ghost" aria-label="Открыть отчет">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </EmployeeLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Metric({ value, type }: { value: number; type: ReportType }) {
  const color =
    type === "commits" ? "bg-blue-500" : type === "tasks" ? "bg-violet-500" : "bg-amber-500";
  return (
    <span className="inline-flex min-w-16 items-center gap-2 font-medium">
      <i className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {value}
    </span>
  );
}
function EmployeeRanking({ reports }: { reports: EmployeeReport[] }) {
  const [metric, setMetric] = useState<Exclude<ReportType, "all">>("tasks");
  const ranked = [...reports]
    .sort((a, b) => activityCount(b, metric) - activityCount(a, metric))
    .slice(0, 4);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Топ сотрудников</h2>
        <Select
          value={metric}
          onValueChange={(value) => setMetric(value as Exclude<ReportType, "all">)}
        >
          <SelectTrigger className="h-8 w-35 border-0 bg-muted/60 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tasks">По задачам</SelectItem>
            <SelectItem value="commits">По коммитам</SelectItem>
            <SelectItem value="video">По видео</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ol className="mt-4 space-y-3">
        {ranked.map((report, index) => (
          <li key={report.member.id} className="flex items-center gap-3">
            <span className="w-4 text-xs font-medium text-muted-foreground">{index + 1}</span>
            <EmployeeLink id={report.member.id}>
              <EmployeeName member={report.member} compact />
            </EmployeeLink>
            <span className="ml-auto text-sm font-semibold">{activityCount(report, metric)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
function RecentActivity({ reports }: { reports: EmployeeReport[] }) {
  const recent = reports
    .flatMap((report) =>
      report.activities.map((activity) => ({ ...activity, member: report.member })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="font-semibold">Недавняя активность</h2>
      {recent.length ? (
        <div className="mt-4 space-y-4">
          {recent.map((item) => (
            <EmployeeLink key={item.id} id={item.member.id}>
              <div className="group flex gap-3">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.kind === "commits" ? "bg-blue-500" : item.kind === "tasks" ? "bg-violet-500" : "bg-amber-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    {item.kind === "commits"
                      ? "Новый коммит"
                      : item.kind === "tasks"
                        ? "Задача обновлена"
                        : "Видеоотчет загружен"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                </div>
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(item.date).slice(0, 5)}
                </time>
              </div>
            </EmployeeLink>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Недавних событий нет.</p>
      )}
      <button
        type="button"
        className="mt-5 inline-flex items-center text-sm font-medium text-primary"
      >
        Показать всю активность <ChevronRight className="ml-1 h-4 w-4" />
      </button>
    </section>
  );
}
