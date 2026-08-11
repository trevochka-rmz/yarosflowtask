import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  integrationApi,
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationProvider,
} from "@/lib/platform";
import { ProviderIcon } from "@/components/IntegrationCard";

const PROVIDERS: IntegrationProvider[] = ["BITRIX24", "ONE_C", "JIRA"];

/* ---- Поля credentials по провайдеру ---- */
type CredField = { key: string; label: string; placeholder?: string; secret?: boolean };

const CRED_FIELDS: Record<IntegrationProvider, CredField[]> = {
  BITRIX24: [
    { key: "base_url", label: "URL портала", placeholder: "https://portal.bitrix24.ru" },
    { key: "access_token", label: "Access Token", secret: true, placeholder: "Токен доступа" },
    { key: "refresh_token", label: "Refresh Token (опционально)", secret: true, placeholder: "Refresh токен" },
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
  const [step, setStep] = useState<1 | 2 | 3>(defaultProvider ? 2 : 1);
  const [provider, setProvider] = useState<IntegrationProvider>(defaultProvider ?? "BITRIX24");
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>(
    DEFAULT_SETTINGS[defaultProvider ?? "BITRIX24"],
  );

  const create = useMutation({
    mutationFn: () =>
      integrationApi.create(orgId, {
        provider,
        name: name.trim(),
        status: "DISABLED",
        credentials: Object.fromEntries(
          Object.entries(creds).filter(([, v]) => v.trim() !== ""),
        ) as Record<string, string>,
        settings: Object.fromEntries(
          Object.entries(settings).filter(([, v]) => v.trim() !== ""),
        ),
      }),
    onSuccess: (data) => {
      toast.success("Интеграция создана");
      void qc.invalidateQueries({ queryKey: ["integrations", orgId] });
      onSuccess?.(data.id);
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
                provider === p
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
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
    const fields = CRED_FIELDS[provider] ?? [];
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

          {fields.map((f) => (
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
          ))}
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
            disabled={!name.trim()}
            onClick={() => setStep(3)}
          >
            Далее <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  /* ---- Шаг 3: настройки ---- */
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Шаг 3 — Настройки синхронизации</h2>
      <div className="space-y-3">
        {Object.entries(settings).map(([key, val]) => (
          <div key={key}>
            <Label htmlFor={`setting-${key}`}>{key}</Label>
            <Input
              id={`setting-${key}`}
              className="mt-1"
              value={val}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={() => setStep(2)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Назад
        </Button>
        <Button
          className="ml-auto"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
