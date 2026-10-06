import type { ReactNode } from "react";
import { useCurrentOrg } from "@/lib/org";
import { AppLayout } from "@/components/AppLayout";

export function isEmployeeRole(role: string | null | undefined) {
  return ["employee", "сотрудник"].includes(String(role || "").trim().toLowerCase());
}

export function EmployeeRestrictedPage({ children }: { children: ReactNode }) {
  const { org, isLoading } = useCurrentOrg();
  if (isLoading) return <AppLayout><p>Загрузка…</p></AppLayout>;
  if (isEmployeeRole(org?.role_code || org?.role_name)) {
    return <AppLayout><p>Этот раздел недоступен для сотрудников.</p></AppLayout>;
  }
  return children;
}
