import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CR_TYPE_LABELS,
  platform,
  useCurrentTenant,
  type CrType,
  type RiskClass,
} from "@/lib/platform";

export const Route = createFileRoute("/change-requests/new")({
  validateSearch: z.object({ botId: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Новая заявка на изменение — Yaya.Цифровой Бот" },
      {
        name: "description",
        content: "Опишите изменение логики бота, укажите тип и класс риска — заявка уйдёт на ревью.",
      },
      { property: "og:title", content: "Новая заявка на изменение — Yaya.Цифровой Бот" },
      { property: "og:description", content: "Заявка на изменение цифрового сотрудника." },
    ],
  }),
  component: NewChangeRequestPage,
});

const TYPES = Object.keys(CR_TYPE_LABELS) as CrType[];
const RISKS: RiskClass[] = ["C1", "C2", "C3", "C4"];

function NewChangeRequestPage() {
  const { botId } = Route.useSearch();
  const { tenant } = useCurrentTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CrType>("bot_logic");
  const [riskClass, setRiskClass] = useState<RiskClass>("C2");
  const [bot, setBot] = useState<string>(botId ? String(botId) : "");

  const bots = useQuery({
    queryKey: ["bots", tenant?.id],
    queryFn: () => platform.bots(tenant!.id),
    enabled: !!tenant?.id,
  });

  const create = useMutation({
    mutationFn: () =>
      platform.createChangeRequest({
        tenantId: tenant!.id,
        botId: bot ? Number(bot) : null,
        type,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        riskClass,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success("Заявка создана");
      void navigate({ to: "/change-requests" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenant) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">
          Сначала создайте организацию на{" "}
          <Link to="/" className="text-primary underline">
            главной
          </Link>
          .
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Новая заявка
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Любое изменение логики бота проходит через ревью — так история остаётся прозрачной.
      </p>

      <form
        className="mt-5 max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <div>
          <label className="text-sm font-medium">Заголовок</label>
          <Input
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Добавить напоминание за 24 часа до дедлайна"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Описание</label>
          <Textarea
            className="mt-1 min-h-28"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Что меняем и зачем"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CrType)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {CR_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Класс риска</label>
            <select
              value={riskClass}
              onChange={(e) => setRiskClass(e.target.value as RiskClass)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {RISKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Бот</label>
            <select
              value={bot}
              onChange={(e) => setBot(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">Без привязки</option>
              {(bots.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={!title.trim() || create.isPending}
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Создать заявку
        </Button>
      </form>
    </AppLayout>
  );
}
