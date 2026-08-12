import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  SendHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/api";
import { orgApi, useCurrentOrg, type ChatMessage, type OrgChat, type Automation } from "@/lib/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  validateSearch: z.object({ chatId: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Чат — Yaya.ЦифровойБот" },
      { property: "og:title", content: "Чат — Yaya.ЦифровойБот" },
    ],
  }),
  component: ChatPage,
});

/* ═══════════════════════════════════════════════════════════
   Утилиты
═══════════════════════════════════════════════════════════ */

function roleMeta(role: ChatMessage["role"]) {
  switch (role) {
    case "user":
      return { label: "Вы", bubble: "bg-primary text-primary-foreground", align: "items-end" };
    case "assistant":
      return {
        label: "Ассистент",
        bubble: "bg-card border border-border text-foreground",
        align: "items-start",
      };
    case "system":
      return { label: "Система", bubble: "bg-muted text-muted-foreground", align: "items-start" };
    default:
      return { label: role, bubble: "bg-muted text-foreground", align: "items-start" };
  }
}

/* ═══════════════════════════════════════════════════════════
   Карточка предложения (proposal)
═══════════════════════════════════════════════════════════ */
function ProposalCard({
  orgId,
  proposalId,
  actions,
  onDone,
}: {
  orgId: number;
  proposalId: number;
  actions: string[];
  onDone: (msgs: ChatMessage[]) => void;
}) {
  const qc = useQueryClient();

  const accept = useMutation({
    mutationFn: () => orgApi.acceptProposal(orgId, proposalId),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["automations", orgId] });
      onDone([res.message]);
      toast.success(`Автоматизация #${res.automation.id} создана`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: () => orgApi.rejectProposal(orgId, proposalId),
    onSuccess: () => toast("Предложение отклонено"),
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = accept.isPending || reject.isPending;
  const done = accept.isSuccess || reject.isSuccess;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.includes("accept") && !done && (
        <Button size="sm" disabled={busy} onClick={() => accept.mutate()} className="gap-1.5">
          {accept.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Создать автоматизацию
        </Button>
      )}
      {(actions.includes("reject") || actions.includes("cancel")) && !done && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => reject.mutate()}
          className="gap-1.5"
        >
          {reject.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Отклонить
        </Button>
      )}
      {done && (
        <span className="text-xs text-muted-foreground">
          {accept.isSuccess ? "✓ Автоматизация создана" : "✗ Отклонено"}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Одно сообщение
═══════════════════════════════════════════════════════════ */
function MessageBubble({
  msg,
  orgId,
  onNewMessages,
}: {
  msg: ChatMessage;
  orgId: number;
  onNewMessages: (msgs: ChatMessage[]) => void;
}) {
  const { bubble, align } = roleMeta(msg.role);
  const isUser = msg.role === "user";
  const proposalId = msg.meta?.proposal_id;
  const actions: string[] = msg.meta?.actions ?? [];

  return (
    <div className={cn("flex flex-col gap-1", align)}>
      <div
        className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[70%]", bubble)}
      >
        {/* Имя автора — только не-user */}
        {!isUser && msg.author_name && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
            {msg.author_name}
          </p>
        )}
        {/* Текст с переводами строк */}
        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>

        {/* Кнопки proposal */}
        {proposalId && actions.length > 0 && (
          <ProposalCard
            orgId={orgId}
            proposalId={proposalId}
            actions={actions}
            onDone={onNewMessages}
          />
        )}
      </div>
      {/* Время */}
      <time className="px-1 text-[10px] text-muted-foreground">{formatDate(msg.created_at)}</time>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Блок автоматизаций
═══════════════════════════════════════════════════════════ */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-muted text-muted-foreground",
};

function AutomationsPanel({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const { data: automations = [], isPending } = useQuery({
    queryKey: ["automations", orgId],
    queryFn: () => orgApi.automations(orgId),
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "PAUSED" }) =>
      orgApi.updateAutomation(orgId, id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["automations", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <div className="h-8 animate-pulse rounded-xl bg-muted" />;
  if (!automations.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Активные автоматизации
      </p>
      <ul className="space-y-1.5">
        {automations.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
          >
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                STATUS_COLORS[a.status] ?? "bg-muted",
              )}
            >
              {a.status}
            </span>
            <span className="min-w-0 flex-1 truncate">{a.title}</span>
            {a.schedule_cron && (
              <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">
                {a.schedule_cron}
              </span>
            )}
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() =>
                toggle.mutate({ id: a.id, status: a.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })
              }
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={a.status === "ACTIVE" ? "Поставить на паузу" : "Возобновить"}
            >
              {a.status === "ACTIVE" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Список чатов (левая панель)
═══════════════════════════════════════════════════════════ */
function ChatList({
  orgId,
  activeChatId,
  onSelect,
}: {
  orgId: number;
  activeChatId: number | null;
  onSelect: (chat: OrgChat) => void;
}) {
  const { data: chats = [], isPending } = useQuery({
    queryKey: ["chats", orgId],
    queryFn: () => orgApi.chats(orgId),
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <ul className="space-y-1 p-2">
      {chats.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
              activeChatId === c.id
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground hover:bg-accent",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                c.type === "org"
                  ? "bg-primary/15 text-primary"
                  : "bg-accent text-accent-foreground",
              )}
            >
              {c.type === "org" ? (
                <MessageSquare className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate">{c.title}</span>
              {c.bot_code && (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {c.bot_code}
                </span>
              )}
            </div>
          </button>
        </li>
      ))}
      {chats.length === 0 && (
        <li className="px-3 py-4 text-center text-xs text-muted-foreground">Чатов пока нет</li>
      )}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════
   Область сообщений
═══════════════════════════════════════════════════════════ */
function ChatWindow({
  orgId,
  chat,
  canWrite,
}: {
  orgId: number;
  chat: OrgChat;
  canWrite: boolean;
}) {
  const [text, setText] = useState("");
  const [localMsgs, setLocalMsgs] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const { data: serverMsgs = [], isPending: historyPending } = useQuery({
    queryKey: ["chat-messages", orgId, chat.id],
    queryFn: () => orgApi.chatMessages(orgId, chat.id, 100),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Объединяем серверные + локальные (оптимистично), убираем дубли по id
  const allMsgs = [...serverMsgs];
  localMsgs.forEach((lm) => {
    if (!allMsgs.find((sm) => sm.id === lm.id)) allMsgs.push(lm);
  });
  allMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Скроллим вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMsgs.length]);

  const send = useMutation({
    mutationFn: (body: string) => orgApi.sendMessage(orgId, chat.id, body),
    onSuccess: (res) => {
      const incoming: ChatMessage[] = [res.user_message];
      if (res.assistant_message) incoming.push(res.assistant_message);
      setLocalMsgs((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !ids.has(m.id))];
      });
      void qc.invalidateQueries({ queryKey: ["chat-messages", orgId, chat.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    setText("");
    send.mutate(body);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Шапка чата */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            chat.type === "org" ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground",
          )}
        >
          {chat.type === "org" ? (
            <MessageSquare className="h-5 w-5" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{chat.title}</p>
          {chat.bot_code && (
            <p className="truncate text-xs text-muted-foreground">{chat.bot_code}</p>
          )}
        </div>
      </div>

      {/* История */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {historyPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-muted" />
              </div>
            ))}
          </div>
        ) : allMsgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
              <MessageSquare className="h-8 w-8 text-accent-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Чат пустой</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Напишите что-нибудь — ассистент ответит и предложит автоматизации.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {allMsgs.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                orgId={orgId}
                onNewMessages={(newMsgs) =>
                  setLocalMsgs((prev) => {
                    const ids = new Set(prev.map((m) => m.id));
                    return [...prev, ...newMsgs.filter((m) => !ids.has(m.id))];
                  })
                }
              />
            ))}
            {/* Typing индикатор */}
            {send.isPending && (
              <div className="flex items-start gap-1">
                <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Автоматизации */}
      {chat.type === "org" && (
        <div className="shrink-0 border-t border-border px-4 py-2">
          <AutomationsPanel orgId={orgId} />
        </div>
      )}

      {/* Поле ввода */}
      {canWrite ? (
        <div className="shrink-0 border-t border-border bg-card/80 px-4 py-3 backdrop-blur">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напишите запрос ассистенту…"
              rows={1}
              className="max-h-32 min-h-[2rem] flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-xl"
              disabled={!text.trim() || send.isPending}
              onClick={handleSend}
            >
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Ctrl / ⌘ + Enter — отправить
          </p>
        </div>
      ) : (
        <div className="shrink-0 border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
          У вас нет права <code>chat.write</code> — просмотр истории доступен.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Главная страница чата
═══════════════════════════════════════════════════════════ */
function ChatPage() {
  const { chatId: initialChatId } = Route.useSearch();
  const { org, can, isLoading } = useCurrentOrg();
  const qc = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<number | null>(initialChatId ?? null);
  const [mobileShowList, setMobileShowList] = useState(!initialChatId);

  const canRead = can("chat.read");
  const canWrite = can("chat.write");

  // Открываем / создаём org-чат при первом заходе (если нет chatId в URL)
  const openOrg = useMutation({
    mutationFn: () => orgApi.openOrgChat(org!.id),
    onSuccess: (chat) => {
      void qc.invalidateQueries({ queryKey: ["chats", org?.id] });
      setActiveChatId(chat.id);
      setMobileShowList(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Загружаем список чатов для поиска активного
  const { data: chats = [] } = useQuery({
    queryKey: ["chats", org?.id],
    queryFn: () => orgApi.chats(org!.id),
    enabled: !!org?.id && canRead,
    staleTime: 60_000,
  });

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  // Если нет active и чаты загружены — открываем org
  useEffect(() => {
    if (!activeChatId && org?.id && canRead && !openOrg.isPending && chats.length === 0) {
      openOrg.mutate();
    }
    if (!activeChatId && chats.length > 0 && chats[0]) {
      setActiveChatId(chats[0].id);
      setMobileShowList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.length, activeChatId, org?.id, canRead]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Загрузка…
        </div>
      </AppLayout>
    );
  }

  if (!canRead) {
    return (
      <AppLayout>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">Чат</h1>
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Для доступа нужно право <code>chat.read</code>.
        </p>
      </AppLayout>
    );
  }

  if (!org) {
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
      {/* Заголовок страницы + мобильная навигация */}
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-brand-deep sm:text-2xl">
          Чат ассистента
        </h1>
        {/* Мобильная кнопка "Чаты" */}
        <button
          type="button"
          onClick={() => setMobileShowList((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent md:hidden"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {mobileShowList ? "К чату" : "Чаты"}
        </button>
        {/* Кнопка создания org-чата */}
        <Button
          size="sm"
          variant="outline"
          className="hidden md:flex"
          disabled={openOrg.isPending}
          onClick={() => openOrg.mutate()}
        >
          {openOrg.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          Общий чат
        </Button>
      </div>

      {/* Основной лейаут */}
      <div
        className="overflow-hidden rounded-2xl border border-border bg-background shadow-soft"
        style={{ height: "calc(100svh - 10rem)" }}
      >
        <div className="flex h-full">
          {/* ── Левая панель: список чатов ── */}
          <aside
            className={cn(
              "flex-col border-r border-border bg-card/50",
              // Desktop — всегда видна, Mobile — по togglel
              "hidden w-60 shrink-0 md:flex",
              mobileShowList && "flex w-full md:hidden md:w-60",
            )}
          >
            <div className="border-b border-border px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Чаты
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatList
                orgId={org.id}
                activeChatId={activeChatId}
                onSelect={(c) => {
                  setActiveChatId(c.id);
                  setMobileShowList(false);
                }}
              />
            </div>
            {/* Кнопка общего чата внутри панели */}
            <div className="border-t border-border p-2">
              <button
                type="button"
                disabled={openOrg.isPending}
                onClick={() => {
                  openOrg.mutate();
                  setMobileShowList(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {openOrg.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                Открыть общий чат
              </button>
            </div>
          </aside>

          {/* ── Правая часть: история сообщений ── */}
          <div className={cn("min-w-0 flex-1", mobileShowList && "hidden md:flex")}>
            {activeChat ? (
              <ChatWindow orgId={org.id} chat={activeChat} canWrite={canWrite} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                {openOrg.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
                      <MessageSquare className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <div className="max-w-xs">
                      <p className="font-semibold text-foreground">Выберите чат</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Или откройте общий чат организации
                      </p>
                    </div>
                    <Button onClick={() => openOrg.mutate()} disabled={openOrg.isPending}>
                      <MessageSquare className="mr-1.5 h-4 w-4" />
                      Открыть общий чат
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
