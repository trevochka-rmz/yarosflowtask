import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, ExternalLink, Loader2, MessageSquare, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/api";
import {
  BOT_STATUS_LABELS,
  VERSION_STATUS_LABELS,
  platform,
  useCurrentTenant,
} from "@/lib/platform";
import { orgApi } from "@/lib/org";

export const Route = createFileRoute("/bots/$botId")({
  head: () => ({
    meta: [
      { title: "Бот и версии настроек — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Карточка цифрового сотрудника: статус, версии настроек и публикация.",
      },
      { property: "og:title", content: "Бот и версии настроек — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Версии настроек цифрового сотрудника." },
    ],
  }),
  component: BotPage,
});

function BotPage() {
  const { botId } = Route.useParams();
  const id = Number(botId);
  const { tenant } = useCurrentTenant();
  const orgId = tenant?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Карточка бота: предпочитаем GET /organizations/{orgId}/bots/:botId
  const botDetail = useQuery({
    queryKey: ["bot-detail", orgId, id],
    enabled: !!orgId,
    queryFn: () => platform.botDetail(orgId!, id),
    retry: false,
  });

  // Фоллбэк: ищем бота в общем списке если botDetail не работает
  const botsQuery = useQuery({
    queryKey: ["bots", orgId],
    queryFn: () => platform.bots(orgId!),
    enabled: !!orgId && botDetail.isError,
  });

  const bot = botDetail.data ?? botsQuery.data?.find((b) => b.id === id);
  const isTaskFlow = bot?.code === "TASKFLOW-001";

  const versions = useQuery({
    queryKey: ["bot-versions", orgId, id],
    enabled: !!orgId,
    queryFn: () => platform.versions(orgId!, id),
  });

  const publish = useMutation({
    mutationFn: (versionId: number) => platform.publishVersion(orgId!, id, versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bot-versions", orgId, id] });
      void queryClient.invalidateQueries({ queryKey: ["bot-detail", orgId, id] });
      void queryClient.invalidateQueries({ queryKey: ["bots", orgId] });
      toast.success("Версия опубликована");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openChat = useMutation({
    mutationFn: () => orgApi.openBotChat(orgId!, id),
    onSuccess: (chat) => {
      void queryClient.invalidateQueries({ queryKey: ["chats", orgId] });
      void navigate({ to: "/chat", search: { chatId: chat.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Создание новой версии
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [riskClass, setRiskClass] = useState("C2");

  const createVersion = useMutation({
    mutationFn: () => {
      const body: { changelog?: string; riskClass?: string } = { riskClass };
      if (changelog.trim()) body.changelog = changelog.trim();
      return platform.createVersion(orgId!, id, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bot-versions", orgId, id] });
      void queryClient.invalidateQueries({ queryKey: ["bot-detail", orgId, id] });
      setChangelog("");
      setRiskClass("C2");
      setShowNewVersion(false);
      toast.success("Новая версия создана (draft)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            <Bot className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate">{bot?.name ?? `Бот #${id}`}</span>
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {bot ? `${bot.code} · ${bot.description || "без описания"}` : "Загрузка…"}
          </p>
        </div>
        {bot ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
            {BOT_STATUS_LABELS[bot.status] ?? bot.status}
          </span>
        ) : null}
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {orgId && (
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            size="sm"
            disabled={openChat.isPending}
            onClick={() => openChat.mutate()}
          >
            {openChat.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="mr-1 h-4 w-4" />
            )}
            Чат бота
          </Button>
        )}
        {isTaskFlow && (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/taskflow">
              <ExternalLink className="h-4 w-4" /> Открыть TaskFlow
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/change-requests/new" search={{ botId: id }}>
            Заявка на изменение
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/bots">К флоту ботов</Link>
        </Button>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-brand-deep">Версии настроек</h2>
          <Button size="sm" variant="outline" onClick={() => setShowNewVersion((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Новая версия
          </Button>
        </div>

        {/* Форма создания версии */}
        {showNewVersion && (
          <form
            className="mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              createVersion.mutate();
            }}
          >
            <h3 className="text-sm font-semibold">Новая версия (draft)</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Изменения</label>
              <Textarea
                className="mt-1 min-h-20 text-sm"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="Опишите, что меняется в этой версии"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Класс риска</label>
                <Input
                  className="mt-1 h-9 text-sm"
                  value={riskClass}
                  onChange={(e) => setRiskClass(e.target.value)}
                  placeholder="C2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createVersion.isPending}>
                {createVersion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Создать
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowNewVersion(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}

        {versions.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Загрузка…</p>
        ) : versions.isError ? (
          <p className="mt-3 text-sm text-destructive">{(versions.error as Error).message}</p>
        ) : versions.data?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {versions.data.map((v) => (
              <li key={v.id} className="py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">v{v.version}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {VERSION_STATUS_LABELS[v.status] ?? v.status}
                      {v.risk_class ? ` · риск ${v.risk_class}` : ""} · {formatDate(v.created_at)}
                    </span>
                  </span>
                  {v.status === "published" ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
                      <CheckCircle2 className="h-4 w-4" /> активна
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={publish.isPending}
                      onClick={() => publish.mutate(v.id)}
                    >
                      {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Опубликовать
                    </Button>
                  )}
                </div>
                {v.changelog ? (
                  <p className="mt-2 text-sm text-muted-foreground">{v.changelog}</p>
                ) : null}
                {v.spec && Object.keys(v.spec as object).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-3 text-xs">
                    {JSON.stringify(v.spec, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Версий пока нет.</p>
        )}
      </section>
    </AppLayout>
  );
}
