import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orgApi, useCurrentOrg } from "@/lib/org";

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["org-departments", orgId] });
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
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код (MKT)"
          />
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
                  <span className="block truncate font-semibold text-brand-deep">{d.name}</span>
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
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => toggleActive.mutate({ id: d.id, is_active: !d.is_active })}
                >
                  {d.is_active ? "Выключить" : "Включить"}
                </Button>
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
