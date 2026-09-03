import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { hasAuth } from "./auth";

/** Реагирует на появление/удаление token в localStorage. */
export function useAuthPresence() {
  // SSR и первый браузерный render должны совпадать. localStorage/Telegram
  // доступны только после mount, иначе React получает hydration mismatch (#418).
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    const sync = () => setAuthed(hasAuth());
    sync();
    window.addEventListener("yaros:auth-changed", sync);
    window.addEventListener("storage", sync);
    const t = window.setTimeout(sync, 400);
    return () => {
      window.removeEventListener("yaros:auth-changed", sync);
      window.removeEventListener("storage", sync);
      window.clearTimeout(t);
    };
  }, []);
  return authed;
}

export function useCurrentUser() {
  const authed = useAuthPresence();
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [authed, queryClient]);

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.me()).user,
    enabled: authed,
    retry: false,
    staleTime: 60_000,
  });
}
