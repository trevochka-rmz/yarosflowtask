import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { api, userHandle } from "@/lib/api";
import { MEMBER_ROLE_LABELS, platform, useCurrentTenant, type MemberRole } from "@/lib/platform";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Участники и роли — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Участники организации и их роли: владельцы ботов, аудиторы, администраторы.",
      },
      { property: "og:title", content: "Участники и роли — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Роли и доступы участников организации." },
    ],
  }),
  component: MembersPage,
});

const ROLES = Object.keys(MEMBER_ROLE_LABELS) as MemberRole[];

function MembersPage() {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<MemberRole>("bot_user");

  const members = useQuery({
    queryKey: ["members", tenantId],
    queryFn: () => platform.members(tenantId!),
    enabled: !!tenantId,
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.users(), enabled: !!tenantId });

  const add = useMutation({
    mutationFn: () => platform.addMember(tenantId!, { userId: Number(userId), role }),
    onSuccess: () => {
      setUserId("");
      void queryClient.invalidateQueries({ queryKey: ["members", tenantId] });
      toast.success("Участник добавлен");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (membershipId: number) => platform.removeMember(tenantId!, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", tenantId] });
      toast.success("Участник удалён");
    },
    onError: (e: Error) => toast.error(e.message),
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
        Участники и роли
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{tenant.name}</p>

      <form
        className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (userId) add.mutate();
        }}
      >
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Выберите пользователя…</option>
          {(users.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {userHandle(u)}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {MEMBER_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={!userId || add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Добавить
        </Button>
      </form>

      {members.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : members.isError ? (
        <p className="mt-5 text-sm text-destructive">{(members.error as Error).message}</p>
      ) : members.data?.length ? (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Участник</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.data.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      {m.full_name || (m.username ? `@${m.username}` : `#${m.user_id}`)}
                    </td>
                    <td className="px-4 py-3">{MEMBER_ROLE_LABELS[m.role] ?? m.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.is_active ? "Активен" : "Отключён"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove.mutate(m.id)}
                        aria-label="Удалить участника"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-5 space-y-3 sm:hidden">
            {members.data.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {m.full_name || (m.username ? `@${m.username}` : `#${m.user_id}`)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {MEMBER_ROLE_LABELS[m.role] ?? m.role} · {m.is_active ? "активен" : "отключён"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => remove.mutate(m.id)}
                  aria-label="Удалить участника"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Участников пока нет.</p>
      )}
    </AppLayout>
  );
}
