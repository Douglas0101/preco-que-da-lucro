import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";
import { initWebVitals } from "@/lib/web-vitals.client";

// router.tsx is also part of the SSR graph; the isomorphic wrapper keeps the
// web-vitals collector out of the server bundle (import protection).
const initWebVitalsOnClient = createIsomorphicFn().client(initWebVitals);
initWebVitalsOnClient();

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
