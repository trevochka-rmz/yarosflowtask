import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import logo from "@/assets/yaros-logo.png.asset.json";
import { telegramLogin } from "@/lib/api";
import { TELEGRAM_BOT_USERNAME, type TelegramWidgetUser } from "@/lib/auth";

export function TelegramLoginPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    (window as unknown as { onTelegramAuth?: (u: TelegramWidgetUser) => void }).onTelegramAuth =
      async (user: TelegramWidgetUser) => {
        setPending(true);
        try {
          await telegramLogin(user);
          await queryClient.invalidateQueries({ queryKey: ["me"] });
          toast.success("Вход выполнен");
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setPending(false);
        }
      };

    const el = containerRef.current;
    if (el && !el.querySelector("script")) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      el.appendChild(script);
    }

    return () => {
      delete (window as unknown as { onTelegramAuth?: unknown }).onTelegramAuth;
    };
  }, [queryClient]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <img
          src={logo.url}
          alt="YAROS.TaskFlow"
          className="mx-auto h-16 w-16 rounded-full sm:h-20 sm:w-20"
        />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-brand-deep sm:text-2xl">
          YAROS<span className="text-primary">.TaskFlow</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Вход только через Telegram — тот же аккаунт, что и в Mini App.
        </p>

        <div ref={containerRef} className="mt-6 flex min-h-[3rem] justify-center" />

        {pending ? <p className="mt-4 text-sm text-muted-foreground">Выполняем вход…</p> : null}
      </div>
    </div>
  );
}
