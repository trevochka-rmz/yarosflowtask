import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmployeeReportsDashboard } from "@/components/reports/EmployeeReportsDashboard";

/** Kept as a direct URL for links; /reports remains the same all-employees overview. */
export const Route = createFileRoute("/reports/employees")({ component: EmployeesReportsRoute });
function EmployeesReportsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/reports/employees") return <Outlet />;
  return (
    <AppLayout wide>
      <EmployeeReportsDashboard />
    </AppLayout>
  );
}
