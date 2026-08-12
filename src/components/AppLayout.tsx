import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Shield,
  Building,
  KeyRound,
  UserCog,
  Plug,
  ChevronDown,
} from "lucide-react";
// Teams/team link removed — route not implemented yet
import type { ReactNode } from "react";
import logo from "@/assets/yaros-logo.png.asset.json";
import { useCurrentUser } from "@/lib/use-current-user";
import { userHandle } from "@/lib/api";
import { clearToken, getTelegramInitData, getToken } from "@/lib/auth";
import { TelegramLoginPage } from "@/components/TelegramLoginPage";
import {
  useCurrentOrg,
  orgApi,
  AVAILABILITY_LABELS,
  SELF_STATUSES,
  MANAGER_STATUSES,
  type AvailabilityStatus,
} from "@/lib/org";
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

/* =====================================================================
   Цвет точки по статусу
   ===================================================================== */
function statusDot(status?: AvailabilityStatus | null) {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-500";
    case "BUSY":
      return "bg-amber-500";
    case "AWAY":
      return "bg-yellow-400";
    case "VACATION":
      return "bg-sky-400";
    case "SICK_LEAVE":
      return "bg-rose-400";
    case "OFFLINE":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}

/* Виджет статуса в шапке (только desktop, только если есть орг) */
function UserStatusWidget({
  orgId,
  memberId,
  canAll,
}: {
  orgId: number;
  memberId: number | null;
  canAll: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  // Находим свою запись в списке членов
  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => orgApi.members(orgId),
    staleTime: 60_000,
  });

  const myMember = memberId ? members.data?.find((m) => m.user_id === memberId) : null;

  const currentStatus = myMember?.availability_status ?? null;
  const statuses = canAll ? MANAGER_STATUSES : SELF_STATUSES;

  const setStatus = useMutation({
    mutationFn: (s: AvailabilityStatus) => {
      if (!myMember) throw new Error("Не найдена запись члена");
      return orgApi.setMemberStatus(orgId, myMember.id, s);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["org-members", orgId] });
      setOpen(false);
    },
  });

  if (!myMember) return null;

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(currentStatus)}`} />
        <span className="hidden max-w-[7rem] truncate lg:block">
          {currentStatus ? AVAILABILITY_LABELS[currentStatus] : "Статус"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>

      {open && (
        <>
          {/* Оверлей для закрытия */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Мой статус
            </div>
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate(s)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent ${
                  currentStatus === s ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot(s)}`} />
                {AVAILABILITY_LABELS[s]}
                {currentStatus === s && <span className="ml-auto text-primary">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  exact?: boolean;
  perm?: string;
};

type NavGroup = { label: string; items: NavItem[]; adminOnly?: boolean };

const GROUPS: NavGroup[] = [
  {
    label: "Управление",
    items: [
      { title: "Главная", url: "/", icon: Home, exact: true },
      { title: "Центр организации", url: "/org", icon: LayoutDashboard },
      { title: "Флот ботов", url: "/bots", icon: Bot, exact: true, perm: "bot.read" },
      { title: "Создать бота", url: "/bots/new", icon: Plus, perm: "bot.create" },
      { title: "TaskFlow — новое ТЗ", url: "/taskflow", icon: ClipboardList, perm: "task.create" },
      { title: "Задачи", url: "/tasks", icon: ListChecks, perm: "task.read" },
    ],
  },
  {
    label: "Организация",
    items: [
      { title: "Сотрудники", url: "/members", icon: UserCog, perm: "employee.read" },
      { title: "Роли и права", url: "/roles", icon: KeyRound, perm: "role.read" },
      { title: "Отделы", url: "/departments", icon: Building },
    ],
  },
  {
    label: "Интеграции",
    items: [
      { title: "Битрикс24", url: "/integrations/bitrix24", icon: Plug },
      { title: "1С", url: "/integrations/1c", icon: Plug },
      { title: "Jira", url: "/integrations/jira", icon: Plug },
    ],
  },
  {
    label: "Доверие",
    items: [
      { title: "Журнал аудита", url: "/audit", icon: FileClock, perm: "audit.read" },
      { title: "Заявки на изменения", url: "/change-requests", icon: GitPullRequestArrow },
    ],
  },
  {
    label: "Платформа",
    adminOnly: true,
    items: [{ title: "Администрирование", url: "/admin", icon: Shield }],
  },
];

function AppSidebar({ locked }: { locked?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { org, can, isPlatformAdmin } = useCurrentOrg();

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.url;
    // Для интеграций: /integrations/bitrix24 должна быть активна и на /integrations/bitrix24/123
    // Но не должна совпадать с /integrations/1c при проверке /integrations/bitrix
    return pathname === item.url || pathname.startsWith(`${item.url}/`);
  };

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
              {org
                ? org.name
                : isPlatformAdmin
                  ? "Администратор платформы"
                  : "Организация не выбрана"}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        {locked ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Навигация недоступна — вас ещё не добавили в организацию.
          </div>
        ) : (
          GROUPS.filter((g) => (g.adminOnly ? isPlatformAdmin : true))
            .map((group) => ({
              ...group,
              items: group.items.filter((i) => (i.perm ? can(i.perm) : true)),
            }))
            .filter((g) => g.items.length > 0)
            .map((group) => (
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
            ))
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();
  const { org, hasNoOrg, isPlatformAdmin, can } = useCurrentOrg();
  const locked = hasNoOrg && !isPlatformAdmin;
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
        <AppSidebar locked={locked} />

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
              <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
                {/* Статус доступности — только если есть организация */}
                {org ? (
                  <UserStatusWidget
                    orgId={org.id}
                    memberId={user.id}
                    canAll={can("employee.update")}
                  />
                ) : null}

                {/* Аватар + имя */}
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
                    {(userHandle(user).replace("@", "")[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="hidden min-w-0 leading-tight sm:block">
                    <div className="max-w-[9rem] truncate text-sm font-medium">
                      {user.full_name || userHandle(user)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user.username ? `@${user.username}` : ""}
                    </div>
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
            {locked ? <NoTenantScreen /> : children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
