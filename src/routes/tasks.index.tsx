import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Columns3, List, Loader2, RefreshCw, Search, UserRound } from "lucide-react";
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
  type BoardColumnKey,
  type BoardTask,
  type Task,
  type TasksBoard,
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
type TasksView = "table" | "board";

function TasksPage() {
  const { data: user } = useCurrentUser();
  const { tenant } = useCurrentTenant();
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [assignment, setAssignment] = useState<Assignment>("any");
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [view, setView] = useState<TasksView>("table");
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

  const projectsQuery = useQuery({
    queryKey: ["task-projects", organizationId],
    enabled: !!organizationId && hasActiveJira,
    queryFn: () => api.taskProjects(organizationId!),
  });

  const query = useQuery({
    queryKey: [
      "tasks",
      scope,
      status,
      assignment,
      source,
      search,
      projectKey,
      userId,
      organizationId,
    ],
    enabled: !!organizationId && view === "table",
    queryFn: async (): Promise<Task[]> => {
      if (!organizationId) return [];
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (assignment !== "any") params.set("assigned", assignment);
      if (source !== "all") params.set("source", source);
      if (search.trim()) params.set("search", search.trim());
      if (hasActiveJira && projectKey) params.set("projectKey", projectKey);
      const qs = params.toString() ? `?${params.toString()}` : "";
      if (scope === "author") return api.tasksByAuthor(userId, organizationId, qs);
      if (scope === "assigned") return api.tasksMine(organizationId, qs);
      return api.tasks(organizationId, qs);
    },
  });

  const boardQueryKey = [
    "tasks-board",
    scope,
    assignment,
    source,
    search,
    projectKey,
    userId,
    organizationId,
  ] as const;
  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    enabled: !!organizationId && view === "board",
    queryFn: () => {
      if (!organizationId) throw new Error("Организация не выбрана");
      const params = new URLSearchParams();
      if (scope === "author") params.set("authorId", String(userId));
      if (scope === "assigned") params.set("assigned", "me");
      else if (assignment !== "any") params.set("assigned", assignment);
      if (source !== "all") params.set("source", source);
      if (search.trim()) params.set("search", search.trim());
      if (hasActiveJira && projectKey) params.set("projectKey", projectKey);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return api.tasksBoard(organizationId, qs);
    },
  });

  const moveTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) => {
      if (!organizationId) throw new Error("Организация не выбрана");
      return api.setStatus(taskId, status, organizationId);
    },
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: boardQueryKey });
      const previousBoard = qc.getQueryData<TasksBoard>(boardQueryKey);
      if (!previousBoard) return { previousBoard };

      const targetColumn =
        BOARD_COLUMNS.find((column) => BOARD_COLUMN_STATUS[column] === status) ?? "BACKLOG";
      let movedTask: BoardTask | undefined;
      const columns = Object.fromEntries(
        BOARD_COLUMNS.map((key) => {
          const tasks = previousBoard.columns[key] ?? [];
          const found = tasks.find((task) => task.id === taskId);
          if (found) movedTask = found;
          return [key, tasks.filter((task) => task.id !== taskId)];
        }),
      ) as TasksBoard["columns"];

      if (movedTask) {
        columns[targetColumn] = [
          { ...movedTask, status, board_column: targetColumn },
          ...columns[targetColumn],
        ];
        qc.setQueryData<TasksBoard>(boardQueryKey, {
          ...previousBoard,
          columns,
          counts: Object.fromEntries(
            BOARD_COLUMNS.map((key) => [key, columns[key].length]),
          ) as TasksBoard["counts"],
        });
      }
      return { previousBoard };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousBoard) qc.setQueryData(boardQueryKey, context.previousBoard);
      toast.error(error.message || "Не удалось изменить статус задачи");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: boardQueryKey });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
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
      void qc.invalidateQueries({ queryKey: ["tasks-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = query.data ?? [];
  const board = boardQuery.data;

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
    <AppLayout wide>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Задачи
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Отслеживайте прогресс от постановки ТЗ до выполнения.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex w-full rounded-lg border border-border bg-card p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                view === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-4 w-4" /> Таблица
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                view === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Columns3 className="h-4 w-4" /> Канбан
            </button>
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
      </div>

      {/* Фильтры */}
      <div className="mt-4 space-y-3">
        <div className={cn("grid w-full gap-3", view === "table" && "md:grid-cols-2")}>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, описанию или ключу Jira…"
              className="w-full pl-8"
            />
          </div>
          {view === "table" && (
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
          )}
        </div>

        {hasActiveJira && (
          <select
            value={projectKey}
            disabled={projectsQuery.isPending}
            onChange={(event) => setProjectKey(event.target.value)}
            aria-label="Фильтр по Jira-проекту"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              {projectsQuery.isPending ? "Загрузка проектов…" : "Все Jira-проекты"}
            </option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.project_key} value={project.project_key}>
                {project.project_name} ({project.project_key}) · {project.task_count}
              </option>
            ))}
          </select>
        )}

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
        ) : view === "board" ? (
          boardQuery.isPending ? (
            <div className="-mx-4 overflow-hidden px-4 sm:-mx-6 sm:px-6">
              <div className="grid min-w-full w-max grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-4">
                {BOARD_COLUMNS.map((column) => (
                  <div key={column} className="h-48 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            </div>
          ) : boardQuery.isError ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
              {(boardQuery.error as Error).message}
            </p>
          ) : board ? (
            <KanbanBoard
              board={board}
              movingTaskId={moveTask.isPending ? moveTask.variables?.taskId : undefined}
              onMove={(taskId, column) =>
                moveTask.mutate({ taskId, status: BOARD_COLUMN_STATUS[column] })
              }
            />
          ) : null
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

const BOARD_COLUMNS: BoardColumnKey[] = [
  "BACKLOG",
  "SELECTED",
  "WAITING",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "CANCELLED",
];
const BOARD_COLUMN_STATUS: Record<BoardColumnKey, TaskStatus> = {
  BACKLOG: "BACKLOG",
  SELECTED: "SELECTED",
  WAITING: "WAITING",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW: "REVIEW",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
};
const BOARD_LABELS: Record<BoardColumnKey, string> = {
  BACKLOG: "Новые задачи",
  SELECTED: "На утверждении",
  WAITING: "Ожидает исполнения",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Выполнено",
  CANCELLED: "Отменено",
};

function getBoardAssignee(task: BoardTask) {
  if (task.assignee_label) return task.assignee_label;
  const internalNames = (task.assignees ?? [])
    .map((assignee) => assignee.full_name || assignee.username)
    .filter(Boolean);
  if (internalNames.length > 0) return internalNames.join(", ");
  return task.external_assignee_name || "Без исполнителя";
}

function KanbanBoard({
  board,
  movingTaskId,
  onMove,
}: {
  board: TasksBoard;
  movingTaskId?: number;
  onMove: (taskId: number, column: BoardColumnKey) => void;
}) {
  const [dragOverColumn, setDragOverColumn] = useState<BoardColumnKey | null>(null);
  const metaLabels = Object.fromEntries(
    board.columnsMeta.map((column) => [column.key, column.label]),
  ) as Partial<Record<BoardColumnKey, string>>;

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">Всего задач: {board.total}</p>
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        <div className="grid min-w-full w-max grid-flow-col auto-cols-[minmax(15rem,1fr)] items-start gap-4">
          {BOARD_COLUMNS.map((columnKey) => {
            const columnTasks = board.columns[columnKey] ?? [];
            return (
              <section
                key={columnKey}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverColumn(columnKey);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragOverColumn(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverColumn(null);
                  const taskId = Number(event.dataTransfer.getData("text/plain"));
                  const taskAlreadyHere = columnTasks.some((task) => task.id === taskId);
                  if (Number.isFinite(taskId) && !taskAlreadyHere) onMove(taskId, columnKey);
                }}
                className={cn(
                  "min-w-0 rounded-2xl border border-border bg-muted/35 p-3 transition-colors",
                  dragOverColumn === columnKey && "border-primary bg-primary/5",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h2 className="font-semibold text-foreground">
                    {metaLabels[columnKey] ?? BOARD_LABELS[columnKey]}
                  </h2>
                  <span className="inline-flex min-w-7 justify-center rounded-full bg-card px-2 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                    {board.counts[columnKey] ?? columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnTasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-card/50 px-3 py-6 text-center text-xs text-muted-foreground">
                      Нет задач
                    </p>
                  ) : (
                    columnTasks.map((task) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        isMoving={movingTaskId === task.id}
                        onMove={(column) => onMove(task.id, column)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KanbanTaskCard({
  task,
  isMoving,
  onMove,
}: {
  task: BoardTask;
  isMoving: boolean;
  onMove: (column: BoardColumnKey) => void;
}) {
  const project = task.project_name || task.project_key || "Без проекта";

  return (
    <article
      draggable={!isMoving}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(task.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
        isMoving && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceBadge source={task.source} externalKey={task.external_key} />
        <StatusBadge status={task.status} />
      </div>
      <Link
        to="/tasks/$taskId"
        params={{ taskId: String(task.id) }}
        className="mt-2 block font-medium leading-snug text-foreground hover:text-primary"
      >
        {task.title}
      </Link>
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="truncate" title={project}>
          Проект: <span className="font-medium text-foreground">{project}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{getBoardAssignee(task)}</span>
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {task.priority ? <PriorityBadge priority={task.priority} /> : <span />}
        {task.external_url ? (
          <a
            href={task.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary hover:underline"
          >
            Открыть в Jira
          </a>
        ) : null}
      </div>
      <label className="mt-3 block border-t border-border pt-2 text-xs text-muted-foreground lg:hidden">
        Переместить в
        <select
          value={task.board_column}
          disabled={isMoving}
          onChange={(event) => onMove(event.target.value as BoardColumnKey)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground"
        >
          {BOARD_COLUMNS.map((column) => (
            <option key={column} value={column}>
              {BOARD_LABELS[column]}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
