import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  SendHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/api";
import {
  orgApi,
  useCurrentOrg,
  type ChatMessage,
  type ChatProposal,
  type OrgChat,
} from "@/lib/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  validateSearch: z.object({ chatId: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Чат ассистента — Yaya.ЦифровойБот" },
      { property: "og:title", content: "Чат ассистента — Yaya.ЦифровойБот" },
    ],
  }),
  component: ChatPage,
});

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критичный",
};

function roleMeta(role: ChatMessage["role"]) {
  switch (role) {
    case "user":
      return { bubble: "bg-primary text-primary-foreground", align: "items-end" };
    case "assistant":
      return { bubble: "bg-card border border-border text-foreground", align: "items-start" };
    case "system":
      return {
        bubble: "bg-muted/70 text-muted-foreground border border-border/40 text-xs",
        align: "items-start",
      };
    default:
      return { bubble: "bg-muted text-foreground", align: "items-start" };
  }
}

/* ── Карточка предварительного просмотра задачи ── */
function TaskPreviewCard({ proposal }: { proposal: ChatProposal }) {
  const preview = proposal.parsed?.task_preview;
  if (!preview) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-background/80 text-foreground">
      <div className="bg-primary/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        📋 Предлагаемое ТЗ
      </div>
      <div className="divide-y divide-border/60">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold">{preview.title}</p>
          {preview.description && (
            <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
              {preview.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              PRIORITY_BADGE[preview.priority] ?? "bg-muted text-muted-foreground",
            )}
          >
            {PRIORITY_LABEL[preview.priority] ?? preview.priority}
          </span>
          {preview.deadline && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {new Date(preview.deadline).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {preview.acceptance_criteria && (
            <span className="text-[10px] text-muted-foreground">✓ Критерии приёмки</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Кнопки proposal ── */
function ProposalCard({
  orgId,
  proposal,
  actions,
  onDone,
}: {
  orgId: number;
  proposal: ChatProposal;
  actions: string[];
  onDone: (msgs: ChatMessage[], updatedProposal?: ChatProposal) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const alternatives = proposal.parsed?.alternatives ?? [];

  const accept = useMutation({
    mutationFn: () => orgApi.acceptProposal(orgId, proposal.id),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["automations", orgId] });
      onDone([res.message]);
      if (res.task) {
        const taskId = res.task.id;
        toast.success(`Задача #${taskId} создана`, {
          action: {
            label: "Открыть",
            onClick: () =>
              void navigate({ to: "/tasks/$taskId", params: { taskId: String(taskId) } }),
          },
        });
      } else if (res.automation) {
        toast.success(`Автоматизация #${res.automation.id} создана`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: () => orgApi.rejectProposal(orgId, proposal.id),
    onSuccess: () => toast("Предложение отклонено"),
    onError: (e: Error) => toast.error(e.message),
  });

  const changeBot = useMutation({
    mutationFn: (botCode: string) => orgApi.changeProposalBot(orgId, proposal.id, { botCode }),
    onSuccess: (res) => {
      onDone([res.assistant_message], res.proposal);
      if (proposal.chat_id) {
        void qc.invalidateQueries({ queryKey: ["chat-messages", orgId, proposal.chat_id] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = accept.isPending || reject.isPending || changeBot.isPending;
  const done = accept.isSuccess || reject.isSuccess;
  const taskId = accept.data?.task?.id;

  if (done) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {accept.isSuccess ? (
          <>
            <span className="text-xs text-emerald-600">
              ✓ {taskId ? `Задача #${taskId} создана` : "Выполнено"}
            </span>
            {taskId && (
              <Link
                to="/tasks/$taskId"
                params={{ taskId: String(taskId) }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Открыть <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">✗ Отклонено</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.includes("accept") && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => accept.mutate()}
            className="h-7 gap-1 text-xs"
          >
            {accept.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Создать
          </Button>
        )}
        {actions.includes("change_bot") && alternatives.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              const first = alternatives[0];
              if (alternatives.length === 1 && first) {
                changeBot.mutate(first.code);
              }
            }}
            className="h-7 gap-1 text-xs"
          >
            {changeBot.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bot className="h-3 w-3" />
            )}
            Сменить бота
          </Button>
        )}
        {(actions.includes("reject") || actions.includes("cancel")) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => reject.mutate()}
            className="h-7 gap-1 text-xs"
          >
            {reject.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            Отклонить
          </Button>
        )}
      </div>

      {(proposal.suggested_bot_code || alternatives.length > 0) && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Бот:
          <span className="ml-1 font-medium text-foreground">
            {(() => {
              const current =
                alternatives.find((b) => b.code === proposal.suggested_bot_code) ?? alternatives[0];
              return current?.name
                ? `${current.name} (${current.code})`
                : proposal.suggested_bot_code;
            })()}
          </span>
        </div>
      )}

      {actions.includes("change_bot") && alternatives.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {alternatives.map((alt) => (
            <button
              key={alt.id}
              type="button"
              disabled={busy}
              onClick={() => changeBot.mutate(alt.code)}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {alt.name ? `${alt.name} (${alt.code})` : alt.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Одно сообщение ── */
function MessageBubble({
  msg,
  orgId,
  proposals,
  onNewMessages,
}: {
  msg: ChatMessage;
  orgId: number;
  proposals: ChatProposal[];
  onNewMessages: (msgs: ChatMessage[], updatedProposal?: ChatProposal) => void;
}) {
  const { bubble, align } = roleMeta(msg.role);
  const isUser = msg.role === "user";
  const proposalId = msg.meta?.proposal_id;
  const actions: string[] = msg.meta?.actions ?? [];
  const proposal = proposalId ? proposals.find((p) => p.id === proposalId) : null;

  return (
    <div className={cn("flex flex-col gap-0.5", align)}>
      {!isUser && msg.role !== "system" && (
        <p className="px-1 text-[10px] font-medium text-muted-foreground">
          {msg.author_name ?? "Ассистент"}
        </p>
      )}
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[72%]",
          bubble,
          isUser ? "rounded-br-sm" : msg.role === "assistant" ? "rounded-bl-sm" : "rounded-bl-sm",
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        {proposal && <TaskPreviewCard proposal={proposal} />}
        {proposal && actions.length > 0 && (
          <ProposalCard
            orgId={orgId}
            proposal={proposal}
            actions={actions}
            onDone={onNewMessages}
          />
        )}
        {msg.meta?.task_id && msg.role === "system" && (
          <Link
            to="/tasks/$taskId"
            params={{ taskId: String(msg.meta.task_id) }}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Перейти к задаче #{msg.meta.task_id} <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <time className={cn("px-1 text-[10px] text-muted-foreground", isUser && "text-right")}>
        {formatDate(msg.created_at)}
      </time>
    </div>
  );
}

/* ── Панель автоматизаций ── */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

function AutomationsPanel({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const { data: automations = [] } = useQuery({
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
  const hide = useMutation({
    mutationFn: (id: number) => orgApi.updateAutomation(orgId, id, "ARCHIVED"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["automations", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const active = automations.filter((a) => a.status !== "ARCHIVED");
  if (!active.length) return null;
  return (
    <div className="border-t border-border bg-card/50 px-4 py-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Автоматизации ({active.length})
      </p>
      <ul className="space-y-1">
        {active.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-1.5 text-xs"
          >
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                STATUS_COLORS[a.status] ?? "bg-muted",
              )}
            >
              {a.status}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground">{a.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                {a.bot_code && <span className="truncate">Бот: {a.bot_code}</span>}
                <span>{formatDate(a.created_at)}</span>
                {a.result_task_id && (
                  <Link
                    to="/tasks/$taskId"
                    params={{ taskId: String(a.result_task_id) }}
                    className="shrink-0 text-[10px] text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Задача #{a.result_task_id}
                  </Link>
                )}
              </p>
            </div>
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() =>
                toggle.mutate({ id: a.id, status: a.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })
              }
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={a.status === "ACTIVE" ? "Пауза" : "Возобновить"}
            >
              {a.status === "ACTIVE" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <button
              type="button"
              disabled={hide.isPending}
              onClick={() => hide.mutate(a.id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Скрыть"
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Список чатов ── */
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
  if (isPending)
    return (
      <div className="space-y-1.5 p-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  return (
    <ul className="space-y-0.5 p-2">
      {chats.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
              activeChatId === c.id
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground hover:bg-accent",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                c.type === "org"
                  ? "bg-primary/15 text-primary"
                  : "bg-accent text-accent-foreground",
              )}
            >
              {c.type === "org" ? (
                <MessageSquare className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
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
        <li className="py-6 text-center text-xs text-muted-foreground">Чатов пока нет</li>
      )}
    </ul>
  );
}

/* ── Область сообщений ── */
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
  const [localProposals, setLocalProposals] = useState<ChatProposal[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const { data: serverMsgs = [], isPending: historyPending } = useQuery({
    queryKey: ["chat-messages", orgId, chat.id],
    queryFn: () => orgApi.chatMessages(orgId, chat.id, 100),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    setLocalMsgs([]);
    setLocalProposals([]);
  }, [chat.id]);

  const allMsgs = [...serverMsgs];
  localMsgs.forEach((lm) => {
    if (!allMsgs.find((sm) => sm.id === lm.id)) allMsgs.push(lm);
  });
  allMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
      if (res.proposal) {
        setLocalProposals((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return ids.has(res.proposal!.id) ? prev : [...prev, res.proposal!];
        });
      }
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
      {/* Шапка */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/40 px-4 py-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            chat.type === "org" ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground",
          )}
        >
          {chat.type === "org" ? (
            <MessageSquare className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{chat.title}</p>
          {chat.bot_code && (
            <p className="truncate text-[10px] text-muted-foreground">{chat.bot_code}</p>
          )}
        </div>
      </div>

      {/* История */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {historyPending ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-muted" />
              </div>
            ))}
          </div>
        ) : allMsgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
              <MessageSquare className="h-7 w-7 text-accent-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Начните диалог</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Опишите задачу или запрос — ассистент предложит план.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {allMsgs.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                orgId={orgId}
                proposals={localProposals}
                onNewMessages={(newMsgs, updatedProposal) => {
                  setLocalMsgs((prev) => {
                    const ids = new Set(prev.map((m) => m.id));
                    return [...prev, ...newMsgs.filter((m) => !ids.has(m.id))];
                  });
                  if (updatedProposal) {
                    setLocalProposals((prev) => {
                      const exists = prev.find((p) => p.id === updatedProposal.id);
                      if (exists) {
                        return prev.map((p) => (p.id === updatedProposal.id ? updatedProposal : p));
                      }
                      return [...prev, updatedProposal];
                    });
                  }
                }}
              />
            ))}
            {send.isPending && (
              <div className="flex flex-col items-start gap-0.5">
                <p className="px-1 text-[10px] font-medium text-muted-foreground">Ассистент</p>
                <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: `${i * 160}ms` }}
                      />
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">генерирует ответ…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {chat.type === "org" && <AutomationsPanel orgId={orgId} />}

      {canWrite ? (
        <div className="shrink-0 border-t border-border bg-card/60 px-3 py-2.5 backdrop-blur">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/10">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напишите запрос ассистенту…"
              rows={1}
              disabled={send.isPending}
              className="max-h-36 min-h-[1.75rem] flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 disabled:opacity-60"
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
          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
            ⌘+Enter — отправить · ответ 1–5 сек
          </p>
        </div>
      ) : (
        <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          Нет права <code>chat.write</code> — только просмотр.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Главная страница
═══════════════════════════════════════════════════════════ */
function ChatPage() {
  const { chatId: initialChatId } = Route.useSearch();
  const { org, can, isLoading } = useCurrentOrg();
  const qc = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<number | null>(initialChatId ?? null);
  const [mobileShowList, setMobileShowList] = useState(!initialChatId);

  const canRead = can("chat.read");
  const canWrite = can("chat.write");

  const openOrg = useMutation({
    mutationFn: () => orgApi.openOrgChat(org!.id),
    onSuccess: (chat) => {
      void qc.invalidateQueries({ queryKey: ["chats", org?.id] });
      setActiveChatId(chat.id);
      setMobileShowList(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: chats = [], isPending: chatsLoading } = useQuery({
    queryKey: ["chats", org?.id],
    queryFn: () => orgApi.chats(org!.id),
    enabled: !!org?.id && canRead,
    staleTime: 60_000,
  });

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    if (!canRead || chatsLoading || activeChatId) return;
    if (chats.length === 0 && !openOrg.isPending) {
      openOrg.mutate();
    } else if (chats.length > 0 && chats[0]) {
      setActiveChatId(chats[0].id);
      setMobileShowList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.length, chatsLoading, activeChatId, canRead]);

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
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">Чат ассистента</h1>
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> Нужно право <code>chat.read</code>.
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
    <AppLayout fullscreen>
      <div className="flex h-[calc(100svh-56px)] min-h-0 flex-1 flex-col">
        {/* Мобильная панель навигации */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card/60 px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileShowList((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {mobileShowList ? "К чату" : "Чаты"}
          </button>
          {activeChat && !mobileShowList && (
            <span className="truncate text-sm font-medium text-foreground">{activeChat.title}</span>
          )}
          <Link
            to="/tasks"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Задачи <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Основной layout — занимает всё оставшееся пространство */}
        <div className="flex min-h-0 flex-1 overflow-hidden border-t border-border">
          <div className="flex h-full min-h-0 w-full">
            {/* Левая панель */}
            <aside
              className={cn(
                "flex-col h-full min-h-0 border-r border-border bg-card/50",
                "hidden w-56 shrink-0 md:flex",
                mobileShowList && "flex w-full md:hidden",
              )}
            >
              <div className="border-b border-border px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Чат ассистента
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
            </aside>

            {/* Правая часть */}
            <div
              className={cn(
                "min-h-0 min-w-0 flex-1",
                mobileShowList && "hidden md:flex md:flex-col",
              )}
            >
              {activeChat ? (
                <ChatWindow orgId={org.id} chat={activeChat} canWrite={canWrite} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                  {openOrg.isPending || chatsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                        <MessageSquare className="h-7 w-7 text-accent-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Выберите чат слева</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
