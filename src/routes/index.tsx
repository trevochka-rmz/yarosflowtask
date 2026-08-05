import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles, ArrowRight, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { FilePicker, PickedFiles } from "@/components/Attachments";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, formatDate, type Task } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { useVoiceInput } from "@/lib/use-voice-input";


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
  const [files, setFiles] = useState<File[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rawText: string) => {
      const userId = user?.id ?? 1;
      const created = await api.createTask(userId, rawText);
      if (files.length) {
        try {
          await api.uploadAttachments(created.id, userId, files);
          toast.success("Файлы прикреплены");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      setTask(created);
      setText("");
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Техническое задание готово");
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const loading = mutation.isPending;

  const voice = useVoiceInput({
    onText: (spoken) => setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken)),
    onError: (message) => toast.error(message),
  });

  return (
    <AppLayout>
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> AI-постановка задач
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-brand-deep sm:text-4xl md:text-5xl">
          Заметка → готовое ТЗ
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Напишите мысль в свободной форме. Система соберёт название, описание, критерии приёмки,
          приоритет и категорию, а затем задачу можно назначить сотрудникам.
        </p>
      </section>

      <section className="mx-auto mt-6 max-w-3xl sm:mt-8">
        <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: нужно переделать личный кабинет, добавить экспорт в Excel и уведомления..."
            className="min-h-32 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 sm:min-h-36"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim()) {
                mutation.mutate(text.trim());
              }
            }}
          />
          <div className="flex flex-col gap-2 px-2 pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {voice.recording
                ? "Идёт запись — нажмите «Стоп», текст появится в поле"
                : voice.transcribing
                  ? "Распознаём речь…"
                  : "Ctrl / ⌘ + Enter — отправить"}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="lg"
                variant={voice.recording ? "destructive" : "outline"}
                className="w-full sm:w-auto"
                disabled={voice.transcribing || loading}
                onClick={voice.toggle}
              >
                {voice.transcribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Распознаём…
                  </>
                ) : voice.recording ? (
                  <>
                    <Square className="h-4 w-4" /> Стоп
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" /> Голосом
                  </>
                )}
              </Button>
              <Button
                size="lg"
                className="w-full sm:w-auto"
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
          {voice.recording ? (
            <div className="flex items-center gap-2 px-2 pb-2 text-xs text-destructive sm:hidden">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Идёт запись…
            </div>
          ) : null}
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
          <div className="bg-brand-gradient px-4 py-4 text-primary-foreground sm:px-6 sm:py-5">
            <div className="text-xs opacity-80">Задача #{task.id}</div>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{task.title}</h2>
          </div>
          <table className="w-full text-sm max-sm:block">
            <tbody className="divide-y divide-border max-sm:block">
              <tr className="max-sm:block">
                <th className="bg-muted/40 px-4 py-2 sm:w-48 sm:px-6 sm:py-3 text-left align-top font-medium text-muted-foreground">
                  Статус
                </th>
                <td className="px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
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
                  Срок (AI)
                </th>
                <td className="px-4 py-3 sm:px-6">{formatDate(task.ai_suggested_deadline)}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-4 sm:flex-row sm:flex-wrap sm:px-6">
            <Button className="w-full sm:w-auto" onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: String(task.id) } })}>
              Открыть и назначить
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link to="/tasks">Все задачи</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </AppLayout>
  );
}
