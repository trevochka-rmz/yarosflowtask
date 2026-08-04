import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { AssignmentBadge, PriorityBadge, StatusBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  formatDate,
  nextStatuses,
  STATUS_LABELS,
  userLabel,
  type TaskStatus,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/tasks/$taskId")({
  head: () => ({
    meta: [
      { title: "Карточка задачи — YAROS.TaskFlow" },
      {
        name: "description",
        content: "Техническое задание, исполнители, статусы, комментарии и история изменений.",
      },
      { property: "og:title", content: "Карточка задачи — YAROS.TaskFlow" },
      { property: "og:description", content: "Полный цикл работы над задачей в одном месте." },
    ],
  }),
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const id = Number(taskId);
  const { data: user } = useCurrentUser();
  const currentId = user?.id ?? 1;
  const role = user?.role ?? "manager";
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const taskQuery = useQuery({ queryKey: ["task", id], queryFn: () => api.task(id) });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => api.employees() });
  const comments = useQuery({ queryKey: ["comments", id], queryFn: () => api.comments(id) });
  const history = useQuery({ queryKey: ["history", id], queryFn: () => api.history(id) });

  const task = taskQuery.data;

  useEffect(() => {
    if (task?.assignees) setSelected(task.assignees.map((a) => a.id));
  }, [task?.id, task?.assignees]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", id] });
    queryClient.invalidateQueries({ queryKey: ["history", id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => api.setStatus(id, status, currentId),
    onSuccess: () => {
      invalidate();
      toast.success("Статус обновлён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: (userIds: number[]) => api.assign(id, userIds, currentId),
    onSuccess: () => {
      invalidate();
      toast.success("Исполнители обновлены");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => api.addComment(id, currentId, body),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (taskQuery.isPending) {
    return (
      <AppLayout>
        <div className="space-y-3">
          <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppLayout>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <AppLayout>
        <p className="text-sm text-destructive">{(taskQuery.error as Error)?.message ?? "Задача не найдена"}</p>
      </AppLayout>
    );
  }

  const transitions = nextStatuses(task.status, role);

  return (
    <AppLayout>
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> К списку задач
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="bg-brand-gradient px-4 py-4 text-primary-foreground sm:px-6 sm:py-5">
              <div className="text-xs opacity-80">Задача #{task.id}</div>
              <h1 className="mt-1 text-xl font-semibold break-words sm:text-2xl">{task.title}</h1>
            </div>
            <table className="w-full text-sm max-sm:block">
              <tbody className="divide-y divide-border max-sm:block">
                <tr className="max-sm:block">
                  <th className="bg-muted/40 px-4 py-2 sm:w-48 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                    Статус / приоритет
                  </th>
                  <td className="px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      <AssignmentBadge count={task.assignees?.length ?? 0} />
                    </div>
                  </td>
                </tr>
                <tr className="max-sm:block">
                  <th className="bg-muted/40 px-4 py-2 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                    Категория
                  </th>
                  <td className="px-4 py-3 sm:px-6">{task.category ?? "—"}</td>
                </tr>
                <tr className="max-sm:block">
                  <th className="bg-muted/40 px-4 py-2 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                    Описание
                  </th>
                  <td className="px-4 py-3 sm:px-6 whitespace-pre-wrap">{task.description}</td>
                </tr>
                <tr className="max-sm:block">
                  <th className="bg-muted/40 px-4 py-2 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                    Критерии приёмки
                  </th>
                  <td className="px-4 py-3 sm:px-6 whitespace-pre-wrap">{task.acceptance_criteria}</td>
                </tr>
                <tr className="max-sm:block">
                  <th className="bg-muted/40 px-4 py-2 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                    Дедлайн
                  </th>
                  <td className="px-4 py-3 sm:px-6">
                    {formatDate(task.deadline ?? task.ai_suggested_deadline)}
                  </td>
                </tr>
                <tr className="max-sm:block">
                  <th className="bg-muted/40 px-4 py-2 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                    Исходная заметка
                  </th>
                  <td className="px-4 py-3 sm:px-6 whitespace-pre-wrap text-muted-foreground">{task.raw_text}</td>
                </tr>
              </tbody>
            </table>
            {transitions.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 border-t border-border bg-muted/30 px-4 py-4 sm:flex sm:flex-wrap sm:px-6">
                {transitions.map((s) => (
                  <Button
                    key={s}
                    variant={s === "done" ? "default" : "outline"}
                    className="w-full sm:w-auto"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(s)}
                  >
                    {STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <h2 className="text-lg font-semibold">Комментарии</h2>
            <div className="mt-4 space-y-4">
              {comments.data?.length ? (
                comments.data.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.author_name || (c.author_username ? `@${c.author_username}` : `#${c.author_id}`)}
                      </span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Комментариев пока нет.</p>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Написать комментарий…"
                className="min-h-20"
              />
              <Button
                className="w-full sm:w-auto"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate(comment.trim())}
              >
                {commentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <h2 className="text-lg font-semibold">Исполнители</h2>
            {task.assignees?.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {task.assignees.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>{userLabel(a)}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(a.assigned_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Никто не назначен.</p>
            )}

            {role === "manager" ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-medium">Назначить сотрудников</p>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {employees.data?.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selected.includes(emp.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked ? [...prev, emp.id] : prev.filter((x) => x !== emp.id),
                          )
                        }
                      />
                      {userLabel(emp)}
                    </label>
                  ))}
                  {employees.isError ? (
                    <p className="text-xs text-destructive">{(employees.error as Error).message}</p>
                  ) : null}
                </div>
                <Button
                  className="mt-3 w-full"
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate(selected)}
                >
                  {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить назначение"}
                </Button>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <h2 className="text-lg font-semibold">История</h2>
            {history.data?.length ? (
              <ol className="mt-3 space-y-3 text-sm">
                {history.data.map((h) => (
                  <li key={h.id} className="border-l-2 border-primary/30 pl-3">
                    <div className="text-xs text-muted-foreground">{formatDate(h.changed_at)}</div>
                    <div>
                      <span className="font-medium">{h.field_changed}</span>: {h.old_value ?? "—"} →{" "}
                      {h.new_value ?? "—"}
                    </div>
                    {h.changed_by_name ? (
                      <div className="text-xs text-muted-foreground">{h.changed_by_name}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Изменений пока нет.</p>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
