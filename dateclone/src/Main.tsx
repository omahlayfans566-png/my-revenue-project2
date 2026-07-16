// import { StrictMode } from "react";
// import { createRoot } from "react-dom/client";
// import { BrowserRouter } from "react-router-dom";
// import "./index.css";
// import App from "./App.tsx";

// createRoot(document.getElementById("root")!).render(
//   <StrictMode>
//     <BrowserRouter>
//       <App />
//     </BrowserRouter>
//   </StrictMode>
// );


import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

// ─── Service Worker Cleanup ──────────────────────────────────────────────────
// vite-plugin-pwa registers its own SW. We must unregister any old/stale
// service workers that conflict (e.g. the old custom sw.js).
if ("serviceWorker" in navigator) {
  // Unregister any service worker that is NOT the one from vite-plugin-pwa
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      const swUrl = registration.active?.scriptURL || "";
      // Only keep the vite-plugin-pwa service worker
      // The generated SW has a unique hash in its URL (e.g. sw.js?scope=... or with hash)
      // We keep any registered by workbox/vite
      if (swUrl && !swUrl.includes("sw.js")) {
        registration.unregister().catch(() => {});
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

