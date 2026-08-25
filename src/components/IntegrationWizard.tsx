import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  integrationApi,
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationProvider,
} from "@/lib/platform";
import { orgApi, type JiraTestResult } from "@/lib/org";
import { ProviderIcon } from "@/components/IntegrationCard";

const PROVIDERS: IntegrationProvider[] = ["BITRIX24", "ONE_C", "JIRA"];

/* ---- Поля credentials по провайдеру ---- */
type CredField = { key: string; label: string; placeholder?: string; secret?: boolean };

const CRED_FIELDS: Record<IntegrationProvider, CredField[]> = {
  BITRIX24: [
    { key: "base_url", label: "URL портала", placeholder: "https://portal.bitrix24.ru" },
    { key: "access_token", label: "Access Token", secret: true, placeholder: "Токен доступа" },
    {
      key: "refresh_token",
      label: "Refresh Token (опционально)",
      secret: true,
      placeholder: "Refresh токен",
    },
  ],
  ONE_C: [
    { key: "base_url", label: "URL сервера 1С", placeholder: "https://1c.company.ru/base" },
    { key: "username", label: "Логин", placeholder: "admin" },
    { key: "password", label: "Пароль", secret: true, placeholder: "••••••" },
  ],
  JIRA: [
    { key: "base_url", label: "URL Jira", placeholder: "https://company.atlassian.net" },
    { key: "username", label: "Email", placeholder: "user@company.com" },
    { key: "access_token", label: "API Token", secret: true, placeholder: "Токен из Atlassian" },
  ],
  TELEGRAM: [
    { key: "access_token", label: "Bot Token", secret: true, placeholder: "123456:ABC-..." },
  ],
};

/* ---- Настройки по умолчанию ---- */
const DEFAULT_SETTINGS: Record<IntegrationProvider, Record<string, string>> = {
  BITRIX24: { sync_interval: "5", exchange_mode: "API" },
  ONE_C: { sync_interval: "15", exchange_mode: "HTTP" },
  JIRA: { sync_interval: "10", exchange_mode: "REST" },
  TELEGRAM: { sync_interval: "1" },
};

interface Props {
  orgId: number;
  defaultProvider?: IntegrationProvider;
  onSuccess?: (id: number) => void;
  onCancel?: () => void;
}

export function IntegrationWizard({ orgId, defaultProvider, onSuccess, onCancel }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(defaultProvider ? 2 : 1);
  const [provider, setProvider] = useState<IntegrationProvider>(defaultProvider ?? "BITRIX24");
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>(
    DEFAULT_SETTINGS[defaultProvider ?? "BITRIX24"],
  );
  const [jiraMode, setJiraMode] = useState<"server" | "cloud">("server");
  const [jiraTest, setJiraTest] = useState<JiraTestResult | null>(null);

  const create = useMutation({
    mutationFn: () =>
      integrationApi.create(orgId, {
        provider,
        name: name.trim(),
        status: "DISABLED",
        credentials: Object.fromEntries(
          Object.entries(creds).filter(([, v]) => v.trim() !== ""),
        ) as Record<string, string>,
        settings: Object.fromEntries(Object.entries(settings).filter(([, v]) => v.trim() !== "")),
      }),
    onSuccess: (data) => {
      toast.success("Интеграция создана");
      void qc.invalidateQueries({ queryKey: ["integrations", orgId] });
      onSuccess?.(data.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jiraConnect = useMutation({
    mutationFn: () => {
      const trimmedName = name.trim();
      const baseUrl = (creds.baseUrl ?? "").trim();
      const token = (creds.token ?? "").trim();
      const email = (creds.email ?? "").trim();
      const apiToken = (creds.apiToken ?? "").trim();

      if (!baseUrl) throw new Error("Укажите URL Jira");
      if (jiraMode === "server" && !token) throw new Error("Укажите токен доступа");
      if (jiraMode === "cloud" && (!email || !apiToken))
        throw new Error("Укажите email и API Token");

      const body =
        jiraMode === "server"
          ? {
              baseUrl,
              token,
              ...(trimmedName ? { name: trimmedName } : {}),
            }
          : {
              baseUrl,
              email,
              apiToken,
              ...(trimmedName ? { name: trimmedName } : {}),
            };

      return orgApi.jiraConnect(orgId, body);
    },
    onSuccess: (res) => {
      setJiraTest(res.test);
      void qc.invalidateQueries({ queryKey: ["integrations", orgId] });
      if (res.test.ok) {
        const who = res.test.user?.displayName || res.test.user?.name;
        toast.success(
          who ? `Jira подключена (пользователь: ${who})` : "Jira подключена и проверена",
        );
        onSuccess?.(res.integration.id);
      } else {
        const msg = res.test.error ?? "Тест не прошёл. Проверьте URL и токен.";
        toast.error(msg);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---- Шаг 1: выбор провайдера ---- */
  if (step === 1) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Шаг 1 — Выберите тип интеграции</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setProvider(p);
                setSettings(DEFAULT_SETTINGS[p]);
                setCreds({});
              }}
              className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-colors hover:bg-accent/40 ${
                provider === p ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <ProviderIcon provider={p} className="h-14 w-14 text-base" />
              <span className="font-medium">{INTEGRATION_PROVIDER_LABELS[p]}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-between pt-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
          )}
          <Button className="ml-auto" onClick={() => setStep(2)}>
            Далее <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  /* ---- Шаг 2: имя + credentials ---- */
  if (step === 2) {
    const isJira = provider === "JIRA";
    const fields = isJira ? [] : (CRED_FIELDS[provider] ?? []);

    const canSubmitJira = (() => {
      if (!name.trim()) return false;
      const baseUrl = (creds.baseUrl ?? "").trim();
      const token = (creds.token ?? "").trim();
      const email = (creds.email ?? "").trim();
      const apiToken = (creds.apiToken ?? "").trim();
      if (!baseUrl) return false;
      if (jiraMode === "server") return !!token;
      return !!(email && apiToken);
    })();

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Шаг 2 — Данные подключения ({INTEGRATION_PROVIDER_LABELS[provider]})
        </h2>

        <div className="space-y-3">
          <div>
            <Label htmlFor="int-name">Название интеграции *</Label>
            <Input
              id="int-name"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Основной ${INTEGRATION_PROVIDER_LABELS[provider]}`}
            />
          </div>

          {isJira ? (
            <>
              <div>
                <Label className="mb-1.5 block">Способ подключения</Label>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
                  {[
                    { key: "server" as const, label: "Server / Data Center" },
                    { key: "cloud" as const, label: "Cloud (Atlassian)" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setJiraMode(opt.key)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        jiraMode === opt.key
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="jira-base">URL Jira</Label>
                <Input
                  id="jira-base"
                  className="mt-1"
                  value={creds.baseUrl ?? ""}
                  onChange={(e) => setCreds((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder={
                    jiraMode === "server"
                      ? "https://jira.ys.kg"
                      : "https://your-domain.atlassian.net"
                  }
                />
              </div>

              {jiraMode === "server" ? (
                <div>
                  <Label htmlFor="jira-token">Personal Access Token</Label>
                  <Input
                    id="jira-token"
                    type="password"
                    className="mt-1"
                    value={creds.token ?? ""}
                    onChange={(e) => setCreds((prev) => ({ ...prev, token: e.target.value }))}
                    placeholder="PAT из Jira (Bearer токен)"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="jira-email">Email аккаунта</Label>
                    <Input
                      id="jira-email"
                      className="mt-1"
                      value={creds.email ?? ""}
                      onChange={(e) => setCreds((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="user@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jira-api-token">API Token</Label>
                    <Input
                      id="jira-api-token"
                      type="password"
                      className="mt-1"
                      value={creds.apiToken ?? ""}
                      onChange={(e) => setCreds((prev) => ({ ...prev, apiToken: e.target.value }))}
                      placeholder="Токен из Atlassian Cloud"
                    />
                  </div>
                </>
              )}

              {jiraTest && (
                <div
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
                    jiraTest.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  <Plug className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    {jiraTest.ok ? (
                      <>
                        <div>Подключение проверено успешно.</div>
                        {jiraTest.user?.displayName && (
                          <div className="text-xs opacity-80">
                            Пользователь: {jiraTest.user.displayName}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="font-medium">Тест не прошёл.</div>
                        <div className="text-xs">
                          {jiraTest.error ??
                            "Проверьте URL и токен/учётные данные и попробуйте снова."}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            fields.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`cred-${f.key}`}>{f.label}</Label>
                <Input
                  id={`cred-${f.key}`}
                  className="mt-1"
                  type={f.secret ? "password" : "text"}
                  value={creds[f.key] ?? ""}
                  onChange={(e) => setCreds((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between pt-2">
          {!defaultProvider && (
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Назад
            </Button>
          )}
          {defaultProvider && onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
          )}
          <Button
            className="ml-auto"
            disabled={
              isJira ? !canSubmitJira || jiraConnect.isPending : !name.trim() || create.isPending
            }
            onClick={() => {
              if (isJira) jiraConnect.mutate();
              else create.mutate();
            }}
          >
            {jiraConnect.isPending || create.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-1 h-4 w-4" />
            )}
            Подключить
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
