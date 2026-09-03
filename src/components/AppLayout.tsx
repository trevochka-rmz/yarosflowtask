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
  Terminal,
  KeyRound,
  UserCog,
  Plug,
  ChevronDown,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
// Teams/team link removed — route not implemented yet
import type { ReactNode } from "react";
import logo from "@/assets/yaros-logo.png.asset.json";
import { useAuthPresence, useCurrentUser } from "@/lib/use-current-user";
import { api, userHandle } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { clearToken, getTelegramInitData } from "@/lib/auth";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

/* =====================================================================
   Хук для списка членов орг (общий, чтобы не дублировать запросы)
   ===================================================================== */
function useMyMember(orgId: number | undefined, userId: number | undefined) {
  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => orgApi.members(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  });
  const myMember =
    orgId && userId ? (members.data?.find((m) => m.user_id === userId) ?? null) : null;
  return { myMember, membersLoading: members.isPending };
}

/* =====================================================================
   Список статусов для выбора (унифицированный блок)
   ===================================================================== */
function StatusList({
  currentStatus,
  statuses,
  onSelect,
  isPending,
}: {
  currentStatus: AvailabilityStatus | null;
  statuses: AvailabilityStatus[];
  onSelect: (s: AvailabilityStatus) => void;
  isPending: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1">
      {statuses.map((s) => {
        const active = currentStatus === s;
        return (
          <button
            key={s}
            type="button"
            disabled={isPending}
            onClick={() => onSelect(s)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-accent font-semibold text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            <span className={`h-3 w-3 shrink-0 rounded-full ${statusDot(s)}`} />
            <span className="flex-1 text-left">{AVAILABILITY_LABELS[s]}</span>
            {active && <span className="text-xs font-bold text-primary">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================================
   Десктоп: виджет статуса в шапке
   ===================================================================== */
function UserStatusWidget({
  orgId,
  userId,
  canAll,
}: {
  orgId: number;
  userId: number;
  canAll: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const { myMember } = useMyMember(orgId, userId);
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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lg">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Мой статус
            </p>
            <StatusList
              currentStatus={currentStatus}
              statuses={statuses}
              onSelect={(s) => setStatus.mutate(s)}
              isPending={setStatus.isPending}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* =====================================================================
   Мобильный Sheet — профиль + смена статуса
   ===================================================================== */
function UserProfileSheet({
  user,
  org,
  canAll,
  onSignOut,
  inMiniApp,
}: {
  user: {
    id: number;
    full_name?: string | null;
    username?: string | null;
    first_name?: string | null;
    avatar_url?: string | null;
    has_custom_avatar?: boolean;
  };
  org: { id: number; name: string } | null;
  canAll: boolean;
  onSignOut: () => void;
  inMiniApp: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const { myMember } = useMyMember(org?.id, user.id);
  const currentStatus = myMember?.availability_status ?? null;
  const statuses = canAll ? MANAGER_STATUSES : SELF_STATUSES;

  const displayName =
    user.full_name?.trim() ||
    (user.username ? `@${user.username}` : user.first_name || "Пользователь");

  const setStatus = useMutation({
    mutationFn: (s: AvailabilityStatus) => {
      if (!myMember || !org) throw new Error("Не найдена запись члена");
      return orgApi.setMemberStatus(org.id, myMember.id, s);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["org-members", org?.id] });
    },
  });

  const avatar = useMutation({
    mutationFn: (file: File) => api.uploadMyAvatar(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["users-me"] });
      void qc.invalidateQueries({ queryKey: ["org-members"] });
    },
  });

  const removeAvatar = useMutation({
    mutationFn: () => api.removeMyAvatar(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["users-me"] });
      void qc.invalidateQueries({ queryKey: ["org-members"] });
    },
  });

  return (
    <>
      {/* Кнопка аватара — кликабельная, с точкой статуса поверх */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative h-8 w-8 shrink-0 rounded-full transition-opacity hover:opacity-90"
        aria-label="Профиль"
      >
        <UserAvatar avatarUrl={user.avatar_url} name={displayName} className="h-8 w-8" />
        {/* Точка статуса поверх аватара */}
        {myMember && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusDot(currentStatus)}`}
          />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-safe">
          {/* Профиль */}
          {/* text-left переопределяет text-center из shadcn SheetHeader */}
          <SheetHeader className="px-5 pb-4 pt-2 [&>*]:text-left">
            <div className="flex items-start gap-4">
              <div className="relative h-14 w-14 shrink-0">
                <UserAvatar
                  avatarUrl={user.avatar_url}
                  name={displayName}
                  className="h-14 w-14"
                  fallbackClassName="text-xl font-bold"
                />
                {myMember && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card ${statusDot(currentStatus)}`}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <SheetTitle className="block truncate text-left text-base font-semibold leading-snug">
                  {displayName}
                </SheetTitle>
                {user.username && (
                  <p className="mt-0.5 block truncate text-left text-sm text-muted-foreground">
                    @{user.username}
                  </p>
                )}
                {org && (
                  <p className="mt-1 block truncate text-left text-xs text-muted-foreground/80">
                    {org.name}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
                {avatar.isPending ? "Загрузка…" : "Изменить фото"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={avatar.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) avatar.mutate(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {user.has_custom_avatar ? (
                <button
                  type="button"
                  disabled={removeAvatar.isPending}
                  onClick={() => removeAvatar.mutate()}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  Удалить
                </button>
              ) : null}
              {(avatar.error || removeAvatar.error) && (
                <span className="text-xs text-destructive">
                  {(avatar.error || removeAvatar.error)?.message}
                </span>
              )}
            </div>
          </SheetHeader>

          <div className="border-t border-border" />

          {/* Статус — только если есть орг */}
          {myMember && (
            <div className="px-4 py-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Мой статус
              </p>
              <StatusList
                currentStatus={currentStatus}
                statuses={statuses}
                onSelect={(s) => setStatus.mutate(s)}
                isPending={setStatus.isPending}
              />
            </div>
          )}

          {/* Выход */}
          {!inMiniApp && (
            <div className="border-t border-border px-4 pt-3 pb-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Выйти из аккаунта
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
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
      { title: "Чат", url: "/chat", icon: MessageSquare, perm: "chat.read" },
      {
        title: "Директорский центр",
        url: "/director",
        icon: LayoutGrid,
        perm: "organization.update",
      },
      { title: "Флот ботов", url: "/bots", icon: Bot, exact: true, perm: "bot.read" },
      {
        title: "Подключение/создание ботов",
        url: "/bots/new",
        icon: Plus,
        perm: "bot.read",
      },
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
          (() => {
            const baseGroups = GROUPS.filter((g) => (g.adminOnly ? isPlatformAdmin : true))
              .map((group) => ({
                ...group,
                items: group.items.filter((i) => (i.perm ? can(i.perm) : true)),
              }))
              .filter((g) => g.items.length > 0);

            const groups =
              org?.id === 1
                ? baseGroups.map((group) => {
                    if (group.label !== "Управление") return group;
                    const items = [...group.items];
                    const insertAfter = items.findIndex((i) => i.url === "/tasks");
                    const acquiringItem: NavItem = {
                      title: "Эквайринг",
                      url: "/acquiring",
                      icon: Terminal,
                    };
                    if (!items.some((i) => i.url === acquiringItem.url)) {
                      if (insertAfter >= 0) items.splice(insertAfter + 1, 0, acquiringItem);
                      else items.push(acquiringItem);
                    }
                    return { ...group, items };
                  })
                : baseGroups;

            return groups.map((group) => (
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
            ));
          })()
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({
  children,
  fullscreen,
  wide,
}: {
  children: ReactNode;
  fullscreen?: boolean;
  wide?: boolean;
}) {
  const { data: user, isLoading, isError } = useCurrentUser();
  const authPresent = useAuthPresence();
  const { org, hasNoOrg, isPlatformAdmin, can } = useCurrentOrg();
  const locked = hasNoOrg && !isPlatformAdmin;
  const queryClient = useQueryClient();
  const [inMiniApp, setInMiniApp] = React.useState(false);
  React.useEffect(() => setInMiniApp(getTelegramInitData() !== null), []);
  const canUseSite = authPresent || import.meta.env.DEV;

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

        <SidebarInset className="flex min-h-0 min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <Link to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
              <img src={logo.url} alt="Yaya" className="h-7 w-7 shrink-0 rounded-full" />
              <span className="truncate text-sm font-semibold tracking-tight text-brand-deep">
                Yaya<span className="text-primary">.Цифровой Бот</span>
              </span>
            </Link>

            {user ? (
              <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
                {/* Desktop: пилл статуса — скрыт на мобилке */}
                {org ? (
                  <UserStatusWidget
                    orgId={org.id}
                    userId={user.id}
                    canAll={can("employee.update")}
                  />
                ) : null}

                {/* Имя — видно только на sm+ */}
                <div className="hidden min-w-0 leading-tight sm:block">
                  <div className="max-w-[9rem] truncate text-sm font-medium">
                    {user.full_name || userHandle(user)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user.username ? `@${user.username}` : ""}
                  </div>
                </div>

                {/* Аватар — клик открывает Sheet на мобилке + точка статуса */}
                <UserProfileSheet
                  user={user}
                  org={org ?? null}
                  canAll={can("employee.update")}
                  onSignOut={signOut}
                  inMiniApp={inMiniApp}
                />

                {/* Desktop: кнопка выхода отдельно */}
                {!inMiniApp ? (
                  <button
                    type="button"
                    onClick={signOut}
                    aria-label="Выйти"
                    title="Выйти"
                    className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </header>

          <main
            className={
              fullscreen
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : wide
                  ? "w-full px-4 py-6 sm:px-6 sm:py-8"
                  : "mx-auto w-full max-w-6xl px-4 py-6 sm:py-8"
            }
          >
            {locked ? <NoTenantScreen /> : children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
