import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Building2, GitPullRequestArrow, ShieldAlert, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import { orgApi } from "@/lib/org";
import {
  BOT_STATUS_LABELS,
  CR_STATUS_LABELS,
  platform,
  setStoredTenant,
  useCurrentTenant,
} from "@/lib/platform";

export const Route = createFileRoute("/org")({
  head: () => ({
    meta: [
      { title: "Центр организации — Yaya.Цифровой Бот" },
      {
        name: "description",
        content:
          "Обзор организации: цифровые сотрудники, участники и активные заявки на изменения.",
      },
      { property: "og:title", content: "Центр организации — Yaya.Цифровой Бот" },
      {
        property: "og:description",
        content: "Обзор организации: боты, участники и заявки на изменения.",
      },
    ],
  }),
  component: OrgPage,
});

function OrgPage() {
  const { tenant, tenants, canManage, isLoading } = useCurrentTenant();
  const tenantId = tenant?.id;

  const bots = useQuery({
    queryKey: ["bots", tenantId],
    queryFn: () => platform.bots(tenantId!),
    enabled: !!tenantId,
  });
  const members = useQuery({
    queryKey: ["org-members", tenantId],
    queryFn: () => orgApi.members(tenantId!),
    enabled: !!tenantId,
  });
  const crs = useQuery({
    queryKey: ["change-requests", tenantId],
    queryFn: () => platform.changeRequests({ tenantId: tenantId! }),
    enabled: !!tenantId,
  });

  // Director Cockpit: заявки на решение (submitted + in_review)
  const pendingCrs = useQuery({
    queryKey: ["change-requests", tenantId, "pending"],
    queryFn: async () => {
      const [submitted, inReview] = await Promise.all([
        platform.changeRequests({ tenantId: tenantId!, status: "submitted" }),
        platform.changeRequests({ tenantId: tenantId!, status: "in_review" }),
      ]);
      return [...submitted, ...inReview].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Загружаем организации…</p>
      </AppLayout>
    );
  }

  if (!tenant) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <Building2 className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-xl font-semibold text-brand-deep">Организации пока нет</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте организацию на главной — это займёт меньше минуты.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Создать организацию</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const stats = [
    { icon: Bot, label: "Ботов", value: bots.data?.length ?? "—", to: "/bots" as const },
    {
      icon: Users,
      label: "Участников",
      value: members.data?.length ?? "—",
      to: "/members" as const,
    },
    {
      icon: GitPullRequestArrow,
      label: "Заявок",
      value: crs.data?.length ?? "—",
      to: "/change-requests" as const,
    },
  ];

  return (
    <AppLayout>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            {tenant.name}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {tenant.slug} · создана {formatDate(tenant.created_at)}
          </p>
        </div>
        {tenants.length > 1 ? (
          <select
            value={tenant.id}
            onChange={(e) => setStoredTenant(Number(e.target.value))}
            className="h-10 shrink-0 rounded-md border border-input bg-card px-3 text-sm"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-brand-deep">{s.value}</div>
          </Link>
        ))}
      </section>

      {/* Director Cockpit — заявки на решение */}
      {(pendingCrs.data?.length ?? 0) > 0 ? (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-soft dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
              На решение — {pendingCrs.data!.length}
            </h2>
            <Link
              to="/change-requests"
              className="ml-auto text-xs text-amber-700 underline dark:text-amber-300"
            >
              Все заявки
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-amber-200 dark:divide-amber-800">
            {pendingCrs.data!.slice(0, 5).map((cr) => (
              <li key={cr.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate text-amber-900 dark:text-amber-100">
                  {cr.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    cr.status === "submitted"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  }`}
                >
                  {CR_STATUS_LABELS[cr.status] ?? cr.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate text-lg font-semibold text-brand-deep">Цифровые сотрудники</h2>
          {canManage ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/bots/new">Создать</Link>
            </Button>
          ) : null}
        </div>
        {bots.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Загрузка…</p>
        ) : bots.isError ? (
          <p className="mt-3 text-sm text-destructive">{(bots.error as Error).message}</p>
        ) : bots.data?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {bots.data.map((b) => (
              <li key={b.id} className="py-3">
                <Link
                  to="/bots/$botId"
                  params={{ botId: String(b.id) }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.code}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                    {BOT_STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Ботов пока нет.</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-brand-deep">Последние заявки</h2>
        {crs.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Загрузка…</p>
        ) : crs.data?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {crs.data.slice(0, 5).map((cr) => (
              <li key={cr.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 text-sm">
                <span className="min-w-0 truncate">{cr.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {CR_STATUS_LABELS[cr.status] ?? cr.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Заявок пока нет.</p>
        )}
      </section>
    </AppLayout>
  );
}
