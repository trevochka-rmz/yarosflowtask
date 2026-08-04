import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, formatDate, type Task } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YAROS.TaskFlow — заметка превращается в ТЗ" },
      {
        name: "description",
        content:
          "Превращаем мысли в задачи. Создавайте, назначайте, контролируйте — всё в одном месте.",
      },
      { property: "og:title", content: "YAROS.TaskFlow — заметка превращается в ТЗ" },
      {
        property: "og:description",
        content: "Превращаем мысли в задачи. Создавайте, назначайте, контролируйте — всё в одном месте.",
      },
    ],
  }),
  component: Index,
});

const EXAMPLES = [
  "Нужно сделать авторизацию через JWT и Telegram Login",
  "Клиенты жалуются на медленную загрузку каталога, надо ускорить",
  "Подготовить отчёт по продажам за квартал с графиками",
];

function Index() {
  const [text, setText] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rawText: string) => api.createTask(user?.id ?? 1, rawText),
    onSuccess: (created) => {
      setTask(created);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Техническое задание готово");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loading = mutation.isPending;

  return (
    <AppLayout>
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> AI-постановка задач
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-brand-deep sm:text-5xl">
          Заметка → готовое ТЗ
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Напишите мысль в свободной форме. Система соберёт название, описание, критерии приёмки,
          приоритет и категорию, а затем задачу можно назначить сотрудникам.
        </p>
      </section>

      <section className="mx-auto mt-8 max-w-3xl">
        <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: нужно переделать личный кабинет, добавить экспорт в Excel и уведомления..."
            className="min-h-36 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim()) {
                mutation.mutate(text.trim());
              }
            }}
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <span className="text-xs text-muted-foreground">Ctrl / ⌘ + Enter — отправить</span>
            <Button
              size="lg"
              disabled={loading || !text.trim()}
              onClick={() => mutation.mutate(text.trim())}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> AI формирует ТЗ…
                </>
              ) : (
                <>
                  Создать ТЗ <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="mx-auto mt-10 max-w-3xl animate-pulse space-y-3 rounded-2xl border border-border bg-card p-6">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
          <div className="h-3 w-4/6 rounded bg-muted" />
        </section>
      ) : null}

      {task && !loading ? (
        <section className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="bg-brand-gradient px-6 py-5 text-primary-foreground">
            <div className="text-xs opacity-80">Задача #{task.id}</div>
            <h2 className="mt-1 text-2xl font-semibold">{task.title}</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-48 bg-muted/40 px-6 py-3 text-left align-top font-medium text-muted-foreground">
                  Статус
                </th>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                  </div>
                </td>
              </tr>
              <tr>
                <th className="bg-muted/40 px-6 py-3 text-left align-top font-medium text-muted-foreground">
                  Категория
                </th>
                <td className="px-6 py-3">{task.category ?? "—"}</td>
              </tr>
              <tr>
                <th className="bg-muted/40 px-6 py-3 text-left align-top font-medium text-muted-foreground">
                  Описание
                </th>
                <td className="px-6 py-3 whitespace-pre-wrap">{task.description}</td>
              </tr>
              <tr>
                <th className="bg-muted/40 px-6 py-3 text-left align-top font-medium text-muted-foreground">
                  Критерии приёмки
                </th>
                <td className="px-6 py-3 whitespace-pre-wrap">{task.acceptance_criteria}</td>
              </tr>
              <tr>
                <th className="bg-muted/40 px-6 py-3 text-left align-top font-medium text-muted-foreground">
                  Срок (AI)
                </th>
                <td className="px-6 py-3">{formatDate(task.ai_suggested_deadline)}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-6 py-4">
            <Button onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: String(task.id) } })}>
              Открыть и назначить
            </Button>
            <Button variant="outline" asChild>
              <Link to="/tasks">Все задачи</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </AppLayout>
  );
}
