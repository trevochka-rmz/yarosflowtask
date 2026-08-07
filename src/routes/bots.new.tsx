import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { platform, useCurrentTenant, type BotTemplate } from "@/lib/platform";

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

const FALLBACK_TEMPLATES: BotTemplate[] = [
  {
    code: "TASKFLOW-001",
    name: "TaskFlow — ТЗ и задачи",
    category: "delivery",
    description: "Заметка → ТЗ → задачи",
    defaultSpec: { features: ["task.create_from_text"] },
    riskClass: "C2",
    implemented: true,
  },
  {
    code: "PROMISE-001",
    name: "Контроль обещаний",
    category: "compliance",
    description: "Фиксирует обещания и напоминает о сроках",
    defaultSpec: {},
    riskClass: "C2",
    implemented: false,
  },
  {
    code: "CHAT-001",
    name: "Chat-ассистент",
    category: "communication",
    description: "Отвечает на вопросы в Telegram-чате",
    defaultSpec: {},
    riskClass: "C1",
    implemented: false,
  },
  {
    code: "DEV-001",
    name: "Dev-ассистент",
    category: "engineering",
    description: "Помогает разработчикам: code review, задачи, pull-реквесты",
    defaultSpec: {},
    riskClass: "C2",
    implemented: false,
  },
  {
    code: "REPORT-001",
    name: "Автоотчётность",
    category: "analytics",
    description: "Генерирует отчёты по данным организации",
    defaultSpec: {},
    riskClass: "C2",
    implemented: false,
  },
  {
    code: "SALES-001",
    name: "Sales-ассистент",
    category: "sales",
    description: "Сопровождает сделки, напоминает о фоллоупах",
    defaultSpec: {},
    riskClass: "C2",
    implemented: false,
  },
  {
    code: "LEXA-001",
    name: "Lexa — Юр. ассистент",
    category: "legal",
    description: "Отвечает на вопросы по документам и договорам",
    defaultSpec: {},
    riskClass: "C3",
    implemented: false,
  },
];

function TemplateCard({
  tpl,
  selected,
  onSelect,
}: {
  tpl: BotTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-brand-deep">{tpl.name}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            tpl.implemented
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {tpl.implemented ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Готов к работе
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" /> Каркас / скоро
            </span>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {tpl.code} · риск {tpl.riskClass}
      </p>
    </button>
  );
}

function NewBotPage() {
  const { tenant, canManage } = useCurrentTenant();
  const [selectedTpl, setSelectedTpl] = useState<BotTemplate | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const templates = useQuery({
    queryKey: ["bot-templates"],
    queryFn: () => platform.botTemplates().catch(() => FALLBACK_TEMPLATES),
    retry: false,
  });

  const tplList = templates.data ?? FALLBACK_TEMPLATES;

  const handleSelectTpl = (tpl: BotTemplate) => {
    setSelectedTpl(tpl);
    setCode(tpl.code);
    setName(tpl.name);
    setDescription(tpl.description);
  };

  const create = useMutation({
    mutationFn: () => {
      const body = selectedTpl
        ? { templateCode: selectedTpl.code }
        : {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
          };
      return platform.createBot(tenant!.id, body);
    },
    onSuccess: (bot) => {
      void queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Бот создан — версия 1.0.0 в черновике");
      if (selectedTpl?.code === "TASKFLOW-001" || bot.code === "TASKFLOW-001") {
        void navigate({ to: "/taskflow" });
      } else {
        void navigate({ to: "/bots/$botId", params: { botId: String(bot.id) } });
      }
    },
    onError: (e: Error) => {
      if (e.message.includes("403") || e.message.toLowerCase().includes("прав")) {
        toast.error("Недостаточно прав — нужны роли manager, bot_owner или director");
      } else {
        toast.error(e.message);
      }
    },
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

  if (!canManage) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-semibold text-brand-deep">Недостаточно прав</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Создавать ботов могут участники с ролью manager, bot_owner или director.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/org">Назад в Центр</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-deep sm:text-3xl">
        Создать бота
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Выберите шаблон или заполните форму вручную.
      </p>

      {/* Шаблоны */}
      <section className="mt-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Шаблоны ботов
        </h2>
        {templates.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Загрузка шаблонов…</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tplList.map((tpl) => (
              <TemplateCard
                key={tpl.code}
                tpl={tpl}
                selected={selectedTpl?.code === tpl.code}
                onSelect={() => handleSelectTpl(tpl)}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setSelectedTpl(null);
                setCode("");
                setName("");
                setDescription("");
              }}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                selectedTpl === null
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="text-sm font-medium text-brand-deep">Свой бот</span>
              <p className="mt-1 text-xs text-muted-foreground">Заполнить вручную</p>
            </button>
          </div>
        )}
      </section>

      {/* Форма */}
      <section className="mt-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ChevronRight className="h-3.5 w-3.5" />
          {selectedTpl ? `Параметры: ${selectedTpl.name}` : "Форма"}
        </h2>
        <form
          className="mt-3 max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
          onSubmit={(e) => {
            e.preventDefault();
            const canSubmit = selectedTpl ? true : code.trim() && name.trim();
            if (canSubmit) create.mutate();
          }}
        >
          {selectedTpl ? (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium text-brand-deep">{selectedTpl.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedTpl.code} · риск {selectedTpl.riskClass}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedTpl.description}</p>
            </div>
          ) : (
            <>
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
            </>
          )}

          <div>
            <label className="text-sm font-medium">Описание</label>
            <Textarea
              className="mt-1 min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что делает бот и какую рутину закрывает"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={(!selectedTpl && (!code.trim() || !name.trim())) || create.isPending}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {selectedTpl?.code === "TASKFLOW-001" ? "Создать и открыть TaskFlow" : "Создать бота"}
            </Button>
            {selectedTpl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTpl(null);
                  setCode("");
                  setName("");
                  setDescription("");
                }}
              >
                Сбросить
              </Button>
            ) : null}
          </div>
        </form>
      </section>
    </AppLayout>
  );
}
