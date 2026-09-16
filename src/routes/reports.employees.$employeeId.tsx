import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileVideo,
  GitCommitHorizontal,
  ListChecks,
  Play,
  UserRound,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { useCurrentOrg } from "@/lib/org";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatDate, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/api";
import {
  hasCompletedTask,
  isoDate,
  reportsService,
  type EmployeeActivity,
  type EmployeeReport,
  type ReportType,
} from "@/lib/reports";
import { EmptyReport, MetricCard } from "@/components/reports/ReportPrimitives";
import { VideoReportUpload } from "@/components/reports/VideoReportUpload";

export const Route = createFileRoute("/reports/employees/$employeeId")({
  component: EmployeeReportPage,
});
type DetailTab = "overview" | Exclude<ReportType, "all">;

function EmployeeReportPage() {
  const { employeeId } = Route.useParams();
  const { org } = useCurrentOrg();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const today = isoDate(new Date());
  const from = new Date();
  from.setDate(from.getDate() - 13);
  const [range] = useState({ from: isoDate(from), to: today });
  const [tab, setTab] = useState<DetailTab>("overview");
  const report = useQuery({
    queryKey: ["employee-report", org?.id, employeeId, range],
    queryFn: () => reportsService.getEmployee(org!.id, Number(employeeId), range),
    enabled: !!org?.id,
  });
  if (!org)
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">
          Выберите организацию, чтобы посмотреть отчет.
        </p>
      </AppLayout>
    );
  return (
    <AppLayout wide>
      <div className="space-y-6">
        <Link
          to="/reports"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Отчеты
        </Link>
        {report.isPending ? (
          <DetailSkeleton />
        ) : report.isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            Не удалось загрузить отчет: {report.error.message}
          </div>
        ) : !report.data ? (
          <EmptyReport />
        ) : (
          <EmployeeReportContent
            report={report.data}
            range={range}
            tab={tab}
            setTab={setTab}
            canUpload={Number(currentUser?.id) === Number(report.data.member.user_id)}
            onUploaded={() => {
              void queryClient.invalidateQueries({
                queryKey: ["employee-report", org.id, employeeId],
              });
              void queryClient.invalidateQueries({ queryKey: ["employee-reports", org.id] });
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
function EmployeeReportContent({
  report,
  range,
  tab,
  setTab,
}: {
  report: EmployeeReport;
  range: { from: string; to: string };
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  canUpload: boolean;
  onUploaded: () => void;
}) {
  const completed = report.tasks.filter(hasCompletedTask).length;
  return (
    <>
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar
            avatarUrl={report.member.avatar_url}
            name={report.member.full_name}
            className="h-14 w-14"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {report.member.full_name || report.member.username || "Сотрудник"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.member.department_name || report.member.role_name || "Сотрудник"}
            </p>
          </div>
        </div>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {formatShortRange(range)}
        </p>
        {canUpload && report.member.video_report_eligible ? (
          <VideoReportUpload employee={report.member} onUploaded={onUploaded} />
        ) : null}
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Коммиты"
          value={report.commits.length}
          icon={GitCommitHorizontal}
          tone="violet"
        />
        <MetricCard label="Выполненные задачи" value={completed} icon={CheckCircle2} />
        <MetricCard
          label="Видеоотчеты"
          value={report.videos.length}
          icon={FileVideo}
          tone="amber"
        />
        <MetricCard label="Активные дни" value={report.activeDays} icon={UserRound} tone="rose" />
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as DetailTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="overview" className="rounded-lg px-4 py-2">
            Обзор
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-lg px-4 py-2">
            Задачи
          </TabsTrigger>
          <TabsTrigger value="commits" className="rounded-lg px-4 py-2">
            Коммиты
          </TabsTrigger>
          <TabsTrigger value="video" className="rounded-lg px-4 py-2">
            Видеоотчеты
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "overview" ? (
        <ActivityTimeline activities={report.activities} />
      ) : tab === "tasks" ? (
        <TasksTable report={report} />
      ) : tab === "commits" ? (
        <CommitsTable report={report} />
      ) : (
        <Videos report={report} />
      )}
    </>
  );
}
function formatShortRange(range: { from: string; to: string }) {
  const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
  return `${fmt.format(new Date(`${range.from}T12:00:00`))} — ${fmt.format(new Date(`${range.to}T12:00:00`))}`;
}
function ActivityTimeline({ activities }: { activities: EmployeeActivity[] }) {
  const groups = useMemo(() => {
    const grouped = new Map<string, EmployeeActivity[]>();
    activities.forEach((activity) => {
      const key = activity.date.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), activity]);
    });
    return [...grouped.entries()];
  }, [activities]);
  if (!groups.length) return <EmptyReport />;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="font-semibold">Лента активности</h2>
      <div className="mt-5 space-y-6">
        {groups.map(([day, records]) => (
          <div key={day}>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
                new Date(`${day}T12:00:00`),
              )}
            </h3>
            <ol className="space-y-3 border-l border-border pl-5">
              {records.map((activity) => (
                <li key={activity.id} className="relative">
                  <span
                    className={`absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full ${activity.kind === "commits" ? "bg-blue-500" : activity.kind === "tasks" ? "bg-violet-500" : "bg-amber-500"}`}
                  />
                  <div className="flex gap-3">
                    <time className="w-10 text-xs text-muted-foreground">
                      {formatDate(activity.date).slice(-5)}
                    </time>
                    <div>
                      <p className="text-sm font-medium">
                        {activity.kind === "commits"
                          ? "Commit"
                          : activity.kind === "tasks"
                            ? "Задача обновлена"
                            : "Видеоотчет"}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{activity.title}</p>
                      {activity.detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{activity.detail}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
function TasksTable({ report }: { report: EmployeeReport }) {
  if (!report.tasks.length) return <EmptyReport type="tasks" />;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">Задачи</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Jira Key</th>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Приоритет</th>
              <th className="px-4 py-3">Дата обновления</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.tasks.map((task) => (
              <tr key={task.id}>
                <td className="px-5 py-3 font-medium text-primary">
                  {task.jira_url ? (
                    <a href={task.jira_url} target="_blank" rel="noreferrer">
                      {task.jira_key || "—"}
                    </a>
                  ) : (
                    task.jira_key || "—"
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{task.title}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || task.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {task.priority
                    ? PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] ||
                      task.priority
                    : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {task.updated_at ? formatDate(task.updated_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function CommitsTable({ report }: { report: EmployeeReport }) {
  if (!report.commits.length) return <EmptyReport type="commits" />;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">Коммиты</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Repository</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Commit</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.commits.map((commit, index) => (
              <tr key={`${commit.hash}-${index}`}>
                <td className="px-5 py-3 text-muted-foreground">{commit.repository || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{commit.branch || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">
                  {commit.url ? (
                    <a href={commit.url} target="_blank" rel="noreferrer">
                      {commit.hash || "—"}
                    </a>
                  ) : (
                    commit.hash || "—"
                  )}
                </td>
                <td className="max-w-xl px-4 py-3 font-medium">
                  <p>{commit.message}</p>
                  {commit.report_text ? (
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-sans text-xs font-normal leading-relaxed text-muted-foreground">
                      {commit.report_text}
                    </pre>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {commit.date ? formatDate(commit.date) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Videos({ report }: { report: EmployeeReport }) {
  if (!report.videos.length) return <EmptyReport type="video" />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {report.videos.map((video, index) => (
        <article
          key={`${video.date}-${index}`}
          className="rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{formatDate(video.date).slice(0, 10)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Видеоотчет</p>
            </div>
            <span className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
              <FileVideo className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <p>Длительность: {video.duration || "не указана"}</p>
            <p>Создан: {video.createdAt ? formatDate(video.createdAt) : "не указано"}</p>
          </div>
          {video.url ? (
            <Button asChild className="mt-5 w-full">
              <a href={video.url} target="_blank" rel="noreferrer">
                <Play className="mr-2 h-4 w-4" />
                Смотреть
              </a>
            </Button>
          ) : null}
          {video.summary && (
            <div className="mt-5 border-t border-border pt-4 text-sm">
              <h3 className="font-medium">Краткое содержание</h3>
              {video.summary.completed && (
                <p className="mt-2 text-muted-foreground">Выполнено: {video.summary.completed}</p>
              )}
              {video.summary.problems && (
                <p className="mt-2 text-muted-foreground">Проблемы: {video.summary.problems}</p>
              )}
              {video.summary.plans && (
                <p className="mt-2 text-muted-foreground">Планы: {video.summary.plans}</p>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
