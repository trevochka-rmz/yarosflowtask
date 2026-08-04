import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { api, formatDate, STATUS_LABELS, type Task, type TaskStatus } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks/")({
  head: () => ({
    meta: [
      { title: "Задачи — YAROS.TaskFlow" },
      { name: "description", content: "Все технические задания: статусы, приоритеты и исполнители." },
      { property: "og:title", content: "Задачи — YAROS.TaskFlow" },
      { property: "og:description", content: "Список задач со статусами, приоритетами и сроками." },
    ],
  }),
  component: TasksPage,
});

type Scope = "all" | "author" | "assigned";

function TasksPage() {
  const { data: user } = useCurrentUser();
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const userId = user?.id ?? 1;

  const query = useQuery({
    queryKey: ["tasks", scope, status, userId],
    queryFn: async (): Promise<Task[]> => {
      const qs = status ? `?status=${status}` : "";
      if (scope === "author") return api.tasksByAuthor(userId, qs);
      if (scope === "assigned") return api.tasksAssigned(userId, qs);
      return api.tasks(qs);
    },
  });

  const scopes: { key: Scope; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "author", label: "Мои созданные" },
    { key: "assigned", label: "Назначенные мне" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-deep">Задачи</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Отслеживайте прогресс от постановки ТЗ до выполнения.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-border bg-card p-1">
        {scopes.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              scope === s.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {query.isPending ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="p-6 text-sm text-destructive">{(query.error as Error).message}</p>
        ) : (query.data?.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Задач пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Название</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Приоритет</th>
                  <th className="px-4 py-3 font-medium">Категория</th>
                  <th className="px-4 py-3 font-medium">Создана</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.data?.map((task) => (
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
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{task.category ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(task.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
