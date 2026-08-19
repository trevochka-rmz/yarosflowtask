import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatDate } from "@/lib/api";
import { useCurrentTenant } from "@/lib/platform";
import {
  acquiringApi,
  TERMINAL_STATUS_COLORS,
  TERMINAL_STATUS_LABELS,
  type TerminalStatsRanges,
} from "@/lib/acquiring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acquiring")({
  head: () => ({
    meta: [
      { title: "Эквайринг — терминалы" },
      {
        name: "description",
        content: "Статистика и список терминалов эквайринга: статусы, поиск, фильтры.",
      },
    ],
  }),
  component: AcquiringPage,
});

type ViewFilter = "all" | "pending" | "registered" | "paid";
type SortOption =
  | "created_desc"
  | "created_asc"
  | "registered_desc"
  | "registered_asc"
  | "paid_desc"
  | "paid_asc"
  | "duration_desc"
  | "duration_asc";

function buildQuery({
  page,
  limit,
  search,
  view,
  sort,
}: {
  page: number;
  limit: number;
  search: string;
  view: ViewFilter;
  sort: SortOption;
}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));

  const trimmed = search.trim();
  if (trimmed) params.set("q", trimmed);

  switch (view) {
    case "pending":
      params.set("status", "pending");
      break;
    case "registered":
      params.set("status", "registered");
      params.set("hasInn", "true");
      break;
    case "paid":
      params.set("status", "paid");
      break;
    default:
      break;
  }

  switch (sort) {
    case "created_desc":
      params.set("sort", "created_at");
      params.set("order", "desc");
      break;
    case "created_asc":
      params.set("sort", "created_at");
      params.set("order", "asc");
      break;
    case "registered_desc":
      params.set("sort", "registered_at");
      params.set("order", "desc");
      break;
    case "registered_asc":
      params.set("sort", "registered_at");
      params.set("order", "asc");
      break;
    case "paid_desc":
      params.set("sort", "paid_at");
      params.set("order", "desc");
      break;
    case "paid_asc":
      params.set("sort", "paid_at");
      params.set("order", "asc");
      break;
    case "duration_desc":
      params.set("status", "paid");
      params.set("sort", "duration");
      params.set("order", "desc");
      break;
    case "duration_asc":
      params.set("status", "paid");
      params.set("sort", "duration");
      params.set("order", "asc");
      break;
  }

  return params;
}

function StatBlock({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2 text-xs sm:text-sm">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 text-base font-semibold text-foreground sm:text-lg">
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatsSection() {
  const [range, setRange] = useState<"all" | "week" | "month">("all");
  const stats = useQuery({
    queryKey: ["acquiring-stats"],
    queryFn: () => acquiringApi.stats(),
  });

  if (stats.isPending) {
    return (
      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 flex gap-2">
          <div className="h-16 flex-1 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 flex-1 animate-pulse rounded-xl bg-muted" />
          <div className="hidden h-16 flex-1 animate-pulse rounded-xl bg-muted sm:block" />
        </div>
      </section>
    );
  }

  if (stats.isError || !stats.data) return null;

  const data = stats.data as TerminalStatsRanges;
  const current = data[range];

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-brand-deep sm:text-lg">
          Статистика терминалов
        </h2>
        <div className="ml-auto inline-flex gap-1 rounded-full bg-muted p-1 text-xs">
          {(
            [
              ["all", "За всё время"],
              ["week", "7 дней"],
              ["month", "30 дней"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                range === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <StatBlock label="Всего" value={current?.total ?? "—"} />
        <StatBlock label="Ждут регистрации" value={current?.pending ?? "—"} />
        <StatBlock label="Зарегистрированы" value={current?.registered ?? "—"} />
        <StatBlock label="Оплачены" value={current?.paid ?? "—"} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <StatBlock label="Отменены" value={current?.cancelled ?? "—"} />
        <StatBlock label="Среднее время до оплаты" value={current?.avgDuration ?? "—"} />
        <StatBlock
          label="Мин/макс до оплаты"
          value={`${current?.minDuration ?? "—"} / ${current?.maxDuration ?? "—"}`}
        />
      </div>
    </section>
  );
}

function CreateTerminalForm() {
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      acquiringApi.createPending({ serialNumber: serial.trim(), notes: notes.trim() || undefined }),
    onSuccess: (terminal) => {
      toast.success(`Терминал ${terminal.serialNumber} создан`);
      setSerial("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["acquiring-registrations"] });
      void qc.invalidateQueries({ queryKey: ["acquiring-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = !serial.trim() || mutation.isPending;

  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        mutation.mutate();
      }}
    >
      <div>
        <Label htmlFor="serial">Серийный номер</Label>
        <Input
          id="serial"
          placeholder="SN-123456"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="notes">Заметка (опционально)</Label>
        <Input
          id="notes"
          placeholder="Комментарий для себя"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full sm:w-auto" disabled={disabled}>
        {mutation.isPending ? (
          "Создаём…"
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Создать терминал
          </span>
        )}
      </Button>
    </form>
  );
}

function AcquiringPage() {
  const { tenant } = useCurrentTenant();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [sort, setSort] = useState<SortOption>("created_desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const isOrgAllowed = tenant?.id === 1;

  const query = useQuery({
    queryKey: ["acquiring-registrations", page, limit, appliedSearch, view, sort],
    enabled: isOrgAllowed,
    queryFn: async () => {
      const params = buildQuery({ page, limit, search: appliedSearch, view, sort });
      return acquiringApi.registrations(params);
    },
  });

  const terminals = query.data?.data ?? [];
  const pagination = query.data?.pagination;

  return (
    <AppLayout>
      {!isOrgAllowed ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Страница эквайринга доступна только для организации с ID 1.
        </div>
      ) : (
        <>
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
                Эквайринг
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Статистика и список всех терминалов организации.
              </p>
            </div>
          </header>

          <StatsSection />

          <CreateTerminalForm />

          <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedSearch(search);
                  setPage(1);
                }}
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по ИНН, серийному номеру или названию"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button type="submit" variant="outline" className="shrink-0">
                  Найти
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <SlidersHorizontal className="h-3 w-3" /> Фильтры
                </span>
                <div className="inline-flex rounded-full bg-muted p-1">
                  {(
                    [
                      ["all", "Все"],
                      ["pending", "Ждут регистрации"],
                      ["registered", "Зарегистрированы"],
                      ["paid", "С оплатой"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setView(key);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors md:text-sm",
                        view === key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Сортировка</Label>
                  <Select
                    value={sort}
                    onValueChange={(value) => {
                      setSort(value as SortOption);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[220px] text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_desc">По дате создания (новые сверху)</SelectItem>
                      <SelectItem value="created_asc">По дате создания (старые сверху)</SelectItem>
                      <SelectItem value="registered_desc">По дате регистрации (новые)</SelectItem>
                      <SelectItem value="registered_asc">По дате регистрации (старые)</SelectItem>
                      <SelectItem value="paid_desc">По дате оплаты (новые)</SelectItem>
                      <SelectItem value="paid_asc">По дате оплаты (старые)</SelectItem>
                      <SelectItem value="duration_desc">
                        По времени до оплаты (долго → быстро)
                      </SelectItem>
                      <SelectItem value="duration_asc">
                        По времени до оплаты (быстро → долго)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mt-4">
              {query.isPending ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : query.isError ? (
                <p className="text-sm text-destructive">{(query.error as Error).message}</p>
              ) : terminals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Терминалов пока нет.</p>
              ) : (
                <>
                  <div className="-mx-4 hidden overflow-x-auto md:mx-0 md:block">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">ID</th>
                          <th className="px-4 py-2 font-medium">Серийный номер</th>
                          <th className="px-4 py-2 font-medium">ИНН</th>
                          <th className="px-4 py-2 font-medium">Объект</th>
                          <th className="px-4 py-2 font-medium">Адрес</th>
                          <th className="px-4 py-2 font-medium">Статус</th>
                          <th className="px-4 py-2 font-medium">Регистрация</th>
                          <th className="px-4 py-2 font-medium">Оплата</th>
                          <th className="px-4 py-2 font-medium">Время до оплаты</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {terminals.map((t) => (
                          <tr key={t.id} className="transition-colors hover:bg-accent/40">
                            <td className="px-4 py-2 text-muted-foreground">{t.id}</td>
                            <td className="px-4 py-2">
                              <Link
                                to="/acquiring/$terminalId"
                                params={{ terminalId: String(t.id) }}
                                className="font-medium text-primary hover:underline"
                              >
                                {t.serialNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{t.inn ?? "—"}</td>
                            <td className="px-4 py-2">
                              <div className="max-w-[220px] truncate">
                                {t.objectName || t.subjectName || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="max-w-[260px] truncate text-muted-foreground">
                                {t.objectAddress || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  TERMINAL_STATUS_COLORS[t.status],
                                )}
                              >
                                {TERMINAL_STATUS_LABELS[t.status]}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {formatDate(t.registeredAt)}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {formatDate(t.paidAt)}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {t.durationHuman ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Мобильные карточки */}
                  <ul className="space-y-3 md:hidden">
                    {terminals.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-2xl border border-border bg-card/80 p-4 shadow-soft"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to="/acquiring/$terminalId"
                              params={{ terminalId: String(t.id) }}
                              className="font-medium text-primary hover:underline"
                            >
                              {t.serialNumber}
                            </Link>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              ИНН: {t.inn ?? "—"}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t.objectName || t.subjectName || "—"}
                            </div>
                            {t.objectAddress ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {t.objectAddress}
                              </div>
                            ) : null}
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                              TERMINAL_STATUS_COLORS[t.status],
                            )}
                          >
                            {TERMINAL_STATUS_LABELS[t.status]}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div>
                            <div className="uppercase tracking-wide">Регистрация</div>
                            <div>{formatDate(t.registeredAt)}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide">Первая оплата</div>
                            <div>{formatDate(t.paidAt)}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide">Время до оплаты</div>
                            <div>{t.durationHuman ?? "—"}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {pagination && pagination.totalPages > 1 ? (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (page > 1) setPage(page - 1);
                            }}
                          />
                        </PaginationItem>
                        {Array.from({ length: pagination.totalPages }).map((_, index) => {
                          const p = index + 1;
                          return (
                            <PaginationItem key={p}>
                              <PaginationLink
                                href="#"
                                isActive={p === page}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPage(p);
                                }}
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (page < pagination.totalPages) setPage(page + 1);
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </AppLayout>
  );
}
