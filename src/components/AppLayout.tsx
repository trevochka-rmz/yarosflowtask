import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/yaros-logo.png.asset.json";
import { useCurrentUser } from "@/lib/use-current-user";
import { userLabel } from "@/lib/api";

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo.url} alt="YAROS.TaskFlow" className="h-10 w-10 rounded-full" />
            <span className="text-lg font-semibold tracking-tight text-brand-deep">
              YAROS<span className="text-primary">.TaskFlow</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link
              to="/"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
              activeOptions={{ exact: true }}
            >
              Новая задача
            </Link>
            <Link
              to="/tasks"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              Задачи
            </Link>
            <Link
              to="/team"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              Команда
            </Link>
          </nav>
          {user ? (
            <div className="hidden items-center gap-2 border-l border-border pl-4 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-primary-foreground">
                {(userLabel(user)[0] ?? "?").toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-medium">{userLabel(user)}</div>
                <div className="text-xs text-muted-foreground">
                  {user.role === "manager" ? "Руководитель" : "Сотрудник"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
