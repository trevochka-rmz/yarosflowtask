import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Lock,
  Plug,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IntegrationCard, ProviderIcon } from "@/components/IntegrationCard";
import { IntegrationWizard } from "@/components/IntegrationWizard";
import {
  integrationApi,
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationProvider,
} from "@/lib/platform";
import { useCurrentTenant } from "@/lib/platform";
import { orgApi, useCurrentOrg, type BitrixIntegration, type BitrixDeal } from "@/lib/org";
import type { IntegrationDetail } from "@/lib/platform";
import { cn } from "@/lib/utils";

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

/* ── Bitrix: Бейдж статуса ── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    ACTIVE: { label: "Активна", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
    ERROR: { label: "Ошибка", cls: "bg-red-100 text-red-700", Icon: AlertCircle },
    DISABLED: { label: "Отключена", cls: "bg-slate-100 text-slate-600", Icon: WifiOff },
  };
  const s = cfg[status] ?? { label: status, cls: "bg-muted text-muted-foreground", Icon: Wifi };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        s.cls,
      )}
    >
      <s.Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

/* ── Bitrix: Таблица сделок ── */
function DealsTable({
  query,
  label,
  accent,
}: {
  query: ReturnType<typeof useQuery<{ ok: boolean; deals: BitrixDeal[]; error?: string }>>;
  label: string;
  accent?: boolean;
}) {
  if (query.isPending)
    return (
      <div className="border-t border-border px-5 py-4">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  const errMsg = (query.error as Error | undefined)?.message ?? query.data?.error;
  if (query.isError || (query.data && !query.data.ok))
    return (
      <div className="border-t border-border px-5 py-4">
        <p className="text-sm text-destructive">{errMsg ?? "Ошибка"}</p>
      </div>
    );
  const deals = query.data?.deals ?? [];
  return (
    <div className="border-t border-border">
      <p
        className={cn(
          "px-5 py-2 text-xs font-semibold uppercase tracking-wide",
          accent ? "text-red-600" : "text-muted-foreground",
        )}
      >
        {label} ({deals.length})
      </p>
      {deals.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted-foreground">Сделок нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-t border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {["#", "Название", "Стадия", "Сумма", "Закрытие"].map((h) => (
                  <th
                    key={h}
                    className={cn("px-5 py-2", h === "Сумма" ? "text-right" : "text-left")}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deals.map((d) => (
                <tr key={d.ID} className="hover:bg-accent/30">
                  <td className="px-5 py-2 text-muted-foreground">{d.ID}</td>
                  <td className="max-w-[14rem] truncate px-5 py-2 font-medium">{d.TITLE}</td>
                  <td className="px-5 py-2 text-muted-foreground">{d.STAGE_ID}</td>
                  <td className="px-5 py-2 text-right">
                    {d.OPPORTUNITY ? `${Number(d.OPPORTUNITY).toLocaleString("ru-RU")} ₽` : "—"}
                  </td>
                  <td className="px-5 py-2 text-muted-foreground">
                    {d.CLOSEDATE ? new Date(d.CLOSEDATE).toLocaleDateString("ru-RU") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Bitrix: Карточка подключения ── */
function BitrixIntegrationItem({ orgId, item }: { orgId: number; item: BitrixIntegration }) {
  const qc = useQueryClient();
  const [showDeals, setShowDeals] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const test = useMutation({
    mutationFn: () => orgApi.bitrixTest(orgId, item.id),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["bitrix-integrations", orgId] });
      if (res.ok) toast.success("Соединение в порядке");
      else toast.error(`Ошибка: ${res.error ?? "неизвестно"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deals = useQuery({
    queryKey: ["bitrix-deals", orgId, item.id],
    queryFn: () => orgApi.bitrixDeals(orgId, item.id),
    enabled: showDeals,
  });
  const overdue = useQuery({
    queryKey: ["bitrix-deals-overdue", orgId, item.id],
    queryFn: () => orgApi.bitrixDealsOverdue(orgId, item.id),
    enabled: showOverdue,
  });
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2fc7f7]/10 text-[#2fc7f7]">
          <Plug className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.credentials.auth_type === "webhook" ? "Webhook" : "OAuth"} ·{" "}
            {item.credentials.base_url}
          </p>
        </div>
        <StatusBadge status={item.status} />
        <Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>
          {test.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}{" "}
          Проверить
        </Button>
      </div>
      {test.data && (
        <div
          className={cn(
            "mx-5 mb-3 rounded-xl px-3 py-2 text-sm",
            test.data.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {test.data.ok ? "✓ Соединение успешно" : `✗ ${test.data.error ?? "Ошибка"}`}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
        <Button
          size="sm"
          variant={showDeals ? "default" : "outline"}
          onClick={() => setShowDeals((v) => !v)}
          className="gap-1.5"
        >
          {showDeals ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}{" "}
          Сделки
        </Button>
        <Button
          size="sm"
          variant={showOverdue ? "default" : "outline"}
          onClick={() => setShowOverdue((v) => !v)}
          className="gap-1.5"
        >
          {showOverdue ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}{" "}
          Просроченные
        </Button>
        <a
          href={item.credentials.base_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Открыть портал
        </a>
      </div>
      {showDeals && <DealsTable query={deals} label="Все сделки" />}
      {showOverdue && <DealsTable query={overdue} label="Просроченные сделки" accent />}
    </div>
  );
}

/* ── Bitrix: Форма подключения ── */
type AuthMode = "webhook" | "oauth";
function BitrixConnectForm({ orgId, onSuccess }: { orgId: number; onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>("webhook");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string | undefined } | null>(
    null,
  );
  const connect = useMutation({
    mutationFn: () =>
      mode === "webhook"
        ? orgApi.bitrixConnect(orgId, { name: name.trim(), webhookUrl: webhookUrl.trim() })
        : orgApi.bitrixConnect(orgId, {
            name: name.trim(),
            baseUrl: baseUrl.trim(),
            accessToken: accessToken.trim(),
            ...(refreshToken.trim() ? { refreshToken: refreshToken.trim() } : {}),
          }),
    onSuccess: (res) => {
      setTestResult({ ok: res.test.ok, ...(res.test.error ? { error: res.test.error } : {}) });
      toast[res.test.ok ? "success" : "error"](
        res.test.ok ? "Bitrix24 подключён" : `Тест не прошёл: ${res.test.error ?? "ошибка"}`,
      );
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSubmit =
    name.trim() && (mode === "webhook" ? webhookUrl.trim() : baseUrl.trim() && accessToken.trim());
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block">Способ подключения</Label>
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
          {(["webhook", "oauth"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "webhook" ? "🔗 Webhook URL" : "🔑 OAuth / Токены"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="b24n">Название</Label>
        <Input
          id="b24n"
          className="mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bitrix TMG Production"
        />
      </div>
      {mode === "webhook" ? (
        <div>
          <Label htmlFor="b24wh">Webhook URL</Label>
          <Input
            id="b24wh"
            className="mt-1 font-mono text-xs"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://crm.example.com/rest/42663/secret/"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Bitrix24 → Приложения → Webhooks → Входящий webhook → скопируйте URL.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="b24bu">URL портала</Label>
            <Input
              id="b24bu"
              className="mt-1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://company.bitrix24.ru"
            />
          </div>
          <div>
            <Label htmlFor="b24at">Access Token</Label>
            <Input
              id="b24at"
              type="password"
              className="mt-1 font-mono text-xs"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <Label htmlFor="b24rt">Refresh Token (необязательно)</Label>
            <Input
              id="b24rt"
              type="password"
              className="mt-1 font-mono text-xs"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
      )}
      {testResult && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
            testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {testResult.ok
            ? "Соединение проверено успешно"
            : `Тест не прошёл: ${testResult.error ?? "ошибка"}`}
        </div>
      )}
      <Button
        className="w-full"
        disabled={!canSubmit || connect.isPending}
        onClick={() => connect.mutate()}
      >
        {connect.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plug className="mr-2 h-4 w-4" />
        )}{" "}
        Подключить и проверить
      </Button>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Главный компонент страницы
════════════════════════════════════════════════ */
function IntegrationProviderPage() {
  const { provider: providerSlug } = Route.useParams();
  const provider = slugToProvider(providerSlug);
  const isBitrix = provider === "BITRIX24";
  const { tenant } = useCurrentTenant();
  const { org, can } = useCurrentOrg();
  const orgId = tenant?.id ?? org?.id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const canRead = can("integration.read");
  const canCreate = can("integration.create");
  const label = INTEGRATION_PROVIDER_LABELS[provider] ?? provider;

  const generalQuery = useQuery({
    queryKey: ["integrations", orgId],
    enabled: !!orgId && !isBitrix,
    queryFn: () => integrationApi.list(orgId!),
  });
  const bitrixQuery = useQuery({
    queryKey: ["bitrix-integrations", orgId],
    enabled: !!orgId && isBitrix && canRead,
    queryFn: async (): Promise<BitrixIntegration[]> => {
      const all = await integrationApi.list(orgId!);
      const filtered = all.filter((i) => i.provider === "BITRIX24");
      // Загружаем детали каждой интеграции чтобы получить credentials
      const details = await Promise.all(
        filtered.map((i) => integrationApi.get(orgId!, i.id).catch(() => i as IntegrationDetail)),
      );
      return details.map((d) => ({
        id: d.id,
        provider: d.provider,
        name: d.name,
        status: d.status as BitrixIntegration["status"],
        credentials: {
          auth_type: (d.credentials?.extra?.auth_type as "webhook" | "oauth") ?? "webhook",
          base_url: d.credentials?.base_url ?? "",
          has_access_token: d.credentials?.has_access_token ?? false,
        },
      }));
    },
    staleTime: 30_000,
  });

  /* ── Bitrix24 ── */
  if (isBitrix) {
    if (!canRead)
      return (
        <AppLayout>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">Bitrix24</h1>
          <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" /> Нужно право <code>integration.read</code>.
          </p>
        </AppLayout>
      );
    const bitrixItems = bitrixQuery.data ?? [];
    return (
      <AppLayout>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#2fc7f7]/10 text-[#2fc7f7]">
            <Plug className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
              Bitrix24
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              CRM и корпоративный портал — синхронизация контактов, сделок и задач.
            </p>
          </div>
          {canCreate && (
            <Button
              className="shrink-0"
              variant={showConnectForm ? "outline" : "default"}
              onClick={() => setShowConnectForm((v) => !v)}
            >
              <Plug className="mr-1.5 h-4 w-4" /> {showConnectForm ? "Скрыть форму" : "Подключить"}
            </Button>
          )}
        </div>
        {showConnectForm && canCreate && orgId && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="mb-4 text-base font-semibold">Новое подключение</h2>
            <BitrixConnectForm
              orgId={orgId}
              onSuccess={() => {
                setShowConnectForm(false);
                void qc.invalidateQueries({ queryKey: ["bitrix-integrations", orgId] });
              }}
            />
          </div>
        )}
        <div className="mt-5 space-y-4">
          {bitrixQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : bitrixItems.length === 0 && !showConnectForm ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[#2fc7f7]/10 text-[#2fc7f7] opacity-40">
                <Plug className="h-8 w-8" />
              </div>
              <p className="text-base font-medium">Нет активных подключений</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Нажмите «Подключить», чтобы добавить Bitrix24.
              </p>
              {canCreate && (
                <Button className="mt-5" onClick={() => setShowConnectForm(true)}>
                  <Plug className="mr-1.5 h-4 w-4" /> Подключить Bitrix24
                </Button>
              )}
            </div>
          ) : (
            orgId &&
            bitrixItems.map((item) => (
              <BitrixIntegrationItem key={item.id} orgId={orgId} item={item} />
            ))
          )}
        </div>
      </AppLayout>
    );
  }

  /* ── Другие провайдеры ── */
  const items = (generalQuery.data ?? []).filter((i) => i.provider === provider);
  return (
    <AppLayout>
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
      <div className="mt-6">
        {!orgId ? (
          <p className="text-sm text-muted-foreground">Выберите организацию.</p>
        ) : generalQuery.isPending ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : generalQuery.isError ? (
          <p className="text-sm text-destructive">{(generalQuery.error as Error).message}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <ProviderIcon provider={provider} className="mx-auto h-16 w-16 opacity-40" />
            <p className="mt-4 text-base font-medium">Нет активных подключений {label}</p>
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
                  params: { provider: providerSlug, integrationId: String(id) },
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
