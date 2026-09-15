import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, FileVideo, GitCommitHorizontal, ListChecks, Loader2, UserRound } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { orgApi, useCurrentOrg, type EmployeeDailyReport } from "@/lib/org";
import { STATUS_LABELS, type TaskStatus } from "@/lib/api";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function parsedTasks(value: EmployeeDailyReport["task_items"]) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value) as Array<{ id: number; title: string; status: string }>; } catch { return []; }
}

function summary(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["summary", "text", "report", "Отчет", "message", "comment", "description"]) {
      if (typeof record[key] === "string" && record[key]) return record[key] as string;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function ReportsPage() {
  const { org } = useCurrentOrg();
  const [date, setDate] = useState(localDate);
  const reports = useQuery({
    queryKey: ["employee-reports", org?.id, date],
    queryFn: () => orgApi.employeeReports(org!.id, { date }),
    enabled: !!org?.id,
  });
  const rows = reports.data ?? [];
  const totals = useMemo(() => ({ employees: rows.length, tasks: rows.reduce((sum, row) => sum + parsedTasks(row.task_items).length, 0), commits: rows.filter((row) => row.commit_report).length }), [rows]);

  if (!org) return <AppLayout><p className="text-sm text-muted-foreground">Выберите организацию, чтобы посмотреть отчёты.</p></AppLayout>;

  return (
    <AppLayout wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">Отчёты сотрудников</h1>
          <p className="mt-1 text-sm text-muted-foreground">IT-отдел · ежедневные снимки задач, коммитов и видеоотчётов</p>
        </div>
        <label className="space-y-1 text-sm font-medium"><span className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-4 w-4" /> Рабочий день</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[["Сотрудников", totals.employees, UserRound], ["Задач в отчётах", totals.tasks, ListChecks], ["Отчётов по коммитам", totals.commits, GitCommitHorizontal]].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof UserRound;
          return <div key={String(label)} className="rounded-2xl border border-border bg-card p-4 shadow-soft"><MetricIcon className="h-4 w-4 text-primary" /><p className="mt-3 text-2xl font-semibold">{value as number}</p><p className="text-sm text-muted-foreground">{String(label)}</p></div>;
        })}
      </div>
      {reports.isPending ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Загружаем отчёты…</div> : reports.isError ? <p className="mt-6 text-sm text-destructive">{reports.error.message}</p> : rows.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">За этот рабочий день отчётов пока нет</p><p className="mt-1 text-sm text-muted-foreground">Они сохраняются автоматически после вечернего cron в 18:00.</p></div> : <div className="mt-6 grid gap-4 xl:grid-cols-2">{rows.map((row) => <ReportCard key={row.id} row={row} />)}</div>}
    </AppLayout>
  );
}

function ReportCard({ row }: { row: EmployeeDailyReport }) {
  const tasks = parsedTasks(row.task_items);
  const commitText = summary(row.commit_report);
  return <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"><header className="flex items-center gap-3 border-b border-border px-5 py-4"><UserAvatar avatarUrl={row.avatar_url} name={row.full_name} className="h-10 w-10" /><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{row.full_name || "Без имени"}</h2><p className="truncate text-xs text-muted-foreground">{row.department_name || "IT"}{row.gitlab_username ? ` · @${row.gitlab_username}` : ""}</p></div><Badge variant="secondary">{tasks.length} задач</Badge></header><div className="space-y-5 p-5"><section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-primary" />Задачи</h3>{tasks.length ? <div className="space-y-1.5">{tasks.map((task) => <div key={task.id} className="flex gap-2 rounded-lg bg-muted/55 px-3 py-2 text-sm"><span className="min-w-0 flex-1 break-words">{task.title}</span><Badge variant="outline" className="h-5 shrink-0 text-[10px]">{STATUS_LABELS[task.status as TaskStatus] || task.status}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Нет обновлённых или активных задач.</p>}</section><section className="rounded-xl border border-border/80 bg-muted/25 p-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><GitCommitHorizontal className="h-4 w-4 text-primary" />Коммиты</h3>{commitText ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{commitText}</p> : <p className="mt-2 text-sm text-muted-foreground">Не найдено в 1С{row.gitlab_username ? " по GitLab username или ФИО" : " по ФИО"}.</p>} {row.commit_lookup && <p className="mt-2 text-[11px] text-muted-foreground">Поиск: {row.commit_lookup === "username" ? "GitLab username" : "ФИО"}</p>}</section><section className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"><FileVideo className="h-4 w-4" />{row.video_report ? "Видеоотчёт обработан" : "Видеоотчёт будет добавлен после запуска обработки"}</section></div></article>;
}
