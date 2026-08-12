import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  Lock,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import {
  orgApi,
  useCurrentOrg,
  AVAILABILITY_LABELS,
  type DashboardTask,
  type DashboardActivity,
  type DashboardEmployee,
  type AvailabilityStatus,
} from "@/lib/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/director")({
  head: () => ({
    meta: [
      { title: "Директорский центр — Yaya.ЦифровойБот" },
      { property: "og:title", content: "Директорский центр — Yaya.ЦифровойБот" },
    ],
  }),
  component: DirectorPage,
});

/* ── Цвет точки статуса ── */
function statusDotColor(s: AvailabilityStatus | null) {
  switch (s) {
    case "AVAILABLE":
      return "bg-emerald-500";
    case "BUSY":
      return "bg-amber-500";
    case "AWAY":
      return "bg-yellow-400";
    case "VACATION":
      return "bg-sky-400";
    case "SICK_LEAVE":
      return "bg-rose-400";
    case "OFFLINE":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}

/* ── Цвет приоритета ── */
const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

/* ── Карточка одной задачи ── */
function TaskRow({ task, accent }: { task: DashboardTask; accent?: string | undefined }) {
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: String(task.id) }}
      className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-accent/30"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        {task.deadline && (
          <p className={cn("mt-0.5 text-xs", accent ?? "text-muted-foreground")}>
            <Clock className="mr-1 inline h-3 w-3" />
            {new Date(task.deadline).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
            })}
          </p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          PRIORITY_BADGE[task.priority] ?? "bg-muted text-muted-foreground",
        )}
      >
        {PRIORITY_LABEL[task.priority] ?? task.priority}
      </span>
    </Link>
  );
}

/* ── Раскрываемый блок задач ── */
const PREVIEW = 4;
function TaskBlock({
  title,
  icon: Icon,
  tasks,
  accentText,
  iconColor,
  empty,
}: {
  title: string;
  icon: typeof AlertTriangle;
  tasks: DashboardTask[];
  accentText?: string;
  iconColor?: string;
  empty: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tasks : tasks.slice(0, PREVIEW);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", iconColor ?? "text-muted-foreground")} />
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {shown.map((t) => (
            <TaskRow key={t.id} task={t} accent={accentText} />
          ))}
          {tasks.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 w-full rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {expanded ? "Свернуть" : `Ещё ${tasks.length - PREVIEW}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Счётчик-карточка ── */
function CounterCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 shadow-soft", color ?? "border-border bg-card")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── Лента активности ── */
function ActivityFeed({ items }: { items: DashboardActivity[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 8);
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 shadow-soft">
      <h3 className="font-semibold text-foreground">Лента действий</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Активности пока нет.</p>
      ) : (
        <ol className="mt-3 space-y-0 divide-y divide-border">
          {shown.map((a, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
                <Zap className="h-3 w-3 text-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <Link
                    to="/tasks/$taskId"
                    params={{ taskId: String(a.task_id) }}
                    className="font-medium text-foreground hover:underline"
                  >
                    {a.task_title}
                  </Link>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.actor_name ?? "Система"} · {a.field_changed}:{" "}
                  <span className="line-through opacity-60">{a.old_value ?? "—"}</span> →{" "}
                  <span className="font-medium text-foreground">{a.new_value ?? "—"}</span>
                </p>
              </div>
              <time className="shrink-0 text-[10px] text-muted-foreground">
                {formatDate(a.changed_at).split(",")[0]}
              </time>
            </li>
          ))}
        </ol>
      )}
      {items.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {expanded ? "Свернуть" : `Ещё ${items.length - 8} событий`}
        </button>
      )}
    </div>
  );
}

/* ── Блок сотрудников ── */
function EmployeesBlock({ employees }: { employees: DashboardEmployee[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? employees : employees.slice(0, 6);

  // Группируем: сначала доступные, потом остальные
  const sorted = [...employees].sort((a, b) => {
    const order: Record<string, number> = {
      AVAILABLE: 0,
      BUSY: 1,
      AWAY: 2,
      VACATION: 3,
      SICK_LEAVE: 4,
      OFFLINE: 5,
    };
    return (order[a.availability_status ?? ""] ?? 9) - (order[b.availability_status ?? ""] ?? 9);
  });
  const shownSorted = expanded ? sorted : sorted.slice(0, 6);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">Сотрудники</h3>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Link to="/members">
            Все <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {employees.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Сотрудников нет.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {shownSorted.map((e) => (
            <li key={e.user_id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              {/* Аватар-инициал */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {(e.full_name || e.username || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {e.full_name || (e.username ? `@${e.username}` : `#${e.user_id}`)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{e.role_name ?? "—"}</p>
              </div>
              {/* Статус */}
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn("h-2.5 w-2.5 rounded-full", statusDotColor(e.availability_status))}
                />
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {e.availability_status ? AVAILABILITY_LABELS[e.availability_status] : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {employees.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {expanded ? "Свернуть" : `Ещё ${employees.length - 6} сотрудников`}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Главная страница
═══════════════════════════════════════════ */
function DirectorPage() {
  const { org, can, isLoading: orgLoading } = useCurrentOrg();
  const canView = can("organization.update");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["director-dashboard", org?.id],
    queryFn: () => orgApi.dashboard(org!.id),
    enabled: !!org?.id && canView,
    staleTime: 30_000,
    refetchInterval: 60_000, // автообновление раз в минуту
  });

  if (orgLoading) {
    return (
      <AppLayout>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
        </div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">
          Директорский центр
        </h1>
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Для доступа нужно право <code>organization.update</code>.
        </p>
      </AppLayout>
    );
  }

  if (!org) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Организация не выбрана.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Директорский центр
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{org.name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
        </Button>
      </div>

      {isPending ? (
        /* Skeleton */
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : isError ? (
        <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>
      ) : data ? (
        <div className="mt-6 space-y-5">
          {/* ── Счётчики ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <CounterCard label="Всего задач" value={data.counters.total} />
            <CounterCard
              label="Новые"
              value={data.counters.new}
              color="border-blue-200 bg-blue-50"
            />
            <CounterCard
              label="В работе"
              value={data.counters.in_progress}
              color="border-indigo-200 bg-indigo-50"
            />
            <CounterCard
              label="Ожидание"
              value={data.counters.waiting}
              color="border-amber-200 bg-amber-50"
            />
            <CounterCard
              label="Просрочено"
              value={data.counters.overdue}
              color={
                data.counters.overdue > 0 ? "border-red-200 bg-red-50" : "border-border bg-card"
              }
            />
            <CounterCard
              label="Без исполнителя"
              value={data.counters.unassigned}
              color={
                data.counters.unassigned > 0
                  ? "border-orange-200 bg-orange-50"
                  : "border-border bg-card"
              }
            />
            <CounterCard
              label="Выполнено"
              value={data.counters.completed}
              color="border-emerald-200 bg-emerald-50"
            />
          </div>

          {/* ── Быстрая ссылка на все задачи ── */}
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link to="/tasks">
                <ListChecks className="mr-1.5 h-4 w-4" /> Все задачи
              </Link>
            </Button>
          </div>

          {/* ── Три блока задач (2 колонки на md) ── */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TaskBlock
              title="Просроченные"
              icon={AlertTriangle}
              iconColor="text-red-500"
              tasks={data.overdue_tasks}
              accentText="text-red-500"
              empty="Просроченных задач нет — отлично!"
            />
            <TaskBlock
              title="Без исполнителя"
              icon={UserCog}
              iconColor="text-orange-500"
              tasks={data.unassigned_tasks}
              empty="Все задачи назначены."
            />
            <TaskBlock
              title="В ожидании"
              icon={Clock}
              iconColor="text-amber-500"
              tasks={data.waiting_tasks}
              empty="Ожидающих задач нет."
            />
          </div>

          {/* ── Сотрудники + Лента (2 колонки на lg) ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <EmployeesBlock employees={data.employees} />
            <ActivityFeed items={data.recent_activity} />
          </div>

          {/* ── Итого по статусам (мини-таблица) ── */}
          {Object.keys(data.counters.by_status).length > 0 && (
            <div className="rounded-2xl border border-border bg-card/50 p-4 shadow-soft">
              <h3 className="mb-3 font-semibold text-foreground">Разбивка по статусам</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {Object.entries(data.counters.by_status).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{status}</span>
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </AppLayout>
  );
}
