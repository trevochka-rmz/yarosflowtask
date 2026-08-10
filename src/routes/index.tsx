import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  FileClock,
  GitPullRequestArrow,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platform, setStoredTenant, useCurrentTenant } from "@/lib/platform";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yaya.Цифровой Бот — организация, боты и контроль изменений" },
      {
        name: "description",
        content:
          "Yaya.Цифровой Бот следит за вашим проектом: организация, цифровые сотрудники, роли участников, заявки на изменения и журнал аудита.",
      },
      { property: "og:title", content: "Yaya.Цифровой Бот — организация, боты и контроль" },
      {
        property: "og:description",
        content:
          "Создайте организацию, запустите цифрового сотрудника и держите изменения под контролем.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Building2,
    title: "Организация",
    text: "Единое пространство компании: участники, роли и доступы к цифровым сотрудникам.",
  },
  {
    icon: Bot,
    title: "Флот ботов",
    text: "Цифровые сотрудники вроде TaskFlow: версии настроек, публикация и статусы.",
  },
  {
    icon: GitPullRequestArrow,
    title: "Заявки на изменения",
    text: "Любая правка логики бота проходит как change request с классом риска.",
  },
  {
    icon: FileClock,
    title: "Журнал аудита",
    text: "Кто, что и когда изменил — прозрачная лента действий по всей организации.",
  },
];

function Landing() {
  const { tenant, tenants, isLoading, canCreateTenant } = useCurrentTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  return (
    <AppLayout>
      <section className="overflow-hidden rounded-3xl border border-border bg-surface-gradient p-6 shadow-soft sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Пространство цифровых сотрудников
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Yaya<span className="text-primary">.Цифровой Бот</span> поможет следить за вашим проектом
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Создавайте ботов, которые работают вместо рутины: ставят задачи, готовят ТЗ, следят за
          обещаниями и сроками. Всё живёт внутри вашей организации — с ролями участников, версиями
          настроек, заявками на изменения и журналом аудита. Начните с создания организации.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/org">
              Центр организации <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/taskflow">Открыть TaskFlow</Link>
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-brand-deep">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-brand-deep">
            {tenant ? "Ваша организация" : canCreateTenant ? "Шаг 1 — создайте организацию" : "Организация"}
          </h2>
        </div>

        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Загружаем организации…</p>
        ) : tenant ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Активная организация: <span className="font-medium text-foreground">{tenant.name}</span>{" "}
              ({tenant.slug}). Доступно организаций: {tenants.length}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link to="/bots/new">Создать бота</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/members">Пригласить участников</Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Организация — это контур вашей компании. Внутри неё живут цифровые сотрудники,
            участники с ролями и история изменений.
          </p>
        )}

        {canCreateTenant ? (
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название организации, например «Компания Ярос»"
          />
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (необязательно)"
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Создать организацию
          </Button>
        </form>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Создавать новые организации может только администратор платформы (platform_admin).
          </p>
        )}
      </section>
    </AppLayout>
  );
}
