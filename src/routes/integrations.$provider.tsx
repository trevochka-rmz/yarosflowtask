import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IntegrationCard, ProviderIcon } from "@/components/IntegrationCard";
import { IntegrationWizard } from "@/components/IntegrationWizard";
import {
  integrationApi,
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationProvider,
} from "@/lib/platform";
import { useCurrentTenant } from "@/lib/platform";

/** Преобразует slug из URL (bitrix24 / one_c / jira) → код провайдера */
function slugToProvider(slug: string): IntegrationProvider {
  const map: Record<string, IntegrationProvider> = {
    bitrix24: "BITRIX24",
    "1c": "ONE_C",
    one_c: "ONE_C",
    jira: "JIRA",
    telegram: "TELEGRAM",
  };
  return map[slug.toLowerCase()] ?? (slug.toUpperCase() as IntegrationProvider);
}

const PROVIDER_DESCRIPTIONS: Record<IntegrationProvider, string> = {
  BITRIX24: "CRM и корпоративный портал Битрикс24: синхронизация контактов, задач и сделок.",
  ONE_C: "Учётная система 1С: обмен данными через HTTP-сервис или API-интеграцию.",
  JIRA: "Трекер задач Atlassian Jira: импорт и синхронизация тикетов.",
  TELEGRAM: "Telegram Bot API: уведомления и интерактивные сценарии.",
};

export const Route = createFileRoute("/integrations/$provider")({
  head: ({ params }) => {
    const prov = slugToProvider(params.provider);
    const label = INTEGRATION_PROVIDER_LABELS[prov] ?? params.provider;
    return {
      meta: [
        { title: `Интеграция ${label} — Yaya.ЦифровойБот` },
        { property: "og:title", content: `Интеграция ${label} — Yaya.ЦифровойБот` },
      ],
    };
  },
  component: IntegrationProviderPage,
});

function IntegrationProviderPage() {
  const { provider: providerSlug } = Route.useParams();
  const provider = slugToProvider(providerSlug);
  const { tenant } = useCurrentTenant();
  const orgId = tenant?.id;
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: all, isPending, isError, error } = useQuery({
    queryKey: ["integrations", orgId],
    enabled: !!orgId,
    queryFn: () => integrationApi.list(orgId!),
  });

  const items = (all ?? []).filter((i) => i.provider === provider);
  const label = INTEGRATION_PROVIDER_LABELS[provider] ?? provider;

  return (
    <AppLayout>
      {/* Заголовок */}
      <div className="flex flex-wrap items-center gap-4">
        <ProviderIcon provider={provider} className="h-14 w-14 shrink-0 text-base" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            {label}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {PROVIDER_DESCRIPTIONS[provider] ?? "Интеграция с внешней системой."}
          </p>
        </div>
        <Button className="ml-auto shrink-0" onClick={() => setWizardOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Подключить
        </Button>
      </div>

      {/* Список */}
      <div className="mt-6">
        {!orgId ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Выберите организацию для просмотра интеграций.
          </p>
        ) : isPending ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
            {(error as Error).message}
          </p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <ProviderIcon provider={provider} className="mx-auto h-16 w-16 text-lg opacity-40" />
            <p className="mt-4 text-base font-medium text-foreground">
              Нет активных подключений {label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Нажмите «Подключить», чтобы добавить первую интеграцию.
            </p>
            <Button className="mt-5" onClick={() => setWizardOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Подключить {label}
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((integration) => (
              <li key={integration.id}>
                <IntegrationCard integration={integration} orgId={orgId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Мастер создания */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Подключить {label}</DialogTitle>
          </DialogHeader>
          {orgId && (
            <IntegrationWizard
              orgId={orgId}
              defaultProvider={provider}
              onSuccess={(id) => {
                setWizardOpen(false);
                void navigate({
                  to: "/integrations/$provider/$integrationId",
                  params: {
                    provider: providerSlug,
                    integrationId: String(id),
                  },
                });
              }}
              onCancel={() => setWizardOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
