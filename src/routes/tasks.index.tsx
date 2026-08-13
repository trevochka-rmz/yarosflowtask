import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AssignmentBadge, PriorityBadge, StatusBadge } from "@/components/Badges";
import { DeleteTaskButton } from "@/components/DeleteTaskButton";
import { ExportMenu } from "@/components/ExportMenu";

import {
  api,
  assigneeCount,
  formatDate,
  STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { useCurrentTenant } from "@/lib/platform";
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
type Assignment = "any" | "with" | "without";

function TasksPage() {
  const { data: user } = useCurrentUser();
  const { tenant } = useCurrentTenant();
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [assignment, setAssignment] = useState<Assignment>("any");
  const userId = user?.id ?? 0;
  const organizationId = tenant?.id;

  const query = useQuery({
    queryKey: ["tasks", scope, status, assignment, userId, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Task[]> => {
      if (!organizationId) return [];
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (assignment === "without") params.set("unassigned", "true");
      const qs = params.toString() ? `?${params.toString()}` : "";
      if (scope === "author") return api.tasksByAuthor(userId, organizationId, qs);
      if (scope === "assigned") return api.tasksMine(organizationId, qs);
      return api.tasks(organizationId, qs);
    },
  });

  const tasks = query.data ?? [];

  const scopes: { key: Scope; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "author", label: "Мои созданные" },
    { key: "assigned", label: "Назначенные мне" },
  ];

  const assignments: { key: Assignment; label: string }[] = [
    { key: "any", label: "Все" },
    { key: "with", label: "Назначенные" },
    { key: "without", label: "Без исполнителя" },
  ];

  return (
    <AppLayout>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
          Задачи
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Отслеживайте прогресс от постановки ТЗ до выполнения.
        </p>
      </div>

      {/* Фильтры — мобильные: столбцом, десктоп: одна строка */}
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm md:w-44"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {scopes.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  scope === s.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {assignments.map((a) => (
              <button
                key={a.key}
                onClick={() => setAssignment(a.key)}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: String(task.id) }}
                      className="min-w-0 font-medium text-foreground"
                    >
                      {task.title}
                    </Link>
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
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      <AssignmentBadge count={assigneeCount(task)} />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      #{task.id} · {task.category ?? "Без категории"} ·{" "}
                      {formatDate(task.created_at)}
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
                          <Link
                            to="/tasks/$taskId"
                            params={{ taskId: String(task.id) }}
                            className="font-medium text-primary hover:underline"
                          >
                            {task.title}
                          </Link>
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
                          <div className="flex items-center justify-end gap-0.5">
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
