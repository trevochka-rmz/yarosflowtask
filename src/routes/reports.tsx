import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, FileVideo, GitCommitHorizontal, ListChecks, Loader2, UserRound } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { orgApi, useCurrentOrg, type EmployeeDailyReport, type OrgMember } from "@/lib/org";
import { STATUS_LABELS, type TaskStatus } from "@/lib/api";

export const Route = createFileRoute("/reports")({ component: ReportsPage });
type ReportKind = "commits" | "tasks" | "video";

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function parsedTasks(value: EmployeeDailyReport["task_items"]) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value) as Array<{ id: number; title: string; status: string }>; } catch { return []; }
}
function commitText(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const record = value as Record<string, unknown>;
  const report = record["Отчет"] ?? record.report ?? record.text ?? record.summary;
  return typeof report === "string" ? report : JSON.stringify(report ?? value, null, 2);
}
function isItEmployee(member: OrgMember) {
  return member.is_active && ["it", "ит"].includes((member.department_name || "").trim().toLowerCase()) && ["employee", "сотрудник"].includes((member.role_name || "").trim().toLowerCase());
}

function ReportsPage() {
  const { org } = useCurrentOrg();
  const [date, setDate] = useState(localDate);
  const [memberId, setMemberId] = useState("");
  const [kind, setKind] = useState<ReportKind>("commits");
  const members = useQuery({ queryKey: ["org-members", org?.id], queryFn: () => orgApi.members(org!.id), enabled: !!org?.id });
  const employees = (members.data ?? []).filter(isItEmployee);
  useEffect(() => { if (!memberId && employees[0]) setMemberId(String(employees[0].id)); }, [memberId, employees]);
  const preview = useQuery({ queryKey: ["employee-report-preview", org?.id, memberId, date], queryFn: () => orgApi.employeeReportPreview(org!.id, Number(memberId), date), enabled: !!org?.id && !!memberId && kind !== "video" });
  const selected = employees.find((member) => String(member.id) === memberId);

  if (!org) return <AppLayout><p className="text-sm text-muted-foreground">Выберите организацию, чтобы посмотреть отчёты.</p></AppLayout>;
  return <AppLayout wide>
    <div><h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">Отчёты сотрудников</h1><p className="mt-1 text-sm text-muted-foreground">IT-отдел · коммиты из 1С загружаются сразу, без ожидания вечернего cron.</p></div>
    <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft md:grid-cols-3">
      <label className="space-y-1.5 text-sm font-medium"><span className="flex items-center gap-1.5 text-muted-foreground"><UserRound className="h-4 w-4" />Сотрудник</span><Select value={memberId} onValueChange={setMemberId}><SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger><SelectContent>{employees.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.full_name || member.username || `#${member.user_id}`}{member.gitlab_username ? ` · @${member.gitlab_username}` : ""}</SelectItem>)}</SelectContent></Select></label>
      <label className="space-y-1.5 text-sm font-medium"><span className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-4 w-4" />День</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="space-y-1.5 text-sm font-medium"><span className="text-muted-foreground">Тип отчёта</span><Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="commits">Коммиты из 1С</SelectItem><SelectItem value="tasks">Задачи сотрудника</SelectItem><SelectItem value="video">Видеоотчёт</SelectItem></SelectContent></Select></label>
    </div>
    {!members.isPending && employees.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">В IT-отделе пока нет активных сотрудников с ролью Employee.</p> : kind === "video" ? <><ReportHeader member={selected} /><div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"><FileVideo className="mx-auto mb-3 h-8 w-8" />Видеоотчёты появятся здесь после завершения обработки роликов.</div></> : preview.isPending ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Загружаем данные…</div> : preview.isError ? <p className="mt-6 text-sm text-destructive">{preview.error.message}</p> : preview.data ? <LiveReport row={preview.data} kind={kind} /> : null}
  </AppLayout>;
}

function ReportHeader({ member }: { member?: OrgMember }) {
  if (!member) return null;
  return <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"><UserAvatar avatarUrl={member.avatar_url} name={member.full_name} className="h-11 w-11" /><div><h2 className="font-semibold">{member.full_name || "Без имени"}</h2><p className="text-sm text-muted-foreground">{member.department_name || "IT"}{member.gitlab_username ? ` · @${member.gitlab_username}` : ""}</p></div></div>;
}

function LiveReport({ row, kind }: { row: EmployeeDailyReport; kind: ReportKind }) {
  const tasks = parsedTasks(row.task_items); const commits = commitText(row.commit_report);
  return <article className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft"><header className="flex items-center gap-3 border-b border-border px-5 py-4"><UserAvatar avatarUrl={row.avatar_url} name={row.full_name} className="h-11 w-11" /><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{row.full_name || "Без имени"}</h2><p className="text-xs text-muted-foreground">{row.department_name || "IT"}{row.gitlab_username ? ` · @${row.gitlab_username}` : ""} · {row.report_date}</p></div>{kind === "tasks" ? <Badge variant="secondary">{tasks.length} задач</Badge> : null}</header><div className="p-5">{kind === "tasks" ? <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><ListChecks className="h-4 w-4 text-primary" />Задачи</h3>{tasks.length ? <div className="space-y-2">{tasks.map((task) => <div key={task.id} className="flex gap-3 rounded-lg bg-muted/55 px-3 py-2.5 text-sm"><span className="min-w-0 flex-1 break-words">{task.title}</span><Badge variant="outline" className="h-5 shrink-0 text-[10px]">{STATUS_LABELS[task.status as TaskStatus] || task.status}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">За выбранный день задач нет.</p>}</section> : <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><GitCommitHorizontal className="h-4 w-4 text-primary" />Коммиты из 1С</h3>{commits ? <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 font-sans text-sm text-foreground">{commits}</pre> : <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">За выбранный день отчёт по коммитам не найден.</p>}{row.commit_lookup ? <p className="mt-3 text-xs text-muted-foreground">Поиск выполнен по {row.commit_lookup === "username" ? "GitLab username" : "ФИО"}.</p> : null}</section>}</div></article>;
}
