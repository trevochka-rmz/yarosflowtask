import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { platform, useCurrentTenant } from "@/lib/platform";

export const Route = createFileRoute("/bots/new")({
  head: () => ({
    meta: [
      { title: "Создать бота — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Запуск нового цифрового сотрудника: код, название и описание задач бота.",
      },
      { property: "og:title", content: "Создать бота — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Новый цифровой сотрудник вашей организации." },
    ],
  }),
  component: NewBotPage,
});

function NewBotPage() {
  const { tenant } = useCurrentTenant();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      platform.createBot(tenant!.id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    onSuccess: (bot) => {
      void queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Бот создан — версия 1.0.0 в черновике");
      void navigate({ to: "/bots/$botId", params: { botId: String(bot.id) } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Создать бота
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Цифровой сотрудник получит версию настроек 1.0.0 в статусе «черновик».
      </p>

      {!tenant ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Сначала создайте организацию на{" "}
          <Link to="/" className="text-primary underline">
            главной
          </Link>
          .
        </p>
      ) : (
        <form
          className="mt-5 max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim() && name.trim()) create.mutate();
          }}
        >
          <div>
            <label className="text-sm font-medium">Код</label>
            <Input
              className="mt-1"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PROMISE-001"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Название</label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Контроль обещаний"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Описание</label>
            <Textarea
              className="mt-1 min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что делает бот и какую рутину закрывает"
            />
          </div>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={!code.trim() || !name.trim() || create.isPending}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Создать бота
          </Button>
        </form>
      )}
    </AppLayout>
  );
}
