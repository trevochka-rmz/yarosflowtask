import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Loader2, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orgApi, setStoredOrg, useIsPlatformAdmin } from "@/lib/org";

/** Экран для пользователя, которого ещё не добавили ни в одну организацию. */
export function NoTenantScreen() {
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: () =>
      orgApi.create({ name: name.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}) }),
    onSuccess: (created) => {
      setStoredOrg(created.id);
      void queryClient.invalidateQueries({ queryKey: ["orgs-mine"] });
      toast.success("Организация создана");
      void navigate({ to: "/org" });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("403")
          ? "Создавать организации может только администратор платформы"
          : e.message,
      ),
  });

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <ShieldQuestion className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-brand-deep sm:text-2xl">
          Нет доступа к организации
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Вас ещё не добавили ни в одну организацию Yaya.Цифровой Бот. Попросите директора или
          администратора платформы выдать вам доступ — как только вас добавят, рабочее пространство
          с ботами и задачами появится здесь автоматически.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Уже попросили? Обновите страницу через пару минут.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Обновить
          </Button>
          {isPlatformAdmin ? (
            <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
              <Building2 className="h-4 w-4" /> Создать организацию
            </Button>
          ) : null}
        </div>

        {open && isPlatformAdmin ? (
          <form
            className="mt-5 grid gap-2 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название организации"
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
            <p className="text-xs text-muted-foreground">
              Доступно только администратору платформы.
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
