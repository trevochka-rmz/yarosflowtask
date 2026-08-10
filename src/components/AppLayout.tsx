import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ClipboardList,
  FileClock,
  GitPullRequestArrow,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  UserCog,
} from "lucide-react";
// Teams/team link removed — route not implemented yet
import type { ReactNode } from "react";
import logo from "@/assets/yaros-logo.png.asset.json";
import { useCurrentUser } from "@/lib/use-current-user";
import { userHandle } from "@/lib/api";
import { clearToken, getTelegramInitData, getToken } from "@/lib/auth";
import { TelegramLoginPage } from "@/components/TelegramLoginPage";
import { useCurrentTenant } from "@/lib/platform";
import { NoTenantScreen } from "@/components/NoTenantScreen";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: typeof Home; exact?: boolean };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Управление",
    items: [
      { title: "Главная", url: "/", icon: Home, exact: true },
      { title: "Центр организации", url: "/org", icon: LayoutDashboard },
      { title: "Флот ботов", url: "/bots", icon: Bot, exact: true },
      { title: "Создать бота", url: "/bots/new", icon: Plus },
      { title: "TaskFlow — новое ТЗ", url: "/taskflow", icon: ClipboardList },
      { title: "Задачи", url: "/tasks", icon: ListChecks },
    ],
  },
  {
    label: "Организация",
    items: [
      { title: "Сотрудники и роли", url: "/members", icon: UserCog },
    ],
  },
  {
    label: "Доверие",
    items: [
      { title: "Журнал аудита", url: "/audit", icon: FileClock },
      { title: "Заявки на изменения", url: "/change-requests", icon: GitPullRequestArrow },
    ],
  },
];

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tenant } = useCurrentTenant();

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.url
      : pathname === item.url || pathname.startsWith(`${item.url}/`);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex min-w-0 items-center gap-2 px-2 py-1.5">
          <img src={logo.url} alt="Yaya" className="h-9 w-9 shrink-0 rounded-full" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-brand-deep">
              Yaya<span className="text-primary">.Цифровой Бот</span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {tenant ? tenant.name : "Организация не выбрана"}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();
  const { hasNoTenant } = useCurrentTenant();
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <Link to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
              <img src={logo.url} alt="Yaya" className="h-7 w-7 shrink-0 rounded-full" />
              <span className="truncate text-sm font-semibold tracking-tight text-brand-deep">
                Yaya<span className="text-primary">.Цифровой Бот</span>
              </span>
            </Link>

            {user ? (
              <div className="ml-auto flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
                  {(userHandle(user).replace("@", "")[0] ?? "?").toUpperCase()}
                </div>
                <div className="hidden min-w-0 leading-tight sm:block">
                  <div className="max-w-[11rem] truncate text-sm font-medium">
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
            {hasNoTenant ? <NoTenantScreen /> : children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
