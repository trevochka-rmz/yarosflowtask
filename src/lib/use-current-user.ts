import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.me()).user,
    retry: false,
    staleTime: 60_000,
  });
}
