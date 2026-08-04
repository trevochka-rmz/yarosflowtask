import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { api, formatDate, userLabel } from "@/lib/api";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Команда — YAROS.TaskFlow" },
      { name: "description", content: "Сотрудники и руководители: роли, статус активности, контакты." },
      { property: "og:title", content: "Команда — YAROS.TaskFlow" },
      { property: "og:description", content: "Список участников и их роли в системе задач." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const query = useQuery({ queryKey: ["users"], queryFn: () => api.users() });

  return (
    <AppLayout>
      <h1 className="text-3xl font-semibold tracking-tight text-brand-deep">Команда</h1>
      <p className="mt-1 text-sm text-muted-foreground">Руководители и сотрудники системы.</p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {query.isPending ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="p-6 text-sm text-destructive">{(query.error as Error).message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Имя</th>
                  <th className="px-4 py-3 font-medium">Telegram</th>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-4 py-3 font-medium">Активен</th>
                  <th className="px-4 py-3 font-medium">Последняя активность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.data?.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3 text-muted-foreground">{u.id}</td>
                    <td className="px-4 py-3 font-medium">{userLabel(u)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.username ? `@${u.username}` : u.tg_id}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "manager" ? "Руководитель" : "Сотрудник"}
                    </td>
                    <td className="px-4 py-3">{u.is_active ? "Да" : "Нет"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
