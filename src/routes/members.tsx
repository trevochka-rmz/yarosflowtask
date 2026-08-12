import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Lock, Trash2, UserPlus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import {
  orgApi,
  personLabel,
  useCurrentOrg,
  AVAILABILITY_LABELS,
  SELF_STATUSES,
  MANAGER_STATUSES,
  type OrgMember,
  type AvailabilityStatus,
} from "@/lib/org";
import { useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Сотрудники организации — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Участники организации: добавление, роли, отделы и отзыв доступа.",
      },
      { property: "og:title", content: "Сотрудники организации — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Роли, отделы и доступы участников организации." },
    ],
  }),
  component: MembersPage,
});

const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-2 text-sm disabled:opacity-60";

/** Цвет и пункт фона по статусу */
function availabilityColor(status?: AvailabilityStatus | null) {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-500";
    case "BUSY":
      return "bg-amber-500";
    case "AWAY":
      return "bg-yellow-400";
    case "VACATION":
      return "bg-sky-400";
    case "SICK_LEAVE":
      return "bg-rose-400";
    case "OFFLINE":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}

function AvailabilityBadge({ status }: { status?: AvailabilityStatus | null | undefined }) {
  const label = status ? (AVAILABILITY_LABELS[status] ?? status) : "Неизвестно";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${availabilityColor(status)}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

function StatusSelect({
  member,
  orgId,
  canAll,
  isSelf,
}: {
  member: OrgMember;
  orgId: number;
  canAll: boolean;
  isSelf: boolean;
}) {
  const qc = useQueryClient();
  const statuses = canAll ? MANAGER_STATUSES : isSelf ? SELF_STATUSES : null;
  if (!statuses) {
    return <AvailabilityBadge status={member.availability_status} />;
  }

  const set = useMutation({
    mutationFn: (s: AvailabilityStatus) => orgApi.setMemberStatus(orgId, member.id, s),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative inline-flex items-center gap-1">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${availabilityColor(member.availability_status)}`}
      />
      <select
        value={member.availability_status ?? ""}
        disabled={set.isPending}
        onChange={(e) => set.mutate(e.target.value as AvailabilityStatus)}
        className="appearance-none bg-transparent pr-4 text-xs text-muted-foreground focus:outline-none disabled:opacity-60 cursor-pointer hover:text-foreground"
      >
        {!member.availability_status && <option value="">—</option>}
        {statuses.map((s) => (
          <option key={s} value={s}>
            {AVAILABILITY_LABELS[s]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-muted-foreground" />
    </div>
  );
}

function MembersPage() {
  const { org, can } = useCurrentOrg();
  const { data: currentUser } = useCurrentUser();
  const orgId = org?.id;
  const queryClient = useQueryClient();

  const canRead = can("employee.read");
  const canCreate = can("employee.create");
  const canUpdate = can("employee.update");
  const canDelete = can("employee.delete");
  /** Право на все статусы включая VACATION/SICK */
  const canSetAllStatuses = canUpdate;

  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => orgApi.members(orgId!),
    enabled: !!orgId && canRead,
  });
  const roles = useQuery({
    queryKey: ["org-roles", orgId],
    queryFn: () => orgApi.roles(orgId!),
    enabled: !!orgId && canRead,
  });
  const departments = useQuery({
    queryKey: ["org-departments", orgId],
    queryFn: () => orgApi.departments(orgId!),
    enabled: !!orgId,
  });
  const candidates = useQuery({
    queryKey: ["users-without-org"],
    queryFn: () => orgApi.usersWithoutOrganization(),
    enabled: !!orgId && canCreate,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    void queryClient.invalidateQueries({ queryKey: ["users-without-org"] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const add = useMutation({
    mutationFn: () =>
      orgApi.addMember(orgId!, {
        userId: Number(userId),
        roleId: Number(roleId),
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      }),
    onSuccess: () => {
      setUserId("");
      setDepartmentId("");
      invalidate();
      toast.success("Сотрудник добавлен");
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: (v: {
      member: OrgMember;
      body: { roleId?: number; departmentId?: number | null; is_active?: boolean };
    }) => orgApi.updateMember(orgId!, v.member.id, v.body),
    onSuccess: () => {
      invalidate();
      toast.success("Участник обновлён");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (memberId: number) => orgApi.removeMember(orgId!, memberId),
    onSuccess: () => {
      invalidate();
      toast.success("Сотрудник убран из организации");
    },
    onError,
  });

  if (!org) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Организация не выбрана.</p>
      </AppLayout>
    );
  }

  if (!canRead) {
    return (
      <AppLayout>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">Сотрудники</h1>
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />У вашей роли «{org.role_name}» нет права{" "}
          <code>employee.read</code>. Попросите администратора организации выдать доступ.
        </p>
      </AppLayout>
    );
  }

  const roleList = roles.data ?? [];
  const deptList = departments.data ?? [];

  const RoleSelect = ({ m }: { m: OrgMember }) => (
    <select
      value={m.role_id ?? ""}
      disabled={!canUpdate || patch.isPending}
      onChange={(e) => patch.mutate({ member: m, body: { roleId: Number(e.target.value) } })}
      className={selectClass}
    >
      {roleList.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
      {roleList.some((r) => r.id === m.role_id) ? null : (
        <option value={m.role_id}>{m.role_name ?? "—"}</option>
      )}
    </select>
  );

  const DeptSelect = ({ m }: { m: OrgMember }) => (
    <select
      value={m.department_id ?? ""}
      disabled={!canUpdate || patch.isPending}
      onChange={(e) =>
        patch.mutate({
          member: m,
          body: { departmentId: e.target.value ? Number(e.target.value) : null },
        })
      }
      className={selectClass}
    >
      <option value="">Без отдела</option>
      {deptList.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Сотрудники организации
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {org.name} · ваша роль: {org.role_name}
      </p>

      {canCreate ? (
        <form
          className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,12rem)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (userId && roleId) add.mutate();
          }}
        >
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Выберите пользователя…</option>
            {(candidates.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {personLabel(u)}
              </option>
            ))}
          </select>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Роль…</option>
            {roleList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Без отдела</option>
            {deptList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!userId || !roleId || add.isPending}>
            {add.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Добавить
          </Button>
          {candidates.data && candidates.data.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
              Свободных пользователей нет — все уже состоят в организациях.
            </p>
          ) : null}
        </form>
      ) : null}

      {members.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : members.isError ? (
        <p className="mt-5 text-sm text-destructive">{(members.error as Error).message}</p>
      ) : members.data?.length ? (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Сотрудник</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Telegram</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Отдел</th>
                  <th className="px-4 py-3">Добавлен</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.data.map((m) => {
                  const isSelf = currentUser?.id === m.user_id;
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium">{personLabel(m)}</td>
                      <td className="px-4 py-3">
                        {orgId ? (
                          <StatusSelect
                            member={m}
                            orgId={orgId}
                            canAll={canSetAllStatuses}
                            isSelf={isSelf}
                          />
                        ) : (
                          <AvailabilityBadge status={m.availability_status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.username ? `@${m.username}` : (m.tg_id ?? "—")}
                      </td>
                      <td className="px-4 py-3">
                        <RoleSelect m={m} />
                      </td>
                      <td className="px-4 py-3">
                        <DeptSelect m={m} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(m.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove.mutate(m.id)}
                            aria-label="Убрать из организации"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="mt-5 space-y-3 lg:hidden">
            {members.data.map((m) => {
              const isSelf = currentUser?.id === m.user_id;
              return (
                <li key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{personLabel(m)}</span>
                      <div className="mt-0.5 flex items-center gap-2">
                        {orgId ? (
                          <StatusSelect
                            member={m}
                            orgId={orgId}
                            canAll={canSetAllStatuses}
                            isSelf={isSelf}
                          />
                        ) : (
                          <AvailabilityBadge status={m.availability_status} />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {m.username ? `@${m.username}` : (m.tg_id ?? "")}
                        </span>
                      </div>
                    </span>
                    {canDelete ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => remove.mutate(m.id)}
                        aria-label="Убрать из организации"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-2">
                    <RoleSelect m={m} />
                    <DeptSelect m={m} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Сотрудников пока нет.</p>
      )}
    </AppLayout>
  );
}
