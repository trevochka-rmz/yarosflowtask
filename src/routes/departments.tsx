import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orgApi, useCurrentOrg, type Department } from "@/lib/org";

export const Route = createFileRoute("/departments")({
  head: () => ({
    meta: [
      { title: "Отделы организации — Yaya.Цифровой Бот" },
      { name: "description", content: "Отделы организации: структура, создание и редактирование." },
      { property: "og:title", content: "Отделы организации — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Структура отделов и распределение сотрудников." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentEditor({
  department,
  orgId,
  onSaved,
  disabled,
}: {
  department: Department;
  orgId: number;
  onSaved: () => Promise<unknown>;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(department.name);
  const [code, setCode] = useState(department.code ?? "");
  const save = useMutation({
    mutationFn: () =>
      orgApi.updateDepartment(orgId, department.id, {
        name: name.trim(),
        code: code.trim().toUpperCase() || null,
      }),
    onSuccess: async () => {
      await onSaved();
      setEditing(false);
      toast.success("Название и код отдела обновлены");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!editing)
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setName(department.name);
          setCode(department.code ?? "");
          setEditing(true);
        }}
      >
        <Pencil className="h-4 w-4" />
        Редактировать
      </Button>
    );
  const unchanged =
    name.trim() === department.name && (code.trim().toUpperCase() || null) === department.code;
  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() && !save.isPending && !disabled) save.mutate();
      }}
    >
      <label className="grid gap-1 text-xs text-muted-foreground">
        Название отдела
        <Input
          value={name}
          maxLength={150}
          required
          disabled={save.isPending || disabled}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Код отдела
        <Input
          value={code}
          maxLength={50}
          disabled={save.isPending || disabled}
          placeholder="Например, IT"
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">Оставьте код пустым, если он не нужен.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || unchanged || save.isPending || disabled}
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Сохранить
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={save.isPending}
          onClick={() => setEditing(false)}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}

function DepartmentsPage() {
  const { org, can } = useCurrentOrg();
  const orgId = org?.id;
  const queryClient = useQueryClient();

  const canCreate = can("department.create");
  const canUpdate = can("department.update");
  const canDelete = can("department.delete");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const departments = useQuery({
    queryKey: ["org-departments", orgId],
    queryFn: () => orgApi.departments(orgId!),
    enabled: !!orgId,
  });
  const templates = useQuery({
    queryKey: ["department-templates"],
    queryFn: () => orgApi.departmentTemplates(),
    staleTime: 10 * 60_000,
  });

  const invalidate = () =>
    Promise.all(
      [
        ["org-departments", orgId],
        ["org-members", orgId],
        ["employee-report-members-settings", orgId],
        ["employee-reports", orgId],
        ["employee-report-detail", orgId],
        ["employee-general-report", orgId],
        ["notification-settings", orgId],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  const onError = (e: Error) => toast.error(e.message);

  const create = useMutation({
    mutationFn: () =>
      orgApi.createDepartment(orgId!, {
        name: name.trim(),
        ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
      }),
    onSuccess: () => {
      setName("");
      setCode("");
      void invalidate();
      toast.success("Отдел создан");
    },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (v: { id: number; is_active: boolean }) =>
      orgApi.updateDepartment(orgId!, v.id, { is_active: v.is_active }),
    onSuccess: () => {
      void invalidate();
      toast.success("Отдел обновлён");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => orgApi.deleteDepartment(orgId!, id),
    onSuccess: () => {
      void invalidate();
      toast.success("Отдел удалён");
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

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">Отделы</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {org.name} · структура подразделений организации
      </p>

      {canCreate ? (
        <form
          className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название отдела, например «Маркетинг»"
          />
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код (MKT)" />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Создать
          </Button>
        </form>
      ) : null}

      {departments.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : departments.isError ? (
        <p className="mt-5 text-sm text-destructive">{(departments.error as Error).message}</p>
      ) : departments.data?.length ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.data.map((d) => (
            <li key={d.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <span className="block break-words font-semibold text-brand-deep">{d.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.code ?? "—"} · {d.is_active ? "активен" : "выключен"}
                  </span>
                </div>
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => remove.mutate(d.id)}
                    aria-label="Удалить отдел"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {d.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
              ) : null}
              {canUpdate ? (
                <div className="mt-3 grid gap-2">
                  <DepartmentEditor
                    key={`${orgId}:${d.id}`}
                    department={d}
                    orgId={orgId!}
                    onSaved={invalidate}
                    disabled={remove.isPending || toggleActive.isPending}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={toggleActive.isPending || remove.isPending}
                    onClick={() => toggleActive.mutate({ id: d.id, is_active: !d.is_active })}
                  >
                    {d.is_active ? "Выключить" : "Включить"}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Отделов пока нет.</p>
      )}

      {templates.data?.length ? (
        <section className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
            <Building className="h-4 w-4" /> Глобальные шаблоны отделов
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {templates.data.map((t) => (
              <li
                key={t.id}
                className="rounded-full bg-card px-2.5 py-1 text-xs text-muted-foreground"
              >
                {t.name} · {t.code}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppLayout>
  );
}
