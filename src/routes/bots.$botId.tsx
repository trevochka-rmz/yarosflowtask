import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import {
  BOT_STATUS_LABELS,
  VERSION_STATUS_LABELS,
  platform,
  useCurrentTenant,
} from "@/lib/platform";

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
  const queryClient = useQueryClient();

  const bots = useQuery({
    queryKey: ["bots", tenant?.id],
    queryFn: () => platform.bots(tenant!.id),
    enabled: !!tenant?.id,
  });
  const bot = bots.data?.find((b) => b.id === id);

  const versions = useQuery({
    queryKey: ["bot-versions", id],
    queryFn: () => platform.versions(id),
  });

  const publish = useMutation({
    mutationFn: (versionId: number) => platform.publishVersion(id, versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bot-versions", id] });
      void queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Версия опубликована");
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
        <h2 className="text-lg font-semibold text-brand-deep">Версии настроек</h2>
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
                {v.spec ? (
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
