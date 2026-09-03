import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Edit2,
  Loader2,
  Mic,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { FilePicker, PickedFiles } from "@/components/Attachments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, userLabel, type Priority } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { useCurrentTenant, aiApi, integrationApi, type AiTaskPreview } from "@/lib/platform";
import { orgApi } from "@/lib/org";
import { useVoiceInput } from "@/lib/use-voice-input";

export const Route = createFileRoute("/taskflow")({
  head: () => ({
    meta: [
      { title: "Yaya.ЦифровойБот · TaskFlow — заметка в ТЗ" },
      {
        name: "description",
        content:
          "Превращаем мысли в задачи. Создавайте, назначайте, контролируйте — всё в одном месте.",
      },
      { property: "og:title", content: "Yaya.ЦифровойБот · TaskFlow — заметка в ТЗ" },
      {
        property: "og:description",
        content: "Цифровой сотрудник TaskFlow: заметка превращается в готовое ТЗ.",
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

/* ===================================================================
   Индикаторы приоритета и категории
   =================================================================== */
const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

/* ===================================================================
   Карточка-превью AI результата
   =================================================================== */
function PreviewCard({
  preview,
  onConfirm,
  onEdit,
  onCancel,
  isPending,
  jiraEnabled,
  publishToJira,
  onPublishToJiraChange,
  jiraMembers,
  jiraProjects,
  selectedProjectKey,
  onSelectedProjectKeyChange,
  selectedJiraUserId,
  onSelectedJiraUserIdChange,
}: {
  preview: AiTaskPreview;
  onConfirm: (p: AiTaskPreview) => void;
  onEdit: (p: AiTaskPreview) => void;
  onCancel: () => void;
  isPending: boolean;
  jiraEnabled: boolean;
  publishToJira: boolean;
  onPublishToJiraChange: (checked: boolean) => void;
  jiraMembers: Array<{
    id: number;
    user_id: number;
    full_name: string | null;
    username: string | null;
    jira_username?: string | null;
  }>;
  jiraProjects: Array<{ key: string; name: string }>;
  selectedProjectKey: string;
  onSelectedProjectKeyChange: (projectKey: string) => void;
  selectedJiraUserId: number | null;
  onSelectedJiraUserIdChange: (userId: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(preview.title);
  const [desc, setDesc] = useState(preview.description);
  const [criteria, setCriteria] = useState(preview.acceptance_criteria);

  const current: AiTaskPreview = {
    ...preview,
    title,
    description: desc,
    acceptance_criteria: criteria,
  };

  if (editing) {
    return (
      <div className="mx-auto mt-8 max-w-3xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-lg font-semibold">Редактировать предложение</h2>
        <div>
          <Label>Название</Label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Описание</Label>
          <Textarea
            className="mt-1 min-h-24 resize-none"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div>
          <Label>Критерии приёмки</Label>
          <Textarea
            className="mt-1 min-h-20 resize-none"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              onEdit(current);
              setEditing(false);
            }}
          >
            <Check className="mr-1 h-4 w-4" /> Готово
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/30 bg-card shadow-soft">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-brand-gradient px-5 py-4 text-primary-foreground">
        <div className="min-w-0">
          <p className="text-xs opacity-75">AI сформировал предложение — проверьте и подтвердите</p>
          <h2 className="mt-1 break-words text-xl font-semibold">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              PRIORITY_COLORS[preview.priority] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {PRIORITY_LABELS[preview.priority] ?? preview.priority}
          </span>
          {preview.category && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">
              {preview.category}
            </span>
          )}
        </div>
      </div>

      {/* Тело */}
      <div className="divide-y divide-border">
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Описание
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm">{desc}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Критерии приёмки
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm">{criteria}</p>
        </div>
      </div>

      {jiraEnabled ? (
        <div className="border-t border-border px-5 py-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={publishToJira}
              onChange={(event) => onPublishToJiraChange(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Добавить задачу в Jira</span>
              <span className="block text-xs text-muted-foreground">
                Проект по умолчанию — PREDEV. Публикация включена по умолчанию.
              </span>
            </span>
          </label>
          {publishToJira ? (
            <div className="mt-3 space-y-3">
              <label className="block space-y-1.5 text-sm font-medium">
                Проект Jira
                <select
                  value={selectedProjectKey}
                  onChange={(event) => onSelectedProjectKeyChange(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {jiraProjects.map((project) => (
                    <option key={project.key} value={project.key}>
                      {project.name} ({project.key})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                Исполнитель Jira
                <select
                  value={selectedJiraUserId ?? ""}
                  onChange={(event) =>
                    onSelectedJiraUserIdChange(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">Без исполнителя</option>
                  {jiraMembers.map((member) => (
                    <option key={member.id} value={member.user_id}>
                      {userLabel({
                        id: member.user_id,
                        full_name: member.full_name,
                        username: member.username,
                      })}
                      {member.jira_username ? ` — ${member.jira_username}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Действия */}
      <div className="flex flex-wrap gap-2 rounded-b-2xl border-t border-border bg-muted/30 px-5 py-4">
        <Button disabled={isPending} onClick={() => onConfirm(current)}>
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          {jiraEnabled && publishToJira ? "Создать и добавить в Jira" : "Создать задачу"}
        </Button>
        <Button variant="outline" disabled={isPending} onClick={() => setEditing(true)}>
          <Edit2 className="mr-1 h-4 w-4" /> Изменить
        </Button>
        <Button variant="ghost" disabled={isPending} onClick={onCancel}>
          <X className="mr-1 h-4 w-4" /> Отменить
        </Button>
      </div>
    </div>
  );
}

/* ===================================================================
   Главная страница TaskFlow
   =================================================================== */
function Index() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<AiTaskPreview | null>(null);
  const [publishToJira, setPublishToJira] = useState(true);
  const [selectedProjectKey, setSelectedProjectKey] = useState("PREDEV");
  const [selectedJiraUserId, setSelectedJiraUserId] = useState<number | null>(null);

  const { data: user, isLoading: userLoading, isError: userError } = useCurrentUser();
  const { tenant } = useCurrentTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const integrations = useQuery({
    queryKey: ["integrations", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: () => integrationApi.list(tenant!.id),
  });
  const hasActiveJira = (integrations.data ?? []).some(
    (integration) => integration.provider === "JIRA" && integration.status === "ACTIVE",
  );
  const activeJira = (integrations.data ?? []).find(
    (integration) => integration.provider === "JIRA" && integration.status === "ACTIVE",
  );
  const jiraProjects = useQuery({
    queryKey: ["jira-projects", tenant?.id, activeJira?.id],
    enabled: !!tenant?.id && !!activeJira?.id,
    queryFn: () => integrationApi.jiraProjects(tenant!.id, activeJira!.id),
  });
  const jiraMembers = useQuery({
    queryKey: ["org-members", tenant?.id, "forJira"],
    enabled: !!tenant?.id && hasActiveJira,
    queryFn: () => orgApi.members(tenant!.id, { forJira: true }),
  });

  useEffect(() => {
    if (!hasActiveJira) {
      setPublishToJira(false);
      setSelectedJiraUserId(null);
      return;
    }
    setPublishToJira(true);
  }, [hasActiveJira, tenant?.id]);

  useEffect(() => {
    const projects = jiraProjects.data?.projects ?? [];
    if (!projects.length) return;
    setSelectedProjectKey((current) =>
      projects.some((project) => project.key === current)
        ? current
        : (projects.find((project) => project.key === "PREDEV")?.key ?? projects[0].key),
    );
  }, [jiraProjects.data]);

  useEffect(() => {
    if (!hasActiveJira || selectedJiraUserId != null || !jiraMembers.data?.length) return;
    const timur = jiraMembers.data.find((member) =>
      [member.full_name, member.username, member.jira_username].some((value) =>
        /(^|\s)(timur|тимур)(\s|$)/i.test(value ?? ""),
      ),
    );
    if (timur) setSelectedJiraUserId(timur.user_id);
  }, [hasActiveJira, jiraMembers.data, selectedJiraUserId]);

  /* Шаг 1: генерация превью */
  const generate = useMutation({
    mutationFn: (rawText: string) => {
      if (!tenant?.id) throw new Error("Организация не выбрана");
      return aiApi.generateTask(tenant.id, rawText);
    },
    onSuccess: (data) => setPreview(data),
    onError: (e: Error) => toast.error(e.message),
  });

  /* Шаг 2: создание задачи через aiActionId */
  const confirm = useMutation({
    mutationFn: async (p: AiTaskPreview) => {
      if (!tenant?.id) throw new Error("Организация не выбрана");
      const jiraMember = jiraMembers.data?.find((member) => member.user_id === selectedJiraUserId);
      const created = await api.createTaskFromAi(tenant.id, p.ai_action_id, {
        title: p.title,
        description: p.description,
        acceptanceCriteria: p.acceptance_criteria,
        priority: p.priority as Priority,
        category: p.category,
        deadline: null,
        pushToJira: hasActiveJira && publishToJira,
        ...(hasActiveJira && publishToJira
          ? { projectKey: selectedProjectKey, jiraAssignee: jiraMember?.jira_username ?? null }
          : {}),
      });
      if (created.jira_push_error) {
        throw new Error(
          `Задача создана локально, но Jira вернула ошибку: ${created.jira_push_error}`,
        );
      }
      if (files.length && user?.id) {
        try {
          await api.uploadAttachments(created.id, user.id, files);
          toast.success("Файлы прикреплены");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      setText("");
      setFiles([]);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-board"] });
      toast.success(
        hasActiveJira && publishToJira
          ? "Техническое задание создано и добавлено в Jira"
          : "Техническое задание создано",
      );
      void navigate({ to: "/tasks/$taskId", params: { taskId: String(created.id) } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loading = generate.isPending;
  const confirming = confirm.isPending;

  const voice = useVoiceInput({
    onText: (spoken) => setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken)),
    onError: (message) => toast.error(message),
  });

  if (userLoading) {
    return (
      <AppLayout>
        <p className="text-center text-sm text-muted-foreground">Вход…</p>
      </AppLayout>
    );
  }

  if (userError || !user) {
    return (
      <AppLayout>
        <p className="text-center text-sm text-destructive">
          Не удалось определить пользователя. Откройте Mini App из Telegram.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Заголовок */}
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> AI-постановка задач
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-brand-deep sm:text-4xl md:text-5xl">
          Заметка → готовое ТЗ
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Напишите мысль в свободной форме. AI соберёт название, описание и критерии приёмки — вы
          проверяете и подтверждаете.
        </p>
      </section>

      {/* Индикатор шагов */}
      {!preview && (
        <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            1
          </span>
          <span className="font-medium text-foreground">Опишите задачу</span>
          <ChevronRight className="h-3 w-3" />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            2
          </span>
          <span>Проверьте превью</span>
          <ChevronRight className="h-3 w-3" />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            3
          </span>
          <span>Создайте задачу</span>
        </div>
      )}
      {preview && (
        <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            1
          </span>
          <span>Описание</span>
          <ChevronRight className="h-3 w-3" />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            2
          </span>
          <span className="font-medium text-foreground">Проверьте превью</span>
          <ChevronRight className="h-3 w-3" />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            3
          </span>
          <span>Создайте задачу</span>
        </div>
      )}

      {/* Форма ввода */}
      {!preview && (
        <section className="mx-auto mt-4 max-w-3xl sm:mt-6">
          <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Например: нужно переделать личный кабинет, добавить экспорт в Excel и уведомления..."
              className="min-h-32 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 sm:min-h-36"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim()) {
                  generate.mutate(text.trim());
                }
              }}
            />
            <div className="flex flex-col gap-2 px-2 pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {voice.recording
                  ? "Идёт запись — нажмите «Стоп», текст появится в поле"
                  : voice.transcribing
                    ? "Распознаём речь…"
                    : "Ctrl / ⌘ + Enter — сгенерировать"}
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <FilePicker files={files} onChange={setFiles} disabled={loading} />
                <Button
                  type="button"
                  size="lg"
                  variant={voice.recording ? "destructive" : "outline"}
                  className="w-full sm:w-auto"
                  disabled={loading}
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
                  disabled={loading || !text.trim() || !tenant?.id}
                  onClick={() => generate.mutate(text.trim())}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> AI анализирует…
                    </>
                  ) : (
                    <>
                      Сгенерировать ТЗ <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
            <PickedFiles
              files={files}
              onRemove={(i) => setFiles((prev) => prev.filter((_, x) => x !== i))}
            />
            {voice.recording && (
              <div className="flex items-center gap-2 px-2 pb-2 text-xs text-destructive sm:hidden">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Идёт запись…
              </div>
            )}
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
      )}

      {/* Skeleton пока AI думает */}
      {loading && (
        <section className="mx-auto mt-8 max-w-3xl animate-pulse space-y-3 rounded-2xl border border-border bg-card p-6">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
          <div className="h-3 w-4/6 rounded bg-muted" />
        </section>
      )}

      {/* Превью */}
      {preview && (
        <PreviewCard
          preview={preview}
          onConfirm={(p) => confirm.mutate(p)}
          onEdit={(p) => setPreview(p)}
          onCancel={() => setPreview(null)}
          isPending={confirming}
          jiraEnabled={hasActiveJira}
          publishToJira={publishToJira}
          onPublishToJiraChange={setPublishToJira}
          jiraMembers={jiraMembers.data ?? []}
          jiraProjects={
            jiraProjects.data?.projects?.length
              ? jiraProjects.data.projects
              : [{ key: "PREDEV", name: "PREDEV" }]
          }
          selectedProjectKey={selectedProjectKey}
          onSelectedProjectKeyChange={setSelectedProjectKey}
          selectedJiraUserId={selectedJiraUserId}
          onSelectedJiraUserIdChange={setSelectedJiraUserId}
        />
      )}
    </AppLayout>
  );
}
