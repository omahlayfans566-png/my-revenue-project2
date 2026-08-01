import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

// ─── Global Error Handler ──────────────────────────────────────────────────
// Catch uncaught errors and unhandled promise rejections to prevent blank screens
window.onerror = (message, source, lineno, colno, error) => {
  console.error("[Global Error Handler]", { message, source, lineno, colno, error });
  return true; // Prevent default browser error handling
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
  event.preventDefault();
});

// ─── Service Worker Cleanup ─────────────────────────────────────────────────
// The vite-plugin-pwa SW (sw.js or generated workbox-*.js) is the ONLY one we keep.
// Any other service worker (old custom sw) is stale and must be unregistered,
// otherwise it serves the old cached bundle and breaks client-side navigation.
async function cleanupServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const keepUrl = "sw.js";

    for (const registration of registrations) {
      const swUrl =
        registration.active?.scriptURL ||
        registration.installing?.scriptURL ||
        registration.waiting?.scriptURL ||
        "";
      const isVitePwa = swUrl.includes(keepUrl);

      // Unregister ANY service worker that is NOT the vite-plugin-pwa one.
      // The old condition was inverted — it unregistered the correct SW and kept stale ones.
      if (swUrl && !isVitePwa) {
        await registration.unregister().catch(() => {});
        console.info("[SW Cleanup] Unregistered stale service worker:", swUrl);
      }
    }
  } catch {
    // Silently fail - SW cleanup is not critical to app boot
  }
}

// ─── Purge Stale Workbox Caches ─────────────────────────────────────────────
// Old caches (from a previous build) can serve stale index.html/js/css and
// cause blank screens after navigation. Remove every known workbox cache
// that does not belong to the currently active service worker revision.
async function purgeStaleCaches() {
  if (!("caches" in window)) return;

  try {
    const cacheNames = await caches.keys();
    const workboxPrefixes = [
      "workbox-precache",
      "workbox-runtime",
      "static-cache",
      "image-cache",
      "api-cache",
    ];
    const hasController = !!navigator.serviceWorker.controller;

    const toDelete = cacheNames.filter((name) => {
      const lower = name.toLowerCase();
      const isManaged = workboxPrefixes.some((p) => lower.includes(p));
      if (!isManaged) return false;
      // Keep the current precache while the new SW controls the page.
      if (lower.includes("workbox-precache")) {
        return !hasController;
      }
      return false;
    });

    await Promise.all(
      toDelete.map((name) => caches.delete(name).catch(() => false))
    );
    if (toDelete.length > 0) {
      console.info("[Cache Purge] Removed stale caches:", toDelete);
    }
  } catch {
    // Silently fail
  }
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────
(async () => {
  await cleanupServiceWorkers();
  // The vite-plugin-pwa registers its own SW via registerSW.js (bundled).
  // Purging here removes leftover caches before the new SW takes over.
  await purgeStaleCaches();
})();

// ─── Create Router ──────────────────────────────────────────────────────────
// Using createBrowserRouter (RouterProvider) instead of BrowserRouter
// to ensure full compatibility with React Router v7.
// The wildcard "/*" delegates all paths to App.tsx where <Routes> handles
// client-side routing. This is also required for deep links + SPA fallback.
const router = createBrowserRouter([
  {
    path: "/*",
    element: <App />,
  },
]);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);