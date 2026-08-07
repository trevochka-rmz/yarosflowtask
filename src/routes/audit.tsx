import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { formatDate } from "@/lib/api";
import { platform, useCurrentTenant } from "@/lib/platform";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Журнал аудита — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Лента действий организации: кто, что и когда изменил в ботах и заявках.",
      },
      { property: "og:title", content: "Журнал аудита — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Прозрачная история действий в организации." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const query = useQuery({
    queryKey: ["audit", tenantId],
    queryFn: () => platform.audit({ tenantId: tenantId!, limit: 50 }),
    enabled: !!tenantId,
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
        Журнал аудита
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{tenant.name}</p>

      {query.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : query.isError ? (
        <p className="mt-5 text-sm text-destructive">{(query.error as Error).message}</p>
      ) : query.data?.length ? (
        <ol className="mt-5 space-y-3">
          {query.data.map((e) => (
            <li key={e.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <FileClock className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">{e.action}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(e.created_at)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {e.entity_type ? `${e.entity_type} ${e.entity_id ?? ""}` : "—"}
                {e.actor_id ? ` · пользователь #${e.actor_id}` : ""}
              </p>
              {e.meta && Object.keys(e.meta).length > 0 ? (
                <pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-3 text-xs">
                  {JSON.stringify(e.meta, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Записей пока нет.</p>
      )}
    </AppLayout>
  );
}
