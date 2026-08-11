import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Loader2, Plus, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/api";
import { orgApi, personLabel, setStoredOrg, useIsPlatformAdmin } from "@/lib/org";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Администрирование платформы — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Платформенный админ: все организации и пользователи Yaya.Цифровой Бот.",
      },
      { property: "og:title", content: "Администрирование платформы — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Создание организаций и просмотр всех пользователей." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isPlatformAdmin, isLoading } = useIsPlatformAdmin();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const orgs = useQuery({
    queryKey: ["orgs-all"],
    queryFn: () => orgApi.all(),
    enabled: isPlatformAdmin,
  });
  const users = useQuery({
    queryKey: ["users-all"],
    queryFn: () => orgApi.users(),
    enabled: isPlatformAdmin,
  });

  const create = useMutation({
    mutationFn: () =>
      orgApi.create({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    onSuccess: (created) => {
      setName("");
      setSlug("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["orgs-all"] });
      void queryClient.invalidateQueries({ queryKey: ["orgs-mine"] });
      toast.success(`Организация «${created.name}» создана`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Проверяем права…</p>
      </AppLayout>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <ShieldAlert className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-xl font-semibold text-brand-deep">Раздел только для админов</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Администрирование платформы доступно пользователям с флагом platform admin.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Администрирование платформы
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Все организации и пользователи Yaya.Цифровой Бот
      </p>

      <form
        className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название организации" />
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (необяз.)" />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание (необяз.)"
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Создать
        </Button>
      </form>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-deep">
          <Building2 className="h-4 w-4" /> Организации ({orgs.data?.length ?? 0})
        </h2>
        {orgs.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Загрузка…</p>
        ) : orgs.isError ? (
          <p className="mt-2 text-sm text-destructive">{(orgs.error as Error).message}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(orgs.data ?? []).map((o) => (
              <li key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <span className="block truncate font-semibold text-brand-deep">{o.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {o.slug} · {o.is_active ? "активна" : "деактивирована"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  создана {formatDate(o.created_at)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setStoredOrg(o.id)}
                >
                  Работать в этой организации
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-deep">
          <Users className="h-4 w-4" /> Пользователи ({users.data?.length ?? 0})
        </h2>
        {users.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Загрузка…</p>
        ) : users.isError ? (
          <p className="mt-2 text-sm text-destructive">{(users.error as Error).message}</p>
        ) : (
          <>
            <div className="mt-3 hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Пользователь</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Активность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(users.data ?? []).map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 text-muted-foreground">{u.id}</td>
                      <td className="px-4 py-3 font-medium">
                        {personLabel(u)}
                        {u.is_platform_admin ? (
                          <span className="ml-2 rounded-full bg-brand-gradient px-2 py-0.5 text-xs text-primary-foreground">
                            admin
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.username ? `@${u.username}` : (u.tg_id ?? "—")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.is_active ? "Активен" : "Отключён"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(u.last_activity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-3 space-y-3 lg:hidden">
              {(users.data ?? []).map((u) => (
                <li key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <span className="block truncate font-medium">
                    {personLabel(u)}
                    {u.is_platform_admin ? (
                      <span className="ml-2 rounded-full bg-brand-gradient px-2 py-0.5 text-xs text-primary-foreground">
                        admin
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    #{u.id} · {u.username ? `@${u.username}` : (u.tg_id ?? "—")} ·{" "}
                    {u.is_active ? "активен" : "отключён"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AppLayout>
  );
}
