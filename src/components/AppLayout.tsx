import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/yaros-logo.png.asset.json";
import { useCurrentUser } from "@/lib/use-current-user";
import { userLabel } from "@/lib/api";

const navLink =
  "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground";

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:h-16 sm:py-0">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img
              src={logo.url}
              alt="YAROS.TaskFlow"
              className="h-8 w-8 shrink-0 rounded-full sm:h-10 sm:w-10"
            />
            <span className="truncate text-base font-semibold tracking-tight text-brand-deep sm:text-lg">
              YAROS<span className="text-primary">.TaskFlow</span>
            </span>
          </Link>

          {user ? (
            <div className="flex shrink-0 items-center gap-2 sm:order-3 sm:border-l sm:border-border sm:pl-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-primary-foreground">
                {(userLabel(user)[0] ?? "?").toUpperCase()}
              </div>
              <div className="hidden leading-tight sm:block">
                <div className="text-sm font-medium">{userLabel(user)}</div>
                <div className="text-xs text-muted-foreground">
                  {user.role === "manager" ? "Руководитель" : "Сотрудник"}
                </div>
              </div>
            </div>
          ) : null}

          <nav className="col-span-2 -mx-1 flex items-center gap-1 overflow-x-auto sm:col-span-1 sm:order-2 sm:ml-auto sm:overflow-visible">
            <Link to="/" className={navLink} activeOptions={{ exact: true }}>
              Новая задача
            </Link>
            <Link to="/tasks" className={navLink}>
              Задачи
            </Link>
            <Link to="/team" className={navLink}>
              Команда
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
