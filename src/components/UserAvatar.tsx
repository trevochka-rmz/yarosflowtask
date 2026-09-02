import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({
  avatarUrl,
  name,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const initials =
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name || "Аватар"} /> : null}
      <AvatarFallback
        className={cn("bg-brand-gradient text-xs font-semibold text-primary-foreground", fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function AssigneeAvatars({
  assignees,
  limit = 3,
  sizeClassName = "h-6 w-6",
}: {
  assignees?: Array<{
    id?: number | null;
    avatar_url?: string | null;
    full_name?: string | null;
    username?: string | null;
  }>;
  limit?: number;
  sizeClassName?: string;
}) {
  if (!assignees?.length) return null;
  const visible = assignees.slice(0, limit);
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-label="Исполнители">
      {visible.map((assignee, index) => (
        <UserAvatar
          key={assignee.id ?? `${assignee.username ?? "external"}-${index}`}
          avatarUrl={assignee.avatar_url}
          name={assignee.full_name || assignee.username}
          className={cn(sizeClassName, "border-2 border-card")}
        />
      ))}
      {assignees.length > limit ? (
        <span
          className={cn(
            sizeClassName,
            "relative flex items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-semibold",
          )}
        >
          +{assignees.length - limit}
        </span>
      ) : null}
    </span>
  );
}
