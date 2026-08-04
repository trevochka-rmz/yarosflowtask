import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type TaskStatus,
} from "@/lib/api";

const STATUS_STYLES: Record<TaskStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/12 text-primary",
  review: "bg-chart-5/15 text-chart-5",
  done: "bg-chart-2/15 text-chart-2",
  cancelled: "bg-destructive/10 text-destructive",
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
  return <Pill className={STATUS_STYLES[status] ?? STATUS_STYLES.draft}>{STATUS_LABELS[status] ?? status}</Pill>;
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
    <Pill className={count > 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}>
      {count > 0 ? `Назначена · ${count}` : "Не назначена"}
    </Pill>
  );
}
