import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/yaros-logo.png.asset.json";
import { useCurrentUser } from "@/lib/use-current-user";
import { userHandle } from "@/lib/api";
import { clearToken, getTelegramInitData, getToken } from "@/lib/auth";
import { TelegramLoginPage } from "@/components/TelegramLoginPage";

const navLink =
  "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground";

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();
  const queryClient = useQueryClient();
  const inMiniApp = getTelegramInitData() !== null;
  const canUseSite = inMiniApp || getToken() !== null || import.meta.env.DEV;

  if (!canUseSite || (isError && !inMiniApp)) {
    return <TelegramLoginPage />;
  }

  if (isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  const signOut = () => {
    clearToken();
    queryClient.clear();
  };



  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 lg:h-16 lg:flex-nowrap lg:py-0">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
            <img
              src={logo.url}
              alt="YAROS.TaskFlow"
              className="h-8 w-8 shrink-0 rounded-full sm:h-10 sm:w-10"
            />
            <span className="truncate text-base font-semibold tracking-tight text-brand-deep sm:text-lg">
              YAROS<span className="text-primary">.TaskFlow</span>
            </span>
          </Link>

          <nav className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto lg:order-2 lg:mx-0 lg:ml-auto lg:w-auto lg:overflow-visible">
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

          {user ? (
            <div className="order-2 flex min-w-0 shrink items-center gap-2 lg:order-3 lg:shrink-0 lg:border-l lg:border-border lg:pl-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-primary-foreground">
                {(userHandle(user).replace("@", "")[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="max-w-[7.5rem] truncate text-sm font-medium sm:max-w-[11rem] lg:max-w-none">
                  {userHandle(user)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.role === "manager" ? "Руководитель" : "Сотрудник"}
                </div>
              </div>
              {!inMiniApp ? (
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Выйти"
                  title="Выйти"
                  className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : null}
            </div>

          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
