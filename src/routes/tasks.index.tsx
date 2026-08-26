import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { AssignmentBadge, PriorityBadge, SourceBadge, StatusBadge } from "@/components/Badges";
import { DeleteTaskButton } from "@/components/DeleteTaskButton";
import { ExportMenu } from "@/components/ExportMenu";
import { Input } from "@/components/ui/input";

import {
  api,
  assigneeCount,
  formatDate,
  STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { integrationApi, useCurrentTenant } from "@/lib/platform";
import { orgApi } from "@/lib/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks/")({
  head: () => ({
    meta: [
      { title: "Задачи — Yaya.ЦифровойБот" },
      {
        name: "description",
        content: "Все технические задания: статусы, приоритеты и исполнители.",
      },
      { property: "og:title", content: "Задачи — Yaya.ЦифровойБот" },
      { property: "og:description", content: "Список задач со статусами, приоритетами и сроками." },
    ],
  }),
  component: TasksPage,
});

type Scope = "all" | "author" | "assigned";
type Assignment = "any" | "yes" | "no";
type SourceFilter = "all" | "internal" | "jira";

function TasksPage() {
  const { data: user } = useCurrentUser();
  const { tenant } = useCurrentTenant();
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [assignment, setAssignment] = useState<Assignment>("any");
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const userId = user?.id ?? 0;
  const organizationId = tenant?.id;

  const integrations = useQuery({
    queryKey: ["integrations", organizationId],
    enabled: !!organizationId,
    queryFn: () => integrationApi.list(organizationId!),
  });

  const hasActiveJira = (integrations.data ?? []).some(
    (i) => i.provider === "JIRA" && i.status === "ACTIVE",
  );

  const query = useQuery({
    queryKey: ["tasks", scope, status, assignment, source, search, userId, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Task[]> => {
      if (!organizationId) return [];
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (assignment !== "any") params.set("assigned", assignment);
      if (source !== "all") params.set("source", source);
      if (search.trim()) params.set("search", search.trim());
      const qs = params.toString() ? `?${params.toString()}` : "";
      if (scope === "author") return api.tasksByAuthor(userId, organizationId, qs);
      if (scope === "assigned") return api.tasksMine(organizationId, qs);
      return api.tasks(organizationId, qs);
    },
  });

  const syncJira = useMutation({
    mutationFn: (payload: { maxResults?: number; jql?: string }) => {
      if (!organizationId) throw new Error("Организация не выбрана");
      return orgApi.tasksSyncJira(organizationId, payload);
    },
    onSuccess: (res) => {
      toast.success(
        res?.synced && res.synced > 0
          ? `Синхронизировано задач из Jira: ${res.synced}`
          : "Синхронизация с Jira выполнена",
      );
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = query.data ?? [];

  const scopes: { key: Scope; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "author", label: "Мои созданные" },
    { key: "assigned", label: "Назначенные мне" },
  ];

  const assignments: { key: Assignment; label: string }[] = [
    { key: "any", label: "Все" },
    { key: "yes", label: "С исполнителем" },
    { key: "no", label: "Без исполнителя" },
  ];

  const sources: { key: SourceFilter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "internal", label: "Только наши" },
    ...(hasActiveJira ? [{ key: "jira", label: "Только Jira" as const }] : []),
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Задачи
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Отслеживайте прогресс от постановки ТЗ до выполнения.
          </p>
        </div>
        {hasActiveJira && (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground sm:w-auto"
            disabled={syncJira.isPending}
            onClick={() =>
              syncJira.mutate({
                maxResults: 50,
                jql: "statusCategory != Done ORDER BY updated DESC",
              })
            }
          >
            {syncJira.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Синхронизировать Jira
          </button>
        )}
      </div>

      {/* Фильтры */}
      <div className="mt-4 space-y-3">
        <div className="grid w-full gap-3 md:grid-cols-2">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, описанию или ключу Jira…"
              className="w-full pl-8"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap">
          <div className="flex w-full rounded-lg border border-border bg-card p-1 md:w-auto">
            {scopes.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm md:flex-none",
                  scope === s.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex w-full rounded-lg border border-border bg-card p-1 md:w-auto">
            {sources.map((s) => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm md:flex-none",
                  source === s.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex w-full rounded-lg border border-border bg-card p-1 md:w-auto">
            {assignments.map((a) => (
              <button
                key={a.key}
                onClick={() => setAssignment(a.key)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm md:flex-none",
                  assignment === a.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {!organizationId ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Выберите организацию для просмотра задач.
          </p>
        ) : query.isPending ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
            {(query.error as Error).message}
          </p>
        ) : tasks.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Задач пока нет.
          </p>
        ) : (
          <>
            {/* Мобильные карточки */}
            <ul className="space-y-3 md:hidden">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <SourceBadge
                          source={task.source ?? undefined}
                          externalKey={task.external_key ?? undefined}
                        />
                      </div>
                      <Link
                        to="/tasks/$taskId"
                        params={{ taskId: String(task.id) }}
                        className="block min-w-0 font-medium text-foreground"
                      >
                        {task.title}
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <ExportMenu taskId={task.id} />
                      <DeleteTaskButton
                        taskId={task.id}
                        title={task.title}
                        tenantId={organizationId}
                      />
                    </div>
                  </div>
                  <Link to="/tasks/$taskId" params={{ taskId: String(task.id) }} className="block">
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {task.source === "jira" && task.external_status ? (
                        <span className="font-medium">
                          {task.external_status} <span className="text-muted-foreground">→</span>
                        </span>
                      ) : null}
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      <AssignmentBadge count={assigneeCount(task)} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        #{task.id} · {task.category ?? "Без категории"} ·{" "}
                        {formatDate(task.created_at)}
                      </span>
                      {task.source === "jira" && task.external_url ? (
                        <a
                          href={task.external_url}
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          🔗 Открыть в Jira
                        </a>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Таблица для больших экранов */}
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Источник</th>
                      <th className="px-4 py-3 font-medium">Название</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-4 py-3 font-medium">Исполнители</th>
                      <th className="px-4 py-3 font-medium">Приоритет</th>
                      <th className="px-4 py-3 font-medium">Категория</th>
                      <th className="px-4 py-3 font-medium">Создана</th>
                      <th className="px-4 py-3 font-medium text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tasks.map((task) => (
                      <tr key={task.id} className="transition-colors hover:bg-accent/40">
                        <td className="px-4 py-3 text-muted-foreground">{task.id}</td>
                        <td className="px-4 py-3">
                          <SourceBadge
                            source={task.source ?? undefined}
                            externalKey={task.external_key ?? undefined}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to="/tasks/$taskId"
                            params={{ taskId: String(task.id) }}
                            className="font-medium text-primary hover:underline"
                          >
                            {task.title}
                          </Link>
                          {task.source === "jira" && task.external_status ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {task.external_status}{" "}
                              <span className="text-muted-foreground">→</span>{" "}
                              {STATUS_LABELS[task.status]}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-3">
                          <AssignmentBadge count={assigneeCount(task)} />
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{task.category ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(task.created_at)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {task.source === "jira" && task.external_url ? (
                              <a
                                href={task.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                              >
                                🔗 Jira
                              </a>
                            ) : null}
                            <ExportMenu taskId={task.id} />
                            <DeleteTaskButton
                              taskId={task.id}
                              title={task.title}
                              tenantId={organizationId}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
