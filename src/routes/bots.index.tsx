import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import { BOT_STATUS_LABELS, platform, useCurrentTenant } from "@/lib/platform";
import { orgApi } from "@/lib/org";

export const Route = createFileRoute("/bots/")({
  head: () => ({
    meta: [
      { title: "Флот ботов — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Все цифровые сотрудники организации: статусы, коды и версии настроек.",
      },
      { property: "og:title", content: "Флот ботов — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Цифровые сотрудники организации и их статусы." },
    ],
  }),
  component: BotsPage,
});

function OpenBotChatButton({ orgId, botId }: { orgId: number; botId: number }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const open = useMutation({
    mutationFn: () => orgApi.openBotChat(orgId, botId),
    onSuccess: (chat) => {
      void qc.invalidateQueries({ queryKey: ["chats", orgId] });
      void navigate({ to: "/chat", search: { chatId: chat.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={open.isPending}
      onClick={(e) => {
        e.preventDefault();
        open.mutate();
      }}
      className="shrink-0 gap-1.5"
    >
      {open.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MessageSquare className="h-3.5 w-3.5" />
      )}
      Чат
    </Button>
  );
}

function BotsPage() {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const query = useQuery({
    queryKey: ["bots", tenantId],
    queryFn: () => platform.bots(tenantId!),
    enabled: !!tenantId,
  });

  const available = useQuery({
    queryKey: ["bots-available", tenantId],
    queryFn: () => platform.availableBots(tenantId!),
    enabled: !!tenantId,
  });

  return (
    <AppLayout>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Флот ботов
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {tenant ? tenant.name : "Организация не выбрана"}
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/bots/new">Подключить</Link>
        </Button>
      </header>

      {!tenant ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Сначала создайте организацию на{" "}
          <Link to="/" className="text-primary underline">
            главной
          </Link>
          .
        </p>
      ) : query.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : query.isError ? (
        <p className="mt-5 text-sm text-destructive">{(query.error as Error).message}</p>
      ) : query.data?.length ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {query.data.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-border bg-card shadow-soft transition-colors hover:border-primary/40"
              >
                <Link to="/bots/$botId" params={{ botId: String(b.id) }} className="block p-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Bot className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{b.name}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                      {BOT_STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {b.description || "Без описания"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {b.code} · {formatDate(b.created_at)}
                  </p>
                </Link>
                {/* Кнопка Чат бота */}
                {tenantId && (
                  <div className="border-t border-border px-5 py-2.5">
                    <OpenBotChatButton orgId={tenantId} botId={b.id} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Доступные боты для подключения */}
          <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Доступные для подключения
            </div>
            {available.isPending ? (
              <p className="mt-3 text-sm text-muted-foreground">Загрузка каталога…</p>
            ) : available.isError ? (
              <p className="mt-3 text-sm text-destructive">{(available.error as Error).message}</p>
            ) : (available.data ?? []).length ? (
              <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(available.data ?? []).map((tpl) => (
                  <li
                    key={tpl.code}
                    className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"
                  >
                    <span className="font-medium text-foreground">{tpl.name}</span>
                    <span className="text-[11px]">({tpl.code})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Все доступные боты уже подключены к вашей организации.
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Пока ни одного цифрового сотрудника.</p>
          <Button asChild className="mt-3">
            <Link to="/bots/new">Подключить первого бота</Link>
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
