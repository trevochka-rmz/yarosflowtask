import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, FileClock, Filter, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import { platform, type AuditEntry, useCurrentTenant } from "@/lib/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Журнал аудита — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Лента действий организации: кто, что и когда изменил в ботах и заявках.",
      },
      { property: "og:title", content: "Журнал аудита — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Прозрачная история действий в организации." },
    ],
  }),
  component: AuditPage,
});

const ACTION_LABELS: Record<string, string> = {
  "integration.bitrix.connect": "Подключение Bitrix24",
  "integration.bitrix.connect_failed": "Ошибка подключения Bitrix24",
  "integration.delete": "Удаление интеграции",
  "bot.create": "Создание бота",
  "bot.update": "Изменение бота",
  "task.create": "Создание задачи",
  "task.status": "Смена статуса задачи",
  "task.assign": "Назначение задачи",
  "chat.proposal.accept": "Подтверждение в чате",
  "chat.proposal.reject": "Отмена предложения в чате",
  "change_request.create": "Заявка на изменение",
  "change_request.status": "Статус заявки",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatActor(e: AuditEntry) {
  if (e.actor_name || e.actor_username) {
    const parts = [] as string[];
    if (e.actor_name) parts.push(e.actor_name);
    if (e.actor_username) parts.push(`@${e.actor_username}`);
    if (e.actor_id) parts.push(`#${e.actor_id}`);
    return parts.join(" · ");
  }
  return e.actor_id ? `Пользователь #${e.actor_id}` : "—";
}

function parseMeta(raw: AuditEntry["meta"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return { value: raw };
    }
  }
  return raw ?? {};
}

function metaSummary(meta: Record<string, unknown>): string | null {
  if (!meta || Object.keys(meta).length === 0) return null;
  if (typeof meta.title === "string" && meta.title) return meta.title;
  if (typeof meta.name === "string" && meta.name) return meta.name;
  if (typeof meta.status === "string" && meta.status) return `Статус: ${meta.status}`;
  if (typeof meta.ok === "boolean") return meta.ok ? "Успешно" : "Ошибка";
  return null;
}

function AuditPage() {
  const { tenant } = useCurrentTenant();
  const organizationId = tenant?.id;

  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorId, setActorId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: [
      "audit",
      organizationId,
      { action, entityType, entityId, actorId, fromDate, toDate, search, limit, offset },
    ],
    enabled: !!organizationId,
    queryFn: () =>
      platform.audit({
        organizationId: organizationId!,
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(actorId ? { actorId: Number(actorId) || undefined } : {}),
        ...(fromDate ? { from: fromDate } : {}),
        ...(toDate ? { to: `${toDate}T23:59:59` } : {}),
        ...(search ? { q: search } : {}),
        limit,
        offset,
      }),
    keepPreviousData: true,
  });

  const rows = query.data ?? [];
  const canPrev = offset > 0;
  const canNext = rows.length === limit;
  const currentPage = Math.floor(offset / limit) + 1;

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
        Журнал аудита
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{tenant.name}</p>

      {/* Панель фильтров */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Фильтры
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="audit-action">Действие</Label>
            <Input
              id="audit-action"
              placeholder="task.* или integration.bitrix.connect"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Тип сущности</Label>
            <Select
              value={entityType}
              onValueChange={(val) => {
                setEntityType(val === "all" ? "" : val);
                setOffset(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="task">Задачи</SelectItem>
                <SelectItem value="bot">Боты</SelectItem>
                <SelectItem value="integration">Интеграции</SelectItem>
                <SelectItem value="change_request">Заявки</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-entity-id">ID сущности</Label>
            <Input
              id="audit-entity-id"
              placeholder="например 15"
              value={entityId}
              onChange={(e) => {
                setEntityId(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-actor-id">ID пользователя</Label>
            <Input
              id="audit-actor-id"
              placeholder="например 2"
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-from">С даты</Label>
            <Input
              id="audit-from"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-to">По дату</Label>
            <Input
              id="audit-to"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-2">
            <Label htmlFor="audit-search">Поиск</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="audit-search"
                  className="pl-8"
                  placeholder="Поиск по действию и деталям (например Bitrix, просроч)"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOffset(0);
                  }}
                />
              </div>
              <div className="w-28">
                <Label htmlFor="audit-limit" className="sr-only">
                  Лимит
                </Label>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => {
                    const n = Number(val) || 50;
                    setLimit(n);
                    setOffset(0);
                  }}
                >
                  <SelectTrigger id="audit-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица событий */}
      {query.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Загрузка…</p>
      ) : query.isError ? (
        <p className="mt-5 text-sm text-destructive">{(query.error as Error).message}</p>
      ) : rows.length ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Время</th>
                  <th className="px-4 py-2 text-left font-medium">Действие</th>
                  <th className="px-4 py-2 text-left font-medium">Сущность</th>
                  <th className="px-4 py-2 text-left font-medium">Пользователь</th>
                  <th className="px-4 py-2 text-left font-medium">Детали</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((e) => {
                  const metaObj = parseMeta(e.meta);
                  const summary = metaSummary(metaObj);
                  return (
                    <tr key={e.id} className="align-top hover:bg-accent/40">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                        {formatDate(e.created_at)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-foreground">
                          {actionLabel(e.action)}
                        </div>
                        {e.action && (
                          <div className="text-[11px] text-muted-foreground">{e.action}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {e.entity_type ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                            <span className="font-mono text-[11px]">{e.entity_type}</span>
                            {e.entity_id && (
                              <span className="ml-1 text-[11px] text-foreground">
                                #{e.entity_id}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatActor(e)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {summary ? (
                          <div className="line-clamp-2 max-w-xs text-foreground">{summary}</div>
                        ) : Object.keys(metaObj).length > 0 ? (
                          <pre className="max-h-32 max-w-xs overflow-auto rounded bg-muted/80 p-2 text-[11px]">
                            {JSON.stringify(metaObj, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <div>
              Страница {currentPage}, показано {rows.length} записей
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={!canPrev || query.isPending}
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={!canNext || query.isPending}
                onClick={() => setOffset((prev) => prev + limit)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Записей пока нет.</p>
      )}
    </AppLayout>
  );
}
