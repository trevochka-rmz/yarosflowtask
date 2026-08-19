import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/api";
import {
  acquiringApi,
  TERMINAL_STATUS_COLORS,
  TERMINAL_STATUS_LABELS,
  type Terminal,
} from "@/lib/acquiring";
import { useCurrentTenant } from "@/lib/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acquiring/$terminalId")({
  head: () => ({
    meta: [
      { title: "Терминал эквайринга" },
      {
        name: "description",
        content: "Детальная информация по терминалу эквайринга.",
      },
    ],
  }),
  component: AcquiringTerminalPage,
});

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="max-sm:block">
      <th className="bg-muted/40 px-4 py-2 text-left text-xs font-medium text-muted-foreground sm:w-48 sm:px-6 sm:py-3">
        {label}
      </th>
      <td className="px-4 py-2 text-sm sm:px-6">{value}</td>
    </tr>
  );
}

function AcquiringTerminalPage() {
  const { terminalId } = Route.useParams();
  const id = Number(terminalId);
  const { tenant } = useCurrentTenant();
  const isOrgAllowed = tenant?.id === 1;

  const query = useQuery({
    queryKey: ["acquiring-terminal", id],
    queryFn: () => acquiringApi.registration(id),
    enabled: isOrgAllowed,
  });

  if (!isOrgAllowed) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">
          Страница эквайринга доступна только для организации с ID 1.
        </p>
      </AppLayout>
    );
  }

  if (query.isPending) {
    return (
      <AppLayout>
        <div className="space-y-3">
          <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppLayout>
    );
  }

  if (query.isError || !query.data) {
    return (
      <AppLayout>
        <p className="text-sm text-destructive">
          {(query.error as Error)?.message ?? "Терминал не найден"}
        </p>
      </AppLayout>
    );
  }

  const t = query.data as Terminal;

  return (
    <AppLayout>
      <Link
        to="/acquiring"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> К списку терминалов
      </Link>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="bg-brand-gradient px-4 py-4 text-primary-foreground sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">Терминал {t.serialNumber}</h1>
            <Badge
              className={cn(
                "border-none text-[11px] font-medium",
                TERMINAL_STATUS_COLORS[t.status],
              )}
            >
              {TERMINAL_STATUS_LABELS[t.status]}
            </Badge>
          </div>
          {t.inn ? <div className="mt-1 text-sm opacity-90">ИНН: {t.inn}</div> : null}
        </div>

        <table className="w-full text-sm max-sm:block">
          <tbody className="divide-y divide-border max-sm:block">
            <InfoRow label="ID" value={t.id} />
            <InfoRow label="Серийный номер" value={t.serialNumber} />
            <InfoRow label="ИНН" value={t.inn ?? "—"} />
            <InfoRow label="E-mail" value={t.email ?? "—"} />
            <InfoRow label="Телефон" value={t.contactPhone ?? "—"} />
            <InfoRow label="Тип объекта" value={t.objectType ?? "—"} />
            <InfoRow label="Субъект" value={t.subjectName ?? "—"} />
            <InfoRow label="Объект" value={t.objectName ?? "—"} />
            <InfoRow label="Адрес" value={t.objectAddress ?? "—"} />
            <InfoRow label="Вид деятельности" value={t.activityType ?? "—"} />
            <InfoRow label="Налоговый режим" value={t.taxRegime ?? "—"} />
            <InfoRow label="Дата создания" value={formatDate(t.createdAt)} />
            <InfoRow label="Регистрация" value={formatDate(t.registeredAt)} />
            <InfoRow label="Первая оплата" value={formatDate(t.paidAt)} />
            <InfoRow label="Время до оплаты" value={t.durationHuman ?? "—"} />
            <InfoRow label="Комментарий" value={t.notes ?? "—"} />
            <InfoRow label="Последнее обновление" value={formatDate(t.updatedAt)} />
          </tbody>
        </table>
      </section>
    </AppLayout>
  );
}
