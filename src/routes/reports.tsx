import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmployeeReportsWorkspace } from "@/components/reports/EmployeeReportsWorkspace";

export const Route = createFileRoute("/reports")({ component: ReportsPage });
function ReportsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/reports") return <Outlet />;
  return (
    <AppLayout wide>
      <EmployeeReportsWorkspace />
    </AppLayout>
  );
}
