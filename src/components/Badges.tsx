import {
  BookOpen,
  Bug,
  ClipboardList,
  Check,
  GitBranch,
  Lightbulb,
  type LucideIcon,
  LifeBuoy,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type TaskStatus } from "@/lib/api";

const STATUS_STYLES: Record<TaskStatus, string> = {
  BACKLOG: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SELECTED: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  WAITING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  IN_PROGRESS: "bg-primary/12 text-primary",
  REVIEW: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  DONE: "bg-chart-2/15 text-chart-2",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  lowest: "bg-muted/60 text-muted-foreground",
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-chart-5/15 text-chart-5",
  highest: "bg-destructive/10 text-destructive",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Pill className={STATUS_STYLES[status] ?? STATUS_STYLES.BACKLOG}>
      {STATUS_LABELS[status] ?? status}
    </Pill>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Pill className={PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium}>
      {PRIORITY_LABELS[priority] ?? priority}
    </Pill>
  );
}

export function AssignmentBadge({ count }: { count: number }) {
  return (
    <Pill
      className={
        count > 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
      }
    >
      {count > 0 ? `Назначена · ${count}` : "Не назначена"}
    </Pill>
  );
}

export function SourceBadge({
  source,
  externalKey,
}: {
  source?: string | null;
  externalKey?: string | null;
}) {
  if (source === "jira") {
    return (
      <Pill className="bg-[#0052CC]/10 text-[#0052CC]">
        Jira{externalKey ? ` ${externalKey}` : ""}
      </Pill>
    );
  }
  return <Pill className="bg-muted text-muted-foreground">Внутренняя</Pill>;
}

type TaskTypeMeta = {
  label: string;
  icon: LucideIcon;
  className: string;
  compactClassName: string;
};

function getTaskTypeMeta(issueType: string): TaskTypeMeta {
  const normalized = issueType.trim().toLowerCase();
  if (normalized.includes("epic") || normalized.includes("эпик")) {
    return {
      label: issueType,
      icon: Zap,
      className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
      compactClassName: "bg-[#8777D9] text-white",
    };
  }
  if (normalized.includes("bug") || normalized.includes("ошиб") || normalized.includes("дефект")) {
    return {
      label: issueType,
      icon: Bug,
      className: "bg-destructive/10 text-destructive",
      compactClassName: "bg-[#E5493A] text-white",
    };
  }
  if (normalized.includes("improvement") || normalized.includes("улучш")) {
    return {
      label: issueType,
      icon: Lightbulb,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      compactClassName: "bg-[#FFAB00] text-white",
    };
  }
  if (normalized.includes("story") || normalized.includes("истори")) {
    return {
      label: issueType,
      icon: BookOpen,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      compactClassName: "bg-[#36B37E] text-white",
    };
  }
  if (normalized.includes("sub-task") || normalized.includes("подзадач")) {
    return {
      label: issueType,
      icon: GitBranch,
      className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      compactClassName: "bg-[#4C9AFF] text-white",
    };
  }
  if (normalized.includes("support") || normalized.includes("поддерж")) {
    return {
      label: issueType,
      icon: LifeBuoy,
      className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
      compactClassName: "bg-[#00B8D9] text-white",
    };
  }
  return {
    label: issueType,
    icon: normalized.includes("task") || normalized.includes("задач") ? Check : ClipboardList,
    className: "bg-muted text-muted-foreground",
    compactClassName: "bg-[#4C9AFF] text-white",
  };
}

export function TaskTypeBadge({
  issueType,
  compact = false,
}: {
  issueType?: string | null;
  compact?: boolean;
}) {
  if (!issueType?.trim()) return null;
  const meta = getTaskTypeMeta(issueType);
  const Icon = meta.icon;

  if (compact) {
    return (
      <span
        title={meta.label}
        aria-label={`Тип задачи: ${meta.label}`}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px]",
          meta.compactClassName,
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Pill className={cn("gap-1.5", meta.className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </Pill>
  );
}
