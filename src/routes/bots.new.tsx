import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { platform, useCurrentTenant, type AvailableBotTemplate } from "@/lib/platform";

export const Route = createFileRoute("/bots/new")({
  head: () => ({
    meta: [
      { title: "Подключить бота — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Выберите готового цифрового сотрудника из каталога и подключите к организации.",
      },
      { property: "og:title", content: "Подключить бота — Yaya.Цифровой Бот" },
      {
        property: "og:description",
        content: "Каталог готовых ботов: подключение и заявки на подключение.",
      },
    ],
  }),
  component: NewBotPage,
});

function AvailableBotCard({
  tpl,
  canCreateBot,
  onConnect,
  onRequest,
  isLoading,
}: {
  tpl: AvailableBotTemplate;
  canCreateBot: boolean;
  onConnect: () => void;
  onRequest: () => void;
  isLoading: boolean;
}) {
  const needIntegrations = tpl.missing_integrations ?? [];
  const canConnectNow = tpl.can_create && needIntegrations.length === 0 && canCreateBot;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-brand-deep">{tpl.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{tpl.code}</p>
        {needIntegrations.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-600">
            Нужна интеграция: {needIntegrations.join(", ")}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {tpl.executable ? "Готов к работе" : "Требует доработки"}
        </p>
        {canCreateBot ? (
          <Button
            size="sm"
            className="mt-1 w-full sm:mt-0 sm:w-auto"
            disabled={!canConnectNow || isLoading}
            onClick={onConnect}
          >
            {isLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Подключить
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-1 w-full sm:mt-0 sm:w-auto"
            disabled={isLoading}
            onClick={onRequest}
          >
            {isLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Запросить подключение
          </Button>
        )}
      </div>
    </div>
  );
}

function NewBotPage() {
  const { tenant, can } = useCurrentTenant();
  const canCreateBot = can("bot.create");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const available = useQuery({
    queryKey: ["bots-available", tenant?.id],
    queryFn: () => platform.availableBots(tenant!.id),
    enabled: !!tenant?.id,
  });

  const connect = useMutation({
    mutationFn: (templateCode: string) => platform.createBot(tenant!.id, { templateCode }),
    onSuccess: (bot) => {
      void queryClient.invalidateQueries({ queryKey: ["bots", tenant?.id] });
      void queryClient.invalidateQueries({ queryKey: ["bots-available", tenant?.id] });
      toast.success("Бот подключён");
      void navigate({ to: "/bots/$botId", params: { botId: String(bot.id) } });
    },
    onError: (e: Error) => {
      // Для ошибок интеграций backend вернёт message с подсказкой
      toast.error(e.message);
    },
  });

  const requestCr = useMutation({
    mutationFn: (tpl: AvailableBotTemplate) =>
      platform.createChangeRequest({
        organizationId: tenant!.id,
        type: "bot_create",
        title: `Подключить ${tpl.name}`,
        description: tpl.description,
        payload: { templateCode: tpl.code },
        riskClass: "C1",
        submit: true,
      }),
    onSuccess: () => {
      toast.success("Заявка на подключение бота отправлена");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenant) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">
          Сначала создайте организацию на{" "}
          <Link to="/" className="text-primary underline">
            главной
          </Link>
          .
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Подключить бота
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        В списке только те боты, которые ещё не подключены к вашей организации.
      </p>
      {!canCreateBot && (
        <p className="mt-2 flex items-start gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />У вас нет права{" "}
          <code>bot.create</code>. Вместо прямого подключения будет отправлена заявка на подключение
          бота директору.
        </p>
      )}

      <section className="mt-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Доступные боты
        </h2>

        <div className="mt-2 text-xs text-muted-foreground">
          Если нужного бота нет в каталоге, вы можете отправить заявку на создание нового бота. Для
          этого перейдите в раздел{" "}
          <Link to="/change-requests/new" className="text-primary underline">
            «Заявки на изменения»
          </Link>{" "}
          и выберите тип <code>Создание бота</code>.
        </div>
        {available.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Загрузка каталога…</p>
        ) : available.isError ? (
          <p className="mt-3 text-sm text-destructive">{(available.error as Error).message}</p>
        ) : (available.data ?? []).length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(available.data ?? []).map((tpl) => (
              <AvailableBotCard
                key={tpl.code}
                tpl={tpl}
                canCreateBot={canCreateBot}
                isLoading={selectedCode === tpl.code && (connect.isPending || requestCr.isPending)}
                onConnect={() => {
                  setSelectedCode(tpl.code);
                  connect.mutate(tpl.code);
                }}
                onRequest={() => {
                  setSelectedCode(tpl.code);
                  requestCr.mutate(tpl);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Все доступные боты уже подключены к вашей организации.
          </div>
        )}
      </section>
    </AppLayout>
  );
}
