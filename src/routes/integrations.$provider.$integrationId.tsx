import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProviderIcon, StatusBadge } from "@/components/IntegrationCard";
import {
  integrationApi,
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationDetail,
  type IntegrationProvider,
  type IntegrationStatus,
} from "@/lib/platform";
import { useCurrentTenant } from "@/lib/platform";
import { formatDate } from "@/lib/api";
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

type Tab = "settings" | "credentials" | "logs";

export const Route = createFileRoute("/integrations/$provider/$integrationId")({
  head: () => ({
    meta: [
      { title: "Интеграция — Yaya.ЦифровойБот" },
      { property: "og:title", content: "Интеграция — Yaya.ЦифровойБот" },
    ],
  }),
  component: IntegrationDetailPage,
});

function IntegrationDetailPage() {
  const { provider: providerSlug, integrationId } = Route.useParams();
  const provider = slugToProvider(providerSlug);
  const id = Number(integrationId);
  const { tenant } = useCurrentTenant();
  const orgId = tenant?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("settings");

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["integration", orgId, id],
    enabled: !!orgId,
    queryFn: () => integrationApi.get(orgId!, id),
  });

  const { data: logs, isPending: logsPending } = useQuery({
    queryKey: ["integration-logs", orgId, id],
    enabled: !!orgId && tab === "logs",
    queryFn: () => integrationApi.logs(orgId!, id),
  });

  /* ---- мутации ---- */
  const updateStatus = useMutation({
    mutationFn: (status: IntegrationStatus) => integrationApi.update(orgId!, id, { status }),
    onSuccess: () => {
      toast.success("Статус обновлён");
      void qc.invalidateQueries({ queryKey: ["integration", orgId, id] });
      void qc.invalidateQueries({ queryKey: ["integrations", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => integrationApi.delete(orgId!, id),
    onSuccess: () => {
      toast.success("Интеграция удалена");
      void qc.invalidateQueries({ queryKey: ["integrations", orgId] });
      void navigate({ to: "/integrations/$provider", params: { provider: providerSlug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Организация не выбрана.</p>
      </AppLayout>
    );
  }

  if (isPending) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !data) {
    return (
      <AppLayout>
        <p className="text-sm text-destructive">{(error as Error)?.message ?? "Не найдено"}</p>
      </AppLayout>
    );
  }

  const label = INTEGRATION_PROVIDER_LABELS[provider] ?? provider;
  const isActive = data.status === "ACTIVE";
  const isDisabled = data.status === "DISABLED";

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <Link
        to="/integrations/$provider"
        params={{ provider: providerSlug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Все интеграции {label}
      </Link>

      {/* Шапка */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <ProviderIcon provider={provider} className="h-12 w-12 shrink-0 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-brand-deep sm:text-2xl">
              {data.name}
            </h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {label} · Создано: {formatDate(data.created_at)}
          </p>
        </div>

        {/* Переключатель статуса */}
        <div className="flex items-center gap-2">
          {data.status === "ERROR" && (
            <Button
              variant="outline"
              size="sm"
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate("ACTIVE")}
            >
              {updateStatus.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="mr-1 h-4 w-4 text-red-500" />
              )}
              Повторить подключение
            </Button>
          )}
          {(isActive || isDisabled) && (
            <Button
              variant={isActive ? "outline" : "default"}
              size="sm"
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate(isActive ? "DISABLED" : "ACTIVE")}
            >
              {updateStatus.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : isActive ? (
                <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-500" />
              ) : null}
              {isActive ? "Отключить" : "Включить"}
            </Button>
          )}

          {/* Удалить */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={del.isPending}>
                {del.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить интеграцию?</AlertDialogTitle>
                <AlertDialogDescription>
                  Токены и настройки будут стёрты. Отменить это действие нельзя.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => del.mutate()}
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Табы */}
      <div className="mt-6 border-b border-border">
        <div className="-mb-px flex gap-0">
          {(
            [
              { key: "settings", label: "Настройки" },
              { key: "credentials", label: "Доступ" },
              { key: "logs", label: "Журнал" },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "border-b-2 px-5 py-2.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {tab === "settings" && <SettingsTab orgId={orgId} integrationId={id} data={data} />}
        {tab === "credentials" && <CredentialsTab orgId={orgId} integrationId={id} data={data} />}
        {tab === "logs" && <LogsTab logs={logs} isPending={logsPending} />}
      </div>
    </AppLayout>
  );
}

/* ============================================================ */
/* Tab: Настройки                                               */
/* ============================================================ */
function SettingsTab({
  orgId,
  integrationId,
  data,
}: {
  orgId: number;
  integrationId: number;
  data: IntegrationDetail;
}) {
  const qc = useQueryClient();
  const rawSettings = data.settings ?? [];
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(rawSettings.map((s) => [s.key, s.value])),
  );
  const [name, setName] = useState(data.name);

  const save = useMutation({
    mutationFn: () => {
      const patch: Parameters<typeof integrationApi.update>[2] = { settings: fields };
      if (name.trim()) patch.name = name.trim();
      return integrationApi.update(orgId, integrationId, patch);
    },
    onSuccess: () => {
      toast.success("Настройки сохранены");
      void qc.invalidateQueries({ queryKey: ["integration", orgId, integrationId] });
      void qc.invalidateQueries({ queryKey: ["integrations", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="s-name">Название</Label>
        <Input
          id="s-name"
          className="mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {Object.entries(fields).map(([key, val]) => (
        <div key={key}>
          <Label htmlFor={`s-${key}`}>{key}</Label>
          <Input
            id={`s-${key}`}
            className="mt-1"
            value={val}
            onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
          />
        </div>
      ))}

      {rawSettings.length === 0 && Object.keys(fields).length === 0 && (
        <p className="text-sm text-muted-foreground">Настройки не заданы.</p>
      )}

      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-1 h-4 w-4" />
        )}
        Сохранить
      </Button>
    </div>
  );
}

/* ============================================================ */
/* Tab: Доступ (credentials)                                    */
/* ============================================================ */
type CredField = { key: string; label: string; secret?: boolean; hasKey?: string };

const CRED_FIELDS_DETAIL: Record<IntegrationProvider, CredField[]> = {
  BITRIX24: [
    { key: "base_url", label: "URL портала" },
    { key: "access_token", label: "Access Token", secret: true, hasKey: "has_access_token" },
    { key: "refresh_token", label: "Refresh Token", secret: true, hasKey: "has_refresh_token" },
  ],
  ONE_C: [
    { key: "base_url", label: "URL сервера 1С" },
    { key: "username", label: "Логин", hasKey: "has_username" },
    { key: "password", label: "Пароль", secret: true, hasKey: "has_password" },
  ],
  JIRA: [
    { key: "base_url", label: "URL Jira" },
    { key: "username", label: "Email", hasKey: "has_username" },
    { key: "access_token", label: "API Token", secret: true, hasKey: "has_access_token" },
  ],
  TELEGRAM: [{ key: "access_token", label: "Bot Token", secret: true, hasKey: "has_access_token" }],
};

function CredentialsTab({
  orgId,
  integrationId,
  data,
}: {
  orgId: number;
  integrationId: number;
  data: IntegrationDetail;
}) {
  const qc = useQueryClient();
  const provider = data.provider as IntegrationProvider;
  const creds = data.credentials ?? {};
  const fields = CRED_FIELDS_DETAIL[provider] ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [changing, setChanging] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: () => {
      const patch: Record<string, string> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (v.trim()) patch[k] = v.trim();
      });
      return integrationApi.update(orgId, integrationId, { credentials: patch });
    },
    onSuccess: () => {
      toast.success("Данные доступа обновлены");
      setValues({});
      setChanging({});
      void qc.invalidateQueries({ queryKey: ["integration", orgId, integrationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasAnyChange = Object.values(values).some((v) => v.trim() !== "");

  return (
    <div className="max-w-lg space-y-4">
      {fields.map((f) => {
        const hasFlag = f.hasKey ? (creds as Record<string, unknown>)[f.hasKey] : false;
        const currentVal = (creds as Record<string, unknown>)[f.key];
        const isSet = hasFlag || (typeof currentVal === "string" && currentVal.length > 0);
        const isChanging = changing[f.key];

        return (
          <div key={f.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                {!isChanging && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {f.key === "base_url" && typeof currentVal === "string" && currentVal ? (
                      <span className="font-mono">{currentVal}</span>
                    ) : isSet ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Задан ✓
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Не задан</span>
                    )}
                  </p>
                )}
              </div>
              {!isChanging && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChanging((p) => ({ ...p, [f.key]: true }))}
                >
                  {isSet ? "Сменить" : "Задать"}
                </Button>
              )}
            </div>

            {isChanging && (
              <div className="mt-3 space-y-2">
                <Input
                  type={f.secret ? "password" : "text"}
                  placeholder={f.secret ? "Новое значение…" : undefined}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChanging((p) => ({ ...p, [f.key]: false }));
                    setValues((p) => ({ ...p, [f.key]: "" }));
                  }}
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {hasAnyChange && (
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Сохранить изменения
        </Button>
      )}
    </div>
  );
}

/* ============================================================ */
/* Tab: Журнал логов                                            */
/* ============================================================ */
function LogsTab({
  logs,
  isPending,
}: {
  logs?: Awaited<ReturnType<typeof integrationApi.logs>> | undefined;
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Логов пока нет.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Время</th>
              <th className="px-4 py-3 font-medium">Операция</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Сообщение / Ошибка</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr
                key={log.id}
                className={cn(
                  "transition-colors hover:bg-accent/30",
                  log.status === "ERROR" && "bg-red-50/60",
                  log.status === "SUCCESS" && "bg-emerald-50/40",
                )}
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {formatDate(log.created_at)}
                </td>
                <td className="px-4 py-3 font-medium">{log.operation}</td>
                <td className="px-4 py-3">
                  {log.status === "SUCCESS" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      <AlertCircle className="h-3 w-3" /> ERROR
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {log.error ? (
                    <span className="text-red-600">{log.error}</span>
                  ) : (
                    (log.message ?? "—")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
