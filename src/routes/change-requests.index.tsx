import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GitPullRequestArrow } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import {
  CR_STATUS_LABELS,
  CR_TYPE_LABELS,
  platform,
  useCurrentTenant,
  type CrStatus,
} from "@/lib/platform";

export const Route = createFileRoute("/change-requests/")({
  head: () => ({
    meta: [
      { title: "Заявки на изменения — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Change requests организации: тип, класс риска, статус рассмотрения и внедрение.",
      },
      { property: "og:title", content: "Заявки на изменения — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Контроль изменений логики цифровых сотрудников." },
    ],
  }),
  component: ChangeRequestsPage,
});

const STATUS_FILTERS: Array<{ value: "" | CrStatus; label: string }> = [
  { value: "", label: "Все" },
  { value: "submitted", label: "Отправленные" },
  { value: "in_review", label: "На рассмотрении" },
  { value: "approved", label: "Одобренные" },
  { value: "published", label: "Внедрённые" },
  { value: "rejected", label: "Отклонённые" },
];

const NEXT: Partial<Record<CrStatus, CrStatus[]>> = {
  draft: ["submitted", "cancelled"],
  submitted: ["in_review", "cancelled"],
  in_review: ["approved", "rejected"],
  approved: ["published"],
};

function ChangeRequestsPage() {
  const { tenant } = useCurrentTenant();
  const organizationId = tenant?.id;
  const [status, setStatus] = useState<"" | CrStatus>("");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["change-requests", organizationId, status],
    queryFn: () =>
      platform.changeRequests({ organizationId: organizationId!, ...(status ? { status } : {}) }),
    enabled: !!organizationId,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: CrStatus }) =>
      platform.setChangeRequestStatus(id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success("Статус заявки обновлён");
    },
    onError: (e: Error) => {
      if (e.message.includes("403") || e.message.toLowerCase().includes("прав")) {
        toast.error("Недостаточно прав — нужны роли manager, director или platform_admin");
      } else {
        toast.error(e.message);
      }
    },
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
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Заявки на изменения
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{tenant.name}</p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/change-requests/new">Новая</Link>
        </Button>
      </header>

      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
              status === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : query.isError ? (
        <p className="mt-5 text-sm text-destructive">{(query.error as Error).message}</p>
      ) : query.data?.length ? (
        <ul className="mt-5 space-y-3">
          {query.data.map((cr) => (
            <li key={cr.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <GitPullRequestArrow className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">{cr.title}</span>
                </span>
                <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  {CR_STATUS_LABELS[cr.status] ?? cr.status}
                </span>
              </div>
              {cr.description ? (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{cr.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {CR_TYPE_LABELS[cr.type] ?? cr.type}
                {cr.risk_class ? ` · риск ${cr.risk_class}` : ""} · {formatDate(cr.created_at)}
              </p>
              {NEXT[cr.status]?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {NEXT[cr.status]!.map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      disabled={setStatusMutation.isPending}
                      onClick={() => setStatusMutation.mutate({ id: cr.id, next })}
                    >
                      {CR_STATUS_LABELS[next]}
                    </Button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Заявок пока нет.</p>
      )}
    </AppLayout>
  );
}
