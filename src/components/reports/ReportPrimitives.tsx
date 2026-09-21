import { Link } from "@tanstack/react-router";
import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileVideo,
  GitCommitHorizontal,
  ListChecks,
  Search,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { Department, OrgMember } from "@/lib/org";
import { rangeFor, type ReportFilters, type ReportType } from "@/lib/reports";

export const reportTabs: Array<{ value: ReportType; label: string; icon: typeof ListChecks }> = [
  { value: "all", label: "Все", icon: Users },
  { value: "commits", label: "Коммиты", icon: GitCommitHorizontal },
  { value: "tasks", label: "Задачи", icon: ListChecks },
  { value: "video", label: "Видеоотчеты", icon: FileVideo },
];

export function ReportsHeader({
  filters,
  departments,
  members,
  onChange,
}: {
  filters: ReportFilters;
  departments: Department[];
  members: OrgMember[];
  onChange: (filters: ReportFilters) => void;
}) {
  const [dayOpen, setDayOpen] = React.useState(false);
  const preset = React.useMemo(() => {
    const isRange = (range: { from: string; to: string }) =>
      filters.from === range.from && filters.to === range.to;
    if (isRange(rangeFor("today"))) return "today";
    if (isRange(rangeFor("yesterday"))) return "yesterday";
    if (isRange(rangeFor("7"))) return "7";
    if (isRange(rangeFor("30"))) return "30";
    return "custom";
  }, [filters.from, filters.to]);
  const selectedPeriodLabel = React.useMemo(() => {
    const format = (date: string) =>
      new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${date}T00:00:00`));
    if (filters.from === filters.to) return format(filters.from);
    return `${format(filters.from)} — ${format(filters.to)}`;
  }, [filters.from, filters.to]);
  const setRange = (value: string) => {
    if (value === "custom") return;
    const range = value.includes("|")
      ? (() => {
          const [from, to] = value.split("|");
          return { from, to };
        })()
      : rangeFor(value);
    onChange({ ...filters, ...range });
  };
  return (
    <>
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
            Отчеты по сотрудникам
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Анализ активности команды: задачи, коммиты и видеоотчеты
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={preset} onValueChange={setRange}>
            <SelectTrigger className="min-w-[190px] bg-card">
              <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="yesterday">Вчера</SelectItem>
              <SelectItem value="7">За неделю</SelectItem>
              <SelectItem value="30">За месяц</SelectItem>
              <SelectItem value="custom" disabled>
                Выбранный период: {selectedPeriodLabel}
              </SelectItem>
            </SelectContent>
          </Select>
          <Popover open={dayOpen} onOpenChange={setDayOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <CalendarDays className="h-4 w-4" />
                {preset === "custom" && filters.from === filters.to
                  ? selectedPeriodLabel
                  : "Выбрать день"}
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-64 space-y-3">
              <p className="text-sm font-medium">
                {preset === "custom" && filters.from === filters.to
                  ? "Изменить выбранный день"
                  : "Выберите день"}
              </p>
              <input
                type="date"
                value={filters.from === filters.to ? filters.from : ""}
                onChange={(event) => {
                  const date = event.target.value;
                  if (date) {
                    onChange({ ...filters, from: date, to: date });
                    setDayOpen(false);
                  }
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <ReportsFilters
        filters={filters}
        departments={departments}
        members={members}
        onChange={onChange}
      />
    </>
  );
}

function ReportsFilters({
  filters,
  departments,
  members,
  onChange,
}: {
  filters: ReportFilters;
  departments: Department[];
  members: OrgMember[];
  onChange: (filters: ReportFilters) => void;
}) {
  const itDepartment = departments.find((department) =>
    ["it", "ит"].includes(department.name.trim().toLowerCase()),
  );
  const itMembers = members.filter((member) => {
    const role = (member.role_name || "").trim().toLowerCase();
    return (
      (!itDepartment || member.department_id === itDepartment.id) &&
      !["manager", "менеджер", "administrator", "администратор"].includes(role)
    );
  });
  return (
    <div className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft md:grid-cols-[minmax(180px,1fr)_220px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search ?? ""}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          className="border-0 bg-muted/50 pl-9 shadow-none"
          placeholder="Поиск сотрудника"
        />
      </div>
      <Select
        value={String(filters.memberId ?? "all")}
        onValueChange={(value) =>
          onChange({ ...filters, memberId: value === "all" ? undefined : Number(value) })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Сотрудник" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все сотрудники</SelectItem>
          {itMembers.map((member) => (
            <SelectItem key={member.id} value={String(member.id)}>
              {member.full_name || member.username || `#${member.user_id}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReportTypeTabs({
  type,
  onChange,
}: {
  type: ReportType;
  onChange: (type: ReportType) => void;
}) {
  return (
    <Tabs value={type} onValueChange={(value) => onChange(value as ReportType)} className="mt-6">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
        <>
          {reportTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 gap-2 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </>
      </TabsList>
    </Tabs>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone?: "primary" | "violet" | "amber" | "rose";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    violet: "bg-violet-500/10 text-violet-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("rounded-xl p-2", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function EmployeeName({
  member,
  compact = false,
}: {
  member: OrgMember;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        avatarUrl={member.avatar_url}
        name={member.full_name}
        className={compact ? "h-8 w-8" : "h-10 w-10"}
      />
      <div className="min-w-0">
        <p className="break-words font-medium">{member.full_name || member.username || "Без имени"}</p>
        {!compact && (
          <p className="truncate text-xs text-muted-foreground">
            {member.department_name || member.role_name || "Сотрудник"}
          </p>
        )}
      </div>
    </div>
  );
}

export function EmptyReport({ type = "activity" }: { type?: string }) {
  const copy: Record<string, string> = {
    commits: "Коммитов за выбранный период нет.",
    tasks: "Задач за выбранный период нет.",
    video: "Видеоотчетов за выбранный период нет.",
    activity: "За выбранный период активности нет.",
  };
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <CheckCircle2 className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{copy[type] ?? copy.activity}</p>
    </div>
  );
}

export function EmployeeLink({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <Link
      to="/reports/employees/$employeeId"
      params={{ employeeId: String(id) }}
      className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}
