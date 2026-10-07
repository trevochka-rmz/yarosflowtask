import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  FileText,
  LayoutGrid,
  ListChecks,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platform, setStoredTenant, useCurrentTenant } from "@/lib/platform";
import { useCurrentOrg } from "@/lib/org";
import { TELEGRAM_BOT_USERNAME } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaskFlow — задачи и отчёты сотрудников" },
      {
        name: "description",
        content: "Создавайте задачи, следите за их выполнением и отправляйте отчёты руководству.",
      },
      {
        property: "og:title",
        content: "TaskFlow — задачи и отчёты сотрудников",
      },
      {
        property: "og:description",
        content: "Создавайте задачи, следите за их выполнением и отправляйте отчёты руководству.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { isLoading, canCreateTenant } = useCurrentTenant();
  const { can, org, isLoading: orgLoading } = useCurrentOrg();
  const role = String(org?.role_code || org?.role_name || "")
    .trim()
    .toLowerCase();
  const isLeadership = [
    "administrator",
    "admin",
    "platform_admin",
    "администратор",
    "админ",
    "owner",
    "bot_owner",
    "владелец",
    "director",
    "директор",
  ].includes(role);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Для роли Director стартовая страница — рабочая сводка.
  // Другие роли, включая Owner, продолжают видеть обычную главную.
  useEffect(() => {
    const role = String(org?.role_code || org?.role_name || "")
      .trim()
      .toLowerCase();
    if (!orgLoading && ["director", "директор"].includes(role)) {
      void navigate({ to: "/director", replace: true });
    }
  }, [navigate, org?.role_code, org?.role_name, orgLoading]);

  const create = useMutation({
    mutationFn: () =>
      platform.createTenant({ name: name.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}) }),
    onSuccess: (created) => {
      setStoredTenant(created.id);
      setName("");
      setSlug("");
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["tenants-mine"] });
      toast.success("Организация создана");
      void navigate({ to: "/org" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (orgLoading || isLoading) {
    return (
      <AppLayout>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загружаем ваше рабочее пространство…
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <section className="rounded-3xl border border-border bg-surface-gradient p-6 shadow-soft sm:p-10">
        <p className="text-sm font-medium text-primary">TaskFlow · Рабочее пространство</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          {org
            ? isLeadership
              ? "Задачи команды и отчёты сотрудников"
              : "Ваши задачи и отчёты"
            : "Задачи и отчёты в одном месте"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {org
            ? isLeadership
              ? "Контролируйте выполнение задач, просматривайте отчёты и управляйте работой организации."
              : "Следите за своими задачами, обновляйте их статусы и отправляйте отчёты о проделанной работе руководству."
            : "Создавайте задачи текстом или голосом через Telegram-бота. В приложении удобно следить за выполнением и работать с отчётами сотрудников."}
        </p>
        {org && (
          <p className="mt-4 text-sm text-muted-foreground">
            Организация: <span className="font-medium text-foreground">{org.name}</span> · Ваша
            роль: {org.role_name}
          </p>
        )}
        {org && isLeadership && can("task.read") && (
          <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
            <Link to="/director">
              <LayoutGrid className="h-4 w-4" /> Директорский центр{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </section>

      {org ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Основные разделы">
            {can("task.read") && (
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
                <ListChecks className="h-7 w-7 text-primary" />
                <h2 className="mt-4 text-xl font-semibold">
                  {isLeadership ? "Задачи команды" : "Мои задачи"}
                </h2>
                <p className="mb-5 mt-2 text-sm text-muted-foreground">
                  {isLeadership
                    ? "Проверяйте сроки, назначайте исполнителей и следите за выполнением задач команды."
                    : "Посмотрите, что назначено вам, проверьте сроки и обновите статус выполнения."}
                </p>
                <Button asChild className="mt-auto w-full sm:w-auto sm:self-start">
                  <Link
                    to="/tasks"
                    search={{
                      taskStatus: undefined,
                      assignment: undefined,
                      query: undefined,
                      project: undefined,
                      assignee: isLeadership ? undefined : "me",
                      dateMode: "all",
                      dateField: undefined,
                      exactDate: undefined,
                      dateFrom: undefined,
                      dateTo: undefined,
                      view: undefined,
                      period: undefined,
                    }}
                  >
                    {isLeadership ? "Открыть задачи команды" : "Открыть мои задачи"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
            <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
              <FileText className="h-7 w-7 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">
                {isLeadership ? "Отчёты сотрудников" : "Мои отчёты"}
              </h2>
              <p className="mb-5 mt-2 text-sm text-muted-foreground">
                {isLeadership
                  ? "Просматривайте результаты работы сотрудников и сводки по отделам за выбранный период."
                  : "Подготовьте отчёт за день, проверьте его содержание и отправьте руководству."}
              </p>
              <Button asChild variant="outline" className="mt-auto w-full sm:w-auto sm:self-start">
                <Link
                  to="/reports"
                  search={(previous) => ({
                    ...previous,
                    memberId: isLeadership ? undefined : org.membership_id,
                  })}
                >
                  Открыть отчёты
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
          <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Создавайте задачи через Telegram</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Напишите боту, что нужно сделать, или отправьте голосовое сообщение — он разберёт
              описание и подготовит задачи. Отдельная команда или кнопка не нужна.
            </p>
            <blockquote className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
              Например: «Айбеку подготовить отчёт по продажам до пятницы».
            </blockquote>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Send className="h-4 w-4" />
                  Открыть Telegram-бота
                </a>
              </Button>
              {can("chat.read") && (
                <Button asChild variant="ghost">
                  <Link to="/chat">
                    <MessageSquare className="h-4 w-4" />
                    Чат ассистента
                  </Link>
                </Button>
              )}
            </div>
          </section>
          {isLeadership && (can("employee.read") || can("organization.update")) && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5 text-primary" />
                Управление организацией
              </h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {can("employee.read") && (
                  <Button asChild variant="outline">
                    <Link to="/members">Сотрудники</Link>
                  </Button>
                )}
                {can("organization.update") && (
                  <Button asChild variant="outline">
                    <Link to="/org">Настройки организации</Link>
                  </Button>
                )}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="text-lg font-semibold">
            {canCreateTenant ? "Создайте организацию" : "Получите доступ к организации"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {canCreateTenant
              ? "Создайте рабочее пространство компании, чтобы подключить сотрудников и начать работу."
              : "Войдите через Telegram и выберите организацию в меню, если доступ уже выдан. Чтобы вас добавили, напишите @tr3volka — укажите ваше имя, организацию и отдел."}
          </p>
          {canCreateTenant ? (
            <form
              className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) create.mutate();
              }}
            >
              <Input
                aria-label="Название организации"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название организации"
              />
              <Input
                aria-label="Короткое имя организации"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="slug (необязательно)"
              />
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Создать
                организацию
              </Button>
            </form>
          ) : (
            <Button asChild variant="outline" className="mt-4">
              <a href="https://t.me/tr3volka" target="_blank" rel="noopener noreferrer">
                Написать @tr3volka
              </a>
            </Button>
          )}
        </section>
      )}
    </AppLayout>
  );
}
