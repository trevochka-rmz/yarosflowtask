import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  GitBranch,
  ListChecks,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { orgApi, useCurrentOrg } from "@/lib/org";
import { useCurrentUser } from "@/lib/use-current-user";
import { isoDate, reportsService, type ReportFilters, type ReportType } from "@/lib/reports";
import { parseGitReport } from "@/lib/git-report-parser";
import { STATUS_LABELS } from "@/lib/api";
import { EmployeeName, EmptyReport, ReportsHeader, ReportTypeTabs } from "./ReportPrimitives";
import { VideoReportCard } from "./VideoReportCard";
import { VideoReportUpload } from "./VideoReportUpload";

export function EmployeeReportsWorkspace() {
  const { org } = useCurrentOrg();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const linkedMemberId = useRouterState({
    select: (state) => Number(state.location.search.memberId) || undefined,
  });
  const appliedLinkedMemberId = useRef<number>();
  const today = isoDate(new Date());
  const [filters, setFilters] = useState<ReportFilters>({ from: today, to: today });
  const [source, setSource] = useState<ReportType>("all");
  const [selected, setSelected] = useState<number>();
  const [tab, setTab] = useState<"overview" | "git" | "tasks" | "video">("overview");
  const members = useQuery({
    queryKey: ["org-members", org?.id],
    queryFn: () => orgApi.members(org!.id),
    enabled: !!org,
  });
  const departments = useQuery({
    queryKey: ["org-departments", org?.id],
    queryFn: () => orgApi.departments(org!.id),
    enabled: !!org,
  });
  useEffect(() => {
    const it = departments.data?.find((department) =>
      ["it", "ит"].includes(department.name.trim().toLowerCase()),
    );
    if (it && filters.departmentId !== it.id)
      setFilters((current) => ({ ...current, departmentId: it.id }));
  }, [departments.data, filters.departmentId]);
  const reports = useQuery({
    queryKey: ["employee-reports", org?.id, filters],
    queryFn: () => reportsService.getOverview(org!.id, filters),
    enabled: !!org,
  });
  const list = (reports.data ?? [])
    .filter(
      (report) =>
        source === "all" ||
        (source === "commits" && report.commits.length > 0) ||
        (source === "tasks" && report.tasks.length > 0) ||
        (source === "video" && report.videos.length > 0),
    )
    .sort((left, right) => {
      const leftIsCurrent = Number(left.member.user_id) === Number(currentUser?.id);
      const rightIsCurrent = Number(right.member.user_id) === Number(currentUser?.id);
      return Number(rightIsCurrent) - Number(leftIsCurrent);
    });
  useEffect(() => {
    if (
      !linkedMemberId ||
      appliedLinkedMemberId.current === linkedMemberId ||
      !list.some((report) => report.member.id === linkedMemberId)
    ) {
      return;
    }
    appliedLinkedMemberId.current = linkedMemberId;
    setSelected(linkedMemberId);
  }, [linkedMemberId, list]);
  const active = list.find((x) => x.member.id === selected) ?? list[0];
  const activeReport = useQuery({
    queryKey: ["employee-report-detail", org?.id, active?.member.id, filters],
    queryFn: () => reportsService.getEmployee(org!.id, active!.member.id, filters),
    enabled: !!org && !!active,
  });
  // После успешной загрузки 1С-снимок сохранён на backend. Обновляем только
  // сводный список, чтобы красный Git-индикатор сразу стал зелёным.
  useEffect(() => {
    if (!activeReport.data?.commits.length) return;
    void queryClient.invalidateQueries({
      queryKey: ["employee-reports", org?.id],
    });
  }, [activeReport.dataUpdatedAt, activeReport.data?.commits.length, org?.id, queryClient]);
  if (!org) return <p className="text-sm text-muted-foreground">Выберите организацию.</p>;
  return (
    <div className="space-y-3">
      <ReportsHeader
        filters={filters}
        departments={departments.data ?? []}
        members={members.data ?? []}
        onChange={setFilters}
      />
      <ReportTypeTabs
        type={source}
        onChange={(value) => {
          setSource(value);
          setTab(
            value === "commits"
              ? "git"
              : value === "tasks"
                ? "tasks"
                : value === "video"
                  ? "video"
                  : "overview",
          );
        }}
      />
      {reports.isPending ? (
        <p className="p-8 text-sm text-muted-foreground">Загружаем отчеты…</p>
      ) : reports.isError ? (
        <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          {reports.error.message}
        </p>
      ) : !active ? (
        <EmptyReport />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[29%_1fr]">
          <aside className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b p-4">
              <b>Сотрудники</b>
            </div>
            {list.map((report) => {
              const git = report.commits.length > 0,
                jira = report.tasks.length > 0,
                video = report.videos.length > 0;
              const isCurrentUser = Number(report.member.user_id) === Number(currentUser?.id);
              return (
                <button
                  key={report.member.id}
                  onClick={() => setSelected(report.member.id)}
                  className={`flex w-full items-center gap-3 border-b p-3 text-left hover:bg-accent/50 ${active.member.id === report.member.id ? "border-l-2 border-l-primary bg-primary/8" : ""} ${isCurrentUser ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""}`}
                >
                  <EmployeeName member={report.member} compact />
                  {isCurrentUser ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Вы
                    </span>
                  ) : null}
                  <span className="ml-auto flex gap-1">
                    <i
                      title="Git-отчет"
                      className={`h-2 w-2 rounded-full ${git ? "bg-emerald-500" : "bg-rose-400"}`}
                    />
                    <i
                      title="Jira"
                      className={`h-2 w-2 rounded-full ${jira ? "bg-blue-500" : "bg-muted-foreground/30"}`}
                    />
                    <i
                      title="Видео"
                      className={`h-2 w-2 rounded-full ${video ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                    />
                  </span>
                </button>
              );
            })}
            <div className="border-t bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Индикаторы активности</p>
              <div className="mt-2 space-y-1.5">
                <p className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-emerald-500" /> Git-отчет: есть
                </p>
                <p className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-rose-400" /> Git-отчет: нет
                </p>
                <p className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-blue-500" /> Jira: есть активность
                </p>
                <p className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-emerald-500" /> Видео: загружено
                </p>
              </div>
            </div>
          </aside>
          {activeReport.isPending ? (
            <section className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
              Загружаем отчет сотрудника…
            </section>
          ) : activeReport.isError ? (
            <section className="rounded-2xl border bg-card p-8 text-sm text-destructive">
              Не удалось загрузить отчет сотрудника.
            </section>
          ) : (
            <ReportPanel
              report={activeReport.data ?? active}
              tab={tab}
              setTab={setTab}
              canUpload={
                Number(currentUser?.id) === Number((activeReport.data ?? active).member.user_id)
              }
              selectedReportDate={filters.to}
              onUploaded={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["employee-report-detail", org.id, active.member.id],
                });
                void queryClient.invalidateQueries({ queryKey: ["employee-reports", org.id] });
              }}
              onDeleted={async (videoReportId) => {
                await reportsService.deleteVideo(org.id, active.member.id, videoReportId);
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: ["employee-report-detail", org.id, active.member.id],
                  }),
                  queryClient.invalidateQueries({ queryKey: ["employee-reports", org.id] }),
                ]);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
function ReportPanel({
  report,
  tab,
  setTab,
  canUpload,
  selectedReportDate,
  onUploaded,
  onDeleted,
}: {
  report: Awaited<ReturnType<typeof reportsService.getEmployee>> extends infer T
    ? NonNullable<T>
    : never;
  tab: string;
  setTab: (tab: "overview" | "git" | "tasks" | "video") => void;
  canUpload: boolean;
  selectedReportDate: string;
  onUploaded: () => void;
  onDeleted: (videoReportId: number) => Promise<void>;
}) {
  const git = parseGitReport(report.commits.find((x) => x.report_text)?.report_text);
  const video = report.videos[0];
  const reportDateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedReportDate}T12:00:00`));
  const hasVideoForSelectedDate = report.videos.some(
    (item) => isoDate(new Date(item.date)) === selectedReportDate,
  );
  return (
    <section className="rounded-2xl border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <UserAvatar
          avatarUrl={report.member.avatar_url}
          name={report.member.full_name}
          className="h-14 w-14"
        />
        <div>
          <h1 className="text-xl font-semibold">{report.member.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {report.member.department_name || report.member.role_name || "Сотрудник"}
          </p>
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Отчет за {reportDateLabel}
          </span>
          {canUpload && report.member.video_report_eligible ? (
            <VideoReportUpload
              employee={report.member}
              defaultReportDate={selectedReportDate}
              alreadyUploaded={hasVideoForSelectedDate}
              onUploaded={onUploaded}
            />
          ) : null}
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="git">Git-отчет</TabsTrigger>
          <TabsTrigger value="tasks">Задачи (Jira)</TabsTrigger>
          <TabsTrigger value="video">Видеоотчет</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "git" || tab === "overview" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border p-4">
            <h2 className="font-semibold">Краткая сводка дня</h2>
            {git ? (
              <>
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  {git.summary}
                </p>
                <p className="mt-3 text-sm font-medium">
                  Отработано: {git.workedHours || "не указано"}
                </p>
              </>
            ) : (
              <EmptyReport type="commits" />
            )}
          </article>
          <article className="rounded-xl border p-4">
            <h2 className="font-semibold">Проекты и изменения</h2>
            {git?.projects.length ? (
              git.projects.map((p) => (
                <div key={p.name} className="mt-3 border-t pt-3 text-sm">
                  <b>{p.name}</b>
                  <p className="mt-1 text-emerald-600">{p.added && `+${p.added}`}</p>
                  <p className="text-rose-500">{p.removed && `-${p.removed}`}</p>
                </div>
              ))
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Данные по проектам не указаны.</p>
            )}
          </article>
        </div>
      ) : null}
      {tab === "tasks" || tab === "overview" ? (
        <article className="mt-4 rounded-xl border p-4">
          <h2 className="flex gap-2 font-semibold">
            <ListChecks className="h-5 w-5 text-primary" />
            Задачи
          </h2>
          {report.tasks.length ? (
            report.tasks.map((t) => (
              <div key={t.id} className="mt-3 flex justify-between text-sm">
                <span>
                  {t.jira_url ? (
                    <a className="text-primary" href={t.jira_url}>
                      {t.jira_key || t.id}
                    </a>
                  ) : (
                    t.jira_key || t.id
                  )}{" "}
                  · {t.title}
                </span>
                <span className="text-muted-foreground">
                  {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status}
                </span>
              </div>
            ))
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Новых и выполненных задач нет.</p>
          )}
        </article>
      ) : null}
      {tab === "video" || tab === "overview" ? (
        <article className="mt-4 rounded-xl border p-4">
          <h2 className="flex gap-2 font-semibold">
            <FileVideo className="h-5 w-5 text-primary" />
            Видеоотчет
          </h2>
          {video ? (
            <div className="mt-3">
              <VideoReportCard video={video} canDelete={canUpload} onDelete={onDeleted} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Видеоотчета нет.</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
