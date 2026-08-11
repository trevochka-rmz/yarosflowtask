import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Lock, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupPermissions, orgApi, useCurrentOrg, type OrgRole } from "@/lib/org";

export const Route = createFileRoute("/roles")({
  head: () => ({
    meta: [
      { title: "Роли и права — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Роли организации: набор прав, системные шаблоны и кастомные роли.",
      },
      { property: "og:title", content: "Роли и права — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Создание ролей и настройка прав доступа." },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const { org, can } = useCurrentOrg();
  const orgId = org?.id;
  const queryClient = useQueryClient();

  const canRead = can("role.read");
  const canCreate = can("role.create");
  const canUpdate = can("role.update");
  const canDelete = can("role.delete");

  const [editing, setEditing] = useState<OrgRole | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const roles = useQuery({
    queryKey: ["org-roles", orgId],
    queryFn: () => orgApi.roles(orgId!),
    enabled: !!orgId && canRead,
  });
  const permissions = useQuery({
    queryKey: ["permissions"],
    queryFn: () => orgApi.permissions(),
    staleTime: 10 * 60_000,
  });
  const templates = useQuery({
    queryKey: ["role-templates"],
    queryFn: () => orgApi.roleTemplates(),
    staleTime: 10 * 60_000,
  });

  const groups = useMemo(() => groupPermissions(permissions.data ?? []), [permissions.data]);

  const reset = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSelected([]);
  };

  const startNew = () => {
    setEditing("new");
    setName("");
    setDescription("");
    setSelected([]);
  };

  const startEdit = (r: OrgRole) => {
    setEditing(r);
    setName(r.name);
    setDescription(r.description ?? "");
    setSelected(r.permissions ?? []);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["org-roles", orgId] });
  const onError = (e: Error) => toast.error(e.message);

  const save = useMutation({
    mutationFn: () =>
      editing === "new"
        ? orgApi.createRole(orgId!, {
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            permissions: selected,
          })
        : orgApi.updateRole(orgId!, (editing as OrgRole).id, {
            name: name.trim(),
            description: description.trim(),
            permissions: selected,
          }),
    onSuccess: () => {
      void invalidate();
      toast.success(editing === "new" ? "Роль создана" : "Роль обновлена");
      reset();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (roleId: number) => orgApi.deleteRole(orgId!, roleId),
    onSuccess: () => {
      void invalidate();
      toast.success("Роль удалена");
    },
    onError,
  });

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const toggleGroup = (codes: string[], all: boolean) =>
    setSelected((prev) =>
      all ? prev.filter((c) => !codes.includes(c)) : [...new Set([...prev, ...codes])],
    );

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
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">Роли и права</h1>
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          У вашей роли «{org.role_name}» нет права <code>role.read</code>.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <header className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Роли и права
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.name} · права определяют, какие разделы видит сотрудник
          </p>
        </div>
        {canCreate ? (
          <Button className="w-full sm:w-auto" onClick={startNew}>
            <Plus className="h-4 w-4" /> Новая роль
          </Button>
        ) : null}
      </header>

      {editing ? (
        <form
          className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="text-base font-semibold text-brand-deep">
              {editing === "new" ? "Новая роль" : `Роль «${editing.name}»`}
            </h2>
            <Button type="button" size="sm" variant="ghost" onClick={reset} aria-label="Закрыть">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название роли, например «Руководитель продаж»"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание (необязательно)"
            />
          </div>

          <p className="mt-4 text-sm font-medium">
            Права <span className="text-muted-foreground">· выбрано {selected.length}</span>
          </p>

          {permissions.isPending ? (
            <p className="mt-2 text-sm text-muted-foreground">Загружаем список прав…</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {groups.map((g) => {
                const codes = g.items.map((i) => i.code);
                const all = codes.every((c) => selected.includes(c));
                return (
                  <div key={g.group} className="rounded-xl border border-border p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <span className="truncate text-sm font-medium text-brand-deep">
                        {g.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(codes, all)}
                        className="shrink-0 text-xs text-primary underline"
                      >
                        {all ? "снять все" : "выбрать все"}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {g.items.map((p) => (
                        <li key={p.code}>
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.includes(p.code)}
                              onChange={() => toggle(p.code)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[var(--color-primary)]"
                            />
                            <span className="min-w-0">
                              <span className="block truncate">{p.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {p.code}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить роль
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Отмена
            </Button>
          </div>
        </form>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        {roles.isPending ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : roles.isError ? (
          <p className="text-sm text-destructive">{(roles.error as Error).message}</p>
        ) : (
          (roles.data ?? []).map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-brand-deep">{r.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.is_system ? "Системная роль" : "Кастомная роль"}
                    {r.description ? ` · ${r.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canUpdate ? (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)} aria-label="Изменить">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canDelete && !r.is_system ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(r.id)}
                      aria-label="Удалить роль"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {(r.permissions ?? []).map((p) => (
                  <li
                    key={p}
                    className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                  >
                    {p}
                  </li>
                ))}
                {(r.permissions ?? []).length === 0 ? (
                  <li className="text-xs text-muted-foreground">Прав нет</li>
                ) : null}
              </ul>
            </article>
          ))
        )}
      </section>

      {templates.data?.length ? (
        <section className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
            <ShieldCheck className="h-4 w-4" /> Системные шаблоны ролей
          </h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.data.map((t) => (
              <li key={t.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <span className="block font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.description ?? t.code}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppLayout>
  );
}
