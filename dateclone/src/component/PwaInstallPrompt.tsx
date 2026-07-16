import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import "../style/pwaInstall.css";

// ─── Type Definitions ──────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
    "pwa-install-ready": CustomEvent<BeforeInstallPromptEvent>;
  }
  interface Window {
    __deferredPrompt: BeforeInstallPromptEvent | null;
  }
}

// ─── Local Storage Keys ────────────────────────────────────────────────────────
const LS_DISMISSED = "pwa_install_dismissed";
const LS_REMIND_LATER = "pwa_install_remind_later";
const LS_INSTALLED = "pwa_installed";
const REMINDER_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Helper: Check standalone / installed ──────────────────────────────────────
function isStandalone(): boolean {
  return (
    localStorage.getItem(LS_INSTALLED) === "true" ||
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone: boolean }).standalone === true)
  );
}

// ─── Helper: Detect iOS Safari (including iPadOS 13+) ──────────────────────────
function isIOSDevice(): boolean {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports as MacIntel
  if (
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1 &&
    !(window as unknown as Record<string, unknown>).MSStream
  ) {
    return true;
  }
  return false;
}

// ─── Helper: Detect in-app browsers (cannot install) ───────────────────────────
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("fbav") ||
    ua.includes("fban") ||
    ua.includes("instagram") ||
    ua.includes("messenger") ||
    ua.includes("wv") ||
    /; wv\)/.test(ua)
  );
}

// ─── Helper: Check if browser supports beforeinstallprompt ─────────────────────
function supportsBeforeInstallPrompt(): boolean {
  return "onbeforeinstallprompt" in window;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [isIOS] = useState(() => isIOSDevice());
  const mountedRef = useRef(true);

  // ─── CRITICAL: Recover deferredPrompt from window.__deferredPrompt on mount ──
  // The beforeinstallprompt event fires BEFORE React loads. The inline script
  // in index.html saves it to window.__deferredPrompt. We recover it here.
  useEffect(() => {
    if (installed) return;
    if (window.__deferredPrompt) {
      setDeferredPrompt(window.__deferredPrompt);
      window.__deferredPrompt = null; // clear after recovery
    }
  }, [installed]);

  // ─── Listen for custom pwa-install-ready event (fallback) ────────────────────
  useEffect(() => {
    if (installed) return;

    const handler = (e: CustomEvent<BeforeInstallPromptEvent>) => {
      setDeferredPrompt(e.detail);
    };

    window.addEventListener("pwa-install-ready", handler as EventListener);
    return () => window.removeEventListener("pwa-install-ready", handler as EventListener);
  }, [installed]);

  // ─── beforeinstallprompt handler (direct, in case React mounts before event) ─
  useEffect(() => {
    if (installed || isInAppBrowser()) return;

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [installed]);

  // ─── appinstalled handler ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
      setShowIOSInstructions(false);
      localStorage.setItem(LS_INSTALLED, "true");
      localStorage.removeItem(LS_DISMISSED);
      localStorage.removeItem(LS_REMIND_LATER);

      toast.success("DateClone has been installed successfully.", {
        duration: 5000,
        icon: "🎉",
        style: {
          borderRadius: "12px",
          background: "#1a1a2e",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      });
    };

    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  // ─── Check on mount if display-mode changes ────────────────────────────────
  useEffect(() => {
    if (installed) return;
    const mql = window.matchMedia("(display-mode: standalone)");
    const handler = () => {
      if (mql.matches) {
        setInstalled(true);
        localStorage.setItem(LS_INSTALLED, "true");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [installed]);

  // ─── Update canInstall based on state ──────────────────────────────────────
  const updateCanInstall = useCallback(() => {
    const hasPrompt = deferredPrompt !== null;
    const canShowPrompt = supportsBeforeInstallPrompt() ? hasPrompt : false;
    setCanInstall(
      !installed &&
      !isInAppBrowser() &&
      !isStandalone() &&
      (canShowPrompt || isIOS)
    );
  }, [installed, isIOS, deferredPrompt]);

  // ─── Update canInstall when deferredPrompt changes ─────────────────────────
  useEffect(() => {
    updateCanInstall();
  }, [deferredPrompt, updateCanInstall]);

  // ─── Show banner after a short delay if eligible ───────────────────────────
  useEffect(() => {
    if (installed) return;
    if (isInAppBrowser()) return;

    const dismissed = localStorage.getItem(LS_DISMISSED) === "true";
    if (dismissed) return;

    const remindLater = localStorage.getItem(LS_REMIND_LATER);
    if (remindLater) {
      const remindTime = parseInt(remindLater, 10);
      if (Date.now() < remindTime) return;
      localStorage.removeItem(LS_REMIND_LATER);
    }

    // Wait 1.5s before showing banner to avoid overwhelming
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        if (isIOS) {
          setShowIOSInstructions(true);
        } else if (deferredPrompt) {
          setShowBanner(true);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [installed, deferredPrompt, isIOS]);

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── Install handler ───────────────────────────────────────────────────────
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // Try to recover one more time
      if (window.__deferredPrompt) {
        setDeferredPrompt(window.__deferredPrompt);
        window.__deferredPrompt = null;
      }
      // If still null and browser supports it, show banner again
      if (!window.__deferredPrompt && !isIOS) {
        toast("Open browser menu and tap 'Install' or 'Add to Home Screen'", {
          icon: "ℹ️",
          duration: 5000,
        });
        return;
      }
    }
    const promptToUse = deferredPrompt || window.__deferredPrompt;
    if (!promptToUse) return;
    try {
      await promptToUse.prompt();
      const result = await promptToUse.userChoice;
      if (result.outcome === "accepted") {
        setInstalled(true);
        localStorage.setItem(LS_INSTALLED, "true");
        setDeferredPrompt(null);
        window.__deferredPrompt = null;
        setShowBanner(false);
        toast.success("DateClone has been installed successfully.", {
          duration: 5000,
          icon: "🎉",
        });
      } else {
        // User dismissed native prompt — keep floating button but close banner
        setShowBanner(false);
        setDeferredPrompt(null);
        window.__deferredPrompt = null;
      }
    } catch (err) {
      console.error("Install prompt failed:", err);
      setShowBanner(false);
    }
  }, [deferredPrompt, isIOS]);

  // ─── Dismiss banner (remember permanently) ────────────────────────────────
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSInstructions(false);
    localStorage.setItem(LS_DISMISSED, "true");
  }, []);

  // ─── Remind later ───────────────────────────────────────────────────────────
  const handleRemindLater = useCallback(() => {
    setShowBanner(false);
    setShowIOSInstructions(false);
    localStorage.setItem(LS_REMIND_LATER, String(Date.now() + REMINDER_DELAY_MS));
  }, []);

  // ─── Floating button click handler ──────────────────────────────────────────
  const handleFloatingClick = useCallback(() => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      handleInstall();
    } else if (window.__deferredPrompt) {
      // Recover from global and install
      setDeferredPrompt(window.__deferredPrompt);
      const prompt = window.__deferredPrompt;
      window.__deferredPrompt = null;
      prompt.prompt().then(() => {
        prompt.userChoice.then((result) => {
          if (result.outcome === "accepted") {
            setInstalled(true);
            localStorage.setItem(LS_INSTALLED, "true");
            toast.success("DateClone has been installed successfully.", {
              duration: 5000,
              icon: "🎉",
            });
          }
        });
      }).catch(console.error);
    } else {
      // For browsers that don't support beforeinstallprompt but can still PWA
      if (isIOS) {
        setShowIOSInstructions(true);
      } else {
        toast("Open browser menu and tap 'Install' or 'Add to Home Screen'", {
          icon: "ℹ️",
          duration: 5000,
        });
      }
    }
  }, [isIOS, deferredPrompt, handleInstall]);

  // ─── Render Nothing If Installed ────────────────────────────────────────────
  if (installed) return null;

  return (
    <>
      {/* ── Floating Install Button ──────────────────────────────────────── */}
      {canInstall && (
        <button
          className="pwa-floating-install"
          onClick={handleFloatingClick}
          aria-label="Install DateClone app"
          title="Install DateClone"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="pwa-floating-label">Install App</span>
          <span className="pwa-floating-label-short">Install</span>
        </button>
      )}

      {/* ── Install Banner Popup ─────────────────────────────────────────── */}
      {showBanner && (
        <div
          className="pwa-popup-overlay"
          onClick={handleDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="Install DateClone"
        >
          <div className="pwa-popup" onClick={(e) => e.stopPropagation()}>
            <button className="pwa-popup-close" onClick={handleDismiss} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="pwa-popup-icon">
              <span>D</span>
            </div>
            <h2 className="pwa-popup-title">Install DateClone</h2>
            <p className="pwa-popup-message">
              Install DateClone for faster access, offline support, instant notifications, and a full-screen app experience.
            </p>
            <ul className="pwa-popup-benefits">
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4081" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                One-tap access from home screen
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4081" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                Works offline and saves data
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4081" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                Push notifications for matches & messages
              </li>
            </ul>
            <div className="pwa-popup-actions">
              <button className="pwa-popup-btn pwa-popup-btn-primary" onClick={handleInstall}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Install Now
              </button>
              <button className="pwa-popup-btn pwa-popup-btn-secondary" onClick={handleRemindLater}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS Instructions Popup ────────────────────────────────────────── */}
      {showIOSInstructions && (
        <div
          className="pwa-popup-overlay"
          onClick={handleDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="Install DateClone on iOS"
        >
          <div className="pwa-popup" onClick={(e) => e.stopPropagation()}>
            <button className="pwa-popup-close" onClick={handleDismiss} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="pwa-popup-icon">
              <span>D</span>
            </div>
            <h2 className="pwa-popup-title">Install DateClone</h2>
            <p className="pwa-popup-message">
              Install DateClone on your iPhone or iPad for the best experience — full screen, offline, and notifications.
            </p>
            <div className="pwa-ios-instructions">
              <ol className="pwa-ios-steps">
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M12 6v.01M12 18v.01M6 12h.01M18 12h.01"/></svg>
                  </span>
                  <div>
                    Tap the <strong>Share</strong> button{" "}
                    <span className="pwa-ios-share-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    </span>{" "}
                    in Safari
                  </div>
                </li>
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  </span>
                  <div>
                    Scroll down and tap <strong>Add to Home Screen</strong>
                  </div>
                </li>
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </span>
                  <div>
                    Tap <strong>Add</strong> in the top-right corner
                  </div>
                </li>
              </ol>
            </div>
            <div className="pwa-popup-actions">
              <button className="pwa-popup-btn pwa-popup-btn-primary" onClick={handleDismiss}>
                Got it
              </button>
              <button className="pwa-popup-btn pwa-popup-btn-secondary" onClick={handleRemindLater}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Hook: Check if PWA is installed ───────────────────────────────────────────
export function useIsPwaInstalled(): boolean {
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const check = () => setInstalled(isStandalone());
    window.addEventListener("appinstalled", check);
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", check);
    return () => {
      window.removeEventListener("appinstalled", check);
      mql.removeEventListener("change", check);
    };
  }, []);

  return installed;
}

// ─── Hook: Install prompt for manual triggering ────────────────────────────────
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Recover from global store on mount
  useEffect(() => {
    if (window.__deferredPrompt) {
      setDeferredPrompt(window.__deferredPrompt);
    }
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    const prompt = deferredPrompt || window.__deferredPrompt;
    if (!prompt) return false;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") {
        localStorage.setItem(LS_INSTALLED, "true");
        window.__deferredPrompt = null;
        return true;
      }
    } catch (err) {
      console.error("Install failed:", err);
    }
    return false;
  }, [deferredPrompt]);

  return { canInstall: !!(deferredPrompt || window.__deferredPrompt), install };
}