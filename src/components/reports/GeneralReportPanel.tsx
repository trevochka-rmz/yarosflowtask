import { FileText, LoaderCircle, Sparkles, Users } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import type { GeneralShortReport, TeamDailyReport } from "@/lib/reports";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

export function GeneralReportPanel({
  reports,
  teamReport,
  pending,
  error,
}: {
  reports: GeneralShortReport[];
  teamReport: TeamDailyReport | null;
  pending: boolean;
  error: boolean;
}) {
  if (pending) {
    return <section className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Загружаем краткие отчёты…</section>;
  }
  if (error) {
    return <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">Не удалось загрузить общий отчёт.</section>;
  }
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-5 shadow-soft">
      <header className="flex flex-wrap items-start gap-3 border-b pb-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Общий отчёт</h1>
          <p className="mt-1 text-sm text-muted-foreground">Итог команды и краткие отчёты сотрудников</p>
        </div>
        <span className="ml-auto rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{reports.length} {reports.length === 1 ? "отчёт" : "отчётов"}</span>
      </header>
      {teamReport ? (
        <article className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <header className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold">Итоговый отчёт IT-команды</h2>
              <p className="text-xs text-muted-foreground">{formatDate(teamReport.report_date)}</p>
            </div>
          </header>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{teamReport.team_report}</p>
        </article>
      ) : null}
      {reports.length ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-border bg-muted/20 p-4">
              <header className="flex items-center gap-3">
                <UserAvatar avatarUrl={report.member.avatar_url} name={report.member.full_name} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">{report.member.full_name || "Сотрудник"}</h2>
                  <p className="text-xs text-muted-foreground">{report.member.department_name || "Сотрудник"} · {formatDate(report.report_date)}</p>
                </div>
                <FileText className="h-4 w-4 shrink-0 text-primary" />
              </header>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{report.employee_report}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">За выбранный период кратких отчётов пока нет.</div>
      )}
    </section>
  );
}
