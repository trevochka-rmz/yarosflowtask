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
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-chart-5/15 text-chart-5",
  critical: "bg-destructive/10 text-destructive",
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
