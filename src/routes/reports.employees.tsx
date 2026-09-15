import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmployeeReportsWorkspace } from "@/components/reports/EmployeeReportsWorkspace";

/** Kept as a direct URL for links; /reports remains the same all-employees overview. */
export const Route = createFileRoute("/reports/employees")({ component: EmployeesReportsRoute });
function EmployeesReportsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/reports/employees") return <Outlet />;
  return (
    <AppLayout wide>
      <EmployeeReportsWorkspace />
    </AppLayout>
  );
}
