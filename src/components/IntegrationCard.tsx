import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, MinusCircle, Plug } from "lucide-react";
import type { Integration, IntegrationStatus } from "@/lib/platform";
import { INTEGRATION_STATUS_LABELS } from "@/lib/platform";
import { formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

/* -------- Иконки / цвета провайдеров -------- */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const base = cn("flex items-center justify-center rounded-xl text-white font-bold", className);

  if (provider === "BITRIX24")
    return (
      <div className={cn(base, "bg-[#2FC7F7]")}>
        <span className="text-lg leading-none">B</span>
      </div>
    );
  if (provider === "ONE_C")
    return (
      <div className={cn(base, "bg-[#F7941D]")}>
        <span className="text-lg leading-none">1С</span>
      </div>
    );
  if (provider === "JIRA")
    return (
      <div className={cn(base, "bg-[#0052CC]")}>
        <span className="text-lg leading-none">J</span>
      </div>
    );
  if (provider === "TELEGRAM")
    return (
      <div className={cn(base, "bg-[#26A5E4]")}>
        <span className="text-lg leading-none">TG</span>
      </div>
    );
  return (
    <div className={cn(base, "bg-muted text-muted-foreground")}>
      <Plug className="h-4 w-4" />
    </div>
  );
}

/* -------- Бейдж статуса -------- */
export function StatusBadge({ status }: { status: IntegrationStatus | string }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        {INTEGRATION_STATUS_LABELS["ACTIVE"]}
      </span>
    );
  if (status === "ERROR")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" />
        {INTEGRATION_STATUS_LABELS["ERROR"]}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <MinusCircle className="h-3 w-3" />
      {INTEGRATION_STATUS_LABELS["DISABLED"]}
    </span>
  );
}

/* -------- Карточка интеграции -------- */
export function IntegrationCard({
  integration,
  orgId,
}: {
  integration: Integration;
  orgId: number;
}) {
  return (
    <Link
      to="/integrations/$provider/$integrationId"
      params={{
        provider: integration.provider.toLowerCase(),
        integrationId: String(integration.id),
      }}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:bg-accent/30 sm:p-5"
    >
      <ProviderIcon provider={integration.provider} className="h-12 w-12 shrink-0 text-sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{integration.name}</span>
          <StatusBadge status={integration.status} />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Обновлено: {formatDate(integration.updated_at)}
        </div>
      </div>
    </Link>
  );
}
