import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamWeeklySynergy } from "@/lib/reports";

const priorities = { high: "Высокий", medium: "Средний", low: "Низкий" };
const types = { expert_help: "Помощь эксперта", reuse_solution: "Повторное использование решения", duplicate_work: "Дублирование работы", collaboration: "Совместная работа", knowledge_sharing: "Обмен опытом" };

export function TeamWeeklySynergyPanel({ report, loading, error, generating, onGenerate }: {
  report?: TeamWeeklySynergy | null;
  loading: boolean;
  error: boolean;
  generating: boolean;
  onGenerate: () => void;
}) {
  const pending = generating || report?.status === "queued" || report?.status === "processing";
  const data = report?.response_data;
  return (
    <section className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-violet-600" />Синергия команды IT</h2>
        {!data ? <Button size="sm" variant="outline" disabled={loading || pending} onClick={onGenerate}>
          {pending ? "Формируем…" : report?.status === "failed" ? "Повторить" : "Сформировать"}
        </Button> : null}
      </header>
      <p className="mt-2 text-sm text-muted-foreground">Возможности обмена опытом за неделю: от прошлого такого же дня недели до выбранной даты, без суббот и воскресений. Рассылка только Owner — по времени в настройках.</p>
      {loading || pending ? <p className="mt-3 text-sm" role="status"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Собираем полные краткие отчёты IT и формируем рекомендации… Можно закрыть сайт.</p> : null}
      {error || report?.status === "failed" ? <p className="mt-3 text-sm text-destructive">{report?.last_error || "Не удалось загрузить синергию команды."}</p> : null}
      {!loading && !pending && !error && !report ? <p className="mt-3 text-sm text-muted-foreground">За выбранную дату синергия команды ещё не сформирована.</p> : null}
      {data ? <>
        <p className="mt-3 text-sm font-medium">{data.period.from} — {data.period.to} · Кратких отчётов: {report?.source_report_count} · Рекомендаций: {data.summary.total} · Высокий приоритет: {data.summary.high_priority}</p>
        {!data.recommendations.length ? <p className="mt-3 text-sm">Обоснованных рекомендаций по предоставленным отчётам не найдено.</p> : null}
        <div className="mt-3 space-y-3">
          {data.recommendations.map((item, index) => <article key={index} className="min-w-0 break-words rounded-lg border bg-card p-4">
            <h3 className="font-medium">{index + 1}. {item.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Уровень: {priorities[item.priority]} · {types[item.type]}</p>
            <p className="mt-2 text-sm font-medium">{item.employees.join(", ")}</p>
            <p className="mt-2 whitespace-pre-line text-sm">{item.description}</p>
            <p className="mt-3 whitespace-pre-line text-sm"><strong>Рекомендация руководителю: </strong>{item.recommendation}</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Основания из отчётов ({item.evidence.length})</summary>
              <ul className="mt-2 list-disc space-y-2 pl-5">{item.evidence.map((evidence, i) => <li key={i}><strong>{evidence.employee}, {evidence.date}: </strong>{evidence.fact}</li>)}</ul>
            </details>
          </article>)}
        </div>
      </> : null}
    </section>
  );
}
