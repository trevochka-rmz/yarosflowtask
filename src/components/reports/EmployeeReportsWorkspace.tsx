import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileVideo,
  GitBranch,
  ListChecks,
  LoaderCircle,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { orgApi, useCurrentOrg } from "@/lib/org";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  isoDate,
  reportsService,
  type GeneralShortReport,
  type ReportFilters,
  type ReportType,
} from "@/lib/reports";
import { parseGitReport } from "@/lib/git-report-parser";
import { STATUS_LABELS } from "@/lib/api";
import { EmployeeName, EmptyReport, ReportsHeader, ReportTypeTabs } from "./ReportPrimitives";
import { GeneralReportPanel } from "./GeneralReportPanel";
import { VideoReportCard } from "./VideoReportCard";
import { VideoReportUpload } from "./VideoReportUpload";

function formatReportDay(value: unknown) {
  const raw = String(value ?? "").slice(0, 10);
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Дата отчёта не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function searchDate(value: unknown) {
  const date = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

function searchId(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function searchSource(value: unknown): ReportType {
  return ["all", "commits", "tasks", "video"].includes(String(value))
    ? (value as ReportType)
    : "all";
}

export function EmployeeReportsWorkspace() {
  const { org } = useCurrentOrg();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routeSearch = useRouterState({ select: (state) => state.location.search });
  const linkedMemberId = searchId(routeSearch.memberId);
  const appliedLinkedMemberId = useRef<number>();
  const today = isoDate(new Date());
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    from: searchDate(routeSearch.reportFrom) ?? today,
    to: searchDate(routeSearch.reportTo) ?? today,
    departmentId: searchId(routeSearch.reportDepartmentId),
    memberId: searchId(routeSearch.reportMemberId),
    search: typeof routeSearch.reportSearch === "string" ? routeSearch.reportSearch : undefined,
  }));
  const [source, setSource] = useState<ReportType>(() => searchSource(routeSearch.reportSource));
  const [selected, setSelected] = useState<number | "general">();
  const [tab, setTab] = useState<"overview" | "git" | "tasks" | "video">("overview");
  const [previewTarget, setPreviewTarget] = useState<{
    memberId: number;
    reportDate: string;
    ownerSendingForOther?: boolean;
  }>();
  const [deliveryInProgress, setDeliveryInProgress] = useState(false);
  const isCurrentOrgOwner = ["owner", "владелец"].includes(
    String(org?.role_code || org?.role_name || "")
      .trim()
      .toLowerCase(),
  );
  const canRegenerateVideoAnalysis = [
    "owner",
    "bot_owner",
    "владелец",
    "administrator",
    "admin",
    "platform_admin",
    "администратор",
    "director",
    "директор",
  ].includes(
    String(org?.role_code || org?.role_name || "")
      .trim()
      .toLowerCase(),
  );
  const canViewGeneralReport = [
    "owner",
    "владелец",
    "director",
    "директор",
    "administrator",
    "admin",
    "администратор",
    "админ",
  ].includes(
    String(org?.role_code || org?.role_name || "")
      .trim()
      .toLowerCase(),
  );
  const isDirector = ["director", "директор"].includes(
    String(org?.role_code || org?.role_name || "")
      .trim()
      .toLowerCase(),
  );
  const updateFilters = (next: ReportFilters) => {
    setFilters(next);
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        reportFrom: next.from,
        reportTo: next.to,
        reportDepartmentId: next.departmentId,
        reportMemberId: next.memberId,
        reportSearch: next.search || undefined,
      }),
    });
  };
  const updateSource = (next: ReportType) => {
    setSource(next);
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, reportSource: next === "all" ? undefined : next }),
    });
  };
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
    if (it && filters.departmentId !== it.id) updateFilters({ ...filters, departmentId: it.id });
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
  useEffect(() => {
    if (isDirector && selected === undefined && !linkedMemberId) setSelected("general");
  }, [isDirector, linkedMemberId, selected]);
  const generalSelected = canViewGeneralReport && selected === "general";
  const active = generalSelected
    ? undefined
    : (list.find((x) => x.member.id === selected) ?? list[0]);
  const generalReport = useQuery({
    queryKey: ["employee-general-report", org?.id, filters.from, filters.to],
    queryFn: () => reportsService.getGeneralReport(org!.id, filters),
    enabled: !!org && generalSelected,
  });
  const activeReport = useQuery({
    queryKey: ["employee-report-detail", org?.id, active?.member.id, filters],
    queryFn: () => reportsService.getEmployee(org!.id, active!.member.id, filters),
    enabled: !!org && !!active,
  });
  const sendVideo = useMutation({
    mutationFn: ({ memberId, reportDate }: { memberId: number; reportDate: string }) =>
      reportsService.sendEmployeeReport(org!.id, memberId, reportDate),
    onSuccess: (data) => {
      if (data.notification?.pending) {
        toast.success("Отправка начата. Ролик появится в Telegram после обработки.");
        setDeliveryInProgress(true);
        setPreviewTarget(undefined);
        // В фоне Telegram может принимать большой файл дольше обычного.
        // Обновляем карточку несколько раз, чтобы кнопка стала
        // «Переотправить» сразу после сохранения доставки на backend.
        [5_000, 15_000, 35_000].forEach((delay) => {
          window.setTimeout(() => {
            void queryClient.invalidateQueries({
              queryKey: ["employee-report-detail", org?.id],
            });
          }, delay);
        });
        return;
      }
      const sent = Number(data.notification?.sent ?? 0);
      toast.success(
        sent > 0
          ? "Полный отчёт отправлен руководству и вам"
          : "Отчёт подготовлен, но руководитель с подключённым Telegram не найден",
      );
      setPreviewTarget(undefined);
      void queryClient.invalidateQueries({ queryKey: ["employee-report-detail", org?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const previewVideo = useMutation({
    mutationFn: ({ memberId, reportDate }: { memberId: number; reportDate: string }) =>
      reportsService.previewEmployeeReport(org!.id, memberId, reportDate),
    onError: (error: Error) => toast.error(error.message),
  });
  useEffect(() => {
    if (!deliveryInProgress || !org || !active) return;
    const timer = window.setInterval(() => {
      void reportsService
        .employeeReportDeliveryStatus(org.id, active.member.id, filters.to)
        .then((data) => {
          if (!data.pending) {
            setDeliveryInProgress(false);
            void queryClient.invalidateQueries({
              queryKey: ["employee-report-detail", org.id, active.member.id],
            });
          }
        });
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [active, deliveryInProgress, filters.to, org, queryClient]);
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
    <div className="min-w-0 space-y-3">
      <ReportsHeader
        filters={filters}
        departments={departments.data ?? []}
        members={members.data ?? []}
        onChange={updateFilters}
      />
      <ReportTypeTabs
        type={source}
        onChange={(value) => {
          updateSource(value);
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
      ) : !active && !generalSelected ? (
        <EmptyReport />
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[29%_1fr]">
          <aside className="min-w-0 overflow-hidden rounded-2xl border bg-card">
            <div className="border-b p-4">
              <b>Сотрудники</b>
            </div>
            {canViewGeneralReport ? (
              <button
                type="button"
                onClick={() => setSelected("general")}
                className={`flex min-w-0 w-full items-center gap-3 border-b p-3 text-left hover:bg-accent/50 ${generalSelected ? "border-l-2 border-l-primary bg-primary/8" : ""}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Общий отчёт</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Краткие отчёты команды
                  </span>
                </span>
              </button>
            ) : null}
            {list.map((report) => {
              const git = report.commits.length > 0,
                jira = report.tasks.length > 0,
                video = report.videos.length > 0;
              const isCurrentUser = Number(report.member.user_id) === Number(currentUser?.id);
              return (
                <button
                  key={report.member.id}
                  onClick={() => setSelected(report.member.id)}
                  className={`flex min-w-0 w-full items-center gap-3 border-b p-3 text-left hover:bg-accent/50 ${active?.member.id === report.member.id ? "border-l-2 border-l-primary bg-primary/8" : ""} ${isCurrentUser ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""}`}
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
          {generalSelected ? (
            <GeneralReportPanel
              reports={generalReport.data ?? []}
              pending={generalReport.isPending}
              error={generalReport.isError}
            />
          ) : activeReport.isPending ? (
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
              canSend={
                Number(currentUser?.id) === Number((activeReport.data ?? active).member.user_id) ||
                isCurrentOrgOwner
              }
              ownerSendingForOther={
                isCurrentOrgOwner &&
                Number(currentUser?.id) !== Number((activeReport.data ?? active).member.user_id)
              }
              isSingleDay={filters.from === filters.to}
              selectedReportDate={filters.to}
              onUploaded={(uploaded) => {
                void queryClient.invalidateQueries({
                  queryKey: ["employee-report-detail", org.id, active.member.id],
                });
                void queryClient.invalidateQueries({ queryKey: ["employee-reports", org.id] });
                // После успешной загрузки сразу показываем именно то
                // уведомление, которое сотрудник сможет отправить. Дата
                // берётся из ответа API: пользователь мог выбрать прошлый
                // день в форме загрузки.
                const target = {
                  memberId: active.member.id,
                  reportDate: String(uploaded.report_date).slice(0, 10),
                  ownerSendingForOther: false,
                };
                setTab("video");
                setPreviewTarget(target);
                previewVideo.mutate(target);
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
              canRegenerateVideoAnalysis={canRegenerateVideoAnalysis}
              onRegenerateVideoAnalysis={async (videoReportId) => {
                await reportsService.regenerateVideoAnalysis(
                  org.id,
                  active.member.id,
                  videoReportId,
                );
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: ["employee-report-detail", org.id, active.member.id],
                  }),
                  queryClient.invalidateQueries({ queryKey: ["employee-reports", org.id] }),
                ]);
              }}
              onPreview={() => {
                const target = {
                  memberId: active.member.id,
                  reportDate: filters.to,
                  ownerSendingForOther:
                    isCurrentOrgOwner && Number(currentUser?.id) !== Number(active.member.user_id),
                };
                setPreviewTarget(target);
                previewVideo.mutate(target);
              }}
              isSending={
                sendVideo.isPending ||
                deliveryInProgress ||
                Boolean((activeReport.data ?? active).reportDeliveryPending)
              }
            />
          )}
        </div>
      )}
      <Dialog
        open={Boolean(previewTarget)}
        onOpenChange={(open) => {
          if (!open && !sendVideo.isPending) setPreviewTarget(undefined);
        }}
      >
        <DialogContent className="flex h-[85dvh] max-h-[85dvh] max-w-xl flex-col">
          <DialogHeader>
            <DialogTitle>Предпросмотр уведомления</DialogTitle>
            <DialogDescription>
              {previewTarget?.ownerSendingForOther
                ? "Так сообщение будет выглядеть у получателей отчёта. Самому сотруднику оно не отправится."
                : "Так сообщение будет выглядеть у руководства и у вас. Оно ещё не отправлено."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {previewVideo.isPending ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Готовим предпросмотр…
              </p>
            ) : previewVideo.data ? (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  {previewVideo.data.has_video
                    ? "🎥 Видеоролик будет прикреплён"
                    : "📝 Отчёт будет отправлен без видеоролика"}
                </p>
                {!previewVideo.data.has_video ? (
                  <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                    Чтобы добавить ролик, отмените этот предпросмотр, загрузите видеоотчёт и затем
                    снова откройте отправку отчёта. Ролик не прикрепляется автоматически.
                  </p>
                ) : null}
                {!previewVideo.data.caption.includes("Краткая сводка из 1С") ? (
                  <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                    Отчёт из 1С пока не найден. Сначала заполните отчёт в 1С — после обновления он
                    появится здесь.
                  </p>
                ) : null}
                <div
                  className="whitespace-pre-wrap text-sm leading-relaxed [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: previewVideo.data.caption }}
                />
                <p className="mt-4 rounded-md border bg-background px-3 py-2 text-center text-sm text-primary">
                  📋 Открыть полный отчёт
                </p>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-destructive">
                Не удалось подготовить предпросмотр.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sendVideo.isPending}
              onClick={() => setPreviewTarget(undefined)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!previewTarget || !previewVideo.data || sendVideo.isPending}
              onClick={() => {
                if (previewTarget) void sendVideo.mutateAsync(previewTarget);
              }}
            >
              {sendVideo.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendVideo.isPending
                ? "Отправляем…"
                : previewTarget?.ownerSendingForOther
                  ? "Отправить руководству"
                  : "Отправить руководству и себе"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ReportPanel({
  report,
  tab,
  setTab,
  canUpload,
  canSend,
  ownerSendingForOther,
  isSingleDay,
  selectedReportDate,
  onUploaded,
  onDeleted,
  canRegenerateVideoAnalysis,
  onRegenerateVideoAnalysis,
  onPreview,
  isSending,
}: {
  report: Awaited<ReturnType<typeof reportsService.getEmployee>> extends infer T
    ? NonNullable<T>
    : never;
  tab: string;
  setTab: (tab: "overview" | "git" | "tasks" | "video") => void;
  canUpload: boolean;
  canSend: boolean;
  ownerSendingForOther: boolean;
  isSingleDay: boolean;
  selectedReportDate: string;
  onUploaded: () => void;
  onDeleted: (videoReportId: number) => Promise<void>;
  canRegenerateVideoAnalysis: boolean;
  onRegenerateVideoAnalysis: (videoReportId: number) => Promise<void>;
  onPreview: () => void;
  isSending: boolean;
}) {
  const gitReports = report.commits
    .filter((commit) => commit.report_text)
    .map((commit) => ({ commit, parsed: parseGitReport(commit.report_text) }));
  const git = gitReports[0]?.parsed;
  const video = report.videos[0];
  const reportWasSent = Boolean(report.reportDelivery?.sent_at);
  const videosForPeriod = [...report.videos].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const reportDateLabel = formatReportDay(selectedReportDate);
  const hasVideoForSelectedDate = report.videos.some(
    (item) => isoDate(new Date(item.date)) === selectedReportDate,
  );
  const hasTextReportForSelectedDate = report.commits.some(
    (commit) =>
      Boolean(commit.report_text?.trim()) && isoDate(new Date(commit.date)) === selectedReportDate,
  );
  const hasReportDataForSelectedDate =
    hasVideoForSelectedDate || hasTextReportForSelectedDate || report.tasks.length > 0;
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <UserAvatar
          avatarUrl={report.member.avatar_url}
          name={report.member.full_name}
          className="h-14 w-14"
        />
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">{report.member.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {report.member.department_name || report.member.role_name || "Сотрудник"}
          </p>
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Отчет за {reportDateLabel}
          </span>
          {isSingleDay && report.member.video_report_eligible && (canUpload || canSend) ? (
            <div className="flex flex-col gap-2">
              {canUpload ? (
                <VideoReportUpload
                  employee={report.member}
                  defaultReportDate={selectedReportDate}
                  alreadyUploaded={hasVideoForSelectedDate}
                  onUploaded={onUploaded}
                />
              ) : null}
              {canSend ? (
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isSending || !hasReportDataForSelectedDate}
                  onClick={onPreview}
                >
                  {isSending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSending
                    ? "Отправляем…"
                    : !hasReportDataForSelectedDate
                      ? "Добавьте отчёт"
                      : reportWasSent
                        ? ownerSendingForOther
                          ? "Переотправить руководству"
                          : "Переотправить руководству и себе"
                        : ownerSendingForOther
                          ? "Отправить руководству"
                          : "Отправить руководству и себе"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      {report.shortReports.length ? (
        <section className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-violet-600" />
            Краткий отчёт из отчетов за сегодня
          </div>
          <div className="mt-3 space-y-3">
            {report.shortReports.map((shortReport) => (
              <article key={shortReport.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{formatReportDay(shortReport.date)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {shortReport.text}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList className="h-auto w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="git">Git-отчет</TabsTrigger>
          <TabsTrigger value="tasks">Задачи (Jira)</TabsTrigger>
          <TabsTrigger value="video">Видеоотчет</TabsTrigger>
        </TabsList>
      </Tabs>
      {!isSingleDay && (tab === "git" || tab === "overview") ? (
        <article className="mt-4 rounded-xl border p-4">
          <h2 className="font-semibold">Отчёты из 1С по дням</h2>
          {gitReports.length ? (
            <div className="mt-3 space-y-3">
              {gitReports.map(({ commit, parsed }) => (
                <div key={commit.date} className="rounded-lg border bg-muted/20 p-3">
                  <h3 className="text-sm font-medium">{formatReportDay(commit.date)}</h3>
                  {parsed ? (
                    <>
                      <p className="mt-2 text-sm font-medium">
                        Отработано: {parsed.workedHours || "не указано"}
                      </p>
                      <details className="mt-3">
                        <summary className="w-fit cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted">
                          Посмотреть полностью
                        </summary>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {parsed.raw}
                        </p>
                      </details>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Отчёт получен, но его текст пока не удалось разобрать.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyReport type="commits" />
          )}
        </article>
      ) : null}
      {isSingleDay && (tab === "git" || tab === "overview") ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border p-4">
            <h2 className="font-semibold">Краткая сводка из 1С</h2>
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
              <div key={t.id} className="mt-3 flex items-start gap-4 text-sm">
                <span className="min-w-0 flex-1 break-words">
                  {t.jira_url ? (
                    <a className="text-primary" href={t.jira_url}>
                      {t.jira_key || t.id}
                    </a>
                  ) : (
                    t.jira_key || t.id
                  )}{" "}
                  · {t.title}
                </span>
                <span className="shrink-0 text-right text-muted-foreground">
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
            {isSingleDay ? "Видеоотчет" : `Видеоотчёты за период (${videosForPeriod.length})`}
          </h2>
          {videosForPeriod.length ? (
            <div className="mt-3 space-y-4">
              {videosForPeriod.map((periodVideo) => (
                <VideoReportCard
                  key={periodVideo.id ?? `${periodVideo.date}-${periodVideo.url ?? "video"}`}
                  video={periodVideo}
                  canDelete={canUpload}
                  onDelete={onDeleted}
                  canRegenerateAnalysis={canRegenerateVideoAnalysis}
                  onRegenerateAnalysis={onRegenerateVideoAnalysis}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Видеоотчета нет.</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
