import { lazy } from "react";

/**
 * Wraps React.lazy with a one-time automatic retry.
 *
 * When a lazy chunk fails to load (e.g. stale service-worker cache, a brief
 * network drop, or a temporary server hiccup), React.Suspense throws and an
 * error boundary can show a blank screen that requires a manual refresh.
 * Retrying the dynamic import after a short delay recovers from these
 * transient failures automatically — the user never sees a blank page.
 */
export const lazyWithRetry = <T extends object>(
  factory: () => Promise<{ default: React.ComponentType<T> }>
) => {
  return lazy(() =>
    factory().catch((err: unknown) => {
      console.warn("[Lazy Retry] Chunk load failed, retrying…", err);
      return new Promise<{ default: React.ComponentType<T> }>((resolve) => {
        setTimeout(() => resolve(factory()), 800);
      });
    })
  );
};