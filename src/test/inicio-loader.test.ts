import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session-context", () => ({
  sessionQueryOptions: () => ({ queryKey: ["auth", "session"] }),
}));

vi.mock("@/lib/query-options", () => ({
  dashboardSummaryQueryOptions: () => ({ queryKey: ["dashboard", "summary", "month"] }),
}));

import { Route } from "@/routes/_authenticated/inicio";

type LoaderContext = {
  queryClient: {
    getQueryData: (key: readonly unknown[]) => unknown;
    ensureQueryData: (options: unknown) => Promise<unknown>;
  };
};

const loader = Route.options.loader as (args: { context: LoaderContext }) => Promise<unknown>;

function contextWith(getQueryData: (key: readonly unknown[]) => unknown) {
  const ensureQueryData = vi.fn().mockResolvedValue({ ok: true });
  return {
    context: {
      queryClient: { getQueryData, ensureQueryData } satisfies LoaderContext["queryClient"],
    },
    ensureQueryData,
  };
}

describe("inicio loader — prefetch só com sessão já em cache", () => {
  it("não prefetcha o dashboard quando a sessão ainda não está no cache", async () => {
    const getQueryData = vi.fn().mockReturnValue(undefined);
    const { context, ensureQueryData } = contextWith(getQueryData);

    await expect(loader({ context })).resolves.toBeNull();
    expect(getQueryData).toHaveBeenCalledWith(["auth", "session"]);
    expect(ensureQueryData).not.toHaveBeenCalled();
  });

  it("prefetcha o dashboard quando a sessão já está no cache", async () => {
    const getQueryData = vi.fn().mockReturnValue({ id: "session-user" });
    const { context, ensureQueryData } = contextWith(getQueryData);

    await expect(loader({ context })).resolves.toEqual({ ok: true });
    expect(ensureQueryData).toHaveBeenCalledWith({
      queryKey: ["dashboard", "summary", "month"],
    });
  });

  it("degrada para null quando o prefetch do dashboard falha", async () => {
    const getQueryData = vi.fn().mockReturnValue({ id: "session-user" });
    const { context, ensureQueryData } = contextWith(getQueryData);
    ensureQueryData.mockRejectedValueOnce(new Error("401"));

    await expect(loader({ context })).resolves.toBeNull();
  });
});
