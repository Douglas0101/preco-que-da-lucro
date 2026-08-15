import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await authClient.getSession();
    if (error || !data?.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: `${location.pathname}${location.searchStr}${location.hash}` },
      });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
