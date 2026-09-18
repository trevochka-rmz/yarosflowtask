import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CirclePlus,
  Clock,
  ListChecks,
  Loader2,
  Lock,
  TrendingUp,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { AssigneeAvatars, UserAvatar } from "@/components/UserAvatar";
import { formatDate } from "@/lib/api";
import {
  orgApi,
  useCurrentOrg,
  AVAILABILITY_LABELS,
  type DashboardTask,
  type DashboardActivity,
  type DashboardEmployee,
  type DashboardTrendPoint,
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
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-200",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-200",
  critical: "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-200",
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
      <AssigneeAvatars assignees={task.assignees} sizeClassName="h-6 w-6" />
    </Link>
  );
}

function TaskTrend({ points }: { points: DashboardTrendPoint[] }) {
  const normalized = points.map((point) => ({
    ...point,
    updates: Number(point.updates) || 0,
    completed: Number(point.completed) || 0,
  }));
  const maximum = Math.max(1, ...normalized.flatMap((point) => [point.updates, point.completed]));
  const width = 680;
  const height = 190;
  const padding = 22;
  const pointAt = (value: number, index: number) => {
    const x = normalized.length < 2 ? width / 2 : (index * width) / (normalized.length - 1);
    const y = height - padding - ((height - padding * 2) * value) / maximum;
    return `${x},${y}`;
  };
  const line = (key: "updates" | "completed") => normalized.map((point, index) => pointAt(point[key], index)).join(" ");

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> Динамика задач
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Действия и завершения за последние 7 дней</p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" /> Действия</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Выполнено</span>
        </div>
      </div>
      {normalized.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">Пока нет данных для графика.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height + 28}`} className="h-52 w-full" role="img" aria-label="Динамика задач за неделю">
            {[0.25, 0.5, 0.75, 1].map((factor) => (
              <line key={factor} x1="0" x2={width} y1={height - padding - (height - padding * 2) * factor} y2={height - padding - (height - padding * 2) * factor} className="stroke-border" strokeDasharray="3 5" />
            ))}
            <polyline fill="none" points={line("updates")} className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polyline fill="none" points={line("completed")} className="stroke-emerald-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {normalized.map((point, index) => (
              <g key={point.date}>
                <circle cx={pointAt(point.updates, index).split(",")[0]} cy={pointAt(point.updates, index).split(",")[1]} r="4" className="fill-primary" />
                <circle cx={pointAt(point.completed, index).split(",")[0]} cy={pointAt(point.completed, index).split(",")[1]} r="4" className="fill-emerald-500" />
                <text x={normalized.length < 2 ? width / 2 : (index * width) / (normalized.length - 1)} y={height + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(`${point.date}T12:00:00`))}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}

function StatusOverview({ counters }: { counters: { total: number; new: number; in_progress: number; waiting: number; completed: number; overdue: number } }) {
  const items = [
    { label: "Новые", value: counters.new, color: "bg-sky-500" },
    { label: "В работе", value: counters.in_progress, color: "bg-violet-500" },
    { label: "Ожидают", value: counters.waiting, color: "bg-amber-500" },
    { label: "Выполнено", value: counters.completed, color: "bg-emerald-500" },
    { label: "Просрочено", value: counters.overdue, color: "bg-rose-500" },
  ];
  const total = Math.max(1, counters.total);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold text-foreground"><BarChart3 className="h-4 w-4 text-primary" /> Статус задач</h2>
      <div className="mt-5 flex items-center gap-5">
        <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#10b981 0deg ${(counters.completed / total) * 360}deg, #8b5cf6 ${(counters.completed / total) * 360}deg ${((counters.completed + counters.in_progress) / total) * 360}deg, #f59e0b ${((counters.completed + counters.in_progress) / total) * 360}deg ${((counters.completed + counters.in_progress + counters.waiting) / total) * 360}deg, #0ea5e9 ${((counters.completed + counters.in_progress + counters.waiting) / total) * 360}deg 360deg)` }}>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-center"><b className="text-xl">{counters.total}</b><span className="-mt-5 text-[10px] text-muted-foreground">всего</span></div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {items.map((item) => <li key={item.label} className="flex items-center gap-2 text-sm"><i className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} /><span className="min-w-0 flex-1 text-muted-foreground">{item.label}</span><b>{item.value}</b><span className="w-9 text-right text-xs text-muted-foreground">{Math.round((item.value / total) * 100)}%</span></li>)}
        </ul>
      </div>
    </section>
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
              <UserAvatar avatarUrl={e.avatar_url} name={e.full_name || e.username} />
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
  const canView = can("task.read");

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
          Для доступа нужно право <code>task.read</code>.
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
      {/* Заголовок и действия */}
      <div className="rounded-3xl border border-border bg-surface-gradient p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Управление организацией</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">Директорский центр</h1>
          <p className="mt-1 text-sm text-muted-foreground">{org.name} · оперативная картина по задачам и команде</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild className="flex-1 sm:flex-none"><Link to="/taskflow"><CirclePlus className="h-4 w-4" /> Создать задачу</Link></Button>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
          </Button>
        </div>
      </div>
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
              color="border-blue-200 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/35"
            />
            <CounterCard
              label="В работе"
              value={data.counters.in_progress}
              color="border-indigo-200 bg-indigo-50 dark:border-indigo-900/70 dark:bg-indigo-950/35"
            />
            <CounterCard
              label="Ожидание"
              value={data.counters.waiting}
              color="border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/35"
            />
            <CounterCard
              label="Просрочено"
              value={data.counters.overdue}
              color={
                data.counters.overdue > 0
                  ? "border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/35"
                  : "border-border bg-card"
              }
            />
            <CounterCard
              label="Без исполнителя"
              value={data.counters.unassigned}
              color={
                data.counters.unassigned > 0
                  ? "border-orange-200 bg-orange-50 dark:border-orange-900/70 dark:bg-orange-950/35"
                  : "border-border bg-card"
              }
            />
            <CounterCard
              label="Выполнено"
              value={data.counters.completed}
              color="border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/35"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
            <TaskTrend points={data.task_trend ?? []} />
            <StatusOverview counters={data.counters} />
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
