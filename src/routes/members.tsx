import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { api, formatDate, userHandle } from "@/lib/api";
import {
  MEMBER_ROLE_LABELS,
  platform,
  roleLabel,
  useCurrentTenant,
  useRoles,
  type Member,
  type MemberRole,
} from "@/lib/platform";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Управление организацией — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Сотрудники организации: добавление, изменение ролей и отзыв доступа.",
      },
      { property: "og:title", content: "Управление организацией — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Роли и доступы участников организации." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { tenant, canManageMembers } = useCurrentTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<MemberRole>("bot_user");

  const rolesQuery = useRoles();
  const roleOptions = rolesQuery.data ?? [];

  const members = useQuery({
    queryKey: ["members", tenantId],
    queryFn: () => platform.members(tenantId!),
    enabled: !!tenantId,
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users(),
    enabled: !!tenantId && canManageMembers,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members", tenantId] });

  const handleMutationError = (e: Error) => {
    if (e.message.includes("403") || e.message.toLowerCase().includes("прав")) {
      toast.error("Недостаточно прав — нужна роль director, bot_owner или platform_admin");
    } else {
      toast.error(e.message);
    }
  };

  const add = useMutation({
    mutationFn: () => platform.addMember(tenantId!, { userId: Number(userId), role }),
    onSuccess: () => {
      setUserId("");
      void invalidate();
      toast.success("Участник добавлен");
    },
    onError: handleMutationError,
  });

  const changeRole = useMutation({
    mutationFn: (v: { member: Member; role: MemberRole }) =>
      platform.updateMemberRole(tenantId!, v.member, v.role),
    onSuccess: () => {
      void invalidate();
      toast.success("Роль обновлена");
    },
    onError: handleMutationError,
  });

  const remove = useMutation({
    mutationFn: (membershipId: number) => platform.removeMember(tenantId!, membershipId),
    onSuccess: () => {
      void invalidate();
      toast.success("Участник удалён");
    },
    onError: handleMutationError,
  });

  if (!tenant) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">
          Сначала выберите организацию на{" "}
          <Link to="/org" className="text-primary underline">
            странице организации
          </Link>
          .
        </p>
      </AppLayout>
    );
  }

  const memberName = (m: Member) =>
    m.full_name || (m.username ? `@${m.username}` : `#${m.user_id}`);

  const RoleSelect = ({ m }: { m: Member }) => (
    <select
      value={m.role}
      disabled={!canManageMembers || changeRole.isPending}
      onChange={(e) => changeRole.mutate({ member: m, role: e.target.value as MemberRole })}
      className="h-9 w-full max-w-[14rem] rounded-md border border-input bg-card px-2 text-sm disabled:opacity-60"
    >
      {(roleOptions.length
        ? roleOptions
        : (Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((c) => ({ code: c }))
      ).map((r) => (
        <option key={r.code} value={r.code}>
          {roleLabel(String(r.code), roleOptions)}
        </option>
      ))}
      {roleOptions.some((r) => r.code === m.role) ? null : (
        <option value={m.role}>{roleLabel(m.role, roleOptions)}</option>
      )}
    </select>
  );

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Управление организацией
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {tenant.name} · сотрудники, роли и доступы
      </p>

      {canManageMembers ? (
        <form
          className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]"
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
            <option value="">Выберите сотрудника…</option>
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
            {(roleOptions.length
              ? roleOptions
              : (Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((c) => ({ code: c }))
            ).map((r) => (
              <option key={r.code} value={r.code}>
                {roleLabel(String(r.code), roleOptions)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!userId || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Добавить
          </Button>
        </form>
      ) : (
        <p className="mt-5 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Управлять составом организации могут только роли «Директор», «Bot Owner» и «Админ
          платформы». Список ниже доступен только для просмотра.
        </p>
      )}

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
                  <th className="px-4 py-3">Сотрудник</th>
                  <th className="px-4 py-3">Telegram</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Добавлен</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.data.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium">{memberName(m)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.username ? `@${m.username}` : (m.tg_id ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <RoleSelect m={m} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.is_active ? "Активен" : "Отключён"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {canManageMembers ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(m.id)}
                          aria-label="Удалить сотрудника"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
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
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{memberName(m)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.username ? `@${m.username}` : (m.tg_id ?? "—")} ·{" "}
                      {m.is_active ? "активен" : "отключён"}
                    </span>
                  </span>
                  {canManageMembers ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => remove.mutate(m.id)}
                      aria-label="Удалить сотрудника"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2">
                  <RoleSelect m={m} />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Сотрудников пока нет.</p>
      )}
    </AppLayout>
  );
}
